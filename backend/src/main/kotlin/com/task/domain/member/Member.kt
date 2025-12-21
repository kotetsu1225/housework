package com.task.domain.member

import java.util.UUID

/**
 * メンバー集約ルート
 *
 * 【不変条件】
 * - 名前は既存メンバーと重複してはならない
 */
class Member(
    val id: MemberId,
    val name: MemberName,
    val familyRole: FamilyRole,
) {
    /**
     * 名前を更新する
     * @return 新しいMemberインスタンス（不変オブジェクト）
     */
    fun updateName(newName: MemberName, existingMembersName: List<MemberName>): Member {
        validateNoDuplicationExistingMembersName(existingMembersName, newName)

        return Member(
            id = this.id,
            name = newName,
            familyRole = this.familyRole
        )
    }

    /**
     * 家族内役割を更新する
     * @return 新しいMemberインスタンス（不変オブジェクト）
     */
    fun updateFamilyRole(newRole: FamilyRole): Member {
        return Member(
            id = this.id,
            name = this.name,
            familyRole = newRole
        )
    }

    companion object {
        /**
         * 新規メンバーを作成する（ファクトリメソッド）
         *
         * @param name メンバー名
         * @param familyRole 家族内役割
         * @param existingMembersName 既存メンバーの名前リスト（重複チェック用）
         */
        fun create(
            name: MemberName,
            familyRole: FamilyRole,
            existingMembersName: List<MemberName>
        ): Member {
            validateNoDuplicationExistingMembersName(existingMembersName, name)

            return Member(
                id = MemberId.generate(),
                name = name,
                familyRole = familyRole,
            )
        }

        /**
         * DBから復元する（バリデーションなし）
         *
         * 【なぜ別メソッド？】
         * - create()は新規作成時のバリデーションを行う
         * - reconstruct()はDBから復元時に使用（すでに検証済みのデータ）
         */
        fun reconstruct(
            id: MemberId,
            name: MemberName,
            familyRole: FamilyRole,
        ): Member {
            return Member(
                id = id,
                name = name,
                familyRole = familyRole,
            )
        }

        private fun validateNoDuplicationExistingMembersName(
            membersName: List<MemberName>,
            newMemberName: MemberName
        ) {
            require(membersName.none { it.value == newMemberName.value }) {
                "既存のユーザ名と重複しています"
            }
        }
    }
}

/**
 * メンバーID（値オブジェクト）
 */
data class MemberId(val value: UUID) {
    companion object {
        fun generate() = MemberId(value = UUID.randomUUID())
    }
}

/**
 * メンバー名（値オブジェクト）
 *
 * 【不変条件】
 * - 空白は許可しない
 */
data class MemberName(val value: String) {
    init {
        require(value.isNotBlank()) {
            "名前は必須です。"
        }
    }
}

/**
 * 家族内役割（列挙型）
 */
enum class FamilyRole(val value: String) {
    FATHER("FATHER"),
    MOTHER("MOTHER"),
    SISTER("SISTER"),
    BROTHER("BROTHER");

    companion object {
        fun get(value: String): FamilyRole = entries.find {
            it.value == value
        } ?: throw IllegalArgumentException("Invalid family role: $value")
    }

    fun toName(): String = when (this) {
        FATHER -> "父"
        MOTHER -> "母"
        SISTER -> "妹"
        BROTHER -> "兄"
    }
}
