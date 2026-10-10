package com.task.usecase.task

import com.task.domain.AppTimeZone
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.RecurrencePattern
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.tenant.TenantId
import com.task.infra.database.Database
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.jooq.tables.references.PUSH_SUBSCRIPTIONS
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.pushSubscription.PushSubscription
import com.task.infra.pushSubscription.PushSubscriptionRepositoryImpl
import com.task.infra.query.NotificationTargetQueryServiceImpl
import com.task.infra.query.TomorrowNotDailyTaskQueryServiceImpl
import com.task.infra.query.UpcomingNotDailyTaskQueryServiceImpl
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.infra.tenant.TenantRepositoryImpl
import com.task.infra.webpush.WebPushSender
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import com.task.usecase.batch.TenantBatchRunner
import com.zaxxer.hikari.HikariDataSource
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/**
 * #58 #59 #60 の受け入れ条件を実 DB(RLS あり)で確かめる。スケジューラと同じく TenantBatchRunner で全テナントを回す。
 * - tenant A のタスクが tenant B のメンバーに通知されない(2 テナントのデータ)
 * - Web Push 送信がトランザクションの外で行われる(アプリ用プールを 1 本にし、送信中に別のトランザクションを開けることで確認)
 * - 1 テナントの送信失敗が他テナントの通知を止めない
 * - 期限切れ購読の無効化が引き続き動く
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class NotificationBatchesTenantTest {

    /** 接続 1 本のアプリ用プール。送信がトランザクションの中だと、送信中の withTransaction が接続を取れずに失敗する */
    private val singleAppDataSource: HikariDataSource = PostgresTestDatabase.createAppDataSource(1)
    private val database = Database(PostgresTestDatabase.ownerDataSource, singleAppDataSource)

    private val memberRepository = MemberRepositoryImpl()
    private val taskDefinitionRepository = TaskDefinitionRepositoryImpl()
    private val taskExecutionRepository = TaskExecutionRepositoryImpl()
    private val pushRepository = PushSubscriptionRepositoryImpl()
    private val fakeWebPush = FakeWebPushSender(database)
    private val delivery = TenantPushNotificationDelivery(database, pushRepository, fakeWebPush)
    private val tenantBatchRunner = TenantBatchRunner(DatabaseWithoutRLS(PostgresTestDatabase.ownerDataSource), TenantRepositoryImpl())

    private val dailyUseCase = SendDailyNotCompletedTaskNotificationsUseCaseImpl(
        database, NotificationTargetQueryServiceImpl(), pushRepository, delivery,
    )
    private val reminderUseCase = SendNotDailyTaskRemindersUseCaseImpl(
        database, UpcomingNotDailyTaskQueryServiceImpl(memberRepository), pushRepository, delivery,
    )
    private val tomorrowUseCase = SendNotDailyTomorrowTaskNotificationsUseCaseImpl(
        database, TomorrowNotDailyTaskQueryServiceImpl(memberRepository, taskDefinitionRepository),
        taskExecutionRepository, pushRepository, delivery,
    )

    private val today: LocalDate = LocalDate.now(AppTimeZone.ZONE)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
        fakeWebPush.reset()
    }

    @AfterAll
    fun closePool() {
        singleAppDataSource.close()
    }

    // ---- データの用意(すべて tenant スコープのトランザクション = RLS の WITH CHECK あり) ----

    private data class Family(val tenantId: TenantId, val memberId: MemberId, val subscriptionId: UUID)

    private fun createFamily(familyName: String, memberName: String, email: String): Family {
        val fixture = TestFixtures.createTenantWithMember(PostgresTestDatabase.ownerDsl(), familyName, memberName, email)
        val subscription = PushSubscription(
            id = UUID.randomUUID(),
            tenantId = fixture.tenantId,
            memberId = fixture.memberId,
            endpoint = "https://push.example.com/$email",
            p256dhKey = "p256dh",
            authKey = "auth",
            expirationTime = null,
            userAgent = null,
            isActive = true,
        )
        PostgresTestDatabase.inTenantTransaction(fixture.tenantId) { pushRepository.save(subscription, it) }
        return Family(fixture.tenantId, fixture.memberId, subscription.id)
    }

    private fun createDefinition(family: Family, name: String, schedule: TaskSchedule, start: Instant): TaskDefinition {
        val definition = TaskDefinition.create(
            tenantId = family.tenantId,
            name = TaskDefinitionName(name),
            description = TaskDefinitionDescription("通知テスト"),
            scheduledTimeRange = ScheduledTimeRange(startTime = start, endTime = start.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            owner = null,
            schedule = schedule,
            point = 5,
        )
        PostgresTestDatabase.inTenantTransaction(family.tenantId) { taskDefinitionRepository.create(definition, it) }
        return definition
    }

    private fun createExecution(family: Family, definition: TaskDefinition, scheduled: Instant) {
        val execution = TaskExecution.create(definition, scheduled).newState
        PostgresTestDatabase.inTenantTransaction(family.tenantId) { taskExecutionRepository.create(execution, it) }
    }

    /** 毎日の FAMILY タスクと、今日の NOT_STARTED の実行(#58 の通知対象) */
    private fun createDailyTaskForToday(family: Family, name: String) {
        val now = Instant.now()
        val definition = createDefinition(
            family, name,
            TaskSchedule.Recurring(RecurrencePattern.Daily(skipWeekends = false), startDate = today.minusDays(1), endDate = null),
            now,
        )
        createExecution(family, definition, now)
    }

    private fun isActive(subscriptionId: UUID): Boolean =
        PostgresTestDatabase.ownerDsl().select(PUSH_SUBSCRIPTIONS.IS_ACTIVE).from(PUSH_SUBSCRIPTIONS)
            .where(PUSH_SUBSCRIPTIONS.ID.eq(subscriptionId)).fetchOne(PUSH_SUBSCRIPTIONS.IS_ACTIVE)!!

    // ---- #58 毎日タスクの未完了通知 ----

    @Test
    fun `#58 各家族のメンバーには自分の家族の未完了タスクだけが通知され、送信はトランザクションの外で行われる`() {
        val familyA = createFamily("山田家", "太郎", "taro@example.com")
        val familyB = createFamily("鈴木家", "次郎", "jiro@example.com")
        createDailyTaskForToday(familyA, "A家の皿洗い")
        createDailyTaskForToday(familyB, "B家の洗濯")

        val summary = tenantBatchRunner.forEachActiveTenant("daily notification") { tenantId ->
            dailyUseCase.execute(SendDailyNotCompletedTaskNotificationsUseCase.Input(tenantId, today))
        }

        assertEquals(2, summary.successCount)
        assertTrue(summary.results.values.all { it.getOrNull() == SendDailyNotCompletedTaskNotificationsUseCase.ExecutionResult.Success }) {
            "送信中にトランザクションを開けなかった(= 送信がトランザクションの中)可能性: ${summary.results}"
        }
        assertEquals(mapOf(familyA.memberId to "・A家の皿洗い", familyB.memberId to "・B家の洗濯"), fakeWebPush.bodiesByMember())
    }

    @Test
    fun `#58 ある家族への送信が失敗しても他の家族には届き、期限切れの購読はその家族の分だけ無効化される`() {
        val familyA = createFamily("山田家", "太郎", "taro@example.com")
        val familyB = createFamily("鈴木家", "次郎", "jiro@example.com")
        val familyC = createFamily("田中家", "三郎", "saburo@example.com")
        createDailyTaskForToday(familyA, "A家の皿洗い")
        createDailyTaskForToday(familyB, "B家の洗濯")
        createDailyTaskForToday(familyC, "C家の掃除")
        fakeWebPush.throwFor += familyA.memberId
        fakeWebPush.expiredFor += familyB.memberId

        val summary = tenantBatchRunner.forEachActiveTenant("daily notification") { tenantId ->
            dailyUseCase.execute(SendDailyNotCompletedTaskNotificationsUseCase.Input(tenantId, today))
        }

        val resultOfC = summary.results[familyC.tenantId]!!.getOrThrow()
        assertEquals(SendDailyNotCompletedTaskNotificationsUseCase.ExecutionResult.Success, resultOfC)
        assertEquals("・C家の掃除", fakeWebPush.bodiesByMember()[familyC.memberId])
        val resultOfA = summary.results[familyA.tenantId]!!.getOrThrow()
        assertTrue(resultOfA is SendDailyNotCompletedTaskNotificationsUseCase.ExecutionResult.Failed) { "$resultOfA" }
        // 期限切れは B の購読だけが無効化される
        assertEquals(false, isActive(familyB.subscriptionId))
        assertEquals(true, isActive(familyA.subscriptionId))
        assertEquals(true, isActive(familyC.subscriptionId))
    }

    // ---- #59 非毎日タスクのリマインダー ----

    @Test
    fun `#59 約1時間後に始まる単発タスクのリマインダーは自分の家族のメンバーにだけ届く`() {
        val familyA = createFamily("山田家", "太郎", "taro@example.com")
        val familyB = createFamily("鈴木家", "次郎", "jiro@example.com")
        val now = Instant.now()
        val start = now.plus(60, ChronoUnit.MINUTES)
        val startDate = start.atZone(AppTimeZone.ZONE).toLocalDate()
        val definitionA = createDefinition(familyA, "A家のゴミ出し", TaskSchedule.OneTime(deadline = startDate), start)
        createExecution(familyA, definitionA, start)
        val definitionB = createDefinition(familyB, "B家の買い物", TaskSchedule.OneTime(deadline = startDate), start)
        createExecution(familyB, definitionB, start)

        val summary = tenantBatchRunner.forEachActiveTenant("not-daily task reminder") { tenantId ->
            reminderUseCase.execute(SendNotDailyTaskRemindersUseCase.Input(tenantId, now))
        }

        assertTrue(summary.results.values.all { it.getOrNull() == SendNotDailyTaskRemindersUseCase.ExecutionResult.Success }) {
            "${summary.results}"
        }
        assertEquals(mapOf(familyA.memberId to "・A家のゴミ出し", familyB.memberId to "・B家の買い物"), fakeWebPush.bodiesByMember())
    }

    // ---- #60 翌日の非毎日タスク ----

    @Test
    fun `#60 明日が期限の単発タスクの通知は自分の家族のメンバーにだけ届く`() {
        val familyA = createFamily("山田家", "太郎", "taro@example.com")
        val familyB = createFamily("鈴木家", "次郎", "jiro@example.com")
        val tomorrow = today.plusDays(1)
        val start = tomorrow.atTime(10, 0).atZone(AppTimeZone.ZONE).toInstant()
        createDefinition(familyA, "A家の粗大ごみ", TaskSchedule.OneTime(deadline = tomorrow), start)
        createDefinition(familyB, "B家の通院", TaskSchedule.OneTime(deadline = tomorrow), start)

        val summary = tenantBatchRunner.forEachActiveTenant("Tomorrow Task Notification") { tenantId ->
            tomorrowUseCase.execute(SendNotDailyTomorrowTaskNotificationsUseCase.Input(tenantId, today))
        }

        assertTrue(summary.results.values.all { it.getOrNull() == SendNotDailyTomorrowTaskNotificationsUseCase.ExecutionResult.Success }) {
            "${summary.results}"
        }
        assertEquals(mapOf(familyA.memberId to "・A家の粗大ごみ", familyB.memberId to "・B家の通院"), fakeWebPush.bodiesByMember())
    }

    /**
     * 送信内容を記録する WebPushSender。送信のたびに、購読のテナントで短いトランザクションを開く
     * (アプリ用プールは 1 本なので、呼び出し側がトランザクションを開いたまま送信していると接続が取れずに失敗する)。
     */
    private class FakeWebPushSender(private val database: Database) : WebPushSender {
        val sent = CopyOnWriteArrayList<WebPushSender.SendWebPushInput>()
        val throwFor = mutableSetOf<MemberId>()
        val expiredFor = mutableSetOf<MemberId>()

        fun reset() {
            sent.clear(); throwFor.clear(); expiredFor.clear()
        }

        fun bodiesByMember(): Map<MemberId, String> = sent.associate { it.pushSubscription.memberId to it.body }

        override fun sendWebPushToMember(input: WebPushSender.SendWebPushInput): WebPushSender.SendResult {
            database.withTransaction(input.pushSubscription.tenantId) { it.selectOne().fetch() }
            val memberId = input.pushSubscription.memberId
            if (memberId in throwFor) throw IllegalStateException("送信先がタイムアウトしました(テスト)")
            sent.add(input)
            return if (memberId in expiredFor) WebPushSender.SendResult.SubscriptionExpired else WebPushSender.SendResult.Success
        }
    }
}
