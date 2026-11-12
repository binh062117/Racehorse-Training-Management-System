/**
 * Kiểm thử kịch bản demo (docs/DEMO_SCRIPT.md) qua API — chạy TRƯỚC buổi demo.
 * In PASS/FAIL cho từng bước của 3 luồng + chuồng trại.
 *
 *   node apps/api/scripts/demo-rehearsal.mjs                       # API local (mặc định)
 *   API=https://<host>/api/v1 node apps/api/scripts/demo-rehearsal.mjs
 *
 * Script tạo một ngựa thử "Rehearsal …", chạy hết các bước rồi xóa (xóa mềm) ngựa đó.
 * Sự cố, hồ sơ khám, thông báo của ngựa thử vẫn còn trong DB — nên chạy trên DB local,
 * chỉ chạy trên production khi chấp nhận để lại dữ liệu đó.
 * Cần các tài khoản demo của prisma/seed.ts.
 */
const API = process.env.API ?? 'http://localhost:3000/api/v1';
const results = [];
const step = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

async function call(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data, msg: data?.error?.message };
}
async function login(email, password) {
  const r = await call(null, 'POST', '/auth/login', { email, password });
  if (r.status >= 300) throw new Error(`login ${email}: ${r.status} ${r.msg}`);
  return r.data.accessToken;
}

const T = {
  manager: await login('manager@racehorse.local', 'Manager123!'),
  trainer: await login('trainer@racehorse.local', 'Trainer123!'),
  vet: await login('vet@racehorse.local', 'Vet123!'),
  groom: await login('groom@racehorse.local', 'Groom123!'),
  owner1: await login('owner1@racehorse.local', 'Owner123!'),
  owner2: await login('owner2@racehorse.local', 'Owner123!'),
};
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// Setup: a fresh horse for owner1 so the run doesn't disturb other data.
const users = (await call(T.manager, 'GET', '/users?limit=100')).data;
const list = Array.isArray(users) ? users : users.data;
const owner1 = list.find((u) => u.email === 'owner1@racehorse.local');
const horse = (await call(T.manager, 'POST', '/horses', { name: `Rehearsal ${now % 100000}`, ownerId: owner1.id, breed: 'Thoroughbred' })).data;
step('setup: tạo ngựa thử', !!horse?.id, horse?.name);

// Flow 1 — plan, session, 60-minute conflict
const plan = await call(T.trainer, 'POST', `/horses/${horse.id}/training-plans`, { goal: 'Kiểm thử demo', startDate: iso(now), endDate: iso(now + 7 * 864e5), targetDistanceM: 1600 });
step('HLV lập giáo án có cự ly mục tiêu', plan.status === 201, `${plan.status} ${plan.msg ?? ''}`);
const s1 = await call(T.trainer, 'POST', `/horses/${horse.id}/sessions`, { scheduledAt: iso(now + 3 * 36e5), type: 'Chạy bền', planId: plan.data?.id, distanceM: 1200 });
step('HLV xếp buổi tập', s1.status === 201, `${s1.status} ${s1.msg ?? ''}`);
const s2 = await call(T.trainer, 'POST', `/horses/${horse.id}/sessions`, { scheduledAt: iso(now + 3.5 * 36e5), type: 'Chạy nhanh', planId: plan.data?.id });
step('EX-01: buổi thứ 2 cách 30 phút bị chặn', s2.status === 409, `${s2.status} ${s2.msg ?? ''}`);
const groomRes = await call(T.groom, 'PATCH', `/sessions/${s1.data?.id}`, { status: 'DONE', finishTimeSec: 80 });
step('Groom không được ghi kết quả', groomRes.status === 403, `${groomRes.status}`);
const early = await call(T.trainer, 'PATCH', `/sessions/${s1.data?.id}`, { status: 'DONE', finishTimeSec: 80 });
step('Không ghi kết quả trước giờ tập', early.status >= 400, `${early.status} ${early.msg ?? ''}`);

// Flow 2 — injury
const inc = await call(T.groom, 'POST', `/horses/${horse.id}/incidents`, { description: 'Đi khập khiễng chân trước trái sau buổi tập', severity: 'HIGH' });
step('Groom báo sự cố HIGH', inc.status === 201, `${inc.status} ${inc.msg ?? ''}`);
const h1 = (await call(T.manager, 'GET', `/horses/${horse.id}`)).data;
step('Ngựa tự bị khóa + chuyển INJURED', h1.locked === true && h1.healthStatus === 'INJURED', `locked=${h1.locked} health=${h1.healthStatus}`);
const vn = (await call(T.vet, 'GET', '/notifications?limit=10')).data;
const vnList = Array.isArray(vn) ? vn : vn.data;
step('Bác sĩ nhận thông báo sự cố', vnList.some((n) => n.type === 'INCIDENT_REPORTED' && n.message.includes(horse.name)));
const s3 = await call(T.trainer, 'POST', `/horses/${horse.id}/sessions`, { scheduledAt: iso(now + 6 * 36e5), type: 'Chạy nhẹ' });
step('Ngựa bị khóa: HLV không xếp thêm buổi được', s3.status >= 400, `${s3.status} ${s3.msg ?? ''}`);
const tasks = (await call(T.vet, 'GET', '/me/tasks')).data;
step('Việc cần làm của bác sĩ có sự cố mở', tasks.some((t) => t.key === 'openIncidents' && t.count > 0), JSON.stringify(tasks.map((t) => `${t.key}:${t.count}`)));

// Race gate while locked
const races = (await call(T.manager, 'GET', '/races?limit=100')).data.data;
let race = races.find((r) => new Date(r.date).getTime() > now + 864e5);
if (!race) race = (await call(T.manager, 'POST', '/races', { name: `Giải thử ${now % 1000}`, date: iso(now + 20 * 864e5), venue: 'Phú Thọ', distance: 1600 })).data;
const e1 = await call(T.trainer, 'POST', `/races/${race.id}/entries`, { horseId: horse.id });
step('Đăng ký giải bị chặn kèm lý do', e1.status === 400, e1.msg);

// Unlock rule
const rec = await call(T.vet, 'POST', `/horses/${horse.id}/health-records`, { examDate: iso(now), diagnosis: 'Viêm gân nhẹ, đã hồi phục', healthStatus: 'FIT' });
step('Bác sĩ lập hồ sơ khám FIT', rec.status === 201, `${rec.status} ${rec.msg ?? ''}`);
const trainerAssess = await call(T.trainer, 'POST', `/horses/${horse.id}/fitness-assessment`, { speedScore: 18, staminaScore: 18, conditionScore: 18, recoveryScore: 18, moraleScore: 18 });
step('HLV không được chấm thể lực', trainerAssess.status === 403, `${trainerAssess.status}`);
await call(T.vet, 'POST', `/horses/${horse.id}/fitness-assessment`, { speedScore: 14, staminaScore: 14, conditionScore: 14, recoveryScore: 14, moraleScore: 14 });
const un1 = await call(T.vet, 'PATCH', `/horses/${horse.id}/lock`, { locked: false, healthRecordId: rec.data?.id });
step('Điểm 70 < 80: không mở khóa được', un1.status === 400, un1.msg);
await call(T.vet, 'POST', `/horses/${horse.id}/fitness-assessment`, { speedScore: 17, staminaScore: 17, conditionScore: 17, recoveryScore: 17, moraleScore: 17 });
const resolve = await call(T.vet, 'PATCH', `/incidents/${inc.data?.id}`, { status: 'RESOLVED', healthRecordId: rec.data?.id });
step('Đóng sự cố (khám FIT + điểm 85) → tự mở khóa', resolve.status === 200 && resolve.data?.horseUnlocked === true, `${resolve.status} unlocked=${resolve.data?.horseUnlocked} ${resolve.msg ?? ''}`);
const events = (await call(T.manager, 'GET', `/horses/${horse.id}/lock-events`)).data;
step('Lịch sử khóa/mở có 2 sự kiện', Array.isArray(events) && events.length >= 2, `${events.length} sự kiện`);

// Race gate with a ready horse
const ready = (await call(T.trainer, 'GET', '/races/readiness')).data.filter((r) => r.ready);
step('Có ngựa sẵn sàng thi đấu', ready.length > 0, ready.map((r) => r.horseName).join(', '));
const detail = (await call(T.manager, 'GET', `/races/${race.id}`)).data;
const target = ready.find((r) => !detail.entries.some((e) => e.horseId === r.horseId));
if (target) {
  const e2 = await call(T.trainer, 'POST', `/races/${race.id}/entries`, { horseId: target.horseId });
  step(`Đăng ký ngựa sẵn sàng (${target.horseName})`, e2.status === 201, `${e2.status} ${e2.msg ?? ''}`);
  const e3 = await call(T.trainer, 'POST', `/races/${race.id}/entries`, { horseId: target.horseId });
  step('Đăng ký trùng bị chặn', e3.status === 409, `${e3.status}`);
}

// Flow 3 — owner transparency
const o2 = await call(T.owner2, 'GET', `/horses/${horse.id}`);
step('Chủ khác không xem được ngựa', o2.status === 403, `${o2.status}`);
const rep = await call(T.owner1, 'GET', `/horses/${horse.id}/report`);
step('Chủ ngựa xem báo cáo tháng', rep.status === 200 && rep.data?.health?.exams?.length > 0, `exams=${rep.data?.health?.exams?.length} incidents=${rep.data?.health?.incidents?.length}`);

// Stall biosecurity
const stalls = (await call(T.manager, 'GET', '/stalls')).data;
const st = stalls.find((s) => s.status === 'AVAILABLE' && !s.pendingStatus);
const rq = await call(T.groom, 'POST', `/stalls/${st.id}/request-status`, { targetStatus: 'DISINFECTING', notes: 'Khử trùng sau ca bệnh' });
step('Groom đề xuất khử trùng ô chuồng', rq.status < 300, `${st.code} ${rq.status} ${rq.msg ?? ''}`);
const ap = await call(T.vet, 'POST', `/stalls/${st.id}/approve-status`, { approved: true });
step('Bác sĩ duyệt → ô chuyển DISINFECTING', ap.status < 300 && ap.data?.status === 'DISINFECTING', `${ap.status} ${ap.data?.status ?? ap.msg}`);
await call(T.manager, 'PATCH', `/stalls/${st.id}`, { status: 'AVAILABLE' });

// Cleanup the rehearsal horse
const del = await call(T.manager, 'DELETE', `/horses/${horse.id}`);
console.log(`cleanup horse: ${del.status}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} bước PASS`);
