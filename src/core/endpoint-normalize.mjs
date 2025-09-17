/**
 * Utility helpers for normalizing API endpoint paths so that dynamic identifiers
 * such as `/jobs/123` are mapped to canonical placeholders (e.g. `/jobs/:id`).
 * This allows billing and analytics modules to reason about endpoints using a
 * single source of truth regardless of the concrete identifiers that appear in
 * runtime requests.
 */

const UUID_V4_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const UUID_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const HEX_24_REGEX = /^[0-9a-f]{24}$/i; // Mongo/ObjectId tarzı kimlikler.
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/; // ULID formatı.
const BASE62_LONG_REGEX = /^[A-Za-z0-9_-]{16,}$/; // Uzun token benzeri kimlikler.
const NUMERIC_ID_REGEX = /^\d+$/;

const DEFAULT_MATCHERS = [
    (segment) => NUMERIC_ID_REGEX.test(segment),
    (segment) => UUID_V4_REGEX.test(segment) || UUID_REGEX.test(segment),
    (segment) => HEX_24_REGEX.test(segment),
    (segment) => ULID_REGEX.test(segment),
    (segment) => BASE62_LONG_REGEX.test(segment),
];

function toDateSafe(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new TypeError('normalizeEndpoint: invalid date value encountered');
    }
    return date;
}

function normalizePathInput(rawPath) {
    if (typeof rawPath !== 'string') {
        throw new TypeError('normalizeEndpoint: `path` must be a string.');
    }

    if (rawPath === '' || rawPath === '/') {
        return '/';
    }

    const [pathOnly] = rawPath.split(/[?#]/, 1);
    const trimmed = pathOnly.trim();
    if (trimmed === '') {
        return '/';
    }

    const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    let collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');
    if (collapsed.length > 1 && collapsed.endsWith('/')) {
        collapsed = collapsed.slice(0, -1);
    }
    return collapsed || '/';
}

/**
 * Normalizes a concrete request path into its canonical representation.
 *
 * @example
 * normalizeEndpoint('/jobs/12345'); // => '/jobs/:id'
 *
 * @param {string} path - Concrete HTTP path (may include query string).
 * @param {Object} [options]
 * @param {string} [options.placeholder=':id'] - Placeholder used for dynamic segments.
 * @param {boolean} [options.preserveCase=false] - Keeps original segment casing.
 * @param {Array<Function|RegExp>} [options.matchers] - Extra segment matchers.
 * @returns {string} Normalized, leading-slash path (without query/fragment).
 */
export function normalizeEndpoint(path, options = {}) {
    const {
        placeholder = ':id',
        preserveCase = false,
        matchers = [],
    } = options;

    const normalizedBase = normalizePathInput(path);
    if (normalizedBase === '/') {
        return '/';
    }

    const compiledMatchers = matchers.map((matcher) => {
        if (typeof matcher === 'function') {
            return matcher;
        }
        if (matcher instanceof RegExp) {
            return (segment) => matcher.test(segment);
        }
        throw new TypeError('normalizeEndpoint: `matchers` must be functions or RegExp instances.');
    });

    const segments = normalizedBase.split('/').filter(Boolean);
    const detectors = [...DEFAULT_MATCHERS, ...compiledMatchers];

    const normalizedSegments = segments.map((segment) => {
        const shouldReplace = detectors.some((detector) => detector(segment));
        if (shouldReplace) {
            return placeholder;
        }
        return preserveCase ? segment : segment.toLowerCase();
    });

    return `/${normalizedSegments.join('/')}`;
}

/**
 * Creates a pre-configured normalizer instance which can later be reused.
 *
 * @param {Object} [options] - Same options supported by {@link normalizeEndpoint}.
 * @returns {(path: string) => string}
 */
export function createEndpointNormalizer(options = {}) {
    return (path) => normalizeEndpoint(path, options);
}

/**
 * Convenience helper for building Redis/metric keys using the normalized path
 * together with a UTC month identifier.
 *
 * @param {string} path - Request path.
 * @param {Date|number|string} [at=new Date()] - Reference time.
 * @param {Object} [options]
 * @returns {string}
 */
export function normalizeEndpointForMonth(path, at = new Date(), options = {}) {
    const normalizedPath = normalizeEndpoint(path, options);
    const date = toDateSafe(at);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${normalizedPath}@${year}-${month}`;
}

/**
 * Usage example:
 *
 * ```js
 * import { normalizeEndpoint, normalizeEndpointForMonth } from './core/endpoint-normalize.mjs';
 *
 * const normalized = normalizeEndpoint('/jobs/42');
 * // normalized === '/jobs/:id'
 *
 * const monthlyKey = normalizeEndpointForMonth('/jobs/42', '2024-05-16T12:00:00Z');
 * // monthlyKey === '/jobs/:id@2024-05'
 * ```
 */
