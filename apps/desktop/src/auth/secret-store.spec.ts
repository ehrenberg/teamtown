import { describe, expect, it } from 'vitest';
import { EncryptedFileSecretStore, type Encryption, type FileAccess } from './secret-store.ts';

const FILE = '/user-data/session.bin';

function setup({ available = true, rotated = false } = {}) {
  const files = new Map<string, Buffer>();
  const access: FileAccess = {
    read: (path) => Promise.resolve(files.get(path) ?? null),
    write: (path, data) => {
      files.set(path, data);
      return Promise.resolve();
    },
    remove: (path) => {
      files.delete(path);
      return Promise.resolve();
    },
  };
  const encryption: Encryption = {
    isAsyncEncryptionAvailable: () => Promise.resolve(available),
    encryptStringAsync: (text) => Promise.resolve(Buffer.from(`enc2:${text}`)),
    decryptStringAsync: (data) => {
      const match = /^enc2?:(.*)$/.exec(data.toString());
      if (!match?.[1]) return Promise.reject(new Error('cannot decrypt'));
      return Promise.resolve({ result: match[1], shouldReEncrypt: rotated });
    },
  };
  return { store: new EncryptedFileSecretStore(FILE, encryption, access), files };
}

describe('EncryptedFileSecretStore', () => {
  it('stores the secret encrypted and reads it back', async () => {
    const { store, files } = setup();
    await store.save('refresh-token');
    expect(files.get(FILE)?.toString()).toBe('enc2:refresh-token');
    await expect(store.load()).resolves.toBe('refresh-token');
  });

  it('never writes the secret in plain text when OS encryption is unavailable', async () => {
    const { store, files } = setup({ available: false });
    await store.save('refresh-token');
    expect(files.size).toBe(0);
    await expect(store.load()).resolves.toBeNull();
  });

  it('discards data it cannot decrypt', async () => {
    const { store, files } = setup();
    files.set(FILE, Buffer.from('garbage'));
    await expect(store.load()).resolves.toBeNull();
    expect(files.has(FILE)).toBe(false);
  });

  it('re-encrypts the secret when the OS rotated the key', async () => {
    const { store, files } = setup({ rotated: true });
    files.set(FILE, Buffer.from('enc:refresh-token'));
    await expect(store.load()).resolves.toBe('refresh-token');
    expect(files.get(FILE)?.toString()).toBe('enc2:refresh-token');
  });

  it('clears the stored secret', async () => {
    const { store } = setup();
    await store.save('refresh-token');
    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });
});
