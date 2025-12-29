package com.task

import com.google.inject.AbstractModule
import com.google.inject.TypeLiteral
import com.google.inject.multibindings.Multibinder
import com.task.domain.event.DomainEventDispatcher
import com.task.domain.event.DomainEventHandler
import com.task.domain.member.MemberRepository
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database
import com.task.infra.event.InMemoryDomainEventDispatcher
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.memberAvailability.MemberAvailabilityRepositoryImpl
import com.task.infra.taskDefinition.TaskDefinitionRepositoryImpl
// Member UseCases
import com.task.usecase.member.CreateMemberUseCase
import com.task.usecase.member.CreateMemberUseCaseImpl
import com.task.usecase.member.GetMemberUseCase
import com.task.usecase.member.GetMemberUseCaseImpl
import com.task.usecase.member.GetMembersUseCase
import com.task.usecase.member.GetMembersUseCaseImpl
import com.task.usecase.member.UpdateMemberUseCase
import com.task.usecase.member.UpdateMemberUseCaseImpl
// MemberAvailability UseCases
import com.task.usecase.memberAvailability.create.CreateMemberAvailabilityUseCase
import com.task.usecase.memberAvailability.create.CreateMemberAvailabilityUseCaseImpl
import com.task.usecase.memberAvailability.get.GetMemberAvailabilitiesUseCase
import com.task.usecase.memberAvailability.get.GetMemberAvailabilitiesUseCaseImpl
import com.task.usecase.memberAvailability.update.UpdateMemberAvailabilityTimeSlotsUseCase
import com.task.usecase.memberAvailability.update.UpdateMemberAvailabilityTimeSlotsUseCaseImpl
import com.task.usecase.memberAvailability.update.DeleteMemberAvailabilityTimeSlotsUseCase
import com.task.usecase.memberAvailability.update.DeleteMemberAvailabilityTimeSlotsUseCaseImpl
// TaskDefinition UseCases
import com.task.usecase.taskDefinition.create.CreateTaskDefinitionUseCase
import com.task.usecase.taskDefinition.create.CreateTaskDefinitionUseCaseImpl
import com.task.usecase.taskDefinition.delete.DeleteTaskDefinitionUseCase
import com.task.usecase.taskDefinition.delete.DeleteTaskDefinitionUseCaseImpl
import com.task.usecase.taskDefinition.get.GetTaskDefinitionUseCase
import com.task.usecase.taskDefinition.get.GetTaskDefinitionUseCaseImpl
import com.task.usecase.taskDefinition.get.GetTaskDefinitionsUseCase
import com.task.usecase.taskDefinition.get.GetTaskDefinitionsUseCaseImpl
import com.task.usecase.taskDefinition.handler.CreateTaskExecutionOnTaskDefinitionCreatedHandler
import com.task.usecase.taskDefinition.handler.TaskDefinitionDeletedHandler
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCase
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCaseImpl
import kotlin.jvm.java

import com.task.infra.security.JwtConfig
import com.task.infra.security.JwtService
import com.task.usecase.auth.LoginUseCase
import com.task.usecase.auth.LoginUseCaseImpl
import com.typesafe.config.ConfigFactory
import com.task.domain.mail.MailSender
import com.task.infra.mail.LoggingMailSender
import com.task.infra.event.handler.EmailNotificationHandler

class AppModule : AbstractModule() {
    override fun configure() {
        bind(Database::class.java).asEagerSingleton()

        bind(MemberRepository::class.java).to(MemberRepositoryImpl::class.java)
        bind(MemberAvailabilityRepository::class.java).to(MemberAvailabilityRepositoryImpl::class.java)
        // 修正: インターフェースを実装クラスにバインド（元のコードは自身にバインドしていたバグ）
        // GuiceはTaskDefinitionRepositoryImplをインスタンス化し、TaskDefinitionRepositoryとして注入
        bind(TaskDefinitionRepository::class.java).to(TaskDefinitionRepositoryImpl::class.java)

        // Member UseCase bindings
        bind(CreateMemberUseCase::class.java).to(CreateMemberUseCaseImpl::class.java)
        bind(UpdateMemberUseCase::class.java).to(UpdateMemberUseCaseImpl::class.java)
        // 追加: GETエンドポイント用UseCase
        bind(GetMembersUseCase::class.java).to(GetMembersUseCaseImpl::class.java)
        bind(GetMemberUseCase::class.java).to(GetMemberUseCaseImpl::class.java)

        // MemberAvailability UseCase bindings
        bind(CreateMemberAvailabilityUseCase::class.java).to(CreateMemberAvailabilityUseCaseImpl::class.java)
        bind(UpdateMemberAvailabilityTimeSlotsUseCase::class.java).to(UpdateMemberAvailabilityTimeSlotsUseCaseImpl::class.java)
        bind(DeleteMemberAvailabilityTimeSlotsUseCase::class.java).to(DeleteMemberAvailabilityTimeSlotsUseCaseImpl::class.java)
        // 追加: GETエンドポイント用UseCase
        bind(GetMemberAvailabilitiesUseCase::class.java).to(GetMemberAvailabilitiesUseCaseImpl::class.java)

        // TaskDefinition UseCase bindings
        bind(CreateTaskDefinitionUseCase::class.java).to(CreateTaskDefinitionUseCaseImpl::class.java)
        bind(UpdateTaskDefinitionUseCase::class.java).to(UpdateTaskDefinitionUseCaseImpl::class.java)
        bind(DeleteTaskDefinitionUseCase::class.java).to(DeleteTaskDefinitionUseCaseImpl::class.java)
        // 追加: GETエンドポイント用UseCase（ページネーション対応）
        bind(GetTaskDefinitionsUseCase::class.java).to(GetTaskDefinitionsUseCaseImpl::class.java)
        bind(GetTaskDefinitionUseCase::class.java).to(GetTaskDefinitionUseCaseImpl::class.java)

        bind(DomainEventDispatcher::class.java).to(InMemoryDomainEventDispatcher::class.java)

        // Mail bindings
        bind(MailSender::class.java).to(LoggingMailSender::class.java)

        // Auth UseCase bindings
        bind(LoginUseCase::class.java).to(LoginUseCaseImpl::class.java)

        val handlerBinder = Multibinder.newSetBinder(
            binder(),
            object : TypeLiteral<DomainEventHandler<*>>() {}
        )
        handlerBinder.addBinding().to(CreateTaskExecutionOnTaskDefinitionCreatedHandler::class.java)
        handlerBinder.addBinding().to(TaskDefinitionDeletedHandler::class.java)
        handlerBinder.addBinding().to(EmailNotificationHandler::class.java)

        val appConfig = ConfigFactory.load()
        val jwtConfig = JwtConfig(
            secret = appConfig.getString("jwt.secret"),
            issuer =  appConfig.getString("jwt.issuer"),
            audience =  appConfig.getString("jwt.audience"),
            realm =  appConfig.getString("jwt.realm"),
            expiresInMs =  appConfig.getLong("jwt.expiresInMs")
        )

        // JwtConfigをシングルトンとして登録
        bind(JwtConfig::class.java).toInstance(jwtConfig)

        // JwtServiceをシングルトンとして登録
        bind(JwtService::class.java).toInstance(JwtService(jwtConfig))
    }
}
