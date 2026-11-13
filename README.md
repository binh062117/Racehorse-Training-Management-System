# Racehorse Training & Management System

SWP391 - Software Project. A web-based system for managing racehorse
profiles, training, medical records, and related activities.

- **Team rules**: [TEAM_RULES.md](TEAM_RULES.md)
- **Documents**: https://docs.google.com/spreadsheets/d/1Lvt5olaitrGitI21ocxcncGpBv1YzI1S/edit?gid=1322017341#gid=1322017341
- **Task Management**: https://docs.google.com/spreadsheets/d/1S5tOJ0vErWeYvc5K3pkXOHmyE57Ab1nU7RSLhxpTjFU/edit?gid=0#gid=0

---

Đồ án môn Software Development Project. Kiến trúc: **1 Core API** (NestJS) +
frontend (React/Vite). Tài liệu thiết kế trong [`docs/`](docs/) —
đọc [docs/OVERVIEW.md](docs/OVERVIEW.md) và [docs/PLAN.md](docs/PLAN.md) trước.

**Thành viên mới trong nhóm, máy chưa từng chạy project này:** đọc
[docs/SETUP.md](docs/SETUP.md) — phần mềm cần cài (Node, PostgreSQL/Docker,
VS Code + extension) và các bước cài đặt từ đầu. Phần dưới đây là bản tóm
tắt nhanh cho ai đã setup rồi.

**Muốn đưa lên mạng để demo cho giảng viên (không cần chạy local):** đọc
[docs/DEPLOY.md](docs/DEPLOY.md) — Render (API) + Neon (Postgres) + Vercel
(frontend), free hoàn toàn.

```
apps/
  api/   NestJS + Prisma + PostgreSQL — Core API
  web/   React + Vite — frontend MVP demo
demo/    racehorse-demo.html (offline, mock) và racehorse-demo-live.html (gắn API thật)
scripts/ pg-start.ps1 / pg-stop.ps1 — bật/tắt PostgreSQL local
docs/    tài liệu thiết kế
```

## Yêu cầu

- Node 24 + npm
- PostgreSQL — bản portable tại `C:\Users\Lenovo\pgsql`
  (data: `C:\Users\Lenovo\pgdata`, db `racehorse`, user `postgres` / `postgres`).
  **Tự khởi động khi đăng nhập Windows** qua `scripts/pg-autostart.vbs` (đã đặt
  bản sao trong thư mục Startup của user). Điều khiển tay:
  `scripts/pg-start.ps1` / `scripts/pg-stop.ps1`.
  Tắt autostart: xoá `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\pg-autostart.vbs`.
  ⚠️ Các đường dẫn trên chỉ đúng trên máy này — **máy khác trong nhóm dùng
  [docs/SETUP.md](docs/SETUP.md) §3** (Docker hoặc tự cài Postgres riêng).

## Chạy Core API (lần đầu)

```powershell
# 1. bật PostgreSQL (thường đã tự chạy sau khi đăng nhập Windows)
powershell -File scripts/pg-start.ps1

# 2. cài & cấu hình API
cd apps/api
copy .env.example .env        # sửa lại nếu cần (Resend API key, secrets...)
npm install
npm run prisma:generate
npm run prisma:migrate        # tạo bảng
npm run db:seed               # tạo tài khoản MANAGER

# 3. chạy
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/v1/health

## Chạy frontend (cần API đang chạy ở :3000)

```powershell
cd apps/web
npm install
npm run dev        # http://localhost:5173
```

`apps/web/.env` mặc định trỏ `VITE_API_URL=http://localhost:3000/api/v1`.

## Tài khoản demo (sau `npm run db:seed`)

| Email | Mật khẩu | Role |
|---|---|---|
| `manager@racehorse.local` | `Manager123!` | MANAGER |
| `trainer@racehorse.local` | `Trainer123!` | TRAINER |
| `vet@racehorse.local` | `Vet123!` | VET |
| `groom@racehorse.local` | `Groom123!` | GROOM |
| `owner1@racehorse.local` | `Owner123!` | OWNER (Thunderbolt, Sea Breeze) |
| `owner2@racehorse.local` | `Owner123!` | OWNER (Midnight) |
| `newbie@racehorse.local` | `Newbie123!` | PENDING — chờ MANAGER duyệt |

## Demo 4 luồng MVP (bấm tay trên web)

1. **Setup** — đăng nhập MANAGER → *Ngựa* → *Thêm ngựa* (gán cho owner) →
   *Người dùng* → duyệt `newbie@` (chọn role → *Duyệt*).
2. **Training** — đăng nhập TRAINER → mở 1 ngựa → tab *Buổi tập* → tạo buổi tập →
   đăng nhập GROOM → *Cập nhật* → `status=DONE` + nhập result → thấy `DONE`.
3. **Health** — đăng nhập VET → mở ngựa → tab *Y tế* → tạo hồ sơ khám →
   *Tải tệp đính kèm* (PDF/ảnh) → *Mở tệp đính kèm*.
4. **View** — đăng nhập `owner1@` → chỉ thấy ngựa của mình, xem tab Buổi tập / Y tế,
   không có nút tạo/sửa. `owner2@` mở URL ngựa của owner1 → báo lỗi quyền.

Đổi ngôn ngữ VI/EN ở góc phải header.

5. **Đăng ký + OTP + duyệt** — trang `/register` → điền form → nhập mã
   OTP 6 số gửi qua email (Brevo trên bản deploy, hoặc log console khi
   chạy local chưa cấu hình `BREVO_API_KEY`) → tài khoản ở trạng thái
   PENDING chờ MANAGER duyệt (hoặc **Từ chối** — xoá hẳn, cho đăng ký lại
   được) ở `/admin/users`.
6. **Đăng nhập Google** — trang `/login` → nút "Đăng nhập bằng Google"
   (cần `VITE_GOOGLE_CLIENT_ID`, tự ẩn nếu chưa cấu hình). Tài khoản
   Google mới cũng phải qua bước nhập OTP (điền sẵn email/tên từ Google,
   không cần gõ tay) rồi mới tới bước MANAGER duyệt, giống hệt luồng đăng
   ký thường.

`apps/api` còn có 3 luồng mở rộng đã xong phần API nhưng **chưa có UI**:
Pedigree & Races, Training Plan & Lock, Health & Injury (incidents +
notifications) — xem [docs/STATE.md](docs/STATE.md) §4 và thử nhanh qua
`demo/racehorse-demo-live.html` hoặc Swagger (`/api/docs`).

## Test

```powershell
cd apps/api
npm test           # unit
npm run test:e2e   # end-to-end, 149 test (cần PostgreSQL + đã seed)

cd apps/web
npm run build      # tsc + vite build
npm run lint       # oxlint
```

## Quy ước

- Nhánh `feat/phase-N-...`, PR nhỏ theo phase (xem [docs/PLAN.md](docs/PLAN.md) §6).
- Commit message tiếng Anh, conventional commits.
- Không commit `.env` (đã có trong `.gitignore`).
- **Không push trực tiếp lên `main`** — theo [TEAM_RULES.md](TEAM_RULES.md) §6:
  branch riêng → PR → họp nhóm review → merge.
