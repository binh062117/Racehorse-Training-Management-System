import { Prisma, PrismaClient } from '@prisma/client';
import { hash, compare } from 'bcrypt';
import { buildHaiDemo } from './hai-demo-data';

async function main() {
  const data = buildHaiDemo(process.env.HAI_DEMO_ANCHOR ?? '2026-10-29');
  const expected = Object.fromEntries(
    Object.entries(data).map(([model, rows]) => [model, rows.length]),
  );
  if (!process.argv.includes('--execute')) {
    console.log(JSON.stringify({ mode: 'DRY_RUN_NO_CONNECTION', expected }));
    return;
  }
  if (
    process.env.HAI_DEMO_CONFIRM !== 'YES' ||
    process.env.HAI_DEMO_DISPOSABLE !== 'YES' ||
    !process.env.HAI_DEMO_ANCHOR ||
    !process.env.HAI_DEMO_PASSWORD ||
    !process.env.DATABASE_URL
  )
    throw new Error(
      'Execution requires confirmation, disposable DB acknowledgement, explicit anchor, password and database URL',
    );
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Invalid PostgreSQL URL');
  const anchor = new Date(`${process.env.HAI_DEMO_ANCHOR}T00:00:00Z`);
  if (Math.abs(Date.now() - anchor.getTime()) > 2 * 86400000)
    throw new Error(
      'Use an anchor within two days of execution; preserve it for idempotent reruns',
    );
  const password = process.env.HAI_DEMO_PASSWORD;
  const passwordHash = await hash(password, 12);
  const prisma = new PrismaClient();
  try {
    const counts = await prisma.$transaction(
      async (tx) => {
        const counts: Record<string, { created: number; reused: number }> = {};
        async function ensure(
          model: string,
          expectedRow: object,
          read: () => Promise<object | null>,
          create: () => Promise<object>,
        ) {
          counts[model] ??= { created: 0, reused: 0 };
          const found = await read();
          if (found) {
            const row = found as Record<string, unknown>;
            for (const [key, value] of Object.entries(expectedRow)) {
              // The automatic job may have closed an overdue fixture since the prior run.
              if (
                model === 'TrainingSession' &&
                key === 'status' &&
                value === 'PLANNED' &&
                row[key] === 'MISSED' &&
                new Date(row.scheduledAt as string) < new Date()
              )
                continue;
              if (JSON.stringify(row[key]) !== JSON.stringify(value))
                throw new Error(
                  `Collision or changed fixture in ${model}; transaction cancelled`,
                );
            }
            if (
              model === 'User' &&
              !(await compare(password, String(row.passwordHash)))
            )
              throw new Error(
                'Existing fixture account password differs; transaction cancelled',
              );
            counts[model].reused++;
          } else {
            await create();
            counts[model].created++;
          }
        }
        for (const r of data.users)
          await ensure(
            'User',
            r,
            () => tx.user.findUnique({ where: { id: r.id } }),
            () => tx.user.create({ data: { ...r, passwordHash } }),
          );
        for (const r of data.horses)
          await ensure(
            'Horse',
            r,
            () => tx.horse.findUnique({ where: { id: r.id } }),
            () => tx.horse.create({ data: r }),
          );
        for (const r of data.plans)
          await ensure(
            'TrainingPlan',
            r,
            () => tx.trainingPlan.findUnique({ where: { id: r.id } }),
            () => tx.trainingPlan.create({ data: r }),
          );
        for (const r of data.sessions)
          await ensure(
            'TrainingSession',
            r,
            () => tx.trainingSession.findUnique({ where: { id: r.id } }),
            () => tx.trainingSession.create({ data: r }),
          );
        for (const r of data.records)
          await ensure(
            'HealthRecord',
            r,
            () => tx.healthRecord.findUnique({ where: { id: r.id } }),
            () => tx.healthRecord.create({ data: r }),
          );
        for (const r of data.incidents)
          await ensure(
            'IncidentReport',
            r,
            () => tx.incidentReport.findUnique({ where: { id: r.id } }),
            () => tx.incidentReport.create({ data: r }),
          );
        for (const r of data.injuries)
          await ensure(
            'InjuryLocation',
            r,
            () => tx.injuryLocation.findUnique({ where: { id: r.id } }),
            () => tx.injuryLocation.create({ data: r }),
          );
        for (const r of data.treatments)
          await ensure(
            'TreatmentPlan',
            r,
            () => tx.treatmentPlan.findUnique({ where: { id: r.id } }),
            () => tx.treatmentPlan.create({ data: r }),
          );
        for (const r of data.medications)
          await ensure(
            'Medication',
            r,
            () => tx.medication.findUnique({ where: { id: r.id } }),
            () => tx.medication.create({ data: r }),
          );
        for (const r of data.vaccinations)
          await ensure(
            'Vaccination',
            r,
            () => tx.vaccination.findUnique({ where: { id: r.id } }),
            () => tx.vaccination.create({ data: r }),
          );
        return counts;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120_000,
      },
    );
    console.log(
      JSON.stringify({
        transaction: 'COMMITTED',
        counts,
        notifications: 0,
        nonDemoModified: 0,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  // Never echo Prisma connection strings, arguments, password hashes or account passwords.
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : 'FAILED';
  console.error(
    `Seed stopped (${code}); no recovery attempted. Any active transaction was rolled back.`,
  );
  process.exitCode = 1;
});
