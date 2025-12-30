/**
 * ダッシュボードページ
 *
 * 今日のタスク一覧、メンバー進捗、空き時間を表示するホーム画面
 * CQRSパターン: DashboardQueryServiceを使用して一括データ取得
 */

import { useState, useCallback, useMemo } from 'react'
import { RefreshCw, ListTodo, Users, Clock, CheckCircle2, Circle, PlayCircle, Calendar, ChevronDown } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { ProgressSummaryCard } from '../components/dashboard'
import { TaskActionModal } from '../components/dashboard/TaskActionModal'
import { MemberAvailabilitySection } from '../components/dashboard/MemberAvailabilitySection'
import { useDashboard, useMember } from '../hooks'
import { useAuth } from '../contexts'
import { formatJa, toISODateString, isParentRole } from '../utils'
import { getFamilyRoleLabel } from '../utils/familyRole'
import type { TodayTaskDto, MemberTaskSummaryDto } from '../api/dashboard'
import type { FamilyRole, Member } from '../types'

/**
 * ステータスに応じたアイコンを取得
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    case 'IN_PROGRESS':
      return <PlayCircle className="w-5 h-5 text-shazam-400" />
    default:
      return <Circle className="w-5 h-5 text-white/30" />
  }
}

/**
 * ステータスに応じたバッジを取得
 */
function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="success">完了</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="info">進行中</Badge>
    default:
      return <Badge variant="default">やること</Badge>
  }
}

/**
 * 今日のタスクカードコンポーネント
 */
interface TodayTaskCardProps {
  task: TodayTaskDto
  onClick: (task: TodayTaskDto) => void
  /** 将来のタスク用に日付を表示するか */
  showDate?: boolean
}

function TodayTaskCard({ task, onClick, showDate = false }: TodayTaskCardProps) {
  const handleClick = () => onClick(task)

  return (
    <Card
      variant="glass"
      hoverable
      className="flex items-center gap-4 cursor-pointer"
      onClick={handleClick}
    >
      {/* ステータスアイコン */}
      <div className="flex-shrink-0">
        {getStatusIcon(task.status)}
      </div>

      {/* タスク情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`font-medium truncate ${
              task.status === 'COMPLETED'
                ? 'text-white/50 line-through'
                : 'text-white'
            }`}
          >
            {task.taskName}
          </span>
          {getStatusBadge(task.status)}
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          {/* 期限が今日じゃない場合は日付を表示 */}
          {showDate && task.scheduledDate && (
            <span className="flex items-center gap-1 text-shazam-400">
              <Calendar className="w-3.5 h-3.5" />
              {formatJa(new Date(task.scheduledDate), 'M月d日')}
            </span>
          )}
          {task.scheduledStartTime && task.scheduledEndTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {task.scheduledStartTime} - {task.scheduledEndTime}
            </span>
          )}
          <span className="flex items-center gap-1 whitespace-nowrap">
            {task.scope === 'FAMILY' ? (
              <Users className="w-3.5 h-3.5" />
            ) : (
              <span className="w-3.5 h-3.5">👤</span>
            )}
            {task.scope === 'FAMILY' ? '家族' : '個人'}
          </span>
          {task.assigneeMemberName && (
            <span className="text-coral-400">
              {task.assigneeMemberName}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

/**
 * メンバー進捗カードコンポーネント
 */
interface MemberProgressCardProps {
  summary: MemberTaskSummaryDto
}

function MemberProgressCard({ summary }: MemberProgressCardProps) {
  const progress = summary.totalCount > 0
    ? Math.round((summary.completedCount / summary.totalCount) * 100)
    : 0
  const familyRole = summary.familyRole as FamilyRole

  return (
    <Card variant="glass" className="min-w-[140px] flex-shrink-0">
      <div className="flex flex-col items-center gap-2">
        <Avatar
          name={summary.memberName}
          size="lg"
          role={familyRole}
          variant={isParentRole(familyRole) ? 'parent' : 'child'}
        />
        <div className="text-center">
          <p className="font-medium text-white text-sm">{summary.memberName}</p>
          <p className="text-xs text-white/50">
            {getFamilyRoleLabel(familyRole)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-coral-400">
            {summary.completedCount}/{summary.totalCount}
          </p>
          <p className="text-xs text-white/50">完了</p>
        </div>
        {/* プログレスバー */}
        <div className="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-coral-500 to-shazam-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  )
}

/**
 * ダッシュボードページ
 */
export function Dashboard() {
  const today = new Date()
  const todayStr = toISODateString(today)
  const { user } = useAuth()

  // 選択中のタスク（モーダル表示用）
  const [selectedTask, setSelectedTask] = useState<TodayTaskDto | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  // ダッシュボードデータ取得（CQRS Query）
  const {
    todayTasks,
    memberSummaries,
    memberAvailabilities,
    loading,
    error,
    refetch,
    startTask,
    completeTask,
    assignTask,
    clearError,
  } = useDashboard(todayStr)

  // メンバー一覧取得（モーダルの担当者選択用）
  const { members, fetchMembers } = useMember()

  // 初回ロード時にメンバーも取得
  useState(() => {
    fetchMembers()
  })

  // タスクを今日のタスクと将来のタスクに分離
  const { todayActiveTasks, completedTasks, futureTasks } = useMemo(() => {
    const todayActive = todayTasks.filter((task) => {
      // キャンセル済みは除外
      if (task.status === 'CANCELLED') return false
      // 完了済みは除外
      if (task.status === 'COMPLETED') return false
      // 予定日が今日のタスク
      return task.scheduledDate === todayStr
    })
    
    const completed = todayTasks.filter((task) => {
      return task.status === 'COMPLETED' && task.scheduledDate === todayStr
    })
    
    const future = todayTasks.filter((task) => {
      if (task.status === 'CANCELLED') return false
      // 予定日が今日より後のタスク
      return task.scheduledDate > todayStr
    })
    
    return { todayActiveTasks: todayActive, completedTasks: completed, futureTasks: future }
  }, [todayTasks, todayStr])

  // 進捗サマリーの計算（今日のタスクのみ）
  const { completedCount, totalCount } = useMemo(() => {
    // 完了数はcompletedTasksの数、総数はactive + completed
    return { 
      completedCount: completedTasks.length, 
      totalCount: todayActiveTasks.length + completedTasks.length 
    }
  }, [todayActiveTasks, completedTasks])

  /**
   * タスククリック時の処理（モーダル表示）
   */
  const handleTaskClick = useCallback((task: TodayTaskDto) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }, [])

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = useCallback(() => {
    setShowTaskModal(false)
    setSelectedTask(null)
  }, [])

  /**
   * タスク開始処理
   */
  const handleStartTask = useCallback(async (taskExecutionId: string, memberId: string) => {
    return await startTask(taskExecutionId, memberId)
  }, [startTask])

  /**
   * タスク完了処理
   */
  const handleCompleteTask = useCallback(async (taskExecutionId: string, completedByMemberId: string) => {
    return await completeTask(taskExecutionId, completedByMemberId)
  }, [completeTask])

  /**
   * 担当者割り当て処理
   */
  const handleAssignTask = useCallback(async (taskExecutionId: string, assigneeMemberId: string) => {
    return await assignTask(taskExecutionId, assigneeMemberId)
  }, [assignTask])

  /**
   * データ再取得
   */
  const handleRefresh = useCallback(async () => {
    await refetch()
    await fetchMembers()
  }, [refetch, fetchMembers])

  // エラー自動クリア（5秒後）
  if (error) {
    setTimeout(() => clearError(), 5000)
  }

  return (
    <>
      <Header
        title="ホーム"
        subtitle={formatJa(today, 'M月d日（E）')}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <PageContainer>
        {/* エラーメッセージ */}
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* 進捗サマリー */}
        <section className="py-6">
          <ProgressSummaryCard
            completedCount={completedCount}
            totalCount={totalCount}
          />
        </section>

        {/* 今日のタスク一覧 */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-coral-400" />
            今日のタスク
          </h2>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-white/50">読み込み中...</p>
              </div>
            ) : todayActiveTasks.length > 0 ? (
              todayActiveTasks.map((task) => (
                <TodayTaskCard
                  key={task.taskExecutionId}
                  task={task}
                  onClick={handleTaskClick}
                />
              ))
            ) : (
              <Card variant="glass" className="text-center py-8">
                <p className="text-white/50 mb-2">今日のタスクはありません</p>
                <p className="text-sm text-white/30">
                  タスク設定画面でタスクを作成してください
                </p>
              </Card>
            )}
          </div>
        </section>

        {/* 完了済みタスク */}
        {completedTasks.length > 0 && (
          <section className="mt-8">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-lg font-bold text-white/50 mb-4 hover:text-white/70 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400/50" />
              完了済み ({completedTasks.length})
              <ChevronDown className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
            </button>
            
            {showCompleted && (
              <div className="space-y-3 opacity-60">
                {completedTasks.map((task) => (
                  <TodayTaskCard
                    key={task.taskExecutionId}
                    task={task}
                    onClick={handleTaskClick}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* 将来の単発タスク（存在する場合のみ表示） */}
        {futureTasks.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-shazam-400" />
              今後の単発タスク
            </h2>
            
            <div className="space-y-3">
              {futureTasks.map((task) => (
                <TodayTaskCard
                  key={task.taskExecutionId}
                  task={task}
                  onClick={handleTaskClick}
                  showDate
                />
              ))}
            </div>
          </section>
        )}

        {/* メンバー進捗 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-coral-400" />
            メンバーの進捗
          </h2>
          {/* 横スクロール可能なカードリスト */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible">
            {memberSummaries.map((summary) => (
              <MemberProgressCard
                key={summary.memberId}
                summary={summary}
              />
            ))}
          </div>
        </section>

        {/* メンバーの空き時間 */}
        <section className="mt-8">
          <MemberAvailabilitySection
            availabilities={memberAvailabilities}
            title="今日の空き時間"
          />
        </section>

        {/* タスクアクションモーダル */}
        <TaskActionModal
          isOpen={showTaskModal}
          onClose={handleCloseModal}
          task={selectedTask}
          members={members}
          currentMemberId={user?.id}
          onStart={handleStartTask}
          onComplete={handleCompleteTask}
          onAssign={handleAssignTask}
        />
      </PageContainer>
    </>
  )
}
