-- V13: MemberAvailability集約の削除
-- 子テーブルから先に削除（外部キー制約のため）

DROP TABLE IF EXISTS time_slots;
DROP TABLE IF EXISTS member_availabilities;
