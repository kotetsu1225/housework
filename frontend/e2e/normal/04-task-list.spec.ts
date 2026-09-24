/**
 * 正常系: タスク一覧（検索・絞り込み・編集・削除）
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession, createTask, uniq, sectionBox, type TestMember } from '../helpers'

test.describe('正常系 / タスク一覧', () => {
  let me: TestMember

  test.beforeEach(async ({ page, request }) => {
    me = await setupMember(request, { prefix: 'list' })
    await useSession(page, me)
  })

  test('N-LIST-1 検索で名前に一致するタスクだけが残る', async ({ page, request }) => {
    const a = uniq('検索A')
    const b = uniq('別物B')
    await createTask(request, me, { name: a })
    await createTask(request, me, { name: b })

    await page.goto('/tasks/list')
    await expect(page.getByText(a)).toBeVisible()
    await page.getByLabel('タスクを検索').fill(a)
    await expect(page.getByText(a)).toBeVisible()
    await expect(page.getByText(b)).toHaveCount(0)
  })

  test('N-LIST-2 家族／個人の絞り込みと、個人タスクの「自分のタスク」箱', async ({ page, request }) => {
    const family = uniq('家事')
    const mine = uniq('自習')
    await createTask(request, me, { name: family })
    await createTask(request, me, { name: mine, scope: 'PERSONAL', ownerMemberId: me.id, point: 0 })

    await page.goto('/tasks/list')
    const range = page.getByRole('group', { name: '表示する範囲' })
    await range.getByRole('button', { name: '個人' }).click()
    await expect(sectionBox(page, '自分のタスク').getByText(mine)).toBeVisible()
    await expect(page.getByText(family)).toHaveCount(0)

    await range.getByRole('button', { name: '家族' }).click()
    await expect(sectionBox(page, '家族のタスク').getByText(family)).toBeVisible()
    await expect(page.getByText(mine)).toHaveCount(0)
  })

  test('N-LIST-3 編集ボタンから名前を変更すると一覧に反映される', async ({ page, request }) => {
    const name = uniq('旧名')
    await createTask(request, me, { name })
    await page.goto('/tasks/list')

    await page.getByRole('button', { name: `${name}を編集` }).click()
    const dialog = page.getByRole('dialog')
    const newName = uniq('新名')
    await dialog.getByLabel('タスク名').fill(newName)
    await dialog.getByLabel('ポイント').fill('25')
    await dialog.getByRole('button', { name: '更新' }).click()
    await expect(dialog).toBeHidden()

    await expect(page.getByText(newName)).toBeVisible()
    await expect(page.getByText(name)).toHaveCount(0)
  })

  test('N-LIST-4 削除すると一覧から消え、ホームの当日分も消える', async ({ page, request }) => {
    const name = uniq('消す')
    await createTask(request, me, { name })

    await page.goto('/')
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()

    await page.goto('/tasks/list')
    await page.getByRole('button', { name: `${name}を削除` }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(`「${name}」を削除しますか？`)
    await dialog.getByRole('button', { name: '削除' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(name)).toHaveCount(0)

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0)
  })

  test('N-LIST-5 削除確認をキャンセルすると何も消えない', async ({ page, request }) => {
    const name = uniq('残す')
    await createTask(request, me, { name })
    await page.goto('/tasks/list')
    await page.getByRole('button', { name: `${name}を削除` }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'キャンセル' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText(name)).toBeVisible()
  })
})
