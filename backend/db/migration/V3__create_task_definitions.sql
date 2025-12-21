-- V3: タスク定義テーブルの作成
-- TaskDefinition集約のルートエンティティ

CREATE TABLE task_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes > 0),
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('FAMILY', 'PERSONAL')),
    owner_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('RECURRING', 'ONE_TIME')),
    one_time_deadline DATE,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 不変条件: PERSONALスコープの場合はowner_member_idが必須
    CONSTRAINT chk_personal_owner CHECK (
        (scope = 'FAMILY' AND owner_member_id IS NULL) OR
        (scope = 'PERSONAL' AND owner_member_id IS NOT NULL)
    ),

    -- 不変条件: ONE_TIMEの場合はdeadlineが必須
    CONSTRAINT chk_onetime_deadline CHECK (
        (schedule_type = 'RECURRING' AND one_time_deadline IS NULL) OR
        (schedule_type = 'ONE_TIME' AND one_time_deadline IS NOT NULL)
    )
);

-- インデックス
CREATE INDEX idx_task_definitions_scope ON task_definitions(scope);
CREATE INDEX idx_task_definitions_owner ON task_definitions(owner_member_id);
CREATE INDEX idx_task_definitions_schedule_type ON task_definitions(schedule_type);
CREATE INDEX idx_task_definitions_is_deleted ON task_definitions(is_deleted);

-- コメント
COMMENT ON TABLE task_definitions IS 'タスク定義（カタログ）';
COMMENT ON COLUMN task_definitions.id IS 'タスク定義ID（UUID）';
COMMENT ON COLUMN task_definitions.name IS 'タスク名';
COMMENT ON COLUMN task_definitions.description IS 'タスクの説明・実行方法';
COMMENT ON COLUMN task_definitions.estimated_minutes IS '見積時間（分）';
COMMENT ON COLUMN task_definitions.scope IS 'スコープ（FAMILY: 家族全体、PERSONAL: 個人）';
COMMENT ON COLUMN task_definitions.owner_member_id IS '所有者（PERSONALの場合のみ）';
COMMENT ON COLUMN task_definitions.schedule_type IS 'スケジュールタイプ（RECURRING: 定期、ONE_TIME: 単発）';
COMMENT ON COLUMN task_definitions.one_time_deadline IS '期限（ONE_TIMEの場合のみ）';
COMMENT ON COLUMN task_definitions.version IS '楽観ロック用バージョン';
COMMENT ON COLUMN task_definitions.is_deleted IS '論理削除フラグ';
COMMENT ON COLUMN task_definitions.created_at IS '作成日時';
COMMENT ON COLUMN task_definitions.updated_at IS '更新日時';
