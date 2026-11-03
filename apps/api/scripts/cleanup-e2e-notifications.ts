import { Prisma, PrismaClient } from '@prisma/client';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const execute = process.argv.includes('--execute');
  if (execute && process.env.HAI_CLEANUP_CONFIRM !== 'YES')
    throw new Error('HAI_CLEANUP_CONFIRM=YES required');
  const prisma = new PrismaClient();
  // PostgreSQL default LIKE semantics: exact case-sensitive substring E2E.
  const where: Prisma.NotificationWhereInput = {
    message: { contains: 'E2E', mode: 'default' },
  };
  try {
    if (!execute) {
      console.log(
        JSON.stringify({
          matching: await prisma.notification.count({ where }),
        }),
      );
      return;
    }
    const deleted = await prisma.$transaction(
      async (tx) => {
        const result = await tx.notification.deleteMany({ where });
        return result.count;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    console.log(JSON.stringify({ deleted }));
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((error: unknown) => {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : 'FAILED';
  console.error(
    `Cleanup stopped (${code}); any active transaction was rolled back.`,
  );
  process.exitCode = 1;
});
