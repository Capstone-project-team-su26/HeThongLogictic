/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "attachments" — giấy tờ đính kèm (POST/GET /api/attachments).
 *
 * Dùng chung cho lô vận chuyển, sự cố hàng hoá và yêu cầu giao. Feature khác import qua
 * barrel này, không đi đường sâu. Chỉ một module api/ nên `export *` an toàn (không thể
 * va tên với một `export *` nào khác trong cùng barrel).
 */

export { default as AttachmentList } from "./components/AttachmentList/AttachmentList";
export { default as AttachmentUploadButton } from "./components/AttachmentUploadButton/AttachmentUploadButton";

export * from "./api/attachmentService";
export { default as attachmentService } from "./api/attachmentService";
