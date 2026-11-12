# Kiểm tra yêu cầu Cường — 03/11/2026

Nhánh: `cuong-work`. Tích hợp `origin/main` tại `d2ba5ee`, giữ các cập nhật mới về huấn luyện, thú y, nhật ký, chăm sóc, phân công và đánh giá thể lực.

| Yêu cầu | Kết quả |
| --- | --- |
| Điều kiện đăng ký giải | API và giao diện chặn ngựa khóa tập, giải nghệ, cách ly, chấn thương; chặn giải đã diễn ra và đóng đăng ký khi còn dưới 72 giờ. Unit test kiểm tra đúng mốc 72 giờ và lệch 1 ms. |
| Trạng thái đăng ký | Có Chưa có kết quả, Đã có kết quả, Rút lui, Không xuất phát. Chuyển về trạng thái không có kết quả sẽ xóa thứ hạng, thời gian và tiền thưởng cũ. |
| Phân trang Giải đua / Tiêm phòng | Lấy từng trang 20 bản ghi; dùng tổng số từ API. Kiểm thử truy cập trang thứ hai sau 100 dòng và không trùng ID. |
| Kết quả Groom | Hiện người nhập; Groom không được xác nhận. HLV có nút xác nhận kết quả đã hoàn thành, giữ nguyên người nhập và số liệu gốc. |
| Farrier | Có loại chăm sóc FARRIER, bộ lọc, form tạo và lịch đến hạn. Nhắc lịch dùng đúng nhãn kiểm tra móng. |
| Báo cáo tài chính | Manager ghi chi phí thực tế; Manager và Owner xem chi phí, tiền thưởng đã ghi nhận, chênh lệch và lọc thời gian. Owner chỉ xem ngựa của mình. |
| Video đua thử | Manager / HLV thêm hoặc xóa liên kết HTTP(S). Owner xem video ngựa của mình trong tab hồ sơ; không được xem ngựa người khác hoặc xóa video. Video trực tiếp, YouTube và Vimeo phát ngay tại trang, không có nút mở sang trang khác. Video nhà cung cấp phải cho phép nhúng; liên kết không phát được hiện thông báo tại chỗ. |

## Xác minh

- Database kiểm thử riêng: `racehorse_cuong_verify_20261103`; áp dụng đủ 20 migration và seed dữ liệu demo.
- Bộ e2e riêng `cuong-features`: **15/15 đạt**, chạy luồng tạo giải → đăng ký → nhập kết quả → xem lịch sử, các điều kiện chặn và phân quyền.
- Toàn bộ API e2e: **14 suite, 211/211 đạt**.
- API unit test: **3 suite, 55/55 đạt**.
- Web i18n: **8/8 đạt**, kiểm tra đủ 5 role, chuyển ngôn ngữ lặp lại, khóa dịch và biến nội suy.
- Sau cập nhật trình phát video tại trang: **11/11 kiểm thử web đạt**, gồm chuyển đổi liên kết YouTube/Vimeo, video trực tiếp, quyền hiển thị Owner và thông báo liên kết không hợp lệ. Build web và lint các file trình phát đạt.
- API và web build thành công. Web lint không có lỗi; còn cảnh báo React và kích thước bundle.
- Database local `racehorse` đã được sao lưu trước khi áp dụng 5 migration còn thiếu của main; không reset hoặc seed đè dữ liệu local.

Đây là kiểm thử API và render giao diện tự động; chưa có kiểm thử thao tác trình duyệt trực tiếp hoặc xác minh phát video từ nhà cung cấp bên ngoài. Các thay đổi chưa được push hoặc triển khai lên production.
