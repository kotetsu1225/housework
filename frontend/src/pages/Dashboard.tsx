/**
 * ダッシュボードページ
 *
 * 今日のタスク一覧と進捗サマリーを表示するホーム画面
 *
 * @note TaskExecution APIはバックエンドで未実装のため、現在はモックデータを使用しています。
 *       バックエンドのTaskExecutions Presentation層が実装されると、実際のAPIを呼び出すようになります。
 * @see docs/BACKEND_ISSUES.md - 1. TaskExecutions Presentation層の欠落
 */

import { useEffect, useMemo, useCallback, useState } from 'react'
import { RefreshCw } from 'lucide-react'
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
import { MOCK_TASK_EXECUTIONS } from '../mocks'
import type { TaskExecution, Member } from '../types'

/**
 * バックエンドのTaskExecution APIが実装されているかどうかのフラグ
 *
 * @note バックエンドのTaskExecutions Presentation層が実装されたら、
 *       このフラグをtrueに変更してください。
 * @see docs/BACKEND_ISSUES.md
 */
const USE_REAL_TASK_EXECUTION_API = false

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

  // API未実装時のモックデータ使用フラグ
  const [usingMockData, setUsingMockData] = useState(!USE_REAL_TASK_EXECUTION_API)

  // タスク実行管理フック
  const {
    taskExecutions,
    loading: tasksLoading,
    error: tasksError,
    fetchTaskExecutions,
    startTask,
    completeTask,
    setTaskExecutions,
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
    // Member APIは実装済みなので、実際のAPIを呼び出す
    fetchMembers()

    if (USE_REAL_TASK_EXECUTION_API) {
      // TaskExecution APIが実装されている場合
      fetchTaskExecutions({ date: todayStr })
      setUsingMockData(false)
    } else {
      // TaskExecution APIが未実装の場合、モックデータを使用
      const todayMockTasks = MOCK_TASK_EXECUTIONS.filter(
        (t) => t.scheduledDate === todayStr
      )
      setTaskExecutions(todayMockTasks)
      setUsingMockData(true)
    }
  }, [todayStr, fetchMembers, fetchTaskExecutions, setTaskExecutions])

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
    // Member APIを再取得
    await fetchMembers()

    if (USE_REAL_TASK_EXECUTION_API) {
      await fetchTaskExecutions({ date: todayStr })
    } else {
      // モックデータをリセット
      const todayMockTasks = MOCK_TASK_EXECUTIONS.filter(
        (t) => t.scheduledDate === todayStr
      )
      setTaskExecutions(todayMockTasks)
    }
  }, [todayStr, fetchMembers, fetchTaskExecutions, setTaskExecutions])

  /**
   * ステータスアイコンクリック時の処理
   *
   * @note TaskExecution APIが未実装のため、現在はローカル状態のみ更新します。
   *       APIが実装されると、バックエンドと同期されます。
   */
  const handleStatusClick = useCallback(
    async (task: TaskExecution) => {
      if (!user) return

      if (USE_REAL_TASK_EXECUTION_API) {
        // 実際のAPIを呼び出す
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
      } else {
        // モックモード: ローカル状態のみ更新
        setTaskExecutions((prev) =>
          prev.map((t) => {
            if (t.id !== task.id) return t

            switch (t.status) {
              case 'NOT_STARTED':
                return {
                  ...t,
                  status: 'IN_PROGRESS' as const,
                  assigneeMemberId: user.id,
                  startedAt: new Date().toISOString(),
                  taskSnapshot: {
                    ...t.taskSnapshot,
                    createdAt: new Date().toISOString(),
                  },
                }
              case 'IN_PROGRESS':
                return {
                  ...t,
                  status: 'COMPLETED' as const,
                  completedAt: new Date().toISOString(),
                  completedByMemberId: user.id,
                }
              default:
                return t
            }
          })
        )
      }
    },
    [user, startTask, completeTask, setTaskExecutions]
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
        {/* 開発用: モックデータ使用時の通知 */}
        {usingMockData && (
          <Alert variant="info" className="mb-4">
            タスクデータはモックを使用しています（バックエンドAPI未実装）
          </Alert>
        )}

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
            <Button variant="ghost" size="sm">
              すべて見る
            </Button>
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
              <div className="text-center py-8 text-white/50">
                {loading ? '読み込み中...' : '今日のタスクはありません'}
              </div>
            )}
          </div>
        </section>

        {/* メンバーの状況 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white mb-4">メンバー</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
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
