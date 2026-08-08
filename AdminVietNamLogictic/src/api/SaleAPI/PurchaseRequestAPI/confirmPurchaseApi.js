import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

/* =========================================================
   API XÁC NHẬN MUA HỘ & CẬP NHẬT TIẾN ĐỘ
   PUT /api/purchase-requests/{purchaseRequestId}/confirm-purchase
========================================================= */

const getApiErrorMessage = (error, fallbackMessage) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.title ||
    error?.message ||
    fallbackMessage
  );
};

const VALID_BE_PURCHASE_STATUSES = new Set([
  "PENDING_REVIEW",
  "DEPOSIT_PAID",
  "PAID",
  "PURCHASED",
  "SELLER_SHIPPED",
  "ARRIVED_ORIGIN_WAREHOUSE",
  "WAITING_STORED",
  "STORED",
  "COMPLETED",
]);

/**
 * API Cập nhật Trạng thái & Bằng chứng Mua hộ
 *
 * @param {string} purchaseRequestId - GUID của đơn hàng mua hộ (ví dụ: 4b8e036f-3c72-49ab-b513-9683e189cc42)
 * @param {Object} payload
 * @param {string} payload.status - Status code hợp lệ trên BE
 * @param {Array<string>} payload.proofImages - Mảng danh sách URL ảnh bằng chứng
 * @param {string} payload.generalNote - Ghi chú mua hộ
 * @param {string} payload.warehouseId - GUID kho nhận dự kiến
 * @param {string} payload.destinationWarehouseId - GUID kho đích dự kiến
 * @param {string} payload.warehouseName - Tên kho nhận dự kiến
 */
export const confirmPurchaseApi = async (purchaseRequestId, payload = {}) => {
  if (!purchaseRequestId) {
    throw new Error("Không tìm thấy mã ID đơn mua hộ (purchaseRequestId).");
  }

  const normalizedId = String(purchaseRequestId).trim();
  const rawStatus = String(payload?.status || "PURCHASED").trim().toUpperCase();

  // Đảm bảo status thuộc mảng hợp lệ của Backend: PENDING_REVIEW, DEPOSIT_PAID, PAID, PURCHASED, SELLER_SHIPPED, ARRIVED_ORIGIN_WAREHOUSE, WAITING_STORED, STORED, COMPLETED
  const targetStatus = VALID_BE_PURCHASE_STATUSES.has(rawStatus)
    ? rawStatus
    : "PURCHASED";

  const requestBody = {
    status: targetStatus,
    proofImages: Array.isArray(payload?.proofImages)
      ? payload.proofImages.map((img) => String(img || "").trim()).filter(Boolean)
      : [],
    generalNote: String(payload?.generalNote || "").trim() || "",
    warehouseId: payload?.warehouseId ? String(payload.warehouseId).trim() : null,
    destinationWarehouseId: payload?.destinationWarehouseId
      ? String(payload.destinationWarehouseId).trim()
      : payload?.warehouseId
      ? String(payload.warehouseId).trim()
      : null,
    warehouseName: payload?.warehouseName ? String(payload.warehouseName).trim() : "",
  };

  const endpointUrl =
    typeof API_ENDPOINTS?.purchaseRequests?.confirmPurchase === "function"
      ? API_ENDPOINTS.purchaseRequests.confirmPurchase(normalizedId)
      : `/api/purchase-requests/${encodeURIComponent(normalizedId)}/confirm-purchase`;

  try {
    const response = await axiosInstance.put(endpointUrl, requestBody);

    if (response?.data && response?.data?.success === false) {
      throw new Error(
        response?.data?.message || "Cập nhật tiến độ mua hàng thất bại."
      );
    }

    return response?.data?.data ?? response?.data ?? null;
  } catch (error) {
    console.error("CONFIRM PURCHASE API ERROR:", error);
    throw new Error(
      getApiErrorMessage(error, "Không thể xác nhận mua hộ."),
      { cause: error }
    );
  }
};

/**
 * Ops/Manager duyệt kiểm kê nhập kho.
 * POST /api/purchase-requests/{requestId}/approve-store
 * Chỉ khi đơn ở WAITING_STORED hoặc ARRIVED_ORIGIN_WAREHOUSE → STORED.
 */
export const approveStorePurchaseApi = async (purchaseRequestId, payload = {}) => {
  if (!purchaseRequestId) {
    throw new Error("Không tìm thấy mã ID đơn mua hộ (purchaseRequestId).");
  }

  const normalizedId = String(purchaseRequestId).trim();
  const requestBody = {
    note: String(payload?.note || "").trim() || null,
    warehouseId: payload?.warehouseId ? String(payload.warehouseId).trim() : null,
  };

  const endpointUrl =
    typeof API_ENDPOINTS?.purchaseRequests?.approveStore === "function"
      ? API_ENDPOINTS.purchaseRequests.approveStore(normalizedId)
      : `/api/purchase-requests/${encodeURIComponent(normalizedId)}/approve-store`;

  try {
    const response = await axiosInstance.post(endpointUrl, requestBody, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });
    return response?.data?.data ?? response?.data ?? null;
  } catch (error) {
    console.error("APPROVE STORE PURCHASE API ERROR:", error);
    throw new Error(
      getApiErrorMessage(error, "Không thể duyệt nhập kho đơn mua hộ."),
      { cause: error }
    );
  }
};

export default confirmPurchaseApi;
