import { useState } from 'react'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, X, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Input } from '../components/ui/Input'
import type { Member, TimeSlot, FamilyRole } from '../types'
import { clsx } from 'clsx'

const isParentRole = (role: FamilyRole): boolean => {
  return role === 'FATHER' || role === 'MOTHER'
}

// モックデータ
const mockMembers: Member[] = [
  { id: '1', name: '母', role: 'MOTHER', createdAt: '', updatedAt: '' },
  { id: '2', name: '太郎', role: 'BROTHER', createdAt: '', updatedAt: '' },
  { id: '3', name: '花子', role: 'SISTER', createdAt: '', updatedAt: '' },
]

const mockTimeSlots: TimeSlot[] = [
  { id: '1', memberId: '1', targetDate: format(new Date(), 'yyyy-MM-dd'), startTime: '10:00', endTime: '12:00', memo: '買い物後' },
  { id: '2', memberId: '2', targetDate: format(new Date(), 'yyyy-MM-dd'), startTime: '15:00', endTime: '18:00', memo: '学校から帰宅後' },
  { id: '3', memberId: '3', targetDate: format(new Date(), 'yyyy-MM-dd'), startTime: '16:00', endTime: '17:00' },
  { id: '4', memberId: '2', targetDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'), startTime: '10:00', endTime: '12:00' },
]

export function Availability() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSlot, setNewSlot] = useState({ startTime: '', endTime: '', memo: '' })

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  const getSlotsForDate = (date: Date, memberId?: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return mockTimeSlots.filter(
      (slot) =>
        slot.targetDate === dateStr &&
        (memberId ? slot.memberId === memberId : true)
    )
  }

  const selectedDateSlots = getSlotsForDate(selectedDate)

  return (
    <>
      <Header
        title="空き時間"
        subtitle="家族の予定を管理"
        action={
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            登録
          </Button>
        }
      />
      <PageContainer>
        {/* カレンダーナビゲーション */}
        <section className="py-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-white">
              {format(currentWeekStart, 'M月', { locale: ja })}
            </span>
            <Button variant="ghost" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* 週カレンダー */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate)
              const isToday = isSameDay(day, new Date())
              const hasSlots = getSlotsForDate(day).length > 0

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={clsx(
                    'flex flex-col items-center py-2 rounded-xl transition-all',
                    isSelected
                      ? 'bg-coral-500 text-white'
                      : isToday
                      ? 'bg-dark-800 text-coral-400'
                      : 'text-dark-300 hover:bg-dark-800'
                  )}
                >
                  <span className="text-[10px] mb-1">
                    {format(day, 'E', { locale: ja })}
                  </span>
                  <span className={clsx('text-lg font-bold', isSelected && 'text-white')}>
                    {format(day, 'd')}
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

        {/* 選択日の詳細 */}
        <section className="mt-4">
          <h2 className="text-lg font-bold text-white mb-4">
            {format(selectedDate, 'M月d日（E）', { locale: ja })}の空き時間
          </h2>

          {selectedDateSlots.length > 0 ? (
            <div className="space-y-3">
              {mockMembers.map((member) => {
                const memberSlots = selectedDateSlots.filter(
                  (s) => s.memberId === member.id
                )
                if (memberSlots.length === 0) return null

                return (
                  <Card key={member.id} variant="glass">
                    <div className="flex items-start gap-3">
                      <Avatar
                        name={member.name}
                        size="md"
                        variant={isParentRole(member.role) ? 'parent' : 'child'}
                      />
                      <div className="flex-1">
                        <span className="font-medium text-white">{member.name}</span>
                        <div className="mt-2 space-y-2">
                          {memberSlots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between bg-dark-900/50 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-coral-400" />
                                <span className="text-white">
                                  {slot.startTime} - {slot.endTime}
                                </span>
                                {slot.memo && (
                                  <span className="text-dark-400 text-sm">
                                    ({slot.memo})
                                  </span>
                                )}
                              </div>
                              <button className="p-1 hover:bg-dark-700 rounded">
                                <Trash2 className="w-4 h-4 text-dark-500 hover:text-red-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card variant="glass" className="text-center py-8">
              <Clock className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">この日の登録はありません</p>
              <Button
                variant="primary"
                size="sm"
                className="mt-4"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                空き時間を登録
              </Button>
            </Card>
          )}
        </section>

        {/* メンバー別サマリー */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-white mb-4">メンバー別</h2>
          <div className="grid grid-cols-3 gap-3">
            {mockMembers.map((member) => {
              const totalSlots = mockTimeSlots.filter(
                (s) => s.memberId === member.id
              ).length

              return (
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
                  <p className="text-xs text-dark-400">{totalSlots}件の登録</p>
                </Card>
              )
            })}
          </div>
        </section>

        {/* 追加モーダル */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50">
            <div className="bg-dark-900 w-full max-w-lg rounded-t-3xl p-6 safe-bottom">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">空き時間を登録</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-dark-800 rounded-full"
                >
                  <X className="w-5 h-5 text-dark-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    メンバー
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {mockMembers.map((member) => (
                      <Button
                        key={member.id}
                        variant={selectedMember === member.id ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setSelectedMember(member.id)}
                      >
                        {member.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    日付
                  </label>
                  <div className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white">
                    {format(selectedDate, 'yyyy年M月d日（E）', { locale: ja })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="開始時刻"
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) =>
                      setNewSlot({ ...newSlot, startTime: e.target.value })
                    }
                  />
                  <Input
                    label="終了時刻"
                    type="time"
                    value={newSlot.endTime}
                    onChange={(e) =>
                      setNewSlot({ ...newSlot, endTime: e.target.value })
                    }
                  />
                </div>

                <Input
                  label="メモ（任意）"
                  placeholder="例: 学校から帰宅後"
                  value={newSlot.memo}
                  onChange={(e) => setNewSlot({ ...newSlot, memo: e.target.value })}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowAddModal(false)}
                >
                  キャンセル
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    // TODO: APIを呼び出して空き時間を登録
                    setShowAddModal(false)
                    setNewSlot({ startTime: '', endTime: '', memo: '' })
                  }}
                >
                  登録
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </>
  )
}
