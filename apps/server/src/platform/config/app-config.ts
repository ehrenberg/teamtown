import { err, ok, type Result } from '@teamtown/kernel';
import { z } from 'zod';

/**
 * All configuration comes from environment variables, validated at startup (fail fast).
 * Every variable is documented in .env.example; local development values are in apps/server/.env.development.
 */
const AppConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Run pending database migrations when the server starts. */
    DATABASE_MIGRATE_ON_START: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    /** OIDC issuer URL, e.g. https://auth.example.org/realms/teamtown */
    OIDC_ISSUER: z.url(),
    /** Audience that access tokens must contain. */
    OIDC_AUDIENCE: z.string().min(1).default('teamtown-api'),
    /** Minimum level of the JSON logs (ADR-0019). */
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    /** LiveKit (ADR-0008). Without it, conversations still form but there is no audio. */
    LIVEKIT_URL: z.url({ protocol: /^wss?$/ }).optional(),
    /** LiveKit server API as reached from this server; defaults to LIVEKIT_URL with http(s). */
    LIVEKIT_API_URL: z.url({ protocol: /^https?$/ }).optional(),
    LIVEKIT_API_KEY: z.string().min(1).optional(),
    LIVEKIT_API_SECRET: z.string().min(1).optional(),
    /** Days a logged meeting is kept (ADR-0027); an admin setting from M4 on. */
    MEETING_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  })
  .refine(
    (config) =>
      [config.LIVEKIT_URL, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET].every((value) => value === undefined) ||
      [config.LIVEKIT_URL, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET].every((value) => value !== undefined),
    { message: 'set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET together', path: ['LIVEKIT_URL'] },
  );

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type AppConfigInput = z.input<typeof AppConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadAppConfig(env: Readonly<Record<string, string | undefined>>): Result<AppConfig, string[]> {
  const parsed = AppConfigSchema.safeParse(env);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
}
