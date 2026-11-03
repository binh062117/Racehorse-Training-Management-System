# HẢI training and health completion — 2026-10-29

Source: explicit user request to implement the seven remaining HẢI requirements.
This contract supersedes the retrospective session-scheduling permission in
phase-3-training.md and the corresponding historical decision. Other roles,
fitness warnings, locks, medical write permissions and ownership rules remain.

## Training states and time

- `MISSED` is persisted and terminal, alongside `DONE` and `CANCELLED`.
- On application bootstrap and every 60 seconds, a lifecycle-managed Nest provider
  updates only `PLANNED AND scheduledAt < now` to `MISSED`. It retries next tick on
  failure, prevents overlapping ticks in one process, and clears its timer on shutdown.
  Multiple API instances are safe because the update is conditional/idempotent.
- Training reads reconcile overdue sessions as well. Single-session/plan reads check
  ownership first. The job emits no notifications. Missed sessions cannot be edited,
  reopened, completed or cancelled. Clients cannot manually assign MISSED.
- This is a strict scheduled-instant cutoff, with **no grace period**: an overdue
  PLANNED session cannot subsequently receive a result. This follows the new request;
  a future late-result workflow would require a separate approved product change.
- Create and reschedule reject past instants with `VALIDATION_ERROR`. Conditional
  updates protect terminal states against concurrent scheduler/result writes.
- Plans represent calendar dates in `Asia/Ho_Chi_Minh` (UTC+07, no DST). Compare the
  session's club calendar day with the stored start/end club calendar days, inclusive.
  Thus 15:00 on the end date is valid. Null end means no upper bound.
- Validate plan existence and same horse on create, plan reassignment and reschedule.
- EX-01 remains inclusive ±60 minutes for PLANNED sessions, excludes the edited ID,
  and remains enforced by the server across **all** pages. The browser's early clash
  warning uses the displayed page; off-page clashes still return a localized 409.
- Lock restriction and `heart_rate_max > 195` warnings are unchanged.

## Assigned groom and authorization

- Nullable `TrainingSession.groomId` references User via `SessionGroom`; existing
  sessions remain valid. `trainerId` still identifies the creator/responsible trainer.
- Supplied groom must exist, be ACTIVE, not soft-deleted, and have role GROOM.
  Null clears assignment on update. API responses include `{id, name}` for groom.
- `GET /training/grooms?page=&limit=`: TRAINER only, paginated ACTIVE GROOM names/IDs.
  Existing MANAGER-only user administration endpoint is unchanged.
- TRAINER alone creates/schedules/assigns. GROOM retains only status/result updates;
  being assigned does not grant scheduling privileges or narrow existing result rights.

## Pagination and health

- Keep `{data, meta: {page, limit, total}}`; UI page size 20, server limit maximum 100.
- Session and horse examination tabs request one page, not the whole dataset.
- Health Records page paginates horses and examinations independently, resetting both
  on search/health-filter changes. `GET /health-records` replaces the former capped
  100-horse/50-horse fan-out and accepts page, limit, q, healthStatus, from and to.
- New global read and `GET /health-records/horse-summary` exclude deleted horses and
  constrain OWNER to `ownerId = currentUser.id`. Existing frontend page stays VET-only.
- Summary counts use server aggregates, not counts of the current page. Ordering has
  an ID tie-breaker. Out-of-range API pages return empty data with the actual total;
  pagination controls permit navigation back to valid pages.
- Creating an examination refreshes page 1 and the parent horse. Editing/uploading
  refreshes the current examination page. Treatment/medication/attachment contracts
  and VET-only writes are preserved.

## Injury map

- Reuse `HorseMap`; no duplicate diagram. Mouse, Enter and Space select regions;
  the selected region is announced and buttons expose pressed state.
- `shared/injury-regions.json` is the canonical list reused by UI and demo manifest.
  New records store stable region keys (`head`, `neck`, etc.), never translated labels.
  EN/VI labels are translated separately. Old Vietnamese names map to the same diagram;
  unknown legacy/custom values remain readable. No existing rows are rewritten.
- Backend keeps accepting old free-text locations; no data rewrite or new enum.

## Club overview

- `GET /training/progress/overview` and `/training/progress` UI: MANAGER and TRAINER
  only. Service also rejects other roles before querying. No OWNER club-data access.
- SQL/group aggregates exclude deleted horses; return all-time counts for all four
  statuses, total, completion and eight Monday-based weeks including current week.
  Weekly rows use scheduledAt in Vietnam time and include all four statuses.
- **Completion stays DONE / (DONE + CANCELLED)**, rounded to integer percent, null
  when denominator is zero. MISSED is displayed separately. Whether to include it
  in the denominator is a product follow-up, not silently implemented here.
- Reuse existing shell, loading/error/empty UI; scoped light/dark design-system tokens
  are used for the new overview and interactive map, without a local theme switch.

## Migration and rollout

`20261029090000_hai_training_sessions/migration.sql` adds enum value MISSED,
nullable TEXT groomId (consistent with existing UUID-string IDs), groom FK with
ON DELETE SET NULL / ON UPDATE CASCADE, and groom/status-time indexes. No data
deletion, reset, backfill, column removal or old-row invalidation.

Migration has **not** been executed. Review shared API/schema changes with the
training owner/team leader as required by TEAM_RULES before integration/deployment.
Apply the reviewed migration before starting this API: startup runs reconciliation.
No live database or E2E verification was authorized for implementation.
