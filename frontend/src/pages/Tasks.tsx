/**
 * タスクページ（カレンダー中心のUI）
 *
 * - カレンダーで単発タスクの日程を可視化
 * - 定期タスクはリストで表示
 * - 日付クリックでモーダル表示（タスク一覧と追加）
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Settings, Clock, Star, Users, User, Calendar, X, Repeat, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { clsx } from 'clsx'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { Avatar } from '../components/ui/Avatar'
import { TaskCalendar } from '../components/tasks/TaskCalendar'
import { RecurringTaskList } from '../components/tasks/RecurringTaskList'
import { TaskEditModal } from '../components/tasks/TaskEditModal'
import { TaskDefinitionDetailModal } from '../components/tasks/TaskDefinitionDetailModal'
import { useTaskDefinition, useMembers } from '../hooks'
import { useAuth } from '../contexts/AuthContext'
import {
  timeToISOString,
  formatTimeFromISO,
  isParentRole,
  alignStartDateToWeeklyDay,
  normalizeIsoDateString,
  isRecurringTaskOnDate,
  toISODateString,
} from '../utils'
import type { TaskDefinition, TaskScope, PatternType, Member } from '../types'
import type { CreateTaskDefinitionRequest, ScheduleDto, PatternDto } from '../types/api'

type FilterScope = 'all' | 'family' | 'personal'

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
 * 選択日のタスクカード
 */
interface DayTaskCardProps {
  task: TaskDefinition
  members?: Member[]
  isRecurring?: boolean
  /** カードクリック時のコールバック（詳細モーダルを開く） */
  onClick?: (task: TaskDefinition) => void
}

function DayTaskCard({ task, members = [], isRecurring = false, onClick }: DayTaskCardProps) {
  const owner = task.scope === 'PERSONAL' && task.ownerMemberId
    ? members.find((m) => m.id === task.ownerMemberId)
    : null

  return (
    <div
      className={clsx(
        'rounded-xl p-3 border transition-all',
        task.scope === 'FAMILY'
          ? 'bg-blue-950/30 border-blue-700/30'
          : 'bg-emerald-950/30 border-emerald-700/30',
        onClick && 'cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'
      )}
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {/* アイコン */}
            {task.scope === 'FAMILY' ? (
              <Users className="w-4 h-4 text-blue-400 flex-shrink-0" />
            ) : owner ? (
              <Avatar
                name={owner.name}
                size="sm"
                role={owner.role}
                variant={isParentRole(owner.role) ? 'parent' : 'child'}
              />
            ) : (
              <User className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
            <span className="font-medium text-white truncate">{task.name}</span>
            {isRecurring && (
              <Badge variant="default" size="sm">
                <Repeat className="w-2.5 h-2.5 mr-0.5" />
                定期
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeFromISO(task.scheduledTimeRange.startTime)} -{' '}
              {formatTimeFromISO(task.scheduledTimeRange.endTime)}
            </span>
            {task.point > 0 && (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Star className="w-3 h-3 fill-amber-400" />
                {task.point}pt
              </span>
            )}
            {owner && (
              <span className="text-emerald-400">{owner.name}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 週次パターンの開始日を曜日に合わせる
 */
const alignWeeklyStartDate = (startDate: string, dayOfWeek: string): string => {
  const normalizedStartDate = normalizeIsoDateString(startDate) ?? toISODateString(new Date())
  const alignedDate = alignStartDateToWeeklyDay(parseISO(normalizedStartDate), dayOfWeek)
  return toISODateString(alignedDate)
}

/**
 * タスクページ
 */
export function Tasks() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // 状態管理
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filterScope, setFilterScope] = useState<FilterScope>('all')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null) // 個人フィルター用メンバーID
  const [showMemberFilter, setShowMemberFilter] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<TaskDefinition | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [taskToDetail, setTaskToDetail] = useState<TaskDefinition | null>(null)

  // メンバー管理フック
  const { members, fetchMembers, loading: membersLoading } = useMembers()

  // タスク定義管理フック
  const {
    taskDefinitions,
    loading: taskLoading,
    error,
    fetchTaskDefinitions,
    addTaskDefinition,
    editTaskDefinition,
    clearError,
  } = useTaskDefinition()

  const loading = membersLoading || taskLoading

  // 初回マウント時にデータを取得
  useEffect(() => {
    fetchMembers()
    fetchTaskDefinitions()
  }, [fetchMembers, fetchTaskDefinitions])

  // エラー自動クリア
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  // フィルタースコープが個人に切り替わった時のみ、デフォルトで自分を選択
  const prevFilterScopeRef = useRef(filterScope)
  useEffect(() => {
    // 個人フィルターに切り替わった時のみ初期値を設定
    if (filterScope === 'personal' && prevFilterScopeRef.current !== 'personal' && user?.id) {
      setSelectedMemberId(user.id)
    }
    prevFilterScopeRef.current = filterScope
  }, [filterScope, user?.id])

  // スコープでフィルタリング（削除されていないもののみ）
  const filteredTasks = useMemo(() => {
    return taskDefinitions.filter((task) => {
      if (task.isDeleted) return false
      if (filterScope === 'family' && task.scope !== 'FAMILY') return false
      if (filterScope === 'personal') {
        if (task.scope !== 'PERSONAL') return false
        // 特定のメンバーでフィルター（nullは全員）
        if (selectedMemberId && task.ownerMemberId !== selectedMemberId) return false
      }
      return true
    })
  }, [taskDefinitions, filterScope, selectedMemberId])

  // 選択日の単発タスク
  const selectedDateTasks = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    return filteredTasks.filter((task) => {
      return task.scheduleType === 'ONE_TIME' && task.oneTimeDeadline === dateStr
    })
  }, [filteredTasks, selectedDate])

  // 選択日に該当する定期タスク
  const selectedDateRecurringTasks = useMemo(() => {
    return filteredTasks.filter((task) => isRecurringTaskOnDate(task, selectedDate))
  }, [filteredTasks, selectedDate])

  // 毎日以外の定期タスク（週次・月次）
  const nonDailyRecurringTasks = useMemo(() => {
    return selectedDateRecurringTasks.filter((task) => task.recurrence?.patternType !== 'DAILY')
  }, [selectedDateRecurringTasks])

  // 毎日のタスク
  const dailyRecurringTasks = useMemo(() => {
    return selectedDateRecurringTasks.filter((task) => task.recurrence?.patternType === 'DAILY')
  }, [selectedDateRecurringTasks])

  // フォーム初期値
  const getDefaultFormState = (date: Date) => ({
    name: '',
    description: '',
    scheduledStartTime: '09:00',
    scheduledEndTime: '10:00',
    scope: 'PERSONAL' as TaskScope,
    ownerMemberId: '',
    scheduleType: 'ONE_TIME' as 'RECURRING' | 'ONE_TIME',  // カレンダーから追加するのでデフォルトは単発
    patternType: 'DAILY' as PatternType,
    skipWeekends: false,
    dayOfWeek: 'MONDAY',
    dayOfMonth: 1,
    startDate: format(date, 'yyyy-MM-dd'),
    endDate: '',
    deadline: format(date, 'yyyy-MM-dd'),  // 選択日をデフォルト
    point: 0,
  })

  const [newTask, setNewTask] = useState(getDefaultFormState(new Date()))

  // 日付選択時（カレンダークリック）
  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
    setNewTask((prev) => ({
      ...prev,
      deadline: format(date, 'yyyy-MM-dd'),
      startDate: format(date, 'yyyy-MM-dd'),
    }))
    setShowDateModal(true)
    setShowAddForm(false)
  }

  // 日付モーダルを閉じる
  const handleCloseDateModal = () => {
    setShowDateModal(false)
    setShowAddForm(false)
    setNewTask(getDefaultFormState(selectedDate))
    clearError()
  }

  // 追加フォームを表示
  const handleShowAddForm = () => {
    setNewTask(getDefaultFormState(selectedDate))
    setShowAddForm(true)
  }

  // 追加フォームをキャンセル
  const handleCancelAddForm = () => {
    setShowAddForm(false)
    setNewTask(getDefaultFormState(selectedDate))
    clearError()
  }

  // スコープ変更ハンドラー
  const handleScopeChange = (scope: TaskScope) => {
    if (scope === 'PERSONAL') {
      // 個人タスクはポイントなし（0固定）
      setNewTask({ ...newTask, scope, ownerMemberId: user?.id ?? '', point: 0 })
    } else {
      setNewTask({ ...newTask, scope, ownerMemberId: '' })
    }
  }

  // タスク追加ハンドラー
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
      const scheduleStartDate = newTask.patternType === 'WEEKLY'
        ? alignWeeklyStartDate(newTask.startDate, newTask.dayOfWeek)
        : (normalizeIsoDateString(newTask.startDate) ?? newTask.startDate)
      schedule = {
        type: 'Recurring',
        pattern,
        startDate: scheduleStartDate,
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
      setShowAddForm(false)
      setNewTask(getDefaultFormState(selectedDate))
    }
  }

  // データ再取得
  const handleRefresh = async () => {
    await Promise.all([fetchMembers(), fetchTaskDefinitions()])
  }

  // 編集用タスク選択（モーダルを表示）
  const handleEditTask = (task: TaskDefinition) => {
    setTaskToEdit(task)
    setShowEditModal(true)
  }

  // 編集モーダルを閉じる
  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setTaskToEdit(null)
    clearError()
  }

  // 編集保存ハンドラー
  const handleSaveEdit = async (id: string, request: Parameters<typeof editTaskDefinition>[1]): Promise<boolean> => {
    const success = await editTaskDefinition(id, request)
    if (success) {
      handleCloseEditModal()
    }
    return success
  }

  // タスク詳細モーダルを開く（カードクリック時）
  const handleTaskDetailClick = (task: TaskDefinition) => {
    setTaskToDetail(task)
    setShowDetailModal(true)
  }

  // 詳細モーダルを閉じる
  const handleCloseDetailModal = () => {
    setShowDetailModal(false)
    setTaskToDetail(null)
  }

  // 詳細モーダルから編集モーダルを開く
  const handleEditFromDetail = (task: TaskDefinition) => {
    setShowDetailModal(false)
    setTaskToDetail(null)
    handleEditTask(task)
  }

  // 選択中のメンバー名を取得
  const selectedMember = selectedMemberId ? members.find((m) => m.id === selectedMemberId) : null

  return (
    <>
      <Header
        title="タスク"
        subtitle="カレンダー"
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSelectedDate(new Date())
                setShowDateModal(true)
                setShowAddForm(true)
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              追加
            </Button>
          </div>
        }
      />
      <PageContainer noPadding className="max-w-none px-0">
        <div className="px-4 md:px-6 lg:px-8 max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto">
          {/* エラーメッセージ */}
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          {/* スコープフィルター */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(['all', 'family', 'personal'] as FilterScope[]).map((scope) => (
              <button
                key={scope}
                onClick={() => {
                  setFilterScope(scope)
                  if (scope !== 'personal') {
                    setSelectedMemberId(null)
                    setShowMemberFilter(false)
                  }
                }}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  filterScope === scope
                    ? 'bg-coral-500/20 text-coral-400 border border-coral-500/30'
                    : 'bg-dark-800/50 text-white/50 border border-transparent hover:border-dark-600'
                )}
              >
                {scope === 'all' ? 'すべて' : scope === 'family' ? '家族' : '個人'}
              </button>
            ))}

            {/* 個人フィルター用メンバー選択 */}
            {filterScope === 'personal' && (
              <div className="relative">
                <button
                  onClick={() => setShowMemberFilter(!showMemberFilter)}
                  className={clsx(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  )}
                >
                  {selectedMember ? (
                    <>
                      <Avatar
                        name={selectedMember.name}
                        size="xs"
                        role={selectedMember.role}
                        variant={isParentRole(selectedMember.role) ? 'parent' : 'child'}
                      />
                      {selectedMember.name}
                    </>
                  ) : (
                    '全員'
                  )}
                  <ChevronDown className={clsx('w-4 h-4 transition-transform', showMemberFilter && 'rotate-180')} />
                </button>

                {/* メンバー選択ドロップダウン */}
                {showMemberFilter && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-lg z-20">
                    <button
                      onClick={() => {
                        setSelectedMemberId(null)
                        setShowMemberFilter(false)
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm hover:bg-dark-700 transition-colors',
                        !selectedMemberId ? 'text-emerald-400' : 'text-white/70'
                      )}
                    >
                      全員
                    </button>
                    {members.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setSelectedMemberId(member.id)
                          setShowMemberFilter(false)
                        }}
                        className={clsx(
                          'w-full px-4 py-2 text-left text-sm hover:bg-dark-700 transition-colors flex items-center gap-2',
                          selectedMemberId === member.id ? 'text-emerald-400' : 'text-white/70'
                        )}
                      >
                        <Avatar
                          name={member.name}
                          size="xs"
                          role={member.role}
                          variant={isParentRole(member.role) ? 'parent' : 'child'}
                        />
                        {member.name}
                        {member.id === user?.id && <span className="text-white/40">(自分)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* カレンダー */}
        <section className="mb-4 sm:mb-6 px-2 sm:px-3 md:px-4">
          <TaskCalendar
            tasks={filteredTasks}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            filterScope={filterScope}
            members={members}
            selectedMemberId={selectedMemberId}
          />
        </section>

        <div className="px-4 md:px-6 lg:px-8 max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto">
          {/* 定期タスク一覧 */}
          <section className="mb-6">
            <RecurringTaskList
              tasks={filteredTasks}
              onEdit={handleEditTask}
              onTaskClick={handleTaskDetailClick}
              filterScope={filterScope}
              members={members}
              selectedMemberId={selectedMemberId}
              defaultOpen={true}
              currentUserId={user?.id}
            />
          </section>

          {/* タスク一覧を編集するリンク */}
          <section>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/tasks/list')}
            >
              <Settings className="w-4 h-4 mr-2" />
              タスク一覧を編集する
            </Button>
          </section>
        </div>

        {/* 日付選択モーダル */}
        <Modal
          isOpen={showDateModal}
          onClose={handleCloseDateModal}
          title={format(selectedDate, 'M月d日(E)', { locale: ja })}
        >
          <div className="space-y-4">
            {/* タスク追加フォームが表示されていない場合 */}
            {!showAddForm ? (
              <>
                {/* この日の単発タスク一覧 */}
                {selectedDateTasks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      単発タスク ({selectedDateTasks.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedDateTasks.map((task) => (
                        <DayTaskCard key={task.id} task={task} members={members} onClick={handleTaskDetailClick} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 毎日以外の定期タスク一覧 */}
                {nonDailyRecurringTasks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                      <Repeat className="w-4 h-4" />
                      定期タスク ({nonDailyRecurringTasks.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {nonDailyRecurringTasks.map((task) => (
                        <DayTaskCard key={task.id} task={task} members={members} isRecurring onClick={handleTaskDetailClick} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 毎日のタスク一覧 */}
                {dailyRecurringTasks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-white/70 mb-2 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      毎日のタスク ({dailyRecurringTasks.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {dailyRecurringTasks.map((task) => (
                        <DayTaskCard key={task.id} task={task} members={members} isRecurring onClick={handleTaskDetailClick} />
                      ))}
                    </div>
                  </div>
                )}

                {/* タスクがない場合 */}
                {selectedDateTasks.length === 0 && selectedDateRecurringTasks.length === 0 && (
                  <div className="text-center py-6 text-white/50 bg-dark-800/30 rounded-xl border border-dark-700/30">
                    <p>この日のタスクはありません</p>
                  </div>
                )}

                {/* タスクを追加ボタン */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleShowAddForm}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  この日にタスクを追加
                </Button>
              </>
            ) : (
              /* タスク追加フォーム */
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-white">タスクを追加</h4>
                  <button
                    onClick={handleCancelAddForm}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {error && (
                  <Alert variant="error" className="mb-4">
                    {error}
                  </Alert>
                )}

                {/* スコープ選択（タブ形式） */}
                <div className="flex rounded-lg overflow-hidden border border-dark-700">
                  <button
                    onClick={() => handleScopeChange('FAMILY')}
                    className={clsx(
                      'flex-1 py-2 px-3 text-sm font-medium transition-all flex items-center justify-center gap-1',
                      newTask.scope === 'FAMILY'
                        ? 'bg-blue-500/20 text-blue-400 border-r border-blue-500/30'
                        : 'bg-dark-800/50 text-white/50 border-r border-dark-700 hover:bg-dark-700/50'
                    )}
                  >
                    <Users className="w-3 h-3" />
                    家族
                  </button>
                  <button
                    onClick={() => handleScopeChange('PERSONAL')}
                    className={clsx(
                      'flex-1 py-2 px-3 text-sm font-medium transition-all flex items-center justify-center gap-1',
                      newTask.scope === 'PERSONAL'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-dark-800/50 text-white/50 hover:bg-dark-700/50'
                    )}
                  >
                    <User className="w-3 h-3" />
                    個人
                  </button>
                </div>

                <Input
                  label="タスク名"
                  placeholder="例: お風呂掃除"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                />

                <Input
                  label="説明（任意）"
                  placeholder="例: 浴槽と床を洗う"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />

                <div className={newTask.scope === 'FAMILY' ? 'grid grid-cols-2 gap-4' : ''}>
                  {/* ポイント入力は家族タスクの場合のみ表示 */}
                  {newTask.scope === 'FAMILY' && (
                    <Input
                      label="ポイント"
                      type="number"
                      min="0"
                      value={newTask.point}
                      onChange={(e) =>
                        setNewTask({ ...newTask, point: parseInt(e.target.value) || 0 })
                      }
                    />
                  )}
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      タイプ
                    </label>
                    <div className="flex gap-1">
                      <Button
                        variant={newTask.scheduleType === 'ONE_TIME' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setNewTask({ ...newTask, scheduleType: 'ONE_TIME' })}
                      >
                        単発
                      </Button>
                      <Button
                        variant={newTask.scheduleType === 'RECURRING' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setNewTask({ ...newTask, scheduleType: 'RECURRING' })}
                      >
                        定期
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm text-white/70 mb-1 block">開始時刻</span>
                    <Input
                      type="time"
                      value={newTask.scheduledStartTime}
                      onChange={(e) =>
                        setNewTask({ ...newTask, scheduledStartTime: e.target.value })
                      }
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
                    />
                  </label>
                </div>

                {/* 単発の場合の期限 */}
                {newTask.scheduleType === 'ONE_TIME' && (
                  <Input
                    label="期限"
                    type="date"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                  />
                )}

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
                            onClick={() => setNewTask((prev) => {
                              const next = { ...prev, patternType: opt.value }
                              if (opt.value === 'WEEKLY') {
                                next.startDate = alignWeeklyStartDate(prev.startDate, prev.dayOfWeek)
                              }
                              return next
                            })}
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
                          onChange={(e) => setNewTask((prev) => ({
                            ...prev,
                            dayOfWeek: e.target.value,
                            startDate: prev.patternType === 'WEEKLY'
                              ? alignWeeklyStartDate(prev.startDate, e.target.value)
                              : prev.startDate,
                          }))}
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
                      onChange={(e) => setNewTask((prev) => ({
                        ...prev,
                        startDate: prev.patternType === 'WEEKLY'
                          ? alignWeeklyStartDate(e.target.value, prev.dayOfWeek)
                          : e.target.value,
                      }))}
                    />
                  </>
                )}

                {/* 追加ボタン */}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={handleCancelAddForm}
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
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* タスク編集モーダル */}
        <TaskEditModal
          isOpen={showEditModal}
          onClose={handleCloseEditModal}
          task={taskToEdit}
          onSave={handleSaveEdit}
          loading={loading}
          error={error}
          currentUserId={user?.id}
        />

        {/* タスク詳細モーダル */}
        <TaskDefinitionDetailModal
          isOpen={showDetailModal}
          onClose={handleCloseDetailModal}
          task={taskToDetail}
          onEdit={handleEditFromDetail}
          members={members}
          currentUserId={user?.id}
        />
      </PageContainer>
    </>
  )
}
