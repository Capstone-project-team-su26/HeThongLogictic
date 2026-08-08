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
      getAdminApiError(error, "Không tải được tổng quan dòng tiền.")
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
      getAdminApiError(error, "Không tải được danh sách công nợ.")
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
      )
    );
  }
};

const adminFinanceService = {
  getAdminFinanceSummary,
  getAdminFinanceOrders,
  getAdminFinanceTransactions,
};

export default adminFinanceService;
