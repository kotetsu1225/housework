import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CheckCircle2, Circle, PlayCircle, Sparkles } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { ProgressRing } from '../components/ui/ProgressRing'
import { Button } from '../components/ui/Button'
import type { TaskExecution, Member, ExecutionStatus, FamilyRole } from '../types'

const isParentRole = (role: FamilyRole): boolean => {
  return role === 'FATHER' || role === 'MOTHER'
}

// モックデータ（バックエンド接続後に置き換え）
const mockMembers: Member[] = [
  { id: '1', name: '母', role: 'MOTHER', createdAt: '', updatedAt: '' },
  { id: '2', name: '太郎', role: 'BROTHER', createdAt: '', updatedAt: '' },
  { id: '3', name: '花子', role: 'SISTER', createdAt: '', updatedAt: '' },
]

const mockTasks: (TaskExecution & { assignee?: Member })[] = [
  {
    id: '1',
    taskDefinitionId: 't1',
    assigneeMemberId: '2',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'COMPLETED',
    taskSnapshot: {
      name: 'お風呂掃除',
      description: '浴槽と床を洗う',
      estimatedMinutes: 15,
      definitionVersion: 1,
      createdAt: '',
    },
    completedAt: new Date().toISOString(),
    completedByMemberId: '2',
    createdAt: '',
    updatedAt: '',
    assignee: mockMembers[1],
  },
  {
    id: '2',
    taskDefinitionId: 't2',
    assigneeMemberId: '3',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'IN_PROGRESS',
    taskSnapshot: {
      name: '洗濯物を干す',
      estimatedMinutes: 20,
      definitionVersion: 1,
      createdAt: '',
    },
    startedAt: new Date().toISOString(),
    createdAt: '',
    updatedAt: '',
    assignee: mockMembers[2],
  },
  {
    id: '3',
    taskDefinitionId: 't3',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'NOT_STARTED',
    taskSnapshot: {
      name: '夕食の準備',
      description: 'カレーを作る',
      estimatedMinutes: 45,
      definitionVersion: 1,
      createdAt: '',
    },
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '4',
    taskDefinitionId: 't4',
    assigneeMemberId: '2',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'NOT_STARTED',
    taskSnapshot: {
      name: 'ゴミ出し',
      estimatedMinutes: 5,
      definitionVersion: 1,
      createdAt: '',
    },
    createdAt: '',
    updatedAt: '',
    assignee: mockMembers[1],
  },
]

const getStatusIcon = (status: ExecutionStatus) => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
    case 'IN_PROGRESS':
      return <PlayCircle className="w-5 h-5 text-shazam-400" />
    default:
      return <Circle className="w-5 h-5 text-white/30" />
  }
}

const getStatusBadge = (status: ExecutionStatus) => {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="success">完了</Badge>
    case 'IN_PROGRESS':
      return <Badge variant="info">実行中</Badge>
    case 'CANCELLED':
      return <Badge variant="danger">キャンセル</Badge>
    default:
      return <Badge variant="default">未着手</Badge>
  }
}

export function Dashboard() {
  const today = new Date()
  const completedCount = mockTasks.filter(t => t.status === 'COMPLETED').length
  const totalCount = mockTasks.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <>
      <Header
        title="ホーム"
        subtitle={format(today, 'M月d日（E）', { locale: ja })}
      />
      <PageContainer>
        {/* 進捗サマリー */}
        <section className="py-6">
          <Card variant="gradient" className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-shazam-500/20 rounded-full blur-3xl" />
            <div className="flex items-center gap-6">
              <ProgressRing progress={progress} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-shazam-400" />
                  <span className="text-sm text-white/60">今日の進捗</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {completedCount} / {totalCount}
                </p>
                <p className="text-sm text-white/50 mt-1">
                  {totalCount - completedCount}件のタスクが残っています
                </p>
              </div>
            </div>
          </Card>
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
            {mockTasks.map((task) => (
              <Card
                key={task.id}
                variant="glass"
                hoverable
                className="flex items-center gap-4"
              >
                <button className="flex-shrink-0">
                  {getStatusIcon(task.status)}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`font-medium truncate ${
                        task.status === 'COMPLETED'
                          ? 'text-white/50 line-through'
                          : 'text-white'
                      }`}
                    >
                      {task.taskSnapshot.name}
                    </span>
                    {getStatusBadge(task.status)}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/50">
                    <span>{task.taskSnapshot.estimatedMinutes}分</span>
                    {task.assignee && (
                      <div className="flex items-center gap-1">
                        <Avatar
                          name={task.assignee.name}
                          size="sm"
                          variant={isParentRole(task.assignee.role) ? 'parent' : 'child'}
                        />
                        <span>{task.assignee.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* メンバーの空き状況 */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white mb-4">メンバー</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4">
            {mockMembers.map((member) => {
              const memberTasks = mockTasks.filter(
                (t) => t.assigneeMemberId === member.id
              )
              const memberCompleted = memberTasks.filter(
                (t) => t.status === 'COMPLETED'
              ).length

              return (
                <Card
                  key={member.id}
                  variant="glass"
                  className="flex-shrink-0 w-28 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Avatar
                      name={member.name}
                      size="lg"
                      variant={isParentRole(member.role) ? 'parent' : 'child'}
                    />
                    <span className="font-medium text-white">{member.name}</span>
                    <span className="text-xs text-white/50">
                      {memberCompleted}/{memberTasks.length}完了
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      </PageContainer>
    </>
  )
}
