/*
 * Theo dõi đơn, giữ hàng, chốt đơn — ĐÃ NỐI API THẬT
 * (api-xuat-kho.md mục K, L; api-hang-ve-viet-nam.md mục F, G).
 *
 *   GET /api/orders/consignments/tracking?stage=&search=&includeFinished=&pageNumber=&pageSize=
 *       → { message, data: { items, totalCount, ... } }   (nhân viên thấy mọi đơn)
 *   GET /api/orders/consignments/{orderId}/tracking     → { message, data: OrderTracking }
 *   PUT /api/orders/consignments/{orderId}/export-hold  { hold, reason }
 *       → data.parcelsAlreadyInApprovedRelease: kiện đã trong phiếu đã duyệt — cờ giữ hàng KHÔNG dừng được
 *   PUT /api/orders/consignments/{orderId}/complete     { note }   (OM, Admin — chốt tay)
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getPagedData, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";
import { labelOf } from "@shared/utils/statusLabel";

export { getAdminApiError as getTrackingApiError };

/* Chặng của đơn / kiện (server trả sẵn *Text; bảng này chỉ để tô màu + làm bộ lọc). */
export const TRACKING_STAGES = Object.freeze([
  { value: "NOT_RECEIVED", label: "Kho chưa nhận hàng", color: "default" },
  { value: "AT_ORIGIN_WAREHOUSE", label: "Đang lưu kho nguồn", color: "blue" },
  { value: "PREPARING_EXPORT", label: "Chuẩn bị xuất kho", color: "cyan" },
  { value: "HANDED_OVER", label: "Đã xuất kho", color: "processing" },
  { value: "DEPARTED", label: "Đã khởi hành", color: "processing" },
  { value: "IN_TRANSIT", label: "Đang vận chuyển", color: "processing" },
  { value: "DELAYED", label: "Trễ lịch", color: "warning" },
  { value: "ON_HOLD", label: "Tạm giữ", color: "error" },
  { value: "CUSTOMS_CLEARED", label: "Đã thông quan", color: "geekblue" },
  { value: "ARRIVED_VN", label: "Đã về Việt Nam", color: "geekblue" },
  { value: "ARRIVED_DESTINATION", label: "Đã về kho VN", color: "green" },
  { value: "RECEIVED_AT_VN", label: "Kho VN đã kiểm", color: "green" },
  { value: "QUARANTINED", label: "Đang xử lý sự cố", color: "error" },
  { value: "STORED_AT_VN", label: "Lưu kho VN", color: "gold" },
  { value: "OUT_FOR_DELIVERY", label: "Đang giao", color: "processing" },
  { value: "DELIVERY_FAILED", label: "Giao chưa thành công", color: "error" },
  { value: "DELIVERED", label: "Đã giao", color: "success" },
  { value: "DISPOSED", label: "Đã huỷ theo sự cố", color: "default" },
]);

export const getStageMeta = (stage) =>
  TRACKING_STAGES.find((item) => item.value === String(stage || "").toUpperCase()) || {
    value: stage,
    label: labelOf(TRACKING_STAGES, stage),
    color: "default",
  };

const trimText = (value) => String(value ?? "").trim();

const requireOrderId = (value) => {
  const id = trimText(value);
  if (!id) throw new Error("Thiếu mã đơn hàng.");
  return id;
};

/** Đơn đang có hàng ở kho / trên đường → { items, totalCount, pageNumber, pageSize }. */
export const listTrackedOrders = async ({
  stage = "",
  search = "",
  includeFinished = false,
  pageNumber = 1,
  pageSize = 20,
} = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.orders.trackingList, {
    params: removeEmptyParams({
      stage,
      search,
      includeFinished: includeFinished ? true : undefined,
      pageNumber,
      pageSize,
    }),
  });

  const page = getPagedData(getResponseData(response), { pageNumber, pageSize });
  return {
    items: page.items,
    totalCount: page.totalCount,
    pageNumber: page.pageNumber,
    pageSize: page.pageSize,
  };
};

/** Hành trình chi tiết một đơn: chặng, từng kiện, chuyến, dòng thời gian (cũ → mới). */
export const getOrderTracking = async (orderId) => {
  const response = await httpClient.get(API_ENDPOINTS.orders.tracking(requireOrderId(orderId)));
  return getResponseData(response);
};

/**
 * Bật / tắt giữ hàng tại kho nguồn thay khách. Bật bắt buộc lý do (để kho biết vì sao hàng
 * không lên chuyến) — chặn trước ở đây.
 */
export const setExportHold = async (orderId, { hold, reason = "" } = {}) => {
  const cleanReason = trimText(reason);
  if (hold && !cleanReason) {
    throw new Error("Bật giữ hàng phải ghi lý do để kho biết vì sao hàng không lên chuyến.");
  }

  const response = await httpClient.put(API_ENDPOINTS.orders.exportHold(requireOrderId(orderId)), {
    hold: Boolean(hold),
    ...(hold ? { reason: cleanReason } : {}),
  });
  return getResponseData(response);
};

/** Chốt đơn hoàn thành bằng tay (còn sự cố / bồi thường / khoản thu treo thì backend trả 400). */
export const completeOrder = async (orderId, note = "") => {
  const response = await httpClient.put(API_ENDPOINTS.orders.complete(requireOrderId(orderId)), {
    note: trimText(note) || null,
  });
  return getResponseData(response);
};

export default {
  listTrackedOrders,
  getOrderTracking,
  setExportHold,
  completeOrder,
  getStageMeta,
};
