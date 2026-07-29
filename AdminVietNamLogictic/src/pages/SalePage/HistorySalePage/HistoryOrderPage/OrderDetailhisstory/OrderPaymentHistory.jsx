import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowLeftOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DollarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  Button,
  Empty,
  Skeleton,
  Tag,
  Tooltip,
} from "antd";

import {
  getOrderPaymentHistoryApi,
} from "../../../../../api/SaleAPI/Historyapi/orderPaymentService";
import AuthNotify from "../../../../../utils/Common/AuthNotify";

import "./OrderPaymentHistory.css";

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const formatCurrency = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0 ₫";
  }

  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.round(amount))} ₫`;
};

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const ORDER_STATUS_MAP = {
  PENDING: {
    label: "Chờ xử lý",
    className: "is-warning",
  },
  PENDING_REVIEW: {
    label: "Chờ duyệt",
    className: "is-warning",
  },
  QUOTATION_SENT: {
    label: "Đã gửi báo giá",
    className: "is-info",
  },
  WAITING_DEPOSIT: {
    label: "Chờ đặt cọc",
    className: "is-warning",
  },
  DEPOSIT_PAID: {
    label: "Đã đặt cọc",
    className: "is-success",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "is-info",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "is-success",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "is-danger",
  },
};

const PAYMENT_STATUS_MAP = {
  SUCCESS: {
    label: "Thanh toán thành công",
    className: "is-success",
  },
  PENDING: {
    label: "Đang chờ thanh toán",
    className: "is-warning",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "is-info",
  },
  FAILED: {
    label: "Thanh toán thất bại",
    className: "is-danger",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "is-danger",
  },
};

const QUOTATION_STATUS_MAP = {
  PENDING: "Chờ xác nhận",
  SENT: "Đã gửi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  EXPIRED: "Đã hết hạn",
};

const INSTALLMENT_TYPE_MAP = {
  DEPOSIT: "Thanh toán đặt cọc",
  REMAINING: "Thanh toán phần còn lại",
  FULL_PAYMENT: "Thanh toán toàn bộ",
  FINAL_PAYMENT: "Thanh toán phần còn lại",
};

const PAYMENT_METHOD_MAP = {
  SEPAY: "Chuyển khoản SePay",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  CASH: "Tiền mặt",
  VNPAY: "VNPay",
  MOMO: "MoMo",
};

const getOrderStatus = (value) => {
  const code = normalizeUpperText(value);

  return (
    ORDER_STATUS_MAP[code] || {
      label: code || "Chưa xác định",
      className: "is-default",
    }
  );
};

const getPaymentStatus = (value) => {
  const code = normalizeUpperText(value);

  return (
    PAYMENT_STATUS_MAP[code] || {
      label: code || "Chưa xác định",
      className: "is-default",
    }
  );
};

const getInstallmentTypeLabel = (value) => {
  const code = normalizeUpperText(value);

  return (
    INSTALLMENT_TYPE_MAP[code] ||
    "Khoản thanh toán"
  );
};

const getPaymentMethodLabel = (value) => {
  const code = normalizeUpperText(value);

  return (
    PAYMENT_METHOD_MAP[code] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

const copyText = async (value) => {
  const text = normalizeText(value);

  if (!text) {
    throw new Error(
      "Không có nội dung để sao chép."
    );
  }

  if (
    navigator?.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text
    );

    return;
  }

  const textArea =
    document.createElement("textarea");

  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

/* =========================================================
   SMALL COMPONENTS
========================================================= */

function CopyValue({
  value,
  label = "Nội dung",
}) {
  const handleCopy = async () => {
    try {
      await copyText(value);

      AuthNotify.success(
        "Đã sao chép",
        `${label} đã được sao chép.`
      );
    } catch (error) {
      AuthNotify.error(
        "Không thể sao chép",
        error?.message ||
          "Vui lòng thử lại."
      );
    }
  };

  return (
    <div className="payment-copy-value">
      <span title={normalizeText(value)}>
        {normalizeText(value) || "—"}
      </span>

      {normalizeText(value) && (
        <Tooltip title={`Sao chép ${label}`}>
          <button
            type="button"
            className="payment-copy-button"
            onClick={handleCopy}
            aria-label={`Sao chép ${label}`}
          >
            <CopyOutlined />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function PaymentHistoryLoading() {
  return (
    <main className="payment-history-page">
      <div className="payment-history-shell">
        <Skeleton.Button
          active
          size="small"
        />

        <Skeleton
          active
          paragraph={{ rows: 10 }}
        />
      </div>
    </main>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function OrderPaymentHistory({
  orderId: orderIdProp,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const orderId =
    orderIdProp ||
    params?.orderId ||
    location?.state?.orderId ||
    location?.state?.consignment?.orderId ||
    "";

  const [history, setHistory] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadPaymentHistory =
    useCallback(async () => {
      if (!orderId) {
        setError(
          "Không tìm thấy orderId của đơn hàng."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data =
          await getOrderPaymentHistoryApi(
            orderId
          );

        setHistory(data);
      } catch (requestError) {
        const message =
          requestError?.message ||
          "Không thể tải lịch sử thanh toán.";

        setError(message);
        setHistory(null);

        AuthNotify.error(
          "Tải dữ liệu thất bại",
          message
        );
      } finally {
        setLoading(false);
      }
    }, [orderId]);

  useEffect(() => {
    loadPaymentHistory();
  }, [loadPaymentHistory]);

  const orderStatus = useMemo(
    () =>
      getOrderStatus(
        history?.orderStatus
      ),
    [history?.orderStatus]
  );

  const paymentProgress = useMemo(() => {
    const total =
      Number(history?.totalBillAmount) || 0;

    const paid =
      Number(history?.totalPaid) || 0;

    if (total <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        Math.round((paid / total) * 100)
      )
    );
  }, [
    history?.totalBillAmount,
    history?.totalPaid,
  ]);

  if (loading) {
    return <PaymentHistoryLoading />;
  }

  if (error || !history) {
    return (
      <main className="payment-history-page">
        <div className="payment-history-error">
          <div className="payment-history-error__icon">
            <FileTextOutlined />
          </div>

          <h2>
            Không thể hiển thị lịch sử thanh toán
          </h2>

          <p>
            {error ||
              "Không tìm thấy dữ liệu thanh toán."}
          </p>

          <div className="payment-history-error__actions">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
            >
              Quay lại
            </Button>

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadPaymentHistory}
            >
              Tải lại
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="payment-history-page">
      <div className="payment-history-shell">
        <div className="payment-history-topbar">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="payment-history-back"
            onClick={() => navigate(-1)}
          >
            Quay lại
          </Button>

          <Tag
            className={`payment-status-tag ${orderStatus.className}`}
          >
            {orderStatus.label}
          </Tag>
        </div>

        <section className="payment-history-hero">
          <div>
            <span className="payment-history-eyebrow">
              LỊCH SỬ THANH TOÁN
            </span>

            <h1>
              {history?.consignmentCode ||
                "Đơn hàng"}
            </h1>

            <p>
              Theo dõi tổng giá trị đơn, số tiền đã
              thanh toán và toàn bộ giao dịch phát sinh.
            </p>
          </div>

          <div className="payment-history-progress-card">
            <div>
              <span>Tiến độ thanh toán</span>
              <strong>
                {paymentProgress}%
              </strong>
            </div>

            <div className="payment-progress-track">
              <div
                className="payment-progress-value"
                style={{
                  width: `${paymentProgress}%`,
                }}
              />
            </div>

            <small>
              Đã thanh toán{" "}
              {formatCurrency(
                history?.totalPaid
              )}{" "}
              trên{" "}
              {formatCurrency(
                history?.totalBillAmount
              )}
            </small>
          </div>
        </section>

        <section className="payment-summary-grid">
          <article className="payment-summary-card">
            <div className="payment-summary-card__icon">
              <FileTextOutlined />
            </div>

            <div>
              <span>Tổng giá trị đơn</span>
              <strong>
                {formatCurrency(
                  history?.totalBillAmount
                )}
              </strong>
            </div>
          </article>

          <article className="payment-summary-card is-paid">
            <div className="payment-summary-card__icon">
              <CheckCircleOutlined />
            </div>

            <div>
              <span>Đã thanh toán</span>
              <strong>
                {formatCurrency(
                  history?.totalPaid
                )}
              </strong>
            </div>
          </article>

          <article className="payment-summary-card is-remaining">
            <div className="payment-summary-card__icon">
              <WalletOutlined />
            </div>

            <div>
              <span>Còn phải thanh toán</span>
              <strong>
                {formatCurrency(
                  history?.remaining
                )}
              </strong>
            </div>
          </article>
        </section>

        <div className="payment-info-grid">
          <section className="payment-section-card">
            <div className="payment-section-heading">
              <div className="payment-section-heading__icon">
                <UserOutlined />
              </div>

              <div>
                <span>THÔNG TIN KHÁCH HÀNG</span>
                <h2>
                  Người thanh toán
                </h2>
              </div>
            </div>

            <div className="payment-detail-grid">
              <div className="payment-detail-item">
                <span>Họ và tên</span>
                <strong>
                  {history?.customer?.fullName ||
                    "—"}
                </strong>
              </div>

              <div className="payment-detail-item">
                <span>Mã khách hàng</span>
                <CopyValue
                  value={
                    history?.customer
                      ?.customerCode
                  }
                  label="mã khách hàng"
                />
              </div>

              <div className="payment-detail-item">
                <span>Email</span>
                <strong>
                  {history?.customer?.email ||
                    "—"}
                </strong>
              </div>

              <div className="payment-detail-item">
                <span>Số điện thoại</span>
                <strong>
                  {history?.customer?.phone ||
                    "—"}
                </strong>
              </div>
            </div>
          </section>

          <section className="payment-section-card">
            <div className="payment-section-heading">
              <div className="payment-section-heading__icon">
                <SafetyCertificateOutlined />
              </div>

              <div>
                <span>THÔNG TIN BÁO GIÁ</span>
                <h2>
                  Báo giá chính thức
                </h2>
              </div>
            </div>

            <div className="payment-detail-grid">
              <div className="payment-detail-item">
                <span>Loại báo giá</span>
                <strong>
                  {normalizeUpperText(
                    history?.quotation?.quoteType
                  ) === "OFFICIAL"
                    ? "Báo giá chính thức"
                    : history?.quotation
                        ?.quoteType || "—"}
                </strong>
              </div>

              <div className="payment-detail-item">
                <span>Trạng thái báo giá</span>
                <strong>
                  {QUOTATION_STATUS_MAP[
                    normalizeUpperText(
                      history?.quotation
                        ?.status
                    )
                  ] ||
                    history?.quotation
                      ?.status ||
                    "—"}
                </strong>
              </div>

              <div className="payment-detail-item is-full">
                <span>Tổng tiền báo giá</span>
                <strong className="payment-highlight-amount">
                  {formatCurrency(
                    history?.quotation
                      ?.totalAmount
                  )}
                </strong>
              </div>
            </div>
          </section>
        </div>

        <section className="payment-section-card payment-transactions-section">
          <div className="payment-section-heading payment-section-heading--between">
            <div className="payment-section-heading__group">
              <div className="payment-section-heading__icon">
                <BankOutlined />
              </div>

              <div>
                <span>LỊCH SỬ GIAO DỊCH</span>
                <h2>Các khoản đã thanh toán</h2>
              </div>
            </div>

            <Tag className="payment-count-tag">
              {history?.payments?.length || 0} giao dịch
            </Tag>
          </div>

          {!history?.payments?.length ? (
            <div className="payment-empty">
              <Empty description="Chưa có giao dịch thanh toán" />
            </div>
          ) : (
            <div className="payment-receipt-list">
              {history.payments.map((payment, index) => {
                const status = getPaymentStatus(payment?.status);
                const isPaymentSuccess =
                  normalizeUpperText(payment?.status) === "SUCCESS";

                const transactionCode =
                  payment?.transactionCode ||
                  payment?.orderCode ||
                  payment?.paymentId ||
                  "—";

                return (
                  <article
                    key={
                      payment?.paymentId ||
                      `${payment?.orderCode}-${index}`
                    }
                    className={`payment-receipt-card ${
                      isPaymentSuccess
                        ? "payment-receipt-card--success"
                        : ""
                    }`}
                  >
                    <div className="payment-receipt-card__head">
                      <div className="payment-receipt-card__check">
                        <CheckCircleOutlined />
                      </div>

                      <div className="payment-receipt-card__head-content">
                        <h3>
                          {isPaymentSuccess
                            ? "THANH TOÁN THÀNH CÔNG!"
                            : status.label}
                        </h3>
                        <p>
                          {isPaymentSuccess
                            ? "Giao dịch đã được hệ thống ghi nhận"
                            : getInstallmentTypeLabel(
                                payment?.installmentType
                              )}
                        </p>
                      </div>

                      <Tag
                        className={`payment-status-tag ${status.className}`}
                      >
                        {status.label}
                      </Tag>
                    </div>

                    <div className="payment-receipt-card__grid">
                      <div className="payment-receipt-card__field">
                        <span>Mã giao dịch</span>
                        <CopyValue
                          value={transactionCode}
                          label="mã giao dịch"
                        />
                      </div>

                      <div className="payment-receipt-card__field">
                        <span>Thời gian thanh toán</span>
                        <strong>
                          {formatDateTime(
                            payment?.paidAt || payment?.createdAt
                          )}
                        </strong>
                      </div>

                      <div className="payment-receipt-card__field">
                        <span>Khách hàng</span>
                        <strong>
                          {history?.customer?.fullName || "—"}
                        </strong>
                      </div>

                      <div className="payment-receipt-card__field payment-receipt-card__field--amount">
                        <span>Số tiền thanh toán</span>
                        <strong>
                          {formatCurrency(payment?.amount)}
                        </strong>
                      </div>

                      <div className="payment-receipt-card__field">
                        <span>Phương thức thanh toán</span>
                        <strong>
                          {getPaymentMethodLabel(
                            payment?.paymentMethod
                          )}
                        </strong>
                      </div>

                      <div className="payment-receipt-card__field">
                        <span>Nội dung</span>
                        <strong>
                          {getInstallmentTypeLabel(
                            payment?.installmentType
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="payment-receipt-card__subheading">
                      Thông tin đơn hàng / ký gửi
                    </div>

                    <div className="payment-receipt-card__grid payment-receipt-card__grid--order">
                      <div className="payment-receipt-card__field">
                        <span>Mã đơn / ký gửi</span>
                        <CopyValue
                          value={
                            history?.consignmentCode || orderId
                          }
                          label="mã đơn ký gửi"
                        />
                      </div>

                      <div className="payment-receipt-card__field">
                        <span>Ngày ký gửi</span>
                        <strong>
                          {formatDateTime(
                            history?.createdAt ||
                              payment?.createdAt
                          )}
                        </strong>
                      </div>

                      <div className="payment-receipt-card__field">
                        <span>Tổng giá trị hàng ký gửi</span>
                        <strong>
                          {formatCurrency(
                            history?.totalBillAmount
                          )}
                        </strong>
                      </div>

                      <div className="payment-receipt-card__field">
                        <span>Trạng thái</span>
                        <Tag
                          className={`payment-status-tag ${status.className}`}
                        >
                          {status.label}
                        </Tag>
                      </div>
                    </div>

                    {isPaymentSuccess && (
                      <div className="payment-receipt-card__notice">
                        <SafetyCertificateOutlined />
                        <div>
                          <strong>
                            Hệ thống xác nhận: Khách hàng đã
                            thanh toán thành công.
                          </strong>
                          <span>
                            Sale có thể xuất phiếu nhập kho để
                            gửi khách hàng làm chứng từ xác nhận.
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="payment-receipt-card__actions">
                      <Button
                        icon={<FileTextOutlined />}
                        onClick={() =>
                          navigate(`/sale/consignments/${orderId}`, {
                            state: {
                              orderId,
                              payment,
                              paymentHistory: history,
                            },
                            }
                          )
                        }
                      >
                        Xem chi tiết
                      </Button>

                      {isPaymentSuccess && (
                        <Button
                          type="primary"
                          icon={<BankOutlined />}
                          onClick={() =>
                            navigate(
                              `/sale/warehouse-receipts/create/${orderId}`,
                              {
                                state: {
                                  orderId,
                                  paymentHistory: history,
                                  payment,
                                },
                              }
                            )
                          }
                        >
                          Xuất phiếu nhập kho
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}