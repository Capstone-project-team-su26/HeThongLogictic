/*
 * Dữ liệu tĩnh của màn hình chi tiết đơn ký gửi.
 *
 * Tách khỏi ConsignmentDetail.jsx vì đây là bảng tra thuần dữ liệu:
 * chúng không đổi theo state và chỉ làm phình file màn hình.
 */

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
} from "../../constants/orderStatus";

/* =========================
   STATUS CONFIG
========================= */

/*
 * Trạng thái ĐƠN: mã + nhãn lấy từ module dùng chung (constants/orderStatus.js),
 * ở đây chỉ gắn class CSS. QUOTATION_STATUS_CONFIG bên dưới là trạng thái BÁO GIÁ,
 * máy trạng thái riêng, giữ nguyên.
 */
const ORDER_STATUS_CLASS_NAMES = {
  PENDING_REVIEW: "is-warning",
  NEED_MORE_INFO: "is-warning",
  REJECTED: "is-danger",
  QUOTATION_SENT: "is-info",
  QUOTATION_REJECTED: "is-danger",
  WAITING_DEPOSIT: "is-warning",
  DEPOSIT_PAID: "is-success",
  APPROVED: "is-success",
  CHECKED_IN: "is-info",
  IN_TRANSIT: "is-info",
  ARRIVED_VN: "is-info",
  ARRIVED_DESTINATION: "is-info",
  WAITING_PAYMENT: "is-warning",
  PAID: "is-success",
  STORED_AT_VN: "is-info",
  DELIVERING: "is-info",
  DELIVERED: "is-success",
  COMPLETED: "is-success",
  CANCELLED: "is-danger",
};

export const ORDER_STATUS_CONFIG = Object.fromEntries(
  ORDER_STATUS_ORDER.map((code) => [
    code,
    {
      label: ORDER_STATUS_LABELS[code],
      className: ORDER_STATUS_CLASS_NAMES[code] || "is-default",
    },
  ])
);

export const QUOTATION_STATUS_CONFIG = {
  DRAFT: {
    label: "Bản nháp",
    className: "is-draft",
  },
  PENDING: {
    label: "Chờ xác nhận",
    className: "is-warning",
  },
  SENT: {
    label: "Đã gửi",
    className: "is-info",
  },
  ACCEPTED: {
    label: "Đã chấp nhận",
    className: "is-success",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "is-danger",
  },
  EXPIRED: {
    label: "Đã hết hạn",
    className: "is-danger",
  },
};

export const DIM_DECIMAL_PLACES = 4;

/*
 * Bảng nhãn dự phòng cho translateStatusLabel (mã không có trong hai bảng trên):
 * nhãn đơn lấy từ module dùng chung, cộng ba mã chỉ có ở báo giá.
 */
export const STATUS_LABEL_MAP = {
  ...ORDER_STATUS_LABELS,
  DRAFT: "Bản nháp",
  SENT: "Đã gửi",
  EXPIRED: "Đã hết hạn",
};
