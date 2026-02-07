package com.task

import com.task.infra.config.DotenvLoader
import com.task.infra.security.JwtConfig
import com.task.presentation.GuicePlugin
import com.task.presentation.auth
import com.task.presentation.configureJwtAuth
import com.task.presentation.guiceInjectorKey
import com.task.presentation.members
import com.task.presentation.taskDefinitions
import com.task.presentation.taskExecutions
import com.task.presentation.taskGenerations
import com.task.presentation.dashboard
import com.task.presentation.completedTasks
import com.task.presentation.health
import com.task.presentation.pushSubscriptions
import com.task.scheduler.DailyTaskGenerationScheduler
import com.task.scheduler.DailyNotCompletedTaskNotificationScheduler
import com.task.scheduler.NotDailyTomorrowTaskNotificationScheduler
import com.task.scheduler.NotDailyTaskReminderScheduler
import com.task.scheduler.OutboxEventProcessorScheduler
import com.task.usecase.task.GenerateDailyExecutionsUseCase
import com.task.usecase.task.SendDailyNotCompletedTaskNotificationsUseCase
import com.task.usecase.task.SendNotDailyTomorrowTaskNotificationsUseCase
import com.task.usecase.task.SendNotDailyTaskRemindersUseCase
import com.task.usecase.outbox.ProcessOutboxEventsUseCase
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.resources.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.http.HttpStatusCode
import io.ktor.server.auth.authenticate
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

fun main() {
    val port = System.getenv("PORT")?.toInt() ?: 8080
    embeddedServer(Netty, port = port, module = Application::module).start(wait = true)
}

fun Application.module() {
    DotenvLoader.loadIfPresent()

    install(GuicePlugin) {
        modules = listOf(AppModule())
    }

    install(Resources)

    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
        })
    }

    install(CORS) {
        val allowedOriginsEnv = System.getenv("CORS_ALLOWED_ORIGINS")
        val allowedOrigins = allowedOriginsEnv
            ?.split(",")
            ?.map { it.trim() }
            ?: listOf(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            )
        
        allowedOrigins.forEach { origin ->
            allowHost(origin.removePrefix("http://").removePrefix("https://"), 
                     schemes = listOf(if (origin.startsWith("https")) "https" else "http"))
        }
        
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Patch)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowCredentials = true
    }

    install(StatusPages) {
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to (cause.message ?: "Bad Request")))
        }
        exception<Throwable> { call, cause ->
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Internal Server Error")))
        }
    }

    val injector = attributes[guiceInjectorKey]

    val jwtConfig = injector.getInstance(JwtConfig::class.java)
    configureJwtAuth(jwtConfig)

    val taskGenerationScheduler = DailyTaskGenerationScheduler(
        injector.getInstance(GenerateDailyExecutionsUseCase::class.java),
    )

    val notificationScheduleTime = (
        System.getenv("NOTIFICATION_SCHEDULE_TIME")
            ?: System.getProperty("NOTIFICATION_SCHEDULE_TIME")
    )?.let {
        try {
            val parts = it.split(":")
            java.time.LocalTime.of(parts[0].toInt(), if (parts.size > 1) parts[1].toInt() else 0)
        } catch (e: Exception) {
            java.time.LocalTime.of(19, 0)
        }
    } ?: java.time.LocalTime.of(19, 0)

    val notificationScheduler = DailyNotCompletedTaskNotificationScheduler(
        injector.getInstance(SendDailyNotCompletedTaskNotificationsUseCase::class.java),
        executionTime = notificationScheduleTime
    )

    val notDailyTomorrowNotificationScheduler = NotDailyTomorrowTaskNotificationScheduler(
        injector.getInstance(SendNotDailyTomorrowTaskNotificationsUseCase::class.java)
    )

    val notDailyTaskReminderScheduler = NotDailyTaskReminderScheduler(
        injector.getInstance(SendNotDailyTaskRemindersUseCase::class.java)
    )

    val outboxScheduler = OutboxEventProcessorScheduler(
        injector.getInstance(ProcessOutboxEventsUseCase::class.java),
        intervalSeconds = 10
    )

    launch {
        taskGenerationScheduler.start(this)
    }

    launch {
        notificationScheduler.start(this)
    }

    launch {
        notDailyTomorrowNotificationScheduler.start(this)
    }

    launch {
        notDailyTaskReminderScheduler.start(this)
    }

    launch {
        outboxScheduler.start(this)
    }

    environment.monitor.subscribe(ApplicationStopped) {
        taskGenerationScheduler.stop()
        notificationScheduler.stop()
        notDailyTomorrowNotificationScheduler.stop()
        notDailyTaskReminderScheduler.stop()
        outboxScheduler.stop()
    }

    routing {
        get("/health") {
            call.respondText("ok")
        }
        auth()

        authenticate("jwt") {
            health()
            members()
            taskDefinitions()
            taskExecutions()
            taskGenerations()
            dashboard()
            completedTasks()
            pushSubscriptions()
        }

    }
}
