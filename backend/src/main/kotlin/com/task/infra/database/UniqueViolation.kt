package com.task.infra.database

import org.jooq.exception.DataAccessException
import org.postgresql.util.PSQLException

private const val UNIQUE_VIOLATION_SQL_STATE = "23505"

/**
 * [this]の原因チェーンをたどり、PostgreSQLの一意制約違反(SQLState 23505)で、
 * かつ違反した制約名が[constraintNames]に含まれる場合にtrueを返す。
 *
 * 原因チェーンにPSQLExceptionが無い、あるいは制約名が取れない場合は
 * 一意制約違反と判定できないためfalseを返す(呼び出し側で元の例外をthrowし直す想定)。
 *
 * RegisterFamilyUseCaseImpl(#44)とCreateMemberUseCaseImpl(#51)が、emailの一意制約違反
 * (members_email_key / tenants_email_key)を検知して[com.task.domain.member.EmailAlreadyUsedException]
 * に変換するために共通で使う。
 */
fun DataAccessException.isUniqueViolationOf(constraintNames: Set<String>): Boolean {
    val psqlException = generateSequence<Throwable>(this) { it.cause }
        .filterIsInstance<PSQLException>()
        .firstOrNull()
        ?: return false
    val constraintName = psqlException.serverErrorMessage?.getConstraint() ?: return false

    return psqlException.getSQLState() == UNIQUE_VIOLATION_SQL_STATE &&
        constraintName in constraintNames
}
