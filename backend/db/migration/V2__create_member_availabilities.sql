-- V2: MemberAvailability集約の永続化
-- 集約ルート: MemberAvailability
-- 値オブジェクト: TimeSlot（複数）

-- ============================================
-- テーブル1: 集約ルート（MemberAvailability）
-- ============================================
CREATE TABLE member_availabilities (
    -- 集約ルートの識別子
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 外部集約への参照（ID参照のみ）
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

    -- 集約ルートの属性
    target_date DATE NOT NULL,

    -- メタデータ
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ドメイン不変条件: 1メンバー1日付につき1つの集約のみ
    CONSTRAINT uq_member_target_date UNIQUE (member_id, target_date)
);

-- ============================================
-- テーブル2: 値オブジェクトコレクション（TimeSlot）
-- ============================================
CREATE TABLE time_slots (
    -- TimeSlot識別用ID（技術的なID、ドメインIDではない）
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 親集約への参照
    member_availability_id UUID NOT NULL REFERENCES member_availabilities(id) ON DELETE CASCADE,

    -- TimeSlotの属性
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    memo TEXT,

    -- メタデータ
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ドメイン不変条件: 開始時刻 < 終了時刻
    CONSTRAINT chk_time_order CHECK (start_time < end_time)
);

-- インデックス
CREATE INDEX idx_member_availabilities_member_id ON member_availabilities(member_id);
CREATE INDEX idx_member_availabilities_target_date ON member_availabilities(target_date);
CREATE INDEX idx_time_slots_availability_id ON time_slots(member_availability_id);

-- コメント（member_availabilities）
COMMENT ON TABLE member_availabilities IS 'MemberAvailability集約ルート';
COMMENT ON COLUMN member_availabilities.id IS 'MemberAvailabilityId（集約ルートID）';
COMMENT ON COLUMN member_availabilities.member_id IS 'MemberId（外部集約参照）';
COMMENT ON COLUMN member_availabilities.target_date IS '対象日';
COMMENT ON COLUMN member_availabilities.is_deleted IS '論理削除フラグ';
COMMENT ON COLUMN member_availabilities.created_at IS '作成日時';
COMMENT ON COLUMN member_availabilities.updated_at IS '更新日時';

-- コメント（time_slots）
COMMENT ON TABLE time_slots IS 'TimeSlot値オブジェクト（MemberAvailability集約の一部）';
COMMENT ON COLUMN time_slots.id IS '技術的ID（ドメインには露出しない）';
COMMENT ON COLUMN time_slots.member_availability_id IS '親集約のID';
COMMENT ON COLUMN time_slots.start_time IS '開始時刻';
COMMENT ON COLUMN time_slots.end_time IS '終了時刻';
COMMENT ON COLUMN time_slots.memo IS 'メモ';
COMMENT ON COLUMN time_slots.created_at IS '作成日時';
COMMENT ON COLUMN time_slots.updated_at IS '更新日時';
