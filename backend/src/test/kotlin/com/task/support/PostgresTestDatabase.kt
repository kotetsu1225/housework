package com.task.support

import com.task.domain.tenant.TenantId
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.flywaydb.core.Flyway
import org.jooq.DSLContext
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.testcontainers.postgresql.PostgreSQLContainer

/**
 * テスト用のPostgreSQL(Testcontainers)を、JVMプロセス内で1回だけ起動して使い回すヘルパー(issue #41)。
 *
 * 【なぜJVM内で1回だけ起動するのか】
 * コンテナ起動 + Flyway(V1〜最新)の適用は数秒かかるため、テストクラス／テストケースごとに
 * 起動すると遅い。プロパティを `by lazy` にすることで、最初にアクセスされたテストで1回だけ
 * 起動・マイグレーションを行い、以降のテストで使い回す。コンテナ自体の後片付けは
 * TestcontainersのRyuk(JVM終了時に動く番人コンテナ)に任せる。
 *
 * 【2ロールについて(#37の方式に合わせる)】
 * - [ownerDataSource] / [ownerDsl]: テーブルオーナー接続。RLSをバイパスする。
 *   Flywayの適用や、テストフィクスチャの投入・後片付け([truncateAll])に使う。
 * - [appDataSource]: `housework_app` ロールでの接続。RLSが適用される。
 *   V21マイグレーションでこのロールが作られ、パスワードはFlywayのplaceholder
 *   `appRolePassword` に渡した値([APP_ROLE_PASSWORD])と一致させる必要がある。
 *
 * 【使い方の例】
 * ```kotlin
 * class SomeIsolationTest {
 *     @AfterEach
 *     fun cleanup() {
 *         PostgresTestDatabase.truncateAll()
 *     }
 *
 *     @Test
 *     fun `tenant Aのトランザクションではtenant Aのデータだけ見える`() {
 *         val ownerDsl = PostgresTestDatabase.ownerDsl()
 *         val tenantA = TestFixtures.createTenantWithMember(ownerDsl, "山田家", "太郎", "taro@example.com")
 *
 *         val rows = PostgresTestDatabase.inTenantTransaction(tenantA.tenantId) { dsl ->
 *             dsl.selectFrom(MEMBERS).fetch()
 *         }
 *         // rows には tenantA のmembersだけが含まれる
 *     }
 * }
 * ```
 *
 * 【注意】このクラスを使うテストの実行にはDockerが必要。
 */
object PostgresTestDatabase {

    /**
     * V21で作られる `housework_app` ロールのテスト用パスワード。
     * Flywayのplaceholder `appRolePassword` にもこの値を渡すため、
     * [appDataSource] の接続パスワードと必ず一致させること。
     */
    private const val APP_ROLE_PASSWORD = "test_app_password"

    /**
     * flyway_schema_history を除く、アプリケーションの全テーブル(V1〜V23時点)。
     * [truncateAll] で使う。新しいmigrationでテーブルを追加/削除したらここも更新すること。
     */
    private val APPLICATION_TABLES = listOf(
        "tenants",
        "members",
        "task_definitions",
        "task_recurrences",
        "task_executions",
        "task_snapshots",
        "task_execution_participants",
        "push_subscriptions",
        "member_metas",
        "outbox",
        "completed_domain_events",
    )

    /**
     * PostgreSQL 17のTestcontainers。
     * 本番(17.7)に合わせたイメージを使う。アクセス時に起動する。
     */
    private val container: PostgreSQLContainer by lazy {
        PostgreSQLContainer("postgres:17-alpine")
            .withDatabaseName("housework")
            .withUsername("housework")
            .withPassword("housework_password")
            .apply { start() }
    }

    /**
     * オーナー(テーブル作成者)接続のプール。RLSをバイパスする。
     * 初回アクセス時にコンテナ起動 + Flyway(V1〜最新)の適用まで行う。
     */
    val ownerDataSource: HikariDataSource by lazy {
        val jdbcUrl = container.jdbcUrl
        runFlywayMigrations(jdbcUrl)

        HikariDataSource(
            HikariConfig().apply {
                driverClassName = "org.postgresql.Driver"
                this.jdbcUrl = jdbcUrl
                username = container.username
                password = container.password
                maximumPoolSize = 5
                poolName = "PostgresTestDatabase-owner"
            }
        )
    }

    /**
     * `housework_app` ロールでの接続プール。RLSが適用される。
     *
     * オーナー側の初期化(Flywayによる housework_app ロール作成を含む)が
     * 終わってからでないと接続できないため、先に[ownerDataSource]を評価する。
     */
    val appDataSource: HikariDataSource by lazy {
        check(!ownerDataSource.isClosed) { "ownerDataSourceの初期化(Flyway)が完了していません" }

        HikariDataSource(
            HikariConfig().apply {
                driverClassName = "org.postgresql.Driver"
                jdbcUrl = container.jdbcUrl
                username = "housework_app"
                password = APP_ROLE_PASSWORD
                maximumPoolSize = 5
                poolName = "PostgresTestDatabase-app"
            }
        )
    }

    /** オーナー接続のjOOQ DSLContext。呼び出すたびに作成する(状態を持たない)。 */
    fun ownerDsl(): DSLContext = DSL.using(ownerDataSource, SQLDialect.POSTGRES)

    /**
     * `housework_app` 接続でトランザクションを張り、最初に
     * `select set_config('app.current_tenant_id', ?, true)` を実行してからblockを呼ぶ。
     *
     * 本番の `Database.withTransaction(tenantId)`(#40で実装予定)と同じ動きを、
     * #40に依存せずに単体でRLSの検証ができるようにするためのテスト用ヘルパー。
     */
    fun <T> inTenantTransaction(tenantId: TenantId, block: (DSLContext) -> T): T {
        val dsl = DSL.using(appDataSource, SQLDialect.POSTGRES)
        return dsl.transactionResult { config ->
            val txDsl = config.dsl()
            txDsl.execute(
                "select set_config('app.current_tenant_id', ?, true)",
                tenantId.value.toString(),
            )
            block(txDsl)
        }
    }

    /**
     * `housework_app` 接続でtenantを設定せずにトランザクションを張る。
     * fail-closed(tenant未設定時はRLSによりアクセスできないこと)の確認用。
     */
    fun <T> inAppTransactionWithoutTenant(block: (DSLContext) -> T): T {
        val dsl = DSL.using(appDataSource, SQLDialect.POSTGRES)
        return dsl.transactionResult { config -> block(config.dsl()) }
    }

    /**
     * オーナー接続で、flyway_schema_history以外のアプリの全テーブルをTRUNCATE CASCADEする。
     * 各テストの `@AfterEach` から呼び、テスト間の状態をリセットする。
     */
    fun truncateAll() {
        ownerDsl().execute("TRUNCATE TABLE ${APPLICATION_TABLES.joinToString(", ")} CASCADE")
    }

    /** オーナー接続でFlywayのV1〜最新のマイグレーションを適用する。 */
    private fun runFlywayMigrations(jdbcUrl: String) {
        Flyway.configure()
            .dataSource(jdbcUrl, container.username, container.password)
            .locations("filesystem:db/migration")
            .placeholders(mapOf("appRolePassword" to APP_ROLE_PASSWORD))
            .load()
            .migrate()
    }
}
