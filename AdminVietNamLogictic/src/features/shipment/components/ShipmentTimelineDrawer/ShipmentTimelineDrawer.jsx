import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  FilePdfOutlined,
  FlagOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  getShipmentApiError,
  getShipmentDetail,
  getShipmentStatusMeta,
  getShipmentTimeline,
  MILESTONE_REQUIREMENT_NOTE,
  openShipmentManifest,
  updateShipmentMilestone,
} from "@features/shipment/api/internationalShipmentService";
import {
  ATTACHMENT_ENTITY,
  AttachmentList,
  AttachmentUploadButton,
  getDocumentTypeLabel,
} from "@features/attachments";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import ActionErrorAlert from "@shared/components/ActionErrorAlert/ActionErrorAlert";
import { createLoadSequencer, createRowActionRunner } from "@shared/utils/rowActionGuard";
import {
  ReviewFacts,
  ReviewItemsTable,
} from "@shared/components/SubmitReview/SubmitReview";
import { REVIEW_MODAL_PROPS } from "@shared/components/SubmitReview/submitReviewFormat";
import OrderTypeTag from "@shared/components/OrderTypeTag/OrderTypeTag";
import { getParcelStatusLabel, textOr } from "@shared/utils/statusLabel";
import { countPurchaseRecords, isPurchaseRecord } from "@shared/components/OrderTypeTag/orderType";
import { subTablePagination } from "@shared/utils/tablePagination";

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

/* Loại giấy tờ Sale được up thêm vào lô sau bàn giao (api-xuat-kho.md J3). */
const SALE_DOCUMENT_TYPES = ["CUSTOMS_IMPORT", "INCIDENT", "TAX_RECEIPT", "OTHER"];

const EMPTY_FORM = { note: "", customerMessage: "", location: "", carrierTrackingCode: "" };

/**
 * Chi tiết một lô cho Sale / OM / Admin: dòng thời gian, nút ghi mốc theo `nextMilestones`,
 * giấy tờ còn thiếu kèm nút tải lên, đơn bị ảnh hưởng, kiện trong lô và manifest PDF.
 *
 * @param {{ shipmentId?: string, open: boolean, onClose: () => void, canUpdate?: boolean,
 *   onChanged?: () => void, onOpenOrder?: (orderId: string) => void }} props
 */
export default function ShipmentTimelineDrawer({
  shipmentId,
  open,
  onClose,
  canUpdate = true,
  onChanged,
  onOpenOrder,
}) {
  const [timeline, setTimeline] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [milestone, setMilestone] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [uploadType, setUploadType] = useState("CUSTOMS_IMPORT");
  const [manifestBusy, setManifestBusy] = useState(false);

  /*
   * CHỐNG GHI MỐC HAI LẦN: mỗi lô chỉ một lời gọi ghi mốc đang bay (bấm đúp / Enter + chuột không
   * gọi API lần hai); lỗi hiện ngay trong hộp, hộp không đóng; ghi xong mốc vừa ghi rời danh sách
   * nút ngay; chỉ lần tải mới nhất được ghi vào ngăn (đổi lô / tải lại chồng nhau không đè nhau).
   */
  const [runMilestone] = useState(createRowActionRunner);
  const [loadSeq] = useState(createLoadSequencer);
  const [milestoneError, setMilestoneError] = useState("");

  const load = useCallback(async () => {
    if (!shipmentId) return;
    const seq = loadSeq.next();
    setLoading(true);
    setErrorMessage("");
    /* Timeline là phần chính; chi tiết lô (kiện, phiếu) hỏng thì vẫn xem được hành trình. */
    const [timelineResult, detailResult] = await Promise.allSettled([
      getShipmentTimeline(shipmentId),
      getShipmentDetail(shipmentId),
    ]);

    if (!loadSeq.isLatest(seq)) return;

    if (timelineResult.status === "fulfilled") setTimeline(timelineResult.value);
    else setErrorMessage(getShipmentApiError(timelineResult.reason, "Không tải được hành trình lô."));

    setDetail(detailResult.status === "fulfilled" ? detailResult.value : null);
    setLoading(false);
  }, [shipmentId, loadSeq]);

  useEffect(() => {
    if (open && shipmentId) {
      setTimeline(null);
      setDetail(null);
      load();
    }
  }, [open, shipmentId, load]);

  const reloadAll = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const openMilestone = (item) => {
    if (runMilestone.isBusy(shipmentId)) return;
    setMilestone(item);
    setMilestoneError("");
    setForm({ ...EMPTY_FORM, carrierTrackingCode: "" });
  };

  const noteRequired = Boolean(milestone?.requirements?.includes(MILESTONE_REQUIREMENT_NOTE));

  const submitMilestone = async () => {
    if (!milestone || runMilestone.isBusy(shipmentId)) return;

    const recorded = milestone;
    setMilestoneError("");
    setSubmitting(true);

    const outcome = await runMilestone(shipmentId, () =>
      updateShipmentMilestone(shipmentId, {
        status: recorded.status,
        ...form,
        noteRequired,
      }),
    );

    if (outcome.skipped) return;

    setSubmitting(false);

    if (!outcome.ok) {
      setMilestoneError(getShipmentApiError(outcome.error, "Vui lòng thử lại."));
      return;
    }

    AuthNotify.success(
      "Đã ghi mốc hành trình",
      `${textOr(recorded.text, getShipmentStatusMeta(recorded.status).label)} — khách của từng đơn trong lô đã nhận thông báo.`,
    );
    setMilestone(null);
    /* Mốc vừa ghi rời danh sách nút ngay, không chờ tải lại xong mới mất. */
    setTimeline((current) =>
      current && Array.isArray(current.nextMilestones)
        ? { ...current, nextMilestones: current.nextMilestones.filter((item) => item.status !== recorded.status) }
        : current,
    );
    await reloadAll();
  };

  const openManifest = async () => {
    setManifestBusy(true);
    try {
      await openShipmentManifest(shipmentId, timeline?.shipmentCode || detail?.shipmentCode);
    } catch (error) {
      AuthNotify.error("Không mở được manifest", getShipmentApiError(error, "Vui lòng thử lại."));
    } finally {
      setManifestBusy(false);
    }
  };

  const summary = timeline || detail || {};
  const statusMeta = getShipmentStatusMeta(summary.status);
  const nextMilestones = Array.isArray(timeline?.nextMilestones) ? timeline.nextMilestones : [];
  /* Server trả sự kiện cũ → mới; đảo lại để mốc mới nhất nằm trên cùng. */
  const events = Array.isArray(timeline?.events) ? [...timeline.events].reverse() : [];

  const milestonePanel = (
    <>
      {nextMilestones.length === 0 ? (
        <Alert
          type="info"
          showIcon
          message="Lô không còn mốc nào để ghi"
          description="Lô chưa bàn giao cho hãng, đã tới kho đích hoặc đã huỷ."
        />
      ) : (
        <Space direction="vertical" style={{ width: "100%" }}>
          {nextMilestones.map((item) => {
            const missing = Array.isArray(item.missingDocuments) ? item.missingDocuments : [];
            const blocked = missing.length > 0;
            return (
              <div key={item.status} className="shipment-milestone-row">
                <Space wrap>
                  <Tooltip
                    title={
                      blocked
                        ? `Thiếu: ${missing.map(getDocumentTypeLabel).join(", ")}`
                        : item.requirements?.includes(MILESTONE_REQUIREMENT_NOTE)
                          ? "Bắt buộc ghi chú lý do"
                          : ""
                    }
                  >
                    <Button
                      type="primary"
                      icon={<FlagOutlined />}
                      disabled={!canUpdate || blocked || submitting}
                      onClick={() => openMilestone(item)}
                    >
                      {textOr(item.text, getShipmentStatusMeta(item.status).label)}
                    </Button>
                  </Tooltip>
                  {item.requirements?.includes(MILESTONE_REQUIREMENT_NOTE) ? (
                    <Tag color="orange">Cần ghi chú</Tag>
                  ) : null}
                  {canUpdate &&
                    missing.map((documentType) => (
                      <AttachmentUploadButton
                        key={documentType}
                        entityType={ATTACHMENT_ENTITY.SHIPMENT}
                        entityId={shipmentId}
                        documentType={documentType}
                        label={`Tải ${getDocumentTypeLabel(documentType).toLowerCase()}`}
                        buttonProps={{ danger: true, size: "middle" }}
                        onUploaded={reloadAll}
                      />
                    ))}
                </Space>
              </div>
            );
          })}
        </Space>
      )}
    </>
  );

  const eventsPanel = events.length ? (
    <Timeline
      items={events.map((event) => ({
        key: event.id || `${event.time}-${event.status}`,
        color: getShipmentStatusMeta(event.status).color === "error" ? "red" : "blue",
        content: (
          <Space direction="vertical" size={2}>
            <Space wrap>
              <Tag color={getShipmentStatusMeta(event.status).color}>
                {textOr(event.statusText, getShipmentStatusMeta(event.status).label)}
              </Tag>
              <Text type="secondary">{formatDateTime(event.time)}</Text>
              <Text type="secondary">· {event.createdByName || "Hệ thống"}</Text>
            </Space>
            {event.location ? (
              <Text>
                <EnvironmentOutlined /> {event.location}
              </Text>
            ) : null}
            {event.customerMessage ? (
              <Text>
                <Text strong>Khách thấy:</Text> {event.customerMessage}
              </Text>
            ) : (
              <Text type="secondary">Khách nhận câu mặc định của mốc.</Text>
            )}
            {event.note ? (
              <Text type="secondary">
                <Text strong type="secondary">
                  Nội bộ:
                </Text>{" "}
                {event.note}
              </Text>
            ) : null}
          </Space>
        ),
      }))}
    />
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có mốc hành trình nào." />
  );

  return (
    <Drawer
      open={open}
      width={1000}
      onClose={onClose}
      title={`Lô ${summary.shipmentCode || ""}`}
      extra={
        <Space>
          <Button icon={<FilePdfOutlined />} loading={manifestBusy} onClick={openManifest}>
            Manifest PDF
          </Button>
          <Button icon={<ReloadOutlined spin={loading} />} onClick={load} disabled={loading}>
            Tải lại
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        {errorMessage ? (
          <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 12 }} />
        ) : null}

        <Space wrap style={{ marginBottom: 12 }}>
          <Tag color={statusMeta.color}>{textOr(summary.statusText, statusMeta.label)}</Tag>
          {timeline?.isOverdue ? (
            <Tag color="error" icon={<WarningOutlined />}>
              Quá ngày dự kiến
            </Tag>
          ) : null}
          {timeline?.needsUpdate ? (
            <Tag color="warning" icon={<ClockCircleOutlined />}>
              {timeline.daysSinceLastUpdate} ngày chưa có mốc mới
            </Tag>
          ) : null}
        </Space>

        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Kho đi → kho đến">
            {summary.originWarehouseName || "—"} → {summary.destinationWarehouseName || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Hãng vận chuyển">{summary.carrierName || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mã tra cứu của hãng">
            {summary.carrierTrackingCode || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Bàn giao lúc">
            {formatDateTime(timeline?.handedOverAt || detail?.shippedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Dự kiến về">{formatDate(timeline?.estimatedArrivalDate)}</Descriptions.Item>
          <Descriptions.Item label="Cập nhật gần nhất">{formatDateTime(timeline?.lastUpdateAt)}</Descriptions.Item>
          <Descriptions.Item label="Quy mô">
            {timeline?.orderCount ?? "—"} đơn · {timeline?.parcelCount ?? detail?.totalPackages ?? "—"} kiện
          </Descriptions.Item>
          <Descriptions.Item label="Tổng cân">
            {detail?.totalWeight != null ? `${Number(detail.totalWeight).toLocaleString("vi-VN")} kg` : "—"}
          </Descriptions.Item>
        </Descriptions>

        <Title level={5} style={{ marginTop: 20 }}>
          Ghi mốc tiếp theo
        </Title>
        {milestonePanel}

        <Tabs
          style={{ marginTop: 16 }}
          items={[
            { key: "events", label: `Dòng thời gian (${events.length})`, children: eventsPanel },
            {
              key: "orders",
              label: `Đơn bị ảnh hưởng (${timeline?.orders?.length || 0})`,
              children: (
                <Table
                  size="small"
                  rowKey="orderId"
                  pagination={subTablePagination("đơn")}
                  dataSource={timeline?.orders || []}
                  columns={[
                    {
                      title: "Mã đơn",
                      dataIndex: "consignmentCode",
                      render: (value, row) =>
                        onOpenOrder ? (
                          <Button type="link" style={{ padding: 0 }} onClick={() => onOpenOrder(row.orderId)}>
                            {value || "—"}
                          </Button>
                        ) : (
                          <Text code>{value || "—"}</Text>
                        ),
                    },
                    { title: "Khách hàng", dataIndex: "customerName", render: (v) => v || "—" },
                    { title: "Số kiện", dataIndex: "parcelCount", align: "center", width: 100 },
                  ]}
                />
              ),
            },
            {
              key: "parcels",
              label: `Kiện & phiếu (${detail?.parcels?.length || 0})`,
              children: (
                <>
                  <Space wrap style={{ marginBottom: 8 }}>
                    {(detail?.wroRequests || []).map((wro) => (
                      <Tag key={wro.wroRequestId}>{wro.wroCode}</Tag>
                    ))}
                    {countPurchaseRecords(detail?.parcels) ? (
                      <Text type="secondary">
                        · {countPurchaseRecords(detail?.parcels)} kiện mua hộ /{" "}
                        {(detail?.parcels || []).length} kiện
                      </Text>
                    ) : null}
                  </Space>
                  <Table
                    size="small"
                    rowKey="parcelId"
                    pagination={subTablePagination("kiện")}
                    dataSource={detail?.parcels || []}
                    columns={[
                      { title: "Mã kiện", dataIndex: "packageCode", render: (v) => <Text code>{v}</Text> },
                      {
                        title: "Đơn",
                        dataIndex: "orderCode",
                        filters: [
                          { text: "Mua hộ", value: "PURCHASE" },
                          { text: "Ký gửi", value: "CONSIGNMENT" },
                        ],
                        onFilter: (value, row) => (value === "PURCHASE") === isPurchaseRecord(row),
                        render: (v, row) => (
                          <Space size={6} wrap>
                            <span>{v || "—"}</span>
                            <OrderTypeTag record={row} />
                          </Space>
                        ),
                      },
                      { title: "Khách", dataIndex: "customerName", render: (v) => v || "—" },
                      {
                        title: "Cân nặng",
                        dataIndex: "weight",
                        align: "right",
                        render: (v) => (v != null ? `${Number(v).toLocaleString("vi-VN")} kg` : "—"),
                      },
                      {
                        title: "Trạng thái kiện",
                        dataIndex: "packageStatus",
                        render: (v, row) => <Tag>{textOr(row.packageStatusText, getParcelStatusLabel(v))}</Tag>,
                      },
                    ]}
                  />
                </>
              ),
            },
            {
              key: "documents",
              label: `Giấy tờ (${timeline?.attachments?.length || 0})`,
              children: (
                <>
                  {canUpdate ? (
                    <Space style={{ marginBottom: 12 }} wrap>
                      <Select
                        value={uploadType}
                        style={{ width: 240 }}
                        onChange={setUploadType}
                        options={SALE_DOCUMENT_TYPES.map((value) => ({
                          value,
                          label: getDocumentTypeLabel(value),
                        }))}
                      />
                      <AttachmentUploadButton
                        entityType={ATTACHMENT_ENTITY.SHIPMENT}
                        entityId={shipmentId}
                        documentType={uploadType}
                        label="Tải lên"
                        onUploaded={reloadAll}
                      />
                    </Space>
                  ) : null}
                  <AttachmentList items={timeline?.attachments || []} />
                </>
              ),
            },
          ]}
        />
      </Spin>

      {/*
        Ghi mốc = báo cho MỌI khách có đơn trong lô. Hộp trước đây không có cả mã lô; giờ hiện đủ
        lô đang ở đâu, mốc cũ → mốc mới, và danh sách đơn / khách sẽ nhận thông báo (đã nạp sẵn
        trên drawer, không gọi thêm).
      */}
      <Modal
        {...REVIEW_MODAL_PROPS}
        open={!!milestone}
        title={`Ghi mốc: ${milestone ? textOr(milestone.text, getShipmentStatusMeta(milestone.status).label) : ""} · lô ${summary.shipmentCode || ""}`}
        okText="Ghi mốc và báo khách"
        cancelText="Huỷ"
        okButtonProps={{ loading: submitting, disabled: noteRequired && !form.note.trim() }}
        cancelButtonProps={{ disabled: submitting }}
        closable={!submitting}
        maskClosable={!submitting}
        keyboard={!submitting}
        onOk={submitMilestone}
        onCancel={() => {
          if (!submitting) setMilestone(null);
        }}
        footer={(origin) => (
          <>
            <ActionErrorAlert error={milestoneError} title="Không ghi được mốc" />
            {origin}
          </>
        )}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Mỗi mốc gửi thông báo cho chủ của từng đơn trong lô. Không lùi được mốc — ghi sai thì ghi thêm mốc đúng kèm ghi chú."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
          <ReviewFacts
            items={[
              { label: "Lô", value: <Text strong>{summary.shipmentCode || "—"}</Text> },
              {
                label: "Mốc hiện tại → mốc mới",
                value: `${textOr(summary.statusText, statusMeta.label)} → ${
                  textOr(milestone?.text, getShipmentStatusMeta(milestone?.status).label)
                }`,
              },
              {
                label: "Kho đi → kho đến",
                value: `${summary.originWarehouseName || "—"} → ${summary.destinationWarehouseName || "—"}`,
              },
              { label: "Hãng vận chuyển", value: summary.carrierName },
              {
                label: "Quy mô",
                value: `${timeline?.orderCount ?? "—"} đơn · ${
                  timeline?.parcelCount ?? detail?.totalPackages ?? "—"
                } kiện${
                  detail?.totalWeight != null
                    ? ` · ${Number(detail.totalWeight).toLocaleString("vi-VN")} kg`
                    : ""
                }`,
              },
              { label: "Cập nhật gần nhất", value: formatDateTime(timeline?.lastUpdateAt) },
            ]}
          />
          <ReviewItemsTable
            title="Đơn / khách sẽ nhận thông báo"
            items={timeline?.orders || []}
            rowKey={(row, index) => row?.orderId || index}
            extra={`${(timeline?.orders || []).length} đơn`}
            columns={[
              { title: "Mã đơn", dataIndex: "consignmentCode", render: (v) => <Text code>{v || "—"}</Text> },
              { title: "Khách hàng", dataIndex: "customerName", render: (v) => v || "—" },
              { title: "Số kiện", dataIndex: "parcelCount", align: "center", width: 100 },
            ]}
            scrollX={500}
          />
        </div>
        <Space direction="vertical" style={{ width: "100%" }} size={10}>
          <div>
            <Text strong>Lời nhắn cho khách</Text>
            <Input.TextArea
              rows={2}
              value={form.customerMessage}
              onChange={(e) => setForm((f) => ({ ...f, customerMessage: e.target.value }))}
              placeholder="Khách thấy trong thông báo và màn theo dõi đơn. Bỏ trống thì khách nhận câu mặc định."
            />
          </div>
          <div>
            <Text strong>Ghi chú nội bộ {noteRequired ? <Text type="danger">*</Text> : null}</Text>
            <Input.TextArea
              rows={2}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder={
                noteRequired
                  ? "Bắt buộc — lý do trễ / tạm giữ. Khách không bao giờ thấy."
                  : "Khách không bao giờ thấy (không bắt buộc)."
              }
            />
          </div>
          <Input
            addonBefore="Vị trí hàng"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="Cảng, sân bay, cửa khẩu… (khách thấy)"
          />
          <Input
            addonBefore="Mã tra cứu của hãng"
            value={form.carrierTrackingCode}
            onChange={(e) => setForm((f) => ({ ...f, carrierTrackingCode: e.target.value }))}
            placeholder={summary.carrierTrackingCode ? `Hiện tại: ${summary.carrierTrackingCode}` : "Gửi thì ghi đè"}
          />
        </Space>
      </Modal>
    </Drawer>
  );
}
