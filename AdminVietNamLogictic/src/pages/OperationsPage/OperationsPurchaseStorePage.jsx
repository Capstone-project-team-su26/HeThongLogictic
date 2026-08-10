import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CheckOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
} from "@ant-design/icons";

import { getPurchaseRequestsApi } from "../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import { approveStorePurchaseApi } from "../../api/SaleAPI/PurchaseRequestAPI/confirmPurchaseApi";
import { getOperationsApiError } from "../../api/OperationsAPI/consolidationWorkflowService";
import AuthNotify from "../../utils/Common/AuthNotify";
import "./OperationsPage.css";

const PENDING_STORE_STATUSES = new Set([
  "WAITING_STORED",
  "ARRIVED_ORIGIN_WAREHOUSE",
]);

const STATUS_META = {
  WAITING_STORED: { label: "Chờ nhập kho", tone: "warning" },
  ARRIVED_ORIGIN_WAREHOUSE: { label: "Đã về kho nguồn", tone: "processing" },
  STORED: { label: "Đã nhập kho", tone: "success" },
};

export default function OperationsPurchaseStorePage() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      const [waiting, arrived] = await Promise.all([
        getPurchaseRequestsApi({ status: "WAITING_STORED", pageSize: 100 }),
        getPurchaseRequestsApi({
          status: "ARRIVED_ORIGIN_WAREHOUSE",
          pageSize: 100,
        }),
      ]);

      const map = new Map();
      const rawWaiting = waiting?.items || (Array.isArray(waiting) ? waiting : []);
      const rawArrived = arrived?.items || (Array.isArray(arrived) ? arrived : []);

      for (const item of [...rawWaiting, ...rawArrived]) {
        const id = item?.purchaseRequestId || item?.id;
        const statusKey = String(item?.status || "").toUpperCase();
        if (!id || !PENDING_STORE_STATUSES.has(statusKey)) {
          continue;
        }
        map.set(id, item);
      }
      setRows([...map.values()]);
    } catch (error) {
      setLoadError(
        getOperationsApiError(error, "Không tải được danh sách đơn chờ nhập kho.")
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function handleApprove() {
    if (!approveTarget || submitting) return;
    const id = approveTarget.purchaseRequestId || approveTarget.id;
    if (!id) return;

    // Tự động lấy ID kho có sẵn từ dữ liệu đơn hàng, người dùng không cần nhập
    const autoWarehouseId =
      approveTarget.warehouseId ||
      approveTarget.destinationWarehouseId ||
      approveTarget.originWarehouseId ||
      approveTarget.warehouse?.id ||
      approveTarget.destinationWarehouse?.id ||
      approveTarget.originWarehouse?.id ||
      undefined;

    setSubmitting(true);
    try {
      await approveStorePurchaseApi(id, {
        note: note.trim(),
        warehouseId: autoWarehouseId,
      });
      const successMsg = `Duyệt nhập kho thành công đơn ${approveTarget.purchaseCode || id}.`;
      AuthNotify.success("Thành công", successMsg);
      setNotice({
        type: "success",
        message: successMsg,
      });
      setApproveTarget(null);
      setNote("");
      await loadData({ refresh: true });
    } catch (error) {
      const errMsg = getOperationsApiError(error, "Duyệt nhập kho thất bại.");
      AuthNotify.error("Duyệt nhập kho thất bại", errMsg);
      setNotice({
        type: "error",
        message: errMsg,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Calculated Stats
  const waitingCount = useMemo(
    () => rows.filter((r) => String(r.status).toUpperCase() === "WAITING_STORED").length,
    [rows]
  );
  const arrivedCount = useMemo(
    () => rows.filter((r) => String(r.status).toUpperCase() === "ARRIVED_ORIGIN_WAREHOUSE").length,
    [rows]
  );

  // Filtered rows for table
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const statusKey = String(row.status || "").toUpperCase();
      if (statusFilter !== "ALL" && statusFilter !== statusKey) {
        return false;
      }
      if (!searchText.trim()) return true;
      const q = searchText.trim().toLowerCase();
      const code = String(row.purchaseCode || "").toLowerCase();
      const customer = String(row.customerName || "").toLowerCase();
      const route = String(row.route || "").toLowerCase();
      const wh = String(row.warehouseName || row.destinationWarehouseName || row.originWarehouseName || "").toLowerCase();
      return code.includes(q) || customer.includes(q) || route.includes(q) || wh.includes(q);
    });
  }, [rows, statusFilter, searchText]);

  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "purchaseCode",
        fixed: "left",
        width: 140,
        render: (value) => (
          <Typography.Text code style={{ fontWeight: 600 }}>
            {value || "—"}
          </Typography.Text>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        width: 160,
        render: (status) => {
          const key = String(status || "").toUpperCase();
          const meta = STATUS_META[key] || { label: status, tone: "default" };
          return <Tag color={meta.tone}>{meta.label}</Tag>;
        },
      },
      {
        title: "Khách hàng",
        dataIndex: "customerName",
        render: (value) => value || "—",
      },
      {
        title: "Tuyến vận chuyển",
        dataIndex: "route",
        render: (value) => value || "—",
      },
      {
        title: "Kho nhận dự kiến",
        render: (_, row) =>
          row.warehouseName || row.destinationWarehouseName || row.originWarehouseName || "Kho mặc định",
      },
      {
        title: "Ngày tạo",
        dataIndex: "createdAt",
        width: 170,
        render: (value) =>
          value ? new Date(value).toLocaleString("vi-VN") : "—",
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 150,
        render: (_, row) => (
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => {
              setApproveTarget(row);
              setNote("");
            }}
          >
            Duyệt nhập kho
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Duyệt Nhập Kho Mua Hộ</h1>
          <p>
            Quản lý và duyệt các đơn mua hộ đã về kho hoặc chờ nhập kho lưu giữ trong hệ thống.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{rows.length} đơn</strong>
          </div>
          <Button
            type="primary"
            icon={<ReloadOutlined spin={isRefreshing} />}
            disabled={isRefreshing || isLoading}
            onClick={() => loadData({ refresh: true })}
          >
            Làm mới
          </Button>
        </div>
      </section>

      {/* KPI Overview Grid */}
      <div className="ops-kpi-grid">
        <div className="ops-kpi-card">
          <p className="ops-kpi-card__label">Tổng đơn chờ nhập</p>
          <p className="ops-kpi-card__value" style={{ color: "#2563eb" }}>
            {rows.length}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Đang xử lý ở kho</p>
            <InboxOutlined style={{ fontSize: 20, color: "#2563eb" }} />
          </div>
        </div>

        <div className="ops-kpi-card">
          <p className="ops-kpi-card__label">Chờ nhập kho</p>
          <p className="ops-kpi-card__value" style={{ color: "#d97706" }}>
            {waitingCount}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Đơn gửi yêu cầu lưu kho</p>
            <ShopOutlined style={{ fontSize: 20, color: "#d97706" }} />
          </div>
        </div>

        <div className="ops-kpi-card">
          <p className="ops-kpi-card__label">Đã về kho nguồn</p>
          <p className="ops-kpi-card__value" style={{ color: "#0284c7" }}>
            {arrivedCount}
          </p>
          <div className="ops-kpi-card__meta">
            <p>Hàng đã cập bến</p>
            <CheckCircleOutlined style={{ fontSize: 20, color: "#0284c7" }} />
          </div>
        </div>
      </div>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={loadError}
          action={
            <Button size="small" onClick={() => loadData()}>
              Thử lại
            </Button>
          }
        />
      ) : null}

      {notice ? (
        <Alert
          type={notice.type}
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      ) : null}

      <div className="ops-table-card">
        <div className="ops-table-card__head" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3>Danh sách đơn chờ nhập kho</h3>
            <span>{filteredRows.length} / {rows.length} đơn</span>
          </div>

          <Space wrap>
            <Input
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              placeholder="Tìm theo mã đơn, khách, tuyến, kho..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 260 }}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 180 }}
              options={[
                { value: "ALL", label: "Tất cả trạng thái" },
                { value: "WAITING_STORED", label: "Chờ nhập kho" },
                { value: "ARRIVED_ORIGIN_WAREHOUSE", label: "Đã về kho nguồn" },
              ]}
            />
          </Space>
        </div>

        <Table
          rowKey={(row) => row.purchaseRequestId || row.id}
          columns={columns}
          dataSource={filteredRows}
          loading={isLoading}
          sticky={{ offsetHeader: 0 }}
          scroll={{ x: 1000, y: "calc(100vh - 410px)" }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50", "100"],
            showTotal: (total) => `Tổng ${total} đơn`,
          }}
          locale={{ emptyText: "Không tìm thấy đơn mua hộ nào chờ duyệt nhập kho." }}
        />
      </div>

      {/* Approve Modal */}
      <Modal
        open={Boolean(approveTarget)}
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
            <span>Xác nhận duyệt nhập kho {approveTarget?.purchaseCode || ""}</span>
          </Space>
        }
        onCancel={() => {
          if (submitting) return;
          setApproveTarget(null);
          setNote("");
        }}
        onOk={handleApprove}
        okText="Xác nhận duyệt nhập kho"
        confirmLoading={submitting}
        destroyOnHidden
        width={520}
      >
        {approveTarget && (
          <div style={{ marginTop: 12 }}>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Mã đơn mua hộ">
                <Typography.Text code>{approveTarget.purchaseCode || approveTarget.id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng">
                {approveTarget.customerName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Tuyến">
                {approveTarget.route || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Kho tiếp nhận">
                <Tag color="blue">
                  {approveTarget.warehouseName || approveTarget.destinationWarehouseName || approveTarget.originWarehouseName || "Kho mặc định của đơn"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginBottom: 8 }}>
              <label htmlFor="ops-store-note" style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>
                Ghi chú kiểm kê / lưu kho (không bắt buộc):
              </label>
              <Input.TextArea
                id="ops-store-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ví dụ: Đã nhận đủ hàng, kiện đóng gói nguyên vẹn..."
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

