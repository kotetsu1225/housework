package com.task.domain.mail

interface MailSender {
    fun send(mail: Mail)
    fun sendMultiple(mails: List<Mail>) {
        mails.forEach { send(it) }
    }
}
