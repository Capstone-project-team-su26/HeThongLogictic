import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Divider,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from "antd";

import {
  ArrowRightOutlined,
  CalculatorOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  PieChartOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  SwapOutlined,
  SyncOutlined,
  TeamOutlined,
  TruckOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { getPurchaseRequestsApi } from "../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import { getConsignmentsApi } from "../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import {
  getExchangeRatesApi,
  convertCurrencyApi,
} from "../../../api/SaleAPI/ExchangeRateAPI/exchangeRateService";
import { getServicePricingsApi } from "../../../api/SaleAPI/ConsignmentAPI/servicePricingService";

import AuthNotify from "../../../utils/Common/AuthNotify";
import "./SaleDashboard.css";

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

export default function SaleDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [consignments, setConsignments] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [servicePricings, setServicePricings] = useState([]);

  // Quick convert state
  const [convertCurrency, setConvertCurrency] = useState("CNY");
  const [convertAmount, setConvertAmount] = useState(1);
  const [convertedVnd, setConvertedVnd] = useState(3650);
  const [convertRate, setConvertRate] = useState(3650);
  const [converting, setConverting] = useState(false);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [purchaseRes, consignRes, rateList, pricingList] =
        await Promise.allSettled([
          getPurchaseRequestsApi(),
          getConsignmentsApi(),
          getExchangeRatesApi({ activeOnly: true }),
          getServicePricingsApi(),
        ]);

      if (purchaseRes.status === "fulfilled") {
        const val = purchaseRes.value;
        const list = Array.isArray(val)
          ? val
          : Array.isArray(val?.items)
          ? val.items
          : Array.isArray(val?.data)
          ? val.data
          : [];
        setPurchaseRequests(list);
      }
      if (consignRes.status === "fulfilled") {
        const val = consignRes.value;
        const list = Array.isArray(val)
          ? val
          : Array.isArray(val?.items)
          ? val.items
          : Array.isArray(val?.data)
          ? val.data
          : [];
        setConsignments(list);
      }
      if (rateList.status === "fulfilled") {
        const val = rateList.value;
        const list = Array.isArray(val)
          ? val
          : Array.isArray(val?.items)
          ? val.items
          : Array.isArray(val?.data)
          ? val.data
          : [];
        setExchangeRates(list);
      }
      if (pricingList.status === "fulfilled") {
        const val = pricingList.value;
        const list = Array.isArray(val)
          ? val
          : Array.isArray(val?.items)
          ? val.items
          : Array.isArray(val?.data)
          ? val.data
          : [];
        setServicePricings(list);
      }
    } catch (err) {
      console.error("LOAD SALE DASHBOARD ERROR:", err);
      AuthNotify.error("Lỗi tải dữ liệu", "Không thể tải đầy đủ thông tin tổng quan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Quick converter handler
  const handleConvertQuick = async (curr, amt) => {
    const currency = curr || convertCurrency;
    const amount = Number(amt ?? convertAmount);

    setConvertCurrency(currency);
    setConvertAmount(amount);

    if (!amount || amount <= 0) {
      setConvertedVnd(0);
      setConvertRate(0);
      return;
    }

    try {
      setConverting(true);
      const res = await convertCurrencyApi(currency, amount);
      if (res?.amountVnd >= 0) {
        setConvertedVnd(res.amountVnd);
        setConvertRate(res.exchangeRate);
      }
    } catch (err) {
      const foundRate = exchangeRates.find((r) => r.currencyCode === currency);
      const rate = foundRate?.rateToVnd || 0;
      if (rate > 0) {
        setConvertedVnd(Math.round(amount * rate));
        setConvertRate(rate);
      }
    } finally {
      setConverting(false);
    }
  };

  // Calculated Stats
  const pendingPurchaseCount = useMemo(
    () =>
      purchaseRequests.filter(
        (r) =>
          String(r.status).toUpperCase() === "PENDING_REVIEW" ||
          String(r.status).toUpperCase() === "PENDING_QUOTATION"
      ).length,
    [purchaseRequests]
  );

  const pendingConsignmentCount = useMemo(
    () =>
      consignments.filter(
        (c) =>
          String(c.status).toUpperCase() === "PENDING_QUOTATION" ||
          String(c.status).toUpperCase() === "PENDING_REVIEW"
      ).length,
    [consignments]
  );

  const approvedQuotationCount = useMemo(
    () =>
      purchaseRequests.filter(
        (r) =>
          String(r.status).toUpperCase() === "QUOTATION_APPROVED" ||
          String(r.status).toUpperCase() === "PURCHASE_CONFIRMED"
      ).length,
    [purchaseRequests]
  );

  // Combined All Orders (Mua Hộ & Ký Gửi)
  const allOrders = useMemo(
    () => [...purchaseRequests, ...consignments],
    [purchaseRequests, consignments]
  );

  // Dynamic Route Distribution from combined API data (Mua Hộ & Ký Gửi)
  const routeStats = useMemo(() => {
    const total = allOrders.length || 1;
    let krwCount = 0;
    let jpyCount = 0;
    let cnyCount = 0;
    let usdCount = 0;

    allOrders.forEach((req) => {
      const r = String(req?.route || req?.destinationWarehouse || "").toUpperCase();
      if (r.includes("KOREA") || r.includes("HAN") || r.includes("HÀN")) krwCount++;
      else if (r.includes("JAPAN") || r.includes("NHAT") || r.includes("NHẬT")) jpyCount++;
      else if (r.includes("CHINA") || r.includes("TRUNG")) cnyCount++;
      else if (r.includes("USA") || r.includes("US") || r.includes("MỸ")) usdCount++;
      else krwCount++;
    });

    const krwPct = Math.round((krwCount / total) * 100);
    const jpyPct = Math.round((jpyCount / total) * 100);
    const cnyPct = Math.round((cnyCount / total) * 100);
    const usdPct = Math.max(0, 100 - krwPct - jpyPct - cnyPct);

    return {
      krwCount, krwPct,
      jpyCount, jpyPct,
      cnyCount, cnyPct,
      usdCount, usdPct,
      totalCount: allOrders.length,
    };
  }, [allOrders]);

  // Dynamic Status Distribution from combined API data (Mua Hộ & Ký Gửi)
  const statusStats = useMemo(() => {
    const total = allOrders.length || 1;
    let pending = 0;
    let quoted = 0;
    let approved = 0;
    let rejected = 0;

    allOrders.forEach((req) => {
      const st = String(req?.status || "").toUpperCase();
      if (st === "PENDING_REVIEW" || st === "PENDING_QUOTATION" || st === "PENDING" || st === "NEW") pending++;
      else if (st === "QUOTATION_SENT" || st === "QUOTED") quoted++;
      else if (st === "QUOTATION_APPROVED" || st === "PURCHASE_CONFIRMED" || st === "APPROVED" || st === "COMPLETED") approved++;
      else if (st === "CANCELLED" || st === "REJECTED") rejected++;
      else pending++;
    });

    const pendingPct = Math.round((pending / total) * 100);
    const quotedPct = Math.round((quoted / total) * 100);
    const approvedPct = Math.round((approved / total) * 100);
    const rejectedPct = Math.max(0, 100 - pendingPct - quotedPct - approvedPct);

    // Circumference = 2 * PI * 60 = 377
    const CIRCUMFERENCE = 377;
    const pendingDash = Math.round((pendingPct / 100) * CIRCUMFERENCE);
    const quotedDash = Math.round((quotedPct / 100) * CIRCUMFERENCE);
    const approvedDash = Math.round((approvedPct / 100) * CIRCUMFERENCE);
    const rejectedDash = Math.round((rejectedPct / 100) * CIRCUMFERENCE);

    return {
      pending, pendingPct, pendingDash,
      quoted, quotedPct, quotedDash,
      approved, approvedPct, approvedDash,
      rejected, rejectedPct, rejectedDash,
      totalCount: allOrders.length,
      CIRCUMFERENCE,
    };
  }, [allOrders]);

  const recentPurchaseRequests = useMemo(
    () => purchaseRequests.slice(0, 5),
    [purchaseRequests]
  );

  const recentConsignments = useMemo(
    () => consignments.slice(0, 5),
    [consignments]
  );

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
      render: (status) => {
        const stKey = String(status || "").toUpperCase();
        const conf = STATUS_CONFIGS[stKey] || {
          color: "#475569",
          bg: "#f8fafc",
          border: "#e2e8f0",
          text: status || "Mới",
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
        const stKey = String(status || "").toUpperCase();
        const conf = STATUS_CONFIGS[stKey] || {
          color: "#2563eb",
          bg: "#eff6ff",
          border: "#bfdbfe",
          text: status || "Mới tạo",
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
              Quản lý yêu cầu mua hộ, ký gửi hàng hóa quốc tế và tra cứu tỷ giá hối đoái real-time tại một nơi duy nhất.
            </p>

            <div className="hero-action-buttons">
              <Button
                type="primary"
                size="large"
                icon={<ShoppingOutlined />}
                onClick={() => navigate("/sale/create-order/buy-orders")}
                className="hero-btn primary-glow"
              >
                Tạo Đơn Mua Hộ Mới
              </Button>

              <Button
                size="large"
                icon={<InboxOutlined />}
                onClick={() => navigate("/sale/create-order/consignment")}
                className="hero-btn secondary-btn"
              >
                Tạo Đơn Ký Gửi Mới
              </Button>

              <Button
                size="large"
                icon={<CalculatorOutlined />}
                onClick={() => navigate("/sale/service-pricings")}
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
                <div key={rate.id || rate.currencyCode} className="rate-row">
                  <span className="rate-name">
                    <strong>{rate.currencyCode}</strong> ({rate.currencyName}):
                  </span>
                  <span className="rate-value">{formatNumber(rate.rateToVnd)} ₫</span>
                </div>
              ))}
            </div>

            <div className="rates-card-footer">
              <ClockCircleOutlined /> Tỷ giá áp dụng cho quy đổi đơn hàng real-time.
            </div>
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
                <div className="bar-chart-item">
                  <div className="bar-item-header">
                    <span>🇰🇷 Hàn Quốc (Korea)</span>
                    <strong>{routeStats.krwPct}% ({routeStats.krwCount} đơn)</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill is-krw" style={{ width: `${routeStats.krwPct}%` }} />
                  </div>
                </div>

                <div className="bar-chart-item">
                  <div className="bar-item-header">
                    <span>🇯🇵 Nhật Bản (Japan)</span>
                    <strong>{routeStats.jpyPct}% ({routeStats.jpyCount} đơn)</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill is-jpy" style={{ width: `${routeStats.jpyPct}%` }} />
                  </div>
                </div>

                <div className="bar-chart-item">
                  <div className="bar-item-header">
                    <span>🇨🇳 Trung Quốc (China)</span>
                    <strong>{routeStats.cnyPct}% ({routeStats.cnyCount} đơn)</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill is-cny" style={{ width: `${routeStats.cnyPct}%` }} />
                  </div>
                </div>

                <div className="bar-chart-item">
                  <div className="bar-item-header">
                    <span>🇺🇸 Mỹ (USA)</span>
                    <strong>{routeStats.usdPct}% ({routeStats.usdCount} đơn)</strong>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill is-usd" style={{ width: `${routeStats.usdPct}%` }} />
                  </div>
                </div>
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
                  {/* Arc 1: Pending (Amber) */}
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    className="donut-segment segment-pending"
                    strokeDasharray={`${statusStats.pendingDash} ${statusStats.CIRCUMFERENCE}`}
                    strokeDashoffset="0"
                  />
                  {/* Arc 2: Quoted (Blue) */}
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    className="donut-segment segment-quoted"
                    strokeDasharray={`${statusStats.quotedDash} ${statusStats.CIRCUMFERENCE}`}
                    strokeDashoffset={`-${statusStats.pendingDash}`}
                  />
                  {/* Arc 3: Approved (Green) */}
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    className="donut-segment segment-approved"
                    strokeDasharray={`${statusStats.approvedDash} ${statusStats.CIRCUMFERENCE}`}
                    strokeDashoffset={`-${statusStats.pendingDash + statusStats.quotedDash}`}
                  />
                  {/* Arc 4: Rejected (Red) */}
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    className="donut-segment segment-rejected"
                    strokeDasharray={`${statusStats.rejectedDash} ${statusStats.CIRCUMFERENCE}`}
                    strokeDashoffset={`-${statusStats.pendingDash + statusStats.quotedDash + statusStats.approvedDash}`}
                  />
                </svg>
                <div className="donut-center-text">
                  <strong>{formatNumber(statusStats.totalCount)}</strong>
                  <span>TỔNG ĐƠN</span>
                </div>
              </div>

              <div className="donut-legend">
                <div className="legend-item">
                  <span className="dot dot-pending" />
                  <span>Chờ duyệt ({statusStats.pendingPct}%)</span>
                </div>
                <div className="legend-item">
                  <span className="dot dot-quoted" />
                  <span>Đã báo giá ({statusStats.quotedPct}%)</span>
                </div>
                <div className="legend-item">
                  <span className="dot dot-approved" />
                  <span>Đã duyệt ({statusStats.approvedPct}%)</span>
                </div>
                <div className="legend-item">
                  <span className="dot dot-rejected" />
                  <span>Từ chối ({statusStats.rejectedPct}%)</span>
                </div>
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
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="300" y2="30" className="chart-grid-line" />
                  <line x1="0" y1="70" x2="300" y2="70" className="chart-grid-line" />
                  <line x1="0" y1="110" x2="300" y2="110" className="chart-grid-line" />

                  {/* Filled Area */}
                  <polygon
                    points="20,110 60,75 100,85 140,40 180,60 220,30 260,45 260,110 20,110"
                    fill="url(#areaGradient)"
                  />

                  {/* Trend Line */}
                  <polyline
                    points="20,110 60,75 100,85 140,40 180,60 220,30 260,45"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data Points */}
                  <circle cx="20" cy="110" r="4.5" className="chart-point" />
                  <circle cx="60" cy="75" r="4.5" className="chart-point" />
                  <circle cx="100" cy="85" r="4.5" className="chart-point" />
                  <circle cx="140" cy="40" r="4.5" className="chart-point" />
                  <circle cx="180" cy="60" r="4.5" className="chart-point" />
                  <circle cx="220" cy="30" r="4.5" className="chart-point" />
                  <circle cx="260" cy="45" r="4.5" className="chart-point" />
                </svg>

                <div className="area-x-axis">
                  <span>T2</span>
                  <span>T3</span>
                  <span>T4</span>
                  <span>T5</span>
                  <span>T6</span>
                  <span>T7</span>
                  <span>CN</span>
                </div>
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
                  <h3>Công cụ Tính nhanh Ngoại tệ Real-time</h3>
                  <span>Quy đổi trực tiếp số tiền ngoại tệ sang Việt Nam Đồng (VNĐ)</span>
                </div>
              </div>

              <div className="converter-form">
                <div className="converter-input-row">
                  <div className="converter-field">
                    <label>Loại ngoại tệ</label>
                    <Select
                      value={convertCurrency}
                      options={[
                        { value: "CNY", label: "🇨🇳 CNY (Nhân dân tệ)" },
                        { value: "JPY", label: "🇯🇵 JPY (Yên Nhật)" },
                        { value: "KRW", label: "🇰🇷 KRW (Won Hàn)" },
                        { value: "USD", label: "🇺🇸 USD (Đô la Mỹ)" },
                      ]}
                      onChange={(curr) => handleConvertQuick(curr, convertAmount)}
                      className="converter-select"
                    />
                  </div>

                  <div className="converter-field">
                    <label>Số tiền ngoại tệ</label>
                    <InputNumber
                      value={convertAmount}
                      min={0}
                      controls={false}
                      onChange={(amt) => handleConvertQuick(convertCurrency, amt)}
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
                  onClick={() => navigate("/sale/restricted-items")}
                >
                  <SafetyCertificateOutlined className="sc-icon ban-sc" />
                  <div>
                    <strong>Danh mục Hàng cấm</strong>
                    <span>Tra cứu quy định hàng cấm/hạn chế</span>
                  </div>
                </div>

                <div
                  className="shortcut-item"
                  onClick={() => navigate("/sale/service-pricings")}
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
                    <ShoppingCartOutlined /> Yêu cầu Mua hộ mới nhất ({purchaseRequests.length})
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
                      rowKey={(r) => r.purchaseRequestId || r.purchaseCode || Math.random()}
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
                    <InboxOutlined /> Đơn Ký gửi mới nhất ({consignments.length})
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
                      rowKey={(r) => r.orderId || r.id || r.code || Math.random()}
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
