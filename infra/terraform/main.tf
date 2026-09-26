provider "google" {
  project = var.project_id
  region  = var.region

  # 利用者の ADC(gcloud auth application-default login)で google_billing_budget を扱うには、
  # billing_project と user_project_override = true が必要(provider の公式ドキュメント)。
  billing_project       = var.project_id
  user_project_override = true
}

# ------------------------------------------------------------
# API の有効化(#69 のスコープ)
# 破棄時に API を無効化しない(他のリソースが使っている可能性があるため)。
# ------------------------------------------------------------
locals {
  services = [
    "pubsub.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "billingbudgets.googleapis.com",
  ]
}

resource "google_project_service" "this" {
  for_each = toset(local.services)

  service            = each.value
  disable_on_destroy = false
}

data "google_project" "this" {
  project_id = var.project_id

  depends_on = [google_project_service.this]
}

# ------------------------------------------------------------
# 予算アラート(#69)
# 請求先アカウントは他のプロジェクトと共有しているので、このプロジェクトだけに絞る。
# 予算は通知だけで、使用を止めない(Cloud Billing の公式ドキュメント)。
# 通知は既定で請求先アカウントの管理者・利用者にメールで届く。
# ------------------------------------------------------------
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account
  display_name    = "housework monthly"

  budget_filter {
    projects = ["projects/${data.google_project.this.number}"]
  }

  amount {
    specified_amount {
      currency_code = var.budget_currency
      units         = tostring(var.budget_amount)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  depends_on = [google_project_service.this]
}
