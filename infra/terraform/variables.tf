variable "project_id" {
  description = "GCP プロジェクト ID"
  type        = string
}

variable "region" {
  description = "GCP リージョン(#34 の共通契約)"
  type        = string
  default     = "asia-northeast1"
}

variable "billing_account" {
  description = "請求先アカウント ID(例: 000000-000000-000000。billingAccounts/ の接頭辞は付けない)"
  type        = string
}

variable "budget_amount" {
  description = "月の予算額(budget_currency の単位の整数)"
  type        = number
  default     = 1000
}

variable "budget_currency" {
  description = "予算の通貨。請求先アカウントの通貨と一致させる必要がある(一致しないと API がエラーを返す)"
  type        = string
  default     = "JPY"
}
