/**
 * Dữ liệu tra cứu cho màn ĐƠN MUA NCC — API thật, chỉ đọc.
 *
 * Màn đơn mua cần bốn thứ mà tầng mock của feature này không có: yêu cầu mua hộ đã trả trước,
 * chi tiết sản phẩm của một yêu cầu, danh mục nhà cung cấp và danh sách kho nguồn.
 * Gom vào một file riêng để không lẫn với `purchaseRequestService.js` (đang là mock).
 */
import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getPagedData,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";

const trimText = (value) => String(value ?? "").trim();

const toNumber = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Yêu cầu mua hộ theo trạng thái.
 *
 * Sale lập đơn mua từ yêu cầu ở trạng thái `PAID` (khách đã trả 100% phần trả trước) hoặc
 * `PURCHASING` (đã có đơn mua khác, mua tiếp từ NCC thứ hai).
 */
export const listPurchaseRequests = async ({ status = "", search = "", pageSize = 100 } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.purchaseRequests.list, {
    params: removeEmptyParams({
      status: trimText(status),
      searchKeyword: trimText(search) || undefined,
      pageNumber: 1,
      pageSize,
    }),
  });

  return getPagedData(getResponseData(response), { pageNumber: 1, pageSize }).items;
};

/** Chi tiết một yêu cầu — màn đơn mua cần `items[]` để biết mua những gì, số lượng bao nhiêu. */
export const getPurchaseRequestDetail = async (purchaseRequestId) => {
  const id = trimText(purchaseRequestId);

  if (!id) {
    throw new Error("Thiếu mã yêu cầu mua hộ.");
  }

  const detail = getResponseData(await httpClient.get(API_ENDPOINTS.purchaseRequests.detail(id)));

  const items = getArrayItems(detail?.items).map((item) => ({
    ...item,
    /* Backend trả khoá dòng là `itemId`; các màn khác quen đọc `purchaseRequestItemId`. */
    purchaseRequestItemId: item.purchaseRequestItemId || item.itemId || item.id,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    quotedUnitPrice: item.quotedUnitPrice == null ? null : toNumber(item.quotedUnitPrice),
  }));

  return { ...detail, items };
};

/** Danh mục nhà cung cấp — bắt buộc chọn từ đây, không cho gõ tay tên NCC. */
export const listSuppliers = async () => {
  const response = await httpClient.get("/api/suppliers", {
    params: { pageNumber: 1, pageSize: 200 },
  });

  const payload = getResponseData(response);
  const items = getArrayItems(payload?.items ?? payload);

  return items
    .map((supplier) => ({
      supplierId: supplier.supplierId || supplier.id,
      name: supplier.supplierName || supplier.name || "—",
      contact: [supplier.phone, supplier.email].filter(Boolean).join(" · "),
      country: supplier.country || supplier.countryCode || "",
      status: supplier.status || "",
    }))
    .filter((supplier) => supplier.supplierId);
};

/** Kho nguồn nhận hàng của đơn mua. */
export const listActiveWarehouses = async () => {
  const response = await httpClient.get(API_ENDPOINTS.warehouses.active);

  return getArrayItems(getResponseData(response))
    .map((warehouse) => ({
      warehouseId: warehouse.warehouseId || warehouse.id,
      name: warehouse.warehouseName || warehouse.name || "—",
      regionCode: warehouse.regionCode || warehouse.region || "",
      type: warehouse.warehouseType || "",
    }))
    .filter((warehouse) => warehouse.warehouseId);
};

export default {
  listPurchaseRequests,
  getPurchaseRequestDetail,
  listSuppliers,
  listActiveWarehouses,
};
