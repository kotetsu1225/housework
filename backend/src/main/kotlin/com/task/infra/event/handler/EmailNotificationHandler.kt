package com.task.infra.event.handler

import com.task.domain.event.DomainEvent
import com.task.domain.event.DomainEventHandler
import com.task.domain.mail.Mail
import com.task.domain.mail.MailSender
import com.task.domain.member.MemberRepository
import com.task.domain.taskExecution.event.TaskExecutionCancelled
import com.task.domain.taskExecution.event.TaskExecutionCompleted
import com.task.domain.taskExecution.event.TaskExecutionCreated
import com.task.domain.taskExecution.event.TaskExecutionEvent
import com.task.domain.taskExecution.event.TaskExecutionStarted
import org.jooq.DSLContext
import org.slf4j.LoggerFactory
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import com.google.inject.Inject

class EmailNotificationHandler @Inject constructor(
    private val mailSender: MailSender,
    private val memberRepository: MemberRepository
) : DomainEventHandler<DomainEvent> {

    override val eventType: Class<DomainEvent> = DomainEvent::class.java

    private val logger = LoggerFactory.getLogger(EmailNotificationHandler::class.java)

    private val timeFormatter = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm")
        .withZone(ZoneId.systemDefault())

    override fun handle(event: DomainEvent, session: DSLContext) {
        if (event !is TaskExecutionEvent) return

        // 全メンバー取得
        val allMembers = memberRepository.findAll(session)

        // メール作成処理
        val mails = when (event) {
            is TaskExecutionCreated -> {
                // 作成時は担当者以外全員に通知（担当者がいれば）
                val senderId = event.assigneeMemberId // 作成者IDがイベントにないため、暫定的に担当者を除外
                val targetMembers = allMembers.filter { it.id != senderId }
                
                targetMembers.map { member ->
                    Mail(
                        to = member.email,
                        subject = "【タスク追加】${event.taskName.value}",
                        body = """
                            新しいタスクが追加されました。
                            タスク: ${event.taskName.value}
                            日時: ${timeFormatter.format(event.occurredAt)}
                        """.trimIndent()
                    )
                }
            }
            is TaskExecutionStarted -> {
                // 開始した人（担当者）以外に通知
                val targetMembers = allMembers.filter { it.id != event.assigneeMemberId }

                targetMembers.map { member ->
                    Mail(
                        to = member.email,
                        subject = "【開始】${event.taskName.value}",
                        body = """
                            タスクが開始されました。
                            タスク: ${event.taskName.value}
                            日時: ${timeFormatter.format(event.occurredAt)}
                        """.trimIndent()
                    )
                }
            }
            is TaskExecutionCompleted -> {
                // 完了した人以外に通知
                val targetMembers = allMembers.filter { it.id != event.completedByMemberId }

                targetMembers.map { member ->
                    Mail(
                        to = member.email,
                        subject = "【完了！】${event.taskName.value}", // TaskNameがイベントにないため修正が必要
                        body = """
                            タスクが完了しました！
                            日時: ${timeFormatter.format(event.occurredAt)}
                        """.trimIndent()
                    )
                }
            }
            is TaskExecutionCancelled -> {
                 // 全員に通知（誰がキャンセルしたかイベントに情報がないため）
                 // 本来はキャンセル操作者を除外したいが、情報不足のため全員通知
                 allMembers.map { member ->
                    Mail(
                        to = member.email,
                        subject = "【キャンセル】タスクがキャンセルされました",
                        body = """
                            タスクがキャンセルされました。
                            ID: ${event.taskExecutionId.value}
                            日時: ${timeFormatter.format(event.occurredAt)}
                        """.trimIndent()
                    )
                }
            }
        }

        if (mails.isNotEmpty()) {
            try {
                mailSender.sendMultiple(mails)
            } catch (e: Exception) {
                // メール送信失敗はログに記録するが、メイン処理は継続
                logger.error("メール通知の送信に失敗しましたが、処理は継続します", e)
            }
        }
    }
}
