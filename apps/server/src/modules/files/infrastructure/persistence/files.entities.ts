import { defineEntity, p } from '@mikro-orm/postgresql';

/** Persistence records of the Files context (schema `files`); the domain class stays undecorated. */

export const UploadEntity = defineEntity({
  name: 'UploadRecord',
  schema: 'files',
  tableName: 'upload',
  properties: {
    uploadId: p.string().length(64).primary(),
    uploaderId: p.uuid(),
    fileName: p.string().length(255),
    contentType: p.string().length(128),
    byteSize: p.integer(),
    storageKey: p.string().length(255),
    status: p.string().length(16),
    claimedByMessageId: p.string().length(64).nullable(),
    createdAt: p.datetime(),
    expiresAt: p.datetime(),
  },
});
export class UploadRecord extends UploadEntity.class {}
UploadEntity.setClass(UploadRecord);

export const FILES_ENTITIES = [UploadEntity];
