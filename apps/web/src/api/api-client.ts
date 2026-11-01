import type { z } from 'zod';
import { currentAccessToken } from '../stores/session-store.ts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** The stable error code of a 4xx answer (e.g. `MessagingErrorCode`), if the server sent one. */
    readonly code: string | null = null,
  ) {
    super(`API request failed with HTTP ${status}`);
  }
}

const headers = (json: boolean): Record<string, string> => {
  const token = currentAccessToken();
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'content-type': 'application/json' } : {}),
  };
};

async function errorOf(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const code =
    typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
      ? body.message
      : null;
  return new ApiError(response.status, code);
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

/** DELETE a resource of the TeamTown API. */
export async function apiDelete(path: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(`/api${path}`, { method: 'DELETE', headers: headers(false) });
  if (!response.ok) {
    throw await errorOf(response);
  }
}

type SendMethod = 'POST' | 'PATCH' | 'PUT';

/** POST, PATCH or PUT a JSON body; with a schema, the answer is validated against its contract. */
export async function apiSend(
  method: SendMethod,
  path: string,
  body: unknown,
  schema?: undefined,
  fetchImpl?: typeof fetch,
): Promise<void>;
export async function apiSend<Schema extends z.ZodType>(
  method: SendMethod,
  path: string,
  body: unknown,
  schema: Schema,
  fetchImpl?: typeof fetch,
): Promise<z.infer<Schema>>;
export async function apiSend(
  method: SendMethod,
  path: string,
  body: unknown,
  schema?: z.ZodType,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetchImpl(`/api${path}`, { method, headers: headers(true), body: JSON.stringify(body) });
  if (!response.ok) {
    throw await errorOf(response);
  }
  return schema ? schema.parse(await response.json()) : undefined;
}
