exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    'api_events_rollup_hourly',
    {
      bucket_ts: { type: 'timestamptz', notNull: true },
      tenant_id: { type: 'text', notNull: true },
      endpoint: { type: 'text', notNull: true },
      calls: { type: 'bigint', notNull: true, default: 0 },
      success: { type: 'bigint', notNull: true, default: 0 },
      errors4xx: { type: 'bigint', notNull: true, default: 0 },
      errors5xx: { type: 'bigint', notNull: true, default: 0 },
      avg_ms: { type: 'integer' },
      p95_ms: { type: 'integer' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint('api_events_rollup_hourly', 'api_events_rollup_hourly_pkey', {
    primaryKey: ['bucket_ts', 'tenant_id', 'endpoint'],
  });

  pgm.createIndex('api_events_rollup_hourly', ['tenant_id', { name: 'bucket_ts', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'api_events_rollup_hourly_tenant_bucket_idx',
  });
  pgm.createIndex('api_events_rollup_hourly', ['bucket_ts'], {
    ifNotExists: true,
    name: 'api_events_rollup_hourly_bucket_idx',
  });

  pgm.createTable(
    'api_events_rollup_daily',
    {
      bucket_ts: { type: 'timestamptz', notNull: true },
      tenant_id: { type: 'text', notNull: true },
      endpoint: { type: 'text', notNull: true },
      calls: { type: 'bigint', notNull: true, default: 0 },
      success: { type: 'bigint', notNull: true, default: 0 },
      errors4xx: { type: 'bigint', notNull: true, default: 0 },
      errors5xx: { type: 'bigint', notNull: true, default: 0 },
      avg_ms: { type: 'integer' },
      p95_ms: { type: 'integer' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint('api_events_rollup_daily', 'api_events_rollup_daily_pkey', {
    primaryKey: ['bucket_ts', 'tenant_id', 'endpoint'],
  });

  pgm.createIndex('api_events_rollup_daily', ['tenant_id', { name: 'bucket_ts', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'api_events_rollup_daily_tenant_bucket_idx',
  });
  pgm.createIndex('api_events_rollup_daily', ['bucket_ts'], {
    ifNotExists: true,
    name: 'api_events_rollup_daily_bucket_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('api_events_rollup_daily', { ifExists: true, cascade: true });
  pgm.dropTable('api_events_rollup_hourly', { ifExists: true, cascade: true });
};
