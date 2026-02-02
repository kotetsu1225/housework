/**
 * ダッシュボードページ
 *
 * 今日のタスク一覧を表示するホーム画面
 * CQRSパターン: DashboardQueryServiceを使用して一括データ取得
 */
import { useState, useCallback, useMemo, useEffect } from 'react'
import { RefreshCw, ListTodo, CheckCircle2, ChevronDown, Calendar } from 'lucide-react'
import { addDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { ProgressSummaryCard, TaskGroupsSection, TodayTaskCard, TomorrowTaskDetailModal } from '../components/dashboard'
import { TaskActionModal } from '../components/dashboard/TaskActionModal'
import { NotificationPermissionModal } from '../components/push/NotificationPermissionModal'
import { useDashboard, useMembers, usePushSubscription } from '../hooks'
import { useAuth } from '../contexts'
import { formatJa, toISODateString } from '../utils'
import { getDashboardData, ApiError } from '../api'
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

  // Push通知購読
  const {
    permission,
    isRegistering,
    subscribe,
    hasBackendSubscription,
    isCheckingSubscription,
    hasPermissionAnswer,
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
    if (!user) return
    if (isCheckingSubscription || isCheckingPermissionAnswer) return

    if (hasPermissionAnswer) {
      setShowNotificationModal(false)
      return
    }

    const shouldShow =
      !hasBackendSubscription &&
      permission !== 'denied'

    setShowNotificationModal(shouldShow)
  }, [
    user,
    permission,
    hasBackendSubscription,
    hasPermissionAnswer,
    isCheckingSubscription,
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
        subtitle={formatJa(today, 'M月d日（E）')}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
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
        <section className="py-6">
          <ProgressSummaryCard
            completedCount={completedCount}
            totalCount={totalCount}
            label="今日の家族タスク進捗"
          />
        </section>

        {/* 今日のタスク一覧 */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-coral-400" />
              今日のタスク
            </h2>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowTomorrowModal(true)
                if (!tomorrowFetched && !tomorrowLoading) {
                  void fetchTomorrow()
                }
              }}
            >
              明日のタスクを確認する
            </Button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-white/50">読み込み中...</p>
              </div>
            ) : (
              <TaskGroupsSection
                tasks={todayActiveTasks}
                members={members}
                currentUserId={user?.id}
                onTaskClick={handleTaskClick}
                emptyTitle="今日のタスクはありません"
                emptyDescription="タスク設定画面でタスクを作成してください"
              />
            )}
          </div>
        </section>

        {/* 完了済みタスク */}
          <section className="mt-8">
            <div className="flex items-center justify-between gap-3 mb-4">
              {completedTasks.length > 0 && (
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-lg font-bold text-white/50 hover:text-white/70 transition-colors"
                  type="button"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400/50" />
                  完了済み家族タスク ({completedTasks.length})
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCompleted ? 'rotate-180' : ''}`} />
                </button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/executions/completed')}
              >
                完了タスク一覧を見る
              </Button>
            </div>
            
            {completedTasks.length > 0 && showCompleted && (
              <div className="opacity-60">
                <TaskGroupsSection
                  tasks={completedTasks}
                  members={members}
                  currentUserId={user?.id}
                  onTaskClick={handleTaskClick}
                  emptyTitle="完了済みタスクはありません"
                />
              </div>
            )}
          </section>

        {/* 将来の単発タスク（存在する場合のみ表示） */}
        {futureTasks.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-shazam-400" />
              今後の単発タスク
            </h2>
            
            <div className="space-y-3">
              {futureTasks.map((task) => (
                <TodayTaskCard
                  key={task.taskExecutionId}
                  task={task}
                  onClick={handleTaskClick}
                  showDate
                  members={members}
                />
              ))}
            </div>
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
          className=""
          footer={
            <Button variant="secondary" onClick={() => setShowTomorrowModal(false)} className="flex-1">
              閉じる
            </Button>
          }
        >
          {tomorrowError && (
            <Alert variant="error">
              <div className="space-y-3">
                <p>{tomorrowError}</p>
                <Button variant="secondary" size="sm" onClick={() => void fetchTomorrow()}>
                  再取得
                </Button>
              </div>
            </Alert>
          )}

          {tomorrowLoading ? (
            <div className="text-center py-8">
              <p className="text-white/50">読み込み中...</p>
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
              emptyTitle="明日のタスクはありません"
            />
          )}
        </Modal>

        {/* 明日のタスク詳細（閲覧専用） */}
        <TomorrowTaskDetailModal
          isOpen={showTomorrowDetailModal}
          task={selectedTomorrowTask}
          members={members}
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
