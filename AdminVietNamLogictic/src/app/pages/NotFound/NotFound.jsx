/**
 * Trang 404. Bản gốc định nghĩa inline ngay trong AppRoutes; tách ra file riêng
 * để router chỉ còn việc khai báo đường đi.
 */
import "./NotFound.css";

export default function NotFound() {
  return (
    <div className="app-not-found">
      <div className="app-not-found__inner">
        <h1 className="app-not-found__code">404</h1>
        <p className="app-not-found__message">Không tìm thấy trang bạn yêu cầu.</p>
      </div>
    </div>
  );
}
