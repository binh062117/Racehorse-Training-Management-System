# SETUP — cài môi trường để chạy Core API + DB (cho cả nhóm)

> File này dành cho **bất kỳ ai trong nhóm** muốn chạy được `apps/api` +
> PostgreSQL trên máy mình — không giả định máy đó là máy của người viết
> tài liệu. Đọc xong file này là chạy được, không cần hỏi lại trong nhóm chat.
> Muốn hiểu kiến trúc/tiến độ dự án thì đọc [OVERVIEW.md](OVERVIEW.md) và
> [STATE.md](STATE.md) — file này chỉ nói về **cài đặt máy**.

## 1. Phần mềm cần cài trước

| Phần mềm | Bản khuyên dùng | Vì sao cần |
|---|---|---|
| **Git** | mới nhất | clone/pull/push repo |
| **Node.js** | **24.x** (kèm sẵn npm) — [nodejs.org](https://nodejs.org) | chạy API (NestJS) + frontend (Vite) |
| **PostgreSQL** | 17.x | database — xem §3, có 2 cách cài |
| **Docker Desktop** | mới nhất | *(tuỳ chọn nhưng khuyên dùng)* cách gọn nhất để có PostgreSQL, không phải tự cài/cấu hình |
| **VS Code** | — | *(tuỳ chọn)* IDE nhóm đang dùng |
| ↳ extension **Prisma** | — | tô màu cú pháp `schema.prisma`, autocomplete |
| ↳ extension **ESLint** + **Prettier** | — | khớp lint/format với CI |

Không cần cài PostgreSQL client (psql) riêng — **Prisma Studio** (xem §6) đã
đủ để xem/sửa dữ liệu qua giao diện web, không cần biết SQL.

### Windows — lỗi hay gặp: "running scripts is disabled"

PowerShell mặc định chặn chạy file `.ps1` (và `npm` trên Windows thực chất
gọi `npm.ps1`). Sửa **một lần duy nhất**, không cần quyền admin:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Gõ `Y` khi được hỏi. Làm xong thì `npm ...` và các script `.ps1` trong
`scripts/` chạy bình thường. Chưa muốn đổi policy thì né tạm bằng cách gọi
thẳng bản `.cmd`: `npm.cmd run start:dev` (npm) hoặc
`powershell -ExecutionPolicy Bypass -File scripts\pg-start.ps1` (script khác).

## 2. Clone & cài dependencies

```powershell
git clone <repo-url> racehorse
cd racehorse

cd apps/api
npm install

cd ../web
npm install
```

Mạng hay `ECONNRESET` khi cài? Cứ chạy lại `npm install` — repo đã cấu hình
`maxsockets=3` + retry cao trong `.npmrc` để đỡ đứt giữa chừng.
Prisma Client được tự generate sau khi cài dependencies, trước khi build và
khi chạy `npm run start:dev`. Nếu chạy TypeScript trực tiếp bằng công cụ khác,
hãy chạy `npm run prisma:generate` sau khi schema thay đổi.

## 3. Bật PostgreSQL — chọn 1 trong 2 cách

### Cách A — Docker (khuyên dùng, ít việc nhất)

Cần Docker Desktop đang chạy. Ở thư mục gốc repo:

```powershell
docker compose up -d db
```

Tạo container Postgres 17, lộ ra `localhost:5432`, db `racehorse`, user/pass
`postgres`/`postgres` — khớp sẵn với `DATABASE_URL` mặc định trong
`.env.example`. Tắt: `docker compose stop db`. Dữ liệu giữ lại giữa các lần
tắt/bật (Docker volume `pgdata`).

### Cách B — Cài PostgreSQL trực tiếp lên máy

Tải bản cài đặt chính thức tại [postgresql.org/download](https://www.postgresql.org/download/)
(hoặc bản portable nếu không có quyền admin). Sau khi cài:
1. Tạo database tên `racehorse`.
2. Đảm bảo user/pass khớp với `DATABASE_URL` bạn điền ở `.env` (xem §4) —
   không nhất thiết phải là `postgres`/`postgres`, chỉ cần khớp.
3. Đảm bảo Postgres đang chạy ở cổng `5432` (hoặc đổi cổng trong `.env`).

> ⚠️ `scripts/pg-start.ps1` / `pg-stop.ps1` trong repo là script **cho máy
> của người viết dự án ban đầu** (đường dẫn cứng `C:\Users\Lenovo\...`) —
> **không dùng được trên máy người khác**. Nếu bạn cũng cài bản portable
> trên Windows, tự tạo bản script tương tự trỏ đúng đường dẫn máy mình, hoặc
> đơn giản hơn là dùng Cách A (Docker).

## 4. Cấu hình `.env`

```powershell
cd apps/api
copy .env.example .env
```

Mở `.env`, kiểm tra `DATABASE_URL` khớp với cách bạn chọn ở §3 (mặc định đã
khớp sẵn với Cách A). Các biến còn lại (`JWT_*`, `BREVO_API_KEY`) để
nguyên giá trị mẫu cũng chạy được — **thiếu `BREVO_API_KEY` thì API tự
log email ra console thay vì gửi thật**, không chặn việc chạy local.

## 5. Migrate + seed dữ liệu mẫu

```powershell
cd apps/api
npm run prisma:migrate        # tạo toàn bộ bảng theo migration đã có
npm run db:seed               # tạo tài khoản + dữ liệu demo
```

`db:seed` idempotent — chạy lại nhiều lần không tạo trùng, không lỗi.
Tài khoản demo tạo ra: xem bảng trong [README.md](../README.md).

## 6. Chạy & xem

```powershell
npm run start:dev
```

| Việc | URL |
|---|---|
| Gọi API | `http://localhost:3000/api/v1` |
| **Swagger** — xem/thử mọi endpoint trên trình duyệt | `http://localhost:3000/api/docs` |
| Health check | `http://localhost:3000/api/v1/health` |
| **Prisma Studio** — xem/sửa dữ liệu DB qua giao diện web | chạy `npm run prisma:studio` → tự mở `http://localhost:5555` |

Gọi endpoint cần đăng nhập trong Swagger: `POST /auth/login` lấy
`accessToken` → bấm nút **Authorize** (góc trên) → dán token vào.

Frontend (`apps/web`, cần API đang chạy):
```powershell
cd apps/web
npm run dev        # http://localhost:5173
```

## 7. Test

```powershell
cd apps/api
npm test           # unit
npm run test:e2e   # e2e — cần Postgres đang chạy + đã seed
```

## 8. Bản demo không cần cài gì (xem nhanh không cần setup)

`demo/racehorse-demo.html` — mở trực tiếp bằng trình duyệt, không cần Node,
không cần Postgres, không cần làm bất kỳ bước nào ở trên. Dùng khi chỉ cần
xem giao diện nhanh. Chi tiết: [`../demo/README.md`](../demo/README.md).

## 9. Việc còn thiếu để repo này thật sự "push lên chung nhóm"

Repo hiện **chưa `git init`** — đây là quyết định đang chờ chốt trong
[STATE.md](STATE.md) §4, không phải quên. Muốn cả nhóm thao tác chung cần
thêm: `git init` + tạo repo trên GitHub + push + mời thành viên. File này
(`SETUP.md`) viết sẵn để đi kèm khi việc đó xảy ra.
