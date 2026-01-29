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
        val memberNameById = allMembers.associateBy({ it.id }, { it.name.value })

        // メール作成処理
        val mails = when (event) {
            is TaskExecutionCreated -> {
                // タスク作成時は通知不要
                emptyList()
            }
            is TaskExecutionStarted -> {
                // 開始した人（担当者）以外に通知
                val targetMembers = allMembers.filter { it.id !in event.assigneeMemberIds }
                val starterNames = event.assigneeMemberIds.mapNotNull { memberNameById[it] }
                val starterText = if (starterNames.isNotEmpty()) starterNames.joinToString("、") else "不明"

                targetMembers.map { member ->
                    Mail(
                        to = member.email,
                        subject = "【開始】${event.taskName.value}",
                        body = """
                            タスクが開始されました。
                            タスク: ${event.taskName.value}
                            開始した人: $starterText
                            日時: ${timeFormatter.format(event.occurredAt)}
                        """.trimIndent()
                    )
                }
            }
            is TaskExecutionCompleted -> {
                // 完了した人（担当者）以外に通知
                val targetMembers = allMembers.filter { it.id !in event.assigneeMemberIds }
                val completerNames = event.assigneeMemberIds.mapNotNull { memberNameById[it] }
                val completerText = if (completerNames.isNotEmpty()) completerNames.joinToString("、") else "不明"

                targetMembers.map { member ->
                    Mail(
                        to = member.email,
                        subject = "【完了！】${event.taskName.value}",
                        body = """
                            タスクが完了しました！
                            完了した人: $completerText
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
