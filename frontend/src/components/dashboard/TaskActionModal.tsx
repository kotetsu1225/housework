/**
 * タスクアクションモーダルコンポーネント
 *
 * タスクの状態変更（開始、完了）と担当者割り当てを行う確認ダイアログ
 */

import { useState } from 'react'
import { Clock, Users, User, Play, CheckCircle2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { isParentRole } from '../../utils'
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
  onStart: (taskExecutionId: string) => Promise<boolean>
  /** タスク完了時のコールバック */
  onComplete: (taskExecutionId: string, completedByMemberId: string) => Promise<boolean>
  /** 担当者割り当て時のコールバック */
  onAssign: (taskExecutionId: string, assigneeMemberId: string) => Promise<boolean>
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
}: TaskActionModalProps) {
  const [loading, setLoading] = useState(false)
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null)

  if (!task) return null

  const isNotStarted = task.status === 'NOT_STARTED'
  const isInProgress = task.status === 'IN_PROGRESS'
  const isCompleted = task.status === 'COMPLETED'

  const scopeLabel = task.scope === 'FAMILY' ? '家族タスク' : '個人タスク'
  const scopeIcon = task.scope === 'FAMILY' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />

  /**
   * タスク開始処理
   */
  const handleStart = async () => {
    setLoading(true)
    try {
      const success = await onStart(task.taskExecutionId)
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
    if (!currentMemberId) return

    setLoading(true)
    try {
      const success = await onComplete(task.taskExecutionId, currentMemberId)
      if (success) {
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * 担当者割り当て処理
   */
  const handleAssign = async (memberId: string) => {
    setLoading(true)
    try {
      const success = await onAssign(task.taskExecutionId, memberId)
      if (success) {
        setSelectedAssignee(memberId)
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
        <Button variant="secondary" onClick={onClose} className="flex-1">
          閉じる
        </Button>
      )
    }

    if (isInProgress) {
      return (
        <>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            閉じる
          </Button>
          <Button
            variant="primary"
            onClick={handleComplete}
            loading={loading}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            完了する
          </Button>
        </>
      )
    }

    // NOT_STARTED
    return (
      <>
        <Button variant="secondary" onClick={onClose} className="flex-1">
          あとで
        </Button>
        <Button
          variant="primary"
          onClick={handleStart}
          loading={loading}
          className="flex-1"
        >
          <Play className="w-5 h-5 mr-2" />
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
        <div className="flex items-center gap-4 text-sm text-white/70">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{task.estimatedMinutes}分</span>
          </div>
          <div className="flex items-center gap-1">
            {scopeIcon}
            <span className="whitespace-nowrap">{scopeLabel}</span>
          </div>
          <Badge
            variant={
              isCompleted
                ? 'success'
                : isInProgress
                  ? 'info'
                  : 'default'
            }
          >
            {isCompleted ? '完了' : isInProgress ? '進行中' : 'やること'}
          </Badge>
        </div>

        {/* 説明 */}
        {task.taskDescription && (
          <p className="text-white/60 text-sm bg-dark-800/50 rounded-lg p-3">
            {task.taskDescription}
          </p>
        )}

        {/* 担当者選択（未着手の場合のみ） */}
        {isNotStarted && members.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-white/70 font-medium">
              担当者を選択
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const isSelected =
                  selectedAssignee === member.id ||
                  (!selectedAssignee && task.assigneeMemberId === member.id)
                const isCurrent = member.id === currentMemberId

                return (
                  <button
                    key={member.id}
                    onClick={() => handleAssign(member.id)}
                    disabled={loading}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                      ${
                        isSelected
                          ? 'bg-coral-500/20 border-2 border-coral-500'
                          : 'bg-dark-800 border-2 border-transparent hover:border-dark-600'
                      }
                      ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <Avatar
                      name={member.name}
                      size="sm"
                      role={member.role}
                      variant={isParentRole(member.role) ? 'parent' : 'child'}
                    />
                    <span className="text-sm text-white">
                      {isCurrent ? '自分' : member.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 現在の担当者（進行中または完了の場合） */}
        {(isInProgress || isCompleted) && task.assigneeMemberName && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span>担当:</span>
            <span className="text-white font-medium">{task.assigneeMemberName}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

TaskActionModal.displayName = 'TaskActionModal'

