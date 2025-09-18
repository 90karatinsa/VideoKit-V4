exports.shorthands = undefined;

exports.up = (pgm) => {
  // API event audit trail
  pgm.createTable(
    'api_events',
    {
      id: 'bigserial',
      ts: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      tenant_id: { type: 'text', notNull: true },
      user_id: { type: 'text' },
      method: { type: 'text', notNull: true },
      path: { type: 'text', notNull: true },
      endpoint_norm: { type: 'text', notNull: true },
      status: { type: 'integer', notNull: true },
      duration_ms: { type: 'integer' },
      error_class: { type: 'text' },
      bytes_in: { type: 'bigint' },
      bytes_out: { type: 'bigint' },
    },
    { ifNotExists: true }
  );

  pgm.createIndex('api_events', ['tenant_id', { name: 'ts', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'api_events_tenant_ts_idx',
  });
  pgm.createIndex(
    'api_events',
    ['tenant_id', 'endpoint_norm', { name: 'ts', sort: 'DESC' }],
    {
      ifNotExists: true,
      name: 'api_events_tenant_endpoint_ts_idx',
    }
  );
  pgm.createIndex('api_events', ['ts'], { ifNotExists: true, name: 'api_events_ts_idx' });
  pgm.createIndex('api_events', ['status'], {
    ifNotExists: true,
    name: 'api_events_status_idx',
  });

  // Usage aggregation counters
  pgm.createTable(
    'usage_counters',
    {
      tenant_id: { type: 'text', notNull: true },
      endpoint: { type: 'text', notNull: true },
      period_start: { type: 'date', notNull: true },
      count: { type: 'bigint', notNull: true, default: 0 },
      total_weight: { type: 'bigint', notNull: true, default: 0 },
    },
    { ifNotExists: true }
  );
  pgm.addConstraint('usage_counters', 'usage_counters_pkey', {
    primaryKey: ['tenant_id', 'endpoint', 'period_start'],
  });
  pgm.createIndex('usage_counters', ['tenant_id', 'endpoint'], {
    ifNotExists: true,
    name: 'usage_counters_tenant_endpoint_idx',
  });
  pgm.createIndex('usage_counters', ['period_start'], {
    ifNotExists: true,
    name: 'usage_counters_period_idx',
  });

  // Idempotency records keyed by tenant
  pgm.createTable(
    'idempotency_keys',
    {
      tenant_id: { type: 'text', notNull: true },
      idempotency_key: { type: 'text', notNull: true },
      request_hash: { type: 'text', notNull: true },
      response_status: { type: 'integer' },
      response_body: { type: 'jsonb' },
      locked_at: { type: 'timestamptz' },
      expires_at: { type: 'timestamptz', notNull: true },
    },
    {
      ifNotExists: true,
    }
  );
  pgm.addConstraint('idempotency_keys', 'idempotency_keys_pkey', {
    primaryKey: ['tenant_id', 'idempotency_key'],
  });
  pgm.createIndex('idempotency_keys', ['tenant_id', 'expires_at'], {
    ifNotExists: true,
    name: 'idempotency_keys_tenant_expires_idx',
  });
  pgm.createIndex('idempotency_keys', ['request_hash'], {
    ifNotExists: true,
    name: 'idempotency_keys_request_hash_idx',
  });

  // Plan entitlements catalogue
  pgm.createTable(
    'plan_entitlements',
    {
      plan_id: { type: 'text', primaryKey: true },
      monthly_api_calls_total: { type: 'bigint', notNull: true, default: 0 },
      overrides: {
        type: 'jsonb',
        notNull: true,
        default: pgm.func("'{}'::jsonb"),
      },
    },
    { ifNotExists: true }
  );
  pgm.addConstraint('plan_entitlements', 'plan_entitlements_monthly_calls_non_negative', {
    check: 'monthly_api_calls_total >= 0',
  });

  // Tenant plan assignments
  pgm.createTable(
    'tenants',
    {
      tenant_id: { type: 'text', primaryKey: true },
      plan_id: {
        type: 'text',
        notNull: true,
        references: 'plan_entitlements',
        referencesConstraintName: 'tenants_plan_id_fkey',
        onDelete: 'restrict',
      },
      quota_override: { type: 'jsonb' },
    },
    { ifNotExists: true }
  );
  pgm.createIndex('tenants', ['plan_id'], {
    ifNotExists: true,
    name: 'tenants_plan_id_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('tenants', { ifExists: true, cascade: true });
  pgm.dropTable('plan_entitlements', { ifExists: true, cascade: true });
  pgm.dropTable('idempotency_keys', { ifExists: true, cascade: true });
  pgm.dropTable('usage_counters', { ifExists: true, cascade: true });
  pgm.dropTable('api_events', { ifExists: true, cascade: true });
};
