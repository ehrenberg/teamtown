import { err, ok, type Result } from '@teamtown/kernel';
import { z } from 'zod';

/**
 * All configuration comes from environment variables, validated at startup (fail fast).
 * Every variable is documented in .env.example; local development values are in apps/server/.env.development.
 */
const AppConfigSchema = z.object({
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
});

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
