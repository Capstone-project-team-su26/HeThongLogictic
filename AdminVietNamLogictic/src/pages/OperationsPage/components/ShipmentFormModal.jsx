import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";

import { getOperationsApiError } from "../../../api/OperationsAPI/consolidationWorkflowService";

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
  onClose,
  onSubmit,
}) {
  const [boxes, setBoxes] = useState(masterBoxes);
  const [originWarehouseId, setOriginWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [sea, setSea] = useState({ vessel: "", voyage: "" });
  const [seaDates, setSeaDates] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      setBoxes(masterBoxes);
      setOriginWarehouseId(masterBoxes[0]?.originWarehouseId ?? "");
      setDestinationWarehouseId(masterBoxes[0]?.destinationWarehouseId ?? "");
      setCarrierId(masterBoxes[0]?.carrierId ?? "");
      setShippingMethodId(masterBoxes[0]?.shippingMethodId ?? "");
      setReceiverName("");
      setReceiverPhone("");
      setDeliveryAddress("");
      setSea({ vessel: "", voyage: "" });
      setSeaDates({});
      setError("");
      setIsSubmitting(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, masterBoxes]);

  const selectedMethod = shippingMethods.find((row) => row.id === shippingMethodId);
  const isSea = selectedMethod?.mode === "SEA";

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

  const totals = useMemo(() => {
    const parcels = boxes.flatMap((box) => parcelsByBoxId.get(box.id) ?? []);
    return {
      packages: parcels.length,
      chargeableWeight: sumBy(parcels, "chargeableWeight"),
      volume: sumBy(parcels, "volume"),
    };
  }, [boxes, parcelsByBoxId]);

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
    if (!receiverName.trim() || !receiverPhone.trim() || !deliveryAddress.trim()) {
      return setError("Cần nhập người nhận / SĐT / địa chỉ để tạo WRO trước khi xuất shipment.");
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        originWarehouseId,
        destinationWarehouseId,
        carrierId,
        shippingMethodId,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        masterBoxIds: boxes.map((row) => row.id),
        seaDetails: isSea
          ? {
              vessel: sea.vessel,
              voyage: sea.voyage,
              siCutOff: seaDates.siCutOff?.toISOString?.() ?? null,
              vgmCutOff: seaDates.vgmCutOff?.toISOString?.() ?? null,
              cyCutOff: seaDates.cyCutOff?.toISOString?.() ?? null,
              cfsCutOff: seaDates.cfsCutOff?.toISOString?.() ?? null,
            }
          : null,
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
        message="BE yêu cầu WRO ở trạng thái RELEASED trước khi tạo shipment. Hệ thống sẽ tự: tạo WRO → duyệt → picking → xác nhận → complete → tạo shipment quốc tế."
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
          <label>Phương thức vận chuyển</label>
          <Select
            style={{ width: "100%" }}
            allowClear
            placeholder="Tuỳ chọn"
            value={shippingMethodId || undefined}
            options={shippingMethods.map((row) => ({ value: row.id, label: row.name }))}
            onChange={(value) => setShippingMethodId(value ?? "")}
          />
        </div>
        <div>
          <label>Người nhận (WRO) *</label>
          <Input
            value={receiverName}
            placeholder="Họ tên người nhận tại kho đích"
            onChange={(event) => setReceiverName(event.target.value)}
          />
        </div>
        <div>
          <label>SĐT người nhận *</label>
          <Input
            value={receiverPhone}
            placeholder="Số điện thoại"
            onChange={(event) => setReceiverPhone(event.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Địa chỉ giao / nhận *</label>
          <Input
            value={deliveryAddress}
            placeholder="Địa chỉ kho đích hoặc địa chỉ nhận hàng"
            onChange={(event) => setDeliveryAddress(event.target.value)}
          />
        </div>
      </div>

      {isSea ? (
        <>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Thông tin đường biển
          </Typography.Title>
          <div className="ops-form-grid">
            <div>
              <label>Tàu (vessel)</label>
              <Input
                value={sea.vessel}
                onChange={(event) =>
                  setSea((current) => ({ ...current, vessel: event.target.value }))
                }
              />
            </div>
            <div>
              <label>Chuyến (voyage)</label>
              <Input
                value={sea.voyage}
                onChange={(event) =>
                  setSea((current) => ({ ...current, voyage: event.target.value }))
                }
              />
            </div>
            {[
              ["siCutOff", "SI cut-off"],
              ["vgmCutOff", "VGM cut-off"],
              ["cyCutOff", "CY cut-off"],
              ["cfsCutOff", "CFS cut-off"],
            ].map(([key, label]) => (
              <div key={key}>
                <label>{label}</label>
                <DatePicker
                  showTime
                  style={{ width: "100%" }}
                  value={seaDates[key] ?? null}
                  onChange={(value) =>
                    setSeaDates((current) => ({ ...current, [key]: value }))
                  }
                />
              </div>
            ))}
          </div>
        </>
      ) : null}

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
