UPDATE "RaceEntry" SET "status" = 'COMPLETED' WHERE "status" = 'PENDING' AND ("position" IS NOT NULL OR "time" IS NOT NULL);
