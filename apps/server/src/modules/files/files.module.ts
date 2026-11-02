import { Module } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import type { Clock, IdGenerator } from '@teamtown/kernel';
import { MessagingEventStream, MessagingModule } from '../messaging/public-api.ts';
import { PeopleModule } from '../people/public-api.ts';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.ts';
import { CLOCK, ID_GENERATOR } from '../../platform/config/config.module.ts';
import { CancelUpload } from './application/cancel-upload.ts';
import { ClaimUploads } from './application/claim-uploads.ts';
import { DeleteAttachmentsOfMessage } from './application/delete-attachments-of-message.ts';
import { GetUploadContent } from './application/get-upload-content.ts';
import { FILE_STORAGE, type FileStorage } from './application/ports/file-storage.port.ts';
import { MALWARE_SCANNER, type MalwareScanner } from './application/ports/malware-scanner.port.ts';
import { UPLOAD_REPOSITORY, type UploadRepository } from './application/ports/upload-repository.port.ts';
import { PurgeExpiredUploads } from './application/purge-expired-uploads.ts';
import { UploadFile } from './application/upload-file.ts';
import { ClamavScannerAdapter } from './infrastructure/clamav-scanner.adapter.ts';
import { DisabledMalwareScanner } from './infrastructure/disabled-malware-scanner.adapter.ts';
import { LocalFileStorageAdapter } from './infrastructure/local-file-storage.adapter.ts';
import { MessageDeletedListener } from './infrastructure/message-deleted-listener.ts';
import { FILES_ENTITIES } from './infrastructure/persistence/files.entities.ts';
import { FILES_MIGRATIONS } from './infrastructure/persistence/migrations/files-initial.migration.ts';
import { MikroOrmUploadRepository } from './infrastructure/persistence/mikro-orm-upload.repository.ts';
import { UploadExpiry } from './infrastructure/upload-expiry.ts';
import { FilesController } from './interface/http/files.controller.ts';

/** Uploads behind a `FileStorage` port (ADR-0017), scanned behind a `MalwareScanner` port (ADR-0035, M3d). */
@Module({
  imports: [MessagingModule, PeopleModule],
  controllers: [FilesController],
  providers: [
    {
      provide: UPLOAD_REPOSITORY,
      useFactory: (orm: MikroORM) => new MikroOrmUploadRepository(orm),
      inject: [MikroORM],
    },
    {
      provide: FILE_STORAGE,
      useFactory: (config: AppConfig) => new LocalFileStorageAdapter(config.FILES_STORAGE_PATH),
      inject: [APP_CONFIG],
    },
    {
      provide: MALWARE_SCANNER,
      useFactory: (config: AppConfig) =>
        config.FILES_CLAMAV_HOST
          ? new ClamavScannerAdapter(config.FILES_CLAMAV_HOST, config.FILES_CLAMAV_PORT)
          : new DisabledMalwareScanner(),
      inject: [APP_CONFIG],
    },
    {
      provide: UploadFile,
      useFactory: (
        uploads: UploadRepository,
        storage: FileStorage,
        scanner: MalwareScanner,
        clock: Clock,
        ids: IdGenerator,
      ) => new UploadFile(uploads, storage, scanner, clock, ids),
      inject: [UPLOAD_REPOSITORY, FILE_STORAGE, MALWARE_SCANNER, CLOCK, ID_GENERATOR],
    },
    {
      provide: CancelUpload,
      useFactory: (uploads: UploadRepository, storage: FileStorage) => new CancelUpload(uploads, storage),
      inject: [UPLOAD_REPOSITORY, FILE_STORAGE],
    },
    {
      provide: GetUploadContent,
      useFactory: (uploads: UploadRepository, storage: FileStorage) => new GetUploadContent(uploads, storage),
      inject: [UPLOAD_REPOSITORY, FILE_STORAGE],
    },
    {
      provide: ClaimUploads,
      useFactory: (uploads: UploadRepository) => new ClaimUploads(uploads),
      inject: [UPLOAD_REPOSITORY],
    },
    {
      provide: PurgeExpiredUploads,
      useFactory: (uploads: UploadRepository, storage: FileStorage, clock: Clock) =>
        new PurgeExpiredUploads(uploads, storage, clock),
      inject: [UPLOAD_REPOSITORY, FILE_STORAGE, CLOCK],
    },
    {
      provide: UploadExpiry,
      useFactory: (purge: PurgeExpiredUploads) => new UploadExpiry(purge),
      inject: [PurgeExpiredUploads],
    },
    {
      provide: DeleteAttachmentsOfMessage,
      useFactory: (uploads: UploadRepository, storage: FileStorage) => new DeleteAttachmentsOfMessage(uploads, storage),
      inject: [UPLOAD_REPOSITORY, FILE_STORAGE],
    },
    {
      provide: MessageDeletedListener,
      useFactory: (events: MessagingEventStream, deleteAttachments: DeleteAttachmentsOfMessage) =>
        new MessageDeletedListener(events, deleteAttachments),
      inject: [MessagingEventStream, DeleteAttachmentsOfMessage],
    },
  ],
  exports: [ClaimUploads],
})
export class FilesModule {
  static readonly entities = FILES_ENTITIES;
  static readonly migrations = FILES_MIGRATIONS;
}
