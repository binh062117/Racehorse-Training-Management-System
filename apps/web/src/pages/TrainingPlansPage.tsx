import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Paginated, TrainingPlan } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { CreateTrainingPlanModal } from '../components/training/CreateTrainingPlanModal';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, Chip, HeroStats, Icon } from '../ds/ui';

export function TrainingPlansPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const role = user?.role;
  const canCreate = role === 'TRAINER';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'create' && canCreate) {
      setCreateOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canCreate]);

  const { data, loading, error: loadErr, reload: loadPlans } = useCachedResource('training-plans', () =>
    api.get<Paginated<TrainingPlan>>('/training-plans', { params: { limit: 100 } }).then((r) => r.data),
  );
  const plans = data?.data ?? [];

  usePageChrome({ crumbs: [t('nav.plans'), t('trainingPage.title')], search: t('trainingPage.search'), onSearch: setSearch });

  const now = new Date();
  const totalCount = plans.length;
  const activeCount = plans.filter((p) => !p.endDate || new Date(p.endDate).getTime() >= now.getTime()).length;
  const completedCount = plans.filter((p) => p.endDate && new Date(p.endDate).getTime() < now.getTime()).length;
  const uniqueHorsesCount = new Set(plans.map((p) => p.horseId)).size;

  const filteredPlans = plans.filter((p) => {
    const isOngoing = !p.endDate || new Date(p.endDate).getTime() >= now.getTime();
    if (statusFilter === 'ACTIVE' && !isOngoing) return false;
    if (statusFilter === 'COMPLETED' && isOngoing) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchHorse = p.horse?.name?.toLowerCase().includes(q);
      const matchGoal = p.goal.toLowerCase().includes(q);
      const matchTrainer = p.trainer?.name?.toLowerCase().includes(q);
      if (!matchHorse && !matchGoal && !matchTrainer) return false;
    }
    return true;
  });

  const subtitle = t(`trainingPage.roleSubtitle.${role ?? 'default'}`);

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-[1_1_360px] min-w-0">
            <div className="lbl">{t('trainingPage.season')}</div>
            <h1 className="disp text-[56px] mt-2">{t('trainingPage.title')}</h1>
            <p className="text-hero-muted mt-2.5 max-w-[520px]">{subtitle}</p>
          </div>
          {canCreate && (
            <Btn v="light" onClick={() => setCreateOpen(true)}><Icon name="plus" />{t('trainingPage.create')}</Btn>
          )}
        </div>
        <HeroStats items={[
          { label: t('trainingPage.total'), value: totalCount },
          { label: t('trainingPage.active'), value: activeCount, color: '#9fd9b1' },
          { label: t('trainingPage.completed'), value: completedCount },
          { label: t('trainingPage.horsesWithPlans'), value: uniqueHorsesCount },
        ]} />
      </section>

      <div className="flex flex-wrap gap-2.5 items-center">
        <Chip on={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>{t('trainingPage.all')} <span className="text-muted">{totalCount}</span></Chip>
        <Chip on={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter('ACTIVE')}>{t('trainingPage.active')} <span className="text-muted">{activeCount}</span></Chip>
        <Chip on={statusFilter === 'COMPLETED'} onClick={() => setStatusFilter('COMPLETED')}>{t('trainingPage.completedFilter')} <span className="text-muted">{completedCount}</span></Chip>
      </div>

      {loading && plans.length === 0 ? (
        <p className="cap">{t('trainingPage.loading')}</p>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : filteredPlans.length === 0 ? (
        <Card className="px-5 py-10 text-center flex flex-col items-center gap-3">
          <Icon name="plans" className="w-7 h-7 text-muted" />
          <p className="cap">{plans.length === 0 ? t('trainingPage.empty') : t('trainingPage.noMatch')}</p>
          {canCreate && plans.length === 0 && (
            <Btn v="p" onClick={() => setCreateOpen(true)}><Icon name="plus" />{t('trainingPage.createFirst')}</Btn>
          )}
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="text-left">
                  {[t('trainingPage.horse'), t('trainingPage.goal'), t('trainingPage.trainer'), t('trainingPage.period'), t('trainingPage.status'), ''].map((heading) => (
                    <th key={heading} className="h-[42px] px-4 bg-cream lbl border-b border-line">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const isOngoing = !plan.endDate || new Date(plan.endDate).getTime() >= now.getTime();
                  return (
                    <tr key={plan.id} className="border-b border-line-soft hover:bg-subtle">
                      <td className="px-4 py-3">
                        <Link to={`/horses/${plan.horseId}`} className="font-semibold text-navy no-underline">{plan.horse?.name ?? '—'}</Link>
                        {plan.horse?.breed && <div className="cap">{plan.horse.breed}</div>}
                      </td>
                      <td className="px-4 py-3 max-w-[360px]">{plan.goal}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{plan.trainer?.name ?? '—'}</div>
                        <div className="cap">{plan.trainer?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px]">{formatDate(plan.startDate)}</div>
                        <div className="cap">{t('trainingPage.until')} {plan.endDate ? formatDate(plan.endDate) : t('trainingPage.longTerm')}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isOngoing ? <Badge tone="ok"><Icon name="check" className="w-3.5 h-3.5" />{t('trainingPage.active')}</Badge> : <Badge tone="neu">{t('trainingPage.completed')}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right"><Btn sm to={`/horses/${plan.horseId}`}>{t('trainingPage.horseProfile')} ›</Btn></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateTrainingPlanModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => void loadPlans()} />
    </>
  );
}
