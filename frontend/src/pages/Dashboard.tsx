/**
 * ダッシュボードページ
 *
 * 今日のタスク一覧を表示するホーム画面
 * CQRSパターン: DashboardQueryServiceを使用して一括データ取得
 */
import { useState, useCallback, useMemo, useEffect } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { addDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { SectionBox } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { ProgressSummaryCard, TaskGroupsSection, TodayTaskCard, TomorrowTaskDetailModal } from '../components/dashboard'
import { TaskActionModal } from '../components/dashboard/TaskActionModal'
import { NotificationPermissionModal } from '../components/push/NotificationPermissionModal'
import { useDashboard, useMembers, usePushSubscription } from '../hooks'
import { useAuth } from '../contexts'
import { formatJa, toISODateString, formatScheduleDtoLabel } from '../utils'
import { getDashboardData, getTaskDefinitions, ApiError } from '../api'
import type { TodayTaskDto } from '../api/dashboard'

/**
 * ダッシュボードページ
 */
export function Dashboard() {
  const today = new Date()
  const todayStr = toISODateString(today)
  const tomorrowDate = addDays(today, 1)
  const tomorrowStr = toISODateString(tomorrowDate)
  const { user } = useAuth()
  const navigate = useNavigate()

  // 選択中のタスク（モーダル表示用）
  const [selectedTask, setSelectedTask] = useState<TodayTaskDto | null>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  // 明日のタスク一覧モーダル
  const [showTomorrowModal, setShowTomorrowModal] = useState(false)
  const [tomorrowTasks, setTomorrowTasks] = useState<TodayTaskDto[]>([])
  const [tomorrowLoading, setTomorrowLoading] = useState(false)
  const [tomorrowError, setTomorrowError] = useState<string | null>(null)
  const [tomorrowFetched, setTomorrowFetched] = useState(false)
  const [selectedTomorrowTask, setSelectedTomorrowTask] = useState<TodayTaskDto | null>(null)
  const [showTomorrowDetailModal, setShowTomorrowDetailModal] = useState(false)

  // ダッシュボードデータ取得（CQRS Query）
  const {
    todayTasks,
    loading,
    error,
    refetch,
    startTask,
    completeTask,
    assignTask,
    clearError,
  } = useDashboard(todayStr)

  // メンバー一覧取得（モーダルの担当者選択用）
  const { members, fetchMembers } = useMembers()

  // 周期チップの文言（タスク定義ID → 毎日／毎週火曜／9/22）
  const [scheduleLabels, setScheduleLabels] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    getTaskDefinitions()
      .then((res) => {
        if (cancelled) return
        const labels: Record<string, string> = {}
        for (const def of res.taskDefinitions) {
          labels[def.id] = formatScheduleDtoLabel(def.schedule)
        }
        setScheduleLabels(labels)
      })
      .catch(() => {
        // 文言が取れなくてもカードは日付／「定期」で表示できるので握りつぶす
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Push通知購読
  const {
    isRegistering,
    subscribe,
    hasPermissionAnswer,
    hasCheckedPermissionAnswer,
    isCheckingPermissionAnswer,
    savePermissionAnswer,
    checkSubscription,
  } = usePushSubscription()

  // 通知許可モーダルの表示状態
  const [showNotificationModal, setShowNotificationModal] = useState(false)

  // 初回ロード時にメンバーも取得
  useState(() => {
    fetchMembers()
  })

  // ログイン時に購読状態を再確認
  useEffect(() => {
    if (user) {
      void checkSubscription()
    }
  }, [user, checkSubscription])

  // 通知許可モーダルの表示条件チェック
  useEffect(() => {
    if (!user) {
      setShowNotificationModal(false)
      return
    }
    if (isCheckingPermissionAnswer || !hasCheckedPermissionAnswer) {
      setShowNotificationModal(false)
      return
    }

    setShowNotificationModal(!hasPermissionAnswer)
  }, [
    user,
    hasPermissionAnswer,
    hasCheckedPermissionAnswer,
    isCheckingPermissionAnswer,
  ])

  // タスクを今日のタスクと将来のタスクに分離
  const { todayActiveTasks, completedTasks, futureTasks } = useMemo(() => {
    const todayActive = todayTasks.filter((task) => {
      // キャンセル済みは除外
      if (task.status === 'CANCELLED') return false
      // 完了済みは除外
      if (task.status === 'COMPLETED') return false
      // 予定日が今日のタスク
      return task.scheduledDate === todayStr
    })
    
    const completed = todayTasks.filter((task) => {
      return task.status === 'COMPLETED' && task.scheduledDate === todayStr
    })
    
    const future = todayTasks.filter((task) => {
      if (task.status === 'CANCELLED') return false
      // 予定日が今日より後のタスク
      return task.scheduledDate > todayStr
    })
    
    return { todayActiveTasks: todayActive, completedTasks: completed, futureTasks: future }
  }, [todayTasks, todayStr])

  // 明日モーダル/今日のactive/完了済み表示は TaskGroupsSection に移譲

  // 進捗サマリーの計算（今日の家族タスクのみ）
  const { completedCount, totalCount } = useMemo(() => {
    // 家族タスクのみをカウント
    const familyActiveTasks = todayActiveTasks.filter((t) => t.scope === 'FAMILY')
    const familyCompletedTasks = completedTasks.filter((t) => t.scope === 'FAMILY')
    return { 
      completedCount: familyCompletedTasks.length, 
      totalCount: familyActiveTasks.length + familyCompletedTasks.length 
    }
  }, [todayActiveTasks, completedTasks])

  /**
   * タスククリック時の処理（モーダル表示）
   */
  const handleTaskClick = useCallback((task: TodayTaskDto) => {
    setSelectedTask(task)
    setShowTaskModal(true)
  }, [])

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = useCallback(() => {
    setShowTaskModal(false)
    setSelectedTask(null)
  }, [])

  /**
   * タスク開始処理
   */
  const handleStartTask = useCallback(async (taskExecutionId: string, memberIds: string[]) => {
    return await startTask(taskExecutionId, memberIds)
  }, [startTask])

  /**
   * タスク完了処理
   */
  const handleCompleteTask = useCallback(async (taskExecutionId: string) => {
    return await completeTask(taskExecutionId)
  }, [completeTask])

  /**
   * 担当者割り当て処理
   */
  const handleAssignTask = useCallback(async (taskExecutionId: string, memberIds: string[]) => {
    return await assignTask(taskExecutionId, memberIds)
  }, [assignTask])

  /**
   * 通知許可モーダル: 許可する
   */
  const handleAllowNotification = useCallback(async () => {
    const success = await subscribe()
    if (success) {
      setShowNotificationModal(false)
    }
  }, [subscribe])

  /**
   * 通知許可モーダル: 今はしない
   */
  const handleDismissNotification = useCallback(() => {
    const save = async () => {
      const saved = await savePermissionAnswer(false)
      if (saved) {
        setShowNotificationModal(false)
      }
    }

    void save()
  }, [savePermissionAnswer])

  /**
   * データ再取得
   */
  const handleRefresh = useCallback(async () => {
    await refetch()
    await fetchMembers()
  }, [refetch, fetchMembers])

  const fetchTomorrow = useCallback(async () => {
    setTomorrowLoading(true)
    setTomorrowError(null)

    try {
      const data = await getDashboardData(tomorrowStr)
      setTomorrowTasks(data.todayTasks)
      setTomorrowFetched(true)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : '明日のタスク取得に失敗しました'
      setTomorrowError(message)
      setTomorrowFetched(false)
    } finally {
      setTomorrowLoading(false)
    }
  }, [tomorrowStr])

  // エラー自動クリア（5秒後）
  if (error) {
    setTimeout(() => clearError(), 5000)
  }

  return (
    <>
      <Header
        title="ホーム"
        subtitle={formatJa(today, 'M月d日 EEEE')}
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="最新の状態に更新"
            className="w-11 h-11 rounded-full bg-surface text-accent flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
          </button>
        }
      />
      <PageContainer>
        {/* エラーメッセージ */}
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* 進捗サマリー（家族タスクのみ） */}
        <section className="pt-1 pb-4">
          <ProgressSummaryCard
            completedCount={completedCount}
            totalCount={totalCount}
            label="今日の家族タスク"
            footer={
              <button
                type="button"
                onClick={() => {
                  setShowTomorrowModal(true)
                  if (!tomorrowFetched && !tomorrowLoading) {
                    void fetchTomorrow()
                  }
                }}
                className="w-full flex items-center justify-between min-h-tap px-4 text-[15px] text-ink"
              >
                <span>明日のタスクを見る</span>
                <ChevronRight className="w-[18px] h-[18px] text-icon-muted" />
              </button>
            }
          />
        </section>

        {/* 今日のタスク一覧 */}
        <section>
          {loading ? (
            <div className="bg-surface rounded-box py-8 text-center">
              <p className="text-ink-muted">読み込み中...</p>
            </div>
          ) : (
            <TaskGroupsSection
              tasks={todayActiveTasks}
              members={members}
              currentUserId={user?.id}
              onTaskClick={handleTaskClick}
              scheduleLabels={scheduleLabels}
              emptyTitle="今日のタスクはありません"
              emptyDescription="タスク設定画面でタスクを作成してください"
              familyFooter={
                <>
                  {completedTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCompleted(!showCompleted)}
                      aria-expanded={showCompleted}
                      className="w-full flex items-center gap-2.5 min-h-tap px-3.5 rounded-card text-[15px] text-ink-muted"
                    >
                      <Check className="w-[22px] h-[22px] text-accent" strokeWidth={2.5} />
                      <span className="flex-1 text-left tabular">完了 {completedTasks.length} 件</span>
                      <ChevronDown
                        className={clsx('w-[18px] h-[18px] text-icon-muted transition-transform', showCompleted && 'rotate-180')}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate('/executions/completed')}
                    className="w-full flex items-center justify-between min-h-tap px-3.5 rounded-card text-[15px] text-ink"
                  >
                    <span>完了したタスクを見る</span>
                    <ChevronRight className="w-[18px] h-[18px] text-icon-muted" />
                  </button>
                </>
              }
            />
          )}
        </section>

        {/* 完了済みタスク（展開時） */}
        {completedTasks.length > 0 && showCompleted && (
          <section className="mt-3">
            <TaskGroupsSection
              tasks={completedTasks}
              members={members}
              currentUserId={user?.id}
              onTaskClick={handleTaskClick}
              scheduleLabels={scheduleLabels}
              emptyTitle="完了済みタスクはありません"
            />
          </section>
        )}

        {/* 将来の単発タスク（存在する場合のみ表示） */}
        {futureTasks.length > 0 && (
          <section className="mt-3">
            <SectionBox title="今後の単発タスク" meta={`${futureTasks.length} 件`}>
              {futureTasks.map((task) => (
                <TodayTaskCard
                  key={task.taskExecutionId}
                  task={task}
                  onClick={handleTaskClick}
                  showDate
                  members={members}
                  scheduleLabel={scheduleLabels[task.taskDefinitionId]}
                />
              ))}
            </SectionBox>
          </section>
        )}

        {/* タスクアクションモーダル */}
        <TaskActionModal
          isOpen={showTaskModal}
          onClose={handleCloseModal}
          task={selectedTask}
          members={members}
          currentMemberId={user?.id}
          onStart={handleStartTask}
          onComplete={handleCompleteTask}
          onAssign={handleAssignTask}
          scheduleLabel={selectedTask ? scheduleLabels[selectedTask.taskDefinitionId] : undefined}
        />

        <NotificationPermissionModal
          isOpen={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          onAllow={handleAllowNotification}
          onDismiss={handleDismissNotification}
          isRegistering={isRegistering}
        />

        {/* 明日のタスク一覧モーダル */}
        <Modal
          isOpen={showTomorrowModal}
          onClose={() => setShowTomorrowModal(false)}
          title={`明日のタスク（${formatJa(tomorrowDate, 'M月d日（E）')}）`}
          footer={
            <Button variant="secondary" size="lg" onClick={() => setShowTomorrowModal(false)} className="flex-1">
              閉じる
            </Button>
          }
        >
          {tomorrowError && (
            <Alert variant="error">
              <span className="flex flex-wrap items-center gap-3">
                <span>{tomorrowError}</span>
                <Button variant="secondary" size="sm" onClick={() => void fetchTomorrow()}>
                  再取得
                </Button>
              </span>
            </Alert>
          )}

          {tomorrowLoading ? (
            <div className="text-center py-8">
              <p className="text-ink-muted">読み込み中...</p>
            </div>
          ) : (
            <TaskGroupsSection
              tasks={tomorrowTasks.filter((t) => t.status !== 'CANCELLED' && t.status !== 'COMPLETED' && t.scheduledDate === tomorrowStr)}
              members={members}
              currentUserId={user?.id}
              onTaskClick={(task) => {
                setSelectedTomorrowTask(task)
                setShowTomorrowModal(false)
                setShowTomorrowDetailModal(true)
              }}
              showDate={false}
              scheduleLabels={scheduleLabels}
              emptyTitle="明日のタスクはありません"
            />
          )}
        </Modal>

        {/* 明日のタスク詳細（閲覧専用） */}
        <TomorrowTaskDetailModal
          isOpen={showTomorrowDetailModal}
          task={selectedTomorrowTask}
          members={members}
          scheduleLabel={selectedTomorrowTask ? scheduleLabels[selectedTomorrowTask.taskDefinitionId] : undefined}
          onClose={() => {
            setShowTomorrowDetailModal(false)
            setSelectedTomorrowTask(null)
          }}
          onBackToList={() => {
            setShowTomorrowDetailModal(false)
            setShowTomorrowModal(true)
          }}
        />
      </PageContainer>
    </>
  )
}
