/**
 * ダッシュボードページ
 *
 * 今日のタスク一覧と進捗サマリーを表示するホーム画面
 * @see docs/TASK_EXECUTION_API.md
 */

import { useEffect, useMemo, useCallback } from 'react'
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
import { MOCK_TASK_EXECUTIONS, MOCK_MEMBERS } from '../mocks'
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
 *
 * @note 現在はモックデータを使用。バックエンドAPI実装後、
 *       useEffect内のfetchTaskExecutions呼び出しを有効化する。
 */
export function Dashboard() {
  const today = new Date()
  const todayStr = toISODateString(today)
  const { user } = useAuth()

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

  // メンバー管理フック
  const {
    members,
    loading: membersLoading,
    error: membersError,
    fetchMembers,
    setMembers,
    clearError: clearMemberError,
  } = useMember()

  const loading = tasksLoading || membersLoading
  const error = tasksError || membersError

  // 初回マウント時にデータを取得
  useEffect(() => {
    // TODO: バックエンドAPI実装後、以下のコメントを解除
    // fetchTaskExecutions({ date: todayStr })
    // fetchMembers()

    // 現在はモックデータを使用
    setTaskExecutions(MOCK_TASK_EXECUTIONS.filter((t) => t.scheduledDate === todayStr))
    setMembers(MOCK_MEMBERS)
  }, [todayStr, setTaskExecutions, setMembers])

  // エラー自動クリア
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

  // データ再取得
  const handleRefresh = useCallback(async () => {
    // TODO: バックエンドAPI実装後、以下のコメントを解除
    // await Promise.all([
    //   fetchTaskExecutions({ date: todayStr }),
    //   fetchMembers(),
    // ])

    // 現在はモックデータをリセット
    setTaskExecutions(MOCK_TASK_EXECUTIONS.filter((t) => t.scheduledDate === todayStr))
    setMembers(MOCK_MEMBERS)
  }, [todayStr, setTaskExecutions, setMembers])

  // ステータスアイコンクリック時の処理
  const handleStatusClick = useCallback(
    async (task: TaskExecution) => {
      if (!user) return

      switch (task.status) {
        case 'NOT_STARTED':
          // 未着手 → 開始
          await startTask(task.id, user.id)
          break
        case 'IN_PROGRESS':
          // 実行中 → 完了
          await completeTask(task.id, user.id)
          break
        default:
          // COMPLETED, CANCELLED は何もしない
          break
      }
    },
    [user, startTask, completeTask]
  )

  // タスクカードクリック時の処理
  const handleTaskClick = useCallback((task: TaskExecution) => {
    // TODO: タスク詳細画面への遷移を実装
    console.log('Task clicked:', task.id)
  }, [])

  // メンバーカードクリック時の処理
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
