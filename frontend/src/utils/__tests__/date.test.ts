/**
 * 日付ユーティリティ関数のテスト
 */

import { describe, it, expect } from 'vitest'
import { formatJa, toISODateString } from '../date'

describe('date utilities', () => {
  describe('formatJa', () => {
    it('日付を日本語フォーマットで表示する（月日曜日）', () => {
      // 2024年1月15日（月曜日）
      const date = new Date(2024, 0, 15)
      const result = formatJa(date, 'M月d日（E）')
      expect(result).toBe('1月15日（月）')
    })

    it('日付を日本語フォーマットで表示する（年月日）', () => {
      const date = new Date(2024, 11, 25)
      const result = formatJa(date, 'yyyy年M月d日')
      expect(result).toBe('2024年12月25日')
    })

    it('時刻を日本語フォーマットで表示する', () => {
      const date = new Date(2024, 0, 15, 14, 30)
      const result = formatJa(date, 'H時m分')
      expect(result).toBe('14時30分')
    })

    it('曜日を正しく表示する', () => {
      // 各曜日をテスト
      const monday = new Date(2024, 0, 15) // 月曜日
      const tuesday = new Date(2024, 0, 16) // 火曜日
      const wednesday = new Date(2024, 0, 17) // 水曜日
      const thursday = new Date(2024, 0, 18) // 木曜日
      const friday = new Date(2024, 0, 19) // 金曜日
      const saturday = new Date(2024, 0, 20) // 土曜日
      const sunday = new Date(2024, 0, 21) // 日曜日

      expect(formatJa(monday, 'EEEE')).toBe('月曜日')
      expect(formatJa(tuesday, 'EEEE')).toBe('火曜日')
      expect(formatJa(wednesday, 'EEEE')).toBe('水曜日')
      expect(formatJa(thursday, 'EEEE')).toBe('木曜日')
      expect(formatJa(friday, 'EEEE')).toBe('金曜日')
      expect(formatJa(saturday, 'EEEE')).toBe('土曜日')
      expect(formatJa(sunday, 'EEEE')).toBe('日曜日')
    })

    it('短い曜日表記を正しく表示する', () => {
      const monday = new Date(2024, 0, 15)
      expect(formatJa(monday, 'E')).toBe('月')
    })
  })

  describe('toISODateString', () => {
    it('日付をYYYY-MM-DD形式に変換する', () => {
      const date = new Date(2024, 0, 15)
      expect(toISODateString(date)).toBe('2024-01-15')
    })

    it('月と日が1桁の場合ゼロパディングする', () => {
      const date = new Date(2024, 0, 5) // 1月5日
      expect(toISODateString(date)).toBe('2024-01-05')
    })

    it('12月の日付を正しく変換する', () => {
      const date = new Date(2024, 11, 31) // 12月31日
      expect(toISODateString(date)).toBe('2024-12-31')
    })

    it('年初の日付を正しく変換する', () => {
      const date = new Date(2024, 0, 1) // 1月1日
      expect(toISODateString(date)).toBe('2024-01-01')
    })
  })
})

