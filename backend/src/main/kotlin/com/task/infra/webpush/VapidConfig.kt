package com.task.infra.webpush

data class VapidConfig (
    val publicKey: String,   // Base64 URL-safe エンコード
    val privateKey: String,  // Base64 URL-safe エンコード（秘密！）
    val subject: String      // mailto:xxx@example.com または https://example.com
)