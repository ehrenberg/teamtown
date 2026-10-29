import { DEFAULT_NAMESPACE, FALLBACK_LANGUAGE, isSupportedLanguage, resources } from '@teamtown/i18n';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

const browserLanguage = navigator.language.slice(0, 2);

export const i18n = i18next.createInstance();

await i18n.use(initReactI18next).init({
  resources,
  lng: isSupportedLanguage(browserLanguage) ? browserLanguage : FALLBACK_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  defaultNS: DEFAULT_NAMESPACE,
  interpolation: { escapeValue: false }, // React already escapes rendered values.
});

document.documentElement.lang = i18n.language;
