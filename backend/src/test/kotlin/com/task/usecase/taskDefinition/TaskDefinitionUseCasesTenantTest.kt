package com.task.usecase.taskDefinition

import com.task.domain.AppTimeZone
import com.task.domain.event.DomainEvent
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.event.DomainEventHandler
import com.task.domain.mail.Mail
import com.task.domain.mail.MailSender
import com.task.domain.member.MemberRepository
import com.task.domain.taskDefinition.RecurrencePattern
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.domain.tenant.TenantId
import com.task.infra.database.Database
import com.task.infra.database.jooq.tables.references.OUTBOX
import com.task.infra.database.jooq.tables.references.TASK_DEFINITIONS
import com.task.infra.database.jooq.tables.references.TASK_EXECUTIONS
import com.task.infra.event.InMemoryDomainEventDispatcher
import com.task.infra.event.handler.EmailNotificationHandler
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.outbox.OutboxRepository
import com.task.infra.outbox.OutboxRepositoryImpl
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import com.task.usecase.task.service.TaskDefinitionAuthServiceImpl
import com.task.usecase.taskDefinition.create.CreateTaskDefinitionUseCase
import com.task.usecase.taskDefinition.create.CreateTaskDefinitionUseCaseImpl
import com.task.usecase.taskDefinition.delete.DeleteTaskDefinitionUseCase
import com.task.usecase.taskDefinition.delete.DeleteTaskDefinitionUseCaseImpl
import com.task.usecase.taskDefinition.get.GetTaskDefinitionUseCase
import com.task.usecase.taskDefinition.get.GetTaskDefinitionUseCaseImpl
import com.task.usecase.taskDefinition.get.GetTaskDefinitionsUseCase
import com.task.usecase.taskDefinition.get.GetTaskDefinitionsUseCaseImpl
import com.task.usecase.taskDefinition.handler.CreateTaskExecutionOnTaskDefinitionCreatedHandler
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCase
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCaseImpl
import org.jooq.DSLContext
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate

/**
 * issue #53 の受け入れ条件を実 DB で確かめる。
 * - TaskDefinition 系 5 UseCase が tenant スコープの transaction(`withTransaction(tenantId)`)で動く
 * - tenant Aのトークンで tenant Bの定義を get / update / delete すると「見つからない」扱いになる
 * - 一覧・件数が自テナントの分だけになる
 * - 定義作成時にハンドラ経由で自動生成される TaskExecution にも作成元テナントの tenant_id が入る
 * - 削除時に outbox へ書き込まれる行にも作成元テナントの tenant_id が入る(tenant スコープの
 *   トランザクションで INSERT でき、V24 の RLS を通ることの確認を兼ねる)
 */
class TaskDefinitionUseCasesTenantTest {

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    @Test
    fun `作成した定義とハンドラ経由で自動生成されるTaskExecutionのtenant_idが作成元テナントになる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val useCases = TestUseCases()

        val created = createDefinition(useCases, tenantA.tenantId)

        val definitionTenant = owner.select(TASK_DEFINITIONS.TENANT_ID).from(TASK_DEFINITIONS)
            .where(TASK_DEFINITIONS.ID.eq(created.id.value))
            .fetchOne(TASK_DEFINITIONS.TENANT_ID)
        assertEquals(tenantA.tenantId.value, definitionTenant)

        // ハンドラ(CreateTaskExecutionOnTaskDefinitionCreatedHandler)経由で
        // 今日実行予定のTaskExecutionが1件自動生成されているはず(スケジュールは毎日実行)
        val executionTenants = owner.select(TASK_EXECUTIONS.TENANT_ID).from(TASK_EXECUTIONS)
            .where(TASK_EXECUTIONS.TASK_DEFINITION_ID.eq(created.id.value))
            .fetch(TASK_EXECUTIONS.TENANT_ID)
        assertEquals(1, executionTenants.size)
        assertEquals(tenantA.tenantId.value, executionTenants.first())
    }

    @Test
    fun `他テナントの定義をgetすると見つからずnullになる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")
        val useCases = TestUseCases()
        val definitionOfB = createDefinition(useCases, tenantB.tenantId)

        val output = useCases.getUseCase.execute(
            GetTaskDefinitionUseCase.Input(id = definitionOfB.id, tenantId = tenantA.tenantId)
        )

        assertNull(output)
    }

    @Test
    fun `他テナントの定義をupdateすると見つからずIllegalArgumentExceptionになる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")
        val useCases = TestUseCases()
        val definitionOfB = createDefinition(useCases, tenantB.tenantId)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            useCases.updateUseCase.execute(
                UpdateTaskDefinitionUseCase.Input(
                    id = definitionOfB.id,
                    tenantId = tenantA.tenantId,
                    requesterId = tenantA.memberId,
                    point = 20,
                )
            )
        }
        assertTrue(exception.message!!.contains("見つかりませんでした")) { exception.message!! }
    }

    @Test
    fun `他テナントの定義をdeleteすると見つからずIllegalArgumentExceptionになる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")
        val useCases = TestUseCases()
        val definitionOfB = createDefinition(useCases, tenantB.tenantId)

        val exception = assertThrows(IllegalArgumentException::class.java) {
            useCases.deleteUseCase.execute(
                DeleteTaskDefinitionUseCase.Input(
                    id = definitionOfB.id,
                    tenantId = tenantA.tenantId,
                    requesterId = tenantA.memberId,
                )
            )
        }
        assertTrue(exception.message!!.contains("見つかりませんでした")) { exception.message!! }
    }

    @Test
    fun `一覧と件数は自テナントの分だけになる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(owner, "鈴木家", "次郎", "jiro@example.com")
        val useCases = TestUseCases()
        val definitionOfA = createDefinition(useCases, tenantA.tenantId, name = "皿洗い")
        createDefinition(useCases, tenantB.tenantId, name = "洗濯")

        val output = useCases.getListUseCase.execute(
            GetTaskDefinitionsUseCase.Input(tenantId = tenantA.tenantId)
        )

        assertEquals(1, output.total)
        assertEquals(listOf(definitionOfA.id), output.taskDefinitions.map { it.id })
    }

    @Test
    fun `deleteでoutboxに書き込まれる行のtenant_idが削除元テナントになる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val useCases = TestUseCases()
        val definitionOfA = createDefinition(useCases, tenantA.tenantId)

        useCases.deleteUseCase.execute(
            DeleteTaskDefinitionUseCase.Input(
                id = definitionOfA.id,
                tenantId = tenantA.tenantId,
                requesterId = tenantA.memberId,
            )
        )

        val outboxTenant = owner.select(OUTBOX.TENANT_ID).from(OUTBOX)
            .where(OUTBOX.AGGREGATE_ID.eq(definitionOfA.id.value))
            .fetchOne(OUTBOX.TENANT_ID)
        assertEquals(tenantA.tenantId.value, outboxTenant)
    }

    // --- ヘルパー(このテストファイル専用。support/ 配下は変更しない) ---

    /**
     * 5 UseCase と、その依存(リポジトリ・認可サービス・ドメインイベントディスパッチャ)を
     * 手で組み立てるためのテスト用バンドル。
     *
     * [CreateTaskExecutionOnTaskDefinitionCreatedHandler] は [DomainEventDispatcher] を、
     * [InMemoryDomainEventDispatcher] はハンドラの集合を、それぞれコンストラクタで要求するため
     * 素朴には組み立てられない(循環)。本番の Guice 設定はインターフェース型の循環を
     * 動的プロキシで解決するが、テストでは手動で組み立てる必要があるため、
     * [LazyDomainEventDispatcher] を介して先にハンドラを組み立ててから実体を差し込む。
     */
    private class TestUseCases {
        val database = Database(PostgresTestDatabase.ownerDataSource, PostgresTestDatabase.appDataSource)
        val taskDefinitionRepository: TaskDefinitionRepository = TaskDefinitionRepositoryImpl()
        val taskExecutionRepository: TaskExecutionRepository = TaskExecutionRepositoryImpl()
        val outboxRepository: OutboxRepository = OutboxRepositoryImpl()
        val memberRepository: MemberRepository = MemberRepositoryImpl()
        val authorizationService = TaskDefinitionAuthServiceImpl()
        val fakeMailSender = FakeMailSender()

        private val lazyDispatcher = LazyDomainEventDispatcher()
        private val createExecutionHandler = CreateTaskExecutionOnTaskDefinitionCreatedHandler(
            taskExecutionRepository = taskExecutionRepository,
            taskDefinitionRepository = taskDefinitionRepository,
            domainEventDispatcher = lazyDispatcher,
        )
        private val emailHandler = EmailNotificationHandler(fakeMailSender, memberRepository)

        val dispatcher: DomainEventDispatcher =
            InMemoryDomainEventDispatcher(setOf<DomainEventHandler<*>>(createExecutionHandler, emailHandler))
                .also { lazyDispatcher.delegate = it }

        val createUseCase = CreateTaskDefinitionUseCaseImpl(database, taskDefinitionRepository, dispatcher)
        val updateUseCase = UpdateTaskDefinitionUseCaseImpl(database, taskDefinitionRepository, authorizationService)
        val deleteUseCase =
            DeleteTaskDefinitionUseCaseImpl(database, taskDefinitionRepository, authorizationService, outboxRepository)
        val getUseCase = GetTaskDefinitionUseCaseImpl(database, taskDefinitionRepository)
        val getListUseCase = GetTaskDefinitionsUseCaseImpl(database, taskDefinitionRepository)
    }

    /** [InMemoryDomainEventDispatcher] とハンドラの間の循環をテスト内で解決するための遅延委譲。 */
    private class LazyDomainEventDispatcher : DomainEventDispatcher {
        lateinit var delegate: DomainEventDispatcher
        override fun dispatchAll(events: List<DomainEvent>, session: DSLContext) {
            delegate.dispatchAll(events, session)
        }
    }

    /** メール送信内容を記録するだけの [MailSender]。実際には送信しない。 */
    private class FakeMailSender : MailSender {
        val sentMails = mutableListOf<Mail>()
        override fun send(mail: Mail) {
            sentMails.add(mail)
        }
    }

    private fun createDefinition(
        useCases: TestUseCases,
        tenantId: TenantId,
        name: String = "皿洗い",
    ): CreateTaskDefinitionUseCase.Output {
        return useCases.createUseCase.execute(
            CreateTaskDefinitionUseCase.Input(
                tenantId = tenantId,
                name = TaskDefinitionName(name),
                description = TaskDefinitionDescription("テスト用タスク"),
                scheduledTimeRange = testScheduledTimeRange(),
                scope = TaskScope.FAMILY,
                ownerMemberId = null,
                schedule = dailyScheduleStartingYesterday(),
                point = 10,
            )
        )
    }

    private fun testScheduledTimeRange(): ScheduledTimeRange {
        val now = Instant.now()
        return ScheduledTimeRange(startTime = now, endTime = now.plusSeconds(1800))
    }

    /** ハンドラの`today`判定(Asia/Tokyo基準)で確実に「今日実行すべき」になるスケジュール。 */
    private fun dailyScheduleStartingYesterday(): TaskSchedule {
        val today = LocalDate.now(AppTimeZone.ZONE)
        return TaskSchedule.Recurring(
            pattern = RecurrencePattern.Daily(skipWeekends = false),
            startDate = today.minusDays(1),
            endDate = null,
        )
    }
}
