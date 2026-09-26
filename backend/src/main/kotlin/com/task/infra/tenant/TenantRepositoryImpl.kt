package com.task.infra.tenant

import com.google.inject.Singleton
import com.task.domain.member.MemberEmail
import com.task.domain.tenant.FamilyName
import com.task.domain.tenant.Tenant
import com.task.domain.tenant.TenantId
import com.task.domain.tenant.TenantRepository
import com.task.domain.tenant.TenantStatus
import com.task.infra.database.jooq.tables.Tenants.Companion.TENANTS
import com.task.infra.database.jooq.tables.records.TenantsRecord
import org.jooq.DSLContext

@Singleton
class TenantRepositoryImpl : TenantRepository {

    override fun create(tenant: Tenant, session: DSLContext): Tenant {
        val record = session.newRecord(TENANTS)

        record.id = tenant.id.value
        record.familyName = tenant.familyName.value
        record.email = tenant.email.value
        record.status = tenant.status.name
        // created_at, updated_at は DB のデフォルト値(CURRENT_TIMESTAMP)に任せる

        record.store()

        return tenant
    }

    override fun findById(id: TenantId, session: DSLContext): Tenant? {
        val record = session
            .selectFrom(TENANTS)
            .where(TENANTS.ID.eq(id.value))
            .fetchOne()

        return record?.toDomain()
    }

    override fun findAllActiveIds(session: DSLContext): List<TenantId> {
        // created_at 昇順で固定することで、テナント横断バッチ(#56)のログを追いやすくする
        return session
            .select(TENANTS.ID)
            .from(TENANTS)
            .where(TENANTS.STATUS.eq(TenantStatus.ACTIVE.name))
            .orderBy(TENANTS.CREATED_AT.asc())
            .fetch()
            .map { record -> TenantId(record.get(TENANTS.ID)!!) }
    }

    private fun TenantsRecord.toDomain(): Tenant {
        return Tenant.reconstruct(
            id = TenantId(this.id!!),
            familyName = FamilyName(this.familyName),
            email = MemberEmail(this.email),
            status = TenantStatus.valueOf(this.status!!),
        )
    }
}
