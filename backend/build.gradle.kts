import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "1.9.22"
    kotlin("plugin.serialization") version "1.9.22"
    id("io.ktor.plugin") version "2.3.7"
    id("org.flywaydb.flyway") version "9.22.3"
    id("nu.studer.jooq") version "8.2"
    id("com.github.johnrengelman.shadow") version "8.1.1"
    application
}

// マルチテナント作業では shopping を含まない DB を指すため -PdbUrl で上書きする(handoff §12、#36)
val dbUrl: String = (findProperty("dbUrl") as String?) ?: "jdbc:postgresql://localhost:5432/housework"
val dbUser: String = (findProperty("dbUser") as String?) ?: "housework"
val dbPassword: String = (findProperty("dbPassword") as String?) ?: "housework_password"
// V21のhousework_appロール作成に使うパスワード（-PappRolePasswordで上書き。既定はローカル用の値）
val appRolePassword: String = (findProperty("appRolePassword") as String?) ?: "housework_app_password"

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
val flywayVersion = "9.22.3"

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
    implementation("io.ktor:ktor-server-resources:$ktorVersion")

    // Ktor Client (for external API calls if needed)
    implementation("io.ktor:ktor-client-core-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-cio-jvm:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation-jvm:$ktorVersion")

    // Database
    implementation("org.postgresql:postgresql:$postgresVersion")
    implementation("org.jooq:jooq:$jooqVersion")
    implementation("com.zaxxer:HikariCP:5.1.0")

    // Flyway (アプリケーション実行時用)
    // Flyway 9.x: flyway-coreのみで PostgreSQL をサポート
    implementation("org.flywaydb:flyway-core:$flywayVersion")

    // DI - Guice
    implementation("com.google.inject:guice:$guiceVersion")

    // Logging
    implementation("ch.qos.logback:logback-classic:$logbackVersion")

    // JWT
    implementation("io.ktor:ktor-server-auth-jvm:${ktorVersion}")
    implementation("io.ktor:ktor-server-auth-jwt-jvm:${ktorVersion}")
    // パスワードハッシュ化
    implementation("org.mindrot:jbcrypt:0.4")

    // Email (JavaMail / Jakarta Mail)
    implementation("com.sun.mail:jakarta.mail:2.0.1")

    // Testing
    testImplementation("io.ktor:ktor-server-tests-jvm:$ktorVersion")
    testImplementation("org.jetbrains.kotlin:kotlin-test-junit:$kotlinVersion")
    testImplementation("io.mockk:mockk:1.13.8")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")

    // JOOQ code generation
    jooqGenerator("org.postgresql:postgresql:$postgresVersion")

    implementation("nl.martijndwars:web-push:5.1.1")
    implementation("org.bouncycastle:bcprov-jdk18on:1.77")
}

// Flyway configuration
flyway {
    url = dbUrl
    user = dbUser
    password = dbPassword
    locations = arrayOf("filesystem:db/migration")
    cleanDisabled = false
    // V21のhousework_appロール作成に使う（flywayMigrate/generateJooqは引き続きオーナーで接続する）
    placeholders = mapOf("appRolePassword" to appRolePassword)
}

// JOOQ configuration
jooq {
    version.set(jooqVersion)
    configurations {
        create("main") {
            // 生成物はコミット済みなのでコンパイル時に自動生成しない。
            // 生成は `./gradlew generateJooq -PdbUrl=...` で明示的に行う。
            // 素の build で DB に触れないようにするため。
            generateSchemaSourceOnCompilation.set(false)
            jooqConfiguration.apply {
                logging = org.jooq.meta.jaxb.Logging.WARN
                jdbc.apply {
                    driver = "org.postgresql.Driver"
                    url = dbUrl
                    user = dbUser
                    password = dbPassword
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
                        directory = "src/generated/jooq/main"
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
// src/generated/jooq/main をコンパイル対象に含める
// ============================================================
sourceSets {
    main {
        kotlin {
            srcDir("src/generated/jooq/main")
        }
    }
}

// JOOQ generation depends on Flyway migration
tasks.named("generateJooq") {
    dependsOn("flywayMigrate")
}
