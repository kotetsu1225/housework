/**
 * 正常系: メンバー（追加・ランキング・詳細・完了履歴）
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession, createTask, findTodayExecution, authed, uniq, sectionBox, type TestMember } from '../helpers'

test.describe('正常系 / メンバー', () => {
  let me: TestMember

  test.beforeEach(async ({ page, request }) => {
    me = await setupMember(request, { prefix: 'mem' })
    await useSession(page, me)
  })

  test('N-MEM-1 追加モーダルから新しいメンバーを登録すると一覧に役割付きで出る', async ({ page }) => {
    const name = uniq('妹')
    await page.goto('/members')
    await page.getByRole('button', { name: '追加', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('新しいメンバーを追加')
    await dialog.getByLabel('名前').fill(name)
    // サーバーのメール検証は ASCII のみ許可（A-VAL-8 参照）
    await dialog.getByLabel('メールアドレス').fill(`${uniq('sis')}@example.com`)
    await dialog.getByLabel('パスワード').fill('password123')
    await dialog.getByRole('radio', { name: /妹/ }).click()
    await dialog.getByRole('button', { name: '追加' }).click()
    await expect(dialog).toBeHidden()

    const card = page.getByRole('button', { name: `${name}の詳細を見る` })
    await expect(card).toBeVisible()
    await expect(card).toContainText('妹')
  })

  test('N-MEM-2 ランキングは今日の獲得ポイント順で並ぶ', async ({ page, request }) => {
    const rival = await setupMember(request, { prefix: 'rival', role: 'BROTHER' })
    const name = uniq('稼ぐ')
    await createTask(request, me, { name, point: 40 })
    const exec = await findTodayExecution(request, me, name)
    // rival が API で開始・完了 → 40pt
    let res = await request.post(`/api/task-executions/${exec.taskExecutionId}/start`, { ...authed(rival), data: { memberIds: [rival.id] } })
    expect(res.ok(), await res.text()).toBeTruthy()
    res = await request.post(`/api/task-executions/${exec.taskExecutionId}/complete`, { ...authed(rival), data: { memberIds: [rival.id] } })
    expect(res.ok(), await res.text()).toBeTruthy()

    await page.goto('/members')
    const rivalCard = page.getByRole('button', { name: `${rival.name}の詳細を見る` })
    await expect(rivalCard).toContainText('40pt')
    // 40pt を稼いだ rival が、0pt の自分より上に並ぶ
    const names = await page.getByRole('button', { name: /の詳細を見る$/ }).allTextContents()
    const rivalIdx = names.findIndex((t) => t.includes(rival.name))
    const meIdx = names.findIndex((t) => t.includes(me.name))
    expect(rivalIdx).toBeGreaterThanOrEqual(0)
    expect(rivalIdx).toBeLessThan(meIdx)
  })

  test('N-MEM-3 詳細ページに今日の成果と完了タスクの箱が出て、完了履歴へ移動できる', async ({ page, request }) => {
    const name = uniq('成果')
    await createTask(request, me, { name, point: 12 })
    const exec = await findTodayExecution(request, me, name)
    await request.post(`/api/task-executions/${exec.taskExecutionId}/start`, { ...authed(me), data: { memberIds: [me.id] } })
    await request.post(`/api/task-executions/${exec.taskExecutionId}/complete`, { ...authed(me), data: { memberIds: [me.id] } })

    await page.goto('/members')
    await page.getByRole('button', { name: `${me.name}の詳細を見る` }).click()
    await expect(page).toHaveURL(new RegExp(`/members/${me.id}$`))
    await expect(page.getByRole('heading', { name: 'メンバー詳細' })).toBeVisible()
    await expect(page.getByText('今日の獲得')).toBeVisible()
    await expect(sectionBox(page, '家族のタスク').getByRole('button', { name: new RegExp(name) })).toBeVisible()

    // 完了タスクの詳細モーダル
    await sectionBox(page, '家族のタスク').getByRole('button', { name: new RegExp(name) }).click()
    await expect(page.getByRole('dialog')).toContainText('+12pt')
    await page.getByRole('dialog').getByRole('button', { name: '閉じる' }).last().click()

    await page.getByRole('button', { name: '完了履歴を見る' }).click()
    await expect(page).toHaveURL(new RegExp(`/members/${me.id}/completed$`))
    await expect(page.getByRole('heading', { name: '完了履歴' })).toBeVisible()
    await expect(sectionBox(page, '家族のタスク').getByText(name)).toBeVisible()
  })

  test('N-MEM-4 完了したタスク画面で「今日／すべて」を切り替えられる', async ({ page, request }) => {
    const name = uniq('切替')
    await createTask(request, me, { name, point: 3 })
    const exec = await findTodayExecution(request, me, name)
    await request.post(`/api/task-executions/${exec.taskExecutionId}/start`, { ...authed(me), data: { memberIds: [me.id] } })
    await request.post(`/api/task-executions/${exec.taskExecutionId}/complete`, { ...authed(me), data: { memberIds: [me.id] } })

    await page.goto('/executions/completed')
    await expect(sectionBox(page, '家族のタスク').getByText(name)).toBeVisible()
    await page.getByRole('group', { name: '表示する範囲' }).getByRole('button', { name: 'すべて' }).click()
    await expect(page.getByText('すべて', { exact: true }).first()).toBeVisible()
    await expect(sectionBox(page, '家族のタスク').getByText(name)).toBeVisible()
    await page.getByRole('group', { name: '表示する範囲' }).getByRole('button', { name: '今日' }).click()
    await expect(sectionBox(page, '家族のタスク').getByText(name)).toBeVisible()
  })
})
