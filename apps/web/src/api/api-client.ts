import type { z } from 'zod';
import { currentAccessToken } from '../stores/session-store.ts';

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API request failed with HTTP ${status}`);
  }
}

/** GET a JSON resource from the TeamTown API and validate it against its contract. */
export async function apiGet<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  fetchImpl: typeof fetch = fetch,
): Promise<z.infer<Schema>> {
  const token = currentAccessToken();
  const response = await fetchImpl(`/api${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return schema.parse(await response.json());
}
