package com.task.usecase.task

import com.task.domain.AppTimeZone
import com.task.domain.taskDefinition.RecurrencePattern
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.tenant.TenantId
import com.task.infra.database.Database
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.database.jooq.tables.references.TENANTS
import com.task.infra.event.InMemoryDomainEventDispatcher
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.infra.tenant.TenantRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.usecase.batch.TenantBatchRunner
import com.task.usecase.task.service.TaskGenerationServiceImpl
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * issue #57 の受け入れ条件を実DBで確かめる。
 * - スケジューラ相当(TenantBatchRunner経由)で全ACTIVEテナントの当日分が生成され、
 *   各行のtenant_idが定義のtenantと一致する
 * - あるテナントの生成が失敗しても他テナントの生成はコミットされる(失敗の隔離)
 * - HTTP相当(UseCaseを直接呼ぶ)では呼び出し元テナントの分だけが生成される
 * - 同じ日付で複数回実行しても冪等(重複生成されない)
 */
class GenerateDailyExecutionsTenantTest {

    private val database = Database(PostgresTestDatabase.ownerDataSource, PostgresTestDatabase.appDataSource)
    private val taskDefinitionRepository = TaskDefinitionRepositoryImpl()
    private val taskExecutionRepository = TaskExecutionRepositoryImpl()
    private val domainEventDispatcher = InMemoryDomainEventDispatcher(emptySet())
    private val taskGenerationService = TaskGenerationServiceImpl(
        taskDefinitionRepository,
        taskExecutionRepository,
        domainEventDispatcher,
    )
    private val useCase = GenerateDailyExecutionsUseCaseImpl(database, taskGenerationService)

    private val tenantBatchRunner = TenantBatchRunner(
        DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource),
        TenantRepositoryImpl(),
    )

    private val today: LocalDate = LocalDate.now(AppTimeZone.ZONE)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    /** オーナー接続でtenantsに1行INSERTする(statusはデフォルトのACTIVE)。 */
    private fun createTenant(familyName: String, email: String): TenantId {
        val tenantId = TenantId.generate()
        PostgresTestDatabase.ownerDsl()
            .insertInto(TENANTS)
            .set(TENANTS.ID, tenantId.value)
            .set(TENANTS.FAMILY_NAME, familyName)
            .set(TENANTS.EMAIL, email)
            .execute()
        return tenantId
    }

    /**
     * 今日が対象日になる毎日の定義を、tenantスコープのtransaction(RLSのWITH CHECKあり)で作成する。
     */
    private fun createDailyDefinition(tenantId: TenantId, name: String): TaskDefinition {
        val now = Instant.now()
        val definition = TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName(name),
            description = TaskDefinitionDescription("テスト用の毎日タスク"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            ownerMemberId = null,
            schedule = TaskSchedule.Recurring(
                pattern = RecurrencePattern.Daily(skipWeekends = false),
                startDate = today.minusDays(1),
                endDate = null,
            ),
            point = 5,
        )
        PostgresTestDatabase.inTenantTransaction(tenantId) { session ->
            taskDefinitionRepository.create(definition, session)
        }
        return definition
    }

    /** オーナー接続(RLSバイパス)で、指定の定義から生成されたtask_executionsの件数を数える。 */
    private fun executionCount(definitionId: TaskDefinitionId): Int {
        return PostgresTestDatabase.ownerDsl()
            .selectCount()
            .from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(definitionId.value))
            .fetchOne(0, Int::class.java) ?: 0
    }

    /** オーナー接続(RLSバイパス)で、指定の定義から生成された行のtenant_idを取得する。 */
    private fun executionTenantId(definitionId: TaskDefinitionId): UUID? {
        return PostgresTestDatabase.ownerDsl()
            .select(TASK_EXECUTIONS.TENANT_ID)
            .from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(definitionId.value))
            .fetchOne(TASK_EXECUTIONS.TENANT_ID)
    }

    @Test
    fun `ランナー経由で全ACTIVEテナントの当日分が生成され各行のtenant_idが定義のtenantと一致する`() {
        val tenantA = createTenant("A家", "a@example.com")
        val tenantB = createTenant("B家", "b@example.com")
        val definitionA = createDailyDefinition(tenantA, "Aの毎日タスク")
        val definitionB = createDailyDefinition(tenantB, "Bの毎日タスク")

        val summary = tenantBatchRunner.forEachActiveTenant("日次タスク生成") { tenantId ->
            useCase.execute(GenerateDailyExecutionsUseCase.Input(tenantId = tenantId, targetDate = today))
        }

        assertEquals(2, summary.successCount)
        assertEquals(0, summary.failureCount)

        assertEquals(1, executionCount(definitionA.id))
        assertEquals(tenantA.value, executionTenantId(definitionA.id))

        assertEquals(1, executionCount(definitionB.id))
        assertEquals(tenantB.value, executionTenantId(definitionB.id))
    }

    @Test
    fun `あるテナントの生成が失敗しても他テナントの生成はコミットされ失敗が1件集計される`() {
        val tenantA = createTenant("A家", "a@example.com")
        val tenantB = createTenant("B家", "b@example.com")
        val tenantC = createTenant("C家", "c@example.com")
        val definitionA = createDailyDefinition(tenantA, "Aの毎日タスク")
        val definitionB = createDailyDefinition(tenantB, "Bの毎日タスク")
        val definitionC = createDailyDefinition(tenantC, "Cの毎日タスク")

        // UseCase本体には仕掛けを入れず、Cのtenantidの時だけ例外を投げるblockをランナーに渡す
        val summary = tenantBatchRunner.forEachActiveTenant("日次タスク生成") { tenantId ->
            if (tenantId == tenantC) {
                throw IllegalStateException("Cの生成に失敗させる(テスト用)")
            }
            useCase.execute(GenerateDailyExecutionsUseCase.Input(tenantId = tenantId, targetDate = today))
        }

        assertEquals(2, summary.successCount)
        assertEquals(1, summary.failureCount)
        assertTrue(summary.results.getValue(tenantC).isFailure)

        // AとBの生成はコミットされている(Cの失敗に巻き込まれない)
        assertEquals(1, executionCount(definitionA.id))
        assertEquals(1, executionCount(definitionB.id))
        // Cは例外でUseCaseが呼ばれていないため生成されない
        assertEquals(0, executionCount(definitionC.id))
    }

    @Test
    fun `HTTP相当でUseCaseを直接呼ぶと呼び出し元テナントの分だけが生成される`() {
        val tenantA = createTenant("A家", "a@example.com")
        val tenantB = createTenant("B家", "b@example.com")
        val definitionA = createDailyDefinition(tenantA, "Aの毎日タスク")
        val definitionB = createDailyDefinition(tenantB, "Bの毎日タスク")

        useCase.execute(GenerateDailyExecutionsUseCase.Input(tenantId = tenantA, targetDate = today))

        assertEquals(1, executionCount(definitionA.id))
        assertEquals(0, executionCount(definitionB.id))
    }

    @Test
    fun `同じ日付で2回実行しても実行は1件のまま(冪等性)`() {
        val tenantA = createTenant("A家", "a@example.com")
        val definitionA = createDailyDefinition(tenantA, "Aの毎日タスク")

        useCase.execute(GenerateDailyExecutionsUseCase.Input(tenantId = tenantA, targetDate = today))
        useCase.execute(GenerateDailyExecutionsUseCase.Input(tenantId = tenantA, targetDate = today))

        assertEquals(1, executionCount(definitionA.id))
    }
}
