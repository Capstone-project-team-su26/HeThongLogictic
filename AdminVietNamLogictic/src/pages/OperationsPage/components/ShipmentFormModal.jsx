import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";

import {
  getOperationsApiError,
  TRANSPORT_MODES,
} from "../../../api/OperationsAPI/consolidationWorkflowService";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

const sumBy = (rows, key) =>
  rows.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);

export default function ShipmentFormModal({
  open,
  masterBoxes,
  parcelsByBoxId,
  warehouses,
  carriers,
  shippingMethods,
  shippingRoutes = [],
  onClose,
  onSubmit,
}) {
  const [boxes, setBoxes] = useState(masterBoxes);
  const [originWarehouseId, setOriginWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [shippingRouteId, setShippingRouteId] = useState("");
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState(null);
  const [exportReason, setExportReason] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      const firstBox = masterBoxes[0];
      const method =
        shippingMethods.find((row) => row.id === firstBox?.shippingMethodId) ?? null;
      setBoxes(masterBoxes);
      setOriginWarehouseId(firstBox?.originWarehouseId ?? "");
      setDestinationWarehouseId(firstBox?.destinationWarehouseId ?? "");
      setCarrierId(firstBox?.carrierId ?? "");
      setShippingMethodId(firstBox?.shippingMethodId ?? "");
      setTransportMode(method?.mode || "");
      setShippingRouteId("");
      setEstimatedDeliveryDays(null);
      setExportReason("Xuất kho gom hàng quốc tế");
      setNote("");
      setError("");
      setIsSubmitting(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, masterBoxes, shippingMethods]);

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

  const totals = useMemo(() => {
    const parcels = boxes.flatMap((box) => parcelsByBoxId.get(box.id) ?? []);
    return {
      packages: parcels.length,
      chargeableWeight: sumBy(parcels, "chargeableWeight"),
      volume: sumBy(parcels, "volume"),
    };
  }, [boxes, parcelsByBoxId]);

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
    if (route.estimatedTransitDays != null) {
      setEstimatedDeliveryDays(route.estimatedTransitDays);
    }
  }

  function handleMethodChange(value) {
    setShippingMethodId(value ?? "");
    const method = shippingMethods.find((row) => row.id === value);
    if (method?.mode && !selectedRoute) setTransportMode(method.mode);
  }

  const boxColumns = [
    {
      title: "Mã master box",
      dataIndex: "code",
      render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
    },
    {
      title: "Số kiện",
      align: "right",
      render: (_, row) => parcelsByBoxId.get(row.id)?.length ?? 0,
    },
    {
      title: "Tổng KG",
      align: "right",
      render: (_, row) =>
        formatNumber(sumBy(parcelsByBoxId.get(row.id) ?? [], "chargeableWeight"), " kg"),
    },
    {
      title: "",
      width: 64,
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          danger
          onClick={() => setBoxes((current) => current.filter((item) => item.id !== row.id))}
        >
          Bỏ
        </Button>
      ),
    },
  ];

  async function handleSubmit() {
    if (isSubmitting) return;
    setError("");
    if (!boxes.length) return setError("Shipment cần ít nhất một master box.");
    if (!originWarehouseId) return setError("Cần chọn kho xuất.");
    if (!destinationWarehouseId) return setError("Cần chọn kho đích.");
    if (!transportMode) {
      return setError("Cần chọn phương thức vận chuyển (AIR / SEA / ROAD / RAIL).");
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        originWarehouseId,
        destinationWarehouseId,
        carrierId,
        shippingMethod: transportMode,
        transportMode,
        shippingMethodId,
        shippingRoute: selectedRoute?.code || shippingRouteId || undefined,
        estimatedDeliveryDays,
        exportReason: exportReason.trim(),
        note: note.trim(),
        masterBoxIds: boxes.map((row) => row.id),
      });
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tạo shipment."));
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Tạo shipment quốc tế"
      onCancel={onClose}
      width={900}
      destroyOnHidden
      footer={
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Typography.Text type="secondary">
            {boxes.length} master box · {totals.packages} kiện ·{" "}
            {formatNumber(totals.chargeableWeight, " kg")} ·{" "}
            {formatNumber(totals.volume, " m³")}
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" loading={isSubmitting} onClick={handleSubmit}>
              Tạo WRO + shipment
            </Button>
          </Space>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="BE: WRO chỉ tạo từ tồn AVAILABLE → RELEASE_APPROVED → picking → gán tuyến (PACKING) → complete (RELEASED) → shipment. Master box đã pack (RESERVED) không tạo WRO được."
      />

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
          <label>Phương thức vận chuyển *</label>
          <Select
            style={{ width: "100%" }}
            placeholder="AIR / SEA / ROAD / RAIL"
            value={transportMode || undefined}
            options={TRANSPORT_MODES}
            onChange={(value) => {
              setTransportMode(value ?? "");
              if (
                selectedRoute &&
                selectedRoute.transportMode &&
                selectedRoute.transportMode !== value
              ) {
                setShippingRouteId("");
              }
            }}
          />
        </div>
        <div>
          <label>Tuyến vận chuyển</label>
          <Select
            style={{ width: "100%" }}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chọn tuyến đã cấu hình"
            value={shippingRouteId || undefined}
            options={routeOptions.map((row) => ({
              value: row.id || row.code,
              label: `${row.code} — ${row.name}${
                row.transportMode ? ` (${row.transportMode})` : ""
              }`,
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
        <div>
          <label>Phương án (catalog)</label>
          <Select
            style={{ width: "100%" }}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Shipping method catalog"
            value={shippingMethodId || undefined}
            options={shippingMethods.map((row) => ({
              value: row.id,
              label: row.code ? `${row.code} — ${row.name}` : row.name,
            }))}
            onChange={handleMethodChange}
          />
        </div>
        <div>
          <label>Số ngày vận chuyển dự kiến</label>
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            max={365}
            placeholder="VD: 10"
            value={estimatedDeliveryDays}
            onChange={setEstimatedDeliveryDays}
          />
        </div>
        <div>
          <label>Lý do xuất kho</label>
          <Input
            value={exportReason}
            placeholder="exportReason (WRO)"
            onChange={(event) => setExportReason(event.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Ghi chú tuyến</label>
          <Input.TextArea
            rows={2}
            value={note}
            placeholder="Ghi chú gán tuyến WRO (nếu có)"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Master box đã chọn ({boxes.length})
      </Typography.Title>
      <Table
        rowKey="id"
        size="small"
        columns={boxColumns}
        dataSource={boxes}
        pagination={false}
        locale={{ emptyText: "Chưa có master box nào." }}
      />
    </Modal>
  );
}
