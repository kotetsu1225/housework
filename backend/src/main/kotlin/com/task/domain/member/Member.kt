package com.task.domain.member

import java.util.UUID

class Member private constructor(
    val id: MemberId,
    val name: MemberName,
    val familyRole: FamilyRole,
) {
    fun updateName(newName: MemberName, existingMembersName: List<MemberName>): Member {
        validateNoDuplicationExistingMembersName(existingMembersName, newName)

        return Member(
            id = this.id,
            name = newName,
            familyRole = this.familyRole
        )
    }

    fun updateFamilyRole(newRole: FamilyRole): Member {
        return Member(
            id = this.id,
            name = this.name,
            familyRole = newRole
        )
    }

    companion object {
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

data class MemberId(val value: UUID) {
    companion object {
        fun generate() = MemberId(value = UUID.randomUUID())
        fun from(value: String) = MemberId(value = UUID.fromString(value))
    }
}

data class MemberName(val value: String) {
    init {
        require(value.isNotBlank()) {
            "名前は必須です。"
        }
    }
}

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
