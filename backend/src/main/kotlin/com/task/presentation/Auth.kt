package com.task.presentation

import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword
import com.task.domain.tenant.FamilyName
import com.task.usecase.auth.LoginUseCase
import com.task.usecase.auth.RegisterFamilyUseCase
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
            val familyName: String,
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
            val email: String,
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
    // RegisterFamilyUseCaseで「家族(tenant)+ 最初のメンバー」を作成 → 戻り値のtokenをそのまま返す
    post<Auth.Register> {
        val request = call.receive<Auth.Register.Request>()

        try {
            val output = instance<RegisterFamilyUseCase>().execute(
                RegisterFamilyUseCase.Input(
                    familyName = FamilyName(request.familyName),
                    name = MemberName(request.name),
                    email = MemberEmail(request.email),
                    familyRole = FamilyRole.get(request.familyRole),
                    password = PlainPassword(request.password)
                )
            )

            call.respond(
                HttpStatusCode.Created,
                Auth.Register.Response(
                    token = output.token,
                    memberName = output.memberName.value
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
                    email = MemberEmail(request.email),
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
            // MemberEmail の形式不正(バリデーション例外)も含め、失敗理由によらず
            // 同じメッセージを返す。e.message をそのまま返すと、失敗理由の違い
            // (email形式不正/該当メンバー無し/パスワード不一致/tenant無効)から
            // アカウントの存在有無が推測できてしまうため。
            call.respond(
                HttpStatusCode.Unauthorized,
                mapOf("error" to LoginUseCase.INVALID_CREDENTIALS_MESSAGE)
            )
        }
    }
}
