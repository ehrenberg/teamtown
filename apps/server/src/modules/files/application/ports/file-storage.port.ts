/** Default adapter: local Docker volume. Optional alternative: S3-compatible (ADR-0017). */
export interface FileStorage {
  put(storageKey: string, bytes: Buffer): Promise<void>;
  get(storageKey: string): Promise<NodeJS.ReadableStream>;
  delete(storageKey: string): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
