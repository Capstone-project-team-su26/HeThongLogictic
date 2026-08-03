import { Link } from "react-router-dom";
import {
  BankOutlined,
  BoxPlotOutlined,
  CarOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import "./AdminPage.css";

const ADMIN_MODULES = [
  { path: "/admin/users", title: "Người dùng", description: "Tài khoản, phân quyền, khóa và mở khóa.", icon: <TeamOutlined />, color: "blue" },
  { path: "/admin/warehouses", title: "Kho vận hành", description: "Kho nguồn, kho đích và trạng thái hoạt động.", icon: <BankOutlined />, color: "cyan" },
  { path: "/admin/warehouse-locations", title: "Sơ đồ vị trí kho", description: "Chỉnh Zone / Shelf / Bin và giới hạn lưu trữ.", icon: <EnvironmentOutlined />, color: "green" },
  { path: "/admin/carriers", title: "Đơn vị vận chuyển", description: "Đối tác vận chuyển và thông tin tích hợp.", icon: <CarOutlined />, color: "purple" },
  { path: "/admin/package-configurations", title: "Cấu hình đóng gói", description: "Kích thước thùng và phí đóng gói.", icon: <BoxPlotOutlined />, color: "orange" },
  { path: "/admin/service-pricings", title: "Bảng giá vận chuyển", description: "Đơn giá theo tuyến và loại dịch vụ.", icon: <DollarOutlined />, color: "gold" },
  { path: "/admin/pricing-rules", title: "Quy tắc phụ phí", description: "Điều kiện và công thức tính phụ phí.", icon: <SettingOutlined />, color: "indigo" },
  { path: "/admin/restricted-items", title: "Hàng cấm, hạn chế", description: "Danh mục kiểm soát hàng hóa xuyên biên giới.", icon: <SafetyCertificateOutlined />, color: "red" },
];

export default function AdminDashboard() {
  return (
    <div className="admin-page admin-dashboard">
      <section className="admin-page__hero admin-dashboard__hero">
        <div>
          <span>VIETNAM LOGISTICS</span>
          <h1>Trung tâm quản trị</h1>
          <p>Quản lý tập trung tài khoản, kho vận hành, đối tác và toàn bộ cấu hình giá.</p>
        </div>
        <div className="admin-dashboard__shield"><SafetyCertificateOutlined /></div>
      </section>

      <section className="admin-dashboard__grid">
        {ADMIN_MODULES.map((module) => (
          <Link key={module.path} to={module.path} className={`admin-module-card is-${module.color}`}>
            <span className="admin-module-card__icon">{module.icon}</span>
            <div>
              <h2>{module.title}</h2>
              <p>{module.description}</p>
            </div>
            <span className="admin-module-card__arrow">→</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
