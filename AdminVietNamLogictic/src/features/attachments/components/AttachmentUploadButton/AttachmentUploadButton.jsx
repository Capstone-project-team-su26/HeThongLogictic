import { useRef, useState } from "react";
import { Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";

import {
  ACCEPT_ATTRIBUTE,
  getAttachmentApiError,
  getDocumentTypeLabel,
  uploadAttachment,
  validateAttachmentFile,
} from "@features/attachments/api/attachmentService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";

/**
 * Nút chọn file rồi tải ngay lên POST /api/attachments.
 *
 * Dùng <input type="file"> ẩn thay vì antd Upload: Upload tự gửi request bằng XHR riêng (không
 * qua httpClient) nên sẽ thiếu Authorization và không theo quy tắc 401 chung.
 *
 * @param {{ entityType: string, entityId: string, documentType: string, note?: string,
 *   label?: string, onUploaded?: (attachment) => void, buttonProps?: object }} props
 */
export default function AttachmentUploadButton({
  entityType,
  entityId,
  documentType,
  note = "",
  label,
  onUploaded,
  buttonProps = {},
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    /* Xoá giá trị để chọn lại cùng một file vẫn kích hoạt onChange. */
    event.target.value = "";
    if (!file) return;

    const invalid = validateAttachmentFile(file);
    if (invalid) {
      AuthNotify.error("File không hợp lệ", invalid);
      return;
    }

    setUploading(true);
    try {
      const attachment = await uploadAttachment({ file, entityType, entityId, documentType, note });
      AuthNotify.success(
        "Đã tải giấy tờ lên",
        `${getDocumentTypeLabel(documentType)}: ${attachment?.fileName || file.name}`,
      );
      onUploaded?.(attachment);
    } catch (error) {
      AuthNotify.error("Tải giấy tờ thất bại", getAttachmentApiError(error, "Vui lòng thử lại."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        style={{ display: "none" }}
        onChange={handleChange}
      />
      <Button
        icon={<UploadOutlined />}
        loading={uploading}
        disabled={!entityId}
        onClick={() => inputRef.current?.click()}
        {...buttonProps}
      >
        {label || `Tải ${getDocumentTypeLabel(documentType).toLowerCase()}`}
      </Button>
    </>
  );
}
