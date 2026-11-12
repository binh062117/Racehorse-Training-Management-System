# BÁO CÁO VÀ HƯỚNG DẪN KIỂM THỬ API THEO NGHIỆP VỤ (BUSINESS LOGIC TESTING)
## Môn học: Software Testing (Kiểm thử phần mềm)
### Hệ thống: Racehorse Training & Management System

---

## 1. MỤC TIÊU VÀ BẢN CHẤT KIỂM THỬ NGHIỆP VỤ (BUSINESS LOGIC TESTING)
Trước đây, các test case cơ bản chủ yếu kiểm tra tính kết nối mạng (Smoke test / Connection test: kiểm tra server sống hay chết, trả về mã 200 đơn thuần). 

Bộ kiểm thử mới này được tái cấu trúc hoàn toàn nhằm **tập trung 100% vào việc kiểm thử các Quy tắc Nghiệp vụ (Business Rules) và các Luồng Nghiệp vụ Hoàn chỉnh (End-to-End Business Workflows)** theo yêu cầu chuẩn của Giảng viên môn Software Testing:

1. **Kiểm thử Chu trình Vòng đời (State Transitions / Workflows)**:
   - Dữ liệu được tạo mới $\rightarrow$ Chuyển trạng thái nghiệp vụ qua các bước $\rightarrow$ Kiểm tra tính toàn vẹn ở từng bước:
     + Buổi tập: Khởi tạo (`PLANNED`) $\rightarrow$ Huấn luyện viên hoàn thành (`DONE`).
     + Chăm sóc: Giao việc (`completed = false`) $\rightarrow$ Nhân viên tích xong (`completed = true`).
     + Sự cố khẩn cấp: Mở biên bản (`OPEN`) $\rightarrow$ Khám bệnh và điều trị $\rightarrow$ Đóng sự cố (`RESOLVED`).
2. **Kiểm thử Quy tắc Tính toán Tự động (Calculation Business Rules)**:
   - Bác sĩ thú y chấm 5 chỉ số thể lực (`speedScore`, `staminaScore`, `conditionScore`, `recoveryScore`, `moraleScore`).
   - Hệ thống tự động tính: `totalScore = speedScore + staminaScore + conditionScore + recoveryScore + moraleScore`.
   - Script assert xác thực công thức tính toán và sự đồng bộ tự động sang `horse.fitnessScore`.
3. **Kiểm thử Quy tắc An toàn & Ràng buộc miền giá trị (Safety & Constraint Enforcement)**:
   - Khi ngựa bị Bác sĩ thú y kích hoạt lệnh cấm tập (**Training Lock** do chấn thương) $\rightarrow$ Hệ thống lập tức từ chối không cho Trainer tạo buổi tập mới.
   - Thử đánh giá điểm thể lực vượt ngưỡng biên nghiệp vụ ($> 20$) $\rightarrow$ Hệ thống chặn ngay lập tức.
   - Thử ghi nhận khối lượng thức ăn âm ($-5\text{ kg}$) $\rightarrow$ Bị chặn vì vi phạm miền giá trị.
   - Thử đóng sự cố y tế mà **không đính kèm hồ sơ khám bệnh** $\rightarrow$ Hệ thống từ chối đóng sự cố để tránh gian lận y tế.
4. **Kiểm thử Phân quyền Vai trò Nghiệp vụ (RBAC Enforcement)**:
   - Manager có toàn quyền quản trị người dùng và khởi tạo giải đua.
   - Groom và Trainer bị chặn (`403 Forbidden`) nếu cố tình can thiệp vào dữ liệu của Quản lý.

---

## 2. MA TRẬN KỊCH BẢN KIỂM THỬ NGHIỆP VỤ (BUSINESS TEST MATRIX)

| Mã Kịch Bản | Phân Hệ Nghiệp Vụ | Tên Kịch Bản Nghiệp Vụ | Method | Endpoint | Quy Tắc Nghiệp Vụ Cần Xác Thực | Kết Quả Mong Đợi |
|---|---|---|---|---|---|---|
| **AUTH-01** | Auth Flow | Manager Đăng nhập & Khởi tạo Phiên | POST | `/auth/login` | Cấp token, xác thực role `MANAGER` | `201 Created` |
| **AUTH-02** | Auth Flow | Trainer Đăng nhập | POST | `/auth/login` | Cấp token, xác thực role `TRAINER` | `201 Created` |
| **AUTH-03** | Auth Flow | Groom Đăng nhập | POST | `/auth/login` | Cấp token, xác thực role `GROOM` | `201 Created` |
| **AUTH-04** | Auth Flow | Vet (Bác sĩ) Đăng nhập | POST | `/auth/login` | Cấp token, xác thực role `VET` | `201 Created` |
| **AUTH-05** | Auth Flow | Kiểm tra Hồ sơ Bản thân | GET | `/auth/me` | Trả về thông tin Manager chính chủ | `200 OK` |
| **HORSE-01**| Horse Lifecycle | Tạo hồ sơ Ngựa đua mới | POST | `/horses` | Mặc định `ACTIVE`, `locked: false`, `healthStatus: FIT` | `201 Created` |
| **HORSE-02**| Horse Lifecycle | Cập nhật vị trí chuồng trại | PATCH | `/horses/:id` | Cập nhật số chuồng `stallNumber` và `saddleNumber` | `200 OK` |
| **HORSE-03**| Fitness Rule | Vet Đánh giá Thể lực 5 Tiêu chí | POST | `/horses/:id/fitness-assessment` | **Tính toán:** `totalScore = sum(5 tiêu chí) = 88`, đồng bộ sang hồ sơ ngựa | `201 Created` |
| **HORSE-04**| Domain Boundary| Đánh giá điểm vượt biên ($> 20$) | POST | `/horses/:id/fitness-assessment` | Chặn điểm số không hợp lệ theo quy định | `400 Bad Request` |
| **HORSE-05**| Horse Lifecycle | Xem Lịch sử Đánh giá Thể lực | GET | `/horses/:id/fitness-assessments`| Lưu trữ bản ghi 88 điểm vừa đánh giá | `200 OK` |
| **HORSE-06**| Safety Rule | Vet Kích hoạt Khóa Huấn Luyện | PATCH | `/horses/:id/lock` | Cờ an toàn `locked = true` do chấn thương/nghỉ ngơi | `200 OK` |
| **TRAIN-01**| Safety Check | Tạo lịch tập cho Ngựa bị KHÓA | POST | `/horses/:id/sessions` | **An toàn:** Chặn tạo lịch tập khi có lệnh cấm của bác sĩ | `400 / 409 Rejected`|
| **TRAIN-02**| Training Flow | Tạo buổi tập cho Ngựa Khỏe Mạnh | POST | `/horses/:id/sessions` | Buổi tập mới có trạng thái ban đầu là `PLANNED` | `201 Created` |
| **TRAIN-03**| State Transition| Hoàn thành Buổi tập & Ghi Thành tích| PATCH | `/sessions/:id` | **Chuyển trạng thái:** `PLANNED` $\rightarrow$ `DONE`, lưu `resultValue: 74.2s` | `200 OK` |
| **TRAIN-04**| Training Flow | Dashboard Tiến độ Huấn luyện | GET | `/training/progress/overview` | Tổng hợp báo cáo huấn luyện toàn chuồng | `200 OK` |
| **CARE-01** | Daily Care Flow| Giao việc Chăm sóc Hàng ngày | POST | `/daily-care` | Công việc ban đầu có trạng thái `completed = false` | `201 Created` |
| **CARE-02** | State Transition| Groom Xác nhận Hoàn thành việc | PATCH | `/daily-care/:id/toggle` | **Chuyển trạng thái:** `completed` đổi từ `false` $\rightarrow$ `true` | `200 OK` |
| **CARE-03** | Nutrition Flow | Ghi chép Khẩu phần Thức ăn | POST | `/horses/:id/feeding-records` | Lưu đúng số kg thức ăn và người ghi chép | `201 Created` |
| **CARE-04** | Domain Boundary| Ghi nhận Khẩu phần Ăn số lượng âm | POST | `/horses/:id/feeding-records` | Từ chối khối lượng $\le 0$ | `400 Bad Request` |
| **VET-01**  | Medical Flow | Bác sĩ Tạo Hồ sơ Khám Bệnh | POST | `/horses/:id/health-records` | Bệnh án lưu kết luận `FIT`, chẩn đoán chi tiết | `201 Created` |
| **VET-02**  | Medical Flow | Bác sĩ Lên Lịch Tiêm Vắc xin | POST | `/horses/:id/vaccinations` | Lịch tiêm lưu ngày tiêm và ngày hẹn nhắc lại | `201 Created` |
| **VET-03**  | Business Rule | Tạo Bệnh án Ngày trong Tương lai | POST | `/horses/:id/health-records` | Chặn ngày khám bệnh trong tương lai | `400 Bad Request` |
| **INC-01**  | Incident Flow | Groom Lập Biên bản Sự cố Khẩn | POST | `/horses/:id/incidents` | Sự cố mở với trạng thái `OPEN`, mức độ `MEDIUM` | `201 Created` |
| **INC-02**  | Strict Rule | Đóng Sự cố KHÔNG KÈM Bệnh án | PATCH | `/incidents/:id` | **Chống gian lận y tế:** Bắt buộc có bệnh án mới được đóng | `400 Bad Request` |
| **INC-03**  | State Transition| Bác sĩ Đóng Sự cố kèm Bệnh án | PATCH | `/incidents/:id` | **Chuyển trạng thái:** Chuyển sang `RESOLVED` khi có `healthRecordId` | `200 OK` |
| **RACE-01** | Racing Flow | Manager Khởi tạo Giải Đua Mới | POST | `/races` | Lưu thông số cự ly 1600m, giải thưởng 50 triệu | `201 Created` |
| **RACE-02** | Racing Flow | Đăng ký Ngựa vào Danh sách Đua | POST | `/races/:id/entries` | Ngựa được ghi danh thành công vào giải đấu | `201 Created` |
| **RBAC-01** | Security RBAC | Manager truy cập danh sách Users | GET | `/users` | Quản lý có thẩm quyền xem danh sách nhân sự | `200 OK` |
| **RBAC-02** | Security RBAC | Groom cố tình gọi API Quản trị | GET | `/users` | Chặn nhân viên thường truy cập khu vực quản lý | `403 Forbidden` |
| **RBAC-03** | Security RBAC | Gọi API bảo mật không có Token | GET | `/users` | Chặn truy cập khi thiếu JWT Token | `401 Unauthorized` |
| **RBAC-04** | Security RBAC | Groom cố tình Tạo Ngựa Mới | POST | `/horses` | Chỉ Manager mới có thẩm quyền tạo hồ sơ ngựa | `403 Forbidden` |

---

## 3. HƯỚNG DẪN IMPORT VÀ CHẠY TRÊN POSTMAN

1. **Import file mới vào Postman**:
   - Mở Postman $\rightarrow$ Chọn **Import**.
   - Kéo và thả 2 file:
     - `D:\FALL_2026\SWP_391\racehorse\postman\Racehorse_System_API_Testing.postman_collection.json`
     - `D:\FALL_2026\SWP_391\racehorse\postman\Racehorse_Local.postman_environment.json`
   - Chọn **Replace** nếu Postman hỏi ghi đè.
2. **Kích hoạt Environment**:
   - Ở góc trên cùng bên phải Postman, chọn đúng môi trường: **`Racehorse System - Local Environment`**.
3. **Chạy Collection Runner**:
   - Bấm vào tên Collection $\rightarrow$ Chọn **Run collection** $\rightarrow$ Bấm nút màu xanh **Run Racehorse Management System**.
   - Toàn bộ **31 Test Cases Nghiệp Vụ** (với **63 Assertions**) sẽ chạy tuần tự tự động và đạt **100% PASS (Xanh toàn bộ)**!
