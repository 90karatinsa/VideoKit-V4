exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('idempotency_keys', {
    idempotency_key: { type: 'text', primaryKey: true },
    tenant_id: { type: 'text', notNull: true },
    endpoint: { type: 'text', notNull: true },
    request_hash: { type: 'text', notNull: true },
    response_body: { type: 'jsonb' },
    status_code: { type: 'integer' },
    locked_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true },
    last_accessed_at: { type: 'timestamptz', default: pgm.func('now()') },
  }, { ifNotExists: true });

  pgm.createIndex('idempotency_keys', ['tenant_id', 'endpoint'], {
    ifNotExists: true,
    name: 'idempotency_keys_tenant_endpoint_idx',
  });
  pgm.createIndex('idempotency_keys', ['expires_at'], { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropTable('idempotency_keys', { ifExists: true, cascade: true });
};
