# infra/terraform

housework の GCP リソース(Pub/Sub の土台と予算アラート)を管理する Terraform です。手作業の前準備は [doc/gcp-setup.md](../../doc/gcp-setup.md) を参照してください。

## 管理しているもの

| ファイル | 内容 | issue |
|---|---|---|
| `main.tf` | API の有効化(pubsub / iam / cloudresourcemanager / billingbudgets)、プロジェクト単位の予算アラート(50% / 90% / 100%) | #69 |
| Pub/Sub の topic・subscription・サービスアカウント | これから追加 | #70 |

state は GCS のバケットに置きます。このバケットだけは Terraform より前に手で作ります(`doc/gcp-setup.md` §4)。

## 初回の準備

1. 認証(ブラウザが開く)
   ```bash
   gcloud auth application-default login
   gcloud auth application-default set-quota-project <PROJECT_ID>
   ```
2. 設定ファイルを作る。どちらもコミットしない(`.gitignore` 済み)。
   ```bash
   cp terraform.tfvars.example terraform.tfvars      # project_id と billing_account を埋める
   cp backend.tfbackend.example backend.tfbackend    # bucket を埋める
   ```
   請求先アカウント ID は `gcloud billing projects describe <PROJECT_ID> --format="value(billingAccountName)"` の `billingAccounts/` より後ろです。
3. 初期化
   ```bash
   terraform init -backend-config=backend.tfbackend
   ```

## 変更の手順

```bash
terraform fmt -check
terraform validate
terraform plan -out=plan.tfplan   # 差分を人間が確認する
terraform apply plan.tfplan
terraform plan                    # 「No changes」になることを確認する
```

## 公開リポジトリなのでコミットしないもの

`terraform.tfvars`、`backend.tfbackend`、`*.tfstate`、`*.tfplan`、`.terraform/`、サービスアカウントキー。`.terraform.lock.hcl` はコミットします(provider の版を固定するため)。

## 注意

- 予算アラートは通知だけで、使用や課金を止めません。
- 予算の通貨は請求先アカウントの通貨と一致させる必要があります(このプロジェクトは JPY)。
- 利用者の ADC で予算を扱うため、provider に `billing_project` と `user_project_override = true` を設定しています。
