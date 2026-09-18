import { useEffect, useState } from "react";
import { Button, Empty, Image, List, Space, Tag, Typography } from "antd";
import { DownloadOutlined, EyeOutlined, FileOutlined } from "@ant-design/icons";

import {
  downloadAttachment,
  fetchAttachmentBlob,
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
 * Ảnh thu nhỏ tải bằng Blob có Authorization — thẻ <img src="/api/..."> trần sẽ bị 401.
 * Object URL được thu hồi khi component rời màn để không rò bộ nhớ.
 */
function AuthorizedThumbnail({ attachment }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    fetchAttachmentBlob(attachment)
      .then(({ blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        /* Ảnh lỗi thì chỉ mất phần xem trước; nút Xem vẫn báo lỗi rõ ràng. */
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);

  if (!src) {
    return (
      <div className="attachment-thumb attachment-thumb--empty">
        <FileOutlined />
      </div>
    );
  }

  return (
    <Image
      src={src}
      width={72}
      height={72}
      style={{ objectFit: "cover", borderRadius: 8 }}
      alt={attachment?.fileName || "Ảnh đính kèm"}
    />
  );
}

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
