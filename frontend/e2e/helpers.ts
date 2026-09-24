/**
 * E2E 共通ヘルパー
 *
 * - 一意な名前の生成（DB を共有するので、テストごとに別ユーザー・別タスク名を使う）
 * - API 経由のセットアップ（登録、タスク定義作成、通知回答）
 * - ブラウザへのセッション注入（アプリと同じ localStorage キーを使う）
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test'

export type FamilyRole = 'FATHER' | 'MOTHER' | 'BROTHER' | 'SISTER'

export interface TestMember {
  id: string
  name: string
  email: string
  role: FamilyRole
  password: string
  token: string
}

/** 短い一意サフィックス（メンバー名はアプリ全体で一意である必要がある） */
export function uniq(prefix: string): string {
  return `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`
}

/** Asia/Tokyo の今日（バックエンドの AppTimeZone と揃える） */
export function todayJst(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

/** 'HH:mm' を、JST の指定日のその時刻を表す ISO 文字列にする */
export function jstTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString()
}

/** 'yyyy-MM-dd' → 'M月d日'（カレンダーの aria-label と同じ書式） */
export function toMonthDayLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日`
}

function decodeJwtSub(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  return payload.sub as string
}

/** 新規登録 API でテスト用メンバーを作る */
export async function registerMember(
  request: APIRequestContext,
  opts: { prefix?: string; role?: FamilyRole; password?: string } = {}
): Promise<TestMember> {
  const name = uniq(opts.prefix ?? 'u')
  const email = `${name}@example.com`
  const password = opts.password ?? 'password123'
  const role = opts.role ?? 'FATHER'
  const res = await request.post('/api/auth/register', {
    data: { name, email, familyRole: role, password },
  })
  expect(res.status(), await res.text()).toBe(201)
  const body = await res.json()
  return { id: decodeJwtSub(body.token), name, email, role, password, token: body.token }
}

/** 通知許可モーダルに「今はしない」と答えた状態にする（ホームでモーダルが出なくなる） */
export async function answerNotificationPrompt(request: APIRequestContext, member: TestMember): Promise<void> {
  const res = await request.post('/api/push-subscriptions/permission-answer', {
    headers: { Authorization: `Bearer ${member.token}` },
    data: { value: false },
  })
  expect(res.status(), await res.text()).toBe(204)
}

/** 登録 + 通知回答済み のメンバーを一度に用意する */
export async function setupMember(
  request: APIRequestContext,
  opts: { prefix?: string; role?: FamilyRole; password?: string } = {}
): Promise<TestMember> {
  const member = await registerMember(request, opts)
  await answerNotificationPrompt(request, member)
  return member
}

/** ページを開く前にセッションを注入する（アプリの AuthContext が localStorage から復元する） */
export async function useSession(page: Page, member: TestMember): Promise<void> {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('housework_token', token)
      localStorage.setItem('housework_currentUser', JSON.stringify(user))
    },
    {
      token: member.token,
      user: { id: member.id, name: member.name, email: member.email, role: member.role, createdAt: new Date().toISOString() },
    }
  )
}

export interface CreateTaskOptions {
  name: string
  description?: string
  scope?: 'FAMILY' | 'PERSONAL'
  ownerMemberId?: string | null
  point?: number
  /** 'HH:mm' */
  startTime?: string
  endTime?: string
  /** 省略時は今日から毎日 */
  schedule?:
    | { type: 'OneTime'; deadline: string }
    | { type: 'Recurring'; pattern: { type: 'Daily'; skipWeekends: boolean } | { type: 'Weekly'; dayOfWeek: string } | { type: 'Monthly'; dayOfMonth: number }; startDate: string; endDate: string | null }
}

export function buildTaskRequest(opts: CreateTaskOptions) {
  const today = todayJst()
  return {
    name: opts.name,
    description: opts.description ?? '',
    scheduledTimeRange: {
      startTime: jstTimeToIso(today, opts.startTime ?? '09:00'),
      endTime: jstTimeToIso(today, opts.endTime ?? '10:00'),
    },
    scope: opts.scope ?? 'FAMILY',
    ownerMemberId: opts.ownerMemberId ?? null,
    schedule: opts.schedule ?? { type: 'Recurring', pattern: { type: 'Daily', skipWeekends: false }, startDate: today, endDate: null },
    point: opts.point ?? 10,
  }
}

/** タスク定義を API で作る。今日が対象日なら当日分の実行も同時に作られる（同期イベント） */
export async function createTask(request: APIRequestContext, member: TestMember, opts: CreateTaskOptions) {
  const res = await request.post('/api/task-definitions/create', {
    headers: { Authorization: `Bearer ${member.token}` },
    data: buildTaskRequest(opts),
  })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()) as { id: string; name: string }
}

/** 今日のダッシュボードから、タスク名で実行IDを引く */
export async function findTodayExecution(request: APIRequestContext, member: TestMember, taskName: string) {
  const res = await request.get(`/api/dashboard?date=${todayJst()}`, {
    headers: { Authorization: `Bearer ${member.token}` },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  const task = (body.todayTasks as Array<{ taskName: string; taskExecutionId: string; status: string }>).find((t) => t.taskName === taskName)
  expect(task, `today's execution for ${taskName}`).toBeTruthy()
  return task!
}

/** 認証付きの API 呼び出し（異常系の API レベル検証用） */
export function authed(member: TestMember) {
  return { headers: { Authorization: `Bearer ${member.token}` } }
}

/** ホームの通知モーダルが出ていれば「今はしない」で閉じる */
export async function dismissNotificationModalIfShown(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: '今はしない' })
  if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
    await button.click()
    await expect(button).toBeHidden()
  }
}

/** ログイン画面から UI でログインする */
export async function loginViaUi(page: Page, member: TestMember): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('名前').fill(member.name)
  await page.getByLabel('パスワード', { exact: true }).fill(member.password)
  await page.getByRole('button', { name: 'ログイン' }).click()
}

/** 「家族のタスク」などの箱（SectionBox）を見出しで特定する */
export function sectionBox(page: Page, title: string | RegExp) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: title }) }).last()
}

/** 「毎日の定期タスク」などの開閉できる箱（CollapsibleBox）をトグルボタンの文言で特定する */
export function collapsibleBox(page: Page, title: string) {
  return page.locator('section').filter({ has: page.getByRole('button', { name: new RegExp(`^${title}`) }) }).last()
}
