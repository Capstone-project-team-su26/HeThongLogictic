import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { FilePdfOutlined, SendOutlined, DeleteOutlined } from "@ant-design/icons";
import { jsPDF } from "jspdf";

import {
  addParcelsToMasterBox,
  canDeleteMasterBox,
  confirmMasterBoxPacking,
  deleteMasterBox,
  getMasterBoxDetail,
  getOperationsApiError,
  isParcelEligible,
  listCarriers,
  listConsolidationInventory,
  listShipments,
  listShippingMethods,
  listWarehouses,
  MASTER_BOX_STATUS_META,
  removeParcelFromMasterBox,
  SHIPMENT_STATUS_META,
} from "../../../api/OperationsAPI/consolidationWorkflowService";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

const sumBy = (rows, key) =>
  rows.reduce((sum, row) => sum + (Number(row?.[key]) || 0), 0);

function exportManifestPdf({ box, parcels, warehouses, carriers, shippingMethods, shipment }) {
  const pdf = new jsPDF();
  const value = (input, suffix = "") =>
    input == null || input === "" ? "-" : `${input}${suffix}`;
  const warehouseLabel = (id) => {
    const row = warehouses.find((item) => item.id === id);
    return row ? `${row.code} - ${row.name}` : "-";
  };

  pdf.setFontSize(16);
  pdf.text("Consolidation Manifest", 14, 16);
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 23);

  let y = 32;
  const lines = [
    `Master box: ${value(box.code)}`,
    `Status: ${value(box.status)}`,
    `Origin: ${warehouseLabel(box.originWarehouseId)}`,
    `Destination: ${warehouseLabel(box.destinationWarehouseId)}`,
    `Carrier: ${value(carriers.find((row) => row.id === box.carrierId)?.name)}`,
    `Shipping method: ${value(shippingMethods.find((row) => row.id === box.shippingMethodId)?.name)}`,
    `Shipment: ${value(shipment?.code)}`,
    `Parcels: ${parcels.length}`,
    `Total chargeable weight (kg): ${value(sumBy(parcels, "chargeableWeight"))}`,
    `Total volume (m3): ${value(sumBy(parcels, "volume"))}`,
  ];
  for (const line of lines) {
    pdf.text(line, 14, y);
    y += 6;
  }

  y += 4;
  pdf.setFontSize(11);
  pdf.text("Parcels", 14, y);
  y += 7;
  pdf.setFontSize(9);

  for (const parcel of parcels) {
    if (y > 280) {
      pdf.addPage();
      y = 16;
    }
    const line = `${value(parcel.parcelCode)} | ${value(parcel.orderCode)} | ${value(parcel.customerName)} | ${value(parcel.chargeableWeight)} kg | ${value(parcel.volume)} m3`;
    pdf.text(line.slice(0, 110), 14, y);
    y += 5;
  }

  pdf.save(`${box.code || "manifest"}.pdf`);
}

export default function MasterBoxDetailModal({
  open,
  boxId,
  onClose,
  onChanged,
  onCreateShipment,
  onDeleted,
}) {
  const [box, setBox] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [eligiblePool, setEligiblePool] = useState([]);
  const [trackings, setTrackings] = useState([]);
  const [lookups, setLookups] = useState({
    warehouses: [],
    carriers: [],
    shippingMethods: [],
    shipment: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState("");
  const [pickParcelId, setPickParcelId] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [detail, inventory, warehouses, carriers, shippingMethods, shipments] =
        await Promise.all([
          getMasterBoxDetail(boxId),
          listConsolidationInventory(),
          listWarehouses(),
          listCarriers(),
          listShippingMethods(),
          listShipments(),
        ]);
      const current = detail.box;
      setBox(current);
      setParcels(detail.parcels);
      setEligiblePool(
        inventory.filter((row) => {
          if (!isParcelEligible(row)) return false;
          if (
            current?.originWarehouseId &&
            row.warehouseId &&
            row.warehouseId !== current.originWarehouseId
          ) {
            return false;
          }
          return true;
        })
      );
      setLookups({
        warehouses,
        carriers,
        shippingMethods,
        shipment: shipments.find((row) => row.id === current?.shipmentId) ?? null,
      });
      setTrackings(detail.trackings ?? []);
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tải chi tiết master box."));
    } finally {
      setIsLoading(false);
    }
  }, [boxId]);

  useEffect(() => {
    if (!open || !boxId) return undefined;
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [open, boxId, load]);

  const isDraft = box?.status === "DRAFT";

  const totals = useMemo(
    () => ({
      packages: parcels.length,
      actualWeight: sumBy(parcels, "actualWeight"),
      chargeableWeight: sumBy(parcels, "chargeableWeight"),
      volume: sumBy(parcels, "volume"),
    }),
    [parcels]
  );

  const warehouseLabel = (id) => {
    const row = lookups.warehouses.find((item) => item.id === id);
    return row ? `${row.code} — ${row.name}` : "—";
  };

  async function run(action, message) {
    if (isActing) return;
    setIsActing(true);
    setError("");
    try {
      await action();
      await load();
      onChanged?.(message);
    } catch (err) {
      setError(getOperationsApiError(err, "Thao tác không thành công."));
    } finally {
      setIsActing(false);
    }
  }

  async function handleDeleteLot() {
    if (isActing || !canDeleteMasterBox(box)) return;
    setIsActing(true);
    setError("");
    try {
      await deleteMasterBox(boxId);
      const message = `Đã xóa lô ${box?.code || boxId}.`;
      onDeleted?.(box);
      onChanged?.(message);
      onClose?.();
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể xóa lô."));
    } finally {
      setIsActing(false);
    }
  }

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
    ...(isDraft
      ? [
          {
            title: "",
            width: 72,
            render: (_, row) => (
              <Popconfirm
                title={`Rút ${row.parcelCode} khỏi master box?`}
                okText="Rút"
                cancelText="Hủy"
                onConfirm={() =>
                  run(
                    () => removeParcelFromMasterBox(boxId, row.id),
                    `Đã rút ${row.parcelCode} khỏi ${box?.code}.`
                  )
                }
              >
                <Button size="small" type="link" danger disabled={isActing}>
                  Rút ra
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  const statusMeta = MASTER_BOX_STATUS_META[box?.status] ?? {
    label: box?.status,
    tone: "default",
  };
  const shipmentMeta = SHIPMENT_STATUS_META[lookups.shipment?.status];

  return (
    <Modal
      open={open}
      title={
        <>
          Master box <Typography.Text code>{box?.code ?? "…"}</Typography.Text>
        </>
      }
      onCancel={onClose}
      width={920}
      destroyOnHidden
      footer={
        <Space wrap>
          <Button
            icon={<FilePdfOutlined />}
            disabled={!box || !parcels.length}
            onClick={() =>
              exportManifestPdf({
                box,
                parcels,
                warehouses: lookups.warehouses,
                carriers: lookups.carriers,
                shippingMethods: lookups.shippingMethods,
                shipment: lookups.shipment,
              })
            }
          >
            Xuất manifest
          </Button>
          {box?.status === "PACKED" ? (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => onCreateShipment?.(box)}
            >
              Tạo yêu cầu xuất kho
            </Button>
          ) : null}
          {canDeleteMasterBox(box) ? (
            <Popconfirm
              title={`Xóa lô ${box?.code || ""}?`}
              description="Kiện trong lô sẽ được trả về tồn kho chờ gom."
              okText="Xóa lô"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={handleDeleteLot}
            >
              <Button danger icon={<DeleteOutlined />} disabled={isActing}>
                Xóa lô
              </Button>
            </Popconfirm>
          ) : null}
          <Button onClick={onClose}>Đóng</Button>
        </Space>
      }
    >
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Mã master box">{box?.code ?? "—"}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <Tag color={statusMeta.tone}>{statusMeta.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Kho xuất">
          {box ? warehouseLabel(box.originWarehouseId) : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Kho đích">
          {box
            ? box.destinationWarehouseId
              ? warehouseLabel(box.destinationWarehouseId)
              : box.route || "—"
            : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Phương thức">
          {lookups.shippingMethods.find((row) => row.id === box?.shippingMethodId)?.name ?? "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Hãng vận chuyển">
          {lookups.carriers.find((row) => row.id === box?.carrierId)?.name ?? "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Số kiện">{totals.packages}</Descriptions.Item>
        <Descriptions.Item label="Tổng KG tính cước">
          {formatNumber(totals.chargeableWeight, " kg")}
        </Descriptions.Item>
        <Descriptions.Item label="Tổng thể tích">
          {formatNumber(totals.volume, " m³")}
        </Descriptions.Item>
        <Descriptions.Item label="Shipment">
          {lookups.shipment ? (
            <Space size={6}>
              <Typography.Text code>{lookups.shipment.code}</Typography.Text>
              {shipmentMeta ? <Tag color={shipmentMeta.tone}>{shipmentMeta.label}</Tag> : null}
            </Space>
          ) : (
            "—"
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Ghi chú" span={2}>
          {box?.note || "—"}
        </Descriptions.Item>
      </Descriptions>

      {isDraft ? (
        <div className="ops-selection-bar" style={{ marginBottom: 12 }}>
          <Space size={8} wrap>
            <Select
              showSearch
              placeholder="Thêm kiện cùng kho xuất..."
              style={{ minWidth: 320 }}
              value={pickParcelId || undefined}
              options={eligiblePool.map((row) => ({
                value: row.id,
                label: `${row.parcelCode} · ${row.customerName} · ${formatNumber(
                  row.chargeableWeight,
                  " kg"
                )}`,
              }))}
              onChange={setPickParcelId}
              allowClear
            />
            <Button
              disabled={!pickParcelId || isActing}
              onClick={() =>
                run(
                  () => addParcelsToMasterBox(boxId, [pickParcelId]),
                  "Đã thêm kiện vào master box."
                ).then(() => setPickParcelId(""))
              }
            >
              Thêm kiện
            </Button>
            <Popconfirm
              title={`Xác nhận gom ${box?.code}? Sau khi xác nhận không thêm/rút kiện được nữa.`}
              okText="Xác nhận"
              cancelText="Hủy"
              onConfirm={() =>
                run(() => confirmMasterBoxPacking(boxId), `Đã gom ${box?.code}.`)
              }
            >
              <Button type="primary" disabled={isActing || !parcels.length}>
                Xác nhận gom
              </Button>
            </Popconfirm>
          </Space>
        </div>
      ) : null}

      <Typography.Title level={5}>Kiện trong master box ({parcels.length})</Typography.Title>
      <Table
        rowKey="id"
        size="small"
        loading={isLoading}
        columns={parcelColumns}
        dataSource={parcels}
        pagination={{ pageSize: 6, showSizeChanger: false }}
        locale={{ emptyText: "Chưa có kiện nào." }}
        style={{ marginBottom: 16 }}
      />

      <Typography.Title level={5}>Lịch sử (trackings)</Typography.Title>
      {trackings.length ? (
        <Timeline
          items={trackings.map((event) => ({
            children: (
              <>
                <Typography.Text strong>{event.message}</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {event.status} · {formatDateTime(event.at)}
                </Typography.Text>
              </>
            ),
          }))}
        />
      ) : (
        <Typography.Text type="secondary">Chưa có sự kiện.</Typography.Text>
      )}
    </Modal>
  );
}
