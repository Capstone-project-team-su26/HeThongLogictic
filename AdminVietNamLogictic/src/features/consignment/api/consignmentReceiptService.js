/**
 * Phiếu nhập kho đơn ký gửi (PDF) — ĐÃ NỐI API THẬT (đợt 3).
 *
 *   GET /api/orders/consignments/{orderId}/receipt   (Admin, Sale, WarehouseStaff,
 *   OperationsManager) → application/pdf
 *
 * Trả Blob PDF; `download: true` thì tự tải file về máy. Lỗi 4xx của request blob có
 * body cũng là Blob → đọc ra `{ message }` để hiện đúng câu backend.
 *
 * Màn còn chạy danh sách đơn mẫu (ConsignmentDocumentsList, consignmentService.mock)
 * import bản sao ./consignmentReceiptService.mock.js.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const triggerBlobDownload = (blob, fileName) => {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(blobUrl);
};

/** Tên file từ header Content-Disposition (nếu server gửi), không thì dựng theo mã đơn. */
const getFileName = (headers, fallback) => {
  const disposition =
    (typeof headers?.get === "function"
      ? headers.get("content-disposition")
      : headers?.["content-disposition"]) || "";

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      /* rơi xuống nhánh dưới */
    }
  }

  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return plainMatch?.[1]?.trim() || fallback;
};

/** Body lỗi của request responseType "blob" là Blob JSON → bóc `message`. */
const readBlobErrorMessage = async (error) => {
  const data = error?.response?.data;

  if (data && typeof data.text === "function") {
    try {
      const parsed = JSON.parse(await data.text());
      if (typeof parsed?.message === "string") return parsed.message;
    } catch {
      /* body không phải JSON */
    }
  }

  if (typeof data?.message === "string") return data.message;

  return "";
};

/**
 * Lấy file PDF phiếu nhập kho của đơn ký gửi.
 *
 * @param {string} orderId - GUID đơn hàng ký gửi
 * @param {{ download?: boolean, signal?: AbortSignal }} [options]
 * @returns {Promise<Blob>} Blob PDF
 */
export const getConsignmentReceiptApi = async (orderId, options = {}) => {
  const id = String(orderId ?? "").trim();

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Không tìm thấy mã ID đơn ký gửi (orderId).");
  }

  try {
    const response = await httpClient.get(API_ENDPOINTS.consignments.receipt(id), {
      responseType: "blob",
      signal: options?.signal,
    });

    const pdfBlob =
      response.data instanceof Blob && response.data.type === "application/pdf"
        ? response.data
        : new Blob([response.data], { type: "application/pdf" });

    if (options?.download) {
      triggerBlobDownload(
        pdfBlob,
        getFileName(response.headers, `Phieu-Nhap-Kho-${id}.pdf`),
      );
    }

    return pdfBlob;
  } catch (error) {
    const backendMessage = await readBlobErrorMessage(error);
    const status = error?.response?.status;

    throw new Error(
      backendMessage ||
        (status === 404
          ? "Đơn này chưa có phiếu nhập kho được duyệt."
          : error?.message || "Không thể lấy phiếu nhập kho."),
      { cause: error },
    );
  }
};

export default getConsignmentReceiptApi;
