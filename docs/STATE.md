# STATE — tiến độ & điểm bàn giao

> File này là **điểm vào cho mỗi phiên làm việc mới**. Đọc file này trước, rồi
> mới tới [PLAN.md](PLAN.md) và [DECISIONS.md](DECISIONS.md).
> Cập nhật file này mỗi khi kết thúc một mảng việc.

> Historical testing-branch claim (2026-09-30; not validation of this merge): Cập nhật lần cuối: **2026-09-30** — hoàn thành thiết kế và triển khai **Flow 1 Frontend (Horse Profile Management)** theo chuẩn `racehorse-design-system.html` (Tone Navy `#1c2b3a` / Cream `#f5f4f1` / Blue accent `#1a4b8a`, font Inter, status badges, metric cards, modal CRUD, phả hệ 3 đời, upload ảnh). Toàn bộ 149 test E2E backend + frontend build/lint đều PASS 100%.
Latest review: **2026-10-02** ? committed testing/Hai-work merge; see review below.

Tổng kết backend (lịch sử): **2026-09-25** — kết thúc Phase 10 (Health & Injury
extensions), hoàn tất Sprint 3 theo `CLAUDE_CODE_BACKEND_FULL.md` (xem
[DECISIONS.md](DECISIONS.md)). **MVP (Phase 0-5) vẫn DONE**; 3 luồng mở rộng
(Phase 6-8) xong phần API; Phase 9 (Sprint 2 remainder) + Phase 10 (Sprint 3
remainder) **xong** — toàn bộ `CLAUDE_CODE_BACKEND_FULL.md` (Sprint 0-3) đã
được đối chiếu/hoàn thành phía API. Còn lại chủ yếu là **frontend** — xem §4.

---

## Horse Gender Integration — Xem & Tạo ngựa - 2026-10-05

Bổ sung hiển thị và nhập liệu **Giới tính ngựa (Horse Gender)** (`MALE` / `FEMALE`) trên toàn bộ các trang liên quan:

### Thay đổi Frontend
1. **`HorseFormPage.tsx`** (Trang tạo / sửa hồ sơ `/horses/new` & `/horses/:id/edit`):
   - Thêm trường `gender: HorseGender | ''` vào `HorseFormState` và `EMPTY_FORM`.
   - Nạp `gender` từ `detailResponse` khi sửa ngựa.
   - Gửi `gender` trong payload khi tạo mới (`api.post`) và cập nhật (`api.patch`).
   - Thêm dropdown `<Field label={t('horse.gender')}>` (Đực / Cái / Chưa rõ).
2. **`CreateHorseModal.tsx`** (Modal tạo ngựa nhanh trên `HorsesPage`):
   - Sử dụng type `HorseGender | ''`, thêm lựa chọn `— Chưa rõ —` và chỉ gửi trường `gender` khi được chọn.
3. **`HorsesPage.tsx`** (Bảng danh sách ngựa):
   - Thêm cột `<th>Giới tính</th>` và hiển thị badge trung tính (`Đực` / `Cái` / `Chưa rõ`).
4. **`HorseDetailPage.tsx`** (Trang chi tiết ngựa):
   - Hero header: Hiển thị giới tính trong dòng tóm tắt cạnh giống loài và tuổi.
   - Tab Thông tin lý lịch (`tab === 'profile'`): Thêm dòng `dt/dd` hiển thị Giới tính (`Đực` / `Cái` / `Chưa xác định`).
5. **`DashboardPage.tsx`** (Danh sách ngựa gần đây):
   - Hiển thị giới tính trong dòng mô tả phụ của mỗi ngựa.
6. **`HealthRecordsPage.tsx`** (Bảng sơ đồ sức khỏe ngựa):
   - Thêm cột `<th>Giới tính</th>` hiển thị badge `Đực` / `Cái`.
7. **`i18n/vi.json` & `i18n/en.json`**:
   - Thêm các key `gender`, `genderMale`, `genderFemale`, `genderUnknown` trong section `horse`.

### Build & Test
- Frontend: `tsc -b && vite build` PASS (141 modules, 533.34 kB).
- Linter: `oxlint` PASS (0 errors).

---

## Record Medical Examination — cải tiến giao diện VET - 2026-10-05

Nâng cấp chức năng "Ghi nhận hồ sơ khám bệnh" cho role VET (Bác sĩ Thú y):

### Thay đổi Frontend

1. **`CreateHealthRecordModal.tsx`** (MỚI) — Modal ghi nhận hồ sơ khám theo
   design system (modal-overlay, modal-content, modal-header, modal-footer).
   Bổ sung trường **`healthStatus`** (FIT / MONITORING / INJURED / QUARANTINED)
   để VET cập nhật trạng thái sức khỏe khi khám. Có cảnh báo khi chọn
   INJURED/QUARANTINED (ảnh hưởng tới khóa tập/giải đua).

2. **`HealthTab.tsx`** (REFACTOR) — Thay thế inline form bằng modal. Thêm:
   - Toolbar với nút "Ghi nhận hồ sơ khám" (VET only).
   - Summary card: trạng thái sức khỏe hiện tại, tổng số lần khám, lần khám
     gần nhất.
   - Cải thiện layout record list (date + vet header, diagnosis/treatment
     sections, inline edit, attachment upload).
   - Prop thay đổi: `{ horseId: string }` → `{ horse: Horse }`.

3. **`HealthRecordsPage.tsx`** (MỚI) — Trang tổng quan "Hồ sơ khám bệnh"
   toàn đàn cho VET tại route `/health-records`. Bao gồm:
   - KPI tiles (tổng đàn, khỏe mạnh, cần theo dõi, chấn thương/cách ly,
     khóa tập).
   - Bảng sơ đồ trạng thái sức khỏe toàn đàn (tên, giống, trạng thái y tế,
     khóa tập) với search và filter theo healthStatus.
   - Nút "Khám" nhanh trên mỗi dòng → mở modal tạo hồ sơ khám.
   - Danh sách hồ sơ khám gần đây (20 bản ghi mới nhất, click → chi tiết ngựa).

4. **`Layout.tsx`** — Sidebar VET: link "Hồ sơ khám bệnh" kích hoạt
   (thay placeholder "Sắp có"). Topbar title mapping cho `/health-records`.

5. **`HorseDetailPage.tsx`** — `<HealthTab horse={horse} />` thay vì
   `<HealthTab horseId={horse.id} />`.

6. **`main.tsx`** — Route `/health-records` restricted `@Roles(['VET'])`.

### Backend — không thay đổi
API đã hỗ trợ đầy đủ từ trước (POST/GET/PATCH health-records, attachment, healthStatus).

### Build & Test
- Frontend: `tsc -b && vite build` PASS (141 modules, 531 kB).
- Backend: `nest build` PASS.

---

## UC-10 read-only schedule hierarchy - 2026-10-03

Grouped already-loaded sessions by Vietnam calendar date; time uses the same
Asia/Ho_Chi_Minh display zone. Scoped CSS emphasizes time, uppercase type and
adjacent status badge, plan title, secondary trainer and notes, with a subtle
navy summary border. Success notice is compact; its existing clearing behavior
is unchanged. No extra requests, business-rule or serialization changes.
Creation modal and protected UC-11 state/handler/result/update JSX were verified
byte-identical to the pre-refinement snapshot. Browser mocks passed UTC-midnight
date grouping, EN/VI, 320px summary containment, modal create/refresh and result
save. Desktop screenshot inspected. Build passed (138 modules, 516.02 kB bundle
warning); lint passed with 13 existing warnings; diff check passed. No backend,
DB, staging, commit or push operations.

## UC-10 scheduling presentation refinement - 2026-10-03

Scheduling now opens from a Trainer-only action in the shared modal style, with
Cancel/X and compact footer actions. Successful creation closes the modal and
refreshes sessions. Read-only summaries separate date/type/status badge and show
plan goal (or no-plan/unavailable fallback), trainer and secondary notes. Shared
same-horse plan pagination feeds both summaries and modal; no per-session reads.
No scheduling contract, validation, time serialization, role or lock rule changes.
UC-11 state/save handler and entire update button/form JSX verified byte-identical
to the pre-refinement file; protected translations also unchanged. Backend untouched.
Mock browser checks passed collapse/open/Cancel/X, with/without-plan saves,
validation, conflict/lock detail, status/plan summaries, OWNER controls, EN/VI,
390px modal and 320px summary containment, and existing result-save behavior.
Build passed (137 modules, 515.60 kB JS); lint passed with existing warnings.
No conflict markers; git diff --check passed. No DB writes, staging, commit or push.

## UC-10 daily session scheduling - 2026-10-03

Audit started from clean Hai-work HEAD 631f04e. Classification C: frontend
partial, backend complete for the current contract. SessionsTab already creates
sessions and separately edits results; no calendar/daily schedule route exists.
Missing UI: optional same-horse plan selection, scheduling-specific validation
and backend error detail. Its first-100 session limit can hide a newly created
session. Implementation will extend this form/list, not create a competing UI.

Contract: POST /horses/:id/sessions (TRAINER) accepts scheduledAt, type (1..80),
notes (optional, <=2000), planId (optional UUID, same horse). trainerId is the
caller; status defaults PLANNED. GET horse sessions and GET /sessions/:id allow
all authenticated roles with OWNER horse scoping. PATCH permits TRAINER fields
or GROOM status/result only; terminal sessions cannot change; DONE needs results.
Plan POST/PATCH are TRAINER-only; plan reads are authenticated/OWNER-scoped.
Plan dates must be ordered; plan creation blocks RETIRED/QUARANTINED, not locked.
Session creation checks lock, then plan, then schedule conflicts; past/future
ISO dates allowed, no plan-date-bound constraint. No duration/distance/surface/
groom-assignment fields exist; only type and notes describe the scheduled work.
Training lock is Horse.locked/lockReason, not a separate model.

Evidence: training controller/service/DTOs/schema; specs phase-3-training,
phase-7-training-plan-lock, phase-9-training-safety; API/DATA_MODEL/DECISIONS.
Discrepancies retained: phase-9 prose says under 60 minutes, service uses inclusive
+/-60; DATA_MODEL claims timestamptz but schema has plain Prisma DateTime (no
native timezone annotation). Historical API Phase 3 says plans are missing;
Phase 7 supersedes that statement. No backend behavior/schema changes planned.
Existing input conversion is browser-local -> UTC ISO; display is explicitly
Asia/Ho_Chi_Minh. Keep the helper and label these conventions. No duplicate
training routes, creation forms, DTO fields or TrainingSession declarations found.

Implementation complete: extended the existing SessionsTab form with optional
same-horse plan selection (all pages), retry on plan load failure, local required/
length validation, backend scheduling error details, and a save confirmation.
No-plan scheduling remains available if optional plan loading fails. Session
refresh now reads all pages so later sessions are visible. Initial reads abort
on unmount; horse-keyed content resets form/list state across horses. Reused
shared controls and time helper; EN/VI labels explain device input and Vietnam
display time. No CSS, routes, UC-05, UC-09/11 editor, schema or API source changes.

Verification (2026-10-03): web npm run build passed (137 modules, JS 512.66 kB,
existing >500 kB warning); npm run lint passed with the same 13 warnings. API
npx --no-install prisma validate, npx --no-install prisma generate (6.19.3), and
npm run build passed; existing package.json Prisma config deprecation warning.
JSON AST checks found no duplicate keys; session EN/VI keys match. TypeScript AST
checks found no duplicate type/interface declarations or training DTO fields.
No conflict markers; no duplicate scheduling routes/forms; git diff --check passed.

Temporary headless Edge against built Vite preview with all API calls mocked:
Trainer form, required fields/trim validation, >100 plans and sessions, save with
page-two plan and without plan, created session visibility, known/stale locks,
backend date/conflict detail, plan-loading retry, OWNER denial and other role
controls, UC-09 plan create/list, UC-11 Groom results, EN/VI passed. Browser-local
09:30 serialized to 02:30Z in Bangkok and 14:30Z in New York (December fixture).
Final harness run had no uncaught exceptions. These tests validate frontend
behavior; backend role/ownership rules were source-reviewed, not live-tested.

Limitations: no calendar/recurrence, duration/distance/surface fields or explicit
groom/trainer assignment controls; current trainer is assigned by the server.
All-page loading favors correctness for current club scale and can be costly for
large histories. Existing UC-09 Vietnamese-only text and its list limits remain.
No change to inclusive conflict boundary, input/display timezone conventions,
backend state machine or authorization. No migration, seed, E2E, live DB mutation,
staging, commit or push. Ready for human review.

## UC-05 ancestor navigation - 2026-10-02

Known sire/dam/grandparent names now use React Router Link to
/horses/<id>?tab=pedigree. Root and Unknown nodes remain
plain text. Existing shared link styling is reused; no CSS or business-logic
changes. Mocked browser checks passed ancestor navigation, browser Back, direct
Pedigree URLs, manager edit/save and synchronization, pagination, null branches,
non-manager roles, five tabs/one panel and EN/VI. Build and lint passed (existing
bundle-size warning and 13 lint warnings); no conflict markers or duplicate
types/fields; git diff --check passed. No backend/DB commands, commit or push.

## UC-05 visual integration and regression review - 2026-10-02

Continued on Hai-work at merge commit 94fe7a3, preserving all five unstaged
post-merge corrections below. Per the explicit task direction, UC-05 now follows
the CURRENT merged application (navy/Inter), superseding the earlier isolated
Burgundy treatment for this task; this is not a global design-system rewrite.

- Removed feature-local fonts, palette declarations, colored heading and special
  tab styling. Reused shared card, button, input and underline-tab treatments.
- Kept the three-generation tree, stronger root, medium parents, lighter
  grandparents and subdued unknowns. CSS container queries stack narrow panels;
  the compact editor uses two columns where space permits. Every custom selector
  remains scoped beneath .pedigree. No global CSS or translation changes.
- Styling inherits application tokens for future application-level themes;
  there is no local switch or independent dark palette/global theme system.
- No business logic or backend changes in this visual pass. Existing pagination,
  raw parent initialization, validation, null clearing/termination, abort/retry,
  role checks, save refresh and profile/editor synchronization remain intact.

Verification rerun on this working tree:
- Web npm run build: passed (137 modules, JS 509.08 kB); existing >500 kB warning.
- Web npm run lint: exit 0, same 13 existing warnings; no autofix.
- API npx --no-install prisma validate, npx --no-install prisma generate, and
  npm run build: all passed. Generated client 6.19.3; existing package.json Prisma
  configuration deprecation warning. No database migration, seed or E2E run.
- git grep conflict-marker check: no matches; git diff --check: passed.
- TypeScript AST review: unique interface/type declarations and Horse fields;
  Horse fields from both merge parents retained, including healthStatus/locks.
- JSON AST review: no duplicate EN/VI keys, both parents' keys retained, matching
  EN/VI structures. Horse Detail retains five tabs, one UC-05 panel, profile
  actions, query preservation and synchronized parent edits. PedigreeTree remains
  unused; HorsePedigreePage retains the separate read-only route/navigation.
- Temporary headless Edge harness against production preview, all API requests
  mocked: pagination, both editor synchronization directions, null clearing and
  termination, query preservation across all tabs, single sessions/health GET,
  four non-manager read-only roles, EN/VI, native font/tab/shared surface, no local
  toggle, standalone route and no CSS leakage passed; no uncaught exceptions.
  A 320px-wide panel stacked with no tree overflow. Visually inspected profile,
  plans, sessions, pedigree read/edit and standalone screenshots using UC05-Child,
  UC05-Sire and UC05-Dam fixtures. These are mocked UI checks, not live persistence
  or database authorization verification. No real API/database requests.

Remaining limits: existing lint/bundle warnings, profile modal's 100-candidate
limit, Vietnamese-only portions of merged screens, sparse styling on standalone
HorsePedigreePage, and the prior review's backend documentation discrepancies
remain outside this task. Application-wide mobile shell and dark theming were
not redesigned; only the pedigree panel's responsive layout was checked.
Live database/migration state is unverified. No staging, commit, push, pull,
reset or new merge. Stop for human review.

## Merge review ? 2026-10-02

Actual state: merge already committed as `94fe7a3`, parents `a0dace8`
(Hai-work) and `4d26ae0` (testing). Initial working tree clean; no MERGE_HEAD
or staged changes. Reviewed HEAD against both parents without altering history.
No tracked conflict markers found. Both parents' STATE content was retained;
older validation/design claims below remain historical, not current evidence.

Before correction: web build failed with 16 TypeScript errors; lint failed with
three duplicate declarations. Horse repeated sireId/damId/fitnessScore and the
PedigreeNode interface; Horse Detail combined both tab implementations, referenced
undefined t/showing, and duplicated pedigree/session/health renders.

Minimum corrections completed (unstaged):
- Deduplicate types, preserving healthStatus, lock fields and all testing types.
- Keep testing's profile/plans/sessions/health actions and profile default, one
  translated pedigree tab using UC-05, and unrelated query parameters. Existing
  session URLs with ?tab=sessions still work; no-tab URL uses testing's profile.
- Synchronize Horse Detail/profile modal after UC-05 saves; refresh the pedigree
  component after profile-modal writes to prevent stale competing editor values.
- Scope UC-05 node CSS beneath .pedigree so it cannot style testing's standalone
  HorsePedigreePage. Its /horses/:id/pedigree route and HorseRecordNav remain.
  This standalone page is read-only; ?tab=pedigree is the editable manager view.
  PedigreeTree is retained as an unused legacy component, no longer rendered in
  Horse Detail. No route-path collision; two separate presentations remain.
- EN/VI JSON keys are unique and contain all keys from both parents; no changes.

Backend review: merged apps/api matches testing exactly. PreventiveCareType SQL
adds the enum and non-null careType with VACCINATION default, matching schema,
DTO and service. Training-plan list scopes OWNER through horse.ownerId and skips
deleted horses; race-entry restrictions use existing horse fields. Prisma
validate, Prisma generate (6.19.3), and npm run build passed. No migrations,
seed, backend E2E, database inspection/write, pull, reset, commit or push.
Live migration application is unverified. Existing STATE race-entry prose says
TRAINER/injured-horse blocking, but the controller permits MANAGER and service
checks locked/RETIRED/QUARANTINED, not INJURED alone; not changed in this review.
Testing's wider navy/Inter styling and Vietnamese-only screens remain existing
scope; workspace Markdown design rules still govern UC-05. Profile modal horse
candidates still stop at 100 (testing behavior); UC-05 pagination is unchanged.

Post-correction verification:
- Web `npm run build`: passed, 137 modules; existing combined bundle exceeds
  Vite's 500 kB warning threshold (509.08 kB). No dependency/bundling changes.
- Web `npm run lint`: exit 0, 13 warnings in merged testing-side code (state
  effects and memoization). No autofix or unrelated warning cleanup.
- `git diff --check` and `git diff --cached --check`: passed; cached diff is
  empty because the merge had already been committed.
- Temporary headless Edge harness against the built Vite preview, with all API
  requests intercepted/mocked: five tabs/one pedigree panel, parent pagination,
  UC-05 save -> profile editor values, profile save -> tree refresh, null branch
  termination, query preservation, single session/health GET, four read-only
  roles, EN/VI labels, ancestor dark tokens/no local toggle, standalone route
  and navigation without CSS leakage; no uncaught browser exceptions.
  Command: `node "$env:TEMP/uc05-merge-review/merge-smoke.mjs" "$env:TEMP/uc05-merge-review"`
  with `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort`
  in apps/web and an isolated Edge CDP profile on 9335. No real API/DB calls.
  An initial fixture choosing a page-2 parent exposed testing's existing modal
  candidate limit: the raw ID survives but its selected option is absent. The
  two-editor synchronization check then passed with a page-1 candidate; that
  modal limit remains a separate finding, not fixed or concealed here.

No source changes in apps/api, schema/migrations, package files, translations,
or routes. Corrections remain unstaged; no in-progress merge to complete.

---

## UC-05 frontend — 2026-10-01

Status: **UC-05 frontend implementation complete; ready for review.** Build, lint
and mocked browser checks passed. The user subsequently confirmed live GET,
MANAGER editing/PATCH, save-refresh and PostgreSQL parent-ID persistence.
This is user-reported live verification, not a new agent database check.
Scope: primary React SPA pedigree viewing and MANAGER sire/dam editing only.
This dated entry supersedes older statements that the pedigree frontend is absent;
other Phase 6-10 frontend scope is unchanged. Historical phase/spec results below
are not checks run in this task.

### Incremental milestones

1. **Types implemented and checked:** `Horse` now includes nullable `sireId`,
   `damId`, `fitnessScore`; recursive `PedigreeNode` matches the API.
   `npm --prefix apps/web exec -- tsc -b apps/web/tsconfig.json` passed.
2. **Read component implemented and type-checked:** `PedigreeTab.tsx` calls the
   existing pedigree API, renders three nested generations including unknown
   relationships and nullable fitness scores, and handles loading/error/retry.
   Scoped CSS implements the normative light/dark tokens (light default).
   The initial local toggle was removed in review; see correction below.
   TypeScript check above passed again. Browser behavior
   was not yet verified at this milestone; mounting/translations were pending.
3. **MANAGER editor implemented and type-checked:** raw IDs load from Horse;
   candidate loading follows all `/horses` pages and excludes the current horse.
   Selectors disable the opposite parent, offer explicit unknown/null clearing,
   preserve unavailable current IDs, and send only `sireId`/`damId` together via
   `PATCH /horses/:id`. Successful saves trigger pedigree re-fetch; errors stay
   visible and cancel is available. Non-manager UI has no editor. The same
   TypeScript check passed. Runtime browser checks, integration/i18n and final
   verification were pending at this milestone; no live database writes made.
4. **Tab and i18n integrated:** Horse Detail now parses/renders all three tabs,
   supports `?tab=pedigree`, defaults unknown tabs to Sessions, and preserves
   unrelated query parameters. English/Vietnamese pedigree labels and existing
   common Save/Cancel keys are wired. JSON parsing and the TypeScript check
   passed.
5. **Initial final checks:** `npm run build` in `apps/web` passed (TypeScript +
   Vite, 119 modules). `npm run lint` exited 0 with five set-state-in-effect
   warnings: four existing files and one new pedigree loading reset to address.
   The new warning was fixed by resetting loading in user/save handlers.
   Re-ran `npm run build`: passed (119 modules). Re-ran `npm run lint`: exit 0,
   only the four pre-existing warnings in AdminUsersPage, HorsesPage, SessionsTab,
   HealthTab; none in UC-05. `git diff --check` passed.
   Headless Edge against the built Vite preview, with every API request mocked,
   verified loading, seven ancestry slots, zero/null fitness, all five roles,
   candidate pagination beyond 100, self/duplicate exclusion, independent sire
   and dam changes/clears, exact two-field PATCH bodies, selector synchronization,
   no reload, validation errors, candidate retry and post-save refresh retry.
   Also checked raw IDs when traversal suppresses a branch, unavailable parents,
   existing duplicate parents, query preservation, Sessions/Health navigation,
   unknown-tab fallback, mocked OWNER forbidden response, Vietnamese labels,
   375px mobile/editor overflow and no uncaught browser exceptions. The mocked
   forbidden case does not prove live backend authorization. Official fonts loaded;
   light/dark and Vietnamese mobile/editor screenshots visually reviewed.
   Final source/docs diff reviewed: only UC-05 frontend files and this document.

### Review correction — null ancestry branches

`Ancestor` now renders children only when `depth > 1 && node !== null`.
A missing parent displays Unknown once and terminates that branch; it does not
create nested Unknown parents. This supersedes the fixed seven-slot behavior
recorded in the earlier mocked browser checks above. No other UI behavior changed.
After this correction, `npm run build` (TypeScript + Vite) passed and
`npm run lint` exited 0 with the same four pre-existing warnings. The earlier
browser harness was not rerun; its fixed seven-slot assertion is now obsolete.

### Review correction — remove feature-local theme switch

Removed Pedigree's theme state, toggle button, local `data-theme` attribute and
unused `pedigree.darkTheme` translations. Light remains the default; dark tokens
are retained under `[data-theme='dark'] .pedigree` for a future application-level
ancestor attribute. No global theme system was added. The Design System requires
both themes, not a feature-local switch. Earlier toggle-driven browser checks
are historical. After this correction, `npm run build` passed (TypeScript + Vite),
`npm run lint` exited 0 with the same four pre-existing warnings, and
`git diff --check` passed. Browser checks were not rerun for this removal.

### Presentation refinement — ancestry layout

In progress: replace nested cards with a compact root and two horizontal ancestry
branches, collapsing vertically on mobile. Move the existing edit action into
the heading and retain its form above the tree. Presentation only; no new UC
capability, API/state/validation changes, database operations or dependencies.
The null-branch termination fix and ancestor-driven dark tokens remain required.

### Verification commands and remaining manual checklist

Executed from the application repository unless noted:

- `npm --prefix apps/web exec -- tsc -b apps/web/tsconfig.json` after each
  implementation milestone: passed.
- In `apps/web`: `npm run build` passed; `npm run lint` exited 0 with the four
  existing warnings listed above. No backend E2E executed.
- `git status`, `git branch --show-current`, `git diff --stat`,
  `git diff -- apps/web`, `git diff -- docs/STATE.md`, `git diff --check`;
  new (untracked) component/CSS contents also reviewed directly.
- Scoped formatting only:
  `node apps/api/node_modules/prettier/bin/prettier.cjs --config apps/api/.prettierrc --write apps/web/src/pages/horse/PedigreeTab.tsx apps/web/src/pages/horse/PedigreeTab.css apps/web/src/pages/HorseDetailPage.tsx`.
- In `apps/web`: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort`.
- Temporary smoke harness: `node "$env:TEMP/uc05-smoke-012d1eb7304048d4af758b0a044df6e2/smoke.mjs" "$env:TEMP/uc05-smoke-012d1eb7304048d4af758b0a044df6e2"`.
  It uses an isolated headless Edge CDP profile on port 9335 and mock API fixtures;
  no real API/database requests. Harness and screenshots are temporary local
  artifacts, not repository dependencies or a committed regression suite.

Remaining live/manual checks (use designated disposable horse fixtures for edits):

- [ ] MANAGER: open Horses → Horse Detail → Pedigree; check current horse,
  sire, dam and both grandparent branches; null parents/grandparents and fitness.
- [ ] MANAGER: change sire and dam, save and verify refresh without reload;
  reopen and confirm selections. Clear sire and dam independently, saving each.
  Confirm self is excluded and identical parents cannot be selected/saved.
- [ ] TRAINER, VET, GROOM separately: accessible pedigree is readable; no editor.
- [ ] OWNER: owned horse readable, editor absent; another owner's direct URL
  denied by the real backend. This task only inspected the server guard.
- [ ] Exercise loading, API validation/network errors and retries; verify EN/VI,
  light/dark and mobile. External Google Fonts require network availability.
- [ ] Check `/horses/:id`, `?tab=health`, `?tab=pedigree` and browser navigation.

All five milestones were documented as work progressed, before starting the next.
Race UI and the remainder of Phase 6 frontend are not marked complete.

### Inspection findings / implementation constraints

- Workspace `AGENTS.md` and the task make the Markdown design rules normative.
  The official HTML differs (navy/Inter/20px cards/8px and 10px radii);
  UC-05 follows Markdown (burgundy/Fraunces, Work Sans, JetBrains Mono/16px
  cards/10px and 12px radii). Existing purple/system-font SPA styling is drift;
  use scoped UC-05 styles, not a global migration.
- Existing backend `assertPedigree` compares only submitted IDs, so a partial
  PATCH can duplicate the unchanged parent. The UC-05 editor sends both IDs.
- `pedigreeNode` shares one `seen` set across branches, suppressing repeated
  ancestors even without a cycle; it also does not filter deleted ancestors.
  Display the API tree as returned; initialize edits from raw Horse parent IDs,
  never infer absent relationships from truncated tree nodes. Backend unchanged.
- Ownership guards the root horse; ancestor nodes are not separately owner-filtered.
  Do not create ancestor profile links that imply independent access.
- No database, migration, seed, backend E2E, dependency, commit or push work.

---


## 1. Tóm tắt 30 giây

- Đồ án: **Racehorse Training & Management System** (dự án bắt buộc số 1).
- Kiến trúc: **1 Core API (NestJS)** + **1 frontend React/Vite** trong monorepo
  `apps/`. Xem [OVERVIEW.md](OVERVIEW.md).
- Đang ở giai đoạn: **MVP theo main flow**, kế hoạch 6 phase trong [PLAN.md](PLAN.md) §6.
- **Phase 0 → 5 — XONG. MVP hoàn chỉnh** (Core API + frontend React demo được
  cả 4 main flow).
- **Phase 6 (Pedigree & Races) — XONG (API).** Luồng 1/3 của việc mở rộng
  sau-MVP chốt ngày 2026-09-12 (xem [DECISIONS.md](DECISIONS.md)).
- **Phase 7 (Training Plan & Training Lock) — XONG (API).** Luồng 2/3.
- **Phase 8 (Health & Injury) — XONG (API).** Luồng 3/3 (cuối cùng) — **cả 3
  luồng mở rộng sau-MVP đã xong phần API.** Frontend cho cả 3 (pedigree/races,
  training-plan/lock, incidents/notifications) **chưa làm** — xem §4.
- **2026-09-24 — nhận file `CLAUDE_CODE_BACKEND_FULL.md`** (task list backend
  đầy đủ theo Sprint 0-3 + UC/EX numbering của nhóm) — đối chiếu với code thật,
  ghi mâu thuẫn + câu hỏi mở vào [DECISIONS.md](DECISIONS.md). **Phase 9
  (Sprint 2 remainder: EX-01 + UC-12) — XONG.**
- **Phase 10 (Sprint 3 remainder: healthStatus, injury_locations,
  vaccinations, treatment_plans/medications, ảnh sự cố) — XONG (2026-09-25).**
  Toàn bộ `CLAUDE_CODE_BACKEND_FULL.md` nay đã xong phía API.
- Từ Phase 2: mỗi phase có file đặc tả trong [specs/](specs/) viết trước khi code.

## 2. Môi trường máy (đã dựng sẵn)

| Thành phần | Trạng thái |
|---|---|
| Node | 24.19, npm 11 |
| PostgreSQL | Bản portable `C:\Users\Lenovo\pgsql`, data `C:\Users\Lenovo\pgdata`, port **5432**, user/pass `postgres`/`postgres`, DB **`racehorse`** đã tạo |
| PG autostart | `scripts/pg-autostart.vbs` đã đặt trong Startup folder → tự chạy khi login. Không đăng ký được Windows service (bị chặn quyền). Bật/tắt tay: `scripts/pg-start.ps1` / `pg-stop.ps1` |
| `apps/api` deps | Đã cài đủ. Prisma **6.19.3** (KHÔNG lên 7/8 — v7+ bỏ `url` trong schema, bắt buộc driver adapter) |
| `apps/web` deps | Đã cài: react-router-dom, axios, i18next, react-i18next, vite |
| npm config | `maxsockets=3`, retry cao, `prefer-offline` — mạng hay `ECONNRESET`, cứ chạy lại `npm install` nếu đứt |
| npm 11 allow-scripts | Đã approve script cho `@prisma/*`, `bcrypt`, `@parcel/watcher`, `unrs-resolver`; denied `@scarf/scarf`. Khi thêm dep có postinstall, chạy `npm approve-scripts <pkg>` |

## 3. Phase 0 đã làm gì

### apps/api (NestJS)
- Scaffold chuẩn `nest new`. Đã xoá `app.controller/service`.
- `src/config/env.ts` — validate biến môi trường bằng **zod** (bootstrap fail sớm nếu thiếu).
- `src/prisma/` — `PrismaModule` (global) + `PrismaService` (connect/disconnect theo lifecycle).
- `src/common/app-exception.ts` — class `AppException(code, message?, details?)` + map `code → HTTP status`.
- `src/common/filters/all-exceptions.filter.ts` — render mọi lỗi thành
  `{ error: { code, message, details? } }`. Mã lỗi ổn định (xem [PLAN.md](PLAN.md) §4).
- `src/health/` — `GET /api/v1/health` → `{ status, db: up|down, time }` (có ping DB).
- `src/main.ts` — prefix `/api/v1`, `helmet`, `ValidationPipe` (whitelist + forbidNonWhitelisted + transform),
  global exception filter, Swagger tại `/api/docs`, CORS bật.
- `prisma/schema.prisma` — **6 model**: `User`, `RefreshToken`, `AuthToken`,
  `Horse`, `TrainingSession`, `HealthRecord` (đủ cho cả Phase 1-4).
- `prisma/migrations/` — migration `init` **đã apply** vào DB.
- `prisma/seed.ts` — tạo 1 MANAGER: `manager@racehorse.local` / `Manager123!`
  (ACTIVE + đã verify email).
- `.env` (gitignored, đã điền Gmail `quocbinh072517@gmail.com` + app password) và `.env.example`.
- `tsconfig`: `tsconfig.json` include cả `src/test/prisma` cho tooling;
  `tsconfig.build.json` có `rootDir: src` + loại `test/prisma` → build ra `dist/main.js` phẳng.
- eslint: tắt `no-unsafe-enum-comparison`; nới các rule `no-unsafe-*` cho file test.
- **Đã verify:** `npm run build` OK · `npm run lint` sạch · `npm run test:e2e` pass
  (test health) · chạy `node dist/main.js` → `/health` trả `db:"up"`, `/api/docs` = 200,
  route lạ trả đúng envelope 404.

Scripts có sẵn trong `apps/api/package.json`:
`start:dev`, `build`, `lint`, `test`, `test:e2e`,
`prisma:generate`, `prisma:migrate`, `prisma:studio`, `db:seed`.

### apps/web (Vite + React + TS)
- Scaffold `create-vite react-ts`.
- `src/lib/api.ts` — axios client (baseURL từ `VITE_API_URL`), interceptor gắn Bearer token.
- `src/i18n/` — `index.ts` + `vi.json` + `en.json` (khởi tạo i18next).
- `src/App.tsx`, `src/main.tsx` — skeleton router.
- `.env` / `.env.example` — `VITE_API_URL=http://localhost:3000/api/v1`.
- ⚠️ Mới ở mức skeleton — UI thật làm ở **Phase 5**.

### Root
- `README.md` (hướng dẫn chạy), `.gitignore`, `docker-compose.yml` (Postgres tuỳ chọn),
  `scripts/` (pg-start / pg-stop / pg-autostart).
- **Chưa `git init`** — chờ người dùng quyết.

## 3b. Phase 1 đã làm gì (Auth & Users)

**Chốt:** refresh token trả qua **body JSON** (không cookie); không captcha/rate-limit.
Chi tiết lý do trong [DECISIONS.md](DECISIONS.md) mục 2026-09-08 Phase 1.

### apps/api — module mới
- `src/common/decorators/` — `@Public()`, `@Roles(...)`, `@CurrentUser()` (+ type `AuthUser`).
- `src/common/guards/` — `JwtAuthGuard` (global, bỏ qua `@Public()`; verify access JWT
  rồi **load user từ DB** kiểm tra status/soft-delete) · `RolesGuard` (global, đọc `@Roles`).
- `src/common/duration.ts` — parse `"15m"`/`"7d"` → ms.
- `src/mail/` — `MailService` (nodemailer; thiếu SMTP ⇒ log ra console) +
  `sendVerifyEmail` / `sendResetPassword`. `@Global`.
- `src/auth/`
  - `token.service.ts` — access JWT (payload chỉ `sub`), refresh token (hash SHA-256,
    **rotation**), auth token VERIFY_EMAIL (24h) / RESET_PASSWORD (1h). Chỉ lưu hash.
  - `auth.service.ts` + `auth.controller.ts` — `POST /auth/register` · `GET /auth/verify-email?token=` ·
    `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` ·
    `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/me` (auth).
    Login chặn theo thứ tự: sai pass → `UNAUTHENTICATED`; chưa verify → `EMAIL_NOT_VERIFIED`;
    PENDING → `ACCOUNT_PENDING`; DISABLED → `ACCOUNT_DISABLED`.
  - `auth.module.ts` — `@Global`, export `TokenService` + `JwtModule`.
- `src/users/` (class-level `@Roles(MANAGER)`)
  - `GET /users?status=&role=&page=&limit=` → `{ data, meta:{page,limit,total} }` (lọc `deletedAt:null`).
  - `GET /users/:id` · `PATCH /users/:id` `{name?,role?,status?}` (set ACTIVE bắt buộc có role) ·
    `DELETE /users/:id` (soft delete + revoke refresh; không tự xoá mình).
- `src/app.module.ts` — đăng ký 2 `APP_GUARD` (Jwt rồi Roles), import Mail/Auth/Users.
- `src/health/health.controller.ts` — thêm `@Public()`.
- `nest-cli.json` — bật plugin `@nestjs/swagger`.
- `test/auth.e2e-spec.ts` — 9 test: register → duplicate 409 → login chặn (chưa verify) →
  verify → login chặn (PENDING) → MANAGER duyệt (role+ACTIVE) → non-manager list 403 →
  login OK → me → refresh rotation → tái dùng token cũ 401 → logout → refresh sau logout 401.
  Override `MailService` bằng fake bắt token (không cần SMTP thật).

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e` (9/9) ✅ ·
smoke `node dist/main.js`: `/api/docs` 200, `/auth/me` không token → envelope
`UNAUTHENTICATED`, login MANAGER trả access+refresh+user, register sai → `VALIDATION_ERROR`.

Seed vẫn chỉ 1 MANAGER (`manager@racehorse.local` / `Manager123!`).

## 3c. Phase 2 đã làm gì (Horses)

Đặc tả đầy đủ: **[specs/phase-2-horses.md](specs/phase-2-horses.md)** (viết trước khi code).
Không cần migration — bảng `Horse` đã có từ `init`.

### apps/api — module mới
- `src/common/guards/horse-ownership.guard.ts` — `HorseOwnershipGuard`: load Horse
  theo `:id` (`deletedAt:null`), 404 nếu không có, 403 nếu OWNER truy cập ngựa
  người khác; gắn `req.horse`. Dùng lại cho Phase 3/4.
- `src/horses/`
  - `POST /horses` (MANAGER) — `ownerId` phải là user `role=OWNER`; `birthDate`
    không được tương lai.
  - `GET /horses?ownerId=&status=&q=&page=&limit=` — **OWNER bị ép `ownerId=self`**.
  - `GET /horses/:id` (guard ownership) · `PATCH /horses/:id` (MANAGER, cho `null`
    để xoá `breed`/`birthDate`, đổi chủ) · `DELETE /horses/:id` (MANAGER, soft delete).
  - `POST /horses/:id/photo` (MANAGER, multipart field `file`) — ảnh jpg/png/webp
    ≤ `UPLOAD_MAX_MB`, ghi đè ảnh cũ (xoá file cũ best-effort).
  - Object trả về có thêm `photoUrl` (tính từ `photoPath`).
- `src/files/`
  - `file-storage.service.ts` — thuần fs (mkdir lúc boot, `removeQuietly`, resolve path).
  - `upload.ts` — cấu hình multer `diskStorage` (`uploads/horse-photos/<horseId>-<rand>.<ext>`),
    fileFilter mime, limit size; regex `SAFE_FILENAME` chống path traversal.
  - `files.module.ts` — `MulterModule.registerAsync` + `FileStorageService` (không
    phụ thuộc domain → tránh circular).
  - `files.controller.ts` (đăng ký trong `HorsesModule`) —
    `GET /files/horse-photos/:filename` (auth + ownership; validate filename; serve file).
- `src/common/filters/all-exceptions.filter.ts` — thêm nhánh `MulterError`
  (`LIMIT_FILE_SIZE`…) → `VALIDATION_ERROR` 400.
- `src/app.module.ts` — import `HorsesModule`.
- `prisma/seed.ts` — thêm `owner1@` / `owner2@racehorse.local` (`Owner123!`, OWNER,
  ACTIVE+verified) + 3 ngựa (Thunderbolt, Sea Breeze, Midnight).
- `apps/api/uploads/.gitkeep`.
- `test/horses.e2e-spec.ts` — 15 test: create 201 · ownerId sai role 400 · birthDate
  tương lai 400 · non-manager 403 · OWNER list bị scope · OWNER không mở rộng scope
  qua query · OWNER xem ngựa người khác 403 · OWNER xem ngựa mình 200 · patch status ·
  upload ảnh 201 + `photoUrl` · upload non-image 400 · owner tải ảnh 200 image/png ·
  owner khác tải ảnh 403 · filename traversal 404 · soft-delete → GET 404 · id lạ 404.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(25/25:** health 1 + auth 9 + horses 15**)** ✅ · smoke curl: upload ảnh →
tải lại `200 image/png`, không token `401`, traversal `404`.

Seed hiện có: 1 MANAGER + 2 OWNER + 3 ngựa.

## 3d. Phase 3 đã làm gì (Training sessions)

Đặc tả đầy đủ: **[specs/phase-3-training.md](specs/phase-3-training.md)**.
Không cần migration — bảng `TrainingSession` đã có từ `init`.

### apps/api — module mới `src/training/`
- **2 controller:**
  - `HorseSessionsController` (`@Controller('horses/:id/sessions')`, class-level
    `@UseGuards(HorseOwnershipGuard)`):
    - `POST` (TRAINER) — `{scheduledAt, type, notes?}`; `trainerId` = người gọi;
      luôn khởi tạo `PLANNED`.
    - `GET ?status=&from=&to=&page=&limit=` — sắp xếp `scheduledAt asc`.
  - `SessionsController` (`@Controller('sessions')`):
    - `GET /sessions/:id` — ownership check ở service (session→horse; OWNER phải là chủ).
    - `PATCH /sessions/:id` (`@Roles(TRAINER, GROOM)`).
- **State machine** (`training.service.ts`): hợp lệ `PLANNED → DONE | CANCELLED`;
  `DONE`/`CANCELLED` là trạng thái cuối → PATCH tiếp → `VALIDATION_ERROR`.
  Chuyển `DONE` bắt buộc có `resultMetric` + `resultValue` (từ payload hoặc đã có).
  Field `scheduledAt/type/notes` chỉ sửa khi đang `PLANNED`.
- **GROOM field-whitelist:** chỉ `status`, `resultMetric`, `resultValue`; gửi field
  khác → `FORBIDDEN`. Lọc key theo `v !== undefined` (class-transformer hay thêm
  field optional = undefined).
- `TrainingModule` tự provide `HorseOwnershipGuard` (chỉ cần `PrismaService`).
- `prisma/seed.ts` — thêm `trainer@` / `vet@` / `groom@racehorse.local`
  (`Trainer123!` / `Vet123!` / `Groom123!`, ACTIVE+verified) + 3 session
  (Thunderbolt: gallop PLANNED + sprint DONE có result; Midnight: trot PLANNED).
- `src/app.module.ts` — import `TrainingModule`.
- `test/training.e2e-spec.ts` — 14 test: create 201/PLANNED · thiếu type 400 ·
  GROOM/OWNER create 403 · horse lạ 404 · owner xem session ngựa mình / owner khác 403 ·
  `GET /sessions/:id` ownership + 404 · TRAINER sửa notes · `DONE` thiếu result 400 ·
  GROOM `DONE` + result 200 · GROOM sửa `type` 403 · PATCH session đã DONE 400 ·
  `CANCELLED` không cần result 200 · filter `status`.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(39/39:** health 1 + auth 9 + horses 15 + training 14**)** ✅ · smoke curl chạy
trọn luồng MVP #2 (trainer tạo → groom DONE+result → owner xem thấy).

Seed hiện có: MANAGER + TRAINER + VET + GROOM + 2 OWNER + 3 ngựa + 3 session.

## 3e. Phase 4 đã làm gì (Health records)

Đặc tả đầy đủ: **[specs/phase-4-health.md](specs/phase-4-health.md)**.
Không cần migration — bảng `HealthRecord` đã có từ `init`
(**không có `updatedAt`/`deletedAt`**).

### apps/api — module mới `src/health/health-records.*`
- Tên tách bạch với `HealthController` (health-check `GET /api/v1/health` từ Phase 0):
  `HealthRecordsModule` / `HealthRecordsService`, file `health-records.{module,controller,service}.ts`,
  dto `dto/health.dto.ts`.
- **3 controller:**
  - `HorseHealthRecordsController` (`@Controller('horses/:id/health-records')`,
    class-level `HorseOwnershipGuard`):
    - `POST` (VET) — `{examDate, diagnosis, treatment?}`; `vetId` = người gọi;
      `examDate` **không được tương lai** → `VALIDATION_ERROR`.
    - `GET ?from=&to=&page=&limit=` — sắp xếp `examDate desc`.
  - `HealthRecordsController` (`@Controller('health-records')`):
    - `GET /health-records/:id` — ownership ở service (record→horse; OWNER phải là chủ).
    - `PATCH /health-records/:id` (VET) — `{examDate?, diagnosis?, treatment?}`
      (`treatment: null` để xoá). Không cần ownership guard (chỉ VET tới, VET xem mọi ngựa).
    - `POST /health-records/:id/attachment` (VET, multipart `file`) — jpg/png/webp/**pdf**
      ≤ `UPLOAD_MAX_MB`, ghi đè file cũ.
  - `HealthFilesController` (`@Controller('files')`) —
    `GET /files/health-attachments/:filename` (auth + ownership; validate filename).
- Object trả về có thêm `attachmentUrl` (tính từ `attachmentPath`).
- `src/files/upload.ts` — thêm `HEALTH_ATTACHMENT_KIND`, `ATTACHMENT_MIME_TO_EXT`
  (+pdf), `SAFE_ATTACHMENT_FILENAME`, `buildAttachmentMulterOptions()` (đọc
  `process.env`, dùng inline trong `FileInterceptor`).
- `src/files/file-storage.service.ts` — `onModuleInit` tạo cả 2 thư mục
  (`horse-photos` + `health-attachments`).
- `src/app.module.ts` — import `HealthRecordsModule`.
- `prisma/seed.ts` — +2 health record (Thunderbolt: routine checkup;
  Midnight: mild colic + treatment).
- `test/health.e2e-spec.ts` — 16 test: VET tạo 201 · thiếu diagnosis 400 ·
  examDate tương lai 400 · TRAINER/OWNER tạo 403 · horse lạ 404 · owner xem list
  ngựa mình / owner khác 403 · `GET /health-records/:id` ownership + 404 ·
  VET PATCH treatment · TRAINER PATCH 403 · VET upload PDF 201 + `attachmentUrl` ·
  upload .txt 400 · owner tải attachment 200 application/pdf · owner khác 403 ·
  filename traversal 404 · filter theo `from`.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(55/55:** health-check 1 + auth 9 + horses 15 + training 14 + health-records 16**)** ✅.

Seed hiện có: MANAGER + TRAINER + VET + GROOM + 2 OWNER + 3 ngựa + 3 session + 2 health record.

## 3f. Phase 5 đã làm gì (Hoàn thiện MVP + frontend)

Đặc tả đầy đủ: **[specs/phase-5-mvp.md](specs/phase-5-mvp.md)**.

### apps/web — frontend React demo (1 app, đổi UI theo role)
- Không thêm dependency. React 19 + react-router-dom 7 (`createBrowserRouter`) +
  axios + i18next. `npm run build` (tsc + vite) ✅, `npm run lint` (oxlint) exit 0
  (4 warning `set-state-in-effect` ở trang fetch danh sách — chấp nhận).
- `src/lib/`: `types.ts`, `format.ts` (ngày Asia/Ho_Chi_Minh), `api.ts` viết lại —
  request gắn Bearer; response interceptor **refresh 1 lần** (dedupe), bỏ qua
  `/auth/*`, hỏng → `setOnAuthLost` → xoá token → về `/login`.
- `src/auth/`: `context.ts` + `AuthProvider.tsx` (khởi động gọi `GET /auth/me`) +
  `useAuth.ts` + `RequireAuth.tsx` (guard đăng nhập + role).
- `src/components/`: `Layout` (header: nav, lang VI/EN, user, logout), `Field`, `ErrorText`
  (dịch mã lỗi API qua khoá `error.<CODE>`).
- `src/pages/`: `LoginPage`, `RegisterPage` (đăng ký → PENDING), `HorsesPage`
  (list + form tạo ngựa cho MANAGER, chọn owner từ `GET /users?role=OWNER`),
  `HorseDetailPage` (tab Sessions/Health), `horse/SessionsTab` (TRAINER tạo;
  TRAINER/GROOM sửa status+result+notes khi PLANNED), `horse/HealthTab` (VET
  tạo/sửa + upload đính kèm; "mở đính kèm" = tải blob qua axios rồi `window.open`),
  `AdminUsersPage` (MANAGER duyệt PENDING = chọn role + `PATCH {role,status:ACTIVE}`,
  khoá/mở ACTIVE↔DISABLED).
- `src/index.css` viết lại (tokens sáng/tối, card/btn/input/table/tag/tabs).
- `src/i18n/{vi,en}.json` mở rộng đủ nhãn UI. Xoá `src/App.tsx`.
- Route: `/login`, `/register` công khai; `/horses`, `/horses/:id` cần đăng nhập;
  `/admin/users` cần role MANAGER; `*` → `/horses`.

### apps/api
- `prisma/seed.ts`: +`newbie@racehorse.local` / `Newbie123!` (PENDING, đã verify
  email — demo bước duyệt) + 1 session `dressage` PLANNED cho Sea Breeze + in
  bảng tài khoản demo ở cuối. Vẫn idempotent. `test:e2e` giữ **55/55**.

### docs
- `DATA_MODEL.md`: thêm **ERD Mermaid** (6 model thật) ở đầu file.
- `README.md`: mục chạy full-stack + bảng tài khoản demo + "Demo 4 luồng MVP".
- `MVP.md`: tick checklist "Định nghĩa xong MVP".

**Đã verify:** web `build` + `lint` ✅ · api `build`+`lint`+`test:e2e` (55/55) ✅ ·
seed chạy lại OK · 2 server boot + phục vụ (health, login, SPA fallback). Click-through
4 luồng MVP để người dùng demo (không có test tự động cho web ở phase này).

## 3g. Phase 6 đã làm gì (Pedigree & Races)

Đặc tả đầy đủ: **[specs/phase-6-pedigree.md](specs/phase-6-pedigree.md)**.
Migration mới `phase6_pedigree_races` (cột nullable trên `Horse` + 2 bảng mới
— không phá dữ liệu cũ).

### apps/api — module mới `src/races/` + mở rộng `src/horses/`
- `Horse` +`sireId`/`sire`, `damId`/`dam` (tự tham chiếu, 2 relation riêng
  `HorsePedigree_Sire`/`HorsePedigree_Dam`), `+fitnessScore` (Int? 0..100).
- `horses.service.ts`: `assertPedigree()` (chặn tự tham chiếu + `sireId===damId`
  + phải trỏ ngựa tồn tại) dùng trong `update()`; `pedigree()` + `pedigreeNode()`
  đệ quy 3 đời (horse → cha/mẹ → ông/bà), cắt bằng `Set` chống vòng lặp dữ liệu lỗi.
- `horses.controller.ts`: `+GET /horses/:id/pedigree` (`HorseOwnershipGuard`).
- Model mới `Race` (`name, date, venue?, distance?, surface?, prizePool?`) +
  `RaceEntry` (`raceId, horseId, position?, time?`, `@@unique([raceId,horseId])`,
  không soft-delete).
- `src/races/`: `RacesController` (`/races`, `/races/:id/entries`) +
  `HorseRaceEntriesController` (`/horses/:id/race-entries`, `HorseOwnershipGuard`)
  + `RaceEntriesController` (`/race-entries/:id`) — cùng `RacesModule`, tự
  provide `HorseOwnershipGuard` (giống `TrainingModule`).
- `src/app.module.ts` — import `RacesModule`.
- `prisma/seed.ts` — +2 ngựa tổ tiên (RETIRED, không hiển thị nổi bật) gán
  làm sire/dam của Thunderbolt, `fitnessScore` cho Thunderbolt/Midnight, +1
  race ("Spring Derby 2026") +2 entry (chưa có kết quả).
- `test/pedigree.e2e-spec.ts` (9 test) + `test/races.e2e-spec.ts` (13 test):
  validate pedigree (tự tham chiếu, trùng, ngựa lạ, fitnessScore ngoài range,
  403 non-manager), cây phả hệ 3 đời + ownership; CRUD race + entry (409 trùng
  entry, 404 ngựa lạ, 403 non-manager, ownership `race-entries` theo ngựa).

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(77/77:** 55 cũ + pedigree 9 + races 13**)** ✅ · seed chạy lại idempotent.

Chưa làm ở phase này: UI frontend cho pedigree/race history (API trước, FE
sau nếu còn thời gian); Training Lock, `incident_reports`, `notifications`
(2 luồng còn lại của việc mở rộng — xem §4).

## 3h. Phase 7 đã làm gì (Training Plan & Training Lock)

Đặc tả đầy đủ: **[specs/phase-7-training-plan-lock.md](specs/phase-7-training-plan-lock.md)**.
Migration mới `phase7_training_plan_lock` (cột default/nullable trên
`Horse`/`TrainingSession` + bảng mới `TrainingPlan` — không phá dữ liệu cũ).

### apps/api — mở rộng `src/horses/` + `src/training/`
- `Horse` +`locked` (Boolean, default false), `+lockReason` (String?).
- `horses.service.ts`: `+lock()` — set `locked` + `lockReason` (mở khoá luôn
  xoá `lockReason`, không giữ lịch sử).
- `horses.controller.ts`: `+PATCH /horses/:id/lock` (`@Roles(VET)` +
  `HorseOwnershipGuard`), DTO riêng `LockHorseDto` (tách khỏi
  `UpdateHorseDto` vì khác role).
- Model mới `TrainingPlan` (`horseId, trainerId, goal, startDate, endDate?`,
  không soft-delete) + `TrainingSession.planId` (nullable FK).
- `training.service.ts`:
  - `create()` (tạo session) mở rộng: chặn nếu `horse.locked===true` →
    `VALIDATION_ERROR` kèm `lockReason` trong message; validate `planId`
    (nếu gửi) phải thuộc cùng ngựa.
  - `+createPlan/listPlansByHorse/getPlan/updatePlan` — `getPlan` join
    `sessions` tóm tắt; `assertPlanDates()` chặn `endDate < startDate`
    (dùng cho cả create và update, so với giá trị hiện có nếu field kia
    không gửi).
- `training.controller.ts`: `+HorseTrainingPlansController`
  (`horses/:id/training-plans`, `HorseOwnershipGuard`) +
  `+TrainingPlansController` (`training-plans/:id`) — cùng `TrainingModule`.
- `prisma/seed.ts` — +1 training plan (Thunderbolt, TRAINER seed), khoá
  **Sea Breeze** (`locked=true`, lý do "tendon strain") để demo TRAINER bị
  chặn tạo buổi tập.
- `test/training-plan.e2e-spec.ts` (19 test): plan CRUD + ownership (404/403),
  validate ngày, lock/unlock (VET-only, 403 MANAGER), chặn tạo session khi
  khoá + thông báo lý do, `planId` hợp lệ/sai ngựa, hành vi sau mở khoá.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(96/96:** 77 cũ + 19 mới**)** ✅ · seed chạy lại idempotent.

Chưa làm ở phase này: UI frontend cho training plan/lock; `incident_reports`,
`notifications` (luồng Health & Injury — nay đã xong, xem §3i).

## 3i. Phase 8 đã làm gì (Health & Injury) — luồng cuối (3/3)

Đặc tả đầy đủ: **[specs/phase-8-health-injury.md](specs/phase-8-health-injury.md)**.
Migration mới `phase8_incidents_notifications` (2 bảng mới + 3 enum, không
đổi cột hiện có).

### apps/api — 2 module mới `src/notifications/` + `src/incidents/`
- `NotificationsModule` đứng độc lập (không phụ thuộc horses/incidents) —
  `NotificationsService.notifyUsers()` (helper nội bộ, tạo hàng loạt qua
  `createMany`) + `managerIds()` (mọi MANAGER `ACTIVE`, `deletedAt:null`).
  `NotificationsController`: `GET /notifications?unread=&page=&limit=` (luôn
  tự lọc `userId=self`) + `PATCH /notifications/:id/read` (403 nếu không
  phải chủ, 404 nếu không tồn tại).
- `HorsesService.lock()` (Phase 7) **mở rộng**: sau khi update `locked`, nếu
  giá trị **thực sự đổi** so với trước → gọi `notifications.notifyUsers()`
  cho chủ ngựa + mọi MANAGER (`TRAINING_LOCKED`/`TRAINING_UNLOCKED`). Chỉ 1
  nơi gửi thông báo khoá/mở khoá, dùng chung cho lời gọi tay (VET,
  `PATCH /horses/:id/lock`) và tự động (từ sự cố).
- Model mới `IncidentReport` (`horseId, reportedById, description, severity,
  status, healthRecordId?`) + `Notification` (`userId, type, message, read`)
  + 3 enum `IncidentSeverity`/`IncidentStatus`/`NotificationType`.
- `IncidentsModule` import `HorsesModule` (dùng lại `HorsesService.lock()`)
  + `NotificationsModule`.
  - `IncidentsService.create()`: tạo `IncidentReport` (`status=OPEN`); nếu
    `severity=HIGH` → gọi `horses.lock(horseId, {locked:true, reason:
    "Incident: <description>"})`; luôn gửi `INCIDENT_REPORTED` (mọi severity).
  - `IncidentsService.update()`: `status` chỉ tiến (`STATUS_ORDER` index,
    cho nhảy bước), `RESOLVED` là trạng thái cuối; `healthRecordId` (nếu
    gửi) phải thuộc cùng ngựa; chuyển `RESOLVED` **khi ngựa đang khoá** →
    gọi `horses.lock(horseId, {locked:false})` (bỏ qua nếu không khoá, tránh
    no-op).
  - `HorseIncidentsController` (`horses/:id/incidents`, `HorseOwnershipGuard`,
    POST=GROOM) + `IncidentsController` (`incidents/:id`, PATCH=VET, GET
    ownership qua service như training-plans/health-records).
- `src/app.module.ts` — import `NotificationsModule` + `IncidentsModule`.
- `prisma/seed.ts` — seed dùng raw prisma (không có Nest DI), nên **tự tay
  lặp lại** hiệu ứng của service: 1 incident `HIGH` cho Midnight (tự khoá +
  tạo `Notification` cho owner2 + MANAGER), 1 incident `LOW` `RESOLVED` cho
  Thunderbolt (gắn `healthRecordId` của hồ sơ "Routine checkup" đã seed).
- `test/incidents.e2e-spec.ts` (14 test) + `test/notifications.e2e-spec.ts`
  (7 test): CRUD + ownership, forward-only status, `healthRecordId` sai
  ngựa, auto-lock khi tạo `HIGH`, auto-unlock khi `RESOLVED` lúc đang khoá,
  resolve ngựa không khoá không lỗi; list/mark-read thông báo (chỉ của
  chính mình, filter `unread`).

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(117/117:** 96 cũ + 21 mới**)** ✅ · seed chạy lại idempotent.

Chưa làm: UI frontend cho incidents/notifications (không chặn "xong" phase
này — xem §4).

## 3j. Phase 9 đã làm gì (Training safety rules — EX-01 + UC-12)

Đặc tả đầy đủ: **[specs/phase-9-training-safety.md](specs/phase-9-training-safety.md)**.
Nguồn: `CLAUDE_CODE_BACKEND_FULL.md` (Sprint 2 remainder) — xem đối chiếu
đầy đủ trong [DECISIONS.md](DECISIONS.md) mục "2026-09-24 — Đối chiếu...".
Migration mới `phase9_fitness_warning_notification` (chỉ +1 giá trị enum).

### apps/api — mở rộng `src/training/` + `src/notifications/`
- `src/notifications/notifications.service.ts`: `+groomIds()` (mọi GROOM
  `ACTIVE`) song song `managerIds()` đã có từ Phase 8.
- `src/training/training.module.ts`: import `NotificationsModule`.
- `src/training/training.service.ts`:
  - `+assertNoScheduleConflict()` trong `create()` — 409 `CONFLICT` nếu
    ngựa có session `PLANNED` khác trong ±60 phút. Chạy **sau** rule
    Training Lock + validate `planId` đã có.
  - `+maybeWarnFitness()` trong `update()` — khi chuyển `DONE` với
    `resultMetric="heart_rate_max"` và `resultValue>195` → tạo
    `Notification` (`FITNESS_WARNING`) cho HLV + mọi GROOM + chủ ngựa.
  - 2 hằng số `SESSION_CONFLICT_WINDOW_MIN=60`, `FITNESS_HEART_RATE_MAX=195`.
- `test/training-safety.e2e-spec.ts` (8 test): trùng lịch trong/ngoài cửa
  sổ 60', ngựa khác không bị ảnh hưởng, khoá ưu tiên trước trùng lịch,
  cảnh báo đúng ngưỡng/đúng metric, không cảnh báo dưới ngưỡng hoặc metric
  khác.
- Sửa 2 test cũ (`training.e2e-spec.ts`, `training-plan.e2e-spec.ts`) —
  bị vỡ vì tạo nhiều session "now" cho cùng ngựa, nay va rule EX-01 mới;
  dời giờ lệch +2 tiếng, không đổi hành vi được test.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(125/125:** 117 cũ + 8 mới**)** ✅.

Chưa làm: Sprint 3 remainder — **nay đã xong ở Phase 10** (§3k dưới đây).

## 3k. Phase 10 đã làm gì (Health & Injury extensions — Sprint 3 remainder)

Đặc tả đầy đủ: **[specs/phase-10-health-injury-extensions.md](specs/phase-10-health-injury-extensions.md)**.
Nguồn: `CLAUDE_CODE_BACKEND_FULL.md` (Sprint 3) — hoàn tất phần "chưa làm"
còn lại sau Phase 9 (UC-14, 16, 18, 19, 20; UC-17 đã xong từ Phase 7/8).
Migration mới `phase10_health_injury_extensions` (+`Horse.healthStatus`,
+`IncidentReport.photoPath`, +4 bảng mới, +2 enum).

### apps/api — 2 module mới `src/injuries/` + `src/vaccinations/` + mở rộng `src/health/`, `src/incidents/`
- `Horse.healthStatus` (enum `FIT|MONITORING|QUARANTINED|INJURED`, default
  `FIT`) — **độc lập** với `status` (career) và `locked` (Training Lock),
  không tách/đổi tên field cũ nào.
- `ListHorsesQueryDto` + `horses.service.ts`: lọc thêm theo `healthStatus`
  (UC-14).
- `CreateHealthRecordDto` +`healthStatus?`; `health-records.service.ts`
  ghi lên `Horse.healthStatus` nếu VET gửi (UC-15 mở rộng).
- `src/injuries/`: `InjuryLocation` (2 FK nullable — `incidentReportId`
  hoặc `healthRecordId`, ràng buộc "đúng 1" ở service). 2 cặp route
  `POST/GET .../injury-locations` theo từng nguồn gốc (VET tạo, ownership
  khi đọc).
- `src/vaccinations/`: `POST/GET /horses/:id/vaccinations` (VET tạo,
  ownership) + `GET /vaccinations?upcoming=` (view toàn CLB, chặn OWNER
  403 thẳng thay vì lọc). `upcoming=true` lọc `nextDueDate` trong 30 ngày.
- `src/health/treatment-plans.{controller,service}.ts` (trong
  `HealthRecordsModule`): `TreatmentPlan` (`status` mặc định `ACTIVE`) +
  `Medication` (`treatmentPlanId` nullable — có thể đứng độc lập hoặc
  thuộc 1 plan, đúng yêu cầu STEP 0 mục 6).
- `IncidentsService` đổi từ trả thẳng Prisma payload sang `toView()`
  (tính `photoUrl`, giống Horses/HealthRecords) — áp dụng lại cho cả
  `create/listByHorse/get/update` đã có, không chỉ 2 method mới.
  `POST /incidents/:id/photo` (GROOM, multipart) + `GET
  /files/incident-photos/:filename` (ownership) — tái dùng nguyên
  `FileStorageService`/`upload.ts` (thêm `INCIDENT_PHOTO_KIND` +
  `buildIncidentPhotoMulterOptions()`), không thêm dependency mới.
- `prisma/seed.ts` (raw prisma, không qua service — không có side-effect
  nào cần replicate cho phần Phase 10): `healthStatus` cho Sea Breeze
  (`MONITORING`) + Midnight (`INJURED`), 1 vaccination Thunderbolt
  (`Tetanus`, due 20 ngày), 1 injury-location gắn incident HIGH của
  Midnight, 1 treatment-plan+medication gắn health record "Mild colic".
- `test/health-injury-ext.e2e-spec.ts` (15 test): filter healthStatus, ghi
  healthStatus qua health-record, injury-location cả 2 nguồn + ownership +
  role (VET-only), vaccination create + upcoming view + chặn OWNER, upload
  ảnh sự cố + ownership tải ảnh, treatment-plan + medication + ownership.

**Đã verify:** `npm run build` ✅ · `npm run lint` ✅ · `npm run test:e2e`
**(140/140:** 125 cũ + 15 mới**)** ✅ · seed chạy lại idempotent.

**Sprint 3 (Health & Injury) theo `CLAUDE_CODE_BACKEND_FULL.md` nay đã đầy
đủ.** Chưa làm: UI frontend cho toàn bộ tính năng Phase 6-10 (không chặn
"xong" phase này — xem §4).

## 3l. Phase 11 đã làm gì (Đăng nhập Google + xác thực email bằng OTP)

Đặc tả gốc: **[specs/phase-11-google-auth-otp.md](specs/phase-11-google-auth-otp.md)**.
Nguồn: yêu cầu người dùng (2026-09-29 → 2026-09-30, hoàn thiện qua nhiều
vòng khi test trực tiếp trên bản deploy thật — xem
[DECISIONS.md](DECISIONS.md) các mục ngày 2026-09-30 để biết chi tiết quá
trình chẩn đoán). Migration `phase11_google_otp` (+`User.googleId`,
`passwordHash` → optional, +bảng `OtpCode`). **Đã test xong trên bản live**
(Render + Vercel), không chỉ local.

### apps/api — `src/auth/` mở rộng
- Xác thực email đăng ký đổi từ link token sang **OTP 6 số** (model
  `OtpCode`, TTL 10 phút, khoá sau 5 lần nhập sai/mã). `GET
  /auth/verify-email` xoá hẳn, thay bằng `POST /auth/verify-otp` +
  `POST /auth/resend-otp` (luôn trả message chung, không lộ email tồn tại
  — giống `forgot-password`).
- `POST /auth/google` `{idToken}` — verify **Google ID token** bằng
  `google-auth-library` (`GOOGLE_CLIENT_ID`, không cần secret/redirect
  URL). **Google account mới toanh cũng phải qua OTP** (đổi ngày
  2026-09-30 — ban đầu tự verify luôn vì Google đã xác minh email, sau đổi
  ý để nhất quán 1 luồng xác nhận cho mọi cách tạo tài khoản): tạo user
  `PENDING`, `emailVerifiedAt=null`, phát OTP tới đúng email/tên Google
  trả về, trả `{otpRequired: true, email}` thay vì token — client tự
  chuyển màn nhập OTP, không cần gõ tay. Email trùng tài khoản đăng ký
  thường có sẵn → vẫn tự gắn `googleId` + verify ngay (không bắt OTP lại).
  Sau khi verify OTP xong, **vẫn cần MANAGER duyệt** ở `/admin/users` như
  đăng ký thường (không đổi luồng duyệt có sẵn).
- `POST /users/:id/reject` (MANAGER, chỉ user `PENDING`) — **xoá hẳn**
  record (khác `DELETE /users/:id` soft-delete có sẵn), để email được
  giải phóng cho đăng ký lại (kể cả qua Google). Thêm ngày 2026-09-30
  theo yêu cầu người dùng.
- `User.passwordHash` chuyển optional (tài khoản Google-only không có mật
  khẩu cục bộ) — `login()` thêm guard: `passwordHash` null → coi như sai
  mật khẩu, không crash.
- **`MailService` đổi cơ chế gửi 2 lần** sau khi test trên Render (xem
  DECISIONS.md 2026-09-30 để biết toàn bộ quá trình): SMTP (nodemailer,
  thiết kế gốc) → phát hiện Render chặn kết nối SMTP ra ngoài
  (`Connection timeout`, đã thử thêm timeout ngắn + ép DNS ipv4first,
  không giải quyết được) → **Resend** (HTTP API) → phát hiện Resend
  sandbox chỉ cho gửi tới đúng email chủ tài khoản Resend, không gửi được
  cho người khác → **Brevo** (HTTP API cuối cùng, dùng `fetch()` sẵn có,
  không thêm SDK) — chỉ cần verify 1 sender email (không cần domain), gửi
  được tới bất kỳ ai. Biến env đổi theo: ~~`SMTP_*`~~ → ~~`RESEND_API_KEY`~~
  → **`BREVO_API_KEY`** (hiện tại).

### apps/web
- `LoginPage.tsx`: thêm nút "Đăng nhập bằng Google" (component mới
  `GoogleSignInButton.tsx`, dùng script Google Identity Services nhúng ở
  `index.html`; tự ẩn nếu chưa cấu hình `VITE_GOOGLE_CLIENT_ID`). Khi
  backend trả `otpRequired`, chuyển sang màn nhập OTP ngay trên trang
  Login (không rời trang) — bắt qua `OtpRequiredError` (`auth/context.ts`).
- `RegisterPage.tsx`: sau khi đăng ký, chuyển sang bước nhập mã OTP (thay
  màn hình tĩnh cũ) — có nút "Gửi lại mã".
- `components/OtpStep.tsx` (mới, tách từ `RegisterPage.tsx` ngày
  2026-09-30) — dùng chung cho cả luồng đăng ký thường lẫn Google mới.
- `AdminUsersPage.tsx`: thêm nút "Từ chối" cạnh "Duyệt" cho user PENDING,
  có confirm dialog cảnh báo xoá hẳn.

**Đã verify:** `npm run build` ✅ (api+web) · `npm run lint` ✅ (api+web) ·
`npm run test:e2e` **(149/149)** ✅ · seed chạy lại idempotent · **đã test
thủ công trên bản live** (Render+Vercel) — đăng ký → nhận OTP thật qua
Brevo → xác nhận → MANAGER duyệt; Google login tài khoản mới → màn OTP →
duyệt → đăng nhập lại được; nút Từ chối hoạt động đúng.

## 3m. Flow 1 Frontend đã làm gì (Horse Profile Management — 2026-09-30)

Đặc tả đầy đủ: **[FLOW1_HORSE_PROFILE_DESIGN.md](FLOW1_HORSE_PROFILE_DESIGN.md)**.
Nguồn: chuẩn thiết kế từ `racehorse-design-system.html` (Tone Navy `#1c2b3a` / Cream `#f5f4f1` / Blue accent `#1a4b8a`, font Inter).

### apps/web — triển khai Flow 1
- **Design Tokens**: Tích hợp biến CSS vào `src/index.css` (tokens Navy, Cream, Brand Blue, huy hiệu `badge-*`, `metric-card`, `chip`, `table`, `modal-overlay`).
- **Use Case 1 (View horse list & detail)**:
  - `HorsesPage.tsx`: Thêm 4 thẻ chỉ số nhanh `HorseMetricCards` (Tổng số ngựa, Đang thi đấu, Nghỉ dưỡng/Giải nghệ, Cần chú ý/Khóa), tìm kiếm tức thời theo tên ngựa, thanh lọc chip trạng thái (`ALL`, `ACTIVE`, `RESTING`, `RETIRED`).
  - `HorseDetailPage.tsx`: Hero banner có avatar tròn lớn (ảnh hoặc ký tự đầu), huy hiệu trạng thái `HorseStatusBadge` (kết hợp trạng thái nghề nghiệp, sức khỏe, điểm thể trạng, cờ khóa tập luyện). Banner cảnh báo khi ngựa bị khóa tập luyện kèm lý do. 4 Tab: **Hồ sơ chi tiết** (key-value grid), **Cây phả hệ (3 đời)** (`PedigreeTree.tsx`), **Buổi tập**, **Hồ sơ y tế**.
- **Use Case 2 (Add / Edit / Delete horse profile)**:
  - `CreateHorseModal.tsx`: Modal tạo ngựa mới (chọn chủ sở hữu từ danh sách user có role OWNER, validate ngày sinh không vượt quá ngày hiện tại).
  - `EditHorseModal.tsx`: Sửa hồ sơ ngựa, đổi chủ sở hữu, cập nhật điểm thể trạng, gán ngựa cha (sireId) và ngựa mẹ (damId) với validate chống chọn trùng hoặc tự làm cha/mẹ.
  - `DeleteHorseModal.tsx`: Hộp thoại xác nhận xóa mềm an toàn (soft-delete bảo toàn lịch sử buổi tập và hồ sơ khám).
  - `PhotoUploadModal.tsx`: Tải lên ảnh đại diện cho ngựa (multipart, tối đa 5MB, preview trước khi lưu).
- **Kiểm chứng**:
  - `npm run build` (tsc + vite) ✅ không lỗi.
  - `npm run lint` (oxlint) ✅ 0 lỗi.
  - Backend e2e tests `npm run test:e2e` **149/149 passed** ✅.

## 3n. Thiết kế Giao diện Dashboard & Shell Rail theo chuẩn demo + Phân quyền RBAC nghiêm ngặt (2026-09-30)

Nghiên cứu cấu trúc từ file mẫu `demo/racehorse-demo.html` và file thiết kế `racehorse-design-system.html`, chuyển đổi giao diện từ thanh topbar đơn sang layout **Dashboard 2 cột chuyên nghiệp**, đồng thời tinh chỉnh phân quyền thao tác và hiển thị (RBAC) nghiêm ngặt cho 5 vai trò chính:
- **Chuẩn hóa Icon & Thẩm mỹ**:
  - Loại bỏ 100% emoji màu mè khỏi toàn bộ giao diện (`Layout`, `DashboardPage`, `HorsesPage`, `HorseDetailPage`).
  - Xây dựng thư viện component icon SVG tối giản, đơn sắc (`apps/web/src/components/Icons.tsx`) chuẩn thiết kế enterprise.
  - Phục hồi nguyên trạng (`git checkout`) giao diện trang đăng nhập `LoginPage.tsx` theo yêu cầu.
- **Cột bên trái (Sidebar Rail - `.rail`)**:
  - Cố định (sticky, `height: 100vh`, `width: 240px`), nền Navy (`var(--brand-navy)` / `#1c2b3a`), chữ vàng kim/kem.
  - **Menu lọc chính xác theo quyền của từng vai trò (RBAC)**:
    - `TRAINER`: Tổng quan, Ngựa đua (toàn bộ chiến mã CLB), Giáo án huấn luyện (Lập giáo án chi tiết), Giải đua (Đăng ký giải đua), Y tế & Sự cố (Cảnh báo vượt ngưỡng thể lực).
    - `VET`: Tổng quan, Sơ đồ đàn ngựa, Hồ sơ khám bệnh & Phác đồ điều trị, Lịch tiêm phòng & móng định kỳ.
    - `GROOM`: Tổng quan, Chuồng & Khẩu phần dinh dưỡng, Báo cáo sự cố đột xuất tại chuồng.
    - `OWNER`: Tổng quan, Ngựa của tôi (chỉ các cá thể sở hữu), Lịch tập & Nhật ký nhận xét HLV, Lịch sử giải đua.
    - `MANAGER`: Toàn quyền tất cả các phân hệ, bao gồm Quản trị hệ thống & Phân quyền thành viên (`/admin/users`).
- **Cột bên phải (Main Area - `.main`)**:
  - **Thanh tiêu đề (`.topbar`)**: Breadcrumb động, nhận diện vai trò người dùng, chuyển đổi ngôn ngữ (VI/EN) và nút đăng xuất.
  - **Trang Dashboard (`DashboardPage.tsx`) cá nhân hóa theo từng vai trò**:
    - **KPIs theo vai trò**:
      - `VET`: 4 trạng thái sức khỏe đàn ngựa (`FIT`, `MONITORING`, `INJURED`, `QUARANTINED`).
      - `TRAINER`: Tổng số chiến mã CLB, Số lượng sẵn sàng tập luyện, Ngựa cảnh báo thể lực/quá tải, Tỷ lệ tuân thủ giáo án.
      - `GROOM`: Số cá thể chuồng phụ trách, Tình trạng khẩu phần ăn, Báo cáo sự cố cần xử lý.
      - `OWNER`: Số ngựa sở hữu, Điểm thể trạng trung bình, Buổi tập gần nhất, Lượt thi đấu sắp tới.
      - `MANAGER`: Tổng số ngựa, Số lượng ngựa bị khoá tập, Tài khoản chờ duyệt RBAC.
    - **Thao tác nhanh (Quick Actions) khớp chuẩn nghiệp vụ**:
      - `TRAINER`: Lập giáo án chi tiết, Đánh giá phong độ buổi tập, Chọn ngựa tham gia giải đua.
      - `VET`: Ghi nhận hồ sơ khám bệnh, Đặt lệnh Khóa huấn luyện khẩn cấp, Theo dõi lịch tiêm phòng.
      - `GROOM`: Xác nhận hoàn thành việc chăm sóc, Gửi báo cáo sự cố chuồng (bỏ ăn/sốt/móng xước), Đề xuất vật tư.
      - `OWNER`: Tra cứu phả hệ (Pedigree) & lý lịch, Theo dõi sức khỏe realtime, Đọc nhật ký nhận xét từ HLV Trưởng.
      - `MANAGER`: Thêm mới hồ sơ ngựa, Duyệt tài khoản RBAC, Xem báo cáo vận hành & Audit Log.
    - **Cảnh báo an toàn**: Hiển thị chi tiết danh sách ngựa đang bị áp lệnh khóa huấn luyện kèm lý do thực tế từ cơ sở dữ liệu.
- **Kiểm chứng**:
  - `npm run build` ✅ thành công 100% trong 193ms.
  - `oxlint` ✅ 0 lỗi.
  - Loại bỏ hoàn toàn emoji, giữ nguyên bản `LoginPage.tsx`.

## 3o. Triển khai phân hệ & Chức năng Lập Giáo án Huấn luyện (Create Training Plan) cho Head Trainer (2026-10-01)

Triển khai hoàn chỉnh tính năng lập giáo án huấn luyện chi tiết cho vai trò Head Trainer (`TRAINER`) và phân hệ quản lý giáo án:
- **Backend Core API & Nghiệp vụ chuyên sâu (Business Rules)**:
  - Phân quyền RBAC nghiêm ngặt: Chỉ `TRAINER` mới có quyền tạo giáo án (`@Roles(Role.TRAINER)`). Các vai trò `MANAGER`, `VET`, `GROOM`, `OWNER` bị chặn `403 Forbidden` nếu cố tình gọi API tạo giáo án (đã verify bằng test E2E).
  - Quy tắc nghiệp vụ chuyên môn (Business Rules):
    + **BR-1**: Chặn lập giáo án cho chiến mã đã giải nghệ (`status === 'RETIRED'`), trả về `400 VALIDATION_ERROR`.
    + **BR-2**: Chặn lập giáo án cho chiến mã đang diện cách ly kiểm dịch y tế (`healthStatus === 'QUARANTINED'`), trả về `400 VALIDATION_ERROR`.
    + **BR-3**: Cho phép soạn thảo giáo án chiến lược cho ngựa đang dính lệnh khóa tập luyện (`locked === true`), nhưng cờ khóa sẽ ngăn việc xếp lịch các buổi tập thực tế (`TrainingSession`).
  - Mở rộng `PLAN_INCLUDE`: Bổ sung thông tin chi tiết ngựa (`name`, `breed`, `ownerId`) vào payload trả về để tối ưu hiển thị danh sách giáo án.
  - Bổ sung Endpoint `GET /api/v1/training-plans`: Cho phép liệt kê toàn bộ giáo án của đàn ngựa theo phân quyền (HLV/Quản lý thấy toàn bộ, Chủ ngựa chỉ thấy giáo án của ngựa mình sở hữu).
  - Viết bổ sung và verify kiểm thử E2E: **152/152 tests PASS 100%** (trong đó có 22/22 test kịch bản `training-plan`).
- **Frontend Web App (`apps/web`)**:
  - Chuẩn hóa phân quyền hiển thị (RBAC):
    + `TRAINER`: Là người duy nhất thấy nút "+ Tạo giáo án mới" trên cả trang `/plans`, trang `/dashboard` và Tab `PlansTab`.
    + `MANAGER` & `OWNER`: Chỉ có quyền xem giáo án (Read-only), không có nút tạo hay chỉnh sửa giáo án.
  - Component Modal `CreateTrainingPlanModal.tsx`:
    + Tự động lọc bỏ các ngựa đã giải nghệ hoặc đang cách ly khỏi danh sách chọn lựa.
    + Thẻ cảnh báo ngữ cảnh: Phân biệt rõ giữa ngựa bị khóa huấn luyện khẩn cấp và ngựa đang bị chấn thương (`INJURED`) để HLV cân nhắc.
    + Khối gợi ý giáo án chuyên môn nhanh (Quick Templates): 4 mẫu giáo án chuẩn (Cự ly 1400m sân cát, Cự ly 1600m sân cỏ, Bứt tốc nước rút 1200m, Bài tập nhẹ phục hồi gân cơ).
  - Trang Quản lý Giáo án `TrainingPlansPage.tsx` (`/plans`):
    + Phụ đề trang cá nhân hóa theo từng vai trò (HLV: lập giáo án; Quản lý: giám sát tiến độ CLB; Chủ ngựa: xem lịch trình ngựa sở hữu).
    + Thẻ thống kê KPI: Tổng số giáo án, Đang áp dụng, Đã hoàn thành, Số chiến mã có giáo án.
    + Bảng danh sách chi tiết các giáo án, người phụ trách, thời gian và trạng thái.
  - Tích hợp Tab `PlansTab.tsx` trong `HorseDetailPage.tsx`:
    + Nhận đầy đủ đối tượng `horse` để hiển thị cảnh báo nghiệp vụ nếu ngựa giải nghệ/cách ly và điểm thể lực hiện tại (`fitnessScore/100`).
  - Kích hoạt menu điều hướng `/plans` trong Sidebar Rail `Layout.tsx` cho các vai trò `TRAINER`, `MANAGER`, `OWNER`.
- **Kiểm chứng**:
  - `npm run build` (tsc + vite) ✅ thành công 100% trong 202ms.
  - `oxlint` ✅ 0 lỗi.
  - E2E Backend `test/training-plan.e2e-spec.ts` ✅ 22/22 test passed.

## 3p. Cơ chế Phân quyền & Xử lý Ngoại lệ Khóa Huấn luyện (Training Lock Exception) giữa Bác sĩ Thú y & HLV Trưởng (2026-10-01)

Giải quyết và chuẩn hóa luồng nghiệp vụ liên quan đến **Exception "Horse is locked" (Khóa huấn luyện)**:
- **Phân định thẩm quyền (Role Authority)**:
  - **Veterinarian (Bác sĩ Thú y)**: Có **thẩm quyền độc quyền** ban hành lệnh *"Khóa huấn luyện"* khẩn cấp (`PATCH /api/v1/horses/:id/lock` với `locked: true` kèm lý do chẩn đoán y tế) và gỡ khóa (`locked: false`) khi chiến mã hồi phục. Các vai trò khác (kể cả Manager hay Trainer) bị chặn `403 Forbidden` nếu gọi route này.
  - **Head Trainer (HLV Trưởng)**: Là đối tượng **bị ảnh hưởng và kiểm soát** bởi lệnh khóa:
    + Khi ngựa bị khóa (`locked === true`), Trainer bị chặn không thể lên lịch buổi tập mới (`POST /api/v1/horses/:id/sessions`), hệ thống ném ngoại lệ `400 VALIDATION_ERROR`: `"Horse training is locked: [Lý do]"`.
    + Khi ngựa bị khóa hoặc chấn thương/cách ly, Trainer cũng bị chặn không thể đăng ký ngựa tham gia giải đua (`POST /api/v1/races/:id/entries`).
    + Trainer được thông báo tức thời qua chuông Notification (`TRAINING_LOCKED`) để chủ động hủy hoặc sắp xếp lại lịch tập của CLB.
- **Frontend Web App (`apps/web`)**:
  - `HorseDetailPage.tsx`: Nút "Khóa tập luyện" / "Mở khóa tập" chỉ hiển thị cho `VET`.
  - `SessionsTab.tsx`: Khi ngựa bị khóa, tự động hiển thị dải thông báo đỏ nổi bật cảnh báo lý do khóa từ Bác sĩ thú y và ẩn form lên lịch tập luyện.
- **Kiểm chứng**:
  - Test E2E `test/races.e2e-spec.ts`: Bổ sung kiểm thử chặn đăng ký giải đua cho ngựa bị khóa (14/14 tests pass).
  - Toàn bộ backend test suite: **153/153 tests pass 100%**.
  - Frontend `npm run build` ✅ không lỗi.

## 4. Việc tiếp theo


MVP (Phase 0-5) đủ 4 main flow gốc. 3 luồng mở rộng sau-MVP (Phase 6-8)
xong phần API. **Phase 9 + Phase 10 vá xong toàn bộ Sprint 2/3 remainder
của `CLAUDE_CODE_BACKEND_FULL.md`.** **Phase 11 (2026-09-29 → 30) thêm
đăng nhập Google + xác thực email bằng OTP + nút Từ chối đăng ký — đã
deploy và test xong trên bản live.** Còn lại:
- **Frontend cho toàn bộ tính năng Phase 6-10** (pedigree/races,
  training-plan/lock, incidents/notifications, healthStatus/injury-
  locations/vaccinations/treatment-plans) — API đã đủ, chưa có UI; làm khi
  cần demo trực quan (không bắt buộc để các phase trên tính "xong"). Đây là
  hạng mục lớn nhất còn lại.
- **Deploy — ĐÃ XONG và đang chạy** (2026-09-25 chốt hạ tầng, hoàn thiện
  + test thật 2026-09-30): API trên Render
  (`racehorse-training-management-system.onrender.com`), Postgres trên
  Neon, frontend trên Vercel
  (`binh062117-horse-managing.vercel.app`). Repo deploy giờ là
  `binh062117/Racehorse-Training-Management-System` (Rin4869 đã
  **transfer ownership** sang `binh062117` ngày 2026-09-29 để Vercel/Render
  tự build được — trước đó bị lỗi vì Vercel/Render nối nhầm/không nối
  được đúng repo, xem DECISIONS.md để chi tiết). Gửi giảng viên xem trực
  tiếp URL Vercel, không cần chạy local. Hướng dẫn đầy đủ (kể cả phần Gửi
  email/Google OAuth) vẫn ở [DEPLOY.md](DEPLOY.md), đã cập nhật khớp thực
  tế (Brevo, không phải Resend/SMTP nữa).
- Việc khác (chưa ưu tiên, chờ chốt): `stalls`, `care_logs`,
  `facility_tasks`, `audit_logs` (nếu có yêu cầu mới), CI (GitHub Actions),
  test frontend (Playwright/Vitest), deliverable giảng viên (ERD/UML, Scrum,
  coverage).
- Git: repo hiện tại `binh062117/Racehorse-Training-Management-System`
  (transfer từ `Rin4869` ngày 2026-09-29). Từ Phase 11 trở đi, các thay
  đổi được merge thẳng vào `main` qua PR (branch riêng → PR → merge ngay,
  không đợi họp — quyết định của người dùng khi cần deploy gấp để test,
  khác quy trình PR #1/#2 trước đó chờ họp nhóm theo `TEAM_RULES.md` §6).
  PR gần nhất: #10 (`0790d57`).

## 5. Cách một phiên mới tiếp tục

1. Đọc `docs/STATE.md` → `docs/PLAN.md` → `docs/DECISIONS.md` → `docs/specs/` của phase đang làm.
2. Kiểm tra Postgres đang chạy: `powershell -File scripts/pg-start.ps1`.
3. `cd apps/api && npm run start:dev` — xác nhận `/api/v1/health` trả `db:"up"`.
4. Viết spec phase mới trong `docs/specs/` **trước khi code**, rồi code theo spec, test ngay.
5. Làm xong → cập nhật §3x/§4 file này + `specs/<phase>.md` §11 + mục trong `DECISIONS.md`.
