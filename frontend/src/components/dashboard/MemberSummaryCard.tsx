/**
 * メンバーサマリーカードコンポーネント
 *
 * 各メンバーのタスク進捗を表示するコンパクトなカード
 */

import { Card } from '../ui/Card'
import { Avatar } from '../ui/Avatar'
import { isParentRole } from '../../utils'
import type { Member } from '../../types'

/**
 * MemberSummaryCardコンポーネントのProps
 */
export interface MemberSummaryCardProps {
  /** メンバー情報 */
  member: Member
  /** 完了タスク数 */
  completedCount: number
  /** 総タスク数（このメンバーに割り当てられたタスク） */
  totalCount: number
  /** カードクリック時のハンドラ */
  onClick?: (member: Member) => void
}

/**
 * メンバーサマリーカードコンポーネント
 *
 * Dashboard画面の下部に横スクロールで表示されるメンバー一覧
 *
 * @example
 * ```tsx
 * <MemberSummaryCard
 *   member={member}
 *   completedCount={2}
 *   totalCount={3}
 *   onClick={(m) => navigate(`/members/${m.id}`)}
 * />
 * ```
 */
export function MemberSummaryCard({
  member,
  completedCount,
  totalCount,
  onClick,
}: MemberSummaryCardProps) {
  const handleClick = () => {
    onClick?.(member)
  }

  return (
    <Card
      variant="glass"
      className="flex-shrink-0 w-28 text-center cursor-pointer hover:bg-dark-700/50 transition-colors"
      onClick={handleClick}
    >
      <div className="flex flex-col items-center gap-2">
        <Avatar
          name={member.name}
          size="lg"
          role={member.role}
          variant={isParentRole(member.role) ? 'parent' : 'child'}
        />
        <span className="font-medium text-white truncate w-full">{member.name}</span>
        <span className="text-xs text-white/50">
          {totalCount > 0 ? `${completedCount}/${totalCount}完了` : 'タスクなし'}
        </span>
      </div>
    </Card>
  )
}

