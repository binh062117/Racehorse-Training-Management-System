# TÀI LIỆU VÀ HƯỚNG DẪN API TESTING VỚI POSTMAN
## Môn học: Software Testing (Kiểm thử phần mềm)
### Dự án: Racehorse Training & Management System

---

## 1. Mục tiêu kiểm thử (Testing Objectives)
Bộ kiểm thử API này được thiết kế theo đúng chuẩn kiến thức và phương pháp luận của môn học **Software Testing**, nhằm:
1. **Sanity / Smoke Testing**: Xác nhận hệ thống API và cơ sở dữ liệu hoạt động bình thường trước khi chạy bộ test chuyên sâu.
2. **Functional Testing (Positive / Happy Path)**: Kiểm thử tính đúng đắn của các luồng nghiệp vụ khi người dùng cung cấp dữ liệu hợp lệ (HTTP 200 OK, 201 Created).
3. **Negative / Boundary Testing**: Kiểm tra khả năng xử lý dữ liệu sai, thiếu trường bắt buộc, sai định dạng (HTTP 400 Bad Request, 404 Not Found, 409 Conflict).
4. **Security & RBAC Testing (Role-Based Access Control)**: Kiểm thử tính bảo mật phân quyền đa vai trò (Manager, Trainer, Groom, Owner) và tính toàn vẹn của JWT Authentication (HTTP 401 Unauthorized, 403 Forbidden).
5. **Performance / SLA Testing**: Kiểm thử thời gian phản hồi (Response Time < 2000ms) để đảm bảo hiệu năng API.

---

## 2. Cấu trúc bộ kiểm thử (Test Suite Structure)

Bộ kiểm thử được đóng gói thành 2 file chuẩn Postman trong thư mục `postman/`:
- `Racehorse_System_API_Testing.postman_collection.json`: Bộ 35 Test Cases hoàn chỉnh có kèm assertions tự động (`pm.test`).
- `Racehorse_Local.postman_environment.json`: File cấu hình biến môi trường (Environment Variables) với URL, tài khoản demo sẵn có, UUID mẫu.

### Phân loại các Test Suites:
| STT | Tên Suite / Thư mục | Số lượng TCs | Mục đích kiểm thử |
|---|---|---|---|
| 00 | **00. Smoke & Sanity Testing** | 1 | Kiểm tra server up, DB connected |
| 01 | **01. Authentication & Authorization** | 9 | Đăng nhập đa vai trò, lưu token, kiểm tra hồ sơ, validate thông tin đăng nhập/đăng ký |
| 02 | **02. RBAC & Access Control Testing** | 5 | Phân quyền vai trò (Groom/Trainer truy cập trái phép bị 403, không có token bị 401) |
| 03 | **03. Horses Management API** | 9 | Lấy danh sách, lọc status, xem sơ đồ chuồng, xem chi tiết, gia phả, test UUID sai/không tồn tại |
| 04 | **04. Daily Care & Feeding API** | 3 | Công việc chăm sóc hàng ngày, nhật ký cho ăn, validate body trống |
| 05 | **05. Health & Medical Records API** | 3 | Hồ sơ bệnh án, lịch tiêm chủng, lịch sử chấn thương |
| 06 | **06. Training, Races & Incidents API**| 3 | Tiến độ huấn luyện, danh sách giải đua, danh sách sự cố |
| 07 | **07. User Management API** | 2 | Xem chi tiết người dùng bởi Manager, kiểm tra ID không tồn tại |

---

## 3. Ma trận kiểm thử chi tiết (Test Case Matrix)

| Test ID | Test Suite | Tên kịch bản kiểm thử | HTTP Method | Endpoint | Loại kiểm thử | Status Code mong đợi | Mã lỗi / Assertions chính |
|---|---|---|---|---|---|---|---|
| **TC-01** | Smoke | Server & DB Health Check | GET | `/health` | Smoke Test | `200 OK` | `db: "up"`, time < 1500ms |
| **TC-02** | Auth | Manager Login | POST | `/auth/login` | Positive | `200 OK` | Nhận `accessToken`, role `MANAGER` |
| **TC-03** | Auth | Trainer Login | POST | `/auth/login` | Positive | `200 OK` | Nhận `trainerToken`, role `TRAINER` |
| **TC-04** | Auth | Groom Login | POST | `/auth/login` | Positive | `200 OK` | Nhận `groomToken`, role `GROOM` |
| **TC-05** | Auth | Owner Login | POST | `/auth/login` | Positive | `200 OK` | Nhận `ownerToken`, role `OWNER` |
| **TC-06** | Auth | Lấy profile cá nhân | GET | `/auth/me` | Positive | `200 OK` | Email trùng với `managerEmail` |
| **TC-07** | Auth | Đăng nhập sai mật khẩu | POST | `/auth/login` | Negative | `401 Unauthorized` | `INVALID_CREDENTIALS` |
| **TC-08** | Auth | Đăng nhập thiếu password | POST | `/auth/login` | Negative | `400 Bad Request` | `VALIDATION_ERROR` |
| **TC-09** | Auth | Đăng ký email đã tồn tại | POST | `/auth/register` | Negative | `409 Conflict` | `CONFLICT` |
| **TC-10** | Auth | Đăng ký sai format email | POST | `/auth/register` | Negative | `400 Bad Request` | `VALIDATION_ERROR` |
| **TC-11** | RBAC | Manager lấy danh sách Users | GET | `/users` | Positive | `200 OK` | Trả về mảng `data` |
| **TC-12** | RBAC | Groom gọi API Manager Users | GET | `/users` | Security / RBAC | `403 Forbidden` | `FORBIDDEN` |
| **TC-13** | RBAC | Trainer gọi API Manager Users| GET | `/users` | Security / RBAC | `403 Forbidden` | `FORBIDDEN` |
| **TC-14** | Security | Gọi API không có Token | GET | `/users` | Security | `401 Unauthorized` | `UNAUTHENTICATED` |
| **TC-15** | Security | Gọi API với Token giả mạo | GET | `/users` | Security | `401 Unauthorized` | `TOKEN_INVALID` |
| **TC-16** | Horses | Lấy toàn bộ danh sách ngựa | GET | `/horses` | Positive | `200 OK` | Trả về `data` và `total` > 0 |
| **TC-17** | Horses | Lọc ngựa theo status=ACTIVE | GET | `/horses?status=ACTIVE&limit=5` | Positive | `200 OK` | Mọi phần tử đều có status ACTIVE |
| **TC-18** | Horses | Xem sơ đồ chuồng ngựa | GET | `/horses/stalls/map` | Positive | `200 OK` | Trả về bản đồ vị trí chuồng |
| **TC-19** | Horses | Lấy thông tin chi tiết 1 con ngựa | GET | `/horses/:id` | Positive | `200 OK` | ID khớp với requested ID |
| **TC-20** | Horses | Xem gia phả (Pedigree) | GET | `/horses/:id/pedigree` | Positive | `200 OK` | Cây phả hệ tổ tiên |
| **TC-21** | Horses | Xem lịch sử đánh giá thể lực | GET | `/horses/:id/fitness-assessments` | Positive | `200 OK` | Lịch sử fitness assessments |
| **TC-22** | Horses | Lấy ngựa với UUID sai định dạng | GET | `/horses/:invalidUUID` | Negative | `400 Bad Request` | `VALIDATION_ERROR` |
| **TC-23** | Horses | Lấy ngựa với UUID không tồn tại | GET | `/horses/:nonExistingUUID`| Negative | `404 Not Found` | `NOT_FOUND` |
| **TC-24** | RBAC | Groom cố tình tạo ngựa mới | POST | `/horses` | RBAC | `403 Forbidden` | `FORBIDDEN` |
| **TC-25** | Daily Care| Lấy danh sách chăm sóc hàng ngày | GET | `/daily-care` | Positive | `200 OK` | Trả về mảng công việc |
| **TC-26** | Feeding | Lấy nhật ký cho ngựa ăn | GET | `/horses/:id/feeding-records` | Positive | `200 OK` | Trả về mảng nhật ký cho ăn |
| **TC-27** | Daily Care| Tạo chăm sóc với body rỗng | POST | `/daily-care` | Negative | `400 Bad Request` | `VALIDATION_ERROR` |
| **TC-28** | Health | Lấy hồ sơ khám bệnh của ngựa | GET | `/horses/:id/health-records` | Positive | `200 OK` | Trả về hồ sơ bệnh án |
| **TC-29** | Health | Lấy lịch tiêm chủng của ngựa | GET | `/horses/:id/vaccinations` | Positive | `200 OK` | Trả về danh sách vaccine |
| **TC-30** | Health | Lấy danh sách chấn thương của ngựa | GET | `/horses/:id/injuries` | Positive | `200 OK` | Trả về lịch sử chấn thương |
| **TC-31** | Training | Tổng quan tiến độ huấn luyện | GET | `/training/progress/overview` | Positive | `200 OK` | Dashboard huấn luyện |
| **TC-32** | Races | Lấy danh sách giải đua | GET | `/races` | Positive | `200 OK` | Danh sách giải đấu |
| **TC-33** | Incidents| Lấy danh sách sự cố | GET | `/incidents` | Positive | `200 OK` | Danh sách sự cố chuồng trại |
| **TC-34** | Users | Manager xem chi tiết 1 User | GET | `/users/:id` | Positive | `200 OK` | Thông tin user và role |
| **TC-35** | Users | Tìm User với ID không tồn tại | GET | `/users/:nonExistingUUID` | Negative | `404 Not Found` | `NOT_FOUND` |

---

## 4. Hướng dẫn chạy kiểm thử trên Postman (Step-by-step)

### Bước 1: Khởi động hệ thống API (Không thay đổi code)
Mở một cửa sổ Terminal (PowerShell hoặc Command Prompt) và chạy:
```powershell
cd apps/api
npm run start:dev
```
> Khi màn hình hiển thị: `API on http://localhost:3000/api/v1 · docs at /api/docs` là hệ thống đã sẵn sàng.

### Bước 2: Import vào Postman
1. Mở phần mềm **Postman**.
2. Nhấn nút **Import** (nằm ở góc trên bên trái).
3. Kéo thả 2 file sau vào cửa sổ Import:
   - `postman/Racehorse_System_API_Testing.postman_collection.json`
   - `postman/Racehorse_Local.postman_environment.json`
4. Postman sẽ nạp Collection và Environment tương ứng.

### Bước 3: Chọn môi trường (Environment)
1. Ở góc trên cùng bên phải giao diện Postman, tìm ô chọn Environment (thường đang là *No Environment*).
2. Chọn **`Racehorse System - Local Environment`**.

### Bước 4: Chạy toàn bộ Test Suite (Collection Runner)
1. Nhấp chuột vào tên Collection: **`Racehorse Management System — API Testing Suite`**.
2. Nhấn nút **Run** (hoặc nút **Run collection** màu xanh).
3. Đảm bảo toàn bộ 35 Test Cases đều được tick chọn.
4. Nhấn **Run Racehorse Management System**.
5. Quan sát Postman chạy lần lượt từ trên xuống dưới:
   - Request `TC-02: Manager Login` sẽ tự động lấy `accessToken` và lưu vào biến môi trường.
   - Các request tiếp theo sẽ tự động kế thừa Bearer token này.
   - Các request test RBAC của `Groom` và `Trainer` sử dụng biến `groomToken` và `trainerToken` tương ứng.
6. Xem kết quả thống kê: Số lượng Pass, Fail và thời gian phản hồi.

---

## 5. Chạy tự động bằng Newman (Tùy chọn xuất báo cáo HTML)
Nếu cần xuất báo cáo đẹp để nộp bài tập lớn hoặc chèn vào word/pdf:
```powershell
# Cài đặt newman (nếu chưa có)
npm install -g newman newman-reporter-htmlextra

# Chạy và sinh báo cáo HTML
newman run postman/Racehorse_System_API_Testing.postman_collection.json -e postman/Racehorse_Local.postman_environment.json -r cli,htmlextra --reporter-htmlextra-export postman/Test_Report.html
```
File `Test_Report.html` sinh ra sẽ có giao diện trực quan, biểu đồ tỉ lệ Pass/Fail để nộp cho giảng viên.
