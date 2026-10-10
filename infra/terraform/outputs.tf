output "project_number" {
  description = "プロジェクト番号(#70 で Pub/Sub のサービスエージェントのメールを組み立てるのに使う)"
  value       = data.google_project.this.number
}

output "budget_name" {
  description = "作成した予算のリソース名"
  value       = google_billing_budget.monthly.name
}
