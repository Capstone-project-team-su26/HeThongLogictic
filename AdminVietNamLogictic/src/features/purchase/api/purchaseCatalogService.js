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

const upperText = (value) => trimText(value).toUpperCase();

/** Số nếu backend có trả, null nếu thiếu (backend cũ) — để nơi gọi biết mà rơi về cách cũ. */
const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

/** Trần số trang đọc liên tiếp — chặn vòng lặp vô hạn nếu backend trả totalCount sai. */
const MAX_PAGES = 20;

/**
 * Một dòng `PurchaseRequestListItemDto` (GET /api/purchase-requests).
 *
 * Backend mới trả sẵn thông tin khách (`customerName`, `customerCode`, `customerPhone` —
 * string|null) và số liệu lập đơn mua (`activePurchaseOrderCount`, `openLineCount`,
 * `openQuantity`, `closedQuantity`, `prepaidAmount`). `receiverName` vẫn là người NHẬN hàng,
 * có thể khác người đặt.
 *
 * Backend CŨ không có các trường đó: `hasCustomerInfo` / `hasLineInfo` = false và các số để
 * null — nơi gọi tự ghép từ danh bạ khách (getCustomerDirectory) và đơn mua của từng yêu cầu
 * như trước.
 */
const normalizeRequestRow = (row = {}) => ({
  ...row,
  purchaseRequestId: row.purchaseRequestId || row.id,
  purchaseCode: trimText(row.purchaseCode),
  customerId: trimText(row.customerId),

  /* null là "có trường nhưng không có giá trị" (backend mới); undefined là backend cũ. */
  hasCustomerInfo: row.customerName !== undefined,
  customerName: trimText(row.customerName),
  customerCode: trimText(row.customerCode),
  customerPhone: trimText(row.customerPhone),

  hasLineInfo: toOptionalNumber(row.openLineCount) !== null,
  activePurchaseOrderCount: toOptionalNumber(row.activePurchaseOrderCount),
  openLineCount: toOptionalNumber(row.openLineCount),
  openQuantity: toOptionalNumber(row.openQuantity),
  closedQuantity: toOptionalNumber(row.closedQuantity),
  /* Tổng khoản trả trước đã thu (PAID): PREPAYMENT + khoản cũ DEPOSIT / FULL_PAYMENT. */
  prepaidAmount: toOptionalNumber(row.prepaidAmount),

  receiverName: trimText(row.receiverName),
  status: upperText(row.status),
  /* Backend đã dịch sẵn nhãn tiếng Việt; "string" là giá trị mẫu của Swagger, bỏ qua. */
  statusDisplayName:
    trimText(row.statusDisplayName) && trimText(row.statusDisplayName) !== "string"
      ? trimText(row.statusDisplayName)
      : "",
  itemCount: toNumber(row.itemCount),
  totalQuantity: toNumber(row.totalQuantity),
  createdAt: row.createdAt || null,
  statusUpdatedAt: row.statusUpdatedAt || null,
});

/**
 * Yêu cầu mua hộ theo trạng thái — đọc HẾT các trang (backend mặc định 10 dòng/trang).
 *
 * Sale lập đơn mua từ yêu cầu ở trạng thái `PAID` (khách đã trả 100% phần trả trước) hoặc
 * `PURCHASING` (đã có đơn mua khác, mua tiếp từ NCC thứ hai).
 */
export const listPurchaseRequests = async ({ status = "", search = "", pageSize = 100 } = {}) => {
  const rows = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const response = await httpClient.get(API_ENDPOINTS.purchaseRequests.list, {
      params: removeEmptyParams({
        status: trimText(status),
        searchKeyword: trimText(search) || undefined,
        pageNumber,
        pageSize,
      }),
    });

    const page = getPagedData(getResponseData(response), { pageNumber, pageSize });

    rows.push(...page.items.map(normalizeRequestRow));

    if (!page.items.length || page.items.length < pageSize || rows.length >= page.totalCount) break;
  }

  return rows;
};

/**
 * Danh bạ khách hàng (GET /api/customers — Admin, Sale) dạng Map `customerId → khách`.
 *
 * DỰ PHÒNG cho backend cũ: khi danh sách yêu cầu mua hộ chỉ có `customerId` (không có
 * `customerName`), một lời gọi này đủ ghép tên + mã + SĐT cho mọi dòng. Backend mới trả sẵn
 * thông tin khách trên từng dòng nên không cần gọi.
 */
export const getCustomerDirectory = async () => {
  const response = await httpClient.get(API_ENDPOINTS.customers.list);
  const directory = new Map();

  getArrayItems(getResponseData(response)).forEach((customer) => {
    const id = trimText(customer?.id ?? customer?.customerId);

    if (!id) return;

    directory.set(id.toLowerCase(), {
      customerId: id,
      fullName: trimText(customer?.fullName ?? customer?.name ?? customer?.customerName),
      customerCode: trimText(customer?.customerCode ?? customer?.code),
      phone: trimText(customer?.phone ?? customer?.phoneNumber),
      email: trimText(customer?.email),
    });
  });

  return directory;
};

/**
 * Chi tiết một yêu cầu — màn đơn mua cần `items[]` để biết mua những gì, số lượng bao nhiêu,
 * và GIÁ ĐÃ BÁO KHÁCH của từng sản phẩm.
 *
 * Giá đã báo KHÔNG nằm trên `items[]` (PurchaseRequestItemResponseDto chỉ có link / tên / SL):
 * nó ở `quotation.items[]` (PurchaseQuotationItemResponseDto: `purchaseRequestItemId`,
 * `unitPrice` đã quy đổi VND). Backend lập đơn mua cũng lấy đúng số này
 * (PurchaseOrderService.ApplyContentAsync: `PurchaseQuotationItem.UnitPrice` của báo giá ACCEPTED),
 * nên ở đây ghép vào từng dòng thành `quotedUnitPrice`. Trước đây FE đọc `item.quotedUnitPrice`
 * — trường không tồn tại — nên cột "Giá đã báo khách" luôn ra 0 ₫.
 */
export const getPurchaseRequestDetail = async (purchaseRequestId) => {
  const id = trimText(purchaseRequestId);

  if (!id) {
    throw new Error("Thiếu mã yêu cầu mua hộ.");
  }

  const detail = getResponseData(await httpClient.get(API_ENDPOINTS.purchaseRequests.detail(id)));

  const quotation = detail?.quotation || null;
  const quotationItems = getArrayItems(quotation?.items);
  const quotedByItem = new Map();

  quotationItems.forEach((row) => {
    const key = trimText(row?.purchaseRequestItemId).toLowerCase();

    /* Backend lấy dòng báo giá ĐẦU TIÊN của mỗi sản phẩm (GroupBy → First) — giữ đúng như vậy. */
    if (key && !quotedByItem.has(key)) {
      quotedByItem.set(key, {
        unitPrice: toNumber(row.unitPrice),
        quantity: toNumber(row.quantity),
      });
    }
  });

  const items = getArrayItems(detail?.items).map((item) => {
    /* Backend trả khoá dòng là `itemId`; các màn khác quen đọc `purchaseRequestItemId`. */
    const purchaseRequestItemId = item.purchaseRequestItemId || item.itemId || item.id;
    const quoted = quotedByItem.get(trimText(purchaseRequestItemId).toLowerCase());
    const ownQuoted = item.quotedUnitPrice == null ? null : toNumber(item.quotedUnitPrice);

    return {
      ...item,
      purchaseRequestItemId,
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      /* null = sản phẩm không có trong báo giá → backend không cho đưa vào đơn mua. */
      quotedUnitPrice: quoted ? quoted.unitPrice : ownQuoted,
      quotedQuantity: quoted ? quoted.quantity : null,
      inQuotation: Boolean(quoted) || ownQuoted !== null,
    };
  });

  return {
    ...detail,
    customerName: trimText(detail?.customerName),
    /*
     * Chi tiết trả báo giá MỚI NHẤT; backend lập đơn dùng báo giá ACCEPTED mới nhất. Yêu cầu đã
     * trả trước thì hai cái trùng nhau — lệch thì màn cảnh báo thay vì hiện giá sai im lặng.
     */
    quotationStatus: upperText(quotation?.status),
    quotationAccepted: upperText(quotation?.status) === "ACCEPTED",
    items,
  };
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
  getCustomerDirectory,
  getPurchaseRequestDetail,
  listSuppliers,
  listActiveWarehouses,
};
