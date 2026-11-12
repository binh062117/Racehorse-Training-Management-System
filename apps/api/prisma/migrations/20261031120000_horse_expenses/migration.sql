CREATE TABLE "HorseExpense" (
  "id" TEXT NOT NULL,
  "horseId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HorseExpense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HorseExpense_amount_check" CHECK ("amount" > 0)
);
CREATE INDEX "HorseExpense_horseId_date_idx" ON "HorseExpense"("horseId", "date");
ALTER TABLE "HorseExpense" ADD CONSTRAINT "HorseExpense_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
