-- V4: 繰り返し設定テーブルの作成
-- TaskDefinition集約に属する繰り返しパターンの永続化

CREATE TABLE task_recurrences (
    task_definition_id UUID PRIMARY KEY REFERENCES task_definitions(id) ON DELETE CASCADE,
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('DAILY', 'WEEKLY', 'MONTHLY')),

    -- DAILYパターン用
    daily_skip_weekends BOOLEAN,

    -- WEEKLYパターン用（1=月曜, 7=日曜）
    weekly_day_of_week INTEGER CHECK (weekly_day_of_week BETWEEN 1 AND 7),

    -- MONTHLYパターン用（1-31日）
    monthly_day_of_month INTEGER CHECK (monthly_day_of_month BETWEEN 1 AND 31),

    start_date DATE NOT NULL,
    end_date DATE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 不変条件: パターンタイプに応じた必須フィールド
    CONSTRAINT chk_daily_pattern CHECK (
        pattern_type != 'DAILY' OR daily_skip_weekends IS NOT NULL
    ),
    CONSTRAINT chk_weekly_pattern CHECK (
        pattern_type != 'WEEKLY' OR weekly_day_of_week IS NOT NULL
    ),
    CONSTRAINT chk_monthly_pattern CHECK (
        pattern_type != 'MONTHLY' OR monthly_day_of_month IS NOT NULL
    ),

    -- 不変条件: 終了日は開始日より後
    CONSTRAINT chk_date_order CHECK (
        end_date IS NULL OR start_date <= end_date
    )
);

-- コメント
COMMENT ON TABLE task_recurrences IS 'タスクの繰り返し設定';
COMMENT ON COLUMN task_recurrences.task_definition_id IS 'タスク定義ID（外部キー・主キー）';
COMMENT ON COLUMN task_recurrences.pattern_type IS '繰り返しパターン（DAILY: 毎日、WEEKLY: 毎週、MONTHLY: 毎月）';
COMMENT ON COLUMN task_recurrences.daily_skip_weekends IS 'DAILYパターン: 土日をスキップするか';
COMMENT ON COLUMN task_recurrences.weekly_day_of_week IS 'WEEKLYパターン: 曜日（1=月曜〜7=日曜）';
COMMENT ON COLUMN task_recurrences.monthly_day_of_month IS 'MONTHLYパターン: 日付（1-31）';
COMMENT ON COLUMN task_recurrences.start_date IS '繰り返し開始日';
COMMENT ON COLUMN task_recurrences.end_date IS '繰り返し終了日（NULLの場合は無期限）';
COMMENT ON COLUMN task_recurrences.created_at IS '作成日時';
COMMENT ON COLUMN task_recurrences.updated_at IS '更新日時';
