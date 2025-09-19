const normalizeSql = (sql) => sql.replace(/\s+/g, ' ').trim();

const isStatusBetween = (status, min, max) => Number.isFinite(status) && status >= min && status <= max;

const truncateToHourUtc = (date) => {
  const d = new Date(date.getTime());
  d.setUTCMinutes(0, 0, 0);
  return d;
};

const truncateToDayUtc = (date) => {
  const d = new Date(date.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export class MockDb {
  constructor({ now = () => new Date() } = {}) {
    this.now = now;
    this.planEntitlements = new Map();
    this.tenants = new Map();
    this.idempotencyKeys = new Map();
    this.usageCounters = new Map();
    this.apiEvents = [];
  }

  setPlan(planId, value) {
    this.planEntitlements.set(planId, {
      plan_id: planId,
      monthly_api_calls_total: value?.monthly_api_calls_total ?? null,
      endpoint_overrides: value?.endpoint_overrides ?? null,
    });
  }

  setTenant(tenantId, value) {
    this.tenants.set(tenantId, {
      id: tenantId,
      name: value?.name ?? null,
      plan_id: value?.planId ?? value?.plan ?? null,
      plan: value?.plan ?? value?.planId ?? null,
      quota_override: value?.quotaOverride ?? null,
    });
  }

  getUsage(tenantId, endpoint) {
    const totals = [];
    for (const [key, record] of this.usageCounters.entries()) {
      const [tenant, ep] = key.split('|', 3);
      if (tenant === tenantId && ep === endpoint) {
        totals.push(record.count ?? 0);
      }
    }
    return totals.reduce((acc, value) => acc + value, 0);
  }

  getTotalUsage(tenantId) {
    let total = 0;
    for (const [key, record] of this.usageCounters.entries()) {
      const [tenant, ep] = key.split('|', 3);
      if (tenant === tenantId && ep === '__total__') {
        total += record.total_weight ?? 0;
      }
    }
    return total;
  }

  async connect() {
    return {
      query: (sql, params) => this.query(sql, params),
      release: () => {},
    };
  }

  async query(sql, params = []) {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('BEGIN') || normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith('SELECT plan_id, monthly_api_calls_total, endpoint_overrides FROM plan_entitlements')) {
      const planId = params[0];
      const row = this.planEntitlements.get(planId);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('SELECT id, name, plan_id, plan, quota_override FROM tenants')) {
      const tenantId = params[0];
      const row = this.tenants.get(tenantId);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('INSERT INTO idempotency_keys')) {
      const [key, tenantId, endpoint, requestHash, expiresAt] = params;
      if (this.idempotencyKeys.has(key)) {
        return { rows: [], rowCount: 0 };
      }
      this.idempotencyKeys.set(key, {
        tenant_id: tenantId,
        endpoint,
        request_hash: requestHash,
        status_code: null,
        expires_at: expiresAt,
        locked_at: this.now(),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('SELECT request_hash, status_code FROM idempotency_keys')) {
      const key = params[0];
      const row = this.idempotencyKeys.get(key);
      if (!row) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [{ request_hash: row.request_hash, status_code: row.status_code }], rowCount: 1 };
    }

    if (normalized.startsWith('UPDATE idempotency_keys SET last_accessed_at')) {
      const key = params[0];
      const row = this.idempotencyKeys.get(key);
      if (row) {
        row.locked_at = this.now();
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('UPDATE idempotency_keys SET status_code')) {
      const [key, status] = params;
      const row = this.idempotencyKeys.get(key);
      if (row) {
        row.status_code = status;
        row.locked_at = null;
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    if (normalized.startsWith('SELECT count, total_weight FROM usage_counters WHERE tenant_id')) {
      const [tenantId, endpoint, periodStart] = params;
      const key = this.#usageKey(tenantId, endpoint, periodStart);
      const record = this.usageCounters.get(key);
      return {
        rows: record ? [{ count: record.count ?? 0, total_weight: record.total_weight ?? 0 }] : [],
        rowCount: record ? 1 : 0,
      };
    }

    if (normalized.startsWith('INSERT INTO usage_counters')) {
      const [tenantId, endpoint, periodStart, count, weight] = params;
      const key = this.#usageKey(tenantId, endpoint, periodStart);
      const existing = this.usageCounters.get(key) ?? { count: 0, total_weight: 0 };
      const next = {
        count: existing.count + Number(count || 0),
        total_weight: existing.total_weight + Number(weight || 0),
      };
      this.usageCounters.set(key, next);
      return { rows: [{ count: next.count, total_weight: next.total_weight }], rowCount: 1 };
    }

    if (normalized.startsWith('INSERT INTO api_events')) {
      const [tenantId, endpoint, eventType, status, requestId, metadata] = params;
      this.apiEvents.push({
        tenant_id: tenantId,
        endpoint,
        event_type: eventType,
        status_code: status,
        request_id: requestId,
        metadata: metadata ?? {},
        occurred_at: this.now(),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith('SELECT date_trunc($4::text, occurred_at) AS bucket')) {
      const [tenantId, fromIso, toIso, groupBy] = params;
      const from = new Date(fromIso);
      const to = new Date(toIso);
      const truncate = groupBy === 'hour' ? truncateToHourUtc : truncateToDayUtc;
      const buckets = new Map();

      for (const event of this.apiEvents) {
        if (event.tenant_id !== tenantId) continue;
        if (event.occurred_at < from || event.occurred_at >= to) continue;
        const bucket = truncate(event.occurred_at).toISOString();
        const current = buckets.get(bucket) ?? {
          bucket: new Date(bucket),
          total: 0,
          success_count: 0,
          errors_4xx: 0,
          errors_5xx: 0,
        };
        current.total += 1;
        if (isStatusBetween(event.status_code, 200, 299)) {
          current.success_count += 1;
        } else if (isStatusBetween(event.status_code, 400, 499)) {
          current.errors_4xx += 1;
        } else if (isStatusBetween(event.status_code, 500, 599)) {
          current.errors_5xx += 1;
        }
        buckets.set(bucket, current);
      }

      const rows = Array.from(buckets.values()).sort((a, b) => a.bucket - b.bucket);
      return { rows, rowCount: rows.length };
    }

    if (normalized.includes('WITH durations AS')) {
      const [tenantId, fromIso, toIso] = params;
      const from = new Date(fromIso);
      const to = new Date(toIso);
      const durations = [];

      for (const event of this.apiEvents) {
        if (event.tenant_id !== tenantId) continue;
        if (event.occurred_at < from || event.occurred_at >= to) continue;
        const value = Number(event.metadata?.duration_ms);
        if (Number.isFinite(value)) {
          durations.push(value);
        }
      }

      if (!durations.length) {
        return { rows: [{ avg_duration: null, p95_duration: null }], rowCount: 1 };
      }

      const sum = durations.reduce((acc, value) => acc + value, 0);
      const avg = sum / durations.length;
      const sorted = [...durations].sort((a, b) => a - b);
      const index = Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)));
      const p95 = sorted[index];

      return { rows: [{ avg_duration: avg, p95_duration: p95 }], rowCount: 1 };
    }

    if (normalized.startsWith('SELECT endpoint, COUNT(*)::bigint AS count FROM api_events')) {
      const [tenantId, fromIso, toIso] = params;
      const from = new Date(fromIso);
      const to = new Date(toIso);
      const counters = new Map();

      for (const event of this.apiEvents) {
        if (event.tenant_id !== tenantId) continue;
        if (event.occurred_at < from || event.occurred_at >= to) continue;
        const endpoint = event.endpoint || '/';
        counters.set(endpoint, (counters.get(endpoint) ?? 0) + 1);
      }

      const rows = Array.from(counters.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count);
      return { rows, rowCount: rows.length };
    }

    throw new Error(`MockDb received unsupported query: ${normalized}`);
  }

  #usageKey(tenantId, endpoint, periodStart) {
    const timestamp = periodStart instanceof Date ? periodStart.toISOString() : new Date(periodStart).toISOString();
    return `${tenantId}|${endpoint}|${timestamp}`;
  }
}

export class MockRedis {
  constructor() {
    this.store = new Map();
    this.hashes = new Map();
    this.ttl = new Map();
    this.shouldFailEval = true;
  }

  async eval() {
    if (this.shouldFailEval) {
      throw new Error('eval not supported in MockRedis');
    }
    return [1, 0, 0];
  }

  async hgetall(key) {
    return this.hashes.get(key) ?? {};
  }

  async hset(key, values) {
    const current = { ...(this.hashes.get(key) ?? {}) };
    Object.assign(current, values);
    this.hashes.set(key, current);
    return 1;
  }

  async expire(key, seconds) {
    this.ttl.set(key, seconds);
    return 1;
  }

  async get(key) {
    return this.store.get(key) ?? null;
  }

  async set(key, value, mode, ttlMode, ttl, modifier) {
    if (modifier === 'NX' && this.store.has(key)) {
      return null;
    }
    this.store.set(key, value);
    if (mode === 'EX' && Number.isFinite(ttl)) {
      this.ttl.set(key, Number(ttl));
    }
    return 'OK';
  }
}
