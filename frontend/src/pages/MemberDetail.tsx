/**
 * メンバー詳細ページ
 *
 * 個別メンバーの詳細情報・今日の活動・完了タスク一覧を表示
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { SectionBox } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Alert } from '../components/ui/Alert'
import { Modal } from '../components/ui/Modal'
import { CompletedTaskCard } from '../components/dashboard'
import { useMembers, useCompletedTasks, useScheduleLabels } from '../hooks'
import { isParentRole, formatTimeFromISO, toISODateString } from '../utils'
import { formatShortDate, scheduleBadgeVariant } from '../utils/scheduleLabel'
import { getRoleLabel } from '../constants'
import { getRankingMedal, calculateMemberRank } from './Members'
import type { CompletedTaskDto } from '../api/completedTasks'
import type { Member } from '../types'

/**
 * タスク詳細モーダルコンポーネント
 */
interface TaskDetailModalProps {
  task: CompletedTaskDto | null
  isOpen: boolean
  onClose: () => void
  members: Member[]
  scheduleLabel?: string
}

function TaskDetailModal({ task, isOpen, onClose, members, scheduleLabel }: TaskDetailModalProps) {
  if (!task) return null

  // 担当者情報にroleを追加
  const assigneesWithRole = task.assigneeMembers.map((assignee) => {
    const memberInfo = members.find((m) => m.id === assignee.id)
    return {
      ...assignee,
      role: memberInfo?.role,
    }
  })
  const label =
    scheduleLabel ?? (task.scheduleType === 'ONE_TIME' ? formatShortDate(task.scheduledDate) : '定期')

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task.name}
      footer={
        <Button variant="secondary" size="lg" onClick={onClose} className="flex-1">
          閉じる
        </Button>
      }
    >
      <div className="space-y-4">
        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
          <Badge variant={scheduleBadgeVariant(task.scheduleType)} size="sm">
            {label}
          </Badge>
          <Badge variant={task.scope === 'FAMILY' ? 'success' : 'personal'} size="sm">
            {task.scope === 'FAMILY' ? '家族' : '個人'}
          </Badge>
          <span className="tabular">
            {formatTimeFromISO(task.scheduledStartTime)}–{formatTimeFromISO(task.scheduledEndTime)}
          </span>
          {task.frozenPoint > 0 && (
            <span className="ml-auto font-bold text-accent tabular">+{task.frozenPoint}pt</span>
          )}
        </div>

        <p className="text-[13px] text-ink-muted tabular">
          {formatShortDate(task.scheduledDate)} {formatTimeFromISO(task.completedAt)} に完了
        </p>

        {/* 説明文 */}
        {task.description && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-ink-soft">説明</p>
            <p className="text-ink text-sm bg-canvas rounded-card p-3.5 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* 担当者 */}
        {assigneesWithRole.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-ink-soft">担当者</p>
            <div className="flex flex-wrap gap-2">
              {assigneesWithRole.map((assignee) => (
                <div
                  key={assignee.id}
                  className="flex items-center gap-2 bg-canvas pl-1 pr-3 py-1 rounded-full"
                >
                  <Avatar
                    name={assignee.name}
                    size="sm"
                    role={assignee.role}
                    variant={assignee.role && isParentRole(assignee.role) ? 'parent' : 'child'}
                    className="w-6 h-6"
                  />
                  <span className="text-ink text-sm font-medium">{assignee.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/**
 * メンバー詳細ページ
 */
export function MemberDetail() {
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()

  const today = new Date()
  const todayStr = toISODateString(today)

  // メンバー一覧取得
  const { members, fetchMembers, loading: membersLoading, error: membersError } = useMembers()

  // このメンバーの今日の完了タスクを取得
  const {
    completedTasks,
    loading: tasksLoading,
    error: tasksError,
    fetchCompletedTasks,
  } = useCompletedTasks()

  // 周期チップの文言
  const scheduleLabels = useScheduleLabels()

  // タスク詳細モーダル
  const [selectedTask, setSelectedTask] = useState<CompletedTaskDto | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

  const handleTaskClick = (task: CompletedTaskDto) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }

  const handleCloseModal = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
  }

  // 初回マウント時にデータを取得
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // memberIdが確定したら完了タスクを取得
  useEffect(() => {
    if (memberId) {
      fetchCompletedTasks({
        memberIds: [memberId],
        date: todayStr,
      })
    }
  }, [memberId, todayStr, fetchCompletedTasks])

  // 現在のメンバーを取得
  const member = useMemo(() => {
    return members.find((m) => m.id === memberId)
  }, [members, memberId])

  // 家族／個人に分けた完了タスク
  const familyTasks = useMemo(() => completedTasks.filter((t) => t.scope === 'FAMILY'), [completedTasks])
  const personalTasks = useMemo(() => completedTasks.filter((t) => t.scope === 'PERSONAL'), [completedTasks])

  // 今日のサマリー（メンバー統計を優先）
  const todayEarnedPoints = member?.todayEarnedPoint ?? 0
  const todayFamilyCompleted = member?.todayFamilyTaskCompleted ?? familyTasks.length
  const todayPersonalCompleted = member?.todayPersonalTaskCompleted ?? personalTasks.length
  const todayCompletedCount = member
    ? todayFamilyCompleted + todayPersonalCompleted
    : completedTasks.length

  // ランキング計算（ポイント順）
  const currentRank = useMemo(() => {
    return calculateMemberRank(members, memberId)
  }, [members, memberId])

  const loading = membersLoading || tasksLoading
  const error = membersError || tasksError

  if (loading && !member) {
    return (
      <>
        <Header title="メンバー詳細" showBack />
        <PageContainer>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-accent border-t-transparent" />
          </div>
        </PageContainer>
      </>
    )
  }

  if (!member) {
    return (
      <>
        <Header title="メンバー詳細" showBack />
        <PageContainer>
          <Alert variant="error">メンバーが見つかりませんでした</Alert>
          <Button variant="secondary" onClick={() => navigate('/members')} className="mt-4 w-full">
            メンバー一覧へ
          </Button>
        </PageContainer>
      </>
    )
  }

  const renderCard = (task: CompletedTaskDto) => (
    <CompletedTaskCard
      key={task.taskExecutionId}
      task={task}
      onClick={handleTaskClick}
      members={members}
      scheduleLabel={scheduleLabels[task.taskDefinitionId]}
    />
  )

  return (
    <>
      <Header title="メンバー詳細" showBack />
      <PageContainer>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* プロフィールカード */}
        <div className="bg-surface rounded-xl p-4 flex items-center gap-4">
          <Avatar
            name={member.name}
            size="xl"
            role={member.role}
            variant={isParentRole(member.role) ? 'parent' : 'child'}
            className="w-[72px] h-[72px]"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-[22px] font-bold text-ink truncate">{member.name}</h2>
            <p className="text-sm text-ink-muted">{getRoleLabel(member.role)}</p>
          </div>
        </div>

        {/* 今日のサマリー */}
        <section>
          <h3 className="px-1 pt-5 pb-2 text-[13px] font-medium text-ink-muted">今日の成果</h3>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-surface rounded-xl px-3 py-3.5 flex flex-col gap-1">
              <span className="text-2xl font-bold text-accent tabular leading-none">
                {todayEarnedPoints}
                <span className="text-[13px]">pt</span>
              </span>
              <span className="text-xs text-ink-muted">今日の獲得</span>
            </div>
            <div className="bg-surface rounded-xl px-3 py-3.5 flex flex-col gap-1">
              <span className="text-2xl font-bold text-ink tabular leading-none">
                {todayCompletedCount}
                <span className="text-[13px] font-medium">件</span>
              </span>
              <span className="text-xs text-ink-muted">今日の完了</span>
            </div>
            <div className="bg-surface rounded-xl px-3 py-3.5 flex flex-col gap-1">
              <span className="text-2xl font-bold text-ink tabular leading-none">
                {currentRank !== null ? getRankingMedal(currentRank) : '-'}
              </span>
              <span className="text-xs text-ink-muted">今日の順位</span>
            </div>
          </div>
        </section>

        {/* 完了数内訳 */}
        <div className="mt-2.5 bg-surface rounded-xl px-4 py-3 flex items-center gap-4 text-sm">
          <span className="text-ink-muted">完了の内訳</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-family border border-family-chip" />
            家族 <strong className="tabular">{todayFamilyCompleted}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-personal border border-personal-chip" />
            個人 <strong className="tabular">{todayPersonalCompleted}</strong>
          </span>
        </div>

        {/* 完了タスク一覧（家族／個人の箱） */}
        <section>
          <h3 className="px-1 pt-5 pb-1 text-[13px] font-medium text-ink-muted">今日完了したタスク</h3>
          {completedTasks.length === 0 ? (
            <div className="bg-surface rounded-box py-8 text-center">
              <p className="text-ink-muted font-medium">完了したタスクはありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {familyTasks.length > 0 && (
                <SectionBox title="家族のタスク" meta={`${familyTasks.length}件`}>
                  {familyTasks.map(renderCard)}
                </SectionBox>
              )}
              {personalTasks.length > 0 && (
                <SectionBox title="自分のタスク" meta={`${personalTasks.length}件`}>
                  {personalTasks.map(renderCard)}
                </SectionBox>
              )}
            </div>
          )}
        </section>

        {/* 完了履歴を見る */}
        <section className="mt-3">
          <button
            type="button"
            onClick={() => navigate(`/members/${memberId}/completed`)}
            className="w-full h-12 rounded-xl bg-surface text-accent text-[15px] font-bold flex items-center justify-center gap-2"
          >
            完了履歴を見る
            <ChevronRight className="w-[18px] h-[18px]" />
          </button>
        </section>

        {/* タスク詳細モーダル */}
        <TaskDetailModal
          task={selectedTask}
          isOpen={showTaskModal}
          onClose={handleCloseModal}
          members={members}
          scheduleLabel={selectedTask ? scheduleLabels[selectedTask.taskDefinitionId] : undefined}
        />
      </PageContainer>
    </>
  )
}
