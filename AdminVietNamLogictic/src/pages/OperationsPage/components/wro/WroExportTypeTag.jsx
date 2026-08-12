import React from "react";
import { Tag } from "antd";
import { AppstoreOutlined, InboxOutlined } from "@ant-design/icons";

export default function WroExportTypeTag({ exportType }) {
  const type = String(exportType || "").toUpperCase();
  if (type === "BATCH") {
    return (
      <Tag color="purple" icon={<AppstoreOutlined />}>
        Lô xuất gom (BATCH)
      </Tag>
    );
  }
  return (
    <Tag color="cyan" icon={<InboxOutlined />}>
      Xuất đơn lẻ (SINGLE)
    </Tag>
  );
}
