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

      if (purchaseRes.status === "fulfilled" && Array.isArray(purchaseRes.value)) {
        setPurchaseRequests(purchaseRes.value);
      }
      if (consignRes.status === "fulfilled" && Array.isArray(consignRes.value)) {
        setConsignments(consignRes.value);
      }
      if (rateList.status === "fulfilled" && Array.isArray(rateList.value)) {
        setExchangeRates(rateList.value);
      }
      if (pricingList.status === "fulfilled" && Array.isArray(pricingList.value)) {
        setServicePricings(pricingList.value);
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

        {/* METRIC STATS GRID */}
        <section className="sale-dashboard-stats-grid">
          <div
            className="stat-card is-pending-buy"
            onClick={() => navigate("/sale/purchase-requests")}
          >
            <div className="stat-icon-wrapper">
              <ShoppingOutlined />
            </div>
            <div className="stat-info">
              <span>MUA HỘ CHỜ BÁO GIÁ</span>
              <strong>{formatNumber(pendingPurchaseCount)}</strong>
              <small>Đơn đang cần nhân viên xử lý báo giá</small>
            </div>
            <ArrowRightOutlined className="stat-arrow" />
          </div>

          <div
            className="stat-card is-pending-consign"
            onClick={() => navigate("/sale/consignments")}
          >
            <div className="stat-icon-wrapper">
              <InboxOutlined />
            </div>
            <div className="stat-info">
              <span>KÝ GỬI CHỜ BÁO GIÁ</span>
              <strong>{formatNumber(pendingConsignmentCount)}</strong>
              <small>Yêu cầu ký gửi hàng chờ duyệt giá</small>
            </div>
            <ArrowRightOutlined className="stat-arrow" />
          </div>

          <div
            className="stat-card is-approved"
            onClick={() => navigate("/sale/history/purchase-requests")}
          >
            <div className="stat-icon-wrapper">
              <CheckCircleOutlined />
            </div>
            <div className="stat-info">
              <span>ĐƠN ĐÃ CHỐT BÁO GIÁ</span>
              <strong>{formatNumber(approvedQuotationCount)}</strong>
              <small>Đơn khách đã chấp nhận & đặt cọc</small>
            </div>
            <ArrowRightOutlined className="stat-arrow" />
          </div>

          <div
            className="stat-card is-support"
            onClick={() => navigate("/sale/customer-service")}
          >
            <div className="stat-icon-wrapper">
              <CustomerServiceOutlined />
            </div>
            <div className="stat-info">
              <span>HỖ TRỢ CSKH & TƯ VẤN</span>
              <strong>AI & Chat</strong>
              <small>Hệ thống hỗ trợ tư vấn tự động 24/7</small>
            </div>
            <ArrowRightOutlined className="stat-arrow" />
          </div>
        </section>

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

        {/* RECENT PURCHASE REQUESTS TABLE */}
        <section className="dashboard-card table-section-card">
          <div className="card-heading heading-between">
            <div className="heading-group">
              <ShoppingCartOutlined className="heading-icon" />
              <div>
                <h3>Yêu cầu Mua hộ Mới nhất</h3>
                <span>Danh sách yêu cầu mua hộ cần theo dõi và xử lý báo giá</span>
              </div>
            </div>

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
        </section>
      </main>
    </ConfigProvider>
  );
}
