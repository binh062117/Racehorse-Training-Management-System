-- Additive only; apply separately after review.
ALTER TYPE "SessionStatus" ADD VALUE 'MISSED';
ALTER TABLE "TrainingSession" ADD COLUMN "groomId" TEXT;
CREATE INDEX "TrainingSession_groomId_idx" ON "TrainingSession"("groomId");
CREATE INDEX "TrainingSession_status_scheduledAt_idx" ON "TrainingSession"("status", "scheduledAt");
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_groomId_fkey"
FOREIGN KEY ("groomId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
