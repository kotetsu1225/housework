package com.task.infra.pushSubscription

import com.google.inject.Inject
import com.task.domain.member.MemberId
import com.task.infra.database.jooq.tables.references.PUSH_SUBSCRIPTIONS
import org.jooq.DSLContext
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

class PushSubscriptionRepositoryImpl @Inject constructor() : PushSubscriptionRepository {

    override fun save(subscription: PushSubscription, session: DSLContext): PushSubscription {
        val now = OffsetDateTime.now(ZoneOffset.UTC)
        val existing = findByEndpoint(subscription.endpoint, session)

        if (existing != null) {
            // 同じendpointがあれば更新（メンバー変更の可能性）
            session.update(PUSH_SUBSCRIPTIONS)
                .set(PUSH_SUBSCRIPTIONS.MEMBER_ID, subscription.memberId.value)
                .set(PUSH_SUBSCRIPTIONS.P256DH_KEY, subscription.p256dhKey)
                .set(PUSH_SUBSCRIPTIONS.AUTH_KEY, subscription.authKey)
                .set(PUSH_SUBSCRIPTIONS.EXPIRATION_TIME,
                    subscription.expirationTime?.atOffset(ZoneOffset.UTC))
                .set(PUSH_SUBSCRIPTIONS.USER_AGENT, subscription.userAgent)
                .set(PUSH_SUBSCRIPTIONS.IS_ACTIVE, true)
                .set(PUSH_SUBSCRIPTIONS.UPDATED_AT, now)
                .where(PUSH_SUBSCRIPTIONS.ENDPOINT.eq(subscription.endpoint))
                .execute()
            return subscription.copy(id = existing.id)
        }

        session.insertInto(PUSH_SUBSCRIPTIONS)
            .set(PUSH_SUBSCRIPTIONS.ID, subscription.id)
            .set(PUSH_SUBSCRIPTIONS.MEMBER_ID, subscription.memberId.value)
            .set(PUSH_SUBSCRIPTIONS.ENDPOINT, subscription.endpoint)
            .set(PUSH_SUBSCRIPTIONS.P256DH_KEY, subscription.p256dhKey)
            .set(PUSH_SUBSCRIPTIONS.AUTH_KEY, subscription.authKey)
            .set(PUSH_SUBSCRIPTIONS.EXPIRATION_TIME,
                subscription.expirationTime?.atOffset(ZoneOffset.UTC))
            .set(PUSH_SUBSCRIPTIONS.USER_AGENT, subscription.userAgent)
            .set(PUSH_SUBSCRIPTIONS.IS_ACTIVE, subscription.isActive)
            .set(PUSH_SUBSCRIPTIONS.CREATED_AT, now)
            .set(PUSH_SUBSCRIPTIONS.UPDATED_AT, now)
            .execute()

        return subscription
    }

    override fun findByMemberId(memberId: MemberId, session: DSLContext): List<PushSubscription> {
        return session.selectFrom(PUSH_SUBSCRIPTIONS)
            .where(PUSH_SUBSCRIPTIONS.MEMBER_ID.eq(memberId.value))
            .and(PUSH_SUBSCRIPTIONS.IS_ACTIVE.eq(true))
            .fetch { toEntity(it) }
    }

    override fun findAllActive(session: DSLContext): List<PushSubscription> {
        return session.selectFrom(PUSH_SUBSCRIPTIONS)
            .where(PUSH_SUBSCRIPTIONS.IS_ACTIVE.eq(true))
            .fetch { toEntity(it) }
    }

    override fun findActiveByMemberIds(memberIds: List<MemberId>, session: DSLContext): List<PushSubscription> {
        if (memberIds.isEmpty()) {
            return emptyList()
        }

        val memberIdsValues = memberIds.map { it.value }
        return session.selectFrom(PUSH_SUBSCRIPTIONS)
            .where(PUSH_SUBSCRIPTIONS.MEMBER_ID.`in`(memberIdsValues))
            .and(PUSH_SUBSCRIPTIONS.IS_ACTIVE.eq(true))
            .fetch { toEntity(it) }
    }

    override fun findByEndpoint(endpoint: String, session: DSLContext): PushSubscription? {
        return session.selectFrom(PUSH_SUBSCRIPTIONS)
            .where(PUSH_SUBSCRIPTIONS.ENDPOINT.eq(endpoint))
            .fetchOne { toEntity(it) }
    }

    override fun deactivate(id: UUID, session: DSLContext) {
        session.update(PUSH_SUBSCRIPTIONS)
            .set(PUSH_SUBSCRIPTIONS.IS_ACTIVE, false)
            .set(PUSH_SUBSCRIPTIONS.UPDATED_AT, OffsetDateTime.now(ZoneOffset.UTC))
            .where(PUSH_SUBSCRIPTIONS.ID.eq(id))
            .execute()
    }

    override fun deleteByMemberId(memberId: MemberId, session: DSLContext) {
        session.deleteFrom(PUSH_SUBSCRIPTIONS)
            .where(PUSH_SUBSCRIPTIONS.MEMBER_ID.eq(memberId.value))
            .execute()
    }

    private fun toEntity(record: org.jooq.Record): PushSubscription {
        return PushSubscription(
            id = record.get(PUSH_SUBSCRIPTIONS.ID)!!,
            memberId = MemberId(record.get(PUSH_SUBSCRIPTIONS.MEMBER_ID)!!),
            endpoint = record.get(PUSH_SUBSCRIPTIONS.ENDPOINT)!!,
            p256dhKey = record.get(PUSH_SUBSCRIPTIONS.P256DH_KEY)!!,
            authKey = record.get(PUSH_SUBSCRIPTIONS.AUTH_KEY)!!,
            expirationTime = record.get(PUSH_SUBSCRIPTIONS.EXPIRATION_TIME)?.toInstant(),
            userAgent = record.get(PUSH_SUBSCRIPTIONS.USER_AGENT),
            isActive = record.get(PUSH_SUBSCRIPTIONS.IS_ACTIVE)!!,
        )
    }
}
