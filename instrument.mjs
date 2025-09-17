// instrument.mjs (ESM)
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0.2,       // ihtiyacına göre
  profilesSampleRate: 0.0      // profil gerekirse >0 yap
});
