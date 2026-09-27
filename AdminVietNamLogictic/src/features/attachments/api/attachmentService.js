/*
 * Giấy tờ đính kèm — ĐÃ NỐI API THẬT (api-xuat-kho.md mục J, api-hang-ve-viet-nam.md mục D3/E).
 *
 *   POST /api/attachments                     multipart: file, entityType, entityId, documentType, note
 *        → { message, data: AttachmentDto }
 *   GET  /api/attachments?entityType=&entityId= → { message, data: AttachmentDto[] }
 *   GET  /api/attachments/{id}/download       → file nhị phân (luôn kiểm quyền)
 *
 * Một module dùng chung cho mọi màn cần giấy tờ: lô vận chuyển (tờ khai nhập, biên bản sự cố),
 * sự cố hàng hoá (ảnh hiện trạng, chứng từ chi bồi thường), yêu cầu giao (ảnh ký nhận).
 * Giấy tờ KHÔNG có API xoá — sai thì tải bổ sung bản đúng.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";
import { openFileInNewTab, saveFile, fetchFileBlob } from "@shared/api/fileDownload";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getAttachmentApiError };

/* Đối tượng được gắn giấy tờ — đúng danh sách AttachmentEntityTypes của backend. */
export const ATTACHMENT_ENTITY = Object.freeze({
  ORDER: "ORDER",
  WRO: "WRO",
  WRO_PARCEL: "WRO_PARCEL",
  SHIPMENT: "SHIPMENT",
  INCIDENT: "INCIDENT",
  DELIVERY_REQUEST: "DELIVERY_REQUEST",
  PURCHASE_ORDER: "PURCHASE_ORDER",
  /* Một KIỆN — dùng cho ảnh chụp kiện nằm trong ô kệ lúc xếp kệ. */
  PARCEL: "PARCEL",
});

/* Nhãn tiếng Việt cho các loại giấy tờ web quản trị gặp. */
export const DOCUMENT_TYPE_LABELS = Object.freeze({
  PERMIT: "Giấy phép hàng hạn chế",
  PICKING_ISSUE: "Biên bản sự cố bốc hàng",
  PARCEL_PHOTO: "Ảnh kiện",
  HANDOVER_RECORD: "Biên bản bàn giao",
  WAYBILL: "Vận đơn",
  CUSTOMS_EXPORT: "Tờ khai xuất",
  COMMERCIAL_INVOICE: "Hoá đơn thương mại",
  CUSTOMS_IMPORT: "Tờ khai nhập",
  TAX_RECEIPT: "Biên lai thuế",
  INCIDENT: "Biên bản sự cố lô",
  INCIDENT_PHOTO: "Ảnh hiện trạng sự cố",
  COMPENSATION_RECEIPT: "Chứng từ chi bồi thường",
  DELIVERY_PROOF: "Ảnh ký nhận giao hàng",
  PURCHASE_PROOF: "Chứng từ mua hộ",
  PUT_AWAY_PROOF: "Ảnh kiện trong ô kệ",
  WRO_APPROVAL_PROOF: "Ảnh hiện trạng lúc duyệt xuất",
  OTHER: "Giấy tờ khác",
});

export const getDocumentTypeLabel = (documentType) =>
  DOCUMENT_TYPE_LABELS[String(documentType || "").toUpperCase()] || documentType || "—";

/*
 * Server chỉ nhận PDF/JPG/PNG/WEBP ≤ 10 MB và xét theo Content-Type chứ không theo đuôi file.
 * Chặn trước ở đây để người dùng đọc câu tiếng Việt ngay, khỏi đợi một vòng upload hỏng.
 */
export const ACCEPTED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.webp";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const validateAttachmentFile = (file) => {
  if (!file) return "Chưa chọn file để tải lên.";
  if (!ACCEPTED_MIME_TYPES.includes(String(file.type || "").toLowerCase())) {
    return "Chỉ nhận file PDF, JPG, PNG hoặc WEBP.";
  }
  if (Number(file.size) > MAX_ATTACHMENT_BYTES) return "File vượt quá 10 MB.";
  return "";
};

const trimText = (value) => String(value ?? "").trim();

/**
 * Tải một file lên và gắn vào đối tượng.
 *
 * @param {{ file: File, entityType: string, entityId: string, documentType: string, note?: string }} payload
 */
export const uploadAttachment = async ({ file, entityType, entityId, documentType, note } = {}) => {
  const invalid = validateAttachmentFile(file);
  if (invalid) throw new Error(invalid);
  if (!trimText(entityType) || !trimText(entityId)) {
    throw new Error("Thiếu đối tượng cần gắn giấy tờ.");
  }
  if (!trimText(documentType)) throw new Error("Thiếu loại giấy tờ.");

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("entityType", trimText(entityType));
  form.append("entityId", trimText(entityId));
  form.append("documentType", trimText(documentType));
  if (trimText(note)) form.append("note", trimText(note));

  /* Upload tối đa 10 MB nên nới timeout — 30 giây mặc định dễ đứt với mạng yếu. */
  const response = await httpClient.post(API_ENDPOINTS.attachments.list, form, {
    timeout: 120_000,
  });

  return getResponseData(response);
};

/** Danh sách giấy tờ của một đối tượng — MẢNG TRẦN, sắp theo thời gian tải lên. */
export const listAttachments = async ({ entityType, entityId } = {}) => {
  if (!trimText(entityType) || !trimText(entityId)) return [];

  const response = await httpClient.get(API_ENDPOINTS.attachments.list, {
    params: { entityType: trimText(entityType), entityId: trimText(entityId) },
  });

  return getArrayItems(getResponseData(response));
};

/*
 * `downloadUrl` server trả là đường dẫn TƯƠNG ĐỐI; httpClient tự ghép base URL. Không có thì
 * dựng lại từ id cho chắc — cả hai đều đi kèm Authorization.
 */
const downloadPathOf = (attachment) => {
  const relative = trimText(attachment?.downloadUrl);
  if (relative.startsWith("/api/")) return relative;
  return API_ENDPOINTS.attachments.download(attachment?.id);
};

/** Mở giấy tờ trong tab mới (xem nhanh PDF / ảnh). */
export const openAttachment = (attachment) =>
  openFileInNewTab(downloadPathOf(attachment), { fileName: attachment?.fileName || "giay-to" });

/** Tải giấy tờ về máy. */
export const downloadAttachment = (attachment) =>
  saveFile(downloadPathOf(attachment), { fileName: attachment?.fileName || "giay-to" });

/** Lấy Blob của giấy tờ — dùng để xem trước ảnh ngay trong trang. */
export const fetchAttachmentBlob = (attachment) =>
  fetchFileBlob(downloadPathOf(attachment), { fileName: attachment?.fileName || "giay-to" });

export const isImageAttachment = (attachment) =>
  String(attachment?.contentType || "").toLowerCase().startsWith("image/");

export default {
  uploadAttachment,
  listAttachments,
  openAttachment,
  downloadAttachment,
  fetchAttachmentBlob,
  validateAttachmentFile,
  getDocumentTypeLabel,
};
