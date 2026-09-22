/**
 * 新規登録ページ
 *
 * 新しいメンバーを作成するためのフォームを提供
 * @see backend/src/main/kotlin/com/task/presentation/Auth.kt
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Alert } from '../components/ui/Alert'
import { RoleSelector } from '../components/ui/RoleSelector'
import { useAuth } from '../contexts/AuthContext'
import type { FamilyRole } from '../types'

/** パスワードの最小文字数（バックエンドと同期） */
const PASSWORD_MIN_LENGTH = 5
/** パスワードの最大文字数（バックエンドと同期） */
const PASSWORD_MAX_LENGTH = 72

export function Register() {
  const navigate = useNavigate()
  const { register, loading, error, clearError } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState<FamilyRole>('FATHER')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')

  // コンポーネントマウント時にエラーをクリア
  useEffect(() => {
    clearError()
  }, [clearError])

  /**
   * メールアドレスバリデーション
   */
  const validateEmail = (value: string): string | null => {
    if (!value) {
      return 'メールアドレスを入力してください'
    }
    // 簡易的なメールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      return '有効なメールアドレスを入力してください'
    }
    return null
  }

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
   * 登録フォーム送信ハンドラー
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (!name.trim()) {
      setLocalError('名前を入力してください')
      return
    }

    const emailError = validateEmail(email.trim())
    if (emailError) {
      setLocalError(emailError)
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setLocalError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setLocalError('パスワードが一致しません')
      return
    }

    const success = await register(name.trim(), email.trim(), selectedRole, password)

    if (success) {
      navigate('/')
    }
  }

  // フォームが有効かどうか
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const isFormValid =
    name.trim() &&
    isEmailValid &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password === confirmPassword

  // 確認用パスワードの状態（入力済みのときだけ表示）
  const confirmError =
    confirmPassword && password !== confirmPassword ? 'パスワードが一致しません' : undefined

  // エラーメッセージ（ローカルエラーまたはAPIエラー）
  const displayError = localError || error

  return (
    <PageContainer className="safe-top">
      {/* 見出し（ログインへ戻る） */}
      <header className="pt-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate('/login')}
          aria-label="ログインに戻る"
          className="w-11 h-11 -ml-3 flex items-center justify-center rounded-full text-accent active:bg-control"
        >
          <ChevronLeft className="w-[26px] h-[26px]" strokeWidth={2.2} />
        </button>
        <h1 className="text-[22px] font-bold leading-tight text-ink">アカウント作成</h1>
      </header>

      {/* フォーム */}
      <form onSubmit={handleSubmit} className="mt-3.5 bg-surface rounded-xl px-4 py-5 flex flex-col gap-[18px]">
        {displayError && <Alert variant="error">{displayError}</Alert>}

        <Input
          label="名前"
          placeholder="名前を入力"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoComplete="username"
        />

        <Input
          label="メールアドレス"
          type="email"
          placeholder="example@mail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
        />

        <RoleSelector
          label="役割（アイコンになります）"
          value={selectedRole}
          onChange={setSelectedRole}
          disabled={loading}
        />

        <PasswordInput
          label="パスワード"
          placeholder={`${PASSWORD_MIN_LENGTH}文字以上`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
        />

        <Input
          label="パスワード（確認）"
          type="password"
          placeholder="もう一度入力"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
          error={confirmError}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-1"
          loading={loading}
          disabled={!isFormValid}
        >
          登録する
        </Button>
      </form>

      {/* ログインへの導線 */}
      <p className="mt-5 flex items-center justify-center gap-1 text-sm text-ink-muted">
        すでにアカウントがありますか？
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center min-h-tap px-1.5 font-bold text-accent active:text-accent-strong"
          disabled={loading}
        >
          ログイン
        </button>
      </p>
    </PageContainer>
  )
}
