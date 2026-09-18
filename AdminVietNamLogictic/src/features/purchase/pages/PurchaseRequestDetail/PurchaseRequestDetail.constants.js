/*
 * Bảng tra cứu tĩnh của trang chi tiết yêu cầu mua hộ.
 * Tách khỏi file trang để khi thêm/sửa một trạng thái
 * không phải cuộn qua toàn bộ phần JSX.
 */
import {
  PRICING_RULE_CODE,
} from "@features/pricing/api/pricingRuleService.mock";

export const STATUS_CONFIG = {
  DRAFT: {
    label: "Bản nháp",
    className: "is-info",
  },
  QUOTATION_CONFIRMED: {
    label: "Đã xác nhận báo giá",
    className: "is-success",
  },
  NEW: {
    label: "Đặt đơn hàng",
    className: "is-info",
  },
  PENDING_REVIEW: {
    label: "Đặt đơn hàng (Chờ duyệt)",
    className: "is-warning",
  },
  IN_REVIEW: {
    label: "Đặt đơn hàng (Đang duyệt)",
    className: "is-info",
  },
  APPROVED: {
    label: "Đặt đơn hàng (Đã duyệt)",
    className: "is-success",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "is-danger",
  },
  QUOTATION_SENT: {
    label: "Đặt đơn hàng (Đã gửi báo giá)",
    className: "is-info",
  },
  QUOTED: {
    label: "Đặt đơn hàng (Đã báo giá)",
    className: "is-success",
  },
  WAITING_PAYMENT: {
    label: "Đặt đơn hàng (Chờ thanh toán)",
    className: "is-warning",
  },
  WAITING_DEPOSIT: {
    label: "Đặt đơn hàng (Chờ cọc)",
    className: "is-warning",
  },
  DEPOSIT_PAID: {
    label: "Đặt đơn hàng (Đã cọc)",
    className: "is-success",
  },
  PAID: {
    label: "Đặt đơn hàng (Đã thanh toán)",
    className: "is-success",
  },
  PURCHASED: {
    label: "Hàng đang đặt về",
    className: "is-info",
  },
  SELLER_SHIPPED: {
    label: "Hàng đang đặt về (NCC phát)",
    className: "is-info",
  },
  ARRIVED_ORIGIN_WAREHOUSE: {
    label: "Hàng đã về kho",
    className: "is-info",
  },
  WAITING_STORED: {
    label: "Hàng chờ nhập kho",
    className: "is-warning",
  },
  STORED: {
    label: "Hàng đã nhập kho",
    className: "is-success",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "is-info",
  },
  COMPLETED: {
    label: "Hàng đã nhập kho",
    className: "is-success",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "is-danger",
  },
};

/*
 * Các rule kỹ thuật / phí hệ thống
 * không phải dịch vụ khách hàng lựa chọn.
 * Không hiển thị trong khu vực dịch vụ.
 */
export const CREATE_QUOTATION_STATUSES =
  new Set([
    "PENDING_REVIEW",
    "IN_REVIEW",
    "APPROVED",
  ]);

export const HIDDEN_SERVICE_RULE_CODES =
  new Set([
    PRICING_RULE_CODE
      .VOLUMETRIC_DIVISOR,

    PRICING_RULE_CODE
      .DOMESTIC_FEE,
  ]);

export const QUOTATION_STATUS_CONFIG = {
  PENDING_CUSTOMER_CONFIRMATION: {
    label:
      "Chờ khách xác nhận",
    className:
      "is-warning",
  },

  ACCEPTED: {
    label:
      "Đã chấp nhận",
    className:
      "is-success",
  },

  CUSTOMER_CONFIRMED: {
    label:
      "Khách đã xác nhận",
    className:
      "is-success",
  },

  CONFIRMED: {
    label:
      "Đã xác nhận",
    className:
      "is-success",
  },

  REJECTED: {
    label:
      "Đã từ chối",
    className:
      "is-danger",
  },

  EXPIRED: {
    label:
      "Đã hết hạn",
    className:
      "is-default",
  },
};

export const FEE_TYPE_LABELS = {
  SERVICE_FEE:
    "Phí dịch vụ",

  TAX:
    "Thuế",

  WOOD_BOX:
    "Đóng thùng gỗ",

  MAIN_SERVICE:
    "Phí vận chuyển",

  INSPECTION:
    "Kiểm hàng",

  INSURANCE:
    "Bảo hiểm",
};
