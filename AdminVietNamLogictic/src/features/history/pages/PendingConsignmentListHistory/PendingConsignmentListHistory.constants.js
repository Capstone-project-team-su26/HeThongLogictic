/*
 * Hằng dữ liệu tĩnh của màn hình lịch sử ký gửi.
 * Tách riêng để phần component chỉ còn luồng hiển thị, và để bảng nhãn
 * trạng thái được sửa ở một chỗ duy nhất thay vì lẫn giữa hàng trăm dòng JSX.
 */

import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
} from "@features/consignment";

export const ALL_STATUS = "ALL";
export const DEFAULT_PAGE_SIZE = 10;

/*
 * Mã + nhãn trạng thái đơn lấy từ module dùng chung của feature consignment (qua
 * barrel); ở đây chỉ gắn class CSS cho chip. Giữ tên export cũ.
 */
const STATUS_CLASS_NAMES = {
  PENDING_REVIEW: "status-pending-review",
  NEED_MORE_INFO: "status-pending",
  REJECTED: "status-rejected",
  QUOTATION_SENT: "status-quotation-sent",
  QUOTATION_REJECTED: "status-quotation-rejected",
  WAITING_DEPOSIT: "status-waiting-deposit",
  DEPOSIT_PAID: "status-deposit-paid",
  APPROVED: "status-approved",
  CHECKED_IN: "status-checked-in",
  IN_TRANSIT: "status-in-transit",
  ARRIVED_VN: "status-customs-clearance",
  ARRIVED_DESTINATION: "status-received",
  WAITING_PAYMENT: "status-waiting-deposit",
  PAID: "status-ready-delivery",
  STORED_AT_VN: "status-checked-in",
  DELIVERING: "status-delivering",
  DELIVERED: "status-delivered",
  COMPLETED: "status-completed",
  CANCELLED: "status-cancelled",
};

export const CONSIGNMENT_STATUS_CONFIG = Object.fromEntries(
  ORDER_STATUS_ORDER.map((code) => [
    code,
    {
      label: ORDER_STATUS_LABELS[code],
      className: STATUS_CLASS_NAMES[code] || "status-unknown",
    },
  ])
);

export const DEPOSIT_STATUS_CODES = [
  ORDER_STATUS.WAITING_DEPOSIT,
  ORDER_STATUS.DEPOSIT_PAID,
];

export const DEPOSIT_STATUS_SET =
  new Set(DEPOSIT_STATUS_CODES);

export const STATUS_OPTIONS = [
  {
    value: ALL_STATUS,
    label:
      "Tất cả trạng thái cọc",
  },
  {
    value: "WAITING_DEPOSIT",
    label:
      CONSIGNMENT_STATUS_CONFIG
        .WAITING_DEPOSIT.label,
  },
  {
    value: "DEPOSIT_PAID",
    label:
      CONSIGNMENT_STATUS_CONFIG
        .DEPOSIT_PAID.label,
  },
];

/*
 * Tên sản phẩm từ API có thể gộp nhiều mục trong một chuỗi, phân cách bằng
 * xuống dòng, dấu câu hoặc liên từ, nên cần một mẫu tách dùng chung.
 */
export const PRODUCT_NAME_SEPARATOR =
  /\r?\n|[,;|•]+|\s+(?:và|and)\s+/giu;

/*
 * API phân trang, nhưng màn hình lọc và phân trang phía client nên phải nạp hết;
 * lấy trang lớn để giảm số vòng gọi.
 */
export const FETCH_PAGE_SIZE = 100;
