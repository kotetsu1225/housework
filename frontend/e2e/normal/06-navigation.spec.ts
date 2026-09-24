/**
 * 正常系: 画面遷移（下タブ・戻る）
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession } from '../helpers'

test.describe('正常系 / ナビゲーション', () => {
  test('N-NAV-1 下タブでホーム／タスク／メンバーを行き来できる', async ({ page, request }) => {
    const me = await setupMember(request, { prefix: 'nav' })
    await useSession(page, me)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'メイン' })

    await nav.getByRole('link', { name: 'タスク' }).click()
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(page.getByRole('heading', { name: 'タスク' })).toBeVisible()

    await nav.getByRole('link', { name: 'メンバー' }).click()
    await expect(page).toHaveURL(/\/members$/)
    await expect(page.getByRole('heading', { name: 'メンバー' })).toBeVisible()

    await nav.getByRole('link', { name: 'ホーム' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
  })

  test('N-NAV-2 詳細ページの戻るボタンで一覧に戻る', async ({ page, request }) => {
    const me = await setupMember(request, { prefix: 'back' })
    await useSession(page, me)
    await page.goto('/members')
    await page.getByRole('button', { name: `${me.name}の詳細を見る` }).click()
    await expect(page.getByRole('heading', { name: 'メンバー詳細' })).toBeVisible()
    await page.getByRole('button', { name: '戻る' }).click()
    await expect(page).toHaveURL(/\/members$/)
  })
})
