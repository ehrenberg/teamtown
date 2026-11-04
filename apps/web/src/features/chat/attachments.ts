import { MAX_ATTACHMENTS_PER_MESSAGE, MAX_UPLOAD_BYTES } from '@teamtown/contracts';

/**
 * What the composer accepts by extension (P-20). Browsers often leave `File.type` empty or vague (`.md`, or `.csv`
 * on Windows), so the upload declares the type from here; the server checks the bytes against it.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  zip: 'application/zip',
};

/** For the file picker's `accept`. */
export const ACCEPTED_EXTENSIONS = Object.keys(CONTENT_TYPES)
  .map((extension) => `.${extension}`)
  .join(',');

/** The lower-case extension without its dot; empty if the name has none. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** The content type to declare for a file name, or `null` if that kind of file isn't allowed. */
export const contentTypeOf = (fileName: string): string | null => CONTENT_TYPES[extensionOf(fileName)] ?? null;

/** A refusal uses the same codes as the server, so both read the same in the UI. */
export type FileRefusal = 'file-too-large' | 'unsupported-file-type' | 'too-many-attachments';

export interface SortedFiles<F> {
  readonly accepted: readonly F[];
  readonly refused: readonly { readonly file: F; readonly code: FileRefusal }[];
}

/** Checks picked files before anything is uploaded (P-19, P-20, P-23), given how many are attached already. */
export function sortFiles<F extends { readonly name: string; readonly size: number }>(
  files: readonly F[],
  attached: number,
): SortedFiles<F> {
  const accepted: F[] = [];
  const refused: { file: F; code: FileRefusal }[] = [];
  for (const file of files) {
    if (contentTypeOf(file.name) === null) refused.push({ file, code: 'unsupported-file-type' });
    else if (file.size > MAX_UPLOAD_BYTES) refused.push({ file, code: 'file-too-large' });
    else if (attached + accepted.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      refused.push({ file, code: 'too-many-attachments' });
    } else accepted.push(file);
  }
  return { accepted, refused };
}

/** `2.4 MB`, in the reader's number format. */
export function formatBytes(bytes: number, locale: string): string {
  const [value, unit] =
    bytes < 1024
      ? [bytes, 'byte']
      : bytes < 1024 * 1024
        ? [bytes / 1024, 'kilobyte']
        : [bytes / (1024 * 1024), 'megabyte'];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }).format(
    value,
  );
}
