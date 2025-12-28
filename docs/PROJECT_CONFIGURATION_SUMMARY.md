# プロジェクト基盤/設定ファイル統合サマリ

このドキュメントは、基盤系（インフラ/設定周り）および設定ファイルを、現状の実装を一切変更せずに1つのMarkdownにまとめたものです。

以下は対象ファイルのコード内容を「CODE REFERENCES」形式で引用しています。実ファイルの行番号は元ファイルのものを保持します。

## Backend

### `backend/build.gradle.kts`
```1:152:backend/build.gradle.kts
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
```

### `backend/Dockerfile`
```1:50:backend/Dockerfile
# ==========================================
# Stage 1: Build
# ==========================================
FROM gradle:8.5-jdk21 AS builder

WORKDIR /app

# Gradleのキャッシュを活用するため、依存関係ファイルを先にコピー
COPY build.gradle.kts settings.gradle.kts ./
#
COPY src ./src
COPY db ./db

RUN chmod -R 644 db/migration/*.sql

# アプリケーションをビルド
RUN gradle shadowJar -x flywayMigrate --no-daemon -x generateJooq --no-daemon

# ==========================================
# Stage 2: Runtime
# ==========================================
FROM eclipse-temurin:21-jre
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# セキュリティ: 非rootユーザーで実行
# -r はシステムユーザーを作成するオプション、-g はグループを指定するオプションです
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
USER appuser
COPY --from=builder --chown=appuser:appgroup /app/build/libs/*-all.jar app.jar

COPY --from=builder --chown=appuser:appgroup /app/db ./db

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
 CMD wget -qO- http://localhost:8080/health > /dev/null || exit 1

# ポート公開
EXPOSE 8080

# アプリケーション起動
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### `backend/docker/postgres/init.sql`
```1:15:backend/docker/postgres/init.sql
-- 初期化スクリプト
-- このファイルはPostgreSQLコンテナの初回起動時に自動実行されます

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- タイムゾーン設定
SET timezone = 'Asia/Tokyo';

-- 確認メッセージ
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
END $$;
```

### `backend/src/main/resources/application.conf`
```1:20:backend/src/main/resources/application.conf
ktor {
   deployment {
       port = 8080
       port = ${?PORT}
   }
   application {
       modules = [ com.task.ApplicationKt.module ]
   }
}

database {
   driverClassName = "org.postgresql.Driver"
   jdbcUrl = "jdbc:postgresql://localhost:5432/housework"
   jdbcUrl = ${?DATABASE_URL}
   username = "housework"
   username = ${?DATABASE_USER}
   password = "housework_password"
   password = ${?DATABASE_PASSWORD}
   maximumPoolSize = 10
}
```

### `backend/src/main/resources/logback.xml`
```1:24:backend/src/main/resources/logback.xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
        </encoder>
    </appender>

    <!-- Application logs -->
    <logger name="com.task" level="DEBUG"/>

    <!-- Ktor logs -->
    <logger name="io.ktor" level="INFO"/>

    <!-- JOOQ logs -->
    <logger name="org.jooq" level="INFO"/>

    <!-- HikariCP logs -->
    <logger name="com.zaxxer.hikari" level="INFO"/>

    <root level="INFO">
        <appender-ref ref="STDOUT"/>
    </root>
</configuration>
```

### `backend/src/main/kotlin/com/task/Application.kt`
```1:73:backend/src/main/kotlin/com/task/Application.kt
package com.task

import com.task.presentation.GuicePlugin
import com.task.presentation.members
import com.task.presentation.memberAvailabilities
import com.task.presentation.taskDefinitions
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
import kotlinx.serialization.json.Json

fun main() {
    val port = System.getenv("PORT")?.toInt() ?: 8080
    embeddedServer(Netty, port = port, module = Application::module).start(wait = true)
}

fun Application.module() {
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
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Patch)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        anyHost()
    }

    install(StatusPages) {
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to (cause.message ?: "Bad Request")))
        }
        exception<Throwable> { call, cause ->
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Internal Server Error")))
        }
    }

    routing {
        get("/health") {
            call.respondText("ok")
        }

        members()
        memberAvailabilities()
        taskDefinitions()
    }
}
```

### `backend/src/main/kotlin/com/task/Config.kt`
```1:77:backend/src/main/kotlin/com/task/Config.kt
package com.task

import com.google.inject.AbstractModule
import com.task.domain.member.MemberRepository
import com.task.domain.memberAvailability.MemberAvailabilityRepository
import com.task.domain.taskDefinition.TaskDefinitionRepository
import com.task.infra.database.Database
import com.task.infra.member.MemberRepositoryImpl
import com.task.infra.memberAvailability.MemberAvailabilityRepositoryImpl
// TaskDefinitionRepositoryImpl: ドメインのインターフェースをインフラの実装に接続
// DIP: 依存性逆転の原則
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
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCase
import com.task.usecase.taskDefinition.update.UpdateTaskDefinitionUseCaseImpl
import kotlin.jvm.java

class AppModule : AbstractModule() {
    override fun configure() {
        bind(Database::class.java).asEagerSingleton()

        bind(MemberRepository::class.java).to(MemberRepositoryImpl::class.java)
        bind(MemberAvailabilityRepository::class.java).to(MemberAvailabilityRepositoryImpl::class.java)
        // Bind interface to implementation
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
    }
}
```

### `backend/src/main/kotlin/com/task/infra/database/DatabaseConfig.kt`
```1:116:backend/src/main/kotlin/com/task/infra/database/DatabaseConfig.kt
package com.task.infra.database

import com.typesafe.config.ConfigFactory
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.flywaydb.core.Flyway

/**
 * データベース接続プールの設定クラス
 *
 * 【このクラスの役割】
 * application.confから設定を読み込み、HikariCPの接続プールを作成する
 *
 * 【HikariCPとは？】
 * - 高速な接続プールライブラリ
 * - DB接続を事前に作成しておき、使い回すことでパフォーマンスを向上
 * - 接続の作成/破棄のオーバーヘッドを削減
 *
 * 【なぜobject（シングルトン）なのか？】
 * - 接続プールはアプリケーション全体で1つだけあればよい
 * - 複数作ると接続数が無駄に増えてDBに負荷がかかる
 */
object DatabaseConfig {
   /**
    * HikariCPのデータソース（接続プール）
    *
    * 【lazyとは？】
    * 最初にアクセスされた時に初期化される
    * → アプリ起動時ではなく、実際にDBを使う時に接続プールが作られる
    */
   val dataSource: HikariDataSource by lazy {
       // application.confを読み込む
       val config = ConfigFactory.load()
       val dbConfig = config.getConfig("database")
       runMigrations(dbConfig)

       // HikariCPの設定を作成
       val hikariConfig = HikariConfig().apply {
           // 【必須設定】
           driverClassName = dbConfig.getString("driverClassName")  // PostgreSQLドライバ
           jdbcUrl = dbConfig.getString("jdbcUrl")                  // 接続先URL
           username = dbConfig.getString("username")                // ユーザー名
           password = dbConfig.getString("password")                // パスワード

           // 【プール設定】
           maximumPoolSize = dbConfig.getInt("maximumPoolSize")     // 最大接続数（デフォルト10）

           // 【推奨設定】
           // 接続がプールに戻される前に、接続が有効かテストする
           connectionTestQuery = "SELECT 1"

           // プール名（デバッグ時に役立つ）
           poolName = "HouseworkHikariPool"

           // 接続が使われていない時のタイムアウト（ミリ秒）
           // 10分間使われなかった接続は閉じられる
           idleTimeout = 600000

           // 接続の最大寿命（ミリ秒）
           // 30分経過した接続は新しい接続に置き換えられる
           maxLifetime = 1800000

           // 接続取得のタイムアウト（ミリ秒）
           // 30秒以内に接続が取得できなければエラー
           connectionTimeout = 30000
       }

       // 設定を元にHikariDataSourceを作成
       HikariDataSource(hikariConfig)
   }

   /**
    * 接続プールをシャットダウンする
    *
    * 【いつ使う？】
    * - アプリケーション終了時
    * - テスト後のクリーンアップ時
    */
   fun close() {
       if (!dataSource.isClosed) {
           dataSource.close()
       }
   }

   /**
    * Flywayマイグレーションを実行
    *
    * 【Flywayとは？】
    * - DBスキーマのバージョン管理ツール
    * - db/migration/V1__*.sql 形式のファイルを順番に実行
    * - 既に適用済みのマイグレーションはスキップ
    *
    * 【なぜ起動時に実行？】
    * - Docker環境でアプリ起動時に自動でスキーマが最新になる
    - 手動でマイグレーションコマンドを実行する必要がない
    *
    * @param dbConfig データベース設定
    */
   private fun runMigrations(dbConfig: com.typesafe.config.Config) {
       val flyway = Flyway.configure()
           .dataSource(
               dbConfig.getString("jdbcUrl"),
               dbConfig.getString("username"),
               dbConfig.getString("password")
           )
           // マイグレーションファイルの場所（Docker環境のみ）
           // Docker環境では /app/db/migration にコピーされている
           .locations("filesystem:/app/db/migration")
           .load()

       // マイグレーション実行（適用済みはスキップ）
       val result = flyway.migrate()
       println("Flyway migration completed: ${result.migrationsExecuted} migrations applied")
   }
}
```

### `frontend/Dockerfile`
```1:39:frontend/Dockerfile
# ==========================================
# Stage 1: Build
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# パッケージファイルをコピー
COPY package.json package-lock.json* ./

# 依存関係のインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# プロダクションビルド
RUN npm run build

# ==========================================
# Stage 2: Production (nginx)
# ==========================================
FROM nginx:alpine

# nginxの設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ビルド成果物をコピー
COPY --from=builder /app/dist /usr/share/nginx/html

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# ポート公開
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### `frontend/vite.config.ts`
```1:20:frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
``

### `frontend/index.html`
```1:17:frontend/index.html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0f0f12" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Housework - 家事タスク管理</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `frontend/package.json`
```1:44:frontend/package.json
{
  "name": "housework-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.1",
    "lucide-react": "^0.303.0",
    "date-fns": "^3.2.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8",
    "vitest": "^1.1.0",
    "@vitest/ui": "^1.1.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.2.0",
    "jsdom": "^23.0.1"
  }
}
```

### `frontend/index.html`（重複回避のため省略）

### `frontend/tsconfig.json`
```1:28:frontend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### `frontend/tsconfig.node.json`
```1:10:frontend/tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

### `frontend/nginx.conf`
```1:38:frontend/nginx.conf
server {
   listen 80;
   server_name localhost;
   root /usr/share/nginx/html;
   index index.html;

   # gzip圧縮
   gzip on;
   gzip_vary on;
   gzip_min_length 1024;
   gzip_proxied expired no-cache no-store private auth;
   gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript;

   # SPAのためのルーティング設定
   location / {
       try_files $uri $uri/ /index.html;
   }

   # APIリクエストをバックエンドにプロキシ
   location /api/ {
       proxy_pass http://backend:8080/api/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_cache_bypass $http_upgrade;
   }

   # 静的ファイルのキャッシュ設定
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
}
```

### `frontend/tailwind.config.js`
```1:80:frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Structured-inspired color palette (dark theme)
        coral: {
          50: '#fff5f4',
          100: '#ffeae9',
          200: '#ffdedb',
          300: '#ffccc7',
          400: '#f49f99',
          500: '#ff9494',
          600: '#e87c7c',
          700: '#d16464',
          800: '#b54d4d',
          900: '#8a3939',
          950: '#5c2525',
        },
        // Accent colors
        accent: {
          blue: '#6185a8',
          green: '#69a859',
          teal: '#4ec757',
        },
        // Dark background colors (Structured style)
        dark: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d9d9de',
          300: '#b8b8c1',
          400: '#91919f',
          500: '#737384',
          600: '#5d5d6c',
          700: '#4c4c58',
          800: '#2a2a32',
          900: '#1c1c22',
          950: '#121216',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Hiragino Sans"',
          '"Hiragino Kaku Gothic ProN"',
          '"Noto Sans JP"',
          'sans-serif',
        ],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 3s ease infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
```

### `docker-compose.yml`
```1:86:docker-compose.yml
version: '3.8'

services:
  # ==========================================
  # PostgreSQL Database
  # ==========================================
  postgres:
    image: postgres:16-alpine
    container_name: housework-db
    environment:
      POSTGRES_USER: housework
      POSTGRES_PASSWORD: housework_password
      POSTGRES_DB: housework
      TZ: Asia/Tokyo
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U housework -d housework"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - housework-network

  # ==========================================
  # Backend API (Kotlin/Ktor)
  # ==========================================
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: housework-backend
    environment:
      DATABASE_URL: jdbc:postgresql://postgres:5432/housework
      DATABASE_USER: housework
      DATABASE_PASSWORD: housework_password
      TZ: Asia/Tokyo
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8080/health > /dev/null || exit 1"]
      interval: 30s
      timeout: 3s
      start_period: 30s
      retries: 3
    restart: unless-stopped
    networks:
      - housework-network

  # ==========================================
  # Frontend (React/Vite)
  # ==========================================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: housework-frontend
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    networks:
      - housework-network

networks:
  housework-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

ここまでが、基盤系/設定周りの主要ファイルの現行状態をそのまま1つのmdに統合したものです。ファイルごとにコードブロックを設け、元のインデント・構造を保持しています。

この文書をそのままリポジトリに保存しますか？保存します場合、保存先とファイル名（デフォルトは `docs/PROJECT_CONFIGURATION_SUMMARY.md`）を確認させてください。次に実ファイルとして保存します。


