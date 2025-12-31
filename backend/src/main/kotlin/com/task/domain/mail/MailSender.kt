package com.task.domain.mail

interface MailSender {
    fun send(mail: Mail)
    fun sendMultiple(mails: List<Mail>) {
        mails.forEach { mail ->
            try {
                send(mail)
            } catch (e: Exception) {
                // 個別のメール送信失敗は握りつぶし、残りのメールは送信を試みる
                // ログは各実装クラス（SendGridMailSender等）で出力済み
            }
        }
    }
}
