/**
 * タスクカードコンポーネント
 *
 * 個別のタスク実行を表示するカード
 * @see docs/TASK_EXECUTION_API.md
 */

import { CheckCircle2, Circle, PlayCircle, XCircle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { isParentRole } from '../../utils'
import type { TaskExecution, Member, ExecutionStatus } from '../../types'

/**
 * TaskCardコンポーネントのProps
 */
export interface TaskCardProps {
  /** タスク実行データ */
  task: TaskExecution
  /** 担当者情報（結合済み） */
  assignee?: Member
  /** カードクリック時のハンドラ */
  onClick?: (task: TaskExecution) => void
  /** ステータスアイコンクリック時のハンドラ */
  onStatusClick?: (task: TaskExecution) => void
}

/**
 * ステータスに応じたアイコンを取得
 */
function getStatusIcon(status: ExecutionStatus) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    case 'IN_PROGRESS':
      return <PlayCircle className="w-5 h-5 text-shazam-400" />
    case 'CANCELLED':
      return <XCircle className="w-5 h-5 text-red-400/50" />
    default:
      return <Circle className="w-5 h-5 text-white/30" />
  }
}

/**
 * ステータスに応じたバッジを取得
 */
function getStatusBadge(status: ExecutionStatus) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="success">完了</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="info">実行中</Badge>
    case 'CANCELLED':
      return <Badge variant="danger">キャンセル</Badge>
    default:
      return <Badge variant="default">未着手</Badge>
  }
}

/**
 * タスクカードコンポーネント
 *
 * Dashboard画面で使用される個別タスクの表示カード
 *
 * @example
 * ```tsx
 * <TaskCard
 *   task={taskExecution}
 *   assignee={member}
 *   onClick={(task) => navigate(`/tasks/${task.id}`)}
 *   onStatusClick={(task) => handleStatusChange(task)}
 * />
 * ```
 */
export function TaskCard({ task, assignee, onClick, onStatusClick }: TaskCardProps) {
  const handleCardClick = () => {
    onClick?.(task)
  }

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStatusClick?.(task)
  }

  // タスク名の取得（NOT_STARTEDの場合はsnapshotがない可能性があるため）
  const taskName = task.taskSnapshot?.name || '(タスク名未設定)'
  const estimatedMinutes = task.taskSnapshot?.estimatedMinutes || 0

  return (
    <Card
      variant="glass"
      hoverable
      className="flex items-center gap-4 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* ステータスアイコン（クリック可能） */}
      <button
        className="flex-shrink-0 hover:scale-110 transition-transform"
        onClick={handleStatusClick}
        aria-label={`ステータス: ${task.status}`}
      >
        {getStatusIcon(task.status)}
      </button>

      {/* タスク情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`font-medium truncate ${
              task.status === 'COMPLETED'
                ? 'text-white/50 line-through'
                : task.status === 'CANCELLED'
                  ? 'text-white/30 line-through'
                  : 'text-white'
            }`}
          >
            {taskName}
          </span>
          {getStatusBadge(task.status)}
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          {estimatedMinutes > 0 && <span>{estimatedMinutes}分</span>}
          {assignee && (
            <div className="flex items-center gap-1">
              <Avatar
                name={assignee.name}
                size="sm"
                role={assignee.role}
                variant={isParentRole(assignee.role) ? 'parent' : 'child'}
              />
              <span>{assignee.name}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

