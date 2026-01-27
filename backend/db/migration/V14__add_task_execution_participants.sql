-- V14: タスク実行の複数人参加対応
-- assignee_member_id / completed_by_member_id を廃止し、参加者テーブルへ移行

-- ================================================
-- Step 1: task_execution_participants テーブル作成
-- ================================================
CREATE TABLE task_execution_participants (
    task_execution_id UUID NOT NULL REFERENCES task_executions(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_execution_id, member_id)
);

CREATE INDEX idx_task_execution_participants_member ON task_execution_participants(member_id);
CREATE INDEX idx_task_execution_participants_execution ON task_execution_participants(task_execution_id);

COMMENT ON TABLE task_execution_participants IS 'タスク実行の参加者';
COMMENT ON COLUMN task_execution_participants.task_execution_id IS 'タスク実行ID（外部キー）';
COMMENT ON COLUMN task_execution_participants.member_id IS 'メンバーID（外部キー）';
COMMENT ON COLUMN task_execution_participants.joined_at IS '参加日時';

-- ================================================
-- Step 2: 既存データの移行
-- ================================================

-- assignee_member_id があるレコードを参加者へ移行
INSERT INTO task_execution_participants (task_execution_id, member_id, joined_at)
SELECT
    id,
    assignee_member_id,
    COALESCE(started_at, created_at)
FROM task_executions
WHERE assignee_member_id IS NOT NULL;

-- completed_by_member_id がある場合も参加者へ追加（重複は除外）
INSERT INTO task_execution_participants (task_execution_id, member_id, joined_at)
SELECT
    id,
    completed_by_member_id,
    COALESCE(completed_at, created_at)
FROM task_executions
WHERE completed_by_member_id IS NOT NULL
ON CONFLICT (task_execution_id, member_id) DO NOTHING;

-- ================================================
-- Step 3: 旧制約/インデックスの削除
-- ================================================
ALTER TABLE task_executions
DROP CONSTRAINT IF EXISTS chk_completed;

DROP INDEX IF EXISTS idx_task_executions_assignee;

-- ================================================
-- Step 4: 旧カラムの削除
-- ================================================
ALTER TABLE task_executions
DROP COLUMN assignee_member_id,
DROP COLUMN completed_by_member_id;

-- ================================================
-- Step 5: 新しい制約の追加
-- ================================================
ALTER TABLE task_executions
ADD CONSTRAINT chk_completed_at CHECK (
    status != 'COMPLETED' OR completed_at IS NOT NULL
);
