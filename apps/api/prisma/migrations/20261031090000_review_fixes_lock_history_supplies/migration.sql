-- CreateEnum
CREATE TYPE "SupplyCategory" AS ENUM ('FEED', 'MEDICINE', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "SupplyRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SUPPLY_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SUPPLY_REVIEWED';

-- AlterTable
ALTER TABLE "FeedingRecord" ADD COLUMN     "supplyItemId" TEXT;

-- AlterTable
ALTER TABLE "HealthRecord" ADD COLUMN     "healthStatus" "HealthStatus";

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "lockIncidentId" TEXT;

-- CreateTable
CREATE TABLE "HorseLockEvent" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "healthRecordId" TEXT,
    "incidentReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorseLockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SupplyCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRequest" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "status" "SupplyRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorseLockEvent_horseId_createdAt_idx" ON "HorseLockEvent"("horseId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplyItem_category_idx" ON "SupplyItem"("category");

-- CreateIndex
CREATE INDEX "SupplyRequest_status_createdAt_idx" ON "SupplyRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "FeedingRecord" ADD CONSTRAINT "FeedingRecord_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "SupplyItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseLockEvent" ADD CONSTRAINT "HorseLockEvent_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseLockEvent" ADD CONSTRAINT "HorseLockEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseLockEvent" ADD CONSTRAINT "HorseLockEvent_healthRecordId_fkey" FOREIGN KEY ("healthRecordId") REFERENCES "HealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseLockEvent" ADD CONSTRAINT "HorseLockEvent_incidentReportId_fkey" FOREIGN KEY ("incidentReportId") REFERENCES "IncidentReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SupplyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRequest" ADD CONSTRAINT "SupplyRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: a horse auto-locked by a HIGH incident ("Incident: …" reason) is tied
-- to its newest unresolved HIGH incident, so resolving that incident unlocks it.
UPDATE "Horse" h SET "lockIncidentId" = (
  SELECT i."id" FROM "IncidentReport" i
  WHERE i."horseId" = h."id" AND i."severity" = 'HIGH' AND i."status" <> 'RESOLVED'
  ORDER BY i."createdAt" DESC LIMIT 1
)
WHERE h."locked" = true AND h."lockReason" LIKE 'Incident:%';

-- Backfill: every horse locked today starts its history with one event.
INSERT INTO "HorseLockEvent" ("id", "horseId", "locked", "reason", "incidentReportId", "createdAt")
SELECT gen_random_uuid()::text, h."id", true, COALESCE(NULLIF(h."lockReason", ''), 'Khóa trước khi có lịch sử khóa tập'), h."lockIncidentId", h."updatedAt"
FROM "Horse" h WHERE h."locked" = true;
