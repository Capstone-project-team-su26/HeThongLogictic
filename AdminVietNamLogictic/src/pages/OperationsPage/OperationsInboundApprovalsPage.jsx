import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  FileTextOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import {
  approveInboundRequest,
  getApprovalApiError,
  getInboundRequestDetail,
  getInboundStatusMeta,
  listInboundRequests,
  rejectInboundRequest,
} from "../../api/OperationsAPI/destinationApprovalService";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./OperationsPage.css";
// Thẻ KPI dùng class wro-kpi-* khai bên trang WRO. Import thẳng thay vì trông chờ trang khác
// đã kéo file này vào bundle giúp.
import "./OperationsWroPage/OperationsWroPage.css";

const { Title, Text } = Typography;

const STATUS_FILTERS = [
  { value: "INBOUND_PENDING", label: "Chờ duyệt" },
  { value: "", label: "Tất cả" },
  { value: "INBOUND_APPROVED", label: "Đã duyệt" },
  { value: "INBOUND_REJECTED", label: "Từ chối" },
];

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

export default function OperationsInboundApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("INBOUND_PENDING");
  const [keyword, setKeyword] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const items = await listInboundRequests({ status: statusFilter });
      setRows(Array.isArray(items) ? items : []);
    } catch (error) {
      setErrorMessage(getApprovalApiError(error, "Không tải được danh sách phiếu nhập kho."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const visibleRows = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.inboundCode, row.shipmentCode, row.warehouseName, row.createdByName]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const pendingRows = useMemo(
    () => rows.filter((row) => String(row.status).toUpperCase() === "INBOUND_PENDING"),
    [rows],
  );
  const pendingCount = pendingRows.length;
  const pendingParcels = useMemo(
    () => pendingRows.reduce((total, row) => total + (Number(row.totalParcels) || 0), 0),
    [pendingRows],
  );

  const openDetail = useCallback(async (row) => {
    setDetail(row);
    setDetailLoading(true);
    try {
      const full = await getInboundRequestDetail(row.inboundRequestId || row.id);
      if (full) setDetail(full);
    } catch (error) {
      AuthNotify.error(getApprovalApiError(error, "Không tải được chi tiết phiếu."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleApprove = useCallback(
    async (row) => {
      setSubmitting(true);
      try {
        await approveInboundRequest(row.inboundRequestId || row.id);
        AuthNotify.success(`Đã duyệt phiếu ${row.inboundCode}. Kho có thể xếp kệ.`);
        setDetail(null);
        await fetchRows();
      } catch (error) {
        AuthNotify.error(getApprovalApiError(error, "Không duyệt được phiếu nhập kho."));
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
      await rejectInboundRequest(rejectTarget.inboundRequestId || rejectTarget.id, rejectReason);
      AuthNotify.success(`Đã từ chối phiếu ${rejectTarget.inboundCode}.`);
      setRejectTarget(null);
      setRejectReason("");
      setDetail(null);
      await fetchRows();
    } catch (error) {
      AuthNotify.error(getApprovalApiError(error, "Không từ chối được phiếu nhập kho."));
    } finally {
      setSubmitting(false);
    }
  }, [rejectTarget, rejectReason, fetchRows]);

  const columns = useMemo(
    () => [
      {
        title: "Mã phiếu",
        dataIndex: "inboundCode",
        render: (value, row) => (
          <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(row)}>
            {value || "—"}
          </Button>
        ),
      },
      { title: "Lô vận chuyển", dataIndex: "shipmentCode", render: (v) => v || "—" },
      { title: "Kho nhận", dataIndex: "warehouseName", render: (v) => v || "—" },
      {
        title: "Số kiện",
        dataIndex: "totalParcels",
        align: "center",
        render: (v) => v ?? 0,
      },
      { title: "Người lập", dataIndex: "createdByName", render: (v) => v || "—" },
      { title: "Lập lúc", dataIndex: "createdAt", render: formatDateTime },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (value) => {
          const meta = getInboundStatusMeta(value);
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        render: (_, row) => {
          const isPending = String(row.status).toUpperCase() === "INBOUND_PENDING";
          if (!isPending) return <Text type="secondary">—</Text>;
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
    ],
    [openDetail, handleApprove, submitting],
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Duyệt Phiếu Nhập Kho Việt Nam</h1>
          <p>
            Kho lập phiếu sau khi mở lô kiểm đếm. Duyệt xong kho mới xếp kiện lên kệ được.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{pendingCount} phiếu</strong>
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

      <section className="wro-kpi-grid-enhanced" aria-label="Chỉ số phiếu nhập kho">
        <div className="ops-kpi-card wro-kpi-card--blue">
          <div className="wro-kpi-card__icon-box">
            <FileTextOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Tổng phiếu nhập kho</p>
            <p className="ops-kpi-card__value">{loading ? "…" : rows.length}</p>
            <div className="ops-kpi-card__meta">
              <p>Theo bộ lọc hiện tại</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <ClockCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Đang chờ duyệt</p>
            <p className="ops-kpi-card__value">{loading ? "…" : pendingCount}</p>
            <div className="ops-kpi-card__meta">
              <p>Kho đang chờ để xếp kệ</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--purple">
          <div className="wro-kpi-card__icon-box">
            <InboxOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Kiện chờ vào kệ</p>
            <p className="ops-kpi-card__value">{loading ? "…" : pendingParcels}</p>
            <div className="ops-kpi-card__meta">
              <p>Thuộc các phiếu chờ duyệt</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc phiếu nhập kho">
        <div>
          <label htmlFor="inbound-f-status">Trạng thái phiếu</label>
          <Select
            id="inbound-f-status"
            style={{ width: "100%" }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
          />
        </div>
        <div>
          <label htmlFor="inbound-f-search">Tìm kiếm nhanh</label>
          <Input.Search
            id="inbound-f-search"
            allowClear
            placeholder="Tìm theo mã phiếu, mã lô, kho nhận..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Danh sách phiếu nhập kho</h3>
          <span>{visibleRows.length} phiếu</span>
        </div>
        <Table
          rowKey={(row) => row.inboundRequestId || row.id}
          size="middle"
          columns={columns}
          dataSource={visibleRows}
          loading={loading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1200, y: "calc(100vh - 460px)" }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (total) => `Tổng ${total} phiếu`,
          }}
          locale={{ emptyText: "Không có phiếu nhập kho nào." }}
        />
      </div>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={640}
        title={detail?.inboundCode || "Chi tiết phiếu nhập kho"}
        loading={detailLoading}
      >
        {detail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Lô vận chuyển">
                {detail.shipmentCode || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho nhận">{detail.warehouseName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={getInboundStatusMeta(detail.status).tone}>
                  {detail.statusText || getInboundStatusMeta(detail.status).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người lập">
                {detail.createdByName || "—"} · {formatDateTime(detail.createdAt)}
              </Descriptions.Item>
              {!!detail.approvedByName && (
                <Descriptions.Item label="Người duyệt">
                  {detail.approvedByName} · {formatDateTime(detail.approvedAt)}
                </Descriptions.Item>
              )}
              {!!detail.rejectionReason && (
                <Descriptions.Item label="Lý do từ chối">{detail.rejectionReason}</Descriptions.Item>
              )}
              <Descriptions.Item label="Ghi chú">{detail.note || "—"}</Descriptions.Item>
            </Descriptions>

            {/*
              Phiếu vài chục kiện thì OM không soi từng dòng được. Gom số kiện lệch ý khách lên
              đầu để nhìn là thấy, còn muốn biết kiện nào thì xem cột "Ý khách" bên dưới.
            */}
            {(() => {
              const conflicting = (detail.parcels || []).filter(
                (row) => row.customerIntent === "DIRECT_DELIVERY"
              );

              if (conflicting.length === 0) return null;

              return (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 20 }}
                  message={`${conflicting.length} kiện có khách yêu cầu giao ngay khi về VN`}
                  description="Những kiện này đang được đề nghị nhập kho, ngược với nguyện vọng khách khai lúc đặt đơn. Xác nhận lại với khách hoặc Sale trước khi duyệt."
                />
              );
            })()}

            <Title level={5} style={{ marginTop: 20 }}>
              Kiện trong phiếu ({detail.totalParcels ?? (detail.parcels || []).length})
            </Title>
            <Table
              rowKey={(row) => row.parcelId}
              size="small"
              pagination={false}
              dataSource={detail.parcels || []}
              columns={[
                { title: "Mã kiện", dataIndex: "packageCode" },
                { title: "Đơn", dataIndex: "orderCode", render: (v) => v || "—" },
                { title: "Khách", dataIndex: "customerName", render: (v) => v || "—" },
                {
                  /*
                   * Khách muốn giao ngay mà kiện lại nằm trong phiếu nhập kho là dấu hiệu lệch:
                   * hoặc khách gọi đổi ý (hợp lệ), hoặc kho tick nhầm. Tô cảnh báo để OM hỏi lại
                   * trước khi ký duyệt, thay vì duyệt xong mới phát hiện.
                   */
                  title: "Ý khách",
                  dataIndex: "customerIntent",
                  render: (value, row) => {
                    if (!value) return <Tag>Chưa chọn</Tag>;

                    return value === "DIRECT_DELIVERY" ? (
                      <Tag color="warning" title={row.customerIntentText}>
                        Muốn giao ngay
                      </Tag>
                    ) : (
                      <Tag color="success" title={row.customerIntentText}>
                        Muốn gửi kho
                      </Tag>
                    );
                  },
                },
                { title: "Trạng thái", dataIndex: "packageStatus" },
                { title: "Ô kệ", dataIndex: "binCode", render: (v) => v || "Chưa xếp" },
              ]}
              locale={{ emptyText: "Phiếu chưa có kiện nào." }}
            />

            {String(detail.status).toUpperCase() === "INBOUND_PENDING" && (
              <Space style={{ marginTop: 20 }}>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={submitting}
                  onClick={() => handleApprove(detail)}
                >
                  Duyệt phiếu
                </Button>
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
              </Space>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={Boolean(rejectTarget)}
        title={`Từ chối phiếu ${rejectTarget?.inboundCode || ""}`}
        okText="Xác nhận từ chối"
        cancelText="Huỷ"
        okButtonProps={{ danger: true, loading: submitting }}
        onOk={handleReject}
        onCancel={() => setRejectTarget(null)}
      >
        <Text type="secondary">Lý do sẽ hiển thị cho kho, nên ghi rõ để họ xử lý tiếp.</Text>
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="Ví dụ: kiện chưa kiểm đếm đủ, cần rà lại trước khi nhập kho"
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  );
}
