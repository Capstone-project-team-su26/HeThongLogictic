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
 *
 * TIỀN HOÀN (backend mới — hiện CHỈ có trên env test, production chưa có):
 *   POST /api/purchase-requests/{id}/close-unfulfilled          đóng phần không mua được / NCC giao thiếu
 *   GET  /api/purchase-requests/{id}/refunds                    sổ hoàn của cả yêu cầu
 *   POST /api/purchase-requests/{id}/refunds/{refundId}/complete đã chuyển MỘT khoản
 *   POST /api/purchase-orders/{id}/refund/complete              thêm refundId + amount
 *   POST /api/purchase-orders/{id}/cancel                       thêm cause CUSTOMER | SUPPLIER
 * Mọi hàm bóc `{ message, data }` qua apiEnvelope; tiền hoàn là số server chốt, FE không tính lại.
 */
import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";
import { metaOf } from "@shared/utils/statusLabel";

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
  metaOf(PURCHASE_ORDER_STATUS_META, status, { tone: "default", waiting: "—" });

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

/* =========================================================
   TIỀN HOÀN — nhãn đọc đúng mã của backend
   (VCL_BLL/Helpers/PurchaseFlow.cs: PurchasePaymentTypes, PurchaseRefundReasons,
   PurchaseRefundStatuses). Mã lạ thì hiện nguyên mã — thà để người đọc thấy mã còn
   hơn đoán sai nghĩa của một khoản tiền.
========================================================= */

/** Loại KHOẢN hoàn (`refundType`, cột PaymentType của PURCHASE_PAYMENTS). */
export const REFUND_TYPE_LABEL = Object.freeze({
  REFUND_PRICE_DIFF: "Giá mua thực thấp hơn giá đã báo",
  /* Gồm cả huỷ sau khi đặt NCC lẫn trả lại chênh giá của đơn huỷ khi CHƯA đặt — xem lý do từng dòng. */
  REFUND_CANCEL: "Huỷ đơn mua",
  REFUND_UNFULFILLED: "Không mua được / NCC giao thiếu",
});

/** Lý do của từng DÒNG hoàn (`reasonCode`, PURCHASE_REFUND_LINES). */
export const REFUND_REASON_LABEL = Object.freeze({
  PRICE_DIFF: "Giá mua thực thấp hơn giá báo",
  UNFULFILLED: "Không mua được (NCC hết hàng / mua ít hơn khách đặt)",
  SUPPLIER_SHORT: "NCC giao thiếu",
  CANCEL_CUSTOMER: "Khách huỷ sau khi đã đặt NCC",
  CANCEL_SUPPLIER: "NCC huỷ / hết hàng sau khi đã đặt",
  PRICE_DIFF_RETURN: "Trả lại phần chênh giá đã thu (đơn huỷ trước khi đặt NCC)",
});

/*
 * Trạng thái khoản hoàn KHÔNG dùng chữ "PAID": đọc "hoàn tiền: đã trả" rất dễ hiểu ngược thành
 * khách đã trả tiền — backend cố ý tách PENDING / REFUNDED / CANCELLED.
 */
export const REFUND_STATUS_META = Object.freeze({
  PENDING: { label: "Chờ chuyển tiền", tone: "gold" },
  REFUNDED: { label: "Đã chuyển trả khách", tone: "green" },
  CANCELLED: { label: "Đã huỷ khoản hoàn", tone: "default" },
});

const upperCode = (value) => String(value ?? "").trim().toUpperCase();

export const getRefundTypeLabel = (refundType) =>
  REFUND_TYPE_LABEL[upperCode(refundType)] || trimText(refundType) || "Hoàn tiền cho khách";

export const getRefundReasonLabel = (reasonCode) =>
  REFUND_REASON_LABEL[upperCode(reasonCode)] || trimText(reasonCode) || "—";

export const getRefundStatusMeta = (status) =>
  REFUND_STATUS_META[upperCode(status)] || { label: trimText(status) || "—", tone: "default" };

/**
 * Nguyên nhân huỷ đơn ĐÃ đặt NCC (`cause` của POST /purchase-orders/{id}/cancel).
 * Hai nguyên nhân cho ra hai con số hoàn khác hẳn nhau, nên màn huỷ bắt chọn và giải thích ngay.
 */
export const PURCHASE_CANCEL_CAUSE = Object.freeze({
  CUSTOMER: "CUSTOMER",
  SUPPLIER: "SUPPLIER",
});

export const PURCHASE_CANCEL_CAUSE_META = Object.freeze({
  CUSTOMER: {
    label: "Khách huỷ",
    refundRule:
      "Hoàn tiền hàng khách THỰC TRẢ (gồm chênh giá khách đã trả thêm, trừ phần chênh đã hoàn) − phí huỷ. GIỮ phí mua hộ + VAT phí.",
  },
  SUPPLIER: {
    label: "NCC không bán được",
    refundRule:
      "Hoàn ĐỦ tiền hàng khách thực trả + phí mua hộ + VAT phí tương ứng. Không trừ phí huỷ.",
  },
});

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

/**
 * Một dòng của khoản hoàn (`PurchaseRefundLineDto`). Chỉ ép kiểu, KHÔNG tính lại gì: mọi con số
 * và câu `formula` là thứ backend đã chốt khi lập khoản — màn hình hiện y nguyên để kế toán và
 * khách đọc cùng một số.
 */
export const normalizeRefundLine = (line = {}) => ({
  ...line,
  reasonCode: upperCode(line.reasonCode),
  reasonLabel: getRefundReasonLabel(line.reasonCode),
  quantity: toNumber(line.quantity),
  unitPrice: toNumber(line.unitPrice),
  goodsAmount: toNumber(line.goodsAmount),
  priceDifferenceAmount: toNumber(line.priceDifferenceAmount),
  serviceFeeAmount: toNumber(line.serviceFeeAmount),
  vatAmount: toNumber(line.vatAmount),
  importTaxAdjustment: toNumber(line.importTaxAdjustment),
  /* true: thuế NK đã thu nên trả luôn trong khoản này; false: trừ trên hoá đơn khi tất toán. */
  importTaxInRefund: Boolean(line.importTaxInRefund),
  cancelFeeAmount: toNumber(line.cancelFeeAmount),
  amount: toNumber(line.amount),
  formula: trimText(line.formula),
});

/** Một khoản hoàn (`PurchaseRefundDto`) kèm các dòng. */
export const normalizeRefund = (refund = {}) => ({
  ...refund,
  refundType: upperCode(refund.refundType),
  typeLabel: getRefundTypeLabel(refund.refundType),
  amount: toNumber(refund.amount),
  status: upperCode(refund.status),
  statusMeta: getRefundStatusMeta(refund.status),
  goodsAmount: toNumber(refund.goodsAmount),
  priceDifferenceAmount: toNumber(refund.priceDifferenceAmount),
  serviceFeeAmount: toNumber(refund.serviceFeeAmount),
  vatAmount: toNumber(refund.vatAmount),
  importTaxAdjustment: toNumber(refund.importTaxAdjustment),
  cancelFeeAmount: toNumber(refund.cancelFeeAmount),
  isLegacy: Boolean(refund.isLegacy),
  lines: Array.isArray(refund.lines) ? refund.lines.map(normalizeRefundLine) : [],
});

/** Sổ hoàn của một yêu cầu (`PurchaseRefundSummaryDto`). */
export const normalizeRefundSummary = (summary = {}) => ({
  ...summary,
  totalCollected: toNumber(summary?.totalCollected),
  totalRefunded: toNumber(summary?.totalRefunded),
  totalPendingRefund: toNumber(summary?.totalPendingRefund),
  refundableRemaining: toNumber(summary?.refundableRemaining),
  refunds: Array.isArray(summary?.refunds) ? summary.refunds.map(normalizeRefund) : [],
});

const normalizeOrder = (order = {}) => ({
  ...order,
  items: Array.isArray(order.items) ? order.items.map(normalizeItem) : [],
  totalAmount: toNumber(order.totalAmount),
  quotedGoodsAmount: toNumber(order.quotedGoodsAmount),
  priceDifferenceAmount: toNumber(order.priceDifferenceAmount),
  priceToleranceRate: toNumber(order.priceToleranceRate),
  /* Tiền đi NGƯỢC — công ty trả lại khách. 0 = không có khoản hoàn nào. */
  refundAmount: toNumber(order.refundAmount),
  cancelFeeRate: toNumber(order.cancelFeeRate),
  cancelFeeAmount: toNumber(order.cancelFeeAmount),
  /*
   * Backend mới trả MỌI khoản hoàn liên quan tới đơn (chênh giá, NCC giao thiếu, huỷ) — không chỉ
   * khoản mới nhất như `refundAmount` / `refundStatus`. Backend cũ (production) không có hai trường
   * này → mảng rỗng, màn hình tự lùi về cặp trường cũ.
   */
  refunds: Array.isArray(order.refunds) ? order.refunds.map(normalizeRefund) : [],
  totalRefundAmount: toNumber(order.totalRefundAmount),
  warehouseInvoiceStatus: trimText(order.warehouseInvoiceStatus).toUpperCase(),
  exchangeRate: order.exchangeRate == null ? null : toNumber(order.exchangeRate),
  statusMeta: getPurchaseOrderStatusMeta(order.status),
});

/** Các khoản hoàn của đơn đang chờ kế toán chuyển. */
export const getPendingRefunds = (order = {}) =>
  (Array.isArray(order?.refunds) ? order.refunds : []).filter(
    (refund) => upperCode(refund?.status) === "PENDING"
  );

/**
 * Còn khoản hoàn đang chờ chuyển trả khách.
 * Đọc `refunds[]` trước (backend mới, có thể nhiều khoản); không có thì lùi về cặp trường cũ.
 */
export const hasPendingRefund = (order = {}) =>
  getPendingRefunds(order).length > 0 ||
  (toNumber(order?.refundAmount) > 0 && upperCode(order?.refundStatus) === "PENDING");

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
  /*
   * Backend phân trang (mặc định 20, tối đa 100 dòng/trang). Trước đây gọi không kèm pageSize nên
   * bảng chỉ thấy 20 đơn cập nhật gần nhất — đơn cũ hơn biến mất khỏi màn. Đọc lần lượt hết trang.
   */
  const PAGE_SIZE = 100;
  const MAX_PAGES = 20;
  const rows = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const response = await httpClient.get(API_ENDPOINTS.purchaseOrders.list, {
      params: removeEmptyParams({
        status: trimText(status),
        purchaseRequestId: trimText(purchaseRequestId),
        pageNumber,
        pageSize: PAGE_SIZE,
      }),
    });

    const payload = getResponseData(response);
    const items = getArrayItems(payload);
    const totalCount = toNumber(payload?.totalCount);

    rows.push(...items.map(normalizeOrder));

    if (!items.length || items.length < PAGE_SIZE || (totalCount > 0 && rows.length >= totalCount)) break;
  }

  return rows;
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

/**
 * Huỷ đơn mua (backend: đã đặt NCC thì chỉ Admin, và kho chưa nhận kiện nào).
 *
 * `cause` chỉ có ý nghĩa với đơn ĐÃ đặt NCC — nó quyết định khoản hoàn:
 *   CUSTOMER (mặc định) → hoàn tiền hàng khách thực trả − phí huỷ, giữ phí mua hộ + VAT phí;
 *   SUPPLIER            → hoàn đủ tiền hàng + phí mua hộ + VAT phí, không phí huỷ.
 * Luôn gửi `cause` tường minh để người bấm biết chắc mình đã chọn gì; backend cũ bỏ qua trường lạ.
 */
export const cancelPurchaseOrder = async (
  purchaseOrderId,
  { reason = "", cause = PURCHASE_CANCEL_CAUSE.CUSTOMER } = {}
) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");

  if (!trimText(reason)) {
    throw new Error("Huỷ đơn mua phải ghi lý do.");
  }

  const normalizedCause = upperCode(cause) || PURCHASE_CANCEL_CAUSE.CUSTOMER;

  if (!PURCHASE_CANCEL_CAUSE[normalizedCause]) {
    throw new Error("Nguyên nhân huỷ chỉ nhận Khách huỷ hoặc NCC không bán được.");
  }

  const response = await httpClient.post(API_ENDPOINTS.purchaseOrders.cancel(id), {
    reason: trimText(reason),
    cause: normalizedCause,
  });

  return normalizeOrder(getResponseData(response));
};

/*
 * Thân chung của hai endpoint "đã chuyển tiền hoàn".
 *
 * Bắt mã giao dịch ngay tại chỗ chứ không đợi backend trả 400: đây là bằng chứng tiền đã ra khỏi
 * tài khoản, không có thì không được đóng sổ. `amount` gửi đúng số của khoản đang đóng — backend
 * đối chiếu, lệch là từ chối, nên không bao giờ đóng nhầm khoản khi một đơn có nhiều khoản chờ.
 */
const buildCompleteRefundBody = ({ transactionCode = "", refundId = "", amount } = {}) => {
  const code = trimText(transactionCode);

  if (!code) {
    throw new Error("Phải nhập mã giao dịch đã chuyển trả khách.");
  }

  const hasAmount = amount !== null && amount !== undefined && trimText(amount) !== "";

  if (hasAmount && !Number.isFinite(Number(amount))) {
    throw new Error("Số tiền đã chuyển không hợp lệ.");
  }

  return {
    transactionCode: code,
    ...(trimText(refundId) ? { refundId: trimText(refundId) } : {}),
    ...(hasAmount ? { amount: Number(amount) } : {}),
  };
};

/**
 * Kế toán xác nhận ĐÃ chuyển trả khách một khoản hoàn CỦA ĐƠN MUA.
 * Đơn có nhiều khoản đang chờ mà thiếu `refundId` → backend 400, nên màn hình luôn gửi kèm.
 */
export const completePurchaseRefund = async (
  purchaseOrderId,
  { transactionCode = "", refundId = "", amount } = {}
) => {
  const id = requireId(purchaseOrderId, "Thiếu mã đơn mua.");
  const body = buildCompleteRefundBody({ transactionCode, refundId, amount });

  const response = await httpClient.post(API_ENDPOINTS.purchaseOrders.completeRefund(id), body);

  return normalizeOrder(getResponseData(response));
};

/* =========================================================
   TIỀN HOÀN CỦA CẢ YÊU CẦU MUA HỘ (backend mới — chỉ có trên env test)
========================================================= */

/**
 * Sổ hoàn của một yêu cầu: tổng đã thu / đã hoàn / chờ hoàn / còn có thể hoàn + MỌI khoản hoàn
 * (không chỉ khoản mới nhất) kèm từng dòng và công thức.
 */
export const getPurchaseRequestRefunds = async (purchaseRequestId) => {
  const id = requireId(purchaseRequestId, "Thiếu mã yêu cầu mua hộ.");
  const response = await httpClient.get(API_ENDPOINTS.purchaseRequests.refunds(id));

  return normalizeRefundSummary(getResponseData(response));
};

/**
 * Sale / Admin đóng phần KHÔNG mua được (NCC hết hàng, mua ít hơn khách đặt) và phần NCC giao
 * thiếu → backend tự tính và lập khoản hoàn theo từng sản phẩm.
 *
 * Lưu ý hình dạng: `purchaseRequestItemIds` RỖNG nghĩa là "mọi sản phẩm còn phần chưa vào đơn mua
 * nào" chứ không phải "không đóng gì" — nên chỉ gửi trường này khi thật sự có danh sách chọn.
 * FE không gửi số tiền nào: tiền hoàn do server tính.
 *
 * @returns {{ refund, summary, requestStatus }}
 */
export const closeUnfulfilledPurchase = async (
  purchaseRequestId,
  { reason = "", purchaseRequestItemIds = [], supplierShortages = [] } = {}
) => {
  const id = requireId(purchaseRequestId, "Thiếu mã yêu cầu mua hộ.");

  if (!trimText(reason)) {
    throw new Error("Phải ghi lý do (ví dụ: NCC hết hàng, chỉ mua được 3/5).");
  }

  const itemIds = (Array.isArray(purchaseRequestItemIds) ? purchaseRequestItemIds : [])
    .map(trimText)
    .filter(Boolean);

  const shortages = (Array.isArray(supplierShortages) ? supplierShortages : [])
    .map((row) => ({
      purchaseOrderId: trimText(row?.purchaseOrderId),
      purchaseRequestItemId: trimText(row?.purchaseRequestItemId),
      quantity: Math.trunc(toNumber(row?.quantity)),
    }))
    .filter((row) => row.purchaseOrderId && row.purchaseRequestItemId && row.quantity > 0);

  const response = await httpClient.post(API_ENDPOINTS.purchaseRequests.closeUnfulfilled(id), {
    reason: trimText(reason),
    ...(itemIds.length ? { purchaseRequestItemIds: itemIds } : {}),
    ...(shortages.length ? { supplierShortages: shortages } : {}),
  });

  const data = getResponseData(response) || {};

  return {
    refund: normalizeRefund(data.refund || {}),
    summary: normalizeRefundSummary(data.summary || {}),
    requestStatus: trimText(data.requestStatus).toUpperCase(),
  };
};

/**
 * Kế toán xác nhận đã chuyển MỘT khoản hoàn của yêu cầu (kể cả khoản "không mua được" không gắn
 * đơn mua nào). Trả về sổ hoàn mới của cả yêu cầu.
 */
export const completePurchaseRequestRefund = async (
  purchaseRequestId,
  refundId,
  { transactionCode = "", amount } = {}
) => {
  const id = requireId(purchaseRequestId, "Thiếu mã yêu cầu mua hộ.");
  const refund = requireId(refundId, "Thiếu mã khoản hoàn.");
  /* refundId đã nằm trên URL — thân chỉ còn mã giao dịch + số tiền. */
  const body = buildCompleteRefundBody({ transactionCode, amount });

  const response = await httpClient.post(
    API_ENDPOINTS.purchaseRequests.completeRefund(id, refund),
    body
  );

  return normalizeRefundSummary(getResponseData(response));
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
  completePurchaseRefund,
  getPurchaseRequestRefunds,
  closeUnfulfilledPurchase,
  completePurchaseRequestRefund,
};
