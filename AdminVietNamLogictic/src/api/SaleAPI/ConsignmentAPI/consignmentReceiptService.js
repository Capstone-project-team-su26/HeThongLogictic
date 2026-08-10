import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

/* =========================================================
   API LẤY PHIẾU BIÊN NHẬN / PHIẾU KÝ GỬI (RECEIPT PDF/BLOB)
   GET /api/orders/consignments/{orderId}/receipt
========================================================= */

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error("Không tìm thấy token. Vui lòng đăng nhập lại.");
  }

  return token;
};

const getAuthHeaders = () => {
  const token = getAccessToken();
  return {
    Accept: "text/plain, application/pdf, */*",
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Lấy file PDF phiếu biên nhận đơn ký gửi theo orderId
 *
 * @param {string} orderId - GUID đơn hàng ký gửi (ví dụ: 28e74231-eea6-4f14-aec1-433886467c73)
 * @param {Object} options
 * @param {boolean} options.download - Nếu true sẽ tự động tải file PDF về máy
 * @returns {Promise<Blob>} Blob dữ liệu PDF
 */
export const getConsignmentReceiptApi = async (orderId, options = {}) => {
  if (!orderId) {
    throw new Error("Không tìm thấy mã ID đơn ký gửi (orderId).");
  }

  const normalizedOrderId = String(orderId).trim();
  const endpointUrl =
    typeof API_ENDPOINTS?.consignments?.receipt === "function"
      ? API_ENDPOINTS.consignments.receipt(normalizedOrderId)
      : `/api/orders/consignments/${encodeURIComponent(normalizedOrderId)}/receipt`;

  try {
    const response = await axiosInstance.get(endpointUrl, {
      headers: getAuthHeaders(),
      responseType: "blob",
    });

    const blobData = response?.data;
    const pdfBlob = new Blob([blobData], { type: "application/pdf" });

    if (options?.download) {
      const blobUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Phieu-Bien-Nhan-Ky-Gui-${normalizedOrderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }

    return pdfBlob;
  } catch (error) {
    console.error("GET CONSIGNMENT RECEIPT API ERROR:", error);
    throw new Error(
      error?.response?.data?.message ||
        error?.message ||
        "Không thể lấy phiếu biên nhận ký gửi.",
      { cause: error }
    );
  }
};

export default getConsignmentReceiptApi;
