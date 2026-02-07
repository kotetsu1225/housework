CREATE TABLE outbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);
CREATE INDEX idx_outbox_pending ON outbox(status, created_at)
    WHERE status = 'PENDING';

CREATE INDEX idx_outbox_aggregate ON outbox(aggregate_type, aggregate_id);

COMMENT ON TABLE outbox IS 'ドメインイベントのOutboxテーブル（結果整合性用）';
COMMENT ON COLUMN outbox.id IS 'イベントID（UUID）';
COMMENT ON COLUMN outbox.event_type IS 'イベントタイプ（例: TaskDefinitionDeleted）';
COMMENT ON COLUMN outbox.aggregate_type IS '集約タイプ（例: TaskDefinition）';
COMMENT ON COLUMN outbox.aggregate_id IS '集約のID';
COMMENT ON COLUMN outbox.payload IS 'イベントのJSONペイロード';
COMMENT ON COLUMN outbox.status IS 'ステータス（PENDING, PROCESSED, FAILED）';
COMMENT ON COLUMN outbox.retry_count IS 'リトライ回数';
COMMENT ON COLUMN outbox.max_retries IS '最大リトライ回数';
COMMENT ON COLUMN outbox.created_at IS '作成日時';
COMMENT ON COLUMN outbox.processed_at IS '処理完了日時';
COMMENT ON COLUMN outbox.error_message IS 'エラーメッセージ（FAILED時）';
