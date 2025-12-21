package com.task.infra.database

import com.typesafe.config.ConfigFactory
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource

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
}
