/**
 * Central registry that describes how API endpoints are billed. Keeping the
 * mapping in a single module allows middlewares, analytics collectors and
 * worker jobs to rely on the same configuration when deciding whether a request
 * should spend quota or credits.
 */

import { normalizeEndpoint } from './endpoint-normalize.mjs';

const DEFAULT_WEIGHT = 1;
const DEFAULT_METHOD_KEY = '*';

const RAW_BILLABLE_DEFINITIONS = Object.freeze({
    '/verify': {
        POST: { billable: true, weight: 1, feature: 'verify' },
    },
    '/jobs/:id': {
        GET: { billable: false, weight: 0 },
    },
    '/stamp': {
        POST: { billable: true, weight: 1, feature: 'stamp' },
    },
    '/batch/upload': {
        POST: { billable: true, weight: 1, feature: 'batch-upload' },
    },
    '/batch/:id/download': {
        GET: { billable: false, weight: 0 },
    },
    '/usage': {
        GET: { billable: false, weight: 0 },
    },
    '/quota': {
        GET: { billable: false, weight: 0 },
    },
    '/billing': {
        GET: { billable: false, weight: 0 },
    },
    '/analytics': {
        GET: { billable: false, weight: 0 },
    },
});

function normalizeMethodKey(method) {
    if (!method) {
        return DEFAULT_METHOD_KEY;
    }
    return method.toUpperCase();
}

function freezeMethodMap(methods) {
    const entries = Object.entries(methods).map(([method, definition]) => {
        const normalizedMethod = normalizeMethodKey(method);
        const normalizedDefinition = Object.freeze({
            billable: Boolean(definition.billable),
            weight: Number.isFinite(definition.weight) ? Number(definition.weight) : DEFAULT_WEIGHT,
            feature: definition.feature ?? undefined,
        });
        return [normalizedMethod, normalizedDefinition];
    });

    return new Map(entries);
}

function buildBillableMap(rawDefinitions) {
    const map = new Map();
    for (const [endpoint, methods] of Object.entries(rawDefinitions)) {
        map.set(endpoint, freezeMethodMap(methods));
    }
    return map;
}

export const BILLABLE_MAP = buildBillableMap(RAW_BILLABLE_DEFINITIONS);

/**
 * Resolves billing information for a given HTTP method + path pair.
 *
 * @param {string} method - HTTP method.
 * @param {string} path - Request path (may include query string).
 * @returns {{ billable: boolean, weight: number, feature?: string }|null}
 */
export function getBillableDefinition(method, path) {
    const normalizedPath = normalizeEndpoint(path);
    const methodMap = BILLABLE_MAP.get(normalizedPath);
    if (!methodMap) {
        return null;
    }

    const normalizedMethod = normalizeMethodKey(method);
    return methodMap.get(normalizedMethod) || methodMap.get(DEFAULT_METHOD_KEY) || null;
}

/**
 * Returns whether the given request should count towards billing/quota.
 *
 * @param {string} method
 * @param {string} path
 * @returns {boolean}
 */
export function isBillable(method, path) {
    const definition = getBillableDefinition(method, path);
    return Boolean(definition && definition.billable);
}

/**
 * Returns the billing weight for the given request. Non-billable requests return
 * `0`.
 *
 * @param {string} method
 * @param {string} path
 * @returns {number}
 */
export function getBillableWeight(method, path) {
    const definition = getBillableDefinition(method, path);
    if (!definition || !definition.billable) {
        return 0;
    }
    return definition.weight ?? DEFAULT_WEIGHT;
}

/**
 * Usage example:
 *
 * ```js
 * import { getBillableWeight, isBillable } from './core/billing-map.mjs';
 *
 * isBillable('POST', '/verify'); // true
 * getBillableWeight('POST', '/verify'); // 1
 *
 * isBillable('GET', '/jobs/123'); // false (normalizes to `/jobs/:id`)
 * ```
 */
