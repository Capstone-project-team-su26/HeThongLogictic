import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Col,
  ConfigProvider,
  InputNumber,
  Row,
  Select,
  Table,
  Tabs,
  Tag,
} from "antd";

import {
  ArrowRightOutlined,
  CalculatorOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  InboxOutlined,
  LineChartOutlined,
  PieChartOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SwapOutlined,
} from "@ant-design/icons";

/*
 * Mọi con số trên trang lấy từ MỘT lời gọi GET /api/staff/dashboard — backend tự đếm/cộng.
 * Trước đây trang kéo danh sách mua hộ (chỉ trang đầu) + đơn ký gửi MẪU + tỷ giá MẪU về rồi
 * tự cộng ở trình duyệt, còn biểu đồ 7 ngày là đường vẽ cứng.
 */
import { getSaleDashboardApi } from "@features/dashboard/api/dashboardService";
/*
 * Trạng thái mua hộ hiện CHẶNG THẬT (đối chiếu đơn mua NCC + đơn kho), không dùng nhãn server
 * "Hoàn tất nghiệp vụ" — mã COMPLETED của yêu cầu có thể chỉ là tất toán đợt cuối đời cũ.
 */
import { getPurchaseStageContextApi } from "@features/purchase/api/purchaseRequestService";
import {
  derivePurchaseStage,
  getPurchaseRequestStatusLabel,
} from "@features/purchase/api/purchaseRequestStage";

import {
  getOrderStatusLabel,
  normalizeOrderStatus,
} from "@features/consignment";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "./SaleDashboard.css";
import { textOr } from "@shared/utils/statusLabel";

const SALE_DASHBOARD_THEME = {
  token: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    borderRadius: 14,
    colorPrimary: "#2563eb",
  },
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatNumber = (val) =>
  new Intl.NumberFormat("vi-VN").format(Number(val) || 0);

const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const STATUS_CONFIGS = {
  PENDING_REVIEW: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    text: "Chờ báo giá",
  },
  QUOTATION_SENT: {
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    text: "Đã gửi báo giá",
  },
  QUOTATION_APPROVED: {
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    text: "Khách chấp nhận",
  },
  PURCHASE_CONFIRMED: {
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    text: "Đã xác nhận mua",
  },
  CANCELLED: {
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    text: "Đã hủy",
  },
  REJECTED: {
    color: "#991b1b",
    bg: "#fef2f2",
    border: "#fecaca",
    text: "Từ chối",
  },
};
/*
 * Dòng "Mua hộ · COMPLETED" của biểu đồ: server ghi "Hoàn tất nghiệp vụ" dù có yêu cầu chỉ mới
 * tất toán đời cũ — ở mức đếm theo mã chỉ gọi là "đã đóng yêu cầu".
 */
const purchaseBreakdownLabel = (row) =>
  String(row?.key || "").toUpperCase() === "PURCHASE:COMPLETED"
    ? `Mua hộ · ${getPurchaseRequestStatusLabel("COMPLETED")}`
    : row?.label;

/* Cờ + lớp màu thanh cho bốn tuyến chính; tuyến khác (nếu backend trả về) dùng màu trung tính. */
const ROUTE_META = {
  KR: { flag: "🇰🇷", name: "Hàn Quốc (Korea)", barClass: "is-krw" },
  JP: { flag: "🇯🇵", name: "Nhật Bản (Japan)", barClass: "is-jpy" },
  CN: { flag: "🇨🇳", name: "Trung Quốc (China)", barClass: "is-cny" },
  US: { flag: "🇺🇸", name: "Mỹ (USA)", barClass: "is-usd" },
};

const STATUS_GROUP_CLASS = {
  PENDING: "pending",
  QUOTED: "quoted",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/* "yyyy-MM-dd" (giờ VN, do backend tính) → nhãn thứ. Dựng Date theo UTC để không lệch ngày. */
const weekdayOf = (isoDate) => {
  const [y, m, d] = String(isoDate).split("-").map(Number);
  if (!y || !m || !d) return "";
  return WEEKDAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

const shortDate = (isoDate) => {
  const [, m, d] = String(isoDate).split("-");
  return m && d ? `${d}/${m}` : String(isoDate);
};

/* Khung vẽ của biểu đồ 7 ngày (viewBox 0 0 300 140): trục x 20→280 (khớp nhãn thứ bên dưới), trục y 110 (0 đơn) → 30 (đỉnh). */
const TREND_X0 = 20;
const TREND_STEP = 260 / 6;
const TREND_Y_BASE = 110;
const TREND_Y_TOP = 30;

const EMPTY_DASHBOARD = {
  exchangeRates: [],
  exchangeRatesUpdatedAt: null,
  totalOrders: 0,
  consignmentTotal: 0,
  purchaseTotal: 0,
  routes: [],
  statusGroups: [],
  last7Days: [],
  workQueue: {
    consignmentsToReview: 0,
    purchasesToQuote: 0,
    quotationsAwaitingCustomer: 0,
    purchaseOrdersToPlace: 0,
  },
  recentPurchaseRequests: [],
  recentConsignments: [],
};

export default function SaleDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  /* undefined = đang tải; null = không tải được (cột trạng thái lùi về nhãn theo mã). */
  const [purchaseStageContext, setPurchaseStageContext] = useState(undefined);

  // Quick convert state — tỷ giá lấy từ bảng tỷ giá công ty (trong response dashboard).
  const [convertCurrency, setConvertCurrency] = useState("CNY");
  const [convertAmount, setConvertAmount] = useState(1);

  /* Mọi setState nằm trong callback của promise (không cập nhật đồng bộ trong effect). */
  useEffect(() => {
    const controller = new AbortController();
    getSaleDashboardApi({ signal: controller.signal })
      .then((data) => setDashboard(data))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("LOAD SALE DASHBOARD ERROR:", err);
        AuthNotify.error("Lỗi tải dữ liệu", "Không thể tải số liệu tổng quan.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPurchaseStageContextApi()
      .then((context) => {
        if (!cancelled) setPurchaseStageContext(context);
      })
      .catch(() => {
        if (!cancelled) setPurchaseStageContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const exchangeRates = dashboard.exchangeRates;

  const currencyOptions = useMemo(
    () =>
      exchangeRates.map((rate) => ({
        value: rate.currencyCode,
        label: `${rate.currencyCode} (${rate.currencyName || rate.currencyCode})`,
      })),
    [exchangeRates]
  );

  /*
   * Quy đổi nhanh: số tiền × tỷ giá công ty đang bật, làm tròn về đồng — cùng công thức với
   * GET /api/exchange-rates/convert. Chưa có tỷ giá cho đồng tiền đang chọn thì hiện 0.
   */
  const convertRate =
    exchangeRates.find((rate) => rate.currencyCode === convertCurrency)?.rateToVnd || 0;
  const convertedVnd = convertRate > 0 ? Math.round((Number(convertAmount) || 0) * convertRate) : 0;

  const routeRows = useMemo(
    () =>
      dashboard.routes.map((route) => {
        const meta = ROUTE_META[route.countryCode];
        return {
          ...route,
          flag: meta?.flag ?? "🌐",
          name: meta?.name ?? route.countryName,
          barClass: meta?.barClass ?? "is-other",
        };
      }),
    [dashboard.routes]
  );

  // Donut: độ dài cung theo phần trăm backend đã chia (tổng đúng 100).
  const donut = useMemo(() => {
    const CIRCUMFERENCE = 377; // 2 * PI * 60
    const dashes = dashboard.statusGroups.map((group) => Math.round((group.percent / 100) * CIRCUMFERENCE));
    const segments = dashboard.statusGroups.map((group, index) => ({
      ...group,
      dash: dashes[index],
      offset: dashes.slice(0, index).reduce((sum, value) => sum + value, 0),
      className: STATUS_GROUP_CLASS[group.key] ?? "pending",
    }));
    return { segments, CIRCUMFERENCE };
  }, [dashboard.statusGroups]);

  const trend = useMemo(() => {
    const days = dashboard.last7Days;
    const max = Math.max(1, ...days.map((d) => d.total));
    const points = days.map((day, index) => ({
      ...day,
      x: TREND_X0 + index * TREND_STEP,
      y: TREND_Y_BASE - Math.round((day.total / max) * (TREND_Y_BASE - TREND_Y_TOP)),
    }));
    const line = points.map((p) => `${p.x},${p.y}`).join(" ");
    const area = points.length
      ? `${line} ${points[points.length - 1].x},${TREND_Y_BASE} ${points[0].x},${TREND_Y_BASE}`
      : "";
    return { points, line, area, max };
  }, [dashboard.last7Days]);

  const recentPurchaseRequests = dashboard.recentPurchaseRequests;
  const recentConsignments = dashboard.recentConsignments;
  const workQueue = dashboard.workQueue;

  const ratesUpdatedText = dashboard.exchangeRatesUpdatedAt
    ? formatDateTime(dashboard.exchangeRatesUpdatedAt)
    : null;

  const purchaseColumns = [
    {
      title: "Mã Yêu cầu",
      dataIndex: "purchaseCode",
      key: "purchaseCode",
      render: (code, record) => (
        <a
          className="dashboard-table-link"
          onClick={() =>
            navigate(`/sale/purchase-requests/${record.purchaseRequestId}`)
          }
        >
          {code || record.purchaseRequestId || "—"}
        </a>
      ),
    },
    {
      title: "Người nhận",
      dataIndex: "receiverName",
      key: "receiverName",
      render: (text) => <strong>{text || "Khách vãng lai"}</strong>,
    },
    {
      title: "Tuyến hàng",
      dataIndex: "route",
      key: "route",
      render: (route) => (
        <Tag className="dashboard-route-tag">
          <EnvironmentOutlined /> {route || "Ngoại quốc → VN"}
        </Tag>
      ),
    },
    {
      title: "Số SP",
      dataIndex: "totalQuantity",
      key: "totalQuantity",
      align: "center",
      render: (qty, record) => (
        <Tag color="blue">{formatNumber(qty || record.itemCount || 1)} SP</Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status, record) => {
        const stKey = String(status || "").toUpperCase();
        const conf = STATUS_CONFIGS[stKey] || {
          color: "#475569",
          bg: "#f8fafc",
          border: "#e2e8f0",
          text: status || "Mới",
        };
        const stage =
          purchaseStageContext || record.overallStage
            ? derivePurchaseStage(record, purchaseStageContext || null)
            : null;
        return (
          <span
            className="dashboard-status-badge"
            style={{ color: conf.color, background: conf.bg, borderColor: conf.border }}
            title={stage?.hint || undefined}
          >
            {stage
              ? stage.label
              : getPurchaseRequestStatusLabel(stKey, textOr(record.statusText, conf.text))}
          </span>
        );
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date) => (
        <span className="dashboard-time-text">{formatDateTime(date)}</span>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      align: "right",
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<RightOutlined />}
          onClick={() =>
            navigate(`/sale/purchase-requests/${record.purchaseRequestId}`)
          }
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  const consignmentColumns = [
    {
      title: "Mã Đơn ký gửi",
      dataIndex: "orderId",
      key: "orderId",
      render: (id, record) => (
        <a
          className="dashboard-table-link"
          onClick={() =>
            navigate(`/sale/consignments/${id || record.id}`)
          }
        >
          {record.orderCode || record.code || id || "—"}
        </a>
      ),
    },
    {
      title: "Người gửi",
      dataIndex: "senderName",
      key: "senderName",
      render: (text, record) => (
        <strong>{text || record.customerName || record.receiverName || "Khách vãng lai"}</strong>
      ),
    },
    {
      title: "Tuyến hàng",
      dataIndex: "route",
      key: "route",
      render: (route) => (
        <Tag className="dashboard-route-tag">
          <EnvironmentOutlined /> {route || "Quốc tế → VN"}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        /* Bảng đơn ký gửi: nhãn theo module trạng thái đơn dùng chung, màu theo STATUS_CONFIGS. */
        const stKey = String(normalizeOrderStatus(status) || "").toUpperCase();
        const baseConf = STATUS_CONFIGS[stKey] || {
          color: "#2563eb",
          bg: "#eff6ff",
          border: "#bfdbfe",
        };
        const conf = {
          ...baseConf,
          text: stKey ? getOrderStatusLabel(stKey) : "Mới tạo",
        };
        return (
          <span
            className="dashboard-status-badge"
            style={{ color: conf.color, background: conf.bg, borderColor: conf.border }}
          >
            {conf.text}
          </span>
        );
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date) => (
        <span className="dashboard-time-text">{formatDateTime(date)}</span>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      align: "right",
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<RightOutlined />}
          onClick={() =>
            navigate(`/sale/consignments/${record.orderId || record.id}`)
          }
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <ConfigProvider theme={SALE_DASHBOARD_THEME}>
      <main className="sale-dashboard-container">
        {/* HERO BANNER */}
        <section className="sale-dashboard-hero">
          <div className="hero-left-content">
            <div className="hero-badge">
              <DashboardOutlined /> TỔNG QUAN HỆ THỐNG SALE LOGISTICS
            </div>

            <h1>Xin chào Nhân viên Sale 👋</h1>

            <p>
              Quản lý yêu cầu mua hộ, ký gửi hàng hóa quốc tế và tra cứu tỷ giá công ty tại một nơi duy nhất.
            </p>

            <div className="hero-action-buttons">
              <Button
                type="primary"
                size="large"
                icon={<ShoppingOutlined />}
                onClick={() => navigate("/sale/create-order?tab=buy-orders")}
                className="hero-btn primary-glow"
              >
                Tạo Đơn Mua Hộ Mới
              </Button>

              <Button
                size="large"
                icon={<InboxOutlined />}
                onClick={() => navigate("/sale/create-order")}
                className="hero-btn secondary-btn"
              >
                Tạo Đơn Ký Gửi Mới
              </Button>

              <Button
                size="large"
                icon={<CalculatorOutlined />}
                onClick={() => navigate("/sale/lookup")}
                className="hero-btn outline-btn"
              >
                Tra Cứu Bảng Giá & Tỷ Giá
              </Button>
            </div>
          </div>

          <div className="hero-rates-quickcard">
            <div className="rates-card-header">
              <SwapOutlined /> Tỷ giá công ty chốt hôm nay
            </div>

            <div className="rates-list">
              {exchangeRates.map((rate) => (
                <div key={rate.currencyCode} className="rate-row">
                  <span className="rate-name">
                    <strong>{rate.currencyCode}</strong> ({rate.currencyName || rate.currencyCode}):
                  </span>
                  <span className="rate-value">{formatNumber(rate.rateToVnd)} ₫</span>
                </div>
              ))}
              {!loading && exchangeRates.length === 0 && (
                <div className="rate-row">
                  <span className="rate-name">Chưa có tỷ giá nào đang bật.</span>
                </div>
              )}
            </div>

            <div className="rates-card-footer">
              <ClockCircleOutlined /> Tỷ giá công ty quy định (bảng Tỷ giá do Admin cập nhật)
              {ratesUpdatedText ? ` · cập nhật ${ratesUpdatedText}` : ""}.
            </div>
          </div>
        </section>

        {/* VIỆC ĐANG CHỜ SALE (đếm ở backend) */}
        <section className="sale-dashboard-stats-grid">
          <div
            className="stat-card is-pending-consign"
            onClick={() => navigate("/sale/consignments")}
          >
            <span className="stat-icon-wrapper"><FileSearchOutlined /></span>
            <div className="stat-info">
              <span>Ký gửi chờ duyệt</span>
              <strong>{formatNumber(workQueue.consignmentsToReview)}</strong>
              <small>Đơn mới chờ Sale xem và báo giá</small>
            </div>
            <RightOutlined className="stat-arrow" />
          </div>

          <div
            className="stat-card is-pending-buy"
            onClick={() => navigate("/sale/purchase-requests")}
          >
            <span className="stat-icon-wrapper"><ShoppingCartOutlined /></span>
            <div className="stat-info">
              <span>Mua hộ chờ báo giá</span>
              <strong>{formatNumber(workQueue.purchasesToQuote)}</strong>
              <small>Yêu cầu chưa có báo giá gửi khách</small>
            </div>
            <RightOutlined className="stat-arrow" />
          </div>

          <div className="stat-card is-approved">
            <span className="stat-icon-wrapper"><SendOutlined /></span>
            <div className="stat-info">
              <span>Báo giá chờ khách</span>
              <strong>{formatNumber(workQueue.quotationsAwaitingCustomer)}</strong>
              <small>Đã gửi, khách chưa trả lời</small>
            </div>
          </div>

          <div
            className="stat-card is-support"
            onClick={() => navigate("/sale/purchase-requests")}
          >
            <span className="stat-icon-wrapper"><FileDoneOutlined /></span>
            <div className="stat-info">
              <span>Đơn mua NCC chờ đặt</span>
              <strong>{formatNumber(workQueue.purchaseOrdersToPlace)}</strong>
              <small>Admin đã duyệt, chờ Sale đặt hàng</small>
            </div>
            <RightOutlined className="stat-arrow" />
          </div>
        </section>

        {/* VISUAL CHARTS SECTION */}
        <Row gutter={[20, 20]} className="sale-dashboard-charts-row">
          {/* Chart 1: Route Distribution Bar Chart */}
          <Col xs={24} lg={8}>
            <div className="dashboard-card chart-card">
              <div className="card-heading">
                <EnvironmentOutlined className="heading-icon" />
                <div>
                  <h3>Tỷ lệ Tuyến hàng (Mua hộ & Ký gửi)</h3>
                  <span>Phân bổ tổng số lượng đơn theo Quốc gia xuất xứ</span>
                </div>
              </div>

              <div className="bar-chart-container">
                {routeRows.map((route) => (
                  <div
                    key={route.countryCode}
                    className="bar-chart-item"
                    title={`${route.name}: ${route.consignmentCount} ký gửi, ${route.purchaseCount} mua hộ`}
                  >
                    <div className="bar-item-header">
                      <span>{route.flag} {route.name}</span>
                      <strong>{route.percent}% ({formatNumber(route.total)} đơn)</strong>
                    </div>
                    <div className="bar-track">
                      <div className={`bar-fill ${route.barClass}`} style={{ width: `${route.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Col>

          {/* Chart 2: Status Donut Chart */}
          <Col xs={24} lg={8}>
            <div className="dashboard-card chart-card">
              <div className="card-heading">
                <PieChartOutlined className="heading-icon" />
                <div>
                  <h3>Trạng thái Đơn hàng (Mua hộ & Ký gửi)</h3>
                  <span>Tỷ lệ phân bổ trạng thái tổng thể các đơn hiện tại</span>
                </div>
              </div>

              <div className="donut-chart-wrapper">
                <svg className="donut-svg" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="60" className="donut-bg" />
                  {donut.segments.map((segment) => (
                    <circle
                      key={segment.key}
                      cx="80"
                      cy="80"
                      r="60"
                      className={`donut-segment segment-${segment.className}`}
                      strokeDasharray={`${segment.dash} ${donut.CIRCUMFERENCE}`}
                      strokeDashoffset={`-${segment.offset}`}
                    >
                      <title>{`${segment.label}: ${segment.count} đơn (${segment.consignmentCount} ký gửi, ${segment.purchaseCount} mua hộ)`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="donut-center-text">
                  <strong>{formatNumber(dashboard.totalOrders)}</strong>
                  <span>TỔNG ĐƠN</span>
                </div>
              </div>

              <div className="donut-legend">
                {donut.segments.map((segment) => (
                  <div
                    key={segment.key}
                    className="legend-item"
                    title={segment.statuses.map((st) => `${purchaseBreakdownLabel(st)}: ${st.count}`).join("\n")}
                  >
                    <span className={`dot dot-${segment.className}`} />
                    <span>{segment.label} ({segment.percent}% · {formatNumber(segment.count)})</span>
                  </div>
                ))}
              </div>
            </div>
          </Col>

          {/* Chart 3: 7-Day Trend Area Line Chart */}
          <Col xs={24} lg={8}>
            <div className="dashboard-card chart-card">
              <div className="card-heading">
                <LineChartOutlined className="heading-icon" />
                <div>
                  <h3>Xu hướng Đơn 7 Ngày (Mua hộ & Ký gửi)</h3>
                  <span>Tổng số lượng đơn yêu cầu phát sinh theo ngày</span>
                </div>
              </div>

              <div className="area-chart-wrapper">
                <svg className="area-svg" viewBox="0 0 300 140">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines: đỉnh = ngày nhiều đơn nhất, giữa = một nửa, đáy = 0 */}
                  <line x1="0" y1="30" x2="300" y2="30" className="chart-grid-line" />
                  <line x1="0" y1="70" x2="300" y2="70" className="chart-grid-line" />
                  <line x1="0" y1="110" x2="300" y2="110" className="chart-grid-line" />
                  <text x="2" y="26" className="chart-axis-label">{`đỉnh ${trend.max}`}</text>

                  {trend.points.length > 0 && (
                    <>
                      <polygon points={trend.area} fill="url(#areaGradient)" />
                      <polyline
                        points={trend.line}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}

                  {trend.points.map((point) => (
                    <g key={point.date}>
                      <circle cx={point.x} cy={point.y} r="4.5" className="chart-point">
                        <title>{`${shortDate(point.date)}: ${point.total} đơn (${point.consignmentCount} ký gửi, ${point.purchaseCount} mua hộ)`}</title>
                      </circle>
                      <text x={point.x} y={point.y - 9} textAnchor="middle" className="chart-point-label">
                        {point.total}
                      </text>
                      {/* Nhãn thứ nằm trong SVG để luôn thẳng hàng với điểm dù thẻ rộng hẹp thế nào */}
                      <text x={point.x} y="132" textAnchor="middle" className="chart-axis-label">
                        {weekdayOf(point.date)}
                        <title>{shortDate(point.date)}</title>
                      </text>
                    </g>
                  ))}
                </svg>

              </div>
            </div>
          </Col>
        </Row>

        {/* QUICK CONVERT & SHORTCUTS SECTION */}
        <Row gutter={[20, 20]} className="sale-dashboard-middle-row">
          <Col xs={24} lg={12}>
            <div className="dashboard-card converter-card">
              <div className="card-heading">
                <CalculatorOutlined className="heading-icon" />
                <div>
                  <h3>Công cụ Tính nhanh Ngoại tệ</h3>
                  <span>Quy đổi số tiền ngoại tệ sang VNĐ theo tỷ giá công ty đang áp dụng</span>
                </div>
              </div>

              <div className="converter-form">
                <div className="converter-input-row">
                  <div className="converter-field">
                    <label>Loại ngoại tệ</label>
                    <Select
                      value={convertCurrency}
                      options={currencyOptions}
                      onChange={setConvertCurrency}
                      className="converter-select"
                    />
                  </div>

                  <div className="converter-field">
                    <label>Số tiền ngoại tệ</label>
                    <InputNumber
                      value={convertAmount}
                      min={0}
                      controls={false}
                      onChange={(amt) => setConvertAmount(amt ?? 0)}
                      placeholder="VD: 100"
                      className="converter-number-input"
                    />
                  </div>
                </div>

                <div className="converter-result-box">
                  <span className="result-label">Thành tiền quy đổi (VNĐ):</span>
                  <div className="result-amount">
                    {formatCurrency(convertedVnd)}
                  </div>

                  {convertRate > 0 && (
                    <small className="result-note">
                      💡 Tỷ giá quy định: 1 {convertCurrency} = {formatNumber(convertRate)} ₫
                    </small>
                  )}
                </div>
              </div>
            </div>
          </Col>

          <Col xs={24} lg={12}>
            <div className="dashboard-card shortcuts-card">
              <div className="card-heading">
                <GlobalOutlined className="heading-icon" />
                <div>
                  <h3>Phím tắt Quản lý Kinh doanh</h3>
                  <span>Lối tắt truy cập nhanh tới các chức năng của bộ phận Sale</span>
                </div>
              </div>

              <div className="shortcuts-grid">
                <div
                  className="shortcut-item"
                  onClick={() => navigate("/sale/purchase-requests")}
                >
                  <ShoppingCartOutlined className="sc-icon buy-sc" />
                  <div>
                    <strong>Quản lý Mua hộ</strong>
                    <span>Danh sách & xử lý báo giá mua hộ</span>
                  </div>
                </div>

                <div
                  className="shortcut-item"
                  onClick={() => navigate("/sale/consignments")}
                >
                  <InboxOutlined className="sc-icon consign-sc" />
                  <div>
                    <strong>Quản lý Ký gửi</strong>
                    <span>Quản lý đơn vận chuyển ký gửi</span>
                  </div>
                </div>

                <div
                  className="shortcut-item"
                  onClick={() => navigate("/sale/lookup?tab=restricted")}
                >
                  <SafetyCertificateOutlined className="sc-icon ban-sc" />
                  <div>
                    <strong>Danh mục Hàng cấm</strong>
                    <span>Tra cứu quy định hàng cấm/hạn chế</span>
                  </div>
                </div>

                <div
                  className="shortcut-item"
                  onClick={() => navigate("/sale/lookup")}
                >
                  <DollarOutlined className="sc-icon fee-sc" />
                  <div>
                    <strong>Bảng giá Dịch vụ</strong>
                    <span>Tra cứu chi phí cước vận chuyển</span>
                  </div>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* TABLES TABS SECTION: MUA HỘ & KÝ GỬI */}
        <section className="dashboard-card table-section-card">
          <Tabs
            defaultActiveKey="purchase"
            className="dashboard-main-tabs"
            items={[
              {
                key: "purchase",
                label: (
                  <span className="tab-title">
                    <ShoppingCartOutlined /> Yêu cầu Mua hộ mới nhất (tổng {formatNumber(dashboard.purchaseTotal)})
                  </span>
                ),
                children: (
                  <>
                    <div className="tab-header-actions">
                      <span className="tab-desc">Danh sách yêu cầu mua hộ cần theo dõi và xử lý báo giá</span>
                      <Button
                        type="link"
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate("/sale/purchase-requests")}
                      >
                        Xem tất cả đơn mua hộ
                      </Button>
                    </div>

                    <Table
                      dataSource={recentPurchaseRequests}
                      columns={purchaseColumns}
                      rowKey={(r) => r.purchaseRequestId || r.purchaseCode}
                      loading={loading}
                      pagination={false}
                      className="dashboard-recent-table"
                    />
                  </>
                ),
              },
              {
                key: "consignment",
                label: (
                  <span className="tab-title">
                    <InboxOutlined /> Đơn Ký gửi mới nhất (tổng {formatNumber(dashboard.consignmentTotal)})
                  </span>
                ),
                children: (
                  <>
                    <div className="tab-header-actions">
                      <span className="tab-desc">Danh sách đơn ký gửi vận chuyển quốc tế mới tạo</span>
                      <Button
                        type="link"
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate("/sale/consignments")}
                      >
                        Xem tất cả đơn ký gửi
                      </Button>
                    </div>

                    <Table
                      dataSource={recentConsignments}
                      columns={consignmentColumns}
                      rowKey={(r) => r.orderId || r.orderCode}
                      loading={loading}
                      pagination={false}
                      className="dashboard-recent-table"
                    />
                  </>
                ),
              },
            ]}
          />
        </section>
      </main>
    </ConfigProvider>
  );
}
