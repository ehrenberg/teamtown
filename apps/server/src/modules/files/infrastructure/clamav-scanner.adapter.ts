import { Socket } from 'node:net';
import type { MalwareScanner, ScanResult } from '../application/ports/malware-scanner.port.ts';

const SCAN_TIMEOUT_MS = 30_000;
const CHUNK_SIZE = 64 * 1024;

/**
 * Default `MalwareScanner` adapter: ClamAV's `clamd`, spoken over its INSTREAM protocol (ADR-0035). Each chunk
 * is a 4-byte big-endian length prefix followed by the chunk bytes; a zero-length chunk ends the stream.
 */
export class ClamavScannerAdapter implements MalwareScanner {
  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  scan(bytes: Buffer): Promise<ScanResult> {
    return new Promise((resolvePromise, reject) => {
      const socket = new Socket();
      let response = '';
      let settled = false;

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      };

      socket.setTimeout(SCAN_TIMEOUT_MS);
      socket.once('timeout', () => {
        fail(new Error('ClamAV scan timed out'));
      });
      socket.once('error', fail);
      socket.on('data', (data: Buffer) => {
        response += data.toString('utf8');
      });
      socket.once('close', () => {
        if (settled) return;
        settled = true;
        resolvePromise(response.includes('FOUND') ? 'infected' : 'clean');
      });

      socket.connect(this.port, this.host, () => {
        socket.write('zINSTREAM\0');
        for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_SIZE) {
          const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
          const header = Buffer.alloc(4);
          header.writeUInt32BE(chunk.byteLength, 0);
          socket.write(header);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      });
    });
  }
}
