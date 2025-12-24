package com.task.presentation

import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.usecase.member.CreateMemberUseCase
import com.task.usecase.member.UpdateMemberUseCase
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import java.util.UUID

@Resource("api/member")
class Members{
    @Resource("/{memberId}")
    data class Member(
        val parent: Members = Members(),
        val memberId: String
    ){
    }

    @Resource("/create")
    class CreateMember(
        val parent: Members,
    ) {
        data class Request(
            val name: String,
            val familyRole: String,
        )
    }

    @Resource("/{memberId}/update")
    class UpdateMember(
        val parent: Members,
        val memberId: String,
    ){
        data class Request(
            val name: String,
            val familyRole: String,
        )
    }
}
fun Route.members() {
    post<Members.CreateMember> {
        val request = call.receive<Members.CreateMember.Request>()

        instance<CreateMemberUseCase>().execute(
            CreateMemberUseCase.Input(
                name = MemberName(request.name),
                familyRole = FamilyRole.valueOf(request.familyRole)
            )
        )
    }
    post<Members.UpdateMember> {
        val request = call.receive<Members.UpdateMember.Request>()

        instance<UpdateMemberUseCase>().execute(
            UpdateMemberUseCase.Input(
                id = MemberId(UUID.fromString(it.memberId)),
                name = MemberName(request.name),
                familyRole = FamilyRole.valueOf(request.familyRole)
            )
        )
    }
}
