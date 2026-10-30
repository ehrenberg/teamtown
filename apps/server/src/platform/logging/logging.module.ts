import { Module, RequestMethod, type DynamicModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { AppConfig } from '../config/app-config.ts';

/**
 * Paths that pino removes from every log line, as a second line of defence behind the request serializers
 * (ADR-0019: never log tokens or personal data). Positions are never passed to the logger at all (ADR-0012).
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.accessToken',
  '*.access_token',
  '*.refreshToken',
  '*.password',
  '*.token',
];

const withoutQuery = (url: string | undefined): string | undefined => url?.split('?')[0];

/** Structured JSON logs via pino (ADR-0019); the OpenTelemetry pino instrumentation forwards them to Loki. */
@Module({})
export class LoggingModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.NODE_ENV === 'test' ? 'silent' : config.LOG_LEVEL,
            redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
            // Request logs carry what operations need, nothing about the person: no headers, no client address.
            serializers: {
              req: (request: { id?: unknown; method?: string; url?: string }) => ({
                id: request.id,
                method: request.method,
                path: withoutQuery(request.url),
              }),
              res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode }),
            },
          },
          // Liveness probes would drown the request logs.
          exclude: [{ method: RequestMethod.GET, path: 'health' }],
        }),
      ],
    };
  }
}
