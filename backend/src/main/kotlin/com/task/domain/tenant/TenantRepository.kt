package com.task.domain.tenant

import org.jooq.DSLContext

/**
 * Tenant 集約の永続化を担うリポジトリ。
 *
 * tenants への書き込み・全件列挙は、テナントが確定する前(サインアップ #44 など)
 * またはテナント横断の処理(バッチ #56 など)でのみ発生する。
 * そのため呼び出し側は通常の RLS 付き Database ではなく、`DatabaseWithoutRLS`(#40)が
 * 発行する session を渡すこと。
 */
interface TenantRepository {
    fun create(tenant: Tenant, session: DSLContext): Tenant

    fun findById(id: TenantId, session: DSLContext): Tenant?

    /**
     * status = 'ACTIVE' の TenantId を列挙する。
     * #56 のテナント横断バッチ処理から利用される。
     */
    fun findAllActiveIds(session: DSLContext): List<TenantId>
}
