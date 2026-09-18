/**
 * Gom provider cấp ứng dụng vào một chỗ.
 *
 * Bản gốc để BrowserRouter và reset.css của antd nằm thẳng trong main.jsx.
 * Tách ra đây để main.jsx chỉ còn việc mount, và thêm/bớt provider sau này
 * không phải đụng vào điểm khởi động.
 */
import { BrowserRouter } from "react-router-dom";

import "antd/dist/reset.css";

export default function AppProviders({ children }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}
