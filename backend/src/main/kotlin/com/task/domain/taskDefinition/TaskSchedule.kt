package com.task.domain.taskDefinition

import java.time.DayOfWeek
import java.time.LocalDate

sealed class TaskSchedule {
    data class Recurring(
        val pattern: RecurrencePattern,
        val startDate: LocalDate,
        val endDate: LocalDate?
    ) : TaskSchedule() {
        init {
            if (endDate != null) {
                require(startDate < endDate) {
                    "startDateはendDateより前である必要があります: $startDate >= $endDate"
                }
            }
        }
    }

    data class OneTime(
        val deadline: LocalDate
    ) : TaskSchedule()
}

sealed class RecurrencePattern {
    data class Daily(
        val skipWeekends: Boolean
    ) : RecurrencePattern()

    data class Weekly(
        val dayOfWeek: DayOfWeek
    ) : RecurrencePattern()

    data class Monthly(
        val dayOfMonth: Int
    ) : RecurrencePattern() {
        init {
            require(dayOfMonth in 1..28) {
                "dayOfMonthは1以上28以下である必要があります: $dayOfMonth"
            }
        }
    }
}

