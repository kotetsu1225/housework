package com.task.usecase.query

import com.task.domain.AppTimeZone
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
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.query.CompletedTaskQueryServiceImpl
import com.task.infra.query.DashboardQueryServiceImpl
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
import com.task.infra.taskExecution.TaskExecutionRepositoryImpl
import com.task.support.PostgresTestDatabase
import com.task.support.TestFixtures
import com.task.usecase.execution.GetCompletedTasksUseCase
import com.task.usecase.execution.GetCompletedTasksUseCaseImpl
import com.task.usecase.query.dashboard.DashboardQueryService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * issue #55: Dashboard / CompletedTasks のクエリ系を tenant スコープ transaction へ移行したことで、
 * RLS により自テナントの分だけに絞られることを実DBで確認する。
 *
 * [DashboardQueryServiceImpl] / [GetCompletedTasksUseCaseImpl] は本来Guiceで組み立てるが、
 * このテストでは #40 と同じ方式(手組み立て)でtenantスコープの検証に専念する。
 */
class QueryTenantScopeTest {

    private val database = Database(PostgresTestDatabase.ownerDataSource, PostgresTestDatabase.appDataSource)
    private val definitionRepository = TaskDefinitionRepositoryImpl()
    private val executionRepository = TaskExecutionRepositoryImpl()
    private val memberRepository = MemberRepositoryImpl()
    private val dashboardQueryService = DashboardQueryServiceImpl(database)
    private val completedTaskQueryService = CompletedTaskQueryServiceImpl()
    private val getCompletedTasksUseCase = GetCompletedTasksUseCaseImpl(database, completedTaskQueryService)

    @AfterEach
    fun cleanup() {
        PostgresTestDatabase.truncateAll()
    }

    /**
     * 指定テナントに、今日期限のFAMILYスコープ単発タスク定義を1件作り、
     * 実行を作成 -> 開始 -> 完了まで進める(すべてtenantスコープのトランザクションで)。
     */
    private fun createCompletedFamilyTaskToday(
        tenantId: TenantId,
        memberId: MemberId,
    ): TaskExecution.Completed {
        val today = LocalDate.now(AppTimeZone.ZONE)
        val now = Instant.now()

        val definition = TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName("掃除機がけ"),
            description = TaskDefinitionDescription("リビングの掃除機がけ"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = TaskScope.FAMILY,
            owner = null,
            schedule = TaskSchedule.OneTime(deadline = today),
            point = 10,
        )
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> definitionRepository.create(definition, session) }

        val notStarted = TaskExecution.create(definition, now).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> executionRepository.create(notStarted, session) }

        val member = PostgresTestDatabase.inTenantTransaction(tenantId) { session -> memberRepository.findById(memberId, session) }
            ?: throw IllegalStateException("テストフィクスチャのメンバーが見つかりません: $memberId")
        val inProgress = notStarted.start(listOf(member), definition).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> executionRepository.update(inProgress, session) }

        val completed = inProgress.complete(definition).newState
        PostgresTestDatabase.inTenantTransaction(tenantId) { session -> executionRepository.update(completed, session) }

        return completed
    }

    @Test
    fun `ダッシュボードは自テナントの今日のタスクとメンバーサマリだけを返す`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(owner, "鈴木家", "花子", "hanako@example.com")

        val completedA = createCompletedFamilyTaskToday(tenantA.tenantId, tenantA.memberId)
        val completedB = createCompletedFamilyTaskToday(tenantB.tenantId, tenantB.memberId)

        val output = dashboardQueryService.fetchDashboardData(
            DashboardQueryService.Input(
                targetDate = LocalDate.now(AppTimeZone.ZONE),
                tenantId = tenantA.tenantId,
            )
        )

        // 今日のタスク一覧: Aの実行だけが含まれ、Bの実行は含まれない
        val todayTaskIds = output.todayTasks.map { it.taskExecutionId }
        assertTrue(todayTaskIds.contains(completedA.id.value.toString())) { "Aの実行が今日のタスクに含まれていない" }
        assertFalse(todayTaskIds.contains(completedB.id.value.toString())) { "Bの実行が今日のタスクに紛れ込んでいる" }

        // メンバーサマリ: Aのメンバーだけが含まれ、Bのメンバーは含まれない
        val summaryMemberIds = output.memberSummaries.map { it.memberId }
        assertTrue(summaryMemberIds.contains(tenantA.memberId.value.toString())) { "Aのメンバーがサマリに含まれていない" }
        assertFalse(summaryMemberIds.contains(tenantB.memberId.value.toString())) { "Bのメンバーがサマリに紛れ込んでいる" }

        // Aのメンバーサマリ内のタスク一覧にもBの実行が紛れ込んでいないこと
        val aSummaryTaskIds = output.memberSummaries
            .first { it.memberId == tenantA.memberId.value.toString() }
            .tasks.map { it.taskExecutionId }
        assertFalse(aSummaryTaskIds.contains(completedB.id.value.toString())) { "Aのメンバーサマリのタスクにbの実行が紛れ込んでいる" }
    }

    @Test
    fun `完了タスク一覧は自テナントの分だけになり、他テナントのmemberIdを指定すると0件になる`() {
        val owner = PostgresTestDatabase.ownerDsl()
        val tenantA = TestFixtures.createTenantWithMember(owner, "山田家", "太郎", "taro@example.com")
        val tenantB = TestFixtures.createTenantWithMember(owner, "鈴木家", "花子", "hanako@example.com")

        val completedA = createCompletedFamilyTaskToday(tenantA.tenantId, tenantA.memberId)
        val completedB = createCompletedFamilyTaskToday(tenantB.tenantId, tenantB.memberId)

        // (a) tenantAでフィルタなし取得 -> Aの分だけ
        val outputAll = getCompletedTasksUseCase.execute(
            GetCompletedTasksUseCase.Input(tenantId = tenantA.tenantId)
        )
        val allTaskIds = outputAll.completedTasks.map { it.taskExecutionId }
        assertTrue(allTaskIds.contains(completedA.id.value.toString())) { "Aの完了タスクが一覧に含まれていない" }
        assertFalse(allTaskIds.contains(completedB.id.value.toString())) { "Bの完了タスクが一覧に紛れ込んでいる" }

        // (b) tenantAのスコープのまま、memberIdsにBのmemberIdを指定 -> RLSにより0件
        val outputFilteredByOtherTenantMember = getCompletedTasksUseCase.execute(
            GetCompletedTasksUseCase.Input(
                tenantId = tenantA.tenantId,
                memberIds = listOf(tenantB.memberId.value.toString()),
            )
        )
        assertEquals(0, outputFilteredByOtherTenantMember.completedTasks.size)
    }
}
