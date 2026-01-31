/**
 * 完了済みタスク一覧ページ
 *
 * 2つのモードで動作:
 * - ホームモード (/executions/completed): 全員の完了タスクを表示
 * - メンバーモード (/members/:memberId/completed): 特定メンバーの全履歴を表示
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, RefreshCw, User, Users, ChevronDown, ArrowLeft, Trophy } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Avatar } from '../components/ui/Avatar'
import { CompletedTaskCard } from '../components/dashboard'
import { useCompletedTasks, useMembers } from '../hooks'
import { useAuth } from '../contexts'
import { toISODateString, formatJa, isParentRole } from '../utils'
import { getRoleLabel } from '../constants'
import type { CompletedTaskDto } from '../api/completedTasks'

type FilterTab = 'all' | 'family' | 'personal'

/**
 * 完了済みタスク一覧ページ
 */
export function CompletedExecutions() {
  const { memberId } = useParams<{ memberId?: string }>()
  const navigate = useNavigate()
  const today = new Date()
  const todayStr = toISODateString(today)

  // メンバーモードかどうか
  const isMemberMode = !!memberId

  // ホームモード用の表示切替
  const [homeMode, setHomeMode] = useState<'today' | 'all'>('today')
  const [showOtherMembers, setShowOtherMembers] = useState(false)

  // メンバーモード用のフィルタータブ
  const [filterTab, setFilterTab] = useState<FilterTab>('all')

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

  // メンバーモード: フィルタリングされたタスク
  const filteredTasks = useMemo(() => {
    if (!isMemberMode) return completedTasks
    switch (filterTab) {
      case 'family':
        return completedTasks.filter((task) => task.scope === 'FAMILY')
      case 'personal':
        return completedTasks.filter((task) => task.scope === 'PERSONAL')
      default:
        return completedTasks
    }
  }, [isMemberMode, completedTasks, filterTab])

  // メンバーモード: 累計ポイント計算
  const totalPoints = useMemo(() => {
    return completedTasks.reduce((sum, task) => sum + (task.frozenPoint ?? 0), 0)
  }, [completedTasks])

  // メンバーモード: スコープ別カウント
  const familyCount = useMemo(() => {
    return completedTasks.filter((t) => t.scope === 'FAMILY').length
  }, [completedTasks])

  const personalCount = useMemo(() => {
    return completedTasks.filter((t) => t.scope === 'PERSONAL').length
  }, [completedTasks])

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
    entries.sort(([aId], [bId]) => aId.localeCompare(bId))
    return entries
  }, [grouped])

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

  // =========================================
  // メンバーモードのレンダリング
  // =========================================
  if (isMemberMode) {
    return (
      <>
        <Header
          title={targetMember ? `${targetMember.name}の完了履歴` : '完了履歴'}
          subtitle={targetMember ? getRoleLabel(targetMember.role) : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate(`/members/${memberId}`)}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              戻る
            </Button>
          }
        />
        <PageContainer>
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          {/* プロフィール + 累計ポイント */}
          {targetMember && (
            <Card variant="glass" className="mb-6">
              <div className="flex items-center gap-4">
                <Avatar
                  name={targetMember.name}
                  size="lg"
                  role={targetMember.role}
                  variant={isParentRole(targetMember.role) ? 'parent' : 'child'}
                />
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">{targetMember.name}</h2>
                  <p className="text-white/50 text-sm">{getRoleLabel(targetMember.role)}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Trophy className="w-5 h-5" />
                    <span className="text-2xl font-bold">{totalPoints}</span>
                    <span className="text-sm">pt</span>
                  </div>
                  <p className="text-xs text-white/50">累計獲得ポイント</p>
                </div>
              </div>
            </Card>
          )}

          {/* フィルタータブ */}
          <section className="mb-4">
            <div className="flex gap-2">
              {(['all', 'family', 'personal'] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterTab === tab
                      ? 'bg-coral-500/20 text-coral-400 border border-coral-500/30'
                      : 'bg-dark-800/50 text-white/50 border border-transparent hover:border-dark-600'
                  }`}
                >
                  {tab === 'all' ? 'すべて' : tab === 'family' ? '家族' : '個人'}
                  <span className="ml-1 text-xs">
                    ({tab === 'all'
                      ? completedTasks.length
                      : tab === 'family'
                      ? familyCount
                      : personalCount})
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* タスク一覧 */}
          <section>
            {loading && completedTasks.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-white/50">読み込み中...</p>
              </div>
            ) : filteredTasks.length > 0 ? (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <CompletedTaskCard key={task.taskExecutionId} task={task} members={members} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-white/50">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>完了したタスクはありません</p>
              </div>
            )}
          </section>

          {/* もっと読み込む */}
          {!loading && completedTasks.length > 0 && hasMore && (
            <section className="mt-6">
              <Button variant="secondary" className="w-full" onClick={handleLoadMore}>
                もっと読み込む
              </Button>
            </section>
          )}
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
        subtitle={homeMode === 'all' ? '全て' : formatJa(today, 'M月d日（E）')}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <PageContainer>
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <section className="py-4">
          <label className="block text-sm text-white/70 mb-2">表示</label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={homeMode === 'today' ? 'primary' : 'secondary'}
              size="sm"
              className="w-full"
              onClick={() => setHomeMode('today')}
            >
              今日
            </Button>
            <Button
              variant={homeMode === 'all' ? 'primary' : 'secondary'}
              size="sm"
              className="w-full"
              onClick={() => setHomeMode('all')}
            >
              全て
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          {loading && completedTasks.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/50">読み込み中...</p>
            </div>
          ) : completedTasks.length > 0 && grouped ? (
            <div className="space-y-6">
              {/* 家族タスク */}
              {grouped.family.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/70 font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    家族のタスク
                  </h3>
                  <div className="space-y-2">
                    {grouped.family.map((task) => (
                      <CompletedTaskCard key={task.taskExecutionId} task={task} members={members} />
                    ))}
                  </div>
                </div>
              )}

              {/* 自分のタスク */}
              {grouped.myPersonal.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-white/70 font-bold flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    自分のタスク
                  </h3>
                  <div className="space-y-2">
                    {grouped.myPersonal.map((task) => (
                      <CompletedTaskCard key={task.taskExecutionId} task={task} members={members} />
                    ))}
                  </div>
                </div>
              )}

              {/* 他メンバーのタスク */}
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
                      {sortedOtherOwners.map(([ownerId, tasks]) => {
                        const ownerName = tasks[0]?.assigneeMembers.find(a => a.id === ownerId)?.name ?? '不明なメンバー'
                        return (
                          <div key={ownerId} className="space-y-3">
                            <div className="flex items-center gap-2 text-white/70 font-bold">
                              <span className="truncate">{ownerName}</span>
                            </div>
                            <div className="space-y-2">
                              {tasks.map((task) => (
                                <CompletedTaskCard key={task.taskExecutionId} task={task} members={members} />
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      {grouped.otherUnknownOwner.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-white/70 font-bold">
                            <span className="truncate">不明なメンバー</span>
                          </div>
                          <div className="space-y-2">
                            {grouped.otherUnknownOwner.map((task) => (
                              <CompletedTaskCard key={task.taskExecutionId} task={task} members={members} />
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
                {homeMode === 'today' ? '今日の完了タスクはありません' : '完了タスクはありません'}
              </p>
            </Card>
          )}
        </section>

        {/* もっと読み込むボタン */}
        {homeMode === 'all' && !loading && completedTasks.length > 0 && hasMore && (
          <section className="mt-6">
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleLoadMore}
            >
              もっと読み込む
            </Button>
          </section>
        )}
      </PageContainer>
    </>
  )
}
