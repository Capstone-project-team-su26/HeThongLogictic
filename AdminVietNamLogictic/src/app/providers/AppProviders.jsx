/**
 * Gom provider cấp ứng dụng vào một chỗ.
 *
 * Bản gốc để BrowserRouter và reset.css của antd nằm thẳng trong main.jsx.
 * Tách ra đây để main.jsx chỉ còn việc mount, và thêm/bớt provider sau này
 * không phải đụng vào điểm khởi động.
 *
 * ConfigProvider locale vi_VN: mọi component antd (thanh phân trang "20 / trang", "Đến
 * trang", tiêu đề Trang trước/Trang kế, nút lọc của bảng, Empty, Popconfirm...) nói tiếng
 * Việt thay vì "20 / page". ConfigProvider lồng bên trong trang (theme riêng) vẫn thừa
 * hưởng locale này. Không đổi locale toàn cục của dayjs (định dạng ngày giữ nguyên).
 */
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";

import "antd/dist/reset.css";

export default function AppProviders({ children }) {
  return (
    <ConfigProvider locale={viVN}>
      <BrowserRouter>{children}</BrowserRouter>
    </ConfigProvider>
  );
}
