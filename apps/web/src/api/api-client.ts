import { UploadSchema, type UploadContract } from '@teamtown/contracts';
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

const codeOf = (body: unknown): string | null =>
  typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
    ? body.message
    : null;

async function errorOf(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  return new ApiError(response.status, codeOf(body));
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

type SendMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** POST, PATCH, PUT or DELETE with a JSON body; with a schema, the answer is validated against its contract. */
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

/** Fetches a file with the session's token; `<img src>` and links can't send one. */
export async function apiBlob(path: string, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<Blob> {
  const response = await fetchImpl(`/api${path}`, { headers: headers(false), ...(signal ? { signal } : {}) });
  if (!response.ok) {
    throw await errorOf(response);
  }
  return response.blob();
}

export interface UploadTask {
  readonly result: Promise<UploadContract>;
  /** Stops a running upload; `result` then rejects. */
  readonly abort: () => void;
}

/**
 * Uploads one file to temporary storage (P-22). Uses `XMLHttpRequest`, since `fetch` reports no upload progress.
 * `onProgress` gets a share from 0 to 1.
 */
export function apiUpload(
  file: File,
  contentType: string,
  onProgress: (share: number) => void,
  createRequest: () => XMLHttpRequest = () => new XMLHttpRequest(),
): UploadTask {
  const request = createRequest();
  const result = new Promise<UploadContract>((resolve, reject) => {
    const form = new FormData();
    form.append('file', new File([file], file.name, { type: contentType }));
    request.open('POST', '/api/files/uploads');
    for (const [name, value] of Object.entries(headers(false))) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      const body = parseJson(request.responseText);
      if (request.status >= 200 && request.status < 300) resolve(UploadSchema.parse(body));
      else reject(new ApiError(request.status, codeOf(body)));
    };
    request.onerror = () => {
      reject(new ApiError(0));
    };
    request.onabort = () => {
      reject(new ApiError(0));
    };
    request.send(form);
  });
  return {
    result,
    abort: () => {
      request.abort();
    },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
