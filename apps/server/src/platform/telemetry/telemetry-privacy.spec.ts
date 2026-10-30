import { LoggerProvider, InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';
import { describe, expect, it } from 'vitest';
import { isForbiddenAttribute, PrivacyLogRecordProcessor, PrivacySpanProcessor } from './telemetry-privacy.ts';

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhbm5hIn0.c2lnbmF0dXJl';

/** What the HTTP instrumentation and careless code could attach (ADR-0012, ADR-0019). */
const forbidden = {
  'client.address': '203.0.113.7',
  'network.peer.address': '203.0.113.7',
  'user_agent.original': 'Mozilla/5.0',
  'url.query': 'invite=secret',
  'http.request.header.authorization': `Bearer ${JWT}`,
  'teamtown.position.x': 12,
  'teamtown.path': '[[1,2],[1,3]]',
  'teamtown.target': '12,4',
  'teamtown.message.body': 'Hello',
  'oidc.access_token': 'abc',
  'some.field': JWT,
};

const allowed = {
  'http.request.method': 'GET',
  'http.route': '/api/floors/:floorId/plan',
  'http.response.status_code': 200,
  'url.path': '/api/floors/ground-floor/plan',
  'db.system.name': 'postgresql',
  'teamtown.realtime.command': 'MoveTo',
  'teamtown.realtime.outcome': 'unreachable',
};

describe('telemetry privacy filter', () => {
  it('removes forbidden span attributes before export and keeps operational ones', () => {
    const exporter = new InMemorySpanExporter();
    const provider = new TracerProvider({
      spanProcessors: [new PrivacySpanProcessor(), new SimpleSpanProcessor({ exporter })],
    });
    const span = provider.getTracer('test').startSpan('GET /api/floors/:floorId/plan');
    span.setAttributes({ ...forbidden, ...allowed });
    span.addEvent('step', { 'teamtown.position.y': 3, 'teamtown.realtime.command': 'MoveTo' });
    span.end();

    const [exported] = exporter.getFinishedSpans();
    expect(exported?.attributes).toEqual(allowed);
    expect(exported?.events[0]?.attributes).toEqual({ 'teamtown.realtime.command': 'MoveTo' });
  });

  it('removes forbidden log attributes before export', () => {
    const exporter = new InMemoryLogRecordExporter();
    const provider = new LoggerProvider({
      processors: [new PrivacyLogRecordProcessor(), new SimpleLogRecordProcessor({ exporter })],
    });
    provider.getLogger('test').emit({ body: 'request completed', attributes: { ...forbidden, ...allowed } });

    const [exported] = exporter.getFinishedLogRecords();
    expect(exported?.attributes).toEqual(allowed);
  });

  it('recognises tokens by value, whatever the key', () => {
    expect(isForbiddenAttribute('detail', `token was ${JWT}`)).toBe(true);
    expect(isForbiddenAttribute('detail', 'floor ground-floor not found')).toBe(false);
  });
});
