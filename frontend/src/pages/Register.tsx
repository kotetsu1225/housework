import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'
import type { FamilyRole } from '../types'
import { clsx } from 'clsx'

const roleOptions: { value: FamilyRole; label: string; icon: string }[] = [
  { value: 'FATHER', label: '父', icon: '/familyIcons/father.svg.jpg' },
  { value: 'MOTHER', label: '母', icon: '/familyIcons/mother.svg.jpg' },
  { value: 'BROTHER', label: '兄弟', icon: '/familyIcons/brother.svg.jpg' },
  { value: 'SISTER', label: '姉妹', icon: '/familyIcons/sister.svg.jpg' },
]

export function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [selectedRole, setSelectedRole] = useState<FamilyRole>('FATHER')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const selectedRoleOption = roleOptions.find((r) => r.value === selectedRole)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }

    setIsLoading(true)
    try {
      register(name.trim(), selectedRole)
      navigate('/')
    } catch {
      setError('登録に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Header title="新規登録" />
      <PageContainer>
        <section className="py-6">
          <Card variant="gradient" className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-coral-500/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <UserPlus className="w-5 h-5 text-coral-400" />
                <h2 className="text-lg font-bold text-white">アカウント作成</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="名前"
                  placeholder="名前を入力"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={error}
                />

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-3">
                    家族の役割
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {roleOptions.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setSelectedRole(role.value)}
                        className={clsx(
                          'p-4 rounded-xl border-2 transition-all duration-200',
                          selectedRole === role.value
                            ? 'border-coral-500 bg-coral-500/10'
                            : 'border-dark-700 bg-dark-800 hover:border-dark-600'
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={role.icon}
                            alt={role.label}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <span className="text-white font-medium">{role.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center py-4">
                  <p className="text-sm text-dark-400 mb-3">選択中のアイコン</p>
                  <img
                    src={selectedRoleOption?.icon}
                    alt="Selected role"
                    className="w-24 h-24 rounded-full object-cover border-4 border-coral-500/50"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={isLoading}
                >
                  登録する
                </Button>

                <p className="text-center text-dark-400 text-sm">
                  すでにアカウントをお持ちですか？{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-coral-400 hover:text-coral-300"
                  >
                    ログイン
                  </button>
                </p>
              </form>
            </div>
          </Card>
        </section>
      </PageContainer>
    </>
  )
}
