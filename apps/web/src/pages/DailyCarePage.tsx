import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/useAuth';
import type { DailyCareLog, DailyCareTask, Horse, Paginated } from '../lib/types';
import { usePageChrome } from '../ds/AppShell';
import { Badge, Btn, Card, HeroStats, Icon } from '../ds/ui';
import { formatDateTime } from '../lib/format';
import { ErrorText } from '../components/ErrorText';

const TASK_META: Record<
  DailyCareTask,
  { label: string; desc: string; icon: string; color: string }
> = {
  FEEDING: {
    label: 'Cho ăn & Dinh dưỡng',
    desc: 'Cung cấp khẩu phần cỏ, cám và khoáng chất theo chỉ định',
    icon: 'sparkle',
    color: '#8a6218',
  },
  CLEANING: {
    label: 'Vệ sinh chuồng',
    desc: 'Dọn dẹp chuồng trại, thay rơm lót và khử trùng máng ăn',
    icon: 'file',
    color: '#3a6b4a',
  },
  BATHING: {
    label: 'Tắm rửa & Chải lông',
    desc: 'Vệ sinh thân thể, chải bờm, làm sạch móng sau vận động',
    icon: 'user',
    color: '#2a5a8a',
  },
  ICE_SOAK: {
    label: 'Ngâm chân nước đá',
    desc: 'Liệu pháp giảm viêm gân và phục hồi khớp cơ sau bài tập nặng',
    icon: 'live',
    color: '#4a6f9c',
  },
  HEALTH_CHECK: {
    label: 'Kiểm tra thể trạng',
    desc: 'Đo thân nhiệt sơ bộ, kiểm tra niêm mạc mắt và dáng đi',
    icon: 'steth',
    color: '#8a2020',
  },
};

export function DailyCarePage() {
  const { user } = useAuth();
  usePageChrome({ crumbs: ['Vận hành', 'Chăm sóc chuồng trại'] });

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tasks, setTasks] = useState<DailyCareLog[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseId, setHorseId] = useState('');
  const [taskType, setTaskType] = useState<DailyCareTask | ''>('');
  const [completedFilter, setCompletedFilter] = useState<'ALL' | 'DONE' | 'PENDING'>('ALL');

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  // Load horses list for filter
  useEffect(() => {
    api
      .get<Paginated<Horse>>('/horses', { params: { limit: 100 } })
      .then((res) => setHorses(res.data.data))
      .catch(() => {});
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, unknown> = {
        date,
        limit: 100,
      };
      if (horseId) params.horseId = horseId;
      if (taskType) params.taskType = taskType;
      if (completedFilter === 'DONE') params.completed = true;
      if (completedFilter === 'PENDING') params.completed = false;

      const res = await api.get<Paginated<DailyCareLog>>('/daily-care', { params });
      setTasks(res.data.data);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [date, horseId, taskType, completedFilter]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleGenerate = async () => {
    setGenerating(true);
    setErr(null);
    try {
      await api.post('/daily-care/generate', {
        date,
        ...(horseId ? { horseId } : {}),
      });
      await loadTasks();
    } catch (e) {
      setErr(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async (taskId: string) => {
    try {
      await api.patch(`/daily-care/${taskId}/toggle`);
      // Update locally for instantaneous feel
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: !t.completed,
                completedAt: !t.completed ? new Date().toISOString() : null,
                groom: user
                  ? { id: user.id, name: user.name, email: user.email }
                  : t.groom,
              }
            : t,
        ),
      );
    } catch (e) {
      setErr(e);
      void loadTasks();
    }
  };

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;
  const pending = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group tasks by horse
  const grouped = tasks.reduce<Record<string, DailyCareLog[]>>((acc, t) => {
    const key = t.horseId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const canEdit = user?.role === 'GROOM' || user?.role === 'MANAGER' || user?.role === 'TRAINER';

  return (
    <>
      <section className="hero px-8 py-7 flex flex-col gap-6">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="lbl">Quy trình vận hành &amp; Chuồng trại</div>
            <h1 className="disp text-[48px] mt-2">Chăm sóc chuồng trại</h1>
            <p className="cap mt-1">
              Checklist công việc hàng ngày cho đội ngũ chăm sóc (Groom / Stable Hand): cho ăn, vệ sinh, ngâm chân đá và theo dõi thể trạng.
            </p>
          </div>
          {canEdit && (
            <Btn
              v="light"
              disabled={generating}
              onClick={handleGenerate}
              className="mt-2"
            >
              <Icon name="sparkle" />
              {generating ? 'Đang khởi tạo...' : 'Khởi tạo Checklist ngày này'}
            </Btn>
          )}
        </div>

        <HeroStats
          items={[
            { label: 'Tổng công việc', value: total },
            { label: 'Đã hoàn thành', value: done, color: '#9fd9b1' },
            { label: 'Chưa thực hiện', value: pending, color: pending > 0 ? '#f3d29a' : undefined },
            { label: 'Tiến độ hoàn tất', value: `${pct}%`, color: pct === 100 ? '#9fd9b1' : undefined },
          ]}
        />
      </section>

      {/* Filter toolbar */}
      <section className="px-8 py-4">
        <Card>
          <div className="px-5 py-4 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1 min-w-[150px]">
              <label className="lbl">Ngày thực hiện</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info"
              />
            </div>

            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="lbl">Chọn chiến mã</label>
              <select
                value={horseId}
                onChange={(e) => setHorseId(e.target.value)}
                className="h-10 rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info"
              >
                <option value="">Tất cả ngựa</option>
                {horses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.saddleNumber ? `(#${h.saddleNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="lbl">Loại công việc</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as DailyCareTask | '')}
                className="h-10 rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info"
              >
                <option value="">Tất cả nhiệm vụ</option>
                {Object.entries(TASK_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[160px]">
              <label className="lbl">Trạng thái</label>
              <select
                value={completedFilter}
                onChange={(e) =>
                  setCompletedFilter(e.target.value as 'ALL' | 'DONE' | 'PENDING')
                }
                className="h-10 rounded-btn border border-line bg-white px-3 text-[13px] outline-none focus:border-info"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="DONE">Đã hoàn thành</option>
                <option value="PENDING">Chưa thực hiện</option>
              </select>
            </div>

            <Btn v="s" onClick={() => void loadTasks()} className="h-10">
              <Icon name="search" />
              Làm mới
            </Btn>
          </div>
        </Card>
      </section>

      {/* Task List grouped by Horse */}
      <section className="px-8 pb-10">
        {err ? (
          <div className="mb-4">
            <ErrorText err={err} />
          </div>
        ) : null}

        {loading ? (
          <p className="cap py-10 text-center">Đang tải danh sách chăm sóc...</p>
        ) : total === 0 ? (
          <Card className="py-14 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-cream text-navy flex items-center justify-center mx-auto mb-3">
              <Icon name="check" className="w-6 h-6" />
            </div>
            <h3 className="text-[17px] font-semibold mb-1">
              Chưa có checklist chăm sóc cho ngày {date}
            </h3>
            <p className="cap max-w-md mx-auto mb-5">
              Nhấn nút bên dưới để tự động tạo 5 nhiệm vụ tiêu chuẩn (Cho ăn, Vệ sinh, Tắm rửa, Ngâm chân, Thể trạng) cho toàn bộ đàn ngựa.
            </p>
            {canEdit && (
              <Btn v="p" disabled={generating} onClick={handleGenerate}>
                <Icon name="sparkle" />
                {generating ? 'Đang tạo...' : 'Khởi tạo Checklist ngay'}
              </Btn>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([hId, horseTasks]) => {
              const horseName = horseTasks[0]?.horse?.name ?? 'Ngựa đua';
              const horseDone = horseTasks.filter((t) => t.completed).length;
              const horseTotal = horseTasks.length;
              const isHorseAllDone = horseDone === horseTotal;

              return (
                <Card key={hId} className="overflow-hidden">
                  <div className="px-5 py-3.5 bg-subtle/60 border-b border-line flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center font-bold text-xs">
                        {horseName.slice(0, 2).toUpperCase()}
                      </span>
                      <h2 className="font-semibold text-[16px] text-ink">
                        {horseName}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] cap num">
                        {horseDone} / {horseTotal} hoàn tất
                      </span>
                      <Badge tone={isHorseAllDone ? 'ok' : 'warn'}>
                        {isHorseAllDone ? 'Hoàn tất' : 'Đang xử lý'}
                      </Badge>
                    </div>
                  </div>

                  <div className="divide-y divide-line-soft">
                    {horseTasks.map((t) => {
                      const meta = TASK_META[t.taskType] ?? {
                        label: t.taskType,
                        desc: '',
                        icon: 'check',
                        color: '#666',
                      };

                      return (
                        <div
                          key={t.id}
                          className={`p-4 flex items-center gap-4 transition-colors ${
                            t.completed ? 'bg-white hover:bg-subtle/50' : 'bg-white hover:bg-amber-50/20'
                          }`}
                        >
                          {/* Interactive Toggle Checkbox */}
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => void handleToggle(t.id)}
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-none transition-all ${
                              t.completed
                                ? 'bg-ok border-ok text-white shadow-sm'
                                : 'border-line hover:border-info bg-white'
                            }`}
                            title={t.completed ? 'Bấm để đánh dấu chưa hoàn thành' : 'Bấm để đánh dấu hoàn thành'}
                          >
                            {t.completed && <Icon name="check" className="w-4 h-4 stroke-[2.5]" />}
                          </button>

                          {/* Task details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[14px] font-semibold ${
                                  t.completed ? 'text-ink line-through opacity-70' : 'text-ink'
                                }`}
                              >
                                {meta.label}
                              </span>
                              <span className="cap text-[11px] text-muted">
                                {meta.desc}
                              </span>
                            </div>
                            {t.notes && (
                              <p className="text-[12px] text-muted italic mt-0.5">
                                Ghi chú: {t.notes}
                              </p>
                            )}
                          </div>

                          {/* Completion metadata */}
                          <div className="text-right flex-none">
                            {t.completed ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ok">
                                  <Icon name="check" className="w-3.5 h-3.5" />
                                  Đã xong
                                </span>
                                {t.completedAt && (
                                  <span className="block cap num text-[11px] text-muted">
                                    {formatDateTime(t.completedAt)}
                                  </span>
                                )}
                                {t.groom && (
                                  <span className="block text-[11px] text-muted">
                                    bởi {t.groom.name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="cap text-muted text-[12px]">
                                Chưa thực hiện
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
