/**
 * 異常系: 入力バリデーション（タスク・メンバー）と存在しないデータ
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession, createTask, uniq, type TestMember } from '../helpers'

test.describe('異常系 / 入力バリデーション', () => {
  let me: TestMember

  test.beforeEach(async ({ page, request }) => {
    me = await setupMember(request, { prefix: 'val' })
    await useSession(page, me)
  })

  test('A-VAL-1 タスク名が空のあいだは「追加」ボタンが無効', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: '追加', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: '追加', exact: true })).toBeDisabled()
    await dialog.getByLabel('タスク名').fill('   ')
    await expect(dialog.getByRole('button', { name: '追加', exact: true })).toBeDisabled()
    await dialog.getByLabel('タスク名').fill('x')
    await expect(dialog.getByRole('button', { name: '追加', exact: true })).toBeEnabled()
  })

  test('A-VAL-2 開始時刻が終了時刻より後だとサーバーが拒否し、エラーがモーダル内に表示される', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: '追加', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('タスク名').fill(uniq('逆順'))
    await dialog.getByLabel('開始時刻').fill('12:00')
    await dialog.getByLabel('終了時刻').fill('11:00')
    await dialog.getByRole('button', { name: '追加', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('開始時間は終了時間より前である必要があります')
    await expect(dialog).toBeVisible()
  })

  test('A-VAL-3 定期タスクの終了日が開始日より前だとサーバーが拒否する（編集モーダル）', async ({ page, request }) => {
    const name = uniq('逆日付')
    await createTask(request, me, { name })
    await page.goto('/tasks/list')
    await page.getByRole('button', { name: `${name}を編集` }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('開始日').fill('2026-10-10')
    await dialog.getByLabel('終了日（任意）').fill('2026-10-01')
    await dialog.getByRole('button', { name: '更新' }).click()
    await expect(dialog.getByRole('alert')).toContainText('startDateはendDateより前である必要があります')
    await expect(dialog).toBeVisible()
  })

  test('A-VAL-4 メンバー追加: パスワードが8文字未満、またはメール形式が不正なら「追加」が無効', async ({ page }) => {
    await page.goto('/members')
    await page.getByRole('button', { name: '追加' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('名前').fill(uniq('short'))
    await dialog.getByLabel('メールアドレス').fill('short@example.com')
    await dialog.getByLabel('パスワード').fill('1234567')
    await expect(dialog.getByRole('button', { name: '追加' })).toBeDisabled()
    await dialog.getByLabel('パスワード').fill('12345678')
    await expect(dialog.getByRole('button', { name: '追加' })).toBeEnabled()
    await dialog.getByLabel('メールアドレス').fill('bad-email')
    await expect(dialog.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  test('A-VAL-5 メンバー追加: 既存の名前だとサーバーエラーがモーダル内に表示され、モーダルは閉じない', async ({ page, request }) => {
    const existing = await setupMember(request, { prefix: 'exists' })
    await page.goto('/members')
    await page.getByRole('button', { name: '追加' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('名前').fill(existing.name)
    await dialog.getByLabel('メールアドレス').fill(`x-${existing.name}@example.com`)
    await dialog.getByLabel('パスワード').fill('password123')
    await dialog.getByRole('button', { name: '追加' }).click()
    await expect(dialog.getByRole('alert')).toContainText('既存のユーザ名と重複しています')
    await expect(dialog).toBeVisible()
  })

  test('A-VAL-6 存在しないメンバーの詳細は「メンバーが見つかりませんでした」になり、一覧へ戻れる', async ({ page }) => {
    await page.goto('/members/00000000-0000-0000-0000-000000000000')
    await expect(page.getByRole('alert')).toContainText('メンバーが見つかりませんでした')
    await page.getByRole('button', { name: 'メンバー一覧へ' }).click()
    await expect(page).toHaveURL(/\/members$/)
  })

  test('A-VAL-8 メンバー追加: メールの@より前に日本語があるとクライアントは通すがサーバーが拒否し、その文言が表示される', async ({ page }) => {
    await page.goto('/members')
    await page.getByRole('button', { name: '追加' }).click()
    const dialog = page.getByRole('dialog')
    const name = uniq('妹')
    await dialog.getByLabel('名前').fill(name)
    await dialog.getByLabel('メールアドレス').fill(`${name}@example.com`)
    await dialog.getByLabel('パスワード').fill('password123')
    await expect(dialog.getByRole('button', { name: '追加' })).toBeEnabled()
    await dialog.getByRole('button', { name: '追加' }).click()
    // エラーは 5 秒で自動的に消えるので、直後に確認する
    await expect(dialog.getByRole('alert')).toContainText('無効なメールアドレス形式です')
    await expect(dialog).toBeVisible()
  })

  test('A-VAL-7 API: 不正な役割・空の名前・短いパスワードは 400', async ({ request }) => {
    const base = { name: uniq('api'), email: 'api@example.com', familyRole: 'FATHER', password: 'password123' }
    const cases: Array<[string, Record<string, unknown>, RegExp]> = [
      ['role', { ...base, familyRole: 'UNCLE' }, /Invalid family role/],
      ['name', { ...base, name: '   ' }, /名前は必須/],
      ['password', { ...base, password: '1234' }, /5文字以上/],
      ['email', { ...base, email: 'no-at-mark' }, /無効なメールアドレス形式/],
    ]
    for (const [label, data, message] of cases) {
      const res = await request.post('/api/auth/register', { data })
      expect(res.status(), label).toBe(400)
      expect((await res.json()).error, label).toMatch(message)
    }
  })
})
