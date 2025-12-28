package com.task.domain.taskDefinition

import java.time.DayOfWeek
import java.time.LocalDate

sealed class TaskSchedule {

    abstract fun isShouldCarryOut(date: LocalDate): Boolean

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
        override fun isShouldCarryOut(date: LocalDate): Boolean {
            if (date < startDate) {
                return false
            }

            if (endDate != null && date > endDate) {
                return false
            }

            return pattern.matchesDate(date)
        }
    }

    data class OneTime(
        val deadline: LocalDate
    ) : TaskSchedule() {
        override fun isShouldCarryOut(date: LocalDate): Boolean{
            return false
        }
    }
}

sealed class RecurrencePattern {
    abstract fun matchesDate(date: LocalDate): Boolean

    data class Daily(
        val skipWeekends: Boolean
    ) : RecurrencePattern() {
        override fun matchesDate(date: LocalDate): Boolean {
            if (skipWeekends) {
                val dayOfWeek = date.dayOfWeek
                return dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY
            }
            return true
        }
    }

    data class Weekly(
        val dayOfWeek: DayOfWeek
    ) : RecurrencePattern() {
        override fun matchesDate(date: LocalDate): Boolean {
            return date.dayOfWeek == dayOfWeek
        }
    }

    data class Monthly(
        val dayOfMonth: Int
    ) : RecurrencePattern() {
        init {
            require(dayOfMonth in 1..28) {
                "dayOfMonthは1以上28以下である必要があります: $dayOfMonth"
            }
        }

        override fun matchesDate(date: LocalDate): Boolean {
            return date.dayOfMonth == dayOfMonth
        }

    }
}

