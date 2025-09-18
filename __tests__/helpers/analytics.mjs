import { normalizeEndpoint } from '../../src/core/endpoint-normalize.mjs';

export const fetchAnalytics = async (db, tenantId, { from, to, groupBy = 'day' }) => {
  const toExclusive = new Date(to.getTime() + 1);
  const fromIso = from.toISOString();
  const toIso = toExclusive.toISOString();
  const groupByParam = groupBy.toLowerCase();

  const totalsResult = await db.query(
    `SELECT
        date_trunc($4::text, occurred_at) AS bucket,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299)::bigint AS success_count,
        COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499)::bigint AS errors_4xx,
        COUNT(*) FILTER (WHERE status_code BETWEEN 500 AND 599)::bigint AS errors_5xx
      FROM api_events
      WHERE tenant_id = $1
        AND occurred_at >= $2::timestamptz
        AND occurred_at < $3::timestamptz
      GROUP BY bucket
      ORDER BY bucket ASC;`,
    [tenantId, fromIso, toIso, groupByParam],
  );

  const totals = totalsResult.rows.map((row) => {
    const bucketDate = row.bucket instanceof Date ? row.bucket : new Date(row.bucket);
    const total = Number(row.total || 0);
    const success = Number(row.success_count || 0);
    const errors4xx = Number(row.errors_4xx || 0);
    const errors5xx = Number(row.errors_5xx || 0);
    const errors = { '4xx': errors4xx, '5xx': errors5xx };

    return {
      bucket: bucketDate.toISOString(),
      total,
      success,
      errors,
      successRate: total > 0 ? success / total : 0,
    };
  });

  const aggregate = totals.reduce(
    (acc, row) => {
      acc.total += row.total;
      acc.success += row.success;
      acc.errors['4xx'] += row.errors['4xx'];
      acc.errors['5xx'] += row.errors['5xx'];
      return acc;
    },
    { total: 0, success: 0, errors: { '4xx': 0, '5xx': 0 } },
  );

  const latencyResult = await db.query(
    `WITH durations AS (
        SELECT (metadata->>'duration_ms')::numeric AS value
        FROM api_events
        WHERE tenant_id = $1
          AND occurred_at >= $2::timestamptz
          AND occurred_at < $3::timestamptz
          AND (metadata->>'duration_ms') ~ '^\\\d+(?:\\.\\d+)?$'
      )
      SELECT
        AVG(value) AS avg_duration,
        PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY value) AS p95_duration
      FROM durations;`,
    [tenantId, fromIso, toIso],
  );

  const latencyRow = latencyResult.rows[0] || {};
  const latency = {
    avg: latencyRow.avg_duration != null ? Number(latencyRow.avg_duration) : null,
    p95: latencyRow.p95_duration != null ? Number(latencyRow.p95_duration) : null,
  };

  const topEndpointsResult = await db.query(
    `SELECT endpoint, COUNT(*)::bigint AS count
      FROM api_events
      WHERE tenant_id = $1
        AND occurred_at >= $2::timestamptz
        AND occurred_at < $3::timestamptz
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 20;`,
    [tenantId, fromIso, toIso],
  );

  const endpointAggregates = new Map();
  for (const row of topEndpointsResult.rows) {
    const rawEndpoint = typeof row.endpoint === 'string' ? row.endpoint : '/';
    let normalized;
    try {
      normalized = normalizeEndpoint(rawEndpoint);
    } catch (error) {
      normalized = rawEndpoint || '/';
    }
    const current = endpointAggregates.get(normalized) ?? 0;
    endpointAggregates.set(normalized, current + Number(row.count || 0));
  }

  const topEndpoints = Array.from(endpointAggregates.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totals,
    successRate: aggregate.total > 0 ? aggregate.success / aggregate.total : 0,
    errors: aggregate.errors,
    latency,
    topEndpoints,
  };
};
