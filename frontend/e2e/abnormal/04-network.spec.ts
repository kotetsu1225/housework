/**
 * 異常系: 通信エラー（API 到達不能・サーバーエラー）からの表示と回復
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession, createTask, uniq, type TestMember } from '../helpers'

/**
 * API だけに一致するパターン。
 * 「アスタリスク2つ + /api/dashboard + アスタリスク2つ」のようなグロブは、Vite が配信するモジュール
 * /src/api/dashboard.ts にも一致してアプリのコード読み込み自体を止めてしまうので、オリジン直後の /api/ に固定する。
 */
const api = (path: string) => new RegExp(`^https?://[^/]+/api/${path}`)

test.describe('異常系 / 通信エラー', () => {
  let me: TestMember

  test.beforeEach(async ({ page, request }) => {
    me = await setupMember(request, { prefix: 'net' })
    await useSession(page, me)
  })

  test('A-NET-1 ダッシュボード API に到達できないとエラーが表示され、「最新の状態に更新」で回復する', async ({ page, request }) => {
    const name = uniq('回復')
    await createTask(request, me, { name })

    // 更新ボタンを押すまでは常に失敗させる（開発モードの StrictMode では初回取得が 2 回走るため「1 回だけ失敗」では再現しない）
    let failing = true
    await page.route(api('dashboard'), async (route) => {
      if (failing) return route.abort('connectionrefused')
      return route.continue()
    })

    await page.goto('/')
    await expect(page.getByRole('alert')).toContainText('ダッシュボードデータの取得に失敗しました')
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0)

    failing = false
    await page.getByRole('button', { name: '最新の状態に更新' }).click()
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()
  })

  test('A-NET-2 サーバーが 500 を返すと、そのメッセージがエラーとして表示される', async ({ page }) => {
    await page.route(api('member$'), (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'サーバー内部エラー（テスト）' }) })
    )
    await page.goto('/members')
    await expect(page.getByRole('alert')).toContainText('サーバー内部エラー（テスト）')
  })

  test('A-NET-3 タスク作成中にサーバーが失敗すると、モーダルは閉じずエラーが出る', async ({ page }) => {
    await page.route(api('task-definitions/create'), (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '保存に失敗しました（テスト）' }) })
    )
    await page.goto('/tasks')
    await page.getByRole('button', { name: '追加', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('タスク名').fill(uniq('失敗'))
    await dialog.getByRole('button', { name: '追加', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('保存に失敗しました（テスト）')
    await expect(dialog).toBeVisible()
  })

  test('A-NET-4 タスク開始 API が失敗してもモーダルは閉じず、状態は未着手のまま', async ({ page, request }) => {
    const name = uniq('開始失敗')
    await createTask(request, me, { name })
    await page.route(api('task-executions/[^/]+/start'), (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '開始できません（テスト）' }) })
    )
    await page.goto('/')
    const card = page.getByRole('button', { name: new RegExp(name) })
    await card.click()
    await page.getByRole('button', { name: '取り掛かる' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'あとで' }).click()
    await expect(card.getByLabel('未着手')).toBeVisible()
  })
})
