/**
 * UI 監査スクリプト（frontend/DESIGN.md §6 の機械チェック）
 *
 * SP（390×844）で各画面を開き、次を計測して違反を一覧表示する。
 *   1. タップ領域: a / button / input / select / role=button|radio|tab が 44×44px 未満
 *   2. 文字コントラスト: 文字を持つ要素の前景／背景が WCAG 2.2 1.4.3 の基準未満
 *      （通常 4.5:1、24px 以上または 18.66px 以上の太字は 3:1）
 *   3. 禁止クラス: bg-gradient-* / backdrop-blur / blur-* / hover:scale-* / dark:
 *   4. フォント: 実際に描画されるフォントが Inter / Roboto / Arial になっていないか
 *
 * 使い方:
 *   npm run dev            # 別ターミナルで開発サーバーを起動（http://127.0.0.1:3000）
 *   npm run ui:audit       # 監査を実行。違反があれば exit code 1
 *
 * 環境変数:
 *   UI_AUDIT_BASE_URL   監査対象の URL（既定: http://127.0.0.1:3000）
 *   UI_AUDIT_PAGES      カンマ区切りのパス（既定: 全画面）
 *   UI_AUDIT_SHOTS      スクリーンショットの保存先ディレクトリ（省略時は保存しない）
 *   UI_AUDIT_BROWSER    Chromium 実行ファイルのパス（Playwright 管理外のブラウザを使うとき）
 *
 * API はすべてモックに差し替えるので、バックエンドは不要。
 * ブラウザは `npx playwright install chromium` で一度だけ入れる。
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = process.env.UI_AUDIT_BASE_URL ?? 'http://127.0.0.1:3000'
const SHOT_DIR = process.env.UI_AUDIT_SHOTS
const ALL_PAGES = ['/login', '/register', '/', '/tasks', '/tasks/list', '/members', '/members/m1', '/executions/completed']
const PAGES = process.env.UI_AUDIT_PAGES ? process.env.UI_AUDIT_PAGES.split(',').map((s) => s.trim()) : ALL_PAGES

/** DESIGN.md §4: タップ領域の最小サイズ */
const MIN_TAP = 44
/** DESIGN.md §2: 文字コントラストの最小比 */
const MIN_CONTRAST = 4.5
const MIN_CONTRAST_LARGE = 3

// ---------------------------------------------------------------------------
// モックデータ（画面を埋めるための最小限）
// ---------------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10)
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'm1', name: 'たろう', role: 'FATHER', exp: Math.floor(Date.now() / 1000) + 86400 })}.sig`

const members = [
  { id: 'm1', name: 'たろう', email: 't@example.com', familyRole: 'FATHER', todayEarnedPoint: 30, todayFamilyTaskCompleted: 2, todayPersonalTaskCompleted: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'm2', name: 'はなこ', email: 'h@example.com', familyRole: 'MOTHER', todayEarnedPoint: 50, todayFamilyTaskCompleted: 3, todayPersonalTaskCompleted: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'm3', name: 'けん', email: 'k@example.com', familyRole: 'BROTHER', todayEarnedPoint: 10, todayFamilyTaskCompleted: 1, todayPersonalTaskCompleted: 2, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
]

const exec = (i, name, status, scope, scheduleType, assignees, point, start, end, date = today) => ({
  taskExecutionId: `e${i}`, taskDefinitionId: `d${i}`, taskName: name, taskDescription: null,
  scheduledStartTime: `${date}T${start}:00+09:00`, scheduledEndTime: `${date}T${end}:00+09:00`,
  scope, scheduleType, status, ownerMemberId: scope === 'PERSONAL' ? 'm1' : null,
  assigneeMemberIds: assignees, assigneeMemberNames: assignees.map((a) => members.find((m) => m.id === a).name),
  scheduledDate: date, point, frozenPoint: status === 'NOT_STARTED' || status === 'SCHEDULED' ? null : point,
})

const dashboard = {
  todayTasks: [
    exec(1, '朝食の片付け', 'COMPLETED', 'FAMILY', 'RECURRING', ['m2'], 10, '07:30', '08:00'),
    exec(2, 'ゴミ出し（燃えるゴミ）', 'IN_PROGRESS', 'FAMILY', 'RECURRING', ['m1'], 10, '08:00', '08:15'),
    exec(3, '洗濯物を干す', 'NOT_STARTED', 'FAMILY', 'RECURRING', [], 15, '09:00', '09:30'),
    exec(4, 'お風呂掃除', 'NOT_STARTED', 'FAMILY', 'RECURRING', ['m3'], 20, '18:00', '18:30'),
    exec(5, '夕食の買い出し', 'NOT_STARTED', 'FAMILY', 'ONE_TIME', ['m2', 'm1'], 20, '16:00', '17:00'),
    exec(6, '英語の宿題', 'NOT_STARTED', 'PERSONAL', 'RECURRING', ['m1'], 5, '20:00', '20:30'),
    exec(7, '掃除機をかける', 'SCHEDULED', 'FAMILY', 'RECURRING', [], 15, '10:00', '10:30', tomorrow),
  ],
  memberSummaries: [],
}

const def = (id, name, scope, schedule, point, start, end, description = '') => ({
  id, name, description, scheduledTimeRange: { startTime: start, endTime: end }, scope,
  ownerMemberId: scope === 'PERSONAL' ? 'm1' : null, schedule, version: 1, isDeleted: false, point,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
})
const recurring = (pattern) => ({ type: 'Recurring', pattern, startDate: '2026-01-01', endDate: null })
const defs = [
  def('d1', '朝食の片付け', 'FAMILY', recurring({ type: 'Daily', skipWeekends: false }), 10, '07:30', '08:00', '食器を洗って乾燥機へ'),
  def('d2', 'ゴミ出し（燃えるゴミ）', 'FAMILY', recurring({ type: 'Weekly', dayOfWeek: 'TUESDAY' }), 10, '08:00', '08:15'),
  def('d4', 'お風呂掃除', 'FAMILY', recurring({ type: 'Daily', skipWeekends: false }), 20, '18:00', '18:30'),
  def('d5', '夕食の買い出し', 'FAMILY', { type: 'OneTime', deadline: today }, 20, '16:00', '17:00'),
  def('d6', '英語の宿題', 'PERSONAL', recurring({ type: 'Daily', skipWeekends: true }), 5, '20:00', '20:30'),
]

const completed = (i, defId, name, scope, scheduleType, assignees, point, start, end, done) => ({
  taskExecutionId: `e${i}`, taskDefinitionId: defId, name, description: null,
  scheduledStartTime: `${today}T${start}:00Z`, scheduledEndTime: `${today}T${end}:00Z`,
  frozenPoint: point, definitionVersion: 1, scope, scheduleType, ownerMemberId: scope === 'PERSONAL' ? 'm1' : null,
  assigneeMembers: assignees.map((a) => ({ id: a, name: members.find((m) => m.id === a).name })),
  scheduledDate: today, completedAt: `${today}T${done}:00Z`,
})
const completedTasks = [
  completed(1, 'd1', '朝食の片付け', 'FAMILY', 'RECURRING', ['m1'], 10, '07:30', '08:00', '08:05'),
  completed(2, 'd5', '夕食の買い出し', 'FAMILY', 'ONE_TIME', ['m1', 'm2'], 20, '16:00', '17:00', '17:10'),
  completed(3, 'd6', '英語の宿題', 'PERSONAL', 'RECURRING', ['m1'], 5, '20:00', '20:30', '20:40'),
]

function mockApi(route) {
  const p = new URL(route.request().url()).pathname
  const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  if (p.startsWith('/api/dashboard')) return json(dashboard)
  if (p === '/api/member') return json({ members })
  if (p.startsWith('/api/member/')) {
    const m = members.find((x) => x.id === p.split('/').pop()) ?? members[0]
    return json({ id: m.id, name: m.name, email: m.email, familyRole: m.familyRole })
  }
  if (p === '/api/push-subscriptions/my') return json({ hasActiveSubscription: false })
  if (p.includes('is-push-notification-permission-answer')) return json({ hasPushNotificationsPermissionAnswer: true })
  if (p.startsWith('/api/task-definitions')) return json({ taskDefinitions: defs, total: defs.length, hasMore: false })
  if (p.startsWith('/api/task-executions')) return json({ taskExecutions: [], total: 0, hasMore: false })
  if (p.startsWith('/api/completed')) return json({ completedTasks, total: completedTasks.length, hasMore: false })
  return json({})
}

// ---------------------------------------------------------------------------
// ブラウザ内で動く計測コード
// ---------------------------------------------------------------------------
function auditInBrowser({ MIN_TAP, MIN_CONTRAST, MIN_CONTRAST_LARGE }) {
  const describe = (el) => {
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ')
    return `<${el.tagName.toLowerCase()}> ${label.slice(0, 24)}`
  }
  const isVisible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
  }
  const parseRgb = (s) => {
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const [r, g, b, a = '1'] = m[1].split(/[\s,\/]+/).filter(Boolean)
    return { r: +r, g: +g, b: +b, a: +a }
  }
  const lum = ({ r, g, b }) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 })
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
  // 祖先をたどって不透明な背景色を合成する（画像・グラデーション背景は判定不能として除外）
  const backgroundOf = (el) => {
    let color = { r: 255, g: 255, b: 255, a: 0 }
    const layers = []
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node)
      if (cs.backgroundImage !== 'none') return null
      const bg = parseRgb(cs.backgroundColor)
      if (bg && bg.a > 0) layers.push(bg)
      if (bg && bg.a >= 1) break
    }
    for (let i = layers.length - 1; i >= 0; i--) color = blend(layers[i], color.a === 0 ? { r: 255, g: 255, b: 255, a: 1 } : color)
    return color.a === 0 ? { r: 255, g: 255, b: 255, a: 1 } : color
  }

  const tap = []
  const seen = new Set()
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="radio"], [role="tab"], [role="checkbox"]')) {
    if (!isVisible(el) || seen.has(el)) continue
    seen.add(el)
    if (el.matches('[disabled], [aria-disabled="true"]')) continue
    const r = el.getBoundingClientRect()
    const w = Math.round(r.width), h = Math.round(r.height)
    if (w < MIN_TAP || h < MIN_TAP) tap.push({ target: describe(el), size: `${w}×${h}` })
  }

  const contrast = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const checked = new Set()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue
    const el = node.parentElement
    if (!el || checked.has(el) || !isVisible(el)) continue
    checked.add(el)
    if (el.closest('[disabled], [aria-disabled="true"], script, style')) continue
    const cs = getComputedStyle(el)
    const fg = parseRgb(cs.color)
    const bg = backgroundOf(el)
    if (!fg || !bg) continue
    const fgOnBg = fg.a < 1 ? blend(fg, bg) : fg
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const large = size >= 24 || (bold && size >= 18.66)
    const need = large ? MIN_CONTRAST_LARGE : MIN_CONTRAST
    const value = ratio(fgOnBg, bg)
    if (value < need) contrast.push({ target: describe(el), ratio: value.toFixed(2), required: need, font: `${size}px${bold ? ' bold' : ''}` })
  }

  const forbidden = []
  const FORBIDDEN = /(^|\s)(bg-gradient-|backdrop-blur|blur-|hover:scale-|dark:)/
  for (const el of document.querySelectorAll('[class]')) {
    const cls = typeof el.className === 'string' ? el.className : ''
    const hit = cls.split(/\s+/).filter((c) => FORBIDDEN.test(` ${c}`))
    if (hit.length) forbidden.push({ target: describe(el), classes: hit.join(' ') })
  }

  const fonts = new Set()
  for (const el of document.querySelectorAll('h1, h2, h3, p, span, label, button, input, a')) {
    if (!isVisible(el)) continue
    const fam = getComputedStyle(el).fontFamily
    if (/^\s*"?(Inter|Roboto|Arial)"?\s*(,|$)/i.test(fam)) fonts.add(fam)
  }

  return { tap, contrast, forbidden, fonts: [...fonts] }
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------
const browser = await chromium.launch(process.env.UI_AUDIT_BROWSER ? { executablePath: process.env.UI_AUDIT_BROWSER } : {})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP',
})
await ctx.addInitScript(({ token }) => {
  localStorage.setItem('housework_token', token)
  localStorage.setItem('housework_currentUser', JSON.stringify({ id: 'm1', name: 'たろう', email: 't@example.com', role: 'FATHER', createdAt: '2026-01-01T00:00:00Z' }))
}, { token })
const apiPattern = new RegExp(`^${BASE_URL.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/api/`)
await ctx.route(apiPattern, mockApi)

if (SHOT_DIR) await mkdir(SHOT_DIR, { recursive: true })

// 開発サーバーが起動しているか先に確認する
try {
  await fetch(BASE_URL, { method: 'HEAD' })
} catch {
  console.error(`開発サーバーに接続できません: ${BASE_URL}\n先に \`npm run dev\` を起動するか、UI_AUDIT_BASE_URL を指定してください。`)
  await browser.close()
  process.exit(2)
}

let failures = 0
for (const pagePath of PAGES) {
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE_URL + pagePath, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  if (SHOT_DIR) {
    const name = pagePath === '/' ? 'home' : pagePath.replace(/^\//, '').replace(/\//g, '-')
    await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
  }

  const result = await page.evaluate(auditInBrowser, { MIN_TAP, MIN_CONTRAST, MIN_CONTRAST_LARGE })
  await page.close()

  const count = result.tap.length + result.contrast.length + result.forbidden.length + result.fonts.length + errors.length
  failures += count
  console.log(`\n== ${pagePath}  ${count === 0 ? 'OK' : `${count} 件`}`)
  for (const e of errors) console.log(`  [error]     ${e}`)
  for (const t of result.tap) console.log(`  [tap<${MIN_TAP}]   ${t.size.padEnd(8)} ${t.target}`)
  for (const c of result.contrast) console.log(`  [contrast]  ${c.ratio}:1 (要 ${c.required}:1, ${c.font}) ${c.target}`)
  for (const f of result.forbidden) console.log(`  [forbidden] ${f.classes}  ${f.target}`)
  for (const f of result.fonts) console.log(`  [font]      ${f}`)
}

await browser.close()
console.log(`\n${failures === 0 ? '違反なし' : `違反 ${failures} 件`}（基準: タップ ${MIN_TAP}px 以上、コントラスト ${MIN_CONTRAST}:1 以上）`)
process.exit(failures === 0 ? 0 : 1)
