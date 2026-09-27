/**
 * Phần "không phải component" của khối TIỀN HOÀN mua hộ (Sale / Admin).
 *
 * Tách khỏi file .jsx vì Vite Fast Refresh chỉ nạp nóng được file CHỈ export component.
 *
 * NGUYÊN TẮC: tiền hoàn là số backend đã chốt (PURCHASE_REFUND_LINES) — ở đây không tính lại đồng
 * nào. Thứ duy nhất được ước tính là SỐ LƯỢNG còn chưa mua, để Sale chọn sản phẩm cho đúng; màn
 * hình ghi rõ đó là ước tính, server mới là bên quyết định.
 */

import { PURCHASE_ORDER_STATUS } from "@features/purchase/api/purchaseOrderService";

const upper = (value) => String(value ?? "").trim().toUpperCase();
const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** Khoản hoàn còn hiệu lực (chờ hoàn / đã hoàn) — khoản đã huỷ không tính vào sổ. */
export const isLiveRefund = (refund) => upper(refund?.status) !== "CANCELLED";

/* Lý do dòng hoàn làm một phần hàng coi như "đã đóng" (khớp CloseUnfulfilledAsync của backend). */
const CLOSING_REASONS = new Set(["UNFULFILLED", "CANCEL_CUSTOMER", "CANCEL_SUPPLIER"]);

/**
 * Ước tính số lượng còn CHƯA vào đơn mua nào của từng sản phẩm, theo đúng cách backend đếm:
 *   khách đặt theo báo giá − SL trong các đơn mua chưa huỷ − SL đã đóng/hoàn (không mua được, huỷ).
 * Backend coi đơn REJECTED / DRAFT vẫn "đang chạy" (chỉ CANCELLED mới không tính), nên ở đây cũng
 * vậy — lệch cách đếm là Sale tưởng còn hàng để đóng trong khi server trả 400.
 *
 * @returns {Map<string, { quoted: number, inOrders: number, closed: number, open: number }>}
 */
export const estimateOpenQuantities = ({ items = [], quotationItems = [], orders = [], refunds = [] } = {}) => {
  const quotedById = new Map();
  (Array.isArray(quotationItems) ? quotationItems : []).forEach((row) => {
    const id = String(row?.purchaseRequestItemId || "");
    if (!id) return;
    quotedById.set(id, (quotedById.get(id) || 0) + toNumber(row?.quantity));
  });

  const inOrdersById = new Map();
  (Array.isArray(orders) ? orders : [])
    .filter((order) => upper(order?.status) !== PURCHASE_ORDER_STATUS.CANCELLED)
    .flatMap((order) => (Array.isArray(order?.items) ? order.items : []))
    .forEach((row) => {
      const id = String(row?.purchaseRequestItemId || "");
      if (!id) return;
      inOrdersById.set(id, (inOrdersById.get(id) || 0) + toNumber(row?.quantity));
    });

  const closedById = new Map();
  (Array.isArray(refunds) ? refunds : [])
    .filter(isLiveRefund)
    .flatMap((refund) => (Array.isArray(refund?.lines) ? refund.lines : []))
    .filter((line) => CLOSING_REASONS.has(upper(line?.reasonCode)))
    .forEach((line) => {
      const id = String(line?.purchaseRequestItemId || "");
      if (!id) return;
      closedById.set(id, (closedById.get(id) || 0) + toNumber(line?.quantity));
    });

  const result = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const id = String(item?.purchaseRequestItemId || item?.itemId || "");
    if (!id) return;
    /* Chưa có dòng báo giá thì lấy SL khách đặt — backend bỏ qua sản phẩm không có trong báo giá. */
    const quoted = quotedById.has(id) ? quotedById.get(id) : toNumber(item?.quantity);
    const inOrders = inOrdersById.get(id) || 0;
    const closed = closedById.get(id) || 0;
    result.set(id, { quoted, inOrders, closed, open: Math.max(0, quoted - inOrders - closed) });
  });

  return result;
};

/** SL NCC đã được ghi giao thiếu trước đó cho (đơn mua, sản phẩm) — để chặn nhập quá phần còn lại. */
export const getRecordedShortage = (refunds = [], purchaseOrderId, purchaseRequestItemId) =>
  (Array.isArray(refunds) ? refunds : [])
    .filter(isLiveRefund)
    .flatMap((refund) => (Array.isArray(refund?.lines) ? refund.lines : []))
    .filter(
      (line) =>
        upper(line?.reasonCode) === "SUPPLIER_SHORT" &&
        String(line?.purchaseOrderId || "") === String(purchaseOrderId || "") &&
        String(line?.purchaseRequestItemId || "") === String(purchaseRequestItemId || "")
    )
    .reduce((sum, line) => sum + toNumber(line?.quantity), 0);

/**
 * Câu giải thích cho dòng "thuế NK" của một khoản hoàn.
 *
 * `importTaxAdjustment` của khoản là tổng các dòng, nhưng chỉ dòng có `importTaxInRefund` mới nằm
 * TRONG số tiền hoàn (đơn kho đã tất toán, khách đã trả thuế). Dòng còn lại chỉ là thuế sẽ KHÔNG
 * thu khi tất toán (dòng TAX_ADJUSTMENT âm) — nói rõ để kế toán không cộng hai lần.
 */
export const describeImportTax = (refund) => {
  const lines = (Array.isArray(refund?.lines) ? refund.lines : []).filter(
    (line) => toNumber(line?.importTaxAdjustment) !== 0
  );
  if (!lines.length) return "";
  const inRefund = lines.filter((line) => line?.importTaxInRefund).length;
  if (inRefund === lines.length) return "đã thu khi tất toán → trả lại trong khoản hoàn này";
  if (inRefund === 0) return "chưa thu → trừ trên hoá đơn khi tất toán, KHÔNG nằm trong số hoàn";
  return "có dòng trả trong khoản hoàn, có dòng trừ khi tất toán — xem từng dòng";
};
