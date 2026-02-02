package com.task.usecase.query.notifications

import com.google.inject.ImplementedBy
import com.task.infra.query.NotificationTargetQueryServiceImpl
import com.task.usecase.task.SendDailyNotCompletedTaskNotificationsUseCase.NotificationForMember
import org.jooq.DSLContext
import java.time.LocalDate

/**
 * 通知対象タスクを取得するクエリサービス
 */
@ImplementedBy(NotificationTargetQueryServiceImpl::class)
interface NotificationTargetQueryService {

    /**
     * 対象日の未完了毎日タスク（Daily）をメンバーごとに取得する
     *
     * ロジック:
     * - 未完了の家族タスクが存在する場合 → 全メンバーに「家族タスク + 自分の個人タスク」
     * - 家族タスクが全て完了している場合 → 各メンバーに「自分の個人タスクのみ」
     *
     * 名前の取得元:
     * - NOT_STARTEDのタスク → TaskDefinition.name
     * - IN_PROGRESSのタスク → TaskSnapshot.frozenName
     *
     * @param session JOOQのDSLContext
     * @param targetDate 対象日（通常は当日）
     * @return メンバーごとの通知対象タスク名リスト（空のメンバーも含む）
     */
    fun fetchNotCompletedDailyTasks(
        session: DSLContext,
        targetDate: LocalDate,
    ): List<NotificationForMember>
}
