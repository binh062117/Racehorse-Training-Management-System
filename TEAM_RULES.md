# QUY TẮC NHÓM — SWP391
### Topic: Racehorse Training & Management System

> Cập nhật lần cuối: **2026-11-08** — đồng bộ với `main` (tới PR #63).

---

## 1. Vai trò & Trách nhiệm

| Thành viên | Vai trò chính | Trách nhiệm |
|---|---|---|
| Nguyễn Đình Nhất Định | Team Leader | Quản lý tiến độ, phân công task, requirement, điều phối, integration. |
| Phạm Thế Cường | Horse Management | Flow 1 — Quản lý Hồ sơ & Lý lịch Ngựa. |
| Đào Trọng Tấn | Training Management | Flow 2 — Lập & Thực hiện Giáo án Huấn luyện. |
| Lê Quang Hải | Medical Management | Flow 3 — Quản lý Y tế & Xử lý Chấn thương. |
| Huỳnh Quốc Bình | Frontend / BA | UI, validation, testing, integration và hỗ trợ các module. |

- Các thành viên có thể hỗ trợ lẫn nhau khi cần.

---

## 2. Quy tắc họp nhóm

- Họp nhóm 2 buổi/tuần.
- Nếu có việc bận hoặc không thể tham gia, thành viên phải báo trước cho leader.
- Thành viên phải cập nhật tiến độ và các vấn đề đang gặp phải.
- Sau mỗi buổi họp sẽ ghi lại quyết định, task được giao và deadline.
- Quyết định kỹ thuật/thiết kế chốt trong buổi họp phải được ghi vào `docs/DECISIONS.md` (kèm ngày).

---

## 3. Quy tắc giao tiếp giữa các thành viên

- Google Meet là kênh giao tiếp chính cho các công việc của nhóm.
- Phản hồi tin nhắn liên quan đến project trong ngày.
- Thay đổi scope, deadline hoặc requirement phải được thông báo trong group.
- Báo sớm khi gặp vấn đề hoặc có nguy cơ trễ deadline.

---

## 4. Task & Deadline

- Mỗi task sẽ phân công người phụ trách, nội dung và deadline cụ thể.
- Quản lý project bằng GitHub, repo chung: `binh062117/Racehorse-Training-Management-System`.
- Deadline nội bộ phải sớm hơn deadline chính thức 1 ngày.
- Không tự ý bỏ task hoặc thay đổi deadline mà không thông báo.

---

## 5. Quy tắc ưu tiên Requirement

**Must Have → Test → Integration → Nice to Have**

- Nhóm phải hoàn thành 3 Flow REQUIRED trước khi bắt đầu các Flow OPTIONAL.
- Flow REQUIRED chỉ được xem là hoàn thành khi đã phát triển, kiểm thử và integration thành công.
- **Trạng thái hiện tại (PR #62, #63):** 3 Flow REQUIRED đã hoàn thiện trên `main`
  (Huấn luyện → sẵn sàng thi đấu, Chấn thương, Minh bạch cho chủ ngựa), e2e + unit test pass.
  Giai đoạn hiện tại: **ổn định, sửa lỗi, chuẩn bị demo**.
- Flow 4 và Flow 5 chỉ được thực hiện khi 3 Flow REQUIRED đã ổn định và còn đủ thời gian.
- Không ưu tiên feature mới khi REQUIRED flow còn lỗi nghiêm trọng.
- Feature mở rộng (AI, thông báo, nhật ký hệ thống, sơ đồ chuồng, hiệu ứng UI…) không được làm hỏng hoặc thay đổi hành vi của 3 Flow REQUIRED.

---

## 6. Git & Version Control

- Sử dụng một repository GitHub chung.
- **Không push trực tiếp lên `main`**, kể cả merge local rồi push. Mọi thay đổi vào `main` phải qua Pull Request.
- Nếu lỡ đưa code sai lên `main`: dùng `git revert`, không dùng `push --force`.
- Mỗi feature/module sử dụng một branch riêng, tạo từ `main` mới nhất.
- Đặt tên branch theo loại việc:
  - `feat/<ten-ngan>` — tính năng mới
  - `fix/<ten-ngan>` — sửa lỗi
  - `chore/<ten-ngan>` — dọn dẹp, cấu hình, script
  - `docs/<ten-ngan>` — tài liệu
  - Hạn chế branch đặt theo tên người (`Hai-work`, `cuong-work`); nếu đã có, đưa vào `main` qua branch `merge/<ten>` + PR.
- Commit message theo dạng `loại(phạm vi): mô tả` — vd `feat(api): …`, `fix(web): …`, `chore(scripts): …`. Mô tả ngắn gọn, nói rõ thay đổi gì.
- Quy trình: Pull → Branch → Code → Test → Commit → Push → Pull Request → Review → Merge.
- Trước khi tạo PR: cập nhật branch với `main` mới nhất và tự xử lý conflict trên branch của mình.
- Mỗi PR phải có ít nhất 1 thành viên khác review. PR đụng tới thành phần dùng chung (mục 8) phải được nhóm thống nhất trước khi merge.
- Mỗi PR nên gọn, một mục đích; mô tả rõ thay đổi gì và đã test thế nào.
- Không dồn integration đến cuối project; phải merge và kiểm tra thường xuyên.
- Không tự ý thay đổi dữ liệu dùng chung.

---

## 7. Code Quality & Testing

- Code phải build và lint thành công trước khi tạo Pull Request:
  - `apps/api`: `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e`
  - `apps/web`: `npm run build`, `npm run lint`
- Feature phải được test trước khi merge; logic nghiệp vụ mới ở API cần có test e2e đi kèm.
- Giao diện mới phải theo design system hiện tại (Racehorse DS v3) và có đủ chuỗi song ngữ trong `apps/web/src/i18n/vi.json` và `en.json` — không viết cứng chữ trong component.
- Không merge code có lỗi nghiêm trọng ảnh hưởng module khác.
- Sau khi merge phải kiểm tra cả module và integration với hệ thống.
- Lỗi phát hiện trong quá trình test phải được ghi nhận và xử lý.

---

## 8. Database & Shared Components

- Các thành phần dùng chung phải được thống nhất, gồm: Horse, User/Role (RBAC), Training Plan & Session, Health Record, Incident/Treatment, Race, Supply/Feeding, Notification, Audit Log, và `shared/injury-regions.json`.
- Thay đổi database, field, relationship hoặc API phải được trao đổi với thành viên liên quan.
- Thay đổi schema chỉ qua **migration Prisma mới** (`npm run prisma:migrate`). Không sửa, xóa migration đã merge vào `main`; không reset database dùng chung khi chưa trao đổi với nhóm.
- Khi pull về có migration mới: chạy lại `npm run prisma:migrate` trước khi code tiếp.
- Script tạo dữ liệu demo (`apps/api/scripts/`) phải chạy lại nhiều lần không bị nhân đôi dữ liệu, và không xóa dữ liệu thật.
- Không tự ý xóa hoặc đổi tên thành phần dùng chung.
- Không commit file `.env`, mật khẩu, API key (Neon, Cloudinary, email, AI…) lên repo.

---

## 9. Tài liệu & Deploy

- Thư mục `docs/` là nguồn thông tin chính của dự án. Khi thiết kế thay đổi trong lúc code, cập nhật `docs/STATE.md` và `docs/DECISIONS.md` trong cùng PR.
- Thành viên mới làm theo `Racehorse_Team_Setup_Guide.md` và `docs/SETUP.md`.
- Bản demo: frontend trên Vercel, API trên Render, database trên Neon, ảnh/file trên Cloudinary (xem `docs/DEPLOY.md`). Code merge vào `main` sẽ được deploy, nên `main` luôn phải chạy được.
- Trước buổi demo: mở link API trước vài phút để server khởi động, kiểm tra dữ liệu demo.

---

## 10. Conflicts

- Ưu tiên thảo luận dựa trên requirement và bằng chứng kỹ thuật.
- Tập trung giải quyết vấn đề, không công kích cá nhân.
- Nếu không thống nhất, Leader sẽ điều phối và đưa ra quyết định.

---

## 11. Đóng góp & Trách nhiệm

- Mỗi thành viên phải có đóng góp rõ ràng và có thể kiểm chứng.
- Contribution có thể thể hiện qua code, Git, database, diagram, documentation, testing hoặc công việc liên quan.
- Commit phải dùng đúng tài khoản GitHub của mình để đóng góp được ghi nhận chính xác.
- Thành viên chịu trách nhiệm với task đã nhận và chủ động yêu cầu hỗ trợ khi cần.

---

## 12. Nguyên tắc chung

- Ưu tiên chất lượng và tính ổn định hơn số lượng feature.
- Mọi thay đổi lớn về scope, database, architecture hoặc requirement phải được nhóm thống nhất.
- Quyết định đã thống nhất trong meeting phải được ghi nhận và thực hiện thống nhất.
- Các thành viên hỗ trợ nhau để đảm bảo tiến độ chung.
