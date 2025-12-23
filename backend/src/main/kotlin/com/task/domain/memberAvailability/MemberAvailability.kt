package com.task.domain.memberAvailability

import com.task.domain.member.MemberId
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

class MemberAvailability(
    val id: MemberAvailabilityId,
    val memberId: MemberId,
    val targetDate: LocalDate,
    val slots: List<TimeSlot>,
) {
    init {
        require(slots.isNotEmpty()) { "少なくとも1つのTimeSlotが必要です。" }
        validateNoInternalOverlap(slots)
    }

    fun deleteSlots(
        deletedSlots: List<TimeSlot>
    ): MemberAvailability {
        require(slots.containsAll(deletedSlots)) {
            "指定されたスロットが存在しません"
        }
        val newSlots = slots.filter { it != deletedSlots }

        require(newSlots.isNotEmpty()) {
            "最後のスロットは削除できません"
        }

        return MemberAvailability(
            id = this.id,
            memberId = memberId,
            targetDate = targetDate,
            slots = newSlots
        )
    }

    fun updateSlots(
        newSlots: List<TimeSlot>,
        existingSlots: List<TimeSlot>,
    ): MemberAvailability{
        validateNoOverlapWithExisting(slots, existingSlots)
        return MemberAvailability(
            id = this.id,
            memberId = this.memberId,
            slots = newSlots,
            targetDate = this.targetDate,
        )
    }

    companion object {
        fun create(
            memberId: MemberId,
            targetDate: LocalDate,
            slots: List<TimeSlot>,
            existingAvailabilities: List<MemberAvailability>,
        ): MemberAvailability {

            validateNoCreateSameDayAndMember(
                memberId = memberId,
                targetDate = targetDate,
                existingAvailabilities = existingAvailabilities
            )

            return MemberAvailability(
                id = MemberAvailabilityId.generate(),
                memberId = memberId,
                targetDate = targetDate,
                slots = slots
            )
        }

        fun reconstruct(
            id: MemberAvailabilityId,
            memberId: MemberId,
            targetDate: LocalDate,
            slots: List<TimeSlot>,
        ): MemberAvailability {
            return MemberAvailability(id, memberId, targetDate, slots)
        }

        private fun validateNoInternalOverlap(slots: List<TimeSlot>) {
            if (slots.size < 2) return

            val sorted = slots.sortedBy { it.startTime }

            for (i in 0 until sorted.size - 1) {
                val current = sorted[i]
                val next = sorted[i + 1]

                require(!current.overlapsWith(next)) {
                    "TimeSlotが重複しています: " +
                    "${current.startTime}〜${current.endTime} と " +
                    "${next.startTime}〜${next.endTime}"
                }
            }
        }

        private fun validateNoOverlapWithExisting(
            newSlots: List<TimeSlot>,
            // ここは同日、同一メンバー
            existingSlots: List<TimeSlot>
        ) {
            for (newSlot in newSlots) {
                for (existingSlot in existingSlots) {
                    require(!newSlot.overlapsWith(existingSlot)) {
                        "既存の空き時間（${existingSlot.startTime}〜${existingSlot.endTime}）と" +
                        "重複しています（${newSlot.startTime}〜${newSlot.endTime}）"
                    }
                }
            }
        }

        private fun validateNoCreateSameDayAndMember(
            memberId: MemberId,
            targetDate: LocalDate,
            existingAvailabilities: List<MemberAvailability>
        ){
            for (existingAvailability in existingAvailabilities) {
                require(existingAvailability.memberId != memberId || existingAvailability.targetDate != targetDate) {
                    "同じ日付とメンバーの空き時間が既に存在します"
                }
            }

        }
    }
}

data class MemberAvailabilityId(val value: UUID) {
    companion object {
        fun generate() = MemberAvailabilityId(value = UUID.randomUUID())
    }
}

data class TimeSlot(
    val startTime: LocalTime,
    val endTime: LocalTime,
    val memo: String?
) {
    init {
        require(startTime.isBefore(endTime)) {
            "開始時刻は終了時刻より前である必要があります。"
        }
    }

    fun overlapsWith(other: TimeSlot): Boolean {
        return this.startTime < other.endTime && this.endTime > other.startTime
    }
}