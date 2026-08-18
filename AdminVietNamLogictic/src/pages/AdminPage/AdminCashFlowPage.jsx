import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PieChartOutlined,
  ReloadOutlined,
  WalletOutlined,
} from "@ant-design/icons";

import {
  approveAdminTransaction,
  getAdminFinanceOrders,
  getAdminFinanceSummary,
  getAdminFinanceTransactions,
  getAdminPendingTransactions,
  rejectAdminTransaction,
} from "../../api/AdminAPI/adminFinanceService";
import "./AdminPage.css";

const { RangePicker } = DatePicker;

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const toDateParam = (value, endOfDay = false) => {
  if (!value) return undefined;
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : null;
  if (!date) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
};

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "PARTIAL", label: "Thanh toán một phần" },
  { value: "UNPAID", label: "Chưa thanh toán" },
];

const PENDING_SOURCE_OPTIONS = [
  { value: "", label: "Cả ký gửi và mua hộ" },
  { value: "CONSIGNMENT", label: "Ký gửi" },
  { value: "PURCHASE", label: "Mua hộ" },
];

const INSTALLMENT_LABELS = {
  DEPOSIT: "Tiền cọc",
  FINAL_PAYMENT: "Tất toán",
  FULL_PAYMENT: "Trả trọn gói",
  STORAGE_FEE: "Phí lưu kho",
};

/**
 * PENDING_RECONCILIATION là khách chọn chuyển khoản tay, hệ thống không hề phát hành link cổng
 * thanh toán — bắt buộc có người đối soát. PENDING là đã phát hành link mà webhook chưa về, có thể
 * do khách chưa trả, cũng có thể do webhook rớt. Hai ca này cần Admin đọc sao kê khác nhau.
 */
const getPendingStatusMeta = (status) => {
  const key = String(status || "").toUpperCase();
  if (key === "PENDING_RECONCILIATION")
    return {
      color: "purple",
      label: "Chờ đối soát",
      hint: "Khách chọn chuyển khoản tay. Không có link cổng thanh toán nào, chỉ đối chiếu sao kê mới biết tiền đã về.",
    };
  return {
    color: "gold",
    label: "Chờ webhook",
    hint: "Đã phát hành link cổng thanh toán nhưng chưa nhận được xác nhận. Kiểm tra sao kê trước khi duyệt tay.",
  };
};

const getPaymentStatusMeta = (status) => {
  const key = String(status || "").toUpperCase();
  if (key === "PAID" || key === "SUCCESS")
    return { color: "green", label: key === "SUCCESS" ? "Thành công" : "Đã thanh toán" };
  if (key === "PARTIAL")
    return { color: "orange", label: "Một phần" };
  if (key === "UNPAID")
    return { color: "red", label: "Chưa thanh toán" };
  if (key === "PENDING")
    return { color: "gold", label: "Đang chờ" };
  if (key === "FAILED")
    return { color: "red", label: "Thất bại" };
  return { color: "default", label: key || "—" };
};

export default function AdminCashFlowPage() {
  const [activeTab, setActiveTab] = useState("orders");
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [summaryError, setSummaryError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [txError, setTxError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dateRange, setDateRange] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [txPageNumber, setTxPageNumber] = useState(1);
  const [txPageSize, setTxPageSize] = useState(20);
  const [txTotalCount, setTxTotalCount] = useState(0);

  // Tab duyệt thủ công
  const [pending, setPending] = useState([]);
  const [pendingError, setPendingError] = useState("");
  const [pendingSource, setPendingSource] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingPageNumber, setPendingPageNumber] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(20);
  const [pendingTotalCount, setPendingTotalCount] = useState(0);
  const [activeRow, setActiveRow] = useState(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [bankReference, setBankReference] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSummaryAndOrders = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setSummaryError("");
      setOrdersError("");

      const params = {
        from: toDateParam(dateRange?.[0]),
        to: toDateParam(dateRange?.[1], true),
      };

      const [summaryResult, ordersResult] = await Promise.allSettled([
        getAdminFinanceSummary(params),
        getAdminFinanceOrders({
          ...params,
          paymentStatus,
          search: searchTerm,
          pageNumber,
          pageSize,
        }),
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        setSummaryError(
          summaryResult.reason?.message ||
            "Không tải được tổng quan dòng tiền."
        );
      }

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value.items);
        setTotalCount(ordersResult.value.totalCount);
      } else {
        setOrders([]);
        setTotalCount(0);
        setOrdersError(
          ordersResult.reason?.message ||
            "Không tải được danh sách công nợ."
        );
      }

      setLoading(false);
      setRefreshing(false);
    },
    [dateRange, paymentStatus, searchTerm, pageNumber, pageSize]
  );

  const loadTransactions = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setTxError("");

      try {
        const page = await getAdminFinanceTransactions({
          from: toDateParam(dateRange?.[0]),
          to: toDateParam(dateRange?.[1], true),
          pageNumber: txPageNumber,
          pageSize: txPageSize,
        });
        setTransactions(page.items);
        setTxTotalCount(page.totalCount);
      } catch (error) {
        setTransactions([]);
        setTxTotalCount(0);
        setTxError(
          error?.message ||
            "Không tải được danh sách giao dịch thanh toán."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateRange, txPageNumber, txPageSize]
  );

  const loadPending = useCallback(
    async ({ refresh = false } = {}) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setPendingError("");

      try {
        const page = await getAdminPendingTransactions({
          pageNumber: pendingPageNumber,
          pageSize: pendingPageSize,
          source: pendingSource,
          search: pendingSearch,
        });
        setPending(page.items);
        setPendingTotalCount(page.totalCount);
      } catch (error) {
        setPending([]);
        setPendingTotalCount(0);
        setPendingError(
          error?.message || "Không tải được danh sách giao dịch chờ duyệt."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pendingPageNumber, pendingPageSize, pendingSource, pendingSearch]
  );

  const openApprove = (row) => {
    setActiveRow(row);
    setBankReference("");
    setApproveNote("");
    setApproveOpen(true);
  };

  const openReject = (row) => {
    setActiveRow(row);
    setRejectReason("");
    setRejectOpen(true);
  };

  const handleApprove = async () => {
    if (!activeRow) return;
    setSubmitting(true);
    try {
      const result = await approveAdminTransaction(activeRow.paymentId, {
        transactionCode: bankReference.trim() || null,
        note: approveNote.trim() || null,
      });
      message.success(
        result.orderStatusAfter && result.orderStatusAfter !== result.orderStatusBefore
          ? `Đã ghi nhận thu tiền. Đơn chuyển ${result.orderStatusBefore} → ${result.orderStatusAfter}.`
          : "Đã ghi nhận thu tiền."
      );
      setApproveOpen(false);
      setActiveRow(null);
      loadPending({ refresh: true });
    } catch (error) {
      message.error(error?.message || "Duyệt giao dịch thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeRow) return;
    if (!rejectReason.trim()) {
      message.warning("Phải ghi lý do từ chối.");
      return;
    }
    setSubmitting(true);
    try {
      await rejectAdminTransaction(activeRow.paymentId, rejectReason.trim());
      message.success("Đã từ chối giao dịch.");
      setRejectOpen(false);
      setActiveRow(null);
      loadPending({ refresh: true });
    } catch (error) {
      message.error(error?.message || "Từ chối giao dịch thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === "orders") {
      loadSummaryAndOrders();
      return;
    }

    if (activeTab === "pending") {
      loadPending();
      return;
    }

    // Tab giao dịch: vẫn giữ KPI summary + tải transactions
    (async () => {
      setSummaryError("");
      try {
        const nextSummary = await getAdminFinanceSummary({
          from: toDateParam(dateRange?.[0]),
          to: toDateParam(dateRange?.[1], true),
        });
        setSummary(nextSummary);
      } catch (error) {
        setSummary(null);
        setSummaryError(
          error?.message || "Không tải được tổng quan dòng tiền."
        );
      }
    })();
    loadTransactions();
  }, [activeTab, dateRange, loadSummaryAndOrders, loadTransactions, loadPending]);

  const handleRefresh = () => {
    if (activeTab === "orders") {
      loadSummaryAndOrders({ refresh: true });
    } else if (activeTab === "pending") {
      loadPending({ refresh: true });
    } else {
      loadTransactions({ refresh: true });
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(String(value || "").trim());
    setPageNumber(1);
  };

  const handleDateChange = (range) => {
    setDateRange(range);
    setPageNumber(1);
    setTxPageNumber(1);
  };

  const handleStatusChange = (value) => {
    setPaymentStatus(value || "");
    setPageNumber(1);
  };

  const orderColumns = [
    {
      title: "Mã đơn",
      dataIndex: "consignmentCode",
      fixed: "left",
      width: 170,
      render: (value, row) => (
        <div>
          <strong>{value || "—"}</strong>
          {row.orderId ? (
            <div>
              <small style={{ color: "#64748b" }}>
                #{String(row.orderId).slice(0, 8)}
              </small>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      render: (value, row) => (
        <div>
          <div>{value || "—"}</div>
          {row.customerCode ? (
            <small style={{ color: "#64748b" }}>
              {row.customerCode}
            </small>
          ) : null}
        </div>
      ),
    },
    {
      title: "Tổng bill",
      dataIndex: "totalBillAmount",
      align: "right",
      render: formatCurrency,
    },
    {
      title: "Đã thu",
      dataIndex: "totalPaid",
      align: "right",
      render: (value) => (
        <span style={{ color: "#15803d", fontWeight: 600 }}>
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      title: "Còn nợ",
      dataIndex: "remaining",
      align: "right",
      render: (value) => (
        <span
          style={{
            color: Number(value) > 0 ? "#b45309" : "#64748b",
            fontWeight: Number(value) > 0 ? 600 : 400,
          }}
        >
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      title: "Trạng thái TT",
      dataIndex: "paymentStatus",
      width: 140,
      render: (value) => {
        const meta = getPaymentStatusMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "TT gần nhất",
      dataIndex: "lastPaidAt",
      width: 150,
      render: formatDateTime,
    },
    {
      title: "Xem",
      key: "actions",
      fixed: "right",
      width: 90,
      render: (_, row) =>
        row.orderId ? (
          <Link
            to={`/admin/consignments/${row.orderId}/payments`}
            state={{ orderId: row.orderId }}
          >
            <Button size="small" type="link" icon={<EyeOutlined />}>
              Lịch sử
            </Button>
          </Link>
        ) : (
          "—"
        ),
    },
  ];

  const transactionColumns = [
    {
      title: "Mã đơn",
      dataIndex: "consignmentCode",
      fixed: "left",
      width: 170,
      render: (value, row) => (
        <div>
          <strong>{value || "—"}</strong>
          {row.orderId ? (
            <div>
              <small style={{ color: "#64748b" }}>
                #{String(row.orderId).slice(0, 8)}
              </small>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      align: "right",
      render: (value) => (
        <span style={{ fontWeight: 600 }}>{formatCurrency(value)}</span>
      ),
    },
    {
      title: "Phương thức",
      dataIndex: "paymentMethod",
      render: (value) => value || "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 130,
      render: (value) => {
        const meta = getPaymentStatusMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "Thời gian",
      dataIndex: "paidAt",
      width: 160,
      render: formatDateTime,
    },
    {
      title: "Xem",
      key: "actions",
      fixed: "right",
      width: 90,
      render: (_, row) =>
        row.orderId ? (
          <Link
            to={`/admin/consignments/${row.orderId}/payments`}
            state={{ orderId: row.orderId }}
          >
            <Button size="small" type="link" icon={<EyeOutlined />}>
              Chi tiết
            </Button>
          </Link>
        ) : (
          "—"
        ),
    },
  ];

  const pendingColumns = [
    {
      title: "Mã đơn",
      dataIndex: "consignmentCode",
      fixed: "left",
      width: 190,
      render: (value, row) => (
        <div>
          <strong>{value || "—"}</strong>
          <div>
            <Tag color={row.source === "PURCHASE" ? "geekblue" : "cyan"}>
              {row.source === "PURCHASE" ? "Mua hộ" : "Ký gửi"}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      render: (value) => value || "—",
    },
    {
      title: "Đợt",
      dataIndex: "installmentType",
      width: 120,
      render: (value) => INSTALLMENT_LABELS[value] || value || "—",
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      align: "right",
      width: 140,
      render: (value) => (
        <span style={{ fontWeight: 600 }}>{formatCurrency(value)}</span>
      ),
    },
    {
      title: "Phương thức",
      dataIndex: "paymentMethod",
      width: 120,
      render: (value) => value || "—",
    },
    {
      title: "Tình trạng",
      dataIndex: "status",
      width: 150,
      render: (value) => {
        const meta = getPendingStatusMeta(value);
        return (
          <Tooltip title={meta.hint}>
            <Tag color={meta.color}>{meta.label}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Treo",
      dataIndex: "waitingDays",
      width: 90,
      align: "right",
      render: (value) => (
        <span style={{ color: value >= 3 ? "#dc2626" : "#64748b" }}>
          {value} ngày
        </span>
      ),
    },
    {
      title: "Trạng thái đơn",
      dataIndex: "orderStatus",
      width: 170,
      render: (value) => value || "—",
    },
    {
      title: "Xử lý",
      key: "manual-actions",
      fixed: "right",
      width: 170,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => openApprove(row)}
          >
            Duyệt
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => openReject(row)}
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  const summaryItems = [
    {
      label: "Tổng phải thu",
      value: formatCurrency(summary?.totalBillAmount),
      icon: <DollarOutlined />,
    },
    {
      label: "Đã thu",
      value: formatCurrency(summary?.totalPaid),
      icon: <CheckCircleOutlined />,
    },
    {
      label: "Còn nợ",
      value: formatCurrency(summary?.remaining),
      icon: <ExclamationCircleOutlined />,
    },
    {
      label: "Đã đủ / Một phần / Chưa TT",
      value: `${summary?.paidCount ?? 0} / ${summary?.partialCount ?? 0} / ${summary?.unpaidCount ?? 0}`,
      icon: <PieChartOutlined />,
    },
    {
      label: "Tổng đơn",
      value: `${summary?.orderCount ?? 0} đơn`,
      icon: <ClockCircleOutlined />,
    },
  ];

  return (
    <div className="admin-page">
      <section className="admin-page__hero">
        <div>
          <span>VIETNAM LOGISTICS</span>
          <h1>Dòng tiền</h1>
          <p>
            Tổng quan công nợ và tình trạng thanh toán toàn bộ đơn ký gửi.
          </p>
        </div>
        <div className="admin-page__hero-count">
          <WalletOutlined />
          <strong>
            {summary ? formatCurrency(summary.totalPaid) : "—"}
          </strong>
          <span>Đã thu trong kỳ</span>
        </div>
      </section>

      {summaryError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Không tải được tổng quan dòng tiền"
          description={summaryError}
          action={
            <Button size="small" onClick={handleRefresh}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      <section className="admin-page__panel">
        <div className="admin-page__toolbar">
          <Space size="middle" wrap>
            <RangePicker
              value={dateRange}
              onChange={handleDateChange}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              allowClear
            />
            {activeTab === "orders" ? (
              <>
                <Select
                  value={paymentStatus}
                  options={PAYMENT_STATUS_OPTIONS}
                  onChange={handleStatusChange}
                  style={{ minWidth: 200 }}
                />
                <Input.Search
                  allowClear
                  placeholder="Tìm mã đơn, khách hàng..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onSearch={handleSearch}
                  style={{ width: 280 }}
                />
              </>
            ) : null}
            {activeTab === "pending" ? (
              <>
                <Select
                  value={pendingSource}
                  options={PENDING_SOURCE_OPTIONS}
                  onChange={(value) => {
                    setPendingSource(value || "");
                    setPendingPageNumber(1);
                  }}
                  style={{ minWidth: 200 }}
                />
                <Input.Search
                  allowClear
                  placeholder="Tìm mã đơn, khách hàng..."
                  defaultValue={pendingSearch}
                  onSearch={(value) => {
                    setPendingSearch(String(value || "").trim());
                    setPendingPageNumber(1);
                  }}
                  style={{ width: 280 }}
                />
              </>
            ) : null}
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              disabled={refreshing || loading}
              onClick={handleRefresh}
            >
              Làm mới
            </Button>
          </Space>
        </div>

        {/* Tab duyệt tay không dùng KPI kỳ này, mà chỉ quan tâm khoản đang treo. */}
        {!summaryError && activeTab !== "pending" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {summaryItems.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: 16,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: "#64748b" }}>{item.label}</span>
                  <span style={{ color: "#2563eb" }}>{item.icon}</span>
                </div>
                <strong style={{ fontSize: 18 }}>
                  {loading && !summary ? "…" : item.value}
                </strong>
              </div>
            ))}
          </div>
        ) : null}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "orders",
              label: `Công nợ theo đơn (${totalCount})`,
              children:
                ordersError && !orders.length ? (
                  <Alert
                    type="error"
                    showIcon
                    message="Không tải được danh sách công nợ"
                    description={ordersError}
                    action={
                      <Button size="small" onClick={handleRefresh}>
                        Thử lại
                      </Button>
                    }
                  />
                ) : (
                  <div className="admin-page__table">
                    <Table
                      rowKey={(row) =>
                        row.orderId || row.consignmentCode
                      }
                      columns={orderColumns}
                      dataSource={orders}
                      loading={loading && activeTab === "orders"}
                      pagination={{
                        current: pageNumber,
                        pageSize,
                        total: totalCount,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} đơn`,
                        onChange: (page, size) => {
                          setPageNumber(page);
                          setPageSize(size);
                        },
                      }}
                      scroll={{ x: 1100 }}
                      locale={{
                        emptyText:
                          "Không có dữ liệu thanh toán theo bộ lọc.",
                      }}
                    />
                  </div>
                ),
            },
            {
              key: "transactions",
              label: `Giao dịch gần đây (${txTotalCount})`,
              children:
                txError && !transactions.length ? (
                  <Alert
                    type="error"
                    showIcon
                    message="Không tải được giao dịch"
                    description={txError}
                    action={
                      <Button size="small" onClick={handleRefresh}>
                        Thử lại
                      </Button>
                    }
                  />
                ) : (
                  <div className="admin-page__table">
                    <Table
                      rowKey={(row) =>
                        row.paymentId ||
                        `${row.orderId}-${row.paidAt}`
                      }
                      columns={transactionColumns}
                      dataSource={transactions}
                      loading={loading && activeTab === "transactions"}
                      pagination={{
                        current: txPageNumber,
                        pageSize: txPageSize,
                        total: txTotalCount,
                        showSizeChanger: true,
                        showTotal: (total) => `Tổng ${total} giao dịch`,
                        onChange: (page, size) => {
                          setTxPageNumber(page);
                          setTxPageSize(size);
                        },
                      }}
                      scroll={{ x: 900 }}
                      locale={{
                        emptyText: "Chưa có giao dịch thanh toán.",
                      }}
                    />
                  </div>
                ),
            },
            {
              key: "pending",
              label: `Duyệt thủ công (${pendingTotalCount})`,
              children:
                pendingError && !pending.length ? (
                  <Alert
                    type="error"
                    showIcon
                    message="Không tải được giao dịch chờ duyệt"
                    description={pendingError}
                    action={
                      <Button size="small" onClick={handleRefresh}>
                        Thử lại
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="Đối chiếu sao kê ngân hàng trước khi bấm duyệt"
                      description="Duyệt là ghi nhận đã thu tiền thật: đơn sẽ nhảy trạng thái y như khi cổng thanh toán báo về, và Sale lập được phiếu tiếp theo. Thao tác này không có nút hoàn tác."
                    />
                    <div className="admin-page__table">
                      <Table
                        rowKey={(row) => row.paymentId}
                        columns={pendingColumns}
                        dataSource={pending}
                        loading={loading && activeTab === "pending"}
                        pagination={{
                          current: pendingPageNumber,
                          pageSize: pendingPageSize,
                          total: pendingTotalCount,
                          showSizeChanger: true,
                          showTotal: (total) => `Tổng ${total} khoản chờ duyệt`,
                          onChange: (page, size) => {
                            setPendingPageNumber(page);
                            setPendingPageSize(size);
                          },
                        }}
                        scroll={{ x: 1300 }}
                        locale={{
                          emptyText: "Không có khoản nào đang chờ đối soát.",
                        }}
                      />
                    </div>
                  </>
                ),
            },
          ]}
        />
      </section>

      <Modal
        open={approveOpen}
        title="Xác nhận đã nhận được tiền"
        okText="Ghi nhận đã thu"
        cancelText="Huỷ"
        confirmLoading={submitting}
        onOk={handleApprove}
        onCancel={() => setApproveOpen(false)}
      >
        {activeRow ? (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Đơn">
                {activeRow.consignmentCode || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {activeRow.customerName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Số tiền">
                <strong>{formatCurrency(activeRow.amount)}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Đợt">
                {INSTALLMENT_LABELS[activeRow.installmentType] ||
                  activeRow.installmentType ||
                  "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Nội dung CK">
                {activeRow.orderCode ?? "—"}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>
                Mã giao dịch trên sao kê{" "}
                <span style={{ color: "#64748b" }}>(nên nhập để đối chiếu về sau)</span>
              </div>
              <Input
                value={bankReference}
                onChange={(event) => setBankReference(event.target.value)}
                placeholder="VD: FT26081712345678"
              />
            </div>

            <div>
              <div style={{ marginBottom: 4 }}>Ghi chú</div>
              <Input.TextArea
                rows={2}
                value={approveNote}
                onChange={(event) => setApproveNote(event.target.value)}
                placeholder="Ai xác nhận, đối chiếu theo sao kê ngày nào..."
              />
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        open={rejectOpen}
        title="Từ chối giao dịch"
        okText="Từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Huỷ"
        confirmLoading={submitting}
        onOk={handleReject}
        onCancel={() => setRejectOpen(false)}
      >
        {activeRow ? (
          <>
            <p>
              Từ chối khoản <strong>{formatCurrency(activeRow.amount)}</strong> của đơn{" "}
              <strong>{activeRow.consignmentCode || "—"}</strong>. Khoản này sẽ chuyển sang
              CANCELLED và khách phải tạo lại đợt thanh toán mới.
            </p>
            <div style={{ marginBottom: 4 }}>Lý do (bắt buộc)</div>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="VD: không tìm thấy khoản tiền tương ứng trên sao kê ngày 17/08"
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}
