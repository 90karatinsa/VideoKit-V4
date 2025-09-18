import { analyticsFixtures } from './fixtures/analytics.expected.mjs';
import { fetchAnalytics } from './helpers/analytics.mjs';
import { MockDb } from './helpers/mock-db.mjs';

const INSERT_EVENT_SQL = `INSERT INTO api_events (tenant_id, endpoint, event_type, status_code, request_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`;

const seedEvent = async (db, event, index) => {
  const previousNow = db.now;
  db.now = () => new Date(event.occurredAt);
  try {
    await db.query(INSERT_EVENT_SQL, [
      event.tenantId,
      event.endpoint,
      event.eventType ?? 'POST',
      event.status,
      event.requestId ?? `req-${index}`,
      { ...(event.metadata ?? {}), duration_ms: event.durationMs },
    ]);
  } finally {
    db.now = previousNow;
  }
};

describe('analytics aggregation uses real api_events data', () => {
  test('hourly and daily aggregations match the analytics fixtures', async () => {
    const db = new MockDb();
    const tenantId = 'tenant-analytics';

    const events = [
      { tenantId, endpoint: '/videos/123', status: 201, occurredAt: '2024-03-10T10:05:00.000Z', durationMs: 45 },
      { tenantId, endpoint: '/videos/456', status: 200, occurredAt: '2024-03-10T10:35:00.000Z', durationMs: 60 },
      { tenantId, endpoint: '/videos/789', status: 404, occurredAt: '2024-03-10T11:15:00.000Z', durationMs: 30 },
      { tenantId, endpoint: '/jobs/42', status: 503, occurredAt: '2024-03-11T09:20:00.000Z', durationMs: 120 },
      { tenantId, endpoint: '/videos/000', status: 204, occurredAt: '2024-03-11T09:45:00.000Z', durationMs: 90 },
      { tenantId: 'tenant-b', endpoint: '/videos/999', status: 200, occurredAt: '2024-03-10T10:10:00.000Z', durationMs: 70 },
      { tenantId, endpoint: '/videos/out-of-range', status: 200, occurredAt: '2024-02-01T12:00:00.000Z', durationMs: 110 },
    ];

    for (const [index, event] of events.entries()) {
      // Seed sequentially so that the mock database captures deterministic timestamps.
      await seedEvent(db, event, index);
    }

    const range = {
      from: new Date('2024-03-10T00:00:00.000Z'),
      to: new Date('2024-03-11T23:59:59.999Z'),
    };

    const dailyAnalytics = await fetchAnalytics(db, tenantId, { ...range, groupBy: 'day' });
    expect(dailyAnalytics).toEqual(analyticsFixtures.day);

    const hourlyAnalytics = await fetchAnalytics(db, tenantId, { ...range, groupBy: 'hour' });
    expect(hourlyAnalytics).toEqual(analyticsFixtures.hour);
  });
});
