-- ============================================================
-- V24: tenants / outbox / completed_domain_events へのRLS適用と権限の最小化
--
-- 背景(issue #38): V21はhousework_appに全テーブルのSELECT/INSERT/UPDATE/DELETEを
-- 付与した一方、RLSポリシーは8テーブルにしか作成しておらず、tenants / outbox /
-- completed_domain_events には無かった。そのためtenantスコープ接続から他テナントの
-- outbox payload（タスク名等を含む）やtenantsの全行を読み書きできてしまう状態だった。
-- 決定(2026-09-19): outbox / completed_domain_eventsの横断処理（スケジューラのポーリング等）
-- はオーナー接続（RLSバイパス）で行うため、RLSを有効にしてもスケジューラは困らない。
-- そのため3テーブルすべてにRLSを適用し、tenantsについては権限レベルでも
-- INSERT/UPDATE/DELETEを拒否して多層防御する。
-- ============================================================

-- ============================================================
-- outbox / completed_domain_events: 他8テーブルと同じtenant_isolation_policyを適用する。
-- tenantスコープtransactionからのINSERT（DeleteTaskDefinitionUseCaseImpl の outbox 書き込み等）は
-- WITH CHECKを満たす。ポーリング/リレーはオーナー接続で行われるためRLSの影響を受けない。
-- ============================================================

ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON outbox
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE completed_domain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON completed_domain_events
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================
-- tenants: housework_appからは自テナント行のSELECTのみ許可する。
-- INSERT/UPDATE/DELETEのポリシーは意図的に作らない（ポリシーが無い操作はRLS上も拒否される）。
-- テナントの作成・列挙はオーナー接続（DatabaseWithoutRLS、#44 #56）で行う。
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_select_policy ON tenants
    FOR SELECT
    USING (id = current_setting('app.current_tenant_id')::uuid);

-- 多層防御: RLSポリシーの有無に関わらず、権限レベルでもINSERT/UPDATE/DELETEを拒否する
-- （SELECTはV21で付与した権限のまま維持する）
REVOKE INSERT, UPDATE, DELETE ON tenants FROM housework_app;

-- ============================================================
-- FORCE ROW LEVEL SECURITYは付けない。
-- オーナー接続（housework）はRLSをバイパスする設計であり、outboxのポーリング/リレー、
-- サインアップ時のテナント作成、テナント列挙はすべてオーナー接続で行うため不要。
-- ============================================================
