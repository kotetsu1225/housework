import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, RefreshCw, Trophy, Star, ChevronRight, CheckCircle2, Users, User } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Avatar } from '../components/ui/Avatar'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { RoleSelector } from '../components/ui/RoleSelector'
import { ProgressRing } from '../components/ui/ProgressRing'
import { useMembers } from '../hooks/useMembers'
import { isParentRole } from '../utils'
import { getRoleLabel } from '../constants'
import type { FamilyRole, Member } from '../types'

/**
 * ランキングメダルを取得
 */
export function getRankingMedal(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇'
    case 2:
      return '🥈'
    case 3:
      return '🥉'
    default:
      return `${rank}`
  }
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
  const todayPersonalCompleted = member.todayPersonalTaskCompleted
  const todayCompletedCount = member.todayFamilyTaskCompleted + todayPersonalCompleted

  return (
    <div
      onClick={onClick}
      className="bg-dark-800/50 backdrop-blur-sm rounded-2xl p-4 border border-dark-700/50 cursor-pointer transition-all hover:border-coral-500/30 hover:scale-[1.01]"
    >
      <div className="flex items-center gap-3">
        {/* ランキング */}
        <div className="flex-shrink-0 w-8 text-center">
          <span className={`text-xl ${rank <= 3 ? '' : 'text-white/50 text-base'}`}>
            {getRankingMedal(rank)}
          </span>
        </div>

        {/* アバター */}
        <Avatar
          name={member.name}
          size="lg"
          role={member.role}
          variant={isParentRole(member.role) ? 'parent' : 'child'}
        />

        {/* メンバー情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white truncate">{member.name}</span>
            <span className="text-xs text-white/50">({getRoleLabel(member.role)})</span>
          </div>
          
          {/* 今日の獲得ポイント */}
          <div className="flex items-center gap-1 text-amber-400 font-bold text-sm mb-2">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>{member.todayEarnedPoint}pt</span>
          </div>

          {/* 完了数の内訳 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              今日 {todayCompletedCount}件
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-400" />
              家族 {member.todayFamilyTaskCompleted}件
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 text-emerald-400" />
              個人 {todayPersonalCompleted > 0 ? todayPersonalCompleted : 0}件
            </span>
          </div>
        </div>

        {/* 家族タスク完了率（円グラフ） */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <ProgressRing progress={familyCompletionRate} size="sm" />
          <span className="text-[10px] text-white/50 mt-1">家族タスク</span>
        </div>

        <ChevronRight className="w-5 h-5 text-white/30 flex-shrink-0" />
      </div>
    </div>
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
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchMembers}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              <UserPlus className="w-4 h-4 mr-1" />
              追加
            </Button>
          </div>
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
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            今日のランキング
          </h2>
          <div className="space-y-3">
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
                className="flex-1"
                onClick={handleCloseModal}
                disabled={loading}
              >
                キャンセル
              </Button>
              <Button
                variant="primary"
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
            <Alert variant="error" className="mb-4">
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

          <p className="text-xs text-white/50">
            追加したメンバーは、ここで設定したメールアドレスとパスワードでログインします。
          </p>

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
