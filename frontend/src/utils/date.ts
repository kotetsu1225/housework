/**
 * 日付関連のユーティリティ関数
 */

import { format as dateFnsFormat } from 'date-fns'
import { ja } from 'date-fns/locale'

/**
 * 日付を日本語フォーマットで表示
 *
 * @param date - フォーマットする日付
 * @param formatStr - date-fnsフォーマット文字列
 * @returns フォーマットされた文字列
 *
 * @example
 * ```typescript
 * formatJa(new Date(), 'M月d日（E）') // "1月15日（月）"
 * ```
 */
export function formatJa(date: Date, formatStr: string): string {
  return dateFnsFormat(date, formatStr, { locale: ja })
}

/**
 * 日付をISO形式（YYYY-MM-DD）でフォーマット
 *
 * @param date - フォーマットする日付
 * @returns YYYY-MM-DD形式の文字列
 */
export function toISODateString(date: Date): string {
  return dateFnsFormat(date, 'yyyy-MM-dd')
}

