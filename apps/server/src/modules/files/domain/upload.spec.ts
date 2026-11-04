import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, Upload, bytesMatchContentType, previewKindOf } from './upload.ts';

const NOW = new Date('2026-11-02T10:00:00Z');

const create = (overrides: Partial<{ byteSize: number; contentType: string }> = {}) =>
  Upload.create({
    uploadId: 'u1',
    uploaderId: 'anna',
    fileName: 'plan.pdf',
    contentType: 'application/pdf',
    byteSize: 1024,
    now: NOW,
    ...overrides,
  });

describe('Upload', () => {
  it('accepts an allowed type within the size limit', () => {
    const upload = unwrap(create());
    expect(upload.props).toMatchObject({ status: 'pending', claimedByMessageId: null, storageKey: 'u1' });
    expect(upload.isPending).toBe(true);
    expect(upload.props.expiresAt.getTime() - NOW.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('rejects a file over the 100 MB limit', () => {
    expect(create({ byteSize: MAX_UPLOAD_BYTES + 1 })).toEqual({ ok: false, error: 'file-too-large' });
    expect(create({ byteSize: MAX_UPLOAD_BYTES }).ok).toBe(true);
  });

  it('rejects a disallowed content type', () => {
    expect(create({ contentType: 'application/x-msdownload' })).toEqual({
      ok: false,
      error: 'unsupported-file-type',
    });
  });

  it('is claimed only once, by the uploader', () => {
    const upload = unwrap(create());
    expect(upload.claim('m1', 'ben')).toEqual({ ok: false, error: 'not-uploader' });
    expect(upload.claim('m1', 'anna').ok).toBe(true);
    expect(upload.props).toMatchObject({ status: 'claimed', claimedByMessageId: 'm1' });
    expect(upload.claim('m2', 'anna')).toEqual({ ok: false, error: 'already-claimed' });
  });

  it('is cancelled only by the uploader, and only before it is claimed', () => {
    const upload = unwrap(create());
    expect(upload.cancel('ben')).toEqual({ ok: false, error: 'not-uploader' });
    unwrap(upload.claim('m1', 'anna'));
    expect(upload.cancel('anna')).toEqual({ ok: false, error: 'already-claimed' });
  });

  it('expires only while pending and past its expiry', () => {
    const upload = unwrap(create());
    const justBefore = new Date(upload.props.expiresAt.getTime() - 1);
    const justAfter = new Date(upload.props.expiresAt.getTime() + 1);
    expect(upload.isExpired(justBefore)).toBe(false);
    expect(upload.isExpired(justAfter)).toBe(true);
    unwrap(upload.claim('m1', 'anna'));
    expect(upload.isExpired(justAfter)).toBe(false);
  });

  it('derives the preview kind from the content type', () => {
    expect(previewKindOf('image/png')).toBe('image');
    expect(previewKindOf('application/pdf')).toBe('pdf');
    expect(previewKindOf('text/plain')).toBe('none');
  });
});

describe('bytesMatchContentType', () => {
  const OFFICE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]);

  it.each([
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ['image/gif', Buffer.from('GIF89a')],
    ['image/webp', Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'latin1')],
    ['application/pdf', Buffer.from('%PDF-1.7')],
    ['application/zip', zip],
    [OFFICE, zip],
    ['application/vnd.oasis.opendocument.text', zip],
    ['text/plain', Buffer.from('Grüße aus dem Büro')],
    ['text/csv', Buffer.from('a,b\n1,2\n')],
    ['text/markdown', Buffer.alloc(0)],
  ])('accepts real %s content', (contentType, bytes) => {
    expect(bytesMatchContentType(contentType, bytes)).toBe(true);
  });

  it.each([
    ['image/png', Buffer.from('MZ\x90\x00', 'latin1')],
    ['image/jpeg', Buffer.from('<html>')],
    ['image/webp', Buffer.from('RIFF\x10\x00\x00\x00WAVEfmt ', 'latin1')],
    ['application/pdf', Buffer.from('<script>alert(1)</script>')],
    ['application/zip', Buffer.from('MZ\x90\x00', 'latin1')],
    [OFFICE, Buffer.from('MZ\x90\x00', 'latin1')],
    ['text/plain', Buffer.from('MZ\x90\x00\x03', 'latin1')],
    ['image/svg+xml', Buffer.from('<svg/>')],
  ])('rejects %s claimed for other content', (contentType, bytes) => {
    expect(bytesMatchContentType(contentType, bytes)).toBe(false);
  });
});
