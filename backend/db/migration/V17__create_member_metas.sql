-- V17: member_metas テーブルを作成
-- ユーザーの回答済みメタ情報（push通知許可など）を永続化する

CREATE TABLE member_metas (
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id, key)
);

CREATE INDEX idx_member_metas_member_id ON member_metas(member_id);

COMMENT ON TABLE member_metas IS 'メンバーのメタ情報（回答済みフラグなど）';
COMMENT ON COLUMN member_metas.member_id IS 'メンバーID';
COMMENT ON COLUMN member_metas.key IS 'メタ情報のキー';
COMMENT ON COLUMN member_metas.value IS 'メタ情報の値';
