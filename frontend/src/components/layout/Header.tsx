import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { clsx } from 'clsx'

export interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  action?: ReactNode
  /** 背景を敷かない（画面の背景に溶け込ませる） */
  transparent?: boolean
}

/**
 * 画面ヘッダー（frontend/DESIGN.md §3）
 *
 * - 戻るボタンが無い画面: サブタイトル（13px）の下に大見出し 34px
 * - 戻るボタンがある画面: 44px の戻るボタン + 小見出し 22px、サブタイトルはその下
 * - 右端に action（44px の丸ボタンなど）
 */
export function Header({ title, subtitle, showBack = false, action, transparent = false }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 safe-top',
        transparent ? 'bg-transparent' : 'bg-canvas'
      )}
    >
      <div
        className={clsx(
          'flex items-end justify-between gap-3 px-4 md:px-6 lg:px-8 max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto',
          showBack ? 'pt-2 pb-2 items-center' : 'pt-3 pb-3'
        )}
      >
        {showBack ? (
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-11 h-11 -ml-3 flex items-center justify-center rounded-full text-accent hover:bg-control transition-colors flex-shrink-0"
              aria-label="戻る"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold text-ink leading-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-[13px] text-ink-muted tabular">{subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            {subtitle && (
              <p className="text-[13px] font-medium text-ink-muted tabular">{subtitle}</p>
            )}
            <h1 className="text-[34px] font-bold text-ink leading-[1.15] tracking-tight truncate">{title}</h1>
          </div>
        )}
        {action && <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">{action}</div>}
      </div>
    </header>
  )
}
