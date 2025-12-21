import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

// ============================================================
// 【重要】Flyway 10以降では、buildscriptブロックでPostgreSQLドライバを追加する必要がある
// これがないと "No database found to handle jdbc:postgresql" エラーが発生する
// ============================================================
buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.flywaydb:flyway-database-postgresql:10.4.1")
    }
}

plugins {
    kotlin("jvm") version "1.9.22"
    kotlin("plugin.serialization") version "1.9.22"
    id("io.ktor.plugin") version "2.3.7"
    id("org.flywaydb.flyway") version "10.4.1"
    id("nu.studer.jooq") version "8.2"
    id("com.github.johnrengelman.shadow") version "8.1.1"
    application
}

group = "com.task"
version = "0.0.1"

application {
    mainClass.set("com.task.ApplicationKt")
}

repositories {
    mavenCentral()
}

val ktorVersion = "2.3.7"
val kotlinVersion = "1.9.22"
val logbackVersion = "1.4.14"
val jooqVersion = "3.18.7"
val postgresVersion = "42.7.1"
val guiceVersion = "7.0.0"
val flywayVersion = "10.4.1"

dependencies {
    // Kotlin
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8:$kotlinVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")

    // Ktor Server
    implementation("io.ktor:ktor-server-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-netty-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation-jvm:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-cors-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages-jvm:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging-jvm:$ktorVersion")

    // Ktor Client (for external API calls if needed)
    implementation("io.ktor:ktor-client-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-cio-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation-jvm:$ktorVersion")

    // Database
    implementation("org.postgresql:postgresql:$postgresVersion")
    implementation("org.jooq:jooq:$jooqVersion")
    implementation("com.zaxxer:HikariCP:5.1.0")

    // Flyway (アプリケーション実行時用)
    implementation("org.flywaydb:flyway-core:$flywayVersion")
    implementation("org.flywaydb:flyway-database-postgresql:$flywayVersion")

    // DI - Guice
    implementation("com.google.inject:guice:$guiceVersion")

    // Logging
    implementation("ch.qos.logback:logback-classic:$logbackVersion")

    // Testing
    testImplementation("io.ktor:ktor-server-tests-jvm:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:$kotlinVersion")
    testImplementation("io.mockk:mockk:1.13.8")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")

    // JOOQ code generation
    jooqGenerator("org.postgresql:postgresql:$postgresVersion")
}

// Flyway configuration
flyway {
    url = "jdbc:postgresql://localhost:5432/housework"
    user = "housework"
    password = "housework_password"
    locations = arrayOf("filesystem:db/migration")
    cleanDisabled = false
}

// JOOQ configuration
jooq {
    version.set(jooqVersion)
    configurations {
        create("main") {
            jooqConfiguration.apply {
                logging = org.jooq.meta.jaxb.Logging.WARN
                jdbc.apply {
                    driver = "org.postgresql.Driver"
                    url = "jdbc:postgresql://localhost:5432/housework"
                    user = "housework"
                    password = "housework_password"
                }
                generator.apply {
                    name = "org.jooq.codegen.KotlinGenerator"
                    database.apply {
                        name = "org.jooq.meta.postgres.PostgresDatabase"
                        inputSchema = "public"
                        excludes = "flyway_schema_history"
                    }
                    generate.apply {
                        isDeprecated = false
                        isRecords = true
                        isImmutablePojos = true
                        isFluentSetters = true
                        isKotlinNotNullPojoAttributes = true
                        isKotlinNotNullRecordAttributes = true
                    }
                    target.apply {
                        packageName = "com.task.infra.database.jooq"
                        // ============================================================
                        // 【重要】生成コードは build/ 配下に出力する
                        // src/main/kotlin に出力すると、cleanタスク実行時に
                        // 手書きコードまで削除される危険がある
                        // 出典: https://github.com/etiennestuder/gradle-jooq-plugin#generating-sources-into-shared-folders-eg-srcmainjava
                        // ============================================================
                        directory = "build/generated-src/jooq/main"
                    }
                }
            }
        }
    }
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs += "-Xjsr305=strict"
        jvmTarget = "21"
    }
}

// JavaのターゲットもKotlinと揃える
tasks.withType<JavaCompile> {
    sourceCompatibility = "21"
    targetCompatibility = "21"
}

tasks.withType<Test> {
    useJUnitPlatform()
}

// ============================================================
// 【重要】JOOQ生成コードをソースセットに追加
// build/generated-src/jooq/main をコンパイル対象に含める
// ============================================================
sourceSets {
    main {
        kotlin {
            srcDir("build/generated-src/jooq/main")
        }
    }
}

// JOOQ generation depends on Flyway migration
tasks.named("generateJooq") {
    dependsOn("flywayMigrate")
}
