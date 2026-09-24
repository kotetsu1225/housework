/**
 * 異常系: 認証（誤入力・重複・期限切れ・改ざん・存在しないURL）
 */
import { test, expect } from '@playwright/test'
import { uniq, setupMember, useSession, type TestMember } from '../helpers'

function forgeToken(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.invalidsignature`
}

test.describe('異常系 / 認証', () => {
  test('A-AUTH-1 パスワードが違うと「名前またはパスワードが正しくありません」と表示され、ログイン画面に留まる', async ({ page, request }) => {
    const member = await setupMember(request, { prefix: 'wrongpw' })
    await page.goto('/login')
    await page.getByLabel('名前').fill(member.name)
    await page.getByLabel('パスワード', { exact: true }).fill('wrong-password')
    await page.getByRole('button', { name: 'ログイン' }).click()
    await expect(page.getByRole('alert')).toContainText('名前またはパスワードが正しくありません')
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate(() => localStorage.getItem('housework_token'))).toBeNull()
  })

  test('A-AUTH-2 存在しないユーザー名でも同じメッセージになる（ユーザーの存在を漏らさない）', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('名前').fill(uniq('ghost'))
    await page.getByLabel('パスワード', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'ログイン' }).click()
    await expect(page.getByRole('alert')).toContainText('名前またはパスワードが正しくありません')
  })

  test('A-AUTH-3 パスワードが5文字未満のあいだはログインボタンが無効', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('名前').fill('someone')
    await page.getByLabel('パスワード', { exact: true }).fill('1234')
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeDisabled()
    await page.getByLabel('パスワード', { exact: true }).fill('12345')
    await expect(page.getByRole('button', { name: 'ログイン' })).toBeEnabled()
  })

  test('A-AUTH-4 既存の名前で登録すると「この名前は既に使用されています」と表示され、登録画面に留まる', async ({ page, request }) => {
    const existing = await setupMember(request, { prefix: 'dup' })
    await page.goto('/register')
    await page.getByLabel('名前').fill(existing.name)
    await page.getByLabel('メールアドレス').fill(`other-${existing.name}@example.com`)
    await page.getByLabel('パスワード', { exact: true }).fill('password123')
    await page.getByLabel('パスワード（確認）').fill('password123')
    await page.getByRole('button', { name: '登録する' }).click()
    // サーバーは 400「既存のユーザ名と重複しています」を返し、AuthContext がこの文言に置き換える
    await expect(page.getByRole('alert')).toContainText('この名前は既に使用されています')
    await expect(page).toHaveURL(/\/register$/)
  })

  test('A-AUTH-5 メール形式が不正、またはパスワードが不一致のあいだは登録ボタンが無効で、不一致メッセージが出る', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('名前').fill(uniq('v'))
    await page.getByLabel('メールアドレス').fill('not-an-email')
    await page.getByLabel('パスワード', { exact: true }).fill('password123')
    await page.getByLabel('パスワード（確認）').fill('password123')
    await expect(page.getByRole('button', { name: '登録する' })).toBeDisabled()

    await page.getByLabel('メールアドレス').fill('ok@example.com')
    await expect(page.getByRole('button', { name: '登録する' })).toBeEnabled()

    await page.getByLabel('パスワード（確認）').fill('password124')
    await expect(page.getByText('パスワードが一致しません')).toBeVisible()
    await expect(page.getByRole('button', { name: '登録する' })).toBeDisabled()
  })

  test('A-AUTH-6 期限切れトークンが保存されていてもログイン済み扱いにならず、ログインへ送られる', async ({ page, request }) => {
    const member = await setupMember(request, { prefix: 'exp' })
    const expired: TestMember = {
      ...member,
      token: forgeToken({ sub: member.id, name: member.name, role: member.role, exp: Math.floor(Date.now() / 1000) - 60 }),
    }
    await useSession(page, expired)
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('A-AUTH-7 署名が不正なトークンでは API が 401 を返し、クライアントはトークンを破棄する', async ({ page, request }) => {
    const member = await setupMember(request, { prefix: 'forged' })
    const forged: TestMember = {
      ...member,
      token: forgeToken({ sub: member.id, name: member.name, role: member.role, exp: Math.floor(Date.now() / 1000) + 3600 }),
    }
    // API レベル: 401
    const res = await request.get('/api/member', { headers: { Authorization: `Bearer ${forged.token}` } })
    expect(res.status()).toBe(401)

    // UI レベル: 期限は有効なので画面は開けるが、API が失敗しトークンが削除される
    await useSession(page, forged)
    await page.goto('/members')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('housework_token'))).toBeNull()
  })

  test('A-AUTH-8 存在しない URL は 404 画面になり、「ホームへ戻る」で戻れる', async ({ page, request }) => {
    const member = await setupMember(request, { prefix: 'nf' })
    await useSession(page, member)
    await page.goto('/no-such-page')
    await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible()
    await page.getByRole('button', { name: 'ホームへ戻る' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
  })

  test('A-AUTH-9 認証なしで保護 API を呼ぶと 401', async ({ request }) => {
    for (const path of ['/api/member', '/api/dashboard', '/api/task-definitions', '/api/completed-tasks']) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(401)
    }
  })
})
