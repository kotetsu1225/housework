package com.task.infra.mail

import com.google.inject.Inject
import com.task.domain.mail.Mail
import com.task.domain.mail.MailSender
import jakarta.mail.Authenticator
import jakarta.mail.Message
import jakarta.mail.PasswordAuthentication
import jakarta.mail.Session
import jakarta.mail.Transport
import jakarta.mail.internet.InternetAddress
import jakarta.mail.internet.MimeMessage
import org.slf4j.LoggerFactory
import java.util.Properties

class SmtpMailSender @Inject constructor(
    private val config: SmtpConfig
) : MailSender {

    private val logger = LoggerFactory.getLogger(this::class.java)

    private val session: Session by lazy {
        val props = Properties().apply {
            put("mail.smtp.auth", "true")
            put("mail.smtp.starttls.enable", "true")
            put("mail.smtp.host", config.host)
            put("mail.smtp.port", config.port.toString())
            // タイムアウト設定
            put("mail.smtp.connectiontimeout", "10000")
            put("mail.smtp.timeout", "10000")
        }

        Session.getInstance(props, object : Authenticator() {
            override fun getPasswordAuthentication(): PasswordAuthentication {
                return PasswordAuthentication(config.username, config.password)
            }
        })
    }

    override fun send(mail: Mail) {
        try {
            val message = MimeMessage(session).apply {
                setFrom(InternetAddress(config.fromAddress, config.fromName, "UTF-8"))
                setRecipients(Message.RecipientType.TO, InternetAddress.parse(mail.to.value))
                subject = mail.subject
                setText(mail.body, "UTF-8")
            }

            Transport.send(message)
            logger.info("メール送信成功: to=${mail.to.value}, subject=${mail.subject}")
        } catch (e: Exception) {
            logger.error("メール送信失敗: to=${mail.to.value}, subject=${mail.subject}", e)
            // 本番では再試行キューに入れるなどの処理を検討
            throw e
        }
    }
}

/**
 * SMTP設定
 */
data class SmtpConfig(
    val host: String,
    val port: Int,
    val username: String,
    val password: String,
    val fromAddress: String,
    val fromName: String = "Housework App"
)

