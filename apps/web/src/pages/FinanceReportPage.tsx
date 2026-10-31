import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { api } from '../lib/api';
import { fetchAll } from '../lib/pagination';
import { useCachedResource } from '../lib/useCachedResource';
import type { FinanceReportResult, Horse } from '../lib/types';
import { formatDate } from '../lib/format';
import { ErrorText } from '../components/ErrorText';
import { usePageChrome } from '../ds/AppShell';
import {
  Btn,
  Card,
  EmptyState,
  Field,
  Input,
  KpiStrip,
  NativeSelect,
  PageHeader,
  Pagination,
  thCls,
} from '../ds/ui';

const categories = [
  'FEEDING',
  'FARRIER',
  'VACCINATION',
  'DEWORMING',
  'MEDICAL',
  'BOARDING',
] as const;
const money = (n: number) => `${n.toLocaleString('vi-VN')} \u20ab`;
export function FinanceReportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [horseId, setHorseId] = useState('');
  const [page, setPage] = useState(1);
  const params = {
    ...(from ? { from: `${from}T00:00:00+07:00` } : {}),
    ...(to ? { to: `${to}T23:59:59.999+07:00` } : {}),
    ...(horseId ? { horseId } : {}),
  };
  const { data, loading, error, reload } = useCachedResource(
    `finances:${user?.id}:${JSON.stringify(params)}`,
    () =>
      api
        .get<FinanceReportResult>('/reports/finances', { params })
        .then((r) => r.data),
  );
  const { data: horses } = useCachedResource(`finance-horses:${user?.id}`, () =>
    fetchAll<Horse>('/horses'),
  );
  usePageChrome({ crumbs: [t('raceFeatures.finances')] });
  return (
    <>
      <PageHeader
        title={t('raceFeatures.finances')}
        sub={t('raceFeatures.financeHint')}
      />
      <div className="flex flex-wrap gap-3">
        <Field label={t('healthSchedule.horse')}>
          <NativeSelect
            value={horseId}
            onChange={(e) => {
              setHorseId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('healthSchedule.all')}</option>
            {horses?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('raceFeatures.from')}>
          <Input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label={t('raceFeatures.to')}>
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
      </div>
      {user?.role === 'MANAGER' && (
        <ExpenseForm horses={horses ?? []} onSaved={reload} />
      )}
      <ErrorText err={error} />
      {loading ? (
        <p>{t('races.loading')}</p>
      ) : (
        data && (
          <>
            <KpiStrip
              items={[
                {
                  label: t('raceFeatures.prize'),
                  value: money(data.summary.totalPrizeMoney),
                },
                {
                  label: t('raceFeatures.cost'),
                  value: money(data.summary.totalCost),
                },
                {
                  label: t('raceFeatures.balance'),
                  value: money(data.summary.netBalance),
                },
              ]}
            />
            <Card className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['horse', 'prize', 'cost', 'balance'].map((k) => (
                      <th key={k} className={thCls}>
                        {t(
                          k === 'horse'
                            ? 'healthSchedule.horse'
                            : `raceFeatures.${k}`,
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.horses.map((h) => (
                    <tr key={h.horseId} className="border-b border-line-soft">
                      <td className="p-4">
                        <Link to={`/horses/${h.horseId}`}>{h.horseName}</Link>
                      </td>
                      <td className="p-4 num">{money(h.prizeMoney)}</td>
                      <td className="p-4 num">{money(h.totalCost)}</td>
                      <td className="p-4 num">{money(h.netBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            {!data.transactions.length ? (
              <EmptyState>{t('raceFeatures.noTransactions')}</EmptyState>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {[
                        'raceFeatures.transactionDate',
                        'healthSchedule.horse',
                        'raceFeatures.description',
                        'raceFeatures.amount',
                      ].map((k) => (
                        <th key={k} className={thCls}>
                          {t(k)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions
                      .slice((page - 1) * 20, page * 20)
                      .map((row) => (
                        <tr key={row.id} className="border-b border-line-soft">
                          <td className="p-4">{formatDate(row.date)}</td>
                          <td className="p-4">{row.horseName}</td>
                          <td className="p-4">{row.description}</td>
                          <td className="p-4 num">
                            {row.type === 'INCOME' ? '+' : '\u2212'}
                            {money(row.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <Pagination
                  page={page}
                  total={data.transactions.length}
                  limit={20}
                  onChange={setPage}
                  className="p-4"
                />
              </Card>
            )}
          </>
        )
      )}
    </>
  );
}
function ExpenseForm({
  horses,
  onSaved,
}: {
  horses: Horse[];
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setErr(null);
    try {
      await api.post('/reports/expenses', {
        horseId: values.get('horseId'),
        category: values.get('category'),
        description: values.get('description'),
        amount: Number(values.get('amount')),
        date: `${values.get('date')}T00:00:00+07:00`,
      });
      form.reset();
      await onSaved();
    } catch (reason) {
      setErr(reason);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-3">{t('raceFeatures.addExpense')}</h2>
      <form onSubmit={save} className="flex flex-wrap gap-3 items-end">
        <Field label={t('healthSchedule.horse')}>
          <NativeSelect name="horseId" required>
            <option value="">{t('healthSchedule.selectHorse')}</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('raceFeatures.expenseCategory')}>
          <NativeSelect name="category">
            {categories.map((k) => (
              <option key={k} value={k}>
                {t(`raceFeatures.category.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('raceFeatures.transactionDate')}>
          <Input name="date" type="date" required />
        </Field>
        <Field label={t('raceFeatures.description')}>
          <Input name="description" required maxLength={2000} />
        </Field>
        <Field label={t('raceFeatures.amount')}>
          <Input name="amount" type="number" min="0.01" step="0.01" required />
        </Field>
        <Btn v="p" type="submit" disabled={busy}>
          {t('common.save')}
        </Btn>
      </form>
      <ErrorText err={err} />
    </Card>
  );
}
