CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE','DELETED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE tenants IS 'テナント（家族）情報';
COMMENT ON COLUMN tenants.id IS 'テナントID（UUID）';
COMMENT ON COLUMN tenants.family_name IS '家族名';
COMMENT ON COLUMN tenants.email IS 'テナント連絡先メールアドレス';
COMMENT ON COLUMN tenants.status IS 'ステータス（ACTIVE: 有効、DELETED: 削除済み）';
COMMENT ON COLUMN tenants.created_at IS '作成日時';
COMMENT ON COLUMN tenants.updated_at IS '更新日時';
