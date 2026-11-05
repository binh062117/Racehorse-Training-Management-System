/**
 * Demo data for the three flows (training → race, injury, owner transparency).
 * Additive and idempotent — safe to re-run; it never deletes real records
 * except the noisy "0/0 buổi" overdue notifications.
 *
 *   npx ts-node scripts/seed-flows-demo.ts            # dry run, prints what it would do
 *   npx ts-node scripts/seed-flows-demo.ts --execute  # writes (uses DATABASE_URL)
 *
 * 1. Unit prices on supplies, and the cost of every feeding record taken from the store.
 * 2. Feeding records for October → today (2 meals/day) for every active horse.
 * 3. Up to 4 healthy horses made race-ready: a completed pre-race plan
 *    (6 DONE sessions with results) and a vet assessment ≥ 80.
 * 4. Training photos on DONE sessions.
 * 5. Trainer / groom assigned where missing.
 * 6. Remove PLAN_OVERDUE notifications sent for plans that never had a session.
 */
import { Prisma, PrismaClient, SessionStatus } from '@prisma/client';

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');
const DAY = 24 * 3600_000;
const READY_GOAL = 'Giáo án tiền giải — chuẩn bị Vietnam Grand Prix';

// Licensed photos from Wikimedia Commons (CC BY / CC BY-SA / CC0).
const PHOTOS = [
  ['https://upload.wikimedia.org/wikipedia/commons/e/ed/Jockeys_training_racehorses_on_the_gallops%2C_Lambourn%2C_Berkshire.jpg', 'Phi nước đại trên đường tập dốc'],
  ['https://upload.wikimedia.org/wikipedia/commons/1/16/Off_to_the_gallops_in_Middleham_-_geograph.org.uk_-_94632.jpg', 'Ra sân tập buổi sáng'],
  ['https://upload.wikimedia.org/wikipedia/commons/9/99/On_the_Gallops_-_geograph.org.uk_-_123153.jpg', 'Bài chạy bền trên sân cỏ'],
  ['https://upload.wikimedia.org/wikipedia/commons/1/16/Two_Horses_Working_On_The_Gallops_%288236263716%29.jpg', 'Tập cặp đôi — giữ nhịp'],
  ['https://upload.wikimedia.org/wikipedia/commons/9/94/Warren_Hill_racehorse_training_gallops_in_Newmarket_-_geograph.org.uk_-_7552884.jpg', 'Chạy dốc tăng sức bền'],
  ['https://upload.wikimedia.org/wikipedia/commons/0/0a/Polytrack_racehorse_training_gallop_up_Warren_Hill%2C_Newmarket_-_geograph.org.uk_-_7552916.jpg', 'Đường tập nhân tạo'],
] as const;

/** VND per unit, by keyword in the item name; falls back on the category. */
function priceFor(name: string, category: string): number {
  const n = name.toLowerCase();
  const table: [string, number][] = [
    ['yến mạch', 18000], ['alfalfa', 12000], ['timothy', 9000], ['cỏ', 9000],
    ['cám', 22000], ['cà rốt', 15000], ['táo', 30000], ['muối', 120000],
    ['vitamin', 250000], ['điện giải', 180000], ['dầu', 90000],
    ['vắc', 350000], ['ivermectin', 95000], ['kháng sinh', 150000],
    ['băng', 45000], ['thuốc', 120000],
  ];
  for (const [k, v] of table) if (n.includes(k)) return v;
  return category === 'FEED' ? 12000 : category === 'MEDICINE' ? 120000 : 60000;
}

async function main() {
  console.log(EXECUTE ? '== EXECUTE ==' : '== DRY RUN (add --execute to write) ==');
  const now = new Date();
  const user = (email: string) => prisma.user.findUnique({ where: { email } });
  const [trainer, vet, groom] = await Promise.all([
    user('trainer@racehorse.local'), user('vet@racehorse.local'), user('groom@racehorse.local'),
  ]);
  if (!trainer || !vet || !groom) throw new Error('trainer/vet/groom demo accounts not found');

  // 1. Supply prices + feeding cost backfill.
  // An empty store gets the standard stock list first (same as prisma/seed.ts).
  const live = await prisma.supplyItem.count({ where: { deletedAt: null } });
  console.log(`supply items in store: ${live}${live === 0 ? ' → creating the standard list (11 items)' : ''}`);
  if (EXECUTE && live === 0)
    await prisma.supplyItem.createMany({
      data: [
        { name: 'Yến mạch cán', category: 'FEED', unit: 'kg', quantity: 180, minQuantity: 100, unitPrice: 18000 },
        { name: 'Cỏ khô Timothy', category: 'FEED', unit: 'kg', quantity: 420, minQuantity: 200, unitPrice: 9000 },
        { name: 'Cám hỗn hợp giàu đạm', category: 'FEED', unit: 'kg', quantity: 35, minQuantity: 60, unitPrice: 22000 },
        { name: 'Cà rốt', category: 'FEED', unit: 'kg', quantity: 24, minQuantity: 20, unitPrice: 15000 },
        { name: 'Muối khoáng liếm', category: 'FEED', unit: 'tảng', quantity: 6, minQuantity: 4, unitPrice: 120000 },
        { name: 'Ivermectin 1.87% (gel uống)', category: 'MEDICINE', unit: 'ống', quantity: 3, minQuantity: 10, unitPrice: 95000 },
        { name: 'Vắc xin cúm ngựa', category: 'MEDICINE', unit: 'liều', quantity: 12, minQuantity: 8, unitPrice: 450000 },
        { name: 'Povidone-iodine 10%', category: 'MEDICINE', unit: 'chai', quantity: 5, minQuantity: 4, unitPrice: 60000 },
        { name: 'Băng quấn chân', category: 'EQUIPMENT', unit: 'cuộn', quantity: 40, minQuantity: 20, unitPrice: 35000 },
        { name: 'Móng sắt', category: 'EQUIPMENT', unit: 'bộ', quantity: 6, minQuantity: 8, unitPrice: 280000 },
        { name: 'Bàn chải lông', category: 'EQUIPMENT', unit: 'cái', quantity: 9, minQuantity: 4, unitPrice: 45000 },
      ],
    });
  const items = await prisma.supplyItem.findMany({ where: { deletedAt: null } });
  const unpriced = items.filter((i) => i.unitPrice == null);
  console.log(`supplies without price: ${unpriced.length}/${items.length}`);
  if (EXECUTE)
    for (const i of unpriced)
      await prisma.supplyItem.update({ where: { id: i.id }, data: { unitPrice: priceFor(i.name, i.category) } });
  const priced = await prisma.supplyItem.findMany({ where: { deletedAt: null } });
  const price = new Map(priced.map((i) => [i.id, i.unitPrice ?? priceFor(i.name, i.category)]));
  const feeds = priced.filter((i) => i.category === 'FEED' && i.unit.toLowerCase() === 'kg');

  // Link text-only feeding records to a store item with the same name, then cost them.
  const loose = await prisma.feedingRecord.findMany({ where: { costVnd: null } });
  let costed = 0;
  for (const r of loose) {
    const item = r.supplyItemId
      ? priced.find((i) => i.id === r.supplyItemId)
      : feeds.find((i) => i.name.toLowerCase() === r.feedType.trim().toLowerCase());
    if (!item) continue;
    costed++;
    if (EXECUTE)
      await prisma.feedingRecord.update({
        where: { id: r.id },
        data: { supplyItemId: item.id, costVnd: Math.round(r.quantityKg * (price.get(item.id) ?? 0)) },
      });
  }
  console.log(`feeding records costed: ${costed}`);

  const horses = await prisma.horse.findMany({
    where: { deletedAt: null, status: { not: 'RETIRED' } },
    include: { owner: { select: { email: true } } },
    orderBy: { name: 'asc' },
  });

  // 2. Meals from 1 October to today, for horses that have few this period.
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const hay = feeds.find((f) => /cỏ|timothy|alfalfa/i.test(f.name)) ?? feeds[0];
  const oats = feeds.find((f) => /yến mạch/i.test(f.name)) ?? feeds[1] ?? feeds[0];
  const mash = feeds.find((f) => /cám/i.test(f.name)) ?? oats;
  let meals = 0;
  if (hay && oats) {
    for (const h of horses) {
      const have = await prisma.feedingRecord.count({ where: { horseId: h.id, date: { gte: from } } });
      if (have >= 20) continue;
      const rows: Prisma.FeedingRecordCreateManyInput[] = [];
      for (let t = from.getTime(); t < now.getTime() - 6 * 3600_000; t += DAY) {
        const d = new Date(t);
        const day = d.getUTCDate();
        const morning = new Date(t); // 07:00 giờ VN
        const evening = new Date(t + 10 * 3600_000); // 17:00 giờ VN
        const am = day % 2 ? oats : mash;
        const amKg = am === mash ? 1.5 : 2.5 + (day % 3) * 0.5;
        const pmKg = 4 + (day % 4) * 0.5;
        rows.push(
          { horseId: h.id, recordedById: groom.id, date: morning, feedType: am.name, quantityKg: amKg, supplyItemId: am.id, costVnd: Math.round(amKg * (price.get(am.id) ?? 0)) },
          { horseId: h.id, recordedById: groom.id, date: evening, feedType: hay.name, quantityKg: pmKg, supplyItemId: hay.id, costVnd: Math.round(pmKg * (price.get(hay.id) ?? 0)) },
        );
      }
      meals += rows.length;
      if (EXECUTE) await prisma.feedingRecord.createMany({ data: rows });
    }
  }
  console.log(`meals added: ${meals}`);

  // 5. Trainer / groom where missing.
  const noStaff = horses.filter((h) => !h.trainerId || !h.groomId);
  console.log(`horses given a trainer/groom: ${noStaff.length}`);
  if (EXECUTE)
    for (const h of noStaff)
      await prisma.horse.update({
        where: { id: h.id },
        data: { trainerId: h.trainerId ?? trainer.id, groomId: h.groomId ?? groom.id },
      });

  // 3. Race-ready horses: healthy, unlocked; owner1's horses first so the owner sees one.
  const already = await prisma.trainingPlan.findMany({ where: { goal: READY_GOAL }, select: { horseId: true } });
  const done = new Set(already.map((p) => p.horseId));
  const candidates = horses
    .filter((h) => !h.locked && h.healthStatus === 'FIT')
    .sort((a, b) => Number(b.owner.email === 'owner1@racehorse.local') - Number(a.owner.email === 'owner1@racehorse.local'));
  const picked = [...candidates.filter((h) => done.has(h.id)), ...candidates.filter((h) => !done.has(h.id))].slice(0, 4);
  console.log(`race-ready horses: ${picked.map((h) => h.name).join(', ') || '(none eligible)'}`);

  let photo = 0;
  for (const [n, h] of picked.entries()) {
    if (done.has(h.id)) continue;
    const latest = await prisma.trainingPlan.findFirst({ where: { horseId: h.id }, orderBy: { startDate: 'desc' } });
    // The new plan must be the horse's latest one (readiness looks at the latest plan).
    const start = new Date(Math.max(now.getTime() - 12 * DAY, (latest?.startDate.getTime() ?? 0) + 3600_000));
    const span = now.getTime() - 3 * 3600_000 - start.getTime();
    const trainerId = h.trainerId ?? trainer.id;
    const steps = [
      ['Khởi động & chạy nhẹ', 1000, 'TURF'], ['Chạy bền', 1400, 'TURF'], ['Chạy dốc', 1200, 'DIRT'],
      ['Tăng tốc nước rút', 1600, 'TURF'], ['Chạy bền', 1800, 'TURF'], ['Mô phỏng giải', 2000, 'TURF'],
    ] as const;
    const score = [86, 84, 88, 82][n] ?? 83;
    console.log(`  ${h.name}: plan from ${start.toISOString().slice(0, 16)}, 6 sessions, fitness ${score}`);
    if (!EXECUTE) continue;
    const plan = await prisma.trainingPlan.create({
      data: {
        horseId: h.id, trainerId, goal: READY_GOAL, startDate: start,
        endDate: new Date(now.getTime() + 10 * DAY), targetDistanceM: 2000, overdueNotifiedAt: null,
      },
    });
    for (const [i, [type, dist, surface]] of steps.entries()) {
      const at = new Date(start.getTime() + (span * (i + 0.5)) / steps.length);
      const s = await prisma.trainingSession.create({
        data: {
          horseId: h.id, trainerId, groomId: h.groomId ?? groom.id, planId: plan.id, scheduledAt: at,
          type, distanceM: dist, surface, status: SessionStatus.DONE,
          finishTimeSec: Math.round((dist / 16.2 + n * 0.8 - i * 0.4) * 10) / 10,
          recoveryHeartRate: 68 - i * 2 + n,
          muscleResponse: i === 2 && n % 2 ? 'TIGHT' : 'NORMAL',
          notes: i === steps.length - 1 ? 'Giữ nhịp tốt cả cự ly, sẵn sàng thi đấu.' : null,
        },
      });
      if (i % 2 === 1) {
        const [url, caption] = PHOTOS[photo++ % PHOTOS.length];
        await prisma.trainingMedia.create({
          data: { horseId: h.id, sessionId: s.id, kind: 'IMAGE', url, caption: `${caption} — ${h.name}`, uploadedById: trainerId, createdAt: new Date(at.getTime() + 3600_000) },
        });
      }
    }
    const per = Math.floor(score / 5);
    const rest = score - per * 5;
    await prisma.fitnessAssessment.create({
      data: {
        horseId: h.id, assessedById: vet.id,
        speedScore: per + rest, staminaScore: per, conditionScore: per, recoveryScore: per, moraleScore: per,
        totalScore: score, notes: 'Đánh giá trước giải: thể lực đạt, tim mạch hồi phục tốt.',
      },
    });
    await prisma.horse.update({ where: { id: h.id }, data: { fitnessScore: score } });
  }

  // 4. A few photos on other horses' recent DONE sessions too (8 in all, once).
  const wiki = { url: { startsWith: 'https://upload.wikimedia.org/' } };
  const otherPlan = { OR: [{ planId: null }, { plan: { goal: { not: READY_GOAL } } }] };
  const seeded = await prisma.trainingMedia.count({ where: { ...wiki, session: otherPlan } });
  const recent = await prisma.trainingSession.findMany({
    where: { ...otherPlan, status: SessionStatus.DONE, media: { none: {} }, horse: { deletedAt: null }, scheduledAt: { gte: from } },
    orderBy: { scheduledAt: 'desc' },
    take: Math.max(0, 8 - seeded),
  });
  console.log(`extra session photos: ${recent.length}`);
  if (EXECUTE)
    for (const s of recent) {
      const [url, caption] = PHOTOS[photo++ % PHOTOS.length];
      await prisma.trainingMedia.create({
        data: { horseId: s.horseId, sessionId: s.id, kind: 'IMAGE', url, caption, uploadedById: s.trainerId, createdAt: new Date(s.scheduledAt.getTime() + 3600_000) },
      });
    }

  // 6. Overdue alerts for plans that never had a session.
  const noisy = await prisma.notification.count({ where: { type: 'PLAN_OVERDUE', message: { contains: 'mới hoàn thành 0/0 buổi' } } });
  console.log(`empty-plan overdue notifications removed: ${noisy}`);
  if (EXECUTE)
    await prisma.notification.deleteMany({ where: { type: 'PLAN_OVERDUE', message: { contains: 'mới hoàn thành 0/0 buổi' } } });
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
