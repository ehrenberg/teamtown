import type { MikroORM } from '@mikro-orm/postgresql';
import type { UploadRepository } from '../../application/ports/upload-repository.port.ts';
import { Upload, type UploadProps, type UploadStatus } from '../../domain/upload.ts';
import { UploadRecord } from './files.entities.ts';

export class MikroOrmUploadRepository implements UploadRepository {
  constructor(private readonly orm: MikroORM) {}

  async findById(uploadId: string): Promise<Upload | null> {
    const record = await this.orm.em.fork().findOne(UploadRecord, { uploadId });
    return record ? toDomain(record) : null;
  }

  async findClaimedByMessage(messageId: string): Promise<Upload[]> {
    const records = await this.orm.em.fork().find(UploadRecord, { claimedByMessageId: messageId });
    return records.map(toDomain);
  }

  async findExpiredPending(now: Date, limit: number): Promise<Upload[]> {
    const records = await this.orm.em
      .fork()
      .find(
        UploadRecord,
        { status: 'pending' satisfies UploadStatus, expiresAt: { $lt: now } },
        { orderBy: { expiresAt: 'asc' }, limit },
      );
    return records.map(toDomain);
  }

  async save(upload: Upload): Promise<void> {
    const { props } = upload;
    await this.orm.em.fork().upsert(UploadRecord, {
      uploadId: props.uploadId,
      uploaderId: props.uploaderId,
      fileName: props.fileName,
      contentType: props.contentType,
      byteSize: props.byteSize,
      storageKey: props.storageKey,
      status: props.status,
      claimedByMessageId: props.claimedByMessageId,
      createdAt: props.createdAt,
      expiresAt: props.expiresAt,
    });
  }

  async delete(uploadId: string): Promise<void> {
    await this.orm.em.fork().nativeDelete(UploadRecord, { uploadId });
  }
}

function toDomain(record: UploadRecord): Upload {
  const props: UploadProps = {
    uploadId: record.uploadId,
    uploaderId: record.uploaderId,
    fileName: record.fileName,
    contentType: record.contentType,
    byteSize: record.byteSize,
    storageKey: record.storageKey,
    status: record.status as UploadStatus,
    claimedByMessageId: record.claimedByMessageId ?? null,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
  return Upload.restore(props);
}
