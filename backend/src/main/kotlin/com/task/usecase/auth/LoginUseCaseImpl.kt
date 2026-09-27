package com.task.usecase.auth

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.MemberRepository
import com.task.domain.member.PasswordHasher
import com.task.domain.tenant.TenantRepository
import com.task.domain.tenant.TenantStatus
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.security.JwtService

@Singleton
class LoginUseCaseImpl @Inject internal constructor(
    private val databaseWithoutRLS: DatabaseWithoutRLS,
    private val memberRepository: MemberRepository,
    private val tenantRepository: TenantRepository,
    private val passwordHasher: PasswordHasher,
    private val jwtService: JwtService,
) : LoginUseCase {

    override fun execute(input: LoginUseCase.Input): LoginUseCase.Output {
        // ログインは tenant が確定する前の処理であり、email はテナントをまたいで
        // グローバルに一意(members_email_key)なので、RLS をバイパスして全テナントから
        // 対象メンバーを探す必要がある(#21、handoff §4 の許可リスト「ログイン(#43)」)。
        val member = databaseWithoutRLS.withTransaction { session ->
            val member = memberRepository.findByEmail(input.email, session)
                ?: throw IllegalArgumentException(LoginUseCase.INVALID_CREDENTIALS_MESSAGE)

            val isValid = passwordHasher.verify(input.password, member.password)
            if (!isValid) {
                throw IllegalArgumentException(LoginUseCase.INVALID_CREDENTIALS_MESSAGE)
            }

            // tenant が削除済み(DELETED)の場合もログインさせない(tenants.status の意味を守る)。
            val tenant = tenantRepository.findById(member.tenantId, session)
            if (tenant == null || tenant.status != TenantStatus.ACTIVE) {
                throw IllegalArgumentException(LoginUseCase.INVALID_CREDENTIALS_MESSAGE)
            }

            member
        }

        val token = jwtService.generateToken(member)

        return LoginUseCase.Output(
            token = token,
            memberName = member.name,
        )
    }
}
