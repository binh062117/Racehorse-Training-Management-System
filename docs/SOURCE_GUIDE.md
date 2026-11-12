# Hướng dẫn source code — Racehorse Training & Management System

> Tài liệu cho các thành viên nhóm 2 đọc để **hiểu code và trả lời được câu hỏi của cô** khi demo/vấn đáp.
> Cập nhật: 12/11/2026, theo `main` sau PR #64. Mỗi quy tắc nghiệp vụ đều ghi rõ **file nào xử lý** để mở ra chỉ khi bị hỏi.

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Công nghệ & lý do chọn](#2-công-nghệ--lý-do-chọn)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Backend: một request đi qua những gì](#4-backend-một-request-đi-qua-những-gì)
5. [Các module backend](#5-các-module-backend)
6. [Dữ liệu (Prisma schema)](#6-dữ-liệu-prisma-schema)
7. [Phân quyền 5 vai trò](#7-phân-quyền-5-vai-trò)
8. [Luồng 1 — Huấn luyện → Sẵn sàng thi đấu](#8-luồng-1--huấn-luyện--sẵn-sàng-thi-đấu)
9. [Luồng 2 — Chấn thương & Khóa tập](#9-luồng-2--chấn-thương--khóa-tập)
10. [Luồng 3 — Minh bạch cho chủ ngựa](#10-luồng-3--minh-bạch-cho-chủ-ngựa)
11. [Tính năng mở rộng](#11-tính-năng-mở-rộng)
12. [Frontend](#12-frontend)
13. [Chạy local, test, migration, deploy](#13-chạy-local-test-migration-deploy)
14. [Câu hỏi thường gặp khi vấn đáp](#14-câu-hỏi-thường-gặp-khi-vấn-đáp)

---

## 1. Tổng quan hệ thống

Hệ thống quản lý huấn luyện và chăm sóc ngựa đua cho một câu lạc bộ. Nhiều vai trò cùng làm việc trên **cùng một dữ liệu**: huấn luyện viên lập giáo án và ghi kết quả, groom chăm sóc và báo sự cố, bác sĩ thú y khám và quyết định khóa/mở tập, quản lý điều hành, chủ ngựa theo dõi ngựa của mình.

| Vai trò (`Role`) | Người dùng | Việc chính trong hệ thống |
|---|---|---|
| `MANAGER` | Quản lý CLB | Duyệt tài khoản, hồ sơ ngựa, giải đua, vật tư, xem HLV trễ giáo án, nhật ký hệ thống |
| `TRAINER` | Huấn luyện viên | Lập giáo án, xếp buổi tập, **ghi kết quả**, đăng ký ngựa vào giải |
| `VET` | Bác sĩ thú y | Khám bệnh, **khóa / mở khóa tập**, **chấm điểm thể lực**, đóng sự cố, tiêm phòng |
| `GROOM` | Người chăm sóc | Ghi khẩu phần ăn, **báo sự cố**, chăm sóc hằng ngày, yêu cầu vật tư, ảnh buổi tập |
| `OWNER` | Chủ ngựa | Chỉ xem **ngựa của mình**: hồ sơ, sức khỏe, giáo án, **báo cáo tháng**, kết quả thi đấu |

**3 luồng nghiệp vụ bắt buộc** (đã hoàn thiện trên `main`):

1. **Huấn luyện → Sẵn sàng thi đấu**: giáo án → buổi tập → kết quả → đánh giá thể lực → chỉ ngựa đủ điều kiện mới được đăng ký giải.
2. **Chấn thương**: groom báo sự cố → ngựa tự khóa tập → bác sĩ khám + chấm thể lực ≥ 80 → đóng sự cố → tự mở khóa.
3. **Minh bạch cho chủ ngựa**: chủ ngựa thấy ai khám, ăn gì, tốn bao nhiêu, tập ra sao, ảnh buổi tập — gói trong **báo cáo tháng**.

**Địa chỉ đang chạy:**

- Web (Vercel): https://binh062117-horse-managing.vercel.app
- API (Render): https://racehorse-training-management-system.onrender.com/api/v1
- Swagger (tài liệu API): https://racehorse-training-management-system.onrender.com/api/docs
- Database: PostgreSQL trên Neon

**Tài khoản demo** (mật khẩu theo mẫu `<Role>123!`):

| Email | Mật khẩu | Vai trò |
|---|---|---|
| manager@racehorse.local | Manager123! | MANAGER |
| trainer@racehorse.local | Trainer123! | TRAINER |
| vet@racehorse.local | Vet123! | VET |
| groom@racehorse.local | Groom123! | GROOM |
| owner1@racehorse.local | Owner123! | OWNER (Owner One) |
| owner2@racehorse.local | Owner123! | OWNER (Owner Two) |

---

## 2. Công nghệ & lý do chọn

| Tầng | Công nghệ | Vì sao |
|---|---|---|
| Backend | **NestJS 11** (TypeScript) | Chia module rõ ràng, có sẵn Guard / Pipe / Filter cho phân quyền và validate |
| ORM | **Prisma 6** | Schema một file, sinh type TypeScript, migration có version |
| Database | **PostgreSQL** (Neon) | Dữ liệu quan hệ chặt (ngựa ↔ giáo án ↔ buổi tập ↔ hồ sơ khám) |
| Xác thực | JWT access 15 phút + refresh token 7 ngày, Google Sign-In, OTP qua email | Stateless, refresh được, thu hồi được |
| Validate | `class-validator` + `ValidationPipe({ whitelist: true })` | Trường lạ bị loại, sai kiểu trả 400 |
| Frontend | **React 19 + Vite + Tailwind CSS 3** | Build nhanh, style theo design system riêng |
| Đa ngôn ngữ | **i18next** (vi / en) | Giao diện song ngữ |
| File | Cloudinary (production), ổ đĩa local (fallback) | Ảnh ngựa, ảnh sự cố, ảnh/video buổi tập |
| AI | Groq API (model `openai/gpt-oss-120b`) | Phân tích sức khỏe, gợi ý khẩu phần, cảnh báo rủi ro |
| Test | Jest (unit + e2e với supertest), Postman | e2e chạy trên DB thật, kiểm tra cả quy tắc nghiệp vụ |
| Deploy | Render (API), Vercel (web), Neon (DB) | Gói miễn phí |

**Kiến trúc**: **một API duy nhất (modular monolith)**, một database, chia module theo nghiệp vụ. Không dùng microservice vì quy mô đồ án nhỏ, một DB giúp ràng buộc dữ liệu chặt và dễ deploy. Web gọi API qua REST, prefix `/api/v1`.

---

## 3. Cấu trúc thư mục

```
racehorse/
├── apps/
│   ├── api/                      # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # TOÀN BỘ data model
│   │   │   ├── migrations/       # Migration SQL theo thời gian
│   │   │   └── seed.ts           # Dữ liệu mẫu: tài khoản demo, ngựa, vật tư
│   │   ├── scripts/              # Script dữ liệu demo (seed-flows-demo.ts, demo-rehearsal.mjs…)
│   │   ├── src/
│   │   │   ├── main.ts           # Khởi động: prefix /api/v1, ValidationPipe, filter lỗi, Swagger
│   │   │   ├── app.module.ts     # Gắn các module + 2 guard toàn cục (JWT, Roles)
│   │   │   ├── common/           # Guard, decorator, AppException, filter lỗi
│   │   │   ├── auth/  users/     # Đăng nhập, đăng ký, OTP, duyệt tài khoản
│   │   │   ├── horses/           # Hồ sơ ngựa, phả hệ, KHÓA TẬP, đánh giá thể lực
│   │   │   ├── training/         # Giáo án, buổi tập, tiến độ, job tự động
│   │   │   ├── health/           # Hồ sơ khám, phác đồ điều trị, thuốc
│   │   │   ├── incidents/        # Sự cố (groom báo, bác sĩ xử lý)
│   │   │   ├── injuries/         # Vị trí chấn thương trên cơ thể ngựa
│   │   │   ├── races/            # Giải đua, đăng ký, ĐIỀU KIỆN THI ĐẤU
│   │   │   ├── reports/          # Báo cáo tháng, ảnh/video buổi tập, việc cần làm
│   │   │   ├── feeding/ supplies/ daily-care/ vaccinations/ stalls/
│   │   │   ├── notifications/ audit/ ai/ mail/ files/
│   │   │   └── prisma/           # PrismaService
│   │   └── test/                 # e2e test (*.e2e-spec.ts)
│   └── web/                      # Frontend React
│       └── src/
│           ├── main.tsx          # Khai báo route + phân quyền route
│           ├── auth/             # AuthProvider, RequireAuth
│           ├── lib/              # api.ts (axios + refresh token), types.ts, format, cache
│           ├── ds/               # Design system: ui.tsx (Button, Card, Badge, Modal…), AppShell (sidebar)
│           ├── pages/            # Mỗi trang một file; pages/horse/* là các tab của trang chi tiết ngựa
│           ├── components/       # Component theo nghiệp vụ (horse/, training/, races/, health/…)
│           └── i18n/             # vi.json, en.json
├── docs/                         # Tài liệu (file này, DEMO_SCRIPT.md, DECISIONS.md, API.md…)
├── postman/                      # Bộ test Postman của Tấn
└── TEAM_RULES.md                 # Quy tắc nhóm
```

---

## 4. Backend: một request đi qua những gì

Ví dụ: groom gửi `POST /api/v1/horses/:id/incidents`.

```
Request ─► JwtAuthGuard ─► RolesGuard ─► HorseOwnershipGuard ─► ValidationPipe ─► Controller ─► Service ─► Prisma ─► PostgreSQL
              │                │                 │                    │                            │
              │                │                 │                    │                            └─ ném AppException khi vi phạm quy tắc
              401 nếu thiếu/   403 nếu sai       404 nếu ngựa không    400 nếu body sai
              hết hạn token    vai trò           tồn tại, 403 nếu chủ   kiểu / thừa trường
                                                 ngựa xem ngựa người khác
                                       ▼
                         AllExceptionsFilter đổi mọi lỗi thành { "error": { "code", "message" } }
```

| Thành phần | File | Ghi chú |
|---|---|---|
| `JwtAuthGuard` (toàn cục) | `src/common/guards/jwt-auth.guard.ts` | Mọi route cần token, trừ route gắn `@Public()` |
| `RolesGuard` (toàn cục) | `src/common/guards/roles.guard.ts` | Đọc `@Roles(Role.VET, …)` trên handler |
| `HorseOwnershipGuard` | `src/common/guards/horse-ownership.guard.ts` | Route có `:id` là ngựa: 404 nếu không có, 403 nếu OWNER không sở hữu |
| `@CurrentUser()` | `src/common/decorators/current-user.decorator.ts` | Lấy user từ token trong handler |
| `AppException` | `src/common/app-exception.ts` | Lỗi nghiệp vụ có mã: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409)… |
| `AllExceptionsFilter` | `src/common/filters/all-exceptions.filter.ts` | Định dạng lỗi thống nhất cho web |

**Định dạng lỗi** — web dựa vào `code` để dịch và vào `message` để hiện chi tiết:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Điểm thể lực gần nhất là 70/100 — cần đạt từ 80 mới mở khóa tập." } }
```

**Job chạy nền** — `src/training/missed-sessions.job.ts` chạy **mỗi phút**:

- `reconcileMissed()`: buổi tập `PLANNED` quá giờ hơn **24 giờ** mà chưa có kết quả → chuyển `MISSED`.
- `reconcileOverduePlans()`: giáo án quá ngày kết thúc, **đã có buổi tập** mà chưa hoàn thành → gửi `PLAN_OVERDUE` cho quản lý + HLV (chỉ 1 lần, đánh dấu `overdueNotifiedAt`).

---

## 5. Các module backend

| Module | Route chính | Trách nhiệm |
|---|---|---|
| `auth` | `/auth/register`, `/verify-otp`, `/login`, `/google`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/me` | Đăng ký có OTP email, đăng nhập (mật khẩu bcrypt hoặc Google), cấp/xoay vòng refresh token |
| `users` | `/users`, `/users/approve`, `/users/:id/reject` | Quản lý duyệt tài khoản mới (`PENDING` → `ACTIVE` + gán vai trò), duyệt hàng loạt |
| `horses` | `/horses`, `/horses/:id/lock`, `/fitness-assessment`, `/pedigree`, `/lock-events`, `/ai-insight`, `/feeding-suggestion` | Hồ sơ ngựa, phả hệ 3 đời, **khóa/mở tập**, **đánh giá thể lực 5 tiêu chí**, AI |
| `training` | `/horses/:id/training-plans`, `/horses/:id/sessions`, `/sessions/:id`, `/training-plans`, `/training/progress/overview` | Giáo án, buổi tập, kết quả, tiến độ, job tự động |
| `health` | `/horses/:id/health-records`, `/health-records`, `/treatment-plans/:id/medications` | Hồ sơ khám (kết luận `FIT` / `MONITORING` / `INJURED` / `QUARANTINED`), phác đồ, thuốc, file đính kèm |
| `incidents` | `/horses/:id/incidents`, `/incidents`, `/incidents/:id` | Groom báo sự cố (kèm ảnh), bác sĩ chuyển trạng thái, đóng sự cố bằng hồ sơ khám |
| `injuries` | `/incidents/:id/injury-locations`, `/health-records/:id/injury-locations` | Đánh dấu vị trí chấn thương |
| `races` | `/races`, `/races/readiness`, `/races/:id/entries`, `/race-entries/:id` | Giải đua, **kiểm tra điều kiện thi đấu**, đăng ký, nhập kết quả |
| `reports` | `/horses/:id/report`, `/horses/:id/media`, `/me/tasks` | **Báo cáo tháng**, ảnh/video buổi tập, **việc cần làm theo vai trò** |
| `feeding` | `/horses/:id/feeding-records` | Groom ghi khẩu phần; lấy từ kho thì **trừ tồn kho** và **tính chi phí** |
| `supplies` | `/supplies`, `/supply-requests` | Kho vật tư (có đơn giá); groom yêu cầu nhập, quản lý duyệt thì **cộng tồn kho** |
| `daily-care` | `/daily-care`, `/daily-care/generate` | Checklist chăm sóc hằng ngày |
| `vaccinations` | `/horses/:id/vaccinations`, `/vaccinations`, `/vaccinations/check-due` | Tiêm phòng / tẩy giun, nhắc lịch đến hạn |
| `stalls` | `/stalls`, `/stalls/:id/request-status`, `/approve-status`, `/stalls/horses/:horseId/assign` | Sơ đồ chuồng, xếp ngựa vào ô (1 ô 1 ngựa), **duyệt khử trùng/cách ly** |
| `notifications` | `/notifications` | Thông báo trong app (chuông) |
| `audit` | `/audit-logs` | Nhật ký hệ thống: đăng nhập, duyệt tài khoản, khóa tập… |
| `ai` | (gọi nội bộ) | Gọi Groq: phân tích sức khỏe, gợi ý khẩu phần, cảnh báo rủi ro cao |
| `mail` | (gọi nội bộ) | Gửi OTP, link đặt lại mật khẩu |
| `files` | `/files/...` | Phục vụ file local khi không dùng Cloudinary (có kiểm quyền) |

Danh sách endpoint đầy đủ có trên Swagger (`<domain>/api/docs`) và trong `docs/API.md`.

---

## 6. Dữ liệu (Prisma schema)

File: `apps/api/prisma/schema.prisma`. Các bảng chính và quan hệ:

```
User ─┬─< Horse (ownerId: chủ, trainerId, groomId)
      │
Horse ─┬─< TrainingPlan ─< TrainingSession ─< TrainingMedia
       ├─< HealthRecord ─< TreatmentPlan ─< Medication
       │                └─< InjuryLocation
       ├─< IncidentReport (có thể gắn HealthRecord khi đóng)
       ├─< HorseLockEvent (lịch sử khóa / mở, kèm hồ sơ khám làm căn cứ)
       ├─< FitnessAssessment (5 tiêu chí × 20 điểm = 100)
       ├─< FeedingRecord (──> SupplyItem, costVnd)
       ├─< Vaccination
       ├─< RaceEntry >── Race
       ├─< DailyCareLog
       └── sire / dam (phả hệ: tự tham chiếu Horse)
Stall (code A-01…, trạng thái, yêu cầu chờ duyệt) ←→ Horse.stallNumber
SupplyItem ─< SupplyRequest
Notification, AuditLog, RefreshToken, OtpCode, AuthToken
```

**Các trường quan trọng hay bị hỏi:**

| Bảng | Trường | Ý nghĩa |
|---|---|---|
| `Horse` | `status` | Sự nghiệp: `ACTIVE` / `RESTING` / `RETIRED` |
| `Horse` | `healthStatus` | Y tế hiện tại: `FIT` / `MONITORING` / `INJURED` / `QUARANTINED` (tách riêng với sự nghiệp) |
| `Horse` | `locked`, `lockReason`, `lockIncidentId` | Đang khóa tập? Lý do? Khóa do sự cố nào (để biết đóng sự cố có được tự mở không) |
| `Horse` | `fitnessScore` | Điểm thể lực hiện tại — **chỉ cập nhật qua phiếu đánh giá của bác sĩ**, không sửa tay |
| `TrainingPlan` | `targetDistanceM`, `endDate`, `overdueNotifiedAt` | Cự ly mục tiêu, hạn kết thúc, đã báo trễ chưa |
| `TrainingSession` | `status` | `PLANNED` → `DONE` / `CANCELLED`, hoặc hệ thống tự chuyển `MISSED` |
| `TrainingSession` | `finishTimeSec`, `recoveryHeartRate`, `muscleResponse` | Kết quả nhiều chỉ số: thời gian về đích, nhịp tim hồi phục, phản ứng cơ (`NORMAL` / `TIGHT` / `SORE`) |
| `FeedingRecord` | `costVnd` | = số kg × đơn giá vật tư lúc ghi |
| `Stall` | `pendingStatus` | Trạng thái đang chờ bác sĩ/groom duyệt |

**Xóa mềm**: `Horse`, `User`, `SupplyItem` dùng `deletedAt` thay vì xóa thật, để lịch sử (hồ sơ khám, kết quả thi đấu) không mất.

---

## 7. Phân quyền 5 vai trò

Phân quyền ở **2 lớp**: API (bắt buộc, `@Roles` + guard) và web (ẩn nút/menu, `RequireAuth roles=[…]` trong `main.tsx`). Dù sửa web thì API vẫn chặn.

| Hành động | MANAGER | TRAINER | VET | GROOM | OWNER |
|---|:-:|:-:|:-:|:-:|:-:|
| Tạo / sửa / xóa hồ sơ ngựa | ✔ | | | | |
| Lập giáo án, xếp buổi tập | | ✔ | | | |
| **Ghi kết quả buổi tập** | | ✔ | | | |
| Ảnh/video buổi tập | | ✔ | | ✔ | |
| **Báo sự cố** | | | | ✔ | |
| Lập hồ sơ khám, đóng sự cố | | | ✔ | | |
| **Khóa / mở khóa tập** | | | ✔ | | |
| **Chấm điểm thể lực** | | | ✔ | | |
| Đăng ký ngựa vào giải | ✔ | ✔ | | | |
| Tạo giải, nhập kết quả thi đấu | ✔ | | | | |
| Ghi khẩu phần ăn | | | | ✔ | |
| Duyệt yêu cầu vật tư | ✔ | | | | |
| Duyệt khử trùng / cách ly ô chuồng | | | ✔ | ✔ | |
| Báo cáo tháng | ✔ | | | | ✔ (ngựa mình) |
| Duyệt tài khoản, nhật ký hệ thống | ✔ | | | | |

**Chủ ngựa chỉ thấy ngựa của mình** ở 3 chỗ:

1. `GET /horses` tự lọc theo `ownerId`.
2. Mọi route `/horses/:id/...` qua `HorseOwnershipGuard` → 403 nếu không phải ngựa của mình.
3. Sơ đồ chuồng: ngựa người khác hiện "Ngựa khác (Bảo mật)" (`stalls.service.ts → listStalls`).

---

## 8. Luồng 1 — Huấn luyện → Sẵn sàng thi đấu

### Các bước

```
HLV lập giáo án (mục tiêu, ngày, cự ly mục tiêu)
   └─► HLV xếp buổi tập (thời gian tương lai, trong khoảng ngày giáo án)
          └─► Buổi tập diễn ra ─► HLV ghi kết quả trong 24h (≥ 1 chỉ số)  ──► DONE
                                └─► quá 24h không ghi ───────────────────────► MISSED (tự động)
   └─► Tiến độ giáo án = số buổi DONE / số buổi (không tính buổi hủy)
          ├─ tất cả DONE ─► HOÀN THÀNH
          └─ quá ngày kết thúc mà chưa xong ─► TRỄ HẠN (báo quản lý + HLV, không chặn gì)
Bác sĩ chấm thể lực (5 tiêu chí) ─► Horse.fitnessScore
Đăng ký giải: chỉ khi ĐỦ ĐIỀU KIỆN THI ĐẤU
```

### Quy tắc & nơi xử lý

| Quy tắc | Giá trị | File |
|---|---|---|
| Chỉ **HLV** tạo/sửa giáo án, buổi tập, ghi kết quả | `@Roles(Role.TRAINER)` | `training.controller.ts` |
| Buổi tập mới phải ở **tương lai** và **trong khoảng ngày của giáo án** | | `training.service.ts` (`assertFuture`, `assertPlanWindow`) |
| **EX-01**: hai buổi tập của cùng một ngựa phải cách nhau ≥ **60 phút** | `SESSION_CONFLICT_WINDOW_MIN = 60` | `training.service.ts → assertNoScheduleConflict` |
| Ngựa **đang khóa** thì không xếp buổi mới, không lập giáo án mới | | `training.service.ts`, `horses.service.ts` |
| **Chỉ ghi kết quả sau giờ tập** — buổi chưa diễn ra thì không được DONE | | `training.service.ts → update` |
| Ghi kết quả trong vòng **24 giờ** sau giờ tập, quá hạn → `MISSED` | `RESULT_WINDOW_HOURS = 24` | `training.service.ts`, `missed-sessions.job.ts` |
| DONE phải có **ít nhất 1 kết quả** (thời gian về đích / nhịp tim hồi phục / phản ứng cơ) | | `training.service.ts` |
| Đổi giờ / loại / cự ly chỉ khi buổi còn ở tương lai | | `training.service.ts` |
| Nhịp tim tối đa > **195** → cảnh báo `FITNESS_WARNING` cho HLV + groom + chủ ngựa | `FITNESS_HEART_RATE_MAX = 195` | `training.service.ts` |
| Tiến độ giáo án tính **theo buổi**, không theo lịch | complete = mọi buổi (trừ hủy) đều DONE | `src/training/plan-progress.ts` |
| Buổi **MISSED** vẫn được tính → giáo án có buổi lỡ sẽ **không bao giờ hoàn thành**, HLV phải lập giáo án mới | quyết định nhóm (cách b) | `plan-progress.ts` |
| Giáo án **chưa có buổi nào** thì không bị tính trễ | | `plan-progress.ts` |
| Cự ly mục tiêu: cảnh báo nếu chưa buổi DONE nào đạt `targetDistanceM` | | `plan-progress.ts → distanceShort` |
| Điểm thể lực = tổng 5 tiêu chí × 0–20: tốc độ, sức bền, cơ gân & khớp, phục hồi, tinh thần; **chỉ bác sĩ chấm** | | `horses.service.ts → assessFitness`, `horses.controller.ts` |

### Điều kiện thi đấu (race readiness)

File: `apps/api/src/races/race-readiness.ts`. Ngựa **chỉ được đăng ký giải** khi đủ cả:

1. Không bị khóa tập, không giải nghệ, không cách ly.
2. **Giáo án gần nhất** (theo ngày bắt đầu) đã **hoàn thành** (mọi buổi DONE).
3. **Điểm thể lực của bác sĩ ≥ 80** (`FITNESS_PASS = 80`, khai báo trong `horses.service.ts`).

- `GET /races/readiness`: danh sách ngựa + `ready` + **lý do bằng tiếng Việt** (chủ ngựa chỉ nhận ngựa của mình).
- `POST /races/:id/entries`: kiểm tra lại cùng điều kiện ở server, sai thì trả 400 kèm lý do; đăng ký trùng trả 409.

### Giao diện

- `pages/TrainingPlansPage.tsx`: danh sách giáo án, lọc Đang thực hiện / Trễ hạn / Hoàn thành, cột tiến độ (`components/training/PlanProgress.tsx`).
- `pages/horse/SessionsTab.tsx`: buổi tập của ngựa, form ghi kết quả. Lựa chọn "Hoàn thành" **chỉ hiện khi buổi đã qua giờ**. Có nút thêm ảnh/video.
- `pages/RacesPage.tsx` + `components/races/ReadinessPanel.tsx`: bảng "Ngựa sẵn sàng thi đấu" kèm lý do. Form đăng ký chỉ cho chọn ngựa đủ điều kiện, ngựa chưa đủ thì bị làm mờ kèm lý do.
- `components/dashboard/TaskList.tsx`: quản lý thấy danh sách **HLV trễ giáo án**.

---

## 9. Luồng 2 — Chấn thương & Khóa tập

### Các bước

```
Groom báo sự cố (mô tả, mức độ LOW/MEDIUM/HIGH, ảnh)
   ├─► mọi bác sĩ nhận thông báo INCIDENT_REPORTED
   ├─► mức MEDIUM/HIGH: AI phân tích rủi ro, nếu CAO → thông báo AI_RISK_ALERT
   └─► mức HIGH: ngựa TỰ ĐỘNG BỊ KHÓA TẬP, healthStatus → INJURED,
                 lưu HorseLockEvent, báo số buổi tập đã lên lịch bị ảnh hưởng
Trong lúc khóa: không xếp buổi tập mới, không lập giáo án, không đăng ký giải
Bác sĩ: lập hồ sơ khám (kết luận FIT) + chấm thể lực
   └─► Đóng sự cố (RESOLVED) — bắt buộc chọn hồ sơ khám đi kèm
          └─► Tự mở khóa nếu: sự cố này là nguyên nhân khóa  VÀ  hồ sơ khám FIT
                              VÀ  điểm thể lực sau khi khóa ≥ 80
Hoặc bác sĩ mở khóa thủ công: cần hồ sơ khám FIT sau khi khóa + điểm ≥ 80
```

### Quy tắc & nơi xử lý

| Quy tắc | File |
|---|---|
| Chỉ **groom** báo sự cố | `incidents.controller.ts` |
| Sự cố mới → thông báo cho tất cả bác sĩ | `incidents.service.ts → create` |
| **HIGH tự khóa tập** (nếu ngựa đang khóa vì lý do khác thì giữ nguyên lý do cũ) | `incidents.service.ts`, `horses.service.ts → lockForIncident` |
| Khóa → `healthStatus` chuyển `INJURED` (nếu đang FIT/MONITORING) | `horses.service.ts → applyLock` |
| Trạng thái sự cố **chỉ đi tiến**: `OPEN` → `IN_PROGRESS` → `RESOLVED`; đã RESOLVED thì không sửa | `incidents.service.ts → update` |
| **Đóng sự cố bắt buộc có hồ sơ khám** của đúng ngựa đó | `incidents.service.ts → update` |
| Chỉ **bác sĩ** khóa / mở khóa và chấm thể lực | `horses.controller.ts` (`@Roles(Role.VET)`) |
| Mở khóa cần hồ sơ khám **FIT viết sau thời điểm khóa** | `horses.service.ts → assertFitRecord` |
| Mở khóa cần **đánh giá thể lực sau khi khóa ≥ 80** (lấy bản mới nhất) | `horses.service.ts → passingAssessmentScore` |
| Mọi lần khóa / mở đều lưu **lịch sử** (ai, lúc nào, lý do, căn cứ hồ sơ khám nào) | bảng `HorseLockEvent`, `GET /horses/:id/lock-events` |
| Ghi **nhật ký hệ thống** khi khóa / mở | `horses.service.ts` → `AuditService` |

### Giao diện

- `pages/IncidentsPage.tsx`: groom báo sự cố, bác sĩ xử lý / đóng (modal chọn hồ sơ khám). Lọc theo trạng thái, mức độ, ngựa (`?horseId=`).
- `components/horse/LockHorseModal.tsx`: bác sĩ khóa / mở. Khi mở khóa, modal hiện **điểm thể lực mới nhất** và yêu cầu ≥ 80, có nút chấm điểm ngay.
- `components/horse/FitnessAssessmentModal.tsx`: phiếu 5 tiêu chí (HLV / quản lý chỉ xem lịch sử).
- `pages/HorseDetailPage.tsx` + `components/horse/HorseStatusLine.tsx`: dòng trạng thái **Bị khóa tập / Đang điều trị / Sẵn sàng thi đấu / Đang tập** kèm lý do.
- `pages/horse/HealthTab.tsx`: hồ sơ khám, phác đồ, vị trí chấn thương, lịch sử khóa/mở.

---

## 10. Luồng 3 — Minh bạch cho chủ ngựa

Mục tiêu: chủ ngựa trả tiền nên phải thấy **ai chăm, ai khám, ăn gì, tốn bao nhiêu, tập ra sao**.

| Thành phần | Cách làm | File |
|---|---|---|
| Đơn giá vật tư | `SupplyItem.unitPrice` (₫ / đơn vị) | `supplies/*`, `pages/SuppliesPage.tsx` |
| Chi phí mỗi bữa | Groom ghi khẩu phần **lấy từ kho** → `costVnd = kg × đơn giá`, đồng thời **trừ tồn kho** | `feeding/feeding.service.ts`, `pages/horse/FeedingTab.tsx` |
| Ảnh / video buổi tập | `POST /horses/:id/media` (HLV/groom, jpg/png/webp/mp4/webm/mov ≤ 50 MB), lưu Cloudinary | `reports/reports.service.ts → addMedia`, `SessionsTab.tsx` |
| **Báo cáo tháng** | `GET /horses/:id/report?month=YYYY-MM`: thông tin ngựa + người phụ trách, hồ sơ khám + tên bác sĩ, sự cố, chi phí ăn theo từng loại, tiến độ giáo án, đánh giá thể lực, thi đấu, điều kiện thi đấu, ảnh | `reports/reports.service.ts → horseReport`, `pages/ReportsPage.tsx` (`/reports`) |
| In / lưu PDF | Nút in của trình duyệt | `ReportsPage.tsx` |
| Chỉ xem ngựa của mình | `HorseOwnershipGuard` | xem [mục 7](#7-phân-quyền-5-vai-trò) |

---

## 11. Tính năng mở rộng

| Tính năng | Mô tả ngắn | File chính |
|---|---|---|
| **Việc cần làm theo vai trò** | Dashboard đếm việc thật: bác sĩ (sự cố mở, ngựa khóa, mũi tiêm đến hạn), HLV (buổi hôm nay, buổi chờ ghi kết quả, giáo án trễ), groom (chăm sóc hôm nay, vật tư sắp hết), quản lý (tài khoản chờ duyệt, yêu cầu vật tư, giáo án trễ, sự cố HIGH), chủ ngựa (ngựa bị khóa, sự cố, báo cáo) | `reports.service.ts → tasks`, `components/dashboard/TaskList.tsx` |
| **Sơ đồ chuồng trại** (Tấn) | Ô A-01…C-10, 1 ô tối đa 1 ngựa. Đổi sang khử trùng / cách ly phải được **bác sĩ hoặc groom duyệt**. Chủ ngựa không thấy ngựa người khác | `stalls/*`, `pages/StableMapPage.tsx` |
| **AI** | Phân tích sức khỏe (bác sĩ, quản lý), gợi ý khẩu phần, tự cảnh báo rủi ro cao khi có sự cố. AI lỗi không làm hỏng thao tác chính | `ai/ai.service.ts`, `components/horse/AiInsightCard.tsx`, `FeedingSuggestionCard.tsx` |
| Vật tư | Groom yêu cầu → quản lý duyệt → cộng tồn kho; cảnh báo dưới mức tối thiểu | `supplies/*` |
| Chăm sóc hằng ngày | Checklist theo ngày cho groom | `daily-care/*`, `pages/DailyCarePage.tsx` |
| Tiêm phòng / tẩy giun | Lịch tiêm, nhắc đến hạn (`PREVENTIVE_CARE_DUE`) | `vaccinations/*`, `pages/HealthSchedulePage.tsx` |
| Nhật ký hệ thống | Ai làm gì, lúc nào (đăng nhập, duyệt tài khoản, khóa tập…) | `audit/*`, `pages/AuditLogPage.tsx` |
| Phả hệ | Cha / mẹ, cây 3 đời | `horses.service.ts → pedigree`, `pages/horse/PedigreeTab.tsx` |
| Lọc theo ngựa | `?horseId=` trên Sự cố / Lịch tiêm / Hồ sơ khám, mở từ trang chi tiết ngựa | `components/HorseFilterChip.tsx` |

---

## 12. Frontend

| Chủ đề | Cách làm | File |
|---|---|---|
| Route & phân quyền trang | `createBrowserRouter`, bọc `RequireAuth roles={[…]}` | `src/main.tsx`, `src/auth/RequireAuth.tsx` |
| Đăng nhập & token | Lưu access + refresh token; axios tự gắn `Authorization: Bearer`; gặp **401 thì tự gọi `/auth/refresh` một lần** rồi gửi lại request | `src/lib/api.ts`, `src/auth/AuthProvider.tsx` |
| Thông báo lỗi | Dịch theo `error.code`, giữ chi tiết tiếng Việt từ server, báo riêng khi máy chủ đang khởi động | `src/lib/localizedError.ts`, `src/components/ErrorText.tsx` |
| Design system | Button, Card, Badge, Modal, Field, KpiStrip, Icon… dùng chung | `src/ds/ui.tsx` |
| Khung trang | Sidebar navy thu gọn, menu theo vai trò | `src/ds/AppShell.tsx` |
| Gọi dữ liệu | `useCachedResource` (cache theo key), `usePagedResource` (phân trang) | `src/lib/*.ts` |
| Kiểu dữ liệu | Interface khớp response của API | `src/lib/types.ts` |
| Đa ngôn ngữ | `t('key')`, file `vi.json` / `en.json` | `src/i18n/` |
| Trang chi tiết ngựa | Các tab: hồ sơ, phả hệ, giáo án, buổi tập, tiến độ, y tế, khẩu phần | `pages/HorseDetailPage.tsx`, `pages/horse/*` |
| Vercel refresh không 404 | Rewrite mọi đường dẫn về `index.html` | `apps/web/vercel.json` |

---

## 13. Chạy local, test, migration, deploy

```bash
# Backend
cd apps/api
npm install
cp .env.example .env              # điền DATABASE_URL, JWT_ACCESS_SECRET…
npx prisma migrate deploy         # tạo bảng
npx prisma db seed                # tài khoản demo + dữ liệu mẫu
npm run start:dev                 # API http://localhost:3000/api/v1 , Swagger http://localhost:3000/api/docs

# Frontend
cd apps/web
npm install
npm run dev                       # http://localhost:5173
```

| Việc | Lệnh | Kết quả hiện tại |
|---|---|---|
| Unit test | `cd apps/api && npm test` | 49/49 |
| e2e test (cần DB local) | `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand` | 205/205 |
| Kiểm thử kịch bản demo | `node apps/api/scripts/demo-rehearsal.mjs` | 24/24 bước |
| Typecheck web | `cd apps/web && npx tsc --noEmit -p tsconfig.app.json` | sạch |
| Build web | `cd apps/web && npm run build` | sạch |

**Migration**:

- Sửa `schema.prisma`, rồi tạo thư mục `prisma/migrations/<thời gian>_<tên>/migration.sql`.
- Lệnh tạo: `npx prisma migrate diff --from-url <DB local> --to-schema-datamodel prisma/schema.prisma --script`.
- **Bắt buộc commit migration cùng schema.** Production chạy `prisma migrate deploy` khi khởi động; thiếu migration thì thiếu bảng và trang lỗi 500.

**Deploy**:

- Merge vào `main` → Render tự build API (chạy migration) và Vercel tự build web.
- Render gói miễn phí **tắt máy khi không dùng**: request đầu mất 30–60 giây. Trước demo phải mở web trước vài phút cho máy chủ khởi động.

---

## 14. Câu hỏi thường gặp khi vấn đáp

**Kiến trúc & công nghệ**

- **Vì sao không dùng microservice?** Quy mô đồ án nhỏ, các nghiệp vụ dính chặt vào nhau (khóa tập ảnh hưởng buổi tập, giải đua). Một API + một DB giữ được ràng buộc dữ liệu, dễ test, dễ deploy. Code vẫn chia module theo nghiệp vụ (modular monolith).
- **Phân quyền làm thế nào?** Role nằm trong JWT. Hai guard toàn cục `JwtAuthGuard` + `RolesGuard` đọc `@Roles(...)` trên từng endpoint. Dữ liệu theo ngựa thêm `HorseOwnershipGuard` để chủ ngựa chỉ thấy ngựa của mình. Web chỉ ẩn nút; **server mới là nơi chặn thật**.
- **Token hết hạn thì sao?** Access token sống 15 phút. Web gặp 401 sẽ tự gọi `/auth/refresh` bằng refresh token (7 ngày, lưu DB, thu hồi được khi đăng xuất), rồi gửi lại request.
- **Đăng ký tài khoản thế nào?** Đăng ký → nhận OTP qua email → xác minh → tài khoản `PENDING` → quản lý duyệt và gán vai trò → `ACTIVE`. Có đăng nhập Google.
- **Validate dữ liệu ở đâu?** DTO dùng `class-validator`, `ValidationPipe` với `whitelist: true` loại trường lạ. Quy tắc nghiệp vụ (khóa, 60 phút, ≥ 80…) nằm trong service và ném `AppException`.
- **Lỗi trả về có dạng gì?** Luôn là `{ error: { code, message } }` nhờ `AllExceptionsFilter`, web dựa vào `code` để dịch.
- **Xóa ngựa có mất lịch sử không?** Không. Xóa mềm (`deletedAt`), hồ sơ khám và kết quả thi đấu vẫn còn.

**Luồng 1**

- **Khi nào giáo án hoàn thành?** Khi mọi buổi tập của giáo án đều DONE (buổi hủy không tính). Không phụ thuộc lịch.
- **Quá ngày kết thúc mà chưa xong thì sao?** Giáo án thành **Trễ hạn**, hệ thống báo quản lý + HLV một lần để nhắc nhở. Không khóa gì.
- **Buổi tập bị lỡ thì sao?** Quá 24 giờ sau giờ tập mà HLV chưa ghi kết quả → hệ thống tự chuyển MISSED (job chạy mỗi phút). Giáo án có buổi lỡ không hoàn thành được, HLV phải lập giáo án mới.
- **Sao không cho ghi kết quả trước giờ tập?** Kết quả mô tả buổi tập đã diễn ra. Cho ghi trước thì giáo án "hoàn thành" giả, và ngựa lọt vào danh sách thi đấu.
- **Sao groom không ghi kết quả?** Nhóm quyết định chỉ HLV chịu trách nhiệm kết quả chuyên môn; groom chỉ thêm ảnh/video.
- **Điểm thể lực lấy ở đâu?** Chỉ từ phiếu 5 tiêu chí của bác sĩ (mỗi tiêu chí 0–20). Quản lý không sửa tay được.
- **Điều kiện thi đấu là gì?** Không khóa / giải nghệ / cách ly, giáo án gần nhất hoàn thành, thể lực ≥ 80. Kiểm tra ở server khi đăng ký, nên dù gọi API trực tiếp cũng không lách được.
- **Hai buổi tập trùng giờ?** Phải cách nhau ít nhất 60 phút, kiểm tra cả khi tạo mới và khi dời giờ (EX-01).

**Luồng 2**

- **Sự cố nào làm khóa tập?** Mức HIGH tự khóa ngay. MEDIUM/LOW thì bác sĩ xem rồi tự quyết khóa thủ công.
- **Ai được mở khóa?** Chỉ bác sĩ, và cần đủ: hồ sơ khám FIT viết sau khi khóa + đánh giá thể lực sau khi khóa ≥ 80.
- **Đóng sự cố có tự mở khóa không?** Có, nếu chính sự cố đó gây ra khóa, hồ sơ khám kết luận FIT và điểm ≥ 80. Nếu ngựa đang khóa vì lý do khác thì vẫn giữ khóa.
- **Truy vết thế nào?** Bảng `HorseLockEvent` lưu mọi lần khóa / mở (ai, lúc nào, lý do, căn cứ hồ sơ khám). Kèm nhật ký hệ thống.

**Luồng 3**

- **Chi phí ăn tính thế nào?** Mỗi bữa groom chọn thức ăn từ kho → `costVnd = kg × đơn giá` lúc ghi, đồng thời trừ tồn kho. Báo cáo tháng cộng theo từng loại thức ăn.
- **Chủ ngựa có xem được ngựa người khác không?** Không: API trả 403, sơ đồ chuồng ẩn tên ngựa người khác.

**Vận hành**

- **Sao mở web lần đầu chậm?** Render gói miễn phí tắt máy khi không dùng, khởi động lại mất 30–60 giây; web có báo "máy chủ đang khởi động".
- **Test những gì?** Unit test cho quy tắc huấn luyện (mock DB), 205 e2e test gọi API thật trên DB (phân quyền, khóa tập, điều kiện thi đấu, sự cố…), bộ Postman, và script kiểm thử kịch bản demo.
