package com.task.domain.tenant

data class FamilyName(val value: String) {
    init {
        require(value.isNotBlank()) {
            "家族名は必須です。"
        }
        require(value.length <= 255) {
            "家族名は255文字以内で入力してください。"
        }
    }
}
