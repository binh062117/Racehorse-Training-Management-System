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
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function updateDocumentLanguage() {
  document.documentElement.lang = i18n.language === 'vi' ? 'vi' : 'en';
  document.title = i18n.t('app.title');
}
i18n.on('languageChanged', updateDocumentLanguage);
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
