/**
 * 正常系: ホーム（今日のタスクの表示・開始・完了・担当者・明日・完了履歴）
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession, createTask, uniq, todayJst, sectionBox, type TestMember } from '../helpers'

test.describe('正常系 / ホーム', () => {
  let me: TestMember

  test.beforeEach(async ({ page, request }) => {
    me = await setupMember(request, { prefix: 'home' })
    await useSession(page, me)
  })

  test('N-HOME-1 今日の家族タスクが「家族のタスク」の箱に出て、担当者なしは「担当者がいません」と表示される', async ({ page, request }) => {
    const name = uniq('洗濯')
    await createTask(request, me, { name, point: 10 })

    await page.goto('/')
    const box = page.locator('section', { has: page.getByRole('heading', { name: '家族のタスク' }) })
    const card = box.getByRole('button', { name: new RegExp(name) })
    await expect(card).toBeVisible()
    await expect(card).toContainText('担当者がいません')
    await expect(card).toContainText('毎日')
    await expect(card).toContainText('10pt')
    await expect(card.getByLabel('未着手')).toBeVisible()
  })

  test('N-HOME-2 個人タスクは「自分のタスク」の箱に、期日チップ付きで出る', async ({ page, request }) => {
    const name = uniq('宿題')
    const today = todayJst()
    await createTask(request, me, {
      name,
      scope: 'PERSONAL',
      ownerMemberId: me.id,
      point: 0,
      schedule: { type: 'OneTime', deadline: today },
    })

    await page.goto('/')
    const box = page.locator('section', { has: page.getByRole('heading', { name: '自分のタスク' }) })
    const card = box.getByRole('button', { name: new RegExp(name) })
    await expect(card).toBeVisible()
    const [, m, d] = today.split('-').map(Number)
    await expect(card).toContainText(`${m}/${d}`)
  })

  test('N-HOME-3 取り掛かる → 進行中、完了する → 完了に移り、獲得ポイントがメンバー一覧に反映される', async ({ page, request }) => {
    const name = uniq('掃除')
    await createTask(request, me, { name, point: 30 })

    await page.goto('/')
    const card = page.getByRole('button', { name: new RegExp(name) })
    await card.click()

    // モーダル: 担当者未選択でも自分が担当になる
    await expect(page.getByRole('dialog')).toContainText(name)
    await page.getByRole('button', { name: '取り掛かる' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await expect(card.getByLabel('進行中')).toBeVisible()
    await expect(card).toContainText(me.name)

    // 完了
    await card.click()
    await page.getByRole('button', { name: '完了する' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // 進捗の完了件数トグルに出る（完了 N 件）
    const completedToggle = page.getByRole('button', { name: /完了 \d+ 件/ })
    await expect(completedToggle).toBeVisible()
    await completedToggle.click()
    const done = page.getByRole('button', { name: new RegExp(name) })
    await expect(done.getByLabel('完了')).toBeVisible()
    await expect(done).toContainText('+30pt')

    // メンバー一覧のランキングに 30pt
    await page.getByRole('link', { name: 'メンバー' }).click()
    await expect(page.getByRole('button', { name: `${me.name}の詳細を見る` })).toContainText('30pt')
  })

  test('N-HOME-4 担当者を選んでから開始すると、選んだメンバーが担当として表示される', async ({ page, request }) => {
    const partner = await setupMember(request, { prefix: 'ptn', role: 'MOTHER' })
    const name = uniq('料理')
    await createTask(request, me, { name, point: 20 })

    await page.goto('/')
    const card = page.getByRole('button', { name: new RegExp(name) })
    await card.click()

    // 担当者を選択（複数可）: パートナーを選ぶ
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: new RegExp(partner.name) }).click()
    await expect(dialog.getByRole('button', { name: new RegExp(partner.name) })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: '取り掛かる' }).click()
    await expect(dialog).toBeHidden()

    await expect(card).toContainText(partner.name)
    await expect(card.getByLabel('進行中')).toBeVisible()
  })

  test('N-HOME-5 「明日のタスクを見る」で明日の毎日タスクが予定として並ぶ', async ({ page, request }) => {
    const name = uniq('明日')
    await createTask(request, me, { name })

    await page.goto('/')
    await page.getByRole('button', { name: '明日のタスクを見る' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('明日のタスク')
    await expect(dialog.getByRole('button', { name: new RegExp(name) })).toBeVisible()
  })

  test('N-HOME-6 「完了したタスクを見る」で完了履歴ページに移動し、完了したタスクが家族の箱に載る', async ({ page, request }) => {
    const name = uniq('履歴')
    await createTask(request, me, { name, point: 5 })
    await page.goto('/')
    const card = page.getByRole('button', { name: new RegExp(name) })
    await card.click()
    await page.getByRole('button', { name: '取り掛かる' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await card.click()
    await page.getByRole('button', { name: '完了する' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: '完了したタスクを見る' }).click()
    await expect(page).toHaveURL(/\/executions\/completed$/)
    await expect(page.getByRole('heading', { name: '完了したタスク' })).toBeVisible()
    await expect(sectionBox(page, '家族のタスク').getByText(name)).toBeVisible()
  })

  test('N-HOME-7 更新ボタンで最新の状態を取り直す（API で作ったタスクが現れる）', async ({ page, request }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    const name = uniq('後追加')
    await createTask(request, me, { name })
    await page.getByRole('button', { name: '最新の状態に更新' }).click()
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()
  })
})
