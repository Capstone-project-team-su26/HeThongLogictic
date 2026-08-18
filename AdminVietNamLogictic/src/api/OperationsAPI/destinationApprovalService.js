/**
 * Hai cửa duyệt của Operations Manager ở chặng hàng về Việt Nam.
 *
 * - Phiếu nhập kho   → /api/warehouse-inbound-requests   (kho lập, OM duyệt, rồi mới xếp kệ được)
 * - Yêu cầu giao hàng → /api/delivery-requests            (sale lập, OM duyệt, rồi kho mới đặt GoShip)
 *
 * Tách riêng khỏi consolidationWorkflowService vì đó là luồng gom lô ở kho quốc tế; hai luồng
 * này thuộc kho đích và có vòng đời khác hẳn.
 */

import axiosInstance from "../axiosInstance";
import { getAdminApiData, getAdminApiError, getAdminApiList } from "../AdminAPI/adminService";

export { getAdminApiError as getApprovalApiError };

const INBOUND_ENDPOINT = "/api/warehouse-inbound-requests";
const DELIVERY_ENDPOINT = "/api/delivery-requests";

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
});

export const getInboundStatusMeta = (status) =>
  INBOUND_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", tone: "default" };

export const getDeliveryStatusMeta = (status) =>
  DELIVERY_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", tone: "default" };

/* ====================== Phiếu nhập kho ====================== */

export const listInboundRequests = async ({ status = "", shipmentId = "" } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (shipmentId) params.shipmentId = shipmentId;

  const response = await axiosInstance.get(INBOUND_ENDPOINT, { params });
  return getAdminApiList(response);
};

export const getInboundRequestDetail = async (inboundRequestId) => {
  if (!inboundRequestId) throw new Error("Thiếu mã phiếu nhập kho.");
  const response = await axiosInstance.get(
    `${INBOUND_ENDPOINT}/${encodeURIComponent(inboundRequestId)}`,
  );
  return getAdminApiData(response);
};

export const approveInboundRequest = async (inboundRequestId) => {
  const response = await axiosInstance.put(
    `${INBOUND_ENDPOINT}/${encodeURIComponent(inboundRequestId)}/status`,
    { status: "INBOUND_APPROVED" },
  );
  return getAdminApiData(response);
};

export const rejectInboundRequest = async (inboundRequestId, rejectionReason) => {
  // BE bắt buộc có lý do khi từ chối — chặn sớm để người dùng khỏi mất một vòng gọi.
  if (!String(rejectionReason || "").trim()) {
    throw new Error("Vui lòng nhập lý do từ chối phiếu nhập kho.");
  }

  const response = await axiosInstance.put(
    `${INBOUND_ENDPOINT}/${encodeURIComponent(inboundRequestId)}/status`,
    { status: "INBOUND_REJECTED", rejectionReason: String(rejectionReason).trim() },
  );
  return getAdminApiData(response);
};

/* ====================== Yêu cầu giao hàng ====================== */

export const listDeliveryRequests = async ({ status = "", orderId = "" } = {}) => {
  const params = {};
  if (status) params.status = status;
  if (orderId) params.orderId = orderId;

  const response = await axiosInstance.get(DELIVERY_ENDPOINT, { params });
  return getAdminApiList(response);
};

export const getDeliveryRequestDetail = async (deliveryRequestId) => {
  if (!deliveryRequestId) throw new Error("Thiếu mã yêu cầu giao hàng.");
  const response = await axiosInstance.get(
    `${DELIVERY_ENDPOINT}/${encodeURIComponent(deliveryRequestId)}`,
  );
  return getAdminApiData(response);
};

export const approveDeliveryRequest = async (deliveryRequestId) => {
  const response = await axiosInstance.put(
    `${DELIVERY_ENDPOINT}/${encodeURIComponent(deliveryRequestId)}/status`,
    { status: "DELIVERY_APPROVED" },
  );
  return getAdminApiData(response);
};

export const rejectDeliveryRequest = async (deliveryRequestId, rejectionReason) => {
  if (!String(rejectionReason || "").trim()) {
    throw new Error("Vui lòng nhập lý do từ chối yêu cầu giao hàng.");
  }

  const response = await axiosInstance.put(
    `${DELIVERY_ENDPOINT}/${encodeURIComponent(deliveryRequestId)}/status`,
    { status: "DELIVERY_REJECTED", rejectionReason: String(rejectionReason).trim() },
  );
  return getAdminApiData(response);
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
  getInboundStatusMeta,
  getDeliveryStatusMeta,
};
