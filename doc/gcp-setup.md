# GCP セットアップ手順(#69 / #73)

housework の outbox を GCP Pub/Sub 経由にするための、GCP 側の準備手順です。人間(リポジトリオーナー)が手で行う作業と、AI エージェントが行う作業を分けて書いています。

- 対象 issue: #69(プロジェクトと Terraform の土台)、#70(Pub/Sub リソース)、#73(本番導入・キーのローテーション)
- 人間チェックポイント: handoff の H2(この文書の §3)、H3(§7)、H7(#73)
- 確認日: 2026-09-24。引用はすべて Google Cloud / HashiCorp の公式ドキュメントから取っています。

---

## 0. このプロジェクトの実際の状態(2026-09-26 確認)

| 項目 | 状態 |
|---|---|
| プロジェクト | 作成済み。ID はプロジェクト番号とともに `infra/terraform/terraform.tfvars` にある(公開リポジトリなのでコミットしない) |
| 請求先アカウント | 通常の請求先アカウント(通貨 JPY)。**無料トライアルのクレジットは無い**(オーナー確認)。他の GCP プロジェクトと共有している |
| gcloud / ADC | ログイン済み |
| Terraform の state バケット | 作成済み(東京リージョン、非公開、バージョニング有効) |

**トライアルが無いことの影響**:
- §1.1 と §6 の「90 日で止まる」問題は、このプロジェクトには当てはまらない。期限は無い。
- Always Free(Pub/Sub は月 10 GiB まで無料)は最初から適用される。無料枠を超えた分と無料枠の対象外の利用(東京の state バケットなど、ごく少額)は、そのまま登録済みの支払い方法に請求される。
- 請求先アカウントを他のプロジェクトと共有しているので、予算アラートはこのプロジェクトだけに絞る(`infra/terraform/main.tf` の `budget_filter`)。
- 推測: 同じ Google アカウントで以前から GCP を使っているため、公式の条件 "You've never been a paying user of Google Cloud" を満たさず、トライアルの対象外になった。

## 1. 始める前に知っておくこと

### 1.1 無料トライアルは 90 日で終わり、そのままだとリソースが止まって消える

(このプロジェクトはトライアルを使っていないので当てはまらない。§0 を参照。トライアルで始める場合のために残している)

無料トライアルの条件(公式):

> "Signing up for the Free Trial creates a Free Trial billing account that is preloaded with $300 in free Welcome credit which is valid for 90 days."
> "You're eligible for the Free Trial when both of the following are true: You've never been a paying user of Google Cloud, Google Maps Platform, or Firebase. You haven't previously signed up for the Free Trial."
> "You will not be billed for any Google Cloud usage during your Free Trial."

トライアルが終わったとき(公式):

> "All resources you created during the trial are stopped. Further, any data you stored in services like Compute Engine is marked for deletion and might be lost."
> "If your Free Trial ends because 90 days pass or $300 credit is exhausted, then your Free Trial account enters a 30-day grace period: If you upgrade to a Paid billing account during this 30-day grace period, then you might be able to recover your stopped resources and data. Otherwise, your Free Trial resources are permanently deleted."

Always Free(無料枠)を使い続ける条件(公式):

> "A Google Cloud billing account is required to access the Google Cloud Free Tier."
> "[Pub/Sub](/pubsub/docs): 10 GiB of messages per month."

出典: https://docs.cloud.google.com/free/docs/free-cloud-features

**つまり**: 「トライアル終了後も Pub/Sub は月 10 GiB まで無料」は、**有料の請求先アカウントへアップグレードした場合に限り**成り立ちます。アップグレードしないと、90 日後に Pub/Sub の topic / subscription が止まり、本番の outbox リレー(#72)と subscriber(#61)が動かなくなります。アップグレード後は、無料枠を超えた分だけが登録したカードに請求されます。

### 1.2 予算アラートは「通知」であって「上限」ではない

> "Setting an alerts-only budget doesn't automatically cap Google Cloud or Google Maps Platform usage or spending."

出典: https://docs.cloud.google.com/billing/docs/how-to/budgets

#69 で作る予算アラート(月 ¥1,000 相当で 50% / 90% / 100%)は、使いすぎに気づくための仕組みです。自動で止まるわけではありません。通知メールは既定で請求先アカウントの管理者と利用者に届きます(同ページ)。

### 1.3 state 用バケットを東京に置くと無料枠の対象外

> "The Free Tier benefits for Cloud Storage apply only to usage in the us-east1, us-west1, and us-central1 regions."

出典: https://docs.cloud.google.com/free/docs/free-cloud-features

Terraform の state ファイルは数 KB〜数十 KB なので、東京(`asia-northeast1`)に置いても料金は実質ゼロに近い見込みです。ただし無料枠の対象ではありません。この手順では #69 の決定どおり `asia-northeast1` に置きます。

### 1.4 公開リポジトリなので、コミットしてはいけないもの

このリポジトリは PUBLIC です。次のものは絶対にコミットしません。

- `*.tfstate`(Terraform の状態。リソースの詳細が入る)
- `*.tfvars`(プロジェクト ID 以外に請求先アカウント ID などを入れる)
- サービスアカウントキーの JSON(#73 で発行する)
- 請求先アカウント ID、カード情報、トライアルの管理画面のスクリーンショット

`.gitignore` への追加は #69 の PR で行います。

---

## 2. 事前に決める値

| 項目 | 決め方 | 候補・既定値 |
|---|---|---|
| 使う Google アカウント | 個人の Google アカウントを推奨。学校の Google Workspace アカウントは管理者の設定で GCP や課金が制限されていることがある | 本人が決める |
| プロジェクト ID | 下の規則を満たし、**後から変更できない** | `housework-prod` → 取られていれば `housework-prod-26` → `housework-prod-2609` |
| プロジェクト名 | 表示用。後から変更できる | `housework` |
| リージョン | #34 の共通契約 | `asia-northeast1`(東京) |
| state 用バケット名 | 世界で一意 | `<プロジェクトID>-tfstate` |
| 予算の金額と通貨 | 通貨は請求先アカウントの通貨に合わせる(§3 の手順 3 で確認) | 月 ¥1,000(JPY の場合)/ 7 USD 前後(USD の場合) |

プロジェクト ID の規則(公式):

> "It can only contain lowercase letters, numbers, and hyphens... It must be 6 to 30 characters in length."
> "It must start with a letter." / "It cannot end with a hyphen."
> "It cannot be in use or previously used; this includes deleted projects."
> "After project creation, the project ID is permanent."
> "Don't include sensitive information, for example, personally identifiable information or security data, in your project name, project ID, or other resource names."

出典: https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects

氏名や学籍番号をプロジェクト ID に入れないでください。

予算の通貨について(Terraform の `google_billing_budget` の公式ドキュメント):

> "currencyCode is optional. If specified, it must match the currency of the billing account."

出典: https://github.com/hashicorp/terraform-provider-google/blob/main/website/docs/r/billing_budget.html.markdown

#69 の本文には「USD 指定」とありますが、日本で作った請求先アカウントの通貨が JPY なら、USD を指定するとエラーになります。手順 3 で通貨を確認してから決めます。

---

## 3. 人間がやる手順(H2)

所要時間の目安は 20〜30 分です。クレジットカードを手元に用意してください。

### 手順 1. 無料トライアルを始める(ブラウザ)

1. https://cloud.google.com/free を開き、「無料で開始」から、使う Google アカウントでサインインする。
2. 国(日本)、利用規約への同意、支払い情報(クレジットカード)を入力する。トライアル中は請求されません(§1.1 の引用)。
3. 完了したら、**開始日を下の記録欄に書く**。終了予定日は開始日 + 90 日、猶予期限は終了予定日 + 30 日です。

### 手順 2. プロジェクトを作る(ブラウザ)

1. https://console.cloud.google.com/projectcreate を開く。
2. 「プロジェクト名」に `housework`、「プロジェクト ID」の「編集」を押して §2 の候補を入れる。使えない ID は画面で指摘されるので、次の候補にする。
3. 「請求先アカウント」に、手順 1 で作られた無料トライアルの請求先アカウントを選ぶ。
4. 作成する。

トライアル開始時に自動で「My First Project」が作られることがあります。使わないので放置して構いません。

### 手順 3. 請求先アカウントの通貨を確認する(ブラウザ)

1. https://console.cloud.google.com/billing を開き、手順 1 の請求先アカウントを選ぶ。
2. 「アカウント管理」などの画面で通貨(JPY または USD)を確認し、記録欄に書く。

### 手順 4. このマシンの gcloud にログインする(ターミナル)

`gcloud` は AI がインストール済みです(Homebrew の `gcloud-cli`)。次のコマンドは**ブラウザでの承認が必要なので、あなた自身のターミナルで**実行してください。Claude Code の入力欄で先頭に `!` を付けて実行しても構いません。

```bash
# 1) gcloud コマンド用のログイン(ブラウザが開く)
gcloud auth login

# 2) 既定のプロジェクトを設定(<PROJECT_ID> は手順 2 で決めた ID)
gcloud config set project <PROJECT_ID>

# 3) Terraform などのライブラリが使う認証情報(Application Default Credentials)のログイン(ブラウザが開く)
gcloud auth application-default login

# 4) ADC の課金・クォータを、このプロジェクトに紐付ける
gcloud auth application-default set-quota-project <PROJECT_ID>
```

ここまで終わったら、AI に「手順 4 まで終わった。プロジェクト ID は ○○、通貨は ○○、トライアル開始日は ○○」と伝えてください。請求先アカウント ID は AI がコマンドで取得するので、チャットに貼る必要はありません。

### 記録欄(手順 1〜3 で埋める)

| 項目 | 値 |
|---|---|
| トライアル開始日 | なし(トライアルのクレジットが無い通常の請求先アカウント。§0) |
| トライアル終了予定日(開始日 + 90 日) | 該当なし |
| 猶予期限(終了予定日 + 30 日。これを過ぎるとリソースが完全に削除される) | 該当なし |
| プロジェクト ID | 記録済み(`infra/terraform/terraform.tfvars`。コミットしない) |
| 請求先アカウントの通貨 | JPY |
| アップグレード判断の期限(§6) | 該当なし |

---

## 4. AI がやる手順(#69)

人間の手順 4 が終わった後に AI が行います。各コマンドの結果は PR に記録します。

1. 認証とプロジェクトの確認: `gcloud config list`、`gcloud projects describe <PROJECT_ID>`(プロジェクト番号を取得)、`gcloud billing projects describe <PROJECT_ID>`(課金が有効か)。
2. 起動に必要な API の確認と有効化: `gcloud services list --enabled` を見て、足りなければ `serviceusage.googleapis.com`、`cloudresourcemanager.googleapis.com`、`storage.googleapis.com` を `gcloud services enable` で有効化する。残りの API(`pubsub`、`iam`、`billingbudgets`)は Terraform で有効化する(#69 のスコープ)。
3. state 用バケットの作成(Terraform より前に手で作る唯一のリソース。#69 の決定):
   ```bash
   gcloud storage buckets create gs://<PROJECT_ID>-tfstate \
     --project=<PROJECT_ID> --location=asia-northeast1 \
     --uniform-bucket-level-access --public-access-prevention
   gcloud storage buckets update gs://<PROJECT_ID>-tfstate --versioning
   ```
4. `infra/terraform/` に土台を作る: `backend "gcs"`、`google` provider、変数 `project_id` / `region` / `billing_account` / `budget_amount` / `budget_currency`、API の有効化、予算アラート。
   - 予算リソースを利用者の ADC で作る場合の注意(公式): "If you are using User ADCs with this resource, you must specify a billing_project and set user_project_override to true in the provider configuration. Otherwise the Billing Budgets API will return a 403 error."(上記 Terraform ドキュメント)
5. `terraform init` → `terraform plan` の結果を人間に見せ、承認を得てから `terraform apply`。もう一度 `terraform plan` して差分なしを確認する(#69 の受け入れ条件)。
6. GCP コンソールの「予算とアラート」で予算が見えることを、人間と一緒に確認する。

`terraform.tfvars`(請求先アカウント ID などを入れる)は `infra/terraform/` に置きますが、コミットしません。代わりに値を空にした `terraform.tfvars.example` をコミットします。

---

## 5. サービスアカウントキーの発行とローテーション(#73 で追記)

#70 で作るアプリ用サービスアカウントのキーを発行し、Railway に登録する手順(人間チェックポイント H3)。#73 の作業時にここへ追記します。方針だけ先に書いておきます。

- キーは `gcloud iam service-accounts keys create` で発行し、Railway の backend サービスの環境変数に登録したら、**ローカルのファイルはすぐ削除する**。
- ローテーションは「新しいキーを発行 → Railway を更新 → 動作確認 → 古いキーを削除」の順。

---

## 6. トライアル終了前の判断(#73 のスコープ 5)

(このプロジェクトはトライアルを使っていないので判断は不要。§0 を参照)

§1.1 のとおり、アップグレードしないと 90 日後に Pub/Sub が止まり、30 日の猶予の後に削除されます。「Always Free の範囲で運用を続ける」には、有料の請求先アカウントへのアップグレードが前提です。

終了予定日の 10 日前までに、次のどちらかを決めてください。

| 選択肢 | 起きること |
|---|---|
| A. 有料アカウントへアップグレードする | Pub/Sub は動き続ける。無料枠(月 10 GiB)を超えた分と、無料枠の対象外の利用(東京の state バケットなど、ごく少額)がカードに請求される。残っているクレジットは引き継がれる |
| B. アップグレードしない | 90 日後に Pub/Sub が止まる。その前に本番の `PUBSUB_ENABLED=false` にして、outbox を旧方式(アプリ内のポーリング処理)に戻す必要がある。#72 / #61 がその切り戻しに対応しているかを事前に確認する |

アップグレードの操作(公式): コンソールの請求先アカウントの画面から行う。詳しくは https://docs.cloud.google.com/free/docs/free-cloud-features の "Upgrade to a paid billing account" の節を参照。
