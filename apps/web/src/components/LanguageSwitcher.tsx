import { useTranslation } from 'react-i18next';
import { setLanguage } from '../i18n';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi';
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
      aria-label={t('language.switchTo', { language: language === 'vi' ? 'English' : 'Tiếng Việt' })}
      title={t('language.switchTo', { language: language === 'vi' ? 'English' : 'Tiếng Việt' })}
      className={`h-8 flex-none px-2 rounded-btn text-[12px] font-medium ${className}`}
    >
      <span lang="vi" className={language === 'vi' ? 'font-bold underline underline-offset-4' : 'opacity-60'}>VI</span>
      <span aria-hidden="true" className="mx-1 opacity-50">/</span>
      <span lang="en" className={language === 'en' ? 'font-bold underline underline-offset-4' : 'opacity-60'}>EN</span>
    </button>
  );
}
