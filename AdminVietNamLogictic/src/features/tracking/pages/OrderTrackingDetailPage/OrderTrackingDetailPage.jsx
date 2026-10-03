import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  AlertOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  CarOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  DollarCircleOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  InboxOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShopOutlined,
  UnlockOutlined,
  WalletOutlined,
  WarningFilled,
} from "@ant-design/icons";

import {
  completeOrder,
  getOrderTracking,
  getStageMeta,
  getTrackingApiError,
  setExportHold,
} from "@features/tracking/api/orderTrackingService";
import {
  getIncidentStatusMeta,
  getIncidentTypeLabel,
  getResolutionLabel,
  listIncidents,
} from "@features/incident";
import { getOrderPayments } from "@features/settlement";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  ReviewFacts,
  ReviewItemsTable,
  ReviewMoney,
} from "@shared/components/SubmitReview/SubmitReview";
import { REVIEW_MODAL_PROPS } from "@shared/components/SubmitReview/submitReviewFormat";
import { getPaymentStatusMeta } from "@shared/utils/paymentStatus";
import { getOrderStatusLabel, OrderReviewPanel, useOrderReview } from "@features/consignment";
import { getShipmentStatusMeta } from "@features/shipment";
import "@features/operations/styles/OperationsPage.css";
import "./OrderTrackingDetailPage.css";
import {
  getInstallmentTypeLabel,
  getParcelStatusLabel,
  getPaymentMethodLabel,
  textOr,
  translateCodesInText,
} from "@shared/utils/statusLabel";

const { Text, Paragraph } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN");
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

/* Đơn chỉ chốt tay được khi đã giao (backend tự kiểm tiếp sự cố / bồi thường / khoản treo). */
const COMPLETABLE_STATUSES = new Set(["DELIVERED", "CUSTOMER_CONFIRMED"]);

const getStageTimelineIcon = (stage) => {
  const s = String(stage || "").toUpperCase();
  if (s.includes("DELIVERED")) return <CheckCircleFilled style={{ color: "#16a34a", fontSize: 16 }} />;
  if (s.includes("OUT_FOR_DELIVERY")) return <CarOutlined style={{ color: "#2563eb", fontSize: 16 }} />;
  if (s.includes("ARRIVED") || s.includes("VN")) return <EnvironmentOutlined style={{ color: "#16a34a", fontSize: 16 }} />;
  if (s.includes("CUSTOMS")) return <SafetyCertificateOutlined style={{ color: "#0284c7", fontSize: 16 }} />;
  if (s.includes("IN_TRANSIT") || s.includes("DEPARTED") || s.includes("HANDED_OVER"))
    return <SendOutlined style={{ color: "#2563eb", fontSize: 16 }} />;
  if (s.includes("HOLD") || s.includes("DELAY") || s.includes("QUARANTINE"))
    return <WarningFilled style={{ color: "#dc2626", fontSize: 16 }} />;
  return <InboxOutlined style={{ color: "#3b82f6", fontSize: 16 }} />;
};

/**
 * Hành trình một đơn cho nhân viên & quản lý: chặng, từng kiện, chuyến quốc tế,
 * dòng thời gian sự kiện, sự cố kiện, các khoản thanh toán, giữ hàng tại kho nguồn.
 * Admin (`canComplete`) có thêm nút chốt đơn hoàn thành bằng tay.
 */
export default function OrderTrackingDetailPage({ basePath = "/sale", canComplete = false }) {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [tracking, setTracking] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [holdModal, setHoldModal] = useState(null); // { hold: boolean }
  const [holdReason, setHoldReason] = useState("");
  const [holdWarning, setHoldWarning] = useState([]);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeNote, setCompleteNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const orderReview = useOrderReview(holdModal || completeOpen ? orderId : "", {
    withPayments: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const [trackingResult, incidentResult, paymentResult] = await Promise.allSettled([
      getOrderTracking(orderId),
      listIncidents({ orderId, pageSize: 100 }),
      getOrderPayments(orderId),
    ]);

    if (trackingResult.status === "fulfilled") {
      setTracking(trackingResult.value);
    } else {
      setErrorMessage(getTrackingApiError(trackingResult.reason, "Không tải được hành trình đơn."));
    }

    setIncidents(incidentResult.status === "fulfilled" ? incidentResult.value.items || [] : []);
    setPayments(paymentResult.status === "fulfilled" ? paymentResult.value : null);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitHold = async () => {
    if (!holdModal) return;
    setSubmitting(true);
    try {
      const result = await setExportHold(orderId, { hold: holdModal.hold, reason: holdReason });
      const alreadyInRelease = Array.isArray(result?.parcelsAlreadyInApprovedRelease)
        ? result.parcelsAlreadyInApprovedRelease
        : [];
      setHoldWarning(holdModal.hold ? alreadyInRelease : []);
      AuthNotify.success(
        holdModal.hold ? "Đã bật giữ hàng" : "Đã tắt giữ hàng",
        tracking?.consignmentCode || "",
      );
      setHoldModal(null);
      load();
    } catch (error) {
      AuthNotify.error("Không đổi được giữ hàng", getTrackingApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitComplete = async () => {
    setSubmitting(true);
    try {
      await completeOrder(orderId, completeNote);
      AuthNotify.success("Đã chốt đơn hoàn thành", tracking?.consignmentCode || "");
      setCompleteOpen(false);
      load();
    } catch (error) {
      AuthNotify.error("Không chốt được đơn", getTrackingApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const stageMeta = getStageMeta(tracking?.currentStage);
  const events = Array.isArray(tracking?.events) ? [...tracking.events].reverse() : [];
  const parcels = Array.isArray(tracking?.parcels) ? tracking.parcels : [];
  const shipments = Array.isArray(tracking?.shipments) ? tracking.shipments : [];
  const openIncidents = incidents.filter(
    (row) => String(row.status || "").toUpperCase() !== "RESOLVED",
  );
  const canCompleteOrder =
    canComplete &&
    tracking &&
    COMPLETABLE_STATUSES.has(String(tracking.orderStatus || "").toUpperCase());

  /* Dữ kiện chung của đơn cho hai hộp xác nhận */
  const renderActionReview = () => {
    if (!tracking) return null;
    const unpaidCompensation = incidents.filter(
      (row) =>
        String(row.resolution || "").toUpperCase() === "COMPENSATE" && !row.compensationPaidAt,
    );
    const paymentRows = Array.isArray(payments?.payments) ? payments.payments : [];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
        <ReviewFacts
          items={[
            { label: "Mã đơn", value: <Text strong>{tracking.consignmentCode || "—"}</Text> },
            {
              label: "Trạng thái đơn",
              value: textOr(tracking.orderStatusText, getOrderStatusLabel(tracking.orderStatus)),
            },
            {
              label: "Chặng hiện tại",
              value: `${textOr(tracking.currentStageText, getStageMeta(tracking.currentStage).label)}${
                tracking.isSplitAcrossStages ? " · kiện đi tách chuyến" : ""
              }`,
            },
            {
              label: "Giữ hàng hiện tại",
              value: tracking.exportHold
                ? `Đang giữ — ${tracking.exportHoldReason || "không ghi lý do"}`
                : "Không",
            },
            {
              label: "Kiện · chuyến",
              value: `${parcels.length} kiện · ${shipments.length} chuyến`,
            },
            {
              label: "Sự cố còn mở",
              value: openIncidents.length ? (
                <Text type="danger">
                  {openIncidents.length} sự cố ({openIncidents.map((row) => row.incidentCode).join(", ")})
                </Text>
              ) : (
                "Không"
              ),
            },
            {
              label: "Bồi thường chưa chi",
              value: unpaidCompensation.length ? (
                <Text type="danger">{unpaidCompensation.length} khoản</Text>
              ) : (
                "Không"
              ),
            },
          ]}
        />
        <ReviewItemsTable
          title="Kiện của đơn"
          items={parcels}
          rowKey={(row, index) => row?.parcelId || index}
          extra={`${parcels.length} kiện`}
          columns={[
            { title: "Mã kiện", dataIndex: "packageCode", render: (v) => <Text code>{v}</Text> },
            { title: "Hàng", dataIndex: "productName", render: (v) => v || "—" },
            {
              title: "Chặng",
              dataIndex: "stage",
              render: (v, row) => (
                <Tag color={getStageMeta(v).color}>{textOr(row.stageText, getStageMeta(v).label)}</Tag>
              ),
            },
            {
              title: "Trạng thái kiện",
              dataIndex: "packageStatus",
              render: (v, row) => textOr(row.packageStatusText, getParcelStatusLabel(v)),
            },
            { title: "Chuyến", dataIndex: "shipmentCode", render: (v) => v || "—" },
          ]}
        />
        {payments ? (
          <ReviewMoney
            title="Thanh toán của đơn"
            lines={[
              { label: "Tổng hoá đơn", value: payments.totalBillAmount },
              { label: "Khách đã trả", value: payments.totalPaid, tone: "success" },
              {
                label: "Còn lại",
                value: payments.remaining,
                strong: true,
                tone: Number(payments.remaining) > 0 ? "warning" : undefined,
              },
              ...paymentRows.map((row, index) => ({
                key: row.paymentId || `p-${index}`,
                label: row.installmentType || "Khoản thanh toán",
                hint: row.paidAt ? `trả lúc ${formatDateTime(row.paidAt)}` : "",
                value: `${formatMoney(row.amount)} · ${getPaymentStatusMeta(row.paymentStatus).label}`,
              })),
            ]}
          />
        ) : (
          <Alert type="warning" showIcon message="Chưa tải được các khoản thanh toán của đơn." />
        )}
        <OrderReviewPanel
          review={orderReview}
          fallback={{ orderCode: tracking.consignmentCode }}
          showMoney={false}
          errorHint="Bạn vẫn thao tác được; dữ kiện hành trình phía trên đã đủ."
        />
      </div>
    );
  };

  return (
    <div className="ops-page tracking-detail-page">
      {/* --- HERO BANNER & INTERNATIONAL ROUTE MAP --- */}
      <section className="tracking-hero">
        <div className="tracking-hero__header">
          <div className="tracking-hero__title-group">
            <div className="tracking-hero__eyebrow">
              <GlobalOutlined />
              <span>HÀNH TRÌNH VẬN CHUYỂN QUỐC TẾ</span>
            </div>
            <div className="tracking-hero__code-row">
              <span className="tracking-hero__code">{tracking?.consignmentCode || "Đang tải mã đơn..."}</span>
              {tracking?.consignmentCode && (
                <Paragraph
                  copyable={{ text: tracking.consignmentCode, tooltips: ["Sao chép", "Đã sao chép"] }}
                  style={{ display: "inline", margin: 0, color: "#bfdbfe" }}
                />
              )}
              {tracking?.orderStatus && (
                <Tag
                  color="blue"
                  style={{
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontWeight: 700,
                    fontSize: 12,
                    border: "none",
                  }}
                >
                  {textOr(tracking.orderStatusText, getOrderStatusLabel(tracking.orderStatus))}
                </Tag>
              )}
              {tracking?.exportHold && (
                <Tag
                  color="error"
                  icon={<LockOutlined />}
                  style={{ borderRadius: 6, padding: "3px 10px", fontWeight: 700 }}
                >
                  ĐANG GIỮ HÀNG
                </Tag>
              )}
            </div>
          </div>

          <div className="tracking-hero__actions">
            <Button
              size="middle"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(`${basePath}/tracking`)}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Danh sách
            </Button>
            <Button
              size="middle"
              icon={<ReloadOutlined spin={loading} />}
              onClick={load}
              disabled={loading}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Làm mới
            </Button>
            {tracking &&
              (tracking.exportHold ? (
                <Button
                  size="middle"
                  icon={<UnlockOutlined />}
                  onClick={() => {
                    setHoldModal({ hold: false });
                    setHoldReason("");
                  }}
                  style={{ borderRadius: 8, fontWeight: 700, background: "#16a34a", color: "#fff", border: "none" }}
                >
                  Tắt giữ hàng
                </Button>
              ) : (
                <Button
                  size="middle"
                  danger
                  type="primary"
                  icon={<LockOutlined />}
                  onClick={() => {
                    setHoldModal({ hold: true });
                    setHoldReason("");
                  }}
                  style={{ borderRadius: 8, fontWeight: 700 }}
                >
                  Giữ hàng thay khách
                </Button>
              ))}
            {canComplete && tracking && (
              <Button
                size="middle"
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={!canCompleteOrder}
                onClick={() => {
                  setCompleteOpen(true);
                  setCompleteNote("");
                }}
                style={{
                  borderRadius: 8,
                  fontWeight: 700,
                  background: canCompleteOrder ? "#16a34a" : undefined,
                  borderColor: canCompleteOrder ? "#16a34a" : undefined,
                }}
              >
                Chốt đơn hoàn thành
              </Button>
            )}
          </div>
        </div>

        {/* Tuyến vận chuyển trực quan */}
        <div className="tracking-route-card">
          <div className="tracking-route-point">
            <div className="tracking-route-point__icon">
              <ShopOutlined />
            </div>
            <div className="tracking-route-point__info">
              <span className="tracking-route-point__label">Kho Nguồn</span>
              <span className="tracking-route-point__name">
                {tracking?.originWarehouseName || "Chưa xác định kho nguồn"}
              </span>
            </div>
          </div>

          <div className="tracking-route-line">
            <div className="tracking-route-line__plane">
              <SendOutlined />
            </div>
            <div className="tracking-route-line__bar" />
            <div className="tracking-route-line__meta">
              {tracking?.isSplitAcrossStages ? (
                <Tag color="orange" style={{ borderRadius: 4, fontSize: 11 }}>
                  Kiện đi tách chuyến
                </Tag>
              ) : (
                <span>Tuyến bay & vận tải xuyên biên giới</span>
              )}
            </div>
          </div>

          <div className="tracking-route-point">
            <div className="tracking-route-point__icon">
              <EnvironmentOutlined />
            </div>
            <div className="tracking-route-point__info">
              <span className="tracking-route-point__label">Kho Đích (Việt Nam)</span>
              <span className="tracking-route-point__name">
                {tracking?.destinationWarehouseName || "Chưa xác định kho đích"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --- CẢNH BÁO GIỮ HÀNG HOẶC LỖI --- */}
      {errorMessage && (
        <Alert
          type="error"
          showIcon
          message="Lỗi nạp hành trình"
          description={errorMessage}
          style={{ borderRadius: 12 }}
        />
      )}

      {tracking?.exportHold && (
        <div className="tracking-hold-banner">
          <WarningFilled className="tracking-hold-banner__icon" />
          <div>
            <strong style={{ fontSize: 14 }}>Đơn hàng đang có lệnh GIỮ HÀNG tại kho nguồn:</strong>
            <div style={{ marginTop: 2 }}>
              Lý do: <em>{tracking.exportHoldReason || "Nhân viên chưa cập nhật lý do cụ thể."}</em>
            </div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>
              Kho nguồn sẽ tạm thời không gom các kiện của đơn này lên chuyến bay/xe mới cho đến khi
              lệnh giữ hàng được mở lại.
            </div>
          </div>
        </div>
      )}

      {holdWarning.length > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => setHoldWarning([])}
          style={{ borderRadius: 12 }}
          message="Lưu ý: Các kiện sau đã nằm trong phiếu xuất kho đã duyệt"
          description={`${holdWarning.join(
            ", ",
          )}. Lệnh giữ hàng không thể tự hủy các kiện đã nằm trong phiếu xuất duyệt. Kho nguồn cần chủ động gỡ kiện khỏi phiếu.`}
        />
      )}

      <Spin spinning={loading}>
        {/* --- KPI SUMMARY METRICS (4 CARDS) --- */}
        {tracking && (
          <div className="tracking-kpi-grid">
            {/* Card 1: Chặng hiện tại */}
            <div className="tracking-kpi-card">
              <div className="tracking-kpi-card__main">
                <span className="tracking-kpi-card__label">Chặng hiện tại</span>
                <span className="tracking-kpi-card__value" style={{ fontSize: 20 }}>
                  <Tag
                    color={stageMeta.color}
                    style={{ fontSize: 14, padding: "4px 10px", borderRadius: 6, fontWeight: 700 }}
                  >
                    {textOr(tracking.currentStageText, stageMeta.label)}
                  </Tag>
                </span>
                <span className="tracking-kpi-card__sub">
                  {tracking.isSplitAcrossStages ? "Đơn đi tách chuyến" : "Toàn bộ kiện đi cùng chặng"}
                </span>
              </div>
              <div className="tracking-kpi-card__icon-box tracking-kpi-card__icon-box--blue">
                <CompassOutlined />
              </div>
            </div>

            {/* Card 2: Quy mô kiện & Chuyến */}
            <div className="tracking-kpi-card">
              <div className="tracking-kpi-card__main">
                <span className="tracking-kpi-card__label">Quy mô kiện & chuyến</span>
                <span className="tracking-kpi-card__value">{parcels.length} kiện</span>
                <span className="tracking-kpi-card__sub">
                  Phân bổ trong {shipments.length} chuyến hàng quốc tế
                </span>
              </div>
              <div className="tracking-kpi-card__icon-box tracking-kpi-card__icon-box--purple">
                <InboxOutlined />
              </div>
            </div>

            {/* Card 3: Dự kiến về Việt Nam */}
            <div className="tracking-kpi-card">
              <div className="tracking-kpi-card__main">
                <span className="tracking-kpi-card__label">Dự kiến về kho VN</span>
                <span className="tracking-kpi-card__value" style={{ fontSize: 20 }}>
                  {tracking.estimatedArrivalDate ? formatDate(tracking.estimatedArrivalDate) : "Chưa có lịch"}
                </span>
                <span className="tracking-kpi-card__sub">
                  {tracking.estimatedArrivalDate ? "Cập bến dự kiến" : "Chờ cập nhật từ hãng bay"}
                </span>
              </div>
              <div className="tracking-kpi-card__icon-box tracking-kpi-card__icon-box--green">
                <CalendarOutlined />
              </div>
            </div>

            {/* Card 4: Tình trạng thanh toán */}
            <div className="tracking-kpi-card">
              <div className="tracking-kpi-card__main">
                <span className="tracking-kpi-card__label">Thanh toán & Quyết toán</span>
                <span
                  className="tracking-kpi-card__value"
                  style={{
                    fontSize: 20,
                    color: payments && Number(payments.remaining) > 0 ? "#ea580c" : "#16a34a",
                  }}
                >
                  {payments ? formatMoney(payments.totalPaid) : "—"}
                </span>
                <span className="tracking-kpi-card__sub">
                  {payments
                    ? Number(payments.remaining) > 0
                      ? `Còn thiếu: ${formatMoney(payments.remaining)}`
                      : "Đã thanh toán đủ 100%"
                    : "Chưa có thông tin hoá đơn"}
                </span>
              </div>
              <div
                className={`tracking-kpi-card__icon-box ${
                  payments && Number(payments.remaining) > 0
                    ? "tracking-kpi-card__icon-box--amber"
                    : "tracking-kpi-card__icon-box--green"
                }`}
              >
                <WalletOutlined />
              </div>
            </div>
          </div>
        )}

        {/* --- MAIN DETAIL TABS --- */}
        {tracking && (
          <div className="tracking-main-card" style={{ marginTop: 20 }}>
            <Tabs
              defaultActiveKey="events"
              items={[
                {
                  key: "events",
                  label: (
                    <Space size={6}>
                      <ClockCircleOutlined />
                      <span>Dòng thời gian sự kiện</span>
                      <Badge count={events.length} overflowCount={99} style={{ backgroundColor: "#2563eb" }} />
                    </Space>
                  ),
                  children: (
                    <div className="tracking-tab-pane-content">
                      {events.length ? (
                        <Timeline
                          className="tracking-timeline"
                          items={events.map((event, index) => {
                            const isLatest = index === 0;
                            return {
                              key: `${event.time}-${index}`,
                              dot: getStageTimelineIcon(event.stage),
                              content: (
                                <div
                                  className={`tracking-event-card ${
                                    isLatest ? "tracking-event-card--latest" : ""
                                  }`}
                                >
                                  <div className="tracking-event-card__head">
                                    <span className="tracking-event-card__title">
                                      {textOr(event.title, getStageMeta(event.stage).label)}
                                    </span>
                                    <span className="tracking-event-card__time">
                                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                                      {formatDateTime(event.time)}
                                    </span>
                                  </div>

                                  {event.message && (
                                    <div className="tracking-event-card__message">
                                      {translateCodesInText(event.message)}
                                    </div>
                                  )}

                                  <div className="tracking-event-card__footer">
                                    {event.location && (
                                      <Space size={4}>
                                        <EnvironmentOutlined style={{ color: "#2563eb" }} />
                                        <span>{event.location}</span>
                                      </Space>
                                    )}
                                    {event.shipmentCode && (
                                      <Tag color="cyan" style={{ borderRadius: 4, margin: 0 }}>
                                        Lô: {event.shipmentCode}
                                      </Tag>
                                    )}
                                    {isLatest && (
                                      <Tag color="processing" style={{ borderRadius: 4, margin: 0 }}>
                                        Mới nhất
                                      </Tag>
                                    )}
                                  </div>
                                </div>
                              ),
                            };
                          })}
                        />
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Chưa có sự kiện hành trình nào được ghi nhận."
                        />
                      )}
                    </div>
                  ),
                },
                {
                  key: "parcels",
                  label: (
                    <Space size={6}>
                      <InboxOutlined />
                      <span>Danh sách kiện hàng</span>
                      <Badge count={parcels.length} overflowCount={99} style={{ backgroundColor: "#2563eb" }} />
                    </Space>
                  ),
                  children: (
                    <div className="tracking-tab-pane-content">
                      <Table
                        size="middle"
                        rowKey={(row, idx) => row?.parcelId || idx}
                        pagination={false}
                        dataSource={parcels}
                        scroll={{ x: 800 }}
                        columns={[
                          {
                            title: "Mã kiện hàng",
                            dataIndex: "packageCode",
                            width: 180,
                            render: (v) => (
                              <Space>
                                <Text code style={{ fontWeight: 600, fontSize: 13 }}>
                                  {v}
                                </Text>
                                {v && (
                                  <Paragraph
                                    copyable={{ text: v, tooltips: ["Sao chép", "Đã sao chép"] }}
                                    style={{ display: "inline", margin: 0 }}
                                  />
                                )}
                              </Space>
                            ),
                          },
                          {
                            title: "Mặt hàng khai báo",
                            dataIndex: "productName",
                            render: (v) => <Text strong>{v || "—"}</Text>,
                          },
                          {
                            title: "Chặng hiện tại",
                            dataIndex: "stage",
                            width: 170,
                            render: (v, row) => (
                              <Tag
                                color={getStageMeta(v).color}
                                style={{ borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}
                              >
                                {textOr(row.stageText, getStageMeta(v).label)}
                              </Tag>
                            ),
                          },
                          {
                            title: "Trạng thái kiện",
                            dataIndex: "packageStatus",
                            width: 160,
                            render: (v, row) => (
                              <Tag color="geekblue" style={{ borderRadius: 6, fontWeight: 600 }}>
                                {textOr(row.packageStatusText, getParcelStatusLabel(v))}
                              </Tag>
                            ),
                          },
                          {
                            title: "Chuyến lô quốc tế",
                            dataIndex: "shipmentCode",
                            width: 160,
                            render: (v) =>
                              v ? (
                                <Tag color="purple" style={{ borderRadius: 4, fontWeight: 700 }}>
                                  {v}
                                </Tag>
                              ) : (
                                <Text type="secondary">Chưa xếp chuyến</Text>
                              ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: "shipments",
                  label: (
                    <Space size={6}>
                      <SendOutlined />
                      <span>Chuyến lô vận chuyển</span>
                      <Badge count={shipments.length} overflowCount={99} style={{ backgroundColor: "#2563eb" }} />
                    </Space>
                  ),
                  children: (
                    <div className="tracking-tab-pane-content">
                      <Table
                        size="middle"
                        rowKey={(row, idx) => row?.shipmentCode || idx}
                        pagination={false}
                        dataSource={shipments}
                        scroll={{ x: 800 }}
                        columns={[
                          {
                            title: "Mã lô vận chuyển",
                            dataIndex: "shipmentCode",
                            width: 170,
                            render: (v) => (
                              <Tag color="geekblue" style={{ fontSize: 13, padding: "3px 8px", fontWeight: 700 }}>
                                {v || "—"}
                              </Tag>
                            ),
                          },
                          {
                            title: "Trạng thái chuyến",
                            dataIndex: "statusText",
                            width: 160,
                            render: (v, row) => (
                              <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
                                {textOr(v, getShipmentStatusMeta(row.status).label)}
                              </Tag>
                            ),
                          },
                          {
                            title: "Hãng & Mã vận đơn quốc tế",
                            key: "carrier",
                            render: (_, row) => (
                              <Space direction="vertical" size={2}>
                                <Text strong>{row.carrierName || "—"}</Text>
                                {row.carrierTrackingCode && (
                                  <Text type="secondary" code style={{ fontSize: 12 }}>
                                    {row.carrierTrackingCode}
                                  </Text>
                                )}
                              </Space>
                            ),
                          },
                          {
                            title: "Bàn giao hãng",
                            dataIndex: "handedOverAt",
                            width: 160,
                            render: formatDateTime,
                          },
                          {
                            title: "Dự kiến về VN",
                            dataIndex: "estimatedArrivalDate",
                            width: 140,
                            render: (v) =>
                              v ? (
                                <Tag color="green" style={{ borderRadius: 4, fontWeight: 600 }}>
                                  {formatDate(v)}
                                </Tag>
                              ) : (
                                "—"
                              ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: "incidents",
                  label: (
                    <Space size={6}>
                      <AlertOutlined style={{ color: openIncidents.length > 0 ? "#dc2626" : undefined }} />
                      <span>Sự cố & Khiếu nại</span>
                      <Badge
                        count={incidents.length}
                        overflowCount={99}
                        style={{
                          backgroundColor: openIncidents.length > 0 ? "#dc2626" : "#64748b",
                        }}
                      />
                    </Space>
                  ),
                  children: (
                    <div className="tracking-tab-pane-content">
                      <Table
                        size="middle"
                        rowKey="id"
                        pagination={false}
                        dataSource={incidents}
                        scroll={{ x: 800 }}
                        locale={{
                          emptyText: (
                            <div style={{ padding: "24px 0", textAlign: "center" }}>
                              <CheckCircleFilled style={{ fontSize: 36, color: "#16a34a", marginBottom: 8 }} />
                              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                                Không phát sinh sự cố
                              </div>
                              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                                Đơn hàng vận chuyển an toàn, không có khiếu nại hay bất thường nào.
                              </div>
                            </div>
                          ),
                        }}
                        columns={[
                          {
                            title: "Mã sự cố",
                            dataIndex: "incidentCode",
                            width: 150,
                            render: (v) => <Text strong style={{ color: "#dc2626" }}>{v}</Text>,
                          },
                          {
                            title: "Kiện hàng",
                            dataIndex: "packageCode",
                            width: 160,
                            render: (v) => <Text code>{v}</Text>,
                          },
                          {
                            title: "Loại sự cố",
                            dataIndex: "incidentType",
                            width: 160,
                            render: (v, row) => textOr(row.incidentTypeText, getIncidentTypeLabel(v)),
                          },
                          {
                            title: "Trạng thái",
                            dataIndex: "status",
                            width: 140,
                            render: (v) => (
                              <Tag color={getIncidentStatusMeta(v).color} style={{ borderRadius: 6 }}>
                                {getIncidentStatusMeta(v).label}
                              </Tag>
                            ),
                          },
                          {
                            title: "Khách hàng yêu cầu",
                            dataIndex: "customerChoice",
                            render: (v) => (v ? getResolutionLabel(v) : "—"),
                          },
                          {
                            title: "Quyết định xử lý",
                            dataIndex: "resolution",
                            render: (v) => (v ? <Tag color="purple">{getResolutionLabel(v)}</Tag> : "—"),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: "payments",
                  label: (
                    <Space size={6}>
                      <DollarCircleOutlined />
                      <span>Thanh toán & Quyết toán</span>
                    </Space>
                  ),
                  children: (
                    <div className="tracking-tab-pane-content">
                      {payments ? (
                        <>
                          <div className="tracking-finance-cards">
                            <div className="tracking-finance-item">
                              <div className="tracking-finance-item__label">Tổng hoá đơn dự kiến</div>
                              <div className="tracking-finance-item__value">
                                {formatMoney(payments.totalBillAmount)}
                              </div>
                            </div>

                            <div className="tracking-finance-item tracking-finance-item--paid">
                              <div className="tracking-finance-item__label">Khách đã thanh toán</div>
                              <div className="tracking-finance-item__value">
                                {formatMoney(payments.totalPaid)}
                              </div>
                            </div>

                            <div className="tracking-finance-item tracking-finance-item--remaining">
                              <div className="tracking-finance-item__label">Còn lại cần quyết toán</div>
                              <div className="tracking-finance-item__value">
                                {formatMoney(payments.remaining)}
                              </div>
                            </div>
                          </div>

                          <Table
                            size="middle"
                            rowKey="paymentId"
                            pagination={false}
                            dataSource={payments.payments || []}
                            columns={[
                              {
                                title: "Khoản thanh toán",
                                dataIndex: "installmentType",
                                render: (v) => <Text strong>{getInstallmentTypeLabel(v)}</Text>,
                              },
                              {
                                title: "Số tiền",
                                dataIndex: "amount",
                                align: "right",
                                render: (v) => <Text strong style={{ fontSize: 14 }}>{formatMoney(v)}</Text>,
                              },
                              {
                                title: "Phương thức",
                                dataIndex: "paymentMethod",
                                render: (v) => getPaymentMethodLabel(v),
                              },
                              {
                                title: "Trạng thái",
                                dataIndex: "paymentStatus",
                                render: (v) => (
                                  <Tag color={getPaymentStatusMeta(v).color} style={{ borderRadius: 6 }}>
                                    {getPaymentStatusMeta(v).label}
                                  </Tag>
                                ),
                              },
                              {
                                title: "Thời điểm ghi nhận",
                                dataIndex: "paidAt",
                                render: formatDateTime,
                              },
                            ]}
                          />
                        </>
                      ) : (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Không tải được dữ liệu thanh toán của đơn."
                        />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Spin>

      {/* --- MODAL GIỮ HÀNG / MỞ GIỮ HÀNG --- */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={Boolean(holdModal)}
        title={
          <Space>
            {holdModal?.hold ? <LockOutlined style={{ color: "#dc2626" }} /> : <UnlockOutlined style={{ color: "#16a34a" }} />}
            <span>
              {holdModal?.hold ? "Xác nhận giữ hàng tại kho nguồn thay khách" : "Xác nhận mở giữ hàng"} ·{" "}
              {tracking?.consignmentCode || ""}
            </span>
          </Space>
        }
        okText={
          orderReview.loading ? "Đang tải thông tin…" : holdModal?.hold ? "Kích hoạt giữ hàng" : "Mở giữ hàng"
        }
        cancelText="Hủy bỏ"
        okButtonProps={{
          loading: submitting,
          danger: holdModal?.hold,
          disabled: orderReview.loading || (holdModal?.hold && !holdReason.trim()),
          style: { borderRadius: 8, fontWeight: 700 },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        onOk={submitHold}
        onCancel={() => setHoldModal(null)}
        destroyOnClose
      >
        {holdModal ? renderActionReview() : null}
        {holdModal?.hold ? (
          <Space direction="vertical" size={12} style={{ width: "100%", marginTop: 8 }}>
            <Alert
              type="warning"
              showIcon
              message="Cảnh báo quy trình giữ hàng"
              description="Kho nguồn sẽ không gom các kiện của đơn này vào phiếu xuất mới và không bàn giao cho đơn vị vận tải. Sale, nhân viên kho và quản lý kho sẽ nhận được thông báo ngay lập tức."
              style={{ borderRadius: 8 }}
            />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: "#1e293b" }}>
                Lý do giữ hàng <span style={{ color: "#ef4444" }}>* (bắt buộc)</span>
              </div>
              <Input.TextArea
                rows={3}
                value={holdReason}
                onChange={(event) => setHoldReason(event.target.value)}
                placeholder="Ví dụ: Khách yêu cầu hoãn xuất để gộp chung với đơn hàng sau..."
                style={{ borderRadius: 8 }}
              />
            </div>
          </Space>
        ) : (
          <Alert
            type="info"
            showIcon
            message="Thông báo mở lưu thông"
            description="Sau khi mở giữ hàng, các kiện của đơn sẽ được tự động xếp vào chuyến vận chuyển gần nhất theo tiến độ thông thường."
            style={{ borderRadius: 8, marginTop: 8 }}
          />
        )}
      </Modal>

      {/* --- MODAL CHỐT ĐƠN HOÀN THÀNH --- */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={completeOpen}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#16a34a" }} />
            <span>Chốt hoàn tất đơn hàng {tracking?.consignmentCode || ""}</span>
          </Space>
        }
        okText={orderReview.loading ? "Đang nạp dữ liệu…" : "Chốt đơn hoàn tất"}
        cancelText="Hủy bỏ"
        okButtonProps={{
          loading: submitting,
          disabled: orderReview.loading,
          style: { borderRadius: 8, fontWeight: 700, background: "#16a34a", borderColor: "#16a34a" },
        }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
        onOk={submitComplete}
        onCancel={() => setCompleteOpen(false)}
        destroyOnClose
      >
        {completeOpen ? renderActionReview() : null}
        <Space direction="vertical" size={12} style={{ width: "100%", marginTop: 8 }}>
          <Alert
            type="warning"
            showIcon
            message="Điều kiện chốt đơn hoàn tất"
            description="Hệ thống sẽ từ chối nếu đơn còn sự cố/khiếu nại mở, khoản bồi thường chưa chi hoặc công nợ thanh toán chưa giải quyết xong."
            style={{ borderRadius: 8 }}
          />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: "#1e293b" }}>
              Ghi chú hoàn tất (không bắt buộc)
            </div>
            <Input.TextArea
              rows={3}
              value={completeNote}
              onChange={(event) => setCompleteNote(event.target.value)}
              placeholder="Ví dụ: Khách hàng đã nhận đủ hàng và ký biên bản bàn giao thuận lợi..."
              style={{ borderRadius: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
