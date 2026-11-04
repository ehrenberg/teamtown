import { describe, expect, it } from 'vitest';
import { contentTypeOf, extensionOf, formatBytes, sortFiles } from './attachments.ts';

const MB = 1024 * 1024;
const file = (name: string, size = 10) => ({ name, size });

describe('contentTypeOf', () => {
  it('knows the allowed types, whatever the case of the extension', () => {
    expect(contentTypeOf('Plan.PDF')).toBe('application/pdf');
    expect(contentTypeOf('notes.md')).toBe('text/markdown');
    expect(contentTypeOf('foto.final.jpeg')).toBe('image/jpeg');
  });

  it.each(['setup.exe', 'run.sh', 'page.html', 'logo.svg', 'tool.js', 'README', '.png'])('refuses %s', (name) => {
    expect(contentTypeOf(name)).toBeNull();
  });
});

describe('extensionOf', () => {
  it('takes the last part and ignores a leading dot', () => {
    expect(extensionOf('archive.tar.zip')).toBe('zip');
    expect(extensionOf('.env')).toBe('');
  });
});

describe('sortFiles', () => {
  it('accepts a file of exactly 100 MB and refuses a bigger one (P-19)', () => {
    const fits = file('a.png', 100 * MB);
    const tooBig = file('b.png', 150 * MB);

    expect(sortFiles([fits, tooBig], 0)).toEqual({
      accepted: [fits],
      refused: [{ file: tooBig, code: 'file-too-large' }],
    });
  });

  it('refuses a disallowed type before anything else (P-20)', () => {
    const virus = file('setup.exe', 150 * MB);

    expect(sortFiles([virus], 0).refused).toEqual([{ file: virus, code: 'unsupported-file-type' }]);
  });

  it('refuses the 11th attachment, counting those already attached (P-23)', () => {
    const files = Array.from({ length: 3 }, (_, index) => file(`${String(index)}.txt`));

    const sorted = sortFiles(files, 8);

    expect(sorted.accepted).toEqual(files.slice(0, 2));
    expect(sorted.refused).toEqual([{ file: files[2], code: 'too-many-attachments' }]);
  });
});

describe('formatBytes', () => {
  it("picks a readable unit in the reader's number format", () => {
    expect(formatBytes(512, 'en')).toBe('512 byte');
    expect(formatBytes(2.5 * 1024, 'en')).toBe('2.5 kB');
    expect(formatBytes(2.5 * MB, 'de')).toBe('2,5 MB');
  });
});
