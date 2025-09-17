exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('api_events', {
    id: 'bigserial',
    tenant_id: { type: 'text', notNull: true },
    endpoint: { type: 'text', notNull: true },
    event_type: { type: 'text', notNull: true },
    occurred_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    status_code: { type: 'integer' },
    request_id: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
  }, { ifNotExists: true });

  pgm.createIndex('api_events', ['tenant_id', 'occurred_at'], {
    ifNotExists: true,
    name: 'api_events_tenant_id_occurred_at_idx',
  });
  pgm.createIndex('api_events', ['tenant_id', 'endpoint', { name: 'occurred_at', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'api_events_tenant_endpoint_time_idx',
  });
  pgm.createIndex('api_events', ['request_id'], { ifNotExists: true });

  pgm.createTable('usage_counters', {
    tenant_id: { type: 'text', notNull: true },
    endpoint: { type: 'text', notNull: true },
    period_start: { type: 'timestamptz', notNull: true },
    call_count: { type: 'bigint', notNull: true, default: 0 },
    last_updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  }, { ifNotExists: true });

  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'usage_counters_pkey'
      ) THEN
        ALTER TABLE usage_counters
          ADD CONSTRAINT usage_counters_pkey PRIMARY KEY (tenant_id, endpoint, period_start);
      END IF;
    END;
    $$;
  `);

  pgm.createIndex('usage_counters', ['period_start'], { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('usage_counters', { ifExists: true, cascade: true });
  pgm.dropTable('api_events', { ifExists: true, cascade: true });
};
