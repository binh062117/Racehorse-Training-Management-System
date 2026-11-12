# Cường — giải đua, chăm sóc và báo cáo

## Hành vi

- Đăng ký giải bị chặn nếu ngựa bị khóa, giải nghệ, cách ly hoặc chấn thương; giải đã bắt đầu; hoặc còn dưới 72 giờ đến thời điểm đua. Đúng mốc 72 giờ vẫn được đăng ký. Ngày tạo giải từ web dùng múi giờ Việt Nam.
- Mỗi đăng ký có trạng thái `PENDING`, `COMPLETED`, `WITHDRAWN`, `DID_NOT_START`. Chuyển về chưa có kết quả/rút lui/không xuất phát sẽ xóa thứ hạng, thời gian và tiền thưởng cũ. Trạng thái hoàn tất cần ít nhất thứ hạng hoặc thời gian.
- Giải đua và lịch chăm sóc tải từng trang 20 dòng. Tìm kiếm/lọc thực hiện trước khi phân trang; danh sách ngựa để chọn tải đủ các trang. Thứ tự có khóa phụ `id` để các bản ghi cùng ngày không bị lặp giữa các trang.
- Kết quả tập lưu người nhập. Groom nhập xong thì chờ HLV xác nhận; HLV xác nhận bằng một yêu cầu riêng, không sửa số liệu hoặc thay tên người nhập. Kết quả HLV tự nhập được xác nhận ngay. Dữ liệu cũ thiếu người nhập được hiển thị rõ là chưa ghi nhận.
- Farrier dùng chung lịch chăm sóc với tiêm phòng/tẩy giun, có bộ lọc riêng và ngày kiểm tra tiếp theo. VET nhập lịch theo phân quyền hiện có.
- `/reports/finances`: Manager và Chủ ngựa xem tổng tiền thưởng, chi phí, chênh lệch và các khoản chi tiết, lọc theo ngựa/thời gian. Chủ ngựa chỉ xem ngựa thuộc sở hữu hiện tại. Manager nhập chi phí thực tế; tiền thưởng lấy từ trường `prizeWon` của kết quả hoàn tất, không suy ra từ tổng quỹ thưởng. Đơn vị VNĐ. Dữ liệu chưa nhập không được ước tính.
- Tab **Video đua thử** trong hồ sơ ngựa: Manager/Trainer thêm hoặc xóa đường dẫn HTTP/HTTPS; Chủ ngựa xem video của ngựa mình. MP4/WebM/OGG phát trong trang; các nguồn khác mở ở tab mới. Nguồn video phải cho phép người xem truy cập đường dẫn đó.

## Cơ sở dữ liệu

Giữ nguyên migration đã có `20261031110503_add_features_sprint`. Hai migration bổ sung:

- `20261031120000_horse_expenses`: lưu các khoản chi thực tế, không đổi/xóa bảng cũ.
- `20261031121000_backfill_race_status`: chuyển các đăng ký cũ có thứ hạng/thời gian sang `COMPLETED`, giữ nguyên kết quả.

Trên môi trường nhận code, chạy trong `apps/api`:

```powershell
npx prisma migrate deploy
npx prisma generate
```

Không đổi tên hoặc sửa nội dung migration đã được áp dụng. Không cần thêm dependency ứng dụng.

## Kiểm tra

- API build và web build thành công.
- API E2E: 13 suite, 186 test qua; có `test/cuong-features.e2e-spec.ts` kiểm tra luồng giải đua, điều kiện chặn, phân trang qua dòng 100, Farrier, xác nhận Groom, báo cáo và quyền xem video.
- Unit test: 3 ca qua, kiểm tra đúng mốc 72 giờ và lệch 1 ms.
- ESLint các module API liên quan qua. Web lint không có lỗi, còn cảnh báo có sẵn của dự án.
- Trình duyệt headless: tạo giải qua form, chuyển trang tới dòng 101, đăng ký ngựa, nhập kết quả, xem lịch sử; nhập chi phí; HLV xác nhận; Owner xem báo cáo/video và bị chặn với ngựa khác; lịch Farrier. Đã xem giao diện desktop và tab video trên màn hình 390 px. Dữ liệu thử được dọn sau khi kiểm tra.
- Bộ `apps/web/test/i18n.test.mjs` có sẵn trong workspace: 2/7 qua, 5 lỗi. Chạy cùng bộ test trên bản `HEAD` trong worktree tạm cũng cho đúng 5 lỗi đó (HTML lang, khóa LanguageSwitcher, nội dung AuthLayout, bodyZoneLabel, ErrorText). Không sửa lẫn phần này.

## Phạm vi để review/merge

Nhánh làm việc: `feat/cuong-race-care-reports`, bắt đầu từ `dfccb3d`. Sau khi fetch, `HEAD` cùng mốc `origin/main`; không có conflict marker và `git diff --check` qua. Chưa commit/push/merge.

Các thay đổi có sẵn của workspace được giữ lại. `apps/web/src/components/LanguageSwitcher.tsx`, `apps/web/test/i18n.test.mjs` và thay đổi ban đầu ở `migration_lock.toml` không thuộc phần triển khai này. Khi chọn file để commit, kiểm tra riêng các file đó.

Phần dùng chung cần review cùng nhóm: `schema.prisma`, `app.module.ts`, `main.tsx`, `AppShell.tsx`, `lib/types.ts`, hai file ngôn ngữ, `Pagination` và `useCachedResource`. Thay đổi cache bỏ qua phản hồi cũ khi người dùng đổi trang/bộ lọc nhanh; không thay API của hook. Các màn hình mới nằm ở file riêng để giảm phần sửa chồng nhau.
