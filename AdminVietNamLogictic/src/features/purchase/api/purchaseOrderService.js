/**
 * ĐƠN MUA NHÀ CUNG CẤP — API THẬT của luồng mua hộ chuẩn.
 *
 * Đây là tầng gọi API duy nhất chạy thật của mua hộ. Các file cũ trong feature này
 * (`purchaseRequestService.js`, `confirmPurchaseApi.js`) vẫn là mock cho bản chỉ-giao-diện;
 * màn mới không đụng tới chúng để khỏi kéo theo dữ liệu giả.
 *
 * Vòng đời một đơn mua (bám đúng backend `PurchaseOrderStatuses`):
 *
 *   DRAFT ──gửi duyệt──▶ PENDING_APPROVAL ──Admin duyệt──▶ APPROVED ──đặt NCC──▶ ORDERED
 *     │                        │                                                   │
 *     │                     REJECTED (sửa rồi gửi lại)                 SUPPLIER_CONFIRMED
 *     │                                                                            │
 *     └─giá thực vượt ngưỡng─▶ AWAITING_CUSTOMER ─khách đồng ý─▶ AWAITING_CUSTOMER_PAYMENT
 *                                                                 (khách trả xong mới gửi duyệt được)
 *                                                                            ▼
 *                                                                   SUPPLIER_SHIPPED
 *
 * Đặt NCC xong backend tự sinh ĐƠN KHO `PUR-xxx-n` + PHIẾU TIẾP NHẬN đã duyệt cho kho nguồn,
 * nên màn hình không phải tạo gì thêm — chỉ hiển thị mã đơn kho trả về.
 */
import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";

/* =========================================================
   TRẠNG THÁI
========================================================= */

export const PURCHASE_ORDER_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  AWAITING_CUSTOMER: "AWAITING_CUSTOMER",
  AWAITING_CUSTOMER_PAYMENT: "AWAITING_CUSTOMER_PAYMENT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  ORDERED: "ORDERED",
  SUPPLIER_CONFIRMED: "SUPPLIER_CONFIRMED",
  SUPPLIER_SHIPPED: "SUPPLIER_SHIPPED",
  CANCELLED: "CANCELLED",
});

/**
 * Nhãn + màu cho từng trạng thái. `tone` dùng thẳng cho `color` của Tag (antd).
 * Câu mô tả trả lời đúng một câu hỏi: "giờ đang chờ AI làm gì".
 */
export const PURCHASE_ORDER_STATUS_META = Object.freeze({
  DRAFT: { label: "Nháp", tone: "default", waiting: "Sale hoàn thiện rồi gửi duyệt" },
  AWAITING_CUSTOMER: {
    label: "Chờ khách duyệt chênh giá",
    tone: "gold",
    waiting: "Khách xem phần chênh và quyết định",
  },
  AWAITING_CUSTOMER_PAYMENT: {
    label: "Chờ khách trả chênh",
    tone: "gold",
    waiting: "Khách trả phần chênh giá",
  },
  PENDING_APPROVAL: { label: "Chờ Admin duyệt", tone: "processing", waiting: "Admin duyệt ngân sách" },
  APPROVED: { label: "Đã duyệt ngân sách", tone: "cyan", waiting: "Sale đặt hàng nhà cung cấp" },
  REJECTED: { label: "Bị từ chối", tone: "error", waiting: "Sale sửa lại rồi gửi duyệt lần nữa" },
  ORDERED: { label: "Đã đặt NCC", tone: "blue", waiting: "Nhà cung cấp xác nhận đơn" },
  SUPPLIER_CONFIRMED: { label: "NCC đã xác nhận", tone: "geekblue", waiting: "Nhà cung cấp phát hàng" },
  SUPPLIER_SHIPPED: { label: "NCC đã phát hàng", tone: "green", waiting: "Hàng về kho nguồn, kho quét phiếu" },
  CANCELLED: { label: "Đã huỷ", tone: "default", waiting: "—" },
});

export const getPurchaseOrderStatusMeta = (status) =>
  PURCHASE_ORDER_STATUS_META[String(status ?? "").trim().toUpperCase()] || {
    label: status || "—",
    tone: "default",
    waiting: "—",
  };

/** Sale còn sửa được nội dung đơn. */
export const isEditablePurchaseOrder = (status) =>
  [PURCHASE_ORDER_STATUS.DRAFT, PURCHASE_ORDER_STATUS.REJECTED].includes(
    String(status ?? "").trim().toUpperCase()
  );

/* =========================================================
   HELPER
========================================================= */

const trimText = (value) => String(value ?? "").trim();

const requireId = (value, message) => {
  const id = trimText(value);

  if (!id) {
    throw new Error(message);
  }

  return id;
};

const toNumber = (value) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Câu lỗi tiếng Việt từ phản hồi backend.
 *
 * Backend luồng mua hộ trả lỗi nghiệp vụ dưới dạng `{ message }` và đó là câu đã viết cho
 * người dùng cuối (ví dụ "Khách chưa trả đủ phần trả trước."), nên ưu tiên hiện nguyên văn
 * thay vì thay bằng câu chung chung của màn hình.
 */
export const getPurchaseOrderApiError = (error, fallback = "Không thực hiện được thao tác.") => {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) return data.trim();
  if (data?.message) return String(data.message);

  if (data?.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors).flat().filter(Boolean)[0];

    if (first) return String(first);
  }

  return error?.message || fallback;
};

/** Ép các trường số về number để màn hình khỏi tự parse ở từng chỗ. */
const normalizeItem = (item = {}) => ({
  ...item,
  requestedQuantity: toNumber(item.requestedQuantity),
  quantity: toNumber(item.quantity),
  unitPrice: toNumber(item.unitPrice),
  unitPriceOriginal: item.unitPriceOriginal == null ? null : toNumber(item.unitPriceOriginal),
  quotedUnitPrice: item.quotedUnitPrice == null ? null : toNumber(item.quotedUnitPrice),
  lineTotal: toNumber(item.lineTotal),
});

const normalizeOrder = (order = {}) => ({
  ...order,
  items: Array.isArray(order.items) ? order.items.map(normalizeItem) : [],
  totalAmount: toNumber(order.totalAmount),
  quotedGoodsAmount: toNumber(order.quotedGoodsAmount),
  priceDifferenceAmount: toNumber(order.priceDifferenceAmount),
  priceToleranceRate: toNumber(order.priceToleranceRate),
  exchangeRate: order.exchangeRate == null ? null : toNumber(order.exchangeRate),
  statusMeta: getPurchaseOrderStatusMeta(order.status),
});

/* =========================================================
   ĐỌC
========================================================= */

/** Danh sách đơn mua của MỘT yêu cầu mua hộ. */
export const listPurchaseOrdersOfRequest = async (purchaseRequestId) => {
  const id = requireId(purchaseRequestId, "Thiếu mã yêu cầu mua hộ.");
  const response = await httpClient.get(API_ENDPOINTS.purchaseRequests.purchaseOrders(id));

  return getArrayItems(getResponseData(response)).map(normalizeOrder);
};

/**
 * Hàng đợi đơn mua. `status` rỗng = tất cả.
 * Admin dùng `status=PENDING_APPROVAL` để lấy đúng việc cần duyệt.
 */
export const listPurchaseOrders = async ({ status = "", purchaseRequestId = "" } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.purchaseOrders.list, {
    params: removeEmptyParams({ status: trimText(status), purchaseRequestId: trimText(purchaseRequestId) }),
  });

  return getArrayItems(getResponseData(response)).map(normalizeOrder);
};

export const getPurchaseOrder = async (purchaseOrderId) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");
  const response = await httpClient.get(API_ENDPOINTS.purchaseOrders.detail(id));

  return normalizeOrder(getResponseData(response));
};

/* =========================================================
   GHI
========================================================= */

/**
 * Nội dung đơn mua mà backend nhận (`SavePurchaseOrderDto`): NCC bắt buộc chọn trong danh mục,
 * mỗi dòng là một sản phẩm của yêu cầu kèm SL và đơn giá mua THỰC theo `currency`.
 */
const buildSaveBody = ({ supplierId, warehouseId, currency, purchaseNote, items = [] } = {}) => ({
  supplierId: trimText(supplierId) || null,
  ...(trimText(warehouseId) ? { warehouseId: trimText(warehouseId) } : {}),
  ...(trimText(currency) ? { currency: trimText(currency).toUpperCase() } : {}),
  ...(trimText(purchaseNote) ? { purchaseNote: trimText(purchaseNote) } : {}),
  items: items.map((item) => ({
    purchaseRequestItemId: trimText(item.purchaseRequestItemId),
    quantity: Math.trunc(toNumber(item.quantity)),
    unitPrice: toNumber(item.unitPrice),
  })),
});

export const createPurchaseOrder = async (purchaseRequestId, payload = {}) => {
  const id = requireId(purchaseRequestId, "Thiếu mã yêu cầu mua hộ.");
  const response = await httpClient.post(
    API_ENDPOINTS.purchaseRequests.purchaseOrders(id),
    buildSaveBody(payload)
  );

  return normalizeOrder(getResponseData(response));
};

export const updatePurchaseOrder = async (purchaseOrderId, payload = {}) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");
  const response = await httpClient.put(
    API_ENDPOINTS.purchaseOrders.detail(id),
    buildSaveBody(payload)
  );

  return normalizeOrder(getResponseData(response));
};

/**
 * Gửi duyệt. Backend tự quyết đi đâu:
 *   - giá thực trong ngưỡng  → PENDING_APPROVAL
 *   - vượt ngưỡng            → AWAITING_CUSTOMER (chờ khách xem phần chênh)
 */
export const submitPurchaseOrder = async (purchaseOrderId) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");
  const response = await httpClient.post(API_ENDPOINTS.purchaseOrders.submit(id));

  return normalizeOrder(getResponseData(response));
};

/** Admin duyệt / từ chối ngân sách. Từ chối bắt buộc có lý do. */
export const decidePurchaseOrder = async (purchaseOrderId, { approve, note = "" } = {}) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");

  if (!approve && !trimText(note)) {
    throw new Error("Từ chối đơn mua phải ghi lý do.");
  }

  const response = await httpClient.post(API_ENDPOINTS.purchaseOrders.decide(id), {
    approve: Boolean(approve),
    ...(trimText(note) ? { note: trimText(note) } : {}),
  });

  return normalizeOrder(getResponseData(response));
};

/** Sale đặt hàng NCC. Ảnh bằng chứng tải lên /api/attachments TRƯỚC khi gọi hàm này. */
export const placePurchaseOrder = async (purchaseOrderId, { supplierOrderCode, note = "" } = {}) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");
  const code = trimText(supplierOrderCode);

  if (!code) {
    throw new Error("Phải nhập mã đơn bên nhà cung cấp.");
  }

  const response = await httpClient.post(API_ENDPOINTS.purchaseOrders.place(id), {
    supplierOrderCode: code,
    ...(trimText(note) ? { note: trimText(note) } : {}),
  });

  return normalizeOrder(getResponseData(response));
};

/** Tiến độ NCC: SUPPLIER_CONFIRMED hoặc SUPPLIER_SHIPPED (phát hàng thì bắt buộc mã vận đơn). */
export const updatePurchaseOrderProgress = async (
  purchaseOrderId,
  { status, domesticTrackingCode = "", domesticCarrier = "", note = "" } = {}
) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");
  const target = trimText(status).toUpperCase();

  if (!target) {
    throw new Error("Chưa chọn mốc tiến độ.");
  }

  if (target === PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED && !trimText(domesticTrackingCode)) {
    throw new Error("Nhà cung cấp phát hàng thì phải có mã vận đơn nội địa.");
  }

  const response = await httpClient.put(API_ENDPOINTS.purchaseOrders.progress(id), {
    status: target,
    ...(trimText(domesticTrackingCode) ? { domesticTrackingCode: trimText(domesticTrackingCode) } : {}),
    ...(trimText(domesticCarrier) ? { domesticCarrier: trimText(domesticCarrier) } : {}),
    ...(trimText(note) ? { note: trimText(note) } : {}),
  });

  return normalizeOrder(getResponseData(response));
};

/** Huỷ đơn mua (Admin; backend chặn khi kho đã nhận kiện). */
export const cancelPurchaseOrder = async (purchaseOrderId, { reason = "" } = {}) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");

  if (!trimText(reason)) {
    throw new Error("Huỷ đơn mua phải ghi lý do.");
  }

  const response = await httpClient.post(API_ENDPOINTS.purchaseOrders.cancel(id), {
    reason: trimText(reason),
  });

  return normalizeOrder(getResponseData(response));
};

export default {
  listPurchaseOrders,
  listPurchaseOrdersOfRequest,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  decidePurchaseOrder,
  placePurchaseOrder,
  updatePurchaseOrderProgress,
  cancelPurchaseOrder,
};
