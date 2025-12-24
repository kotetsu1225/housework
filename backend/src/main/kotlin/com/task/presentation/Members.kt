package com.task.presentation

import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.usecase.member.CreateMemberUseCase
import com.task.usecase.member.UpdateMemberUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import kotlinx.serialization.Serializable
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
        @Serializable
        data class Request(
            val name: String,
            val familyRole: String,
        )
        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val familyRole: String,
        )
    }

    @Resource("/{memberId}/update")
    class UpdateMember(
        val parent: Members,
        val memberId: String,
    ){
        @Serializable
        data class Request(
            val name: String?,
            val familyRole: String?,
        )
        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val familyRole: String,
        )
    }
}
fun Route.members() {
    post<Members.CreateMember> {
        val request = call.receive<Members.CreateMember.Request>()

        val output = instance<CreateMemberUseCase>().execute(
            CreateMemberUseCase.Input(
                name = MemberName(request.name),
                familyRole = FamilyRole.get(request.familyRole)
            )
        )

        call.respond(
            HttpStatusCode.Created,
            Members.CreateMember.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                familyRole = output.familyRole.value
            )
        )
    }
    post<Members.UpdateMember> {
        val request = call.receive<Members.UpdateMember.Request>()

        val output = instance<UpdateMemberUseCase>().execute(
            UpdateMemberUseCase.Input(
                id = MemberId(UUID.fromString(it.memberId)),
                name = request.name?.let { MemberName(it) },
                familyRole = request.familyRole?.let { FamilyRole.get(it) }
            )
        )

        call.respond(
            HttpStatusCode.OK,
            Members.UpdateMember.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                familyRole = output.familyRole.value
            )
        )
    }
}
