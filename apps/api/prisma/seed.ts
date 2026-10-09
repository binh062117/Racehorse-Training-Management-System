import {
  HorseStatus,
  IncidentSeverity,
  IncidentStatus,
  PrismaClient,
  Role,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const daysFromNow = (n: number): Date =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000);

/**
 * Seed data grows per phase (see docs/PLAN.md §6):
 *  - Phase 1: one active, verified MANAGER.
 *  - Phase 2: two OWNERs + three horses.
 *  - Phase 3: TRAINER + VET + GROOM + a few training sessions.
 *  - Phase 4: a couple of health records (VET seeded in Phase 3).
 *  - Phase 5: one PENDING applicant + a session for the 2nd horse; demo-account list.
 *  - Phase 6: two retired ancestor horses (pedigree), fitnessScore on two horses,
 *    one race + two entries (registered, no result yet).
 *  - Phase 7: one training plan (Thunderbolt), Sea Breeze locked (Training Lock)
 *    to demo the trainer being blocked from creating new sessions.
 *  - Phase 8: one HIGH incident (Midnight, auto-locks + notifies), one LOW
 *    incident already RESOLVED (Thunderbolt, linked to its health record).
 *    Seed uses raw prisma writes (no Nest DI here), so it replicates by hand
 *    what IncidentsService/HorsesService.lock() would do at runtime.
 */
async function main(): Promise<void> {
  const managerHash = await bcrypt.hash('Manager123!', 10);
  const ownerHash = await bcrypt.hash('Owner123!', 10);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@racehorse.local' },
    update: {},
    create: {
      name: 'Club Manager',
      email: 'manager@racehorse.local',
      passwordHash: managerHash,
      role: Role.MANAGER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Seeded MANAGER: ${manager.email} / Manager123!`);

  const owners = await Promise.all(
    [
      { name: 'Owner One', email: 'owner1@racehorse.local' },
      { name: 'Owner Two', email: 'owner2@racehorse.local' },
    ].map((o) =>
      prisma.user.upsert({
        where: { email: o.email },
        update: {},
        create: {
          name: o.name,
          email: o.email,
          passwordHash: ownerHash,
          role: Role.OWNER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  );
  console.log(
    `Seeded OWNERs: ${owners.map((o) => o.email).join(', ')} / Owner123!`,
  );

  const staffSpecs: { name: string; email: string; role: Role; password: string }[] = [
    { name: 'Trainer One', email: 'trainer@racehorse.local', role: Role.TRAINER, password: 'Trainer123!' },
    { name: 'Vet One', email: 'vet@racehorse.local', role: Role.VET, password: 'Vet123!' },
    { name: 'Groom One', email: 'groom@racehorse.local', role: Role.GROOM, password: 'Groom123!' },
  ];
  const staff: Record<string, string> = {};
  for (const s of staffSpecs) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        name: s.name,
        email: s.email,
        passwordHash: await bcrypt.hash(s.password, 10),
        role: s.role,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    staff[s.role] = user.id;
  }
  console.log(
    `Seeded staff: ${staffSpecs.map((s) => `${s.email} / ${s.password}`).join(', ')}`,
  );

  // A PENDING account (email already verified) to demo the MANAGER approval flow.
  await prisma.user.upsert({
    where: { email: 'newbie@racehorse.local' },
    update: {},
    create: {
      name: 'Newbie Applicant',
      email: 'newbie@racehorse.local',
      passwordHash: await bcrypt.hash('Newbie123!', 10),
      status: UserStatus.PENDING,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Seeded PENDING user: newbie@racehorse.local / Newbie123!');

  const horseSpecs = [
    { name: 'Thunderbolt', breed: 'Thoroughbred', ownerEmail: 'owner1@racehorse.local', status: HorseStatus.ACTIVE },
    { name: 'Sea Breeze', breed: 'Arabian', ownerEmail: 'owner1@racehorse.local', status: HorseStatus.RESTING },
    { name: 'Midnight', breed: 'Quarter Horse', ownerEmail: 'owner2@racehorse.local', status: HorseStatus.ACTIVE },
  ];

  for (const spec of horseSpecs) {
    const existing = await prisma.horse.findFirst({ where: { name: spec.name } });
    if (existing) continue;
    const owner = owners.find((o) => o.email === spec.ownerEmail)!;
    await prisma.horse.create({
      data: {
        name: spec.name,
        breed: spec.breed,
        ownerId: owner.id,
        status: spec.status,
      },
    });
  }
  const horseCount = await prisma.horse.count({ where: { deletedAt: null } });
  console.log(`Horses in DB: ${horseCount}`);

  const trainerId = staff[Role.TRAINER];
  const horsesByName = Object.fromEntries(
    (await prisma.horse.findMany({ select: { id: true, name: true } })).map(
      (h) => [h.name, h.id],
    ),
  );
  const sessionSpecs = [
    {
      horse: 'Thunderbolt',
      scheduledAt: daysFromNow(3),
      type: 'gallop',
      status: SessionStatus.PLANNED,
    },
    {
      horse: 'Thunderbolt',
      scheduledAt: daysFromNow(-7),
      type: 'sprint',
      status: SessionStatus.DONE,
      resultMetric: 'time_1200m_s',
      resultValue: 74.2,
    },
    {
      horse: 'Midnight',
      scheduledAt: daysFromNow(2),
      type: 'trot',
      status: SessionStatus.PLANNED,
    },
    {
      horse: 'Sea Breeze',
      scheduledAt: daysFromNow(5),
      type: 'dressage',
      status: SessionStatus.PLANNED,
    },
  ];
  for (const spec of sessionSpecs) {
    const horseId = horsesByName[spec.horse];
    if (!horseId) continue;
    // Each (horse, type) pair is unique in the seed set — enough for idempotency.
    const exists = await prisma.trainingSession.findFirst({
      where: { horseId, type: spec.type },
    });
    if (exists) continue;
    await prisma.trainingSession.create({
      data: {
        horseId,
        trainerId,
        scheduledAt: spec.scheduledAt,
        type: spec.type,
        status: spec.status,
        resultMetric: spec.resultMetric ?? null,
        resultValue: spec.resultValue ?? null,
      },
    });
  }
  const sessionCount = await prisma.trainingSession.count();
  console.log(`Training sessions in DB: ${sessionCount}`);

  const vetId = staff[Role.VET];
  const healthSpecs = [
    {
      horse: 'Thunderbolt',
      examDate: daysFromNow(-10),
      diagnosis: 'Routine checkup — healthy',
      treatment: null as string | null,
    },
    {
      horse: 'Midnight',
      examDate: daysFromNow(-3),
      diagnosis: 'Mild colic',
      treatment: 'Monitored 24h, recovered',
    },
  ];
  for (const spec of healthSpecs) {
    const horseId = horsesByName[spec.horse];
    if (!horseId) continue;
    // (horse, diagnosis) is unique in the seed set — enough for idempotency.
    const exists = await prisma.healthRecord.findFirst({
      where: { horseId, diagnosis: spec.diagnosis },
    });
    if (exists) continue;
    await prisma.healthRecord.create({
      data: {
        horseId,
        vetId,
        examDate: spec.examDate,
        diagnosis: spec.diagnosis,
        treatment: spec.treatment,
      },
    });
  }
  const recordCount = await prisma.healthRecord.count();
  console.log(`Health records in DB: ${recordCount}`);

  // Phase 6: pedigree (two retired ancestors) + fitnessScore on a couple of horses.
  const ancestorSpecs = [
    { name: 'Northern Star', breed: 'Thoroughbred', ownerEmail: 'owner1@racehorse.local' },
    { name: 'Silver Mist', breed: 'Thoroughbred', ownerEmail: 'owner1@racehorse.local' },
  ];
  for (const spec of ancestorSpecs) {
    const existing = await prisma.horse.findFirst({ where: { name: spec.name } });
    if (existing) continue;
    const owner = owners.find((o) => o.email === spec.ownerEmail)!;
    await prisma.horse.create({
      data: {
        name: spec.name,
        breed: spec.breed,
        ownerId: owner.id,
        status: HorseStatus.RETIRED,
      },
    });
  }
  const ancestorsByName = Object.fromEntries(
    (
      await prisma.horse.findMany({
        where: { name: { in: ancestorSpecs.map((a) => a.name) } },
        select: { id: true, name: true },
      })
    ).map((h) => [h.name, h.id]),
  );
  const thunderboltId = horsesByName['Thunderbolt'];
  if (thunderboltId && ancestorsByName['Northern Star'] && ancestorsByName['Silver Mist']) {
    await prisma.horse.update({
      where: { id: thunderboltId },
      data: {
        sireId: ancestorsByName['Northern Star'],
        damId: ancestorsByName['Silver Mist'],
        fitnessScore: 78,
      },
    });
  }
  const midnightId = horsesByName['Midnight'];
  if (midnightId) {
    await prisma.horse.update({
      where: { id: midnightId },
      data: { fitnessScore: 65 },
    });
  }
  console.log('Seeded pedigree: Thunderbolt ← Northern Star (sire) + Silver Mist (dam)');

  // Phase 6: one race + entries for Thunderbolt / Midnight (registered, no result yet).
  // No natural unique key on Race — guard idempotency by name (unique in the seed set).
  let race = await prisma.race.findFirst({ where: { name: 'Spring Derby 2026' } });
  if (!race) {
    race = await prisma.race.create({
      data: {
        name: 'Spring Derby 2026',
        date: daysFromNow(20),
        venue: 'Đà Lạt Racecourse',
        distance: 1600,
        surface: 'turf',
      },
    });
  }
  for (const horseId of [thunderboltId, midnightId].filter((v): v is string => !!v)) {
    const exists = await prisma.raceEntry.findUnique({
      where: { raceId_horseId: { raceId: race.id, horseId } },
    });
    if (exists) continue;
    await prisma.raceEntry.create({ data: { raceId: race.id, horseId } });
  }
  const raceEntryCount = await prisma.raceEntry.count({ where: { raceId: race.id } });
  console.log(`Seeded race "${race.name}" with ${raceEntryCount} entries`);

  // Phase 7: one training plan (Thunderbolt) + Training Lock on Sea Breeze.
  if (thunderboltId) {
    const existingPlan = await prisma.trainingPlan.findFirst({
      where: { horseId: thunderboltId, goal: 'Build stamina for Spring Derby 2026' },
    });
    if (!existingPlan) {
      await prisma.trainingPlan.create({
        data: {
          horseId: thunderboltId,
          trainerId,
          goal: 'Build stamina for Spring Derby 2026',
          startDate: daysFromNow(0),
          endDate: daysFromNow(30),
        },
      });
    }
  }
  console.log('Seeded training plan for Thunderbolt');

  const seaBreezeId = horsesByName['Sea Breeze'];
  if (seaBreezeId) {
    await prisma.horse.update({
      where: { id: seaBreezeId },
      data: {
        locked: true,
        lockReason: 'Mild tendon strain — resting per vet advice',
      },
    });
  }
  console.log('Locked Sea Breeze (Training Lock demo)');

  // Phase 8: incidents + notifications. Raw prisma here — no Nest DI in the
  // seed script — so replicate IncidentsService/HorsesService.lock() by hand.
  const groomId = staff[Role.GROOM];
  const managerIds = (
    await prisma.user.findMany({
      where: { role: Role.MANAGER, status: UserStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    })
  ).map((m) => m.id);

  if (midnightId && groomId) {
    const description = 'Va chạm khi vận chuyển, nghi ngờ chấn thương chân sau';
    let incident = await prisma.incidentReport.findFirst({
      where: { horseId: midnightId, description },
    });
    if (!incident) {
      incident = await prisma.incidentReport.create({
        data: {
          horseId: midnightId,
          reportedById: groomId,
          description,
          severity: IncidentSeverity.HIGH,
        },
      });
      const lockReason = `Incident: ${description}`;
      await prisma.horse.update({
        where: { id: midnightId },
        data: { locked: true, lockReason },
      });
      const midnight = await prisma.horse.findUniqueOrThrow({
        where: { id: midnightId },
        select: { name: true, ownerId: true },
      });
      await prisma.notification.createMany({
        data: [
          {
            userId: midnight.ownerId,
            type: 'TRAINING_LOCKED',
            message: `${midnight.name} đã bị khoá tập luyện: ${lockReason}`,
          },
          ...managerIds.map((userId) => ({
            userId,
            type: 'TRAINING_LOCKED' as const,
            message: `${midnight.name} đã bị khoá tập luyện: ${lockReason}`,
          })),
          {
            userId: midnight.ownerId,
            type: 'INCIDENT_REPORTED',
            message: `Sự cố mới (HIGH) cho ${midnight.name}: ${description}`,
          },
        ],
      });
    }
  }
  console.log('Seeded HIGH incident for Midnight (auto-locked + notified)');

  if (thunderboltId) {
    const description = 'Xây xát nhẹ ở vai, tự khỏi sau vài ngày';
    const existingLow = await prisma.incidentReport.findFirst({
      where: { horseId: thunderboltId, description },
    });
    if (!existingLow) {
      const linkedRecord = await prisma.healthRecord.findFirst({
        where: { horseId: thunderboltId, diagnosis: 'Routine checkup — healthy' },
      });
      await prisma.incidentReport.create({
        data: {
          horseId: thunderboltId,
          reportedById: groomId ?? trainerId,
          description,
          severity: IncidentSeverity.LOW,
          status: IncidentStatus.RESOLVED,
          healthRecordId: linkedRecord?.id ?? null,
        },
      });
    }
  }
  console.log('Seeded resolved LOW incident for Thunderbolt');

  // Phase 10: healthStatus, 1 vaccination, 1 injury-location, 1 treatment
  // plan + medication. Raw prisma here too — same "no Nest DI in seed"
  // constraint as Phase 8/9, so no side effects to replicate (these writes
  // don't trigger notifications or locks).
  if (seaBreezeId) {
    await prisma.horse.update({
      where: { id: seaBreezeId },
      data: { healthStatus: 'MONITORING' },
    });
  }
  if (midnightId) {
    await prisma.horse.update({
      where: { id: midnightId },
      data: { healthStatus: 'INJURED' },
    });
  }
  console.log('Seeded healthStatus: Sea Breeze=MONITORING, Midnight=INJURED');

  if (thunderboltId) {
    const existingVaccination = await prisma.vaccination.findFirst({
      where: { horseId: thunderboltId, vaccineName: 'Tetanus' },
    });
    if (!existingVaccination) {
      await prisma.vaccination.create({
        data: {
          horseId: thunderboltId,
          vaccineName: 'Tetanus',
          date: daysFromNow(-345),
          nextDueDate: daysFromNow(20),
        },
      });
    }
  }
  console.log('Seeded vaccination: Thunderbolt / Tetanus (due in 20 days)');

  if (midnightId) {
    const midnightIncident = await prisma.incidentReport.findFirst({
      where: {
        horseId: midnightId,
        description: 'Va chạm khi vận chuyển, nghi ngờ chấn thương chân sau',
      },
    });
    if (midnightIncident) {
      const existingInjury = await prisma.injuryLocation.findFirst({
        where: { incidentReportId: midnightIncident.id },
      });
      if (!existingInjury) {
        await prisma.injuryLocation.create({
          data: {
            incidentReportId: midnightIncident.id,
            bodyRegion: 'Right hind leg',
            side: 'right',
            notes: 'Swelling observed near the fetlock',
          },
        });
      }
    }
  }
  console.log('Seeded injury location for Midnight incident');

  if (midnightId) {
    const colicRecord = await prisma.healthRecord.findFirst({
      where: { horseId: midnightId, diagnosis: 'Mild colic' },
    });
    if (colicRecord) {
      let plan = await prisma.treatmentPlan.findFirst({
        where: { healthRecordId: colicRecord.id },
      });
      if (!plan) {
        plan = await prisma.treatmentPlan.create({
          data: {
            healthRecordId: colicRecord.id,
            description: 'Monitor and rest, review in 48h',
            startDate: colicRecord.examDate,
            endDate: daysFromNow(-1),
            status: 'COMPLETED',
          },
        });
      }
      const existingMed = await prisma.medication.findFirst({
        where: { treatmentPlanId: plan.id },
      });
      if (!existingMed) {
        await prisma.medication.create({
          data: {
            healthRecordId: colicRecord.id,
            treatmentPlanId: plan.id,
            name: 'Flunixin meglumine',
            dosage: '1.1 mg/kg IV',
            startDate: colicRecord.examDate,
            endDate: daysFromNow(-2),
          },
        });
      }
    }
  }
  console.log('Seeded treatment plan + medication for Midnight (Mild colic)');

  // Flow 1 demo data: đủ dữ liệu phong phú cho các trang FE mới (lịch sử đua,
  // danh sách giáo án, lịch tiêm phòng/tẩy giun, phả hệ ngựa thứ 2, thêm 1
  // PENDING applicant) — phục vụ demo trực quan cho từng role.

  // Thêm 1 giải đã diễn ra (có kết quả) để HorseRaceHistoryPage có KPI
  // (số lần thi, podium, vị trí tốt nhất) thay vì toàn số 0.
  let pastRace = await prisma.race.findFirst({ where: { name: 'Autumn Classic 2025' } });
  if (!pastRace) {
    pastRace = await prisma.race.create({
      data: {
        name: 'Autumn Classic 2025',
        date: daysFromNow(-60),
        venue: 'Phú Thọ Racecourse',
        distance: 2000,
        surface: 'dirt',
        prizePool: 50_000_000,
      },
    });
  }
  const pastResults: { horseId: string | undefined; position: number; time: string }[] = [
    { horseId: thunderboltId, position: 1, time: '2:04.10' },
    { horseId: midnightId, position: 3, time: '2:07.55' },
  ];
  for (const r of pastResults) {
    if (!r.horseId) continue;
    const exists = await prisma.raceEntry.findUnique({
      where: { raceId_horseId: { raceId: pastRace.id, horseId: r.horseId } },
    });
    if (exists) continue;
    await prisma.raceEntry.create({
      data: { raceId: pastRace.id, horseId: r.horseId, position: r.position, time: r.time },
    });
  }
  console.log(`Seeded past race "${pastRace.name}" with results (Thunderbolt #1, Midnight #3)`);

  // Thêm giáo án cho Midnight (còn hiệu lực) và Sea Breeze (đã kết thúc) để
  // TrainingPlansPage có cả 2 trạng thái ACTIVE/COMPLETED (suy ra từ endDate
  // ở frontend, model không có cột status riêng).
  const extraPlanSpecs = [
    {
      horse: 'Midnight',
      goal: 'Phục hồi sau chấn thương, tăng dần cường độ',
      startDate: daysFromNow(-5),
      endDate: daysFromNow(25),
    },
    {
      horse: 'Sea Breeze',
      goal: 'Giáo án nền tảng sức bền mùa trước',
      startDate: daysFromNow(-90),
      endDate: daysFromNow(-20),
    },
  ];
  for (const spec of extraPlanSpecs) {
    const horseId = horsesByName[spec.horse];
    if (!horseId) continue;
    const exists = await prisma.trainingPlan.findFirst({
      where: { horseId, goal: spec.goal },
    });
    if (exists) continue;
    await prisma.trainingPlan.create({
      data: {
        horseId,
        trainerId,
        goal: spec.goal,
        startDate: spec.startDate,
        endDate: spec.endDate,
      },
    });
  }
  console.log('Seeded 2 more training plans (Midnight active, Sea Breeze completed)');

  // Thêm lịch tiêm phòng/tẩy giun đa dạng (careType, nhiều ngựa, nhiều
  // trạng thái hạn) cho HealthSchedulePage.
  const careSpecs: {
    horse: string;
    careType: 'VACCINATION' | 'DEWORMING';
    vaccineName: string;
    date: Date;
    nextDueDate: Date | null;
  }[] = [
    {
      horse: 'Thunderbolt',
      careType: 'DEWORMING',
      vaccineName: 'Ivermectin',
      date: daysFromNow(-80),
      nextDueDate: daysFromNow(10),
    },
    {
      horse: 'Sea Breeze',
      careType: 'VACCINATION',
      vaccineName: 'Influenza',
      date: daysFromNow(-300),
      nextDueDate: daysFromNow(15),
    },
    {
      horse: 'Sea Breeze',
      careType: 'DEWORMING',
      vaccineName: 'Fenbendazole',
      date: daysFromNow(-95),
      nextDueDate: daysFromNow(-5), // quá hạn — demo trạng thái cần chú ý
    },
    {
      horse: 'Midnight',
      careType: 'VACCINATION',
      vaccineName: 'Tetanus',
      date: daysFromNow(-10),
      nextDueDate: daysFromNow(355), // còn xa — không rơi vào "upcoming"
    },
  ];
  for (const spec of careSpecs) {
    const horseId = horsesByName[spec.horse];
    if (!horseId) continue;
    const exists = await prisma.vaccination.findFirst({
      where: { horseId, vaccineName: spec.vaccineName, careType: spec.careType },
    });
    if (exists) continue;
    await prisma.vaccination.create({
      data: {
        horseId,
        careType: spec.careType,
        vaccineName: spec.vaccineName,
        date: spec.date,
        nextDueDate: spec.nextDueDate,
      },
    });
  }
  console.log('Seeded 4 more vaccination/deworming records across Thunderbolt/Sea Breeze/Midnight');

  // Phả hệ cho ngựa thứ 2 (Sea Breeze) — HorsePedigreePage không chỉ có
  // đúng 1 ví dụ (Thunderbolt).
  if (seaBreezeId && ancestorsByName['Northern Star']) {
    await prisma.horse.update({
      where: { id: seaBreezeId },
      data: { sireId: ancestorsByName['Northern Star'] },
    });
  }
  console.log('Seeded pedigree: Sea Breeze ← Northern Star (sire)');

  // Thêm 1 PENDING applicant nữa để demo duyệt/từ chối hàng loạt.
  await prisma.user.upsert({
    where: { email: 'newbie2@racehorse.local' },
    update: {},
    create: {
      name: 'Newbie Applicant 2',
      email: 'newbie2@racehorse.local',
      passwordHash: await bcrypt.hash('Newbie123!', 10),
      status: UserStatus.PENDING,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Seeded 2nd PENDING user: newbie2@racehorse.local / Newbie123!');

  console.log('\nDemo accounts (all password "<Role>123!"):');
  console.log('  manager@racehorse.local  / Manager123!  (MANAGER)');
  console.log('  trainer@racehorse.local  / Trainer123!  (TRAINER)');
  console.log('  vet@racehorse.local      / Vet123!      (VET)');
  console.log('  groom@racehorse.local    / Groom123!    (GROOM)');
  console.log('  owner1@racehorse.local   / Owner123!    (OWNER)');
  console.log('  owner2@racehorse.local   / Owner123!    (OWNER)');
  console.log('  newbie@racehorse.local   / Newbie123!   (PENDING — approve me)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
