/*
 * Chặng cuối của Sale — tất toán, thanh toán, giao hàng, báo kho. ĐÃ NỐI API THẬT
 * (api-hang-ve-viet-nam.md mục C, D; api-ky-gui-1.md "Xem các khoản thanh toán của đơn").
 *
 *   GET  /api/orders/awaiting-settlement               → { message, data: { items } }
 *   GET  /api/orders/{orderId}/settlement-preview      → { message, data: SettlementPreview }
 *        (cước tính lại theo cân đo VN, điều chỉnh +/−, VAT, phí lưu kho, blockers;
 *         mua hộ: importTaxAdjustment ≤ 0 + importTaxAdjustmentNote — thuế NK không thu của phần
 *         hàng không tới tay khách. Chỉ backend mới có, hiện chỉ trên env test.)
 *   POST /api/orders/{orderId}/payments/final          { extraFees, paymentMethod }
 *        Dùng cho CẢ đơn mua hộ: `orderId` trong hàng chờ tất toán của đơn mua hộ chính là đơn kho
 *        PUR. Endpoint riêng `POST /api/purchase-requests/{id}/final-payment` backend ĐÃ BỎ (test
 *        backend kiểm nó trả 404) — gọi vào đó là Sale không chốt được phí cuối đơn mua hộ.
 *   GET  /api/orders/{orderId}/payments                → { message, data: { payments, totalPaid... } }
 *   POST /api/delivery-requests                        { orderId, parcelIds, receiver..., redeliveryFee }
 *   PUT  /api/orders/consignments/{orderId}/notify-warehouse  { note }
 *
 * Hàng đợi "Đơn hàng cần xử lý" + lập phiếu tiếp nhận kho gốc nằm ở actionQueueService.
 *
 * Không gửi số tiền client tự tính: backend tự tính lại cước theo cân đo VN khi phát hành,
 * FE chỉ gửi phụ phí Sale nhập thêm.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getSettlementApiError };

/* Mã vướng của xem trước tất toán (C1) → câu hướng dẫn cho Sale. */
export const SETTLEMENT_BLOCKER_HINTS = Object.freeze({
  PARCEL_NOT_INSPECTED: "Còn kiện chưa về / kho VN chưa cân đo — chờ kho tiếp nhận.",
  OPEN_INCIDENT: "Còn sự cố lúc tiếp nhận chưa xử lý — chờ quản lý kho quyết định.",
  NO_INVOICE: "Đơn chưa chấp nhận báo giá.",
  NO_DEPOSIT: "Khách chưa trả cọc.",
  ALREADY_SETTLED: "Đơn đã tất toán.",
});

const trimText = (value) => String(value ?? "").trim();

const requireId = (value, message) => {
  const id = trimText(value);
  if (!id) throw new Error(message);
  return id;
};

/* Dòng phí phát sinh: bỏ dòng rỗng, số tiền phải > 0 (backend không nhận tiền âm). */
const normalizeExtraFees = (extraFees = []) =>
  (Array.isArray(extraFees) ? extraFees : [])
    .map((fee) => ({
      name: trimText(fee?.name),
      amount: Number(fee?.amount) || 0,
      note: trimText(fee?.note) || null,
    }))
    .filter((fee) => fee.name && fee.amount > 0);

/** Hàng chờ tất toán (ký gửi + mua hộ) — MẢNG TRẦN. */
export const listAwaitingSettlement = async () => {
  const response = await httpClient.get(API_ENDPOINTS.orders.awaitingSettlement);
  return getArrayItems(getResponseData(response));
};

/**
 * Dòng hàng chờ còn là VIỆC CỦA SALE (chưa chốt phí cuối). `pendingPaymentAmount` có giá trị nghĩa
 * là Sale đã chốt, đợt cuối đang chờ KHÁCH trả — không còn nút "Chốt tất toán".
 *
 * MỘT định nghĩa cho cả badge tab "Chờ tất toán" lẫn danh sách: trước đây badge lọc theo điều kiện
 * này còn bảng thì không, nên badge 1 mà bảng 2 dòng, dòng đã chốt vẫn còn nút bấm lại được.
 * Backend mới tự bỏ dòng đã chốt khỏi hàng chờ của nhân viên; lọc ở đây vẫn giữ cho backend cũ.
 */
export const needsSaleSettlement = (row) => Boolean(row) && !(Number(row?.pendingPaymentAmount) > 0);

/** Xem trước tất toán theo cân đo VN — không ghi gì, gọi bao nhiêu lần cũng được. */
export const getSettlementPreview = async (orderId) => {
  const id = requireId(orderId, "Thiếu mã đơn hàng.");
  const response = await httpClient.get(API_ENDPOINTS.orders.settlementPreview(id));
  return getResponseData(response);
};

/**
 * Phát hành đợt thanh toán cuối cho đơn ký gửi. Backend tự thêm dòng FREIGHT_ADJUSTMENT /
 * VAT_ADJUSTMENT theo cân đo VN; response có `freightAdjustmentDelta`, `finalAmount`, `checkoutUrl`.
 */
export const createFinalPayment = async (orderId, extraFees = [], paymentMethod = "") => {
  const id = requireId(orderId, "Thiếu mã đơn hàng.");
  const response = await httpClient.post(API_ENDPOINTS.orders.finalPayment(id), {
    extraFees: normalizeExtraFees(extraFees),
    ...(trimText(paymentMethod) ? { paymentMethod: trimText(paymentMethod) } : {}),
  });
  return getResponseData(response);
};

/**
 * Các khoản thanh toán của đơn → { orderId, consignmentCode, orderStatus, totalBillAmount,
 * totalPaid, remaining, payments[] } (payments có installmentType DEPOSIT / FINAL /
 * STORAGE_FEE / REDELIVERY_FEE, paymentStatus, checkoutUrl...).
 */
export const getOrderPayments = async (orderId) => {
  const id = requireId(orderId, "Thiếu mã đơn hàng.");
  const response = await httpClient.get(API_ENDPOINTS.orders.payments(id));
  const data = getResponseData(response) || {};
  return { ...data, payments: getArrayItems(data?.payments ?? data) };
};

/**
 * Lập yêu cầu giao hàng. `parcelIds` bỏ trống = mọi kiện giao được của đơn.
 * `redeliveryFee` > 0 (chỉ Sale, khi giao lại sau hàng hoàn) → backend phát hành khoản thu
 * REDELIVERY_FEE ngay và trả `redeliveryFeeCheckoutUrl` cho khách trả.
 */
export const createDeliveryRequest = async ({
  orderId,
  parcelIds,
  receiverName,
  receiverPhone,
  addressDetail,
  province,
  district,
  ward,
  scheduledDate,
  note,
  redeliveryFee,
} = {}) => {
  const id = requireId(orderId, "Thiếu mã đơn hàng.");
  const required = { receiverName, receiverPhone, addressDetail, province, district, ward };
  if (Object.values(required).some((value) => !trimText(value))) {
    throw new Error("Điền đủ người nhận, số điện thoại và địa chỉ (tỉnh/quận/phường).");
  }

  const fee = Number(redeliveryFee);

  const response = await httpClient.post(API_ENDPOINTS.deliveryRequests.list, {
    orderId: id,
    parcelIds: Array.isArray(parcelIds) && parcelIds.length ? parcelIds : null,
    receiverName: trimText(receiverName),
    receiverPhone: trimText(receiverPhone),
    addressDetail: trimText(addressDetail),
    province: trimText(province),
    district: trimText(district),
    ward: trimText(ward),
    scheduledDate: scheduledDate || null,
    note: trimText(note) || null,
    redeliveryFee: Number.isFinite(fee) && fee > 0 ? fee : null,
  });

  return getResponseData(response);
};

/** Sale báo kho: đơn có kiện khách gửi lại kho VN, kho vào lập phiếu nhập kho. */
export const notifyWarehouse = async (orderId, note = "") => {
  const id = requireId(orderId, "Thiếu mã đơn hàng.");
  const response = await httpClient.put(API_ENDPOINTS.orders.notifyWarehouse(id), {
    note: trimText(note) || null,
  });
  return getResponseData(response);
};

export default {
  listAwaitingSettlement,
  getSettlementPreview,
  createFinalPayment,
  getOrderPayments,
  createDeliveryRequest,
  notifyWarehouse,
};
