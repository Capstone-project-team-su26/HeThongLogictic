import React from "react";
import { Button, Space, Table, Tag, Typography } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  FileTextOutlined,
  InboxOutlined,
} from "@ant-design/icons";

import {
  wroNeedsApproval,
  WRO_STATUS_META,
} from "../../../../api/OperationsAPI/consolidationWorkflowService";
import WroExportTypeTag from "./WroExportTypeTag";
import WroItemExpandTable from "./WroItemExpandTable";

export default function WroTableList({
  data = [],
  isLoading = false,
  readOnly = false,
  busyId = "",
  onView = () => {},
  onApprove = () => {},
  onReject = () => {},
  emptyText = "Không có phiếu xuất kho nào.",
}) {
  const columns = [
    {
      title: "Mã WRO / Barcode",
      key: "wroCode",
      fixed: "left",
      width: 200,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Typography.Text code style={{ fontWeight: 600 }}>
            {row.code || row.wroCode || "—"}
          </Typography.Text>
          {row.exportBarcode ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <InboxOutlined /> {row.exportBarcode}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Loại xuất",
      dataIndex: "exportType",
      key: "exportType",
      width: 170,
      render: (type) => <WroExportTypeTag exportType={type} />,
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 170,
      render: (_, row) => {
        const meta = WRO_STATUS_META[row.status] || {
          label: row.status,
          tone: "default",
        };
        return (
          <Space direction="vertical" size={2}>
            <Tag color={meta.tone}>{meta.label}</Tag>
            {row.customsStatusText ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                Thông quan: {row.customsStatusText}
              </Typography.Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "Kho xuất / Đơn hàng",
      key: "warehouseOrder",
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            {row.warehouseName || "Kho Quảng Châu"}
          </Typography.Text>
          {row.orderCode ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Đơn: <Typography.Text code>{row.orderCode}</Typography.Text>
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Người nhận & Địa chỉ",
      key: "receiver",
      render: (_, row) => (
        <div>
          <Typography.Text strong style={{ display: "block" }}>
            {row.receiverName || row.consigneeName || row.customerName || "—"}
          </Typography.Text>
          {row.receiverPhone || row.consigneePhone ? (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block" }}>
              📞 {row.receiverPhone || row.consigneePhone}
            </Typography.Text>
          ) : null}
          <Typography.Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: 260, display: "block" }}>
            📍 {row.deliveryAddress || row.receiverAddress || "—"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Tuyến & Chuyến",
      key: "routeVehicle",
      width: 180,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <span>{row.shippingRoute || row.carrierName || "—"}</span>
          {row.vehicleNumber ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ✈️ {row.vehicleNumber}
            </Typography.Text>
          ) : null}
          {row.driverName ? (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              👤 Lái xe: {row.driverName}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Số kiện",
      key: "totalQuantity",
      align: "right",
      width: 90,
      render: (_, row) => (
        <Tag color="blue" style={{ fontWeight: 600 }}>
          {row.items?.length || row.totalQuantity || 0} kiện
        </Tag>
      ),
    },
    {
      title: "Giấy tờ",
      key: "customsDocs",
      width: 110,
      render: (_, row) => {
        const urls = row.customsDocumentUrls || [];
        if (!urls.length) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => onView(row.id)}
          >
            {urls.length} file
          </Button>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: readOnly ? 100 : 220,
      render: (_, row) => (
        <Space size={4}>
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onView(row.id)}
          >
            Xem
          </Button>
          {!readOnly && wroNeedsApproval(row.status) ? (
            <>
              <Button
                size="small"
                type="link"
                icon={<CheckOutlined />}
                onClick={() => onApprove(row)}
              >
                Duyệt
              </Button>
              <Button
                size="small"
                type="link"
                danger
                icon={<CloseOutlined />}
                loading={busyId === row.id}
                onClick={() => onReject(row.id)}
              >
                Từ chối
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={isLoading}
      sticky={{ offsetHeader: 0 }}
      scroll={{ x: 1350, y: "calc(100vh - 430px)" }}
      expandable={{
        expandedRowRender: (record) => (
          <WroItemExpandTable items={record.items || []} />
        ),
        rowExpandable: (record) => Boolean(record.items && record.items.length > 0),
      }}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        pageSizeOptions: ["10", "15", "25", "50"],
        showTotal: (total) => `Tổng ${total} phiếu xuất kho`,
      }}
      locale={{ emptyText }}
    />
  );
}
