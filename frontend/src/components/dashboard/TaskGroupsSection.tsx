/**
 * TodayTaskDto のグルーピング表示（Dashboard用）
 *
 * - 家族のタスク
 * - 自分のタスク
 * - 他のメンバーのタスク（折りたたみ）
 *
 * を Dashboard と明日のモーダルで共通利用する。
 * 家族／個人は「大きな箱」と「カードの色」で分ける（frontend/DESIGN.md §1）。
 */
import { ReactNode, useCallback, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { Avatar } from '../ui/Avatar'
import { SectionBox } from '../ui/Card'
import { isParentRole } from '../../utils'
import { TodayTaskCard } from './TodayTaskCard'
import type { TodayTaskDto } from '../../api/dashboard'
import type { Member } from '../../types'

type GroupedTasks = {
  familyTasks: TodayTaskDto[]
  myPersonalTasks: TodayTaskDto[]
  otherPersonalTasksByOwner: Map<string, TodayTaskDto[]>
  otherPersonalTasksUnknownOwner: TodayTaskDto[]
}

export interface TaskGroupsSectionProps {
  tasks: TodayTaskDto[]
  members: Member[]
  currentUserId?: string
  onTaskClick: (task: TodayTaskDto) => void
  /** 未来/別日の表示用に日付を表示するか（TodayTaskCardへ伝播） */
  showDate?: boolean
  /** 空状態の文言（例: 今日のタスクはありません） */
  emptyTitle: string
  /** 空状態の補足文言 */
  emptyDescription?: string
  /** タスク定義IDごとの周期文言（毎日、毎週火曜など） */
  scheduleLabels?: Record<string, string>
  /** 家族のタスクの箱の末尾に差し込む行（完了件数のリンクなど） */
  familyFooter?: ReactNode
}

function remainingMeta(tasks: TodayTaskDto[]): string {
  const remaining = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length
  return remaining === tasks.length ? `${tasks.length} 件` : `残り ${remaining} 件`
}

export function TaskGroupsSection({
  tasks,
  members,
  currentUserId,
  onTaskClick,
  showDate = false,
  emptyTitle,
  emptyDescription,
  scheduleLabels,
  familyFooter,
}: TaskGroupsSectionProps) {
  const [showOtherMembers, setShowOtherMembers] = useState(false)

  const groupTasks = useCallback(
    (input: TodayTaskDto[]): GroupedTasks => {
      const familyTasks: TodayTaskDto[] = []
      const myPersonalTasks: TodayTaskDto[] = []
      const otherPersonalTasksByOwner = new Map<string, TodayTaskDto[]>()
      const otherPersonalTasksUnknownOwner: TodayTaskDto[] = []

      for (const task of input) {
        if (task.scope === 'FAMILY') {
          familyTasks.push(task)
          continue
        }

        // PERSONAL
        if (task.ownerMemberId && currentUserId && task.ownerMemberId === currentUserId) {
          myPersonalTasks.push(task)
          continue
        }

        if (task.ownerMemberId) {
          const bucket = otherPersonalTasksByOwner.get(task.ownerMemberId) ?? []
          bucket.push(task)
          otherPersonalTasksByOwner.set(task.ownerMemberId, bucket)
          continue
        }

        // オーナー情報がない場合（互換/フォールバック）
        otherPersonalTasksUnknownOwner.push(task)
      }

      return {
        familyTasks,
        myPersonalTasks,
        otherPersonalTasksByOwner,
        otherPersonalTasksUnknownOwner,
      }
    },
    [currentUserId]
  )

  const grouped = useMemo(() => groupTasks(tasks), [groupTasks, tasks])

  const otherCount =
    Array.from(grouped.otherPersonalTasksByOwner.values()).reduce((sum, arr) => sum + arr.length, 0) +
    grouped.otherPersonalTasksUnknownOwner.length

  const sortedOtherOwners = useMemo(() => {
    const entries = Array.from(grouped.otherPersonalTasksByOwner.entries())
    entries.sort(([aId], [bId]) => {
      const a = members.find((m) => m.id === aId)?.name ?? aId
      const b = members.find((m) => m.id === bId)?.name ?? bId
      return a.localeCompare(b, 'ja')
    })
    return entries
  }, [grouped.otherPersonalTasksByOwner, members])

  const renderCard = (task: TodayTaskDto) => (
    <TodayTaskCard
      key={task.taskExecutionId}
      task={task}
      onClick={onTaskClick}
      showDate={showDate}
      members={members}
      scheduleLabel={scheduleLabels?.[task.taskDefinitionId]}
    />
  )

  if (tasks.length === 0) {
    return (
      <div className="bg-surface rounded-box py-8 px-4 text-center">
        <p className="text-ink-muted font-medium">{emptyTitle}</p>
        {emptyDescription && <p className="mt-1 text-[13px] text-ink-muted">{emptyDescription}</p>}
        {familyFooter && <div className="mt-4">{familyFooter}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {(grouped.familyTasks.length > 0 || familyFooter) && (
        <SectionBox title="家族のタスク" meta={grouped.familyTasks.length > 0 ? remainingMeta(grouped.familyTasks) : undefined}>
          {grouped.familyTasks.map(renderCard)}
          {familyFooter}
        </SectionBox>
      )}

      {grouped.myPersonalTasks.length > 0 && (
        <SectionBox title="自分のタスク" meta={remainingMeta(grouped.myPersonalTasks)}>
          {grouped.myPersonalTasks.map(renderCard)}
        </SectionBox>
      )}

      {otherCount > 0 && (
        <section className="bg-surface rounded-box p-3 flex flex-col gap-2">
          <button
            onClick={() => setShowOtherMembers((v) => !v)}
            className="flex items-center justify-between gap-2 px-1 min-h-tap text-[15px] font-bold text-ink"
            type="button"
            aria-expanded={showOtherMembers}
          >
            <span>他のメンバーのタスク</span>
            <span className="flex items-center gap-1 text-[13px] font-normal text-ink-muted tabular">
              {otherCount} 件
              <ChevronDown
                className={clsx('w-5 h-5 text-icon-muted transition-transform', showOtherMembers && 'rotate-180')}
              />
            </span>
          </button>

          {showOtherMembers && (
            <div className="space-y-3">
              {sortedOtherOwners.map(([ownerId, ownerTasks]) => {
                const owner = members.find((m) => m.id === ownerId)
                return (
                  <div key={ownerId} className="space-y-2">
                    <div className="flex items-center gap-2 px-1 text-[13px] font-medium text-ink-muted">
                      {owner ? (
                        <Avatar
                          name={owner.name}
                          size="sm"
                          role={owner.role}
                          variant={isParentRole(owner.role) ? 'parent' : 'child'}
                          className="w-6 h-6"
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-control flex items-center justify-center text-xs">?</span>
                      )}
                      <span className="truncate">{owner?.name ?? '不明なメンバー'}</span>
                    </div>
                    {ownerTasks.map(renderCard)}
                  </div>
                )
              })}

              {grouped.otherPersonalTasksUnknownOwner.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-[13px] font-medium text-ink-muted">
                    <span className="w-6 h-6 rounded-full bg-control flex items-center justify-center text-xs">?</span>
                    <span className="truncate">不明なメンバー</span>
                  </div>
                  {grouped.otherPersonalTasksUnknownOwner.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

TaskGroupsSection.displayName = 'TaskGroupsSection'
