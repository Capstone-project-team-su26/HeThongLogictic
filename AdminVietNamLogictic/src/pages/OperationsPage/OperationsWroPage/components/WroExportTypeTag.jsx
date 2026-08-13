import React from "react";
import { Tag } from "antd";

export default function WroExportTypeTag({ exportType }) {
  const type = String(exportType || "").toUpperCase();
  if (type === "BATCH") {
    return (
      <Tag color="purple" style={{ fontWeight: 600 }}>
        Xuất theo lô
      </Tag>
    );
  }
  return (
    <Tag color="cyan" style={{ fontWeight: 600 }}>
      Xuất hỏa tốc
    </Tag>
  );
}
