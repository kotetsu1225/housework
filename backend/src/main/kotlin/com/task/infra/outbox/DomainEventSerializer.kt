package com.task.infra.outbox

import com.task.domain.event.DomainEvent
import com.task.domain.member.MemberId
import com.task.domain.taskDefinition.RecurrencePattern
import com.task.domain.taskDefinition.ScheduledTimeRange
import com.task.domain.taskDefinition.TaskDefinitionDescription
import com.task.domain.taskDefinition.TaskDefinitionId
import com.task.domain.taskDefinition.TaskDefinitionName
import com.task.domain.taskDefinition.TaskSchedule
import com.task.domain.taskDefinition.TaskScope
import com.task.domain.taskDefinition.event.TaskDefinitionDeleted
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

object DomainEventSerializer {

    private val json = Json {
        prettyPrint = false
        ignoreUnknownKeys = true
    }

    fun serialize(event: TaskDefinitionDeleted): String {
        val dto = TaskDefinitionDeletedDto.fromDomain(event)
        return json.encodeToString(dto)
    }

    fun deserializeTaskDefinitionDeleted(jsonString: String): TaskDefinitionDeleted {
        val dto = json.decodeFromString<TaskDefinitionDeletedDto>(jsonString)
        return dto.toDomain()
    }

    fun getEventType(event: DomainEvent): String {
        return event::class.simpleName ?: "UnknownEvent"
    }

    fun extractEventId(jsonString: String): UUID {
        val jsonElement = json.parseToJsonElement(jsonString)
        val eventIdStr = jsonElement.jsonObject["eventId"]?.toString()?.trim('"')
            ?: throw IllegalArgumentException("eventId not found in payload")
        return UUID.fromString(eventIdStr)
    }
}

@Serializable
data class TaskDefinitionDeletedDto(
    val eventId: String,
    val taskDefinitionId: String,
    val name: String,
    val description: String,
    val scheduledStartTime: String,
    val scheduledEndTime: String,
    val scope: String,
    val ownerMemberId: String?,
    val scheduleType: String,
    val oneTimeDeadline: String?,
    val recurringPatternType: String?,
    val recurringStartDate: String?,
    val recurringEndDate: String?,
    val dailySkipWeekends: Boolean?,
    val weeklyDayOfWeek: Int?,
    val monthlyDayOfMonth: Int?,
    val occurredAt: String
) {
    companion object {
        fun fromDomain(event: TaskDefinitionDeleted): TaskDefinitionDeletedDto {
            val (scheduleType, oneTimeDeadline, recurringPatternType, recurringStartDate,
                recurringEndDate, dailySkipWeekends, weeklyDayOfWeek, monthlyDayOfMonth) =
                when (val schedule = event.schedule) {
                    is TaskSchedule.OneTime -> ScheduleSerializationResult(
                        scheduleType = "ONE_TIME",
                        oneTimeDeadline = schedule.deadline.toString(),
                        recurringPatternType = null,
                        recurringStartDate = null,
                        recurringEndDate = null,
                        dailySkipWeekends = null,
                        weeklyDayOfWeek = null,
                        monthlyDayOfMonth = null
                    )
                    is TaskSchedule.Recurring -> {
                        val (patternType, skipWeekends, dayOfWeek, dayOfMonth) =
                            when (val pattern = schedule.pattern) {
                                is RecurrencePattern.Daily -> PatternSerializationResult(
                                    patternType = "DAILY",
                                    skipWeekends = pattern.skipWeekends,
                                    dayOfWeek = null,
                                    dayOfMonth = null
                                )
                                is RecurrencePattern.Weekly -> PatternSerializationResult(
                                    patternType = "WEEKLY",
                                    skipWeekends = null,
                                    dayOfWeek = pattern.dayOfWeek.value,
                                    dayOfMonth = null
                                )
                                is RecurrencePattern.Monthly -> PatternSerializationResult(
                                    patternType = "MONTHLY",
                                    skipWeekends = null,
                                    dayOfWeek = null,
                                    dayOfMonth = pattern.dayOfMonth
                                )
                            }
                        ScheduleSerializationResult(
                            scheduleType = "RECURRING",
                            oneTimeDeadline = null,
                            recurringPatternType = patternType,
                            recurringStartDate = schedule.startDate.toString(),
                            recurringEndDate = schedule.endDate?.toString(),
                            dailySkipWeekends = skipWeekends,
                            weeklyDayOfWeek = dayOfWeek,
                            monthlyDayOfMonth = dayOfMonth
                        )
                    }
                }

            return TaskDefinitionDeletedDto(
                eventId = UUID.randomUUID().toString(),
                taskDefinitionId = event.taskDefinitionId.value.toString(),
                name = event.name.value,
                description = event.description.value,
                scheduledStartTime = event.scheduledTimeRange.startTime.toString(),
                scheduledEndTime = event.scheduledTimeRange.endTime.toString(),
                scope = event.scope.name,
                ownerMemberId = event.ownerMemberId?.value?.toString(),
                scheduleType = scheduleType,
                oneTimeDeadline = oneTimeDeadline,
                recurringPatternType = recurringPatternType,
                recurringStartDate = recurringStartDate,
                recurringEndDate = recurringEndDate,
                dailySkipWeekends = dailySkipWeekends,
                weeklyDayOfWeek = weeklyDayOfWeek,
                monthlyDayOfMonth = monthlyDayOfMonth,
                occurredAt = event.occurredAt.toString()
            )
        }
    }

    fun toDomain(): TaskDefinitionDeleted {
        val schedule = when (scheduleType) {
            "ONE_TIME" -> TaskSchedule.OneTime(
                deadline = LocalDate.parse(oneTimeDeadline!!)
            )
            "RECURRING" -> {
                val pattern = when (recurringPatternType) {
                    "DAILY" -> RecurrencePattern.Daily(skipWeekends = dailySkipWeekends!!)
                    "WEEKLY" -> RecurrencePattern.Weekly(dayOfWeek = DayOfWeek.of(weeklyDayOfWeek!!))
                    "MONTHLY" -> RecurrencePattern.Monthly(dayOfMonth = monthlyDayOfMonth!!)
                    else -> throw IllegalArgumentException("Unknown pattern type: $recurringPatternType")
                }
                TaskSchedule.Recurring(
                    pattern = pattern,
                    startDate = LocalDate.parse(recurringStartDate!!),
                    endDate = recurringEndDate?.let { LocalDate.parse(it) }
                )
            }
            else -> throw IllegalArgumentException("Unknown schedule type: $scheduleType")
        }

        return TaskDefinitionDeleted(
            taskDefinitionId = TaskDefinitionId.from(taskDefinitionId),
            name = TaskDefinitionName(name),
            description = TaskDefinitionDescription(description),
            scheduledTimeRange = ScheduledTimeRange(
                startTime = Instant.parse(scheduledStartTime),
                endTime = Instant.parse(scheduledEndTime)
            ),
            scope = TaskScope.get(scope),
            ownerMemberId = ownerMemberId?.let { MemberId.from(it) },
            schedule = schedule,
            occurredAt = Instant.parse(occurredAt)
        )
    }
}

private data class ScheduleSerializationResult(
    val scheduleType: String,
    val oneTimeDeadline: String?,
    val recurringPatternType: String?,
    val recurringStartDate: String?,
    val recurringEndDate: String?,
    val dailySkipWeekends: Boolean?,
    val weeklyDayOfWeek: Int?,
    val monthlyDayOfMonth: Int?
)

private data class PatternSerializationResult(
    val patternType: String,
    val skipWeekends: Boolean?,
    val dayOfWeek: Int?,
    val dayOfMonth: Int?
)
