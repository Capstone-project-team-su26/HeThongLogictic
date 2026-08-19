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
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  approveReceivingNote,
  getReceivingApiError,
  getReceivingNoteDetail,
  getReceivingStatusMeta,
  listReceivingNotes,
  RECEIVING_STATUS_TABS,
  rejectReceivingNote,
} from "../../api/OperationsAPI/receivingNoteService";
import AuthNotify from "../../utils/Common/AuthNotify";

const { Text, Title } = Typography;

/**
 * Màn phiếu tiếp nhận kho gốc — dùng chung cho OM (hàng đợi duyệt) và Admin (tra cứu toàn hệ thống).
 *
 * Khác nhau đúng hai thứ nên truyền bằng prop thay vì copy hai bản:
 *   - `defaultStatus`: OM mở thẳng tab "Chờ duyệt", Admin mở tab "Tất cả"
 *   - `canApprove`: Admin xem lịch sử thì không cần nút, còn khi cần vẫn bật lên được
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
  subtitle = "Phiếu tự sinh khi đơn thu được tiền. Kho cân đếm rồi chốt số thực tế, duyệt xong hàng mới lên kệ được.",
  eyebrow = "BỘ PHẬN VẬN HÀNH (OPS)",
  defaultStatus = "RECEIVED",
  canApprove = true,
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

  const handleApprove = useCallback(
    async (row) => {
      setSubmitting(true);
      try {
        await approveReceivingNote(row.id);
        AuthNotify.success(
          "Đã duyệt phiếu",
          `Phiếu ${row.receivingNoteCode} đã duyệt. Kho xếp kiện lên kệ được rồi.`,
        );
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
    [fetchRows],
  );

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    setSubmitting(true);
    try {
      await rejectReceivingNote(rejectTarget.id, rejectReason);
      AuthNotify.success(
        "Đã từ chối phiếu",
        `Phiếu ${rejectTarget.receivingNoteCode} bị từ chối, kho đã nhận thông báo.`,
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
                      loading={submitting}
                      onClick={() => handleApprove(row)}
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
    [openDetail, handleApprove, submitting, canApprove],
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
                statusTab === "RECEIVED"
                  ? "Không có phiếu nào đang chờ duyệt."
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
                loading={submitting}
                onClick={() => handleApprove(detail)}
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
              <Descriptions.Item label="Người duyệt">
                {detail.approvedByName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Duyệt lúc">
                {formatDateTime(detail.approvedAt)}
              </Descriptions.Item>
              {detail.rejectionReason ? (
                <Descriptions.Item label="Lý do từ chối" span={2}>
                  <Text type="danger">{detail.rejectionReason}</Text>
                </Descriptions.Item>
              ) : null}
              {detail.warehouseNote ? (
                <Descriptions.Item label="Ghi chú kho" span={2}>
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
                message="Kho chưa chốt số thực tế"
                description="Danh sách đối chiếu chỉ có sau khi kho bấm xác nhận nhập kho. Bên dưới là hàng khách khai trên đơn."
              />
            )}

            <Title level={5} style={{ marginTop: 20 }}>
              Hàng khách khai trên đơn
            </Title>
            <Table
              rowKey={(row, index) => `${row.productName}-${index}`}
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
              ]}
              locale={{ emptyText: "Đơn không có dòng hàng khai báo." }}
            />
          </>
        ) : null}
      </Drawer>

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
          message="Kho sẽ nhận thông báo kèm lý do và phải kiểm đếm lại."
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
