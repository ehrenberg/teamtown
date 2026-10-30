/**
 * OpenTelemetry bootstrap (ADR-0019). Loaded before the application with `node --import ./dist/instrumentation.js`
 * so that the instrumented libraries are patched when they are first imported.
 *
 * Telemetry is only sent when OTEL_EXPORTER_OTLP_ENDPOINT is set (standard OpenTelemetry variable). It goes to the
 * instance's own collector; nothing leaves the instance (ADR-0024).
 */
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { envDetector, hostDetector } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import { register } from 'import-in-the-middle/register-hooks.mjs';
import { PrivacyLogRecordProcessor, PrivacySpanProcessor } from './platform/telemetry/telemetry-privacy.ts';

const HEALTH_PATH = '/api/health';
const METRIC_EXPORT_INTERVAL_MS = 15_000;

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // ESM support: lets the instrumentations patch modules loaded with `import` (synchronous hooks, Node >= 24.11).
  register({ include: ['http', 'node:http', 'pg', 'pino'] });

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'teamtown-server',
    // No process detector: it would attach the OS user name and the full command line to every signal.
    resourceDetectors: [envDetector, hostDetector],
    // The privacy processors must come first: they scrub what the exporting processors then send.
    spanProcessors: [new PrivacySpanProcessor(), new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })],
    logRecordProcessors: [
      new PrivacyLogRecordProcessor(),
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
    // Every 15 s, matching the Prometheus scrape interval Grafana assumes for rate() windows.
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
      }),
    ],
    instrumentations: [
      new HttpInstrumentation({
        // Liveness probes would drown the traces.
        ignoreIncomingRequestHook: (request) => request.url === HEALTH_PATH,
        // The server makes few outgoing calls (OIDC discovery and keys); trace them only within a request.
        requireParentforOutgoingSpans: true,
      }),
      // Statement text only; parameter values (which could hold personal data) are not recorded.
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
      // Adds trace and span IDs to every log line and sends the logs via OTLP to Loki.
      new PinoInstrumentation(),
    ],
  });
  sdk.start();

  const shutdown = () => {
    sdk.shutdown().catch((error: unknown) => {
      console.error('OpenTelemetry shutdown failed', error);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
