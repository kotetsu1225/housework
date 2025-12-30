/**
 * メンバー空き時間セクションコンポーネント
 *
 * ダッシュボードでメンバーの本日の空き時間を表示
 */

import { Clock, Calendar } from 'lucide-react'
import { Card } from '../ui/Card'
import { Avatar } from '../ui/Avatar'
import { isParentRole } from '../../utils'
import { getFamilyRoleLabel } from '../../utils/familyRole'
import type { MemberAvailabilityTodayDto } from '../../api/dashboard'
import type { FamilyRole } from '../../types'

export interface MemberAvailabilitySectionProps {
  /** メンバーの空き時間一覧 */
  availabilities: MemberAvailabilityTodayDto[]
  /** セクションタイトル */
  title?: string
}

/**
 * メンバー空き時間セクション
 *
 * 全メンバーの本日の空き時間を表示
 * 空き時間がないメンバーは「予定なし」と表示
 *
 * @example
 * ```tsx
 * <MemberAvailabilitySection
 *   availabilities={memberAvailabilities}
 *   title="今日の空き時間"
 * />
 * ```
 */
export function MemberAvailabilitySection({
  availabilities,
  title = '今日の空き時間',
}: MemberAvailabilitySectionProps) {
  if (availabilities.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-coral-400" />
          {title}
        </h3>
        <Card variant="glass" className="text-center py-8">
          <p className="text-white/50">今日の空き時間は登録されていません</p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Calendar className="w-5 h-5 text-coral-400" />
        {title}
      </h3>

      <div className="space-y-3">
        {availabilities.map((availability) => (
          <MemberAvailabilityCard
            key={availability.memberId}
            availability={availability}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * 個別メンバーの空き時間カード
 */
interface MemberAvailabilityCardProps {
  availability: MemberAvailabilityTodayDto
}

function MemberAvailabilityCard({ availability }: MemberAvailabilityCardProps) {
  const hasSlots = availability.slots.length > 0
  const familyRole = availability.familyRole as FamilyRole

  return (
    <Card variant="glass" className="flex items-start gap-4">
      {/* アバター */}
      <div className="flex-shrink-0">
        <Avatar
          name={availability.memberName}
          size="md"
          role={familyRole}
          variant={isParentRole(familyRole) ? 'parent' : 'child'}
        />
      </div>

      {/* メンバー情報と空き時間 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-medium text-white">
            {availability.memberName}
          </span>
          <span className="text-xs text-white/50">
            {getFamilyRoleLabel(familyRole)}
          </span>
        </div>

        {/* 空き時間スロット */}
        {hasSlots ? (
          <div className="flex flex-wrap gap-2">
            {availability.slots.map((slot, index) => (
              <TimeSlotBadge
                key={index}
                startTime={slot.startTime}
                endTime={slot.endTime}
                memo={slot.memo}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/40">空き時間の登録なし</p>
        )}
      </div>
    </Card>
  )
}

/**
 * 時間スロットバッジ
 */
interface TimeSlotBadgeProps {
  startTime: string
  endTime: string
  memo: string | null
}

function TimeSlotBadge({ startTime, endTime, memo }: TimeSlotBadgeProps) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-shazam-500/20 text-shazam-300 text-sm"
      title={memo || undefined}
    >
      <Clock className="w-3.5 h-3.5" />
      <span>
        {startTime} - {endTime}
      </span>
      {memo && (
        <span className="text-shazam-400/70 text-xs ml-1">{memo}</span>
      )}
    </div>
  )
}

MemberAvailabilitySection.displayName = 'MemberAvailabilitySection'

