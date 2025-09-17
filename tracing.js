// tracing.js — ESM uyumlu, tam özellikli (OTLP HTTP, propagators, sampler, auto-instrumentations)

// 1) CJS/Esm karışıklığına takılmamak için @opentelemetry/api'yi default import edin
import api from '@opentelemetry/api';

// 2) SDK ve kaynak bilgileri (bunlar ESM uyumlu)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// 3) CJS olabilen paketleri dinamik import edin
const core = await import('@opentelemetry/core'); // propagators burada
const { getNodeAutoInstrumentations } =
  await import('@opentelemetry/auto-instrumentations-node');
const traceBase =
  await import('@opentelemetry/sdk-trace-base');   // sampler türleri burada

// Kısayollar
const { propagation } = api;
const {
  W3CTraceContextPropagator,
  W3CBaggagePropagator,
  CompositePropagator,
} = core;

const {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
} = traceBase;

// ---- Ortam değişkenleri / defaults ----
const serviceName =
  process.env.OTEL_SERVICE_NAME ||
  process.env.SERVICE_NAME ||
  'videokit-api';

const serviceVersion =
  process.env.OTEL_SERVICE_VERSION ||
  process.env.npm_package_version ||
  '0.0.0';

const serviceNamespace =
  process.env.OTEL_SERVICE_NAMESPACE || undefined;

// OTLP HTTP endpoint
const otlpUrl =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
  'http://localhost:4318/v1/traces';

// Opsiyonel: OTLP headers (OTEL_EXPORTER_OTLP_HEADERS="key1=val1,key2=val2")
function parseHeaders(str) {
  if (!str) return {};
  return str.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .reduce((acc, kv) => {
      const [k, ...rest] = kv.split('=');
      acc[k.trim()] = rest.join('=').trim();
      return acc;
    }, {});
}
const otlpHeaders = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

// ---- Exporter ----
const exporter = new OTLPTraceExporter({
  url: otlpUrl,
  headers: otlpHeaders,
});

// ---- Resource ----
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  ...(serviceNamespace
    ? { [SemanticResourceAttributes.SERVICE_NAMESPACE]: serviceNamespace }
    : {}),
});

// ---- Propagators ----
propagation.setGlobalPropagator(
  new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(),
      new W3CBaggagePropagator(),
    ],
  })
);

// ---- Sampler (ENV: OTEL_TRACES_SAMPLER=always_on|always_off|traceidratio, OTEL_TRACES_SAMPLER_ARG=0.1) ----
function makeSampler() {
  const kind = (process.env.OTEL_TRACES_SAMPLER || 'parentbased_always_on').toLowerCase();

  if (kind === 'always_on' || kind === 'on') return new AlwaysOnSampler();
  if (kind === 'always_off' || kind === 'off') return new AlwaysOffSampler();

  if (kind === 'traceidratio' || kind === 'ratio') {
    const arg = Number(process.env.OTEL_TRACES_SAMPLER_ARG || '0.1');
    return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(arg) });
  }

  // parentbased_always_on (default)
  return new ParentBasedSampler({ root: new AlwaysOnSampler() });
}

const sampler = makeSampler();

// ---- Auto-instrumentations ----
const instrumentations = [getNodeAutoInstrumentations({
  // İstersen burada spesifik modülleri kapatıp açabilirsin
  // '@opentelemetry/instrumentation-fs': { enabled: false },
})];

// ---- SDK ----
const sdk = new NodeSDK({
  resource,
  traceExporter: exporter,
  instrumentations,
  sampler,
});

// ---- Start / Shutdown ----
await sdk.start()
  .then(() => {
    console.log(`[tracing] started: service="${serviceName}" ver="${serviceVersion}" → ${otlpUrl}`);
    if (Object.keys(otlpHeaders).length) {
      console.log('[tracing] OTLP headers set:', Object.keys(otlpHeaders).join(', '));
    }
  })
  .catch((e) => {
    console.warn('[tracing] disabled:', e?.message || e);
  });

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
process.on('SIGINT', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
