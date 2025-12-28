package com.task.domain

import java.time.ZoneId

/**
 * アプリケーション全体で使用するタイムゾーン定義
 *
 * 家事管理アプリは日本国内での使用を想定しているため、
 * Asia/Tokyoを明示的に指定する。
 *
 * systemDefault()を避ける理由:
 * - Docker/クラウド環境ではUTCになることが多い
 * - 環境依存の挙動を避け、一貫性を保つ
 */
object AppTimeZone {
    val ZONE: ZoneId = ZoneId.of("Asia/Tokyo")
}
