# Decisions — quyết định kỹ thuật & lý do

Ghi mọi quyết định thiết kế ở đây, kèm ngày và nguồn (Claude Code / Claude chat /
nhóm). Mới nhất lên đầu.

---

## 2026-10-06 — Gửi email khi MANAGER duyệt tài khoản (PENDING → ACTIVE)

**Nguồn:** yêu cầu người dùng.
**Quyết định:** `UsersService.update()` — khi `status` chuyển từ `PENDING`
sang `ACTIVE` (đúng lúc MANAGER bấm "Duyệt"), gửi email thông báo qua
`MailService.sendAccountApproved()` (Brevo, cùng cơ chế với OTP/reset
password). **Chỉ** kích hoạt cho đúng chuyển tiếp `PENDING → ACTIVE` —
mở lại tài khoản bị khoá (`DISABLED → ACTIVE`) là hành động khác, không
gửi lại email "đã được duyệt" (dễ gây hiểu nhầm). e2e: +2 test (gửi đúng
khi duyệt lần đầu; không gửi khi re-enable từ DISABLED) — 157/157 xanh.

## 2026-10-01 — Chuẩn hóa Ngoại lệ Training Lock: Quyền hạn của Bác sĩ Thú y & Ràng buộc HLV Trưởng

**Nguồn:** Yêu cầu người dùng (làm rõ thẩm quyền của Bác sĩ Thú y vs HLV Trưởng đối với ngoại lệ Khóa Huấn Luyện - Horse is locked).
**Quyết định:**
- **Veterinarian (Bác sĩ Thú y)**: Sở hữu thẩm quyền **độc quyền** ra quyết định y khoa: Đặt lệnh "Khóa huấn luyện" khẩn cấp (`PATCH /horses/:id/lock` với `locked: true` + lý do chẩn đoán) và gỡ lệnh khóa (`locked: false`). Không ai khác (kể cả Manager hay Trainer) có quyền can thiệp vào cờ y tế này.
- **Head Trainer (HLV Trưởng)**: Là đối tượng **chịu ràng buộc trực tiếp** bởi lệnh khóa:
  - Khi ngựa bị khóa: Bị chặn hoàn toàn việc lên lịch các buổi tập thực tế (`POST /horses/:id/sessions`), hệ thống ném ngoại lệ `400 VALIDATION_ERROR: Horse training is locked: [Lý do]`.
  - Bị chặn không thể đăng ký thi đấu giải đua (`POST /races/:id/entries`).
  - Được phép soạn khung giáo án lý thuyết dài hạn (`POST /horses/:id/training-plans`), nhưng giao diện hiển thị cảnh báo rõ ràng con ngựa đang bị phong tỏa tập luyện thực địa.
- **Frontend Sync**:
  - Giao diện `SessionsTab.tsx` tự động ẩn form xếp lịch tập và hiển thị dải thông báo đỏ nêu rõ lý do bị Bác sĩ thú y khóa huấn luyện.

## 2026-10-01 — Triển khai Phân hệ Giáo án & Chức năng Create Training Plan cho Head Trainer

**Nguồn:** Yêu cầu người dùng (chức năng Create training plan của role trainer, chỉ TRAINER được tạo, MANAGER chỉ xem).
**Quyết định:**
- **Backend API & Quy tắc nghiệp vụ (Business Rules)**:
  - Phân quyền RBAC nghiêm ngặt: Chỉ `Role.TRAINER` có quyền tạo giáo án; các vai trò `MANAGER`, `VET`, `GROOM`, `OWNER` bị chặn 403 Forbidden (được kiểm chứng bằng E2E test).
  - Quy tắc chuyên môn đua ngựa:
    + BR-1: Không cho phép lập giáo án mới cho ngựa đã giải nghệ (`status === 'RETIRED'`).
    + BR-2: Không cho phép lập giáo án cho ngựa đang cách ly kiểm dịch (`healthStatus === 'QUARANTINED'`).
    + BR-3: Cho phép lập kế hoạch chiến lược cho ngựa bị khóa tập luyện (`locked === true`), nhưng không thể lên lịch buổi tập thực tế cho đến khi mở khóa.
  - Bổ sung `GET /api/v1/training-plans` có scoping: Trainer/Manager thấy toàn bộ CLB, Owner chỉ thấy ngựa của mình.
  - Mở rộng `PLAN_INCLUDE` trả về thêm thông tin chi tiết ngựa (`name`, `breed`, `ownerId`).
- **Frontend**:
  - Chuẩn hóa quyền: Chỉ `role === 'TRAINER'` mới render các nút `+ Tạo giáo án mới`. Manager và Owner chỉ có quyền xem (Read-only).
  - Modal `CreateTrainingPlanModal.tsx`:
    + Tự động lọc các ngựa giải nghệ/cách ly khỏi dropdown.
    + Bổ sung 4 mẫu giáo án chuyên môn nhanh (Quick Templates: Cự ly 1400m sân cát, Cự ly 1600m sân cỏ, Nước rút 1200m, Bài tập nhẹ phục hồi).
    + Cảnh báo phân biệt ngựa bị khóa tập luyện vs ngựa bị chấn thương (`INJURED`).
  - Trang `/plans`: Giao diện hiển thị phụ đề tương ứng theo vai trò, thống kê KPI, bộ lọc trạng thái.
  - Trang `/horses/:id`: Tab `PlansTab` hiển thị cảnh báo nghiệp vụ nếu ngựa giải nghệ/cách ly và điểm thể lực hiện tại.

## 2026-09-30 — Thiết kế Giao diện Dashboard & Shell Rail + Phân quyền RBAC & Icon đơn sắc

**Nguồn:** Yêu cầu người dùng (cấu trúc Dashboard dạng demo, phân quyền nghiêm ngặt theo 5 vai trò nghiệp vụ, loại bỏ 100% emoji và dùng icon tối giản đơn sắc, giữ nguyên trang login).
**Quyết định:** 
- **Phân quyền thanh điều hướng (Sidebar Rail)**:
  - `Head Trainer`: Dashboard, Ngựa đua (toàn bộ chiến mã CLB), Giáo án huấn luyện (Lập giáo án chi tiết), Giải đua (Đăng ký giải đua), Cảnh báo thể lực & sự cố.
  - `Veterinarian`: Dashboard, Sơ đồ đàn ngựa, Hồ sơ khám bệnh & Phác đồ điều trị, Lịch tiêm phòng & móng định kỳ.
  - `Groom / Stable Hand`: Dashboard, Chuồng & Khẩu phần dinh dưỡng, Báo cáo sự cố chuồng.
  - `Horse Owner`: Dashboard, Ngựa của tôi (phạm vi sở hữu), Lịch tập & Nhật ký HLV, Lịch sử giải đua.
  - `Club Manager`: Toàn quyền tất cả các phân hệ, bao gồm Quản trị hệ thống & Phân quyền thành viên (`/admin/users`).
- **Cá nhân hóa DashboardPage (`/dashboard`)**:
  - Từng vai trò có hệ thống thẻ KPI riêng (ví dụ: Vet theo dõi 4 trạng thái FIT/MONITORING/INJURED/QUARANTINED; Trainer theo dõi thể lực và giáo án; Groom theo dõi việc chăm sóc; Owner theo dõi ngựa sở hữu; Manager theo dõi danh mục tổng).
  - Khối Thao tác nhanh (Quick Actions) hiển thị chính xác các tác vụ được phép làm theo nghiệp vụ của vai trò đó.

## 2026-10-02 — Chốt `testing` làm nền FE chuẩn (Flow 1 — Horse Profile)

**Nguồn:** phát hiện trong lúc kiểm tra các nhánh team — nhiều thành viên
tạo nhánh FE độc lập từ cùng 1 điểm (`cbf1f7e`) mà không dựa trên việc của
nhau: `Flow01_HorseProfile` (hồ sơ ngựa), `Hai-work` (thêm tab phả hệ),
`feat/flow-race-training-health` (viết lại gần như toàn bộ `HorsesPage`/
`HorseDetailPage`/`Layout` theo cấu trúc khác). Cả 3 cùng sửa chung những
file lõi theo cách không tương thích nhau — merge thẳng cả 3 vào `main`
sẽ conflict nặng.
**Quyết định:** Người dùng chọn `testing` (nhánh nối dài từ
`Flow01_HorseProfile`, hoá ra khi kiểm tra lại đã tự tích hợp thêm phần
lớn công việc của `feat/flow-race-training-health` — `HorseFormPage`,
`HorseOwnershipPage`, `HorsePedigreePage`, `HorseRaceHistoryPage`,
`HorseRecordNav`, `HealthSchedulePage` đều đã có mặt) làm **nền FE
chuẩn**, merge PR #14 vào `main`. Kèm migration mới
`preventive_care_type` (+enum `PreventiveCareType`, +`Vaccination.careType`).
**Chưa xử lý:** nhánh `Hai-work` (tab phả hệ kiểu riêng của thành viên đó)
**chưa merge** — theo quyết định người dùng, để nhóm tự xem lại có gì
đáng giữ/gộp thêm vào nền `testing` này hay không, Claude Code không tự ý
đụng vào.
**Đã verify trên `main` sau merge:** `npm run build` ✅ (api+web) ·
`npm run test:e2e` **154/154** ✅.

## 2026-09-30 — Nhớ email lần đăng nhập trước (giữ nguyên phiên 7 ngày)

**Nguồn:** yêu cầu người dùng — ban đầu định rút phiên đăng nhập xuống 2
ngày, sau đổi ý giữ nguyên `7d` như cũ, chỉ giữ lại phần "nhớ email".
**Quyết định:** Frontend nhớ email của lần đăng nhập gần nhất
(`localStorage`, key `racehorse.lastEmail`, ghi trong `lib/api.ts` cạnh
cặp hàm đọc/ghi token có sẵn) — tự điền sẵn vào ô Email ở `/login` cho
lần sau, người dùng chỉ cần gõ lại mật khẩu khi phiên (refresh token,
`JWT_REFRESH_TTL=7d`) hết hạn và bị đăng xuất.
**Phạm vi:** chỉ áp dụng cho form đăng nhập email/mật khẩu — đăng nhập
Google không có ô email để tự điền (chọn tài khoản qua popup Google), nên
không đụng tới.
**Đã thử và bỏ:** từng đổi `JWT_REFRESH_TTL` mặc định `7d` → `2d`
(`token.service.ts` + `.env.example`) — người dùng quyết định giữ `7d`
ngay sau đó, đã revert lại trong cùng ngày. Không cần sửa gì trên Render
(vẫn đang set cứng `7d` từ trước, không đổi).

## 2026-09-30 — Google login mới toanh cũng phải qua OTP (không tự động verify nữa)

**Nguồn:** yêu cầu người dùng. Trước đó (Phase 11 gốc), user Google mới
được tự động set `emailVerifiedAt` ngay (vì Google đã xác minh email hộ)
rồi báo thẳng `ACCOUNT_PENDING` — bỏ qua bước OTP.
**Quyết định:** `POST /auth/google` với 1 Google account **chưa từng có
trong hệ thống** giờ **không** tự set `emailVerifiedAt` nữa — tạo user
`PENDING` với `emailVerifiedAt=null`, phát OTP tới đúng email/tên Google
trả về (không bắt gõ tay), trả về `{otpRequired: true, email}` thay vì
token/lỗi. Frontend tự chuyển sang màn nhập OTP y hệt luồng đăng ký
thường (`POST /auth/verify-otp`), chỉ khác là không cần điền form
tên/email/mật khẩu. Bấm nút Google lần nữa trước khi verify → phát OTP
mới (giống `resend-otp`), không lỗi.
**Không đổi** trường hợp email đã tồn tại từ trước (đăng ký thường trước
đó, giờ mới link Google lần đầu) — vẫn tự gắn `googleId` + tự verify
ngay, không bắt OTP lại (coi như đã "chứng minh" bằng đăng ký gốc, Google
chỉ xác nhận thêm cùng người).
**Lý do:** Người dùng muốn nhất quán 1 luồng xác nhận (OTP) cho mọi tài
khoản mới, không phân biệt tạo qua form hay qua Google — dễ demo, dễ hiểu
hơn cho người xem, dù Google vốn đã tự xác minh email đủ tin cậy về mặt
kỹ thuật.

## 2026-09-30 — Đổi tiếp Resend → Brevo (Resend sandbox chặn gửi cho người khác)

**Nguồn:** log lỗi thật khi test trên Render sau khi đã chuyển sang Resend
(xem mục ngay dưới đây).
**Quyết định:** Bỏ Resend, chuyển `MailService` sang
[Brevo](https://www.brevo.com) (vẫn qua HTTP API thuần, không SDK — dùng
`fetch` sẵn có của Node 18+, không thêm dependency mới).
**Lý do:** Resend ở "sandbox mode" (chưa verify domain riêng) chỉ cho gửi
tới **đúng email dùng đăng ký tài khoản Resend**, không gửi được cho ai
khác — lỗi cụ thể: `"You can only send testing emails to your own email
address..."`. Dự án không có domain riêng để verify (ngoài phạm vi demo),
nên không dùng được Resend đúng nghĩa (gửi OTP cho user bất kỳ). Brevo chỉ
cần verify **1 địa chỉ email gửi đi** (xác nhận qua link trong email, không
cần DNS/domain) là gửi được tới **bất kỳ người nhận nào** ngay — đúng nhu
cầu (gửi OTP cho user đăng ký bất kỳ, không phải lúc nào cũng là chính
mình). Hướng dẫn: [DEPLOY.md](DEPLOY.md) mục "Gửi email".

## 2026-09-30 — Đổi gửi mail từ SMTP (nodemailer) sang Resend HTTP API

**Nguồn:** log lỗi thật từ Render khi test luồng OTP trên bản deploy.
**Quyết định:** Bỏ hẳn `nodemailer`/SMTP (Gmail + App Password), chuyển
`MailService` sang dùng [Resend](https://resend.com) qua HTTP API
(`RESEND_API_KEY`, gói `resend`). Áp dụng cho **cả local lẫn Render**
(không giữ SMTP song song) để nhất quán 1 cơ chế gửi mail duy nhất.
**Lý do:** Render (free tier Web Service) không cho kết nối SMTP thò ra
ngoài đúng cách — mọi lần gửi mail qua `smtp.gmail.com:587` đều bị
`Connection timeout` ở tầng TCP (xác nhận qua log Render), dù mật khẩu
App Password đúng. Đã thử 2 hướng vá trước khi kết luận là giới hạn nền
tảng, không phải bug code:
1. Thêm `connectionTimeout`/`greetingTimeout`/`socketTimeout` cho
   nodemailer — chỉ giúp request thất bại nhanh hơn (10s thay vì ~2 phút),
   không giải quyết được gốc rễ.
2. `dns.setDefaultResultOrder('ipv4first')` — nghi vấn Node ưu tiên AAAA
   (IPv6) khiến định tuyến egress tới Gmail bị treo — cũng không giải
   quyết được, cùng lỗi y hệt sau khi deploy lại.

Resend gửi qua HTTPS (cổng 443, giống mọi request web bình thường) nên
không bị chặn. Không cần verify domain riêng để bắt đầu — dùng domain
test có sẵn `onboarding@resend.dev` làm `MAIL_FROM` mặc định, gửi được
tới bất kỳ email nào ngay từ đầu, đủ cho demo. Hướng dẫn tạo API key:
[DEPLOY.md](DEPLOY.md) mục "Gửi email".

**Không cập nhật ngược** các đoạn nhắc tới SMTP/nodemailer trong
PLAN.md/STATE.md (viết ở Phase 1, mô tả đúng lựa chọn tại thời điểm đó) —
giữ nguyên lịch sử, chỉ ghi thay đổi ở đây theo đúng convention
"most-recent-first" của file này.

## 2026-09-30 — Thêm nút "Từ chối" đăng ký cho MANAGER (hard delete, không phải soft delete)

**Nguồn:** người dùng — muốn user bị từ chối phải đăng ký lại (kể cả qua
Google) nếu vẫn muốn có tài khoản.
**Quyết định:** `POST /users/:id/reject` (MANAGER, chỉ áp dụng user đang
`PENDING`) — **xoá thật** (`prisma.user.delete`), khác hẳn `DELETE
/users/:id` đã có từ trước (soft delete — set `deletedAt` + `status
DISABLED`, giữ lại hàng).
**Lý do:** `User.email` có ràng buộc `@unique` ở tầng DB (không phải unique
có điều kiện `WHERE deletedAt IS NULL`) — nếu chỉ soft-delete, email đó
vẫn bị khoá vĩnh viễn, không đăng ký lại được (kể cả qua Google, vì
`googleLogin()` cũng tra theo `email`). Xoá thật là cách duy nhất giải
phóng email mà không phải đổi kiểu unique constraint (thay đổi lớn hơn,
ảnh hưởng toàn bộ luồng `DELETE /users/:id` hiện có, không cần thiết cho
yêu cầu này). An toàn vì giới hạn chỉ áp dụng cho user `PENDING`
(`role=null`, chưa có bất kỳ dữ liệu nào tham chiếu tới — không sở hữu
ngựa, không phải trainer/vet buổi tập/hồ sơ nào) — không đụng tới
`DELETE` cũ (soft delete) vốn dùng cho user đã hoạt động, cần giữ lịch sử.

## 2026-09-29 — Phase 11: Đăng nhập Google + xác thực email bằng OTP

**Nguồn:** người dùng + Claude Code. Chi tiết đầy đủ:
[specs/phase-11-google-auth-otp.md](specs/phase-11-google-auth-otp.md).
**Quyết định:**
- Xác thực email đăng ký **đổi từ link token sang mã OTP 6 số** (model
  `OtpCode` mới, TTL 10 phút, tối đa 5 lần nhập sai/mã). `GET
  /auth/verify-email` xoá hẳn, không giữ song song 2 cơ chế.
- Đăng nhập Google dùng **luồng ID-token** (Google Identity Services ở
  frontend verify rồi POST `idToken` lên `/auth/google`, backend verify lại
  bằng `google-auth-library`) — **không** dùng OAuth2 redirect +
  `passport-google-oauth20`, vì frontend (Vercel) và API (Render) khác
  domain, redirect/callback URL + cookie cross-domain phức tạp hơn hẳn. Chỉ
  cần biến `GOOGLE_CLIENT_ID`, không cần `GOOGLE_CLIENT_SECRET`.
- Tài khoản tạo qua Google **vẫn phải chờ MANAGER duyệt** — dùng lại đúng
  luồng `status=PENDING` đã có ở `/admin/users`, không code lại.
- `User.passwordHash` chuyển sang optional (tài khoản Google không có mật
  khẩu cục bộ); email trùng tài khoản có sẵn → tự gắn `googleId` vào user
  đó thay vì báo lỗi CONFLICT (Google đã xác minh chủ email).
**Đánh đổi đã chấp nhận:** không giới hạn tần suất gửi lại OTP theo thời
gian (cooldown giây) — chỉ giới hạn số lần nhập sai; đủ cho quy mô demo,
có thể bổ sung sau nếu cần chống spam email thật.

## 2026-09-25 — Chốt hạ tầng deploy: Render + Neon + Vercel (free, cho demo)

**Nguồn:** người dùng (mục đích deploy = demo/nộp bài, không phải vận hành
lâu dài) + Claude Code.
**Quyết định:** API deploy trên **Render.com** (Web Service free tier),
Postgres trên **Neon.tech** (free, không hết hạn — khác free Postgres của
Render tự xoá sau 30 ngày), frontend trên **Vercel** (free). Hướng dẫn từng
bước: [DEPLOY.md](DEPLOY.md).
**Lý do:** cả 3 miễn phí vĩnh viễn ở mức dùng 1 đồ án, không cần thẻ tín
dụng, tự deploy khi push GitHub — phù hợp nhu cầu "chỉ cần demo", không
đáng đầu tư công sức tự quản lý VM (Oracle Free Tier) hay trả phí cho ổ đĩa
bền lúc này.
**Đánh đổi đã chấp nhận:** `apps/api` lưu file upload (ảnh ngựa, đính kèm
khám, ảnh sự cố) thẳng vào ổ đĩa server — Render free tier có ổ đĩa **tạm
thời**, file mất sau mỗi lần server ngủ/deploy lại (dữ liệu Postgres không
mất). Free Web Service cũng **ngủ sau ~15 phút** không ai gọi (cold start
~30-60s lần gọi đầu). Chấp nhận được cho demo; nếu sau này cần chạy ổn định
lâu dài, cần bàn lại (disk bền trả phí, hoặc đổi sang cloud storage cho
file — xem cuối DEPLOY.md).

## 2026-09-25 — Phase 10 (Health & Injury extensions) hoàn thành — Sprint 3 xong

**Nguồn:** [specs/phase-10-health-injury-extensions.md](specs/phase-10-health-injury-extensions.md)
+ Claude Code. Hoàn tất phần "chưa làm" còn lại của mục "Đối chiếu
`CLAUDE_CODE_BACKEND_FULL.md`" (2026-09-24) — UC-14, 16, 18, 19, 20 (UC-15
mở rộng nhẹ; UC-17 đã xong từ Phase 7/8, không đụng lại).
**Quyết định:**
- **Không tách `Horse.status` thành `careerStatus`** — chỉ thêm
  `healthStatus` mới (`FIT|MONITORING|QUARANTINED|INJURED`, default `FIT`)
  bên cạnh `status` hiện có. Đổi tên field cũ sẽ phải sửa hàng trăm chỗ
  tham chiếu chỉ để đổi tên — rủi ro cao, lợi ích thấp.
- **`healthStatus` chỉ ghi qua `POST /horses/:id/health-records`**
  (`healthStatus?` optional trên DTO) — không có `PATCH /horses/:id` riêng
  cho field này, tránh 2 nơi ghi cùng 1 field.
- **`InjuryLocation` có 2 FK nullable** (`incidentReportId`,
  `healthRecordId`), ràng buộc "đúng 1 trong 2" ở tầng service (route nào
  gọi thì set đúng FK đó), không ở tầng DB.
- **Chỉ VET tạo injury-location/vaccination/treatment-plan/medication** —
  nhất quán với health-records/incidents PATCH đã có.
- **`GET /vaccinations` (view toàn CLB) chặn OWNER hẳn (403)** thay vì lọc
  theo ngựa sở hữu — OWNER dùng `GET /horses/:id/vaccinations` (đã có
  ownership) cho ngựa của mình.
- **Ảnh sự cố (UC-19) dùng route riêng `POST /incidents/:id/photo`**, không
  gộp vào `POST /horses/:id/incidents` — nhất quán với ảnh ngựa (Phase 2) và
  đính kèm hồ sơ khám (Phase 4), tái dùng nguyên hạ tầng
  `FileStorageService`/`upload.ts` đã có, không thêm dependency mới (trả
  lời OPEN QUESTION #4 từ mục 2026-09-24: dùng local disk, không phải S3).
- **Không tự động đổi `healthStatus` khi có incident/lock đổi** — Training
  Lock (trục "tập được không") và `healthStatus` (trục "tình trạng sức
  khoẻ") giữ độc lập, không tự động hoá chéo.
- **Không có DELETE** cho 4 bảng mới — giữ đúng pattern các phase trước.
- Migration `phase10_health_injury_extensions`: 1 lần cho cả 4 bảng + 1
  field + 2 enum, không tách nhỏ.
**Trạng thái:** ✅ build/lint/e2e (140/140: 125 cũ + 15 mới) xanh.
**Sprint 3 (Health & Injury) theo `CLAUDE_CODE_BACKEND_FULL.md` nay đã đầy đủ.**

## 2026-09-24 — Phase 9 (Training safety rules) hoàn thành

**Nguồn:** [specs/phase-9-training-safety.md](specs/phase-9-training-safety.md)
+ Claude Code. Trả lời phần "chưa làm" của mục "Đối chiếu
`CLAUDE_CODE_BACKEND_FULL.md`" ngay bên dưới (Sprint 2 remainder: EX-01 +
UC-12).
**Quyết định:**
- **EX-01 — cửa sổ trùng lịch cố định 60 phút**, không thêm field
  `duration` cho `TrainingSession`. Chỉ check lúc **tạo mới**
  (`POST /horses/:id/sessions`), không check khi sửa giờ qua `PATCH`.
- **UC-12 — chỉ đánh giá 1 metric cố định `heart_rate_max`**, ngưỡng cố
  định `> 195` (đúng ví dụ minh hoạ trong task list gốc) — `resultMetric`
  là free text, không suy luận được ý nghĩa các giá trị khác.
- **"GROOM liên quan" = mọi user role GROOM đang ACTIVE** — schema không
  gán 1 GROOM riêng cho từng ngựa/session, nên không lọc hẹp hơn được;
  thêm `NotificationsService.groomIds()` song song `managerIds()`.
- **Thêm `NotificationType.FITNESS_WARNING`** — migration chỉ thêm 1 giá
  trị enum, không đổi bảng nào khác.
- Sửa 2 test cũ (`training.e2e-spec.ts`, `training-plan.e2e-spec.ts`) vì
  chúng tạo nhiều session "now" cho cùng 1 ngựa — nay va vào rule EX-01
  mới; dời giờ lệch +2 tiếng, không đổi hành vi được test.
**Trạng thái:** ✅ build/lint/e2e (125/125: 117 cũ + 8 mới) xanh.

## 2026-09-24 — Đối chiếu `CLAUDE_CODE_BACKEND_FULL.md` với code thật — mâu thuẫn + câu hỏi mở

**Nguồn:** người dùng dán file `CLAUDE_CODE_BACKEND_FULL.md` (task list backend
đầy đủ, phạm vi của Bình, xác nhận với nhóm 2026-09-24) + Claude Code audit lại
code thật trong `apps/api`.

**Bối cảnh:** file task này viết ra như thể một số phần "đã có sẵn" trong
`docs/`, nhưng đối chiếu code thì vài giả định đó sai. Theo đúng chỉ dẫn của
chính file đó ("nếu mâu thuẫn với `docs/` thì `docs/` thắng, nhưng phải flag
lại thay vì tự chọn") — ghi lại đây, **chưa tự sửa gì**, chờ nhóm xác nhận.

### Mâu thuẫn đã phát hiện (docs/code hiện tại thắng, file task sai)

| File task giả định | Thực tế trong code |
|---|---|
| Auth chỉ có access token, **không có refresh token** | Sai — đã có refresh token + rotation từ Phase 1 (xem mục 2026-09-08 Phase 1 dưới đây) |
| UC-02: chưa có `POST /auth/register` công khai, chỉ MANAGER tạo qua `POST /users` | Sai — `POST /auth/register` đã có từ Phase 1 (đăng ký công khai → `PENDING` → MANAGER duyệt) |
| UC-07: `POST /races/:id/entries` do MANAGER hoặc TRAINER | Thực tế chỉ **MANAGER** (chốt ở Phase 6) |
| UC-09: route là `POST /training-plans` | Thực tế là `POST /horses/:id/training-plans` (gắn theo ngựa, chốt ở Phase 7) |
| `incident_reports.status`: `OPEN \| IN_REVIEW \| RESOLVED` | Thực tế enum `OPEN \| IN_PROGRESS \| RESOLVED` (chốt ở Phase 8) |
| STEP 0: `vaccinations`/`medications` là bảng "đã có sẵn" trong DATA_MODEL.md | Sai — 2 bảng đó **chỉ là tầm nhìn** trong DATA_MODEL.md §"bản đầy đủ", chưa vào code (ghi rõ trong chính file đó) |

### Phần đã làm khớp với file task (không cần làm lại)

STEP 0: `sireId`/`damId`/`locked`/`fitnessScore` trên `Horse`, bảng
`Race`/`RaceEntry`, bảng `IncidentReport` (thiếu `photoUrl`, enum tên khác —
xem trên), bảng `Notification`. SPRINT 0: SETUP-01→04, UC-01. SPRINT 1: UC-03,
UC-04, UC-05 (pedigree, đúng y hệt — `PATCH` + `GET /horses/:id/pedigree` 3
đời), UC-06 (dùng chung `PATCH /horses/:id`, đúng default file đề xuất),
UC-08. SPRINT 2: UC-10, UC-11 (đúng y hệt: TRAINER mọi field khi PLANNED,
GROOM chỉ status+result, enforce ở service), UC-13 (dạng list, không phải
aggregate — xem OPEN QUESTIONS), EX-02 (khoá ngựa + thông báo cross-role).
SPRINT 3: UC-15 (không ghi `health_status` vì field đó chưa tồn tại), UC-17
(khoá khẩn từ VET **kèm `lockReason`** — đã có sẵn, còn tự động hoá thêm ở
Phase 8 khi sự cố `HIGH`), UC-19 (có endpoint báo sự cố, **không có** upload
ảnh). PROJECT COMPLETION: TEST-01 (117 e2e, cover RBAC 403 + ownership +
lock chặn session — tương đương EX-02/UC-17; **không có** test cho EX-01 vì
chưa build), DOC-01 (Swagger `/api/docs` đã có).

### Chưa làm — hoàn toàn mới so với mọi phase trước

- Tách `Horse.status` thành `careerStatus` (ACTIVE/RESTING/RETIRED, giữ
  nguyên) + `healthStatus` (FIT/MONITORING/QUARANTINED/INJURED, mới).
- Bảng `injury_locations` (UC-16).
- Bảng `treatment_plans` + liên kết `medications` (UC-20) — bản thân bảng
  `medications` cũng chưa hề tồn tại.
- Bảng `vaccinations` (UC-18).
- Cảnh báo ngưỡng thể lực (UC-12) — chưa có rule/threshold, chưa có
  notification loại này.
- Chặn trùng lịch buổi tập (EX-01) — tạo 2 session cùng giờ cho 1 ngựa hiện
  vẫn được, không có validate 409 nào.
- Upload ảnh cho `incident_reports` (UC-19, `photoUrl`).

### OPEN QUESTIONS từ file task — chưa trả lời, chờ nhóm/người dùng chốt

1. UC-02 "Register" — giữ nguyên `POST /auth/register` công khai đã có
   (đăng ký tự do → PENDING), hay đổi hướng khác? *(Claude Code đề xuất: giữ
   nguyên, vì đã hoạt động + có test — nhưng để nhóm xác nhận vì file task
   ngầm định "chưa có endpoint này".)*
2. UC-06 — dùng chung `PATCH /horses/:id` (đã làm vậy) hay tách endpoint
   riêng cho "gán chủ sở hữu"? *(Đã làm theo default file đề xuất — coi như
   xác nhận trừ khi nhóm nói khác.)*
3. UC-17's lock — đã có `lockReason` (text) riêng biệt với boolean `locked`
   từ Phase 7, tên field `lockReason` không phải `lock_reason` (naming
   convention camelCase toàn bộ API, không phải snake_case như file task
   dùng — xem thêm quy ước Prisma/TS hiện có).
4. UC-19 upload ảnh — chưa quyết định lưu ở đâu. Dự án đã có sẵn hạ tầng
   `FileStorageService` (lưu đĩa local `apps/api/uploads/`, dùng cho ảnh
   ngựa + đính kèm hồ sơ khám từ Phase 2/4) — đề xuất tái dùng đúng hạ tầng
   đó cho `incident_reports.photoUrl` thay vì thêm dependency mới (S3...).
   Chờ xác nhận.
5. Sheet gốc của nhóm có DOC-02 trùng nội dung UC-20 — nghi copy-paste lỗi,
   chưa xác nhận nội dung thật của DOC-02.

**Trạng thái:** ⏳ Chỉ mới ghi nhận — **chưa code gì** cho phần "chưa làm" ở
trên. Việc kế tiếp: người dùng xác nhận 5 câu hỏi mở (đặc biệt #4, ảnh hưởng
hạ tầng), rồi viết spec theo đúng thứ tự Sprint 0 (schema) → Sprint 3
(UC-14..20) như file task yêu cầu.

## 2026-09-14 — Phase 8 (Health & Injury) hoàn thành — 3/3 luồng mở rộng XONG

**Nguồn:** [specs/phase-8-health-injury.md](specs/phase-8-health-injury.md) + Claude Code.
**Quyết định:**
- **Luồng 3/3 (cuối) của việc mở rộng "2026-09-12"** — hoàn tất cả 3 luồng
  activity diagram đã chốt (Pedigree & Races, Training Plan & Lock, Health & Injury).
- **Chỉ `severity=HIGH` tự khoá khi tạo sự cố** — `LOW`/`MEDIUM` chỉ ghi
  nhận + thông báo, không ảnh hưởng lịch tập.
- **`HorsesService.lock()` là nơi DUY NHẤT gửi thông báo khoá/mở khoá** —
  dùng chung cho lời gọi tay (Phase 7) và tự động (sự cố Phase 8), chỉ gửi
  khi giá trị `locked` thực sự đổi (idempotent, không spam).
- **Không có `NotificationType` riêng cho "sự cố đã xử lý xong"** — thông
  báo `TRAINING_UNLOCKED` đã đủ ngữ cảnh khi sự cố `RESOLVED` mở khoá ngựa.
- **`INCIDENT_REPORTED` gửi cho mọi severity**, không chỉ `HIGH`.
- **Người nhận thông báo cố định: chủ ngựa + mọi MANAGER** — không có bảng
  phân công trainer/vet theo ngựa nên không nhắm chính xác hơn.
- **`status` sự cố chỉ tiến, cho phép nhảy bước** (`OPEN→RESOLVED` thẳng).
- **`healthRecordId` optional** — sự cố nhẹ có thể đóng mà không cần hồ sơ khám riêng.
- **`PATCH /incidents/:id` không có ownership guard** — chỉ VET tới được
  (giống pattern health-records/training-plans).
- **`GET /notifications` luôn tự lọc theo người gọi** — không có khái niệm
  xem hộ người khác kể cả MANAGER.
- **Không xoá `IncidentReport`/`Notification`** — giống các model MVP mở
  rộng khác. Không đẩy thông báo real-time, không gửi email.
- Migration `phase8_incidents_notifications`: chỉ thêm 2 bảng mới + 3 enum,
  không đổi cột hiện có.
**Trạng thái:** ✅ build/lint/e2e (117/117: 96 cũ + 21 mới) xanh · seed idempotent.

## 2026-09-14 — Phase 7 (Training Plan & Training Lock) hoàn thành

**Nguồn:** [specs/phase-7-training-plan-lock.md](specs/phase-7-training-plan-lock.md) + Claude Code.
**Quyết định:**
- **Luồng 2/3 của việc mở rộng "2026-09-12"** — Pedigree/Races (luồng 1) xong
  trước; Health & Injury (luồng 3) để phase sau.
- **VET là người duy nhất khoá/mở khoá** (`PATCH /horses/:id/lock`), không
  phải MANAGER — đúng chốt "Training Lock do Vet ban hành".
- **Chưa làm `incident_reports`** — khoá là hành động tay của VET ở phase
  này, chưa gắn với 1 hồ sơ sự cố cụ thể (bảng đó thuộc Phase 8, có thể gọi
  lại `lock()` service này thay vì tạo API riêng).
- **`lockReason` bị xoá khi mở khoá** — không có bảng lịch sử khoá ở MVP mở
  rộng này.
- **Chỉ chặn TẠO buổi tập mới khi khoá**, không chặn PATCH buổi tập đã có —
  giữ đơn giản, buổi `PLANNED` từ trước vẫn sửa được (thường để `CANCELLED`).
- **Lập kế hoạch (`training-plans`) không bị chặn bởi `locked`** — kế hoạch
  là dự định tương lai, hợp lý ngay cả khi ngựa đang nghỉ.
- **`planId` trên session optional**, không bắt buộc buổi tập phải thuộc 1
  kế hoạch — giữ tương thích ngược Phase 3.
- **`PATCH /training-plans/:id` không có ownership guard** — chỉ TRAINER tới
  được, TRAINER xem/sửa mọi kế hoạch (giống VET với health-records Phase 4).
- **Không có DELETE** cho `TrainingPlan` — giống pattern `HealthRecord`/`Race`.
- **Tách relation Prisma `"PlanTrainer"` khỏi `"SessionTrainer"`** trên `User`.
- Migration `phase7_training_plan_lock`: chỉ thêm cột default/nullable trên
  `Horse`/`TrainingSession` + bảng mới `TrainingPlan` — không đổi dữ liệu cũ.
**Trạng thái:** ✅ build/lint/e2e (96/96: 77 cũ + 19 mới) xanh · seed idempotent.

## 2026-09-14 — Phase 6 (Pedigree & Races) hoàn thành

**Nguồn:** [specs/phase-6-pedigree.md](specs/phase-6-pedigree.md) + Claude Code.
**Quyết định:**
- **Luồng 1/3 của việc mở rộng "2026-09-12"** — chỉ làm Pedigree/Races ở phase
  này; Training Plan+Lock và Health & Injury để phase sau (đã chốt làm từng
  luồng một, viết spec trước khi code).
- **`sireId`/`damId`/`fitnessScore` sửa qua `PATCH /horses/:id` sẵn có** —
  không thêm endpoint riêng.
- **`fitnessScore` MANAGER nhập tay** (0-100), không tự tính từ dữ liệu
  training/health — chưa có công thức được chốt.
- **`GET /horses/:id/pedigree` giới hạn cứng 3 đời**, không dò cây tổ tiên
  đầy đủ — chỉ chặn tự tham chiếu trực tiếp (`sireId/damId === id`, hoặc
  `sireId === damId`) ở tầng validate.
- **`Race` không có ownership/`ownerId`** — dữ liệu chung CLB, mọi role đăng
  nhập xem được; chỉ `GET /horses/:id/race-entries` (gắn 1 ngựa cụ thể) mới
  qua `HorseOwnershipGuard`.
- **Không có DELETE** cho `Race`/`RaceEntry` ở phase này — giống pattern
  `HealthRecord`: nhập sai thì PATCH lại.
- **1 ngựa/1 giải chỉ 1 entry** (`@@unique([raceId, horseId])`) → trùng = `CONFLICT`.
- Migration `phase6_pedigree_races`: chỉ thêm cột nullable trên `Horse` + 2
  bảng mới — không đổi dữ liệu cũ.
**Trạng thái:** ✅ build/lint/e2e (77/77: 55 cũ + 22 mới) xanh · seed idempotent.

## 2026-09-12 — Mở rộng data model theo 3 activity diagram + ERD

**Nguồn:** người dùng + Claude chat (activity diagram, ERD).
**Quyết định:** thêm bảng `races`, `race_entries`, `incident_reports`,
`notifications`; thêm cột `sire_id`, `dam_id`, `locked`,
`fitness_score` vào `horses`, để khớp 3 activity diagram (Hồ sơ &
Pedigree / Training Plan / Health & Injury) đã chốt làm 3 main flow
demo.
**Lý do:** các flow yêu cầu pedigree, thành tích thi đấu, Training
Lock đồng bộ giữa Training và Health, và hệ thống thông báo dùng
chung — không có trong scope MVP gốc nhưng cần cho bản demo 3 flow.

## 2026-09-08 — Quy trình: đặc tả theo phase trong `docs/specs/`

**Nguồn:** người dùng ("lên kế hoạch thiết kế rồi đi code theo đó... mọi thứ đều
phải ghi doc đặc tả").
**Quyết định:** từ Phase 2, mỗi phase có 1 file `docs/specs/phase-N-*.md` viết
**trước khi code**: phạm vi, data model, hợp đồng API (request/response/lỗi),
RBAC & ownership, quyết định thiết kế, kế hoạch test, định nghĩa "xong". Sau khi
code + test xong, cập nhật mục "Trạng thái thực hiện" ở cuối spec. Index: `specs/README.md`.
**Lý do:** làm việc như một coder thật — thiết kế trước, có tài liệu đặc tả để đối chiếu,
dễ review và bàn giao.

## 2026-09-09 — Phase 5 (Hoàn thiện MVP + frontend) hoàn thành

**Nguồn:** [specs/phase-5-mvp.md](specs/phase-5-mvp.md) + Claude Code.
**Quyết định:**
- **1 app React đổi UI theo role** (không tách web con) — đúng định hướng giai
  đoạn MVP. Tách web con để sau.
- **Không thêm dependency frontend** — CSS thuần (không UI kit), state bằng React
  Context (không Redux/Zustand). Giữ bundle nhỏ, dễ chấm.
- **Token trong `localStorage`** (`racehorse.accessToken` / `.refreshToken`) —
  đúng chốt Phase 1 (refresh qua body). Chấp nhận rủi ro XSS cho đồ án nội bộ.
- **Response interceptor refresh 1 lần** (dedupe bằng 1 promise dùng chung),
  không hàng đợi request song song; bỏ qua `/auth/*` để tránh vòng lặp; hỏng →
  xoá token + về `/login`.
- **`GET /auth/me` khi khởi động** để phục hồi `user` (JWT chỉ mang `sub`).
- **Serve file đính kèm: tải blob qua axios rồi `window.open`** — link `<a href>`
  thuần không gắn được Bearer.
- **MANAGER "tạo user" = duyệt PENDING** (không có `POST /users`): đăng ký công
  khai `/register` → seed sẵn 1 user PENDING (đã verify email) → MANAGER gán role
  + `status=ACTIVE`.
- **ERD đặt trong `DATA_MODEL.md`** (mục Mermaid `erDiagram` ở đầu, 6 model thật),
  không tạo file mới — gom tài liệu data về 1 chỗ.
- **Không i18n hoá dữ liệu động** (tên ngựa, diagnosis…) — chỉ nhãn UI.
- Chấp nhận 4 **warning** oxlint `react(set-state-in-effect)` ở các trang fetch
  danh sách (rule over-eager với data-fetch); `npm run lint` vẫn exit 0.
- Không có test tự động cho frontend ở phase này (đã có 55 e2e API phủ mọi
  endpoint FE gọi).
**Trạng thái:** ✅ web build/lint · api build/lint/e2e (55/55) · seed lại OK ·
2 server boot. Click-through 4 luồng MVP để người dùng demo.

## 2026-09-09 — Phase 4 (Health records) hoàn thành

**Nguồn:** [specs/phase-4-health.md](specs/phase-4-health.md) + Claude Code.
**Quyết định:**
- **Không tạo `RecordOwnershipGuard`.** `/health-records/:id` mang recordId → check
  ownership trong service (load record kèm `horse` một lần). `/horses/:id/health-records*`
  vẫn dùng `HorseOwnershipGuard`. (Giống Phase 3 với `/sessions/:id`.)
- **`vetId` = người gọi**, không nhận từ body. Chỉ VET tạo/sửa/đính kèm được
  (MANAGER cũng không) — đúng bảng quyền MVP.
- **`examDate` không được ở tương lai** → `VALIDATION_ERROR`. Khác `scheduledAt`
  của session (cho phép tương lai vì là lịch hẹn); health record là ghi nhận việc đã khám.
- **`PATCH /health-records/:id` không gắn ownership guard** — chỉ VET tới được,
  mà VET xem/sửa mọi ngựa. Không phân biệt "vet nào tạo thì vet đó sửa" (1 CLB, ít vet).
- **List sắp xếp `examDate desc`** (xem khám gần nhất trước), khác Training `scheduledAt asc`.
- **Không soft-delete, không endpoint DELETE** — `HealthRecord` không có `deletedAt`;
  sửa nhầm thì PATCH lại. Model cũng không có `updatedAt`.
- **Attachment cho phép PDF** ngoài ảnh (kết quả xét nghiệm hay là PDF). Cần multer
  option riêng: `buildAttachmentMulterOptions()` đọc `process.env` (không cần
  `ConfigService` lúc decorate), dùng inline trong `FileInterceptor`. Ảnh ngựa vẫn
  dùng `MulterModule` global. 1 file/record, ghi đè.
- **Module đặt tên `health-records.*`** (`HealthRecordsModule` / `HealthRecordsService`)
  để không đụng `HealthController` (health-check `GET /api/v1/health`) có từ Phase 0.
  `HealthFilesController` (`@Controller('files')`, route `health-attachments/:filename`)
  nằm trong `HealthRecordsModule` — tránh phụ thuộc vòng với `FilesController` của
  Phase 2 (trong `HorsesModule`). Hai controller cùng prefix `files` là hợp lệ.
- **Không cần migration** — `HealthRecord` có từ `init`.
**Trạng thái:** ✅ build / lint / e2e (55/55) xanh.

## 2026-09-08 — Phase 3 (Training sessions) hoàn thành

**Nguồn:** [specs/phase-3-training.md](specs/phase-3-training.md) + Claude Code.
**Quyết định:**
- **Không tạo `SessionOwnershipGuard`.** `/sessions/:id` mang sessionId, không phải
  horseId → check ownership trong service (load session kèm `horse` một lần).
  `/horses/:id/sessions*` vẫn dùng `HorseOwnershipGuard`.
- **`trainerId` = người gọi**, không nhận từ body. Chỉ TRAINER tạo được session
  (MANAGER cũng không) — đúng bảng quyền MVP.
- **State machine tối giản:** chỉ `PLANNED → DONE` và `PLANNED → CANCELLED`.
  `DONE`/`CANCELLED` là trạng thái cuối — PATCH tiếp lên nó → `VALIDATION_ERROR`.
  `scheduledAt/type/notes` chỉ sửa được khi đang `PLANNED`.
- **Chuyển `DONE` ⇒ bắt buộc `resultMetric` + `resultValue`** (lấy từ payload hoặc
  giá trị đã có). `CANCELLED` không cần result.
- **GROOM chỉ được đụng `status` + `resultMetric` + `resultValue`** — kiểm ở
  service bằng whitelist key, vượt → `FORBIDDEN`. GROOM đặt được cả `DONE` lẫn
  `CANCELLED`.
- **Lọc key dto theo `value !== undefined`** trước khi kiểm whitelist — vì
  class-transformer/ValidationPipe hay tạo field optional chưa gửi thành `undefined`.
- **Session không soft-delete** (không endpoint DELETE); hủy = `CANCELLED`.
- **List sắp xếp `scheduledAt asc`** (xem lịch theo thời gian), khác Horses
  (`createdAt desc`).
- **`scheduledAt` không ràng buộc quá khứ/tương lai** (cho ghi hồi tố).
- Seed VET luôn ở Phase 3 (dùng ở Phase 4) cho gọn.
- Không cần migration — `TrainingSession` có từ `init`.
**Trạng thái:** ✅ build / lint / e2e (39/39) xanh + smoke curl trọn luồng MVP #2.

## 2026-09-08 — Phase 2 (Horses) hoàn thành

**Nguồn:** [specs/phase-2-horses.md](specs/phase-2-horses.md) + Claude Code.
**Quyết định:**
- **`ownerId` phải trỏ tới user `role = OWNER`, `deletedAt: null`.** Sai →
  `VALIDATION_ERROR` (lỗi dữ liệu form), không phải 404.
- **OWNER truy cập ngựa không thuộc mình → 403 `FORBIDDEN`** (không phải 404).
  Đánh đổi: lộ sự tồn tại của id. Chấp nhận cho hệ nội bộ 1 CLB.
- **`GET /horses`: OWNER luôn bị ép `ownerId = self`** ở tầng service (bỏ qua query
  client gửi). Role khác dùng filter tự do.
- **Ảnh ngựa: 1 ảnh/ngựa, ghi đè** (không gallery). Lưu `photoPath` tương đối
  (`horse-photos/<horseId>-<rand8>.<ext>`) trong DB; file trên ổ đĩa
  `apps/api/uploads/horse-photos/`. Xoá ngựa **không** xoá file (ghi nợ).
- **Serve ảnh qua controller Nest** (`GET /files/horse-photos/:filename`), không mở
  static folder — để ép qua `JwtAuthGuard` + kiểm tra ownership. Filename validate
  regex `^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$` chống path traversal.
- **Multer `diskStorage`** trực tiếp (không memory), `fileFilter` theo mime
  (jpeg/png/webp), `limits.fileSize = UPLOAD_MAX_MB`. `MulterError` map về
  `VALIDATION_ERROR` 400 trong exception filter.
- Object `Horse` trả về kèm `photoUrl` (service tính từ `photoPath`); giữ nguyên
  `deletedAt` trong payload (luôn null với ngựa sống).
- `HorseOwnershipGuard` tách riêng, gắn `req.horse`, tái sử dụng cho Phase 3/4.
- `FilesModule` chỉ chứa `FileStorageService` (thuần fs) + `MulterModule`;
  `FilesController` nằm trong `HorsesModule` → tránh phụ thuộc vòng.
- **Không cần migration** — bảng `Horse` đã tạo ở migration `init`.
**Trạng thái:** ✅ build / lint / e2e (25/25) xanh + smoke curl OK.

## 2026-09-08 — Phase 1 (Auth & Users) hoàn thành

**Nguồn:** người dùng chốt + Claude Code.
**Quyết định:**
- **Refresh token trả qua body JSON** (không dùng cookie). Frontend tự lưu & tự
  gắn vào `POST /auth/refresh`. Lý do: dễ test qua Swagger, không phải cấu hình
  CORS credentials / cookie-parser cho đồ án.
- Không thêm captcha / rate-limit cho `register` ở giai đoạn này.
- Access JWT payload chỉ chứa `sub` (userId); guard **luôn load user từ DB** mỗi
  request để kiểm tra `status` + soft-delete (không tin role trong token).
- Refresh token & auth token (verify/reset) **chỉ lưu hash SHA-256**, không lưu
  plaintext. Refresh dùng **rotation**: mỗi lần refresh revoke token cũ, phát token mới.
- Reset password + xoá user ⇒ revoke toàn bộ refresh token của user đó.
- `PATCH /users/:id` set `status=ACTIVE` bắt buộc user phải có `role` (tự set hoặc
  đã có) — đây là hành động "duyệt PENDING".
- MANAGER không tự xoá được chính mình.
- `MailService` fallback: thiếu `SMTP_USER/PASS` ⇒ log email ra console thay vì gửi
  (giữ e2e chạy được không cần SMTP thật).
- `@nestjs/swagger` plugin bật trong `nest-cli.json` để tự sinh schema DTO.
**Trạng thái:** ✅ build / lint / e2e (9 test, trọn vòng đời tài khoản) đều xanh.

## 2026-09-08 — Chốt stack & phạm vi Core API (Q&A với người dùng)

**Nguồn:** người dùng trả lời Q&A + Claude Code.
**Quyết định:**
- Stack API: **NestJS + TypeScript**, ORM **Prisma**, DB **PostgreSQL** (mỗi người tự cài lên Windows).
- Auth **đầy đủ**: đăng ký tự do → tài khoản `PENDING`, MANAGER duyệt & gán role;
  có email verify + forgot/reset password + refresh token (rotation).
- Email: **Gmail + App Password** qua nodemailer, cấu hình trong `.env`.
- **Có upload file**, lưu **ổ đĩa local** (`apps/api/uploads/`).
- Repo: **monorepo** `apps/api` + `apps/web` (không dùng Nx/Turbo).
- **Một câu lạc bộ duy nhất** — không có bảng `clubs`, không multi-tenant.
- Deploy: chưa xác định, chỉ chạy local khi demo; vẫn thêm Dockerfile + docker-compose.
- Frontend MVP: **song ngữ i18n** (vi/en) ở client; API trả `code` lỗi ổn định.
- Timeline: **cả học kỳ (> 8 tuần)**.
- Phạm vi Claude Code build: **Core API + 1 frontend React/Vite MVP demo**.
- Git host: **GitHub** (nhóm truy cập được).
**Lý do:** nhóm quen NestJS/TS; scale nhỏ nên 1 API + 1 Postgres là đủ; ưu tiên
chất lượng kiến trúc/tài liệu để chấm điểm. Chi tiết đầy đủ: [PLAN.md](PLAN.md).
**Trạng thái:** ✅ Người dùng DUYỆT 2026-09-08. Bắt đầu Phase 0 (scaffold `apps/api` +
`apps/web`). Bổ sung chốt: cài Postgres giúp người dùng (chưa có trên máy);
`apps/web` làm skeleton ngay ở Phase 0.

---

## 2026-09-08 — Chọn phạm vi MVP theo main flow

**Nguồn:** người dùng + Claude Code.
**Quyết định:** dựng MVP trước, chỉ 4 bảng (`users`, `horses`, `training_sessions`,
`health_records`), gộp kết quả tập thẳng vào `training_sessions`. Bỏ tạm stalls,
plans, vaccinations, medications, care_logs, facility_tasks, audit_logs, reports.
**Lý do:** chứng minh luồng `đặt lịch → thực hiện → ghi kết quả` chạy end-to-end
với ít rủi ro data nhất. Chi tiết: [MVP.md](MVP.md).

## 2026-09-08 — Kiến trúc Core API + nhiều web con

**Nguồn:** người dùng.
**Quyết định:** một Core API duy nhất (1 service, 1 DB) + nhiều frontend độc lập
theo role (1 dashboard admin + các web con). Web con chỉ giao tiếp qua API,
không share DB, không gọi lẫn nhau. KHÔNG microservice.
**Lý do:** vừa sức đồ án, dễ chia việc nhóm, data tập trung dễ quản lý.
Giai đoạn MVP tạm dùng 1 app React đổi UI theo role, tách web con sau.

## 2026-09-08 — Stack (ĐỀ XUẤT — ĐÃ THAY BẰNG quyết định phía trên)

~~Đề xuất ban đầu: NestJS + Prisma + PostgreSQL, chỉ JWT access token.~~
Đã chốt chính thức ở mục "Chốt stack & phạm vi Core API" phía trên (có refresh token).

## 2026-09-08 — Ghim Prisma ở 6.19.3 (không lên v7/v8)

**Nguồn:** Claude Code (phát sinh khi scaffold).
**Quyết định:** `prisma` và `@prisma/client` ghim đúng **6.19.3**.
**Lý do:** Prisma 7+ bỏ `url` trong `datasource`, bắt buộc `prisma.config.ts` +
driver adapter truyền vào `PrismaClient` — phức tạp không cần thiết cho đồ án.
npm dist-tag `latest` của prisma hiện trỏ vào bản RC 8.x nên phải ghim tường minh.

## 2026-09-08 — PostgreSQL: bản portable + autostart qua Startup folder

**Nguồn:** Claude Code (phát sinh khi cài môi trường).
**Quyết định:** dùng bản **portable ZIP** giải nén `C:\Users\Lenovo\pgsql`
(data `C:\Users\Lenovo\pgdata`, port 5432). Autostart bằng
`scripts/pg-autostart.vbs` đặt trong Startup folder của user.
**Lý do:** winget tải installer bị treo (mạng); đăng ký Windows service và
scheduled task đều bị trình phân quyền chặn. Startup-folder VBS là cách không cần
admin, đã test chạy được.

## 2026-09-08 — Phase 0 (scaffold) hoàn thành

**Nguồn:** Claude Code.
**Trạng thái:** ✅ `apps/api` + `apps/web` đã dựng, build/lint/e2e xanh,
DB migrate + seed xong. Chi tiết: [STATE.md](STATE.md) §3.
Tiếp theo: Phase 1 (Auth & Users) — còn chờ chốt cách trả refresh token
(body vs cookie), xem [STATE.md](STATE.md) §4.

---

## 2026-09-30 — Flow 1: Thiết kế & Triển khai Giao diện Quản lý Hồ sơ Ngựa (Horse Profile Management)

**Nguồn:** Yêu cầu người dùng (SWP391 Team RHTMS).
**Quyết định:**
1. Áp dụng chuẩn **Racehorse Design System** từ `racehorse-design-system.html`:
   - Màu thương hiệu chính: Navy `#1c2b3a` (Header, Buttons chính, Avatars).
   - Màu nền: Cream `#f5f4f1`, Card nền trắng `#ffffff`.
   - Màu phụ: Blue accent `#1a4b8a`.
   - Typography: Font Inter đồng nhất; huy hiệu StatusBadges (FIT, MONITORING, INJURED, LOCKED, ACTIVE, RESTING, RETIRED).
2. Hoàn thiện 2 use case chính của Flow 1 trên Frontend:
   - **Use Case 1 (View horse list & detail)**:
     - `HorsesPage`: Metric cards tóm tắt (Tổng số, Đang hoạt động, Nghỉ dưỡng, Cần chú ý), tìm kiếm theo tên, bộ lọc chip trạng thái, bảng danh sách có avatar và status badges.
     - `HorseDetailPage`: Hero banner, avatar lớn, nút đổi ảnh, trạng thái kết hợp, banner cảnh báo khóa tập luyện (Training Lock), tab Hồ sơ chi tiết (key-value grid), tab Cây phả hệ 3 đời (PedigreeTree).
   - **Use Case 2 (Add / Edit / Delete horse profile)**:
     - `CreateHorseModal`: Thêm mới ngựa (chọn chủ từ role OWNER, validate ngày sinh không vượt quá hiện tại).
     - `EditHorseModal`: Sửa thông tin, gán ngựa cha (sireId), ngựa mẹ (damId), điểm thể trạng (fitnessScore), trạng thái, đổi chủ.
     - `DeleteHorseModal`: Xác nhận xóa mềm an toàn (soft-delete bảo lưu lịch sử buổi tập và y tế).
     - `PhotoUploadModal`: Tải ảnh đại diện lên (multipart file, tối đa 5MB).
3. Tài liệu thiết kế chi tiết: Lưu tại `docs/FLOW1_HORSE_PROFILE_DESIGN.md`.

---

## Mẫu ghi quyết định mới


```
## YYYY-MM-DD — <tiêu đề ngắn>

**Nguồn:** <ai>
**Quyết định:** <nội dung>
**Lý do:** <tại sao>
```
