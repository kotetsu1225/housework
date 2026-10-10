# Pub/Sub リソース(#70)。名前は #34 の「Pub/Sub 共通契約」に合わせる。
# - topic は 1 つ(domain-events)。イベント種別は message attribute の eventType で区別する
# - subscription は 1 つ(housework-backend、pull)。ordering / exactly-once は無効(処理は completed_domain_events で冪等)
# - 5 回配信に失敗したメッセージは dead-letter topic に送り、人が確認用の subscription で見る

locals {
  # Pub/Sub のサービスエージェント。dead-letter への転送に、DLQ topic への publisher と元 subscription への subscriber が必要
  pubsub_service_agent = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_topic" "domain_events" {
  name       = "domain-events"
  depends_on = [google_project_service.this]
}

resource "google_pubsub_topic" "domain_events_dead_letter" {
  name       = "domain-events-dead-letter"
  depends_on = [google_project_service.this]
}

resource "google_pubsub_subscription" "housework_backend" {
  name  = "housework-backend"
  topic = google_pubsub_topic.domain_events.id

  ack_deadline_seconds         = 60
  enable_message_ordering      = false
  enable_exactly_once_delivery = false

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.domain_events_dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  # 既定では 31 日間アクティブでない subscription は削除されるため、無期限にする
  expiration_policy {
    ttl = ""
  }
}

resource "google_pubsub_subscription" "domain_events_dead_letter_inspect" {
  name  = "domain-events-dead-letter-inspect"
  topic = google_pubsub_topic.domain_events_dead_letter.id

  expiration_policy {
    ttl = ""
  }
}

# アプリ(Railway の backend)用のサービスアカウント。キーは Terraform では作らない(#73 で手で発行する)
resource "google_service_account" "housework_backend" {
  account_id   = "housework-backend"
  display_name = "housework backend (Pub/Sub publisher / subscriber)"
  depends_on   = [google_project_service.this]
}

# アプリ SA の権限は、この topic への publish と、この subscription からの subscribe だけ(プロジェクト全体のロールは付けない)
resource "google_pubsub_topic_iam_member" "backend_publisher" {
  topic  = google_pubsub_topic.domain_events.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${google_service_account.housework_backend.email}"
}

resource "google_pubsub_subscription_iam_member" "backend_subscriber" {
  subscription = google_pubsub_subscription.housework_backend.id
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${google_service_account.housework_backend.email}"
}

# dead-letter 転送のための Pub/Sub サービスエージェントの権限
resource "google_pubsub_topic_iam_member" "service_agent_dead_letter_publisher" {
  topic  = google_pubsub_topic.domain_events_dead_letter.id
  role   = "roles/pubsub.publisher"
  member = local.pubsub_service_agent
}

resource "google_pubsub_subscription_iam_member" "service_agent_subscriber" {
  subscription = google_pubsub_subscription.housework_backend.id
  role         = "roles/pubsub.subscriber"
  member       = local.pubsub_service_agent
}
