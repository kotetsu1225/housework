package com.task.domain.taskExecution

import com.task.domain.taskExecution.event.TaskExecutionEvent

data class StateChange<out T : TaskExecution>(
    val newState: T,
    val event: TaskExecutionEvent,
)
