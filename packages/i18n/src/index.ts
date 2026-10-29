import de from './locales/de.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: Language = 'en';
export const DEFAULT_NAMESPACE = 'translation';

/** Resources in the shape i18next expects: `{ [language]: { [namespace]: messages } }`. */
export const resources = {
  en: { [DEFAULT_NAMESPACE]: en },
  de: { [DEFAULT_NAMESPACE]: de },
} as const;

export type Messages = typeof en;

export const isSupportedLanguage = (value: string): value is Language =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
