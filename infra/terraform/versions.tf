terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.4"
    }
  }

  # state は GCS に置く(バケットは Terraform より前に手で作る唯一のリソース。doc/gcp-setup.md §4)。
  # バケット名はプロジェクト ID を含むので、公開リポジトリには書かない。
  # `terraform init -backend-config=backend.tfbackend` で渡す(backend.tfbackend.example を参照)。
  backend "gcs" {}
}
