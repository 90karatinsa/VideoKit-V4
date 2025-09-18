import { t } from '../i18n.js';

import { sendError } from './http-error.js';

const createRateLimiter = (redis, plans) => async (req, res, next) => {
  if (!req.tenant || !req.tenant.plan) return next();

  const plan = plans[req.tenant.plan];
  if (!plan || !plan.rateLimitPerMinute) return next();

  const rateLimitIdentifier = req.tenant.apiKey || req.tenant.id;
  const key = `rate_limit:${rateLimitIdentifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, 60);
  }

  res.set('X-RateLimit-Limit', plan.rateLimitPerMinute);
  res.set('X-RateLimit-Remaining', Math.max(0, plan.rateLimitPerMinute - current));

  if (current > plan.rateLimitPerMinute) {
    return sendError(res, req, 429, 'RATE_LIMIT_EXCEEDED', 'Too Many Requests: Rate limit exceeded.');
  }

  next();
};

export const createBillingMiddleware = (dbPool, redis, plans) => {
  const rateLimiter = createRateLimiter(redis, plans);

  return async (req, res, next) => {
    try {
      if (req.query?.apiKey) {
        req.log?.warn?.({ url: req.originalUrl }, '[billing] API key provided via query string rejected.');
        return sendError(res, req, 400, 'API_KEY_HEADER_REQUIRED', 'API keys must be sent using the X-API-Key header.');
      }

      let tenantContext = req.tenant ?? null;

      if (req.user?.tenantId) {
        if (!tenantContext || tenantContext.id !== req.user.tenantId) {
          const tenantResult = await dbPool.query(
            'SELECT id, name, plan FROM tenants WHERE id = $1',
            [req.user.tenantId],
          );
          if (tenantResult.rowCount === 0) {
            return sendError(res, req, 404, 'SESSION_TENANT_NOT_FOUND', 'Oturuma bağlı kiracı bulunamadı.');
          }
          tenantContext = tenantResult.rows[0];
        }
      } else {
        const apiKey = req.get('X-API-Key');
        if (!apiKey) {
          return sendError(res, req, 401, 'API_KEY_MISSING', 'Unauthorized: API key is missing.');
        }

        const tenantId = await redis.get(`api_key:${apiKey}`);
        if (!tenantId) {
          return sendError(res, req, 401, 'API_KEY_INVALID', 'Unauthorized: Invalid API key.');
        }

        let tenantData = await redis.hgetall(`tenant:${tenantId}`);
        if (!tenantData || !tenantData.plan) {
          const tenantResult = await dbPool.query('SELECT id, name, plan FROM tenants WHERE id = $1', [tenantId]);
          if (tenantResult.rowCount === 0) {
            return sendError(res, req, 404, 'API_KEY_TENANT_NOT_FOUND', 'API anahtarına bağlı kiracı bulunamadı.');
          }
          tenantData = tenantResult.rows[0];
          await redis.hset(`tenant:${tenantId}`, {
            id: tenantId,
            name: tenantData.name,
            plan: tenantData.plan,
          });
        }

        tenantContext = {
          id: tenantId,
          name: tenantData.name,
          plan: tenantData.plan,
          apiKey,
        };
      }

      req.tenant = {
        ...tenantContext,
        apiKey: tenantContext.apiKey ?? req.tenant?.apiKey ?? req.get('X-API-Key') ?? undefined,
      };

      const plan = plans[req.tenant.plan];
      if (!plan) {
        return sendError(res, req, 500, 'TENANT_PLAN_INVALID', 'Server configuration error: Tenant plan is invalid.');
      }

      if (plan.monthlyQuota === null) {
        const creditsRaw = (await redis.get(`credits:${req.tenant.id}`)) ?? '0';
        let credits = parseInt(creditsRaw, 10);
        if (Number.isNaN(credits)) {
          credits = 0;
        }

        if (credits <= 0) {
          res.set('X-Credits-Remaining', '0');
          if (req.method !== 'GET') {
            return sendError(res, req, 402, 'CREDITS_EXHAUSTED', 'Payment Required: You have run out of credits.');
          }
        } else if (req.method !== 'GET') {
          const remainingCredits = await redis.decr(`credits:${req.tenant.id}`);
          res.set('X-Credits-Remaining', `${remainingCredits}`);
        } else {
          res.set('X-Credits-Remaining', `${credits}`);
        }
      }

      if (plan.monthlyQuota !== null) {
        const date = new Date();
        const monthKey = `usage:${req.tenant.id}:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

        let usage = parseInt(await redis.get(monthKey) || '0', 10);

        if (usage >= plan.monthlyQuota) {
          res.set('X-Quota-Limit', plan.monthlyQuota);
          res.set('X-Quota-Remaining', 0);
          if (req.method !== 'GET') {
            return sendError(res, req, 429, 'MONTHLY_QUOTA_EXCEEDED', 'Too Many Requests: Monthly quota exceeded.');
          }
        } else {
          if (req.method !== 'GET') {
            usage = await redis.incr(monthKey);
            if (usage === 1) {
              const now = new Date();
              const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
              const secondsToEndOfMonth = Math.round((endOfMonth.getTime() - now.getTime()) / 1000);
              await redis.expire(monthKey, secondsToEndOfMonth);
            }
          }
          res.set('X-Quota-Limit', plan.monthlyQuota);
          res.set('X-Quota-Remaining', Math.max(0, plan.monthlyQuota - usage));
        }
      }

      return rateLimiter(req, res, next);
    } catch (error) {
      req.log?.error?.({ err: error }, '[billing] Middleware failure');
      return sendError(res, req, 500, 'BILLING_MIDDLEWARE_FAILURE', t('error_generic_server', req.lang) || 'Internal Server Error');
    }
  };
};

export default createBillingMiddleware;
