import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { CheckOutlined, ReloadOutlined } from "@ant-design/icons";

import { getPurchaseRequestsApi } from "../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import { approveStorePurchaseApi } from "../../api/SaleAPI/PurchaseRequestAPI/confirmPurchaseApi";
import { getOperationsApiError } from "../../api/OperationsAPI/consolidationWorkflowService";
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

  const loadData = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setLoadError("");
    try {
      // BE không filter OR nhiều status — lấy 2 lần rồi gộp.
      const [waiting, arrived] = await Promise.all([
        getPurchaseRequestsApi({ status: "WAITING_STORED", pageSize: 100 }),
        getPurchaseRequestsApi({
          status: "ARRIVED_ORIGIN_WAREHOUSE",
          pageSize: 100,
        }),
      ]);

      const map = new Map();
      for (const item of [
        ...(waiting?.items || waiting || []),
        ...(arrived?.items || arrived || []),
      ]) {
        const id = item?.purchaseRequestId || item?.id;
        if (!id || !PENDING_STORE_STATUSES.has(String(item?.status || "").toUpperCase())) {
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
    const id =
      approveTarget.purchaseRequestId || approveTarget.id;
    if (!id) return;

    setSubmitting(true);
    try {
      await approveStorePurchaseApi(id, {
        note: note.trim(),
        warehouseId:
          approveTarget.warehouseId ||
          approveTarget.destinationWarehouseId ||
          undefined,
      });
      setNotice({
        type: "success",
        message: `Đã duyệt nhập kho ${approveTarget.purchaseCode || id} → STORED.`,
      });
      setApproveTarget(null);
      setNote("");
      await loadData({ refresh: true });
    } catch (error) {
      setNotice({
        type: "error",
        message: getOperationsApiError(error, "Duyệt nhập kho thất bại."),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "purchaseCode",
        fixed: "left",
        render: (value) => (
          <Typography.Text code>{value || "—"}</Typography.Text>
        ),
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
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
        title: "Tuyến",
        dataIndex: "route",
        render: (value) => value || "—",
      },
      {
        title: "Kho dự kiến",
        render: (_, row) =>
          row.warehouseName || row.destinationWarehouseName || "—",
      },
      {
        title: "Ngày tạo",
        dataIndex: "createdAt",
        render: (value) =>
          value ? new Date(value).toLocaleString("vi-VN") : "—",
      },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 140,
        render: (_, row) => (
          <Button
            type="link"
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
          <span>Mua hộ</span>
          <h1>Duyệt nhập kho mua hộ</h1>
          <p>
            Sale đẩy đơn tới <code>WAITING_STORED</code>. Ops/Manager gọi{" "}
            <code>approve-store</code> → <code>STORED</code>. Sale không được
            bấm bước này.
          </p>
        </div>
        <div className="ops-page__hero-actions">
          <div className="ops-page__weight-chip">
            <small>Chờ duyệt</small>
            <strong>{rows.length}</strong>
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
        <div className="ops-table-card__head">
          <h3>Đơn mua hộ chờ nhập kho</h3>
          <span>{rows.length} đơn</span>
        </div>
        <Table
          rowKey={(row) => row.purchaseRequestId || row.id}
          columns={columns}
          dataSource={rows}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: "Không có đơn chờ duyệt nhập kho." }}
        />
      </div>

      <Modal
        open={Boolean(approveTarget)}
        title={
          approveTarget
            ? `Duyệt nhập kho ${approveTarget.purchaseCode || ""}`
            : "Duyệt nhập kho"
        }
        onCancel={() => {
          if (submitting) return;
          setApproveTarget(null);
          setNote("");
        }}
        onOk={handleApprove}
        okText="Duyệt → STORED"
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="API: POST /api/purchase-requests/{id}/approve-store — trạng thái sau duyệt là STORED (không phải COMPLETED)."
        />
        <label htmlFor="ops-store-note">Ghi chú kiểm kê (tuỳ chọn)</label>
        <Input.TextArea
          id="ops-store-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ví dụ: Kiểm kê đủ số lượng."
          style={{ marginTop: 6 }}
        />
        <Space style={{ marginTop: 12 }}>
          <Typography.Text type="secondary">
            Khách: {approveTarget?.customerName || "—"} · Kho:{" "}
            {approveTarget?.warehouseName ||
              approveTarget?.destinationWarehouseName ||
              "—"}
          </Typography.Text>
        </Space>
      </Modal>
    </div>
  );
}
