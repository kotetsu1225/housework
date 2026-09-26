package com.task.support

import com.task.domain.member.MemberId
import com.task.domain.tenant.TenantId
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.TENANTS
import org.jooq.DSLContext

/**
 * テスト用に、テナントとそのテナントに属するメンバーを投入するフィクスチャ(issue #41)。
 *
 * RLSをバイパスして投入する必要があるため、必ずオーナー接続のDSLContext
 * ([PostgresTestDatabase.ownerDsl])と組み合わせて使う。
 */
object TestFixtures {

    /** [createTenantWithMember]の戻り値。作成したtenantとmemberのIDの組。 */
    data class TenantWithMember(val tenantId: TenantId, val memberId: MemberId)

    /**
     * `tenants` に1行、`members` に1行(作成したtenantの `tenant_id` を設定)をINSERTする。
     *
     * - `members.role` はV7のCHECK制約(FATHER/MOTHER/SISTER/BROTHER)に合わせて固定で"FATHER"を使う
     *   (テストの関心事はテナント分離であり、roleの値自体ではないため)
     * - `members.password_hash` は認証を通さないためダミー文字列を設定する
     * - [email] は `tenants.email` と `members.email` の両方に使う。どちらもUNIQUE制約が
     *   あるため、複数回呼び出す場合は呼び出しごとに異なる値を渡すこと
     *
     * @param dsl オーナー接続のDSLContext([PostgresTestDatabase.ownerDsl]を渡す)
     */
    fun createTenantWithMember(
        dsl: DSLContext,
        familyName: String,
        memberName: String,
        email: String,
    ): TenantWithMember {
        val tenantId = TenantId.generate()
        dsl.insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, familyName)
            .set(TENANTS.EMAIL, email)
            .execute()

        val memberId = MemberId.generate()
        dsl.insertInto(MEMBERS)
            .set(MEMBERS.ID, memberId.value)
            .set(MEMBERS.NAME, memberName)
            .set(MEMBERS.ROLE, "FATHER")
            .set(MEMBERS.PASSWORD_HASH, "dummy-password-hash")
            .set(MEMBERS.EMAIL, email)
            .set(MEMBERS.TENANT_ID, tenantId.value)
            .execute()

        return TenantWithMember(tenantId, memberId)
    }
}
