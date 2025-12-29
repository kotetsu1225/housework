package com.task.domain.mail

import com.task.domain.member.MemberEmail

data class Mail(
    val to: MemberEmail,
    val subject: String,
    val body: String
) {
    init {
        require(subject.isNotBlank()) { "メールの件名は必須です" }
        require(body.isNotBlank()) { "メールの本文は必須です" }
        require(subject.length <= 255) { "件名は255文字以内で入力してください" }
    }
}
