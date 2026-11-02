import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';
import type { FileStorage } from '../application/ports/file-storage.port.ts';

/** Default `FileStorage` adapter: a local Docker volume (ADR-0017). */
export class LocalFileStorageAdapter implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async put(storageKey: string, bytes: Buffer): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(this.#pathFor(storageKey), bytes);
  }

  get(storageKey: string): Promise<NodeJS.ReadableStream> {
    return Promise.resolve(createReadStream(this.#pathFor(storageKey)));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.#pathFor(storageKey), { force: true });
  }

  /** Storage keys are generated upload IDs (never user input), but normalize defensively against traversal. */
  #pathFor(storageKey: string): string {
    const root = resolve(this.rootDir);
    const path = resolve(root, normalize(storageKey));
    if (!path.startsWith(root)) throw new Error(`invalid storage key: ${storageKey}`);
    return join(root, storageKey);
  }
}
