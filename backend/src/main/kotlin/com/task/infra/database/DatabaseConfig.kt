package com.task.infra.database

import com.typesafe.config.Config
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
 *
 * 【2本のプールがある理由】
 * - dataSource: オーナー（housework）接続。RLSをバイパスする。Flywayもこちらで実行する
 * - appDataSource: 非オーナー（housework_app）接続。RLSが自動適用される
 */
object DatabaseConfig {
    /**
     * HikariCPのデータソース（オーナー接続プール）
     *
     * 【lazyとは？】
     * 最初にアクセスされた時に初期化される
     * → アプリ起動時ではなく、実際にDBを使う時に接続プールが作られる
     * （ただしApplication.ktからinitialize()で起動時に強制評価している）
     */
    private val dataSourceDelegate: Lazy<HikariDataSource> = lazy {
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
    val dataSource: HikariDataSource by dataSourceDelegate

    /**
     * HikariCPのデータソース（housework_app接続プール。RLSが適用される）
     *
     * 【なぜdataSourceに先に触れるのか？】
     * Flywayのマイグレーション（housework_appロールの作成を含む）はdataSourceのlazy初期化
     * の中で実行される。appDataSourceがhousework_appロールで接続できるよう、
     * ここで先にdataSourceを評価してFlywayを完了させておく。
     */
    private val appDataSourceDelegate: Lazy<HikariDataSource> = lazy {
        check(!dataSource.isClosed) { "オーナー側dataSourceの初期化(Flyway)が完了していません" }

        val config = ConfigFactory.load()
        val dbConfig = config.getConfig("database")
        val appConfig = dbConfig.getConfig("app")

        val hikariConfig = HikariConfig().apply {
            driverClassName = dbConfig.getString("driverClassName")
            jdbcUrl = dbConfig.getString("jdbcUrl")
            username = appConfig.getString("username")
            password = appConfig.getString("password")

            maximumPoolSize = appConfig.getInt("maximumPoolSize")

            connectionTestQuery = "SELECT 1"
            poolName = "HouseworkAppHikariPool"
            idleTimeout = 600000
            maxLifetime = 1800000
            connectionTimeout = 30000
        }

        HikariDataSource(hikariConfig)
    }
    val appDataSource: HikariDataSource by appDataSourceDelegate

    /**
     * 起動時にオーナー・appの両プールを初期化する
     *
     * 【なぜ必要？】
     * lazyのままだと最初のDBアクセスまで初期化（Flyway含む）が遅延し、
     * 起動直後のログで疎通確認ができない。Application.ktの起動処理から呼び出す。
     */
    fun initialize() {
        dataSource
        println("[DatabaseConfig] オーナープール初期化完了 (pool=${dataSource.poolName})")

        appDataSource
        println("[DatabaseConfig] app プール初期化完了 (pool=${appDataSource.poolName}, user=${appDataSource.username})")
    }

    /**
     * 接続プールをシャットダウンする
     *
     * 【いつ使う？】
     * - アプリケーション終了時
     * - テスト後のクリーンアップ時
     *
     * 【isInitializedで確認する理由】
     * 一度も使われていないプールに触れると、その時点でHikariDataSourceが
     * 新規作成されてしまう（lazyの性質上）ため、初期化済みのものだけ閉じる。
     */
    fun close() {
        if (dataSourceDelegate.isInitialized() && !dataSource.isClosed) {
            dataSource.close()
        }
        if (appDataSourceDelegate.isInitialized() && !appDataSource.isClosed) {
            appDataSource.close()
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
     * - 手動でマイグレーションコマンドを実行する必要がない
     *
     * @param dbConfig データベース設定
     */
    private fun runMigrations(dbConfig: Config) {
        val appRolePassword = dbConfig.getString("app.password")

        // 【安全策】APP_PGPASSWORD未設定（ローカル既定値のまま）で、かつ接続先がローカル以外の
        // 場合は起動を止める。公開リポジトリに書かれた既定パスワードでhousework_appロールが
        // 本番DBに作られてしまうのを防ぐため。
        val jdbcUrl = dbConfig.getString("jdbcUrl")
        if (appRolePassword == "housework_app_password" && !isLocalHost(extractHost(jdbcUrl))) {
            throw IllegalStateException(
                "本番環境では APP_PGPASSWORD を設定してください" +
                    "(公開リポジトリの既定パスワードで housework_app ロールが作られるのを防ぐため)"
            )
        }

        val flyway = Flyway.configure()
            .dataSource(
                dbConfig.getString("jdbcUrl"),
                dbConfig.getString("username"),
                dbConfig.getString("password")
            )
            // マイグレーションファイルの場所（Docker環境のみ）
            // Docker環境では /app/db/migration にコピーされている
            .locations("filesystem:/app/db/migration")
            // V21のhousework_appロール作成で使うパスワード（migrationにパスワードを直書きしないため）
            .placeholders(mapOf("appRolePassword" to appRolePassword))
            .load()

        // マイグレーション実行（適用済みはスキップ）
        val result = flyway.migrate()
        println("Flyway migration completed: ${result.migrationsExecuted} migrations applied")
    }

    /** ローカル開発・Docker Compose内で使われるホスト名 */
    private val LOCAL_HOSTS = setOf(
        "localhost",
        "127.0.0.1",
        "postgres",
        "housework-db",
        "housework-mt-db",
        "host.docker.internal"
    )

    private fun isLocalHost(host: String): Boolean = host in LOCAL_HOSTS

    /** "jdbc:postgresql://<host>:<port>/<db>" からhost部分だけを取り出す */
    private fun extractHost(jdbcUrl: String): String {
        val afterScheme = jdbcUrl.substringAfter("://")
        val hostAndPort = afterScheme.substringBefore("/")
        return hostAndPort.substringBefore(":")
    }
}
