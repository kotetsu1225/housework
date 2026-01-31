/**
 * タスク編集モーダルコンポーネント
 *
 * TaskList.tsxから抽出した再利用可能な編集モーダル
 * Tasks.tsxとTaskList.tsxの両方で使用
 */

import { useState, useEffect } from 'react'
import { Clock, Users, User } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Alert } from '../ui/Alert'
import { timeToISOString, formatTimeFromISO, calculateDurationMinutes } from '../../utils'
import type { TaskDefinition, TaskScope, PatternType } from '../../types'
import type { UpdateTaskDefinitionRequest, ScheduleDto, PatternDto } from '../../types/api'

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

export interface TaskEditModalProps {
  /** モーダル表示状態 */
  isOpen: boolean
  /** モーダルを閉じるコールバック */
  onClose: () => void
  /** 編集対象のタスク（nullの場合は何も表示しない） */
  task: TaskDefinition | null
  /** 保存処理のコールバック */
  onSave: (id: string, request: UpdateTaskDefinitionRequest) => Promise<boolean>
  /** ローディング状態 */
  loading?: boolean
  /** エラーメッセージ */
  error?: string | null
  /** 現在のユーザーID（個人タスクのオーナー設定用） */
  currentUserId?: string
}

interface FormState {
  name: string
  description: string
  scheduledStartTime: string
  scheduledEndTime: string
  scope: TaskScope
  ownerMemberId: string
  scheduleType: 'RECURRING' | 'ONE_TIME'
  patternType: PatternType
  skipWeekends: boolean
  dayOfWeek: string
  dayOfMonth: number
  startDate: string
  endDate: string
  deadline: string
  point: number
}

/**
 * 曜日番号を文字列に変換
 */
function dayOfWeekNumberToString(num: number): string {
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
 * デフォルトのフォーム状態を取得
 */
function getDefaultFormState(): FormState {
  return {
    name: '',
    description: '',
    scheduledStartTime: '09:00',
    scheduledEndTime: '10:00',
    scope: 'FAMILY',
    ownerMemberId: '',
    scheduleType: 'RECURRING',
    patternType: 'DAILY',
    skipWeekends: false,
    dayOfWeek: 'MONDAY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    deadline: new Date().toISOString().split('T')[0],
    point: 0,
  }
}

/**
 * タスク編集モーダル
 */
export function TaskEditModal({
  isOpen,
  onClose,
  task,
  onSave,
  loading = false,
  error = null,
  currentUserId,
}: TaskEditModalProps) {
  const [formState, setFormState] = useState<FormState>(getDefaultFormState())

  // タスクが変更されたらフォーム状態を更新
  useEffect(() => {
    if (task) {
      setFormState({
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
    }
  }, [task])

  // スコープ変更ハンドラー
  const handleScopeChange = (scope: TaskScope) => {
    if (scope === 'PERSONAL') {
      setFormState({ ...formState, scope, ownerMemberId: currentUserId ?? '' })
    } else {
      setFormState({ ...formState, scope, ownerMemberId: '' })
    }
  }

  // モーダルを閉じる
  const handleClose = () => {
    setFormState(getDefaultFormState())
    onClose()
  }

  // 保存処理
  const handleSave = async () => {
    if (!task || !formState.name.trim()) return

    let schedule: ScheduleDto
    if (formState.scheduleType === 'ONE_TIME') {
      schedule = { type: 'OneTime', deadline: formState.deadline }
    } else {
      let pattern: PatternDto
      switch (formState.patternType) {
        case 'DAILY':
          pattern = { type: 'Daily', skipWeekends: formState.skipWeekends }
          break
        case 'WEEKLY':
          pattern = { type: 'Weekly', dayOfWeek: formState.dayOfWeek }
          break
        case 'MONTHLY':
          pattern = { type: 'Monthly', dayOfMonth: formState.dayOfMonth }
          break
      }
      schedule = {
        type: 'Recurring',
        pattern,
        startDate: formState.startDate,
        endDate: formState.endDate ? formState.endDate : null,
      }
    }

    const request: UpdateTaskDefinitionRequest = {
      name: formState.name,
      description: formState.description || null,
      scheduledTimeRange: {
        startTime: timeToISOString(formState.scheduledStartTime),
        endTime: timeToISOString(formState.scheduledEndTime),
      },
      scope: formState.scope,
      ownerMemberId: formState.scope === 'PERSONAL' ? (currentUserId ?? null) : null,
      schedule,
      point: formState.point !== task.point ? formState.point : null,
    }

    const success = await onSave(task.id, request)
    if (success) {
      handleClose()
    }
  }

  if (!task) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="タスクを編集"
      footer={
        <>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleClose}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            loading={loading}
            disabled={!formState.name.trim()}
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

        {/* スコープ選択（タブ形式） */}
        <div className="flex rounded-lg overflow-hidden border border-dark-700">
          <button
            onClick={() => handleScopeChange('FAMILY')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              formState.scope === 'FAMILY'
                ? 'bg-blue-500/20 text-blue-400 border-r border-blue-500/30'
                : 'bg-dark-800/50 text-white/50 border-r border-dark-700 hover:bg-dark-700/50'
            }`}
          >
            <Users className="w-4 h-4" />
            家族タスク
          </button>
          <button
            onClick={() => handleScopeChange('PERSONAL')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              formState.scope === 'PERSONAL'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-dark-800/50 text-white/50 hover:bg-dark-700/50'
            }`}
          >
            <User className="w-4 h-4" />
            個人タスク
          </button>
        </div>

        <Input
          label="タスク名"
          placeholder="例: お風呂掃除"
          value={formState.name}
          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
        />

        <Input
          label="説明"
          placeholder="例: 浴槽と床を洗う"
          value={formState.description}
          onChange={(e) => setFormState({ ...formState, description: e.target.value })}
        />

        <Input
          label="ポイント"
          type="number"
          min="0"
          placeholder="完了時の獲得ポイント"
          value={formState.point}
          onChange={(e) =>
            setFormState({ ...formState, point: parseInt(e.target.value) || 0 })
          }
        />

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-white/70 mb-1 block">開始時刻</span>
            <Input
              type="time"
              value={formState.scheduledStartTime}
              onChange={(e) =>
                setFormState({ ...formState, scheduledStartTime: e.target.value })
              }
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-white/70 mb-1 block">終了時刻</span>
            <Input
              type="time"
              value={formState.scheduledEndTime}
              onChange={(e) =>
                setFormState({ ...formState, scheduledEndTime: e.target.value })
              }
              required
            />
          </label>
        </div>
        <p className="text-sm text-white/50 mt-1">
          所要時間: {calculateDurationMinutes(formState.scheduledStartTime, formState.scheduledEndTime)}分
        </p>

        {/* スケジュールタイプ選択 */}
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-2">
            スケジュール
          </label>
          <div className="flex gap-2">
            <Button
              variant={formState.scheduleType === 'ONE_TIME' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFormState({ ...formState, scheduleType: 'ONE_TIME' })}
            >
              単発
            </Button>
            <Button
              variant={formState.scheduleType === 'RECURRING' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFormState({ ...formState, scheduleType: 'RECURRING' })}
            >
              定期
            </Button>
          </div>
        </div>

        {/* 単発スケジュールの詳細 */}
        {formState.scheduleType === 'ONE_TIME' && (
          <Input
            label="期限"
            type="date"
            value={formState.deadline}
            onChange={(e) => setFormState({ ...formState, deadline: e.target.value })}
          />
        )}

        {/* 定期スケジュールの詳細 */}
        {formState.scheduleType === 'RECURRING' && (
          <>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                繰り返しパターン
              </label>
              <div className="flex gap-2">
                {PATTERN_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={formState.patternType === opt.value ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setFormState({ ...formState, patternType: opt.value })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {formState.patternType === 'DAILY' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editSkipWeekends"
                  checked={formState.skipWeekends}
                  onChange={(e) =>
                    setFormState({ ...formState, skipWeekends: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800"
                />
                <label htmlFor="editSkipWeekends" className="text-sm text-white/70">
                  土日をスキップ
                </label>
              </div>
            )}

            {formState.patternType === 'WEEKLY' && (
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  曜日
                </label>
                <select
                  value={formState.dayOfWeek}
                  onChange={(e) => setFormState({ ...formState, dayOfWeek: e.target.value })}
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

            {formState.patternType === 'MONTHLY' && (
              <Input
                label="日付（1-28）"
                type="number"
                min={1}
                max={28}
                value={formState.dayOfMonth}
                onChange={(e) =>
                  setFormState({ ...formState, dayOfMonth: Number(e.target.value) })
                }
              />
            )}

            <Input
              label="開始日"
              type="date"
              value={formState.startDate}
              onChange={(e) => setFormState({ ...formState, startDate: e.target.value })}
            />

            <Input
              label="終了日（任意）"
              type="date"
              value={formState.endDate}
              onChange={(e) => setFormState({ ...formState, endDate: e.target.value })}
            />
          </>
        )}
      </div>
    </Modal>
  )
}

TaskEditModal.displayName = 'TaskEditModal'
