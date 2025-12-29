import { useState, useEffect } from 'react'
import { UserPlus, CheckCircle2, Clock, TrendingUp, RefreshCw, Mail } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Input } from '../components/ui/Input'
import { ProgressRing } from '../components/ui/ProgressRing'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { RoleSelector } from '../components/ui/RoleSelector'
import { useMember } from '../hooks'
import { isParentRole } from '../utils'
import type { FamilyRole, Member } from '../types'

/**
 * メンバー統計情報（将来的にはAPIから取得）
 */
interface MemberStats {
  completed: number
  total: number
  streak: number
}

/**
 * 統計情報付きメンバー
 */
export interface MemberWithStats extends Member {
  stats: MemberStats
}

/**
 * 役割バッジコンポーネント
 */
function RoleBadge({ role }: { role: FamilyRole }) {
  return isParentRole(role) ? (
    <Badge variant="info" size="sm">親</Badge>
  ) : (
    <Badge variant="success" size="sm">子</Badge>
  )
}

/**
 * メンバーカードコンポーネント
 */
function MemberCard({ member }: { member: MemberWithStats }) {
  const completionRate =
    member.stats.total > 0
      ? Math.round((member.stats.completed / member.stats.total) * 100)
      : 0

  return (
    <Card variant="glass" hoverable>
      <div className="flex items-center gap-4">
        <Avatar
          name={member.name}
          size="xl"
          variant={isParentRole(member.role) ? 'parent' : 'child'}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-lg">{member.name}</span>
            <RoleBadge role={member.role} />
          </div>
          <div className="flex items-center gap-1 text-sm text-white/50 mb-1">
            <Mail className="w-3 h-3" />
            <span className="truncate">{member.email}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/50">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{member.stats.completed}完了</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>{member.stats.streak}日連続</span>
            </div>
          </div>
        </div>
        <ProgressRing progress={completionRate} size="sm" />
      </div>
    </Card>
  )
}

/**
 * 家族統計カードコンポーネント
 */
function FamilyStatsCard({ members }: { members: MemberWithStats[] }) {
  const totalCompleted = members.reduce((sum, m) => sum + m.stats.completed, 0)
  const totalTasks = members.reduce((sum, m) => sum + m.stats.total, 0)
  const maxStreak = members.length > 0
    ? Math.max(...members.map((m) => m.stats.streak))
    : 0
  const completionRate = totalTasks > 0
    ? Math.round((totalCompleted / totalTasks) * 100)
    : 0

  return (
    <Card variant="gradient" className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-shazam-500/10 rounded-full blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-shazam-400" />
          家族の実績
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{totalCompleted}</p>
            <p className="text-xs text-white/50">完了タスク</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400">{completionRate}%</p>
            <p className="text-xs text-white/50">完了率</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-400">{maxStreak}日</p>
            <p className="text-xs text-white/50">最長連続</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * メンバー一覧ページ
 */
export function Members() {
  // メンバー管理フック
  const { members, loading, error, fetchMembers, addMember, clearError } = useMember()

  // 統計情報付きメンバー（将来的には統計APIから取得）
  const membersWithStats: MemberWithStats[] = members.map((member) => ({
    ...member,
    stats: { completed: 0, total: 0, streak: 0 },
  }))

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
      // useMemberフックが内部でmembersを更新するので、
      // ここではモーダルを閉じるだけでOK
      handleCloseModal()
    }
  }

  // メールアドレスのバリデーション
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMemberEmail.trim())
  // パスワードのバリデーション（8文字以上）
  const isPasswordValid = newMemberPassword.trim().length >= 8

  return (
    <>
      <Header
        title="メンバー"
        subtitle={`${membersWithStats.length}人の家族`}
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

        {/* 家族全体の統計 */}
        <section className="py-4">
          <FamilyStatsCard members={membersWithStats} />
        </section>

        {/* メンバー一覧 */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4">メンバー一覧</h2>
          {/* モバイル: 縦並び、タブレット以上: グリッド */}
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            {membersWithStats.map((member) => (
              <MemberCard key={member.id} member={member} />
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
