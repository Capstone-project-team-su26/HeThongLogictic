import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Modal, Select, Space, Table, Typography } from "antd";

import {
  getOperationsApiError,
  suggestMasterBoxCode,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import AuthNotify from "../../../utils/Common/AuthNotify";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

const sumBy = (rows, key) =>
  rows.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);

export default function MasterBoxFormModal({
  open,
  parcels,
  warehouses,
  carriers,
  shippingMethods,
  onClose,
  onSubmit,
}) {
  const originWarehouseId = parcels[0]?.warehouseId ?? "";
  const originWarehouse = warehouses.find((row) => row.id === originWarehouseId);

  const [rows, setRows] = useState(parcels);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      setRows(parcels);
      setDestinationWarehouseId("");
      setCarrierId("");
      setNote("");
      setError("");
      const methods = new Set(parcels.map((row) => row.shippingMethodId).filter(Boolean));
      setShippingMethodId(methods.size === 1 ? [...methods][0] : "");
      suggestMasterBoxCode().then(setCode);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, parcels]);

  const totals = useMemo(
    () => ({
      packages: rows.length,
      actualWeight: sumBy(rows, "actualWeight"),
      chargeableWeight: sumBy(rows, "chargeableWeight"),
      volume: sumBy(rows, "volume"),
    }),
    [rows]
  );

  const parcelColumns = [
    {
      title: "Mã kiện",
      dataIndex: "parcelCode",
      render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
    },
    { title: "Mã đơn", dataIndex: "orderCode" },
    { title: "Khách hàng", dataIndex: "customerName", ellipsis: true },
    {
      title: "KG tính cước",
      dataIndex: "chargeableWeight",
      align: "right",
      render: (value) => formatNumber(value, " kg"),
    },
    {
      title: "Thể tích",
      dataIndex: "volume",
      align: "right",
      render: (value) => formatNumber(value, " m³"),
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

  async function handleSubmit() {
    if (isSubmitting) return;
    setError("");
    if (!rows.length) {
      const msg = "Master box cần ít nhất một kiện hàng.";
      AuthNotify.warning("Cảnh báo", msg);
      return setError(msg);
    }
    if (rows.some((row) => !row.orderId)) {
      const msg = "Có kiện thiếu orderId — API consolidation gom theo đơn, không gom theo kiện.";
      AuthNotify.warning("Cảnh báo", msg);
      return setError(msg);
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        code,
        originWarehouseId,
        destinationWarehouseId,
        shippingMethodId,
        carrierId,
        note,
        parcelIds: rows.map((row) => row.id),
      });
    } catch (err) {
      const errMsg = getOperationsApiError(err, "Không thể tạo master box.");
      AuthNotify.error("Lỗi tạo master box", errMsg);
      setError(errMsg);
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Tạo master box"
      onCancel={onClose}
      width={860}
      destroyOnHidden
      footer={
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Typography.Text type="secondary">
            {totals.packages} kiện · {formatNumber(totals.actualWeight, " kg")} thực ·{" "}
            {formatNumber(totals.chargeableWeight, " kg")} tính cước ·{" "}
            {formatNumber(totals.volume, " m³")}
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button type="primary" loading={isSubmitting} onClick={handleSubmit}>
              Tạo master box
            </Button>
          </Space>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="API consolidation gom theo orderIds của các kiện đã chọn (không gom từng parcelId)."
      />
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}

      <div className="ops-form-grid">
        <div>
          <label>Kho xuất</label>
          <Input
            value={originWarehouse ? `${originWarehouse.code} — ${originWarehouse.name}` : "—"}
            disabled
          />
        </div>
        <div>
          <label>Kho đích (tuỳ chọn)</label>
          <Select
            style={{ width: "100%" }}
            allowClear
            placeholder="BE chưa nhận field này khi tạo consolidation"
            value={destinationWarehouseId || undefined}
            options={warehouses
              .filter(
                (row) =>
                  row.role === "DESTINATION" || row.role === "BOTH" || !row.role
              )
              .map((row) => ({ value: row.id, label: `${row.code} — ${row.name}` }))}
            onChange={(value) => setDestinationWarehouseId(value ?? "")}
          />
        </div>
        <div>
          <label>Phương thức vận chuyển (tuỳ chọn)</label>
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
          <label>Hãng vận chuyển (tuỳ chọn)</label>
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
          <label>Mã master box</label>
          <Input
            value={code}
            placeholder="Hệ thống tự sinh…"
            onChange={(event) => setCode(event.target.value)}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Tự sinh theo mẫu BE (MBX-ngày giờ-số). Ops không cần nhớ — để nguyên hoặc sửa nếu muốn.
          </Typography.Text>
        </div>
        <div>
          <label>Ghi chú nội bộ</label>
          <Input
            value={note}
            placeholder="VD: gom tuyến Nhật tuần 32"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Kiện đã chọn ({rows.length})
      </Typography.Title>
      <Table
        rowKey="id"
        size="small"
        columns={parcelColumns}
        dataSource={rows}
        pagination={{ pageSize: 6, showSizeChanger: false }}
        locale={{ emptyText: "Chưa có kiện nào." }}
        scroll={{ y: 260 }}
      />
    </Modal>
  );
}
