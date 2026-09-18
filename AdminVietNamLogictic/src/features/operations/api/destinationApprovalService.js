/*
 * Hai cửa duyệt chặng hàng về Việt Nam — ĐÃ NỐI API THẬT (api-hang-ve-viet-nam.md mục D).
 *
 * - Phiếu nhập kho VN (kho lập cho kiện STORE_AT_VN, quản lý kho duyệt → hệ thống tự xếp ô)
 *     GET /api/warehouse-inbound-requests?status=&shipmentId=  → { message, data: { items, totalCount } }
 *     GET /api/warehouse-inbound-requests/{id}                 → { message, data }
 *     PUT /api/warehouse-inbound-requests/{id}/status          { status: INBOUND_APPROVED | INBOUND_REJECTED, rejectionReason }
 * - Yêu cầu giao hàng (khách / Sale lập, quản lý kho duyệt, kho đặt GoShip)
 *     GET /api/delivery-requests?status=&orderId=              → { message, data: { items, totalCount } }
 *     GET /api/delivery-requests/{id}                          → { message, data }
 *     PUT /api/delivery-requests/{id}/status                   { status: DELIVERY_APPROVED | DELIVERY_REJECTED, rejectionReason }
 *     POST /api/delivery-requests/{id}/proof                   { receivedBy, note }  (Sale / OM / Admin)
 *
 * Bề mặt public giữ nguyên tên cũ (listXxx → MẢNG TRẦN, getXxxDetail / approve / reject →
 * OBJECT) để OperationsInboundApprovalsPage, OperationsDeliveryApprovalsPage và
 * AdminDeliveriesPage không phải đổi cách đọc dữ liệu.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getApprovalApiError };

/* ====================== Trạng thái ====================== */

export const INBOUND_STATUS_META = Object.freeze({
  INBOUND_PENDING: { label: "Chờ duyệt", tone: "warning" },
  INBOUND_APPROVED: { label: "Đã duyệt", tone: "success" },
  INBOUND_REJECTED: { label: "Từ chối", tone: "error" },
});

export const DELIVERY_STATUS_META = Object.freeze({
  DELIVERY_PENDING: { label: "Chờ duyệt", tone: "warning" },
  DELIVERY_APPROVED: { label: "Đã duyệt", tone: "processing" },
  DELIVERY_REJECTED: { label: "Từ chối", tone: "error" },
  DELIVERY_DISPATCHED: { label: "Đã đặt giao", tone: "success" },
  /* Giao thất bại, kho đã nhận lại hàng hoàn — Sale / khách lập yêu cầu giao lại. */
  DELIVERY_RETURNED: { label: "Hàng hoàn về kho", tone: "error" },
});

export const getInboundStatusMeta = (status) =>
  INBOUND_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", tone: "default" };

export const getDeliveryStatusMeta = (status) =>
  DELIVERY_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", tone: "default" };

const trimText = (value) => String(value ?? "").trim();

const requireId = (value, message) => {
  const id = trimText(value);
  if (!id) throw new Error(message);
  return id;
};

/* ====================== Phiếu nhập kho VN ====================== */

export const listInboundRequests = async ({ status = "", shipmentId = "" } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.warehouseInboundRequests.list, {
    params: removeEmptyParams({ status, shipmentId }),
  });
  return getArrayItems(getResponseData(response));
};

export const getInboundRequestDetail = async (inboundRequestId) => {
  const id = requireId(inboundRequestId, "Thiếu mã phiếu nhập kho.");
  const response = await httpClient.get(API_ENDPOINTS.warehouseInboundRequests.detail(id));
  return getResponseData(response);
};

/** Duyệt phiếu nhập kho VN — hệ thống tự xếp kiện vào ô khu lưu kho còn chỗ. */
export const approveInboundRequest = async (inboundRequestId) => {
  const id = requireId(inboundRequestId, "Thiếu mã phiếu nhập kho.");
  const response = await httpClient.put(API_ENDPOINTS.warehouseInboundRequests.status(id), {
    status: "INBOUND_APPROVED",
  });
  return getResponseData(response);
};

export const rejectInboundRequest = async (inboundRequestId, rejectionReason) => {
  /* Backend bắt buộc lý do khi từ chối — chặn sớm để khỏi mất một vòng gọi. */
  const reason = trimText(rejectionReason);
  if (!reason) throw new Error("Vui lòng nhập lý do từ chối phiếu nhập kho.");

  const id = requireId(inboundRequestId, "Thiếu mã phiếu nhập kho.");
  const response = await httpClient.put(API_ENDPOINTS.warehouseInboundRequests.status(id), {
    status: "INBOUND_REJECTED",
    rejectionReason: reason,
  });
  return getResponseData(response);
};

/* ====================== Yêu cầu giao hàng ====================== */

export const listDeliveryRequests = async ({ status = "", orderId = "" } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.deliveryRequests.list, {
    params: removeEmptyParams({ status, orderId }),
  });

  /* Backend không sắp thứ tự cố định — xếp mới lập lên đầu để tab "Chờ duyệt" đọc từ trên xuống. */
  return getArrayItems(getResponseData(response)).sort(
    (left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0),
  );
};

export const getDeliveryRequestDetail = async (deliveryRequestId) => {
  const id = requireId(deliveryRequestId, "Thiếu mã yêu cầu giao hàng.");
  const response = await httpClient.get(API_ENDPOINTS.deliveryRequests.detail(id));
  return getResponseData(response);
};

export const approveDeliveryRequest = async (deliveryRequestId) => {
  const id = requireId(deliveryRequestId, "Thiếu mã yêu cầu giao hàng.");
  const response = await httpClient.put(API_ENDPOINTS.deliveryRequests.status(id), {
    status: "DELIVERY_APPROVED",
  });
  return getResponseData(response);
};

export const rejectDeliveryRequest = async (deliveryRequestId, rejectionReason) => {
  const reason = trimText(rejectionReason);
  if (!reason) throw new Error("Vui lòng nhập lý do từ chối yêu cầu giao hàng.");

  const id = requireId(deliveryRequestId, "Thiếu mã yêu cầu giao hàng.");
  const response = await httpClient.put(API_ENDPOINTS.deliveryRequests.status(id), {
    status: "DELIVERY_REJECTED",
    rejectionReason: reason,
  });
  return getResponseData(response);
};

/**
 * Sale ghi bằng chứng giao khi hãng không báo về (giao tay). Phiếu phải DELIVERY_DISPATCHED và
 * đã có ảnh ký nhận DELIVERY_PROOF gắn vào yêu cầu giao (entityType = DELIVERY_REQUEST).
 *
 * @param {string} deliveryRequestId
 * @param {{ receivedBy: string, note?: string }} payload
 */
export const recordDeliveryProof = async (deliveryRequestId, { receivedBy, note = "" } = {}) => {
  const id = requireId(deliveryRequestId, "Thiếu mã yêu cầu giao hàng.");
  if (!trimText(receivedBy)) throw new Error("Phải ghi tên người nhận hàng.");

  const response = await httpClient.post(API_ENDPOINTS.deliveryRequests.proof(id), {
    receivedBy: trimText(receivedBy),
    ...(trimText(note) ? { note: trimText(note) } : {}),
  });
  return getResponseData(response);
};

export default {
  listInboundRequests,
  getInboundRequestDetail,
  approveInboundRequest,
  rejectInboundRequest,
  listDeliveryRequests,
  getDeliveryRequestDetail,
  approveDeliveryRequest,
  rejectDeliveryRequest,
  recordDeliveryProof,
  getInboundStatusMeta,
  getDeliveryStatusMeta,
};
