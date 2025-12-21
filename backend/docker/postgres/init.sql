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
END $$;
