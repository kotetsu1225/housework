/**
 * 完了済みタスク一覧ページ
 *
 * 2つのモードで動作:
 * - ホームモード (/executions/completed): 全員の完了タスクを表示
 * - メンバーモード (/members/:memberId/completed): 特定メンバーの全履歴を表示
 *
 * どちらも家族／個人の箱に分けて表示する（frontend/DESIGN.md §1）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { SectionBox } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Avatar } from '../components/ui/Avatar'
import { Segmented } from '../components/ui/Segmented'
import { CompletedTaskCard } from '../components/dashboard'
import { useCompletedTasks, useMembers, useScheduleLabels } from '../hooks'
import { useAuth } from '../contexts'
import { toISODateString, formatJa, isParentRole } from '../utils'
import { getRoleLabel } from '../constants'
import type { CompletedTaskDto } from '../api/completedTasks'

/**
 * 完了済みタスク一覧ページ
 */
export function CompletedExecutions() {
  const { memberId } = useParams<{ memberId?: string }>()
  const today = new Date()
  const todayStr = toISODateString(today)

  // メンバーモードかどうか
  const isMemberMode = !!memberId

  // ホームモード用の表示切替
  const [homeMode, setHomeMode] = useState<'today' | 'all'>('today')
  const [showOtherMembers, setShowOtherMembers] = useState(false)

  const { user } = useAuth()

  // メンバー一覧取得
  const { members, fetchMembers, loading: membersLoading } = useMembers()

  // 完了タスク取得
  const {
    completedTasks,
    hasMore,
    loading: tasksLoading,
    error,
    fetchCompletedTasks,
    loadMore,
  } = useCompletedTasks()

  // 周期チップの文言
  const scheduleLabels = useScheduleLabels()

  const loading = tasksLoading || membersLoading

  // 対象メンバー情報
  const targetMember = useMemo(() => {
    if (!memberId) return null
    return members.find((m) => m.id === memberId) ?? null
  }, [members, memberId])

  // データ取得
  const fetchData = useCallback(() => {
    if (isMemberMode && memberId) {
      // メンバーモード: 全履歴を取得
      fetchCompletedTasks({
        memberIds: [memberId],
        limit: 100,
      })
    } else {
      // ホームモード
      fetchCompletedTasks({
        date: homeMode === 'today' ? todayStr : undefined,
        limit: homeMode === 'today' ? 200 : 50,
      })
    }
  }, [isMemberMode, memberId, homeMode, todayStr, fetchCompletedTasks])

  // 初回ロード
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // メンバーモード: 累計ポイント計算
  const totalPoints = useMemo(() => {
    return completedTasks.reduce((sum, task) => sum + (task.frozenPoint ?? 0), 0)
  }, [completedTasks])

  // メンバーモード: 家族／個人
  const memberFamilyTasks = useMemo(() => completedTasks.filter((t) => t.scope === 'FAMILY'), [completedTasks])
  const memberPersonalTasks = useMemo(() => completedTasks.filter((t) => t.scope === 'PERSONAL'), [completedTasks])

  // ホームモード: グループ分け
  const grouped = useMemo(() => {
    if (isMemberMode) return null

    const family: CompletedTaskDto[] = []
    const myPersonal: CompletedTaskDto[] = []
    const otherByOwner = new Map<string, CompletedTaskDto[]>()
    const otherUnknownOwner: CompletedTaskDto[] = []
    const me = user?.id ?? null

    for (const task of completedTasks) {
      if (task.scope === 'PERSONAL') {
        if (task.ownerMemberId && me && task.ownerMemberId === me) {
          myPersonal.push(task)
        } else if (task.ownerMemberId) {
          const bucket = otherByOwner.get(task.ownerMemberId) ?? []
          bucket.push(task)
          otherByOwner.set(task.ownerMemberId, bucket)
        } else {
          otherUnknownOwner.push(task)
        }
      } else {
        family.push(task)
      }
    }

    return { family, myPersonal, otherByOwner, otherUnknownOwner }
  }, [isMemberMode, completedTasks, user?.id])

  // ホームモード: 他メンバーのタスク数
  const otherCount = useMemo(() => {
    if (!grouped) return 0
    return (
      Array.from(grouped.otherByOwner.values()).reduce((sum, arr) => sum + arr.length, 0) +
      grouped.otherUnknownOwner.length
    )
  }, [grouped])

  // ホームモード: 他メンバーのオーナーをソート
  const sortedOtherOwners = useMemo(() => {
    if (!grouped) return []
    const entries = Array.from(grouped.otherByOwner.entries())
    entries.sort(([aId], [bId]) => {
      const a = members.find((m) => m.id === aId)?.name ?? aId
      const b = members.find((m) => m.id === bId)?.name ?? bId
      return a.localeCompare(b, 'ja')
    })
    return entries
  }, [grouped, members])

  // 追加読み込み
  const handleLoadMore = useCallback(() => {
    if (isMemberMode && memberId) {
      loadMore({
        memberIds: [memberId],
        limit: 50,
      })
    } else {
      loadMore({
        date: homeMode === 'today' ? todayStr : undefined,
        limit: 50,
      })
    }
  }, [isMemberMode, memberId, homeMode, todayStr, loadMore])

  const showDate = isMemberMode || homeMode === 'all'

  const renderCard = (task: CompletedTaskDto) => (
    <CompletedTaskCard
      key={task.taskExecutionId}
      task={task}
      members={members}
      scheduleLabel={scheduleLabels[task.taskDefinitionId]}
      showDate={showDate}
    />
  )

  const refreshButton = (
    <button
      type="button"
      onClick={fetchData}
      disabled={loading}
      aria-label="最新の状態に更新"
      className="w-11 h-11 rounded-full bg-surface text-accent flex items-center justify-center disabled:opacity-50"
    >
      <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
    </button>
  )

  const loadMoreButton = (
    <section className="mt-3">
      <Button variant="secondary" size="lg" className="w-full" onClick={handleLoadMore}>
        もっと読み込む
      </Button>
    </section>
  )

  const emptyBox = (message: string) => (
    <div className="bg-surface rounded-box py-10 text-center">
      <p className="text-ink-muted font-medium">{message}</p>
    </div>
  )

  // =========================================
  // メンバーモードのレンダリング
  // =========================================
  if (isMemberMode) {
    return (
      <>
        <Header
          title="完了履歴"
          subtitle={targetMember ? `${targetMember.name}（${getRoleLabel(targetMember.role)}）` : undefined}
          showBack
          action={refreshButton}
        />
        <PageContainer>
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          {/* プロフィール + 累計ポイント */}
          {targetMember && (
            <div className="bg-surface rounded-xl p-4 flex items-center gap-4 mb-3">
              <Avatar
                name={targetMember.name}
                size="xl"
                role={targetMember.role}
                variant={isParentRole(targetMember.role) ? 'parent' : 'child'}
                className="w-14 h-14"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-bold text-ink truncate">{targetMember.name}</h2>
                <p className="text-[13px] text-ink-muted">{getRoleLabel(targetMember.role)}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-accent tabular leading-none">
                  {totalPoints}
                  <span className="text-[13px]">pt</span>
                </p>
                <p className="text-xs text-ink-muted mt-1">累計獲得ポイント</p>
              </div>
            </div>
          )}

          {/* タスク一覧 */}
          <section className="space-y-3">
            {loading && completedTasks.length === 0 ? (
              emptyBox('読み込み中...')
            ) : completedTasks.length === 0 ? (
              emptyBox('完了したタスクはありません')
            ) : (
              <>
                {memberFamilyTasks.length > 0 && (
                  <SectionBox title="家族のタスク" meta={`${memberFamilyTasks.length}件`}>
                    {memberFamilyTasks.map(renderCard)}
                  </SectionBox>
                )}
                {memberPersonalTasks.length > 0 && (
                  <SectionBox title="個人のタスク" meta={`${memberPersonalTasks.length}件`}>
                    {memberPersonalTasks.map(renderCard)}
                  </SectionBox>
                )}
              </>
            )}
          </section>

          {/* もっと読み込む */}
          {!loading && completedTasks.length > 0 && hasMore && loadMoreButton}
        </PageContainer>
      </>
    )
  }

  // =========================================
  // ホームモードのレンダリング
  // =========================================
  return (
    <>
      <Header
        title="完了したタスク"
        subtitle={homeMode === 'all' ? 'すべて' : formatJa(today, 'M月d日（E）')}
        showBack
        action={refreshButton}
      />
      <PageContainer>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <section className="pb-4">
          <Segmented
            label="表示する範囲"
            value={homeMode}
            onChange={(mode) => setHomeMode(mode)}
            options={[
              { value: 'today', label: '今日' },
              { value: 'all', label: 'すべて' },
            ]}
          />
        </section>

        <section className="space-y-3">
          {loading && completedTasks.length === 0 ? (
            emptyBox('読み込み中...')
          ) : completedTasks.length > 0 && grouped ? (
            <>
              {/* 家族タスク */}
              {grouped.family.length > 0 && (
                <SectionBox title="家族のタスク" meta={`${grouped.family.length}件`}>
                  {grouped.family.map(renderCard)}
                </SectionBox>
              )}

              {/* 自分のタスク */}
              {grouped.myPersonal.length > 0 && (
                <SectionBox title="自分のタスク" meta={`${grouped.myPersonal.length}件`}>
                  {grouped.myPersonal.map(renderCard)}
                </SectionBox>
              )}

              {/* 他メンバーのタスク */}
              {otherCount > 0 && (
                <section className="bg-surface rounded-box p-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOtherMembers((v) => !v)}
                    aria-expanded={showOtherMembers}
                    className="flex items-center justify-between gap-2 px-1 min-h-tap text-[15px] font-bold text-ink"
                  >
                    <span>他のメンバーのタスク</span>
                    <span className="flex items-center gap-1 text-[13px] font-normal text-ink-muted tabular">
                      {otherCount}件
                      <ChevronDown
                        className={clsx('w-5 h-5 text-icon-muted transition-transform', showOtherMembers && 'rotate-180')}
                      />
                    </span>
                  </button>

                  {showOtherMembers && (
                    <div className="space-y-3">
                      {sortedOtherOwners.map(([ownerId, tasks]) => {
                        const owner = members.find((m) => m.id === ownerId)
                        const ownerName =
                          owner?.name ?? tasks[0]?.assigneeMembers.find((a) => a.id === ownerId)?.name ?? '不明なメンバー'
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
                              <span className="truncate">{ownerName}</span>
                            </div>
                            {tasks.map(renderCard)}
                          </div>
                        )
                      })}

                      {grouped.otherUnknownOwner.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 px-1 text-[13px] font-medium text-ink-muted">
                            <span className="w-6 h-6 rounded-full bg-control flex items-center justify-center text-xs">?</span>
                            <span className="truncate">不明なメンバー</span>
                          </div>
                          {grouped.otherUnknownOwner.map(renderCard)}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            emptyBox(homeMode === 'today' ? '今日の完了タスクはありません' : '完了タスクはありません')
          )}
        </section>

        {/* もっと読み込むボタン */}
        {homeMode === 'all' && !loading && completedTasks.length > 0 && hasMore && loadMoreButton}
      </PageContainer>
    </>
  )
}
