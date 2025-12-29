package com.task.presentation

import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword
import com.task.domain.member.MemberRepository
import com.task.infra.database.Database
import com.task.infra.security.JwtService
import com.task.usecase.auth.LoginUseCase
import com.task.usecase.member.CreateMemberUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.resources.post
import kotlinx.serialization.Serializable

/**
 * 認証エンドポイント
 *
 * POST /api/auth/register - 新規ユーザー登録
 * POST /api/auth/login    - ログイン
 *
 * これらのエンドポイントは認証不要（公開API）
 */
@Resource("api/auth")
class Auth {

    @Resource("/register")
    class Register(val parent: Auth = Auth()) {
        @Serializable
        data class Request(
            val name: String,
            val email: String,
            val familyRole: String,
            val password: String,
        )

        @Serializable
        data class Response(
            val token: String,
            val memberName: String,
        )
    }

    @Resource("/login")
    class Login(val parent: Auth = Auth()) {
        @Serializable
        data class Request(
            val name: String,
            val password: String,
        )

        @Serializable
        data class Response(
            val token: String,
            val memberName: String,
        )
    }
}

/**
 * 認証ルートの定義
 */
fun Route.auth() {

    // POST /api/auth/register - 新規登録
    // CreateMemberUseCaseでメンバー作成 → JwtServiceでトークン発行
    post<Auth.Register> {
        val request = call.receive<Auth.Register.Request>()

        try {
            // 1. メンバーを作成
            val createOutput = instance<CreateMemberUseCase>().execute(
                CreateMemberUseCase.Input(
                    name = MemberName(request.name),
                    email = MemberEmail(request.email),
                    familyRole = FamilyRole.get(request.familyRole),
                    password = PlainPassword(request.password)
                )
            )

            // 2. 作成したメンバーを取得してJWTを生成
            val database = instance<Database>()
            val memberRepository = instance<MemberRepository>()
            val jwtService = instance<JwtService>()

            val member = database.withTransaction { session ->
                memberRepository.findById(createOutput.id, session)
            } ?: throw IllegalStateException("作成したメンバーが見つかりません")

            val token = jwtService.generateToken(member)

            call.respond(
                HttpStatusCode.Created,
                Auth.Register.Response(
                    token = token,
                    memberName = member.name.value
                )
            )
        } catch (e: IllegalArgumentException) {
            call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to (e.message ?: "登録に失敗しました"))
            )
        }
    }

    // POST /api/auth/login - ログイン
    post<Auth.Login> {
        val request = call.receive<Auth.Login.Request>()

        try {
            val output = instance<LoginUseCase>().execute(
                LoginUseCase.Input(
                    name = MemberName(request.name),
                    password = PlainPassword(request.password)
                )
            )

            call.respond(
                HttpStatusCode.OK,
                Auth.Login.Response(
                    token = output.token,
                    memberName = output.memberName.value
                )
            )
        } catch (e: IllegalArgumentException) {
            call.respond(
                HttpStatusCode.Unauthorized,
                mapOf("error" to (e.message ?: "ログインに失敗しました"))
            )
        }
    }
}
