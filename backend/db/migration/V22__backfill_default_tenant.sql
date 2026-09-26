-- ============================================================
-- V22: 既存データを1つの default tenant に寄せる backfill
--
-- 目的:
--   V21 で tenant_id 列(nullable)を追加した以下10テーブルについて、
--   V23 で tenant_id を NOT NULL 化・FK 制約付与できるように、
--   本マイグレーションで事前に単一の default tenant へ寄せる。
--   本アプリは単一家族運用を前提としている(要件定義.md参照、#36)。
--     members, task_definitions, task_recurrences, task_executions,
--     task_snapshots, task_execution_participants, push_subscriptions,
--     member_metas, outbox, completed_domain_events
--
-- 仕様:
--   - members が0件(まっさらな新規環境)の場合は何もしない。
--     ただし、上記の他9テーブルのいずれかに行が残っている場合は
--     データ不整合とみなし、どのテーブルに何件あるかを示す
--     メッセージ付きで RAISE EXCEPTION する。
--   - members が1件以上の場合:
--     - 最古の member(created_at 昇順、同時刻なら id 昇順で1件目)の
--       name / email を使って tenants に1行作成する。
--         family_name = '<最古メンバー名>の家族'(暫定値。別の値にしたい
--         場合は issue #36 にコメントする、という決定事項に基づく)
--         email       = 最古メンバーの email
--     - 上記10テーブル(members + 他9テーブル)のうち tenant_id が
--       NULL の行をすべて、作成した tenant の id で更新する。
--   - 最後に RAISE NOTICE で、作成した tenant_id と各テーブルの
--     更新件数(GET DIAGNOSTICS で取得)を出力する。
-- ============================================================

DO $$
DECLARE
    v_member_count BIGINT;
    v_row_count BIGINT;
    v_oldest_name VARCHAR(100);
    v_oldest_email VARCHAR(255);
    v_new_tenant_id UUID;
    v_updated_members BIGINT;
    v_updated_task_definitions BIGINT;
    v_updated_task_recurrences BIGINT;
    v_updated_task_executions BIGINT;
    v_updated_task_snapshots BIGINT;
    v_updated_task_execution_participants BIGINT;
    v_updated_push_subscriptions BIGINT;
    v_updated_member_metas BIGINT;
    v_updated_outbox BIGINT;
    v_updated_completed_domain_events BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_member_count FROM members;

    IF v_member_count = 0 THEN
        -- 新規環境想定。ただし他テーブルにデータが残っていれば不整合なので例外にする。
        SELECT COUNT(*) INTO v_row_count FROM task_definitions;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが task_definitions に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM task_recurrences;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが task_recurrences に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM task_executions;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが task_executions に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM task_snapshots;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが task_snapshots に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM task_execution_participants;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが task_execution_participants に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM push_subscriptions;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが push_subscriptions に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM member_metas;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが member_metas に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM outbox;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが outbox に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        SELECT COUNT(*) INTO v_row_count FROM completed_domain_events;
        IF v_row_count > 0 THEN
            RAISE EXCEPTION 'membersが0件ですが completed_domain_events に % 件のデータが存在します。データ不整合の可能性があります。', v_row_count;
        END IF;

        -- どのテーブルにもデータが無ければ何もせず終了(新規環境)
        RETURN;
    END IF;

    -- members が1件以上の場合: 最古のmemberの情報からdefault tenantを作成する
    SELECT name, email
    INTO v_oldest_name, v_oldest_email
    FROM members
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    INSERT INTO tenants (family_name, email)
    VALUES (v_oldest_name || 'の家族', v_oldest_email)
    RETURNING id INTO v_new_tenant_id;

    UPDATE members SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_members = ROW_COUNT;

    UPDATE task_definitions SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_task_definitions = ROW_COUNT;

    UPDATE task_recurrences SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_task_recurrences = ROW_COUNT;

    UPDATE task_executions SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_task_executions = ROW_COUNT;

    UPDATE task_snapshots SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_task_snapshots = ROW_COUNT;

    UPDATE task_execution_participants SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_task_execution_participants = ROW_COUNT;

    UPDATE push_subscriptions SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_push_subscriptions = ROW_COUNT;

    UPDATE member_metas SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_member_metas = ROW_COUNT;

    UPDATE outbox SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_outbox = ROW_COUNT;

    UPDATE completed_domain_events SET tenant_id = v_new_tenant_id WHERE tenant_id IS NULL;
    GET DIAGNOSTICS v_updated_completed_domain_events = ROW_COUNT;

    RAISE NOTICE 'default tenant を作成しました: tenant_id=%, members=%, task_definitions=%, task_recurrences=%, task_executions=%, task_snapshots=%, task_execution_participants=%, push_subscriptions=%, member_metas=%, outbox=%, completed_domain_events=%',
        v_new_tenant_id,
        v_updated_members,
        v_updated_task_definitions,
        v_updated_task_recurrences,
        v_updated_task_executions,
        v_updated_task_snapshots,
        v_updated_task_execution_participants,
        v_updated_push_subscriptions,
        v_updated_member_metas,
        v_updated_outbox,
        v_updated_completed_domain_events;
END $$;
