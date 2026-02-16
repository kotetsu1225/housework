ALTER TABLE members ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE task_definitions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE task_recurrences ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE task_executions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE task_snapshots ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE task_execution_participants ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE member_metas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE outbox ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE completed_domain_events ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================
-- FK 制約の追加
-- ============================================================

ALTER TABLE members ADD CONSTRAINT fk_members_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE task_definitions ADD CONSTRAINT fk_task_definitions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE task_recurrences ADD CONSTRAINT fk_task_recurrences_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE task_executions ADD CONSTRAINT fk_task_executions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE task_snapshots ADD CONSTRAINT fk_task_snapshots_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE task_execution_participants ADD CONSTRAINT fk_task_execution_participants_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE push_subscriptions ADD CONSTRAINT fk_push_subscriptions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE member_metas ADD CONSTRAINT fk_member_metas_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE outbox ADD CONSTRAINT fk_outbox_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);

ALTER TABLE completed_domain_events ADD CONSTRAINT fk_completed_domain_events_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);
