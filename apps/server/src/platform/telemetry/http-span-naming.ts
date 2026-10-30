import { context, trace } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import { ATTR_HTTP_ROUTE } from '@opentelemetry/semantic-conventions';
import type { FastifyInstance } from 'fastify';

/**
 * Names HTTP server spans after their route template (`GET /api/floors/:floorId/plan`) instead of the bare
 * method, so traces group by endpoint, and hands the route to the HTTP instrumentation's metrics
 * (`http.route` label). Runs as the first Fastify hook, so requests that guards reject are covered too.
 * Without an active span (telemetry off) it does nothing.
 */
export function nameHttpSpansByRoute(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (request, _reply, done) => {
    const span = trace.getActiveSpan();
    const route = request.routeOptions.url;
    if (span && route) {
      span.setAttribute(ATTR_HTTP_ROUTE, route);
      span.updateName(`${request.method} ${route}`);
      const rpcMetadata = getRPCMetadata(context.active());
      if (rpcMetadata?.type === RPCType.HTTP) rpcMetadata.route = route;
    }
    done();
  });
}
