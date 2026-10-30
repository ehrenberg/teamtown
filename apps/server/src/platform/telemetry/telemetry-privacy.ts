import type { Context } from '@opentelemetry/api';
import type { LogRecordProcessor, ReadWriteLogRecord } from '@opentelemetry/sdk-logs';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace';

/**
 * Privacy rules for all telemetry (ADR-0012, ADR-0019): no positions, paths, message content, tokens or
 * personal data in span or log attributes. This filter runs in the server before anything is exported;
 * the OpenTelemetry Collector drops the same keys again as a safety net (docker/observability).
 */
const FORBIDDEN_KEYS = new Set([
  // Personal data added by the HTTP instrumentation
  'client.address',
  'client.port',
  'network.peer.address',
  'network.peer.port',
  'user_agent.original',
  'http.user_agent',
  'net.peer.ip',
  'net.sock.peer.addr',
  // Query strings may carry anything
  'url.query',
]);

const FORBIDDEN_KEY_PATTERNS = [
  /token|password|secret|authorization|cookie/i,
  /^teamtown\.(position|path|target|message)/,
  /^http\.(request|response)\.header\./,
];

/** Values that look like a JWT are never exported, whatever their key. */
const JWT_PATTERN = /eyJ[\w-]+\.[\w-]+\.[\w-]+/;

export function isForbiddenAttribute(key: string, value: unknown): boolean {
  if (FORBIDDEN_KEYS.has(key) || FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key))) return true;
  return typeof value === 'string' && JWT_PATTERN.test(value);
}

/** Removes forbidden attributes in place (the SDK passes its mutable attribute objects). */
export function scrubAttributes(attributes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (isForbiddenAttribute(key, value)) Reflect.deleteProperty(attributes, key);
  }
}

/** Register before the exporting processor: it runs first and scrubs the span before it is queued. */
export class PrivacySpanProcessor implements SpanProcessor {
  onStart(_span: Span, _parentContext: Context): void {
    // Attributes are scrubbed once, when the span has its final set.
  }

  onEnd(span: ReadableSpan): void {
    scrubAttributes(span.attributes);
    for (const event of span.events) {
      if (event.attributes) scrubAttributes(event.attributes);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/** Register before the exporting processor, like {@link PrivacySpanProcessor}. */
export class PrivacyLogRecordProcessor implements LogRecordProcessor {
  onEmit(logRecord: ReadWriteLogRecord): void {
    scrubAttributes(logRecord.attributes);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
