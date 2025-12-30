import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, RefreshCw, Clock, User, Users, ChevronDown } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { getTaskExecutions, getTaskDefinitions, ApiError } from '../api'
import { useMember } from '../hooks'
import { useAuth } from '../contexts'
import { toISODateString, formatJa, formatTimeFromISO, isParentRole } from '../utils'
import type { TaskExecutionWithDetails, TaskExecution, Member } from '../types'
import type { TaskDefinitionResponse } from '../types/api'

type LoadState = {
  loading: boolean
  error: string | null
  items: TaskExecution[]
  hasMore: boolean
}

type DefinitionsState = {
  loading: boolean
  error: string | null
  byId: Record<string, TaskDefinitionResponse>
}

function getScheduleBadgeFromDefinition(def?: TaskDefinitionResponse) {
  if (!def) return null
  const label = def.schedule?.type === 'OneTime' ? '単発' : '定期'
  const variant = def.schedule?.type === 'OneTime' ? 'warning' : 'default'
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  )
}

function getScopeLabel(scope?: string) {
  return scope === 'PERSONAL' ? '個人' : '家族'
}

/**
 * 完了済みExecution一覧（snapshot表示）
 */
export function CompletedExecutions() {
  const today = new Date()
  const todayStr = toISODateString(today)
  const [mode, setMode] = useState<'today' | 'all'>('today')
  const [showOtherMembers, setShowOtherMembers] = useState(false)
  const requestIdRef = useRef(0)
  const [state, setState] = useState<LoadState>({
    loading: true,
    error: null,
    items: [],
    hasMore: false,
  })
  const [defs, setDefs] = useState<DefinitionsState>({
    loading: true,
    error: null,
    byId: {},
  })

  const { user } = useAuth()
  const { members, fetchMembers } = useMember()

  const fetchAllTaskDefinitions = useCallback(async () => {
    setDefs((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const limit = 100
      let offset = 0
      const all: Record<string, TaskDefinitionResponse> = {}
      // hasMore が false になるまでページング取得
      //（全件でも数が小さい前提。増えた場合はここをキャッシュ/サーバー側拡張で改善可能）
      for (;;) {
        const res = await getTaskDefinitions(limit, offset)
        for (const td of res.taskDefinitions) {
          all[td.id] = td
        }
        if (!res.hasMore) break
        offset += limit
      }
      setDefs({ loading: false, error: null, byId: all })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'タスク定義の取得に失敗しました'
      setDefs({ loading: false, error: message, byId: {} })
    }
  }, [])

  const fetchCompleted = useCallback(async (opts?: { append?: boolean; offset?: number }) => {
    const append = opts?.append ?? false
    const offset = append ? (opts?.offset ?? 0) : 0
    const requestId = ++requestIdRef.current

    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await getTaskExecutions({
        scheduledDate: mode === 'today' ? todayStr : undefined,
        status: 'COMPLETED',
        limit: mode === 'today' ? 200 : 50,
        offset,
      })

      const items: TaskExecution[] = res.taskExecutions.map((t) => ({
        id: t.id,
        taskDefinitionId: t.taskDefinitionId,
        assigneeMemberId: t.assigneeMemberId ?? undefined,
        scheduledDate: t.scheduledDate,
        status: t.status,
        taskSnapshot: t.taskSnapshot
          ? {
              name: t.taskSnapshot.name,
              description: t.taskSnapshot.description ?? undefined,
              scheduledStartTime: t.taskSnapshot.scheduledStartTime,
              scheduledEndTime: t.taskSnapshot.scheduledEndTime,
              definitionVersion: t.taskSnapshot.definitionVersion,
              capturedAt: t.taskSnapshot.capturedAt,
            }
          : {
              name: '',
              scheduledStartTime: '',
              scheduledEndTime: '',
              definitionVersion: 0,
              capturedAt: '',
            },
        startedAt: t.startedAt ?? undefined,
        completedAt: t.completedAt ?? undefined,
        completedByMemberId: t.completedByMemberId ?? undefined,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }))

      // 最新リクエスト以外の結果は破棄（連打・切替の競合対策）
      if (requestId !== requestIdRef.current) return

      setState((prev) => {
        const merged = append ? [...prev.items, ...items] : items
        // 表示は「新しい日付→古い日付」（同日内は completedAt → createdAt の降順）
        merged.sort((a, b) => {
          const dateCmp = (b.scheduledDate ?? '').localeCompare(a.scheduledDate ?? '')
          if (dateCmp !== 0) return dateCmp
          const aTime = a.completedAt ?? a.updatedAt ?? a.createdAt
          const bTime = b.completedAt ?? b.updatedAt ?? b.createdAt
          return (bTime ?? '').localeCompare(aTime ?? '')
        })

        return { loading: false, error: null, items: merged, hasMore: res.hasMore }
      })
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      const message =
        err instanceof ApiError ? err.message : '完了一覧の取得に失敗しました'
      setState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [mode, todayStr])

  useEffect(() => {
    fetchMembers()
    fetchAllTaskDefinitions()
  }, [fetchMembers, fetchAllTaskDefinitions])

  useEffect(() => {
    // モード変更時は先頭から取り直す
    fetchCompleted({ append: false })
  }, [fetchCompleted, mode])

  const itemsWithMembers: TaskExecutionWithDetails[] = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m]))
    return state.items.map((t) => ({
      ...t,
      assignee: t.assigneeMemberId ? map.get(t.assigneeMemberId) : undefined,
      completedBy: t.completedByMemberId ? map.get(t.completedByMemberId) : undefined,
    }))
  }, [members, state.items])

  type CompletedEnriched = {
    execution: TaskExecutionWithDetails
    definition?: TaskDefinitionResponse
    scope?: string
    ownerMemberId?: string | null
  }

  const enriched: CompletedEnriched[] = useMemo(() => {
    return itemsWithMembers.map((t) => {
      const def = defs.byId[t.taskDefinitionId]
      return {
        execution: t,
        definition: def,
        scope: def?.scope,
        ownerMemberId: def?.ownerMemberId ?? null,
      }
    })
  }, [defs.byId, itemsWithMembers])

  type Grouped = {
    family: CompletedEnriched[]
    myPersonal: CompletedEnriched[]
    otherByOwner: Map<string, CompletedEnriched[]>
    otherUnknownOwner: CompletedEnriched[]
  }

  const grouped: Grouped = useMemo(() => {
    const family: CompletedEnriched[] = []
    const myPersonal: CompletedEnriched[] = []
    const otherByOwner = new Map<string, CompletedEnriched[]>()
    const otherUnknownOwner: CompletedEnriched[] = []
    const me = user?.id ?? null

    for (const item of enriched) {
      const scope = item.scope
      if (scope === 'PERSONAL') {
        if (item.ownerMemberId && me && item.ownerMemberId === me) {
          myPersonal.push(item)
          continue
        }
        if (item.ownerMemberId) {
          const bucket = otherByOwner.get(item.ownerMemberId) ?? []
          bucket.push(item)
          otherByOwner.set(item.ownerMemberId, bucket)
          continue
        }
        otherUnknownOwner.push(item)
        continue
      }

      // scopeが不明ならFAMILY扱いでフォールバック
      family.push(item)
    }

    return { family, myPersonal, otherByOwner, otherUnknownOwner }
  }, [enriched, user?.id])

  const otherCount = useMemo(() => {
    return (
      Array.from(grouped.otherByOwner.values()).reduce((sum, arr) => sum + arr.length, 0) +
      grouped.otherUnknownOwner.length
    )
  }, [grouped.otherByOwner, grouped.otherUnknownOwner.length])

  const sortedOtherOwners = useMemo(() => {
    const entries = Array.from(grouped.otherByOwner.entries())
    entries.sort(([aId], [bId]) => {
      const a = members.find((m) => m.id === aId)?.name ?? aId
      const b = members.find((m) => m.id === bId)?.name ?? bId
      return a.localeCompare(b, 'ja')
    })
    return entries
  }, [grouped.otherByOwner, members])

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchMembers(), fetchAllTaskDefinitions()])
    await fetchCompleted({ append: false })
  }, [fetchMembers, fetchAllTaskDefinitions, fetchCompleted])

  function CompletedTaskCard({
    item,
    members,
  }: {
    item: CompletedEnriched
    members: Member[]
  }) {
    const t = item.execution
    const taskName = t.taskSnapshot?.name || '(名称不明)'
    const scopeLabel = getScopeLabel(item.scope)
    const scheduleBadge = getScheduleBadgeFromDefinition(item.definition)
    const completedBy = t.completedBy

    const owner = item.ownerMemberId ? members.find((m) => m.id === item.ownerMemberId) : undefined

    return (
      <Card variant="glass" className="flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-white truncate">{taskName}</p>
                {scheduleBadge}
                <Badge variant="success" size="sm">
                  完了
                </Badge>
              </div>
              {t.taskSnapshot?.description && (
                <p className="text-sm text-white/50 line-clamp-2 mt-1">
                  {t.taskSnapshot.description}
                </p>
              )}
            </div>
            <div className="text-xs text-white/40 whitespace-nowrap">
              v{t.taskSnapshot?.definitionVersion ?? 0}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50 mt-3">
            {t.taskSnapshot?.scheduledStartTime && t.taskSnapshot?.scheduledEndTime && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                {formatTimeFromISO(t.taskSnapshot.scheduledStartTime)} - {formatTimeFromISO(t.taskSnapshot.scheduledEndTime)}
              </span>
            )}
            <span className="flex items-center gap-1 whitespace-nowrap">
              {item.scope === 'PERSONAL' ? <User className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
              {scopeLabel}
            </span>
            {owner && item.scope === 'PERSONAL' && (
              <span className="flex items-center gap-1.5 text-white/50 whitespace-nowrap">
                <Avatar
                  name={owner.name}
                  size="sm"
                  role={owner.role}
                  variant={isParentRole(owner.role) ? 'parent' : 'child'}
                />
                {owner.name}
              </span>
            )}
            {completedBy && (
              <span className="flex items-center gap-1.5 text-coral-400 font-medium whitespace-nowrap">
                <Avatar
                  name={completedBy.name}
                  size="sm"
                  role={completedBy.role}
                  variant={isParentRole(completedBy.role) ? 'parent' : 'child'}
                />
                {completedBy.name}
              </span>
            )}
            {t.completedAt && (
              <span className="text-white/40 whitespace-nowrap">
                完了: {formatJa(new Date(t.completedAt), 'MM/dd HH:mm')}
              </span>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Header
        title="完了したタスク"
        subtitle={mode === 'all' ? '全て' : formatJa(today, 'M月d日（E）')}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={state.loading}
          >
            <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <PageContainer>
        {state.error && (
          <Alert variant="error" className="mb-4">
            {state.error}
          </Alert>
        )}

        <section className="py-4">
          <label className="block text-sm text-white/70 mb-2">表示</label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mode === 'today' ? 'primary' : 'secondary'}
              size="sm"
              className="w-full"
              onClick={() => setMode('today')}
            >
              今日
            </Button>
            <Button
              variant={mode === 'all' ? 'primary' : 'secondary'}
              size="sm"
              className="w-full"
              onClick={() => setMode('all')}
            >
              全て
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          {state.loading ? (
            <div className="text-center py-10">
              <p className="text-white/50">読み込み中...</p>
            </div>
          ) : itemsWithMembers.length > 0 ? (
            <div className="space-y-6">
              {defs.error && (
                <Alert variant="error">
                  {defs.error}
                </Alert>
              )}

              {grouped.family.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/70 font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-white/50" />
                    家族のタスク
                  </h3>
                  <div className="space-y-3">
                    {grouped.family.map((item) => (
                      <CompletedTaskCard key={item.execution.id} item={item} members={members} />
                    ))}
                  </div>
                </div>
              )}

              {grouped.myPersonal.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/70 font-bold flex items-center gap-2">
                    <User className="w-4 h-4 text-white/50" />
                    自分のタスク
                  </h3>
                  <div className="space-y-3">
                    {grouped.myPersonal.map((item) => (
                      <CompletedTaskCard key={item.execution.id} item={item} members={members} />
                    ))}
                  </div>
                </div>
              )}

              {otherCount > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowOtherMembers((v) => !v)}
                    className="flex items-center gap-2 text-white/60 hover:text-white/80 transition-colors font-bold"
                  >
                    <Users className="w-4 h-4 text-white/40" />
                    他のメンバーのタスク ({otherCount})
                    <ChevronDown className={`w-4 h-4 transition-transform ${showOtherMembers ? 'rotate-180' : ''}`} />
                  </button>

                  {showOtherMembers && (
                    <div className="space-y-6">
                      {sortedOtherOwners.map(([ownerId, items]) => {
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
                                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">?</span>
                              )}
                              <span className="truncate">{owner?.name ?? '不明なメンバー'}</span>
                            </div>
                            <div className="space-y-3">
                              {items.map((item) => (
                                <CompletedTaskCard key={item.execution.id} item={item} members={members} />
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      {grouped.otherUnknownOwner.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-white/70 font-bold">
                            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">?</span>
                            <span className="truncate">不明なメンバー</span>
                          </div>
                          <div className="space-y-3">
                            {grouped.otherUnknownOwner.map((item) => (
                              <CompletedTaskCard key={item.execution.id} item={item} members={members} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Card variant="glass" className="text-center py-10">
              <p className="text-white/50">
                {mode === 'today' ? '今日の完了タスクはありません' : '完了タスクはありません'}
              </p>
            </Card>
          )}
        </section>

        {mode === 'all' && !state.loading && state.items.length > 0 && state.hasMore && (
          <section className="mt-6">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => fetchCompleted({ append: true, offset: state.items.length })}
            >
              もっと読み込む
            </Button>
          </section>
        )}
      </PageContainer>
    </>
  )
}


