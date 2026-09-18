/**
 * Xác nhận mua hộ & duyệt nhập kho đơn mua hộ.
 *
 * MOCK cho bản CHỈ-GIAO-DIỆN: tầng HTTP đã bị gỡ — không còn axiosInstance, không còn
 * API_ENDPOINTS. Bề mặt public giữ nguyên 100% so với bản thật: hai named export
 * (confirmPurchaseApi, approveStorePurchaseApi) và default export vẫn là confirmPurchaseApi,
 * để ConfirmPurchaseModal, OperationsPurchaseStorePage và cả purchaseRequestService.js
 * (đang re-export approveStorePurchaseApi từ đây) không phải sửa một dòng nào.
 *
 * ĐÂY LÀ HAI HÀM GHI, nên chúng MUTATE thẳng fixture purchaseRequests trong bộ nhớ. Bắt buộc
 * phải vậy: cả hai luồng UI sau khi thành công đều gọi lại API đọc —
 *   - ConfirmPurchaseModal → onSuccess → PurchaseRequestDetail.loadDetail()
 *   - OperationsPurchaseStorePage → loadData({ refresh: true })
 * Nếu mock chỉ trả về object mới mà không sửa fixture thì màn hình tải lại xong sẽ hiện
 * trạng thái CŨ, người dùng thấy đúng như thao tác bị "trôi" mất.
 *
 * VÌ SAO NÉM Error TRẦN CHỨ KHÔNG PHẢI LỖI DẠNG AXIOS: bản thật bọc mọi lỗi lại thành
 * `new Error(getApiErrorMessage(error, fallback))`, tức thứ ném ra khỏi module này vốn đã là
 * Error thường với message tiếng Việt. Hai nơi tiêu thụ đọc theo đúng giả định đó
 * (`err?.message` ở modal, `getOperationsApiError` cũng rơi về `error.message`), nên dựng
 * error.response giả ở đây là làm sai bề mặt cũ.
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm có comment "API thật:" ghi đúng method + endpoint + body cũ.
 * Việc cần làm là khôi phục axiosInstance/API_ENDPOINTS, đổi đoạn đọc-ghi fixture thành lời
 * gọi axios, giữ nguyên phần dựng requestBody và phần bọc lỗi bên dưới.
 */

import { deepClone, delay, nowIso } from "@/mocks/mockUtils";
import {
  findPurchaseRequestById,
} from "@/mocks/data/purchaseRequests";

/* =========================================================
   HELPER
========================================================= */

/** Giữ đúng cách chuẩn hoá của bản thật: chỉ trim, KHÔNG bỏ dấu tiếng Việt. */
const trimmed = (value) => String(value ?? "").trim();

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
 * Tra đơn trong fixture, không thấy thì ném lỗi y như BE trả 404.
 *
 * Trả về CHÍNH tham chiếu trong fixture (không clone) — đây là hàm ghi, cần sửa tại chỗ.
 */
const requirePurchaseRequest = (purchaseRequestId) => {
  const found = findPurchaseRequestById(purchaseRequestId);

  if (!found) {
    throw new Error(
      `Không tìm thấy đơn mua hộ ${trimmed(purchaseRequestId)}.`
    );
  }

  return found;
};

/**
 * Ghi mốc đổi trạng thái.
 *
 * Xoá statusDisplayName là có chủ ý: fixture chỉ khai tay nhãn này cho vài mã mà màn danh sách
 * chưa tự dịch (ví dụ PROCESSING), còn lại để rỗng cho UI tự map từ status. Giữ nhãn cũ sau khi
 * status đã đổi thì chip trạng thái hiện một đằng, dữ liệu một nẻo.
 */
const applyStatus = (request, nextStatus) => {
  request.status = nextStatus;
  request.statusDisplayName = "";
  request.statusUpdatedAt = nowIso();
};

/* =========================================================
   XÁC NHẬN MUA HỘ & CẬP NHẬT TIẾN ĐỘ
========================================================= */

/**
 * API Cập nhật Trạng thái & Bằng chứng Mua hộ.
 *
 * API thật: PUT /api/purchase-requests/{purchaseRequestId}/confirm-purchase
 *           body { status, proofImages, generalNote, warehouseId, destinationWarehouseId,
 *                  warehouseName } → response.data.data ?? response.data → OBJECT đơn mua hộ.
 *
 * ConfirmPurchaseModal đọc `resData?.purchaseCode` để ghép câu toast, rồi đẩy nguyên giá trị
 * này sang onSuccess dưới khoá apiResponse. Vì vậy mock trả về bản sao đơn hàng SAU khi cập
 * nhật — đủ purchaseCode và đủ mọi khoá mà màn chi tiết vốn đọc.
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

  const normalizedId = trimmed(purchaseRequestId);
  const rawStatus = trimmed(payload?.status || "PURCHASED").toUpperCase();

  // Đảm bảo status thuộc mảng hợp lệ của Backend: PENDING_REVIEW, DEPOSIT_PAID, PAID, PURCHASED, SELLER_SHIPPED, ARRIVED_ORIGIN_WAREHOUSE, WAITING_STORED, STORED, COMPLETED
  const targetStatus = VALID_BE_PURCHASE_STATUSES.has(rawStatus)
    ? rawStatus
    : "PURCHASED";

  const requestBody = {
    status: targetStatus,
    proofImages: Array.isArray(payload?.proofImages)
      ? payload.proofImages.map((img) => trimmed(img)).filter(Boolean)
      : [],
    generalNote: trimmed(payload?.generalNote) || "",
    warehouseId: payload?.warehouseId ? trimmed(payload.warehouseId) : null,
    destinationWarehouseId: payload?.destinationWarehouseId
      ? trimmed(payload.destinationWarehouseId)
      : payload?.warehouseId
      ? trimmed(payload.warehouseId)
      : null,
    warehouseName: payload?.warehouseName ? trimmed(payload.warehouseName) : "",
  };

  try {
    await delay();

    const request = requirePurchaseRequest(normalizedId);

    applyStatus(request, requestBody.status);

    /*
     * Ảnh bằng chứng là mảng URL dạng chuỗi (fixture dùng data:image/svg+xml, modal gửi lên
     * img.url) — màn chi tiết map thẳng vào <Image src>. CỘNG DỒN chứ không ghi đè: mỗi lần
     * bấm xác nhận là một bước tiến độ khác, ảnh của bước trước vẫn phải còn trong hồ sơ.
     * Lọc trùng để bấm lại cùng một bước không nhân đôi ảnh.
     */
    if (requestBody.proofImages.length > 0) {
      const existing = Array.isArray(request.proofImages)
        ? request.proofImages
        : [];

      request.proofImages = [
        ...existing,
        ...requestBody.proofImages.filter(
          (url) => !existing.includes(url)
        ),
      ];
    }

    // Ghi chú rỗng nghĩa là Sale không gõ gì thêm, không phải "xoá ghi chú cũ".
    if (requestBody.generalNote) {
      request.generalNote = requestBody.generalNote;
    }

    if (requestBody.warehouseId) {
      request.warehouseId = requestBody.warehouseId;
    }

    /*
     * Kho đích phải cập nhật cả id lẫn TÊN: OperationsPurchaseStorePage tìm kiếm theo
     * warehouseName / destinationWarehouseName / originWarehouseName, và màn chi tiết dò
     * đúng ba khoá đó theo thứ tự. Sửa id mà bỏ tên là bảng vẫn hiện kho cũ.
     */
    if (requestBody.destinationWarehouseId) {
      request.destinationWarehouseId = requestBody.destinationWarehouseId;
    }

    if (requestBody.warehouseName) {
      request.warehouseName = requestBody.warehouseName;
      request.destinationWarehouseName = requestBody.warehouseName;
    }

    return deepClone(request);
  } catch (error) {
    console.error("CONFIRM PURCHASE API ERROR:", error);
    throw new Error(
      error?.message || "Không thể xác nhận mua hộ.",
      { cause: error }
    );
  }
};

/* =========================================================
   OPS/MANAGER DUYỆT KIỂM KÊ NHẬP KHO
========================================================= */

/**
 * Ops/Manager duyệt kiểm kê nhập kho.
 *
 * API thật: POST /api/purchase-requests/{requestId}/approve-store
 *           body { note, warehouseId } → response.data.data ?? response.data → OBJECT.
 * Chỉ khi đơn ở WAITING_STORED hoặc ARRIVED_ORIGIN_WAREHOUSE → STORED.
 *
 * OperationsPurchaseStorePage KHÔNG đọc giá trị trả về (chỉ `await` rồi tự tải lại danh sách),
 * nên bằng chứng thành công nằm ở chỗ khác: fixture đổi sang STORED khiến dòng đó rời khỏi
 * bảng "chờ nhập kho" — trang chỉ giữ lại WAITING_STORED và ARRIVED_ORIGIN_WAREHOUSE. Vẫn trả
 * về bản sao đơn hàng cho khớp bản thật.
 */
export const approveStorePurchaseApi = async (purchaseRequestId, payload = {}) => {
  if (!purchaseRequestId) {
    throw new Error("Không tìm thấy mã ID đơn mua hộ (purchaseRequestId).");
  }

  const normalizedId = trimmed(purchaseRequestId);
  const requestBody = {
    note: trimmed(payload?.note) || null,
    warehouseId: payload?.warehouseId ? trimmed(payload.warehouseId) : null,
  };

  try {
    await delay();

    const request = requirePurchaseRequest(normalizedId);
    const currentStatus = trimmed(request.status).toUpperCase();

    /*
     * Chặn đúng như BE: bấm duyệt hai lần trên cùng một đơn (hoặc mở lại tab cũ) phải nhận
     * thông báo đỏ chứ không âm thầm thành công, vì nhánh catch của trang có sẵn banner lỗi.
     */
    if (
      currentStatus !== "WAITING_STORED" &&
      currentStatus !== "ARRIVED_ORIGIN_WAREHOUSE"
    ) {
      throw new Error(
        `Đơn ${request.purchaseCode} không ở trạng thái chờ nhập kho nên không thể duyệt.`
      );
    }

    applyStatus(request, "STORED");

    if (requestBody.warehouseId) {
      request.warehouseId = requestBody.warehouseId;
    }

    /*
     * Ghi chú kiểm kê chưa có chỗ hiển thị trên UI hiện tại, nhưng vẫn lưu lại: bản thật gửi
     * nó lên BE, và giữ ở đây thì khi màn "lịch sử nhập kho" ra đời không phải sửa lại mock.
     */
    if (requestBody.note) {
      request.storeApprovalNote = requestBody.note;
    }

    request.storedAt = request.statusUpdatedAt;

    return deepClone(request);
  } catch (error) {
    console.error("APPROVE STORE PURCHASE API ERROR:", error);
    throw new Error(
      error?.message || "Không thể duyệt nhập kho đơn mua hộ.",
      { cause: error }
    );
  }
};

export default confirmPurchaseApi;
