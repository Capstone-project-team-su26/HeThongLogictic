import React from "react";
import { Button, Table, Tag, Typography } from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
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
      width: 180,
      render: (_, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography.Text code style={{ fontWeight: 700, fontSize: 13, color: "#1e40af" }}>
            {row.code || row.wroCode || "—"}
          </Typography.Text>
          {row.exportBarcode ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.exportBarcode}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "Loại xuất",
      dataIndex: "exportType",
      key: "exportType",
      width: 140,
      render: (type) => <WroExportTypeTag exportType={type} />,
    },
    {
      title: "Đơn hàng & Khách hàng",
      key: "orderCustomer",
      width: 200,
      render: (_, row) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {row.orderCode ? (
            <Typography.Text code style={{ fontWeight: 600 }}>
              {row.orderCode}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            KH: {row.customerName || "—"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Người nhận & SĐT",
      key: "receiver",
      width: 240,
      render: (_, row) => (
        <div>
          <Typography.Text strong style={{ display: "block", color: "#0f172a" }}>
            {row.receiverName || row.consigneeName || "—"}
          </Typography.Text>
          {row.receiverPhone || row.consigneePhone ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.receiverPhone || row.consigneePhone}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 150,
      render: (_, row) => {
        const meta = WRO_STATUS_META[row.status] || {
          label: row.status,
          tone: "default",
        };
        return <Tag color={meta.tone} style={{ fontWeight: 600 }}>{meta.label}</Tag>;
      },
    },
    {
      title: "Số kiện",
      key: "totalQuantity",
      align: "right",
      width: 90,
      render: (_, row) => (
        <Tag color="blue" style={{ fontWeight: 700, borderRadius: 10 }}>
          {row.items?.length || row.totalQuantity || 0} kiện
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: readOnly ? 110 : 255,
      render: (_, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => onView(row.id)}
            style={{ padding: 0, fontSize: 12, fontWeight: 600 }}
          >
            Xem chi tiết
          </Button>
          {!readOnly && wroNeedsApproval(row.status) ? (
            <>
              <Button
                size="small"
                type="link"
                icon={<CheckOutlined />}
                onClick={() => onApprove(row)}
                style={{ color: "#16a34a", padding: 0, fontSize: 12, fontWeight: 600 }}
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
                style={{ padding: 0, fontSize: 12, fontWeight: 600 }}
              >
                Từ chối
              </Button>
            </>
          ) : null}
        </div>
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
      scroll={{ x: 1350 }}
      expandable={{
        expandedRowRender: (record) => (
          <WroItemExpandTable items={record.items || []} />
        ),
        rowExpandable: (record) => Boolean(record.items && record.items.length > 0),
      }}
      pagination={{
        pageSize: 15,
        showSizeChanger: true,
        pageSizeOptions: ["10", "15", "25", "50"],
        showTotal: (total) => `Tổng ${total} phiếu xuất kho`,
      }}
      locale={{ emptyText }}
    />
  );
}
