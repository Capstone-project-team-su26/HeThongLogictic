/**
 * BÁO GIÁ ĐƠN KÝ GỬI — đọc báo giá và duyệt giá ngoại lệ (đã nối API thật).
 *
 *   GET /api/orders/{orderId}/quotation        → { message, data: QuotationDetail }
 *   GET /api/quotations/{quotationId}          → { message, data: QuotationDetail }
 *   PUT /api/quotations/{quotationId}/price-approval  (role Admin)
 *       body { decision: "APPROVED" | "REJECTED", note }
 *       → { message, status, rejectionReason, consignment }
 *
 * Vì sao cần đọc báo giá ở màn của Sale: khi khách tạo đơn, backend đã sinh sẵn
 * một báo giá `DRAFT` có đủ `additionalFees[]`, trong đó dòng có `orderItemId`
 * là phí thùng gỗ và dịch vụ khách chọn cho RIÊNG kiện đó. Sale không nhập lại
 * những khoản này — màn lập báo giá chỉ hiển thị và cho phép sửa số tiền.
 *
 * Nhân viên nội bộ đọc được mọi bản báo giá, kể cả `PENDING_PRICE_APPROVAL` mà
 * khách chưa thấy; khách thì không.
 *
 * DUYỆT GIÁ NGOẠI LỆ (backend chặn, giao diện chặn trước cho thân thiện):
 * - `decision` chỉ nhận APPROVED / REJECTED.
 * - Từ chối BẮT BUỘC có `note`.
 * - Admin lập báo giá thì KHÔNG tự duyệt được → backend trả 403.
 * - Báo giá không ở trạng thái chờ duyệt giá → 400.
 *
 * TỪ CHỐI BÁO GIÁ (PUT /api/quotations/{id}/reject, POST /api/orders/{id}/quotation/reject):
 * chỉ khách (chủ đơn) hoặc Admin; Sale/nhân viên khác → 403. Vì vậy admin UI
 * KHÔNG có nút từ chối báo giá cho Sale — Sale không từ chối thay khách rồi lập lại.
 */

import httpClient from "@shared/api/httpClient";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";
import { labelOf } from "@shared/utils/statusLabel";

/* =========================
   HẰNG SỐ
========================= */

/** Trạng thái báo giá do backend trả (VCL_BLL/Helpers/QuotationAcceptanceRules.cs). */
export const QUOTATION_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  PENDING_PRICE_APPROVAL: "PENDING_PRICE_APPROVAL",
  PRICE_REJECTED: "PRICE_REJECTED",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
});

/** Nhãn trạng thái báo giá — bảng DUY NHẤT của app cho họ mã này. */
export const QUOTATION_STATUS_LABELS = Object.freeze({
  DRAFT: "Nháp",
  PENDING: "Chờ khách xác nhận",
  SENT: "Đã gửi khách",
  ACCEPTED: "Khách đã chấp nhận",
  REJECTED: "Khách từ chối",
  EXPIRED: "Đã hết hạn",
  PENDING_PRICE_APPROVAL: "Chờ Admin duyệt giá",
  PRICE_REJECTED: "Admin từ chối giá",
  SUPERSEDED: "Đã được thay bằng báo giá mới",
  CANCELLED: "Đã huỷ",
});

export const getQuotationStatusLabel = (status) =>
  labelOf(QUOTATION_STATUS_LABELS, status, { generic: "Trạng thái báo giá khác" });

/** Trạng thái duyệt giá ngoại lệ. */
export const PRICE_APPROVAL_STATUS = Object.freeze({
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

export const PRICE_APPROVAL_DECISION = Object.freeze({
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

/* =========================
   HELPERS
========================= */

const normalizeText = (value) => String(value ?? "").trim();

const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const normalizeOrderId = (orderId) => {
  const id = normalizeText(orderId);

  if (!id) {
    throw new Error("Không tìm thấy mã đơn ký gửi.");
  }

  return id;
};

const normalizeQuotationId = (quotationId) => {
  const id = normalizeText(quotationId);

  if (!id) {
    throw new Error("Không tìm thấy mã báo giá.");
  }

  return id;
};

/* =========================
   CHUẨN HOÁ BÁO GIÁ
========================= */

/**
 * Một dòng phí của báo giá.
 *
 * `orderItemId` khác null nghĩa là phí của RIÊNG kiện đó (dịch vụ khách chọn
 * hoặc phí thùng gỗ) — giao diện nhóm theo kiện để hiển thị; null là phí cả đơn.
 * Backend trả cả bộ khoá mới (feeId/code/label/amount/enabled) lẫn bộ cũ
 * (feeName/feeType/calculationType/value), nên chuẩn hoá về một bộ duy nhất.
 */
/*
 * ID QUY TẮC PHÍ của dòng (PRICING_RULES.id), null nếu dòng không sinh từ quy tắc.
 *
 * Backend trả `feeId = pricingRuleId ?? id` (QuotationService.Helpers.cs, MapToFeeResponseDto):
 * dòng không có quy tắc (phí thùng PACKING_FEE, cước chính, thuế) thì `feeId` chính là ID
 * DÒNG PHÍ (QUOTATION_FEES.id). Gửi ID đó lên POST .../quotation/send là 400 "Không tìm
 * thấy quy định phí với ID". Vì vậy chỉ tin `pricingRuleId`; `feeId` chỉ dùng khi backend
 * cũ không trả `pricingRuleId` VÀ nó khác `id` của dòng.
 */
const resolveFeeRuleId = (fee = {}) => {
  const lineId = normalizeText(fee?.id).toLowerCase();
  const ruleId = normalizeText(fee?.pricingRuleId);

  if (ruleId) return ruleId;

  const feeId = normalizeText(fee?.feeId);

  return feeId && feeId.toLowerCase() !== lineId ? feeId : null;
};

export const normalizeQuotationFee = (fee = {}) => ({
  ...fee,
  id: normalizeText(fee?.id),
  feeId: resolveFeeRuleId(fee),
  pricingRuleId: resolveFeeRuleId(fee),
  orderItemId: normalizeText(fee?.orderItemId) || null,
  itemName: normalizeText(fee?.itemName),
  code: normalizeUpperText(fee?.code),
  label: normalizeText(fee?.label || fee?.feeName) || "Phụ phí",
  feeType: normalizeUpperText(fee?.feeType),
  calculationType: normalizeUpperText(
    fee?.feeCalculationType || fee?.calculationType,
  ),
  amount: toNumber(fee?.amount, 0),
  enabled: fee?.enabled !== false,
  isRequired: fee?.isRequired === true,
  note: normalizeText(fee?.note),
});

/** Báo giá đầy đủ, đã bóc `{ message, data }`. */
export const normalizeQuotationDetail = (data = {}) => ({
  ...data,
  quotationId: normalizeText(data?.quotationId || data?.id),
  orderId: normalizeText(data?.orderId),
  consignmentCode: normalizeText(data?.consignmentCode),
  quoteType: normalizeUpperText(data?.quoteType),
  status: normalizeUpperText(data?.status),
  priceApprovalStatus: normalizeUpperText(data?.priceApprovalStatus) || null,
  overrideReason: normalizeText(data?.overrideReason),
  salesNote: normalizeText(data?.salesNote),
  warehouseId: normalizeText(data?.warehouseId) || null,
  canCustomerAccept: data?.canCustomerAccept === true,
  /* Chỉ nhân viên nhận các cờ này; khách nhận null. */
  canSalesRequote:
    typeof data?.canSalesRequote === "boolean" ? data.canSalesRequote : null,
  requoteState: normalizeUpperText(data?.requoteState) || null,
  requoteBlockedReason: normalizeText(data?.requoteBlockedReason) || null,

  totalWeight: toNumber(data?.totalWeight, 0),
  totalVolume: toNumber(data?.totalVolume, 0),
  volumetricWeight: toNumber(data?.volumetricWeight, 0),
  chargeableWeight: toNumber(data?.chargeableWeight, 0),
  estimatedFreightCharge: toNumber(data?.estimatedFreightCharge, 0),
  domesticShippingFee: toNumber(data?.domesticShippingFee, 0),
  serviceFee: toNumber(data?.serviceFee, 0),
  taxAndDuty: toNumber(data?.taxAndDuty, 0),
  vat: toNumber(data?.vat, 0),
  importTax: toNumber(data?.importTax, 0),
  totalEstimatedCost: toNumber(data?.totalEstimatedCost, 0),

  createdAt: data?.createdAt || null,
  expiredAt: data?.expiredAt || null,
  acceptedAt: data?.acceptedAt || null,

  additionalFees: getArrayItems(data?.additionalFees).map(normalizeQuotationFee),
  parcels: getArrayItems(data?.parcels),
});

/**
 * Gom phí theo từng kiện để màn lập báo giá hiển thị đúng thứ khách đã chọn.
 *
 * @returns {Array<{ orderItemId: string, itemName: string, fees: Array<object>, total: number }>}
 */
export const groupFeesByOrderItem = (additionalFees = []) => {
  const groups = new Map();

  getArrayItems(additionalFees)
    .map(normalizeQuotationFee)
    .filter((fee) => Boolean(fee.orderItemId))
    .forEach((fee) => {
      const current = groups.get(fee.orderItemId) || {
        orderItemId: fee.orderItemId,
        itemName: fee.itemName,
        fees: [],
        total: 0,
      };

      current.itemName = current.itemName || fee.itemName;
      current.fees.push(fee);
      current.total += fee.enabled ? fee.amount : 0;

      groups.set(fee.orderItemId, current);
    });

  return Array.from(groups.values());
};

/** Phí cấp ĐƠN (không gắn kiện nào). */
export const getOrderLevelFees = (additionalFees = []) =>
  getArrayItems(additionalFees)
    .map(normalizeQuotationFee)
    .filter((fee) => !fee.orderItemId);

/* =========================
   LẬP LẠI BÁO GIÁ (luật của Sale)
========================= */

/**
 * Sale còn lập/gửi báo giá mới được không — cùng luật backend
 * (VCL_BLL/Helpers/QuotationAcceptanceRules.cs · EvaluateRequote, trả về
 * `canSalesRequote` / `requoteState` / `requoteBlockedReason` cho nhân viên).
 *
 * Báo giá đã tới tay khách (gửi thẳng theo bảng giá, hoặc Admin đã duyệt giá
 * ngoại lệ) thì KHÔNG lập lại — API gửi báo giá trả 409. Chỉ lập lại khi khách
 * từ chối, báo giá hết hạn, hoặc Admin từ chối giá ngoại lệ. Bản còn chờ Admin
 * duyệt giá thì gửi bản mới sẽ thay bản đang chờ.
 */
export const REQUOTE_STATE = Object.freeze({
  OPEN: "OPEN",
  REPLACE_PENDING_PRICE_APPROVAL: "REPLACE_PENDING_PRICE_APPROVAL",
  CUSTOMER_REJECTED: "CUSTOMER_REJECTED",
  EXPIRED: "EXPIRED",
  PRICE_REJECTED: "PRICE_REJECTED",
  SENT_TO_CUSTOMER: "SENT_TO_CUSTOMER",
  APPROVED_SENT_TO_CUSTOMER: "APPROVED_SENT_TO_CUSTOMER",
  ACCEPTED: "ACCEPTED",
  ORDER_NOT_QUOTABLE: "ORDER_NOT_QUOTABLE",
});

const REQUOTE_STATE_META = Object.freeze({
  OPEN: { label: "Chưa có báo giá chính thức", tone: "default" },
  REPLACE_PENDING_PRICE_APPROVAL: { label: "Chờ Admin duyệt giá", tone: "processing" },
  CUSTOMER_REJECTED: { label: "Khách từ chối — được lập lại", tone: "warning" },
  EXPIRED: { label: "Báo giá hết hạn — được lập lại", tone: "warning" },
  PRICE_REJECTED: { label: "Admin từ chối giá — Sale sửa lại", tone: "error" },
  SENT_TO_CUSTOMER: { label: "Đã gửi khách — chờ khách xác nhận", tone: "success" },
  APPROVED_SENT_TO_CUSTOMER: { label: "Đã duyệt & gửi khách", tone: "success" },
  ACCEPTED: { label: "Khách đã chấp nhận", tone: "success" },
  ORDER_NOT_QUOTABLE: { label: "Đơn đã qua bước báo giá", tone: "default" },
});

const REQUOTE_WHEN =
  "Chỉ lập báo giá mới khi khách từ chối báo giá, báo giá hết hạn hoặc Admin từ chối giá ngoại lệ.";

/* Backend trả DateTime không kèm múi giờ nhưng là giờ UTC. */
const parseUtcTime = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  const withZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`;
  const time = Date.parse(withZone);
  return Number.isFinite(time) ? time : null;
};

const guessRequoteState = (quotation, now) => {
  const status = normalizeUpperText(quotation?.status);
  const approval = normalizeUpperText(quotation?.priceApprovalStatus);
  const expiredAt = parseUtcTime(quotation?.expiredAt);
  const expired = expiredAt !== null && expiredAt < now;

  switch (status) {
    case QUOTATION_STATUS.ACCEPTED:
      return REQUOTE_STATE.ACCEPTED;
    case QUOTATION_STATUS.PENDING:
      if (expired) return REQUOTE_STATE.EXPIRED;
      return approval === PRICE_APPROVAL_STATUS.APPROVED
        ? REQUOTE_STATE.APPROVED_SENT_TO_CUSTOMER
        : REQUOTE_STATE.SENT_TO_CUSTOMER;
    case QUOTATION_STATUS.PENDING_PRICE_APPROVAL:
      return REQUOTE_STATE.REPLACE_PENDING_PRICE_APPROVAL;
    case QUOTATION_STATUS.REJECTED:
      return REQUOTE_STATE.CUSTOMER_REJECTED;
    case QUOTATION_STATUS.PRICE_REJECTED:
      return REQUOTE_STATE.PRICE_REJECTED;
    default:
      return REQUOTE_STATE.OPEN;
  }
};

const BLOCKED_STATES = new Set([
  REQUOTE_STATE.SENT_TO_CUSTOMER,
  REQUOTE_STATE.APPROVED_SENT_TO_CUSTOMER,
  REQUOTE_STATE.ACCEPTED,
  REQUOTE_STATE.ORDER_NOT_QUOTABLE,
]);

const fallbackBlockedReason = (state) => {
  if (state === REQUOTE_STATE.APPROVED_SENT_TO_CUSTOMER) {
    return `Báo giá đã được Admin duyệt và gửi khách — không lập lại được. ${REQUOTE_WHEN}`;
  }
  if (state === REQUOTE_STATE.SENT_TO_CUSTOMER) {
    return `Báo giá đã gửi khách và đang chờ khách xác nhận — không lập lại được. ${REQUOTE_WHEN}`;
  }
  if (state === REQUOTE_STATE.ACCEPTED) {
    return "Khách đã chấp nhận báo giá của đơn này. Phí phát sinh đi qua đợt thanh toán cuối.";
  }
  return null;
};

/**
 * @param {object|null} quotation Báo giá chi tiết (GET .../quotation của nhân viên)
 *   hoặc tóm tắt `detail.quotation` của chi tiết đơn.
 * @returns {{ allowed: boolean, state: string, label: string, tone: string,
 *   reason: string|null, fromBackend: boolean }}
 */
export const getRequoteGuard = (quotation, { now = Date.now() } = {}) => {
  const fromBackend =
    typeof quotation?.canSalesRequote === "boolean" &&
    Boolean(normalizeText(quotation?.requoteState));

  const state = fromBackend
    ? normalizeUpperText(quotation.requoteState)
    : quotation
      ? guessRequoteState(quotation, now)
      : REQUOTE_STATE.OPEN;

  const allowed = fromBackend
    ? quotation.canSalesRequote
    : !BLOCKED_STATES.has(state);

  const meta = REQUOTE_STATE_META[state] || { label: state, tone: "default" };

  return {
    allowed,
    state,
    label: meta.label,
    tone: meta.tone,
    reason: allowed
      ? null
      : normalizeText(quotation?.requoteBlockedReason) ||
        fallbackBlockedReason(state),
    fromBackend,
  };
};

/* =========================
   API
========================= */

/**
 * Báo giá mới nhất của một đơn.
 *
 * Nhân viên nội bộ thấy cả bản `DRAFT` (giá tạm tính lúc khách đặt) và bản
 * `PENDING_PRICE_APPROVAL` (đang chờ Admin duyệt giá). Đơn chưa có báo giá nào
 * thì backend trả 404 — gọi kèm `{ allowMissing: true }` để nhận `null` thay vì
 * ném lỗi, dùng cho màn duyệt giá (quét nhiều đơn, phần lớn không có gì để duyệt).
 *
 * @param {string} orderId
 * @param {{ signal?: AbortSignal, allowMissing?: boolean }} [options]
 */
export const getOrderQuotationApi = async (orderId, options = {}) => {
  const normalizedOrderId = normalizeOrderId(orderId);

  try {
    const response = await httpClient.get(
      `/api/orders/${encodeURIComponent(normalizedOrderId)}/quotation`,
      { signal: options?.signal },
    );

    const data = getResponseData(response);

    return data ? normalizeQuotationDetail(data) : null;
  } catch (error) {
    if (options?.allowMissing && error?.response?.status === 404) {
      return null;
    }

    throw error;
  }
};

/**
 * Báo giá theo id.
 *
 * @param {string} quotationId
 * @param {{ signal?: AbortSignal }} [options]
 */
export const getQuotationByIdApi = async (quotationId, options = {}) => {
  const id = normalizeQuotationId(quotationId);

  const response = await httpClient.get(
    `/api/quotations/${encodeURIComponent(id)}`,
    { signal: options?.signal },
  );

  const data = getResponseData(response);

  return data ? normalizeQuotationDetail(data) : null;
};

/**
 * Admin duyệt hoặc từ chối giá ngoại lệ.
 *
 * Duyệt xong báo giá mới tới tay khách (đơn chuyển `QUOTATION_SENT`); từ chối
 * thì Sale phải lập báo giá khác.
 *
 * @param {string} quotationId
 * @param {{ decision: "APPROVED" | "REJECTED", note?: string }} payload
 * @returns {Promise<{ message: string, status: string, rejectionReason: string|null, consignment: object|null }>}
 */
export const decideQuotationPriceApprovalApi = async (
  quotationId,
  payload = {},
) => {
  const id = normalizeQuotationId(quotationId);

  const decision = normalizeUpperText(payload?.decision);
  const note = normalizeText(payload?.note);

  if (
    decision !== PRICE_APPROVAL_DECISION.APPROVED &&
    decision !== PRICE_APPROVAL_DECISION.REJECTED
  ) {
    throw new Error("Quyết định phải là APPROVED hoặc REJECTED.");
  }

  /* Backend cũng chặn, nhưng chặn trước ở đây để khỏi mất một vòng gọi mạng. */
  if (decision === PRICE_APPROVAL_DECISION.REJECTED && !note) {
    throw new Error("Từ chối giá ngoại lệ thì bắt buộc ghi lý do.");
  }

  const response = await httpClient.put(
    `/api/quotations/${encodeURIComponent(id)}/price-approval`,
    { decision, note: note || null },
  );

  const body = response?.data ?? {};

  return {
    message: normalizeText(body?.message),
    status: normalizeUpperText(body?.status),
    rejectionReason: normalizeText(body?.rejectionReason) || null,
    consignment: body?.consignment ?? null,
  };
};

/**
 * Hàng đợi báo giá chờ Admin duyệt giá.
 *
 * BACKEND CHƯA CÓ ENDPOINT LIỆT KÊ báo giá chờ duyệt giá. Hàng đợi này được
 * DỰNG LẠI ở phía giao diện: lấy các đơn ký gửi gần đây ở những trạng thái còn
 * có thể đang treo báo giá, rồi đọc báo giá của từng đơn và giữ lại bản
 * `PENDING_PRICE_APPROVAL`. Vì vậy:
 *   - danh sách chỉ phủ `maxPages` trang đầu của mỗi trạng thái (mặc định 2),
 *   - mỗi lần mở màn sẽ gọi nhiều request nhỏ, nên giới hạn đồng thời ở 5.
 * Màn hình PHẢI nói rõ điều này cho người dùng.
 *
 * @param {{
 *   fetchOrders: (filters: object) => Promise<{ items: Array<object> }>,
 *   statuses?: string[],
 *   pageSize?: number,
 *   maxPages?: number,
 *   concurrency?: number,
 *   signal?: AbortSignal,
 * }} options
 * @returns {Promise<{ rows: Array<object>, scannedOrders: number, failedOrders: number, truncated: boolean }>}
 */
export const getPendingPriceApprovalQueueApi = async ({
  fetchOrders,
  statuses = [
    "PENDING_REVIEW",
    "NEED_MORE_INFO",
    "QUOTATION_SENT",
    "QUOTATION_REJECTED",
    "APPROVED",
  ],
  pageSize = 50,
  maxPages = 2,
  concurrency = 5,
  signal,
} = {}) => {
  if (typeof fetchOrders !== "function") {
    throw new Error("Thiếu hàm tải danh sách đơn để dựng hàng đợi duyệt giá.");
  }

  const orders = new Map();
  let truncated = false;

  for (const status of statuses) {
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await fetchOrders({
        status,
        pageNumber,
        pageSize,
        signal,
      });

      const items = getArrayItems(page?.items ?? page);

      items.forEach((order) => {
        const orderId = normalizeText(order?.orderId || order?.id);

        if (orderId && !orders.has(orderId)) {
          orders.set(orderId, order);
        }
      });

      const totalPages = toNullableNumber(page?.totalPages);

      if (items.length < pageSize) break;

      if (totalPages !== null && pageNumber >= totalPages) break;

      if (pageNumber === maxPages && totalPages !== null && totalPages > maxPages) {
        truncated = true;
      }
    }
  }

  const entries = Array.from(orders.entries());
  const rows = [];
  let failedOrders = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;

      const [orderId, order] = entries[index];

      try {
        const quotation = await getOrderQuotationApi(orderId, {
          signal,
          allowMissing: true,
        });

        if (
          quotation?.status === QUOTATION_STATUS.PENDING_PRICE_APPROVAL ||
          quotation?.priceApprovalStatus === PRICE_APPROVAL_STATUS.PENDING
        ) {
          rows.push({ order, quotation });
        }
      } catch {
        /* Một đơn lỗi không được làm hỏng cả hàng đợi; đếm lại để báo trên UI. */
        failedOrders += 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker()),
  );

  rows.sort(
    (a, b) =>
      new Date(b?.quotation?.createdAt ?? 0).getTime() -
      new Date(a?.quotation?.createdAt ?? 0).getTime(),
  );

  return {
    rows,
    scannedOrders: entries.length,
    failedOrders,
    truncated,
  };
};

const quotationService = {
  QUOTATION_STATUS,
  PRICE_APPROVAL_STATUS,
  PRICE_APPROVAL_DECISION,
  REQUOTE_STATE,
  getRequoteGuard,
  normalizeQuotationFee,
  normalizeQuotationDetail,
  groupFeesByOrderItem,
  getOrderLevelFees,
  getOrderQuotationApi,
  getQuotationByIdApi,
  decideQuotationPriceApprovalApi,
  getPendingPriceApprovalQueueApi,
};

export default quotationService;
