import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Descriptions,
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
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  UnlockOutlined,
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
/* Khách (kèm mã) + hàng khai của đơn cho hai hộp xác nhận — hành trình không mang mấy thứ này. */
import { getOrderStatusLabel, OrderReviewPanel, useOrderReview } from "@features/consignment";
import { getShipmentStatusMeta } from "@features/shipment";
import "@features/operations/styles/OperationsPage.css";
import {
  getInstallmentTypeLabel,
  getParcelStatusLabel,
  getPaymentMethodLabel,
  textOr,
  translateCodesInText,
} from "@shared/utils/statusLabel";

const { Text, Title } = Typography;

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

/**
 * Hành trình một đơn cho nhân viên: chặng, từng kiện, chuyến, dòng thời gian khách thấy,
 * sự cố của đơn (chỉ đọc), các khoản thanh toán, giữ hàng tại kho nguồn thay khách.
 * Admin (`canComplete`) có thêm nút chốt đơn hoàn thành bằng tay.
 *
 * @param {{ basePath?: string, canComplete?: boolean }} props
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

  /*
   * Hai hộp ghi của màn (bật / tắt giữ hàng, chốt đơn hoàn thành) trước đây chỉ có một câu
   * mô tả, thậm chí không có mã đơn. Giờ hiện đủ: đơn, chặng, từng kiện bị ảnh hưởng, sự cố
   * còn mở, tiền còn lại — phần lớn đã nạp sẵn trên màn — cộng khách + hàng khai của đơn.
   */
  const orderReview = useOrderReview(holdModal || completeOpen ? orderId : "", {
    withPayments: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    /* Hành trình là phần lõi; sự cố / thanh toán hỏng thì vẫn xem được hành trình. */
    const [trackingResult, incidentResult, paymentResult] = await Promise.allSettled([
      getOrderTracking(orderId),
      listIncidents({ orderId, pageSize: 100 }),
      getOrderPayments(orderId),
    ]);

    if (trackingResult.status === "fulfilled") setTracking(trackingResult.value);
    else setErrorMessage(getTrackingApiError(trackingResult.reason, "Không tải được hành trình đơn."));

    setIncidents(incidentResult.status === "fulfilled" ? incidentResult.value.items : []);
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
      /* Cờ giữ hàng chỉ chặn phiếu lập sau — kiện đã trong phiếu đã duyệt VẪN đi; phải nói rõ. */
      setHoldWarning(holdModal.hold ? alreadyInRelease : []);
      AuthNotify.success(holdModal.hold ? "Đã bật giữ hàng" : "Đã tắt giữ hàng", tracking?.consignmentCode || "");
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


  /* Dữ kiện chung của đơn cho hai hộp xác nhận. */
  const renderActionReview = () => {
    if (!tracking) return null;
    const parcels = Array.isArray(tracking.parcels) ? tracking.parcels : [];
    const openIncidents = incidents.filter(
      (row) => String(row.status || "").toUpperCase() !== "RESOLVED",
    );
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
            { label: "Trạng thái đơn", value: textOr(tracking.orderStatusText, getOrderStatusLabel(tracking.orderStatus)) },
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
              value: `${parcels.length} kiện · ${(tracking.shipments || []).length} chuyến`,
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
            { title: "Trạng thái kiện", dataIndex: "packageStatus", render: (v, row) => textOr(row.packageStatusText, getParcelStatusLabel(v)) },
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
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>HÀNH TRÌNH ĐƠN</span>
          <h1>{tracking?.consignmentCode || "Đơn ký gửi"}</h1>
          <p>
            {tracking?.originWarehouseName || "—"} → {tracking?.destinationWarehouseName || "—"} · dự kiến về{" "}
            {formatDate(tracking?.estimatedArrivalDate)}
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`${basePath}/tracking`)}>
            Danh sách
          </Button>
          <Button icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading}>
            Tải lại
          </Button>
          {tracking &&
            (tracking.exportHold ? (
              <Button icon={<UnlockOutlined />} onClick={() => { setHoldModal({ hold: false }); setHoldReason(""); }}>
                Tắt giữ hàng
              </Button>
            ) : (
              <Button danger icon={<LockOutlined />} onClick={() => { setHoldModal({ hold: true }); setHoldReason(""); }}>
                Giữ hàng thay khách
              </Button>
            ))}
          {canComplete && tracking && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={!COMPLETABLE_STATUSES.has(String(tracking.orderStatus || "").toUpperCase())}
              onClick={() => {
                setCompleteOpen(true);
                setCompleteNote("");
              }}
            >
              Chốt đơn hoàn thành
            </Button>
          )}
        </div>
      </section>

      <Spin spinning={loading}>
        {errorMessage && <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />}

        {holdWarning.length > 0 && (
          <Alert
            type="warning"
            showIcon
            closable
            onClose={() => setHoldWarning([])}
            style={{ marginBottom: 16 }}
            message="Các kiện sau đã nằm trong phiếu xuất đã duyệt — giữ hàng KHÔNG dừng được"
            description={`${holdWarning.join(", ")}. Muốn dừng thì kho phải chủ động bỏ kiện khỏi phiếu.`}
          />
        )}

        {tracking && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Chặng hiện tại">
                <Tag color={stageMeta.color}>{textOr(tracking.currentStageText, stageMeta.label)}</Tag>
                {tracking.isSplitAcrossStages ? <Tag color="orange">Kiện đi tách chuyến</Tag> : null}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái đơn">
                {textOr(tracking.orderStatusText, getOrderStatusLabel(tracking.orderStatus))}
              </Descriptions.Item>
              <Descriptions.Item label="Giữ hàng tại kho nguồn" span={2}>
                {tracking.exportHold ? (
                  <Text type="danger">Đang giữ — {tracking.exportHoldReason || "không ghi lý do"}</Text>
                ) : (
                  "Không"
                )}
              </Descriptions.Item>
            </Descriptions>

            <Tabs
              items={[
                {
                  key: "events",
                  label: `Dòng thời gian (${events.length})`,
                  children: events.length ? (
                    <Timeline
                      items={events.map((event, index) => ({
                        key: `${event.time}-${index}`,
                        color: getStageMeta(event.stage).color === "error" ? "red" : "blue",
                        content: (
                          <Space direction="vertical" size={0}>
                            <Space wrap>
                              <Text strong>{textOr(event.title, getStageMeta(event.stage).label)}</Text>
                              <Text type="secondary">{formatDateTime(event.time)}</Text>
                              {event.shipmentCode ? <Tag>{event.shipmentCode}</Tag> : null}
                            </Space>
                            {event.message ? <Text>{translateCodesInText(event.message)}</Text> : null}
                            {event.location ? <Text type="secondary">{event.location}</Text> : null}
                          </Space>
                        ),
                      }))}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có sự kiện." />
                  ),
                },
                {
                  key: "parcels",
                  label: `Kiện (${tracking.parcels?.length || 0})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="parcelId"
                      pagination={false}
                      dataSource={tracking.parcels || []}
                      columns={[
                        { title: "Mã kiện", dataIndex: "packageCode", render: (v) => <Text code>{v}</Text> },
                        { title: "Hàng", dataIndex: "productName", render: (v) => v || "—" },
                        {
                          title: "Chặng",
                          dataIndex: "stage",
                          render: (v, row) => <Tag color={getStageMeta(v).color}>{textOr(row.stageText, getStageMeta(v).label)}</Tag>,
                        },
                        { title: "Trạng thái kiện", dataIndex: "packageStatus", render: (v, row) => textOr(row.packageStatusText, getParcelStatusLabel(v)) },
                        { title: "Chuyến", dataIndex: "shipmentCode", render: (v) => v || "—" },
                      ]}
                    />
                  ),
                },
                {
                  key: "shipments",
                  label: `Chuyến (${tracking.shipments?.length || 0})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="shipmentCode"
                      pagination={false}
                      dataSource={tracking.shipments || []}
                      columns={[
                        { title: "Mã lô", dataIndex: "shipmentCode" },
                        { title: "Trạng thái", dataIndex: "statusText", render: (v, row) => textOr(v, getShipmentStatusMeta(row.status).label) },
                        {
                          title: "Hãng / mã tra cứu",
                          key: "carrier",
                          render: (_, row) => `${row.carrierName || "—"}${row.carrierTrackingCode ? ` · ${row.carrierTrackingCode}` : ""}`,
                        },
                        { title: "Bàn giao", dataIndex: "handedOverAt", render: formatDateTime },
                        { title: "Dự kiến về", dataIndex: "estimatedArrivalDate", render: formatDate },
                      ]}
                    />
                  ),
                },
                {
                  key: "incidents",
                  label: `Sự cố (${incidents.length})`,
                  children: (
                    <Table
                      size="small"
                      rowKey="id"
                      pagination={false}
                      dataSource={incidents}
                      locale={{ emptyText: "Đơn không có sự cố." }}
                      columns={[
                        { title: "Mã", dataIndex: "incidentCode" },
                        { title: "Kiện", dataIndex: "packageCode" },
                        { title: "Loại", dataIndex: "incidentType", render: (v, row) => textOr(row.incidentTypeText, getIncidentTypeLabel(v)) },
                        {
                          title: "Trạng thái",
                          dataIndex: "status",
                          render: (v) => <Tag color={getIncidentStatusMeta(v).color}>{getIncidentStatusMeta(v).label}</Tag>,
                        },
                        { title: "Khách chọn", dataIndex: "customerChoice", render: (v) => (v ? getResolutionLabel(v) : "—") },
                        { title: "Quyết định", dataIndex: "resolution", render: (v) => (v ? getResolutionLabel(v) : "—") },
                      ]}
                    />
                  ),
                },
                {
                  key: "payments",
                  label: "Thanh toán",
                  children: payments ? (
                    <>
                      <Descriptions size="small" column={3} bordered style={{ marginBottom: 12 }}>
                        <Descriptions.Item label="Tổng hoá đơn">{formatMoney(payments.totalBillAmount)}</Descriptions.Item>
                        <Descriptions.Item label="Đã trả">{formatMoney(payments.totalPaid)}</Descriptions.Item>
                        <Descriptions.Item label="Còn lại">{formatMoney(payments.remaining)}</Descriptions.Item>
                      </Descriptions>
                      <Table
                        size="small"
                        rowKey="paymentId"
                        pagination={false}
                        dataSource={payments.payments || []}
                        columns={[
                          { title: "Loại", dataIndex: "installmentType", render: (v) => getInstallmentTypeLabel(v) },
                          { title: "Số tiền", dataIndex: "amount", align: "right", render: formatMoney },
                          { title: "Phương thức", dataIndex: "paymentMethod", render: (v) => getPaymentMethodLabel(v) },
                          {
                            title: "Trạng thái",
                            dataIndex: "paymentStatus",
                            render: (v) => <Tag color={getPaymentStatusMeta(v).color}>{getPaymentStatusMeta(v).label}</Tag>,
                          },
                          { title: "Trả lúc", dataIndex: "paidAt", render: formatDateTime },
                        ]}
                      />
                    </>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không tải được các khoản thanh toán." />
                  ),
                },
              ]}
            />
          </>
        )}
      </Spin>

      <Modal
        {...REVIEW_MODAL_PROPS}
        open={!!holdModal}
        title={`${holdModal?.hold ? "Giữ hàng tại kho nguồn thay khách" : "Tắt giữ hàng"} · ${
          tracking?.consignmentCode || ""
        }`}
        okText={
          orderReview.loading ? "Đang tải thông tin…" : holdModal?.hold ? "Bật giữ hàng" : "Tắt giữ hàng"
        }
        cancelText="Huỷ"
        okButtonProps={{
          loading: submitting,
          danger: holdModal?.hold,
          disabled: orderReview.loading || (holdModal?.hold && !holdReason.trim()),
        }}
        onOk={submitHold}
        onCancel={() => setHoldModal(null)}
      >
        {holdModal ? renderActionReview() : null}
        {holdModal?.hold ? (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="Kho sẽ không đưa kiện của đơn vào phiếu xuất mới và không bàn giao được lô chứa đơn này. Sale, kho và quản lý kho nhận thông báo."
            />
            <Title level={5}>Lý do (bắt buộc)</Title>
            <Input.TextArea
              rows={3}
              value={holdReason}
              onChange={(event) => setHoldReason(event.target.value)}
              placeholder="Ví dụ: khách muốn gộp chuyến sau."
            />
          </>
        ) : (
          <Text>Hàng của đơn sẽ được xếp vào chuyến gần nhất như bình thường.</Text>
        )}
      </Modal>

      <Modal
        {...REVIEW_MODAL_PROPS}
        open={completeOpen}
        title={`Chốt đơn ${tracking?.consignmentCode || ""} hoàn thành`}
        okText={orderReview.loading ? "Đang tải thông tin…" : "Chốt đơn"}
        cancelText="Huỷ"
        okButtonProps={{ loading: submitting, disabled: orderReview.loading }}
        onOk={submitComplete}
        onCancel={() => setCompleteOpen(false)}
      >
        {completeOpen ? renderActionReview() : null}
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Còn sự cố / khiếu nại mở, bồi thường chưa chi hoặc khoản thu đang chờ thì hệ thống từ chối kèm lý do."
        />
        <Input.TextArea
          rows={3}
          value={completeNote}
          onChange={(event) => setCompleteNote(event.target.value)}
          placeholder="Ghi chú (không bắt buộc) — ví dụ: khách đã xác nhận qua điện thoại."
        />
      </Modal>
    </div>
  );
}
