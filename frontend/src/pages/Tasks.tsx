import { useState, useEffect } from 'react'
import { Plus, Filter, Calendar, Clock, ChevronRight, Trash2, Edit2, RefreshCw } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { useTaskDefinition, useMember } from '../hooks'
import type { TaskDefinition, TaskScope, PatternType } from '../types'
import type { CreateTaskDefinitionRequest, ScheduleDto, PatternDto } from '../types/api'

/**
 * スコープバッジコンポーネント
 */
function ScopeBadge({ scope }: { scope: TaskScope }) {
  return scope === 'FAMILY' ? (
    <Badge variant="info" size="sm">家族</Badge>
  ) : (
    <Badge variant="warning" size="sm">個人</Badge>
  )
}

/**
 * スケジュールバッジコンポーネント
 */
function ScheduleBadge({ task }: { task: TaskDefinition }) {
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

/**
 * タスクカードコンポーネント
 */
interface TaskCardProps {
  task: TaskDefinition
  onEdit: (task: TaskDefinition) => void
  onDelete: (task: TaskDefinition) => void
}

function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  return (
    <Card variant="glass" hoverable>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-white truncate">{task.name}</span>
            <ScopeBadge scope={task.scope} />
            <ScheduleBadge task={task} />
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
        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            onClick={() => onEdit(task)}
          >
            <Edit2 className="w-4 h-4 text-white/50 hover:text-white" />
          </button>
          <button
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
            onClick={() => onDelete(task)}
          >
            <Trash2 className="w-4 h-4 text-white/50 hover:text-red-400" />
          </button>
        </div>
      </div>
    </Card>
  )
}

/**
 * パターンタイプ選択
 */
const PATTERN_OPTIONS: { value: PatternType; label: string }[] = [
  { value: 'DAILY', label: '毎日' },
  { value: 'WEEKLY', label: '毎週' },
  { value: 'MONTHLY', label: '毎月' },
]

/**
 * 曜日選択
 */
const DAY_OF_WEEK_OPTIONS: { value: string; label: string }[] = [
  { value: 'MONDAY', label: '月曜日' },
  { value: 'TUESDAY', label: '火曜日' },
  { value: 'WEDNESDAY', label: '水曜日' },
  { value: 'THURSDAY', label: '木曜日' },
  { value: 'FRIDAY', label: '金曜日' },
  { value: 'SATURDAY', label: '土曜日' },
  { value: 'SUNDAY', label: '日曜日' },
]

/**
 * タスク一覧ページ
 */
export function Tasks() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterScope, setFilterScope] = useState<TaskScope | 'ALL'>('ALL')

  // メンバー管理フック（個人タスクのオーナー選択用）
  const { members, fetchMembers, loading: membersLoading } = useMember()

  // タスク定義管理フック
  const {
    taskDefinitions,
    loading: taskLoading,
    error,
    fetchTaskDefinitions,
    addTaskDefinition,
    removeTaskDefinition,
    clearError,
  } = useTaskDefinition()

  const loading = membersLoading || taskLoading

  // 初回マウント時にデータを取得
  useEffect(() => {
    fetchMembers()
    fetchTaskDefinitions()
  }, [fetchMembers, fetchTaskDefinitions])

  // モーダル状態
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<TaskDefinition | null>(null)

  // 新規作成フォーム
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    estimatedMinutes: 15,
    scope: 'FAMILY' as TaskScope,
    ownerMemberId: '',
    scheduleType: 'RECURRING' as 'RECURRING' | 'ONE_TIME',
    patternType: 'DAILY' as PatternType,
    skipWeekends: false,
    dayOfWeek: 'MONDAY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    deadline: new Date().toISOString().split('T')[0],
  })

  // エラー自動クリア
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  // フィルタリング
  const filteredTasks = taskDefinitions.filter((task) => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesScope = filterScope === 'ALL' || task.scope === filterScope
    return matchesSearch && matchesScope && !task.isDeleted
  })

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = () => {
    setShowAddModal(false)
    setNewTask({
      name: '',
      description: '',
      estimatedMinutes: 15,
      scope: 'FAMILY',
      ownerMemberId: '',
      scheduleType: 'RECURRING',
      patternType: 'DAILY',
      skipWeekends: false,
      dayOfWeek: 'MONDAY',
      dayOfMonth: 1,
      startDate: new Date().toISOString().split('T')[0],
      deadline: new Date().toISOString().split('T')[0],
    })
    clearError()
  }

  /**
   * タスク定義追加ハンドラー
   */
  const handleAddTask = async () => {
    if (!newTask.name.trim()) return

    // スケジュールDTOを構築
    let schedule: ScheduleDto
    if (newTask.scheduleType === 'ONE_TIME') {
      schedule = {
        type: 'OneTime',
        deadline: newTask.deadline,
      }
    } else {
      let pattern: PatternDto
      switch (newTask.patternType) {
        case 'DAILY':
          pattern = { type: 'Daily', skipWeekends: newTask.skipWeekends }
          break
        case 'WEEKLY':
          pattern = { type: 'Weekly', dayOfWeek: newTask.dayOfWeek }
          break
        case 'MONTHLY':
          pattern = { type: 'Monthly', dayOfMonth: newTask.dayOfMonth }
          break
      }
      schedule = {
        type: 'Recurring',
        pattern,
        startDate: newTask.startDate,
        endDate: null,
      }
    }

    const request: CreateTaskDefinitionRequest = {
      name: newTask.name,
      description: newTask.description,
      estimatedMinutes: newTask.estimatedMinutes,
      scope: newTask.scope,
      ownerMemberId: newTask.scope === 'PERSONAL' ? newTask.ownerMemberId : null,
      schedule,
    }

    const success = await addTaskDefinition(request)
    if (success) {
      handleCloseModal()
    }
  }

  /**
   * 削除確認ダイアログを開く
   */
  const handleDeleteClick = (task: TaskDefinition) => {
    setTaskToDelete(task)
    setShowDeleteConfirm(true)
  }

  /**
   * 削除実行
   */
  const handleConfirmDelete = async () => {
    if (!taskToDelete) return

    const success = await removeTaskDefinition(taskToDelete.id)
    if (success) {
      setShowDeleteConfirm(false)
      setTaskToDelete(null)
    }
  }

  /**
   * 編集ハンドラー（未実装）
   */
  const handleEdit = (task: TaskDefinition) => {
    // TODO: 編集モーダルを開く
    console.log('Edit task:', task.id)
  }

  /**
   * データ再取得ハンドラー
   */
  const handleRefresh = async () => {
    await Promise.all([fetchMembers(), fetchTaskDefinitions()])
  }

  return (
    <>
      <Header
        title="タスク定義"
        subtitle={`${filteredTasks.length}件のタスク`}
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              追加
            </Button>
          </div>
        }
      />
      <PageContainer>
        {/* エラーメッセージ */}
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

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
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))}

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">タスクが見つかりません</p>
            </div>
          )}
        </section>

        {/* 追加モーダル */}
        <Modal
          isOpen={showAddModal}
          onClose={handleCloseModal}
          title="タスク定義を追加"
          footer={
            <>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleCloseModal}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleAddTask}
                loading={loading}
                disabled={!newTask.name.trim()}
              >
                追加
              </Button>
            </>
          }
        >
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <Input
            label="タスク名"
            placeholder="例: お風呂掃除"
            value={newTask.name}
            onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
          />

          <Input
            label="説明"
            placeholder="例: 浴槽と床を洗う"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
          />

          <Input
            label="見積時間（分）"
            type="number"
            min={1}
            max={1440}
            value={newTask.estimatedMinutes}
            onChange={(e) =>
              setNewTask({ ...newTask, estimatedMinutes: Number(e.target.value) })
            }
          />

          {/* スコープ選択 */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              スコープ
            </label>
            <div className="flex gap-2">
              <Button
                variant={newTask.scope === 'FAMILY' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setNewTask({ ...newTask, scope: 'FAMILY', ownerMemberId: '' })}
              >
                家族
              </Button>
              <Button
                variant={newTask.scope === 'PERSONAL' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setNewTask({ ...newTask, scope: 'PERSONAL' })}
              >
                個人
              </Button>
            </div>
          </div>

          {/* 個人タスクの場合のオーナー選択 */}
          {newTask.scope === 'PERSONAL' && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                担当者
              </label>
              <div className="flex gap-2 flex-wrap">
                {members.map((member) => (
                  <Button
                    key={member.id}
                    variant={newTask.ownerMemberId === member.id ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setNewTask({ ...newTask, ownerMemberId: member.id })}
                  >
                    {member.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* スケジュールタイプ選択 */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              スケジュール
            </label>
            <div className="flex gap-2">
              <Button
                variant={newTask.scheduleType === 'RECURRING' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setNewTask({ ...newTask, scheduleType: 'RECURRING' })}
              >
                定期
              </Button>
              <Button
                variant={newTask.scheduleType === 'ONE_TIME' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setNewTask({ ...newTask, scheduleType: 'ONE_TIME' })}
              >
                単発
              </Button>
            </div>
          </div>

          {/* 定期スケジュールの詳細 */}
          {newTask.scheduleType === 'RECURRING' && (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  繰り返しパターン
                </label>
                <div className="flex gap-2">
                  {PATTERN_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={newTask.patternType === opt.value ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setNewTask({ ...newTask, patternType: opt.value })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {newTask.patternType === 'DAILY' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="skipWeekends"
                    checked={newTask.skipWeekends}
                    onChange={(e) =>
                      setNewTask({ ...newTask, skipWeekends: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-dark-600 bg-dark-800"
                  />
                  <label htmlFor="skipWeekends" className="text-sm text-white/70">
                    土日をスキップ
                  </label>
                </div>
              )}

              {newTask.patternType === 'WEEKLY' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    曜日
                  </label>
                  <select
                    value={newTask.dayOfWeek}
                    onChange={(e) => setNewTask({ ...newTask, dayOfWeek: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white"
                  >
                    {DAY_OF_WEEK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newTask.patternType === 'MONTHLY' && (
                <Input
                  label="日付（1-28）"
                  type="number"
                  min={1}
                  max={28}
                  value={newTask.dayOfMonth}
                  onChange={(e) =>
                    setNewTask({ ...newTask, dayOfMonth: Number(e.target.value) })
                  }
                />
              )}

              <Input
                label="開始日"
                type="date"
                value={newTask.startDate}
                onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })}
              />
            </>
          )}

          {/* 単発スケジュールの詳細 */}
          {newTask.scheduleType === 'ONE_TIME' && (
            <Input
              label="期限"
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
            />
          )}
        </Modal>

        {/* 削除確認モーダル */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false)
            setTaskToDelete(null)
          }}
          title="タスク定義の削除"
          footer={
            <>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setTaskToDelete(null)
                }}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleConfirmDelete}
                loading={loading}
              >
                削除
              </Button>
            </>
          }
        >
          <p className="text-white/70">
            「{taskToDelete?.name}」を削除しますか？この操作は取り消せません。
          </p>
        </Modal>
      </PageContainer>
    </>
  )
}
