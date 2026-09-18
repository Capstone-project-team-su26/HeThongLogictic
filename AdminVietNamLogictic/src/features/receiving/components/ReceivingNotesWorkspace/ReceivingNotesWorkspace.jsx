import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  approveReceivingNote,
  AWAITING_TAB_KEY,
  getApprovalStageMeta,
  getReceivingApiError,
  getReceivingNoteDetail,
  getReceivingStatusMeta,
  listReceivingNotes,
  RECEIVING_STATUS_TABS,
  rejectReceivingNote,
} from "@features/receiving/api/receivingNoteService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import { toPublicReceiptUrl } from "@shared/utils/receiptUrl";

const { Text, Title } = Typography;

/**
 * Màn phiếu nhập kho gốc — dùng chung cho quản lý kho / OM (hàng đợi duyệt) và Admin (tra cứu).
 *
 * Mỗi phiếu chờ quyết định ở một trong hai giai đoạn (`approvalStage`):
 *   - RECEIVE: Sale vừa lập, duyệt thì phiếu ACTIVE + có PDF để khách mang hàng tới;
 *   - DISCREPANCY: kho kiểm đếm bị lệch, duyệt thì chốt biên bản cho xếp kệ.
 *
 * Khác nhau giữa các màn truyền bằng prop:
 *   - `defaultStatus`: OM mở thẳng tab "Cần quyết định", Admin mở tab "Tất cả"
 *   - `canApprove`: có hiện nút duyệt / từ chối không (quyền thật nằm ở BE)
 *   - `requireApproveReason`: Admin duyệt thay quản lý kho → bắt buộc ghi lý do
 */

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("vi-VN") : "—";
};

/** Chênh lệch tô màu: âm là thiếu, dương là thừa, 0 thì im lặng cho đỡ rối mắt. */
function DiffCell({ value, suffix = "" }) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) {
    return <Text type="secondary">—</Text>;
  }
  const isShort = number < 0;
  return (
    <Text strong style={{ color: isShort ? "#cf1322" : "#d46b08" }}>
      {number > 0 ? "+" : ""}
      {formatNumber(number)}
      {suffix}
    </Text>
  );
}

export default function ReceivingNotesWorkspace({
  title = "Phiếu tiếp nhận kho gốc",
  subtitle = "Sale lập phiếu sau khi khách đặt cọc. Quản lý kho duyệt để khách mang hàng tới, và xem biên bản khi kho kiểm đếm bị lệch.",
  eyebrow = "BỘ PHẬN VẬN HÀNH (OPS)",
  defaultStatus = AWAITING_TAB_KEY,
  canApprove = true,
  requireApproveReason = false,
}) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusTab, setStatusTab] = useState(defaultStatus);
  const [keyword, setKeyword] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [approveTarget, setApproveTarget] = useState(null);
  const [approveReason, setApproveReason] = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const result = await listReceivingNotes({ status: statusTab, search: keyword.trim() });
      setRows(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      setErrorMessage(getReceivingApiError(error, "Không tải được danh sách phiếu tiếp nhận."));
    } finally {
      setLoading(false);
    }
  }, [statusTab, keyword]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const awaitingCount = useMemo(() => rows.filter((row) => row.awaitingApproval).length, [rows]);
  const discrepancyCount = useMemo(
    () => rows.filter((row) => row.hasDiscrepancy).length,
    [rows],
  );

  const openDetail = useCallback(async (row) => {
    setDetail({ ...row, items: [], expectedItems: [] });
    setDetailLoading(true);
    try {
      const full = await getReceivingNoteDetail(row.id);
      if (full) setDetail({ ...row, ...full });
    } catch (error) {
      AuthNotify.error(
        "Lỗi tải phiếu",
        getReceivingApiError(error, "Không tải được chi tiết phiếu tiếp nhận."),
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openApprove = useCallback((row) => {
    setApproveTarget(row);
    setApproveReason("");
  }, []);

  const handleApprove = useCallback(
    async () => {
      const row = approveTarget;
      if (!row) return;
      setSubmitting(true);
      try {
        const updated = await approveReceivingNote(row.id, approveReason);
        const isReceiveStage =
          String(row.approvalStage || "").toUpperCase() === "RECEIVE" ||
          String(updated?.status || "").toUpperCase() === "ACTIVE";
        AuthNotify.success(
          "Đã duyệt phiếu",
          isReceiveStage
            ? `Phiếu ${row.receivingNoteCode} đã duyệt, khách nhận được PDF để mang hàng tới kho.`
            : `Đã chốt biên bản phiếu ${row.receivingNoteCode}. Kho xếp kiện lên kệ được rồi.`,
        );
        setApproveTarget(null);
        setApproveReason("");
        setDetail(null);
        await fetchRows();
      } catch (error) {
        AuthNotify.error(
          "Duyệt thất bại",
          getReceivingApiError(error, "Không duyệt được phiếu tiếp nhận."),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [approveTarget, approveReason, fetchRows],
  );

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    setSubmitting(true);
    try {
      await rejectReceivingNote(rejectTarget.id, rejectReason);
      AuthNotify.success(
        "Đã từ chối phiếu",
        `Phiếu ${rejectTarget.receivingNoteCode} bị từ chối, người liên quan đã nhận thông báo.`,
      );
      setRejectTarget(null);
      setRejectReason("");
      setDetail(null);
      await fetchRows();
    } catch (error) {
      AuthNotify.error(
        "Từ chối thất bại",
        getReceivingApiError(error, "Không từ chối được phiếu tiếp nhận."),
      );
    } finally {
      setSubmitting(false);
    }
  }, [rejectTarget, rejectReason, fetchRows]);

  const columns = useMemo(
    () => [
      {
        title: "Mã phiếu",
        dataIndex: "receivingNoteCode",
        width: 160,
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value || "—"}
          </Button>
        ),
      },
      {
        title: "Đơn ký gửi",
        dataIndex: "consignmentCode",
        width: 190,
        render: (value) => <Text code>{value || "—"}</Text>,
      },
      {
        title: "Khách hàng",
        dataIndex: "customerName",
        render: (value, row) => (
          <div>
            <div>{value || "—"}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.customerPhone || ""}
            </Text>
          </div>
        ),
      },
      { title: "Kho tiếp nhận", dataIndex: "warehouseName", render: (v) => v || "—" },
      {
        title: "Đối chiếu",
        key: "checked",
        align: "center",
        width: 130,
        render: (_, row) => (
          <Tooltip title="Số dòng kho đã cân đếm / số dòng khách khai">
            <Text>
              {formatNumber(row.checkedItemCount)} / {formatNumber(row.declaredItemCount)}
            </Text>
          </Tooltip>
        ),
      },
      {
        title: "Kiện",
        dataIndex: "parcelCount",
        align: "center",
        width: 80,
        render: (v) => formatNumber(v),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 190,
        render: (value, row) => {
          const meta = getReceivingStatusMeta(value);
          return (
            <Space direction="vertical" size={2}>
              <Tag color={meta.tone}>{row.statusText || meta.label}</Tag>
              {row.awaitingApproval && getApprovalStageMeta(row.approvalStage) ? (
                <Tag color={getApprovalStageMeta(row.approvalStage).color}>
                  Chờ: {getApprovalStageMeta(row.approvalStage).label}
                </Tag>
              ) : null}
              {row.hasDiscrepancy ? (
                <Tag color="error" icon={<WarningOutlined />}>
                  Có chênh lệch
                </Tag>
              ) : null}
            </Space>
          );
        },
      },
      { title: "Tạo lúc", dataIndex: "createdAt", width: 160, render: formatDateTime },
      ...(canApprove
        ? [
            {
              title: "Thao tác",
              key: "actions",
              width: 190,
              fixed: "right",
              render: (_, row) => {
                if (!row.awaitingApproval) {
                  return row.approvedByName ? (
                    <Text type="secondary">{row.approvedByName}</Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  );
                }
                return (
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => openApprove(row)}
                    >
                      Duyệt
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => {
                        setRejectTarget(row);
                        setRejectReason("");
                      }}
                    >
                      Từ chối
                    </Button>
                  </Space>
                );
              },
            },
          ]
        : []),
    ],
    [openDetail, openApprove, canApprove],
  );

  const compareColumns = useMemo(
    () => [
      { title: "Tên hàng", dataIndex: "productName", render: (v) => v || "—" },
      { title: "Loại", dataIndex: "productType", width: 120, render: (v) => v || "—" },
      {
        title: "SL khai",
        dataIndex: "declaredQuantity",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "SL thực",
        dataIndex: "actualQuantity",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "Lệch SL",
        dataIndex: "quantityDifference",
        align: "right",
        width: 100,
        render: (value) => <DiffCell value={value} />,
      },
      {
        title: "KG khai",
        dataIndex: "declaredWeight",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "KG thực",
        dataIndex: "actualWeight",
        align: "right",
        width: 90,
        render: formatNumber,
      },
      {
        title: "Lệch KG",
        dataIndex: "weightDifference",
        align: "right",
        width: 100,
        render: (value) => <DiffCell value={value} suffix=" kg" />,
      },
      { title: "Ghi chú kho", dataIndex: "note", render: (v) => v || "—" },
    ],
    [],
  );

  const detailStatusMeta = getReceivingStatusMeta(detail?.status);

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
            <small>Chờ duyệt</small>
            <strong>{awaitingCount} phiếu</strong>
          </div>
          <div className="ops-page__weight-chip">
            <small>Có chênh lệch</small>
            <strong>{discrepancyCount} phiếu</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={loading} />}
            disabled={loading}
            onClick={fetchRows}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {!!errorMessage && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={errorMessage}
          action={
            <Button size="small" onClick={fetchRows}>
              Thử lại
            </Button>
          }
        />
      )}

      <Tabs
        activeKey={statusTab}
        onChange={setStatusTab}
        items={RECEIVING_STATUS_TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
      />

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã phiếu, mã đơn, tên hoặc SĐT khách"
          style={{ width: 340 }}
          onSearch={(value) => setKeyword(value)}
          onChange={(event) => {
            if (!event.target.value) setKeyword("");
          }}
        />
        <Text type="secondary">
          {totalCount ? `${formatNumber(totalCount)} phiếu` : ""}
        </Text>
      </Space>

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1200 }}
        pagination={{ pageSize: 12, showSizeChanger: false }}
        locale={{
          emptyText: (
            <Empty
              description={
                statusTab === AWAITING_TAB_KEY
                  ? "Không có phiếu nào đang chờ quyết định."
                  : "Chưa có phiếu nào ở trạng thái này."
              }
            />
          ),
        }}
      />

      <Drawer
        open={!!detail}
        width={980}
        onClose={() => setDetail(null)}
        title={detail ? `Phiếu ${detail.receivingNoteCode}` : "Chi tiết phiếu tiếp nhận"}
        extra={
          canApprove && detail?.awaitingApproval ? (
            <Space>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setRejectTarget(detail);
                  setRejectReason("");
                }}
              >
                Từ chối
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => openApprove(detail)}
              >
                Duyệt phiếu
              </Button>
            </Space>
          ) : null
        }
      >
        {detail ? (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color={detailStatusMeta.tone}>{detail.statusText || detailStatusMeta.label}</Tag>
              {detail.awaitingApproval && getApprovalStageMeta(detail.approvalStage) ? (
                <Tag color={getApprovalStageMeta(detail.approvalStage).color}>
                  Chờ: {getApprovalStageMeta(detail.approvalStage).label}
                </Tag>
              ) : null}
              {toPublicReceiptUrl(detail.receiptPdfUrl) ? (
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  href={toPublicReceiptUrl(detail.receiptPdfUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDF phiếu nhập kho
                </Button>
              ) : null}
              {detail.hasDiscrepancy ? (
                <Tag color="error" icon={<WarningOutlined />}>
                  Số thực tế lệch khai báo
                </Tag>
              ) : null}
            </Space>

            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Đơn ký gửi">
                <Text code>{detail.consignmentCode || "—"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tuyến">{detail.route || "—"}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {detail.customerName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Điện thoại">
                {detail.customerPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho tiếp nhận">
                {detail.warehouseName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Tạo lúc">
                {formatDateTime(detail.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Người lập phiếu">
                {detail.createdByName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Duyệt nhận hàng">
                {detail.receiveApprovedByName
                  ? `${detail.receiveApprovedByName} · ${formatDateTime(detail.receiveApprovedAt)}`
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Người kiểm đếm">
                {detail.receivedByName
                  ? `${detail.receivedByName} · ${formatDateTime(detail.receivedAt)}`
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Chốt nhận hàng">
                {detail.approvedByName
                  ? `${detail.approvedByName} · ${formatDateTime(detail.approvedAt)}`
                  : "—"}
              </Descriptions.Item>
              {detail.approvalNote ? (
                <Descriptions.Item label="Ghi chú duyệt" span={2}>
                  {detail.approvalNote}
                </Descriptions.Item>
              ) : null}
              {detail.rejectionReason ? (
                <Descriptions.Item label="Lý do từ chối" span={2}>
                  <Text type="danger">{detail.rejectionReason}</Text>
                </Descriptions.Item>
              ) : null}
              {detail.warehouseNote ? (
                <Descriptions.Item label="Ghi chú cho kho" span={2}>
                  {detail.warehouseNote}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>
              Đối chiếu khai báo với thực tế
            </Title>
            {detail.items?.length ? (
              <Table
                rowKey={(row) => row.id || row.productName}
                size="small"
                columns={compareColumns}
                dataSource={detail.items}
                pagination={false}
                loading={detailLoading}
                scroll={{ x: 900 }}
              />
            ) : (
              <Alert
                type="info"
                showIcon
                message="Kho chưa kiểm đếm"
                description="Biên bản đối chiếu chỉ có sau khi kho nhận hàng. Bên dưới là hàng khách khai trên đơn, kèm thùng gỗ và dịch vụ kho phải làm cho từng kiện."
              />
            )}

            <Title level={5} style={{ marginTop: 20 }}>
              Hàng khách khai trên đơn
            </Title>
            <Table
              rowKey={(row) => row.orderItemId || row.productName}
              size="small"
              pagination={false}
              dataSource={detail.expectedItems || []}
              columns={[
                { title: "Tên hàng", dataIndex: "productName", render: (v) => v || "—" },
                { title: "Loại", dataIndex: "productType", render: (v) => v || "—" },
                {
                  title: "Số lượng",
                  dataIndex: "quantity",
                  align: "right",
                  width: 100,
                  render: formatNumber,
                },
                {
                  title: "Giá trị khai",
                  dataIndex: "declaredValue",
                  align: "right",
                  width: 140,
                  render: (value) =>
                    value ? `${formatNumber(value)} đ` : "—",
                },
                {
                  title: "Thùng gỗ",
                  key: "packageConfiguration",
                  width: 150,
                  render: (_, row) =>
                    row.packageConfiguration?.configName ||
                    row.packageConfiguration?.configCode ||
                    "—",
                },
                {
                  title: "Dịch vụ kèm kiện",
                  key: "services",
                  render: (_, row) =>
                    Array.isArray(row.services) && row.services.length ? (
                      <Space size={[4, 4]} wrap>
                        {row.services.map((service) => (
                          <Tag key={service.pricingRuleId || service.code}>
                            {service.name || service.code}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      "—"
                    ),
                },
              ]}
              locale={{ emptyText: "Đơn không có dòng hàng khai báo." }}
            />
          </>
        ) : null}
      </Drawer>

      <Modal
        open={!!approveTarget}
        title={`Duyệt phiếu ${approveTarget?.receivingNoteCode || ""}`}
        okText="Duyệt phiếu"
        okButtonProps={{
          loading: submitting,
          disabled: requireApproveReason && !approveReason.trim(),
        }}
        cancelText="Huỷ"
        onOk={handleApprove}
        onCancel={() => {
          setApproveTarget(null);
          setApproveReason("");
        }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            String(approveTarget?.approvalStage || "").toUpperCase() === "DISCREPANCY"
              ? "Chốt biên bản lệch: kiện được xếp kệ theo số thực tế kho đã kiểm đếm."
              : "Duyệt nhận hàng: phiếu có PDF mã WRN-, khách nhận thông báo để mang hàng tới kho."
          }
        />
        <Input.TextArea
          rows={3}
          value={approveReason}
          onChange={(event) => setApproveReason(event.target.value)}
          placeholder={
            requireApproveReason
              ? "Bắt buộc khi Admin duyệt thay quản lý kho. Ví dụ: quản lý kho nghỉ phép, đã xác nhận qua điện thoại."
              : "Ghi chú (không bắt buộc). Ví dụ: đã hẹn khách sáng thứ 6."
          }
        />
      </Modal>

      <Modal
        open={!!rejectTarget}
        title={`Từ chối phiếu ${rejectTarget?.receivingNoteCode || ""}`}
        okText="Từ chối phiếu"
        okButtonProps={{ danger: true, loading: submitting, disabled: !rejectReason.trim() }}
        cancelText="Huỷ"
        onOk={handleReject}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
      >
        <Alert
          type="warning"
          showIcon
          icon={<FileTextOutlined />}
          style={{ marginBottom: 12 }}
          message={
            String(rejectTarget?.approvalStage || "").toUpperCase() === "DISCREPANCY"
              ? "Kho nhận thông báo kèm lý do; kiện của phiếu sẽ không được xếp kệ."
              : "Người lập phiếu nhận thông báo kèm lý do và lập lại phiếu khác."
          }
        />
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Ví dụ: thiếu 2 thùng so với khai báo, cần cân đếm lại trước khi nhập kho."
        />
      </Modal>
    </div>
  );
}
