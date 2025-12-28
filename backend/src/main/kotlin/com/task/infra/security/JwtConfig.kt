package com.task.infra.security

/**
 * JWT設定を保持するdata class
 *
 * DDDの観点:
 * - 設定値の読み込み・保持はInfra層の責務
 * - application.confから値を読み込み、このクラスに格納
 * - immutableなdata classで設定を表現
 */
data class JwtConfig(
    val secret: String,
    val issuer: String,
    val audience: String,
    val realm: String,
    val expiresInMs: Long
)
