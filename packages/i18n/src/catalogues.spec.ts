import { describe, expect, it } from 'vitest';
import { resources, SUPPORTED_LANGUAGES } from './index.ts';

const keysOf = (messages: object, prefix = ''): string[] =>
  Object.entries(messages as Record<string, unknown>).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );

describe('message catalogues', () => {
  const englishKeys = keysOf(resources.en.translation).sort();

  it.each(SUPPORTED_LANGUAGES)('"%s" has exactly the keys of the English base catalogue', (language) => {
    expect(keysOf(resources[language].translation).sort()).toEqual(englishKeys);
  });

  it.each(SUPPORTED_LANGUAGES)('"%s" has no empty messages', (language) => {
    const values = JSON.stringify(resources[language].translation);
    expect(values).not.toMatch(/:""/);
  });
});
