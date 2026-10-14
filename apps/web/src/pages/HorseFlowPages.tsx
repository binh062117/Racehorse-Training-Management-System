import { HorsesPage } from './HorsesPage';

// File này đóng vai trò như "barrel export" cho các page của flow Horse.
// Mục đích là giữ import ổn định ở nơi khác dù các component đã được tách ra thành module nhỏ hơn.
export { HorseFormPage } from './horse/HorseFormPage';
export { HorseOwnershipPage } from './horse/HorseOwnershipPage';
export { HorseRaceHistoryPage } from './horse/HorseRaceHistoryPage';
export { HorseRecordNav } from './horse/HorseRecordNav';

export function MyHorsesPage() {
  // Trang "My Horses" dùng lại component danh sách ngựa nhưng chỉ hiển thị các ngựa thuộc quyền sở hữu của user.
  return <HorsesPage personal />;
}
