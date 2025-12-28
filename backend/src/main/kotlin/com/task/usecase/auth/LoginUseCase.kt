package com.task.usecase.auth

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword

@ImplementedBy(LoginUseCaseImpl::class)
interface LoginUseCase {
    data class Input(
        val name: MemberName,
        val password: PlainPassword,
    )

    data class Output(
        val token: String,
        val memberName: MemberName,
    )

    fun execute(input: Input): Output
}