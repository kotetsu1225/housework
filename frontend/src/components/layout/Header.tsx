import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { clsx } from 'clsx'

export interface HeaderProps {
  title: string
  subtitle?: string
  showBack?: boolean
  action?: ReactNode
  transparent?: boolean
}

export function Header({ title, subtitle, showBack = false, action, transparent = false }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 safe-top',
        transparent
          ? 'bg-transparent'
          : 'bg-dark-950/90 backdrop-blur-lg border-b border-dark-800'
      )}
    >
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-dark-800 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-xs text-dark-400">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  )
}
