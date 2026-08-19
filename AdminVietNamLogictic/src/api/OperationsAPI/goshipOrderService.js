/**
 * Vận đơn GoShip của các phiếu giao đã đặt — `/api/delivery-requests` + `/api/goship/...`.
 *
 * Phiếu giao đi qua ba mốc của mình (`DELIVERY_PENDING → DELIVERY_APPROVED → DELIVERY_DISPATCHED`),
 * rồi đứng yên ở mốc cuối suốt chặng giao. Tiến độ giao thật nằm trên TRẠNG THÁI KIỆN do GoShip
 * trả về, nên màn theo dõi phải đọc kiện chứ không đọc trạng thái phiếu.
 *
 * Sandbox GoShip giữ mọi đơn ở "Đơn mới" và không bắn webhook, nên có thêm đường đặt tay trạng
 * thái để chạy thử hết luồng — cùng logic mà webhook thật đi qua.
 */

import axiosInstance from "../axiosInstance";
import { getAdminApiData, getAdminApiError } from "../AdminAPI/adminService";

export { getAdminApiError as getGoshipApiError };

/** Mã trạng thái GoShip và trạng thái kiện tương ứng bên mình. */
export const GOSHIP_STATUS_STEPS = Object.freeze([
  { code: 901, label: "Chờ lấy hàng", packageStatus: "AWAITING_PICKUP", tone: "default" },
  { code: 902, label: "Đang lấy hàng", packageStatus: "PICKING_UP", tone: "processing" },
  { code: 903, label: "Đã lấy hàng", packageStatus: "PICKED_UP", tone: "processing" },
  { code: 919, label: "Đang vận chuyển", packageStatus: "IN_TRANSIT", tone: "processing" },
  { code: 904, label: "Đang giao", packageStatus: "OUT_FOR_DELIVERY", tone: "processing" },
  { code: 905, label: "Giao thành công", packageStatus: "DELIVERED", tone: "success" },
  { code: 906, label: "Giao thất bại", packageStatus: "DELIVERY_FAILED", tone: "error" },
  { code: 907, label: "Đang chuyển hoàn", packageStatus: "RETURNING", tone: "warning" },
  { code: 908, label: "Đã chuyển hoàn", packageStatus: "RETURNED", tone: "warning" },
  { code: 914, label: "Đơn huỷ", packageStatus: "DELIVERY_CANCELLED", tone: "error" },
]);

/** Nhãn tiếng Việt cho trạng thái kiện mà GoShip đẩy về. */
export const PACKAGE_STATUS_META = Object.freeze({
  AWAITING_PICKUP: { label: "Chờ hãng lấy hàng", tone: "default" },
  PICKING_UP: { label: "Hãng đang tới lấy", tone: "processing" },
  PICKED_UP: { label: "Hãng đã lấy hàng", tone: "processing" },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "processing" },
  AT_CARRIER_WAREHOUSE: { label: "Đang ở kho hãng", tone: "processing" },
  OUT_FOR_DELIVERY: { label: "Đang giao tới khách", tone: "processing" },
  DELIVERED: { label: "Đã giao xong", tone: "success" },
  DELIVERY_FAILED: { label: "Giao thất bại", tone: "error" },
  RETURNING: { label: "Đang chuyển hoàn", tone: "warning" },
  RETURNED: { label: "Đã chuyển hoàn", tone: "warning" },
  LOST: { label: "Thất lạc", tone: "error" },
  DELIVERY_CANCELLED: { label: "Đã huỷ giao", tone: "error" },
  DELIVERY_ERROR: { label: "Đơn lỗi", tone: "error" },
  DELIVERY_DELAYED: { label: "Chậm lấy/giao", tone: "warning" },
  PARTIALLY_DELIVERED: { label: "Giao một phần", tone: "warning" },
});

export const getPackageStatusMeta = (status) =>
  PACKAGE_STATUS_META[String(status || "").toUpperCase()] || {
    label: status || "—",
    tone: "default",
  };

/**
 * Phiếu giao đã đặt vận đơn. Lọc theo `DELIVERY_DISPATCHED` vì chỉ những phiếu đó mới có mã vận
 * đơn để theo dõi; phiếu chờ duyệt hay mới duyệt chưa có gì bên GoShip.
 */
export async function getGoshipOrders() {
  const response = await axiosInstance.get("/api/delivery-requests", {
    params: { status: "DELIVERY_DISPATCHED" },
  });
  const data = getAdminApiData(response);
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  return items.filter((item) => item.carrierTrackingCode);
}

/** Hỏi GoShip trạng thái mới nhất rồi ghi lại vào hệ thống. */
export async function syncGoshipShipment(trackingCode) {
  const response = await axiosInstance.post(
    `/api/goship/shipments/${encodeURIComponent(trackingCode)}/sync`,
  );
  return getAdminApiData(response);
}

/**
 * Đặt tay trạng thái vận đơn để chạy thử luồng giao.
 *
 * Máy chủ khoá đường này ở môi trường thật — ở đó trạng thái phải do hãng vận chuyển quyết.
 */
export async function simulateGoshipStatus(trackingCode, statusCode, statusText) {
  const response = await axiosInstance.post(
    `/api/goship/shipments/${encodeURIComponent(trackingCode)}/simulate`,
    { statusCode, statusText },
  );
  return getAdminApiData(response);
}
