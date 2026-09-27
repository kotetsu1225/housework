package com.task.usecase.auth

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.member.EmailAlreadyUsedException
import com.task.domain.member.Member
import com.task.domain.member.MemberRepository
import com.task.domain.member.PasswordHasher
import com.task.domain.tenant.Tenant
import com.task.domain.tenant.TenantRepository
import com.task.infra.database.DatabaseWithoutRLS
import com.task.infra.database.isUniqueViolationOf
import com.task.infra.security.JwtService
import org.jooq.exception.DataAccessException

@Singleton
class RegisterFamilyUseCaseImpl @Inject constructor(
    private val databaseWithoutRLS: DatabaseWithoutRLS,
    private val tenantRepository: TenantRepository,
    private val memberRepository: MemberRepository,
    private val passwordHasher: PasswordHasher,
    private val jwtService: JwtService,
) : RegisterFamilyUseCase {

    companion object {
        // members.email の一意制約はV11で明示的に付けた名前(members_email_key)。
        // tenants.email の一意制約はV20で `UNIQUE` を列制約として付けており名前を指定していないため、
        // PostgreSQLのデフォルト命名規則(<table>_<column>_key)により tenants_email_key になる。
        private val EMAIL_UNIQUE_CONSTRAINTS = setOf("members_email_key", "tenants_email_key")
    }

    override fun execute(input: RegisterFamilyUseCase.Input): RegisterFamilyUseCase.Output {
        // パスワードのハッシュ化は重い処理のためトランザクション外で行う(CreateMemberUseCaseImplに合わせる)
        val hashedPassword = passwordHasher.hash(input.password)

        // テナント作成はテナントが確定する前の処理であり、V24 により housework_app からの
        // tenants への INSERT は権限レベルで拒否される。また email のグローバル一意性
        // (members.email / tenants.email のどちらも)はテナントを横断して守る必要があるため、
        // RLSをバイパスするオーナー接続(DatabaseWithoutRLS)を使う
        // (#38、ハンドオフ手順書§4の許可リスト「サインアップ」に該当)。
        //
        // email の重複判定は事前SELECTではなく、DBの一意制約違反(SQLState 23505)を検知して行う。
        // 同時に同じemailで2件registerが来た場合でも、DBの制約に一本化することで取りこぼしを防ぐ。
        val (tenant, member) = try {
            databaseWithoutRLS.withTransaction { session ->
                val tenant = Tenant.create(familyName = input.familyName, email = input.email)
                tenantRepository.create(tenant, session)

                // 新しいテナントなので、同一テナント内の名前重複チェックは空リストでよい
                val member = Member.create(
                    tenantId = tenant.id,
                    name = input.name,
                    email = input.email,
                    familyRole = input.familyRole,
                    password = hashedPassword,
                    existingMembersName = emptyList(),
                )
                memberRepository.create(member, session)

                tenant to member
            }
        } catch (e: DataAccessException) {
            throw toEmailAlreadyUsedExceptionOrRethrow(e)
        }

        // トランザクションのコミットが成功した後でJWTを発行する
        val token = jwtService.generateToken(member)

        return RegisterFamilyUseCase.Output(
            tenantId = tenant.id,
            memberId = member.id,
            memberName = member.name,
            token = token,
        )
    }

    /**
     * [e]がPostgreSQLの一意制約違反(members_email_key / tenants_email_key)なら
     * [EmailAlreadyUsedException]に変換する。それ以外の原因の場合は[e]をそのまま返す(呼び出し側でthrowし直す)。
     */
    private fun toEmailAlreadyUsedExceptionOrRethrow(e: DataAccessException): RuntimeException {
        return if (e.isUniqueViolationOf(EMAIL_UNIQUE_CONSTRAINTS)) EmailAlreadyUsedException() else e
    }
}
