-- 初期化スクリプト
-- このファイルはPostgreSQLコンテナの初回起動時に自動実行されます

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- タイムゾーン設定
SET timezone = 'Asia/Tokyo';

-- 確認メッセージ
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully!';
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'housework_app') THEN
        CREATE ROLE housework_app WITH LOGIN PASSWORD 'housework_app_password';
    END IF;
END $$;
