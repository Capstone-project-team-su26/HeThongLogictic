import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Radio,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { CheckOutlined, DollarOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";

import {
  getAllowedResolutions,
  getIncidentApiError,
  getIncidentDetail,
  getIncidentStatusMeta,
  getIncidentTypeLabel,
  getResolutionLabel,
  isAwaitingCompensation,
  listAwaitingCompensation,
  listIncidents,
  markCompensationPaid,
  requiresIncidentPhoto,
  resolveIncident,
} from "@features/incident/api/parcelIncidentService";
import { ATTACHMENT_ENTITY, AttachmentList, AttachmentUploadButton } from "@features/attachments";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "@features/operations/styles/OperationsPage.css";

const { Text, Title } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatMoney = (value) =>
  value == null ? "—" : `${Number(value).toLocaleString("vi-VN")}đ`;

/* Tab ảo "chờ chi bồi thường" — không phải status của backend (xem listAwaitingCompensation). */
const AWAITING_COMPENSATION_TAB = "AWAITING_COMPENSATION";

const TABS_BY_MODE = {
  decide: [
    { key: "OPEN,CUSTOMER_RESPONDED", label: "Cần quyết định" },
    { key: "RESOLVED", label: "Đã xử lý" },
    { key: "", label: "Tất cả" },
  ],
  compensate: [
    { key: AWAITING_COMPENSATION_TAB, label: "Chờ chi bồi thường" },
    { key: "OPEN,CUSTOMER_RESPONDED", label: "Đang mở" },
    { key: "RESOLVED", label: "Đã xử lý" },
    { key: "", label: "Tất cả" },
  ],
  view: [
    { key: "OPEN,CUSTOMER_RESPONDED", label: "Đang mở" },
    { key: "RESOLVED", label: "Đã xử lý" },
    { key: "", label: "Tất cả" },
  ],
};

/**
 * Sự cố hàng hoá ở chặng Việt Nam — một workspace, ba vai:
 *   - mode="decide"     quản lý kho / OM: xem ảnh hiện trạng, quyết ACCEPT / COMPENSATE / DISPOSE;
 *   - mode="compensate" Admin: sự cố đã quyết bồi thường → tải chứng từ + ghi mã giao dịch đã chi;
 *   - mode="view"       Sale: chỉ đọc (để trả lời khách).
 * Quyền thật nằm ở backend (người lập biên bản không tự quyết, kho có quản lý riêng...).
 */
export default function IncidentWorkspace({
  mode = "view",
  eyebrow,
  title = "Sự Cố Hàng Hoá",
  subtitle = "",
}) {
  const tabs = TABS_BY_MODE[mode] || TABS_BY_MODE.view;
  const [statusTab, setStatusTab] = useState(tabs[0].key);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [resolveForm, setResolveForm] = useState({ resolution: "", amount: null, note: "" });
  const [payForm, setPayForm] = useState({ reference: "", note: "" });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      if (statusTab === AWAITING_COMPENSATION_TAB) {
        setRows(await listAwaitingCompensation());
      } else {
        const page = await listIncidents({ status: statusTab, pageSize: 100 });
        setRows(page.items);
      }
    } catch (error) {
      setErrorMessage(getIncidentApiError(error, "Không tải được danh sách sự cố."));
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const loadDetail = useCallback(async (incidentId) => {
    setDetailLoading(true);
    try {
      const full = await getIncidentDetail(incidentId);
      setDetail(full);
      return full;
    } catch (error) {
      AuthNotify.error("Lỗi tải sự cố", getIncidentApiError(error, "Không tải được chi tiết sự cố."));
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = useCallback(
    async (row) => {
      setDetail(row);
      /* Khách đã chọn thì đổ sẵn lựa chọn đó — quản lý kho thường chỉ việc xác nhận. */
      const allowed = getAllowedResolutions(row.incidentType);
      const preset = allowed.includes(String(row.customerChoice || "").toUpperCase())
        ? String(row.customerChoice).toUpperCase()
        : allowed.length === 1
          ? allowed[0]
          : "";
      setResolveForm({ resolution: preset, amount: null, note: "" });
      setPayForm({ reference: "", note: "" });
      await loadDetail(row.id);
    },
    [loadDetail],
  );

  const visibleRows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.incidentCode, row.packageCode, row.consignmentCode, row.customerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const submitResolve = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      await resolveIncident(detail, {
        resolution: resolveForm.resolution,
        compensationAmount: resolveForm.amount,
        note: resolveForm.note,
      });
      AuthNotify.success(
        "Đã quyết định sự cố",
        `${detail.incidentCode || ""}: ${getResolutionLabel(resolveForm.resolution)} — khách đã nhận thông báo.`,
      );
      setDetail(null);
      fetchRows();
    } catch (error) {
      AuthNotify.error("Không quyết định được", getIncidentApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitPaid = async () => {
    if (!detail) return;
    setSubmitting(true);
    try {
      await markCompensationPaid(detail, payForm);
      AuthNotify.success(
        "Đã ghi nhận chi bồi thường",
        `${detail.incidentCode || ""}: ${formatMoney(detail.compensationAmount)} — khách đã nhận thông báo.`,
      );
      setDetail(null);
      fetchRows();
    } catch (error) {
      AuthNotify.error("Không ghi nhận được", getIncidentApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Mã sự cố",
        dataIndex: "incidentCode",
        width: 170,
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value || "—"}
          </Button>
        ),
      },
      {
        title: "Loại",
        dataIndex: "incidentType",
        width: 150,
        render: (value, row) => <Tag color="volcano">{row.incidentTypeText || getIncidentTypeLabel(value)}</Tag>,
      },
      {
        title: "Kiện / đơn",
        key: "parcel",
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text code>{row.packageCode || "—"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.consignmentCode || ""} · {row.customerName || ""}
            </Text>
          </Space>
        ),
      },
      {
        title: "Khách chọn",
        dataIndex: "customerChoice",
        width: 170,
        render: (value, row) =>
          value ? (
            <Tag color="blue">{getResolutionLabel(value)}</Tag>
          ) : row.awaitsCustomerChoice ? (
            <Text type="warning">Chưa chọn</Text>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: "Quyết định",
        key: "resolution",
        width: 200,
        render: (_, row) =>
          row.resolution ? (
            <Space direction="vertical" size={0}>
              <Tag color="green">{getResolutionLabel(row.resolution)}</Tag>
              {String(row.resolution).toUpperCase() === "COMPENSATE" ? (
                <Text type={row.compensationPaidAt ? "success" : "warning"} style={{ fontSize: 12 }}>
                  {formatMoney(row.compensationAmount)} ·{" "}
                  {row.compensationPaidAt ? "đã chi" : "chưa chi"}
                </Text>
              ) : null}
            </Space>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 150,
        render: (value) => {
          const meta = getIncidentStatusMeta(value);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      { title: "Mở lúc", dataIndex: "reportedAt", width: 165, render: formatDateTime },
    ],
    [openDetail],
  );

  const status = String(detail?.status || "").toUpperCase();
  const canDecide = mode === "decide" && detail && status !== "RESOLVED";
  const canPay = mode === "compensate" && detail && isAwaitingCompensation(detail);
  const allowedResolutions = getAllowedResolutions(detail?.incidentType);
  const hasPhoto = (detail?.attachments || []).some(
    (item) => String(item.documentType).toUpperCase() === "INCIDENT_PHOTO",
  );
  const hasReceipt = (detail?.attachments || []).some(
    (item) => String(item.documentType).toUpperCase() === "COMPENSATION_RECEIPT",
  );
  const needsChoiceNote = Boolean(detail?.awaitsCustomerChoice && !detail?.customerChoice);

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Đang hiển thị</small>
            <strong>{visibleRows.length} sự cố</strong>
          </div>
          <Button type="primary" icon={<ReloadOutlined spin={loading} />} disabled={loading} onClick={fetchRows}>
            Làm mới
          </Button>
        </div>
      </section>

      {!!errorMessage && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message={errorMessage} />
      )}

      <Tabs activeKey={statusTab} onChange={setStatusTab} items={tabs} />

      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          placeholder="Tìm mã sự cố, mã kiện, mã đơn, tên khách"
          style={{ width: 340 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={visibleRows}
        scroll={{ x: 1150 }}
        pagination={{ pageSize: 15, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="Không có sự cố nào." /> }}
      />

      <Drawer
        open={!!detail}
        width={880}
        onClose={() => setDetail(null)}
        title={detail ? `Sự cố ${detail.incidentCode || ""}` : "Chi tiết sự cố"}
      >
        {detail ? (
          <Spin spinning={detailLoading}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={getIncidentStatusMeta(detail.status).color}>
                {getIncidentStatusMeta(detail.status).label}
              </Tag>
              <Tag color="volcano">{detail.incidentTypeText || getIncidentTypeLabel(detail.incidentType)}</Tag>
              {detail.stage ? <Tag>{detail.stage === "AFTER_DELIVERY" ? "Sau khi giao" : "Lúc tiếp nhận"}</Tag> : null}
            </Space>

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Kiện">{detail.packageCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Đơn">{detail.consignmentCode || "—"}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">{detail.customerName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Người lập">
                {detail.reportedByName || "—"} · {formatDateTime(detail.reportedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả" span={2}>
                {detail.description || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Khách chọn">
                {detail.customerChoice ? getResolutionLabel(detail.customerChoice) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Khách phản hồi lúc">
                {formatDateTime(detail.customerRespondedAt)}
              </Descriptions.Item>
              {detail.customerNote ? (
                <Descriptions.Item label="Lời khách" span={2}>
                  {detail.customerNote}
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="Quyết định">
                {detail.resolution ? getResolutionLabel(detail.resolution) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Người quyết">
                {detail.resolvedByName ? `${detail.resolvedByName} · ${formatDateTime(detail.resolvedAt)}` : "—"}
              </Descriptions.Item>
              {detail.resolutionNote ? (
                <Descriptions.Item label="Ghi chú quyết định" span={2}>
                  {detail.resolutionNote}
                </Descriptions.Item>
              ) : null}
              {String(detail.resolution || "").toUpperCase() === "COMPENSATE" ? (
                <>
                  <Descriptions.Item label="Tiền bồi thường">{formatMoney(detail.compensationAmount)}</Descriptions.Item>
                  <Descriptions.Item label="Đã chi">
                    {detail.compensationPaidAt
                      ? `${formatDateTime(detail.compensationPaidAt)} · ${detail.compensationReference || ""}`
                      : "Chưa chi"}
                  </Descriptions.Item>
                </>
              ) : null}
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>
              Ảnh hiện trạng và chứng từ
            </Title>
            {mode === "decide" && status !== "RESOLVED" ? (
              <Space style={{ marginBottom: 8 }}>
                <AttachmentUploadButton
                  entityType={ATTACHMENT_ENTITY.INCIDENT}
                  entityId={detail.id}
                  documentType="INCIDENT_PHOTO"
                  label="Tải ảnh hiện trạng"
                  onUploaded={() => loadDetail(detail.id)}
                />
              </Space>
            ) : null}
            <AttachmentList items={detail.attachments || []} showThumbnails emptyText="Chưa có ảnh / chứng từ." />

            {canDecide ? (
              <>
                <Title level={5} style={{ marginTop: 20 }}>
                  Quyết định xử lý
                </Title>
                {requiresIncidentPhoto(detail) && !hasPhoto ? (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    style={{ marginBottom: 12 }}
                    message="Chưa có ảnh hiện trạng — tải ảnh lên trước khi quyết định."
                  />
                ) : null}
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Radio.Group
                    value={resolveForm.resolution}
                    onChange={(event) => setResolveForm((f) => ({ ...f, resolution: event.target.value }))}
                    options={allowedResolutions.map((value) => ({ value, label: getResolutionLabel(value) }))}
                  />
                  {resolveForm.resolution === "COMPENSATE" ? (
                    <InputNumber
                      min={0}
                      step={10000}
                      style={{ width: 260 }}
                      addonBefore="Tiền bồi thường"
                      addonAfter="đ"
                      value={resolveForm.amount}
                      formatter={(value) => (value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "")}
                      parser={(value) => String(value || "").replace(/\./g, "")}
                      onChange={(value) => setResolveForm((f) => ({ ...f, amount: value }))}
                    />
                  ) : null}
                  {resolveForm.resolution === "DISPOSE" ? (
                    <Alert
                      type="warning"
                      showIcon
                      message="Huỷ hàng: kiện chuyển DISPOSED — không tính cước, không giao, nhả ô kệ."
                    />
                  ) : null}
                  <Input.TextArea
                    rows={3}
                    value={resolveForm.note}
                    onChange={(event) => setResolveForm((f) => ({ ...f, note: event.target.value }))}
                    placeholder={
                      needsChoiceNote
                        ? "Bắt buộc — khách chưa chọn cách xử lý, ghi lý do quyết định thay (ví dụ: khách không phản hồi)."
                        : "Ghi chú (không bắt buộc)."
                    }
                  />
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={submitting}
                    disabled={
                      !resolveForm.resolution ||
                      (requiresIncidentPhoto(detail) && !hasPhoto) ||
                      (needsChoiceNote && !resolveForm.note.trim()) ||
                      (resolveForm.resolution === "COMPENSATE" && !(Number(resolveForm.amount) > 0))
                    }
                    onClick={submitResolve}
                  >
                    Ghi quyết định
                  </Button>
                </Space>
              </>
            ) : null}

            {canPay ? (
              <>
                <Title level={5} style={{ marginTop: 20 }}>
                  Ghi nhận đã chi bồi thường {formatMoney(detail.compensationAmount)}
                </Title>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space>
                    <AttachmentUploadButton
                      entityType={ATTACHMENT_ENTITY.INCIDENT}
                      entityId={detail.id}
                      documentType="COMPENSATION_RECEIPT"
                      label="Tải chứng từ chi"
                      buttonProps={{ danger: !hasReceipt }}
                      onUploaded={() => loadDetail(detail.id)}
                    />
                    {hasReceipt ? <Tag color="success">Đã có chứng từ</Tag> : <Text type="warning">Bắt buộc có chứng từ trước</Text>}
                  </Space>
                  <Input
                    addonBefore="Mã giao dịch"
                    value={payForm.reference}
                    onChange={(event) => setPayForm((f) => ({ ...f, reference: event.target.value }))}
                    placeholder="Mã chuyển khoản ngân hàng"
                  />
                  <Input.TextArea
                    rows={2}
                    value={payForm.note}
                    onChange={(event) => setPayForm((f) => ({ ...f, note: event.target.value }))}
                    placeholder="Ghi chú (không bắt buộc)"
                  />
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    loading={submitting}
                    disabled={!hasReceipt || !payForm.reference.trim()}
                    onClick={submitPaid}
                  >
                    Ghi nhận đã chi
                  </Button>
                </Space>
              </>
            ) : null}
          </Spin>
        ) : null}
      </Drawer>
    </div>
  );
}
