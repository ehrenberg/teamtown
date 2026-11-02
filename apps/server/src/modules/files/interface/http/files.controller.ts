import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { UploadContract } from '@teamtown/contracts';
import type { Result } from '@teamtown/kernel';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, CurrentPrincipal, type Principal } from '../../../identity/public-api.ts';
import { ResolvePerson } from '../../../people/public-api.ts';
import { CancelUpload } from '../../application/cancel-upload.ts';
import { GetUploadContent } from '../../application/get-upload-content.ts';
import { UploadFile } from '../../application/upload-file.ts';
import type { Upload } from '../../domain/upload.ts';

const FORBIDDEN = new Set(['not-uploader', 'forbidden', 'already-claimed']);

/** Maps a use-case error to its HTTP status; the code is the `message` (contracts: `FilesErrorCode`). */
function fail(code: string): never {
  if (code === 'not-found') throw new NotFoundException();
  if (FORBIDDEN.has(code)) throw new ForbiddenException(code);
  throw new BadRequestException(code);
}

function valueOf<T>(result: Result<T, string>): T {
  if (!result.ok) fail(result.error);
  return result.value;
}

const toUpload = (upload: Upload): UploadContract => ({
  uploadId: upload.props.uploadId,
  fileName: upload.props.fileName,
  contentType: upload.props.contentType,
  byteSize: upload.props.byteSize,
  previewKind: upload.previewKind,
  expiresAt: upload.props.expiresAt.toISOString(),
});

/**
 * Uploads behind the Files context (M3d, ADR-0017, ADR-0035). Access scoped to the uploader for now; reading a
 * claimed attachment through the channel that posted it arrives with the Messaging integration follow-up
 * (docs/features/messaging-files.md).
 */
@Controller('files')
@UseGuards(AuthGuard)
export class FilesController {
  constructor(
    @Inject(ResolvePerson) private readonly resolvePerson: ResolvePerson,
    @Inject(UploadFile) private readonly uploadFile: UploadFile,
    @Inject(CancelUpload) private readonly cancelUpload: CancelUpload,
    @Inject(GetUploadContent) private readonly getUploadContent: GetUploadContent,
  ) {}

  @Post('uploads')
  async upload(@CurrentPrincipal() principal: Principal, @Req() req: FastifyRequest): Promise<UploadContract> {
    const personId = await this.#personId(principal);
    const part = await req.file();
    if (!part) throw new BadRequestException('invalid-request');

    let bytes: Buffer;
    try {
      bytes = await part.toBuffer();
    } catch (error) {
      if (error instanceof Error && error.message.includes('FST_REQ_FILE_TOO_LARGE')) {
        throw new BadRequestException('file-too-large');
      }
      throw error;
    }

    const result = await this.uploadFile.execute({
      uploaderId: personId,
      fileName: part.filename,
      contentType: part.mimetype,
      bytes,
    });
    return toUpload(valueOf(result));
  }

  @Delete('uploads/:uploadId')
  @HttpCode(204)
  async cancel(@CurrentPrincipal() principal: Principal, @Param('uploadId') uploadId: string): Promise<void> {
    const personId = await this.#personId(principal);
    valueOf(await this.cancelUpload.execute({ uploadId, requesterId: personId }));
  }

  @Get(':fileId')
  async download(@CurrentPrincipal() principal: Principal, @Param('fileId') fileId: string): Promise<StreamableFile> {
    return this.#stream(principal, fileId, 'attachment');
  }

  @Get(':fileId/preview')
  async preview(@CurrentPrincipal() principal: Principal, @Param('fileId') fileId: string): Promise<StreamableFile> {
    const personId = await this.#personId(principal);
    const { upload, stream } = valueOf(await this.getUploadContent.execute({ fileId, requesterId: personId }));
    // Only images have a preview today; PDF first-page thumbnails are a follow-up (docs/features/messaging-files.md).
    if (upload.previewKind !== 'image') throw new NotFoundException();
    return new StreamableFile(stream as unknown as Buffer, { type: upload.props.contentType });
  }

  async #stream(principal: Principal, fileId: string, disposition: 'attachment' | 'inline'): Promise<StreamableFile> {
    const personId = await this.#personId(principal);
    const { upload, stream } = valueOf(await this.getUploadContent.execute({ fileId, requesterId: personId }));
    return new StreamableFile(stream as unknown as Buffer, {
      type: upload.props.contentType,
      disposition: `${disposition}; filename="${encodeURIComponent(upload.props.fileName)}"`,
    });
  }

  async #personId(principal: Principal): Promise<string> {
    const person = await this.resolvePerson.execute(principal);
    if (!person.ok) throw new InternalServerErrorException(person.error);
    return person.value.personId;
  }
}
