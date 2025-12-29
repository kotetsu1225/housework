/**
 * 新規登録ページ
 *
 * 新しいメンバーを作成するためのフォームを提供
 * @see backend/src/main/kotlin/com/task/presentation/Auth.kt
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Eye, EyeOff } from 'lucide-react'
import { clsx } from 'clsx'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Alert } from '../components/ui/Alert'
import { useAuth } from '../contexts/AuthContext'
import type { FamilyRole } from '../types'

/** パスワードの最小文字数（バックエンドと同期） */
const PASSWORD_MIN_LENGTH = 5
/** パスワードの最大文字数（バックエンドと同期） */
const PASSWORD_MAX_LENGTH = 72

/** 役割選択オプション */
const roleOptions: { value: FamilyRole; label: string; icon: string }[] = [
  { value: 'FATHER', label: '父', icon: '/familyIcons/father.svg.jpg' },
  { value: 'MOTHER', label: '母', icon: '/familyIcons/mother.svg.jpg' },
  { value: 'BROTHER', label: '兄弟', icon: '/familyIcons/brother.svg.jpg' },
  { value: 'SISTER', label: '姉妹', icon: '/familyIcons/sister.svg.jpg' },
]

export function Register() {
  const navigate = useNavigate()
  const { register, loading, error, clearError } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedRole, setSelectedRole] = useState<FamilyRole>('FATHER')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState('')

  const selectedRoleOption = roleOptions.find((r) => r.value === selectedRole)

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

  // パスワードの強度インジケーター
  const getPasswordStrength = (): { label: string; color: string } | null => {
    if (!password) return null
    if (password.length < PASSWORD_MIN_LENGTH) {
      return { label: '短すぎます', color: 'text-red-400' }
    }
    if (password.length < 8) {
      return { label: '弱い', color: 'text-yellow-400' }
    }
    if (password.length < 12) {
      return { label: '普通', color: 'text-blue-400' }
    }
    return { label: '強い', color: 'text-green-400' }
  }

  const passwordStrength = getPasswordStrength()

  // フォームが有効かどうか
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const isFormValid =
    name.trim() &&
    isEmailValid &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password === confirmPassword

  // エラーメッセージ（ローカルエラーまたはAPIエラー）
  const displayError = localError || error

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

              {displayError && (
                <Alert variant="error" className="mb-4">
                  {displayError}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
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
                        disabled={loading}
                        className={clsx(
                          'p-4 rounded-xl border-2 transition-all duration-200',
                          selectedRole === role.value
                            ? 'border-coral-500 bg-coral-500/10'
                            : 'border-dark-700 bg-dark-800 hover:border-dark-600',
                          loading && 'opacity-50 cursor-not-allowed'
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

                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      label="パスワード"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="パスワードを入力（5文字以上）"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-9 text-dark-400 hover:text-dark-300"
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {passwordStrength && (
                    <p className={clsx('text-xs', passwordStrength.color)}>
                      パスワード強度: {passwordStrength.label}
                    </p>
                  )}
                </div>

                <div className="relative">
                  <Input
                    label="パスワード（確認）"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="パスワードを再入力"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-9 text-dark-400 hover:text-dark-300"
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">
                      パスワードが一致しません
                    </p>
                  )}
                  {confirmPassword && password === confirmPassword && password.length >= PASSWORD_MIN_LENGTH && (
                    <p className="text-xs text-green-400 mt-1">
                      パスワードが一致しました
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  loading={loading}
                  disabled={!isFormValid}
                >
                  登録する
                </Button>

                <p className="text-center text-dark-400 text-sm">
                  すでにアカウントをお持ちですか？{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-coral-400 hover:text-coral-300"
                    disabled={loading}
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
