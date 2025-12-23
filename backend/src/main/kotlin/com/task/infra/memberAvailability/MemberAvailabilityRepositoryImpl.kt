package com.task.infra.memberAvailability

import com.google.inject.Singleton
import com.task.domain.member.MemberId
import com.task.domain.memberAvailability.*
import com.task.infra.database.jooq.tables.MemberAvailabilities.Companion.MEMBER_AVAILABILITIES
import com.task.infra.database.jooq.tables.TimeSlots.Companion.TIME_SLOTS
import org.jooq.DSLContext
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Singleton
class MemberAvailabilityRepositoryImpl : MemberAvailabilityRepository {

        override fun save(
        memberAvailability: MemberAvailability,
        session: DSLContext
    ): MemberAvailability {

        val existing = session
            .selectFrom(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.ID.eq(memberAvailability.id.value))
            .fetchOne()

        val now = OffsetDateTime.now()

        if (existing == null) {
            val record = session.newRecord(MEMBER_AVAILABILITIES).apply {
                id = memberAvailability.id.value
                memberId = memberAvailability.memberId.value
                targetDate = memberAvailability.targetDate
                isDeleted = false
                createdAt = now
                updatedAt = now
            }
            record.store()
        } else {
            session
                .update(MEMBER_AVAILABILITIES)
                .set(MEMBER_AVAILABILITIES.MEMBER_ID, memberAvailability.memberId.value)
                .set(MEMBER_AVAILABILITIES.TARGET_DATE, memberAvailability.targetDate)
                .set(MEMBER_AVAILABILITIES.IS_DELETED, false)
                .set(MEMBER_AVAILABILITIES.UPDATED_AT, now)
                .where(MEMBER_AVAILABILITIES.ID.eq(memberAvailability.id.value))
                .execute()
        }

        session
            .deleteFrom(TIME_SLOTS)
            .where(TIME_SLOTS.MEMBER_AVAILABILITY_ID.eq(memberAvailability.id.value))
            .execute()

        val slotRecords = memberAvailability.slots.map { slot ->
            session.newRecord(TIME_SLOTS).apply {
                id = UUID.randomUUID()
                memberAvailabilityId = memberAvailability.id.value
                startTime = slot.startTime
                endTime = slot.endTime
                memo = slot.memo
                createdAt = now
                updatedAt = now
            }
        }

        if (slotRecords.isNotEmpty()) {
            session.batchInsert(slotRecords).execute()
        }

        return memberAvailability
    }

    override fun findById(id: MemberAvailabilityId, session: DSLContext): MemberAvailability? {

        val availabilityRecord = session
            .selectFrom(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.ID.eq(id.value))
            .and(MEMBER_AVAILABILITIES.IS_DELETED.eq(false))
            .fetchOne()
            ?: return null

        val slotRecords = session
            .selectFrom(TIME_SLOTS)
            .where(TIME_SLOTS.MEMBER_AVAILABILITY_ID.eq(id.value))
            .fetch()

        val slots = slotRecords.map { record ->
            TimeSlot(
                startTime = record.startTime!!,
                endTime = record.endTime!!,
                memo = record.memo
            )
        }

        return MemberAvailability.reconstruct(
            id = MemberAvailabilityId(availabilityRecord.id!!),
            memberId = MemberId(availabilityRecord.memberId!!),
            targetDate = availabilityRecord.targetDate!!,
            slots = slots
        )
    }

    override fun findByMemberIdAndTargetDate(
        memberId: MemberId,
        targetDate: LocalDate,
        session: DSLContext
    ): MemberAvailability? {
        val availabilityRecord = session
            .selectFrom(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.MEMBER_ID.eq(memberId.value))
            .and(MEMBER_AVAILABILITIES.TARGET_DATE.eq(targetDate))
            .and(MEMBER_AVAILABILITIES.IS_DELETED.eq(false))
            .fetchOne()
            ?: return null

        val slotRecords = session
            .selectFrom(TIME_SLOTS)
            .where(TIME_SLOTS.MEMBER_AVAILABILITY_ID.eq(availabilityRecord.id))
            .fetch()

        val slots = slotRecords.map { record ->
            TimeSlot(
                startTime = record.startTime!!,
                endTime = record.endTime!!,
                memo = record.memo
            )
        }

        return MemberAvailability.reconstruct(
            id = MemberAvailabilityId(availabilityRecord.id!!),
            memberId = MemberId(availabilityRecord.memberId!!),
            targetDate = availabilityRecord.targetDate!!,
            slots = slots
        )
    }

    override fun findAllByMemberId(
        memberId: MemberId,
        session: DSLContext
    ): List<MemberAvailability> {
        val availabilityRecords = session
            .selectFrom(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.MEMBER_ID.eq(memberId.value))
            .and(MEMBER_AVAILABILITIES.IS_DELETED.eq(false))
            .fetch()

        return availabilityRecords.map { availabilityRecord ->
            val slotRecords = session
                .selectFrom(TIME_SLOTS)
                .where(TIME_SLOTS.MEMBER_AVAILABILITY_ID.eq(availabilityRecord.id))
                .fetch()

            val slots = slotRecords.map { record ->
                TimeSlot(
                    startTime = record.startTime!!,
                    endTime = record.endTime!!,
                    memo = record.memo
                )
            }

            MemberAvailability.reconstruct(
                id = MemberAvailabilityId(availabilityRecord.id!!),
                memberId = MemberId(availabilityRecord.memberId!!),
                targetDate = availabilityRecord.targetDate!!,
                slots = slots
            )
        }
    }

    override fun delete(id: MemberAvailabilityId, session: DSLContext) {
        session
            .update(MEMBER_AVAILABILITIES)
            .set(MEMBER_AVAILABILITIES.IS_DELETED, true)
            .set(MEMBER_AVAILABILITIES.UPDATED_AT, OffsetDateTime.now())
            .where(MEMBER_AVAILABILITIES.ID.eq(id.value))
            .execute()
    }
}
