import { Alert, Button, Descriptions, Modal, Tag, Typography } from "antd";

import {
  getInventoryStatusMeta,
  getPackageStatusMeta,
} from "../../../api/OperationsAPI/consolidationWorkflowService";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

export default function ParcelDetailModal({
  open,
  parcel,
  warehouse,
  destinationWarehouse,
  shippingMethod,
  masterBox,
  blockReason,
  onClose,
}) {
  if (!parcel) return null;

  const packageMeta = getPackageStatusMeta(parcel);
  const inventoryMeta = getInventoryStatusMeta(parcel.inventoryStatus);

  const dims =
    parcel.length != null
      ? `${parcel.length} × ${parcel.width} × ${parcel.height} cm`
      : "—";

  return (
    <Modal
      open={open}
      title={
        <>
          Chi tiết kiện <Typography.Text code>{parcel.parcelCode}</Typography.Text>
        </>
      }
      onCancel={onClose}
      width={720}
      destroyOnHidden
      footer={
        <Button type="primary" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      {blockReason ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Kiện chưa đủ điều kiện gom hàng"
          description={blockReason}
        />
      ) : (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message="Kiện đủ điều kiện gom vào master box."
        />
      )}

      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Mã kiện">{parcel.parcelCode}</Descriptions.Item>
        <Descriptions.Item label="Mã đơn/ký gửi">{parcel.orderCode}</Descriptions.Item>
        <Descriptions.Item label="Khách hàng">{parcel.customerName}</Descriptions.Item>
        <Descriptions.Item label="Tuyến">{parcel.route}</Descriptions.Item>
        <Descriptions.Item label="Kho">
          {warehouse ? `${warehouse.code} — ${warehouse.name}` : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Bin / kệ">
          {parcel.binCode} · {parcel.shelfCode}
        </Descriptions.Item>
        <Descriptions.Item label="Kho đích">
          {destinationWarehouse
            ? `${destinationWarehouse.code} — ${destinationWarehouse.name}`
            : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Phương thức">
          {shippingMethod?.name ?? parcel.serviceType ?? "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Kích thước">{dims}</Descriptions.Item>
        <Descriptions.Item label="KG thực">
          {formatNumber(parcel.actualWeight, " kg")}
        </Descriptions.Item>
        <Descriptions.Item label="KG quy đổi">
          {formatNumber(parcel.volumetricWeight, " kg")}
        </Descriptions.Item>
        <Descriptions.Item label="KG tính cước">
          <Typography.Text strong>
            {formatNumber(parcel.chargeableWeight, " kg")}
          </Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="Thể tích">
          {formatNumber(parcel.volume, " m³")}
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái kiện">
          <Tag color={packageMeta.tone}>{packageMeta.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Trạng thái tồn kho">
          <Tag color={inventoryMeta.tone}>{inventoryMeta.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Master box">
          {masterBox ? <Typography.Text code>{masterBox.code}</Typography.Text> : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Ghi chú">{parcel.note || "—"}</Descriptions.Item>
      </Descriptions>
    </Modal>
  );
}
