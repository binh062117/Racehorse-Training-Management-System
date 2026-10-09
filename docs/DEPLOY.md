# DEPLOY — đưa lên mạng để demo cho giảng viên

> Mục tiêu: **demo/nộp bài**, không phải vận hành lâu dài. Công thức dưới
> đây **miễn phí hoàn toàn**, không giới hạn thời gian (khác free Postgres
> của Render, tự xoá dữ liệu sau 30 ngày). Người thực hiện: bất kỳ ai trong
> nhóm có quyền push code — cần tài khoản GitHub (đã có, repo:
> `binh062117/Racehorse-Training-Management-System`).

## Bức tranh chung

```
apps/web (React)  ──deploy──▶  Vercel        (frontend, tĩnh)
apps/api (NestJS) ──deploy──▶  Render         (API server)
                                     │
                                     ▼
                                Neon.tech      (PostgreSQL)
```

3 dịch vụ, 3 tài khoản free riêng biệt, không cái nào cần thẻ tín dụng.

## ⚠️ Giới hạn cần biết trước khi demo

`apps/api` lưu ảnh/đính kèm (ảnh ngựa, đính kèm hồ sơ khám, ảnh sự cố)
**thẳng vào ổ đĩa server**, không dùng cloud storage. Free Web Service của
Render có ổ đĩa **tạm thời** — mỗi lần server "ngủ" rồi thức dậy hoặc mỗi
lần deploy lại, **các file đã upload sẽ mất** (dữ liệu trong Postgres thì
không mất, chỉ mất file). Với nhu cầu demo, chấp nhận được — tránh demo
tính năng upload ảnh sau khi server đã ngủ lâu, hoặc upload lại ảnh mẫu
ngay trước buổi demo.

Free Web Service của Render còn **ngủ sau ~15 phút không ai gọi** — lần gọi
đầu tiên sau đó chậm khoảng 30-60 giây (cold start). Nếu demo trực tiếp cho
cô, mở link API trước buổi demo ~2 phút để "đánh thức" server.

## Bước 1 — Database: Neon.tech

1. Vào [neon.tech](https://neon.tech) → đăng ký bằng GitHub.
2. Tạo project mới (chọn region gần VN nhất, vd Singapore).
3. Vào project → **Connection string** → copy dạng
   `postgresql://<user>:<password>@<host>/<db>?sslmode=require`.
   Đây chính là `DATABASE_URL` sẽ dùng ở Bước 2.

## Bước 2 — API: Render.com

1. Vào [render.com](https://render.com) → đăng ký bằng GitHub → cho phép
   truy cập repo `binh062117/Racehorse-Training-Management-System`.
2. **New** → **Web Service** → chọn repo đó.
3. Điền:
   | Trường | Giá trị |
   |---|---|
   | Root Directory | `apps/api` |
   | Runtime | Node |
   | Build Command | `npm install --include=dev && npm run prisma:generate && npm run build` |
   | Start Command | `npx prisma migrate deploy && node dist/main.js` |
   | Instance Type | Free |

   ⚠️ `--include=dev` là bắt buộc — vì `NODE_ENV=production` (khai ở bước
   sau) khiến `npm install` mặc định bỏ qua `devDependencies`, trong đó có
   `@nestjs/cli` (lệnh `nest` để build). Thiếu cờ này build sẽ lỗi
   `sh: 1: nest: not found`. `--include=dev` không ảnh hưởng lúc chạy thật —
   `dist/main.js` sau khi build xong không cần devDependencies nữa.
4. Tab **Environment** → thêm các biến (copy từ `apps/api/.env.example`,
   điền giá trị thật):

   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | connection string từ Neon (Bước 1) |
   | `JWT_ACCESS_SECRET` | chuỗi ngẫu nhiên dài (tự gõ bừa hoặc dùng [1password.com/password-generator](https://1password.com/password-generator/)) |
   | `JWT_ACCESS_TTL` | `15m` |
   | `JWT_REFRESH_SECRET` | 1 chuỗi ngẫu nhiên **khác** chuỗi trên |
   | `JWT_REFRESH_TTL` | `7d` |
   | `APP_WEB_URL` | URL Vercel ở Bước 3 (điền sau khi có, có thể để tạm `http://localhost:5173` rồi sửa lại) |
   | `BREVO_API_KEY` | API key từ Brevo — xem "Gửi email" bên dưới (để trống thì API tự log email ra console thay vì gửi, không lỗi) |
   | `MAIL_FROM` | `Racehorse Club <email-đã-verify>` — xem "Gửi email" bên dưới (⚠️ không bọc dấu `"` khi dán vào Render) |
   | `UPLOAD_DIR` | `./uploads` |
   | `UPLOAD_MAX_MB` | `5` |
   | `NODE_ENV` | `production` |
   | `GOOGLE_CLIENT_ID` | Google OAuth Client ID — xem "Đăng nhập Google" bên dưới (bỏ trống thì nút Google trên web tự ẩn, không lỗi) |

   Render tự cấp biến `PORT` — không cần thêm tay, code đã đọc
   `process.env.PORT` sẵn (`src/main.ts`).
5. **Create Web Service** — Render tự build + chạy. Lần đầu tiên
   `prisma migrate deploy` sẽ tạo toàn bộ bảng trên Neon.
6. Sau khi chạy xong, chạy seed 1 lần để có tài khoản demo — mở tab
   **Shell** trên Render (hoặc chạy từ máy local, trỏ `DATABASE_URL` sang
   Neon):
   ```powershell
   $env:DATABASE_URL="<connection string Neon>"
   cd apps/api
   npm run db:seed
   ```
7. Copy URL Render cấp (dạng `https://<tên>.onrender.com`) — đây là API
   thật, kiểm tra bằng cách mở `https://<tên>.onrender.com/api/v1/health`.

## Bước 3 — Frontend: Vercel

1. Vào [vercel.com](https://vercel.com) → đăng ký bằng GitHub → **Add New
   Project** → chọn repo đó.
2. Điền:
   | Trường | Giá trị |
   |---|---|
   | Root Directory | `apps/web` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` (mặc định) |
   | Output Directory | `dist` (mặc định) |
3. **Environment Variables** → thêm (nhớ chọn môi trường **Production** —
   Vite bake biến vào lúc build, sai môi trường thì build xong vẫn không
   có tác dụng, phải Redeploy lại sau khi sửa):
   | Biến | Giá trị |
   |---|---|
   | `VITE_API_URL` | `https://<tên>.onrender.com/api/v1` (URL Render ở Bước 2, nhớ thêm `/api/v1`) |
   | `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID — xem "Đăng nhập Google" bên dưới (bỏ trống thì nút Google tự ẩn, không lỗi) |
4. **Deploy**. Xong thì quay lại Render (Bước 2) sửa `APP_WEB_URL` thành
   URL Vercel vừa có (`https://<tên>.vercel.app`) — dùng để dựng link trong
   email xác thực/reset password.

## Đăng nhập Google — tạo OAuth Client ID (miễn phí, 1 lần)

Chỉ cần 1 **Client ID** (không cần Client Secret — xem
[specs/phase-11-google-auth-otp.md](specs/phase-11-google-auth-otp.md)
quyết định #1 để hiểu vì sao). Làm theo đúng thứ tự dưới đây, đừng bỏ
bước nào — Google bắt cấu hình "màn hình xin quyền" (consent screen)
trước khi cho tạo Client ID.

### 1. Tạo project trên Google Cloud

1. Vào [console.cloud.google.com](https://console.cloud.google.com/) —
   đăng nhập bằng tài khoản Gmail bất kỳ (không cần tài khoản trả phí,
   không cần khai thẻ tín dụng cho việc này).
2. Góc trên bên trái, cạnh chữ "Google Cloud" có 1 dropdown chọn project
   (mặc định ghi "Select a project" hoặc tên project cũ). Bấm vào đó →
   **New Project** (góc trên bên phải hộp thoại).
3. Đặt **Project name** bất kỳ, ví dụ `Racehorse Club` → **Create**. Đợi
   vài giây, hệ thống tự chuyển sang project vừa tạo (nếu không, bấm lại
   dropdown ở bước 2 và chọn đúng project vừa tạo).

### 2. Cấu hình màn hình xin quyền (OAuth consent screen)

1. Menu bên trái (bấm icon ☰ nếu bị ẩn) → **APIs & Services** →
   **OAuth consent screen**. (Nếu không thấy mục này, gõ "OAuth consent
   screen" vào ô tìm kiếm trên cùng của trang.)
2. Chọn **User Type = External** → **Create**.
3. Trang **App information** — chỉ cần điền 3 ô bắt buộc (có dấu \*):
   - **App name**: `Racehorse Club` (hoặc tên bất kỳ, hiện ra cho người
     dùng thấy lúc đăng nhập).
   - **User support email**: chọn email Gmail của bạn trong dropdown.
   - Kéo xuống mục **Developer contact information** → **Email
     addresses**: gõ lại email Gmail của bạn.
   - Các ô khác (logo, domain, policy link...) để trống, không bắt buộc.
   → **Save and Continue**.
4. Trang **Scopes** → không cần thêm gì (mặc định đã đủ `email`,
   `profile`, `openid` do Google Identity Services tự xin) → **Save and
   Continue**.
5. Trang **Test users** — **quan trọng**: vì app chưa "Publish" (chưa qua
   review của Google, không cần thiết cho demo), Google chỉ cho **đúng
   những email được thêm ở đây** đăng nhập thử. Bấm **+ Add Users** → gõ
   từng email Gmail sẽ dùng để test (email của bạn, email các bạn cùng
   nhóm, email của giảng viên nếu biết trước) → **Save and Continue**.
   ⚠️ Nếu quên bước này, lúc bấm nút "Đăng nhập bằng Google" trên web sẽ
   hiện lỗi "Access blocked: app has not completed verification" — quay
   lại đây thêm email là hết lỗi ngay, không cần đợi duyệt.

   > **Giao diện Google Cloud gần đây đổi khác** — nếu không thấy trang
   > "Test users" nối tiếp như trên (chỉ thấy 1 trang **OAuth consent
   > screen** với các tab ngang `Overview` / `Branding` / `Audience` /
   > `Clients` / `Data Access`): mục **Test users** giờ nằm trong tab
   > **Audience**, kéo xuống sẽ thấy nút **+ Add users** ở đó. Cách làm
   > (điền email, Save) không đổi, chỉ đổi chỗ tìm.
6. Trang **Summary** → **Back to Dashboard** (hoặc nếu là giao diện mới,
   không có nút này — cứ để vậy, cấu hình tự lưu). Xong phần consent
   screen.

### 3. Tạo OAuth Client ID

1. Menu bên trái → **APIs & Services** → **Credentials**.
2. **+ Create Credentials** (trên cùng) → **OAuth client ID**.
3. **Application type** → chọn **Web application**.
4. **Name**: gõ bất kỳ, ví dụ `Racehorse Web` (chỉ để bạn nhận diện,
   không hiển thị cho người dùng).
5. Mục **Authorized JavaScript origins** → **+ Add URI** → thêm **lần
   lượt từng dòng** (không gõ chung 1 dòng, không có dấu `/` ở cuối):
   ```
   http://localhost:5173
   https://<tên-project-vercel-của-bạn>.vercel.app
   ```
   Ví dụ thực tế theo domain đã deploy ở Bước 3:
   `https://binh062117-horse-managing.vercel.app`. Nếu chưa deploy
   Vercel xong, cứ thêm tạm `http://localhost:5173` trước, quay lại thêm
   domain thật sau (xem mục "Sửa lại sau" bên dưới).
6. Mục **Authorized redirect URIs** → **để trống, không thêm gì** (luồng
   ID-token của Google Identity Services không cần redirect qua server —
   nếu bạn thấy hướng dẫn nào khác trên mạng bảo phải điền redirect URI,
   đó là cho luồng OAuth2 kiểu cũ, dự án này không dùng).
7. **Create**. Một hộp thoại hiện ra "OAuth client created" với 2 dòng
   **Client ID** và **Client secret** — chỉ cần copy **Client ID** (dạng
   `123456789-abcxyz.apps.googleusercontent.com`). Bỏ qua Client secret,
   không cần dùng.

### 4. Điền vào 2 nơi

Cùng 1 giá trị Client ID, điền vào **cả hai**:

| Nơi | Biến | Ghi chú |
|---|---|---|
| Render (Bước 2 ở trên) | `GOOGLE_CLIENT_ID` | Tab Environment → Add Environment Variable |
| Vercel (Bước 3 ở trên) | `VITE_GOOGLE_CLIENT_ID` | Settings → Environment Variables, nhớ tick môi trường **Production** |

Client ID vốn là thông tin công khai (Google thiết kế để lộ ra ở
frontend, không phải bí mật như secret/API key) — an toàn khi đặt trong
biến `VITE_...` dù nó sẽ bị "bake" vào file JS công khai.

Sau khi thêm biến: **Render** tự deploy lại; **Vercel thì không tự động**
— vào tab **Deployments** → bản mới nhất → **⋯** → **Redeploy** (nhắc lại
lỗi hay gặp ở phần "Lỗi hệ thống" bên dưới: Vercel bake biến môi trường
lúc build, thêm biến mà không Redeploy thì chưa có tác dụng).

### Sửa lại sau khi có domain Vercel thật

Nếu bạn tạo Client ID trước khi deploy Vercel (chỉ có
`http://localhost:5173`), sau khi có domain Vercel thật quay lại:
**Credentials** → bấm vào tên Client ID vừa tạo → mục **Authorized
JavaScript origins** → **+ Add URI** → thêm domain Vercel → **Save**. Có
hiệu lực gần như ngay lập tức, không cần tạo Client ID mới.

### Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| "Access blocked: app has not completed verification" | Email đang test chưa được thêm vào **Test users** (mục 2.5) | Quay lại OAuth consent screen → Test users → Add Users |
| "The given origin is not allowed for the given client ID" | Domain đang mở web không khớp **Authorized JavaScript origins** (thiếu `https://`, sai domain, hoặc quên thêm domain Vercel) | Credentials → sửa lại Authorized JavaScript origins cho đúng domain đang chạy |
| Nút Google không hiện ra trên web | `VITE_GOOGLE_CLIENT_ID` chưa set (Vercel) hoặc set nhưng chưa Redeploy | Kiểm tra Settings → Environment Variables trên Vercel, Redeploy lại |
| Bấm nút Google xong báo "Lỗi hệ thống" | `GOOGLE_CLIENT_ID` chưa set bên Render, hoặc sai giá trị | Kiểm tra biến trên Render, xem log Render (tab Logs) lúc bấm thử |

## Gửi email — tạo Brevo API Key (miễn phí)

Dùng để gửi mã OTP xác thực đăng ký và link đặt lại mật khẩu.

> ⚠️ **Không dùng SMTP (Gmail + App Password) trên Render** — dự án từng
> thử cách này và bị lỗi `Connection timeout` liên tục: Render (free tier)
> không cho kết nối SMTP thò ra ngoài đúng cách. Cũng **không dùng
> Resend** — Resend chỉ cho gửi tới đúng email bạn dùng đăng ký tài khoản
> Resend khi chưa verify domain riêng ("sandbox mode"), không gửi được
> cho người khác (đồng đội, giảng viên...) — không hợp cho demo vì không
> có domain riêng để verify. **Brevo** gửi qua **HTTP API** (cổng 443,
> giống mọi request web bình thường, không bị Render chặn) và cho gửi tới
> **bất kỳ ai** ngay sau khi verify **1 địa chỉ email gửi đi** (không cần
> cả domain, không cần DNS).

1. Vào [brevo.com](https://www.brevo.com) → **Sign Up free** (email hoặc
   Google), không cần thẻ tín dụng.
2. Verify sender — vào **Settings** (icon bánh răng, góc trên phải) →
   **Senders, Domains & Dedicated IPs** → tab **Senders** → **Add a
   Sender**. Điền tên (vd `Racehorse Club`) + email bạn muốn dùng làm
   người gửi (dùng ngay email Gmail thật của bạn, vd
   `quocbinh072517@gmail.com`) → **Save**. Brevo gửi 1 email xác nhận tới
   địa chỉ đó → mở email, bấm link xác nhận → sender chuyển trạng thái
   "Verified" (dấu tích xanh).
3. Lấy API Key — menu trái (hoặc **Settings**) → **SMTP & API** → tab
   **API Keys** → **Generate a new API key**. Đặt tên bất kỳ (vd
   `racehorse-render`) → **Generate** → copy chuỗi hiện ra (dạng
   `xkeysib-...`) — **chỉ hiện 1 lần**, copy ngay.
4. Điền vào Render → **Environment**:
   - `BREVO_API_KEY` = key vừa copy.
   - `MAIL_FROM` = `Racehorse Club <email-đã-verify-ở-bước-2>` — **không**
     bọc dấu ngoặc kép `"..."` khi dán vào ô Value trên Render (Render coi
     dấu `"` là ký tự thật, không phải cú pháp shell — dán có dấu `"` sẽ
     làm sai định dạng email và Brevo từ chối gửi).
5. Lưu biến trên Render → tự deploy lại. Thử đăng ký tài khoản mới trên
   web (dùng email bất kỳ, không cần là email đã verify), mail OTP sẽ tới
   Inbox trong vài giây.

### Lỗi thường gặp

| Thông báo | Nguyên nhân | Cách sửa |
|---|---|---|
| Log Render vẫn ghi `[email:not-sent]` | `BREVO_API_KEY` chưa set hoặc sai tên biến | Kiểm tra đúng tên biến `BREVO_API_KEY` trên Render |
| `Brevo send failed (401): ...` | API Key sai/bị revoke | Tạo lại API Key mới ở Brevo → SMTP & API |
| `Brevo send failed (400): ...sender...` | Email trong `MAIL_FROM` chưa verify (bước 2), hoặc `MAIL_FROM` dán còn dính dấu `"` | Kiểm tra sender đã "Verified" ở Brevo chưa; xoá dấu `"` thừa trong `MAIL_FROM` trên Render |
| Mail không tới Inbox, cũng không thấy trong Spam | Hiếm gặp, nhưng có thể do nhà cung cấp mail người nhận lọc gắt | Thử gửi tới địa chỉ Gmail trước để loại trừ; kiểm tra log Brevo (Dashboard → Statistics → Transactional) xem trạng thái gửi |

## Sau khi deploy xong

- Link đưa cho giảng viên xem: URL Vercel (`https://<tên>.vercel.app`).
- Tài khoản demo: xem bảng trong [README.md](../README.md) — vẫn dùng được
  vì đã seed ở Bước 2.6.
- Muốn cập nhật lên bản deploy: chỉ cần `git push` lên nhánh Render/Vercel
  đang theo dõi (mặc định là `main`, hoặc đổi sang nhánh đang làm việc trong
  cài đặt mỗi dịch vụ) — cả 2 tự build lại.
- Muốn xem dữ liệu trên Neon: dùng chính `npx prisma studio` từ máy local,
  trỏ `DATABASE_URL` sang Neon như bước 6, hoặc dùng SQL Editor có sẵn trên
  trang Neon.

## Nếu sau này cần chạy ổn định lâu dài (không chỉ demo)

Xem lại 2 vấn đề đã nêu ở đầu file (server ngủ + mất file upload) — cách xử
lý triệt để là chuyển sang gói trả phí có ổ đĩa bền (Render persistent
disk, ~vài đô/tháng) hoặc đổi hạ tầng lưu file sang cloud storage
(S3-compatible) — đây là thay đổi kiến trúc, cần bàn riêng khi tới lúc.

<!-- trigger redeploy after Vercel repo reconnect (2026-09-29) -->
