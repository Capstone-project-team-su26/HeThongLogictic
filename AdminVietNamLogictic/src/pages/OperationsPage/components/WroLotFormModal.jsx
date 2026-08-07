import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

import {
  getOperationsApiError,
  TRANSPORT_MODES,
  WRO_STATUS_META,
} from "../../../api/OperationsAPI/consolidationWorkflowService";

export default function WroLotFormModal({
  open,
  wros = [],
  warehouses = [],
  carriers = [],
  shippingRoutes = [],
  onClose,
  onSubmit,
}) {
  const [rows, setRows] = useState(wros);
  const [originWarehouseId, setOriginWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [shippingRouteId, setShippingRouteId] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      setRows(wros);
      const routeId = wros.find((row) => row.shippingRouteId)?.shippingRouteId || "";
      const route = shippingRoutes.find((item) => item.id === routeId);
      setShippingRouteId(routeId);
      setOriginWarehouseId(route?.originWarehouseId || "");
      setDestinationWarehouseId(route?.destinationWarehouseId || "");
      setCarrierId(wros.find((row) => row.carrierId)?.carrierId || route?.carrierId || "");
      setTransportMode(route?.transportMode || "");
      setNote("");
      setError("");
      setIsSubmitting(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, wros, shippingRoutes]);

  const originOptions = useMemo(
    () =>
      warehouses.filter(
        (row) => row.role === "ORIGIN" || row.role === "BOTH" || !row.role
      ),
    [warehouses]
  );
  const destinationOptions = useMemo(
    () =>
      warehouses.filter(
        (row) => row.role === "DESTINATION" || row.role === "BOTH" || !row.role
      ),
    [warehouses]
  );

  const routeOptions = useMemo(() => {
    const active = shippingRoutes.filter((row) => row.isActive !== false);
    if (!transportMode) return active;
    return active.filter((row) => !row.transportMode || row.transportMode === transportMode);
  }, [shippingRoutes, transportMode]);

  const selectedRoute = shippingRoutes.find(
    (row) => row.id === shippingRouteId || row.code === shippingRouteId
  );

  const routeMismatch = useMemo(() => {
    const ids = [
      ...new Set(rows.map((row) => row.shippingRouteId).filter(Boolean)),
    ];
    return ids.length > 1;
  }, [rows]);

  function handleRouteChange(value) {
    const route =
      shippingRoutes.find((row) => row.id === value || row.code === value) ?? null;
    setShippingRouteId(value ?? "");
    if (!route) return;
    if (route.transportMode) setTransportMode(route.transportMode);
    if (route.originWarehouseId) setOriginWarehouseId(route.originWarehouseId);
    if (route.destinationWarehouseId) {
      setDestinationWarehouseId(route.destinationWarehouseId);
    }
    if (route.carrierId) setCarrierId(route.carrierId);
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setError("");
    if (!rows.length) return setError("Cần ít nhất một phiếu WRO RELEASED.");
    if (routeMismatch) {
      return setError("Các WRO phải cùng tuyến vận chuyển.");
    }
    if (!originWarehouseId) return setError("Cần chọn kho xuất.");
    if (!destinationWarehouseId) return setError("Cần chọn kho đích.");

    setIsSubmitting(true);
    try {
      await onSubmit({
        wroRequestIds: rows.map((row) => row.id),
        originWarehouseId,
        destinationWarehouseId,
        carrierId,
        shippingMethod: transportMode || undefined,
        transportMode,
        shippingRoute: selectedRoute?.code || shippingRouteId || undefined,
        note: note.trim(),
      });
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tạo lô từ WRO."));
      setIsSubmitting(false);
    }
  }

  const columns = [
    {
      title: "Mã WRO",
      dataIndex: "code",
      render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status) => {
        const meta = WRO_STATUS_META[status] || { label: status, tone: "default" };
        return <Tag color={meta.tone}>{meta.label}</Tag>;
      },
    },
    {
      title: "Người nhận",
      dataIndex: "receiverName",
      render: (value, row) => value || row.customerName || "—",
    },
    {
      title: "Tuyến",
      dataIndex: "shippingRoute",
      render: (value) => value || "—",
    },
    {
      title: "Kiện",
      align: "right",
      render: (_, row) => row.items?.length || row.totalQuantity || 0,
    },
    {
      title: "",
      width: 64,
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          danger
          onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
        >
          Bỏ
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title="Gom lô từ phiếu WRO đã xuất kho"
      onCancel={onClose}
      width={920}
      destroyOnHidden
      footer={
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Typography.Text type="secondary">
            {rows.length} phiếu WRO · BE validate cùng kho + cùng tuyến
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" loading={isSubmitting} onClick={handleSubmit}>
              Tạo lô vận chuyển
            </Button>
          </Space>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Chỉ gom WRO trạng thái RELEASED. BE chặn nếu khác kho xuất hoặc khác tuyến."
      />
      {routeMismatch ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Đang chọn WRO khác tuyến — bỏ bớt trước khi tạo lô."
        />
      ) : null}
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}

      <div className="ops-form-grid">
        <div>
          <label>Kho xuất *</label>
          <Select
            style={{ width: "100%" }}
            placeholder="Chọn kho xuất"
            value={originWarehouseId || undefined}
            options={originOptions.map((row) => ({
              value: row.id,
              label: `${row.code} — ${row.name}`,
            }))}
            onChange={setOriginWarehouseId}
          />
        </div>
        <div>
          <label>Kho đích *</label>
          <Select
            style={{ width: "100%" }}
            placeholder="Chọn kho đích"
            value={destinationWarehouseId || undefined}
            options={destinationOptions.map((row) => ({
              value: row.id,
              label: `${row.code} — ${row.name}`,
            }))}
            onChange={setDestinationWarehouseId}
          />
        </div>
        <div>
          <label>Phương thức</label>
          <Select
            style={{ width: "100%" }}
            allowClear
            placeholder="AIR / SEA / ROAD / RAIL"
            value={transportMode || undefined}
            options={TRANSPORT_MODES}
            onChange={(value) => setTransportMode(value ?? "")}
          />
        </div>
        <div>
          <label>Tuyến vận chuyển</label>
          <Select
            style={{ width: "100%" }}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chọn tuyến"
            value={shippingRouteId || undefined}
            options={routeOptions.map((row) => ({
              value: row.id || row.code,
              label: `${row.code} — ${row.name}`,
            }))}
            onChange={handleRouteChange}
          />
        </div>
        <div>
          <label>Hãng vận chuyển</label>
          <Select
            style={{ width: "100%" }}
            allowClear
            placeholder="Tuỳ chọn"
            value={carrierId || undefined}
            options={carriers.map((row) => ({ value: row.id, label: row.name }))}
            onChange={(value) => setCarrierId(value ?? "")}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Ghi chú</label>
          <Input.TextArea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        WRO đã chọn ({rows.length})
      </Typography.Title>
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: "Chưa chọn WRO nào." }}
      />
    </Modal>
  );
}
