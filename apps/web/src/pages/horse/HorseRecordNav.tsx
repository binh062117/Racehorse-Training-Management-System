import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function HorseRecordNav({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
  const links = [
    { to: `/horses/${horseId}`, label: t('horseFlow.overview'), end: true },
    { to: `/horses/${horseId}/performance`, label: t('horseFlow.performance') },
    { to: `/horses/${horseId}/ownership`, label: t('horseFlow.ownership') },
  ];

  return (
    <nav className="horse-record-nav" aria-label={t('horseFlow.recordSections')}>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
