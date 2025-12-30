import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, Calendar, Clock, User } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Avatar } from '../components/ui/Avatar'
import { getTaskExecutions, ApiError } from '../api'
import { useMember } from '../hooks'
import { toISODateString, formatJa, formatTimeFromISO, isParentRole } from '../utils'
import type { TaskExecutionWithDetails, TaskExecution } from '../types'

type LoadState = {
  loading: boolean
  error: string | null
  items: TaskExecution[]
}

/**
 * 完了済みExecution一覧（snapshot表示）
 */
export function CompletedExecutions() {
  const today = new Date()
  const [date, setDate] = useState<string>(toISODateString(today))
  const [state, setState] = useState<LoadState>({
    loading: true,
    error: null,
    items: [],
  })

  const { members, fetchMembers } = useMember()

  const fetchCompleted = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const res = await getTaskExecutions({
        scheduledDate: date,
        status: 'COMPLETED',
        limit: 100,
        offset: 0,
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

      setState({ loading: false, error: null, items })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '完了一覧の取得に失敗しました'
      setState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [date])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchCompleted()
  }, [fetchCompleted])

  const itemsWithMembers: TaskExecutionWithDetails[] = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m]))
    return state.items.map((t) => ({
      ...t,
      assignee: t.assigneeMemberId ? map.get(t.assigneeMemberId) : undefined,
      completedBy: t.completedByMemberId ? map.get(t.completedByMemberId) : undefined,
    }))
  }, [members, state.items])

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchMembers(), fetchCompleted()])
  }, [fetchMembers, fetchCompleted])

  return (
    <>
      <Header
        title="完了したタスク"
        subtitle={formatJa(new Date(date), 'M月d日（E）')}
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
          <label className="block text-sm text-white/70 mb-2">日付</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-white/70">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white"
            />
          </div>
        </section>

        <section className="space-y-3">
          {state.loading ? (
            <div className="text-center py-10">
              <p className="text-white/50">読み込み中...</p>
            </div>
          ) : itemsWithMembers.length > 0 ? (
            itemsWithMembers.map((t) => (
              <Card key={t.id} variant="glass">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">
                          {t.taskSnapshot.name || '(名称不明)'}
                        </p>
                        {t.taskSnapshot.description && (
                          <p className="text-sm text-white/50 line-clamp-2 mt-1">
                            {t.taskSnapshot.description}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-white/40 whitespace-nowrap">
                        v{t.taskSnapshot.definitionVersion}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-white/50 mt-3">
                      {t.taskSnapshot.scheduledStartTime && t.taskSnapshot.scheduledEndTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTimeFromISO(t.taskSnapshot.scheduledStartTime)} - {formatTimeFromISO(t.taskSnapshot.scheduledEndTime)}
                        </span>
                      )}
                      {t.completedBy && (
                        <span className="flex items-center gap-1.5 text-coral-400 font-medium">
                          <Avatar
                            name={t.completedBy.name}
                            size="sm"
                            role={t.completedBy.role}
                            variant={isParentRole(t.completedBy.role) ? 'parent' : 'child'}
                          />
                          {t.completedBy.name}
                        </span>
                      )}
                      {t.completedAt && (
                        <span className="text-white/40">
                          完了: {formatJa(new Date(t.completedAt), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card variant="glass" className="text-center py-10">
              <p className="text-white/50">この日の完了タスクはありません</p>
            </Card>
          )}
        </section>
      </PageContainer>
    </>
  )
}


