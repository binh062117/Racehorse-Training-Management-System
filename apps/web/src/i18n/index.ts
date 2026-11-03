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

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
  },
  lng: initialLang(),
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  const norm: 'vi' | 'en' = lng && lng.toLowerCase().startsWith('en') ? 'en' : 'vi';
  try {
    localStorage.setItem(STORAGE_KEY, norm);
  } catch {
    /* ignore */
  }
  updateDocumentLanguage();
});

export function getLanguage(): 'vi' | 'en' {
  const current = i18n.resolvedLanguage || i18n.language || initialLang();
  return current.toLowerCase().startsWith('en') ? 'en' : 'vi';
}

function updateDocumentLanguage() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = getLanguage();
  document.title = i18n.t('app.title');
}

updateDocumentLanguage();

export function setLanguage(lang: 'vi' | 'en'): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  void i18n.changeLanguage(lang);
}

export default i18n;
