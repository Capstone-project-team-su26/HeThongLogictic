import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Descriptions,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { FilePdfOutlined, LinkOutlined } from "@ant-design/icons";

import {
  getOperationsApiError,
  getWroDetail,
  getWroStatusMeta,
} from "../../../api/OperationsAPI/consolidationWorkflowService";

function DocLinks({ urls = [] }) {
  if (!urls.length) {
    return <Typography.Text type="secondary">Chưa có giấy tờ.</Typography.Text>;
  }

  return (
    <Space direction="vertical" size={6} style={{ width: "100%" }}>
      {urls.map((url, index) => {
        const isPdf = /\.pdf($|\?)/i.test(url);
        return (
          <a
            key={`${url}-${index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {isPdf ? <FilePdfOutlined /> : <LinkOutlined />}
            Giấy tờ {index + 1}
            {isPdf ? " (PDF)" : ""}
          </a>
        );
      })}
    </Space>
  );
}

export default function WroViewModal({ open, wroId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!wroId) return;
    setLoading(true);
    setError("");
    try {
      setDetail(await getWroDetail(wroId));
    } catch (err) {
      setError(getOperationsApiError(err, "Không thể tải chi tiết phiếu xuất kho."));
    } finally {
      setLoading(false);
    }
  }, [wroId]);

  useEffect(() => {
    if (!open) return undefined;
    setDetail(null);
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [open, load]);

  const statusMeta = getWroStatusMeta(detail?.status);
  const docs = detail?.customsDocumentUrls || [];

  return (
    <Modal
      open={open}
      title={
        <>
          Phiếu xuất kho{" "}
          <Typography.Text code>{detail?.code || wroId || "—"}</Typography.Text>
        </>
      }
      onCancel={onClose}
      width={820}
      destroyOnHidden
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      {error ? (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
        <Descriptions.Item label="Mã WRO">{detail?.code || "—"}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          <Tag color={statusMeta.tone}>{statusMeta.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Mã vạch xuất kho">
          {detail?.exportBarcode ? (
            <Typography.Text code copyable>
              {detail.exportBarcode}
            </Typography.Text>
          ) : (
            "—"
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Chuyến bay / xe">
          {detail?.vehicleNumber || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Khách hàng">{detail?.customerName || "—"}</Descriptions.Item>
        <Descriptions.Item label="Người nhận">
          {detail?.receiverName || "—"}
          {detail?.receiverPhone ? ` · ${detail.receiverPhone}` : ""}
        </Descriptions.Item>
        <Descriptions.Item label="Địa chỉ giao" span={2}>
          {detail?.deliveryAddress || detail?.receiverAddress || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Kho">{detail?.warehouseName || "—"}</Descriptions.Item>
        <Descriptions.Item label="Tuyến">{detail?.shippingRoute || "—"}</Descriptions.Item>
        <Descriptions.Item label="Lý do xuất">{detail?.exportReason || "—"}</Descriptions.Item>
        <Descriptions.Item label="Tracking">{detail?.trackingNumber || "—"}</Descriptions.Item>
        <Descriptions.Item label="Ngày tạo">
          {detail?.createdAt ? new Date(detail.createdAt).toLocaleString("vi-VN") : "—"}
        </Descriptions.Item>
        {detail?.rejectionReason ? (
          <Descriptions.Item label="Lý do từ chối" span={2}>
            {detail.rejectionReason}
          </Descriptions.Item>
        ) : null}
        <Descriptions.Item label="Giấy tờ thông quan" span={2}>
          <DocLinks urls={docs} />
        </Descriptions.Item>
      </Descriptions>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Kiện trong phiếu ({detail?.items?.length || detail?.itemCount || 0})
      </Typography.Title>
      <Table
        rowKey={(row) => row.inventoryId || row.parcelId || row.packageCode || row.itemId}
        size="small"
        loading={loading}
        dataSource={detail?.items ?? []}
        pagination={false}
        columns={[
          {
            title: "Mã kiện",
            render: (_, row) => (
              <Typography.Text code>
                {row.packageCode || row.parcelCode || row.parcelId || row.inventoryId || "—"}
              </Typography.Text>
            ),
          },
          { title: "Sản phẩm", dataIndex: "productName", render: (v) => v || "—" },
          { title: "SL", dataIndex: "quantity", align: "right", width: 80 },
          { title: "Kệ", dataIndex: "shelfCode", width: 90, render: (v) => v || "—" },
        ]}
        locale={{ emptyText: "Không có kiện." }}
      />
    </Modal>
  );
}
