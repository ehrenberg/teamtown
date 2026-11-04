import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { ClamavScannerAdapter } from './clamav-scanner.adapter.ts';

/** A stand-in for clamd: reads the whole INSTREAM request, then answers and closes. */
function fakeClamd(answer: string): Promise<Server> {
  const server = createServer((socket) => {
    let received = Buffer.alloc(0);
    socket.on('data', (data) => {
      received = Buffer.concat([received, data]);
      if (received.subarray(-4).equals(Buffer.alloc(4))) socket.end(answer);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

describe('ClamavScannerAdapter', () => {
  let server: Server | undefined;

  afterEach(() => {
    server?.close();
  });

  const scanWith = async (answer: string) => {
    server = await fakeClamd(answer);
    const { port } = server.address() as AddressInfo;
    return new ClamavScannerAdapter('127.0.0.1', port).scan(Buffer.from('some bytes'));
  };

  it('reports a clean file', async () => {
    await expect(scanWith('stream: OK\0')).resolves.toBe('clean');
  });

  it('reports an infected file', async () => {
    await expect(scanWith('stream: Eicar-Signature FOUND\0')).resolves.toBe('infected');
  });

  it.each([['INSTREAM size limit exceeded. ERROR\0'], ['']])('never calls %j clean', async (answer) => {
    await expect(scanWith(answer)).rejects.toThrow('ClamAV gave no verdict');
  });
});
