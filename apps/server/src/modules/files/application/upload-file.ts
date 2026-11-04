import { err, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import type { UploadCreateError } from '../domain/upload.ts';
import { Upload, bytesMatchContentType } from '../domain/upload.ts';
import type { FileStorage } from './ports/file-storage.port.ts';
import type { MalwareScanner } from './ports/malware-scanner.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

export type UploadFileError = UploadCreateError | 'infected-file' | 'scan-failed';

/**
 * Use case: a member uploads a file to temporary storage (P-22). The scan happens before the upload becomes
 * claimable, so an infected file is rejected immediately and no bytes are kept (ADR-0035). Only a clean verdict
 * lets a file through: if the scanner is on but cannot give one, the upload fails rather than going unscanned.
 */
export class UploadFile {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: FileStorage,
    private readonly scanner: MalwareScanner,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    uploaderId: string;
    fileName: string;
    contentType: string;
    bytes: Buffer;
  }): Promise<Result<Upload, UploadFileError>> {
    const created = Upload.create({
      uploadId: this.ids.next(),
      uploaderId: input.uploaderId,
      fileName: input.fileName,
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      now: this.clock.now(),
    });
    if (!created.ok) return created;
    if (!bytesMatchContentType(input.contentType, input.bytes)) return err('unsupported-file-type');

    const scan = await this.scanner.scan(input.bytes).catch(() => 'failed' as const);
    if (scan === 'infected') return err('infected-file');
    if (scan === 'failed') return err('scan-failed');

    const upload = created.value;
    await this.storage.put(upload.props.storageKey, input.bytes);
    await this.uploads.save(upload);
    return created;
  }
}
