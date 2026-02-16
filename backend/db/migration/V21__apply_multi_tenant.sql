-- ============================================================
-- V21: マルチテナント対応（スキーマ変更のみ）
-- 共有DB・共有スキーマ + RLS + 2ロール方式
--
-- 注意: このマイグレーション適用後、V22を適用する前に
-- 手動でテナント作成 + 既存データのtenant_id更新が必要です。
-- 手順は backend/db/manual/ 配下のSQLテンプレートを参照してください。
-- ============================================================

-- ============================================================
-- Step 1: アプリケーション用ロールの作成
-- housework_app は非オーナーのため RLS が自動適用される
-- housework（オーナー）はログイン・スケジューラ用（RLSバイパス）
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'housework_app') THEN
        CREATE ROLE housework_app WITH LOGIN PASSWORD 'housework_app_password';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO housework_app;

-- ============================================================
-- Step 2: 全テーブルに tenant_id 追加（nullable）+ INDEX
-- データ投入とNOT NULL/FK制約はV22で適用
-- ============================================================

-- members
ALTER TABLE members ADD COLUMN tenant_id UUID;
CREATE INDEX idx_members_tenant_id ON members(tenant_id);

-- task_definitions
ALTER TABLE task_definitions ADD COLUMN tenant_id UUID;
CREATE INDEX idx_task_definitions_tenant_id ON task_definitions(tenant_id);

-- task_recurrences
ALTER TABLE task_recurrences ADD COLUMN tenant_id UUID;
CREATE INDEX idx_task_recurrences_tenant_id ON task_recurrences(tenant_id);

-- task_executions
ALTER TABLE task_executions ADD COLUMN tenant_id UUID;
CREATE INDEX idx_task_executions_tenant_id ON task_executions(tenant_id);

-- task_snapshots
ALTER TABLE task_snapshots ADD COLUMN tenant_id UUID;
CREATE INDEX idx_task_snapshots_tenant_id ON task_snapshots(tenant_id);

-- task_execution_participants
ALTER TABLE task_execution_participants ADD COLUMN tenant_id UUID;
CREATE INDEX idx_task_execution_participants_tenant_id ON task_execution_participants(tenant_id);

-- push_subscriptions
ALTER TABLE push_subscriptions ADD COLUMN tenant_id UUID;
CREATE INDEX idx_push_subscriptions_tenant_id ON push_subscriptions(tenant_id);

-- member_metas
ALTER TABLE member_metas ADD COLUMN tenant_id UUID;
CREATE INDEX idx_member_metas_tenant_id ON member_metas(tenant_id);

-- outbox（RLSは適用しない: スケジューラが全テナント横断で処理するため）
ALTER TABLE outbox ADD COLUMN tenant_id UUID;
CREATE INDEX idx_outbox_tenant_id ON outbox(tenant_id);

-- completed_domain_events（RLSは適用しない: 同上）
ALTER TABLE completed_domain_events ADD COLUMN tenant_id UUID;
CREATE INDEX idx_completed_domain_events_tenant_id ON completed_domain_events(tenant_id);

-- ============================================================
-- Step 3: UNIQUE制約のテナントスコープ化
-- members.name を (tenant_id, name) に変更
-- 異なるテナントで同じメンバー名を許可するため
-- ============================================================
DROP INDEX idx_members_name;
CREATE UNIQUE INDEX idx_members_tenant_name ON members(tenant_id, name);

-- members.email はグローバルユニークを維持（認証に使用するため変更なし）
-- push_subscriptions.endpoint もグローバルユニークを維持（ブラウザ固有のため変更なし）

-- ============================================================
-- Step 4: RLS有効化 + ポリシー作成
-- outbox, completed_domain_events は除外
-- ============================================================

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON members
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE task_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON task_definitions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE task_recurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON task_recurrences
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON task_executions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE task_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON task_snapshots
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE task_execution_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON task_execution_participants
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON push_subscriptions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE member_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON member_metas
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================
-- Step 5: housework_app への権限付与
-- ============================================================

-- 既存テーブルへの権限付与
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO housework_app;

-- 今後作成されるテーブルにも自動で同じ権限を付与
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO housework_app;
