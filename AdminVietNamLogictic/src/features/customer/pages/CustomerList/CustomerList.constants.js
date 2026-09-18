/*
 * Dữ liệu tĩnh của màn hình danh sách khách hàng.
 *
 * Tách khỏi CustomerList.jsx vì đây là bảng tra và danh sách option thuần
 * dữ liệu: chúng không đổi theo state, chỉ làm phình file màn hình và khiến
 * phần logic render bị đẩy xuống quá sâu.
 */

/* =========================
   STATUS CONFIG
========================= */

export const CUSTOMER_STATUS_CONFIG = {
  ACTIVE: {
    label: "Đang hoạt động",
    className: "is-active",
  },
  INACTIVE: {
    label: "Ngừng hoạt động",
    className: "is-inactive",
  },
  BLOCKED: {
    label: "Đã khóa",
    className: "is-blocked",
  },
  PENDING: {
    label: "Chờ kích hoạt",
    className: "is-pending",
  },
  PENDING_VERIFICATION: {
    label: "Chờ xác minh",
    className: "is-pending",
  },
  SUSPENDED: {
    label: "Tạm ngưng",
    className: "is-suspended",
  },
  DELETED: {
    label: "Đã xóa",
    className: "is-deleted",
  },
};

/* =========================
   FILTER OPTIONS
========================= */

export const STATUS_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả trạng thái",
  },
  {
    value: "ACTIVE",
    label: "Đang hoạt động",
  },
  {
    value: "INACTIVE",
    label: "Ngừng hoạt động",
  },
  {
    value: "PENDING",
    label: "Chờ kích hoạt",
  },
  {
    value: "PENDING_VERIFICATION",
    label: "Chờ xác minh",
  },
  {
    value: "BLOCKED",
    label: "Đã khóa",
  },
  {
    value: "SUSPENDED",
    label: "Tạm ngưng",
  },
];
