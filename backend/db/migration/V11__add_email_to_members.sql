-- membersテーブルにemailカラムを追加
ALTER TABLE members ADD COLUMN email VARCHAR(255);

-- 既存のレコードがある場合のために、一時的にダミーデータを埋める
-- 本番環境ですでにデータがある場合は注意が必要ですが、今回は開発環境想定で一律更新します
UPDATE members SET email = 'dummy-' || id || '@example.com' WHERE email IS NULL;

-- NOT NULL制約とUNIQUE制約を追加
ALTER TABLE members ALTER COLUMN email SET NOT NULL;
ALTER TABLE members ADD CONSTRAINT members_email_key UNIQUE (email);
