/**
 * 異常系: 権限（他人の個人タスク）と、タスク実行の状態遷移違反
 *
 * UI が防いでいる操作も、API を直接叩いて「サーバー側でも拒否されること」を確認する。
 */
import { test, expect } from '@playwright/test'
import { setupMember, useSession, createTask, findTodayExecution, buildTaskRequest, authed, uniq, todayJst, toMonthDayLabel, type TestMember } from '../helpers'

test.describe('異常系 / 権限', () => {
  let owner: TestMember
  let other: TestMember

  test.beforeEach(async ({ request }) => {
    owner = await setupMember(request, { prefix: 'own' })
    other = await setupMember(request, { prefix: 'oth', role: 'MOTHER' })
  })

  test('A-PERM-1 他人の個人タスクには編集・削除ボタンが出ず、詳細モーダルにも「編集」が無い', async ({ page, request }) => {
    const name = uniq('他人の')
    await createTask(request, owner, { name, scope: 'PERSONAL', ownerMemberId: owner.id, point: 0, schedule: { type: 'OneTime', deadline: todayJst() } })

    await useSession(page, other)
    await page.goto('/tasks/list')
    // 全員表示に切り替えて他人のタスクを表示
    await page.getByRole('group', { name: '表示する範囲' }).getByRole('button', { name: '個人' }).click()
    await page.getByRole('group', { name: 'メンバーで絞り込み' }).getByRole('button', { name: '全員' }).click()
    await expect(page.getByText(name)).toBeVisible()
    await expect(page.getByRole('button', { name: `${name}を編集` })).toHaveCount(0)
    await expect(page.getByRole('button', { name: `${name}を削除` })).toHaveCount(0)

    // タスク画面の日付モーダルから詳細を開いても「編集」は無い
    await page.goto('/tasks')
    await page.getByRole('button', { name: toMonthDayLabel(todayJst()) }).click()
    await page.getByRole('dialog').getByText(name).click()
    const detail = page.getByRole('dialog').filter({ hasText: 'タスク詳細' })
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('button', { name: '編集' })).toHaveCount(0)
  })

  test('A-PERM-2 API: 他人の個人タスクの更新・削除は 400 で拒否される', async ({ request }) => {
    const name = uniq('守る')
    const task = await createTask(request, owner, { name, scope: 'PERSONAL', ownerMemberId: owner.id, point: 0 })

    const upd = await request.post(`/api/task-definitions/${task.id}/update`, { ...authed(other), data: { name: 'hijacked' } })
    expect(upd.status()).toBe(400)
    expect((await upd.json()).error).toContain('このタスクを編集する権限がありません')

    const del = await request.post(`/api/task-definitions/${task.id}/delete`, { ...authed(other), data: {} })
    expect(del.status()).toBe(400)
    expect((await del.json()).error).toContain('このタスクを削除する権限がありません')

    // 本人なら更新できる
    const ok = await request.post(`/api/task-definitions/${task.id}/update`, { ...authed(owner), data: { name: `${name}改` } })
    expect(ok.status()).toBe(200)
  })

  test('A-PERM-3 API: PERSONAL なのに ownerMemberId が無い定義は 400', async ({ request }) => {
    const res = await request.post('/api/task-definitions/create', {
      ...authed(owner),
      data: buildTaskRequest({ name: uniq('owner無'), scope: 'PERSONAL', ownerMemberId: null }),
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('異常系 / タスク実行の状態遷移', () => {
  let me: TestMember

  test.beforeEach(async ({ request }) => {
    me = await setupMember(request, { prefix: 'st' })
  })

  test('A-STATE-1 担当者なしで開始しようとすると 400（担当者が1人以上必要）', async ({ request }) => {
    const name = uniq('無担当')
    await createTask(request, me, { name })
    const exec = await findTodayExecution(request, me, name)
    const res = await request.post(`/api/task-executions/${exec.taskExecutionId}/start`, { ...authed(me), data: { memberIds: [] } })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toContain('担当者が1人以上必要')
  })

  test('A-STATE-2 未着手のタスクを直接完了しようとすると拒否される', async ({ request }) => {
    const name = uniq('未着手完了')
    await createTask(request, me, { name })
    const exec = await findTodayExecution(request, me, name)
    const res = await request.post(`/api/task-executions/${exec.taskExecutionId}/complete`, { ...authed(me), data: {} })
    expect(res.ok()).toBeFalsy()
    expect((await res.json()).error).toContain('タスクが開始されていません')
    // 状態は変わっていない
    const after = await findTodayExecution(request, me, name)
    expect(after.status).toBe('NOT_STARTED')
  })

  test('A-STATE-3 開始済みのタスクを二重に開始すると拒否され、完了後の再完了・再開始も拒否される', async ({ request }) => {
    const name = uniq('二重')
    await createTask(request, me, { name })
    const exec = await findTodayExecution(request, me, name)
    const id = exec.taskExecutionId

    const start1 = await request.post(`/api/task-executions/${id}/start`, { ...authed(me), data: { memberIds: [me.id] } })
    expect(start1.status()).toBe(200)

    const start2 = await request.post(`/api/task-executions/${id}/start`, { ...authed(me), data: { memberIds: [me.id] } })
    expect(start2.ok()).toBeFalsy()
    expect((await start2.json()).error).toContain('タスクは既に開始されています')

    const complete1 = await request.post(`/api/task-executions/${id}/complete`, { ...authed(me), data: {} })
    expect(complete1.status()).toBe(200)

    const complete2 = await request.post(`/api/task-executions/${id}/complete`, { ...authed(me), data: {} })
    expect(complete2.ok()).toBeFalsy()
    expect((await complete2.json()).error).toContain('タスクは既に完了しています')

    const start3 = await request.post(`/api/task-executions/${id}/start`, { ...authed(me), data: { memberIds: [me.id] } })
    expect(start3.ok()).toBeFalsy()
    expect((await start3.json()).error).toContain('タスクは既に完了しています')
  })

  test('A-STATE-4 削除済みタスクの再削除・更新は 400、存在しないIDの取得は 404', async ({ request }) => {
    const name = uniq('消えた')
    const task = await createTask(request, me, { name })
    const del1 = await request.post(`/api/task-definitions/${task.id}/delete`, { ...authed(me), data: {} })
    expect(del1.status()).toBe(200)

    const del2 = await request.post(`/api/task-definitions/${task.id}/delete`, { ...authed(me), data: {} })
    expect(del2.status()).toBe(400)
    expect((await del2.json()).error).toContain('見つかりませんでした')

    const upd = await request.post(`/api/task-definitions/${task.id}/update`, { ...authed(me), data: { name: 'x' } })
    expect(upd.status()).toBe(400)

    const get = await request.get('/api/task-definitions/00000000-0000-0000-0000-000000000000', authed(me))
    expect(get.status()).toBe(404)

    const exec = await request.get('/api/task-executions/00000000-0000-0000-0000-000000000000', authed(me))
    expect(exec.status()).toBe(404)
  })

  test('A-STATE-5 削除したタスクの当日分はホームから消え、実行は（Outbox 経由で）キャンセル扱いになる', async ({ page, request }) => {
    test.setTimeout(60_000)
    const name = uniq('削除後')
    const task = await createTask(request, me, { name })
    const exec = await findTodayExecution(request, me, name)
    await request.post(`/api/task-definitions/${task.id}/delete`, { ...authed(me), data: {} })

    // 削除イベントは Outbox に書かれ、10 秒間隔のスケジューラが実行をキャンセルする
    await expect
      .poll(async () => (await (await request.get(`/api/task-executions/${exec.taskExecutionId}`, authed(me))).json()).status, { timeout: 30_000 })
      .toBe('CANCELLED')

    await useSession(page, me)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0)
  })
})
