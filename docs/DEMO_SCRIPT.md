# Kịch bản demo — Racehorse Training & Management System

> Dành cho nhóm 2 chuẩn bị và trình bày demo. Cập nhật 12/11/2026.
> Hiểu code để trả lời câu hỏi: xem [SOURCE_GUIDE.md](SOURCE_GUIDE.md).

## Nguyên tắc chọn tính năng

Cô dặn **né CRUD** (thêm / sửa / xóa / xem danh sách). Vì vậy demo chỉ chọn những chỗ thể hiện **nghiệp vụ**:

- **Hệ thống tự phản ứng**: báo sự cố HIGH → ngựa tự khóa, bác sĩ tự nhận thông báo; buổi tập quá hạn tự thành "bị lỡ".
- **Quy tắc chặn sai**: không xếp buổi tập cho ngựa bị khóa, không mở khóa khi thể lực < 80, không đăng ký giải khi chưa đủ điều kiện, hai buổi tập phải cách nhau 60 phút.
- **Nhiều vai trò phối hợp trên cùng một con ngựa**: groom → bác sĩ → huấn luyện viên → chủ ngựa.
- **Dữ liệu tổng hợp có ý nghĩa**: tiến độ giáo án theo buổi, việc cần làm theo vai trò, báo cáo tháng cho chủ ngựa.

| Đưa vào demo | Không demo (CRUD hoặc phụ) |
|---|---|
| Luồng chấn thương: báo sự cố → tự khóa → khám → chấm thể lực → đóng sự cố → tự mở khóa | Thêm / sửa / xóa hồ sơ ngựa, giải đua, vật tư |
| Luồng huấn luyện: tiến độ theo buổi, trễ hạn, ghi kết quả, chặn trùng giờ, điều kiện thi đấu | Danh sách ngựa, tìm kiếm, phân trang |
| Luồng chủ ngựa: báo cáo tháng, chỉ thấy ngựa của mình | Đăng ký / quên mật khẩu, đổi ngôn ngữ |
| (Dự phòng) Duyệt khử trùng ô chuồng, AI phân tích sức khỏe | Phả hệ, tiêm phòng, nhật ký hệ thống |

**Thời lượng mục tiêu: khoảng 15 phút**, rồi hỏi đáp. Nếu thiếu thời gian, ưu tiên theo thứ tự: Cảnh 1 → Cảnh 2 → Cảnh 3 → Cảnh 4.

---

## 1. Dữ liệu dùng trong demo (đã có trên production)

| Vai trò trong kịch bản | Ngựa / dữ liệu | Vì sao chọn |
|---|---|---|
| Ngựa bị chấn thương (Cảnh 1) | **Northern Star** (Owner One, khỏe, chưa khóa) | Đang khỏe nên thấy rõ thay đổi; thuộc Owner One nên chủ ngựa xem được ở Cảnh 3 |
| Ngựa ghi kết quả buổi tập (Cảnh 2) | **Iron Hoof**, giáo án "Phát triển sức bền cự ly 2000m" (đến 11/12) | Có giáo án đang chạy; cần **chuẩn bị trước 1 buổi tập** (xem mục 2) |
| Ngựa đăng ký giải được (Cảnh 2) | **Thunderbolt** (thể lực 84, giáo án 6/6) → giải **Cúp Mùa Đông Phú Thọ** (18/12) | Đủ điều kiện và chưa đăng ký giải này |
| Ngựa không đăng ký được (Cảnh 2) | **Iron Hoof** (giáo án 6/10), **Dark Raven** (thể lực 74), **Black Pearl** (đang khóa) | Mỗi con một lý do khác nhau |
| Báo cáo tháng (Cảnh 3) | **Golden Arrow** (Owner One): chi phí ăn, giáo án 6/6, thể lực 86, ảnh, lịch sử thi đấu | Dữ liệu đầy đủ nhất |
| Ngựa của chủ khác (Cảnh 3) | **Crimson Blaze** (Owner Two) | Chứng minh Owner One không xem được |

Tài khoản (mật khẩu `<Role>123!`): `manager@`, `trainer@`, `vet@`, `groom@`, `owner1@` … `@racehorse.local`.

---

## 2. Chuẩn bị & test trước

### Hôm trước (bắt buộc)

- [ ] **Chạy kiểm thử tự động** trên máy local (API local đang chạy):
  ```bash
  node apps/api/scripts/demo-rehearsal.mjs
  ```
  Phải ra **24/24 bước PASS**. Script đi lại đúng các quy tắc của kịch bản: tự khóa khi sự cố HIGH, chặn trùng giờ 60 phút, groom không ghi kết quả được, không ghi kết quả trước giờ tập, chặn đăng ký giải, thể lực 70 không mở khóa được, đóng sự cố tự mở khóa, chủ khác bị 403, duyệt khử trùng ô chuồng…
- [ ] **Đi thử toàn bộ kịch bản 1 lần trên production** bằng một ngựa khác (vd. **Desert Wind** thay cho Northern Star) để quen thao tác và biết mỗi bước mất bao lâu. **Quay màn hình lần đi thử này** làm video dự phòng.
- [ ] **Chuẩn bị buổi tập cho bước ghi kết quả** (vì chỉ ghi được kết quả **sau giờ tập** và **trong 24 giờ**):
  - Trong khoảng 2–20 giờ trước giờ demo, đăng nhập **trainer** → Ngựa **Iron Hoof** → tab *Buổi tập* → *Xếp buổi tập*.
  - Chọn giáo án "Phát triển sức bền cự ly 2000m", giờ = **giờ bắt đầu demo − 30 phút**, loại "Chạy bền", cự ly 2000 m.
  - Khi demo, buổi này đã qua giờ và đang chờ ghi kết quả.
- [ ] Chuẩn bị sẵn **1 ảnh chân ngựa bị thương** (JPEG/PNG ≤ 5 MB) trên máy để đính kèm sự cố.

### 30 phút trước

- [ ] Mở web để **đánh thức máy chủ Render** (gói miễn phí ngủ khi không dùng, lần đầu mất 30–60 giây). Mở trang Giải đua thấy dữ liệu là được.
- [ ] Mở **5 cửa sổ trình duyệt độc lập**, mỗi cửa sổ đăng nhập một vai trò. Token lưu trong localStorage nên **mỗi vai trò phải là một trình duyệt hoặc một cửa sổ ẩn danh riêng**:

  | Cửa sổ | Vai trò | Mở sẵn trang |
  |---|---|---|
  | Chrome | Groom | Sự cố y tế |
  | Chrome ẩn danh | Bác sĩ (Vet) | Tổng quan |
  | Edge | Huấn luyện viên | Giáo án huấn luyện |
  | Edge InPrivate | Quản lý | Tổng quan |
  | Firefox | Owner One | Báo cáo tháng |

- [ ] Phóng to trình duyệt 110–125% cho người xem dễ nhìn. Tắt thông báo hệ điều hành.

### Nếu có sự cố khi demo

- Máy chủ chậm hoặc lỗi kết nối: web sẽ báo "Máy chủ có thể đang khởi động" → đợi 30 giây rồi thử lại. Không được thì chiếu **video đi thử**.
- Lỡ thao tác sai: tiếp tục bằng ngựa dự phòng **Desert Wind** hoặc **Silver Mist**.

---

## 3. Kịch bản chi tiết

### Mở đầu (1 phút) — Quản lý

| Thao tác | Nói |
|---|---|
| Trang **Tổng quan** của quản lý | "Hệ thống phục vụ 5 vai trò cùng làm việc trên dữ liệu của từng con ngựa. Mỗi người đăng nhập thấy menu và việc cần làm của riêng mình." |
| Chỉ vào ô **Việc cần làm** | "Các con số này được đếm từ dữ liệu thật: tài khoản chờ duyệt, giáo án trễ hạn, sự cố mức cao…" |

### Cảnh 1 — Luồng chấn thương (5 phút)

**Ý chính:** một sự cố do groom báo sẽ tự kích hoạt cả chuỗi xử lý, và chỉ bác sĩ, với đủ căn cứ y tế, mới cho ngựa tập lại.

| # | Vai trò | Thao tác | Kết quả cần thấy | Nói |
|---|---|---|---|---|
| 1 | Groom | *Sự cố y tế* → báo sự cố: ngựa **Northern Star**, mức độ **Nặng**, mô tả "Đi khập khiễng chân trước trái sau buổi tập", đính kèm ảnh → Gửi | Sự cố xuất hiện đầu bảng, có ảnh | "Groom là người gần ngựa nhất, phát hiện bất thường thì báo ngay kèm ảnh." |
| 2 | Bác sĩ | Bấm **chuông thông báo**; nhìn *Việc cần làm* | Có thông báo sự cố mới của Northern Star; số "sự cố chưa xử lý" tăng | "Mọi bác sĩ nhận thông báo ngay, không cần ai gọi điện." |
| 3 | Bác sĩ | Mở trang ngựa **Northern Star** | Dòng trạng thái **Bị khóa tập — Sự cố: …**, sức khỏe chuyển **Chấn thương** | "Sự cố mức cao làm ngựa **tự động bị khóa tập** để không ai cho ngựa tập tiếp." |
| 4 | HLV | Mở Northern Star → tab *Buổi tập* và *Giáo án* | Không có nút xếp buổi / lập giáo án, hiện thông báo ngựa đang khóa | "HLV không thể xếp lịch cho ngựa đang khóa. Server cũng chặn, không chỉ ẩn nút." |
| 5 | HLV | *Giải đua* → bảng **Ngựa sẵn sàng thi đấu** | Northern Star ở nhóm *Chưa đủ điều kiện*, lý do "đang bị khóa tập" | "Ngựa bị khóa cũng không thể đăng ký thi đấu." |
| 6 | Bác sĩ | Northern Star → tab *Hồ sơ y tế* → **Ghi nhận khám bệnh**: chẩn đoán "Viêm gân nhẹ, đã hồi phục", kết luận **Khỏe mạnh** | Hồ sơ khám mới | "Muốn cho tập lại phải có căn cứ khám." |
| 7 | Bác sĩ | Bấm **Chấm điểm thể lực**, chấm mỗi tiêu chí **14** (tổng **70**) → Lưu | Điểm thể lực 70 | "Thể lực chấm theo 5 tiêu chí, mỗi tiêu chí 20 điểm." |
| 8 | Bác sĩ | Bấm **Mở khóa tập** | Modal báo "Lần gần nhất: 70/100", yêu cầu **≥ 80**, **nút xác nhận bị khóa** | "Khám khỏe rồi nhưng thể lực chưa đạt 80 thì vẫn chưa được tập lại." |
| 9 | Bác sĩ | Trong modal bấm *Chấm điểm thể lực*, chấm mỗi tiêu chí **17** (tổng **85**) → đóng modal | Điểm mới 85 | |
| 10 | Bác sĩ | *Sự cố y tế* → sự cố Northern Star → **Đóng sự cố** → chọn hồ sơ khám vừa tạo → bấm **Đóng sự cố** | Sự cố *Đã xử lý*, ngựa **tự mở khóa** | "Đóng sự cố bắt buộc gắn hồ sơ khám. Vì chính sự cố này gây ra khóa, khám kết luận khỏe và thể lực 85, hệ thống tự mở khóa." |
| 11 | Bác sĩ | Northern Star → *Hồ sơ y tế* → mục **Lịch sử khóa tập** | 2 dòng: khóa (lý do sự cố) và mở (ai mở, căn cứ hồ sơ khám nào) | "Mọi lần khóa/mở đều truy vết được." |

### Cảnh 2 — Luồng huấn luyện → thi đấu (5 phút)

**Ý chính:** tiến độ đo bằng buổi tập thật, kết quả phải ghi đúng lúc, và chỉ ngựa đủ điều kiện mới được thi đấu.

| # | Vai trò | Thao tác | Kết quả cần thấy | Nói |
|---|---|---|---|---|
| 1 | HLV | *Giáo án huấn luyện* → bấm lần lượt bộ lọc **Đang thực hiện / Trễ hạn / Hoàn thành** | Cột tiến độ dạng "6/9 buổi", "3 buổi bị lỡ", cảnh báo cự ly mục tiêu | "Giáo án chỉ hoàn thành khi **mọi buổi tập đều xong**, không phải cứ hết ngày là xong. Quá hạn thì báo trễ cho quản lý." |
| 2 | HLV | Ngựa **Iron Hoof** → tab *Buổi tập* → buổi đã chuẩn bị (qua giờ 30 phút) → **Ghi kết quả** | Form có 3 chỉ số: thời gian về đích, nhịp tim hồi phục, phản ứng cơ | "Chỉ HLV ghi kết quả, trong vòng 24 giờ sau giờ tập. Quá 24 giờ hệ thống tự đánh dấu *bị lỡ*." |
| 3 | HLV | Chọn *Hoàn thành* nhưng **để trống** cả 3 chỉ số → Lưu | Báo lỗi "cần ít nhất một kết quả" | "Không cho hoàn thành buổi tập mà không có kết quả." |
| 4 | HLV | Nhập thời gian 128.5 s, nhịp tim 64, phản ứng cơ *Bình thường* → Lưu | Buổi chuyển **Hoàn thành**, hiện đủ kết quả; tiến độ giáo án tăng | |
| 5 | HLV | Bấm *Cập nhật* trên một buổi **chưa tới giờ** | Ô trạng thái **không có lựa chọn "Hoàn thành"** | "Buổi chưa diễn ra thì không thể ghi kết quả. Server cũng chặn." |
| 6 | HLV | *Xếp buổi tập* cho Iron Hoof lúc **hôm nay + 3 giờ** → Lưu. Xếp tiếp một buổi **cách 30 phút** | Buổi thứ 2 bị từ chối: "hai buổi tập phải cách nhau ít nhất 60 phút" | "Một con ngựa không thể có 2 buổi tập sát nhau (quy tắc EX-01)." |
| 7 | HLV | *Giải đua* → bảng **Ngựa sẵn sàng thi đấu** → lọc *Chưa đủ điều kiện* | Mỗi ngựa có lý do: Iron Hoof "giáo án chưa hoàn thành (6/10 buổi)", Dark Raven "điểm thể lực 74/100, cần từ 80", Black Pearl "đang bị khóa tập" | "Điều kiện thi đấu: giáo án gần nhất hoàn thành, thể lực bác sĩ chấm ≥ 80, không bị khóa." |
| 8 | HLV | Chọn giải **Cúp Mùa Đông Phú Thọ** → mục **Ghi danh ngựa** → mở danh sách | Thunderbolt chọn được; ngựa chưa đủ điều kiện bị **làm mờ kèm lý do** | |
| 9 | HLV | Chọn **Thunderbolt** → **Ghi danh** | Thunderbolt vào danh sách ghi danh | "Server kiểm tra lại điều kiện khi đăng ký, gọi thẳng API cũng không lách được." |
| 10 | Quản lý | *Tổng quan* → thẻ **Huấn luyện viên trễ giáo án** | Tên HLV, số giáo án trễ, tiến độ từng ngựa | "Quản lý thấy ngay HLV nào đang chậm để nhắc nhở." |

### Cảnh 3 — Minh bạch cho chủ ngựa (3 phút)

**Ý chính:** chủ ngựa trả tiền nên thấy được ai khám, ăn gì, tốn bao nhiêu, tập ra sao, nhưng **chỉ với ngựa của mình**.

| # | Vai trò | Thao tác | Kết quả cần thấy | Nói |
|---|---|---|---|---|
| 1 | Owner One | *Tổng quan* | Chỉ thấy ngựa của Owner One | |
| 2 | Owner One | *Báo cáo tháng* → ngựa **Golden Arrow**, tháng hiện tại | Chi phí thức ăn (tổng + theo từng loại), giáo án 6/6 buổi đã đạt cự ly 2000 m, thể lực 86 do bác sĩ chấm, HLV và người chăm sóc, lịch sử thi đấu, ảnh buổi tập | "Chi phí mỗi bữa = số kg × đơn giá trong kho, groom ghi bữa nào là trừ kho và tính tiền bữa đó." |
| 3 | Owner One | Đổi sang **tháng 10** | Nhiều ảnh buổi tập và bữa ăn hơn; bấm một ảnh để phóng to | |
| 4 | Owner One | Đổi sang ngựa **Northern Star** (tháng hiện tại) | Thấy sự cố vừa xảy ra ở Cảnh 1, hồ sơ khám, tên bác sĩ đã khám | "Chủ ngựa thấy ngay ngựa mình vừa gặp chuyện gì và được xử lý ra sao." |
| 5 | Owner One | Bấm **In / lưu PDF** | Hộp thoại in của trình duyệt | |
| 6 | Owner One | *Sơ đồ chuồng trại* | Ngựa của chủ khác hiện "Ngựa khác (Bảo mật)", không có nút thao tác | |
| 7 | Owner One | Dán link trang ngựa **Crimson Blaze** (của Owner Two; lấy link từ cửa sổ quản lý) | Báo **không có quyền** | "Chặn ở server: mọi API theo ngựa đều kiểm tra chủ sở hữu." |

### Cảnh 4 — Dự phòng, nếu còn thời gian (2 phút)

Chọn **một** trong hai:

- **An toàn sinh học ô chuồng:** Groom → *Sơ đồ chuồng trại* → ô trống → *Đổi trạng thái* → **Khử trùng** (ghi chú "Khử trùng sau ca bệnh"). Bác sĩ → cùng ô → **Xác nhận duyệt**. Kết quả: ô chuyển *Khử trùng*, quản lý nhận thông báo. Nói: "Đổi trạng thái an toàn sinh học phải có người thứ hai duyệt."
- **AI phân tích sức khỏe:** Bác sĩ → ngựa **Golden Arrow** → tab *Hồ sơ y tế* → thẻ *Trợ lý AI — phân tích rủi ro sức khỏe* → **Phân tích ngay** (mất khoảng 8 giây). Kết quả: tóm tắt rủi ro (vd. sự cố sưng khớp gối còn mở nhưng vẫn tập cường độ cao) và khuyến nghị. Nói: "AI chỉ gợi ý tham khảo; khi có sự cố mức trung bình/cao, AI tự phân tích và báo nếu rủi ro cao."

### Kết (30 giây)

"Ba luồng bắt buộc chạy xuyên suốt nhiều vai trò: sự cố → khóa → khám → mở khóa; giáo án → kết quả → điều kiện thi đấu; và chủ ngựa theo dõi minh bạch qua báo cáo tháng. Mọi quy tắc đều kiểm tra ở server và có test tự động (205 e2e test)."

---

## 4. Câu hỏi dễ gặp ngay sau demo

| Câu hỏi | Trả lời ngắn |
|---|---|
| Nếu HLV gọi thẳng API để xếp buổi cho ngựa bị khóa? | Server trả 400 "Horse training is locked". Phân quyền và quy tắc nằm ở API, web chỉ ẩn nút. |
| Sự cố mức thấp có khóa ngựa không? | Không tự khóa. Bác sĩ xem rồi tự quyết khóa thủ công (vẫn cần lý do). |
| Buổi tập bị lỡ thì giáo án ra sao? | Không hoàn thành được nữa (quyết định của nhóm), HLV lập giáo án mới. Quá ngày kết thúc thì báo trễ cho quản lý. |
| Ai sửa được điểm thể lực? | Chỉ bác sĩ, qua phiếu 5 tiêu chí. Quản lý cũng không sửa tay. |
| Sao ngựa đang có sự cố mức trung bình vẫn "sẵn sàng thi đấu"? | Điều kiện thi đấu hiện xét khóa tập, giáo án và thể lực. Sự cố mức trung bình không tự khóa; bác sĩ quyết định có khóa hay không. AI sẽ cảnh báo rủi ro (như ví dụ Golden Arrow). |
| Mở web lần đầu sao chậm? | Máy chủ Render miễn phí tự ngủ, khởi động lại mất 30–60 giây. |

Câu hỏi về code và kiến trúc: xem [SOURCE_GUIDE.md §14](SOURCE_GUIDE.md#14-câu-hỏi-thường-gặp-khi-vấn-đáp).
