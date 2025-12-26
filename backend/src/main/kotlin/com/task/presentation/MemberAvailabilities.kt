package com.task.presentation

import com.task.domain.member.MemberId
import com.task.domain.memberAvailability.MemberAvailabilityId
import com.task.domain.memberAvailability.TimeSlot
import com.task.usecase.memberAvailability.create.CreateMemberAvailabilityUseCase
import com.task.usecase.memberAvailability.get.GetMemberAvailabilitiesUseCase
import com.task.usecase.memberAvailability.update.DeleteMemberAvailabilityTimeSlotsUseCase
import com.task.usecase.memberAvailability.update.UpdateMemberAvailabilityTimeSlotsUseCase
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
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

@Resource("api/member-availabilities")
class MemberAvailabilities {

    @Resource("/member/{memberId}")
    class ByMember(
        val parent: MemberAvailabilities = MemberAvailabilities(),
        val memberId: String
    ) {
        @Serializable
        data class Response(
            val availabilities: kotlin.collections.List<AvailabilityDto>
        )

        @Serializable
        data class AvailabilityDto(
            val id: String,
            val memberId: String,
            val targetDate: String,
            val slots: kotlin.collections.List<TimeSlotDto>
        )

        @Serializable
        data class TimeSlotDto(
            val startTime: String,
            val endTime: String,
            val memo: String?
        )
    }

    @Resource("/create")
    class Create(
        val parent: MemberAvailabilities = MemberAvailabilities(),
    ) {
        @Serializable
        data class Request(
            val memberId: String,
            val targetDate: String,
            val slots: List<TimeSlotRequest>,
        )

        @Serializable
        data class TimeSlotRequest(
            val startTime: String,
            val endTime: String,
            val memo: String? = null,
        )

        @Serializable
        data class Response(
            val id: String,
            val memberId: String,
            val targetDate: String,
            val slots: List<TimeSlotResponse>,
        )

        @Serializable
        data class TimeSlotResponse(
            val startTime: String,
            val endTime: String,
            val memo: String?,
        )
    }

    @Resource("/{availabilityId}/update")
    class Update(
        val parent: MemberAvailabilities = MemberAvailabilities(),
        val availabilityId: String,
    ) {
        @Serializable
        data class Request(
            val slots: List<TimeSlotRequest>,
        )

        @Serializable
        data class TimeSlotRequest(
            val startTime: String,
            val endTime: String,
            val memo: String? = null,
        )

        @Serializable
        data class Response(
            val id: String,
            val memberId: String,
            val targetDate: String,
            val slots: List<TimeSlotResponse>,
        )

        @Serializable
        data class TimeSlotResponse(
            val startTime: String,
            val endTime: String,
            val memo: String?,
        )
    }

    @Resource("/{availabilityId}/delete-slots")
    class DeleteSlots(
        val parent: MemberAvailabilities = MemberAvailabilities(),
        val availabilityId: String,
    ) {
        @Serializable
        data class Request(
            val slots: List<TimeSlotRequest>,
        )

        @Serializable
        data class TimeSlotRequest(
            val startTime: String,
            val endTime: String,
            val memo: String? = null,
        )

        @Serializable
        data class Response(
            val id: String,
            val memberId: String,
            val targetDate: String,
            val slots: List<TimeSlotResponse>,
        )

        @Serializable
        data class TimeSlotResponse(
            val startTime: String,
            val endTime: String,
            val memo: String?,
        )
    }
}

fun Route.memberAvailabilities() {
    // GET /api/member-availabilities/member/{memberId} - メンバー別空き時間一覧取得
    // DDDの観点: 集約間の参照はIDで行い、MemberAvailabilityをMemberIdで絞り込む
    get<MemberAvailabilities.ByMember> { resource ->
        val output = instance<GetMemberAvailabilitiesUseCase>().execute(
            GetMemberAvailabilitiesUseCase.Input(
                memberId = MemberId(UUID.fromString(resource.memberId))
            )
        )

        call.respond(
            HttpStatusCode.OK,
            MemberAvailabilities.ByMember.Response(
                availabilities = output.availabilities.map { availability ->
                    MemberAvailabilities.ByMember.AvailabilityDto(
                        id = availability.id.value.toString(),
                        memberId = availability.memberId.value.toString(),
                        targetDate = availability.targetDate.toString(),
                        slots = availability.slots.map { slot ->
                            MemberAvailabilities.ByMember.TimeSlotDto(
                                startTime = slot.startTime.toString(),
                                endTime = slot.endTime.toString(),
                                memo = slot.memo
                            )
                        }
                    )
                }
            )
        )
    }

    // POST /api/member-availabilities/create - 空き時間作成
    post<MemberAvailabilities.Create> {
        val request = call.receive<MemberAvailabilities.Create.Request>()

        val output = instance<CreateMemberAvailabilityUseCase>().execute(
            CreateMemberAvailabilityUseCase.Input(
                memberId = MemberId(UUID.fromString(request.memberId)),
                targetDate = LocalDate.parse(request.targetDate),
                slots = request.slots.map { slot ->
                    TimeSlot(
                        startTime = LocalTime.parse(slot.startTime),
                        endTime = LocalTime.parse(slot.endTime),
                        memo = slot.memo
                    )
                }
            )
        )

        call.respond(
            HttpStatusCode.Created,
            MemberAvailabilities.Create.Response(
                id = output.id.value.toString(),
                memberId = output.memberId.value.toString(),
                targetDate = output.targetDate.toString(),
                slots = output.slots.map { slot ->
                    MemberAvailabilities.Create.TimeSlotResponse(
                        startTime = slot.startTime.toString(),
                        endTime = slot.endTime.toString(),
                        memo = slot.memo
                    )
                }
            )
        )
    }

    post<MemberAvailabilities.Update> { resource ->
        val request = call.receive<MemberAvailabilities.Update.Request>()

        val output = instance<UpdateMemberAvailabilityTimeSlotsUseCase>().execute(
            UpdateMemberAvailabilityTimeSlotsUseCase.Input(
                id = MemberAvailabilityId(UUID.fromString(resource.availabilityId)),
                newSlots = request.slots.map { slot ->
                    TimeSlot(
                        startTime = LocalTime.parse(slot.startTime),
                        endTime = LocalTime.parse(slot.endTime),
                        memo = slot.memo
                    )
                }
            )
        )

        call.respond(
            HttpStatusCode.OK,
            MemberAvailabilities.Update.Response(
                id = output.id.value.toString(),
                memberId = output.memberId.value.toString(),
                targetDate = output.targetDate.toString(),
                slots = output.slots.map { slot ->
                    MemberAvailabilities.Update.TimeSlotResponse(
                        startTime = slot.startTime.toString(),
                        endTime = slot.endTime.toString(),
                        memo = slot.memo
                    )
                }
            )
        )
    }

    post<MemberAvailabilities.DeleteSlots> { resource ->
        val request = call.receive<MemberAvailabilities.DeleteSlots.Request>()

        val output = instance<DeleteMemberAvailabilityTimeSlotsUseCase>().execute(
            DeleteMemberAvailabilityTimeSlotsUseCase.Input(
                id = MemberAvailabilityId(UUID.fromString(resource.availabilityId)),
                deletedSlots = request.slots.map { slot ->
                    TimeSlot(
                        startTime = LocalTime.parse(slot.startTime),
                        endTime = LocalTime.parse(slot.endTime),
                        memo = slot.memo
                    )
                }
            )
        )

        call.respond(
            HttpStatusCode.OK,
            MemberAvailabilities.DeleteSlots.Response(
                id = output.id.value.toString(),
                memberId = output.memberId.value.toString(),
                targetDate = output.targetDate.toString(),
                slots = output.slots.map { slot ->
                    MemberAvailabilities.DeleteSlots.TimeSlotResponse(
                        startTime = slot.startTime.toString(),
                        endTime = slot.endTime.toString(),
                        memo = slot.memo
                    )
                }
            )
        )
    }
}
