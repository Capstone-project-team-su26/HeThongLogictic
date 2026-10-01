/**
 * Trạng thái ĐƠN KÝ GỬI — nguồn duy nhất trong app.
 *
 * 19 mã đích theo `state-machines.md` §1 (spec-consignment-flow) và nhãn tiếng Việt
 * thống nhất. File này có BA BẢN GIỐNG HỆT NHAU ở vcl-customer-ui, vcl-admin-ui và
 * vcl-warehouse-staff-ui (ba repo tách rời, không có workspace chung) — sửa ở đâu
 * thì chép sang hai app kia.
 *
 * Chỉ áp dụng cho trạng thái cấp ĐƠN. Trạng thái báo giá, kiện, WRO, lô, phiếu
 * NK/GRN, giao hàng, hàng hoàn và mua hộ có máy trạng thái riêng, không dùng file này.
 *
 * Mock data phải dùng thẳng mã đích; `normalizeOrderStatus` chỉ là lưới an toàn
 * cho dữ liệu lạ (mã cũ còn sót, dữ liệu nhập tay…).
 */

export const ORDER_STATUS = Object.freeze({
  PENDING_REVIEW: "PENDING_REVIEW",
  NEED_MORE_INFO: "NEED_MORE_INFO",
  REJECTED: "REJECTED",
  QUOTATION_SENT: "QUOTATION_SENT",
  QUOTATION_REJECTED: "QUOTATION_REJECTED",
  WAITING_DEPOSIT: "WAITING_DEPOSIT",
  DEPOSIT_PAID: "DEPOSIT_PAID",
  APPROVED: "APPROVED",
  CHECKED_IN: "CHECKED_IN",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_VN: "ARRIVED_VN",
  ARRIVED_DESTINATION: "ARRIVED_DESTINATION",
  WAITING_PAYMENT: "WAITING_PAYMENT",
  PAID: "PAID",
  STORED_AT_VN: "STORED_AT_VN",
  DELIVERING: "DELIVERING",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
});

/** Thứ tự hiển thị (theo tiến trình đơn; REJECTED/CANCELLED là nhánh kết thúc). */
export const ORDER_STATUS_ORDER = Object.freeze([
  ORDER_STATUS.PENDING_REVIEW,
  ORDER_STATUS.NEED_MORE_INFO,
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.QUOTATION_SENT,
  ORDER_STATUS.QUOTATION_REJECTED,
  ORDER_STATUS.WAITING_DEPOSIT,
  ORDER_STATUS.DEPOSIT_PAID,
  ORDER_STATUS.APPROVED,
  ORDER_STATUS.CHECKED_IN,
  ORDER_STATUS.IN_TRANSIT,
  ORDER_STATUS.ARRIVED_VN,
  ORDER_STATUS.ARRIVED_DESTINATION,
  ORDER_STATUS.WAITING_PAYMENT,
  ORDER_STATUS.PAID,
  ORDER_STATUS.STORED_AT_VN,
  ORDER_STATUS.DELIVERING,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
]);

export const ORDER_STATUS_LABELS = Object.freeze({
  PENDING_REVIEW: "Chờ duyệt",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  REJECTED: "Đã từ chối",
  QUOTATION_SENT: "Đã gửi báo giá",
  QUOTATION_REJECTED: "Khách từ chối báo giá",
  WAITING_DEPOSIT: "Chờ đặt cọc",
  DEPOSIT_PAID: "Đã đặt cọc",
  APPROVED: "Đã xác nhận",
  CHECKED_IN: "Đã nhập kho gốc",
  IN_TRANSIT: "Đang vận chuyển quốc tế",
  ARRIVED_VN: "Đã về Việt Nam",
  ARRIVED_DESTINATION: "Đã tới kho VN",
  WAITING_PAYMENT: "Chờ tất toán",
  PAID: "Đã tất toán",
  STORED_AT_VN: "Đang lưu kho VN",
  DELIVERING: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
});

/**
 * Mã cũ còn trong code/mock → mã đích (bảng chuẩn hóa, state-machines.md §1).
 * Mã mơ hồ STORED / WAITING_STORED / IN_WAREHOUSE về ARRIVED_DESTINATION;
 * DELIVERY_FAILED / RETURNING về DELIVERING (hàng hoàn có máy riêng).
 * Mọi mã bắt đầu bằng CUSTOMS_ về IN_TRANSIT (xử lý trong normalizeOrderStatus).
 */
export const LEGACY_ORDER_STATUS_MAP = Object.freeze({
  PENDING: "PENDING_REVIEW",
  WAITING_QUOTATION: "PENDING_REVIEW",
  ACCEPTED: "PENDING_REVIEW",
  QUOTATION_ACCEPTED: "WAITING_DEPOSIT",
  QUOTATION_CONFIRMED: "WAITING_DEPOSIT",
  CONFIRMED: "WAITING_DEPOSIT",
  PENDING_PAYMENT: "WAITING_PAYMENT",
  WAITING_FINAL_PAYMENT: "WAITING_PAYMENT",
  DEPOSITED: "DEPOSIT_PAID",
  PAYMENT_CONFIRMED: "DEPOSIT_PAID",
  PROCESSING: "APPROVED",
  WAITING_FOR_PARCEL: "APPROVED",
  WAITING_PARCEL: "APPROVED",
  ARRIVED_ORIGIN_WAREHOUSE: "CHECKED_IN",
  WAREHOUSE_RECEIVED: "CHECKED_IN",
  RECEIVED: "CHECKED_IN",
  WAITING_INSPECTION: "CHECKED_IN",
  INSPECTION_COMPLETED: "CHECKED_IN",
  WAITING_PACKING: "CHECKED_IN",
  PACKED: "CHECKED_IN",
  CUSTOMS_CLEARANCE: "IN_TRANSIT",
  WAITING_STORED: "ARRIVED_DESTINATION",
  STORED: "ARRIVED_DESTINATION",
  IN_WAREHOUSE: "ARRIVED_DESTINATION",
  READY_FOR_DELIVERY: "PAID",
  DELIVERY_FAILED: "DELIVERING",
  RETURNING: "DELIVERING",
});

/**
 * Mã backend đang ghi (hoặc còn trong DB) nhưng KHÔNG thuộc 19 mã đích và không có mã đích
 * tương đương để chuẩn hoá mà không mất nghĩa (mất cọc, khách đã xác nhận…). Chỉ dùng cho NHÃN —
 * không vào bộ lọc, không đổi logic. Nhãn bám `OrderService.Queries.cs` của backend.
 */
export const EXTRA_ORDER_STATUS_LABELS = Object.freeze({
  AT_DESTINATION_WAREHOUSE: "Đã lưu kho tại kho đích",
  CUSTOMER_CONFIRMED: "Khách đã xác nhận nhận hàng",
  CANCELLED_FORFEITED: "Huỷ do quá hạn thanh toán, mất cọc",
  CANCELED: "Đã hủy",
  SHIPPED: "Đang vận chuyển quốc tế",
  OUT_FOR_DELIVERY: "Đang giao hàng",
  NEW: "Chờ duyệt",
  PREVIEW: "Bản xem trước",
});

const EMPTY_LABEL = "—";
const UNKNOWN_ORDER_STATUS_LABEL = "Trạng thái khác";

/**
 * Chuẩn hóa một mã trạng thái đơn về mã đích.
 * - null/undefined/chuỗi rỗng → null
 * - mã đích → giữ nguyên
 * - mã cũ → mã đích tương ứng
 * - mã lạ → trả lại nguyên giá trị (đã trim), không throw
 */
export const normalizeOrderStatus = (status) => {
  if (status === null || status === undefined) return null;
  const raw = String(status).trim();
  if (!raw) return null;
  const key = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(ORDER_STATUS_LABELS, key)) return key;
  if (Object.prototype.hasOwnProperty.call(LEGACY_ORDER_STATUS_MAP, key)) {
    return LEGACY_ORDER_STATUS_MAP[key];
  }
  if (key.startsWith("CUSTOMS_")) return ORDER_STATUS.IN_TRANSIT;
  return raw;
};

/**
 * Nhãn tiếng Việt của một mã đơn (mã cũ được chuẩn hóa trước; rỗng → "—").
 * Mã lạ KHÔNG in nguyên mã: ra "Trạng thái khác".
 */
export const getOrderStatusLabel = (status) => {
  const normalized = normalizeOrderStatus(status);
  if (normalized === null) return EMPTY_LABEL;
  const known = ORDER_STATUS_LABELS[normalized] || EXTRA_ORDER_STATUS_LABELS[normalized.toUpperCase()];
  if (known) return known;
  /* Chuỗi toàn ký tự ASCII (mã máy, chữ tiếng Anh) không bao giờ được hiện ra; chữ tiếng Việt
     (dữ liệu nhập tay) thì giữ. File này cố ý không import gì để ba bản chép nạp được độc lập. */
  return /^[\x20-\x7E]+$/.test(normalized) ? UNKNOWN_ORDER_STATUS_LABEL : normalized;
};

/** Danh sách { value, label } theo thứ tự đích, dùng cho filter/select/tab. */
export const ORDER_STATUS_OPTIONS = Object.freeze(
  ORDER_STATUS_ORDER.map((value) =>
    Object.freeze({ value, label: ORDER_STATUS_LABELS[value] }),
  ),
);
