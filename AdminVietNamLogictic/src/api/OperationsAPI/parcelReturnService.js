/**
 * Hàng giao không thành công và quay về kho.
 *
 * Hồ sơ do webhook hãng vận chuyển tự mở khi báo giao hỏng / chuyển hoàn / thất lạc. Nhân viên
 * chỉ chạm vào hai bước: kho xác nhận đã cầm được hàng, rồi OM chốt hướng xử lý tiếp.
 *
 * Tách khỏi destinationApprovalService vì đó là hai cửa duyệt lúc hàng ĐANG về; hồ sơ hàng hoàn
 * mở ra sau khi đã giao hỏng, vòng đời khác hẳn.
 */

import axiosInstance from "../axiosInstance";
import { getAdminApiData, getAdminApiError } from "../AdminAPI/adminService";

export { getAdminApiError as getParcelReturnApiError };

const ENDPOINT = "/api/parcel-returns";

/* ====================== Trạng thái & nhãn ====================== */

export const RETURN_STATUS_META = Object.freeze({
  PENDING_RETURN: { label: "Chờ hàng quay về", tone: "warning" },
  IN_TRANSIT_BACK: { label: "Đang về kho", tone: "processing" },
  RECEIVED_AT_WAREHOUSE: { label: "Đã về kho, chờ quyết định", tone: "gold" },
  RESOLVED: { label: "Đã chốt xử lý", tone: "success" },
  LOST: { label: "Hàng thất lạc", tone: "error" },
});

export const RETURN_REASON_META = Object.freeze({
  FAILED_DELIVERY: { label: "Giao không thành công", tone: "warning" },
  RETURNING: { label: "Hãng đang chuyển hoàn", tone: "processing" },
  LOST: { label: "Hãng báo thất lạc", tone: "error" },
  CANCELLED: { label: "Đơn giao bị huỷ", tone: "default" },
});

/**
 * Bốn hướng xử lý OM được chọn. Kèm mô tả để màn hình nói rõ hệ quả từng lựa chọn —
 * đây là quyết định động tới tiền nên không để người duyệt phải đoán.
 */
export const RESOLUTION_OPTIONS = Object.freeze([
  {
    value: "REDELIVER",
    label: "Giao lại cho khách",
    hint: "Kiện quay về diện sẵn sàng xuất kho, Sale lập được phiếu giao mới. Phải chọn ai chịu cước.",
  },
  {
    value: "CUSTOMER_PICKUP",
    label: "Khách tự đến kho lấy",
    hint: "Kiện giữ ở kho chờ khách. Phí lưu kho vẫn chạy trừ khi tick miễn.",
  },
  {
    value: "DISPOSE",
    label: "Thanh lý",
    hint: "Dùng khi hàng hỏng hoặc khách bỏ. Kiện đóng lại, không giao nữa.",
  },
  {
    value: "COMPENSATE",
    label: "Bồi thường cho khách",
    hint: "Dùng khi hàng thất lạc. Bộ phận tài chính xử lý khoản đền bù ngoài hệ thống.",
  },
]);

export const FEE_BEARER_OPTIONS = Object.freeze([
  { value: "CUSTOMER", label: "Khách hàng chịu cước giao lại" },
  { value: "COMPANY", label: "Công ty chịu cước giao lại" },
]);

export const getReturnStatusMeta = (status) =>
  RETURN_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", tone: "default" };

export const getReturnReasonMeta = (reason) =>
  RETURN_REASON_META[String(reason || "").toUpperCase()] || { label: reason || "—", tone: "default" };

/* ====================== Gọi API ====================== */

/**
 * BE trả về { summary, items } nên không dùng getAdminApiList (cái đó chỉ bóc mảng).
 * Luôn trả đủ hai phần để component khỏi phải phòng thủ null.
 */
const emptyList = () => ({
  summary: { total: 0, awaitingReturn: 0, awaitingDecision: 0, lost: 0, overdue: 0 },
  items: [],
});

export const listParcelReturns = async ({ status = "", warehouseId = "" } = {}) => {
  const params = {};
  if (status && status !== "ALL") params.status = status;
  if (warehouseId) params.warehouseId = warehouseId;

  const response = await axiosInstance.get(ENDPOINT, { params });
  const data = getAdminApiData(response);

  if (!data) return emptyList();

  return {
    summary: { ...emptyList().summary, ...(data.summary || {}) },
    items: Array.isArray(data.items) ? data.items : [],
  };
};

export const getParcelReturnDetail = async (returnId) => {
  if (!returnId) throw new Error("Thiếu mã hồ sơ hàng hoàn.");
  const response = await axiosInstance.get(`${ENDPOINT}/${encodeURIComponent(returnId)}`);
  return getAdminApiData(response);
};

export const receiveParcelReturn = async (returnId, { binId = null, note = "" } = {}) => {
  const response = await axiosInstance.put(
    `${ENDPOINT}/${encodeURIComponent(returnId)}/receive`,
    { binId: binId || null, note: String(note || "").trim() || null },
  );
  return getAdminApiData(response);
};

export const resolveParcelReturn = async (
  returnId,
  { resolution, feeBearer = null, waiveStorageFee = false, resolutionNote = "" } = {},
) => {
  // Hai điều kiện BE bắt buộc — chặn tại đây để người duyệt khỏi mất một vòng gọi mới biết.
  if (!resolution) throw new Error("Vui lòng chọn hướng xử lý.");
  if (!String(resolutionNote || "").trim()) {
    throw new Error("Vui lòng nhập lý do chốt hướng xử lý.");
  }
  if (resolution === "REDELIVER" && !feeBearer) {
    throw new Error("Giao lại thì phải chọn ai chịu cước.");
  }

  const response = await axiosInstance.put(
    `${ENDPOINT}/${encodeURIComponent(returnId)}/resolve`,
    {
      resolution,
      feeBearer: resolution === "REDELIVER" ? feeBearer : null,
      waiveStorageFee: Boolean(waiveStorageFee),
      resolutionNote: String(resolutionNote).trim(),
    },
  );
  return getAdminApiData(response);
};

/** Hồ sơ hàng hoàn của một đơn — dùng ở màn chi tiết đơn của Sale. */
export const listParcelReturnsByOrder = async (orderId) => {
  if (!orderId) return emptyList();

  const response = await axiosInstance.get(
    `/api/orders/${encodeURIComponent(orderId)}/parcel-returns`,
  );
  const data = getAdminApiData(response);

  if (!data) return emptyList();

  return {
    summary: { ...emptyList().summary, ...(data.summary || {}) },
    items: Array.isArray(data.items) ? data.items : [],
  };
};

export default {
  listParcelReturns,
  getParcelReturnDetail,
  receiveParcelReturn,
  resolveParcelReturn,
  listParcelReturnsByOrder,
  getReturnStatusMeta,
  getReturnReasonMeta,
};
