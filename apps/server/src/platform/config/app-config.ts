import { err, ok, type Result } from '@teamtown/kernel';
import { z } from 'zod';

/**
 * All configuration comes from environment variables, validated at startup (fail fast).
 * Every variable is documented in .env.example.
 */
const AppConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadAppConfig(env: Readonly<Record<string, string | undefined>>): Result<AppConfig, string[]> {
  const parsed = AppConfigSchema.safeParse(env);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
}
