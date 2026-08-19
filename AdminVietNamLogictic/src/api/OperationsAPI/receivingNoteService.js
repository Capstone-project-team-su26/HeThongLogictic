/**
 * Phiếu tiếp nhận kho gốc — `/api/warehouse-receiving-notes`.
 *
 * Phiếu TỰ SINH khi đơn ký gửi thu được tiền, không ai bấm tạo. Vòng đời:
 *
 *   ACTIVE → PARTIALLY_RECEIVED → RECEIVED → APPROVED
 *                                         ↘ REJECTED
 *
 * Kho cân đếm rồi chốt số thực tế (phiếu sang RECEIVED), OM nhìn chênh lệch rồi mới duyệt.
 * Chưa APPROVED thì `PUT /api/parcels/{id}/put-away` trả 400 — hàng không lên kệ được.
 *
 * Tách riêng khỏi destinationApprovalService vì đó là phiếu nhập kho ĐÍCH (Việt Nam),
 * còn cái này là phiếu tiếp nhận ở kho GỐC, hai vòng đời khác nhau.
 */

import axiosInstance from "../axiosInstance";
import { getAdminApiData, getAdminApiError } from "../AdminAPI/adminService";

export { getAdminApiError as getReceivingApiError };

const ENDPOINT = "/api/warehouse-receiving-notes";

/* ====================== Trạng thái ====================== */

export const RECEIVING_STATUS_META = Object.freeze({
  ACTIVE: { label: "Chờ kho nhận hàng", tone: "default" },
  PARTIALLY_RECEIVED: { label: "Nhận một phần", tone: "processing" },
  RECEIVED: { label: "Chờ duyệt", tone: "warning" },
  APPROVED: { label: "Đã duyệt", tone: "success" },
  REJECTED: { label: "Bị từ chối", tone: "error" },
});

/** Tab của màn duyệt — khớp đúng giá trị `status` mà API nhận. */
export const RECEIVING_STATUS_TABS = Object.freeze([
  { key: "RECEIVED", label: "Chờ duyệt" },
  { key: "ACTIVE", label: "Chờ kho nhận" },
  { key: "PARTIALLY_RECEIVED", label: "Nhận một phần" },
  { key: "APPROVED", label: "Đã duyệt" },
  { key: "REJECTED", label: "Bị từ chối" },
  { key: "", label: "Tất cả" },
]);

export const getReceivingStatusMeta = (status) =>
  RECEIVING_STATUS_META[String(status || "").toUpperCase()] || {
    label: status || "—",
    tone: "default",
  };

/* ====================== Đọc ====================== */

/**
 * Danh sách phiếu. BE đã xếp phiếu chờ duyệt lên đầu nên FE không sắp lại.
 * Trả về nguyên cả bọc phân trang để màn hình hiện được tổng số.
 */
export async function listReceivingNotes({
  status = "",
  warehouseId = "",
  search = "",
  pageNumber = 1,
  pageSize = 50,
} = {}) {
  const params = { pageNumber, pageSize };
  if (status) params.status = status;
  if (warehouseId) params.warehouseId = warehouseId;
  if (search) params.search = search;

  const response = await axiosInstance.get(ENDPOINT, { params });
  const data = getAdminApiData(response);

  return {
    items: Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [],
    totalCount: Number(data?.totalCount) || 0,
    pageNumber: Number(data?.pageNumber) || pageNumber,
    pageSize: Number(data?.pageSize) || pageSize,
  };
}

/** Chi tiết phiếu, gồm hàng khách khai (`expectedItems`) và dòng đối chiếu (`items`). */
export async function getReceivingNoteDetail(receivingNoteId) {
  if (!receivingNoteId) throw new Error("Thiếu mã phiếu tiếp nhận.");
  const response = await axiosInstance.get(
    `${ENDPOINT}/${encodeURIComponent(receivingNoteId)}`,
  );
  return getAdminApiData(response);
}

/** Phiếu đang hoạt động của một đơn ký gửi — dùng ở màn chi tiết đơn. */
export async function getReceivingNoteByOrder(orderId) {
  if (!orderId) throw new Error("Thiếu mã đơn hàng.");
  const response = await axiosInstance.get(
    `${ENDPOINT}/by-consignment/${encodeURIComponent(orderId)}`,
  );
  return getAdminApiData(response);
}

/* ====================== Duyệt ====================== */

export async function approveReceivingNote(receivingNoteId) {
  if (!receivingNoteId) throw new Error("Thiếu mã phiếu tiếp nhận.");
  const response = await axiosInstance.put(
    `${ENDPOINT}/${encodeURIComponent(receivingNoteId)}/status`,
    { status: "APPROVED" },
  );
  return getAdminApiData(response);
}

export async function rejectReceivingNote(receivingNoteId, rejectionReason) {
  if (!receivingNoteId) throw new Error("Thiếu mã phiếu tiếp nhận.");
  const reason = String(rejectionReason || "").trim();
  // Chặn ngay ở FE cho nhanh; BE cũng chặn nên không sợ lọt.
  if (!reason) throw new Error("Từ chối phiếu thì bắt buộc ghi lý do.");

  const response = await axiosInstance.put(
    `${ENDPOINT}/${encodeURIComponent(receivingNoteId)}/status`,
    { status: "REJECTED", rejectionReason: reason },
  );
  return getAdminApiData(response);
}

export default {
  listReceivingNotes,
  getReceivingNoteDetail,
  getReceivingNoteByOrder,
  approveReceivingNote,
  rejectReceivingNote,
  getReceivingStatusMeta,
  RECEIVING_STATUS_META,
  RECEIVING_STATUS_TABS,
};
