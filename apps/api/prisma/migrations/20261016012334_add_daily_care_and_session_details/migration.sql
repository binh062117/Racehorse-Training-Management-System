-- CreateEnum
CREATE TYPE "DailyCareTask" AS ENUM ('FEEDING', 'CLEANING', 'BATHING', 'ICE_SOAK', 'HEALTH_CHECK');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PREVENTIVE_CARE_DUE';

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "distanceM" INTEGER,
ADD COLUMN     "surface" TEXT;

-- CreateTable
CREATE TABLE "DailyCareLog" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "groomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskType" "DailyCareTask" NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCareLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyCareLog_horseId_date_idx" ON "DailyCareLog"("horseId", "date");

-- CreateIndex
CREATE INDEX "DailyCareLog_groomId_idx" ON "DailyCareLog"("groomId");

-- CreateIndex
CREATE INDEX "DailyCareLog_completed_idx" ON "DailyCareLog"("completed");

-- AddForeignKey
ALTER TABLE "DailyCareLog" ADD CONSTRAINT "DailyCareLog_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCareLog" ADD CONSTRAINT "DailyCareLog_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
