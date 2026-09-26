package com.task.domain.tenant

import java.util.UUID

/**
 * テナント(= 家族)の識別子。
 *
 * マルチテナント化の共通契約(issue #34)で型が固定されている。
 * 集約・UseCase の Input・DB 接続点(Database.withTransaction(tenantId))で共通に使う。
 */
@JvmInline
value class TenantId(val value: UUID) {
    companion object {
        fun generate(): TenantId = TenantId(UUID.randomUUID())
        fun from(value: String): TenantId = TenantId(UUID.fromString(value))
    }
}
