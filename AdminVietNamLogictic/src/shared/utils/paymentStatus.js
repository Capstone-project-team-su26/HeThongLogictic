/**
 * Trạng thái một khoản thanh toán (PAYMENTS / PURCHASE_PAYMENTS) — nhãn tiếng Việt dùng chung.
 *
 * Backend trả: PAID (đời cũ có SUCCESS), PENDING (đã phát hành link cổng thanh toán, chờ webhook),
 * PENDING_RECONCILIATION (khách chọn chuyển khoản tay, chờ Admin đối soát sao kê), CANCELLED,
 * EXPIRED, FAILED, REJECTED (Admin từ chối khoản treo), RECEIVED_UNALLOCATED (tiền về cho đơn
 * đã đóng / khoản đã huỷ — cần hoàn hoặc điều chuyển).
 *
 * `tone` dùng cho class CSS (is-success / is-warning / ...), `color` cho Tag của antd.
 */
const META = {
  PAID: { label: "Đã thanh toán", tone: "success", color: "green" },
  SUCCESS: { label: "Đã thanh toán", tone: "success", color: "green" },
  PENDING: { label: "Chờ thanh toán", tone: "warning", color: "gold" },
  PENDING_RECONCILIATION: { label: "Chờ đối soát", tone: "info", color: "purple" },
  PROCESSING: { label: "Đang xử lý", tone: "info", color: "blue" },
  RECEIVED_UNALLOCATED: { label: "Đã nhận, chưa phân bổ", tone: "warning", color: "orange" },
  CANCELLED: { label: "Đã huỷ", tone: "default", color: "default" },
  EXPIRED: { label: "Hết hạn", tone: "default", color: "default" },
  FAILED: { label: "Thất bại", tone: "danger", color: "red" },
  REJECTED: { label: "Đã từ chối", tone: "danger", color: "red" },
};

export const getPaymentStatusMeta = (status) => {
  const key = String(status ?? "").trim().toUpperCase();
  return META[key] || { label: key || "Chưa xác định", tone: "default", color: "default" };
};

export const isPaymentPaid = (status) => getPaymentStatusMeta(status).tone === "success";

/** Khoản đang treo mà Admin duyệt / từ chối tay được (khớp pending-approval của backend). */
export const isAwaitingManualReview = (status) =>
  ["PENDING", "PENDING_RECONCILIATION"].includes(String(status ?? "").trim().toUpperCase());
