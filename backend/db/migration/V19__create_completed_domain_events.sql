CREATE TABLE completed_domain_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_completed_events_type ON completed_domain_events(event_type);

CREATE INDEX idx_completed_events_processed_at ON completed_domain_events(processed_at);

COMMENT ON TABLE completed_domain_events IS '処理済みドメインイベント（冪等性担保用）';
COMMENT ON COLUMN completed_domain_events.event_id IS '処理済みイベントID';
COMMENT ON COLUMN completed_domain_events.event_type IS 'イベントタイプ';
COMMENT ON COLUMN completed_domain_events.processed_at IS '処理完了日時';
