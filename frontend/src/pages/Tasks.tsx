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
import { useAuth } from '../contexts/AuthContext'
import { timeToISOString, formatTimeFromISO, calculateDurationMinutes } from '../utils'
import type { TaskDefinition, TaskScope, PatternType } from '../types'
import type { CreateTaskDefinitionRequest, ScheduleDto, PatternDto } from '../types/api'

/**
 * スコープバッジコンポーネント
 */
function ScopeBadge({ scope }: { scope: TaskScope }) {
  return scope === 'FAMILY' ? (
    <Badge variant="info" size="sm" className="whitespace-nowrap flex-shrink-0">家族</Badge>
  ) : (
    <Badge variant="warning" size="sm" className="whitespace-nowrap flex-shrink-0">個人</Badge>
  )
}

/**
 * スケジュールバッジコンポーネント
 */
function ScheduleBadge({ task }: { task: TaskDefinition }) {
  if (task.scheduleType === 'ONE_TIME') {
    return <Badge variant="default" size="sm" className="whitespace-nowrap flex-shrink-0">単発</Badge>
  }
  const pattern = task.recurrence?.patternType
  switch (pattern) {
    case 'DAILY':
      return <Badge variant="success" size="sm" className="whitespace-nowrap flex-shrink-0">毎日</Badge>
    case 'WEEKLY':
      return <Badge variant="info" size="sm" className="whitespace-nowrap flex-shrink-0">毎週</Badge>
    case 'MONTHLY':
      return <Badge variant="default" size="sm" className="whitespace-nowrap flex-shrink-0">毎月</Badge>
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
  /** 編集権限があるか */
  canEdit: boolean
}

function TaskCard({ task, onEdit, onDelete, canEdit }: TaskCardProps) {
  return (
    <Card variant="glass" hoverable>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-white truncate">{task.name}</span>
            <ScopeBadge scope={task.scope} />
            <ScheduleBadge task={task} />
            {/* 編集権限がない場合の表示 */}
            {!canEdit && (
              <span className="text-xs text-white/30 whitespace-nowrap">
                他メンバーのタスク
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-white/50 line-clamp-1 mb-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-white/40">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {formatTimeFromISO(task.scheduledTimeRange.startTime)} - {formatTimeFromISO(task.scheduledTimeRange.endTime)}
              </span>
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
          {canEdit ? (
            <>
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
            </>
          ) : (
            // 編集権限がない場合はアイコンを薄く表示
            <div className="flex items-center gap-2 opacity-30">
              <Edit2 className="w-4 h-4 text-white/50" />
            </div>
          )}
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
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null)

  // ログインユーザー情報取得
  const { user } = useAuth()

  // メンバー管理フック（個人タスクのオーナー選択用）
  const { members, fetchMembers, loading: membersLoading } = useMember()

  // タスク定義管理フック
  const {
    taskDefinitions,
    loading: taskLoading,
    error,
    fetchTaskDefinitions,
    addTaskDefinition,
    editTaskDefinition,
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
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<TaskDefinition | null>(null)
  const [taskToEdit, setTaskToEdit] = useState<TaskDefinition | null>(null)

  // フォーム初期値
  const getDefaultFormState = () => ({
    name: '',
    description: '',
    scheduledStartTime: '09:00',
    scheduledEndTime: '10:00',
    scope: 'FAMILY' as TaskScope,
    ownerMemberId: '',
    scheduleType: 'RECURRING' as 'RECURRING' | 'ONE_TIME',
    patternType: 'DAILY' as PatternType,
    skipWeekends: false,
    dayOfWeek: 'MONDAY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    deadline: new Date().toISOString().split('T')[0],
    point: 0,
  })

  // 新規作成フォーム
  const [newTask, setNewTask] = useState(getDefaultFormState())

  // 編集フォーム
  const [editTask, setEditTask] = useState(getDefaultFormState())

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
    
    // 個人タスクでメンバーフィルターが設定されている場合
    const matchesMember = filterScope !== 'PERSONAL' || 
      filterMemberId === null || 
      task.ownerMemberId === filterMemberId
    
    return matchesSearch && matchesScope && matchesMember && !task.isDeleted
  })

  /**
   * スコープ変更ハンドラー（メンバーフィルターも連動）
   */
  const handleFilterScopeChange = (scope: TaskScope | 'ALL') => {
    setFilterScope(scope)
    // PERSONALの場合はデフォルトで自分を選択、それ以外はnull
    if (scope === 'PERSONAL') {
      setFilterMemberId(user?.id ?? null)
    } else {
      setFilterMemberId(null)
    }
  }

  /**
   * タスクの編集権限があるか判定
   * - FAMILYタスク: 全員編集可能
   * - PERSONALタスク: オーナーのみ編集可能
   */
  const canEditTask = (task: TaskDefinition): boolean => {
    if (task.scope === 'FAMILY') {
      return true  // 家族タスクは全員編集可能
    }
    // 個人タスクはオーナーのみ
    return task.ownerMemberId === user?.id
  }

  /**
   * 追加モーダルを閉じる
   */
  const handleCloseModal = () => {
    setShowAddModal(false)
    setNewTask(getDefaultFormState())
    clearError()
  }

  /**
   * 編集モーダルを閉じる
   */
  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setTaskToEdit(null)
    setEditTask(getDefaultFormState())
    clearError()
  }

  /**
   * スコープ変更ハンドラー
   */
  const handleScopeChange = (scope: TaskScope, isEdit: boolean) => {
    const targetSet = isEdit ? setEditTask : setNewTask
    const currentTask = isEdit ? editTask : newTask

    if (scope === 'PERSONAL') {
      // 個人スコープ選択時、自分のIDを自動設定
      targetSet({ ...currentTask, scope, ownerMemberId: user?.id ?? '' })
    } else {
      targetSet({ ...currentTask, scope, ownerMemberId: '' })
    }
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
        endDate: newTask.endDate ? newTask.endDate : null,
      }
    }

    const request: CreateTaskDefinitionRequest = {
      name: newTask.name,
      description: newTask.description,
      scheduledTimeRange: {
        startTime: timeToISOString(newTask.scheduledStartTime),
        endTime: timeToISOString(newTask.scheduledEndTime),
      },
      scope: newTask.scope,
      ownerMemberId: newTask.scope === 'PERSONAL' ? (user?.id ?? null) : null,
      schedule,
      point: newTask.point,
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
   * 曜日番号を文字列に変換
   */
  const dayOfWeekNumberToString = (num: number): string => {
    const map: Record<number, string> = {
      1: 'MONDAY',
      2: 'TUESDAY',
      3: 'WEDNESDAY',
      4: 'THURSDAY',
      5: 'FRIDAY',
      6: 'SATURDAY',
      7: 'SUNDAY',
    }
    return map[num] ?? 'MONDAY'
  }

  /**
   * 編集ハンドラー
   */
  const handleEdit = (task: TaskDefinition) => {
    setTaskToEdit(task)
    setEditTask({
      name: task.name,
      description: task.description ?? '',
      scheduledStartTime: formatTimeFromISO(task.scheduledTimeRange.startTime),
      scheduledEndTime: formatTimeFromISO(task.scheduledTimeRange.endTime),
      scope: task.scope,
      ownerMemberId: task.ownerMemberId ?? '',
      scheduleType: task.scheduleType,
      patternType: task.recurrence?.patternType ?? 'DAILY',
      skipWeekends: task.recurrence?.dailySkipWeekends ?? false,
      dayOfWeek: task.recurrence?.weeklyDayOfWeek
        ? dayOfWeekNumberToString(task.recurrence.weeklyDayOfWeek)
        : 'MONDAY',
      dayOfMonth: task.recurrence?.monthlyDayOfMonth ?? 1,
      startDate: task.recurrence?.startDate ?? new Date().toISOString().split('T')[0],
      endDate: task.recurrence?.endDate ?? '',
      deadline: task.oneTimeDeadline ?? new Date().toISOString().split('T')[0],
      point: task.point,
    })
    setShowEditModal(true)
  }

  /**
   * タスク定義更新ハンドラー
   */
  const handleUpdateTask = async () => {
    if (!taskToEdit || !editTask.name.trim()) return

    // スケジュールDTOを構築
    let schedule: ScheduleDto
    if (editTask.scheduleType === 'ONE_TIME') {
      schedule = {
        type: 'OneTime',
        deadline: editTask.deadline,
      }
    } else {
      let pattern: PatternDto
      switch (editTask.patternType) {
        case 'DAILY':
          pattern = { type: 'Daily', skipWeekends: editTask.skipWeekends }
          break
        case 'WEEKLY':
          pattern = { type: 'Weekly', dayOfWeek: editTask.dayOfWeek }
          break
        case 'MONTHLY':
          pattern = { type: 'Monthly', dayOfMonth: editTask.dayOfMonth }
          break
      }
      schedule = {
        type: 'Recurring',
        pattern,
        startDate: editTask.startDate,
        endDate: editTask.endDate ? editTask.endDate : null,
      }
    }

    const request = {
      name: editTask.name,
      description: editTask.description || null,
      scheduledTimeRange: {
        startTime: timeToISOString(editTask.scheduledStartTime),
        endTime: timeToISOString(editTask.scheduledEndTime),
      },
      scope: editTask.scope,
      ownerMemberId: editTask.scope === 'PERSONAL' ? (user?.id ?? null) : null,
      schedule,
      point: editTask.point !== taskToEdit.point ? editTask.point : null,
    }

    const success = await editTaskDefinition(taskToEdit.id, request)
    if (success) {
      handleCloseEditModal()
    }
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
        title="タスク設定"
        subtitle={`${filteredTasks.length}件の設定`}
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
              onClick={() => handleFilterScopeChange('ALL')}
            >
              すべて
            </Button>
            <Button
              variant={filterScope === 'FAMILY' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleFilterScopeChange('FAMILY')}
            >
              家族
            </Button>
            <Button
              variant={filterScope === 'PERSONAL' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handleFilterScopeChange('PERSONAL')}
            >
              個人
            </Button>
          </div>

          {/* メンバー選択（個人タスクの場合のみ） */}
          {filterScope === 'PERSONAL' && members.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterMemberId === null ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilterMemberId(null)}
              >
                全員
              </Button>
              {members.map((member) => (
                <Button
                  key={member.id}
                  variant={filterMemberId === member.id ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilterMemberId(member.id)}
                >
                  {member.id === user?.id ? '自分' : member.name}
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* タスク一覧 */}
        <section>
          {/* モバイル: 縦並び、タブレット以上: グリッド */}
          <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                canEdit={canEditTask(task)}
              />
            ))}
          </div>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50">タスク設定が見つかりません</p>
              <p className="text-sm text-white/30 mt-2">
                「追加」ボタンから新しいタスクを作成してください
              </p>
            </div>
          )}
        </section>

        {/* 追加モーダル */}
        <Modal
          isOpen={showAddModal}
          onClose={handleCloseModal}
          title="新しいタスクを作成"
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
          <div className="space-y-4 px-1">
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
              label="ポイント"
              type="number"
              min="0"
              placeholder="完了時の獲得ポイント"
              value={newTask.point}
              onChange={(e) =>
                setNewTask({ ...newTask, point: parseInt(e.target.value) || 0 })
              }
            />

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-white/70 mb-1 block">開始時刻</span>
                <Input
                  type="time"
                  value={newTask.scheduledStartTime}
                  onChange={(e) =>
                    setNewTask({ ...newTask, scheduledStartTime: e.target.value })
                  }
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm text-white/70 mb-1 block">終了時刻</span>
                <Input
                  type="time"
                  value={newTask.scheduledEndTime}
                  onChange={(e) =>
                    setNewTask({ ...newTask, scheduledEndTime: e.target.value })
                  }
                  required
                />
              </label>
            </div>
            {/* 所要時間の自動計算表示 */}
            <p className="text-sm text-white/50 mt-1">
              所要時間: {calculateDurationMinutes(newTask.scheduledStartTime, newTask.scheduledEndTime)}分
            </p>

            {/* スコープ選択 */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                スコープ
              </label>
              <div className="flex gap-2">
                <Button
                  variant={newTask.scope === 'FAMILY' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleScopeChange('FAMILY', false)}
                >
                  家族
                </Button>
                <Button
                  variant={newTask.scope === 'PERSONAL' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleScopeChange('PERSONAL', false)}
                >
                  個人
                </Button>
              </div>
            </div>


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

                <Input
                  label="終了日（任意）"
                  type="date"
                  value={newTask.endDate}
                  onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })}
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
          </div>
        </Modal>

        {/* 削除確認モーダル */}
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false)
            setTaskToDelete(null)
          }}
          title="タスクの削除"
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

        {/* 編集モーダル */}
        <Modal
          isOpen={showEditModal}
          onClose={handleCloseEditModal}
          title="タスクを編集"
          footer={
            <>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={handleCloseEditModal}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleUpdateTask}
                loading={loading}
                disabled={!editTask.name.trim()}
              >
                更新
              </Button>
            </>
          }
        >
          <div className="space-y-4 px-1">
            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}

            <Input
              label="タスク名"
              placeholder="例: お風呂掃除"
              value={editTask.name}
              onChange={(e) => setEditTask({ ...editTask, name: e.target.value })}
            />

            <Input
              label="説明"
              placeholder="例: 浴槽と床を洗う"
              value={editTask.description}
              onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
            />

            <Input
              label="ポイント"
              type="number"
              min="0"
              placeholder="完了時の獲得ポイント"
              value={editTask.point}
              onChange={(e) =>
                setEditTask({ ...editTask, point: parseInt(e.target.value) || 0 })
              }
            />

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-white/70 mb-1 block">開始時刻</span>
                <Input
                  type="time"
                  value={editTask.scheduledStartTime}
                  onChange={(e) =>
                    setEditTask({ ...editTask, scheduledStartTime: e.target.value })
                  }
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm text-white/70 mb-1 block">終了時刻</span>
                <Input
                  type="time"
                  value={editTask.scheduledEndTime}
                  onChange={(e) =>
                    setEditTask({ ...editTask, scheduledEndTime: e.target.value })
                  }
                  required
                />
              </label>
            </div>
            {/* 所要時間の自動計算表示 */}
            <p className="text-sm text-white/50 mt-1">
              所要時間: {calculateDurationMinutes(editTask.scheduledStartTime, editTask.scheduledEndTime)}分
            </p>

            {/* スコープ選択 */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                スコープ
              </label>
              <div className="flex gap-2">
                <Button
                  variant={editTask.scope === 'FAMILY' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleScopeChange('FAMILY', true)}
                >
                  家族
                </Button>
                <Button
                  variant={editTask.scope === 'PERSONAL' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => handleScopeChange('PERSONAL', true)}
                >
                  個人
                </Button>
              </div>
            </div>


            {/* スケジュールタイプ選択 */}
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                スケジュール
              </label>
              <div className="flex gap-2">
                <Button
                  variant={editTask.scheduleType === 'RECURRING' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setEditTask({ ...editTask, scheduleType: 'RECURRING' })}
                >
                  定期
                </Button>
                <Button
                  variant={editTask.scheduleType === 'ONE_TIME' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setEditTask({ ...editTask, scheduleType: 'ONE_TIME' })}
                >
                  単発
                </Button>
              </div>
            </div>

            {/* 定期スケジュールの詳細 */}
            {editTask.scheduleType === 'RECURRING' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    繰り返しパターン
                  </label>
                  <div className="flex gap-2">
                    {PATTERN_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={editTask.patternType === opt.value ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setEditTask({ ...editTask, patternType: opt.value })}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {editTask.patternType === 'DAILY' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editSkipWeekends"
                      checked={editTask.skipWeekends}
                      onChange={(e) =>
                        setEditTask({ ...editTask, skipWeekends: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-dark-600 bg-dark-800"
                    />
                    <label htmlFor="editSkipWeekends" className="text-sm text-white/70">
                      土日をスキップ
                    </label>
                  </div>
                )}

                {editTask.patternType === 'WEEKLY' && (
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      曜日
                    </label>
                    <select
                      value={editTask.dayOfWeek}
                      onChange={(e) => setEditTask({ ...editTask, dayOfWeek: e.target.value })}
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

                {editTask.patternType === 'MONTHLY' && (
                  <Input
                    label="日付（1-28）"
                    type="number"
                    min={1}
                    max={28}
                    value={editTask.dayOfMonth}
                    onChange={(e) =>
                      setEditTask({ ...editTask, dayOfMonth: Number(e.target.value) })
                    }
                  />
                )}

                <Input
                  label="開始日"
                  type="date"
                  value={editTask.startDate}
                  onChange={(e) => setEditTask({ ...editTask, startDate: e.target.value })}
                />

                <Input
                  label="終了日（任意）"
                  type="date"
                  value={editTask.endDate}
                  onChange={(e) => setEditTask({ ...editTask, endDate: e.target.value })}
                />
              </>
            )}

            {/* 単発スケジュールの詳細 */}
            {editTask.scheduleType === 'ONE_TIME' && (
              <Input
                label="期限"
                type="date"
                value={editTask.deadline}
                onChange={(e) => setEditTask({ ...editTask, deadline: e.target.value })}
              />
            )}
          </div>
        </Modal>
      </PageContainer>
    </>
  )
}