import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { describe, expect, it } from 'vitest';
import { RealtimeTelemetry } from './realtime-telemetry.ts';

/** Collects metrics on demand. */
class TestMetricReader extends MetricReader {
  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }

  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

function setup() {
  const spans = new InMemorySpanExporter();
  const tracerProvider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter: spans })] });
  const reader = new TestMetricReader();
  const meterProvider = new MeterProvider({ readers: [reader] });
  const telemetry = new RealtimeTelemetry(meterProvider.getMeter('test'), tracerProvider.getTracer('test'));
  const metric = async (name: string) => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics).find((m) => m.descriptor.name === name);
  };
  return { telemetry, spans, metric };
}

describe('RealtimeTelemetry', () => {
  it('traces a command with its type and outcome only', async () => {
    const { telemetry, spans } = setup();
    await telemetry.observeCommand('MoveTo', () => Promise.resolve('unreachable'));

    const [span] = spans.getFinishedSpans();
    expect(span?.name).toBe('realtime MoveTo');
    // Privacy (ADR-0012): no person, floor, position or target.
    expect(span?.attributes).toEqual({
      'teamtown.realtime.command': 'MoveTo',
      'teamtown.realtime.outcome': 'unreachable',
    });
  });

  it('marks internal errors on the span', async () => {
    const { telemetry, spans } = setup();
    await telemetry.observeCommand('JoinFloor', () => Promise.resolve('internal-error'));
    expect(spans.getFinishedSpans()[0]?.status.code).toBe(2); // SpanStatusCode.ERROR
  });

  it('counts heartbeats without tracing them', async () => {
    const { telemetry, spans, metric } = setup();
    await telemetry.observeCommand('Ping', () => Promise.resolve('ok'));

    expect(spans.getFinishedSpans()).toHaveLength(0);
    const commands = await metric('teamtown.realtime.commands');
    expect(commands?.dataPoints).toEqual([
      expect.objectContaining({
        attributes: { 'teamtown.realtime.command': 'Ping', 'teamtown.realtime.outcome': 'ok' },
        value: 1,
      }),
    ]);
  });

  it('tracks open connections as an instance-wide total', async () => {
    const { telemetry, metric } = setup();
    telemetry.connectionOpened();
    telemetry.connectionOpened();
    telemetry.connectionClosed();

    const connections = await metric('teamtown.realtime.connections');
    expect(connections?.dataPoints).toEqual([expect.objectContaining({ attributes: {}, value: 1 })]);
  });
});
