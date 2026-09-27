package com.task.infra.pubsub

import com.typesafe.config.Config

/**
 * Pub/Subクライアントの設定を保持するdata class(issue #71)
 *
 * 【このクラスの役割】
 * application.confの`pubsub`ブロックから値を読み込み、[PubSubClientFactory]に渡す。
 * 本番(GCP)・ローカル(エミュレータ)・テスト(Testcontainers)の3環境を、
 * このdata classの値の違い([emulatorHost]の有無)だけで切り替える。
 *
 * 【認証情報を持たない理由】
 * `GOOGLE_CREDENTIALS_JSON` / `GOOGLE_APPLICATION_CREDENTIALS` は機密情報であり、
 * このdata classはログ出力やデバッグ時にtoString()される可能性があるため、
 * 資格情報はここに含めず[PubSubClientFactory]が直接環境変数から読む。
 *
 * @param enabled falseのときはPublisher/Subscriberを起動しない
 *   (ローカルでPub/Sub無しにAPIだけ動かすため)。呼び出し側がこれを見て
 *   [PubSubClientFactory.createPublisher] / [PubSubClientFactory.createSubscriber] を
 *   呼ばないこと(呼ぶとIllegalStateExceptionになる)。
 * @param projectId GCPプロジェクトID(エミュレータ利用時は任意の文字列でよい)
 * @param topicId topic名(共通契約#34により"domain-events"固定)
 * @param subscriptionId subscription名(共通契約#34により"housework-backend"固定)
 * @param emulatorHost `host:port`形式。設定されていればエミュレータに接続する。
 *   未設定(null)なら本番(GCP)に接続する。
 */
data class PubSubConfig(
    val enabled: Boolean,
    val projectId: String,
    val topicId: String,
    val subscriptionId: String,
    val emulatorHost: String?,
) {
    companion object {
        /**
         * application.confの`pubsub`ブロックから[PubSubConfig]を作る。
         *
         * 【emulatorHostの読み方について】
         * application.confでは`emulatorHost = ${?PUBSUB_EMULATOR_HOST}`と書いており、
         * 環境変数`PUBSUB_EMULATOR_HOST`が未設定の場合はHOCONのoptional substitutionの
         * 仕様により`emulatorHost`というキー自体が存在しなくなる(空文字にはならない)。
         * そのため`getString`ではなく`hasPath`で存在確認してから読む。
         */
        fun fromConfig(config: Config): PubSubConfig {
            val pubsubConfig = config.getConfig("pubsub")
            return PubSubConfig(
                enabled = pubsubConfig.getBoolean("enabled"),
                projectId = pubsubConfig.getString("projectId"),
                topicId = pubsubConfig.getString("topicId"),
                subscriptionId = pubsubConfig.getString("subscriptionId"),
                emulatorHost = if (pubsubConfig.hasPath("emulatorHost")) {
                    pubsubConfig.getString("emulatorHost")
                } else {
                    null
                },
            )
        }
    }
}
