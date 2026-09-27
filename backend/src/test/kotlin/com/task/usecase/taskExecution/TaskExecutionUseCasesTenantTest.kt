package com.task.usecase.taskExecution

import com.task.domain.mail.Mail
import com.task.domain.mail.MailSender
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.tenant.TenantId
import com.task.infra.database.Database
import com.task.infra.database.jooq.tables.references.MEMBERS
import com.task.infra.database.jooq.tables.references.PUSH_SUBSCRIPTIONS
import com.task.infra.event.InMemoryDomainEventDispatcher
import com.task.infra.event.handler.EmailNotificationHandler
import com.task.infra.event.handler.FamilyTaskCompletedPushNotificationHandler
import com.task.infra.event.handler.FamilyTaskStartedPushNotificationHandler
import com.task.infra.event.handler.support.FamilyTaskPushNotificationService
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.pushSubscription.PushSubscriptionRepositoryImpl
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.infra.webpush.WebPushSender
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import com.task.usecase.taskExecution.assign.UpdateAssignTaskExecutionUseCase
import com.task.usecase.taskExecution.assign.UpdateAssignTaskExecutionUseCaseImpl
import com.task.usecase.taskExecution.cancel.CancelTaskExecutionUseCase
import com.task.usecase.taskExecution.cancel.CancelTaskExecutionUseCaseImpl
import com.task.usecase.taskExecution.complete.CompleteTaskExecutionUseCase
import com.task.usecase.taskExecution.complete.CompleteTaskExecutionUseCaseImpl
import com.task.usecase.taskExecution.get.GetTaskExecutionUseCase
import com.task.usecase.taskExecution.get.GetTaskExecutionUseCaseImpl
import com.task.usecase.taskExecution.get.GetTaskExecutionsUseCase
import com.task.usecase.taskExecution.get.GetTaskExecutionsUseCaseImpl
import com.task.usecase.taskExecution.start.StartTaskExecutionUseCase
import com.task.usecase.taskExecution.start.StartTaskExecutionUseCaseImpl
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * issue #54: TaskExecution 系 7 UseCase を tenant スコープ transaction へ移行したことの確認。
 *
 * - (a) tenant A のトークン(tenantId)で tenant B の execution を get / start / complete / cancel / assign
 *       すると見つからない扱いになる(RLSにより tenant B の行が見えないため)
 * - (b) 一覧・フィルタ・件数が自テナントの分だけになる
 * - (c) start / complete の通知(メール・WebPush)が tenant A のメンバーにだけ届き、
 *       tenant B のメンバー(email・push購読)には届かない
 *       (issue #54 の「通知ハンドラの重要な性質」: EmailNotificationHandler / FamilyTaskPushNotificationService は
 *       memberRepository.findAll(session) を「家族全員」の意味で使っており、tenant スコープの session を渡すことで
 *       初めて自テナントだけに絞られる)
 */
class TaskExecutionUseCasesTenantTest {

    private val database = Database(PostgresTestDatabase.ownerDataSource, PostgresTestDatabase.appDataSource)
    private val taskExecutionRepository = TaskExecutionRepositoryImpl()
    private val taskDefinitionRepository = TaskDefinitionRepositoryImpl()
    private val memberRepository = MemberRepositoryImpl()
    private val pushSubscriptionRepository = PushSubscriptionRepositoryImpl()

    private val fakeMail = FakeMailSender()
    private val fakeWebPush = FakeWebPushSender()

    private val notificationService =
        FamilyTaskPushNotificationService(fakeWebPush, memberRepository, pushSubscriptionRepository)

    private val dispatcher = InMemoryDomainEventDispatcher(
        setOf(
            EmailNotificationHandler(fakeMail, memberRepository),
            FamilyTaskStartedPushNotificationHandler(notificationService),
            FamilyTaskCompletedPushNotificationHandler(notificationService),
        )
    )

    private val getUseCase: GetTaskExecutionUseCase =
        GetTaskExecutionUseCaseImpl(database, taskExecutionRepository)
    private val getListUseCase: GetTaskExecutionsUseCase =
        GetTaskExecutionsUseCaseImpl(database, taskExecutionRepository)
    private val startUseCase: StartTaskExecutionUseCase =
        StartTaskExecutionUseCaseImpl(database, taskExecutionRepository, taskDefinitionRepository, dispatcher)
    private val completeUseCase: CompleteTaskExecutionUseCase =
        CompleteTaskExecutionUseCaseImpl(database, taskExecutionRepository, taskDefinitionRepository, dispatcher)
    private val cancelUseCase: CancelTaskExecutionUseCase =
        CancelTaskExecutionUseCaseImpl(database, taskExecutionRepository, taskDefinitionRepository, dispatcher)
    private val assignUseCase: UpdateAssignTaskExecutionUseCase =
        UpdateAssignTaskExecutionUseCaseImpl(database, taskExecutionRepository)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    // ==================== フィクスチャ用ヘルパー ====================

    private data class TenantFixture(
        val tenantId: TenantId,
        val memberIds: List<MemberId>,
    )

    /**
     * tenantと、指定した人数分のmember、各memberのpush_subscriptionsを1行ずつ、
     * すべてowner接続(RLSバイパス)で作る。
     */
    private fun createTenantWithMembers(
        familyName: String,
        memberNamesAndEmails: List<Pair<String, String>>,
    ): TenantFixture {
        require(memberNamesAndEmails.isNotEmpty()) { "メンバーは1人以上必要" }
        val owner = PostgresTestDatabase.ownerDsl()

        val (firstName, firstEmail) = memberNamesAndEmails.first()
        val family = TestFixtures.createTenantWithMember(owner, familyName, firstName, firstEmail)
        val memberIds = mutableListOf(family.memberId)

        memberNamesAndEmails.drop(1).forEach { (name, email) ->
            val memberId = MemberId(UUID.randomUUID())
            owner.insertInto(MEMBERS)
                .set(MEMBERS.ID, memberId.value)
                .set(MEMBERS.NAME, name)
                .set(MEMBERS.ROLE, "MOTHER")
                .set(MEMBERS.PASSWORD_HASH, "dummy-password-hash")
                .set(MEMBERS.EMAIL, email)
                .set(MEMBERS.TENANT_ID, family.tenantId.value)
                .execute()
            memberIds.add(memberId)
        }

        memberIds.forEachIndexed { index, memberId ->
            owner.insertInto(PUSH_SUBSCRIPTIONS)
                .set(PUSH_SUBSCRIPTIONS.MEMBER_ID, memberId.value)
                .set(PUSH_SUBSCRIPTIONS.ENDPOINT, "https://push.example.com/$familyName-$index")
                .set(PUSH_SUBSCRIPTIONS.P256DH_KEY, "dummy-p256dh-$index")
                .set(PUSH_SUBSCRIPTIONS.AUTH_KEY, "dummy-auth-$index")
                .set(PUSH_SUBSCRIPTIONS.IS_ACTIVE, true)
                .set(PUSH_SUBSCRIPTIONS.TENANT_ID, family.tenantId.value)
                .execute()
        }

        return TenantFixture(family.tenantId, memberIds)
    }

    /** FAMILYスコープのTaskDefinitionと、NotStarted状態のTaskExecutionを1つ、tenantスコープのトランザクションで作る */
    private fun createFamilyTaskExecution(tenantId: TenantId, taskName: String): TaskExecution.NotStarted {
        val now = Instant.now()
        val definition = TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName(taskName),
            description = TaskDefinitionDescription("テスト用タスク"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            ownerMemberId = null,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.now().plusDays(1)),
            point = 10,
        )
        database.withTransaction(tenantId) { session -> taskDefinitionRepository.create(definition, session) }

        val notStarted = TaskExecution.create(definition, now).newState
        database.withTransaction(tenantId) { session -> taskExecutionRepository.create(notStarted, session) }
        return notStarted
    }

    // ==================== (a) 他テナントのexecutionは見つからない ====================

    @Test
    fun `他テナントのexecutionはget-start-complete-cancel-assignのいずれも見つからない扱いになる`() {
        val tenantA = createTenantWithMembers(
            "A家",
            listOf("太郎" to "taro-a@example.com", "花子" to "hanako-a@example.com")
        )
        val tenantB = createTenantWithMembers("B家", listOf("次郎" to "jiro-b@example.com"))

        val executionB = createFamilyTaskExecution(tenantB.tenantId, "B家のタスク")

        // get: 例外ではなくnullが返る仕様(GetTaskExecutionUseCaseImpl参照)。tenant Aからはtenant Bの行が見えない
        val getResult = getUseCase.execute(
            GetTaskExecutionUseCase.Input(tenantId = tenantA.tenantId, id = executionB.id)
        )
        assertNull(getResult)

        assertThrows(IllegalArgumentException::class.java) {
            startUseCase.execute(
                StartTaskExecutionUseCase.Input(
                    tenantId = tenantA.tenantId,
                    id = executionB.id,
                    assigneeMemberIds = listOf(tenantA.memberIds[0]),
                )
            )
        }

        assertThrows(IllegalArgumentException::class.java) {
            completeUseCase.execute(
                CompleteTaskExecutionUseCase.Input(tenantId = tenantA.tenantId, id = executionB.id)
            )
        }

        assertThrows(IllegalArgumentException::class.java) {
            cancelUseCase.execute(
                CancelTaskExecutionUseCase.Input(tenantId = tenantA.tenantId, id = executionB.id)
            )
        }

        assertThrows(IllegalArgumentException::class.java) {
            assignUseCase.execute(
                UpdateAssignTaskExecutionUseCase.Input(
                    tenantId = tenantA.tenantId,
                    id = executionB.id,
                    newAssigneeMemberIds = listOf(tenantA.memberIds[0]),
                )
            )
        }
    }

    // ==================== (b) 一覧・フィルタ・件数はテナントごとに分離される ====================

    @Test
    fun `一覧とフィルタと件数はテナントごとに分離される`() {
        val tenantA = createTenantWithMembers(
            "A家2",
            listOf("太郎2" to "taro-a2@example.com", "花子2" to "hanako-a2@example.com")
        )
        val tenantB = createTenantWithMembers("B家2", listOf("次郎2" to "jiro-b2@example.com"))

        val executionA1 = createFamilyTaskExecution(tenantA.tenantId, "A家のタスク1")
        val executionA2 = createFamilyTaskExecution(tenantA.tenantId, "A家のタスク2")
        createFamilyTaskExecution(tenantB.tenantId, "B家のタスク")

        val listOutput = getListUseCase.execute(
            GetTaskExecutionsUseCase.Input(tenantId = tenantA.tenantId, limit = 20, offset = 0)
        )
        assertEquals(2, listOutput.totalCount)
        assertEquals(setOf(executionA1.id, executionA2.id), listOutput.items.map { it.id }.toSet())

        val filteredOutput = getListUseCase.execute(
            GetTaskExecutionsUseCase.Input(
                tenantId = tenantA.tenantId,
                limit = 20,
                offset = 0,
                filter = GetTaskExecutionsUseCase.FilterSpec(status = "NOT_STARTED"),
            )
        )
        assertEquals(2, filteredOutput.totalCount)
        assertTrue(filteredOutput.items.all { it.status == "NOT_STARTED" })
    }

    // ==================== (c) start/completeの通知先は同一テナントのメンバーだけ ====================

    @Test
    fun `startとcompleteの通知先はtenant Aのメンバーだけでtenant Bのメンバーには届かない`() {
        val tenantA = createTenantWithMembers(
            "A家3",
            listOf("太郎3" to "taro-a3@example.com", "花子3" to "hanako-a3@example.com")
        )
        createTenantWithMembers("B家3", listOf("次郎3" to "jiro-b3@example.com"))

        val executionA = createFamilyTaskExecution(tenantA.tenantId, "A家の通知タスク")
        // 非担当者(花子3)のpush_subscriptions.endpoint。担当者(太郎3)はindex 0なのでindex 1が花子3
        val hanakoEndpoint = "https://push.example.com/A家3-1"

        startUseCase.execute(
            StartTaskExecutionUseCase.Input(
                tenantId = tenantA.tenantId,
                id = executionA.id,
                assigneeMemberIds = listOf(tenantA.memberIds[0]),
            )
        )

        // メール: A家の非担当者(花子3)にだけ届く。B家(次郎3)には届かない
        assertEquals(listOf("hanako-a3@example.com"), fakeMail.sentMails.map { it.to.value })
        assertFalse(fakeMail.sentMails.any { it.to.value == "jiro-b3@example.com" })

        // WebPush: A家の非担当者のendpointにだけ届く。B家のendpointには届かない
        assertEquals(listOf(hanakoEndpoint), fakeWebPush.sentInputs.map { it.pushSubscription.endpoint })

        fakeMail.sentMails.clear()
        fakeWebPush.sentInputs.clear()

        completeUseCase.execute(
            CompleteTaskExecutionUseCase.Input(tenantId = tenantA.tenantId, id = executionA.id)
        )

        assertEquals(listOf("hanako-a3@example.com"), fakeMail.sentMails.map { it.to.value })
        assertFalse(fakeMail.sentMails.any { it.to.value == "jiro-b3@example.com" })
        assertEquals(listOf(hanakoEndpoint), fakeWebPush.sentInputs.map { it.pushSubscription.endpoint })
    }

    // ==================== テスト内フェイク ====================

    /** 送信先と内容を記録するだけのMailSender */
    private class FakeMailSender : MailSender {
        val sentMails = mutableListOf<Mail>()

        override fun send(mail: Mail) {
            sentMails.add(mail)
        }
    }

    /** 送信先と内容を記録し、常にSuccessを返すWebPushSender */
    private class FakeWebPushSender : WebPushSender {
        val sentInputs = mutableListOf<WebPushSender.SendWebPushInput>()

        override fun sendWebPushToMember(input: WebPushSender.SendWebPushInput): WebPushSender.SendResult {
            sentInputs.add(input)
            return WebPushSender.SendResult.Success
        }
    }
}
