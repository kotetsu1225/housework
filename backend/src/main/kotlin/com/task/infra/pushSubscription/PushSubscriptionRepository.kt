package com.task.infra.pushSubscription

import com.task.domain.member.MemberId
import java.util.UUID

/**
 * PushSubscription リポジトリ
 *
 * 注：このリポジトリはインフラ層に配置されています。
 * 理由：PushSubscriptionはビジネスルールを持たない純粋な技術的概念（通知チャネル）であり、
 * ドメインモデルではないため。将来的にビジネスルールが生まれたら、ドメイン層に昇格させる。
 */
interface PushSubscriptionRepository {
    fun save(subscription: PushSubscription, session: org.jooq.DSLContext): PushSubscription
    fun findByMemberId(memberId: MemberId, session: org.jooq.DSLContext): List<PushSubscription>
    fun findAllActive(session: org.jooq.DSLContext): List<PushSubscription>
    fun findActiveByMemberIds(memberIds: List<MemberId>, session: org.jooq.DSLContext): List<PushSubscription>
    fun findByEndpoint(endpoint: String, session: org.jooq.DSLContext): PushSubscription?
    fun deactivate(id: UUID, session: org.jooq.DSLContext)
    fun deleteByMemberId(memberId: MemberId, session: org.jooq.DSLContext)
}
