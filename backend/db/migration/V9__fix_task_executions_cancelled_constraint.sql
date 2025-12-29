-- V9: CANCELLEDステータスでstarted_atがNULLを許可するように制約を修正
--
-- 問題: NotStarted状態からキャンセルする場合、started_atはNULLのまま
-- 現在の制約: status = 'NOT_STARTED' OR started_at IS NOT NULL
-- これだとCANCELLED + started_at=NULLが許可されない
--
-- 修正後: status IN ('NOT_STARTED', 'CANCELLED') OR started_at IS NOT NULL

-- 既存の制約を削除
ALTER TABLE task_executions
DROP CONSTRAINT chk_started_at;

-- 新しい制約を追加（CANCELLEDも許可）
ALTER TABLE task_executions
ADD CONSTRAINT chk_started_at CHECK (
    status IN ('NOT_STARTED', 'CANCELLED') OR started_at IS NOT NULL
);

COMMENT ON CONSTRAINT chk_started_at ON task_executions IS
    'NOT_STARTEDとCANCELLED以外のステータスではstarted_atが必須';
