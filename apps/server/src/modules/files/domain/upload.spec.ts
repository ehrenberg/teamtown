import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, Upload, previewKindOf } from './upload.ts';

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
