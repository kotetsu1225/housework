package com.task.infra.pushSubscription

import com.task.domain.member.MemberId
import java.time.Instant
import java.util.UUID

data class PushSubscription(
    val id: UUID,
    val memberId: MemberId,
    val endpoint: String,           // Push ServiceのエンドポイントURL
    val p256dhKey: String,          // 暗号化用ECDH公開鍵（Base64）
    val authKey: String,            // 認証シークレット（Base64）
    val expirationTime: Instant?,   // 購読の有効期限（nullable）
    val userAgent: String?,         // ユーザーエージェント（デバッグ用）
    val isActive: Boolean,          // 有効フラグ（410 Goneで無効化）
)
