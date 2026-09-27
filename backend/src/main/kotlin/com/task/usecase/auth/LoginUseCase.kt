package com.task.usecase.auth

import com.google.inject.ImplementedBy
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword

@ImplementedBy(LoginUseCaseImpl::class)
interface LoginUseCase {
    data class Input(
        val email: MemberEmail,
        val password: PlainPassword,
    )

    data class Output(
        val token: String,
        val memberName: MemberName,
    )

    fun execute(input: Input): Output

    companion object {
        /**
         * ログイン失敗時に返す唯一のメッセージ(UseCase とルートの両方で使う)。
         * email が無い・パスワード不一致・tenant が ACTIVE でない・email の形式不正のどれで失敗したかが
         * 外から区別できると、アカウントの存在が推測できてしまうため、失敗理由によらず必ずこれを使う。
         */
        const val INVALID_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが正しくありません"
    }
}