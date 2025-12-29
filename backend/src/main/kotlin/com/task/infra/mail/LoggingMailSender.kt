package com.task.infra.mail

import com.task.domain.mail.Mail
import com.task.domain.mail.MailSender
import org.slf4j.LoggerFactory

class LoggingMailSender : MailSender {
    private val logger = LoggerFactory.getLogger(this::class.java)

    override fun send(mail: Mail) {
        // 開発環境向けにログに出力するだけ
        logger.info("=== EMAIL SENT ===")
        logger.info("To: ${mail.to.value}")
        logger.info("Subject: ${mail.subject}")
        logger.info("Body:\n${mail.body}")
        logger.info("==================")
    }
}
