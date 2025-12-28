import { useState, useEffect, useMemo, useCallback } from 'react'
import { addDays, startOfWeek, isSameDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Clock, Trash2, RefreshCw } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { useMember, useMemberAvailability } from '../hooks'
import { isParentRole, formatJa, toISODateString } from '../utils'
import type { Member, MemberAvailability, TimeSlot } from '../types'
import type { TimeSlotRequest } from '../types/api'
import { clsx } from 'clsx'

/**
 * 週カレンダーコンポーネント
 */
interface WeekCalendarProps {
  currentWeekStart: Date
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onPreviousWeek: () => void
  onNextWeek: () => void
  hasAvailabilitiesOnDate: (date: Date) => boolean
}

function WeekCalendar({
  currentWeekStart,
  selectedDate,
  onSelectDate,
  onPreviousWeek,
  onNextWeek,
  hasAvailabilitiesOnDate,
}: WeekCalendarProps) {
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  )

  return (
    <section className="py-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onPreviousWeek}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-semibold text-white">
          {formatJa(currentWeekStart, 'M月')}
        </span>
        <Button variant="ghost" size="sm" onClick={onNextWeek}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const isToday = isSameDay(day, new Date())
          const hasSlots = hasAvailabilitiesOnDate(day)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={clsx(
                'flex flex-col items-center py-2 rounded-xl transition-all',
                isSelected
                  ? 'bg-coral-500 text-white'
                  : isToday
                    ? 'bg-dark-800 text-coral-400'
                    : 'text-dark-300 hover:bg-dark-800'
              )}
            >
              <span className="text-[10px] mb-1">{formatJa(day, 'E')}</span>
              <span className={clsx('text-lg font-bold', isSelected && 'text-white')}>
                {formatJa(day, 'd')}
              </span>
              {hasSlots && (
                <div
                  className={clsx(
                    'w-1.5 h-1.5 rounded-full mt-1',
                    isSelected ? 'bg-white' : 'bg-coral-400'
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * 時間スロットアイテムコンポーネント
 */
interface TimeSlotItemProps {
  slot: TimeSlot
  onDelete: () => void
  disabled?: boolean
}

function TimeSlotItem({ slot, onDelete, disabled }: TimeSlotItemProps) {
  return (
    <div className="flex items-center justify-between bg-dark-900/50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-coral-400" />
        <span className="text-white">
          {slot.startTime} - {slot.endTime}
        </span>
        {slot.memo && (
          <span className="text-dark-400 text-sm">({slot.memo})</span>
        )}
      </div>
      <button
        className="p-1 hover:bg-dark-700 rounded disabled:opacity-50"
        onClick={onDelete}
        disabled={disabled}
      >
        <Trash2 className="w-4 h-4 text-dark-500 hover:text-red-400" />
      </button>
    </div>
  )
}

/**
 * メンバー空き時間カードコンポーネント
 */
interface MemberAvailabilityCardProps {
  member: Member
  availabilities: MemberAvailability[]
  onDeleteSlot: (availability: MemberAvailability, slot: TimeSlot) => void
  loading: boolean
}

function MemberAvailabilityCard({
  member,
  availabilities,
  onDeleteSlot,
  loading,
}: MemberAvailabilityCardProps) {
  return (
    <Card variant="glass">
      <div className="flex items-start gap-3">
        <Avatar
          name={member.name}
          size="md"
          variant={isParentRole(member.role) ? 'parent' : 'child'}
        />
        <div className="flex-1">
          <span className="font-medium text-white">{member.name}</span>
          <div className="mt-2 space-y-2">
            {availabilities.flatMap((availability) =>
              availability.slots.map((slot, slotIndex) => (
                <TimeSlotItem
                  key={`${availability.id}-${slotIndex}`}
                  slot={slot}
                  onDelete={() => onDeleteSlot(availability, slot)}
                  disabled={loading}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * 空の状態コンポーネント
 */
interface EmptyStateProps {
  onAdd: () => void
}

function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <Card variant="glass" className="text-center py-8">
      <Clock className="w-12 h-12 text-dark-600 mx-auto mb-3" />
      <p className="text-dark-400">この日の登録はありません</p>
      <Button variant="primary" size="sm" className="mt-4" onClick={onAdd}>
        <Plus className="w-4 h-4 mr-1" />
        空き時間を登録
      </Button>
    </Card>
  )
}

/**
 * メンバー選択コンポーネント
 */
interface MemberSelectorProps {
  members: Member[]
  selectedMemberId: string | null
  onSelect: (memberId: string) => void
}

function MemberSelector({ members, selectedMemberId, onSelect }: MemberSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-dark-300 mb-2">
        メンバー
      </label>
      <div className="flex gap-2 flex-wrap">
        {members.map((member) => (
          <Button
            key={member.id}
            variant={selectedMemberId === member.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onSelect(member.id)}
          >
            {member.name}
          </Button>
        ))}
      </div>
    </div>
  )
}

/**
 * 空き時間管理ページ
 */
export function Availability() {
  // カレンダー状態
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedMember, setSelectedMember] = useState<string | null>(null)

  // モーダル状態
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSlot, setNewSlot] = useState<TimeSlotRequest>({
    startTime: '',
    endTime: '',
    memo: '',
  })

  // メンバー管理フック
  const { members, fetchMembers, loading: membersLoading } = useMember()

  // 空き時間管理フック
  const {
    availabilities,
    loading: availabilityLoading,
    error,
    fetchAvailabilities,
    addAvailability,
    removeSlots,
    setAvailabilities,
    clearError,
  } = useMemberAvailability()

  const loading = membersLoading || availabilityLoading

  // 全メンバーの空き時間を取得
  const fetchAllAvailabilities = useCallback(async () => {
    if (members.length === 0) return

    // 各メンバーの空き時間を取得して結合
    const allAvailabilities: MemberAvailability[] = []
    for (const member of members) {
      await fetchAvailabilities(member.id)
    }
  }, [members, fetchAvailabilities])

  // 初回マウント時にメンバー一覧を取得
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // メンバー取得後に空き時間を取得
  useEffect(() => {
    if (members.length > 0) {
      // 最初のメンバーの空き時間を取得（デモ用）
      // 実際には全メンバー分を取得するか、選択されたメンバー分のみ取得
      members.forEach(member => {
        fetchAvailabilities(member.id)
      })
    }
  }, [members, fetchAvailabilities])

  // エラー時の自動クリア
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  /**
   * 指定日付の空き時間を取得
   */
  const getAvailabilitiesForDate = (date: Date, memberId?: string): MemberAvailability[] => {
    const dateStr = toISODateString(date)
    return availabilities.filter(
      (av) => av.targetDate === dateStr && (memberId ? av.memberId === memberId : true)
    )
  }

  /**
   * 指定日付にスロットがあるかチェック
   */
  const hasAvailabilitiesOnDate = (date: Date): boolean => {
    const dateStr = toISODateString(date)
    return availabilities.some((av) => av.targetDate === dateStr && av.slots.length > 0)
  }

  /**
   * メンバーごとの総スロット数を取得
   */
  const getTotalSlotsForMember = (memberId: string): number => {
    return availabilities
      .filter((av) => av.memberId === memberId)
      .reduce((sum, av) => sum + av.slots.length, 0)
  }

  const selectedDateAvailabilities = getAvailabilitiesForDate(selectedDate)

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = () => {
    setShowAddModal(false)
    setNewSlot({ startTime: '', endTime: '', memo: '' })
    setSelectedMember(null)
    clearError()
  }

  /**
   * 空き時間追加ハンドラー
   */
  const handleAddAvailability = async () => {
    if (!selectedMember || !newSlot.startTime || !newSlot.endTime) return

    const targetDate = toISODateString(selectedDate)
    const existingAvailability = availabilities.find(
      (av) => av.memberId === selectedMember && av.targetDate === targetDate
    )

    if (existingAvailability) {
      // 既存データがある場合はローカルでスロット追加
      setAvailabilities((prev) =>
        prev.map((av) =>
          av.id === existingAvailability.id
            ? {
                ...av,
                slots: [
                  ...av.slots,
                  {
                    startTime: newSlot.startTime,
                    endTime: newSlot.endTime,
                    memo: newSlot.memo || null,
                  },
                ],
              }
            : av
        )
      )
      handleCloseModal()
    } else {
      const success = await addAvailability(selectedMember, targetDate, [
        {
          startTime: newSlot.startTime,
          endTime: newSlot.endTime,
          memo: newSlot.memo || undefined,
        },
      ])

      if (success) {
        handleCloseModal()
      }
    }
  }

  /**
   * スロット削除ハンドラー
   */
  const handleDeleteSlot = async (availability: MemberAvailability, slotToDelete: TimeSlot) => {
    if (availability.slots.length <= 1) {
      setAvailabilities((prev) => prev.filter((av) => av.id !== availability.id))
      return
    }

    await removeSlots(availability.id, [
      {
        startTime: slotToDelete.startTime,
        endTime: slotToDelete.endTime,
        memo: slotToDelete.memo ?? undefined,
      },
    ])
  }

  /**
   * データ再取得ハンドラー
   */
  const handleRefresh = async () => {
    await fetchMembers()
    // メンバー取得後、useEffectでavailabilitiesが再取得される
  }

  return (
    <>
      <Header
        title="空き時間"
        subtitle="家族の予定を管理"
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
              登録
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

        {/* カレンダーナビゲーション */}
        <WeekCalendar
          currentWeekStart={currentWeekStart}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPreviousWeek={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}
          onNextWeek={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}
          hasAvailabilitiesOnDate={hasAvailabilitiesOnDate}
        />

        {/* 選択日の詳細 */}
        <section className="mt-4">
          <h2 className="text-lg font-bold text-white mb-4">
            {formatJa(selectedDate, 'M月d日（E）')}の空き時間
          </h2>

          {selectedDateAvailabilities.length > 0 ? (
            <div className="space-y-3">
              {members.map((member) => {
                const memberAvailabilities = selectedDateAvailabilities.filter(
                  (av) => av.memberId === member.id
                )
                if (memberAvailabilities.length === 0) return null

                return (
                  <MemberAvailabilityCard
                    key={member.id}
                    member={member}
                    availabilities={memberAvailabilities}
                    onDeleteSlot={handleDeleteSlot}
                    loading={loading}
                  />
                )
              })}
            </div>
          ) : (
            <EmptyState onAdd={() => setShowAddModal(true)} />
          )}
        </section>

        {/* メンバー別サマリー */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white mb-4">メンバー別</h2>
          {members.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {members.map((member) => (
                <Card
                  key={member.id}
                  variant="glass"
                  hoverable
                  className="text-center"
                  onClick={() => setSelectedMember(member.id)}
                >
                  <Avatar
                    name={member.name}
                    size="lg"
                    variant={isParentRole(member.role) ? 'parent' : 'child'}
                    className="mx-auto mb-2"
                  />
                  <p className="font-medium text-white text-sm">{member.name}</p>
                  <p className="text-xs text-dark-400">
                    {getTotalSlotsForMember(member.id)}件の登録
                  </p>
                </Card>
              ))}
            </div>
          ) : (
            <Card variant="glass" className="text-center py-4">
              <p className="text-dark-400">
                {membersLoading ? '読み込み中...' : 'メンバーがいません'}
              </p>
            </Card>
          )}
        </section>

        {/* 追加モーダル */}
        <Modal
          isOpen={showAddModal}
          onClose={handleCloseModal}
          title="空き時間を登録"
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
                onClick={handleAddAvailability}
                loading={loading}
                disabled={!selectedMember || !newSlot.startTime || !newSlot.endTime}
              >
                登録
              </Button>
            </>
          }
        >
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <MemberSelector
            members={members}
            selectedMemberId={selectedMember}
            onSelect={setSelectedMember}
          />

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">
              日付
            </label>
            <div className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white">
              {formatJa(selectedDate, 'yyyy年M月d日（E）')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="開始時刻"
              type="time"
              value={newSlot.startTime}
              onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
            />
            <Input
              label="終了時刻"
              type="time"
              value={newSlot.endTime}
              onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
            />
          </div>

          <Input
            label="メモ（任意）"
            placeholder="例: 学校から帰宅後"
            value={newSlot.memo ?? ''}
            onChange={(e) => setNewSlot({ ...newSlot, memo: e.target.value })}
          />
        </Modal>
      </PageContainer>
    </>
  )
}
