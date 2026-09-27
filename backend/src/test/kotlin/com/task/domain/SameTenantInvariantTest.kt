package com.task.domain

import com.task.domain.member.FamilyRole
import com.task.domain.member.Member
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PasswordHash
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.tenant.TenantId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * issue #50: 集約間の関連付けで same-tenant をドメイン不変条件として検証する。
 *
 * RLS(Row Level Security)はDBレベルのアクセス制御であり、「関連付ける相手が同じテナントであること」
 * という意味的な整合性を保証するものではない(ADR #19 決定4)。本テストは、RLSをバイパスするような
 * 経路(バッチ、outbox処理など)や将来の変更があっても、ドメイン層の `require` によって
 * 他テナントの集約が関連付けられないことを保証していることを確かめる。
 */
class SameTenantInvariantTest {

    private fun buildMember(tenantId: TenantId, name: String = "山田太郎"): Member {
        return Member.create(
            tenantId = tenantId,
            name = MemberName(name),
            email = MemberEmail("${UUID.randomUUID()}@example.com"),
            familyRole = FamilyRole.FATHER,
            password = PasswordHash("hashed-password"),
            existingMembersName = emptyList(),
        )
    }

    private fun buildTaskDefinition(
        tenantId: TenantId,
        scope: TaskScope = TaskScope.FAMILY,
        owner: Member? = null,
    ): TaskDefinition {
        val now = Instant.now()
        return TaskDefinition.create(
            tenantId = tenantId,
            name = TaskDefinitionName("皿洗い"),
            description = TaskDefinitionDescription("夕食後に皿を洗う"),
            scheduledTimeRange = ScheduledTimeRange(startTime = now, endTime = now.plus(30, ChronoUnit.MINUTES)),
            scope = scope,
            owner = owner,
            schedule = TaskSchedule.OneTime(deadline = LocalDate.now().plusDays(1)),
            point = 10,
        )
    }

    private fun buildNotStarted(taskDefinition: TaskDefinition): TaskExecution.NotStarted {
        return TaskExecution.create(taskDefinition = taskDefinition, scheduledDate = Instant.now()).newState
    }

    // ==================== 1. TaskDefinition.create / update: owner Member ====================

    @Test
    fun `createで同じtenantのownerを指定すると成功する`() {
        val tenantId = TenantId.generate()
        val owner = buildMember(tenantId)

        val taskDefinition = buildTaskDefinition(tenantId, scope = TaskScope.PERSONAL, owner = owner)

        assertEquals(owner.id, taskDefinition.ownerMemberId)
    }

    @Test
    fun `createで別tenantのownerを指定すると例外になる`() {
        val tenantId = TenantId.generate()
        val otherTenantOwner = buildMember(TenantId.generate())

        assertThrows(IllegalArgumentException::class.java) {
            buildTaskDefinition(tenantId, scope = TaskScope.PERSONAL, owner = otherTenantOwner)
        }
    }

    @Test
    fun `updateで同じtenantのownerを指定すると成功する`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId, scope = TaskScope.FAMILY, owner = null)
        val newOwner = buildMember(tenantId)

        val updated = taskDefinition.update(
            id = taskDefinition.id,
            name = null,
            description = null,
            scheduledTimeRange = null,
            scope = TaskScope.PERSONAL,
            owner = newOwner,
            schedule = null,
            point = null,
        )

        assertEquals(newOwner.id, updated.ownerMemberId)
    }

    @Test
    fun `updateで別tenantのownerを指定すると例外になる`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId, scope = TaskScope.FAMILY, owner = null)
        val otherTenantOwner = buildMember(TenantId.generate())

        assertThrows(IllegalArgumentException::class.java) {
            taskDefinition.update(
                id = taskDefinition.id,
                name = null,
                description = null,
                scheduledTimeRange = null,
                scope = TaskScope.PERSONAL,
                owner = otherTenantOwner,
                schedule = null,
                point = null,
            )
        }
    }

    // ==================== 2. TaskExecution.create: 構造的に保証済み(#47) ====================

    @Test
    fun `createは親のTaskDefinitionのtenantIdをそのまま引き継ぐ`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)

        val notStarted = buildNotStarted(taskDefinition)

        assertEquals(taskDefinition.tenantId, notStarted.tenantId)
    }

    // ==================== 3. NotStarted.start: assignee Members / taskDefinition ====================

    @Test
    fun `startで同じtenantのassigneeとtaskDefinitionを指定すると成功する`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val assignee = buildMember(tenantId)

        val inProgress = notStarted.start(assignees = listOf(assignee), taskDefinition = taskDefinition).newState

        assertEquals(listOf(assignee.id), inProgress.assigneeMemberIds)
    }

    @Test
    fun `startで別tenantのassigneeを指定すると例外になる`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val otherTenantAssignee = buildMember(TenantId.generate())

        assertThrows(IllegalArgumentException::class.java) {
            notStarted.start(assignees = listOf(otherTenantAssignee), taskDefinition = taskDefinition)
        }
    }

    @Test
    fun `startで別tenantのtaskDefinitionを指定すると例外になる`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val otherTenantDefinition = buildTaskDefinition(TenantId.generate())
        val assignee = buildMember(tenantId)

        assertThrows(IllegalArgumentException::class.java) {
            notStarted.start(assignees = listOf(assignee), taskDefinition = otherTenantDefinition)
        }
    }

    // ==================== 4. NotStarted.cancel(taskDefinition) ====================

    @Test
    fun `NotStartedのcancelで同じtenantのtaskDefinitionを指定すると成功する`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)

        val cancelled = notStarted.cancel(taskDefinition).newState

        assertEquals(tenantId, cancelled.tenantId)
    }

    @Test
    fun `NotStartedのcancelで別tenantのtaskDefinitionを指定すると例外になる`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val otherTenantDefinition = buildTaskDefinition(TenantId.generate())

        assertThrows(IllegalArgumentException::class.java) {
            notStarted.cancel(otherTenantDefinition)
        }
    }

    // ==================== 5. InProgress.complete / InProgress.cancel ====================

    @Test
    fun `InProgressのcompleteで同じtenantのtaskDefinitionを指定すると成功する`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val inProgress = notStarted.start(assignees = listOf(buildMember(tenantId)), taskDefinition = taskDefinition).newState

        val completed = inProgress.complete(taskDefinition).newState

        assertEquals(tenantId, completed.tenantId)
    }

    @Test
    fun `InProgressのcompleteで別tenantのtaskDefinitionを指定すると例外になる`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val inProgress = notStarted.start(assignees = listOf(buildMember(tenantId)), taskDefinition = taskDefinition).newState
        val otherTenantDefinition = buildTaskDefinition(TenantId.generate())

        assertThrows(IllegalArgumentException::class.java) {
            inProgress.complete(otherTenantDefinition)
        }
    }

    @Test
    fun `InProgressのcancelで同じtenantのtaskDefinitionを指定すると成功する`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val inProgress = notStarted.start(assignees = listOf(buildMember(tenantId)), taskDefinition = taskDefinition).newState

        val cancelled = inProgress.cancel(taskDefinition).newState

        assertEquals(tenantId, cancelled.tenantId)
    }

    @Test
    fun `InProgressのcancelで別tenantのtaskDefinitionを指定すると例外になる`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val inProgress = notStarted.start(assignees = listOf(buildMember(tenantId)), taskDefinition = taskDefinition).newState
        val otherTenantDefinition = buildTaskDefinition(TenantId.generate())

        assertThrows(IllegalArgumentException::class.java) {
            inProgress.cancel(otherTenantDefinition)
        }
    }

    // ==================== 6. 担当者変更: TaskExecution.requireSameTenant ====================

    @Test
    fun `requireSameTenantで同じtenantのmembersを指定すると成功する`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val members = listOf(buildMember(tenantId), buildMember(tenantId))

        // 例外が発生しないことを確認する
        notStarted.requireSameTenant(members)
    }

    @Test
    fun `requireSameTenantで別tenantのmembersが1人でも含まれると例外になる`() {
        val tenantId = TenantId.generate()
        val taskDefinition = buildTaskDefinition(tenantId)
        val notStarted = buildNotStarted(taskDefinition)
        val members = listOf(buildMember(tenantId), buildMember(TenantId.generate()))

        assertThrows(IllegalArgumentException::class.java) {
            notStarted.requireSameTenant(members)
        }
    }
}
