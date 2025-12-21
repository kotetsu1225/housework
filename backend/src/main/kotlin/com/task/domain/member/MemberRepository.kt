package com.task.domain.member

import com.google.inject.ImplementedBy
import com.task.infra.member.MemberRepositoryImpl
import org.jooq.DSLContext

/**
 * メンバーリポジトリ（インターフェース）
 *
 * 【DDDにおけるRepository】
 * - ドメインオブジェクトの永続化と取得を担当
 * - インターフェースはドメイン層に配置
 * - 実装はインフラ層に配置（依存性逆転の原則）
 *
 * 【@ImplementedBy】
 * - Guiceのアノテーション
 * - このインターフェースのデフォルト実装を指定
 */
@ImplementedBy(MemberRepositoryImpl::class)
interface MemberRepository {
    /**
     * メンバーを新規作成する
     */
    fun create(member: Member, session: DSLContext): Member

    /**
     * メンバーを更新する
     */
    fun update(member: Member, session: DSLContext): Member

    /**
     * IDでメンバーを検索する
     */
    fun findById(id: MemberId, session: DSLContext): Member?

    /**
     * 全メンバーの名前を取得する
     * （重複チェック用）
     */
    fun findAllNames(session: DSLContext): List<MemberName>
}
