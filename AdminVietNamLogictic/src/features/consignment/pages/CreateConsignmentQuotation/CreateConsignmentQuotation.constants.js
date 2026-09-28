/* =========================
   DỮ LIỆU TĨNH CỦA TRANG LẬP BÁO GIÁ
   Tách riêng để bảng tra không lẫn với luồng render.
========================= */

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_ORDER,
} from "../../constants/orderStatus";

/* =========================
   TRẠNG THÁI
========================= */

/*
 * Tiêu đề khung khoá màn lập báo giá, theo `requoteState` backend trả
 * (QuotationAcceptanceRules.EvaluateRequote). Trạng thái không có ở đây thì
 * dùng nhãn của getRequoteGuard.
 */
export const REQUOTE_LOCK_TITLES = Object.freeze({
  APPROVED_SENT_TO_CUSTOMER:
    "Báo giá đã được Admin duyệt và gửi khách",
  SENT_TO_CUSTOMER:
    "Báo giá đã gửi khách — đang chờ khách xác nhận",
  ACCEPTED: "Khách đã chấp nhận báo giá",
  ORDER_NOT_QUOTABLE: "Đơn đã qua bước báo giá",
});

/*
 * Mã + nhãn trạng thái đơn lấy từ module dùng chung (constants/orderStatus.js);
 * ở đây chỉ gắn class CSS. Giữ tên export cũ.
 */
const ORDER_STATUS_CLASS_NAMES = {
  PENDING_REVIEW: "is-warning",
  NEED_MORE_INFO: "is-warning",
  REJECTED: "is-danger",
  QUOTATION_SENT: "is-info",
  QUOTATION_REJECTED: "is-danger",
  WAITING_DEPOSIT: "is-warning",
  DEPOSIT_PAID: "is-success",
  APPROVED: "is-info",
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

export const DIM_DECIMAL_PLACES = 4;

/* =========================
   CHỌN KHO THEO TUYẾN
========================= */

export const WAREHOUSE_COUNTRY_KEYWORDS = {
  CN: [
    "CN",
    "CHINA",
    "TRUNG QUOC",
    "QUANG CHAU",
    "GUANGZHOU",
    "SHENZHEN",
  ],
  JP: [
    "JP",
    "JAPAN",
    "NHAT BAN",
    "TOKYO",
    "OSAKA",
  ],
  KR: [
    "KR",
    "KOREA",
    "HAN QUOC",
    "SEOUL",
    "BUSAN",
  ],
  VN: [
    "VN",
    "VIET NAM",
    "VIETNAM",
    "HCM",
    "HA NOI",
  ],
};
