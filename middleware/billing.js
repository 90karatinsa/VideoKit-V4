import crypto from 'crypto';
import promClient from 'prom-client';

const OPERATIONS = [
  { method: 'POST', pattern: /^\/verify$/i, name: '/verify', weight: 1 },
  { method: 'POST', pattern: /^\/stamp$/i, name: '/stamp', weight: 5 },
  { method: 'POST', pattern: /^\/batch\/upload$/i, name: '/batch/upload', weight: 10 },
  { method: 'POST', pattern: /^\/management\/keys$/i, name: '/management/keys', billable: false },
  {
    method: 'DELETE',
    pattern: /^\/management\/keys\/[^/]+$/i,
    name: '/management/keys/:keyId',
    billable: false,
  },
];

const TOTAL_FIELD = '__total__';
const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours

const REDIS_INCREMENT_LUA = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local totalField = ARGV[2]
local opField = ARGV[3]
local increment = tonumber(ARGV[4])
local limit = tonumber(ARGV[5])

if limit >= 0 then
  local current = tonumber(redis.call('HGET', key, totalField) or '0')
  if current + increment > limit then
    local opValue = tonumber(redis.call('HGET', key, opField) or '0')
    return {0, current, opValue}
  end
end

local newTotal = redis.call('HINCRBYFLOAT', key, totalField, increment)
local newOp = redis.call('HINCRBYFLOAT', key, opField, increment)

if ttl and ttl > 0 then
  redis.call('PEXPIRE', key, ttl)
end

return {1, newTotal, newOp}
`;

const state = {
  redis: null,
  dbPool: null,
  now: () => new Date(),
  idempotencyTtlSeconds: DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  planCache: new Map(),
  logger: console,
};

const histogramName = 'videokit_api_billable_duration_ms';
let durationMetric = promClient.register.getSingleMetric(histogramName);
if (!durationMetric) {
  durationMetric = new promClient.Histogram({
    name: histogramName,
    help: 'Duration of billable API calls in milliseconds.',
    labelNames: ['method', 'endpoint', 'status'],
    buckets: [50, 100, 200, 500, 1000, 2000, 5000, 10_000],
  });
}

const counterName = 'videokit_api_billable_requests_total';
let requestCounter = promClient.register.getSingleMetric(counterName);
if (!requestCounter) {
  requestCounter = new promClient.Counter({
    name: counterName,
    help: 'Total billable API requests processed.',
    labelNames: ['method', 'endpoint', 'status', 'billable'],
  });
}

export const configureBilling = ({
  redis,
  dbPool,
  now,
  idempotencyTtlSeconds,
  logger,
} = {}) => {
  if (redis) state.redis = redis;
  if (dbPool) state.dbPool = dbPool;
  if (typeof now === 'function') state.now = now;
  if (Number.isFinite(idempotencyTtlSeconds) && idempotencyTtlSeconds > 0) {
    state.idempotencyTtlSeconds = idempotencyTtlSeconds;
  }
  if (logger) state.logger = logger;
};

const ensureConfigured = () => {
  if (!state.redis || !state.dbPool) {
    throw new Error('Billing middleware requires configureBilling to run first.');
  }

  return state;
};

const ensureReqState = (req) => {
  if (!req.billing) {
    req.billing = {};
  }
  return req.billing;
};

const normalizePath = (rawPath) => {
  const path = (rawPath || '').split('?')[0].replace(/\\+/g, '/');
  if (!path || path === '/') {
    return '/';
  }
  return path.endsWith('/') ? path.slice(0, -1) || '/' : path;
};

const matchOperation = (req) => {
  const method = (req.method || '').toUpperCase();
  const raw = req.route?.path || req.originalUrl || req.path || '/';
  const normalized = normalizePath(raw);

  for (const operation of OPERATIONS) {
    if (operation.method === method && operation.pattern.test(normalized)) {
      return { ...operation, normalizedEndpoint: operation.name ?? normalized };
    }
  }

  return { method, normalizedEndpoint: normalized, weight: 1, billable: true };
};

const getOperationContext = (req) => {
  const stateForRequest = ensureReqState(req);
  if (!stateForRequest.operation) {
    stateForRequest.operation = matchOperation(req);
  }
  return stateForRequest.operation;
};

const parseJson = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const loadPlan = async (planId, dbPool) => {
  if (!planId) return null;

  const cached = state.planCache.get(planId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const result = await dbPool.query(
    'SELECT plan_id, monthly_api_calls_total, endpoint_overrides FROM plan_entitlements WHERE plan_id = $1',
    [planId],
  );
  const value = result.rows[0] ?? null;
  state.planCache.set(planId, { value, expiresAt: now + 300_000 });
  return value;
};

const loadTenantById = async (tenantId, { redis, dbPool }) => {
  if (!tenantId) return null;

  const cached = redis ? await redis.hgetall(`tenant:${tenantId}`) : null;
  if (cached?.id && cached?.plan_id) {
    return {
      id: cached.id,
      name: cached.name,
      planId: cached.plan_id,
      quotaOverride: parseJson(cached.quota_override),
    };
  }

  const result = await dbPool.query(
    'SELECT id, name, plan_id, plan, quota_override FROM tenants WHERE id = $1',
    [tenantId],
  );
  if (!result.rowCount) return null;

  const row = result.rows[0];
  const tenant = {
    id: row.id,
    name: row.name,
    planId: row.plan_id || row.plan,
    quotaOverride: parseJson(row.quota_override),
  };

  if (redis) {
    await redis.hset(`tenant:${tenantId}`, {
      id: tenant.id,
      name: tenant.name ?? '',
      plan_id: tenant.planId ?? '',
      quota_override: row.quota_override ? JSON.stringify(row.quota_override) : '',
    });
    await redis.expire(`tenant:${tenantId}`, 3600);
  }

  return tenant;
};

const resolveTenantIdFromApiKey = async (apiKey, { redis, dbPool }) => {
  if (!apiKey) return null;

  const direct = redis ? await redis.get(`api_key:${apiKey}`) : null;
  if (direct) return direct;

  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
  if (redis) {
    const cached = await redis.get(`api_key_hash:${hash}`);
    if (cached) return cached;
  }

  try {
    const result = await dbPool.query(
      'SELECT tenant_id FROM api_keys WHERE key_hash = $1 LIMIT 1',
      [hash],
    );
    const tenantId = result.rows[0]?.tenant_id ?? null;
    if (tenantId && redis) {
      await redis.set(`api_key:${apiKey}`, tenantId, 'EX', 3600);
      await redis.set(`api_key_hash:${hash}`, tenantId, 'EX', 3600);
    }
    return tenantId;
  } catch (error) {
    if (error.code !== '42P01') throw error;
    return null;
  }
};

const mergeQuota = (plan, override) => {
  const planLimit = plan?.monthly_api_calls_total ?? null;
  const overrideLimit = override?.monthly_api_calls_total ?? override?.total ?? null;

  const endpointOverrides = { ...(plan?.endpoint_overrides ?? {}) };
  if (override?.endpoint_overrides) {
    for (const [endpoint, value] of Object.entries(override.endpoint_overrides)) {
      endpointOverrides[endpoint] = {
        ...(endpointOverrides[endpoint] ?? {}),
        ...value,
      };
    }
  }

  return { limit: overrideLimit ?? planLimit ?? null, endpointOverrides };
};

const computePeriod = (now) => {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  const start = new Date(Date.UTC(year, month, 1));
  const next = new Date(Date.UTC(year, month + 1, 1));
  return {
    key,
    start,
    end: new Date(next.getTime() - 1),
    ttlSeconds: Math.max(1, Math.floor((next - now) / 1000)),
  };
};

const endpointField = (endpoint) => `op:${endpoint.replace(/\s+/g, '_')}`;

const requestHash = (req, endpoint) => {
  const hash = crypto.createHash('sha256');
  hash.update((req.method || '').toUpperCase());
  hash.update('|');
  hash.update(endpoint || req.originalUrl || '');
  hash.update('|');
  hash.update(req.headers['content-type'] || '');
  hash.update('|');
  hash.update(req.headers['content-length'] || '');
  if (req.body && Object.keys(req.body).length) {
    hash.update(`|${JSON.stringify(req.body)}`);
  }
  return hash.digest('hex');
};

const upsertIdempotency = async (req, endpoint, tenantId) => {
  const key = req.get?.('Idempotency-Key');
  if (!key) {
    return { skipBilling: false };
  }

  const { dbPool } = ensureConfigured();
  const hash = requestHash(req, endpoint);
  const expiresAt = new Date(state.now().getTime() + state.idempotencyTtlSeconds * 1000);

  try {
    const insert = await dbPool.query(
      `INSERT INTO idempotency_keys (idempotency_key, tenant_id, endpoint, request_hash, expires_at, locked_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      [key, tenantId, endpoint, hash, expiresAt],
    );

    const select = await dbPool.query(
      'SELECT request_hash, status_code FROM idempotency_keys WHERE idempotency_key = $1',
      [key],
    );
    const row = select.rows[0];
    if (!row) {
      return { key, requestHash: hash, skipBilling: false };
    }

    if (row.request_hash !== hash) {
      const error = new Error('Idempotency hash mismatch');
      error.statusCode = 409;
      throw error;
    }

    await dbPool.query(
      'UPDATE idempotency_keys SET last_accessed_at = NOW(), locked_at = NOW() WHERE idempotency_key = $1',
      [key],
    );

    return {
      key,
      requestHash: hash,
      skipBilling: insert.rowCount === 0,
      existingStatus: row.status_code ?? null,
    };
  } catch (error) {
    if (error.code === '42P01') {
      state.logger?.warn?.('[billing] idempotency_keys table missing, skipping persistence.');
      return { skipBilling: false };
    }
    throw error;
  }
};

export const resolveTenant = async (req, res, next) => {
  try {
    const { redis, dbPool } = ensureConfigured();
    const billing = ensureReqState(req);

    let tenant = req.tenant ?? null;
    if (!tenant?.id) {
      let tenantId = req.user?.tenantId;

      if (!tenantId) {
        const apiKey = req.get('X-API-Key');
        if (!apiKey) {
          return res.status(401).json({ code: 'AUTH_REQUIRED', message: 'X-API-Key header required.' });
        }

        billing.apiKey = apiKey;
        tenantId = await resolveTenantIdFromApiKey(apiKey, { redis, dbPool });
        if (!tenantId) {
          return res.status(401).json({ code: 'INVALID_API_KEY', message: 'API key is not recognized.' });
        }
      }

      tenant = await loadTenantById(tenantId, { redis, dbPool });
      if (!tenant) {
        return res.status(404).json({ code: 'TENANT_NOT_FOUND', message: 'Tenant context could not be resolved.' });
      }
    }

    const plan = await loadPlan(tenant.planId, dbPool);
    billing.plan = plan;
    billing.quota = mergeQuota(plan, tenant.quotaOverride);
    billing.period = computePeriod(state.now());

    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      planId: tenant.planId,
      plan: tenant.planId,
    };

    res.setHeader('X-Quota-Period', billing.period.key);
    if (billing.quota.limit != null) {
      res.setHeader('X-Quota-Limit', billing.quota.limit);
    }

    next();
  } catch (error) {
    req.log?.error?.({ err: error }, '[billing] resolveTenant failed');
    res.status(500).json({ code: 'TENANT_RESOLUTION_FAILED' });
  }
};

export const startTimer = (req, _res, next) => {
  const billing = ensureReqState(req);
  billing.startedAt = state.now();
  billing.hrtime = typeof process?.hrtime?.bigint === 'function' ? process.hrtime.bigint() : null;
  next();
};

export const isWrite = (req) => !['GET', 'HEAD', 'OPTIONS'].includes((req.method || '').toUpperCase());

export const isBillable = (req) => isWrite(req) && getOperationContext(req).billable !== false;

const extractWeightOverride = (override) => {
  if (!override) return null;

  if (typeof override.weight === 'number') return override.weight;
  if (typeof override.call_weight === 'number') return override.call_weight;
  if (typeof override.operation_weight === 'number') return override.operation_weight;

  return null;
};

export const operationWeight = (req) => {
  const operation = getOperationContext(req);
  const override = ensureReqState(req).quota?.endpointOverrides?.[operation.normalizedEndpoint];
  const weight = extractWeightOverride(override) ?? operation.weight ?? 1;
  return weight > 0 ? weight : 1;
};

const extractEndpointLimit = (override) => {
  if (!override) return null;

  if (typeof override.limit === 'number') return override.limit;
  if (typeof override.monthly_api_calls === 'number') return override.monthly_api_calls;
  if (typeof override.monthlyLimit === 'number') return override.monthlyLimit;

  return null;
};

export const incrementUsageAtomic = async (tenantId, endpoint, weight, periodKey, options = {}) => {
  if (!tenantId || !endpoint || !periodKey) {
    throw new Error('incrementUsageAtomic requires tenantId, endpoint, and periodKey.');
  }

  const { redis, dbPool } = ensureConfigured();
  const limit = Number.isFinite(options.limit) ? options.limit : null;
  const ttlSeconds = Number.isFinite(options.ttlSeconds) ? options.ttlSeconds : null;
  const key = `usage:${tenantId}:${periodKey}`;
  const ttlMs = ttlSeconds ? ttlSeconds * 1000 : null;

  if (redis) {
    try {
      const result = await redis.eval(
        REDIS_INCREMENT_LUA,
        1,
        key,
        ttlMs ?? 0,
        TOTAL_FIELD,
        endpointField(endpoint),
        weight,
        limit ?? -1,
      );

      return {
        allowed: result[0] === 1,
        total: Number(result[1] ?? 0),
        endpointUsage: Number(result[2] ?? 0),
      };
    } catch (error) {
      state.logger?.warn?.({ err: error }, '[billing] Redis increment failed, falling back to Postgres.');
    }
  }

  const periodStart = options.periodStart ?? new Date(`${periodKey}-01T00:00:00.000Z`);
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query(
      'SELECT call_count FROM usage_counters WHERE tenant_id = $1 AND endpoint = $2 AND period_start = $3 FOR UPDATE',
      [tenantId, TOTAL_FIELD, periodStart],
    );
    const currentTotal = Number(current.rows[0]?.call_count ?? 0);
    if (limit != null && currentTotal + weight > limit) {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        total: currentTotal,
        endpointUsage: currentTotal,
      };
    }

    const total = await client.query(
      `INSERT INTO usage_counters (tenant_id, endpoint, period_start, call_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, endpoint, period_start)
       DO UPDATE SET call_count = usage_counters.call_count + EXCLUDED.call_count, last_updated_at = NOW()
       RETURNING call_count`,
      [tenantId, TOTAL_FIELD, periodStart, weight],
    );

    const endpointResult = await client.query(
      `INSERT INTO usage_counters (tenant_id, endpoint, period_start, call_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, endpoint, period_start)
       DO UPDATE SET call_count = usage_counters.call_count + EXCLUDED.call_count, last_updated_at = NOW()
       RETURNING call_count`,
      [tenantId, endpoint, periodStart, weight],
    );

    await client.query('COMMIT');

    return {
      allowed: true,
      total: Number(total.rows[0]?.call_count ?? 0),
      endpointUsage: Number(endpointResult.rows[0]?.call_count ?? 0),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const enforceQuota = async (req, res, next) => {
  if (!isBillable(req)) return next();

  try {
    const billing = ensureReqState(req);
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ code: 'TENANT_REQUIRED' });
    }

    const operation = getOperationContext(req);
    billing.period = billing.period ?? computePeriod(state.now());

    const idempotency = await upsertIdempotency(req, operation.normalizedEndpoint, tenantId);
    billing.idempotency = idempotency;
    if (idempotency.skipBilling) return next();

    const quotaLimit = billing.quota?.limit ?? null;
    const endpointLimit = extractEndpointLimit(billing.quota?.endpointOverrides?.[operation.normalizedEndpoint]);
    const limit = endpointLimit ?? quotaLimit;
    if (limit == null) return next();

    const weight = operationWeight(req);
    const usage = await incrementUsageAtomic(tenantId, operation.normalizedEndpoint, weight, billing.period.key, {
      limit,
      ttlSeconds: billing.period.ttlSeconds,
      periodStart: billing.period.start,
    });

    billing.usage = usage;
    billing.weight = weight;

    if (!usage.allowed) {
      return res.status(429).json({
        code: 'QUOTA_EXCEEDED',
        remaining: Math.max(0, Math.floor(limit - usage.total)),
        resetAt: billing.period.end.toISOString(),
      });
    }

    res.setHeader('X-Quota-Remaining', Math.max(0, Math.floor(limit - usage.total)));

    next();
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ code: 'IDEMPOTENCY_CONFLICT' });
    }

    req.log?.error?.({ err: error }, '[billing] enforceQuota failed');
    res.status(500).json({ code: 'BILLING_FAILURE' });
  }
};

export const finalizeAndLog = (req, res, next) => {
  const billing = ensureReqState(req);
  const startTime = billing.hrtime;
  const startedAt = billing.startedAt ?? state.now();
  const operation = getOperationContext(req);

  res.once('finish', async () => {
    try {
      const { dbPool } = ensureConfigured();
      const end = typeof process?.hrtime?.bigint === 'function' ? process.hrtime.bigint() : null;
      const durationMs = startTime && end ? Number(end - startTime) / 1e6 : state.now() - startedAt;
      const method = (req.method || '').toUpperCase();
      const status = res.statusCode;
      const endpoint = operation.normalizedEndpoint;
      const billable = isBillable(req);

      requestCounter.labels(method, endpoint, String(status), billable ? 'true' : 'false').inc();
      durationMetric.observe({ method, endpoint, status: String(status) }, durationMs);

      const tenantId = req.tenant?.id ?? null;
      if (tenantId) {
        await dbPool.query(
          `INSERT INTO api_events (tenant_id, endpoint, event_type, status_code, request_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            tenantId,
            endpoint,
            method,
            status,
            req.id || req.headers['x-request-id'] || null,
            {
              duration_ms: durationMs,
              billable,
              weight: billing.weight ?? operationWeight(req),
              usage: billing.usage ?? null,
              idempotency: billing.idempotency?.key ?? null,
            },
          ],
        );
      }

      if (billing.idempotency?.key) {
        try {
          await dbPool.query(
            'UPDATE idempotency_keys SET status_code = $2, locked_at = NULL, last_accessed_at = NOW() WHERE idempotency_key = $1',
            [billing.idempotency.key, status],
          );
        } catch (error) {
          if (error.code !== '42P01') {
            state.logger?.warn?.({ err: error }, '[billing] Failed to update idempotency status.');
          }
        }
      }
    } catch (error) {
      req.log?.error?.({ err: error }, '[billing] finalizeAndLog failure');
    }
  });

  if (typeof next === 'function') {
    next();
  }
};

export const createBillingMiddleware = ({
  redis,
  dbPool,
  now,
  idempotencyTtlSeconds,
  logger,
} = {}) => {
  configureBilling({ redis, dbPool, now, idempotencyTtlSeconds, logger });
  return [resolveTenant, startTimer, enforceQuota, finalizeAndLog];
};

export default {
  configureBilling,
  resolveTenant,
  startTimer,
  isWrite,
  isBillable,
  operationWeight,
  incrementUsageAtomic,
  enforceQuota,
  finalizeAndLog,
  createBillingMiddleware,
};
