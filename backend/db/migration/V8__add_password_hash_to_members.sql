-- V8: membersテーブルにpassword_hash列を追加
-- JWT認証のためのパスワードハッシュ保存用

ALTER TABLE members ADD COLUMN password_hash VARCHAR(255) NOT NULL;

-- 名前でのログイン検索を高速化するためのユニークインデックス
CREATE UNIQUE INDEX idx_members_name ON members(name);

-- カラムコメント
COMMENT ON COLUMN members.password_hash IS 'BCryptでハッシュ化されたパスワード';
