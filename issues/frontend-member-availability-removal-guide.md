# MemberAvailability機能 フロントエンド削除ガイド

このドキュメントは、MemberAvailability（空き時間）機能をフロントエンドから削除するための詳細な手順書です。
初心者でもミスなく実装できるよう、各ステップを詳細に記載しています。

---

## 目次

1. [概要](#概要)
2. [削除対象ファイル一覧](#削除対象ファイル一覧)
3. [Step 1: API層の削除・修正](#step-1-api層の削除修正)
4. [Step 2: Hooks層の削除・修正](#step-2-hooks層の削除修正)
5. [Step 3: Types層の修正](#step-3-types層の修正)
6. [Step 4: ページ・コンポーネントの削除](#step-4-ページコンポーネントの削除)
7. [Step 5: ルーティング・ナビゲーションの修正](#step-5-ルーティングナビゲーションの修正)
8. [Step 6: Dashboard関連の修正](#step-6-dashboard関連の修正)
9. [Step 7: Mocks・テストの削除](#step-7-mocksテストの削除)
10. [検証手順](#検証手順)

---

## 概要

### 変更理由
MemberAvailability（空き時間管理）機能がドメインモデルから削除されたため、フロントエンドからも関連コードを削除します。

### 影響範囲
- 空き時間管理ページ（`/availability`）の完全削除
- ダッシュボードからの空き時間セクション削除
- ボトムナビゲーションからの「空き時間」メニュー削除

---

## 削除対象ファイル一覧

### 完全削除するファイル（7ファイル）
| ファイルパス | 説明 |
|-------------|------|
| `src/api/memberAvailabilities.ts` | 空き時間API関数 |
| `src/hooks/useMemberAvailability.ts` | 空き時間カスタムフック |
| `src/pages/Availability.tsx` | 空き時間管理ページ |
| `src/components/dashboard/MemberAvailabilitySection.tsx` | ダッシュボード用空き時間コンポーネント |
| `src/mocks/memberAvailabilities.ts` | モックデータ |
| `src/pages/__tests__/Availability.test.tsx` | テストファイル（存在する場合） |
| `src/hooks/__tests__/useMemberAvailability.test.tsx` | テストファイル（存在する場合） |

### 修正するファイル（8ファイル）
| ファイルパス | 修正内容 |
|-------------|----------|
| `src/api/dashboard.ts` | 空き時間関連の型を削除 |
| `src/api/index.ts` | 空き時間API関連のエクスポートを削除 |
| `src/hooks/index.ts` | useMemberAvailabilityのエクスポートを削除 |
| `src/hooks/useDashboard.ts` | memberAvailabilities関連を削除 |
| `src/types/index.ts` | TimeSlot, MemberAvailability型を削除 |
| `src/types/api.ts` | 空き時間API型を削除 |
| `src/pages/index.ts` | Availabilityのエクスポートを削除 |
| `src/components/dashboard/index.ts` | MemberAvailabilitySectionのエクスポートを削除 |
| `src/App.tsx` | /availabilityルートを削除 |
| `src/components/layout/BottomNav.tsx` | 空き時間ナビアイテムを削除 |
| `src/pages/Dashboard.tsx` | MemberAvailabilitySection使用箇所を削除 |

---

## Step 1: API層の削除・修正

### 1-1. `src/api/memberAvailabilities.ts` を削除

```bash
rm src/api/memberAvailabilities.ts
```

### 1-2. `src/api/dashboard.ts` を修正

**変更前:**
```typescript
/**
 * 時間スロットDTO
 */
export interface TimeSlotDto {
  startTime: string // HH:mm
  endTime: string
  memo: string | null
}

/**
 * メンバーの本日の空き時間DTO
 */
export interface MemberAvailabilityTodayDto {
  memberId: string
  memberName: string
  familyRole: string
  slots: TimeSlotDto[]
}

/**
 * ダッシュボードAPIレスポンス
 */
export interface DashboardResponse {
  todayTasks: TodayTaskDto[]
  memberSummaries: MemberTaskSummaryDto[]
  memberAvailabilities: MemberAvailabilityTodayDto[]
}
```

**変更後:**
```typescript
/**
 * ダッシュボードAPIレスポンス
 */
export interface DashboardResponse {
  todayTasks: TodayTaskDto[]
  memberSummaries: MemberTaskSummaryDto[]
}
```

**削除する箇所:**
- 60-67行目: `TimeSlotDto` インターフェース全体を削除
- 69-77行目: `MemberAvailabilityTodayDto` インターフェース全体を削除
- 85行目: `DashboardResponse` から `memberAvailabilities: MemberAvailabilityTodayDto[]` を削除

### 1-3. `src/api/index.ts` を修正

**変更前:**
```typescript
// MemberAvailability API
export {
  getMemberAvailabilities,
  createMemberAvailability,
  updateMemberAvailability,
  deleteMemberAvailabilitySlots,
  deleteMemberAvailability,
} from './memberAvailabilities'

// Dashboard API (CQRS Query)
export { getDashboardData } from './dashboard'
export type {
  DashboardResponse,
  TodayTaskDto,
  MemberTaskDto,
  MemberTaskSummaryDto,
  TimeSlotDto,
  MemberAvailabilityTodayDto,
} from './dashboard'
```

**変更後:**
```typescript
// Dashboard API (CQRS Query)
export { getDashboardData } from './dashboard'
export type {
  DashboardResponse,
  TodayTaskDto,
  MemberTaskDto,
  MemberTaskSummaryDto,
} from './dashboard'
```

**削除する箇所:**
- 25-32行目: MemberAvailability APIのエクスポートブロック全体を削除
- 63-64行目: `TimeSlotDto`, `MemberAvailabilityTodayDto` のエクスポートを削除

---

## Step 2: Hooks層の削除・修正

### 2-1. `src/hooks/useMemberAvailability.ts` を削除

```bash
rm src/hooks/useMemberAvailability.ts
```

### 2-2. `src/hooks/index.ts` を修正

**変更前:**
```typescript
export { useMember } from './useMember'
export { useMemberAvailability } from './useMemberAvailability'
export { useTaskDefinition } from './useTaskDefinition'
export { useTaskExecution } from './useTaskExecution'
export { useDashboard } from './useDashboard'
export type { MemberAvailability, TimeSlot } from './useMemberAvailability'
```

**変更後:**
```typescript
export { useMember } from './useMember'
export { useTaskDefinition } from './useTaskDefinition'
export { useTaskExecution } from './useTaskExecution'
export { useDashboard } from './useDashboard'
```

**削除する箇所:**
- 6行目: `export { useMemberAvailability } from './useMemberAvailability'` を削除
- 10行目: `export type { MemberAvailability, TimeSlot } from './useMemberAvailability'` を削除

### 2-3. `src/hooks/useDashboard.ts` を修正

**変更前:**
```typescript
import type {
  DashboardResponse,
  TodayTaskDto,
  MemberTaskSummaryDto,
  MemberAvailabilityTodayDto,
} from '../api/dashboard'

interface UseDashboardState {
  /** 今日のタスク一覧 */
  todayTasks: TodayTaskDto[]
  /** メンバーごとのタスクサマリー */
  memberSummaries: MemberTaskSummaryDto[]
  /** メンバーの空き時間 */
  memberAvailabilities: MemberAvailabilityTodayDto[]
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}
```

**変更後:**
```typescript
import type {
  DashboardResponse,
  TodayTaskDto,
  MemberTaskSummaryDto,
} from '../api/dashboard'

interface UseDashboardState {
  /** 今日のタスク一覧 */
  todayTasks: TodayTaskDto[]
  /** メンバーごとのタスクサマリー */
  memberSummaries: MemberTaskSummaryDto[]
  /** ローディング状態 */
  loading: boolean
  /** エラーメッセージ */
  error: string | null
}
```

**その他の修正箇所:**

1. **17行目** import から `MemberAvailabilityTodayDto` を削除

2. **28-29行目** `UseDashboardState` から以下を削除:
   ```typescript
   /** メンバーの空き時間 */
   memberAvailabilities: MemberAvailabilityTodayDto[]
   ```

3. **107行目** `useState` の初期値から `memberAvailabilities: []` を削除:
   **変更前:**
   ```typescript
   const [state, setState] = useState<UseDashboardState>({
     todayTasks: [],
     memberSummaries: [],
     memberAvailabilities: [],
     loading: true,
     error: null,
   })
   ```
   **変更後:**
   ```typescript
   const [state, setState] = useState<UseDashboardState>({
     todayTasks: [],
     memberSummaries: [],
     loading: true,
     error: null,
   })
   ```

4. **123行目** `fetchDashboardData` の `setState` から `memberAvailabilities` を削除:
   **変更前:**
   ```typescript
   setState({
     todayTasks: data.todayTasks,
     memberSummaries: data.memberSummaries,
     memberAvailabilities: data.memberAvailabilities,
     loading: false,
     error: null,
   })
   ```
   **変更後:**
   ```typescript
   setState({
     todayTasks: data.todayTasks,
     memberSummaries: data.memberSummaries,
     loading: false,
     error: null,
   })
   ```

5. **JSDocコメント** (7行目付近) から空き時間関連の記載を削除:
   **変更前:**
   ```typescript
   * - 今日のタスク一覧
   * - メンバーごとのタスクサマリー
   * - メンバーの空き時間
   ```
   **変更後:**
   ```typescript
   * - 今日のタスク一覧
   * - メンバーごとのタスクサマリー
   ```

---

## Step 3: Types層の修正

### 3-1. `src/types/index.ts` を修正

**削除する箇所 (33-68行目):**

```typescript
// ==========================================
// MemberAvailability関連の型定義
// ==========================================

/**
 * 空き時間スロット（バックエンド構造に準拠）
 * @see backend/src/main/kotlin/com/task/domain/memberAvailability/MemberAvailability.kt
 */
export interface TimeSlot {
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  memo?: string | null
}

/**
 * メンバー空き時間（バックエンド構造に準拠）
 * 1つの日付に対する空き時間スロットのコレクション
 */
export interface MemberAvailability {
  id: string
  memberId: string
  targetDate: string // YYYY-MM-DD format
  slots: TimeSlot[]
}

/**
 * フラット化された時間スロット（UI表示用）
 * MemberAvailabilityをフラットなリストとして扱う場合に使用
 */
export interface FlatTimeSlot {
  availabilityId: string
  memberId: string
  targetDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  memo?: string | null
}
```

上記のセクション全体を削除してください。

### 3-2. `src/types/api.ts` を修正

**削除する箇所 (118-209行目):**

```typescript
// ==========================================
// MemberAvailability API Types
// ==========================================

/**
 * 空き時間スロットリクエスト
 */
export interface TimeSlotRequest {
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  memo?: string | null
}

/**
 * 空き時間スロットレスポンス
 */
export interface TimeSlotResponse {
  startTime: string // HH:mm format
  endTime: string // HH:mm format
  memo: string | null
}

/**
 * 空き時間作成リクエスト
 * POST /api/member-availabilities/create
 */
export interface CreateMemberAvailabilityRequest {
  memberId: string
  targetDate: string // YYYY-MM-DD format
  slots: TimeSlotRequest[]
}

/**
 * 空き時間作成レスポンス
 */
export interface CreateMemberAvailabilityResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
}

/**
 * 空き時間更新リクエスト
 * POST /api/member-availabilities/{availabilityId}/update
 */
export interface UpdateMemberAvailabilityRequest {
  slots: TimeSlotRequest[]
}

/**
 * 空き時間更新レスポンス
 */
export interface UpdateMemberAvailabilityResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
}

/**
 * 空き時間スロット削除リクエスト
 * POST /api/member-availabilities/{availabilityId}/delete-slots
 */
export interface DeleteMemberAvailabilitySlotsRequest {
  slots: TimeSlotRequest[]
}

/**
 * 空き時間スロット削除レスポンス
 */
export interface DeleteMemberAvailabilitySlotsResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
}

/**
 * メンバー別空き時間一覧取得レスポンス
 * GET /api/member-availabilities/member/{memberId}
 */
export interface GetMemberAvailabilitiesResponse {
  availabilities: MemberAvailabilityResponse[]
}

export interface MemberAvailabilityResponse {
  id: string
  memberId: string
  targetDate: string
  slots: TimeSlotResponse[]
}
```

上記のセクション全体を削除してください。

また、**6行目**のコメントからMemberAvailabilitiesへの参照を削除:

**変更前:**
```typescript
* @see backend/src/main/kotlin/com/task/presentation/Members.kt
* @see backend/src/main/kotlin/com/task/presentation/MemberAvailabilities.kt
```

**変更後:**
```typescript
* @see backend/src/main/kotlin/com/task/presentation/Members.kt
```

---

## Step 4: ページ・コンポーネントの削除

### 4-1. `src/pages/Availability.tsx` を削除

```bash
rm src/pages/Availability.tsx
```

### 4-2. `src/components/dashboard/MemberAvailabilitySection.tsx` を削除

```bash
rm src/components/dashboard/MemberAvailabilitySection.tsx
```

### 4-3. `src/pages/index.ts` を修正

**変更前:**
```typescript
export * from './Dashboard'
export * from './Tasks'
export * from './Members'
export * from './Availability'
export * from './CompletedExecutions'
```

**変更後:**
```typescript
export * from './Dashboard'
export * from './Tasks'
export * from './Members'
export * from './CompletedExecutions'
```

**削除する箇所:**
- 4行目: `export * from './Availability'` を削除

### 4-4. `src/components/dashboard/index.ts` を修正

**変更前:**
```typescript
export { TomorrowTaskDetailModal } from './TomorrowTaskDetailModal'
export type { TomorrowTaskDetailModalProps } from './TomorrowTaskDetailModal'

export { MemberAvailabilitySection } from './MemberAvailabilitySection'
export type { MemberAvailabilitySectionProps } from './MemberAvailabilitySection'
```

**変更後:**
```typescript
export { TomorrowTaskDetailModal } from './TomorrowTaskDetailModal'
export type { TomorrowTaskDetailModalProps } from './TomorrowTaskDetailModal'
```

**削除する箇所:**
- 26-27行目: `MemberAvailabilitySection` と `MemberAvailabilitySectionProps` のエクスポートを削除

---

## Step 5: ルーティング・ナビゲーションの修正

### 5-1. `src/App.tsx` を修正

**変更前:**
```typescript
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Members } from './pages/Members'
import { Availability } from './pages/Availability'
import { CompletedExecutions } from './pages/CompletedExecutions'
```

**変更後:**
```typescript
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Members } from './pages/Members'
import { CompletedExecutions } from './pages/CompletedExecutions'
```

**削除する箇所:**
- 10行目: `import { Availability } from './pages/Availability'` を削除

**また、ルート定義を削除:**

**変更前 (78-85行目):**
```typescript
        <Route
          path="/availability"
          element={
            <ProtectedRoute>
              <Availability />
            </ProtectedRoute>
          }
        />
```

**変更後:**
上記のルート定義全体を削除してください。

### 5-2. `src/components/layout/BottomNav.tsx` を修正

**変更前:**
```typescript
import { Home, ListTodo, Users, Clock } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'ホーム' },
  { to: '/tasks', icon: ListTodo, label: 'タスク' },
  { to: '/members', icon: Users, label: 'メンバー' },
  { to: '/availability', icon: Clock, label: '空き時間' },
]
```

**変更後:**
```typescript
import { Home, ListTodo, Users } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'ホーム' },
  { to: '/tasks', icon: ListTodo, label: 'タスク' },
  { to: '/members', icon: Users, label: 'メンバー' },
]
```

**修正する箇所:**
- 3行目: import から `Clock` を削除
- 9行目: `{ to: '/availability', icon: Clock, label: '空き時間' }` を削除

---

## Step 6: Dashboard関連の修正

### 6-1. `src/pages/Dashboard.tsx` を修正

**変更前 (19行目):**
```typescript
import { MemberAvailabilitySection } from '../components/dashboard/MemberAvailabilitySection'
```

**変更後:**
この行を削除してください。

**変更前 (54行目付近):**
```typescript
  const {
    todayTasks,
    memberAvailabilities,
    loading,
    error,
    refetch,
    startTask,
    completeTask,
    assignTask,
    clearError,
  } = useDashboard(todayStr)
```

**変更後:**
```typescript
  const {
    todayTasks,
    loading,
    error,
    refetch,
    startTask,
    completeTask,
    assignTask,
    clearError,
  } = useDashboard(todayStr)
```

**削除する箇所:**
- 54行目: `memberAvailabilities,` を削除

**変更前 (305-311行目付近):**
```typescript
        {/* メンバーの空き時間 */}
        <section className="mt-8">
          <MemberAvailabilitySection
            availabilities={memberAvailabilities}
            title="今日の空き時間"
          />
        </section>
```

**変更後:**
上記のセクション全体を削除してください。

---

## Step 7: Mocks・テストの削除

### 7-1. `src/mocks/memberAvailabilities.ts` を削除

```bash
rm src/mocks/memberAvailabilities.ts
```

### 7-2. テストファイルの削除（存在する場合）

```bash
rm src/pages/__tests__/Availability.test.tsx
rm src/hooks/__tests__/useMemberAvailability.test.tsx
```

### 7-3. `src/components/layout/__tests__/BottomNav.test.tsx` を修正（存在する場合）

availabilityルートに関するテストケースがある場合は削除してください。

---

## 検証手順

### 1. TypeScriptコンパイルチェック

```bash
cd frontend
npm run build
```

エラーがないことを確認してください。

### 2. Lintチェック

```bash
npm run lint
```

エラーがないことを確認してください。

### 3. テスト実行

```bash
npm test
```

全てのテストがパスすることを確認してください。

### 4. 開発サーバー起動確認

```bash
npm run dev
```

以下を確認してください:
- ✅ `/availability` にアクセスすると404ページが表示される
- ✅ ボトムナビゲーションに「空き時間」がない
- ✅ ダッシュボードに空き時間セクションがない
- ✅ ログイン、タスク一覧、メンバー一覧が正常に動作する

---

## チェックリスト

実装完了後、以下のチェックリストを確認してください:

### 削除したファイル
- [ ] `src/api/memberAvailabilities.ts`
- [ ] `src/hooks/useMemberAvailability.ts`
- [ ] `src/pages/Availability.tsx`
- [ ] `src/components/dashboard/MemberAvailabilitySection.tsx`
- [ ] `src/mocks/memberAvailabilities.ts`
- [ ] `src/pages/__tests__/Availability.test.tsx`（存在する場合）
- [ ] `src/hooks/__tests__/useMemberAvailability.test.tsx`（存在する場合）

### 修正したファイル
- [ ] `src/api/dashboard.ts`
- [ ] `src/api/index.ts`
- [ ] `src/hooks/index.ts`
- [ ] `src/hooks/useDashboard.ts`
- [ ] `src/types/index.ts`
- [ ] `src/types/api.ts`
- [ ] `src/pages/index.ts`
- [ ] `src/components/dashboard/index.ts`
- [ ] `src/App.tsx`
- [ ] `src/components/layout/BottomNav.tsx`
- [ ] `src/pages/Dashboard.tsx`

### 検証
- [ ] `npm run build` が成功する
- [ ] `npm run lint` がエラーなし
- [ ] `npm test` が全てパス
- [ ] `/availability` が404になる
- [ ] BottomNavに「空き時間」がない
- [ ] ダッシュボードに空き時間セクションがない

---

## トラブルシューティング

### よくあるエラー

**1. TypeScriptエラー: Module not found**
```
Cannot find module './memberAvailabilities' or its corresponding type declarations.
```
→ `src/api/index.ts` または `src/hooks/index.ts` でまだエクスポートが残っています。削除してください。

**2. TypeScriptエラー: Property does not exist**
```
Property 'memberAvailabilities' does not exist on type 'UseDashboardState'.
```
→ `src/hooks/useDashboard.ts` から `memberAvailabilities` 関連のコードが完全に削除されていません。

**3. ランタイムエラー: Element type is invalid**
```
Element type is invalid: expected a string or a class/function but got: undefined
```
→ どこかでまだ削除したコンポーネントをインポートしている可能性があります。grep で検索してください:
```bash
grep -r "MemberAvailabilitySection" src/
grep -r "Availability" src/pages/
```

---

## 補足: バックエンドの変更点

バックエンドでは以下の変更が行われています:
- `/api/dashboard` レスポンスから `memberAvailabilities` フィールドが削除
- `/api/member-availabilities/*` エンドポイントが全て削除
- `member_availabilities` テーブルと `time_slots` テーブルがDBから削除

フロントエンドの変更を行う前に、バックエンドが更新されていることを確認してください。
