/*
 * Bảng tổng quan theo vai trò — ĐÃ NỐI API THẬT.
 *
 *   GET /api/staff/dashboard       → { message, data: SaleDashboardResponse }       (Sale / OM / Admin)
 *   GET /api/operations/dashboard  → { message, data: OperationsDashboardResponse } (OM / Admin, không có tiền)
 *   GET /api/admin/dashboard       → { message, data: AdminDashboardResponse }      (chỉ Admin)
 *
 * Backend tự đếm và cộng từ bảng gốc (StaffDashboardService); màn hình chỉ vẽ. Không còn
 * kéo danh sách đơn về trình duyệt để tự cộng, không còn tỷ giá / đơn ký gửi mẫu.
 * Mọi mốc ngày/tháng đã được backend quy về giờ Việt Nam (yyyy-MM-dd / yyyy-MM).
 *
 * Bộ normalize bên dưới chỉ lấp giá trị mặc định (số → 0, mảng → []) để component không
 * phải phòng thủ; nó KHÔNG tính lại con số nào.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getResponseData } from "@shared/api/apiEnvelope";

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toText = (value) => (value === null || value === undefined ? "" : String(value));

const toArray = (value, map) => (Array.isArray(value) ? value.map(map) : []);

const normalizeCount = (row = {}) => ({
  key: toText(row?.key),
  label: toText(row?.label || row?.key),
  count: toNumber(row?.count),
  percent: toNumber(row?.percent),
});

/* ───────────────────────────── Sale ───────────────────────────── */

const normalizeSaleDashboard = (data = {}) => ({
  generatedAt: data?.generatedAt ?? null,
  exchangeRates: toArray(data?.exchangeRates, (r) => ({
    currencyCode: toText(r?.currencyCode).toUpperCase(),
    currencyName: toText(r?.currencyName),
    rateToVnd: toNumber(r?.rateToVnd),
    updatedAt: r?.updatedAt ?? null,
  })),
  exchangeRatesUpdatedAt: data?.exchangeRatesUpdatedAt ?? null,
  totalOrders: toNumber(data?.totalOrders),
  consignmentTotal: toNumber(data?.consignmentTotal),
  purchaseTotal: toNumber(data?.purchaseTotal),
  routes: toArray(data?.routes, (r) => ({
    countryCode: toText(r?.countryCode),
    countryName: toText(r?.countryName),
    consignmentCount: toNumber(r?.consignmentCount),
    purchaseCount: toNumber(r?.purchaseCount),
    total: toNumber(r?.total),
    percent: toNumber(r?.percent),
  })),
  statusGroups: toArray(data?.statusGroups, (g) => ({
    ...normalizeCount(g),
    consignmentCount: toNumber(g?.consignmentCount),
    purchaseCount: toNumber(g?.purchaseCount),
    statuses: toArray(g?.statuses, normalizeCount),
  })),
  last7Days: toArray(data?.last7Days, (d) => ({
    date: toText(d?.date),
    consignmentCount: toNumber(d?.consignmentCount),
    purchaseCount: toNumber(d?.purchaseCount),
    total: toNumber(d?.total),
  })),
  workQueue: {
    consignmentsToReview: toNumber(data?.workQueue?.consignmentsToReview),
    purchasesToQuote: toNumber(data?.workQueue?.purchasesToQuote),
    quotationsAwaitingCustomer: toNumber(data?.workQueue?.quotationsAwaitingCustomer),
    purchaseOrdersToPlace: toNumber(data?.workQueue?.purchaseOrdersToPlace),
  },
  recentPurchaseRequests: toArray(data?.recentPurchaseRequests, (r) => ({
    purchaseRequestId: toText(r?.purchaseRequestId),
    purchaseCode: toText(r?.purchaseCode),
    customerName: toText(r?.customerName),
    receiverName: toText(r?.receiverName),
    route: toText(r?.route),
    itemCount: toNumber(r?.itemCount),
    totalQuantity: toNumber(r?.totalQuantity),
    status: toText(r?.status),
    statusText: toText(r?.statusText),
    createdAt: r?.createdAt ?? null,
  })),
  recentConsignments: toArray(data?.recentConsignments, (r) => ({
    orderId: toText(r?.orderId),
    orderCode: toText(r?.consignmentCode),
    customerName: toText(r?.customerName),
    receiverName: toText(r?.receiverName),
    route: toText(r?.route),
    status: toText(r?.status),
    statusText: toText(r?.statusText),
    createdAt: r?.createdAt ?? null,
  })),
});

/** Tổng quan Sale: tỷ giá, tỷ lệ tuyến, trạng thái đơn, xu hướng 7 ngày, việc chờ Sale, đơn mới nhất. */
export const getSaleDashboardApi = async (options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.dashboards.sale, { signal: options?.signal });
  return normalizeSaleDashboard(getResponseData(response) ?? {});
};

/* ───────────────────────────── Vận hành ───────────────────────────── */

const normalizeWarehouseStock = (w = {}) => ({
  warehouseId: toText(w?.warehouseId),
  warehouseName: toText(w?.warehouseName),
  warehouseCode: toText(w?.warehouseCode),
  warehouseType: toText(w?.warehouseType).toUpperCase(),
  region: toText(w?.region),
  storedParcels: toNumber(w?.storedParcels),
  storedWeightKg: toNumber(w?.storedWeightKg),
  activeBins: toNumber(w?.activeBins),
  occupiedBins: toNumber(w?.occupiedBins),
  occupancyPercent: toNumber(w?.occupancyPercent),
});

const normalizeOperationsDashboard = (data = {}) => ({
  generatedAt: data?.generatedAt ?? null,
  warehouses: toArray(data?.warehouses, normalizeWarehouseStock),
  stockTotals: normalizeWarehouseStock(data?.stockTotals ?? {}),
  flow7Days: toArray(data?.flow7Days, (d) => ({
    date: toText(d?.date),
    originInbound: toNumber(d?.originInbound),
    exported: toNumber(d?.exported),
    arrivedVn: toNumber(d?.arrivedVn),
    dispatchedDelivery: toNumber(d?.dispatchedDelivery),
  })),
  shipmentsByStatus: toArray(data?.shipmentsByStatus, normalizeCount),
  shipmentsInProgress: toNumber(data?.shipmentsInProgress),
  incidentsByStatus: toArray(data?.incidentsByStatus, normalizeCount),
  incidentsByType: toArray(data?.incidentsByType, (t) => ({
    type: toText(t?.type),
    label: toText(t?.label || t?.type),
    open: toNumber(t?.open),
    total: toNumber(t?.total),
  })),
  openIncidents: toNumber(data?.openIncidents),
  processingWindowDays: toNumber(data?.processingWindowDays),
  processingTimes: toArray(data?.processingTimes, (p) => ({
    key: toText(p?.key),
    label: toText(p?.label),
    measure: toText(p?.measure),
    averageMinutes: p?.averageMinutes === null || p?.averageMinutes === undefined ? null : toNumber(p.averageMinutes),
    sampleCount: toNumber(p?.sampleCount),
  })),
});

/** Tổng quan vận hành: tồn kho theo kho, luồng kiện 7 ngày, lô, sự cố, thời gian xử lý chứng từ. */
export const getOperationsDashboardApi = async (options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.dashboards.operations, { signal: options?.signal });
  return normalizeOperationsDashboard(getResponseData(response) ?? {});
};

/* ───────────────────────────── Admin ───────────────────────────── */

const normalizeAdminDashboard = (data = {}) => {
  const users = data?.users ?? {};
  const orders = data?.orders ?? {};
  const finance = data?.finance ?? {};

  return {
    generatedAt: data?.generatedAt ?? null,
    users: {
      total: toNumber(users.total),
      active: toNumber(users.active),
      locked: toNumber(users.locked),
      pendingVerification: toNumber(users.pendingVerification),
      newLast30Days: toNumber(users.newLast30Days),
      byRole: toArray(users.byRole, (r) => ({
        key: toText(r?.key),
        label: toText(r?.label || r?.key),
        count: toNumber(r?.count),
        active: toNumber(r?.active),
      })),
    },
    orders: {
      consignmentTotal: toNumber(orders.consignmentTotal),
      purchaseTotal: toNumber(orders.purchaseTotal),
      consignmentInProgress: toNumber(orders.consignmentInProgress),
      purchaseInProgress: toNumber(orders.purchaseInProgress),
      consignmentCompleted: toNumber(orders.consignmentCompleted),
      purchaseCompleted: toNumber(orders.purchaseCompleted),
      consignmentByStatus: toArray(orders.consignmentByStatus, normalizeCount),
      purchaseByStatus: toArray(orders.purchaseByStatus, normalizeCount),
      last6Months: toArray(orders.last6Months, (m) => ({
        month: toText(m?.month),
        consignmentCount: toNumber(m?.consignmentCount),
        purchaseCount: toNumber(m?.purchaseCount),
      })),
    },
    finance: {
      totalBillAmount: toNumber(finance.totalBillAmount),
      totalPaid: toNumber(finance.totalPaid),
      remaining: toNumber(finance.remaining),
      billedOrderCount: toNumber(finance.billedOrderCount),
      paidOrderCount: toNumber(finance.paidOrderCount),
      partialOrderCount: toNumber(finance.partialOrderCount),
      unpaidOrderCount: toNumber(finance.unpaidOrderCount),
      collectedTotal: toNumber(finance.collectedTotal),
      consignmentCollected: toNumber(finance.consignmentCollected),
      purchaseCollected: toNumber(finance.purchaseCollected),
      purchaseRefundPending: toNumber(finance.purchaseRefundPending),
      pendingApprovalCount: toNumber(finance.pendingApprovalCount),
      collectedLast6Months: toArray(finance.collectedLast6Months, (m) => ({
        month: toText(m?.month),
        consignment: toNumber(m?.consignment),
        purchase: toNumber(m?.purchase),
        total: toNumber(m?.total),
      })),
    },
    stock: normalizeWarehouseStock(data?.stock ?? {}),
    warehouses: toArray(data?.warehouses, normalizeWarehouseStock),
    openIncidents: toNumber(data?.openIncidents),
    shipmentsInProgress: toNumber(data?.shipmentsInProgress),
  };
};

/** Tổng quan quản trị: người dùng, đơn, dòng tiền, tồn kho. */
export const getAdminDashboardApi = async (options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.dashboards.admin, { signal: options?.signal });
  return normalizeAdminDashboard(getResponseData(response) ?? {});
};

export default {
  getSaleDashboardApi,
  getOperationsDashboardApi,
  getAdminDashboardApi,
};
