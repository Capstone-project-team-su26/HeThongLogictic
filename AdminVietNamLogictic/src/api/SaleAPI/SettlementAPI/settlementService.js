/**
 * Chặng cuối của Sale: chốt tiền với khách rồi cho hàng rời kho.
 *
 * Hai hàng đợi lấy từ BE chứ không lọc theo trạng thái đơn ở FE — trạng thái đơn không nói được
 * "kho đã kiểm xong chưa" hay "khách trả nốt chưa", mà đó mới là thứ quyết định việc của Sale.
 */

import axiosInstance from "../../axiosInstance";
import { getAdminApiData, getAdminApiError } from "../../AdminAPI/adminService";

export { getAdminApiError as getSettlementApiError };

const AWAITING_ENDPOINT = "/api/orders/awaiting-settlement";
const ACTION_QUEUE_ENDPOINT = "/api/orders/action-queue";

const toItems = (data) => (Array.isArray(data?.items) ? data.items : []);

/** Đơn kho đã kiểm xong, đang chờ Sale chốt phí cuối để khách tất toán. */
export const listAwaitingSettlement = async () => {
  const response = await axiosInstance.get(AWAITING_ENDPOINT);
  return toItems(getAdminApiData(response));
};

/**
 * Hàng đợi "Đơn hàng cần xử lý": MỖI DÒNG LÀ MỘT VIỆC, không phải một đơn.
 *
 * Đơn vừa có kiện giao thẳng vừa có kiện gửi lại kho sẽ ra hai dòng — hai nút khác nhau, hai
 * người xử lý tiếp khác nhau. Server đã tách sẵn kèm `rowKey`, FE không tự ghép.
 */
export const listActionQueue = async () => {
  const response = await axiosInstance.get(ACTION_QUEUE_ENDPOINT);
  return toItems(getAdminApiData(response));
};

/**
 * Chốt phí cuối và phát hành mã thanh toán cho khách.
 * @param {string} orderId
 * @param {Array<{name: string, amount: number, note?: string}>} extraFees phí phát sinh
 */
export const createFinalPayment = async (orderId, extraFees = []) => {
  const response = await axiosInstance.post(`/api/orders/${orderId}/payments/final`, {
    extraFees: extraFees.map((fee) => ({
      name: String(fee.name || "").trim(),
      amount: Number(fee.amount) || 0,
      note: fee.note ? String(fee.note).trim() : null,
    })),
    paymentMethod: "SEPAY",
  });

  return getAdminApiData(response);
};

/** Bản tương ứng cho đơn mua hộ — bộ bảng tiền của mua hộ nằm riêng nên endpoint cũng riêng. */
export const createPurchaseFinalPayment = async (purchaseRequestId, extraFees = []) => {
  const response = await axiosInstance.post(
    `/api/purchase-requests/${purchaseRequestId}/final-payment`,
    {
      extraFees: extraFees.map((fee) => ({
        name: String(fee.name || "").trim(),
        amount: Number(fee.amount) || 0,
        note: fee.note ? String(fee.note).trim() : null,
      })),
      paymentMethod: "SEPAY",
    },
  );

  return getAdminApiData(response);
};

/** Các đợt thanh toán của đơn, để Sale biết khách đã trả tới đâu. */
export const getOrderPayments = async (orderId) => {
  const response = await axiosInstance.get(`/api/orders/${orderId}/payments`);
  const data = getAdminApiData(response);
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.payments) ? data.payments : toItems(data);
};

/** Sale lập yêu cầu xuất kho; OM duyệt xong kho mới đi lấy hàng. */
export const createDeliveryRequest = async (payload) => {
  const response = await axiosInstance.post("/api/delivery-requests", {
    orderId: payload.orderId,
    receiverName: payload.receiverName,
    receiverPhone: payload.receiverPhone,
    addressDetail: payload.addressDetail,
    province: payload.province,
    district: payload.district,
    ward: payload.ward,
    note: payload.note || null,
  });

  return getAdminApiData(response);
};

/** Sale báo cho kho vào lập phiếu nhập kho. Chỉ bấm được sau khi khách tất toán. */
export const notifyWarehouse = async (orderId, note) => {
  const response = await axiosInstance.put(
    `/api/orders/consignments/${orderId}/notify-warehouse`,
    { note: note ? String(note).trim() : null },
  );

  return getAdminApiData(response);
};

/**
 * Sale lập phiếu tiếp nhận cho kho gốc, sau khi khách trả cọc.
 *
 * Đây là việc ĐẦU chặng, không phải chặng cuối như mấy hàm trên: lúc này hàng còn chưa tới kho,
 * đơn chưa có kiện nào. Kiện chỉ sinh ra khi kho quét phiếu này rồi bấm xác nhận nhận hàng.
 */
export const createReceivingNote = async ({ orderId, warehouseId, note }) => {
  const response = await axiosInstance.post("/api/warehouse-receiving-notes", {
    consignmentOrderId: orderId,
    warehouseId,
    warehouseNote: note ? String(note).trim() : "",
  });

  return getAdminApiData(response);
};

export default {
  listAwaitingSettlement,
  listActionQueue,
  createFinalPayment,
  createPurchaseFinalPayment,
  getOrderPayments,
  createDeliveryRequest,
  notifyWarehouse,
  createReceivingNote,
};
