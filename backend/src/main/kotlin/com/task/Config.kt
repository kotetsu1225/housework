package com.task

import com.google.inject.AbstractModule
import com.task.domain.member.MemberRepository
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.infra.database.Database
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.memberAvailability.MemberAvailabilityRepositoryImpl
import com.task.usecase.member.CreateMemberUseCase
import com.task.usecase.member.CreateMemberUseCaseImpl
import com.task.usecase.member.UpdateMemberUseCase
import com.task.usecase.member.UpdateMemberUseCaseImpl
import com.task.usecase.memberAvailability.create.CreateMemberAvailabilityUseCase
import com.task.usecase.memberAvailability.create.CreateMemberAvailabilityUseCaseImpl
import com.task.usecase.memberAvailability.update.UpdateMemberAvailabilityTimeSlotsUseCase
import com.task.usecase.memberAvailability.update.UpdateMemberAvailabilityTimeSlotsUseCaseImpl
import com.task.usecase.memberAvailability.update.DeleteMemberAvailabilityTimeSlotsUseCase
import com.task.usecase.memberAvailability.update.DeleteMemberAvailabilityTimeSlotsUseCaseImpl

class AppModule : AbstractModule() {
    override fun configure() {
        bind(Database::class.java).asEagerSingleton()

        bind(MemberRepository::class.java).to(MemberRepositoryImpl::class.java)
        bind(MemberAvailabilityRepository::class.java).to(MemberAvailabilityRepositoryImpl::class.java)

        bind(CreateMemberUseCase::class.java).to(CreateMemberUseCaseImpl::class.java)
        bind(UpdateMemberUseCase::class.java).to(UpdateMemberUseCaseImpl::class.java)
        bind(CreateMemberAvailabilityUseCase::class.java).to(CreateMemberAvailabilityUseCaseImpl::class.java)
        bind(UpdateMemberAvailabilityTimeSlotsUseCase::class.java).to(UpdateMemberAvailabilityTimeSlotsUseCaseImpl::class.java)
        bind(DeleteMemberAvailabilityTimeSlotsUseCase::class.java).to(DeleteMemberAvailabilityTimeSlotsUseCaseImpl::class.java)
    }
}
