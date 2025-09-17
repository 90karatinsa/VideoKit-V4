/**
 * Helpers for computing monthly billing windows. All calculations are performed
 * in UTC midnight boundaries so that billing can be implemented consistently
 * across tenants. The implementation is intentionally timezone-aware so that we
 * can extend it in the future with tenant specific offsets without changing
 * callers.
 */

function toDate(value) {
    if (value instanceof Date) {
        const time = value.getTime();
        if (Number.isNaN(time)) {
            throw new TypeError('time-window: Invalid Date object received.');
        }
        return new Date(time);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new TypeError('time-window: Unable to convert value to a valid Date.');
    }
    return date;
}

function createUtcDate(year, month, day = 1) {
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

/**
 * Returns the UTC midnight representing the start of the month for the provided
 * date.
 *
 * @param {Date|number|string} [reference=new Date()]
 * @returns {Date}
 */
export function startOfUtcMonth(reference = new Date()) {
    const date = toDate(reference);
    return createUtcDate(date.getUTCFullYear(), date.getUTCMonth());
}

/**
 * Returns the exclusive UTC midnight representing the first moment of the next
 * month. Useful for range comparisons: `start <= x < end`.
 *
 * @param {Date|number|string} [reference=new Date()]
 * @returns {Date}
 */
export function endOfUtcMonth(reference = new Date()) {
    const date = toDate(reference);
    return createUtcDate(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

/**
 * Returns the billing window boundaries for the month that contains `reference`.
 *
 * @param {Date|number|string} [reference=new Date()]
 * @returns {{ start: Date, end: Date }}
 */
export function getMonthlyWindow(reference = new Date()) {
    const start = startOfUtcMonth(reference);
    const end = endOfUtcMonth(reference);
    return { start, end };
}

/**
 * Returns the billing window shifted by `offset` months relative to `reference`.
 * A negative offset navigates backwards in time, positive goes forward.
 *
 * @param {number} [offset=0]
 * @param {Date|number|string} [reference=new Date()]
 * @returns {{ start: Date, end: Date }}
 */
export function getMonthlyWindowWithOffset(offset = 0, reference = new Date()) {
    if (!Number.isInteger(offset)) {
        throw new TypeError('time-window: `offset` must be an integer value.');
    }

    const date = toDate(reference);
    const start = createUtcDate(date.getUTCFullYear(), date.getUTCMonth() + offset);
    const end = createUtcDate(start.getUTCFullYear(), start.getUTCMonth() + 1);
    return { start, end };
}

/**
 * Returns a canonical key (`YYYY-MM`) suitable for Redis/metric storage.
 *
 * @param {Date|number|string} [reference=new Date()]
 * @returns {string}
 */
export function getUtcMonthKey(reference = new Date()) {
    const date = startOfUtcMonth(reference);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Usage example:
 *
 * ```js
 * import { getMonthlyWindow, getUtcMonthKey } from './core/time-window.mjs';
 *
 * const { start, end } = getMonthlyWindow('2024-05-16T12:00:00Z');
 * // start === 2024-05-01T00:00:00.000Z
 * // end   === 2024-06-01T00:00:00.000Z
 *
 * const key = getUtcMonthKey(start);
 * // key === '2024-05'
 * ```
 */
