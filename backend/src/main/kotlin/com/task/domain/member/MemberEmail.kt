package com.task.domain.member

@JvmInline
value class MemberEmail(val value: String) {
    init {
        require(value.isNotBlank()) { "メールアドレスは必須です。" }
        require(EMAIL_REGEX.matches(value)) { "無効なメールアドレス形式です: $value" }
    }

    companion object {
        private val EMAIL_REGEX = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$".toRegex()
    }
}
