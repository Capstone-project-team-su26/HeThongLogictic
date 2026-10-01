/*
 * Phiếu nhập kho (tiếp nhận) tại kho GỐC — ĐÃ NỐI API THẬT (đợt 3).
 *
 * Vòng đời (api-ky-gui-1.md bước 6–8):
 *
 *   Sale lập → PENDING_APPROVAL ──(quản lý kho duyệt, approvalStage RECEIVE)──→ ACTIVE (có PDF WRN-)
 *                               ↘ REJECTED
 *   ACTIVE → kho kiểm đếm → khớp: APPROVED (tự chốt)
 *                         → lệch SỐ LƯỢNG / hàng ngoài khai báo: RECEIVED / PARTIALLY_RECEIVED + requiresReview
 *                                 ──(approvalStage DISCREPANCY, chặn xếp kệ)──→ APPROVED / REJECTED
 *                         → đủ số lượng nhưng lệch CÂN: APPROVED (tự chốt, xếp kệ được)
 *                                 ──(approvalStage DISCREPANCY_ACK)──→ chấp nhận số thực tế (chỉ APPROVED;
 *                                   BE trả 400 nếu từ chối, 409 nếu đã có người quyết)
 *
 *   GET  /api/warehouse-receiving-notes?status=&warehouseId=&search=&pageNumber=&pageSize=
 *        → { message, data: { items, totalCount, pageNumber, pageSize, totalPages } }
 *   GET  /api/warehouse-receiving-notes/{id}                   → { message, data: Detail }
 *   GET  /api/warehouse-receiving-notes/by-consignment/{orderId} → Detail TRẦN (404 khi chưa có)
 *   PUT  /api/warehouse-receiving-notes/{id}/status
 *        duyệt  { status: "APPROVED", reason? }   (Admin duyệt thay quản lý kho: bắt buộc reason)
 *        từ chối { status: "REJECTED", rejectionReason }
 *
 *   Phiếu MUA HỘ (`isPurchase`, `orderType = "PURCHASE"`): tự mở ACTIVE khi Sale bấm "Đã đặt NCC",
 *   NCC giao hàng tới kho. Kèm `purchaseCode`, `purchaseOrderCode` (PO-), `supplierName`,
 *   `supplierOrderCode` (mã đơn bên NCC), `domesticCarrier` / `domesticTrackingCode`. `search` khớp cả
 *   các mã này; `orderType=PURCHASE|CONSIGNMENT` lọc theo loại.
 *
 * Backend chỉ lọc MỘT status. Tab "Cần quyết định" (AWAITING_TAB_KEY) lấy mọi phiếu
 * rồi lọc awaitingApproval — backend đã xếp phiếu chờ duyệt lên đầu danh sách.
 */

import httpClient from "@shared/api/httpClient";
import {
  getPagedData,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";
import { metaOf } from "@shared/utils/statusLabel";

export { getAdminApiError as getReceivingApiError };

const ENDPOINT = "/api/warehouse-receiving-notes";

/* Backend giới hạn pageSize tối đa 200. */
const MAX_PAGE_SIZE = 200;

/* ====================== Trạng thái ====================== */

export const RECEIVING_STATUS_META = Object.freeze({
  PENDING_APPROVAL: { label: "Chờ duyệt nhận hàng", tone: "warning" },
  ACTIVE: { label: "Chờ khách mang hàng tới", tone: "default" },
  PARTIALLY_RECEIVED: { label: "Nhận một phần", tone: "processing" },
  RECEIVED: { label: "Đã kiểm đếm", tone: "processing" },
  APPROVED: { label: "Đã chốt nhận hàng", tone: "success" },
  REJECTED: { label: "Bị từ chối", tone: "error" },
  /* Huỷ theo đơn mua NCC bị huỷ (PurchaseOrderService). */
  CANCELLED: { label: "Đã huỷ", tone: "default" },
});

/** Giai đoạn chờ quyết định của phiếu (`approvalStage`). */
export const RECEIVING_APPROVAL_STAGE_META = Object.freeze({
  RECEIVE: { label: "Duyệt nhận hàng", color: "gold" },
  DISCREPANCY: { label: "Xem chênh lệch", color: "red" },
  DISCREPANCY_ACK: { label: "Quyết định lệch cân", color: "volcano" },
});

/** Hai bước quyết định lệch: DISCREPANCY (lệch số lượng) và DISCREPANCY_ACK (lệch cân đã tự chốt). */
export const isDiscrepancyStage = (stage) => {
  const key = String(stage || "").toUpperCase();
  return key === "DISCREPANCY" || key === "DISCREPANCY_ACK";
};

/**
 * Bước này có cho từ chối không. DISCREPANCY_ACK: phiếu đã tự chốt, kiện có thể đã lên kệ —
 * BE chỉ nhận chấp nhận số thực tế, hàng có vấn đề thì mở sự cố cho kiện.
 */
export const canRejectAtStage = (stage) => String(stage || "").toUpperCase() !== "DISCREPANCY_ACK";

/** Tab ảo: mọi phiếu đang chờ quyết định (cả RECEIVE lẫn DISCREPANCY). */
export const AWAITING_TAB_KEY = "AWAITING";

/** Tab của màn duyệt — trừ tab ảo, key là đúng giá trị `status` API nhận. */
export const RECEIVING_STATUS_TABS = Object.freeze([
  { key: AWAITING_TAB_KEY, label: "Cần quyết định" },
  { key: "PENDING_APPROVAL", label: "Chờ duyệt nhận hàng" },
  { key: "ACTIVE", label: "Chờ khách mang hàng" },
  { key: "PARTIALLY_RECEIVED", label: "Nhận một phần" },
  { key: "RECEIVED", label: "Đã kiểm đếm" },
  { key: "APPROVED", label: "Đã chốt" },
  { key: "REJECTED", label: "Bị từ chối" },
  { key: "", label: "Tất cả" },
]);

export const getReceivingStatusMeta = (status) =>
  metaOf(RECEIVING_STATUS_META, status, { tone: "default" });

export const getApprovalStageMeta = (stage) =>
  RECEIVING_APPROVAL_STAGE_META[String(stage || "").toUpperCase()] || null;

/** Loại phiếu cho bộ lọc nhanh (`orderType` của API; rỗng = tất cả). */
export const RECEIVING_ORDER_TYPES = Object.freeze([
  { value: "", label: "Mọi loại" },
  { value: "PURCHASE", label: "Mua hộ" },
  { value: "CONSIGNMENT", label: "Ký gửi" },
]);

/** Phiếu của hàng mua hộ. BE cũ chưa có cờ thì suy từ mã yêu cầu / mã đơn mua. */
export const isPurchaseReceivingNote = (note) => {
  if (!note || typeof note !== "object") return false;
  if (typeof note.isPurchase === "boolean") return note.isPurchase;
  if (note.orderType) return String(note.orderType).toUpperCase() === "PURCHASE";
  return Boolean(note.purchaseCode || note.purchaseOrderCode);
};

/* ====================== Tiện ích ====================== */

const trimText = (value) => String(value ?? "").trim();

const requireId = (value, message) => {
  const id = trimText(value);
  if (!id) throw new Error(message);
  return id;
};

/* ====================== Đọc ====================== */

/**
 * Danh sách phiếu → { items, totalCount, pageNumber, pageSize }.
 *
 * @param {{ status?: string, warehouseId?: string, search?: string, orderType?: string,
 *   pageNumber?: number, pageSize?: number }} [filters]
 */
export async function listReceivingNotes({
  status = "",
  warehouseId = "",
  search = "",
  orderType = "",
  pageNumber = 1,
  pageSize = MAX_PAGE_SIZE,
} = {}) {
  const wantsAwaiting = trimText(status).toUpperCase() === AWAITING_TAB_KEY;
  const size = Math.min(Number(pageSize) || MAX_PAGE_SIZE, MAX_PAGE_SIZE);

  const response = await httpClient.get(ENDPOINT, {
    params: removeEmptyParams({
      status: wantsAwaiting ? "" : status,
      warehouseId,
      search,
      orderType: trimText(orderType).toUpperCase(),
      pageNumber: wantsAwaiting ? 1 : pageNumber,
      pageSize: size,
    }),
  });

  const page = getPagedData(getResponseData(response), { pageNumber, pageSize: size });

  if (!wantsAwaiting) {
    return {
      items: page.items,
      totalCount: page.totalCount,
      pageNumber: page.pageNumber,
      pageSize: page.pageSize,
    };
  }

  const items = page.items.filter((row) => row?.awaitingApproval);

  return {
    items,
    totalCount: items.length,
    pageNumber: 1,
    pageSize: size,
  };
}

/**
 * Số đếm cho đầu trang, tính trên TOÀN BỘ phiếu chứ không theo tab đang mở (trước đây chip
 * "Có chênh lệch" đếm trên tab "Cần quyết định" nên luôn ra 0).
 *
 * @returns {Promise<{ awaiting: number, discrepancyAwaiting: number, discrepancy: number }>}
 */
export async function getReceivingSummary({ warehouseId = "", search = "" } = {}) {
  const page = await listReceivingNotes({ status: "", warehouseId, search, pageSize: MAX_PAGE_SIZE });
  const items = page.items || [];
  return {
    awaiting: items.filter((row) => row?.awaitingApproval).length,
    discrepancyAwaiting: items.filter(
      (row) => row?.awaitingApproval && isDiscrepancyStage(row?.approvalStage),
    ).length,
    discrepancy: items.filter((row) => row?.hasDiscrepancy).length,
  };
}

/** Chi tiết phiếu: expectedItems (thùng gỗ + dịch vụ), items (biên bản đối chiếu), parcels. */
export async function getReceivingNoteDetail(receivingNoteId) {
  const id = requireId(receivingNoteId, "Thiếu mã phiếu tiếp nhận.");
  const response = await httpClient.get(`${ENDPOINT}/${encodeURIComponent(id)}`);
  return getResponseData(response);
}

/** Phiếu đang hoạt động của một đơn. 404 khi đơn chưa có phiếu (giữ lỗi để nơi gọi đọc status). */
export async function getReceivingNoteByOrder(orderId) {
  const id = requireId(orderId, "Thiếu mã đơn hàng.");
  const response = await httpClient.get(
    `${ENDPOINT}/by-consignment/${encodeURIComponent(id)}`,
  );
  return getResponseData(response);
}

/* ====================== Duyệt ====================== */

/**
 * Duyệt phiếu — dùng cho cả ba giai đoạn (RECEIVE: cho khách mang hàng tới;
 * DISCREPANCY: chốt biên bản lệch số lượng; DISCREPANCY_ACK: chấp nhận số thực tế của phiếu
 * lệch cân đã tự chốt). `reason` bắt buộc khi Admin duyệt thay quản lý kho.
 *
 * @param {string} receivingNoteId
 * @param {string} [reason]
 */
export async function approveReceivingNote(receivingNoteId, reason) {
  const id = requireId(receivingNoteId, "Thiếu mã phiếu tiếp nhận.");
  const note = trimText(reason);

  const response = await httpClient.put(`${ENDPOINT}/${encodeURIComponent(id)}/status`, {
    status: "APPROVED",
    ...(note ? { reason: note } : {}),
  });

  return getResponseData(response);
}

/** Từ chối phiếu — bắt buộc lý do (chặn tại chỗ trước khi gọi). */
export async function rejectReceivingNote(receivingNoteId, rejectionReason) {
  const id = requireId(receivingNoteId, "Thiếu mã phiếu tiếp nhận.");
  const reason = trimText(rejectionReason);
  if (!reason) throw new Error("Từ chối phiếu thì bắt buộc ghi lý do.");

  const response = await httpClient.put(`${ENDPOINT}/${encodeURIComponent(id)}/status`, {
    status: "REJECTED",
    rejectionReason: reason,
  });

  return getResponseData(response);
}

export default {
  listReceivingNotes,
  getReceivingSummary,
  getReceivingNoteDetail,
  getReceivingNoteByOrder,
  approveReceivingNote,
  rejectReceivingNote,
  getReceivingStatusMeta,
  getApprovalStageMeta,
  isDiscrepancyStage,
  isPurchaseReceivingNote,
  canRejectAtStage,
  RECEIVING_STATUS_META,
  RECEIVING_ORDER_TYPES,
  RECEIVING_APPROVAL_STAGE_META,
  RECEIVING_STATUS_TABS,
  AWAITING_TAB_KEY,
};
