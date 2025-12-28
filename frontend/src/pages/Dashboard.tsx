/**
 * ダッシュボードページ
 *
 * 今日のタスク一覧と進捗サマリーを表示するホーム画面
 */

import { useEffect, useMemo, useCallback, useState } from 'react'
import { RefreshCw, Plus } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Alert'
import {
  TaskCard,
  ProgressSummaryCard,
  MemberSummaryCard,
} from '../components/dashboard'
import { useTaskExecution, useMember } from '../hooks'
import { useAuth } from '../contexts'
import { formatJa, toISODateString } from '../utils'
import type { TaskExecution, Member } from '../types'

/**
 * メンバーIDからメンバー情報を取得するヘルパー
 */
function getMemberById(members: Member[], memberId?: string): Member | undefined {
  if (!memberId) return undefined
  return members.find((m) => m.id === memberId)
}

/**
 * タスク実行とメンバー情報を結合する
 */
function enrichTasksWithMembers(
  tasks: TaskExecution[],
  members: Member[]
): (TaskExecution & { assignee?: Member })[] {
  return tasks.map((task) => ({
    ...task,
    assignee: getMemberById(members, task.assigneeMemberId),
  }))
}

/**
 * メンバーごとのタスクサマリーを計算する
 */
function calculateMemberTaskSummary(
  members: Member[],
  tasks: TaskExecution[]
): { member: Member; completed: number; total: number }[] {
  return members.map((member) => {
    const memberTasks = tasks.filter((t) => t.assigneeMemberId === member.id)
    const completedTasks = memberTasks.filter((t) => t.status === 'COMPLETED')

    return {
      member,
      completed: completedTasks.length,
      total: memberTasks.length,
    }
  })
}

/**
 * ダッシュボードページ
 */
export function Dashboard() {
  const today = new Date()
  const todayStr = toISODateString(today)
  const { user } = useAuth()

  // タスク生成中フラグ
  const [isGenerating, setIsGenerating] = useState(false)

  // タスク実行管理フック
  const {
    taskExecutions,
    loading: tasksLoading,
    error: tasksError,
    fetchTaskExecutions,
    startTask,
    completeTask,
    generateTasks,
    clearError: clearTaskError,
  } = useTaskExecution()

  // メンバー管理フック（Member APIは実装済み）
  const {
    members,
    loading: membersLoading,
    error: membersError,
    fetchMembers,
    clearError: clearMemberError,
  } = useMember()

  const loading = tasksLoading || membersLoading
  const error = tasksError || membersError

  /**
   * 初回マウント時にデータを取得
   */
  useEffect(() => {
    fetchMembers()
    fetchTaskExecutions({ date: todayStr })
  }, [todayStr, fetchMembers, fetchTaskExecutions])

  /**
   * エラー自動クリア（5秒後）
   */
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearTaskError()
        clearMemberError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearTaskError, clearMemberError])

  // タスクにメンバー情報を結合
  const enrichedTasks = useMemo(
    () => enrichTasksWithMembers(taskExecutions, members),
    [taskExecutions, members]
  )

  // 進捗サマリーの計算（キャンセル以外のタスクを対象）
  const { completedCount, totalCount } = useMemo(() => {
    const activeTasks = taskExecutions.filter((t) => t.status !== 'CANCELLED')
    const completed = activeTasks.filter((t) => t.status === 'COMPLETED').length
    return { completedCount: completed, totalCount: activeTasks.length }
  }, [taskExecutions])

  // メンバーごとのサマリー
  const memberSummaries = useMemo(
    () => calculateMemberTaskSummary(members, taskExecutions),
    [members, taskExecutions]
  )

  /**
   * データ再取得ハンドラー
   */
  const handleRefresh = useCallback(async () => {
    await fetchMembers()
    await fetchTaskExecutions({ date: todayStr })
  }, [todayStr, fetchMembers, fetchTaskExecutions])

  /**
   * タスク生成ハンドラー
   */
  const handleGenerateTasks = useCallback(async () => {
    setIsGenerating(true)
    const success = await generateTasks(todayStr)
    if (success) {
      // 生成後にタスク一覧を再取得
      await fetchTaskExecutions({ date: todayStr })
    }
    setIsGenerating(false)
  }, [todayStr, generateTasks, fetchTaskExecutions])

  /**
   * ステータスアイコンクリック時の処理
   */
  const handleStatusClick = useCallback(
    async (task: TaskExecution) => {
      if (!user) return

      switch (task.status) {
        case 'NOT_STARTED':
          await startTask(task.id, user.id)
          break
        case 'IN_PROGRESS':
          await completeTask(task.id, user.id)
          break
        default:
          break
      }
    },
    [user, startTask, completeTask]
  )

  /**
   * タスクカードクリック時の処理
   */
  const handleTaskClick = useCallback((task: TaskExecution) => {
    // TODO: タスク詳細画面への遷移を実装
    console.log('Task clicked:', task.id)
  }, [])

  /**
   * メンバーカードクリック時の処理
   */
  const handleMemberClick = useCallback((member: Member) => {
    // TODO: メンバー詳細画面への遷移を実装
    console.log('Member clicked:', member.id)
  }, [])

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

        {/* 進捗サマリー */}
        <section className="py-6">
          <ProgressSummaryCard
            completedCount={completedCount}
            totalCount={totalCount}
          />
        </section>

        {/* タスク一覧 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">今日のタスク</h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateTasks}
                disabled={isGenerating || loading}
              >
                <Plus className="w-4 h-4 mr-1" />
                {isGenerating ? '生成中...' : '生成'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {enrichedTasks.length > 0 ? (
              enrichedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  assignee={task.assignee}
                  onClick={handleTaskClick}
                  onStatusClick={handleStatusClick}
                />
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-white/50 mb-4">
                  {loading ? '読み込み中...' : '今日のタスクはありません'}
                </p>
                {!loading && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateTasks}
                    disabled={isGenerating}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    今日のタスクを生成
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* メンバーの状況 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white mb-4">メンバー</h2>
          {/* モバイル: 横スクロール、タブレット以上: グリッド */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible">
            {memberSummaries.map(({ member, completed, total }) => (
              <MemberSummaryCard
                key={member.id}
                member={member}
                completedCount={completed}
                totalCount={total}
                onClick={handleMemberClick}
              />
            ))}
          </div>
        </section>
      </PageContainer>
    </>
  )
}
