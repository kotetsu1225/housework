package com.task.usecase.auth

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.MemberRepository
import com.task.domain.member.PasswordHasher
import com.task.infra.database.Database
import com.task.infra.security.JwtService

@Singleton
class LoginUseCaseImpl @Inject internal constructor(
    private val database: Database,
    private val memberRepository: MemberRepository,
    private val passwordHasher: PasswordHasher,
    private val jwtService: JwtService,
) : LoginUseCase {
    override fun execute(input: LoginUseCase.Input): LoginUseCase.Output {
        val member = database.withTransaction { session ->
            memberRepository.findByName(input.name, session)
        }?: throw IllegalArgumentException("Cannot find member with name ${input.name}")

        val isValid = passwordHasher.verify(input.password, member.password)
        if (!isValid) {
            throw IllegalArgumentException("Passwords do not match")
        }

        val token = jwtService.generateToken(member)

        return LoginUseCase.Output(
            token = token,
            memberName = member.name,
        )
    }
}