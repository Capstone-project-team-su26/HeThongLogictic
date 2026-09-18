/*
 * Lô vận chuyển quốc tế — ĐÃ NỐI API THẬT (api-xuat-kho.md mục H, I, M).
 *
 *   GET /api/international-shipments?pageNumber=&pageSize=&statusTab=&status=&originWarehouseId=&search=
 *       → { message, data: { items, totalCount, pageNumber, pageSize, totalPages } }
 *   GET /api/international-shipments/{id}             → { message, data } — khoá chính là `shipmentId`
 *   GET /api/international-shipments/tracking-queue?originWarehouseId=&attentionOnly=
 *       → { message, data: ShipmentTrackingSummary[] }  (lô đã bàn giao, chưa về kho đích)
 *   GET /api/international-shipments/{id}/timeline    → { message, data: summary + events + orders + attachments }
 *   PUT /api/international-shipments/{id}/status      { status, note, customerMessage, location, carrierTrackingCode }
 *   GET /api/international-shipments/{id}/manifest    → PDF
 *
 * Lập lô / thêm-gỡ phiếu / bàn giao là việc của nhân viên kho (app kho) — không có ở đây.
 * Mốc được bấm tiếp KHÔNG tự suy ở FE: luôn đọc `nextMilestones` server trả.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getPagedData,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";
import { openFileInNewTab } from "@shared/api/fileDownload";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getShipmentApiError };

/* Bộ trạng thái lô MỚI. Bỏ hẳn CREATED / MANIFESTED / READY_TO_SHIP của luồng cũ. */
export const SHIPMENT_STATUS_META = Object.freeze({
  DRAFT: { label: "Lô nháp", color: "default" },
  HANDED_OVER: { label: "Đã bàn giao cho hãng", color: "blue" },
  DEPARTED: { label: "Đã khởi hành", color: "processing" },
  IN_TRANSIT: { label: "Đang vận chuyển", color: "processing" },
  DELAYED: { label: "Trễ lịch", color: "warning" },
  ON_HOLD: { label: "Tạm giữ / sự cố", color: "error" },
  CUSTOMS_CLEARED: { label: "Đã thông quan nhập", color: "cyan" },
  ARRIVED_VN: { label: "Đã về Việt Nam", color: "geekblue" },
  ARRIVED_DESTINATION: { label: "Đã tới kho đích", color: "success" },
  CANCELLED: { label: "Đã huỷ", color: "default" },
});

export const getShipmentStatusMeta = (status) =>
  SHIPMENT_STATUS_META[String(status || "").toUpperCase()] || {
    label: status || "—",
    color: "default",
  };

/* `statusTab` backend trả để chia tab. */
export const SHIPMENT_STATUS_TABS = Object.freeze([
  { key: "", label: "Tất cả" },
  { key: "PREPARING", label: "Đang chuẩn bị" },
  { key: "IN_TRANSIT", label: "Đang vận chuyển" },
  { key: "ISSUE", label: "Trễ / tạm giữ" },
  { key: "ARRIVED", label: "Đã về" },
  { key: "CANCELLED", label: "Đã huỷ" },
]);

/* Yêu cầu của mốc: NOTE → bắt nhập ghi chú; còn lại là mã giấy tờ phải có trên lô. */
export const MILESTONE_REQUIREMENT_NOTE = "NOTE";

const trimText = (value) => String(value ?? "").trim();

const requireId = (value) => {
  const id = trimText(value);
  if (!id) throw new Error("Thiếu mã lô vận chuyển.");
  return id;
};

/** Danh sách lô → { items, totalCount, pageNumber, pageSize }. */
export const listShipments = async ({
  statusTab = "",
  status = "",
  originWarehouseId = "",
  search = "",
  pageNumber = 1,
  pageSize = 20,
} = {}) => {
  const size = Math.min(Number(pageSize) || 20, 100);
  const response = await httpClient.get(API_ENDPOINTS.internationalShipments.list, {
    params: removeEmptyParams({
      statusTab,
      status,
      originWarehouseId,
      search,
      pageNumber,
      pageSize: size,
    }),
  });

  const page = getPagedData(getResponseData(response), { pageNumber, pageSize: size });
  return {
    items: page.items,
    totalCount: page.totalCount,
    pageNumber: page.pageNumber,
    pageSize: page.pageSize,
  };
};

/** Chi tiết lô: phiếu (wroRequests), kiện (parcels). */
export const getShipmentDetail = async (shipmentId) => {
  const response = await httpClient.get(API_ENDPOINTS.internationalShipments.detail(requireId(shipmentId)));
  return getResponseData(response);
};

/** Hàng đợi theo dõi lô của Sale — MẢNG TRẦN, server đã sắp lô cần xử lý lên đầu. */
export const getTrackingQueue = async ({ originWarehouseId = "", attentionOnly = false } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.internationalShipments.trackingQueue, {
    params: removeEmptyParams({ originWarehouseId, attentionOnly: attentionOnly ? true : undefined }),
  });
  return getArrayItems(getResponseData(response));
};

/** Dòng thời gian lô: events, orders (đơn bị ảnh hưởng), attachments, nextMilestones. */
export const getShipmentTimeline = async (shipmentId) => {
  const response = await httpClient.get(
    API_ENDPOINTS.internationalShipments.timeline(requireId(shipmentId)),
  );
  return getResponseData(response);
};

/**
 * Ghi một mốc hành trình. `note` là ghi chú NỘI BỘ (khách không thấy), `customerMessage` là lời
 * nhắn hiện cho khách (bỏ trống thì khách nhận câu mặc định của mốc).
 *
 * @param {string} shipmentId
 * @param {{ status: string, note?: string, customerMessage?: string, location?: string,
 *   carrierTrackingCode?: string, noteRequired?: boolean }} payload
 */
export const updateShipmentMilestone = async (
  shipmentId,
  { status, note, customerMessage, location, carrierTrackingCode, noteRequired = false } = {},
) => {
  const milestone = trimText(status).toUpperCase();
  if (!milestone) throw new Error("Chưa chọn mốc hành trình.");
  if (noteRequired && !trimText(note)) {
    throw new Error("Mốc trễ / tạm giữ phải ghi chú lý do.");
  }

  const response = await httpClient.put(
    API_ENDPOINTS.internationalShipments.status(requireId(shipmentId)),
    removeEmptyParams({
      status: milestone,
      note: trimText(note),
      customerMessage: trimText(customerMessage),
      location: trimText(location),
      carrierTrackingCode: trimText(carrierTrackingCode),
    }),
  );

  return getResponseData(response);
};

/** Mở manifest PDF của lô (sinh được từ lúc lô còn nháp). */
export const openShipmentManifest = (shipmentId, shipmentCode = "") =>
  openFileInNewTab(API_ENDPOINTS.internationalShipments.manifest(requireId(shipmentId)), {
    fileName: `manifest-${shipmentCode || shipmentId}.pdf`,
  });

export default {
  listShipments,
  getShipmentDetail,
  getTrackingQueue,
  getShipmentTimeline,
  updateShipmentMilestone,
  openShipmentManifest,
  getShipmentStatusMeta,
};
