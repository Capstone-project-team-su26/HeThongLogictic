/**
 * Loại hàng của một bản ghi (phiếu tiếp nhận, kiện trong phiếu xuất / lô, đơn): server trả
 * `isPurchase` + `orderType` (PURCHASE | CONSIGNMENT) + `purchaseCode` (mã yêu cầu mua hộ).
 */
export const isPurchaseRecord = (record) => {
  if (!record || typeof record !== "object") return false;
  if (typeof record.isPurchase === "boolean") return record.isPurchase;
  if (record.orderType) return String(record.orderType).trim().toUpperCase() === "PURCHASE";
  return Boolean(record.purchaseCode || record.purchaseOrderCode);
};

/** Số kiện mua hộ trong danh sách kiện. */
export const countPurchaseRecords = (records) =>
  (Array.isArray(records) ? records : []).filter(isPurchaseRecord).length;
