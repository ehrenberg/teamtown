import { metrics, SpanKind, SpanStatusCode, trace, type Meter, type Tracer } from '@opentelemetry/api';
import type { ClientCommand, NackCode } from '@teamtown/contracts';

/** `ok` or the Nack code the client received. */
export type CommandOutcome = 'ok' | NackCode;

/** Commands the clients send every few seconds; counted, but not traced. */
const UNTRACED_COMMANDS = new Set<string>(['Ping']);

/**
 * Metrics and spans of the realtime gateway (ADR-0019). Attributes are limited to the command type and its
 * outcome: never person IDs, floors, positions or targets (ADR-0012). Metrics are instance-wide aggregates.
 */
export class RealtimeTelemetry {
  readonly #tracer: Tracer;
  readonly #connections;
  readonly #commands;
  readonly #duration;

  constructor(meter: Meter = metrics.getMeter('teamtown-server'), tracer: Tracer = trace.getTracer('teamtown-server')) {
    this.#tracer = tracer;
    this.#connections = meter.createUpDownCounter('teamtown.realtime.connections', {
      description: 'Open WebSocket connections',
      unit: '{connection}',
    });
    this.#commands = meter.createCounter('teamtown.realtime.commands', {
      description: 'Handled client commands by type and outcome',
      unit: '{command}',
    });
    this.#duration = meter.createHistogram('teamtown.realtime.command.duration', {
      description: 'Time to handle a client command',
      unit: 's',
    });
  }

  connectionOpened(): void {
    this.#connections.add(1);
  }

  connectionClosed(): void {
    this.#connections.add(-1);
  }

  /** Runs a command handler inside a span and records its outcome. */
  async observeCommand(command: ClientCommand['t'] | 'invalid', handle: () => Promise<CommandOutcome>): Promise<void> {
    const started = performance.now();
    const record = (outcome: CommandOutcome) => {
      const attributes = { 'teamtown.realtime.command': command, 'teamtown.realtime.outcome': outcome };
      this.#commands.add(1, attributes);
      this.#duration.record((performance.now() - started) / 1000, attributes);
      return attributes;
    };

    if (UNTRACED_COMMANDS.has(command)) {
      record(await handle());
      return;
    }
    await this.#tracer.startActiveSpan(
      `realtime ${command}`,
      { kind: SpanKind.SERVER, attributes: { 'teamtown.realtime.command': command } },
      async (span) => {
        try {
          const outcome = await handle();
          span.setAttributes(record(outcome));
          if (outcome === 'internal-error') span.setStatus({ code: SpanStatusCode.ERROR });
        } finally {
          span.end();
        }
      },
    );
  }
}
