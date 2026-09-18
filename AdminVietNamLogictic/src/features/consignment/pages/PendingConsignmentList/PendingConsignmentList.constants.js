/*
 * Dữ liệu tĩnh của màn hình danh sách yêu cầu ký gửi.
 *
 * Tách khỏi PendingConsignmentList.jsx vì đây là bảng tra và danh sách
 * option thuần dữ liệu: chúng không đổi theo state, chỉ làm phình file
 * màn hình và che mất phần logic thật sự cần đọc.
 */

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  ORDER_STATUS_ORDER,
} from "../../constants/orderStatus";

/* =========================================================
   PHÂN TRANG & BỘ LỌC
========================================================= */

export const ALL_STATUS = "ALL";
export const DEFAULT_PAGE_SIZE = 10;

/*
 * Mã + nhãn trạng thái đơn lấy từ module dùng chung (constants/orderStatus.js);
 * ở đây chỉ gắn class CSS cho chip. Giữ tên export cũ để helper/màn hình không đổi.
 */
const STATUS_CLASS_NAMES = {
  PENDING_REVIEW: "status-pending-review",
  NEED_MORE_INFO: "status-waiting-deposit",
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

export const STATUS_OPTIONS = [
  {
    value: ALL_STATUS,
    label: "Tất cả trạng thái",
  },
  ...ORDER_STATUS_OPTIONS,
];

/* =========================================================
   TÁCH TÊN SẢN PHẨM
========================================================= */

export const PRODUCT_NAME_SEPARATOR =
  /\r?\n|[,;|•]+|\s+(?:và|and)\s+/giu;
