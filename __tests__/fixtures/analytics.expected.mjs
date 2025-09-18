export const analyticsFixtures = {
  day: {
    totals: [
      {
        bucket: '2024-03-10T00:00:00.000Z',
        total: 3,
        success: 2,
        errors: { '4xx': 1, '5xx': 0 },
        successRate: 2 / 3,
      },
      {
        bucket: '2024-03-11T00:00:00.000Z',
        total: 2,
        success: 1,
        errors: { '4xx': 0, '5xx': 1 },
        successRate: 1 / 2,
      },
    ],
    successRate: 3 / 5,
    errors: { '4xx': 1, '5xx': 1 },
    latency: { avg: 69, p95: 90 },
    topEndpoints: [
      { endpoint: '/videos/:id', count: 4 },
      { endpoint: '/jobs/:id', count: 1 },
    ],
  },
  hour: {
    totals: [
      {
        bucket: '2024-03-10T10:00:00.000Z',
        total: 2,
        success: 2,
        errors: { '4xx': 0, '5xx': 0 },
        successRate: 1,
      },
      {
        bucket: '2024-03-10T11:00:00.000Z',
        total: 1,
        success: 0,
        errors: { '4xx': 1, '5xx': 0 },
        successRate: 0,
      },
      {
        bucket: '2024-03-11T09:00:00.000Z',
        total: 2,
        success: 1,
        errors: { '4xx': 0, '5xx': 1 },
        successRate: 1 / 2,
      },
    ],
    successRate: 3 / 5,
    errors: { '4xx': 1, '5xx': 1 },
    latency: { avg: 69, p95: 90 },
    topEndpoints: [
      { endpoint: '/videos/:id', count: 4 },
      { endpoint: '/jobs/:id', count: 1 },
    ],
  },
};
