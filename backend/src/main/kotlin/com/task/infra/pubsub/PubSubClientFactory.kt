package com.task.infra.pubsub

import com.google.api.gax.batching.FlowControlSettings
import com.google.api.gax.core.CredentialsProvider
import com.google.api.gax.core.FixedCredentialsProvider
import com.google.api.gax.core.NoCredentialsProvider
import com.google.api.gax.grpc.GrpcTransportChannel
import com.google.api.gax.rpc.AlreadyExistsException
import com.google.api.gax.rpc.FixedTransportChannelProvider
import com.google.api.gax.rpc.TransportChannelProvider
import com.google.auth.oauth2.ServiceAccountCredentials
import com.google.cloud.pubsub.v1.MessageReceiver
import com.google.cloud.pubsub.v1.Publisher
import com.google.cloud.pubsub.v1.Subscriber
import com.google.cloud.pubsub.v1.SubscriptionAdminClient
import com.google.cloud.pubsub.v1.SubscriptionAdminSettings
import com.google.cloud.pubsub.v1.TopicAdminClient
import com.google.cloud.pubsub.v1.TopicAdminSettings
import com.google.inject.Inject
import com.google.inject.Singleton
import com.google.pubsub.v1.ProjectSubscriptionName
import com.google.pubsub.v1.PushConfig
import com.google.pubsub.v1.Subscription
import com.google.pubsub.v1.TopicName
import io.grpc.ManagedChannel
import io.grpc.ManagedChannelBuilder
import java.io.ByteArrayInputStream

/**
 * Pub/SubのPublisher / Subscriber / Admin clientの組み立てを1箇所にまとめるファクトリ(issue #71)。
 *
 * 【なぜ1箇所にまとめるのか】
 * リレー(#72、outboxからのpublish)とsubscriber(#61、受信後の処理)の両方が
 * 「本番(GCP) / ローカル(エミュレータ) / テスト(Testcontainers)のどれに繋ぐか」という
 * 同じ分岐を必要とするため、その組み立てロジックをこのクラスに閉じ込める。
 * #72 / #61 はこのクラスの[createPublisher] / [createSubscriber]を呼ぶだけでよい。
 *
 * 【enabled = falseのとき】
 * [createPublisher] / [createSubscriber] は呼ばずに済ませること(ローカルでPub/Sub無しに
 * APIだけ動かす運用を想定している)。誤って呼んだ場合は[IllegalStateException]を投げる。
 *
 * 【emulatorHostの有無で切り替わる部分】
 * - あり: `ManagedChannelBuilder.forTarget(host).usePlaintext()`で作ったチャネルを
 *   [FixedTransportChannelProvider]で固定し、認証も[NoCredentialsProvider]に差し替える。
 *   (公式ドキュメント https://docs.cloud.google.com/pubsub/docs/emulator の手順どおり)
 * - なし: チャネル・認証情報とも明示的に指定しない。ライブラリの既定
 *   (Application Default Credentials。`GOOGLE_APPLICATION_CREDENTIALS`のファイルパスを
 *   含む)に任せる。ただし`GOOGLE_CREDENTIALS_JSON`(JSON本文の環境変数。Railway等、
 *   ファイルを置きにくい環境向け)が設定されていればそちらを優先する。
 *
 * 【資格情報をログに出さないこと】
 * [productionCredentialsProvider]は`GOOGLE_CREDENTIALS_JSON`の中身や、そこから作った
 * 認証情報オブジェクトを一切ログ出力しない。将来この関数を変更する場合も同様に注意すること。
 *
 * @param config [PubSubConfig.fromConfig]で作られた設定
 */
@Singleton
class PubSubClientFactory @Inject constructor(
    private val config: PubSubConfig,
) : AutoCloseable {

    private val topicName: TopicName = TopicName.of(config.projectId, config.topicId)
    private val subscriptionName: ProjectSubscriptionName =
        ProjectSubscriptionName.of(config.projectId, config.subscriptionId)

    /**
     * エミュレータ用のgRPCチャネル。ファクトリで1つだけ持ち回し、[close]でまとめてshutdownする。
     * emulatorHostが設定されていないとき(本番)はそもそも作られない。
     */
    private val emulatorChannel: ManagedChannel? by lazy {
        config.emulatorHost?.let { host ->
            ManagedChannelBuilder.forTarget(host).usePlaintext().build()
        }
    }

    /**
     * Publisherを生成する。
     *
     * @throws IllegalStateException `pubsub.enabled = false`のとき。呼び出し側は
     *   [PubSubConfig.enabled]を見て、falseなら本メソッドを呼ばないこと。
     */
    fun createPublisher(): Publisher {
        check(config.enabled) { "pubsub.enabled = false のため Publisher を作成できません" }
        val builder = Publisher.newBuilder(topicName)
        applyTransport(
            onEmulator = { channelProvider ->
                builder.setChannelProvider(channelProvider)
                    .setCredentialsProvider(NoCredentialsProvider.create())
            },
            onProduction = { credentialsProvider ->
                credentialsProvider?.let { builder.setCredentialsProvider(it) }
            },
        )
        return builder.build()
    }

    /**
     * Subscriberを生成する。受信したメッセージは呼び出し側の[receiver]でack/nackすること
     * (このクラスは受信後の処理には関与しない。#61の対象)。
     *
     * 【flow controlについて(issue #61)】
     * 同時に受信・処理するメッセージ数を[MAX_OUTSTANDING_ELEMENT_COUNT]件に制限する。
     * 制限しないと大量のメッセージが同時に処理され、各メッセージの処理が開くDB接続
     * (tenantスコープのトランザクション)でコネクションプールを使い切ってしまう恐れがあるため。
     *
     * @throws IllegalStateException `pubsub.enabled = false`のとき。呼び出し側は
     *   [PubSubConfig.enabled]を見て、falseなら本メソッドを呼ばないこと。
     */
    fun createSubscriber(receiver: MessageReceiver): Subscriber {
        check(config.enabled) { "pubsub.enabled = false のため Subscriber を作成できません" }
        val builder = Subscriber.newBuilder(subscriptionName, receiver)
            .setFlowControlSettings(
                FlowControlSettings.newBuilder()
                    .setMaxOutstandingElementCount(MAX_OUTSTANDING_ELEMENT_COUNT)
                    .build()
            )
        applyTransport(
            onEmulator = { channelProvider ->
                builder.setChannelProvider(channelProvider)
                    .setCredentialsProvider(NoCredentialsProvider.create())
            },
            onProduction = { credentialsProvider ->
                credentialsProvider?.let { builder.setCredentialsProvider(it) }
            },
        )
        return builder.build()
    }

    /**
     * エミュレータ利用時だけ、topicとsubscription(pull・ack deadline 60秒・orderingなし)を
     * 「無ければ作る」。既に存在する場合([AlreadyExistsException])は無視するため、
     * 何度呼んでも例外にならない。
     *
     * emulatorHostが設定されていない(本番)場合は何もしない。本番のtopic/subscriptionは
     * Terraformで管理する(このアプリのコードでは作らない)。
     */
    fun ensureEmulatorResources() {
        val channelProvider = emulatorTransportChannelProviderOrNull() ?: return
        val credentialsProvider = NoCredentialsProvider.create()

        TopicAdminClient.create(
            TopicAdminSettings.newBuilder()
                .setTransportChannelProvider(channelProvider)
                .setCredentialsProvider(credentialsProvider)
                .build()
        ).use { topicAdminClient ->
            ensureTopic(topicAdminClient)
        }

        SubscriptionAdminClient.create(
            SubscriptionAdminSettings.newBuilder()
                .setTransportChannelProvider(channelProvider)
                .setCredentialsProvider(credentialsProvider)
                .build()
        ).use { subscriptionAdminClient ->
            ensureSubscription(subscriptionAdminClient)
        }
    }

    /** ファクトリが保持しているエミュレータ用チャネルをshutdownする。本番では何もしない。 */
    override fun close() {
        emulatorChannel?.let { channel ->
            if (!channel.isShutdown) {
                channel.shutdown()
            }
        }
    }

    private fun ensureTopic(topicAdminClient: TopicAdminClient) {
        try {
            topicAdminClient.createTopic(topicName)
        } catch (_: AlreadyExistsException) {
            // エミュレータはリソースを永続化しないため起動のたびに作成を試みるが、
            // 同一エミュレータに対して複数回呼ばれても問題ないよう既存分は無視する。
        }
    }

    private fun ensureSubscription(subscriptionAdminClient: SubscriptionAdminClient) {
        try {
            val subscription = Subscription.newBuilder()
                .setName(subscriptionName.toString())
                .setTopic(topicName.toString())
                // pull subscription(push配信は使わない)
                .setPushConfig(PushConfig.getDefaultInstance())
                .setAckDeadlineSeconds(ACK_DEADLINE_SECONDS)
                // orderingは作成後に変更できないため、イベントが1種類で処理が冪等な現時点では
                // 無効のまま(デフォルトfalse)で作成する(issue #71の前提)。
                .build()
            subscriptionAdminClient.createSubscription(subscription)
        } catch (_: AlreadyExistsException) {
            // 同上
        }
    }

    /**
     * emulatorHostの有無に応じて、Publisher/Subscriberのbuilderに設定すべき
     * チャネル・認証情報をコールバックに渡す。
     */
    private inline fun applyTransport(
        onEmulator: (TransportChannelProvider) -> Unit,
        onProduction: (CredentialsProvider?) -> Unit,
    ) {
        val emulatorProvider = emulatorTransportChannelProviderOrNull()
        if (emulatorProvider != null) {
            onEmulator(emulatorProvider)
        } else {
            onProduction(productionCredentialsProvider())
        }
    }

    private fun emulatorTransportChannelProviderOrNull(): TransportChannelProvider? {
        val channel = emulatorChannel ?: return null
        return FixedTransportChannelProvider.create(GrpcTransportChannel.create(channel))
    }

    /**
     * 本番(GCP)接続用の認証情報を返す。
     *
     * `GOOGLE_CREDENTIALS_JSON`(JSON本文。Railway等ファイルを置きにくい環境向け)が
     * 設定されていればそれを使い、無ければnullを返す(呼び出し側は何も設定せず、
     * ライブラリの既定であるApplication Default Credentials
     * 「`GOOGLE_APPLICATION_CREDENTIALS`のファイルパスを含む」に任せる)。
     *
     * 【注意】この関数はJSON本文や認証情報オブジェクトを絶対にログ出力しないこと。
     */
    private fun productionCredentialsProvider(): CredentialsProvider? {
        // 本番(Railway)は環境変数、ローカルの .env は DotenvLoader がシステムプロパティに入れるので両方を見る
        val credentialsJson = (System.getenv(GOOGLE_CREDENTIALS_JSON_ENV) ?: System.getProperty(GOOGLE_CREDENTIALS_JSON_ENV))
            ?.takeIf { it.isNotBlank() }
            ?: return null
        val credentials = ServiceAccountCredentials
            .fromStream(ByteArrayInputStream(credentialsJson.toByteArray(Charsets.UTF_8)))
            .createScoped(listOf(PUBSUB_SCOPE))
        return FixedCredentialsProvider.create(credentials)
    }

    companion object {
        private const val GOOGLE_CREDENTIALS_JSON_ENV = "GOOGLE_CREDENTIALS_JSON"
        private const val PUBSUB_SCOPE = "https://www.googleapis.com/auth/pubsub"
        private const val ACK_DEADLINE_SECONDS = 60

        /** 同時処理数の上限(issue #61)。[createSubscriber]のKDoc参照。 */
        private const val MAX_OUTSTANDING_ELEMENT_COUNT = 10L
    }
}
