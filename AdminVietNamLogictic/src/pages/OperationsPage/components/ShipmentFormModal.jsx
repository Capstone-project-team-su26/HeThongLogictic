import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Modal, Select, Space, Table, Typography } from "antd";

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
  carriers,
  onClose,
  onSubmit,
}) {
  const [boxes, setBoxes] = useState(masterBoxes);
  const [carrierId, setCarrierId] = useState("");
  const [exportReason, setExportReason] = useState("");
  const [shelfCode, setShelfCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      const firstBox = masterBoxes[0];
      setBoxes(masterBoxes);
      setCarrierId(firstBox?.carrierId ?? "");
      setExportReason("Xuất kho gom hàng quốc tế");
      setShelfCode("");
      setError("");
      setIsSubmitting(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, masterBoxes]);

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
    if (!boxes.length) return setError("Cần ít nhất một master box.");

    setIsSubmitting(true);
    try {
      await onSubmit({
        carrierId,
        shelfCode: shelfCode.trim(),
        exportReason: exportReason.trim(),
        masterBoxIds: boxes.map((row) => row.id),
      });
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tạo yêu cầu xuất kho."));
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Tạo yêu cầu xuất kho (WRO)"
      onCancel={onClose}
      width={720}
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
              Tạo yêu cầu xuất kho
            </Button>
          </Space>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="WRO tạo xong sẽ ở trạng thái Chờ duyệt. Vào mục Duyệt xuất kho để duyệt; sau khi duyệt mới picking → xuất kho → tạo shipment quốc tế. Master box đã pack (RESERVED) không tạo WRO được."
      />

      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}

      <div className="ops-form-grid">
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
          <label>Kệ / shelf</label>
          <Input
            value={shelfCode}
            placeholder="shelfCode (tuỳ chọn)"
            onChange={(event) => setShelfCode(event.target.value)}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>Lý do xuất kho</label>
          <Input
            value={exportReason}
            placeholder="exportReason (WRO)"
            onChange={(event) => setExportReason(event.target.value)}
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
