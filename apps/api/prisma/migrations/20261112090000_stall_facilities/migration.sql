-- CreateEnum
CREATE TYPE "StallStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE', 'DISINFECTING', 'QUARANTINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'STALL_STATUS_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'STALL_STATUS_APPROVED';

-- CreateTable
CREATE TABLE "Stall" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "barn" TEXT NOT NULL,
    "status" "StallStatus" NOT NULL DEFAULT 'AVAILABLE',
    "pendingStatus" "StallStatus",
    "pendingNotes" TEXT,
    "pendingRequestedById" TEXT,
    "pendingRequestedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stall_code_key" ON "Stall"("code");

-- CreateIndex
CREATE INDEX "Stall_barn_idx" ON "Stall"("barn");

-- CreateIndex
CREATE INDEX "Stall_status_idx" ON "Stall"("status");


-- Backfill: the stall map used a fixed grid A-01..C-10. Create those stalls,
-- plus any other stall code a horse already uses; occupied when a horse is in it.
INSERT INTO "Stall" ("id", "code", "barn", "status", "updatedAt")
SELECT gen_random_uuid()::text, c.code, left(c.code, 1),
       CASE WHEN EXISTS (
         SELECT 1 FROM "Horse" h
         WHERE h."deletedAt" IS NULL AND upper(trim(h."stallNumber")) = c.code
       ) THEN 'OCCUPIED'::"StallStatus" ELSE 'AVAILABLE'::"StallStatus" END,
       CURRENT_TIMESTAMP
FROM (
  SELECT b || '-' || lpad(n::text, 2, '0') AS code
  FROM unnest(ARRAY['A', 'B', 'C']) AS b, generate_series(1, 10) AS n
  UNION
  SELECT DISTINCT upper(trim("stallNumber"))
  FROM "Horse"
  WHERE "deletedAt" IS NULL AND "stallNumber" IS NOT NULL AND trim("stallNumber") <> ''
) c
ON CONFLICT ("code") DO NOTHING;
