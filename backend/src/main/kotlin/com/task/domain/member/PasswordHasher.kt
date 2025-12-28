package com.task.domain.member

import com.google.inject.ImplementedBy
import com.task.infra.security.BCryptPasswordHasher

/**
 * パスワードハッシュ化のドメインサービスインターフェース
 *
 * DDDの観点:
 * - インターフェースはドメイン層に配置（依存性逆転の原則）
 * - 具体的な実装（BCrypt）はインフラ層に隔離
 * - UseCaseからはこのインターフェースを通じて利用
 */
@ImplementedBy(BCryptPasswordHasher::class)
interface PasswordHasher {
    /**
     * 平文パスワードをハッシュ化
     */
    fun hash(plainPassword: PlainPassword): PasswordHash

    /**
     * パスワードを検証
     * @param plainPassword ユーザーが入力した平文パスワード
     * @param hashedPassword DBに保存されているハッシュ値
     * @return 一致すればtrue
     */
    fun verify(plainPassword: PlainPassword, hashedPassword: PasswordHash): Boolean
}