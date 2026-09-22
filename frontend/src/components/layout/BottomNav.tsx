import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import { Home, ListTodo, Users } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'ホーム' },
  { to: '/tasks', icon: ListTodo, label: 'タスク' },
  { to: '/members', icon: Users, label: 'メンバー' },
]

/**
 * ボトムナビゲーション（frontend/DESIGN.md §5）
 *
 * 白い面・上に線・高さ 63px + セーフエリア。選択中は accent。
 *
 * レスポンシブ対応:
 * - モバイル: max-w-lg
 * - タブレット/デスクトップ: max-w-2xl/max-w-4xl
 */
export function BottomNav() {
  return (
    <nav
      aria-label="メイン"
      className="fixed bottom-0 left-0 right-0 bg-surface border-t border-line-strong safe-bottom z-50"
    >
      <div className="flex items-stretch justify-around h-[63px] max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto px-2 md:px-6 lg:px-8">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center gap-[3px] min-w-tap transition-colors duration-150',
                isActive ? 'text-accent' : 'text-ink-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-[26px] h-[26px]" strokeWidth={isActive ? 2.2 : 2} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
