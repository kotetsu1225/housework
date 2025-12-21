-- V6: タスクスナップショットテーブルの作成
-- TaskExecution集約に属するスナップショット値オブジェクトの永続化
-- 実行時点のタスク定義の状態を凍結保存する

CREATE TABLE task_snapshots (
    task_execution_id UUID PRIMARY KEY REFERENCES task_executions(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes > 0),
    definition_version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- コメント
COMMENT ON TABLE task_snapshots IS 'タスクスナップショット（実行時点の凍結情報）';
COMMENT ON COLUMN task_snapshots.task_execution_id IS 'タスク実行ID（外部キー・主キー）';
COMMENT ON COLUMN task_snapshots.name IS '凍結されたタスク名';
COMMENT ON COLUMN task_snapshots.description IS '凍結された説明';
COMMENT ON COLUMN task_snapshots.estimated_minutes IS '凍結された見積時間（分）';
COMMENT ON COLUMN task_snapshots.definition_version IS '元タスク定義のバージョン';
COMMENT ON COLUMN task_snapshots.created_at IS 'スナップショット作成日時';
