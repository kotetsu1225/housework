package com.task.infra.security

import com.google.inject.Singleton
import com.task.domain.member.PasswordHash
import com.task.domain.member.PasswordHasher
import com.task.domain.member.PlainPassword
import org.mindrot.jbcrypt.BCrypt

@Singleton
class BCryptPasswordHasher : PasswordHasher {
    companion object {
        private const val BCRYPT_COST = 10
    }

    override fun hash(plainPassword: PlainPassword): PasswordHash {
        return PasswordHash(BCrypt.hashpw(plainPassword.value,  BCrypt.gensalt(BCRYPT_COST)))
    }

    override fun verify(plainPassword: PlainPassword, hashedPassword: PasswordHash): Boolean {
        return BCrypt.checkpw(plainPassword.value, hashedPassword.value)
    }
}