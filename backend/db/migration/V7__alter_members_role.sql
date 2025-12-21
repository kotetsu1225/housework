-- V7: メンバーのrole列を4値に変更
-- PARENT/CHILD から Father/Mother/Sister/Brother に変更

-- 1. 既存のCHECK制約を削除
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_role_check;

-- 2. 新しいCHECK制約を追加
ALTER TABLE members ADD CONSTRAINT members_role_check
    CHECK (role IN ('FATHER', 'MOTHER', 'SISTER', 'BROTHER'));

-- 3. 既存データがある場合のマイグレーション（任意）
-- UPDATE members SET role = 'FATHER' WHERE role = 'PARENT';
-- UPDATE members SET role = 'BROTHER' WHERE role = 'CHILD';

-- コメント更新
COMMENT ON COLUMN members.role IS '家族内の役割（FATHER: 父、MOTHER: 母、SISTER: 姉妹、BROTHER: 兄弟）';
