import { useEffect, useState } from "react";
import { Alert, Button, Descriptions, Modal, Space, Table, Tag, Typography } from "antd";
import { FilePdfOutlined } from "@ant-design/icons";
import { jsPDF } from "jspdf";

import {
  countConsolidationParcels,
  getConsolidationDetail,
  getConsolidationStatusMeta,
  getOperationsApiError,
} from "../../../api/OperationsAPI/consolidationService";
import {
  canonicalizeConsignmentStatus,
  getConsignmentStatusLabel,
} from "../../../api/OperationsAPI/operationsMappers";

function formatNumber(value, suffix = "") {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString("vi-VN")}${suffix}`
    : "—";
}

function formatDimensions(parcel) {
  if (parcel?.length == null && parcel?.width == null && parcel?.height == null) {
    return "—";
  }
  const part = (value) =>
    value == null ? "?" : Number(value).toLocaleString("vi-VN");
  return `${part(parcel.length)} × ${part(parcel.width)} × ${part(parcel.height)} cm`;
}

async function exportManifestPdf(detail) {
  const pdf = new jsPDF();
  const value = (input, suffix = "") =>
    input == null || input === "" ? "-" : `${input}${suffix}`;

  pdf.setFontSize(16);
  pdf.text("Consolidation Manifest", 14, 16);
  pdf.setFontSize(10);
  pdf.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 23);

  let y = 32;
  const lines = [
    `Master code: ${value(detail.masterCode)}`,
    `Status: ${value(detail.status)}`,
    `Total weight (kg): ${value(detail.totalWeight)}`,
    `Total volume (m3): ${value(detail.totalVolume)}`,
    `Orders: ${detail.orders?.length ?? 0}`,
    `Parcels: ${countConsolidationParcels(detail)}`,
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

  for (const order of detail.orders ?? []) {
    const parcels = order.parcels?.length ? order.parcels : [null];
    for (const parcel of parcels) {
      if (y > 280) {
        pdf.addPage();
        y = 16;
      }
      const dims = parcel
        ? formatDimensions(parcel).replace("—", "-")
        : "-";
      const line = `${value(order.consignmentCode)} | ${value(parcel?.packageCode)} | ${dims} | ${value(parcel?.actualWeight)} kg | ${value(parcel?.packageStatus ?? order.status)}`;
      pdf.text(line.slice(0, 110), 14, y);
      y += 5;
    }
  }

  pdf.save(`${detail.masterCode || "consolidation"}.pdf`);
}

export default function ConsolidationDetailDialog({
  consolidationId,
  open,
  onClose,
}) {
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!open || !consolidationId) return undefined;
    let active = true;

    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError("");
      setDetail(null);

      getConsolidationDetail(consolidationId)
        .then((data) => {
          if (active) setDetail(data);
        })
        .catch((err) => {
          if (active) {
            setError(
              getOperationsApiError(err, "Không thể tải chi tiết lô gom hàng.")
            );
          }
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, consolidationId]);

  async function handleExport() {
    if (!detail) return;
    setIsExporting(true);
    try {
      await exportManifestPdf(detail);
    } finally {
      setIsExporting(false);
    }
  }

  const statusMeta = getConsolidationStatusMeta(detail?.status);

  const orderColumns = [
    {
      title: "Mã lô",
      dataIndex: "consignmentCode",
      render: (value) => <Typography.Text code>{value || "—"}</Typography.Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status) => (
        <Tag>{getConsignmentStatusLabel(canonicalizeConsignmentStatus(status))}</Tag>
      ),
    },
    {
      title: "Kiện",
      align: "right",
      render: (_, row) => row.parcels?.length ?? 0,
    },
    {
      title: "KG",
      dataIndex: "totalWeight",
      align: "right",
      render: (value) => formatNumber(value, " kg"),
    },
  ];

  const parcelRows = [];
  for (const order of detail?.orders ?? []) {
    for (const parcel of order.parcels ?? []) {
      parcelRows.push({
        key: `${order.consignmentCode}-${parcel.packageCode || parcel.parcelId}`,
        consignmentCode: order.consignmentCode,
        packageCode: parcel.packageCode,
        dims: formatDimensions(parcel),
        actualWeight: parcel.actualWeight,
        status: parcel.packageStatus ?? order.status,
      });
    }
  }

  return (
    <Modal
      open={open}
      title="Chi tiết lô gom hàng"
      onCancel={onClose}
      width={900}
      destroyOnHidden
      footer={
        <Space>
          <Button
            icon={<FilePdfOutlined />}
            disabled={!detail}
            loading={isExporting}
            onClick={handleExport}
          >
            Xuất PDF
          </Button>
          <Button type="primary" onClick={onClose}>
            Đóng
          </Button>
        </Space>
      }
    >
      {error ? <Alert type="error" showIcon message={error} /> : null}

      {!error ? (
        <>
          <Descriptions
            bordered
            size="small"
            column={{ xs: 1, sm: 2 }}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Mã master">
              {detail?.masterCode || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={statusMeta.tone}>{statusMeta.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Số đơn">
              {detail?.orders?.length ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Số kiện">
              {detail ? countConsolidationParcels(detail) : 0}
            </Descriptions.Item>
            <Descriptions.Item label="Trọng lượng">
              {formatNumber(detail?.totalWeight, " kg")}
            </Descriptions.Item>
            <Descriptions.Item label="Thể tích">
              {formatNumber(detail?.totalVolume, " m³")}
            </Descriptions.Item>
          </Descriptions>

          <Typography.Title level={5}>Đơn trong lô</Typography.Title>
          <Table
            size="small"
            rowKey={(row) => row.id || row.orderId || row.consignmentCode}
            loading={isLoading}
            columns={orderColumns}
            dataSource={detail?.orders ?? []}
            pagination={false}
            style={{ marginBottom: 16 }}
            locale={{ emptyText: "Chưa có đơn." }}
          />

          <Typography.Title level={5}>Kiện hàng</Typography.Title>
          <Table
            size="small"
            rowKey="key"
            loading={isLoading}
            dataSource={parcelRows}
            pagination={{ pageSize: 6, showSizeChanger: false }}
            locale={{ emptyText: "Chưa có kiện." }}
            columns={[
              { title: "Mã lô", dataIndex: "consignmentCode" },
              { title: "Mã kiện", dataIndex: "packageCode", render: (v) => v || "—" },
              { title: "Kích thước", dataIndex: "dims" },
              {
                title: "KG",
                dataIndex: "actualWeight",
                align: "right",
                render: (v) => formatNumber(v, " kg"),
              },
              {
                title: "Trạng thái",
                dataIndex: "status",
                render: (status) => (
                  <Tag>{getConsignmentStatusLabel(canonicalizeConsignmentStatus(status))}</Tag>
                ),
              },
            ]}
          />
        </>
      ) : null}
    </Modal>
  );
}
