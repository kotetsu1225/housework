-- V2: メンバーの空き時間テーブルの作成
-- Member集約に属するTimeSlot値オブジェクトの永続化

CREATE TABLE member_availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    memo TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 不変条件: 開始時刻 < 終了時刻
    CONSTRAINT chk_time_order CHECK (start_time < end_time)
);

-- インデックス
CREATE INDEX idx_member_availabilities_member_id ON member_availabilities(member_id);
CREATE INDEX idx_member_availabilities_target_date ON member_availabilities(target_date);
CREATE INDEX idx_member_availabilities_member_date ON member_availabilities(member_id, target_date);

-- コメント
COMMENT ON TABLE member_availabilities IS 'メンバーの空き時間';
COMMENT ON COLUMN member_availabilities.id IS '空き時間ID（UUID）';
COMMENT ON COLUMN member_availabilities.member_id IS 'メンバーID（外部キー）';
COMMENT ON COLUMN member_availabilities.target_date IS '対象日';
COMMENT ON COLUMN member_availabilities.start_time IS '開始時刻';
COMMENT ON COLUMN member_availabilities.end_time IS '終了時刻';
COMMENT ON COLUMN member_availabilities.memo IS 'メモ';
COMMENT ON COLUMN member_availabilities.is_deleted IS '論理削除フラグ';
COMMENT ON COLUMN member_availabilities.created_at IS '作成日時';
COMMENT ON COLUMN member_availabilities.updated_at IS '更新日時';
