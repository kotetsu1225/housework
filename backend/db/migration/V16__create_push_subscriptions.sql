-- V16: Push購読テーブルの作成
-- Web Push通知の送信先情報を永続化する
-- 注: このテーブルはインフラ層の関心事であり、ドメインモデルではない

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 所有者（どのメンバーの購読か）
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

    -- Web Push API 必須情報
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,

    -- オプション情報
    expiration_time TIMESTAMP WITH TIME ZONE,
    user_agent TEXT,

    -- 有効フラグ（410 Gone時にfalseに更新）
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- 監査情報
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 同一エンドポイントの重複登録を防止
    CONSTRAINT uq_push_subscriptions_endpoint UNIQUE (endpoint)
);

-- インデックス
CREATE INDEX idx_push_subscriptions_member ON push_subscriptions(member_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active)
    WHERE is_active = TRUE;

-- コメント
COMMENT ON TABLE push_subscriptions IS 'Web Push通知の購読情報';
COMMENT ON COLUMN push_subscriptions.member_id IS '購読者のメンバーID';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Push ServiceのエンドポイントURL';
COMMENT ON COLUMN push_subscriptions.p256dh_key IS '暗号化用ECDH公開鍵（Base64）';
COMMENT ON COLUMN push_subscriptions.auth_key IS '認証シークレット（Base64）';
COMMENT ON COLUMN push_subscriptions.is_active IS '有効フラグ（falseで論理削除）';
