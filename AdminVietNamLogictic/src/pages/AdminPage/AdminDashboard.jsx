import { Link } from "react-router-dom";
import {
  BankOutlined,
  BoxPlotOutlined,
  CarOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  InboxOutlined,
  MonitorOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import "./AdminPage.css";

const ADMIN_MODULES = [
  { path: "/admin/users", title: "Người dùng", description: "Tài khoản, phân quyền, khóa và mở khóa.", icon: <TeamOutlined />, color: "blue" },
  { path: "/admin/consignments", title: "Đơn ký gửi (giám sát)", description: "Theo dõi toàn bộ đơn ký gửi của khách hàng.", icon: <FileSearchOutlined />, color: "purple" },
  { path: "/admin/inventory", title: "Tồn kho (giám sát)", description: "Xem kiện đang lưu kho và master box.", icon: <InboxOutlined />, color: "green" },
  { path: "/admin/wro", title: "Phiếu xuất kho (giám sát)", description: "Theo dõi WRO, trạng thái duyệt và chứng từ.", icon: <MonitorOutlined />, color: "cyan" },
  { path: "/admin/cash-flow", title: "Dòng tiền", description: "Tổng thu, công nợ và tình trạng thanh toán các đơn.", icon: <WalletOutlined />, color: "gold" },
  { path: "/admin/warehouses", title: "Kho vận hành", description: "Kho nguồn, kho đích và trạng thái hoạt động.", icon: <BankOutlined />, color: "cyan" },
  { path: "/admin/warehouse-locations", title: "Sơ đồ vị trí kho", description: "Chỉnh Zone / Shelf / Bin và giới hạn lưu trữ.", icon: <EnvironmentOutlined />, color: "green" },
  { path: "/admin/carriers", title: "Đơn vị vận chuyển", description: "Đối tác vận chuyển và thông tin tích hợp.", icon: <CarOutlined />, color: "purple" },
  { path: "/admin/shipping-methods", title: "Phương thức vận chuyển", description: "Danh mục phương thức vận chuyển nội bộ.", icon: <CarOutlined />, color: "purple" },
  { path: "/admin/shipping-routes", title: "Tuyến vận chuyển", description: "Cấu hình tuyến quốc tế và phương thức giao.", icon: <CarOutlined />, color: "purple" },
  { path: "/admin/suppliers", title: "Nhà cung cấp", description: "Đối tác trung chuyển và lấy hàng.", icon: <BoxPlotOutlined />, color: "orange" },
  { path: "/admin/product-types", title: "Loại hàng", description: "Danh mục loại hàng và thuế nhập khẩu.", icon: <BoxPlotOutlined />, color: "orange" },
  { path: "/admin/units-of-measure", title: "Đơn vị tính", description: "Danh mục đơn vị tính cho khai báo hàng.", icon: <BoxPlotOutlined />, color: "orange" },
  { path: "/admin/package-configurations", title: "Cấu hình đóng gói", description: "Kích thước thùng và phí đóng gói.", icon: <BoxPlotOutlined />, color: "orange" },
  { path: "/admin/service-pricings", title: "Bảng giá vận chuyển", description: "Đơn giá theo tuyến và loại dịch vụ.", icon: <DollarOutlined />, color: "gold" },
  { path: "/admin/exchange-rates", title: "Bảng giá tiền tệ", description: "Tỷ giá ngoại tệ quy đổi sang VND (CRUD).", icon: <DollarOutlined />, color: "gold" },
  { path: "/admin/pricing-rules", title: "Quy tắc phụ phí", description: "Điều kiện và công thức tính phụ phí.", icon: <SettingOutlined />, color: "indigo" },
  { path: "/admin/additional-service-fees", title: "Phí bổ sung", description: "Các khoản phí dịch vụ bổ sung.", icon: <SettingOutlined />, color: "indigo" },
  { path: "/admin/restricted-items", title: "Hàng cấm, hạn chế", description: "Danh mục kiểm soát hàng hóa xuyên biên giới.", icon: <SafetyCertificateOutlined />, color: "red" },
];

export default function AdminDashboard() {
  return (
    <div className="admin-page admin-dashboard">
      <section className="admin-page__hero admin-dashboard__hero">
        <div>
          <span>VIETNAM LOGISTICS</span>
          <h1>Trung tâm quản trị</h1>
          <p>Quản lý tài khoản, cấu hình giá và giám sát đơn ký gửi, tồn kho, dòng tiền.</p>
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
