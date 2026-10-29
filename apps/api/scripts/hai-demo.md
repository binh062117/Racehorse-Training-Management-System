# HẢI fixtures and E2E-notification cleanup

Prepared only. Neither script has been executed against a database. Existing local
seed scripts/data are not replaced. These new files are intentionally available for
review; they are not ignored by the repository.

## Fictional fixture dataset

`seed-hai-demo.ts` uses `hai-demo-data.ts`, deterministic UUIDs and one SERIALIZABLE
transaction. It only creates missing fixture IDs. Matching rows are reused after
checking specified fields; collisions, changed identities/relations, different
passwords or unique-constraint failures roll back the whole transaction. It never
updates/deletes real or fixture rows and never inserts Notifications. A previously
overdue PLANNED fixture already transitioned to MISSED is accepted on rerun.

Manifest: 5 users, 105 horses, 105 plans, 57 sessions, 110 examinations, 6 incidents,
12 injury locations, 6 treatment plans, 6 medications, 8 preventive-care records.
Names are fictional (for example Amber Breeze, Willow Dancer, Linh Nguyen);
accounts use reserved `.invalid` emails. No embedded passwords/connection strings.
Medications are fictional demonstration content, not veterinary instructions.

Normal invocation is an offline manifest-only dry-run and never constructs a Prisma
client. Execution requires `--execute`, DATABASE_URL, HAI_DEMO_PASSWORD,
HAI_DEMO_CONFIRM=YES, HAI_DEMO_DISPOSABLE=YES and explicit HAI_DEMO_ANCHOR=YYYY-MM-DD.
Use a dedicated disposable DB **after** applying the reviewed migration separately.
Keep the same anchor/password for reruns. Anchor must be within two days of execution;
do not change the anchor on an existing fixture namespace to refresh dates.

From apps/api (commands for later authorized use, not executed during this task):

```powershell
# Offline manifest preview; no connection
node node_modules/ts-node/dist/bin.js --project scripts/tsconfig.hai.json scripts/seed-hai-demo.ts
# Execution requires all guards above in this same shell
node node_modules/ts-node/dist/bin.js --project scripts/tsconfig.hai.json scripts/seed-hai-demo.ts --execute
```

Review scenarios:

- Amber Breeze: >20 sessions, >100 examinations; >100 horses for page-6 navigation.
- Future sessions inside plan dates, with Khoa Pham assigned as GROOM.
- Multiple historical weeks with DONE/CANCELLED/MISSED for nonempty club charts.
- Morning hand walk on the prior day intentionally PLANNED: demonstrate the automatic
  job in a disposable environment. Stop API during fixture loading to observe it
  transitioning at bootstrap; do not use this scenario in a shared database.
- Try scheduling yesterday through the app: validation must reject; no invalid
  session is created via normal app logic. Try after the plan's final calendar day:
  rejected. Try 15:00 on that final day: permitted if future and conflict-free.
- Injury records use exactly the canonical map values; clinical text remains user data.
- Locked and varied-health horses are included. Fixture insertion does not invoke
  application notification/AI services. It does not prove live database trigger behavior.

## Notification cleanup

`cleanup-e2e-notifications.ts` targets **only Notification.message containing the
case-sensitive substring `E2E`** (PostgreSQL default LIKE). Lowercase `e2e` does not
match; a larger message containing uppercase E2E does. No other table is touched.

Dry-run connects read-only and prints the matching count only. Execution additionally
requires `--execute` and HAI_CLEANUP_CONFIRM=YES, uses one SERIALIZABLE transaction,
and prints deleted count. Both modes require DATABASE_URL; neither was run here.

```powershell
node node_modules/ts-node/dist/bin.js --project scripts/tsconfig.hai.json scripts/cleanup-e2e-notifications.ts
node node_modules/ts-node/dist/bin.js --project scripts/tsconfig.hai.json scripts/cleanup-e2e-notifications.ts --execute
```

No automatic retry or destructive recovery. Failure output includes a Prisma code
where available, never URLs/passwords/query arguments. No secrets belong in this file.

## Safe local verification

From repository root: `node scripts/check-hai-offline.cjs` checks only pure manifest
generation, UI helpers/map interactions, localization and script source. It does not
execute either entrypoint. From apps/api: `node node_modules/typescript/bin/tsc --project
scripts/tsconfig.hai.json --noEmit` type-checks scripts without connecting.
