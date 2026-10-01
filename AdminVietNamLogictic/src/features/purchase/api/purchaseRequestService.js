/* =========================================================
   purchaseRequestService.js — YÊU CẦU MUA HỘ phía nhân viên (Sale / Admin / Ops).

   PHẦN ĐỌC ĐÃ NỐI API THẬT:
     GET /api/purchase-requests        → getPurchaseRequestsApi  (danh sách, có phân trang/lọc)
     GET /api/purchase-requests/{id}   → getPurchaseRequestDetailApi
     POST /api/purchase-requests/{id}/quotation → createPurchaseRequestQuotationApi
     POST /api/staff/purchase-requests → createPurchaseRequestApi (Sale tạo hộ khách)

   Payload báo giá gửi CẢ trường cũ lẫn trường mới: backend cũ trên production bỏ qua trường
   lạ và vẫn tính như trước, backend mới đọc thêm ship nội địa / đơn giá cước / cân ước tính
   để tách TRẢ TRƯỚC và TẠM TÍNH. Nhờ vậy màn hình chạy được trên cả hai bản, không phải
   chờ deploy mới dùng được.

   CÒN MOCK: không còn hàm nào. Hằng số + hàm chuẩn hoá payload (thuần) nằm ở
   purchaseRequestShared.js; purchaseRequestService.mock.js chỉ còn là bản sao lưu.

   Giữ NGUYÊN bề mặt của bản mock: tên export, thứ tự tham số, hình dạng trả về
   { items, totalCount, pageNumber, pageSize, totalPages } — 10 nơi đang gọi không phải sửa.
   ========================================================= */
import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getPagedData, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";

import { listPurchaseOrders, listPurchaseOrdersOfRequest } from "./purchaseOrderService";
import { buildPurchaseStageContext } from "./purchaseRequestStage";

/* Hằng và hàm thuần dùng chung — module thuần, không phải bản mock. */
export {
  PURCHASE_REQUEST_STATUS,
  PURCHASE_SHIPPING_OPTION,
  normalizeCreatePurchaseRequestPayload,
} from "./purchaseRequestShared";

/* Các thao tác GHI chưa nối được — xem lý do ở đầu file. */
/* Tạo yêu cầu hộ khách — API thật, xem hàm bên dưới. */


/* =========================================================
   HELPER
========================================================= */

const trimText = (value) => String(value ?? "").trim();

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
};

/* =========================================================
   ĐỌC — API THẬT
========================================================= */

/**
 * Danh sách yêu cầu mua hộ.
 *
 * Backend lọc theo vai trò: Sale/Admin thấy tất cả, khách chỉ thấy đơn của mình. FE không
 * gửi customerId trừ khi màn hình đang xem theo một khách cụ thể.
 *
 * @param {{ pageNumber?: number, pageSize?: number, status?: string, search?: string,
 *   searchKeyword?: string, keyword?: string, customerId?: string, route?: string,
 *   shippingOption?: string, fromDate?: string, toDate?: string, signal?: AbortSignal }} filters
 * @returns {Promise<{ items: any[], totalCount: number, pageNumber: number, pageSize: number, totalPages: number }>}
 */
export const getPurchaseRequestsApi = async (filters = {}) => {
  const pageNumber = toPositiveInt(filters?.pageNumber, 1);
  const pageSize = toPositiveInt(filters?.pageSize, 10);

  const searchText =
    trimText(filters?.search ?? filters?.searchKeyword ?? filters?.keyword) || undefined;

  const params = removeEmptyParams({
    pageNumber,
    pageSize,
    status: filters?.status ? trimText(filters.status).toUpperCase() : undefined,
    /* Chặng thật (backend mới lọc được; backend cũ bỏ qua tham số lạ → màn tự lọc lại). */
    stage: filters?.stage ? trimText(filters.stage).toUpperCase() : undefined,
    /* Backend đọc `searchKeyword`; gửi kèm `search` cho bản cũ vẫn hiểu. */
    searchKeyword: searchText,
    search: searchText,
    customerId: trimText(filters?.customerId) || undefined,
    route: trimText(filters?.route) || undefined,
    shippingOption: filters?.shippingOption
      ? trimText(filters.shippingOption).toUpperCase()
      : undefined,
    fromDate: trimText(filters?.fromDate) || undefined,
    toDate: trimText(filters?.toDate) || undefined,
  });

  const response = await httpClient.get(API_ENDPOINTS.purchaseRequests.list, {
    params,
    signal: filters?.signal,
  });

  const page = getPagedData(getResponseData(response), { pageNumber, pageSize });

  return {
    items: page.items,
    totalCount: page.totalCount,
    pageNumber: page.pageNumber,
    pageSize: page.pageSize,
    totalPages: Math.max(1, Math.ceil((page.totalCount || 0) / (page.pageSize || pageSize))),
  };
};

/** Chi tiết một yêu cầu: sản phẩm, báo giá mới nhất, lịch sử trạng thái. */
export const getPurchaseRequestDetailApi = async (purchaseRequestId, options = {}) => {
  const id = trimText(purchaseRequestId);

  if (!id) {
    throw new Error("Thiếu mã yêu cầu mua hộ.");
  }

  const response = await httpClient.get(API_ENDPOINTS.purchaseRequests.detail(id), {
    signal: options?.signal,
  });

  return getResponseData(response);
};

/* =========================================================
   CHẶNG THẬT CỦA YÊU CẦU — dữ liệu đối chiếu
========================================================= */

const WAREHOUSE_ORDER_PAGE_SIZE = 500;

/** Đơn kho mua hộ (ORDERS.OrderType = PURCHASE) — chỉ lấy mã + trạng thái để suy chặng. */
const listPurchaseWarehouseOrders = async ({ searchCode } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.consignments.list, {
    params: removeEmptyParams({
      orderType: "PURCHASE",
      searchCode: trimText(searchCode) || undefined,
      pageNumber: 1,
      pageSize: WAREHOUSE_ORDER_PAGE_SIZE,
    }),
  });

  return getPagedData(getResponseData(response), {
    pageNumber: 1,
    pageSize: WAREHOUSE_ORDER_PAGE_SIZE,
  }).items.map((order) => ({
    orderId: order?.orderId,
    consignmentCode: trimText(order?.consignmentCode),
    status: trimText(order?.status).toUpperCase(),
  }));
};

/**
 * Nạp dữ liệu để suy CHẶNG THẬT của yêu cầu mua hộ (xem purchaseRequestStage.js).
 *
 * Danh sách yêu cầu (`PurchaseRequestListItemDto`) chỉ có `status` của yêu cầu — mã COMPLETED
 * ở đó có thể chỉ là "đã tất toán đợt cuối" đời cũ. Nên đọc thêm đơn mua NCC (kèm
 * `warehouseOrderStatus`, `refunds`) và đơn kho mua hộ. Truyền `purchaseRequestId` +
 * `purchaseCode` thì chỉ đọc cho một yêu cầu (màn chi tiết).
 *
 * Nguồn nào lỗi thì trả `null` cho nguồn đó (không ném) — màn hình vẫn hiện, chặng nào không
 * đối chiếu được sẽ hiện "Chưa đối chiếu được tiến độ" chứ không bao giờ tự nhận hoàn tất.
 *
 * @returns {Promise<ReturnType<typeof buildPurchaseStageContext>>}
 */
export const getPurchaseStageContextApi = async ({ purchaseRequestId, purchaseCode } = {}) => {
  const id = trimText(purchaseRequestId);

  const [purchaseOrders, warehouseOrders] = await Promise.all([
    (id ? listPurchaseOrdersOfRequest(id) : listPurchaseOrders()).catch(() => null),
    listPurchaseWarehouseOrders({ searchCode: id ? purchaseCode : undefined }).catch(() => null),
  ]);

  return buildPurchaseStageContext({ purchaseOrders, warehouseOrders });
};

/* =========================================================
   TẠO YÊU CẦU HỘ KHÁCH — API THẬT
========================================================= */

/**
 * Sale tạo yêu cầu mua hộ thay khách.
 *
 * Backend nhận MỘT trong ba khoá tra khách: `customerId` (chọn từ danh sách),
 * `customerPhone` hoặc `customerEmail`. Thiếu cả ba thì trả 400 kèm câu hướng dẫn —
 * vì vậy màn hình bắt chọn khách trước khi cho gửi.
 *
 * @param {object} payload — như bản cũ, thêm customerId/customerPhone/customerEmail
 */
export const createPurchaseRequestApi = async (payload = {}) => {
  const body = { ...payload };

  const customerId = trimText(body.customerId);
  const customerPhone = trimText(body.customerPhone);
  const customerEmail = trimText(body.customerEmail);

  if (!customerId && !customerPhone && !customerEmail) {
    throw new Error("Vui lòng chọn khách hàng cần tạo yêu cầu mua hộ.");
  }

  /* Chỉ gửi khoá đang dùng: backend xét theo thứ tự id → sđt → email. */
  delete body.customerId;
  delete body.customerPhone;
  delete body.customerEmail;

  const response = await httpClient.post(API_ENDPOINTS.purchaseRequests.staffCreate, {
    ...body,
    ...(customerId
      ? { customerId }
      : customerPhone
        ? { customerPhone }
        : { customerEmail }),
  });

  return getResponseData(response);
};

/* =========================================================
   BÁO GIÁ — API THẬT
========================================================= */

const toMoney = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
};

/* Giá ngoại tệ: giữ 2 chữ số lẻ, không âm. */
const toForeignAmount = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
};

const toOptionalNumber = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Sale phát hành báo giá cho một yêu cầu mua hộ.
 *
 * @param {string} purchaseRequestId
 * @param {{ currency?: string, purchaseFee?: number, shippingFee?: number,
 *   domesticShippingFee?: number, freightRatePerKg?: number, servicePricingId?: string,
 *   estimatedWeight?: number, note?: string,
 *   items?: Array<{ purchaseRequestItemId: string, unitPrice: number }>,
 *   additionalFees?: Array<object> }} payload
 */
export const createPurchaseRequestQuotationApi = async (purchaseRequestId, payload = {}) => {
  const id = trimText(purchaseRequestId);

  if (!id) {
    throw new Error("Thiếu mã yêu cầu mua hộ.");
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!items.length) {
    throw new Error("Báo giá phải có ít nhất một sản phẩm.");
  }

  const currency = trimText(payload?.currency).toUpperCase();
  const isForeignCurrency = Boolean(currency) && currency !== "VND";

  const body = {
    /* Trường cũ — bản backend nào cũng hiểu. */
    purchaseFee: toMoney(payload?.purchaseFee),
    shippingFee: toMoney(payload?.shippingFee),
    ...(trimText(payload?.currency) ? { currency: trimText(payload.currency).toUpperCase() } : {}),
    ...(trimText(payload?.note) ? { note: trimText(payload.note) } : {}),

    /* Trường mới — tách phần TRẢ TRƯỚC và phần TẠM TÍNH thu ở Việt Nam. */
    domesticShippingFee: toMoney(payload?.domesticShippingFee),
    ...(toOptionalNumber(payload?.freightRatePerKg)
      ? { freightRatePerKg: toOptionalNumber(payload.freightRatePerKg) }
      : {}),
    ...(toOptionalNumber(payload?.estimatedWeight)
      ? { estimatedWeight: toOptionalNumber(payload.estimatedWeight) }
      : {}),
    ...(trimText(payload?.servicePricingId)
      ? { servicePricingId: trimText(payload.servicePricingId) }
      : {}),

    /*
     * Có currency ngoại tệ thì unitPrice là GIÁ NGOẠI TỆ (được lẻ, vd 39,9 CNY) — backend tự
     * nhân tỷ giá của nó rồi làm tròn về đồng. Làm tròn về số nguyên ở đây là sai tiền.
     */
    items: items.map((item) => ({
      purchaseRequestItemId: trimText(item?.purchaseRequestItemId || item?.itemId),
      unitPrice: isForeignCurrency ? toForeignAmount(item?.unitPrice) : toMoney(item?.unitPrice),
    })),

    additionalFees: Array.isArray(payload?.additionalFees) ? payload.additionalFees : [],
  };

  const response = await httpClient.post(API_ENDPOINTS.purchaseRequests.quotation(id), body);

  return getResponseData(response);
};

/* =========================================================
   DEFAULT EXPORT — giữ đúng bộ khoá của bản mock
========================================================= */

import { normalizeCreatePurchaseRequestPayload as normalizePayload } from "./purchaseRequestShared";

const purchaseRequestService = {
  normalizeCreatePurchaseRequestPayload: normalizePayload,
  createPurchaseRequestApi,
  getPurchaseRequestsApi,
  getPurchaseRequestDetailApi,
  getPurchaseStageContextApi,
  createPurchaseRequestQuotationApi,
};

export default purchaseRequestService;
