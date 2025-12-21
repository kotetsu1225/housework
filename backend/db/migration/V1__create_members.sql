-- V1: メンバーテーブルの作成
-- Member集約のルートエンティティ

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PARENT', 'CHILD')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_members_role ON members(role);

-- コメント
COMMENT ON TABLE members IS '家族メンバー';
COMMENT ON COLUMN members.id IS 'メンバーID（UUID）';
COMMENT ON COLUMN members.name IS 'メンバー名';
COMMENT ON COLUMN members.role IS '家族内の役割（PARENT: 親、CHILD: 子）';
COMMENT ON COLUMN members.created_at IS '作成日時';
COMMENT ON COLUMN members.updated_at IS '更新日時';
