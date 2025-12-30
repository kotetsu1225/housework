/**
 * TodayTaskDto のグルーピング表示（Dashboard用）
 *
 * - 家族のタスク
 * - 自分のタスク
 * - 他のメンバーのタスク（折りたたみ）
 *
 * を Dashboard と明日のモーダルで共通利用する。
 */
import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, User, Users } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Card } from '../ui/Card'
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
}

export function TaskGroupsSection({
  tasks,
  members,
  currentUserId,
  onTaskClick,
  showDate = false,
  emptyTitle,
  emptyDescription,
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

  if (tasks.length === 0) {
    return (
      <Card variant="glass" className="text-center py-8">
        <p className="text-white/50 mb-2">{emptyTitle}</p>
        {emptyDescription && <p className="text-sm text-white/30">{emptyDescription}</p>}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.familyTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white/70 font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-white/50" />
            家族のタスク
          </h3>
          <div className="space-y-3">
            {grouped.familyTasks.map((task) => (
              <TodayTaskCard
                key={task.taskExecutionId}
                task={task}
                onClick={onTaskClick}
                showDate={showDate}
                members={members}
              />
            ))}
          </div>
        </div>
      )}

      {grouped.myPersonalTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-white/70 font-bold flex items-center gap-2">
            <User className="w-4 h-4 text-white/50" />
            自分のタスク
          </h3>
          <div className="space-y-3">
            {grouped.myPersonalTasks.map((task) => (
              <TodayTaskCard
                key={task.taskExecutionId}
                task={task}
                onClick={onTaskClick}
                showDate={showDate}
                members={members}
              />
            ))}
          </div>
        </div>
      )}

      {otherCount > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowOtherMembers((v) => !v)}
            className="flex items-center gap-2 text-white/60 hover:text-white/80 transition-colors font-bold"
            type="button"
          >
            <Users className="w-4 h-4 text-white/40" />
            他のメンバーのタスク ({otherCount})
            <ChevronDown className={`w-4 h-4 transition-transform ${showOtherMembers ? 'rotate-180' : ''}`} />
          </button>

          {showOtherMembers && (
            <div className="space-y-6">
              {sortedOtherOwners.map(([ownerId, ownerTasks]) => {
                const owner = members.find((m) => m.id === ownerId)
                return (
                  <div key={ownerId} className="space-y-3">
                    <div className="flex items-center gap-2 text-white/70 font-bold">
                      {owner ? (
                        <Avatar
                          name={owner.name}
                          size="sm"
                          role={owner.role}
                          variant={isParentRole(owner.role) ? 'parent' : 'child'}
                        />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">
                          ?
                        </span>
                      )}
                      <span className="truncate">{owner?.name ?? '不明なメンバー'}</span>
                    </div>

                    <div className="space-y-3">
                      {ownerTasks.map((task) => (
                        <TodayTaskCard
                          key={task.taskExecutionId}
                          task={task}
                          onClick={onTaskClick}
                          showDate={showDate}
                          members={members}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {grouped.otherPersonalTasksUnknownOwner.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-white/70 font-bold">
                    <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">?</span>
                    <span className="truncate">不明なメンバー</span>
                  </div>

                  <div className="space-y-3">
                    {grouped.otherPersonalTasksUnknownOwner.map((task) => (
                      <TodayTaskCard
                        key={task.taskExecutionId}
                        task={task}
                        onClick={onTaskClick}
                        showDate={showDate}
                        members={members}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

TaskGroupsSection.displayName = 'TaskGroupsSection'


