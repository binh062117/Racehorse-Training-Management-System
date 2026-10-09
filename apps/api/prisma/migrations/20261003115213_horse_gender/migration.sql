-- CreateEnum
CREATE TYPE "HorseGender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "gender" "HorseGender";

