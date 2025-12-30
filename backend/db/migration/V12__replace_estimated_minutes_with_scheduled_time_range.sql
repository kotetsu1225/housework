-- V12: estimated_minutesをscheduled_start_time/scheduled_end_timeに置き換え
-- 本番データが少ないため、既存データを削除してスキーマを変更

-- ================================================
-- Step 1: 既存データの削除（参照順序を考慮）
-- ================================================

-- task_snapshots は task_executions への ON DELETE CASCADE があるため、
-- task_executions を削除すれば自動で削除される

-- task_recurrences は task_definitions を参照しているため先に削除
DELETE FROM task_recurrences;

-- task_executions は task_definitions を参照しているため先に削除
DELETE FROM task_executions;

-- task_definitions を削除
DELETE FROM task_definitions;

-- ================================================
-- Step 2: task_definitions テーブルの変更
-- ================================================

-- estimated_minutes カラムを削除
ALTER TABLE task_definitions DROP COLUMN estimated_minutes;

-- scheduled_start_time と scheduled_end_time カラムを追加
ALTER TABLE task_definitions 
ADD COLUMN scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
ADD COLUMN scheduled_end_time TIMESTAMP WITH TIME ZONE NOT NULL;

-- 開始時間が終了時間より前であることを保証する制約
ALTER TABLE task_definitions
ADD CONSTRAINT chk_scheduled_time_range CHECK (scheduled_start_time < scheduled_end_time);

-- インデックス追加
CREATE INDEX idx_task_definitions_scheduled_start_time ON task_definitions(scheduled_start_time);
CREATE INDEX idx_task_definitions_scheduled_end_time ON task_definitions(scheduled_end_time);

-- コメント更新
COMMENT ON COLUMN task_definitions.scheduled_start_time IS '予定開始時刻';
COMMENT ON COLUMN task_definitions.scheduled_end_time IS '予定終了時刻';

-- ================================================
-- Step 3: task_snapshots テーブルの変更
-- ================================================

-- estimated_minutes カラムを削除
ALTER TABLE task_snapshots DROP COLUMN estimated_minutes;

-- scheduled_start_time と scheduled_end_time カラムを追加
ALTER TABLE task_snapshots 
ADD COLUMN scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
ADD COLUMN scheduled_end_time TIMESTAMP WITH TIME ZONE NOT NULL;

-- 開始時間が終了時間より前であることを保証する制約
ALTER TABLE task_snapshots
ADD CONSTRAINT chk_snapshot_scheduled_time_range CHECK (scheduled_start_time < scheduled_end_time);

-- コメント更新
COMMENT ON COLUMN task_snapshots.scheduled_start_time IS '凍結された予定開始時刻';
COMMENT ON COLUMN task_snapshots.scheduled_end_time IS '凍結された予定終了時刻';

