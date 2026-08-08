import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

/* =========================================================
   TOKEN & AUTH HELPER
========================================================= */

const getAccessToken = () => {
  const token = sessionStorage.getItem("accessToken");
  if (!token) {
    throw new Error("Không tìm thấy token đăng nhập. Vui lòng đăng nhập lại.");
  }
  return token;
};

const getAuthHeaders = () => {
  return {
    Accept: "*/*",
    Authorization: `Bearer ${getAccessToken()}`,
  };
};

const getApiErrorMessage = (error, fallbackMessage) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.title ||
    error?.message ||
    fallbackMessage
  );
};

/* =========================================================
   API XÁC NHẬN MUA HỘ & CẬP NHẬT TIẾN ĐỘ
   PUT /api/purchase-requests/{requestId}/confirm-purchase
========================================================= */

/**
 * API Cập nhật Trạng thái & Bằng chứng Mua hộ
 *
 * @param {string} purchaseRequestId - GUID của đơn hàng mua hộ (ví dụ: f826db18-de19-4e79-9895-a69106cdfdcc)
 * @param {Object} payload
 * @param {string} payload.status - PENDING_REVIEW | PAID | PURCHASED | SELLER_SHIPPED | ARRIVED_ORIGIN_WAREHOUSE
 * @param {Array<string>} payload.proofImages - Danh sách URL ảnh bằng chứng (tối đa 3 ảnh)
 * @param {string} payload.generalNote - Ghi chú xử lý mua hộ
 */
export const confirmPurchaseApi = async (purchaseRequestId, payload = {}) => {
  if (!purchaseRequestId) {
    throw new Error("Không tìm thấy mã ID đơn mua hộ (purchaseRequestId).");
  }

  const normalizedId = String(purchaseRequestId).trim();

  const requestBody = {
    status: String(payload?.status || "PURCHASED").trim().toUpperCase(),
    proofImages: Array.isArray(payload?.proofImages)
      ? payload.proofImages.map((img) => String(img || "").trim()).filter(Boolean)
      : [],
    generalNote: String(payload?.generalNote || "").trim() || null,
    warehouseId: payload?.warehouseId ? String(payload.warehouseId).trim() : null,
    destinationWarehouseId: payload?.destinationWarehouseId
      ? String(payload.destinationWarehouseId).trim()
      : payload?.warehouseId
      ? String(payload.warehouseId).trim()
      : null,
    warehouseName: payload?.warehouseName ? String(payload.warehouseName).trim() : null,
  };

  const endpointUrl =
    typeof API_ENDPOINTS?.purchaseRequests?.confirmPurchase === "function"
      ? API_ENDPOINTS.purchaseRequests.confirmPurchase(normalizedId)
      : `/api/purchase-requests/${encodeURIComponent(normalizedId)}/confirm-purchase`;

  try {
    const response = await axiosInstance.put(endpointUrl, requestBody, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });

    return response?.data?.data ?? response?.data ?? null;
  } catch (error) {
    console.error("CONFIRM PURCHASE API ERROR:", error);
    throw new Error(
      getApiErrorMessage(error, "Không thể xác nhận mua hộ."),
      { cause: error }
    );
  }
};

export default confirmPurchaseApi;
