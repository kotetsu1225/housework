import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { Home, ListTodo, Users, Clock } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'ホーム' },
  { to: '/tasks', icon: ListTodo, label: 'タスク' },
  { to: '/members', icon: Users, label: 'メンバー' },
  { to: '/availability', icon: Clock, label: '空き時間' },
]

/**
 * ボトムナビゲーション
 *
 * レスポンシブ対応:
 * - モバイル: max-w-lg
 * - タブレット/デスクトップ: max-w-2xl/max-w-4xl
 */
export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-900/90 backdrop-blur-lg border-t border-dark-800 safe-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center gap-1 w-16 py-2 rounded-xl transition-all duration-200',
                isActive
                  ? 'text-coral-400'
                  : 'text-dark-400 hover:text-dark-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={clsx(
                    'p-2 rounded-xl transition-all duration-200',
                    isActive && 'bg-coral-500/20'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
