/**
 * 時刻関連のユーティリティ関数
 */

/**
 * HH:mm形式の時刻を本日のISO8601形式に変換
 * @param time HH:mm形式の時刻（例: "09:00"）
 * @returns ISO8601形式の日時文字列
 */
export function timeToISOString(time: string): string {
  const today = new Date()
  const [hours, minutes] = time.split(':').map(Number)
  today.setHours(hours, minutes, 0, 0)
  return today.toISOString()
}

/**
 * ISO8601形式の日時からHH:mm形式の時刻を取得
 * @param isoString ISO8601形式の日時文字列
 * @returns HH:mm形式の時刻
 */
export function formatTimeFromISO(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('ja-JP', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
}

/**
 * 2つの時刻の差分を分で計算
 * @param startTime HH:mm形式の開始時刻
 * @param endTime HH:mm形式の終了時刻
 * @returns 差分（分）
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startHours, startMinutes] = startTime.split(':').map(Number)
  const [endHours, endMinutes] = endTime.split(':').map(Number)
  
  const startTotalMinutes = startHours * 60 + startMinutes
  const endTotalMinutes = endHours * 60 + endMinutes
  
  return endTotalMinutes - startTotalMinutes
}

/**
 * 分数を「X時間Y分」形式に変換
 * @param minutes 分数
 * @returns フォーマット済み文字列
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`
}
