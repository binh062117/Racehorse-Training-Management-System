-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "groomId" TEXT,
ADD COLUMN     "stallNumber" TEXT,
ADD COLUMN     "trainerId" TEXT;

-- CreateTable
CREATE TABLE "FitnessAssessment" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "assessedById" TEXT NOT NULL,
    "speedScore" INTEGER NOT NULL,
    "staminaScore" INTEGER NOT NULL,
    "conditionScore" INTEGER NOT NULL,
    "recoveryScore" INTEGER NOT NULL,
    "moraleScore" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitnessAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FitnessAssessment_horseId_createdAt_idx" ON "FitnessAssessment"("horseId", "createdAt");

-- CreateIndex
CREATE INDEX "FitnessAssessment_assessedById_idx" ON "FitnessAssessment"("assessedById");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessAssessment" ADD CONSTRAINT "FitnessAssessment_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitnessAssessment" ADD CONSTRAINT "FitnessAssessment_assessedById_fkey" FOREIGN KEY ("assessedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

