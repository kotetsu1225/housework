/**
 * タスクページ（カレンダー中心のUI）
 *
 * - カレンダーで単発タスクの日程を可視化
 * - 定期タスクはリストで表示
 * - 日付クリックでモーダル表示（タスク一覧と追加）
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { clsx } from 'clsx'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { Avatar } from '../components/ui/Avatar'
import { Segmented } from '../components/ui/Segmented'
import { Select, Checkbox } from '../components/ui/Select'
import { TaskCalendar } from '../components/tasks/TaskCalendar'
import { RecurringTaskList } from '../components/tasks/RecurringTaskList'
import { TaskEditModal } from '../components/tasks/TaskEditModal'
import { TaskDefinitionDetailModal } from '../components/tasks/TaskDefinitionDetailModal'
import { TaskDefinitionCard } from '../components/tasks/TaskDefinitionCard'
import { useTaskDefinition, useMembers } from '../hooks'
import { useAuth } from '../contexts/AuthContext'
import {
  timeToISOString,
  isParentRole,
  alignStartDateToWeeklyDay,
  normalizeIsoDateString,
  isRecurringTaskOnDate,
  toISODateString,
} from '../utils'
import type { TaskDefinition, TaskScope, PatternType } from '../types'
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

  const openAddForToday = () => {
    setSelectedDate(new Date())
    setShowDateModal(true)
    setShowAddForm(true)
  }

  return (
    <>
      <Header
        title="タスク"
        subtitle="カレンダー"
        action={
          <>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              aria-label="最新の状態に更新"
              className="w-11 h-11 rounded-full bg-surface text-accent flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
            </button>
            <button
              type="button"
              onClick={openAddForToday}
              className="h-11 pl-3 pr-4 rounded-full bg-accent text-white text-[15px] font-bold flex items-center gap-1 active:bg-accent-strong"
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={2.4} />
              追加
            </button>
          </>
        }
      />
      <PageContainer>
        {/* エラーメッセージ */}
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* スコープフィルター */}
        <div className="space-y-2 mb-3">
          <Segmented
            label="表示する範囲"
            value={filterScope}
            onChange={(scope) => {
              setFilterScope(scope)
              if (scope !== 'personal') {
                setSelectedMemberId(null)
                setShowMemberFilter(false)
              }
            }}
            options={[
              { value: 'all', label: 'すべて' },
              { value: 'family', label: '家族' },
              { value: 'personal', label: '個人' },
            ]}
          />

          {/* 個人フィルター用メンバー選択 */}
          {filterScope === 'personal' && (
            <div className="bg-surface rounded-xl">
              <button
                type="button"
                onClick={() => setShowMemberFilter(!showMemberFilter)}
                aria-expanded={showMemberFilter}
                className="w-full flex items-center justify-between gap-2 px-3.5 min-h-tap text-[15px] text-ink"
              >
                <span className="flex items-center gap-2">
                  {selectedMember ? (
                    <>
                      <Avatar
                        name={selectedMember.name}
                        size="sm"
                        role={selectedMember.role}
                        variant={isParentRole(selectedMember.role) ? 'parent' : 'child'}
                        className="w-6 h-6"
                      />
                      {selectedMember.id === user?.id ? '自分' : selectedMember.name}
                    </>
                  ) : (
                    '全員'
                  )}
                </span>
                <ChevronDown className={clsx('w-5 h-5 text-icon-muted transition-transform', showMemberFilter && 'rotate-180')} />
              </button>

              {showMemberFilter && (
                <div className="border-t border-line px-2 py-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={!selectedMemberId}
                    onClick={() => {
                      setSelectedMemberId(null)
                      setShowMemberFilter(false)
                    }}
                    className={clsx(
                      'h-10 px-3.5 rounded-full text-sm',
                      !selectedMemberId ? 'bg-accent text-white font-bold' : 'bg-canvas text-ink-soft font-medium'
                    )}
                  >
                    全員
                  </button>
                  {members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={selectedMemberId === member.id}
                      onClick={() => {
                        setSelectedMemberId(member.id)
                        setShowMemberFilter(false)
                      }}
                      className={clsx(
                        'h-10 pl-1.5 pr-3.5 rounded-full text-sm flex items-center gap-1.5',
                        selectedMemberId === member.id ? 'bg-accent text-white font-bold' : 'bg-canvas text-ink-soft font-medium'
                      )}
                    >
                      <Avatar
                        name={member.name}
                        size="sm"
                        role={member.role}
                        variant={isParentRole(member.role) ? 'parent' : 'child'}
                        className="w-7 h-7"
                      />
                      {member.id === user?.id ? '自分' : member.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* カレンダー */}
        <section className="mb-3">
          <TaskCalendar
            tasks={filteredTasks}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            filterScope={filterScope}
            members={members}
            selectedMemberId={selectedMemberId}
          />
        </section>

        {/* 定期タスク一覧 */}
        <section className="mb-3">
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
          <button
            type="button"
            onClick={() => navigate('/tasks/list')}
            className="w-full h-12 rounded-xl bg-surface text-accent text-[15px] font-bold flex items-center justify-center gap-2"
          >
            タスク一覧を編集する
            <ChevronRight className="w-[18px] h-[18px]" />
          </button>
        </section>

        {/* 日付選択モーダル */}
        <Modal
          isOpen={showDateModal}
          onClose={handleCloseDateModal}
          title={showAddForm ? 'タスクを追加' : format(selectedDate, 'M月d日（E）', { locale: ja })}
          footer={
            showAddForm ? (
              <>
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={handleCancelAddForm}
                  disabled={loading}
                >
                  キャンセル
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  onClick={handleAddTask}
                  loading={loading}
                  disabled={!newTask.name.trim()}
                >
                  追加
                </Button>
              </>
            ) : (
              <Button variant="primary" size="lg" className="flex-1" onClick={handleShowAddForm}>
                <Plus className="w-[18px] h-[18px]" strokeWidth={2.4} />
                この日にタスクを追加
              </Button>
            )
          }
        >
          {!showAddForm ? (
            <div className="space-y-3">
              {/* この日の単発タスク一覧 */}
              {selectedDateTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-ink-muted px-1">単発タスク（{selectedDateTasks.length}）</p>
                  {selectedDateTasks.map((task) => (
                    <TaskDefinitionCard key={task.id} task={task} members={members} onClick={handleTaskDetailClick} />
                  ))}
                </div>
              )}

              {/* 毎日以外の定期タスク一覧 */}
              {nonDailyRecurringTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-ink-muted px-1">週次・月次の定期タスク（{nonDailyRecurringTasks.length}）</p>
                  {nonDailyRecurringTasks.map((task) => (
                    <TaskDefinitionCard key={task.id} task={task} members={members} onClick={handleTaskDetailClick} />
                  ))}
                </div>
              )}

              {/* 毎日のタスク一覧 */}
              {dailyRecurringTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-ink-muted px-1">毎日のタスク（{dailyRecurringTasks.length}）</p>
                  {dailyRecurringTasks.map((task) => (
                    <TaskDefinitionCard key={task.id} task={task} members={members} onClick={handleTaskDetailClick} />
                  ))}
                </div>
              )}

              {/* タスクがない場合 */}
              {selectedDateTasks.length === 0 && selectedDateRecurringTasks.length === 0 && (
                <div className="text-center py-8 bg-canvas rounded-card">
                  <p className="text-ink-muted font-medium">この日のタスクはありません</p>
                </div>
              )}
            </div>
          ) : (
            /* タスク追加フォーム */
            <div className="space-y-4">
              {error && (
                <Alert variant="error">
                  {error}
                </Alert>
              )}

              {/* スコープ選択 */}
              <Segmented
                label="タスクの種別"
                value={newTask.scope}
                onChange={(scope) => handleScopeChange(scope)}
                options={[
                  { value: 'FAMILY', label: '家族タスク' },
                  { value: 'PERSONAL', label: '個人タスク' },
                ]}
              />

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
                <p className="block text-[13px] font-medium text-ink-soft mb-1.5">タイプ</p>
                <Segmented
                  label="タイプ"
                  value={newTask.scheduleType}
                  onChange={(scheduleType) => setNewTask({ ...newTask, scheduleType })}
                  options={[
                    { value: 'ONE_TIME', label: '単発' },
                    { value: 'RECURRING', label: '定期' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="開始時刻"
                  id="new-start-time"
                  type="time"
                  value={newTask.scheduledStartTime}
                  onChange={(e) =>
                    setNewTask({ ...newTask, scheduledStartTime: e.target.value })
                  }
                />
                <Input
                  label="終了時刻"
                  id="new-end-time"
                  type="time"
                  value={newTask.scheduledEndTime}
                  onChange={(e) =>
                    setNewTask({ ...newTask, scheduledEndTime: e.target.value })
                  }
                />
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
                    <p className="block text-[13px] font-medium text-ink-soft mb-1.5">繰り返しパターン</p>
                    <Segmented
                      label="繰り返しパターン"
                      value={newTask.patternType}
                      onChange={(patternType) => setNewTask((prev) => {
                        const next = { ...prev, patternType }
                        if (patternType === 'WEEKLY') {
                          next.startDate = alignWeeklyStartDate(prev.startDate, prev.dayOfWeek)
                        }
                        return next
                      })}
                      options={PATTERN_OPTIONS}
                    />
                  </div>

                  {newTask.patternType === 'DAILY' && (
                    <Checkbox
                      id="skipWeekends"
                      label="土日をスキップ"
                      checked={newTask.skipWeekends}
                      onChange={(checked) => setNewTask({ ...newTask, skipWeekends: checked })}
                    />
                  )}

                  {newTask.patternType === 'WEEKLY' && (
                    <Select
                      label="曜日"
                      value={newTask.dayOfWeek}
                      onChange={(e) => setNewTask((prev) => ({
                        ...prev,
                        dayOfWeek: e.target.value,
                        startDate: prev.patternType === 'WEEKLY'
                          ? alignWeeklyStartDate(prev.startDate, e.target.value)
                          : prev.startDate,
                      }))}
                    >
                      {DAY_OF_WEEK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
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
            </div>
          )}
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
