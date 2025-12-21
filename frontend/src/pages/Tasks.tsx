import { useState } from 'react'
import { Plus, Filter, Calendar, Clock, ChevronRight } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import type { TaskDefinition, TaskScope, ScheduleType } from '../types'

// モックデータ
const mockTaskDefinitions: TaskDefinition[] = [
  {
    id: '1',
    name: 'お風呂掃除',
    description: '浴槽と床を洗う。排水溝も忘れずに。',
    estimatedMinutes: 15,
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: false,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    name: '洗濯物を干す',
    description: '洗濯機を回してからベランダに干す',
    estimatedMinutes: 20,
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: true,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '3',
    name: '夕食の準備',
    description: 'メニューは冷蔵庫に貼ってある献立表を参照',
    estimatedMinutes: 45,
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: false,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '4',
    name: 'ゴミ出し',
    estimatedMinutes: 5,
    scope: 'FAMILY',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'WEEKLY',
      weeklyDayOfWeek: 2,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '5',
    name: '宿題',
    description: '学校の宿題をやる',
    estimatedMinutes: 60,
    scope: 'PERSONAL',
    ownerMemberId: '2',
    scheduleType: 'RECURRING',
    recurrence: {
      patternType: 'DAILY',
      dailySkipWeekends: true,
      startDate: '2024-01-01',
    },
    version: 1,
    isDeleted: false,
    createdAt: '',
    updatedAt: '',
  },
]

const getScopeBadge = (scope: TaskScope) => {
  return scope === 'FAMILY' ? (
    <Badge variant="info" size="sm">家族</Badge>
  ) : (
    <Badge variant="warning" size="sm">個人</Badge>
  )
}

const getScheduleBadge = (task: TaskDefinition) => {
  if (task.scheduleType === 'ONE_TIME') {
    return <Badge variant="default" size="sm">単発</Badge>
  }
  const pattern = task.recurrence?.patternType
  switch (pattern) {
    case 'DAILY':
      return <Badge variant="success" size="sm">毎日</Badge>
    case 'WEEKLY':
      return <Badge variant="info" size="sm">毎週</Badge>
    case 'MONTHLY':
      return <Badge variant="default" size="sm">毎月</Badge>
    default:
      return null
  }
}

export function Tasks() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterScope, setFilterScope] = useState<TaskScope | 'ALL'>('ALL')

  const filteredTasks = mockTaskDefinitions.filter((task) => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesScope = filterScope === 'ALL' || task.scope === filterScope
    return matchesSearch && matchesScope && !task.isDeleted
  })

  return (
    <>
      <Header
        title="タスク定義"
        subtitle={`${mockTaskDefinitions.length}件のタスク`}
        action={
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            追加
          </Button>
        }
      />
      <PageContainer>
        {/* 検索とフィルター */}
        <section className="py-4 space-y-3">
          <Input
            placeholder="タスクを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant={filterScope === 'ALL' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterScope('ALL')}
            >
              すべて
            </Button>
            <Button
              variant={filterScope === 'FAMILY' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterScope('FAMILY')}
            >
              家族
            </Button>
            <Button
              variant={filterScope === 'PERSONAL' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterScope('PERSONAL')}
            >
              個人
            </Button>
          </div>
        </section>

        {/* タスク一覧 */}
        <section className="space-y-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} variant="glass" hoverable>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-white truncate">
                      {task.name}
                    </span>
                    {getScopeBadge(task.scope)}
                    {getScheduleBadge(task)}
                  </div>
                  {task.description && (
                    <p className="text-sm text-white/50 line-clamp-1 mb-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-white/40">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{task.estimatedMinutes}分</span>
                    </div>
                    {task.recurrence && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {task.recurrence.patternType === 'DAILY' && '毎日'}
                          {task.recurrence.patternType === 'WEEKLY' && '毎週'}
                          {task.recurrence.patternType === 'MONTHLY' && '毎月'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30 flex-shrink-0" />
              </div>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">タスクが見つかりません</p>
            </div>
          )}
        </section>
      </PageContainer>
    </>
  )
}
