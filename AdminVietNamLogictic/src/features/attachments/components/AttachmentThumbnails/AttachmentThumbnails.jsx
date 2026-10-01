import { useEffect, useState } from "react";
import { Image, Space, Typography } from "antd";
import { FileOutlined } from "@ant-design/icons";

import { fetchAttachmentBlob, isImageAttachment } from "@features/attachments/api/attachmentService";

const { Text } = Typography;

/**
 * Ảnh thu nhỏ tải bằng Blob có Authorization — thẻ <img src="/api/..."> trần sẽ bị 401.
 * Object URL được thu hồi khi component rời màn để không rò bộ nhớ. Bấm ảnh để phóng to
 * (antd Image preview; đặt trong `Image.PreviewGroup` thì lướt qua lại được giữa các ảnh).
 *
 * @param {{ attachment: object, size?: number }} props
 */
export function AuthorizedThumbnail({ attachment, size = 72 }) {
  const [src, setSrc] = useState("");
  const attachmentId = attachment?.id || "";
  const downloadUrl = attachment?.downloadUrl || "";

  useEffect(() => {
    if (!attachmentId) return undefined;
    let objectUrl = "";
    let cancelled = false;

    fetchAttachmentBlob({ id: attachmentId, downloadUrl, fileName: attachment?.fileName })
      .then(({ blob }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        /* Ảnh lỗi thì chỉ mất phần xem trước; nơi gọi vẫn còn nút Xem báo lỗi rõ ràng. */
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Chỉ tải lại khi đổi giấy tờ — object mới cùng id không cần tải lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentId, downloadUrl]);

  if (!src) {
    return (
      <div
        className="attachment-thumb attachment-thumb--empty"
        style={{
          width: size,
          height: size,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: "#f1f5f9",
          color: "#94a3b8",
        }}
      >
        <FileOutlined />
      </div>
    );
  }

  return (
    <Image
      src={src}
      width={size}
      height={size}
      style={{ objectFit: "cover", borderRadius: 8 }}
      alt={attachment?.fileName || "Ảnh đính kèm"}
    />
  );
}

/**
 * Lưới ảnh thu nhỏ cho ô bảng / drawer — chỉ lấy giấy tờ là ẢNH, bấm để phóng to trong trang.
 * Không có ảnh thì hiện `emptyText` (bỏ trống = không hiện gì).
 *
 * @param {{ items?: object[], size?: number, emptyText?: string }} props
 */
export default function AttachmentThumbnails({ items = [], size = 72, emptyText = "" }) {
  const photos = (Array.isArray(items) ? items : []).filter((item) => item?.id && isImageAttachment(item));

  if (photos.length === 0) {
    return emptyText ? <Text type="secondary">{emptyText}</Text> : null;
  }

  return (
    <Image.PreviewGroup>
      <Space size={6} wrap>
        {photos.map((photo) => (
          <AuthorizedThumbnail key={photo.id} attachment={photo} size={size} />
        ))}
      </Space>
    </Image.PreviewGroup>
  );
}
