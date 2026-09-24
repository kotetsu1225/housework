/**
 * 正常系: 認証（新規登録・ログイン・セッション維持・リダイレクト）
 */
import { test, expect } from '@playwright/test'
import { uniq, setupMember, loginViaUi, useSession } from '../helpers'

test.describe('正常系 / 認証', () => {
  test('N-AUTH-1 新規登録するとホームに遷移し、通知モーダルは「今はしない」で以後表示されない', async ({ page }) => {
    const name = uniq('reg')
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()

    await page.getByLabel('名前').fill(name)
    await page.getByLabel('メールアドレス').fill(`${name}@example.com`)
    await page.getByRole('radio', { name: /母/ }).click()
    await page.getByLabel('パスワード', { exact: true }).fill('password123')
    await page.getByLabel('パスワード（確認）').fill('password123')
    await page.getByRole('button', { name: '登録する' }).click()

    // ホームに遷移
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)

    // 初回は通知許可モーダルが出る → 今はしない
    await expect(page.getByText('通知を有効にしますか？')).toBeVisible()
    await page.getByRole('button', { name: '今はしない' }).click()
    await expect(page.getByText('通知を有効にしますか？')).toBeHidden()

    // 回答はサーバーに保存され、リロードしても再表示されない
    await page.reload()
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(page.getByText('通知を有効にしますか？')).toBeHidden()

    // 下タブが表示され、メンバー一覧に自分が母として載っている
    await page.getByRole('link', { name: 'メンバー' }).click()
    await expect(page.getByRole('button', { name: `${name}の詳細を見る` })).toContainText('母')
  })

  test('N-AUTH-2 登録済みユーザーでログインでき、リロード後もセッションが維持される', async ({ page, request }) => {
    const member = await setupMember(request, { prefix: 'login' })

    await loginViaUi(page, member)
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()

    // トークンが保存されている
    const token = await page.evaluate(() => localStorage.getItem('housework_token'))
    expect(token).toBeTruthy()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    await expect(page).not.toHaveURL(/login/)
  })

  test('N-AUTH-3 未ログインで保護ページを開くとログインへ送られ、ログイン後に元のページへ戻る', async ({ page, request }) => {
    const member = await setupMember(request, { prefix: 'redir' })

    await page.goto('/members')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible()

    await page.getByLabel('名前').fill(member.name)
    await page.getByLabel('パスワード', { exact: true }).fill(member.password)
    await page.getByRole('button', { name: 'ログイン' }).click()

    await expect(page).toHaveURL(/\/members$/)
    await expect(page.getByRole('heading', { name: 'メンバー' })).toBeVisible()
  })

  test('N-AUTH-4 ログイン画面と新規登録画面を相互に行き来できる', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '新規登録' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible()

    await page.getByRole('button', { name: 'ログイン', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/register')
    await page.getByRole('button', { name: 'ログインに戻る' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('N-AUTH-5 ログイン済みでログイン画面を開いても操作でき、ホームに戻れる', async ({ page, request }) => {
    const member = await setupMember(request, { prefix: 'home' })
    await useSession(page, member)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'メイン' })).toBeVisible()
  })
})
