package com.task.usecase.member

import com.google.inject.Inject
import com.google.inject.Singleton
import com.task.domain.AppTimeZone
import com.task.domain.member.MemberRepository
import com.task.infra.database.Database
import com.task.usecase.query.member.MemberStatsQueryService
import java.time.LocalDate

@Singleton
class GetMembersUseCaseImpl @Inject constructor(
    private val database: Database,
    private val memberRepository: MemberRepository,
    private val memberStatsQueryService: MemberStatsQueryService
) : GetMembersUseCase {

    override fun execute(): GetMembersUseCase.Output {
        return database.withTransaction { session ->
            val members = memberRepository.findAll(session)
            val today = LocalDate.now(AppTimeZone.ZONE)
            val statsByMemberId = memberStatsQueryService
                .fetchMemberStats(session, today)
                .associateBy { it.memberId }

            GetMembersUseCase.Output(
                members = members.map { member ->
                    val stats = statsByMemberId[member.id.value.toString()]
                    GetMembersUseCase.MemberOutput(
                        id = member.id,
                        name = member.name,
                        email = member.email,
                        familyRole = member.familyRole,
                        todayEarnedPoint = stats?.todayEarnedPoint ?: 0,
                        todayFamilyTaskCompleted = stats?.todayFamilyTaskCompleted ?: 0,
                        todayPersonalTaskCompleted = stats?.todayPersonalTaskCompleted ?: 0
                    )
                }
            )
        }
    }
}
