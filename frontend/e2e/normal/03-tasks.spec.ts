/**
 * 正常系: タスク（カレンダー）画面
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession, createTask, uniq, todayJst, toMonthDayLabel, collapsibleBox, sectionBox, type TestMember } from '../helpers'

test.describe('正常系 / タスク', () => {
  let me: TestMember

  test.beforeEach(async ({ page, request }) => {
    me = await setupMember(request, { prefix: 'task' })
    await useSession(page, me)
  })

  test('N-TASK-1 ヘッダーの「追加」から家族の毎日タスクを作ると、カレンダーとホームに現れる', async ({ page }) => {
    const name = uniq('風呂')
    await page.goto('/tasks')
    await expect(page.getByRole('heading', { name: 'タスク' })).toBeVisible()

    await page.getByRole('button', { name: '追加', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('タスクを追加')

    await dialog.getByRole('button', { name: '家族タスク' }).click()
    await dialog.getByLabel('タスク名').fill(name)
    await dialog.getByLabel('説明（任意）').fill('浴槽と床')
    await dialog.getByLabel('ポイント').fill('15')
    await dialog.getByRole('button', { name: '定期' }).click()
    await dialog.getByLabel('開始時刻').fill('18:00')
    await dialog.getByLabel('終了時刻').fill('18:30')
    await dialog.getByRole('group', { name: '繰り返しパターン' }).getByRole('button', { name: '毎日' }).click()
    await dialog.getByRole('button', { name: '追加', exact: true }).click()
    // 追加後はその日のタスク一覧に戻り、作ったタスクが載る
    await expect(dialog.getByText(name)).toBeVisible()
    await dialog.getByRole('button', { name: '閉じる' }).first().click()
    await expect(dialog).toBeHidden()

    // 当日セルは表示上限（4 件）を超えることがあるので、セルを開いた日別モーダルで確認する
    // （セル内の 4 文字表示は N-TASK-2 で検証）
    await page.getByRole('button', { name: toMonthDayLabel(todayJst()) }).click()
    await expect(page.getByRole('dialog')).toContainText('毎日のタスク')
    await expect(page.getByRole('dialog').getByText(name)).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: '閉じる' }).first().click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // 毎日の定期タスク箱
    await expect(collapsibleBox(page, '毎日の定期タスク').getByText(name)).toBeVisible()

    // ホームの家族のタスク箱に当日分が生成されている
    await page.getByRole('link', { name: 'ホーム' }).click()
    await expect(sectionBox(page, '家族のタスク').getByRole('button', { name: new RegExp(name) })).toBeVisible()
  })

  test('N-TASK-2 日付セルから未来日の単発タスクを追加すると、その日のモーダルとカレンダーに載る', async ({ page }) => {
    const name = uniq('買出')
    // 今月内の未来日（今日が月末なら今日）
    const [y, m, d] = todayJst().split('-').map(Number)
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const target = d < lastDay ? d + 1 : d
    const targetDate = `${y}-${String(m).padStart(2, '0')}-${String(target).padStart(2, '0')}`

    await page.goto('/tasks')
    await page.getByRole('button', { name: `${m}月${target}日` }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(`${m}月${target}日`)
    await dialog.getByRole('button', { name: 'この日にタスクを追加' }).click()

    await dialog.getByLabel('タスク名').fill(name)
    // 既定は 個人／単発、期限は選択日
    await expect(dialog.getByLabel('期限')).toHaveValue(targetDate)
    await dialog.getByRole('button', { name: '追加', exact: true }).click()
    // 追加後はその日のタスク一覧に戻り、単発タスクとして載る
    await expect(dialog).toContainText('単発タスク')
    await expect(dialog.getByText(name)).toBeVisible()
    await dialog.getByRole('button', { name: '閉じる' }).first().click()
    await expect(dialog).toBeHidden()

    await expect(page.getByRole('button', { name: `${m}月${target}日` })).toContainText(Array.from(name).slice(0, 4).join(''))

    await page.getByRole('button', { name: `${m}月${target}日` }).click()
    await expect(page.getByRole('dialog')).toContainText('単発タスク')
    await expect(page.getByRole('dialog').getByText(name)).toBeVisible()
  })

  test('N-TASK-3 前の月／次の月で表示月が切り替わる', async ({ page }) => {
    await page.goto('/tasks')
    const [y, m] = todayJst().split('-').map(Number)
    await expect(page.getByText(`${y}年${m}月`)).toBeVisible()

    await page.getByRole('button', { name: '次の月' }).click()
    const next = m === 12 ? `${y + 1}年1月` : `${y}年${m + 1}月`
    await expect(page.getByText(next)).toBeVisible()

    await page.getByRole('button', { name: '前の月' }).click()
    await page.getByRole('button', { name: '前の月' }).click()
    const prev = m === 1 ? `${y - 1}年12月` : `${y}年${m - 1}月`
    await expect(page.getByText(prev)).toBeVisible()
  })

  test('N-TASK-4 「表示する範囲」で家族／個人のタスクを絞り込める', async ({ page, request }) => {
    const family = uniq('家族')
    const personal = uniq('個人')
    await createTask(request, me, { name: family })
    await createTask(request, me, { name: personal, scope: 'PERSONAL', ownerMemberId: me.id, point: 0 })

    await page.goto('/tasks')
    const range = page.getByRole('group', { name: '表示する範囲' })
    await range.getByRole('button', { name: '家族' }).click()
    await expect(collapsibleBox(page, '毎日の定期タスク').getByText(family)).toBeVisible()
    await expect(page.getByText(personal)).toHaveCount(0)

    await range.getByRole('button', { name: '個人' }).click()
    await expect(page.getByText(personal).first()).toBeVisible()
    await expect(page.getByText(family)).toHaveCount(0)
  })

  test('N-TASK-5 タスク詳細モーダルから編集して名前を変えられる', async ({ page, request }) => {
    const name = uniq('編集前')
    await createTask(request, me, { name })
    await page.goto('/tasks')
    await collapsibleBox(page, '毎日の定期タスク').getByText(name).click()

    const detail = page.getByRole('dialog')
    await expect(detail).toContainText('タスク詳細')
    await detail.getByRole('button', { name: '編集' }).click()

    const edit = page.getByRole('dialog')
    await expect(edit).toContainText('タスクを編集')
    const newName = uniq('編集後')
    await edit.getByLabel('タスク名').fill(newName)
    await edit.getByRole('button', { name: '更新' }).click()
    await expect(edit).toBeHidden()
    await expect(collapsibleBox(page, '毎日の定期タスク').getByText(newName)).toBeVisible()
  })

  test('N-TASK-6 「タスク一覧を編集する」でタスク一覧に移動し、戻るで戻れる', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'タスク一覧を編集する' }).click()
    await expect(page).toHaveURL(/\/tasks\/list$/)
    await expect(page.getByRole('heading', { name: 'タスク一覧' })).toBeVisible()
    await page.getByRole('button', { name: '戻る' }).click()
    await expect(page).toHaveURL(/\/tasks$/)
  })
})
