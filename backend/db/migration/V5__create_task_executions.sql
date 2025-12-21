-- V5: タスク実行テーブルの作成
-- TaskExecution集約のルートエンティティ

CREATE TABLE task_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_definition_id UUID NOT NULL REFERENCES task_definitions(id) ON DELETE RESTRICT,
    assignee_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NOT_STARTED' CHECK (
        status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    ),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 不変条件: IN_PROGRESS以降はstarted_atが必須
    CONSTRAINT chk_started_at CHECK (
        status = 'NOT_STARTED' OR started_at IS NOT NULL
    ),

    -- 不変条件: COMPLETEDの場合はcompleted_atとcompleted_by_member_idが必須
    CONSTRAINT chk_completed CHECK (
        status != 'COMPLETED' OR (completed_at IS NOT NULL AND completed_by_member_id IS NOT NULL)
    )
);

-- インデックス
CREATE INDEX idx_task_executions_definition ON task_executions(task_definition_id);
CREATE INDEX idx_task_executions_assignee ON task_executions(assignee_member_id);
CREATE INDEX idx_task_executions_scheduled_date ON task_executions(scheduled_date);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_task_executions_date_status ON task_executions(scheduled_date, status);

-- コメント
COMMENT ON TABLE task_executions IS 'タスク実行（チケット）';
COMMENT ON COLUMN task_executions.id IS 'タスク実行ID（UUID）';
COMMENT ON COLUMN task_executions.task_definition_id IS '元タスク定義ID（外部キー）';
COMMENT ON COLUMN task_executions.assignee_member_id IS '担当者ID（外部キー）';
COMMENT ON COLUMN task_executions.scheduled_date IS '実行予定日';
COMMENT ON COLUMN task_executions.status IS 'ステータス（NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED）';
COMMENT ON COLUMN task_executions.started_at IS '開始日時';
COMMENT ON COLUMN task_executions.completed_at IS '完了日時';
COMMENT ON COLUMN task_executions.completed_by_member_id IS '完了者ID（外部キー）';
COMMENT ON COLUMN task_executions.created_at IS '作成日時';
COMMENT ON COLUMN task_executions.updated_at IS '更新日時';
