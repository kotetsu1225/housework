/**
 * タスクアクションモーダルコンポーネント
 *
 * タスクの状態変更（開始、完了）と担当者割り当てを行う確認ダイアログ
 */

import { useState, useEffect } from 'react'
import { Clock, Users, User, Play, CheckCircle2, Star } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Avatar } from '../ui/Avatar'
import { isParentRole, formatTimeFromISO } from '../../utils'
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
  const scopeIcon = task.scope === 'FAMILY' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />

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
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{formatTimeFromISO(task.scheduledStartTime)} - {formatTimeFromISO(task.scheduledEndTime)}</span>
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
            {isCompleted ? '完了' : isInProgress ? '進行中' : '未'}
          </Badge>
          {/* ポイント表示 */}
          {((task.frozenPoint ?? task.point ?? 0) > 0) && (
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Star className="w-4 h-4 fill-amber-400" />
              +{task.frozenPoint ?? task.point}pt
            </span>
          )}
        </div>

        {/* 説明 */}
        {task.taskDescription && (
          <p className="text-white/60 text-sm bg-dark-800/50 rounded-lg p-3">
            {task.taskDescription}
          </p>
        )}

        {/* 担当者選択（未着手または進行中の場合） */}
        {(isNotStarted || isInProgress) && members.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-white/70 font-medium">
              担当者を選択（複数可）
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const isSelected = selectedAssignees.includes(member.id)
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

        {/* 現在の担当者（完了の場合のみ表示。進行中は上の選択UIで表示されるため） */}
        {isCompleted && task.assigneeMemberNames.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span>担当:</span>
            <div className="flex flex-wrap items-center gap-2">
              {task.assigneeMemberIds.map((memberId, idx) => {
                const assignee = members.find((m) => m.id === memberId)
                const name = task.assigneeMemberNames[idx] ?? '不明'

                return (
                  <div
                    key={memberId}
                    className="flex items-center gap-2 bg-dark-800/50 px-3 py-1.5 rounded-full"
                  >
                    {assignee ? (
                      <Avatar
                        name={assignee.name}
                        size="sm"
                        role={assignee.role}
                        variant={isParentRole(assignee.role) ? 'parent' : 'child'}
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-coral-500/20 flex items-center justify-center text-[10px]">
                        ?
                      </span>
                    )}
                    <span className="text-white font-medium">{name}</span>
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

