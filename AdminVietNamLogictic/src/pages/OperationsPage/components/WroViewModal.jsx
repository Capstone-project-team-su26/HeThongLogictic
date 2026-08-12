import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";

import {
  getOperationsApiError,
  getWroDetail,
  getWroStatusMeta,
} from "../../../api/OperationsAPI/consolidationWorkflowService";
import WroExportTypeTag from "../OperationsWroPage/components/WroExportTypeTag";

function DocLinks({ urls = [] }) {
  if (!urls.length) {
    return <Typography.Text type="secondary">Chưa có giấy tờ đính kèm.</Typography.Text>;
  }

  return (
    <Space wrap size={8}>
      {urls.map((url, index) => {
        const isPdf = /\.pdf($|\?)/i.test(url);
        return (
          <Button
            key={`${url}-${index}`}
            type="default"
            size="small"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ borderRadius: 6, fontWeight: 600 }}
          >
            Giấy tờ {index + 1} {isPdf ? "(PDF)" : ""}
          </Button>
        );
      })}
    </Space>
  );
}

export default function WroViewModal({ open, wroId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDetail = useCallback(async () => {
    if (!wroId) return;
    setLoading(true);
    setError("");
    try {
      const data = await getWroDetail(wroId);
      setDetail(data);
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tải chi tiết phiếu xuất kho WRO từ hệ thống."));
    } finally {
      setLoading(false);
    }
  }, [wroId]);

  useEffect(() => {
    if (!open) return undefined;
    setDetail(null);
    const timer = window.setTimeout(() => loadDetail(), 0);
    return () => window.clearTimeout(timer);
  }, [open, loadDetail]);

  const statusMeta = getWroStatusMeta(detail?.status);

  // Calculate totals
  const totalWeight = (detail?.items || []).reduce(
    (sum, item) => sum + (Number(item.actualWeight) || 0),
    0
  );

  const itemColumns = [
    {
      title: "Mã kiện hàng",
      dataIndex: "packageCode",
      key: "packageCode",
      render: (val) => (val ? <Typography.Text code style={{ fontWeight: 700, color: "#1e40af" }}>{val}</Typography.Text> : "—"),
    },
    {
      title: "Mã đơn hàng",
      dataIndex: "orderCode",
      key: "orderCode",
      render: (val) => (val ? <Typography.Text code>{val}</Typography.Text> : "—"),
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "productName",
      key: "productName",
      ellipsis: true,
      render: (val) => val || "—",
    },
    {
      title: "Loại đơn",
      dataIndex: "consignmentType",
      key: "consignmentType",
      width: 100,
      render: (type) =>
        type ? (
          <Tag color={type === "Express" ? "red" : "blue"} style={{ fontWeight: 600 }}>{type}</Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      width: 85,
      render: (qty) => <strong style={{ color: "#2563eb" }}>{Number(qty || 1).toLocaleString("vi-VN")}</strong>,
    },
    {
      title: "Vị trí lưu kho",
      key: "location",
      width: 170,
      render: (_, row) => {
        const parts = [row.zoneName, row.shelfCode, row.binCode].filter(Boolean);
        return parts.length ? parts.join(" / ") : "—";
      },
    },
    {
      title: "Trọng lượng",
      dataIndex: "actualWeight",
      key: "actualWeight",
      align: "right",
      width: 100,
      render: (val) => (val != null ? `${val} kg` : "—"),
    },
    {
      title: "Kích thước (DxRxC)",
      key: "dimensions",
      width: 140,
      render: (_, row) =>
        row.length && row.width && row.height
          ? `${row.length}x${row.width}x${row.height} cm`
          : "—",
    },
  ];

  return (
    <Modal
      open={open}
      centered
      title={
        <div style={{ paddingBottom: 4 }}>
          <Space align="center" size={10} wrap>
            <Typography.Text style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              Phiếu xuất kho WRO:
            </Typography.Text>
            <Typography.Text code style={{ fontSize: 17, fontWeight: 700, color: "#1d4ed8", padding: "2px 8px" }}>
              {detail?.code || detail?.wroCode || wroId || "—"}
            </Typography.Text>
            {detail?.exportType ? <WroExportTypeTag exportType={detail.exportType} /> : null}
            {detail?.status ? (
              <Tag color={statusMeta.tone} style={{ fontWeight: 700, padding: "2px 10px" }}>
                {statusMeta.label}
              </Tag>
            ) : null}
          </Space>
        </div>
      }
      onCancel={onClose}
      width={960}
      destroyOnHidden
      footer={[
        <Button key="close" type="primary" onClick={onClose} style={{ borderRadius: 8, paddingInline: 24 }}>
          Đóng
        </Button>,
      ]}
    >
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      ) : null}

      {loading ? (
        <div style={{ padding: "50px 0", textAlign: "center" }}>
          <Spin size="large" tip="Đang tải thông tin chi tiết phiếu xuất kho..." />
        </div>
      ) : detail ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
          {/* Thông tin Tổng quan & Mã vạch */}
          <Card
            size="small"
            style={{ borderRadius: 14, border: "1px solid #e2e8f0", background: "#f8fafc" }}
          >
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ background: "#fff" }}>
              <Descriptions.Item label="Mã phiếu WRO">
                <Typography.Text code copyable={{ text: detail.code }} style={{ fontWeight: 700 }}>
                  {detail.code || "—"}
                </Typography.Text>
              </Descriptions.Item>

              <Descriptions.Item label="Mã vạch xuất (EXP)">
                {detail.exportBarcode ? (
                  <Typography.Text code copyable={{ text: detail.exportBarcode }} style={{ fontWeight: 700 }}>
                    {detail.exportBarcode}
                  </Typography.Text>
                ) : (
                  "—"
                )}
              </Descriptions.Item>

              <Descriptions.Item label="Thông quan">
                <Tag color={detail.isCustomsCleared ? "success" : "processing"} style={{ fontWeight: 600 }}>
                  {detail.customsStatusText || "Chờ thông quan"}
                </Tag>
              </Descriptions.Item>

              <Descriptions.Item label="Kho xuất hàng">
                <strong>{detail.warehouseName || "Kho Quảng Châu (TQ)"}</strong>
              </Descriptions.Item>

              <Descriptions.Item label="Người tạo phiếu">
                {detail.createdByName || "—"}
                {detail.createdByUserRole ? ` (${detail.createdByUserRole})` : ""}
              </Descriptions.Item>

              <Descriptions.Item label="Thời gian tạo">
                {detail.createdAt
                  ? new Date(detail.createdAt).toLocaleString("vi-VN")
                  : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Giao nhận & Địa chỉ */}
          <Card
            size="small"
            title={<span style={{ fontWeight: 700, color: "#1e293b" }}>Thông tin Khách hàng & Người nhận hàng</span>}
            style={{ borderRadius: 14, border: "1px solid #e2e8f0" }}
          >
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tên khách hàng">
                <strong style={{ color: "#0f172a" }}>{detail.customerName || "—"}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Mã đơn hàng">
                {detail.orderCode ? (
                  <Typography.Text code style={{ fontWeight: 600 }}>{detail.orderCode}</Typography.Text>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Tên người nhận">
                <strong style={{ color: "#0f172a" }}>{detail.receiverName || detail.consigneeName || "—"}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                <strong style={{ color: "#2563eb" }}>{detail.receiverPhone || detail.consigneePhone || "—"}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ nhận hàng" span={2}>
                <div style={{ padding: "6px 10px", background: "#f1f5f9", borderRadius: 6, fontWeight: 600, color: "#334155" }}>
                  {detail.deliveryAddress || detail.receiverAddress || detail.consigneeAddress || "—"}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Vận chuyển & Chứng từ */}
          <Card
            size="small"
            title={<span style={{ fontWeight: 700, color: "#1e293b" }}>Thông tin Hãng bay / Xe & Vận chuyển</span>}
            style={{ borderRadius: 14, border: "1px solid #e2e8f0" }}
          >
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="Tuyến đường">
                {detail.shippingRoute || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Hãng vận chuyển">
                {detail.carrierName || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Số hiệu / Chuyến bay">
                {detail.vehicleNumber ? (
                  <Typography.Text code style={{ fontWeight: 700 }}>{detail.vehicleNumber}</Typography.Text>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Lái xe / Liên hệ">
                {detail.driverName ? `${detail.driverName} (${detail.driverPhone || "N/A"})` : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Mã Tracking">
                {detail.trackingNumber || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do xuất kho">
                {detail.exportReason || "Xuất kho theo quy trình vận hành"}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 12 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
                CHỨNG TỪ THÔNG QUAN ĐÍNH KÈM:
              </Typography.Text>
              <DocLinks urls={detail.customsDocumentUrls} />
            </div>
          </Card>

          {/* Danh sách Kiện hàng */}
          <div>
            <Divider orientation="left" style={{ margin: "14px 0 10px" }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>
                Danh sách kiện sản phẩm thuộc WRO ({detail.items?.length || detail.totalQuantity || 0} kiện)
              </span>
            </Divider>

            <Table
              rowKey={(row) => row.itemId || row.inventoryId || row.packageCode || Math.random()}
              columns={itemColumns}
              dataSource={detail.items || []}
              pagination={false}
              size="small"
              bordered
              summary={(pageData) => {
                const totalQty = pageData.reduce((sum, r) => sum + (Number(r.quantity) || 1), 0);
                return (
                  <Table.Summary.Row style={{ background: "#fafafa", fontWeight: 700 }}>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      Tổng cộng
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <span style={{ color: "#2563eb" }}>{totalQty}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} colSpan={1} />
                    <Table.Summary.Cell index={3} align="right">
                      {totalWeight ? `${totalWeight.toFixed(1)} kg` : "—"}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} />
                  </Table.Summary.Row>
                );
              }}
              locale={{ emptyText: "Không có kiện sản phẩm trong phiếu này." }}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
