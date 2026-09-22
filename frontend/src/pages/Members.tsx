import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, RefreshCw, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { RoleSelector } from '../components/ui/RoleSelector'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useMembers } from '../hooks/useMembers'
import { isParentRole, formatJa } from '../utils'
import { getRoleLabel } from '../constants'
import type { FamilyRole, Member } from '../types'

/**
 * ランキングの表示文言（絵文字は使わない: frontend/DESIGN.md §6）
 */
export function getRankingMedal(rank: number): string {
  return `${rank}位`
}

/**
 * メンバーのランキングを計算（ポイント順）
 */
export function calculateMemberRank(members: Member[], memberId: string | undefined): number | null {
  if (!memberId) return null
  const rankedMembers = [...members].sort((a, b) => b.todayEarnedPoint - a.todayEarnedPoint)
  const rankIndex = rankedMembers.findIndex((m) => m.id === memberId)
  return rankIndex >= 0 ? rankIndex + 1 : null
}

/**
 * メンバーランキングカードコンポーネント
 */
interface MemberRankingCardProps {
  member: Member
  rank: number
  familyCompletionRate: number
  onClick: () => void
}

function MemberRankingCard({ member, rank, familyCompletionRate, onClick }: MemberRankingCardProps) {
  // 今日の完了数（個人タスク含む）
  const todayPersonalCompleted = Math.max(0, member.todayPersonalTaskCompleted)
  const todayCompletedCount = member.todayFamilyTaskCompleted + todayPersonalCompleted

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${member.name}の詳細を見る`}
      className="w-full text-left bg-surface rounded-xl pl-4 pr-3 py-3.5 flex items-center gap-3.5 active:bg-canvas transition-colors"
    >
      {/* 順位 */}
      <span
        className={clsx(
          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 tabular',
          rank === 1 ? 'bg-accent text-white' : 'bg-control text-ink-soft'
        )}
      >
        {rank}
      </span>

      {/* アバター */}
      <Avatar
        name={member.name}
        size="xl"
        role={member.role}
        variant={isParentRole(member.role) ? 'parent' : 'child'}
        className="w-14 h-14"
      />

      {/* メンバー情報 */}
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[17px] font-bold text-ink truncate">
          {member.name}{' '}
          <span className="text-[13px] font-normal text-ink-muted">{getRoleLabel(member.role)}</span>
        </span>
        <span className="text-[13px] text-ink-muted tabular">
          今日 {todayCompletedCount}件 · 家族 {member.todayFamilyTaskCompleted} · 個人 {todayPersonalCompleted}
        </span>
        <span className="flex items-center gap-2">
          <ProgressBar completed={familyCompletionRate} total={100} variant="bar" size="sm" className="flex-1" />
          <span className="text-xs text-ink-muted tabular whitespace-nowrap">家族タスク {familyCompletionRate}%</span>
        </span>
      </span>

      {/* 今日の獲得ポイント */}
      <span className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-xl font-bold text-accent tabular">
          {member.todayEarnedPoint}
          <span className="text-xs">pt</span>
        </span>
        <ChevronRight className="w-[18px] h-[18px] text-icon-muted" />
      </span>
    </button>
  )
}

/**
 * メンバー一覧ページ
 */
export function Members() {
  const navigate = useNavigate()

  // メンバー管理フック
  const { members, loading, error, fetchMembers, addMember, clearError } = useMembers()

  // 今日のポイント順でソートしたメンバー
  const rankedMembers = useMemo(() => {
    return [...members].sort((a, b) => b.todayEarnedPoint - a.todayEarnedPoint)
  }, [members])

  // 全メンバーの「今日の家族タスク完了数」合計を計算
  const familyCompletionTotal = useMemo(() => {
    return members.reduce((total, member) => total + (member.todayFamilyTaskCompleted || 0), 0)
  }, [members])

  // ランキング順に並んだメンバーごとの完了割合
  const familyCompletionRate = useMemo(() => {
    return rankedMembers.map((member) =>
      familyCompletionTotal > 0
        ? Math.round((member.todayFamilyTaskCompleted / familyCompletionTotal) * 100)
        : 0
    )
  }, [rankedMembers, familyCompletionTotal])

  // モーダル状態
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<FamilyRole>('FATHER')

  // 初回マウント時にAPIからメンバー一覧を取得
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // エラー時のトースト表示（5秒後に自動クリア）
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  /**
   * モーダルを閉じる
   */
  const handleCloseModal = () => {
    setShowAddModal(false)
    setNewMemberName('')
    setNewMemberEmail('')
    setNewMemberPassword('')
    setNewMemberRole('FATHER')
    clearError()
  }

  /**
   * メンバー追加ハンドラー
   */
  const handleAddMember = async () => {
    if (!newMemberName.trim() || !newMemberEmail.trim() || !newMemberPassword.trim()) return

    const success = await addMember(newMemberName, newMemberEmail, newMemberRole, newMemberPassword)

    if (success) {
      handleCloseModal()
    }
  }

  /**
   * メンバー詳細ページへ遷移
   */
  const handleMemberClick = (memberId: string) => {
    navigate(`/members/${memberId}`)
  }

  // メールアドレスのバリデーション
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMemberEmail.trim())
  // パスワードのバリデーション（8文字以上）
  const isPasswordValid = newMemberPassword.trim().length >= 8

  return (
    <>
      <Header
        title="メンバー"
        subtitle={`${members.length}人の家族`}
        action={
          <>
            <button
              type="button"
              onClick={fetchMembers}
              disabled={loading}
              aria-label="最新の状態に更新"
              className="w-11 h-11 rounded-full bg-surface text-accent flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-5 h-5', loading && 'animate-spin')} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-11 pl-3 pr-4 rounded-full bg-accent text-white text-[15px] font-bold flex items-center gap-1.5 active:bg-accent-strong"
            >
              <UserPlus className="w-[18px] h-[18px]" />
              追加
            </button>
          </>
        }
      />
      <PageContainer>
        {/* エラーメッセージ */}
        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {/* 今日のランキング */}
        <section>
          <div className="flex items-baseline justify-between px-1 pt-2 pb-2">
            <h2 className="text-[13px] font-medium text-ink-muted">今日のランキング</h2>
            <span className="text-[13px] text-ink-muted tabular">{formatJa(new Date(), 'M月d日')}</span>
          </div>
          <div className="space-y-2.5">
            {rankedMembers.map((member, index) => (
              <MemberRankingCard
                key={member.id}
                member={member}
                rank={index + 1}
                familyCompletionRate={familyCompletionRate[index]}
                onClick={() => handleMemberClick(member.id)}
              />
            ))}
          </div>
        </section>

        {/* 追加モーダル */}
        <Modal
          isOpen={showAddModal}
          onClose={handleCloseModal}
          title="新しいメンバーを追加"
          showCloseButton={false}
          footer={
            <>
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={handleCloseModal}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={handleAddMember}
                loading={loading}
                disabled={!newMemberName.trim() || !isEmailValid || !isPasswordValid}
              >
                追加
              </Button>
            </>
          }
        >
          {/* モーダル内エラー表示 */}
          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          <Input
            label="名前"
            placeholder="名前を入力"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
          />

          <Input
            label="メールアドレス"
            type="email"
            placeholder="example@mail.com"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
          />

          <Input
            label="パスワード"
            type="password"
            placeholder="8文字以上で入力"
            value={newMemberPassword}
            onChange={(e) => setNewMemberPassword(e.target.value)}
          />

          <RoleSelector
            value={newMemberRole}
            onChange={setNewMemberRole}
            disabled={loading}
          />
        </Modal>
      </PageContainer>
    </>
  )
}
