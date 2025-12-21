import { useState } from 'react'
import { UserPlus, CheckCircle2, Clock, TrendingUp } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Input } from '../components/ui/Input'
import { ProgressRing } from '../components/ui/ProgressRing'
import type { Member, FamilyRole } from '../types'
import { clsx } from 'clsx'

const isParentRole = (role: FamilyRole): boolean => {
  return role === 'FATHER' || role === 'MOTHER'
}

const roleOptions: { value: FamilyRole; label: string; icon: string }[] = [
  { value: 'FATHER', label: '父', icon: '/familyIcons/father.svg.jpg' },
  { value: 'MOTHER', label: '母', icon: '/familyIcons/mother.svg.jpg' },
  { value: 'BROTHER', label: '兄弟', icon: '/familyIcons/brother.svg.jpg' },
  { value: 'SISTER', label: '姉妹', icon: '/familyIcons/sister.svg.jpg' },
]

// モックデータ
const mockMembers: (Member & { stats: { completed: number; total: number; streak: number } })[] = [
  {
    id: '1',
    name: '母',
    role: 'MOTHER',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    stats: { completed: 145, total: 150, streak: 7 },
  },
  {
    id: '2',
    name: '太郎',
    role: 'BROTHER',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    stats: { completed: 89, total: 100, streak: 5 },
  },
  {
    id: '3',
    name: '花子',
    role: 'SISTER',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    stats: { completed: 72, total: 85, streak: 3 },
  },
]

const getRoleBadge = (role: FamilyRole) => {
  return isParentRole(role) ? (
    <Badge variant="info" size="sm">親</Badge>
  ) : (
    <Badge variant="success" size="sm">子</Badge>
  )
}

export function Members() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<FamilyRole>('FATHER')

  const totalCompleted = mockMembers.reduce((sum, m) => sum + m.stats.completed, 0)
  const totalTasks = mockMembers.reduce((sum, m) => sum + m.stats.total, 0)

  return (
    <>
      <Header
        title="メンバー"
        subtitle={`${mockMembers.length}人の家族`}
        action={
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            追加
          </Button>
        }
      />
      <PageContainer>
        {/* 家族全体の統計 */}
        <section className="py-4">
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
                  <p className="text-2xl font-bold text-emerald-400">
                    {Math.round((totalCompleted / totalTasks) * 100)}%
                  </p>
                  <p className="text-xs text-white/50">完了率</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-400">
                    {Math.max(...mockMembers.map((m) => m.stats.streak))}日
                  </p>
                  <p className="text-xs text-white/50">最長連続</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* メンバー一覧 */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">メンバー一覧</h2>
          {mockMembers.map((member) => {
            const completionRate = Math.round(
              (member.stats.completed / member.stats.total) * 100
            )

            return (
              <Card key={member.id} variant="glass" hoverable>
                <div className="flex items-center gap-4">
                  <Avatar
                    name={member.name}
                    size="xl"
                    variant={isParentRole(member.role) ? 'parent' : 'child'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-lg">
                        {member.name}
                      </span>
                      {getRoleBadge(member.role)}
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
          })}
        </section>

        {/* 追加モーダル（シンプル実装） */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50">
            <div className="bg-dark-900 w-full max-w-lg rounded-t-3xl p-6 safe-bottom animate-slide-up">
              <h2 className="text-xl font-bold text-white mb-6">
                新しいメンバーを追加
              </h2>
              <div className="space-y-4">
                <Input
                  label="名前"
                  placeholder="名前を入力"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    役割
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {roleOptions.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setNewMemberRole(role.value)}
                        className={clsx(
                          'p-3 rounded-xl border-2 transition-all duration-200',
                          newMemberRole === role.value
                            ? 'border-coral-500 bg-coral-500/10'
                            : 'border-dark-700 bg-dark-800 hover:border-dark-600'
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={role.icon}
                            alt={role.label}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <span className="text-white font-medium text-sm">{role.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowAddModal(false)}
                >
                  キャンセル
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    // TODO: APIを呼び出してメンバーを追加
                    setShowAddModal(false)
                    setNewMemberName('')
                  }}
                >
                  追加
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </>
  )
}
