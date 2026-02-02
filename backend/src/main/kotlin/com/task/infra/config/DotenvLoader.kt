package com.task.infra.config

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

object DotenvLoader {
    private val candidatePaths = listOf(
        Paths.get(".env"),
        Paths.get("backend", ".env")
    )

    fun loadIfPresent() {
        val dotenvPath = candidatePaths.firstOrNull { Files.exists(it) } ?: return
        loadFrom(dotenvPath)
    }

    private fun loadFrom(path: Path) {
        Files.readAllLines(path).forEach { rawLine ->
            val line = rawLine.trim()
            if (line.isEmpty() || line.startsWith("#")) {
                return@forEach
            }

            val index = line.indexOf('=')
            if (index <= 0) {
                return@forEach
            }

            val key = line.substring(0, index).trim()
            val value = unquote(line.substring(index + 1).trim())

            if (key.isEmpty()) {
                return@forEach
            }

            if (System.getenv(key) == null && System.getProperty(key) == null) {
                System.setProperty(key, value)
            }
        }
    }

    private fun unquote(value: String): String {
        if (value.length >= 2) {
            val first = value.first()
            val last = value.last()
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                return value.substring(1, value.length - 1)
            }
        }
        return value
    }
}
