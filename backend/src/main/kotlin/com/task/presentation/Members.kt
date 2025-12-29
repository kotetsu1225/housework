package com.task.presentation

import com.task.domain.member.FamilyRole
import com.task.domain.member.MemberEmail
import com.task.domain.member.MemberId
import com.task.domain.member.MemberName
import com.task.domain.member.PlainPassword
import com.task.usecase.member.CreateMemberUseCase
import com.task.usecase.member.GetMemberUseCase
import com.task.usecase.member.GetMembersUseCase
import com.task.usecase.member.UpdateMemberUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.resources.Resource
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
// Ktor Resources: Type-safe routingを使用する場合は、
// io.ktor.server.resources.get/postを使用する必要がある
// 出典: https://ktor.io/docs/server-resources.html#routes
import io.ktor.server.resources.get
import io.ktor.server.resources.post
import kotlinx.serialization.Serializable
import java.util.UUID

@Resource("api/member")
class Members{

    @Resource("")
    class List(val parent: Members = Members()) {
        @Serializable
        data class Response(
            val members: kotlin.collections.List<MemberDto>
        )

        @Serializable
        data class MemberDto(
            val id: String,
            val name: String,
            val email: String,
            val familyRole: String,
        )
    }

    @Resource("/{memberId}")
    data class Member(
        val parent: Members = Members(),
        val memberId: String
    ) {
        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val email: String,
            val familyRole: String,
        )
    }

    @Resource("/create")
    class CreateMember(
        val parent: Members,
    ) {
        @Serializable
        data class Request(
            val name: String,
            val email: String,
            val familyRole: String,
            val password: String,
        )
        @Serializable
        data class Response(
            val id: String,
            val name: String,
            val email: String,
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

    get<Members.List> {
        val output = instance<GetMembersUseCase>().execute()

        call.respond(
            HttpStatusCode.OK,
            Members.List.Response(
                members = output.members.map { member ->
                    Members.List.MemberDto(
                        id = member.id.value.toString(),
                        name = member.name.value,
                        email = member.email.value,
                        familyRole = member.familyRole.value
                    )
                }
            )
        )
    }

    get<Members.Member> { resource ->
        val output = instance<GetMemberUseCase>().execute(
            GetMemberUseCase.Input(
                id = MemberId(UUID.fromString(resource.memberId))
            )
        )

        if (output == null) {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "Member not found"))
            return@get
        }

        call.respond(
            HttpStatusCode.OK,
            Members.Member.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                email = output.email.value,
                familyRole = output.familyRole.value
            )
        )
    }

    post<Members.CreateMember> {
        val request = call.receive<Members.CreateMember.Request>()

        val output = instance<CreateMemberUseCase>().execute(
            CreateMemberUseCase.Input(
                name = MemberName(request.name),
                email = MemberEmail(request.email),
                familyRole = FamilyRole.get(request.familyRole),
                password = PlainPassword(request.password)
            )
        )

        call.respond(
            HttpStatusCode.Created,
            Members.CreateMember.Response(
                id = output.id.value.toString(),
                name = output.name.value,
                email = output.email.value,
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
