/*
 * Hàng đợi "Đơn hàng cần xử lý" + Sale lập phiếu nhập kho — ĐÃ NỐI API THẬT (đợt 3).
 *
 *   GET  /api/orders/action-queue          (Sale, Admin, OperationsManager)
 *        → { message, data: { items: OrderActionQueueItem[] } }
 *        Mỗi dòng là một việc: { rowKey, orderId, orderCode, orderType, customerName, ...,
 *        handlingGroup, actionState, actionStateText, nextAction, receivingWarehouseId,
 *        receivingWarehouseName, canAct, blockedReason, inboundCode, inboundStatus, ... }
 *        Đơn đã cọc chưa có phiếu: handlingGroup RECEIVING_NOTE, nextAction CREATE_RECEIVING_NOTE.
 *
 *   POST /api/warehouse-receiving-notes    (Sale, Admin)
 *        { consignmentOrderId, warehouseId, warehouseNote }
 *        → 201 { message, receivingNote: Detail }   ← khoá là `receivingNote`, KHÔNG phải `data`
 *        Đơn phải DEPOSIT_PAID, kho ORIGIN đang hoạt động; đã có phiếu mở → 409.
 *
 * Không dùng PUT .../notify-warehouse cho bước này (đó là luồng gửi kho sau tất toán).
 * Các việc chặng cuối (tất toán, giao hàng, báo kho) vẫn ở settlementService (mock) cho
 * tới khi tài liệu luồng sau chuẩn hoá.
 */

import httpClient from "@shared/api/httpClient";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getActionQueueApiError };

export const RECEIVING_NOTE_GROUP = "RECEIVING_NOTE";

const trimText = (value) => String(value ?? "").trim();

/* Mới nhất lên trên: xếp theo mốc chờ (khách trả cọc / hàng về kho) giảm dần. */
const byNewestFirst = (left, right) =>
  new Date(right?.arrivedAt || 0).getTime() - new Date(left?.arrivedAt || 0).getTime();

/** Hàng đợi việc — trả MẢNG TRẦN các dòng việc. */
export const listActionQueue = async () => {
  const response = await httpClient.get("/api/orders/action-queue");

  return getArrayItems(getResponseData(response))
    .map((row) => ({ ...row, rowKey: row?.rowKey || `${row?.orderId}-${row?.handlingGroup}` }))
    .sort(byNewestFirst);
};

/**
 * Sale lập phiếu nhập kho cho đơn đã cọc. Trả bản ghi phiếu (status PENDING_APPROVAL,
 * chờ quản lý kho duyệt).
 *
 * @param {{ orderId: string, warehouseId: string, note?: string }} payload
 */
export const createReceivingNote = async ({ orderId, warehouseId, note } = {}) => {
  const consignmentOrderId = trimText(orderId);
  const warehouse = trimText(warehouseId);

  if (!consignmentOrderId) throw new Error("Không tìm thấy đơn cần lập phiếu.");
  if (!warehouse) {
    throw new Error("Báo giá của đơn chưa chọn kho nhận hàng (ORIGIN), chưa lập được phiếu.");
  }

  const response = await httpClient.post("/api/warehouse-receiving-notes", {
    consignmentOrderId,
    warehouseId: warehouse,
    warehouseNote: trimText(note),
  });

  const body = response?.data ?? {};

  return body?.receivingNote ?? getResponseData(response);
};

export default {
  listActionQueue,
  createReceivingNote,
};
