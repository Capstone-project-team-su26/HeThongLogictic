import axiosInstance from "../axiosInstance";
import {
  getAdminApiData,
  getAdminApiError,
} from "./adminService";

/*
 * Admin finance APIs (đã có trên BE):
 * - GET /api/admin/finance/summary
 * - GET /api/admin/finance/orders
 * - GET /api/admin/finance/transactions
 * - GET /api/admin/finance/transactions/pending-approval
 * - PUT /api/admin/finance/transactions/{paymentId}/approve
 * - PUT /api/admin/finance/transactions/{paymentId}/reject
 */

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

export const getAdminFinanceSummary = async (
  { from, to } = {},
  options = {}
) => {
  try {
    const response = await axiosInstance.get(
      "/api/admin/finance/summary",
      {
        params: cleanParams({ from, to }),
        signal: options.signal,
      }
    );
    return normalizeFinanceSummary(getAdminApiData(response));
  } catch (error) {
    throw new Error(
      getAdminApiError(error, "Không tải được tổng quan dòng tiền."),
      { cause: error }
    );
  }
};

export const getAdminFinanceOrders = async (
  filters = {},
  options = {}
) => {
  const params = cleanParams({
    pageNumber: filters?.pageNumber ?? filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 20,
    paymentStatus: filters?.paymentStatus,
    from: filters?.from,
    to: filters?.to,
    search: filters?.search,
  });

  try {
    const response = await axiosInstance.get(
      "/api/admin/finance/orders",
      {
        params,
        signal: options.signal,
      }
    );

    const page = normalizePaged(getAdminApiData(response) ?? {}, params);
    return {
      ...page,
      items: page.items.map(normalizeFinanceOrder),
    };
  } catch (error) {
    throw new Error(
      getAdminApiError(error, "Không tải được danh sách công nợ."),
      { cause: error }
    );
  }
};

export const getAdminFinanceTransactions = async (
  filters = {},
  options = {}
) => {
  const params = cleanParams({
    pageNumber: filters?.pageNumber ?? filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 20,
    from: filters?.from,
    to: filters?.to,
  });

  try {
    const response = await axiosInstance.get(
      "/api/admin/finance/transactions",
      {
        params,
        signal: options.signal,
      }
    );

    const page = normalizePaged(getAdminApiData(response) ?? {}, params);
    return {
      ...page,
      items: page.items.map(normalizeFinanceTransaction),
    };
  } catch (error) {
    throw new Error(
      getAdminApiError(
        error,
        "Không tải được danh sách giao dịch thanh toán."
      ),
      { cause: error }
    );
  }
};

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

/**
 * Khoản tiền đang treo chờ đối soát tay: khách chuyển khoản tay (OFFLINE →
 * PENDING_RECONCILIATION) hoặc đã phát hành link cổng thanh toán mà webhook chưa về (PENDING).
 */
export const getAdminPendingTransactions = async (filters = {}, options = {}) => {
  const params = cleanParams({
    pageNumber: filters?.pageNumber ?? filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 20,
    source: filters?.source,
    search: filters?.search,
  });

  try {
    const response = await axiosInstance.get(
      "/api/admin/finance/transactions/pending-approval",
      {
        params,
        signal: options.signal,
      }
    );

    const page = normalizePaged(getAdminApiData(response) ?? {}, params);
    return {
      ...page,
      items: page.items.map(normalizePendingTransaction),
    };
  } catch (error) {
    throw new Error(
      getAdminApiError(error, "Không tải được danh sách giao dịch chờ duyệt."),
      { cause: error }
    );
  }
};

/** Admin xác nhận đã thấy tiền về trong sao kê. */
export const approveAdminTransaction = async (paymentId, payload = {}) => {
  try {
    const response = await axiosInstance.put(
      `/api/admin/finance/transactions/${paymentId}/approve`,
      {
        transactionCode: payload?.transactionCode ?? null,
        note: payload?.note ?? null,
      }
    );
    return normalizeManualResult(getAdminApiData(response));
  } catch (error) {
    throw new Error(getAdminApiError(error, "Duyệt giao dịch thất bại."), {
      cause: error,
    });
  }
};

/** Admin từ chối khoản treo. Lý do là bắt buộc, BE trả 400 nếu bỏ trống. */
export const rejectAdminTransaction = async (paymentId, reason) => {
  try {
    const response = await axiosInstance.put(
      `/api/admin/finance/transactions/${paymentId}/reject`,
      { reason }
    );
    return normalizeManualResult(getAdminApiData(response));
  } catch (error) {
    throw new Error(getAdminApiError(error, "Từ chối giao dịch thất bại."), {
      cause: error,
    });
  }
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
