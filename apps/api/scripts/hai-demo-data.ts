import { createHash } from 'node:crypto';
import { Prisma, Role, HealthStatus, SessionStatus } from '@prisma/client';
import regions from '../../../shared/injury-regions.json';

export const demoId = (kind: string, index: number) => {
  const hex = createHash('sha256')
    .update(`hai-club-fixtures-v1:${kind}:${index}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

/** Pure manifest generation. Same anchor produces identical rows on every run. */
export function buildHaiDemo(anchor: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
    new Date(anchor).toISOString().slice(0, 10) !== anchor
  )
    throw new Error('HAI_DEMO_ANCHOR must be a valid YYYY-MM-DD');
  const base = new Date(`${anchor}T08:00:00.000Z`).getTime();
  const at = (days: number, hours = 0) =>
    new Date(base + days * 86400000 + hours * 3600000);
  const roles = [Role.MANAGER, Role.TRAINER, Role.VET, Role.GROOM, Role.OWNER];
  const names = ['Linh Nguyen', 'Minh Tran', 'An Le', 'Khoa Pham', 'Mai Vu'];
  const users = roles.map((role, i) => ({
    id: demoId('user', i),
    name: names[i],
    email: `${names[i].toLowerCase().replace(' ', '.')}@hai-club.example.invalid`,
    role,
    status: 'ACTIVE' as const,
    deletedAt: null,
    emailVerifiedAt: at(-120),
  }));
  const prefixes = [
    'Amber',
    'Willow',
    'Silver',
    'Autumn',
    'Cedar',
    'Golden',
    'Maple',
    'River',
    'Laurel',
    'Winter',
    'Copper',
    'Scarlet',
    'Hazel',
    'Orchard',
    'Velvet',
  ];
  const suffixes = [
    'Breeze',
    'Dancer',
    'Comet',
    'Meadow',
    'Promise',
    'Whisper',
    'Crest',
  ];
  const health: HealthStatus[] = [
    'FIT',
    'MONITORING',
    'INJURED',
    'QUARANTINED',
  ];
  const horses: Prisma.HorseUncheckedCreateInput[] = Array.from(
    { length: 105 },
    (_, i) => ({
      id: demoId('horse', i),
      name: `${prefixes[Math.floor(i / suffixes.length)]} ${suffixes[i % suffixes.length]}`,
      ownerId: users[4].id,
      breed: i % 2 ? 'Thoroughbred' : 'Arabian',
      gender: i % 2 ? 'FEMALE' : 'MALE',
      birthDate: new Date(`${2016 + (i % 8)}-03-12T00:00:00Z`),
      healthStatus: health[i % 4],
      status: 'ACTIVE',
      locked: i === 2,
      lockReason: i === 2 ? 'Rest during tendon rehabilitation' : null,
      deletedAt: null,
    }),
  );
  const plans: Prisma.TrainingPlanUncheckedCreateInput[] = horses.map(
    (h, i) => ({
      id: demoId('plan', i),
      horseId: h.id!,
      trainerId: users[1].id,
      goal:
        i % 2
          ? 'Improve controlled canter endurance'
          : 'Build aerobic fitness with steady pacing',
      startDate: at(-70),
      endDate: at(35),
    }),
  );
  const sessions: Prisma.TrainingSessionUncheckedCreateInput[] = [];
  // Two months of outcomes and >20 sessions on the first horse; no fitness notifications.
  for (let i = 0; i < 48; i++) {
    const horseIndex = i < 32 ? 0 : 4;
    const status: SessionStatus =
      i % 8 === 0 ? 'MISSED' : i % 5 === 0 ? 'CANCELLED' : 'DONE';
    sessions.push({
      id: demoId('session', i),
      horseId: demoId('horse', horseIndex),
      planId: demoId('plan', horseIndex),
      trainerId: users[1].id,
      groomId: users[3].id,
      scheduledAt: at(-60 + i),
      type: i % 2 ? 'Controlled canter' : 'Endurance walk',
      status,
      resultMetric: status === 'DONE' ? 'heart_rate_max' : null,
      resultValue: status === 'DONE' ? 150 + (i % 30) : null,
      notes: 'Routine conditioning on the sand track',
    });
  }
  for (let i = 0; i < 8; i++)
    sessions.push({
      id: demoId('session', 48 + i),
      horseId: demoId('horse', 0),
      planId: demoId('plan', 0),
      trainerId: users[1].id,
      groomId: users[3].id,
      scheduledAt: at(2 + i),
      type: 'Steady canter',
      status: 'PLANNED',
    });
  // Only allowed in an explicitly disposable environment by the execution guard.
  sessions.push({
    id: demoId('session', 56),
    horseId: demoId('horse', 4),
    planId: demoId('plan', 4),
    trainerId: users[1].id,
    groomId: users[3].id,
    scheduledAt: at(-1),
    type: 'Morning hand walk',
    status: 'PLANNED',
  });
  const records: Prisma.HealthRecordUncheckedCreateInput[] = Array.from(
    { length: 110 },
    (_, i) => ({
      id: demoId('health', i),
      horseId: demoId('horse', i < 105 ? 0 : i - 104),
      vetId: users[2].id,
      examDate: at(-110 + i),
      diagnosis:
        i % 3
          ? 'Routine follow-up: comfortable at walk, normal appetite'
          : 'Mild forelimb sensitivity after exercise',
      treatment:
        i % 3
          ? 'Continue observation and controlled exercise'
          : 'Rest and reassess gait before increasing work',
    }),
  );
  const incidents: Prisma.IncidentReportUncheckedCreateInput[] = Array.from(
    { length: 6 },
    (_, i) => ({
      id: demoId('incident', i),
      horseId: demoId('horse', i),
      reportedById: users[3].id,
      description:
        'Mild swelling noticed during morning grooming; veterinary assessment requested',
      severity: i % 2 ? 'LOW' : 'MEDIUM',
      status: 'OPEN',
    }),
  );
  const injuries: Prisma.InjuryLocationUncheckedCreateInput[] = regions.map(
    (r, i) => ({
      id: demoId('injury', i),
      healthRecordId: demoId('health', i),
      bodyRegion: r.key,
      side: i % 2 ? 'R' : 'L',
      notes: 'Local tenderness assessed during examination',
    }),
  );
  const treatments: Prisma.TreatmentPlanUncheckedCreateInput[] = Array.from(
    { length: 6 },
    (_, i) => ({
      id: demoId('treatment', i),
      healthRecordId: demoId('health', i),
      description: 'Controlled rest and daily comfort assessment',
      startDate: at(-110 + i),
      endDate: at(-103 + i),
      status: 'COMPLETED',
    }),
  );
  const medications: Prisma.MedicationUncheckedCreateInput[] = treatments.map(
    (t, i) => ({
      id: demoId('medication', i),
      healthRecordId: t.healthRecordId,
      treatmentPlanId: t.id,
      name: 'Veterinary electrolyte supplement',
      dosage: 'As prescribed by attending veterinarian',
      startDate: t.startDate,
      endDate: t.endDate,
    }),
  );
  const vaccinations: Prisma.VaccinationUncheckedCreateInput[] = Array.from(
    { length: 8 },
    (_, i) => ({
      id: demoId('care', i),
      horseId: demoId('horse', i),
      vaccineName:
        i % 2 ? 'Routine parasite control' : 'Equine influenza booster',
      careType: i % 2 ? 'DEWORMING' : 'VACCINATION',
      date: at(-30),
      nextDueDate: at(150),
    }),
  );
  return {
    users,
    horses,
    plans,
    sessions,
    records,
    incidents,
    injuries,
    treatments,
    medications,
    vaccinations,
  };
}
