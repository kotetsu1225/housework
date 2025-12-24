package com.task.presentation

import com.google.inject.Guice
import com.google.inject.Injector
import com.google.inject.Module
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.application
import io.ktor.server.application.createApplicationPlugin
import io.ktor.util.AttributeKey
import io.ktor.util.pipeline.PipelineContext

val guiceInjectorKey = AttributeKey<Injector>("GuicePlugin/Injector")

class GuicePluginConfiguration {
    var modules: List<Module> = listOf()
}

val GuicePlugin = createApplicationPlugin(
    name = "GuicePlugin",
    createConfiguration = ::GuicePluginConfiguration
) {
    val injector = Guice.createInjector(pluginConfig.modules)
    application.attributes.put(guiceInjectorKey, injector)
}

inline fun <reified T> PipelineContext<*, ApplicationCall>.instance(): T {
    val injector = application.attributes[guiceInjectorKey]
    return injector.getInstance(T::class.java)
}

inline fun <reified T> ApplicationCall.instance(): T {
    val injector = application.attributes[guiceInjectorKey]
    return injector.getInstance(T::class.java)
}
