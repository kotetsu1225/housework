package com.task.usecase.taskExecution.create

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.taskExecution.TaskExecution
import com.task.domain.taskExecution.TaskExecutionRepository
import com.task.infra.database.Database

@Singleton
class CreateTaskExecutionUseCaseImpl @Inject constructor(
    private val database: Database,
    private val taskExecutionRepository: TaskExecutionRepository
) : CreateTaskExecutionUseCase {

    override fun execute(input: CreateTaskExecutionUseCase.Input): CreateTaskExecutionUseCase.Output {
       
    }
}
