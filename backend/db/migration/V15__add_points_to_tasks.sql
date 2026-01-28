-- V15: タスクにポイント機能を追加
-- task_definitionsにpoint、task_snapshotsにfrozen_point、task_execution_participantsにearned_pointを追加

-- ================================================
-- Step 1: task_definitions テーブルに point カラムを追加
-- ================================================
ALTER TABLE task_definitions 
ADD COLUMN point INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN task_definitions.point IS 'タスク完了時に獲得できるポイント';

-- ================================================
-- Step 2: task_snapshots テーブルに frozen_point カラムを追加
-- ================================================
ALTER TABLE task_snapshots 
ADD COLUMN frozen_point INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN task_snapshots.frozen_point IS 'タスク開始時点で凍結されたポイント';

-- ================================================
-- Step 3: task_execution_participants テーブルに earned_point カラムを追加
-- ================================================
ALTER TABLE task_execution_participants 
ADD COLUMN earned_point INTEGER;

COMMENT ON COLUMN task_execution_participants.earned_point IS '獲得したポイント（NULL = 未完了、NOT NULL = 完了時の獲得ポイント）';
