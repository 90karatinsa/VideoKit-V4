/**
 * Dev/stub billing middleware: hiçbir şeyi engellemez, sadece next() der.
 * Prod'da gerçek kontrolleri geri koy.
 */
export function billingMiddleware(req, res, next) { next(); }
export function ensureActiveSubscription(req, res, next) { next(); }
export function verifyPlan(/* plan */) { return (_req, _res, next) => next(); }
export function requirePlan(/* plan */) { return (_req, _res, next) => next(); }
const _default = billingMiddleware;
export default _default;
