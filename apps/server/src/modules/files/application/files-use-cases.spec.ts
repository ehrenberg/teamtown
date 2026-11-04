import { Readable } from 'node:stream';
import { FixedClock, unwrap, type IdGenerator } from '@teamtown/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { Upload } from '../domain/upload.ts';
import { CancelUpload } from './cancel-upload.ts';
import { ClaimUploads } from './claim-uploads.ts';
import { DeleteAttachmentsOfMessage } from './delete-attachments-of-message.ts';
import { GetUploadContent } from './get-upload-content.ts';
import type { FileStorage } from './ports/file-storage.port.ts';
import type { MalwareScanner, ScanResult } from './ports/malware-scanner.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';
import { PurgeExpiredUploads } from './purge-expired-uploads.ts';
import { UploadFile } from './upload-file.ts';

/** Stores plain props and restores a fresh `Upload` on every read, like a real repository round-trip:
 * mutating a returned aggregate never persists without an explicit `save`. */
class InMemoryUploads implements UploadRepository {
  readonly records = new Map<string, Upload['props']>();

  findById(uploadId: string): Promise<Upload | null> {
    const props = this.records.get(uploadId);
    return Promise.resolve(props ? Upload.restore(props) : null);
  }
  async findClaimedByMessage(messageId: string): Promise<Upload[]> {
    const all = await Promise.all([...this.records.keys()].map((id) => this.findById(id)));
    return all.filter((upload): upload is Upload => upload !== null && upload.props.claimedByMessageId === messageId);
  }
  async findExpiredPending(now: Date, limit: number): Promise<Upload[]> {
    const all = await Promise.all([...this.records.keys()].map((id) => this.findById(id)));
    return all.filter((upload): upload is Upload => upload?.isExpired(now) ?? false).slice(0, limit);
  }
  save(upload: Upload): Promise<void> {
    this.records.set(upload.props.uploadId, upload.props);
    return Promise.resolve();
  }
  delete(uploadId: string): Promise<void> {
    this.records.delete(uploadId);
    return Promise.resolve();
  }
}

class FakeStorage implements FileStorage {
  readonly bytes = new Map<string, Buffer>();

  put(storageKey: string, bytes: Buffer): Promise<void> {
    this.bytes.set(storageKey, bytes);
    return Promise.resolve();
  }
  get(storageKey: string): Promise<NodeJS.ReadableStream> {
    const buffer = this.bytes.get(storageKey);
    if (!buffer) throw new Error(`no bytes for ${storageKey}`);
    return Promise.resolve(Readable.from(buffer));
  }
  delete(storageKey: string): Promise<void> {
    this.bytes.delete(storageKey);
    return Promise.resolve();
  }
}

class FakeScanner implements MalwareScanner {
  result: ScanResult | Error = 'clean';
  scan(): Promise<ScanResult> {
    return this.result instanceof Error ? Promise.reject(this.result) : Promise.resolve(this.result);
  }
}

const ids: IdGenerator = (() => {
  let next = 0;
  return { next: () => `u${String(++next)}` };
})();

const NOW = new Date('2026-11-02T10:00:00Z');
const PDF = Buffer.from('%PDF-1.7 hello');

describe('Files use cases', () => {
  let uploads: InMemoryUploads;
  let storage: FakeStorage;
  let scanner: FakeScanner;
  let clock: FixedClock;
  let uploadFile: UploadFile;

  beforeEach(() => {
    uploads = new InMemoryUploads();
    storage = new FakeStorage();
    scanner = new FakeScanner();
    clock = new FixedClock(NOW);
    uploadFile = new UploadFile(uploads, storage, scanner, clock, ids);
  });

  it('stores a clean upload and keeps its bytes', async () => {
    const result = await uploadFile.execute({
      uploaderId: 'anna',
      fileName: 'plan.pdf',
      contentType: 'application/pdf',
      bytes: PDF,
    });
    const upload = unwrap(result);
    expect(upload.props.status).toBe('pending');
    expect(storage.bytes.get(upload.props.storageKey)?.toString()).toBe(PDF.toString());
    expect((await uploads.findById(upload.props.uploadId))?.props.fileName).toBe('plan.pdf');
  });

  it('rejects an infected upload and keeps no bytes', async () => {
    scanner.result = 'infected';
    const result = await uploadFile.execute({
      uploaderId: 'anna',
      fileName: 'plan.pdf',
      contentType: 'application/pdf',
      bytes: PDF,
    });
    expect(result).toEqual({ ok: false, error: 'infected-file' });
    expect(storage.bytes.size).toBe(0);
    expect(uploads.records.size).toBe(0);
  });

  it('rejects a file whose bytes do not match its declared type, keeping nothing (P-20)', async () => {
    const result = await uploadFile.execute({
      uploaderId: 'anna',
      fileName: 'photo.png',
      contentType: 'image/png',
      bytes: Buffer.from('MZ this is an executable'),
    });
    expect(result).toEqual({ ok: false, error: 'unsupported-file-type' });
    expect(storage.bytes.size).toBe(0);
    expect(uploads.records.size).toBe(0);
  });

  it('keeps nothing when the scan cannot give a verdict: only a clean result lets a file through (ADR-0035)', async () => {
    scanner.result = new Error('clamd answered with an error');
    const result = await uploadFile.execute({
      uploaderId: 'anna',
      fileName: 'plan.pdf',
      contentType: 'application/pdf',
      bytes: PDF,
    });
    expect(result).toEqual({ ok: false, error: 'scan-failed' });
    expect(storage.bytes.size).toBe(0);
    expect(uploads.records.size).toBe(0);
  });

  it('rejects a disallowed type before scanning', async () => {
    const result = await uploadFile.execute({
      uploaderId: 'anna',
      fileName: 'tool.exe',
      contentType: 'application/x-msdownload',
      bytes: PDF,
    });
    expect(result).toEqual({ ok: false, error: 'unsupported-file-type' });
    expect(storage.bytes.size).toBe(0);
  });

  it('lets only the uploader cancel a pending upload, deleting its bytes', async () => {
    const upload = unwrap(
      await uploadFile.execute({
        uploaderId: 'anna',
        fileName: 'plan.pdf',
        contentType: 'application/pdf',
        bytes: PDF,
      }),
    );
    const cancel = new CancelUpload(uploads, storage);
    expect(await cancel.execute({ uploadId: upload.props.uploadId, requesterId: 'ben' })).toEqual({
      ok: false,
      error: 'not-uploader',
    });
    expect(await cancel.execute({ uploadId: upload.props.uploadId, requesterId: 'anna' })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(storage.bytes.size).toBe(0);
    expect(await uploads.findById(upload.props.uploadId)).toBeNull();
  });

  it('claims every upload or none, and only for the uploader', async () => {
    const annasUpload = unwrap(
      await uploadFile.execute({
        uploaderId: 'anna',
        fileName: 'a.pdf',
        contentType: 'application/pdf',
        bytes: PDF,
      }),
    );
    const bensUpload = unwrap(
      await uploadFile.execute({
        uploaderId: 'ben',
        fileName: 'b.pdf',
        contentType: 'application/pdf',
        bytes: PDF,
      }),
    );
    const claim = new ClaimUploads(uploads);
    const mixed = await claim.execute({
      uploadIds: [annasUpload.props.uploadId, bensUpload.props.uploadId],
      messageId: 'm1',
      uploaderId: 'anna',
    });
    expect(mixed).toEqual({ ok: false, error: 'not-uploader' });
    // Neither upload was claimed: the failing check happens before any save.
    expect((await uploads.findById(annasUpload.props.uploadId))?.props.status).toBe('pending');

    const claimed = unwrap(
      await claim.execute({ uploadIds: [annasUpload.props.uploadId], messageId: 'm1', uploaderId: 'anna' }),
    );
    expect(claimed[0]).toMatchObject({ fileId: annasUpload.props.uploadId, fileName: 'a.pdf' });
    expect((await uploads.findById(annasUpload.props.uploadId))?.props).toMatchObject({
      status: 'claimed',
      claimedByMessageId: 'm1',
    });
  });

  it('only lets the uploader read their own upload', async () => {
    const upload = unwrap(
      await uploadFile.execute({
        uploaderId: 'anna',
        fileName: 'plan.pdf',
        contentType: 'application/pdf',
        bytes: PDF,
      }),
    );
    const getContent = new GetUploadContent(uploads, storage);
    expect(await getContent.execute({ fileId: upload.props.uploadId, requesterId: 'ben' })).toEqual({
      ok: false,
      error: 'forbidden',
    });
    const read = unwrap(await getContent.execute({ fileId: upload.props.uploadId, requesterId: 'anna' }));
    expect(read.upload.props.fileName).toBe('plan.pdf');
  });

  it('purges only expired pending uploads', async () => {
    const upload = unwrap(
      await uploadFile.execute({
        uploaderId: 'anna',
        fileName: 'plan.pdf',
        contentType: 'application/pdf',
        bytes: PDF,
      }),
    );
    const purge = new PurgeExpiredUploads(uploads, storage, clock);
    expect(await purge.execute()).toBe(0);

    clock.advanceBy(25 * 60 * 60 * 1000);
    expect(await purge.execute()).toBe(1);
    expect(await uploads.findById(upload.props.uploadId)).toBeNull();
    expect(storage.bytes.size).toBe(0);
  });

  it('deletes claimed attachments when their message is deleted', async () => {
    const upload = unwrap(
      await uploadFile.execute({
        uploaderId: 'anna',
        fileName: 'plan.pdf',
        contentType: 'application/pdf',
        bytes: PDF,
      }),
    );
    unwrap(
      await new ClaimUploads(uploads).execute({
        uploadIds: [upload.props.uploadId],
        messageId: 'm1',
        uploaderId: 'anna',
      }),
    );

    const deleteAttachments = new DeleteAttachmentsOfMessage(uploads, storage);
    await deleteAttachments.execute('m1');
    expect(await uploads.findById(upload.props.uploadId)).toBeNull();
    expect(storage.bytes.size).toBe(0);
  });
});
