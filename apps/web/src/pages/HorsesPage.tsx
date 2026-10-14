import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getFileUrl } from '../lib/api';
import { useCachedResource } from '../lib/useCachedResource';
import type { Horse, HealthStatus, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { CreateHorseModal } from '../components/horse/CreateHorseModal';
import { EditHorseModal } from '../components/horse/EditHorseModal';
import { DeleteHorseModal } from '../components/horse/DeleteHorseModal';
import { usePageChrome } from '../ds/AppShell';
import {
  Badge, Btn, Card, Chip, Cloth, HeroStats, Icon, LockBadge, Ring, Seg, Silk,
  careerTone, fitColor, healthTone,
} from '../ds/ui';

type Filter = 'all' | 'locked' | 'injured' | 'mon';
const FILTERS: [Filter, string, (h: Horse) => boolean][] = [
  ['all', 'Tất cả', () => true],
  ['locked', 'Khóa tập', (h) => h.locked],
  ['injured', 'Chấn thương / Cách ly', (h) => h.healthStatus === 'INJURED' || h.healthStatus === 'QUARANTINED'],
  ['mon', 'Cần theo dõi', (h) => h.healthStatus === 'MONITORING'],
];
const HEALTH_DIST: { key: HealthStatus; label: string; color: string }[] = [
  { key: 'FIT', label: 'Khỏe mạnh', color: '#6fae84' },
  { key: 'MONITORING', label: 'Cần theo dõi', color: '#e0b55a' },
  { key: 'QUARANTINED', label: 'Cách ly', color: '#d98080' },
  { key: 'INJURED', label: 'Chấn thương', color: '#b94a4a' },
];

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const years = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return years >= 0 ? years : null;
}

export function HorsesPage({ personal = false }: { personal?: boolean }) {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isOwner = user?.role === 'OWNER';

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  const [deletingHorse, setDeletingHorse] = useState<Horse | null>(null);

  const queryParams = {
    limit: 100,
    ...(personal && isOwner && user?.id ? { ownerId: user.id } : {}),
  };
  const cacheKey = `horses:${JSON.stringify(queryParams)}`;
  const { data, loading, error: loadErr, reload: load } = useCachedResource(cacheKey, () =>
    api.get<Paginated<Horse>>('/horses', { params: queryParams }).then((r) => r.data),
  );
  const all = data?.data ?? [];
  const bySearch = debouncedSearch.trim()
    ? all.filter((h) => h.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase()))
    : all;
  const rows = [...bySearch].filter(FILTERS.find((f) => f[0] === filter)![2])
    .sort((a, b) => (b.fitnessScore ?? -1) - (a.fitnessScore ?? -1));

  const locked = all.filter((h) => h.locked).length;
  const active = all.filter((h) => h.status === 'ACTIVE').length;
  const scored = all.filter((h) => h.fitnessScore != null);
  const avgFit = scored.length ? (scored.reduce((s, h) => s + (h.fitnessScore ?? 0), 0) / scored.length).toFixed(1) : '—';
  const healthCounts = HEALTH_DIST.map((d) => ({ ...d, n: all.filter((h) => h.healthStatus === d.key).length }));

  const title = personal ? 'Ngựa của tôi' : 'Chuồng ngựa';
  usePageChrome({ crumbs: ['Ngựa đua', title], search: 'Tìm theo tên ngựa…', onSearch: setSearch });

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-[1_1_360px] min-w-0">
            <div className="lbl">Mùa giải 2026 · Racehorse Club</div>
            <h1 className="disp text-[64px] mt-2">{title}</h1>
            <p className="text-hero-muted mt-2.5 max-w-[520px]">
              {isManager
                ? 'Toàn bộ ngựa của câu lạc bộ — trạng thái thi đấu, sức khỏe và thể trạng hiện tại.'
                : personal
                  ? 'Ngựa thuộc sở hữu của bạn.'
                  : 'Danh sách ngựa theo phân quyền của bạn.'}
            </p>
          </div>
          {isManager && (
            <div className="flex flex-wrap gap-2">
              <Btn v="light" onClick={() => setCreateOpen(true)}><Icon name="plus" />Thêm ngựa</Btn>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-y-6 items-end">
          <HeroStats items={[
            { label: 'Tổng đàn', value: all.length, small: 'ngựa' },
            { label: 'Đang thi đấu', value: active, small: `/ ${all.length}` },
            { label: 'Fitness TB', value: avgFit },
            { label: 'Khóa tập', value: locked, small: 'ngựa', color: '#f3b4b4' },
          ]} />
          <div className="flex-[1_1_320px] min-w-[260px] pl-6 border-l border-white/10">
            <span className="lbl">Sức khỏe đàn ngựa</span>
            <div className="flex gap-0.5 h-2.5 rounded overflow-hidden mt-2" role="img" aria-label={healthCounts.map((d) => `${d.label} ${d.n}`).join(', ')}>
              {healthCounts.map((d) => (
                <i key={d.key} className="block" style={{ width: all.length ? `${(d.n / all.length) * 100}%` : 0, background: d.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 mt-2 text-[11.5px] text-hero-line">
              {healthCounts.map((d) => (
                <span key={d.key} className="flex gap-1.5 items-center"><i className="w-2 h-2 rounded-sm" style={{ background: d.color }} />{d.label} <b className="text-white">{d.n}</b></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2.5 items-center">
        {FILTERS.map(([k, l, fn]) => (
          <Chip key={k} on={filter === k} onClick={() => setFilter(k)}>{l} <span className={filter === k ? 'text-hero-line' : 'text-muted'}>{bySearch.filter(fn).length}</span></Chip>
        ))}
        <div className="ml-auto flex gap-2.5 items-center">
          <span className="cap">Sắp xếp: Fitness ↓</span>
          <Seg options={[['cards', 'Thẻ'], ['table', 'Bảng']]} value={view} onChange={(v) => setView(v as 'cards' | 'table')} />
        </div>
      </div>

      <ErrorText err={loadErr} />

      {loading && rows.length === 0 ? (
        <p className="cap">Đang tải danh sách ngựa…</p>
      ) : rows.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="cap">Không tìm thấy hồ sơ ngựa nào phù hợp với bộ lọc hiện tại.</p>
        </Card>
      ) : view === 'cards' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))' }}>
          {rows.map((h, i) => <HorseCard key={h.id} h={h} no={i + 1} canManage={isManager} onEdit={() => setEditingHorse(h)} onDelete={() => setDeletingHorse(h)} />)}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="text-left">
                  {['Ngựa', 'Chủ sở hữu', 'Giống', 'Fitness', 'Trạng thái', 'Sức khỏe', 'Khóa tập', ...(isManager ? ['Thao tác'] : [])].map((t) => (
                    <th key={t} className="h-[42px] px-4 bg-cream lbl border-b border-line">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((h, i) => {
                  const age = calculateAge(h.birthDate);
                  return (
                    <tr key={h.id} className={`border-b border-line-soft hover:bg-subtle ${h.locked ? 'bg-[#fdfbfb]' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Cloth n={i + 1} /><Silk owner={h.owner.id} />
                          <div>
                            <Link to={`/horses/${h.id}`} className="font-semibold text-ink no-underline">{h.name}</Link>
                            <div className="cap num">{h.gender === 'MALE' ? 'Đực' : h.gender === 'FEMALE' ? 'Cái' : '—'} · {age != null ? `${age} tuổi` : '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{h.owner.name}</td>
                      <td className="px-4 py-3">{h.breed ?? '—'}</td>
                      <td className="px-4 py-3"><b className="num" style={{ color: fitColor(h.fitnessScore) }}>{h.fitnessScore ?? '—'}</b></td>
                      <td className="px-4 py-3"><Badge tone={careerTone[h.status]}>{h.status}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={healthTone[h.healthStatus]}>{h.healthStatus}</Badge></td>
                      <td className="px-4 py-3">{h.locked ? <LockBadge>{h.lockReason ?? 'Đã khóa'}</LockBadge> : <span className="cap">—</span>}</td>
                      {isManager && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Btn sm onClick={() => setEditingHorse(h)}><Icon name="edit" className="w-3.5 h-3.5" />Sửa</Btn>
                            <Btn sm v="d" onClick={() => setDeletingHorse(h)}><Icon name="trash" className="w-3.5 h-3.5" />Xóa</Btn>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className="flex items-center gap-3"><span className="cap">Hiển thị {rows.length} / {all.length} ngựa</span></div>

      <CreateHorseModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
      <EditHorseModal horse={editingHorse} isOpen={editingHorse !== null} onClose={() => setEditingHorse(null)} onUpdated={load} />
      <DeleteHorseModal horse={deletingHorse} isOpen={deletingHorse !== null} onClose={() => setDeletingHorse(null)} onDeleted={load} />
    </>
  );
}

function HorseCard({ h, no, canManage, onEdit, onDelete }: { h: Horse; no: number; canManage: boolean; onEdit: () => void; onDelete: () => void }) {
  const age = calculateAge(h.birthDate);
  const photo = getFileUrl(h.photoUrl);
  return (
    <div className={`relative flex flex-col rounded-xl border border-line overflow-hidden text-ink transition hover:border-line-strong hover:shadow-lift ${h.locked ? 'hatch' : 'bg-white'}`}>
      {h.locked && <span className="lockband" aria-hidden="true">Khóa</span>}
      <Link to={`/horses/${h.id}`} aria-label={`Hồ sơ ${h.name}`} className="flex gap-3 items-start p-4 pb-3 no-underline text-ink">
        {photo ? (
          <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover flex-none border border-line" />
        ) : (
          <Cloth n={no} />
        )}
        <Silk owner={h.owner.id} size={34} />
        <div className="flex-1 min-w-0"><div className="disp text-2xl leading-6 truncate">{h.name}</div><div className="cap num mt-1">{h.breed ?? 'Chưa rõ giống'} · {age != null ? `${age} tuổi` : 'Chưa rõ tuổi'}</div></div>
      </Link>
      <div className="flex items-center gap-3.5 px-4 pb-3.5">
        <Ring value={h.fitnessScore ?? 0} color={fitColor(h.fitnessScore)} text={h.fitnessScore ?? '—'} label={`Fitness ${h.fitnessScore ?? 'chưa đánh giá'}`} />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline"><span className="lbl">Thể trạng</span></div>
          <span className="cap">{h.fitnessScore != null ? `${h.fitnessScore} / 100` : 'Chưa đánh giá'}</span>
          <div className="flex items-center gap-2"><span className="lbl">Giới tính</span><span className="cap">{h.gender === 'MALE' ? 'Đực' : h.gender === 'FEMALE' ? 'Cái' : 'Chưa rõ'}</span></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3.5">
        <Badge tone={careerTone[h.status]}>{h.status}</Badge>
        <Badge tone={healthTone[h.healthStatus]}>{h.healthStatus}</Badge>
        {h.locked && <LockBadge>{h.lockReason ?? 'Đã khóa'}</LockBadge>}
      </div>
      <div className="mt-auto flex items-center gap-2 px-4 py-2.5 border-t border-line-soft bg-subtle">
        <span className="cap flex-1 min-w-0 truncate">Chủ sở hữu <b className="text-ink">{h.owner.name}</b></span>
        {canManage && (
          <div className="flex gap-1">
            <button type="button" aria-label="Sửa" onClick={onEdit} className="w-7 h-7 rounded-btn inline-flex items-center justify-center text-muted hover:bg-white hover:text-ink"><Icon name="edit" className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label="Xóa" onClick={onDelete} className="w-7 h-7 rounded-btn inline-flex items-center justify-center text-muted hover:bg-white hover:text-bad"><Icon name="trash" className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
