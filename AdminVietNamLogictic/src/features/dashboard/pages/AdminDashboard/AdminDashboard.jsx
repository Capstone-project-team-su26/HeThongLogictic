import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Spin } from "antd";
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
  ReloadOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { getAdminDashboardApi } from "@features/dashboard/api/dashboardService";
import {
  BarList,
  ChartCard,
  ColumnChart,
  StatTile,
} from "@features/dashboard/components/DashboardCharts";
import {
  formatCompactVnd,
  formatCount,
  formatMonthLabel,
  formatVnd,
} from "@features/dashboard/components/dashboardFormat";
import "@features/admin/styles/AdminPage.css";

/*
 * Trung tâm quản trị: phần tổng quan đọc từ GET /api/admin/dashboard (chỉ Admin, backend tự
 * đếm/cộng). Ba số phải thu / đã thu / còn nợ lấy nguyên từ tổng quan Dòng tiền nên khớp trang
 * /admin/cash-flow; "tiền thực thu" cộng thẳng từng khoản đã vào tài khoản theo ngày thu.
 * Các lối tắt module giữ nguyên, dời xuống dưới.
 */
const ORDER_SERIES = [
  { key: "consignmentCount", label: "Ký gửi" },
  { key: "purchaseCount", label: "Mua hộ" },
];

const MONEY_SERIES = [
  { key: "consignment", label: "Ký gửi" },
  { key: "purchase", label: "Mua hộ" },
];

/* Trạng thái nhiều nhất trước; phần đuôi gộp "Khác" để thẻ không dài quá. */
const topStatuses = (rows, limit = 7) => {
  const head = rows.slice(0, limit);
  const tail = rows.slice(limit);
  const tailCount = tail.reduce((sum, row) => sum + row.count, 0);
  const tailPercent = tail.reduce((sum, row) => sum + row.percent, 0);
  const list = head.map((row) => ({
    key: row.key,
    label: row.label,
    value: row.count,
    valueText: `${formatCount(row.count)} (${row.percent}%)`,
  }));
  if (tailCount > 0) {
    list.push({
      key: "__OTHER__",
      label: `Khác (${tail.length} trạng thái)`,
      value: tailCount,
      valueText: `${formatCount(tailCount)} (${tailPercent}%)`,
      title: tail.map((row) => `${row.label}: ${row.count}`).join("\n"),
    });
  }
  return list;
};

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
  { path: "/admin/restricted-items", title: "Hàng cấm, hạn chế", description: "Danh mục kiểm soát hàng hóa xuyên biên giới.", icon: <SafetyCertificateOutlined />, color: "red" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /* Không setState đồng bộ trong effect: mọi cập nhật nằm trong callback của promise. */
  const fetchStats = useCallback(
    () =>
      getAdminDashboardApi()
        .then((data) => {
          setStats(data);
          setFailed(false);
        })
        .catch(() => setFailed(true))
        .finally(() => setLoading(false)),
    [],
  );

  const load = useCallback(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

      <div style={{ display: "flex", justifyContent: "flex-end", margin: "16px 0 8px" }}>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading}>
          Làm mới số liệu
        </Button>
      </div>

      {failed && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="Không tải được số liệu tổng quan." />
      )}

      <Spin spinning={loading}>{stats ? <AdminStats stats={stats} /> : <div style={{ minHeight: 80 }} />}</Spin>

      <h2 className="dash-section__title" style={{ margin: "8px 0 12px" }}>Lối tắt quản trị</h2>
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

/* ───────────────────────── Tổng quan số liệu ───────────────────────── */

function AdminStats({ stats }) {
  const { users, orders, finance, stock } = stats;

  return (
    <div className="dash-section">
      <div className="dash-stats">
        <StatTile
          label="Người dùng"
          value={formatCount(users.total)}
          hint={`${formatCount(users.active)} đang hoạt động · ${formatCount(users.newLast30Days)} mới 30 ngày`}
        />
        <StatTile
          label="Đơn đang xử lý"
          value={formatCount(orders.consignmentInProgress + orders.purchaseInProgress)}
          hint={`${formatCount(orders.consignmentInProgress)} ký gửi · ${formatCount(orders.purchaseInProgress)} mua hộ`}
        />
        <StatTile
          label="Tiền thực thu"
          value={formatCompactVnd(finance.collectedTotal)}
          title={formatVnd(finance.collectedTotal)}
          hint={`Ký gửi ${formatCompactVnd(finance.consignmentCollected)} · mua hộ ${formatCompactVnd(finance.purchaseCollected)}`}
        />
        <StatTile
          label="Còn phải thu (theo đơn)"
          value={formatCompactVnd(finance.remaining)}
          title={formatVnd(finance.remaining)}
          hint={`${formatCount(finance.unpaidOrderCount)} đơn chưa trả · ${formatCount(finance.partialOrderCount)} trả một phần`}
        />
        <StatTile
          label="Khoản chờ đối soát"
          value={formatCount(finance.pendingApprovalCount)}
          hint="Chờ Admin xác nhận ở trang Dòng tiền"
          tone={finance.pendingApprovalCount > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Tồn kho"
          value={`${formatCount(stock.storedParcels)} kiện`}
          hint={`${stock.occupancyPercent}% ô kệ có hàng · ${formatCount(stats.openIncidents)} sự cố mở`}
        />
      </div>

      <div className="dash-grid-2">
        <ChartCard title="Đơn tạo mới 6 tháng" subtitle="Ký gửi và yêu cầu mua hộ theo tháng (giờ Việt Nam)">
          <ColumnChart
            data={orders.last6Months}
            xKey="month"
            xLabel={formatMonthLabel}
            series={ORDER_SERIES}
            ariaLabel="Số đơn tạo mới theo tháng"
          />
        </ChartCard>

        <ChartCard title="Tiền thực thu 6 tháng" subtitle="Khoản đã vào tài khoản, theo ngày thu">
          <ColumnChart
            data={finance.collectedLast6Months}
            xKey="month"
            xLabel={formatMonthLabel}
            series={MONEY_SERIES}
            format={formatCompactVnd}
            ariaLabel="Tiền thực thu theo tháng"
          />
        </ChartCard>
      </div>

      <div className="dash-grid-3">
        <ChartCard
          title="Đơn ký gửi theo trạng thái"
          subtitle={`${formatCount(orders.consignmentTotal)} đơn · ${formatCount(orders.consignmentCompleted)} hoàn tất`}
        >
          <BarList rows={topStatuses(orders.consignmentByStatus)} />
        </ChartCard>

        <ChartCard
          title="Mua hộ theo trạng thái"
          subtitle={`${formatCount(orders.purchaseTotal)} yêu cầu · ${formatCount(orders.purchaseCompleted)} hoàn tất`}
        >
          <BarList rows={topStatuses(orders.purchaseByStatus)} color="#eb6834" />
        </ChartCard>

        <ChartCard title="Người dùng theo vai trò" subtitle="Tổng / đang hoạt động">
          <BarList
            rows={users.byRole.map((row) => ({
              key: row.key,
              label: row.label,
              value: row.count,
              valueText: `${formatCount(row.count)} (${formatCount(row.active)} hoạt động)`,
            }))}
            color="#1baf7a"
          />
        </ChartCard>
      </div>

      <div className="dash-grid-2">
        <ChartCard title="Dòng tiền theo đơn" subtitle="Cùng số với trang Dòng tiền">
          <table className="dash-table">
            <tbody>
              <tr>
                <td>Tổng phải thu</td>
                <td><strong>{formatVnd(finance.totalBillAmount)}</strong></td>
              </tr>
              <tr>
                <td>Đã thu</td>
                <td><strong>{formatVnd(finance.totalPaid)}</strong></td>
              </tr>
              <tr>
                <td>Còn nợ</td>
                <td><strong>{formatVnd(finance.remaining)}</strong></td>
              </tr>
              <tr>
                <td>Số đơn: đã trả đủ / một phần / chưa trả</td>
                <td>
                  {formatCount(finance.paidOrderCount)} / {formatCount(finance.partialOrderCount)} /{" "}
                  {formatCount(finance.unpaidOrderCount)}
                </td>
              </tr>
              <tr>
                <td>Mua hộ: tiền đang chờ hoàn khách</td>
                <td><strong>{formatVnd(finance.purchaseRefundPending)}</strong></td>
              </tr>
            </tbody>
          </table>
        </ChartCard>

        <ChartCard title="Tồn kho theo kho" subtitle="Kiện đang nằm trên ô kệ">
          <BarList
            rows={stats.warehouses.map((w) => ({
              key: w.warehouseId || w.warehouseName,
              label: w.warehouseName || w.warehouseCode,
              value: w.storedParcels,
              valueText: `${formatCount(w.storedParcels)} kiện · ${w.occupancyPercent}% ô`,
            }))}
            emptyText="Chưa có kho nào."
          />
          <p className="dash-section__note" style={{ margin: 0 }}>
            {formatCount(stats.shipmentsInProgress)} lô quốc tế đang chạy · {formatCount(stats.openIncidents)} sự cố đang mở
          </p>
        </ChartCard>
      </div>
    </div>
  );
}
