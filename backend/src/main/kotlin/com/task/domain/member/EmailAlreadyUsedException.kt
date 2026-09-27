package com.task.domain.member

/**
 * 登録しようとしたメールアドレスが既に使われている場合の例外。
 *
 * サインアップ(`POST /api/auth/register`、#44)と、認証済みメンバーによる
 * 2人目以降のメンバー作成(`POST /api/member/create`、#51)の両方から
 * 投げられる共通の例外として切り出している。
 * `Application.kt` の StatusPages でこの例外を捕まえ、HTTP 409 Conflict にマッピングする。
 */
class EmailAlreadyUsedException : RuntimeException("このメールアドレスは既に登録されています")
