import React from "react";
import { Table, Tag, Typography } from "antd";

export default function WroItemExpandTable({ items = [] }) {
  const columns = [
    {
      title: "Mã kiện hàng",
      dataIndex: "packageCode",
      key: "packageCode",
      render: (val) => (val ? <Typography.Text code>{val}</Typography.Text> : "—"),
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
      width: 110,
      render: (type) =>
        type ? (
          <Tag color={type === "Express" ? "red" : "blue"}>{type}</Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      width: 90,
      render: (qty) => Number(qty || 1).toLocaleString("vi-VN"),
    },
    {
      title: "Vị trí kho",
      key: "location",
      width: 180,
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
      width: 110,
      render: (val) => (val != null ? `${val} kg` : "—"),
    },
    {
      title: "Kích thước (DxRxC)",
      key: "dimensions",
      width: 150,
      render: (_, row) =>
        row.length && row.width && row.height
          ? `${row.length}x${row.width}x${row.height} cm`
          : "—",
    },
  ];

  return (
    <div style={{ padding: "8px 16px", backgroundColor: "#fafafa", borderRadius: 6 }}>
      <Typography.Text type="secondary" style={{ fontSize: 13, marginBottom: 8, display: "block" }}>
        📦 Danh sách kiện/sản phẩm thuộc phiếu ({items.length} mục)
      </Typography.Text>
      <Table
        rowKey={(record, index) => record.itemId || record.inventoryId || index}
        columns={columns}
        dataSource={items}
        pagination={false}
        size="small"
        bordered
      />
    </div>
  );
}
