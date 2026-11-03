import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './vi.json';
import en from './en.json';

const STORAGE_KEY = 'racehorse.lang';

function initialLang(): 'vi' | 'en' {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return 'vi';
}

function syncLanguage(lang: string): void {
  const language = lang.startsWith('en') ? 'en' : 'vi';
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* storage unavailable */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

i18n.on('languageChanged', syncLanguage);

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: 'vi' | 'en'): void {
  void i18n.changeLanguage(lang);
}

export function getLocale(): 'vi-VN' | 'en-GB' {
  return i18n.resolvedLanguage?.startsWith('en') ? 'en-GB' : 'vi-VN';
}

export default i18n;
