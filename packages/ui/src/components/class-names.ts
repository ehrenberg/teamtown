/** Joins conditional class names, skipping falsy values. */
export const classNames = (...names: readonly (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(' ');
