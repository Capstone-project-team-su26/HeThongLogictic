import { useState } from "react";
import { Button, Empty, List, Space, Tag, Typography } from "antd";
import { DownloadOutlined, EyeOutlined } from "@ant-design/icons";

import { AuthorizedThumbnail } from "@features/attachments/components/AttachmentThumbnails/AttachmentThumbnails";
import {
  downloadAttachment,
  getAttachmentApiError,
  getDocumentTypeLabel,
  isImageAttachment,
  openAttachment,
} from "@features/attachments/api/attachmentService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";

const { Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatSize = (bytes) => {
  const number = Number(bytes);
  if (!Number.isFinite(number) || number <= 0) return "";
  if (number < 1024 * 1024) return `${Math.round(number / 1024)} KB`;
  return `${(number / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Danh sách giấy tờ đính kèm dùng chung: nhãn loại giấy tờ, người tải, nút xem / tải về.
 * Mọi thao tác mở file đều đi qua Blob có Authorization, không mở link trần.
 *
 * @param {{ items: Array, showThumbnails?: boolean, emptyText?: string }} props
 */
export default function AttachmentList({
  items = [],
  showThumbnails = false,
  emptyText = "Chưa có giấy tờ nào.",
}) {
  const [busyId, setBusyId] = useState("");

  const run = async (attachment, action) => {
    setBusyId(`${attachment.id}:${action}`);
    try {
      if (action === "open") await openAttachment(attachment);
      else await downloadAttachment(attachment);
    } catch (error) {
      AuthNotify.error("Không mở được giấy tờ", getAttachmentApiError(error, "Vui lòng thử lại."));
    } finally {
      setBusyId("");
    }
  };

  if (!Array.isArray(items) || items.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <List
      size="small"
      dataSource={items}
      rowKey={(item) => item.id}
      renderItem={(item) => (
        <List.Item
          actions={[
            <Button
              key="open"
              size="small"
              icon={<EyeOutlined />}
              loading={busyId === `${item.id}:open`}
              onClick={() => run(item, "open")}
            >
              Xem
            </Button>,
            <Button
              key="save"
              size="small"
              icon={<DownloadOutlined />}
              loading={busyId === `${item.id}:save`}
              onClick={() => run(item, "save")}
            />,
          ]}
        >
          <Space align="start">
            {showThumbnails && isImageAttachment(item) ? (
              <AuthorizedThumbnail attachment={item} />
            ) : null}
            <Space direction="vertical" size={0}>
              <Space size={6} wrap>
                <Tag color="blue">{getDocumentTypeLabel(item.documentType)}</Tag>
                <Text strong>{item.fileName || "—"}</Text>
                <Text type="secondary">{formatSize(item.size)}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.uploadedByName || "—"} · {formatDateTime(item.uploadedAt)}
                {item.note ? ` · ${item.note}` : ""}
              </Text>
            </Space>
          </Space>
        </List.Item>
      )}
    />
  );
}
