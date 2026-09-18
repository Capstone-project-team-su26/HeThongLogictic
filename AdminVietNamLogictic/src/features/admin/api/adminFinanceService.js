/*
 * Tài chính Admin — ĐÃ NỐI API THẬT (đợt 3, api-ky-gui-1.md bước 5).
 *
 *   GET /api/admin/finance/summary?from=&to=
 *   GET /api/admin/finance/orders?PageNumber=&PageSize=&PaymentStatus=&From=&To=&Search=
 *   GET /api/admin/finance/transactions?PageNumber=&PageSize=&From=&To=
 *   GET /api/admin/finance/transactions/pending-approval?PageNumber=&PageSize=&Source=&Search=
 *   PUT /api/admin/finance/transactions/{paymentId}/approve
 *       { transactionCode, receivedAmount, note }
 *       - transactionCode đã dùng cho khoản khác → 400
 *       - receivedAmount nhỏ hơn số cần trả → 400 (không xác nhận thiếu)
 *       - paymentStatus RECEIVED_UNALLOCATED: tiền về cho đơn đã đóng / khoản đã huỷ
 *   PUT /api/admin/finance/transactions/{paymentId}/reject  { reason } (bắt buộc)
 *
 * Mọi response bọc { message, data }. Hình dạng trả về giữ như bản mock (bộ normalize
 * dưới đây) để AdminCashFlowPage không đổi cách đọc.
 */

import httpClient from "@shared/api/httpClient";
import { getResponseData } from "@shared/api/apiEnvelope";

const ENDPOINT = "/api/admin/finance";

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
    )
  );

const normalizePaged = (data = {}, fallback = {}) => {
  const items = Array.isArray(data?.items) ? data.items : [];
  const pageNumber =
    toNumber(data?.pageNumber) || toNumber(fallback.pageNumber) || 1;
  const pageSize =
    toNumber(data?.pageSize) || toNumber(fallback.pageSize) || 20;
  const totalCount = toNumber(data?.totalCount) || items.length;

  return {
    items,
    pageNumber,
    pageSize,
    totalCount,
    totalPages:
      toNumber(data?.totalPages) ||
      (totalCount ? Math.ceil(totalCount / pageSize) : 0),
  };
};

const normalizeFinanceSummary = (data = {}) => ({
  totalBillAmount: toNumber(data?.totalBillAmount),
  totalPaid: toNumber(data?.totalPaid),
  remaining: toNumber(data?.remaining),
  orderCount: toNumber(data?.orderCount),
  paidCount: toNumber(data?.paidCount),
  partialCount: toNumber(data?.partialCount),
  unpaidCount: toNumber(data?.unpaidCount),
});

const normalizeFinanceOrder = (item = {}) => ({
  orderId: String(item?.orderId ?? ""),
  consignmentCode: String(item?.consignmentCode ?? ""),
  customerName: String(item?.customerName ?? ""),
  customerCode: String(item?.customerCode ?? ""),
  orderStatus: String(item?.orderStatus ?? ""),
  totalBillAmount: toNumber(item?.totalBillAmount),
  totalPaid: toNumber(item?.totalPaid),
  remaining: toNumber(item?.remaining),
  paymentStatus: String(item?.paymentStatus ?? "").toUpperCase(),
  lastPaidAt: item?.lastPaidAt ?? null,
});

const normalizeFinanceTransaction = (item = {}) => ({
  paymentId: String(item?.paymentId ?? ""),
  orderId: String(item?.orderId ?? ""),
  consignmentCode: String(item?.consignmentCode ?? ""),
  amount: toNumber(item?.amount),
  paymentMethod: String(item?.paymentMethod ?? ""),
  status: String(item?.status ?? "").toUpperCase(),
  paidAt: item?.paidAt ?? null,
});

const normalizePendingTransaction = (item = {}) => ({
  paymentId: String(item?.paymentId ?? ""),
  source: String(item?.source ?? "").toUpperCase(),
  orderId: String(item?.orderId ?? ""),
  consignmentCode: String(item?.consignmentCode ?? ""),
  customerName: String(item?.customerName ?? ""),
  amount: toNumber(item?.amount),
  paymentMethod: String(item?.paymentMethod ?? "").toUpperCase(),
  status: String(item?.status ?? "").toUpperCase(),
  installmentType: String(item?.installmentType ?? "").toUpperCase(),
  orderStatus: String(item?.orderStatus ?? "").toUpperCase(),
  orderCode: item?.orderCode ?? null,
  createdAt: item?.createdAt ?? null,
  waitingDays: toNumber(item?.waitingDays),
});

const normalizeManualResult = (data = {}) => ({
  paymentId: String(data?.paymentId ?? ""),
  source: String(data?.source ?? "").toUpperCase(),
  paymentStatus: String(data?.paymentStatus ?? "").toUpperCase(),
  orderId: String(data?.orderId ?? ""),
  consignmentCode: String(data?.consignmentCode ?? ""),
  orderStatusBefore: String(data?.orderStatusBefore ?? ""),
  orderStatusAfter: String(data?.orderStatusAfter ?? ""),
  amount: toNumber(data?.amount),
  transactionCode: String(data?.transactionCode ?? ""),
  paidAt: data?.paidAt ?? null,
});

const getSignal = (options = {}) => options?.signal;

export const getAdminFinanceSummary = async ({ from, to } = {}, options = {}) => {
  const response = await httpClient.get(`${ENDPOINT}/summary`, {
    params: cleanParams({ from, to }),
    signal: getSignal(options),
  });

  return normalizeFinanceSummary(getResponseData(response));
};

export const getAdminFinanceOrders = async (filters = {}, options = {}) => {
  const params = cleanParams({
    pageNumber: filters?.pageNumber ?? filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 20,
    paymentStatus: filters?.paymentStatus,
    from: filters?.from,
    to: filters?.to,
    search: filters?.search,
  });

  const response = await httpClient.get(`${ENDPOINT}/orders`, {
    params,
    signal: getSignal(options),
  });

  const page = normalizePaged(getResponseData(response), params);

  return {
    ...page,
    items: page.items.map(normalizeFinanceOrder),
  };
};

export const getAdminFinanceTransactions = async (filters = {}, options = {}) => {
  const params = cleanParams({
    pageNumber: filters?.pageNumber ?? filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 20,
    from: filters?.from,
    to: filters?.to,
  });

  const response = await httpClient.get(`${ENDPOINT}/transactions`, {
    params,
    signal: getSignal(options),
  });

  const page = normalizePaged(getResponseData(response), params);

  return {
    ...page,
    items: page.items.map(normalizeFinanceTransaction),
  };
};

/**
 * Khoản tiền đang treo chờ đối soát tay: khách chuyển khoản tay (OFFLINE →
 * PENDING_RECONCILIATION), SePay (production chưa có khoá webhook) hoặc link cổng
 * thanh toán mà webhook chưa về (PENDING).
 */
export const getAdminPendingTransactions = async (filters = {}, options = {}) => {
  const params = cleanParams({
    pageNumber: filters?.pageNumber ?? filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 20,
    source: filters?.source,
    search: filters?.search,
  });

  const response = await httpClient.get(`${ENDPOINT}/transactions/pending-approval`, {
    params,
    signal: getSignal(options),
  });

  const data = getResponseData(response);
  /* Phòng khi server trả mảng trần thay vì khối phân trang. */
  const page = normalizePaged(Array.isArray(data) ? { items: data } : data, params);

  return {
    ...page,
    items: page.items.map(normalizePendingTransaction),
  };
};

/**
 * Admin xác nhận đã thấy tiền về trong sao kê.
 *
 * @param {string} paymentId
 * @param {{ transactionCode?: string, receivedAmount?: number|string, note?: string }} payload
 */
export const approveAdminTransaction = async (paymentId, payload = {}) => {
  const id = String(paymentId ?? "").trim();
  if (!id) throw new Error("Không tìm thấy khoản thanh toán cần duyệt.");

  const rawAmount = payload?.receivedAmount;
  const receivedAmount =
    rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === ""
      ? null
      : Number(rawAmount);

  if (receivedAmount === null || !Number.isFinite(receivedAmount) || receivedAmount <= 0) {
    throw new Error("Nhập số tiền thực nhận (lớn hơn 0) theo sao kê ngân hàng.");
  }

  const transactionCode = String(payload?.transactionCode ?? "").trim();
  const note = String(payload?.note ?? "").trim();

  const response = await httpClient.put(
    `${ENDPOINT}/transactions/${encodeURIComponent(id)}/approve`,
    {
      transactionCode: transactionCode || null,
      receivedAmount,
      note: note || null,
    },
  );

  return normalizeManualResult(getResponseData(response));
};

/** Admin từ chối khoản treo. Lý do là bắt buộc (chặn tại chỗ, BE cũng trả 400). */
export const rejectAdminTransaction = async (paymentId, reason) => {
  const id = String(paymentId ?? "").trim();
  if (!id) throw new Error("Không tìm thấy khoản thanh toán cần từ chối.");

  const cleanReason = String(reason ?? "").trim();
  if (!cleanReason) throw new Error("Phải ghi lý do từ chối.");

  const response = await httpClient.put(
    `${ENDPOINT}/transactions/${encodeURIComponent(id)}/reject`,
    { reason: cleanReason },
  );

  return normalizeManualResult(getResponseData(response));
};

const adminFinanceService = {
  getAdminFinanceSummary,
  getAdminFinanceOrders,
  getAdminFinanceTransactions,
  getAdminPendingTransactions,
  approveAdminTransaction,
  rejectAdminTransaction,
};

export default adminFinanceService;
