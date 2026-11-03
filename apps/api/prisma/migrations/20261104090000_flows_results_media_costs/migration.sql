-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PLAN_OVERDUE';

-- AlterTable
ALTER TABLE "FeedingRecord" ADD COLUMN     "costVnd" INTEGER;

-- AlterTable
ALTER TABLE "SupplyItem" ADD COLUMN     "unitPrice" INTEGER;

-- AlterTable
ALTER TABLE "TrainingPlan" ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "targetDistanceM" INTEGER;

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "finishTimeSec" DOUBLE PRECISION,
ADD COLUMN     "muscleResponse" TEXT,
ADD COLUMN     "recoveryHeartRate" INTEGER;

-- CreateTable
CREATE TABLE "TrainingMedia" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingMedia_horseId_createdAt_idx" ON "TrainingMedia"("horseId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrainingMedia" ADD CONSTRAINT "TrainingMedia_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMedia" ADD CONSTRAINT "TrainingMedia_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMedia" ADD CONSTRAINT "TrainingMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

