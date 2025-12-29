-- V10: MemberAvailabilitiesを論理削除から物理削除に変更
--
-- 設計判断: 「空き時間がないならMemberAvailability自体が不要」
-- 論理削除（is_deleted）は不要となるため、カラムを削除
--
-- 注意: time_slotsテーブルはON DELETE CASCADEが設定されているため、
--       member_availabilitiesの削除時に自動的に削除される

-- 1. 論理削除済みのレコードを物理削除（関連するtime_slotsも自動削除）
DELETE FROM member_availabilities WHERE is_deleted = true;

-- 2. is_deletedカラムを削除
ALTER TABLE member_availabilities DROP COLUMN is_deleted;

-- コメント追加
COMMENT ON TABLE member_availabilities IS
    'メンバーの空き時間（物理削除方式）';
