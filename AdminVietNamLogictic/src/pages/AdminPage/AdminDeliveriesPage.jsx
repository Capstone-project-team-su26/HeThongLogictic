import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Select, Table, Tag, Typography } from "antd";
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import {
  getApprovalApiError,
  getDeliveryStatusMeta,
  listDeliveryRequests,
} from "../../api/OperationsAPI/destinationApprovalService";
import "../OperationsPage/OperationsPage.css";

const { Text } = Typography;

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "DELIVERY_PENDING", label: "Chờ duyệt" },
  { value: "DELIVERY_APPROVED", label: "Đã duyệt, chờ đặt giao" },
  { value: "DELIVERY_DISPATCHED", label: "Đang giao" },
  { value: "DELIVERY_REJECTED", label: "Từ chối" },
];

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/**
 * Admin giám sát toàn bộ đơn đang trên đường giao.
 *
 * Khác màn duyệt của OM ở chỗ đây là màn CHỈ ĐỌC: admin theo dõi tiến độ và tra mã vận đơn,
 * việc duyệt hay đặt giao vẫn thuộc OM và kho.
 */
export default function AdminDeliveriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("DELIVERY_DISPATCHED");
  const [keyword, setKeyword] = useState("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const items = await listDeliveryRequests({ status: statusFilter });
      setRows(Array.isArray(items) ? items : []);
    } catch (error) {
      setErrorMessage(getApprovalApiError(error, "Không tải được danh sách đơn đang giao."));
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
      [row.deliveryCode, row.orderCode, row.customerName, row.receiverName, row.receiverPhone, row.carrierTrackingCode]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const dispatchedCount = useMemo(
    () => rows.filter((row) => String(row.status).toUpperCase() === "DELIVERY_DISPATCHED").length,
    [rows],
  );
  const waitingCount = useMemo(
    () =>
      rows.filter((row) =>
        ["DELIVERY_PENDING", "DELIVERY_APPROVED"].includes(String(row.status).toUpperCase()),
      ).length,
    [rows],
  );
  const totalParcels = useMemo(
    () => rows.reduce((total, row) => total + (Number(row.totalParcels) || 0), 0),
    [rows],
  );

  const columns = useMemo(
    () => [
      { title: "Mã phiếu", dataIndex: "deliveryCode", render: (v) => v || "—" },
      { title: "Đơn hàng", dataIndex: "orderCode", render: (v) => v || "—" },
      { title: "Khách", dataIndex: "customerName", render: (v) => v || "—" },
      {
        title: "Người nhận",
        key: "receiver",
        render: (_, row) => (
          <div>
            <div>{row.receiverName || "—"}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.receiverPhone || "—"}
            </Text>
          </div>
        ),
      },
      {
        title: "Địa chỉ giao",
        dataIndex: "fullAddress",
        ellipsis: true,
        render: (v, row) => v || row.addressDetail || "—",
      },
      { title: "Số kiện", dataIndex: "totalParcels", align: "center", render: (v) => v ?? 0 },
      {
        title: "Mã vận đơn",
        dataIndex: "carrierTrackingCode",
        render: (value) =>
          value ? <Text copyable>{value}</Text> : <Text type="secondary">Chưa đặt</Text>,
      },
      { title: "Đặt giao lúc", dataIndex: "dispatchedAt", render: formatDateTime },
      {
        title: "Trạng thái",
        dataIndex: "status",
        render: (value, row) => {
          const meta = getDeliveryStatusMeta(value);
          return <Tag color={meta.tone}>{row.statusText || meta.label}</Tag>;
        },
      },
    ],
    [],
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>QUẢN TRỊ HỆ THỐNG</span>
          <h1>Theo Dõi Đơn Đang Giao</h1>
          <p>
            Giám sát toàn bộ phiếu giao chặng cuối: đơn vị vận chuyển, mã vận đơn và tiến độ tới
            tay khách.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Đang giao</small>
            <strong>{dispatchedCount} phiếu</strong>
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

      <section className="wro-kpi-grid-enhanced" aria-label="Chỉ số giao hàng">
        <div className="ops-kpi-card wro-kpi-card--blue">
          <div className="wro-kpi-card__icon-box">
            <CarOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Đang trên đường giao</p>
            <p className="ops-kpi-card__value">{loading ? "…" : dispatchedCount}</p>
            <div className="ops-kpi-card__meta">
              <p>Đơn vị vận chuyển đã nhận</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--amber">
          <div className="wro-kpi-card__icon-box">
            <ClockCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Chờ xử lý</p>
            <p className="ops-kpi-card__value">{loading ? "…" : waitingCount}</p>
            <div className="ops-kpi-card__meta">
              <p>Chờ OM duyệt hoặc kho đặt giao</p>
            </div>
          </div>
        </div>

        <div className="ops-kpi-card wro-kpi-card--purple">
          <div className="wro-kpi-card__icon-box">
            <CheckCircleOutlined />
          </div>
          <div className="wro-kpi-card__body">
            <p className="ops-kpi-card__label">Tổng kiện</p>
            <p className="ops-kpi-card__value">{loading ? "…" : totalParcels}</p>
            <div className="ops-kpi-card__meta">
              <p>Thuộc các phiếu đang hiển thị</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ops-page__filters" aria-label="Bộ lọc đơn đang giao">
        <div>
          <label htmlFor="admin-delivery-status">Trạng thái phiếu</label>
          <Select
            id="admin-delivery-status"
            style={{ width: "100%" }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS}
          />
        </div>
        <div>
          <label htmlFor="admin-delivery-search">Tìm kiếm nhanh</label>
          <Input.Search
            id="admin-delivery-search"
            allowClear
            placeholder="Tìm theo mã phiếu, đơn, khách, số điện thoại, mã vận đơn..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </section>

      <div className="ops-table-card">
        <div className="ops-table-card__head">
          <h3>Danh sách phiếu giao</h3>
          <span>{visibleRows.length} phiếu</span>
        </div>
        <Table
          rowKey={(row) => row.deliveryRequestId || row.id}
          size="middle"
          columns={columns}
          dataSource={visibleRows}
          loading={loading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1500, y: "calc(100vh - 460px)" }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (total) => `Tổng ${total} phiếu`,
          }}
          locale={{ emptyText: "Không có phiếu giao nào." }}
        />
      </div>
    </div>
  );
}
