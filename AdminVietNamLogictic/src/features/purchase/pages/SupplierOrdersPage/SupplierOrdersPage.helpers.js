/**
 * Hàm thuần của màn Đơn mua nhà cung cấp — tách ra để kiểm thử được bằng máy
 * và để file màn hình chỉ còn phần dựng giao diện.
 */
import { PURCHASE_ORDER_STATUS } from "@features/purchase/api/purchaseOrderService";

export const formatVnd = (value) =>
  `${Math.round(Number(value) || 0).toLocaleString("vi-VN")} ₫`;

export const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/**
 * Chênh lệch giữa giá mua thực và giá đã báo khách, tính ngay trên màn để Sale thấy TRƯỚC
 * khi gửi duyệt — backend tính lại y hệt lúc nhận đơn nên hai bên không lệch nhau.
 *
 * @returns {{ quoted: number, actual: number, diff: number, rate: number, exceeded: boolean }}
 */
export const summarizePriceDifference = (lines = [], toleranceRate = 5) => {
  const quoted = lines.reduce(
    (total, line) => total + (Number(line.quotedUnitPrice) || 0) * (Number(line.quantity) || 0),
    0
  );

  const actual = lines.reduce(
    (total, line) => total + (Number(line.unitPriceVnd) || 0) * (Number(line.quantity) || 0),
    0
  );

  const diff = actual - quoted;

  /* Giá báo bằng 0 (chưa báo giá) thì không có gì để so — coi như chưa vượt. */
  const rate = quoted > 0 ? (diff / quoted) * 100 : 0;

  return { quoted, actual, diff, rate, exceeded: quoted > 0 && rate > toleranceRate };
};

/** Số lượng còn được mua của một dòng: khách đặt trừ đi phần đã nằm trong các đơn mua khác. */
export const getRemainingQuantity = (requestItem, existingOrders = [], currentOrderId = "") => {
  const requested = Number(requestItem?.quantity) || 0;

  const used = existingOrders
    .filter(
      (order) =>
        order.purchaseOrderId !== currentOrderId &&
        order.status !== PURCHASE_ORDER_STATUS.CANCELLED &&
        order.status !== PURCHASE_ORDER_STATUS.REJECTED
    )
    .flatMap((order) => order.items || [])
    .filter((item) => item.purchaseRequestItemId === requestItem?.purchaseRequestItemId)
    .reduce((total, item) => total + (Number(item.quantity) || 0), 0);

  return Math.max(0, requested - used);
};

/**
 * Việc người đang đăng nhập được làm với đơn mua này.
 * Quyền đi theo VAI TRÒ vì backend cũng chặn theo vai trò; màn hình chỉ giấu nút cho đỡ rối.
 */
export const getAvailableActions = (order, role) => {
  const status = String(order?.status ?? "").trim().toUpperCase();
  const isSale = role === "sale";
  const isAdmin = role === "admin";

  return {
    edit: isSale && [PURCHASE_ORDER_STATUS.DRAFT, PURCHASE_ORDER_STATUS.REJECTED].includes(status),
    submit: isSale && [PURCHASE_ORDER_STATUS.DRAFT, PURCHASE_ORDER_STATUS.REJECTED].includes(status),
    decide: isAdmin && status === PURCHASE_ORDER_STATUS.PENDING_APPROVAL,
    place: isSale && status === PURCHASE_ORDER_STATUS.APPROVED,
    progress:
      isSale &&
      [PURCHASE_ORDER_STATUS.ORDERED, PURCHASE_ORDER_STATUS.SUPPLIER_CONFIRMED].includes(status),
    cancel:
      isAdmin &&
      ![
        PURCHASE_ORDER_STATUS.CANCELLED,
        PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED,
      ].includes(status),
  };
};

/** Mốc tiến độ kế tiếp của đơn đã đặt NCC. */
export const getNextProgressStep = (status) => {
  const current = String(status ?? "").trim().toUpperCase();

  if (current === PURCHASE_ORDER_STATUS.ORDERED) {
    return {
      status: PURCHASE_ORDER_STATUS.SUPPLIER_CONFIRMED,
      label: "NCC đã xác nhận đơn",
      needsTracking: false,
    };
  }

  if (current === PURCHASE_ORDER_STATUS.SUPPLIER_CONFIRMED) {
    return {
      status: PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED,
      label: "NCC đã phát hàng",
      needsTracking: true,
    };
  }

  return null;
};
