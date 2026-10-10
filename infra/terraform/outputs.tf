output "project_number" {
  description = "プロジェクト番号(#70 で Pub/Sub のサービスエージェントのメールを組み立てるのに使う)"
  value       = data.google_project.this.number
}

output "budget_name" {
  description = "作成した予算のリソース名"
  value       = google_billing_budget.monthly.name
}

output "topic_id" {
  description = "outbox リレーが publish する topic(#72、#34 の Pub/Sub 共通契約)"
  value       = google_pubsub_topic.domain_events.name
}

output "subscription_id" {
  description = "アプリ内 subscriber が pull する subscription(#61)"
  value       = google_pubsub_subscription.housework_backend.name
}

output "dead_letter_topic_id" {
  description = "5 回配信に失敗したメッセージの転送先"
  value       = google_pubsub_topic.domain_events_dead_letter.name
}

output "service_account_email" {
  description = "アプリ用サービスアカウント。キーは #73 で手で発行して Railway に登録する"
  value       = google_service_account.housework_backend.email
}
