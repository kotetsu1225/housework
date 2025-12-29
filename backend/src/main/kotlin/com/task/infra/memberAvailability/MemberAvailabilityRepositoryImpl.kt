package com.task.infra.memberAvailability

import com.google.inject.Singleton
import com.task.domain.member.MemberId
import com.task.domain.memberAvailability.*
import com.task.infra.database.jooq.tables.MemberAvailabilities.Companion.MEMBER_AVAILABILITIES
import com.task.infra.database.jooq.tables.TimeSlots.Companion.TIME_SLOTS
import com.task.infra.database.jooq.tables.records.MemberAvailabilitiesRecord
import com.task.infra.database.jooq.tables.records.TimeSlotsRecord
import org.jooq.DSLContext
import org.jooq.Field
import org.jooq.impl.DSL.multiset
import org.jooq.impl.DSL.select
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

@Singleton
class MemberAvailabilityRepositoryImpl : MemberAvailabilityRepository {

    // MULTISETフィールドを変数として定義することで型安全なアクセスを実現
    // record.get(Field)は型パラメータからList<TimeSlotsRecord>を推論するため、キャスト不要
    // 出典: https://blog.jooq.org/ad-hoc-data-type-conversion-with-jooq-3-15/
    private val timeSlotsField: Field<List<TimeSlotsRecord>> = multiset(
        select(TIME_SLOTS.asterisk())
            .from(TIME_SLOTS)
            .where(TIME_SLOTS.MEMBER_AVAILABILITY_ID.eq(MEMBER_AVAILABILITIES.ID))
    ).convertFrom { r -> r.into(TimeSlotsRecord::class.java) }

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
                createdAt = now
                updatedAt = now
            }
            record.store()
        } else {
            session
                .update(MEMBER_AVAILABILITIES)
                .set(MEMBER_AVAILABILITIES.MEMBER_ID, memberAvailability.memberId.value)
                .set(MEMBER_AVAILABILITIES.TARGET_DATE, memberAvailability.targetDate)
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
        return session
            .select(MEMBER_AVAILABILITIES.asterisk(), timeSlotsField)
            .from(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.ID.eq(id.value))
            .fetchOne { record ->
                val availabilityRecord = record.into(MemberAvailabilitiesRecord::class.java)
                // Field変数を使用した型安全なアクセス（キャスト不要）
                val timeSlotsRecords = record.get(timeSlotsField)
                val slots = mapToTimeSlots(timeSlotsRecords)
                reconstructFromRecords(availabilityRecord, slots)
            }
    }

    // MULTISETを使用して1回のクエリで検索と関連データ取得を実行
    override fun findByMemberIdAndTargetDate(
        memberId: MemberId,
        targetDate: LocalDate,
        session: DSLContext
    ): MemberAvailability? {
        return session
            .select(MEMBER_AVAILABILITIES.asterisk(), timeSlotsField)
            .from(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.MEMBER_ID.eq(memberId.value))
            .and(MEMBER_AVAILABILITIES.TARGET_DATE.eq(targetDate))
            .fetchOne { record ->
                val availabilityRecord = record.into(MemberAvailabilitiesRecord::class.java)
                val timeSlotsRecords = record.get(timeSlotsField)
                val slots = mapToTimeSlots(timeSlotsRecords)
                reconstructFromRecords(availabilityRecord, slots)
            }
    }

    override fun findAllByMemberId(
        memberId: MemberId,
        session: DSLContext
    ): List<MemberAvailability> {
        return session
            .select(MEMBER_AVAILABILITIES.asterisk(), timeSlotsField)
            .from(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.MEMBER_ID.eq(memberId.value))
            .orderBy(MEMBER_AVAILABILITIES.CREATED_AT.desc())
            .fetch { record ->
                val memberAvailabilityRecord = record.into(MemberAvailabilitiesRecord::class.java)
                val timeSlotsRecords = record.get(timeSlotsField)
                val slots = mapToTimeSlots(timeSlotsRecords)
                reconstructFromRecords(memberAvailabilityRecord, slots)
            }
    }

    override fun delete(id: MemberAvailabilityId, session: DSLContext) {
        // time_slots は ON DELETE CASCADE で自動削除される
        session
            .deleteFrom(MEMBER_AVAILABILITIES)
            .where(MEMBER_AVAILABILITIES.ID.eq(id.value))
            .execute()
    }

    private fun mapToTimeSlots(slotRecords: List<TimeSlotsRecord>): List<TimeSlot> {
        return slotRecords.map { record ->
            TimeSlot(
                startTime = record.startTime!!,
                endTime = record.endTime!!,
                memo = record.memo
            )
        }
    }

    private fun reconstructFromRecords(
        availabilityRecord: MemberAvailabilitiesRecord,
        slots: List<TimeSlot>
    ): MemberAvailability {
        return MemberAvailability.reconstruct(
            id = MemberAvailabilityId(availabilityRecord.id!!),
            memberId = MemberId(availabilityRecord.memberId!!),
            targetDate = availabilityRecord.targetDate!!,
            slots = slots
        )
    }
}
