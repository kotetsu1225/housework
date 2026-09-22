/**
 * 周期チップの文言（タスク定義ID → 毎日／毎週火曜／9/22）を取得するフック
 *
 * 実行系の DTO（TodayTaskDto / CompletedTaskDto）は周期の詳細を持たないため、
 * タスク定義を一度だけ取得して文言に変換する。取得に失敗しても画面は
 * 日付／「定期」のフォールバックで表示できるので、エラーは表に出さない。
 */
import { useEffect, useState } from 'react'
import { getTaskDefinitions } from '../api'
import { formatScheduleDtoLabel } from '../utils/scheduleLabel'

export type ScheduleLabels = Record<string, string>

export function useScheduleLabels(): ScheduleLabels {
  const [labels, setLabels] = useState<ScheduleLabels>({})

  useEffect(() => {
    let cancelled = false
    getTaskDefinitions()
      .then((res) => {
        if (cancelled) return
        const next: ScheduleLabels = {}
        for (const def of res.taskDefinitions) {
          next[def.id] = formatScheduleDtoLabel(def.schedule)
        }
        setLabels(next)
      })
      .catch(() => {
        // フォールバック表示に任せる
      })
    return () => {
      cancelled = true
    }
  }, [])

  return labels
}
