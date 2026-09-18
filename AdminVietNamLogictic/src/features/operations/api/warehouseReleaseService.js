/*
 * Phiếu xuất kho (WRO) — ĐÃ NỐI API THẬT, luồng xuất kho quốc tế mới (api-xuat-kho.md B, C, G).
 *
 *   GET  /api/warehouse-release-requests?status=A,B&warehouseId=&search=&pageNumber=&pageSize=
 *        → { message, data: { items, totalCount, pageNumber, pageSize, totalPages } }
 *   GET  /api/warehouse-release-requests/{id}       → { message, data: WroDetail (parcels, attachments) }
 *   POST /api/warehouse-release-requests/{id}/decide { decision: APPROVED|REJECTED, reason }
 *   GET  /api/warehouse-release-requests/{id}/release-note   → PDF (sinh khi duyệt)
 *   GET  /api/warehouse-release-requests/{id}/picking-sheet  → PDF danh sách soạn hàng
 *
 * Web quản trị chỉ XEM và DUYỆT. Lập / gửi duyệt / bốc hàng / tách phiếu / lập lô là việc của
 * nhân viên kho trên app kho — OperationsManager không thao tác kho (người duyệt tách khỏi
 * người làm), nên các API đó cố ý không có ở đây.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getPagedData, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";
import { openFileInNewTab } from "@shared/api/fileDownload";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getWroApiError };

/* Trạng thái phiếu mới — bỏ hẳn bộ cũ (PACKING, PACKED, READY_TO_SHIP, CREATED...). */
export const WRO_STATUS_META = Object.freeze({
  DRAFT: { label: "Nháp", color: "default" },
  PENDING_APPROVAL: { label: "Chờ quản lý kho duyệt", color: "gold" },
  APPROVED: { label: "Đã duyệt, chờ bốc hàng", color: "blue" },
  PICKING: { label: "Đang bốc hàng sang khu xuất", color: "processing" },
  READY: { label: "Đã bốc xong, chờ vào lô", color: "cyan" },
  IN_SHIPMENT: { label: "Đã vào lô vận chuyển", color: "geekblue" },
  HANDED_OVER: { label: "Đã bàn giao cho hãng", color: "success" },
  REJECTED: { label: "Bị từ chối", color: "error" },
  CANCELLED: { label: "Đã huỷ", color: "default" },
});

export const WRO_PARCEL_STATUS_META = Object.freeze({
  RESERVED: { label: "Đã khoá, chờ bốc", color: "gold" },
  PICKED: { label: "Đã bốc sang khu xuất", color: "processing" },
  HANDED_OVER: { label: "Đã bàn giao", color: "success" },
  REMOVED: { label: "Bị bỏ khỏi phiếu", color: "default" },
});

export const getWroStatusMeta = (status) =>
  WRO_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", color: "default" };

export const getWroParcelStatusMeta = (status) =>
  WRO_PARCEL_STATUS_META[String(status || "").toUpperCase()] || {
    label: status || "—",
    color: "default",
  };

/** Tab của màn duyệt — key là giá trị `status` gửi thẳng lên (nhiều giá trị ngăn dấu phẩy). */
export const WRO_STATUS_TABS = Object.freeze([
  { key: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { key: "APPROVED,PICKING,READY", label: "Đang soạn hàng" },
  { key: "IN_SHIPMENT,HANDED_OVER", label: "Đã vào lô / bàn giao" },
  { key: "REJECTED", label: "Bị từ chối" },
  { key: "", label: "Tất cả" },
]);

const trimText = (value) => String(value ?? "").trim();

const requireId = (value) => {
  const id = trimText(value);
  if (!id) throw new Error("Thiếu mã phiếu xuất kho.");
  return id;
};

/* Backend giới hạn pageSize tối đa 100. */
const MAX_PAGE_SIZE = 100;

/** Danh sách phiếu (mới nhất trước) → { items, totalCount, pageNumber, pageSize }. */
export const listWarehouseReleases = async ({
  status = "",
  warehouseId = "",
  search = "",
  pageNumber = 1,
  pageSize = 20,
} = {}) => {
  const size = Math.min(Number(pageSize) || 20, MAX_PAGE_SIZE);

  const response = await httpClient.get(API_ENDPOINTS.warehouseReleaseRequests.list, {
    params: removeEmptyParams({ status, warehouseId, search, pageNumber, pageSize: size }),
  });

  const page = getPagedData(getResponseData(response), { pageNumber, pageSize: size });
  return {
    items: page.items,
    totalCount: page.totalCount,
    pageNumber: page.pageNumber,
    pageSize: page.pageSize,
  };
};

/** Chi tiết phiếu: kiện (kể cả dòng REMOVED để xem lịch sử) + giấy tờ. */
export const getWarehouseReleaseDetail = async (id) => {
  const response = await httpClient.get(API_ENDPOINTS.warehouseReleaseRequests.detail(requireId(id)));
  return getResponseData(response);
};

/**
 * Quyết định phiếu. Chặn trước các luật backend chắc chắn từ chối để người dùng đọc câu
 * tiếng Việt thay vì 400: từ chối bắt buộc lý do; Admin duyệt thay cũng bắt buộc lý do.
 *
 * @param {string} id
 * @param {{ decision: "APPROVED"|"REJECTED", reason?: string, reasonRequired?: boolean }} payload
 */
export const decideWarehouseRelease = async (id, { decision, reason = "", reasonRequired = false } = {}) => {
  const normalized = trimText(decision).toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalized)) {
    throw new Error("Quyết định chỉ nhận Duyệt hoặc Từ chối.");
  }

  const note = trimText(reason);
  if (normalized === "REJECTED" && !note) throw new Error("Từ chối phiếu thì bắt buộc ghi lý do.");
  if (reasonRequired && !note) {
    throw new Error("Admin duyệt thay quản lý kho thì bắt buộc ghi lý do.");
  }

  const response = await httpClient.post(API_ENDPOINTS.warehouseReleaseRequests.decide(requireId(id)), {
    decision: normalized,
    ...(note ? { reason: note } : {}),
  });

  return getResponseData(response);
};

/** Mở phiếu xuất kho PDF (chỉ có sau khi duyệt). */
export const openReleaseNotePdf = (id, wroCode = "") =>
  openFileInNewTab(API_ENDPOINTS.warehouseReleaseRequests.releaseNote(requireId(id)), {
    fileName: `phieu-xuat-kho-${wroCode || id}.pdf`,
  });

/** Mở danh sách soạn hàng PDF. */
export const openPickingSheetPdf = (id, wroCode = "") =>
  openFileInNewTab(API_ENDPOINTS.warehouseReleaseRequests.pickingSheet(requireId(id)), {
    fileName: `danh-sach-soan-hang-${wroCode || id}.pdf`,
  });

export default {
  listWarehouseReleases,
  getWarehouseReleaseDetail,
  decideWarehouseRelease,
  openReleaseNotePdf,
  openPickingSheetPdf,
  getWroStatusMeta,
  getWroParcelStatusMeta,
};
