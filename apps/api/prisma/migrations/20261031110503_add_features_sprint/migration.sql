-- CreateEnum
CREATE TYPE "RaceEntryStatus" AS ENUM ('PENDING', 'COMPLETED', 'WITHDRAWN', 'DID_NOT_START');

-- AlterEnum
ALTER TYPE "PreventiveCareType" ADD VALUE 'FARRIER';

-- AlterTable
ALTER TABLE "RaceEntry" ADD COLUMN     "prizeWon" DOUBLE PRECISION,
ADD COLUMN     "status" "RaceEntryStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "resultConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resultRecordedById" TEXT;

-- CreateTable
CREATE TABLE "TrialVideo" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "duration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialVideo_horseId_idx" ON "TrialVideo"("horseId");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_resultRecordedById_fkey" FOREIGN KEY ("resultRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialVideo" ADD CONSTRAINT "TrialVideo_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
