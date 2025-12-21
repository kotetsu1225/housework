import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }

    setIsLoading(true)
    const success = login(name.trim())
    setIsLoading(false)

    if (success) {
      navigate(from, { replace: true })
    } else {
      setError('ユーザーが見つかりませんでした')
    }
  }

  return (
    <>
      <Header title="ログイン" />
      <PageContainer>
        <section className="py-6">
          <Card variant="gradient" className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-coral-500/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <LogIn className="w-5 h-5 text-coral-400" />
                <h2 className="text-lg font-bold text-white">ログイン</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="名前"
                  placeholder="登録した名前を入力"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={error}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={isLoading}
                >
                  ログイン
                </Button>

                <p className="text-center text-dark-400 text-sm">
                  アカウントをお持ちでないですか？{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="text-coral-400 hover:text-coral-300"
                  >
                    新規登録
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
