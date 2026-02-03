package com.task.infra.query

import com.google.inject.Inject
import com.task.domain.member.MemberRepository
import com.task.domain.taskDefinition.RecurrencePattern
import com.task.domain.taskDefinition.TaskDefinition
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.usecase.query.notifications.TomorrowNotDailyTaskQueryService
import com.task.usecase.query.notifications.TomorrowNotDailyTaskQueryService.TaskDefinitionsForMember
import org.jooq.DSLContext
import java.time.LocalDate

class TomorrowNotDailyTaskQueryServiceImpl @Inject constructor(
    private val memberRepository: MemberRepository,
    private val taskDefinitionRepository: TaskDefinitionRepository
) : TomorrowNotDailyTaskQueryService {

    override fun fetchNotDailyTasksByMember(
        session: DSLContext,
        targetDate: LocalDate
    ): List<TaskDefinitionsForMember> {
        val allMembers = memberRepository.findAll(session)

        val notDailyTaskDefinitions = taskDefinitionRepository
            .findAllActiveTaskDefinition(session, targetDate)
            .filter { it.schedule.isShouldCarryOut(targetDate) }
            .filter { !isDaily(it) }

        val familyTasks = notDailyTaskDefinitions.filter { it.scope == TaskScope.FAMILY }
        val personalTasksByOwner = notDailyTaskDefinitions
            .filter { it.scope == TaskScope.PERSONAL && it.ownerMemberId != null }
            .groupBy { it.ownerMemberId!! }

        // 各メンバーに割り当て: FAMILY タスク全件 + 自分の PERSONAL タスク
        return allMembers.map { member ->
            val personalTasks = personalTasksByOwner[member.id] ?: emptyList()
            TaskDefinitionsForMember(
                memberId = member.id,
                taskDefinitions = familyTasks + personalTasks
            )
        }
    }

    /**
     * FAMILY タスクと PERSONAL タスクの分類は scope で行い、
     * Daily パターンの判定は schedule の型で行う。
     * OneTime スケジュールは Daily にはなりうえないため、
     * Recurring かつ Daily パターンの場合のみ true を返す。
     */
    private fun isDaily(definition: TaskDefinition): Boolean {
        return definition.schedule is TaskSchedule.Recurring &&
                definition.schedule.pattern is RecurrencePattern.Daily
    }
}
