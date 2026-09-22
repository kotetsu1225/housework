/**
 * ログインページ
 *
 * 既存のメンバーとしてログインするためのフォームを提供
 * @see backend/src/main/kotlin/com/task/presentation/Auth.kt
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Alert } from '../components/ui/Alert'
import { useAuth } from '../contexts/AuthContext'

/** パスワードの最小文字数（バックエンドと同期） */
const PASSWORD_MIN_LENGTH = 5
/** パスワードの最大文字数（バックエンドと同期） */
const PASSWORD_MAX_LENGTH = 72

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loading, error, clearError } = useAuth()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  // コンポーネントマウント時にエラーをクリア
  useEffect(() => {
    clearError()
  }, [clearError])

  /**
   * パスワードバリデーション
   */
  const validatePassword = (value: string): string | null => {
    if (!value) {
      return 'パスワードを入力してください'
    }
    if (value.length < PASSWORD_MIN_LENGTH) {
      return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で入力してください`
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
      return `パスワードは${PASSWORD_MAX_LENGTH}文字以下で入力してください`
    }
    return null
  }

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

    const passwordError = validatePassword(password)
    if (passwordError) {
      setLocalError(passwordError)
      return
    }

    const success = await login(name.trim(), password)

    if (success) {
      navigate(from, { replace: true })
    }
  }

  // フォームが有効かどうか
  const isFormValid = name.trim() && password.length >= PASSWORD_MIN_LENGTH

  // エラーメッセージ（ローカルエラーまたはAPI エラー）
  const displayError = localError || error

  return (
    <PageContainer className="safe-top">
      {/* 見出し */}
      <section className="pt-20 px-2 flex flex-col gap-1.5">
        <span className="text-[15px] font-bold text-accent tracking-wide">Housework</span>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-ink">ログイン</h1>
        <p className="text-[15px] text-ink-muted">登録した名前とパスワードを入力してください</p>
      </section>

      {/* フォーム */}
      <form onSubmit={handleSubmit} className="mt-7 bg-surface rounded-xl px-4 py-5 flex flex-col gap-[18px]">
        {displayError && <Alert variant="error">{displayError}</Alert>}

        <Input
          label="名前"
          placeholder="登録した名前を入力"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoComplete="username"
        />

        <PasswordInput
          label="パスワード"
          placeholder="パスワードを入力"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-1"
          loading={loading}
          disabled={!isFormValid}
        >
          ログイン
        </Button>
      </form>

      {/* 新規登録への導線 */}
      <p className="mt-5 flex items-center justify-center gap-1 text-sm text-ink-muted">
        アカウントをお持ちでないですか？
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="inline-flex items-center min-h-tap px-1.5 font-bold text-accent active:text-accent-strong"
          disabled={loading}
        >
          新規登録
        </button>
      </p>
    </PageContainer>
  )
}
