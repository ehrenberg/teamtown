import { z } from 'zod';

/**
 * Realtime protocol (ADR-0007, docs/architecture/world-and-realtime.md §5).
 * Envelope `{ t, id?, p }`: commands go client → server, events go server → client.
 */
export const REALTIME_PROTOCOL_VERSION = 1;

const CorrelationId = z.string().min(1).max(64);

// ---- Commands (client → server): imperative names ----

/** Clock sync: the client sends its local time and receives the server time back. */
export const PingCommand = z.object({
  t: z.literal('Ping'),
  id: CorrelationId.optional(),
  p: z.object({ clientTime: z.number() }),
});

export const ClientCommand = z.discriminatedUnion('t', [PingCommand]);
export type ClientCommand = z.infer<typeof ClientCommand>;

// ---- Events (server → client): past tense or state names ----

export const PongEvent = z.object({
  t: z.literal('Pong'),
  p: z.object({ clientTime: z.number(), serverTime: z.number() }),
});

export const AckEvent = z.object({
  t: z.literal('Ack'),
  p: z.object({ id: CorrelationId }),
});

export const NackEvent = z.object({
  t: z.literal('Nack'),
  p: z.object({ id: CorrelationId, code: z.string().min(1) }),
});

export const ServerEvent = z.discriminatedUnion('t', [PongEvent, AckEvent, NackEvent]);
export type ServerEvent = z.infer<typeof ServerEvent>;
