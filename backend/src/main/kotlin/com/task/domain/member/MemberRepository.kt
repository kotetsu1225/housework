package com.task.domain.member

import com.google.inject.ImplementedBy
import com.task.infra.member.MemberRepositoryImpl
import org.jooq.DSLContext

@ImplementedBy(MemberRepositoryImpl::class)
interface MemberRepository {
    fun create(member: Member, session: DSLContext): Member
    fun update(member: Member, session: DSLContext): Member
    fun findById(id: MemberId, session: DSLContext): Member?
    fun findByIds(ids: List<MemberId>, session: DSLContext): List<Member>?
    fun findByName(name: MemberName, session: DSLContext): Member?

    /**
     * SQL は tenant で絞り込まない(無条件で全件の name を SELECT する)。
     *
     * tenant スコープのトランザクション(`Database.withTransaction(tenantId)`)内で呼び出した場合は、
     * RLS(Row Level Security)によって自テナント分のみに絞られる。
     * オーナー接続(互換パスや `DatabaseWithoutRLS` など RLS をバイパスする接続)から呼ぶと、
     * 全テナント分の名前が返ってしまうので注意すること。
     */
    fun findAllNames(session: DSLContext): List<MemberName>

    /**
     * SQL は tenant で絞り込まない(無条件で全件を SELECT する)。
     *
     * tenant スコープのトランザクション(`Database.withTransaction(tenantId)`)内で呼び出した場合は、
     * RLS(Row Level Security)によって自テナント分のみに絞られる。
     * オーナー接続(互換パスや `DatabaseWithoutRLS` など RLS をバイパスする接続)から呼ぶと、
     * 全テナント分が返ってしまうので注意すること
     * (通知ハンドラが「家族全員」の意味でこのメソッドを使っている箇所があるため、呼び出し元の変更時は要確認)。
     */
    fun findAll(session: DSLContext): List<Member>
}
