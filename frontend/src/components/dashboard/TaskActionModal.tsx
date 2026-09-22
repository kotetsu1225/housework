/**
 * タスクアクションモーダルコンポーネント
 *
 * タスクの状態変更（開始、完了）と担当者割り当てを行う確認ダイアログ
 */

import { useState, useEffect } from 'react'
import { Clock, Play, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { isParentRole, formatTimeFromISO } from '../../utils'
import { formatShortDate, scheduleBadgeVariant } from '../../utils/scheduleLabel'
import type { TodayTaskDto } from '../../api/dashboard'
import type { Member } from '../../types'

export interface TaskActionModalProps {
  /** モーダル表示状態 */
  isOpen: boolean
  /** モーダルを閉じるコールバック */
  onClose: () => void
  /** 対象タスク */
  task: TodayTaskDto | null
  /** メンバー一覧（担当者選択用） */
  members: Member[]
  /** 現在のログインユーザーID */
  currentMemberId?: string
  /** タスク開始時のコールバック */
  onStart: (taskExecutionId: string, memberIds: string[]) => Promise<boolean>
  /** タスク完了時のコールバック */
  onComplete: (taskExecutionId: string) => Promise<boolean>
  /** 担当者割り当て時のコールバック */
  onAssign: (taskExecutionId: string, memberIds: string[]) => Promise<boolean>
  /** 周期の文言（毎日、毎週火曜など） */
  scheduleLabel?: string
}

/**
 * タスクアクションモーダル
 *
 * ユーザーフレンドリーな確認ダイアログ
 * - タスクの詳細を表示
 * - 「取り掛かる」ボタンで開始
 * - 「完了」ボタンで完了
 * - 担当者を選択可能
 *
 * @example
 * ```tsx
 * <TaskActionModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   task={selectedTask}
 *   members={members}
 *   currentMemberId={userId}
 *   onStart={handleStart}
 *   onComplete={handleComplete}
 *   onAssign={handleAssign}
 * />
 * ```
 */
export function TaskActionModal({
  isOpen,
  onClose,
  task,
  members,
  currentMemberId,
  onStart,
  onComplete,
  onAssign,
  scheduleLabel,
}: TaskActionModalProps) {
  const [loading, setLoading] = useState(false)
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

  // タスクが変わったら選択状態を現在の担当者で初期化
  useEffect(() => {
    setSelectedAssignees(task?.assigneeMemberIds ?? [])
  }, [task?.taskExecutionId, task?.assigneeMemberIds])

  if (!task) return null

  const isNotStarted = task.status === 'NOT_STARTED'
  const isInProgress = task.status === 'IN_PROGRESS'
  const isCompleted = task.status === 'COMPLETED'

  const scopeLabel = task.scope === 'FAMILY' ? '家族タスク' : '個人タスク'
  const label =
    scheduleLabel ?? (task.scheduleType === 'ONE_TIME' ? formatShortDate(task.scheduledDate) : '定期')
  const point = task.frozenPoint ?? task.point ?? 0

  /**
   * 実行に使用するメンバーIDsを決定
   * 1. 画面上で選択したメンバーs
   * 2. すでに割り当てられているメンバーs
   * 3. 現在のログインユーザー
   */
  const getEffectiveMemberIds = (): string[] => {
    if (selectedAssignees.length > 0) return selectedAssignees
    if (task.assigneeMemberIds.length > 0) return task.assigneeMemberIds
    if (currentMemberId) return [currentMemberId]
    return []
  }

  /**
   * タスク開始処理
   */
  const handleStart = async () => {
    const memberIds = getEffectiveMemberIds()
    if (memberIds.length === 0) return

    setLoading(true)
    try {
      const success = await onStart(task.taskExecutionId, memberIds)
      if (success) {
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * タスク完了処理
   */
  const handleComplete = async () => {
    setLoading(true)
    try {
      const success = await onComplete(task.taskExecutionId)
      if (success) {
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * 担当者割り当て処理（トグル形式で複数選択）
   */
  const handleAssign = async (memberId: string) => {
    setLoading(true)
    try {
      // トグル: 既に選択されていたら削除、そうでなければ追加
      const newSelection = selectedAssignees.includes(memberId)
        ? selectedAssignees.filter((id) => id !== memberId)
        : [...selectedAssignees, memberId]

      const success = await onAssign(task.taskExecutionId, newSelection)
      if (success) {
        setSelectedAssignees(newSelection)
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * アクションボタンの表示
   */
  const renderActionButtons = () => {
    if (isCompleted) {
      return (
        <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
          閉じる
        </Button>
      )
    }

    if (isInProgress) {
      return (
        <>
          <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
            閉じる
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleComplete}
            loading={loading}
            className="flex-1"
          >
            <Check className="w-5 h-5" strokeWidth={2.5} />
            完了する
          </Button>
        </>
      )
    }

    // NOT_STARTED
    return (
      <>
        <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
          あとで
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleStart}
          loading={loading}
          className="flex-1"
        >
          <Play className="w-5 h-5" />
          取り掛かる
        </Button>
      </>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.taskName}
      footer={renderActionButtons()}
    >
      {/* タスク情報 */}
      <div className="space-y-4">
        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
          <Badge variant={scheduleBadgeVariant(task.scheduleType)} size="sm">
            {label}
          </Badge>
          <Badge variant={task.scope === 'FAMILY' ? 'success' : 'personal'} size="sm">
            {scopeLabel}
          </Badge>
          <span className="flex items-center gap-1 tabular">
            <Clock className="w-4 h-4" />
            {formatTimeFromISO(task.scheduledStartTime)}–{formatTimeFromISO(task.scheduledEndTime)}
          </span>
          <span className="ml-auto font-bold text-accent tabular">
            {isCompleted ? '完了 ' : isInProgress ? '進行中 ' : ''}
            {point > 0 && `+${point}pt`}
          </span>
        </div>

        {/* 説明 */}
        {task.taskDescription && (
          <p className="text-ink text-sm bg-canvas rounded-card p-3 leading-relaxed whitespace-pre-wrap">
            {task.taskDescription}
          </p>
        )}

        {/* 担当者選択（未着手または進行中の場合） */}
        {(isNotStarted || isInProgress) && members.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink-soft">
              担当者を選択（複数可）
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const isSelected = selectedAssignees.includes(member.id)
                const isCurrent = member.id === currentMemberId

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleAssign(member.id)}
                    disabled={loading}
                    aria-pressed={isSelected}
                    className={clsx(
                      'flex items-center gap-2 pl-1.5 pr-3.5 min-h-tap rounded-full border-2 transition-colors',
                      isSelected ? 'bg-family border-accent' : 'bg-surface border-line',
                      loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    )}
                  >
                    <Avatar
                      name={member.name}
                      size="sm"
                      role={member.role}
                      variant={isParentRole(member.role) ? 'parent' : 'child'}
                    />
                    <span className={clsx('text-sm', isSelected ? 'font-bold text-family-ink' : 'font-medium text-ink')}>
                      {isCurrent ? '自分' : member.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 現在の担当者（完了の場合のみ表示。進行中は上の選択UIで表示されるため） */}
        {isCompleted && task.assigneeMemberNames.length > 0 && (
          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span>担当:</span>
            <div className="flex flex-wrap items-center gap-2">
              {task.assigneeMemberIds.map((memberId, idx) => {
                const assignee = members.find((m) => m.id === memberId)
                const name = task.assigneeMemberNames[idx] ?? '不明'

                return (
                  <div
                    key={memberId}
                    className="flex items-center gap-2 bg-canvas pl-1 pr-3 py-1 rounded-full"
                  >
                    {assignee ? (
                      <Avatar
                        name={assignee.name}
                        size="sm"
                        role={assignee.role}
                        variant={isParentRole(assignee.role) ? 'parent' : 'child'}
                        className="w-6 h-6"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-control flex items-center justify-center text-[10px]">
                        ?
                      </span>
                    )}
                    <span className="text-ink font-medium">{name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

TaskActionModal.displayName = 'TaskActionModal'
