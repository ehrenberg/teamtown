/** Persists the refresh token between app starts. */
export interface SecretStore {
  load(): Promise<string | null>;
  save(secret: string): Promise<void>;
  clear(): Promise<void>;
}

/** Subset of Electron's `safeStorage`, so the store can be tested without Electron. */
export interface Encryption {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plainText: string): Promise<Buffer>;
  decryptStringAsync(encrypted: Buffer): Promise<{ readonly result: string; readonly shouldReEncrypt: boolean }>;
}

export interface FileAccess {
  read(path: string): Promise<Buffer | null>;
  write(path: string, data: Buffer): Promise<void>;
  remove(path: string): Promise<void>;
}

/**
 * Stores the secret encrypted with the OS keychain (Electron `safeStorage`, ADR-0023).
 * Without OS encryption the secret is never written in plain text; the login then lasts until the app quits.
 */
export class EncryptedFileSecretStore implements SecretStore {
  constructor(
    private readonly filePath: string,
    private readonly encryption: Encryption,
    private readonly files: FileAccess,
  ) {}

  async load(): Promise<string | null> {
    if (!(await this.encryption.isAsyncEncryptionAvailable())) return null;
    const data = await this.files.read(this.filePath);
    if (!data) return null;
    let decrypted: Awaited<ReturnType<Encryption['decryptStringAsync']>>;
    try {
      decrypted = await this.encryption.decryptStringAsync(data);
    } catch {
      await this.clear(); // e.g. the OS key changed; the person simply signs in again
      return null;
    }
    if (decrypted.shouldReEncrypt) await this.save(decrypted.result); // the OS rotated the key
    return decrypted.result;
  }

  async save(secret: string): Promise<void> {
    if (!(await this.encryption.isAsyncEncryptionAvailable())) return;
    await this.files.write(this.filePath, await this.encryption.encryptStringAsync(secret));
  }

  clear(): Promise<void> {
    return this.files.remove(this.filePath);
  }
}
