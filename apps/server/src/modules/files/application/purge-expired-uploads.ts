import type { Clock } from '@teamtown/kernel';
import type { FileStorage } from './ports/file-storage.port.ts';
import type { UploadRepository } from './ports/upload-repository.port.ts';

const BATCH_SIZE = 200;

/** Use case: deletes pending uploads nobody claimed within 24 hours (P-22). Returns the number deleted. */
export class PurgeExpiredUploads {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<number> {
    const expired = await this.uploads.findExpiredPending(this.clock.now(), BATCH_SIZE);
    for (const upload of expired) {
      await this.storage.delete(upload.props.storageKey);
      await this.uploads.delete(upload.props.uploadId);
    }
    return expired.length;
  }
}
