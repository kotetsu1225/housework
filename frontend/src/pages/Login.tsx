/**
 * ログインページ
 *
 * 既存のメンバーとしてログインするためのフォームを提供
 * @see backend/src/main/kotlin/com/task/presentation/Members.kt
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loading, error, clearError } = useAuth()
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  // コンポーネントマウント時にエラーをクリア
  useEffect(() => {
    clearError()
  }, [clearError])

  /**
   * ログインフォーム送信ハンドラー
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!name.trim()) {
      setLocalError('名前を入力してください')
      return
    }

    const success = await login(name.trim())

    if (success) {
      navigate(from, { replace: true })
    }
  }

  // エラーメッセージ（ローカルエラーまたはAPI エラー）
  const displayError = localError || error

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

              {displayError && (
                <Alert variant="error" className="mb-4">
                  {displayError}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="名前"
                  placeholder="登録した名前を入力"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={loading}
                  disabled={!name.trim()}
                >
                  ログイン
                </Button>

                <p className="text-center text-dark-400 text-sm">
                  アカウントをお持ちでないですか？{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="text-coral-400 hover:text-coral-300"
                    disabled={loading}
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
