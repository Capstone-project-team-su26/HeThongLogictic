/**
 * Nhãn tiếng Việt cho MỌI mã trạng thái / chặng / mốc / loại / vai trò trên web quản trị.
 *
 * Luật: người dùng không bao giờ được thấy mã thô kiểu `RECEIVED_AT_DESTINATION`.
 *
 * - Mỗi họ mã (trạng thái lô, phiếu xuất, đơn, kiện…) có ĐÚNG MỘT bảng nhãn trong app. Bảng nào
 *   đã có ở feature thì giữ ở đó; họ nào chưa có bảng thì bảng nằm ở cuối file này.
 * - Mọi chỗ hiển thị đi qua `labelOf` / `metaOf` / `textOr` / `displayCode` dưới đây.
 * - Server hay trả sẵn `statusText`, nhưng khi server cũng không biết mã thì nó trả lại chính
 *   cái mã (đúng lỗi "RECEIVED_AT_DESTINATION" trên dòng thời gian lô). Vì vậy chữ server chỉ được
 *   dùng khi nó là chữ người đọc được; còn là mã thì dịch lại ở FE.
 * - Mã lạ hoàn toàn: KHÔNG in mã. Đoán theo tiền tố/hậu tố (…_CANCELLED → "Đã huỷ") hoặc hiện
 *   "Trạng thái khác", và cảnh báo trên console khi chạy dev để bổ sung bảng.
 *
 * `tools/verify-status-labels.mjs` soát mọi mã backend có thể trả (danh sách lấy từ hằng số
 * VCL_BLL / VCL_DLL) — thiếu nhãn là script đỏ.
 */

export const EMPTY_LABEL = "—";
export const GENERIC_STATUS_LABEL = "Trạng thái khác";

/* Chữ tiếng Anh hay lọt ra màn hình như một "trạng thái" — coi như mã, phải dịch. */
const ENGLISH_STATUS_WORDS = new Set([
  "n/a", "na", "none", "null", "undefined", "unknown", "other", "new", "draft", "pending",
  "approved", "rejected", "paid", "unpaid", "active", "inactive", "blocked", "locked",
  "suspended", "deleted", "cancelled", "canceled", "completed", "complete", "success",
  "succeeded", "failed", "failure", "open", "closed", "resolved", "processing", "in progress",
  "done", "expired", "refunded", "delivered", "shipped", "received", "stored", "true", "false",
  "yes", "no", "ok", "error", "verified", "unverified", "confirmed", "ordered", "partial",
]);

/* Từ tiếng Anh hay ghép thành cụm trạng thái ("Pending review", "Waiting for payment"…). Cụm
   ASCII mà MỌI từ đều thuộc bộ này thì coi như mã; chữ Việt không dấu ("Giao ngay") không dính. */
const ENGLISH_STATUS_TOKENS = new Set([
  ...[...ENGLISH_STATUS_WORDS].filter((word) => !word.includes(" ")),
  "review", "waiting", "awaiting", "for", "payment", "deposit", "final", "in", "progress",
  "transit", "customer", "confirmation", "out", "delivery", "at", "warehouse", "destination",
  "arrived", "ready", "to", "ship", "not", "found", "partially", "fully", "on", "hold", "sent",
  "submitted", "quotation", "quoted", "accepted", "order", "status", "approval", "reconciliation",
  "purchasing", "purchased", "the", "by", "info", "more", "need", "checked", "handed", "over",
  "picked", "up", "returned", "returning", "lost", "cleared", "customs", "departed", "delayed",
]);

const isEnglishStatusPhrase = (value) => {
  if (!/^[A-Za-z]+(?:[\s/-]+[A-Za-z]+)+$/.test(value)) return false;
  return value
    .toLowerCase()
    .split(/[\s/-]+/)
    .every((word) => ENGLISH_STATUS_TOKENS.has(word));
};

/** Chuẩn hoá mã: trim, IN HOA, khoảng trắng / gạch ngang → gạch dưới. */
export const normalizeCode = (code) =>
  String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

/** Chuỗi trông như mã máy (IN_HOA_GẠCH_DƯỚI, snake_case) hoặc chữ trạng thái tiếng Anh. */
export const isCodeLike = (text) => {
  const value = String(text ?? "").trim();
  if (!value) return false;
  if (/^[A-Z0-9]+(?:[_.][A-Z0-9]+)*$/.test(value) && /[A-Z]{2,}/.test(value)) return true;
  if (/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(value)) return true;
  return ENGLISH_STATUS_WORDS.has(value.toLowerCase()) || isEnglishStatusPhrase(value);
};

/** Có phải chữ cho người đọc (không rỗng, không phải mã)? */
export const isDisplayableText = (text) =>
  typeof text === "string" || typeof text === "number"
    ? String(text).trim() !== "" && !isCodeLike(text)
    : false;

const HUMANIZE_RULES = [
  [/CANCEL/, "Đã huỷ"],
  [/REJECT|DECLIN/, "Bị từ chối"],
  [/FAIL|ERROR/, "Không thành công"],
  [/REFUND/, "Hoàn tiền"],
  [/^(PENDING|WAITING|AWAITING)|_PENDING$|_WAITING$/, "Đang chờ xử lý"],
  [/APPROV/, "Đã duyệt"],
  [/UNPAID/, "Chưa thanh toán"],
  [/PAID/, "Đã thanh toán"],
  [/COMPLET|DONE|FINISH|CLOSED/, "Hoàn tất"],
  [/RETURN/, "Hoàn hàng"],
  [/DELIVER/, "Giao hàng"],
  [/TRANSIT/, "Đang vận chuyển"],
  [/RECEIV/, "Đã nhận hàng"],
  [/EXPIRE/, "Hết hạn"],
  [/DRAFT/, "Nháp"],
];

const warnedCodes = new Set();

/** Mã đã rơi xuống nhãn chung trong phiên này (dev) — tools/verify-status-labels.mjs đọc. */
export const getUnlabelledCodes = () => [...warnedCodes];
const warnUnknown = (key) => {
  const dev = Boolean(import.meta.env?.DEV);
  if (!dev || warnedCodes.has(key)) return;
  warnedCodes.add(key);
  console.warn(`[statusLabel] Chưa có nhãn tiếng Việt cho mã "${key}" — bổ sung vào bảng nhãn.`);
};

/** Mã lạ → nhãn tiếng Việt chung chung (không bao giờ trả lại mã). */
export const humanizeCode = (code, generic = GENERIC_STATUS_LABEL) => {
  const key = normalizeCode(code);
  if (!key) return EMPTY_LABEL;
  const rule = HUMANIZE_RULES.find(([pattern]) => pattern.test(key));
  return rule ? rule[1] : generic;
};

const entryLabel = (entry) => {
  if (entry == null) return "";
  if (typeof entry === "string") return entry;
  return entry.label ?? entry.text ?? "";
};

/** Tra một bảng nhãn: object { MÃ: "nhãn" | { label } } hoặc mảng [{ value, label }]. */
const lookup = (map, key) => {
  if (!map || !key) return "";
  if (Array.isArray(map)) {
    const found = map.find((item) => normalizeCode(item?.value ?? item?.key) === key);
    return entryLabel(found);
  }
  if (Object.prototype.hasOwnProperty.call(map, key)) return entryLabel(map[key]);
  return "";
};

/**
 * Nhãn tiếng Việt của một mã.
 *
 * @param {object|Array|null} map   bảng nhãn của họ mã (có thể null → chỉ dùng bảng chung)
 * @param {*} code                  mã server trả
 * @param {string|{preferred?: string, fallback?: string, generic?: string, empty?: string}} [opts]
 *   chuỗi = `preferred`: chữ server trả sẵn (vd. `statusText`), được dùng TRƯỚC bảng nếu là chữ
 *   người đọc được. `fallback`: chữ dùng khi bảng không có mã. `generic`: nhãn chung khi mã lạ.
 */
export const labelOf = (map, code, opts) => {
  const options = typeof opts === "string" || opts == null ? { preferred: opts } : opts;
  const { preferred, fallback, generic = GENERIC_STATUS_LABEL, empty = EMPTY_LABEL } = options;

  if (isDisplayableText(preferred)) return String(preferred).trim();

  const key = normalizeCode(code);
  if (!key) {
    /* Không có mã nhưng server trả chữ dạng mã (vd. "PENDING") → vẫn dịch chữ đó. */
    return isCodeLike(preferred) ? labelOf(map, preferred, { generic, empty }) : empty;
  }

  const own = lookup(map, key);
  if (own) return own;
  if (isDisplayableText(fallback)) return String(fallback).trim();

  const common = lookup(COMMON_CODE_LABELS, key);
  if (common) return common;

  /* "Mã" thật ra là chữ người đọc (dữ liệu cũ, tên tiếng Việt) → giữ nguyên. */
  const raw = String(code).trim();
  if (isDisplayableText(raw)) return raw;

  warnUnknown(key);
  return humanizeCode(key, generic);
};

/**
 * Meta (label + màu…) của một mã: bản ghi trong bảng nếu có, không thì `defaults` kèm nhãn an toàn.
 * Dùng cho các hàm getXxxMeta để không bao giờ trả `{ label: status }`.
 */
export const metaOf = (map, code, defaults = {}, opts) => {
  const key = normalizeCode(code);
  const entry = key && map && !Array.isArray(map) ? map[key] : null;
  if (entry && typeof entry === "object") return entry;
  return { ...defaults, label: labelOf(map, code, opts) };
};

/** Chữ server trả sẵn nếu đọc được, không thì nhãn dự phòng (đã dịch). */
export const textOr = (serverText, fallbackLabel) => {
  if (isDisplayableText(serverText)) return String(serverText).trim();
  if (isDisplayableText(fallbackLabel)) return String(fallbackLabel).trim();
  if (isCodeLike(fallbackLabel)) return labelOf(null, fallbackLabel);
  if (isCodeLike(serverText)) return labelOf(null, serverText);
  return EMPTY_LABEL;
};

/** Làm sạch một chuỗi bất kỳ trước khi hiện: là mã thì dịch qua bảng chung, không thì giữ. */
export const displayCode = (value, map = null, opts) => {
  if (value == null || String(value).trim() === "") return EMPTY_LABEL;
  if (!isCodeLike(value) && !lookup(map, normalizeCode(value))) return String(value).trim();
  return labelOf(map, value, opts);
};

/**
 * Chữ tự do của server (tiêu đề / nội dung thông báo / câu lỗi…) đôi khi chèn nguyên mã, vd. "Đơn
 * đã chuyển sang RECEIVED_AT_DESTINATION". Thay từng MÃ_CÓ_GẠCH_DƯỚI bằng nhãn tiếng Việt; phần còn
 * lại giữ nguyên. Mã đơn / kiện / lô (VCL-…, PCL-…, SHIP-…, PUR-…) dùng gạch ngang nên không bị đụng.
 * Trong câu, chỉ thay token CÓ nhãn (bảng họ / bảng chung — bảng chung phủ mọi mã backend) hoặc
 * đoán được theo tiền tố/hậu tố; token lạ khác (vd. mã SKU "ABC_123" khách gõ) giữ nguyên.
 */
export const translateCodesInText = (text, map = null) => {
  const value = String(text ?? "");
  if (!value.trim()) return value;
  if (isCodeLike(value)) return labelOf(map, value);
  return value.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, (token) => {
    const known = lookup(map, token) || lookup(COMMON_CODE_LABELS, token);
    if (known) return `“${known}”`;
    return HUMANIZE_RULES.some(([pattern]) => pattern.test(token)) ? `“${humanizeCode(token)}”` : token;
  });
};

/** [{ value, label }] cho Select / bộ lọc từ danh sách mã. */
export const optionsOf = (map, codes) =>
  (codes || Object.keys(map || {})).map((value) => ({ value, label: labelOf(map, value) }));

/* ============================================================================================
 * Tuyến hàng (`route`): backend lưu mã nước "CN-VN" (có khi kèm hình thức "CN-VN-ROAD", hoặc
 * viết tắt tiếng Việt "TQ-VN"). Màn hình không được in cặp mã đó — đổi sang tên nước tiếng Việt.
 * Chữ tuyến đã là câu người đọc ("Trung quốc --> Việt Nam") thì giữ nguyên.
 * ========================================================================================== */
const ROUTE_COUNTRY_LABELS = Object.freeze({
  CN: "Trung Quốc",
  TQ: "Trung Quốc",
  VN: "Việt Nam",
  KR: "Hàn Quốc",
  HQ: "Hàn Quốc",
  JP: "Nhật Bản",
  NB: "Nhật Bản",
  US: "Mỹ",
  TW: "Đài Loan",
  TH: "Thái Lan",
  UK: "Anh",
  GB: "Anh",
  DE: "Đức",
  AU: "Úc",
});

const ROUTE_MODE_LABELS = Object.freeze({
  ROAD: "đường bộ",
  SEA: "đường biển",
  AIR: "đường hàng không",
  RAIL: "đường sắt",
  EXPRESS: "chuyển phát nhanh",
});

const routeCountryLabel = (code) => {
  const key = String(code).toUpperCase();
  if (ROUTE_COUNTRY_LABELS[key]) return ROUTE_COUNTRY_LABELS[key];
  try {
    const name = new Intl.DisplayNames(["vi"], { type: "region" }).of(key);
    if (name && name.toUpperCase() !== key) return name;
  } catch {
    /* Môi trường không có Intl.DisplayNames / mã không hợp lệ → nhãn chung bên dưới. */
  }
  return "Nước khác";
};

/**
 * "CN-VN" → "Trung Quốc → Việt Nam"; "CN-VN-ROAD" → "Trung Quốc → Việt Nam (đường bộ)";
 * "CN" → "Trung Quốc → Việt Nam" (hậu tố hình thức lạ thì bỏ qua). Rỗng → `empty`.
 */
export const getRouteLabel = (route, empty = "") => {
  const text = String(route ?? "").trim();
  if (!text) return empty;
  const match = text.match(/^([A-Z]{2})(?:\s*(?:-+>?|_|>|→|\/)\s*([A-Z]{2}))?(?:\s*[-_]\s*([A-Z]+))?$/i);
  if (!match) return displayCode(text, null, { generic: "Tuyến khác" });
  const mode = match[3] ? ROUTE_MODE_LABELS[match[3].toUpperCase()] : "";
  const from = routeCountryLabel(match[1]);
  const to = routeCountryLabel(match[2] || "VN");
  return `${from} → ${to}${mode ? ` (${mode})` : ""}`;
};

/* ============================================================================================
 * Bảng nhãn cho các họ mã CHƯA có bảng riêng ở feature nào. Họ nào đã có bảng ở feature thì
 * KHÔNG chép sang đây (giữ một nguồn).
 * ========================================================================================== */

/** Trạng thái KIỆN (`packageStatus`) — kho nguồn → lô → kho VN → giao nội địa (GoShip / GHN). */
export const PARCEL_STATUS_LABELS = Object.freeze({
  PENDING_CHECKIN: "Chờ kho nước ngoài nhận",
  CREATED: "Chờ kho nhận",
  PENDING: "Chờ kho nhận",
  RECEIVED: "Kho nước ngoài đã nhận",
  CHECKED_IN: "Kho nước ngoài đã nhận",
  IN_WAREHOUSE: "Đang nằm kho nước ngoài",
  STORED: "Đang lưu kho",
  SPLIT: "Đã tách kiện",
  MERGED: "Đã gộp kiện",
  RESERVED: "Đã giữ cho phiếu xuất",
  PICKED: "Đã bốc sang khu xuất",
  RELEASED: "Đã xuất kho, chờ lên lô",
  IN_SHIPMENT: "Đã vào lô vận chuyển",
  HANDED_OVER: "Đã bàn giao cho hãng vận chuyển",
  IN_TRANSIT: "Đang trên đường về Việt Nam",
  ARRIVED_VN: "Đã về Việt Nam",
  ARRIVED_DESTINATION: "Đã về kho Việt Nam, chờ kiểm đếm",
  RECEIVED_AT_DESTINATION: "Kho Việt Nam đã kiểm đếm xong",
  QUARANTINED: "Đang cách ly xử lý sự cố",
  AWAITING_PICKUP: "Chờ đơn vị giao tới lấy",
  PICKING_UP: "Đơn vị giao đang lấy hàng",
  PICKED_UP: "Đơn vị giao đã lấy hàng",
  AT_CARRIER_WAREHOUSE: "Đang ở kho đơn vị giao",
  OUT_FOR_DELIVERY: "Đang giao hàng",
  DELIVERY_DELAYED: "Giao hàng bị chậm",
  PARTIALLY_DELIVERED: "Đã giao một phần",
  DELIVERED: "Đã giao cho khách",
  DELIVERY_FAILED: "Giao chưa thành công",
  DELIVERY_ERROR: "Đơn vị giao báo lỗi",
  DELIVERY_CANCELLED: "Đơn vị giao huỷ đơn",
  RETURNING: "Đang hoàn về kho",
  RETURNED: "Đã hoàn về kho",
  RETURNED_TO_WAREHOUSE: "Giao không thành, đã hoàn về kho",
  LOST: "Thất lạc",
  DISPOSED: "Đã huỷ theo xử lý sự cố",
  CANCELLED: "Đã huỷ",
});

export const getParcelStatusLabel = (status, serverText) =>
  labelOf(PARCEL_STATUS_LABELS, status, serverText);

/** Phương thức thanh toán. */
export const PAYMENT_METHOD_LABELS = Object.freeze({
  PAYOS: "Chuyển khoản payOS",
  SEPAY: "Chuyển khoản SePay",
  OFFLINE: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  CASH: "Tiền mặt",
  VNPAY: "VNPay",
  MOMO: "Ví MoMo",
  MANUAL: "Thủ công (kế toán ghi nhận)",
  PREPAID: "Trừ vào khoản trả trước",
  WALLET: "Ví điện tử",
});

export const getPaymentMethodLabel = (method) =>
  labelOf(PAYMENT_METHOD_LABELS, method, { generic: "Phương thức khác" });

/** Loại khoản thu / đợt thanh toán (`installmentType`, `paymentType`) — ký gửi + mua hộ. */
export const INSTALLMENT_TYPE_LABELS = Object.freeze({
  DEPOSIT: "Tiền cọc",
  FINAL: "Tất toán",
  FINAL_PAYMENT: "Tất toán",
  REMAINING: "Tất toán",
  FULL: "Thanh toán một lần",
  FULL_PAYMENT: "Thanh toán một lần",
  STORAGE_FEE: "Phí lưu kho",
  REDELIVERY_FEE: "Phí giao lại",
  PREPAYMENT: "Trả trước mua hộ",
  PRICE_DIFFERENCE: "Phần chênh giá mua",
  REFUND_PRICE_DIFF: "Hoàn phần chênh giá mua",
  REFUND_CANCEL: "Hoàn tiền do huỷ đơn mua",
  REFUND_UNFULFILLED: "Hoàn phần không mua được / NCC giao thiếu",
});

export const getInstallmentTypeLabel = (type) =>
  labelOf(INSTALLMENT_TYPE_LABELS, type, { generic: "Khoản thu khác" });

/**
 * Vai trò. Backend có nhiều cách viết (Admin / ADMIN / WarehouseStaff / Warehouse Staff /
 * WAREHOUSE_STAFF…) — khoá ở đây đã bỏ khoảng trắng, gạch dưới và gạch ngang.
 */
export const ROLE_LABELS = Object.freeze({
  ADMIN: "Quản trị viên",
  ADMINISTRATOR: "Quản trị viên",
  SALE: "Nhân viên kinh doanh",
  SALES: "Nhân viên kinh doanh",
  SALESSTAFF: "Nhân viên kinh doanh",
  STAFF: "Nhân viên",
  WAREHOUSE: "Nhân viên kho",
  WAREHOUSESTAFF: "Nhân viên kho",
  WAREHOUSETQ: "Nhân viên kho nước ngoài",
  WAREHOUSEVN: "Nhân viên kho Việt Nam",
  WAREHOUSESTAFFVN: "Nhân viên kho Việt Nam",
  WAREHOUSEMANAGER: "Quản lý kho",
  MANAGER: "Quản lý",
  OPERATIONSMANAGER: "Quản lý vận hành",
  OPERATIONS: "Quản lý vận hành",
  DELIVERY: "Nhân viên giao vận",
  CUSTOMER: "Khách hàng",
});

const roleKey = (role) => String(role ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");

export const getRoleLabel = (role) => {
  if (!String(role ?? "").trim()) return EMPTY_LABEL;
  const key = roleKey(role);
  if (key.startsWith("WAREHOUSE") && !ROLE_LABELS[key] && key !== "WAREHOUSEMANAGER") {
    return ROLE_LABELS.WAREHOUSESTAFF;
  }
  return labelOf(ROLE_LABELS, key, { generic: "Vai trò khác" });
};

/** Trạng thái tài khoản (User: PendingVerification / Active / Locked; khách: ACTIVE / INACTIVE…). */
export const USER_STATUS_LABELS = Object.freeze({
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  PENDINGVERIFICATION: "Chờ xác minh",
  PENDING: "Chờ kích hoạt",
  LOCKED: "Đã khoá",
  BLOCKED: "Đã khoá",
  SUSPENDED: "Tạm ngưng",
  DELETED: "Đã xoá",
});

export const getUserStatusLabel = (status) =>
  labelOf(USER_STATUS_LABELS, roleKey(status), { generic: "Trạng thái khác" });

/** Loại tài khoản / loại khách. */
export const USER_TYPE_LABELS = Object.freeze({
  CUSTOMER: "Khách hàng",
  STAFF: "Nhân viên",
  INDIVIDUAL: "Cá nhân",
  RETAIL: "Khách lẻ",
  BUSINESS: "Doanh nghiệp",
});

export const getUserTypeLabel = (type) =>
  labelOf(USER_TYPE_LABELS, type, { generic: "Loại khác" });

/** Loại kho. */
export const WAREHOUSE_TYPE_LABELS = Object.freeze({
  ORIGIN: "Kho nguồn (nước ngoài)",
  DESTINATION: "Kho đích (VN)",
  DOMESTIC: "Kho nội địa",
  TRANSIT: "Kho trung chuyển",
});

export const getWarehouseTypeLabel = (type) =>
  labelOf(WAREHOUSE_TYPE_LABELS, type, { generic: "Loại kho khác" });

/** Các họ mã của màn danh mục (Admin). */
export const CALCULATION_TYPE_LABELS = Object.freeze({
  FIXED: "Cố định",
  PERCENTAGE: "Theo phần trăm",
  PER_KG: "Theo kg",
  PER_VOLUME: "Theo thể tích",
  PER_CBM: "Theo khối (m³)",
  PER_PRODUCT: "Theo sản phẩm",
});

export const CONDITION_TYPE_LABELS = Object.freeze({
  ALWAYS: "Luôn áp dụng",
  REQUIRES_INSPECTION: "Khi cần kiểm hàng",
  MIN_WEIGHT: "Cân nặng tối thiểu",
  MIN_VOLUME: "Thể tích tối thiểu",
  MIN_DECLARED_VALUE: "Giá trị khai báo tối thiểu",
});

export const RULE_TYPE_LABELS = Object.freeze({
  DOMESTIC_FEE: "Phí vận chuyển nội địa",
  VAT: "Thuế VAT",
  PACKING: "Phí đóng gói",
  CARTON_REPACK: "Đóng lại thùng carton",
  IMPORT_TAX: "Thuế nhập khẩu",
  VOLUMETRIC_DIVISOR: "Hệ số quy đổi thể tích",
});

export const TRANSPORT_MODE_LABELS = Object.freeze({
  AIR: "Đường hàng không",
  SEA: "Đường biển",
  ROAD: "Đường bộ",
  RAIL: "Đường sắt",
  EXPRESS: "Chuyển phát nhanh",
});

export const CARRIER_TYPE_LABELS = Object.freeze({
  CROSSBORDER_ROAD: "Xuyên biên giới – đường bộ",
  CROSSBORDER_SEA: "Xuyên biên giới – đường biển",
  CROSSBORDER_AIR: "Xuyên biên giới – hàng không",
  DOMESTIC: "Nội địa",
  AIR_FREIGHT: "Hàng không",
  SEA_FREIGHT: "Đường biển",
  TRUCKING: "Đường bộ (xe tải)",
  EXPRESS: "Chuyển phát nhanh",
  RAIL: "Đường sắt",
});

/* Đơn vị tính của bảng giá: giữ ký hiệu đơn vị, chỉ đổi chữ tiếng Anh. */
export const UNIT_TYPE_LABELS = Object.freeze({
  KG: "kg",
  M3: "m³",
  CBM: "m³",
  PACKAGE: "Kiện",
  ITEM: "Sản phẩm",
  PRODUCT: "Sản phẩm",
});

export const SUPPLIER_TYPE_LABELS = Object.freeze({
  TRANSIT: "Trung chuyển",
  PICKUP: "Lấy hàng",
  GOODS: "Hàng hoá",
  SERVICE: "Dịch vụ",
});

export const RESTRICTION_TYPE_LABELS = Object.freeze({
  BANNED: "Cấm",
  RESTRICTED: "Hạn chế",
  WARNING: "Cảnh báo",
});

/** Sự kiện lịch sử đơn (`OrderStatusHistory.EventCode`). */
export const ORDER_HISTORY_EVENT_LABELS = Object.freeze({
  QUOTATION_SENT: "Đã gửi báo giá",
  QUOTATION_SUBMITTED_FOR_PRICE_APPROVAL: "Gửi duyệt giá báo giá",
  QUOTATION_PRICE_APPROVED: "Giá báo giá đã được duyệt",
  QUOTATION_PRICE_REJECTED: "Giá báo giá bị từ chối",
  QUOTATION_REJECTED: "Khách từ chối báo giá",
  QUOTATION_ACCEPTED: "Khách chấp nhận báo giá",
  ORDER_REJECTED: "Từ chối đơn",
  ORDER_NEED_MORE_INFO: "Yêu cầu bổ sung thông tin",
  ORDER_CANCELLED_BY_CUSTOMER: "Khách huỷ đơn",
  ORDER_DELIVERED: "Đã giao hàng",
  ORDER_COMPLETED_BY_CUSTOMER: "Khách xác nhận hoàn tất đơn",
  ORDER_AUTO_COMPLETED: "Hệ thống tự hoàn tất đơn",
  PAYMENT_RECEIVED_UNALLOCATED: "Nhận tiền chưa phân bổ",
  PAYMENT_CONFIRMED_DEPOSIT: "Xác nhận tiền cọc",
  PAYMENT_CONFIRMED_FINAL_PAYMENT: "Xác nhận tất toán",
  PAYMENT_CONFIRMED_FULL_PAYMENT: "Xác nhận thanh toán một lần",
  PAYMENT_CONFIRMED_STORAGE_FEE: "Xác nhận phí lưu kho",
  PAYMENT_CONFIRMED_REDELIVERY_FEE: "Xác nhận phí giao lại",
  PAYMENT_CONFIRMED_UNKNOWN: "Xác nhận một khoản thanh toán",
  RECEIVING_NOTE_CREATED: "Lập phiếu nhập kho",
  RECEIVING_NOTE_COUNTED: "Kho đã kiểm đếm",
  RECEIVING_NOTE_APPROVED_TO_RECEIVE: "Duyệt cho nhận hàng",
  RECEIVING_NOTE_REJECTED: "Từ chối phiếu nhập kho",
  RECEIVING_COUNT_APPROVED: "Duyệt kết quả kiểm đếm",
  RECEIVING_COUNT_REJECTED: "Từ chối kết quả kiểm đếm",
  RECEIVING_DISCREPANCY_ACCEPTED: "Chấp nhận chênh lệch kiểm đếm",
  PURCHASE_ORDER_PLACED: "Đã đặt đơn mua NCC",
  PURCHASE_ORDER_CANCELLED: "Huỷ đơn mua NCC",
});

export const getOrderHistoryEventLabel = (code, serverText) =>
  labelOf(ORDER_HISTORY_EVENT_LABELS, code, { preferred: serverText, generic: "Cập nhật đơn" });


/**
 * Bảng CHUNG — lưới an toàn cuối cùng, phủ MỌI mã backend có thể trả (tools/status-codes.json).
 * Nhãn trung tính vì một mã có thể thuộc nhiều họ; họ nào cần câu riêng thì bảng của họ đó thắng.
 */
export const COMMON_CODE_LABELS = Object.freeze({
  ACCEPT: "Nhận như hiện trạng",
  ACCEPTED: "Đã chấp nhận",
  ACTIVE: "Đang hoạt động",
  ADMIN: "Quản trị viên",
  ADMINISTRATOR: "Quản trị viên",
  ADMIN_MANUAL: "Admin xác nhận tay",
  AFTER_DELIVERY: "Sau khi giao",
  AIR: "Đường hàng không",
  ALREADY_IN_EXPORT: "Kiện đã nằm trong phiếu xuất khác",
  ALREADY_SETTLED: "Đơn đã tất toán",
  ALWAYS: "Luôn áp dụng",
  APPROVED: "Đã duyệt",
  APPROVED_SENT_TO_CUSTOMER: "Đã duyệt và gửi khách",
  ARRIVED: "Đã về",
  ARRIVED_DESTINATION: "Đã về kho đích",
  ARRIVED_IN_VN: "Đã đến kho Việt Nam",
  ARRIVED_ORIGIN_WAREHOUSE: "Đã về kho nước ngoài",
  ARRIVED_VN: "Đã về Việt Nam",
  AT_CARRIER_WAREHOUSE: "Đang ở kho hãng giao",
  AT_DESTINATION_WAREHOUSE: "Đã lưu kho tại kho đích",
  AT_ORIGIN_WAREHOUSE: "Đang lưu kho nguồn",
  AVAILABLE: "Khả dụng",
  AWAITING_CUSTOMER: "Chờ khách xem giá chênh",
  AWAITING_CUSTOMER_PAYMENT: "Chờ khách trả phần chênh",
  AWAITING_DELIVERY_REQUEST: "Chờ lập yêu cầu giao hàng",
  AWAITING_PICKUP: "Chờ đơn vị giao tới lấy",
  AWAITING_RECEIVING_NOTE: "Chờ Sale lập phiếu nhập kho",
  AWAITING_WAREHOUSE_NOTICE: "Chờ thông báo cho kho",
  BANK_TRANSFER: "Chuyển khoản ngân hàng",
  BANNED: "Cấm",
  BATCH: "Xuất gộp nhiều đơn",
  BLOCKED: "Đã chặn",
  BUBBLE_BAG: "Túi khí chống sốc",
  CANCELED: "Đã huỷ",
  CANCELLED: "Đã huỷ",
  CANCELLED_FORFEITED: "Huỷ do quá hạn thanh toán, mất cọc",
  CANCEL_CUSTOMER: "Khách huỷ sau khi đã đặt NCC",
  CANCEL_SUPPLIER: "NCC huỷ / hết hàng sau khi đã đặt",
  CARTON: "Thùng carton",
  CARTON_REPACK: "Đóng lại thùng carton",
  CASH: "Tiền mặt",
  CHECKED_IN: "Đã nhập kho nguồn",
  COMMERCIAL_INVOICE: "Hoá đơn thương mại",
  COMPANY: "Công ty chịu cước giao lại",
  COMPENSATE: "Bồi thường",
  COMPENSATION_RECEIPT: "Chứng từ chi bồi thường",
  COMPLAINT: "Khách khiếu nại",
  COMPLETED: "Hoàn tất",
  CONSIGNMENT: "Ký gửi",
  CREATED: "Mới tạo",
  CREATE_DELIVERY_REQUEST: "Lập yêu cầu giao hàng",
  CREATE_RECEIVING_NOTE: "Lập phiếu nhập kho",
  CRITICAL: "Nghiêm trọng",
  CUSTOMER: "Khách hàng",
  CUSTOMER_CONFIRMED: "Khách đã xác nhận nhận hàng",
  CUSTOMER_PICKUP: "Khách tự đến kho lấy",
  CUSTOMER_REJECTED: "Khách từ chối",
  CUSTOMER_RESPONDED: "Khách đã chọn cách xử lý",
  CUSTOMS_CLEARED: "Đã thông quan nhập",
  CUSTOMS_EXPORT: "Tờ khai xuất",
  CUSTOMS_EXPORT_PENDING: "Chờ thông quan xuất",
  CUSTOMS_IMPORT: "Tờ khai nhập",
  CUSTOMS_IMPORT_PENDING: "Chờ thông quan nhập",
  CUSTOMS_REJECTED: "Hải quan từ chối",
  DAMAGED: "Hư hỏng",
  DELAYED: "Trễ lịch",
  DELETED: "Đã xoá",
  DELIVERED: "Đã giao",
  DELIVERING: "Đang giao hàng",
  DELIVERY: "Nhân viên giao vận",
  DELIVERY_APPROVED: "Đã duyệt giao hàng",
  DELIVERY_CANCELLED: "Hãng huỷ giao",
  DELIVERY_CONFIRM: "Xác nhận đã nhận hàng",
  DELIVERY_DELAYED: "Giao hàng bị chậm",
  DELIVERY_DISPATCHED: "Đã đặt giao",
  DELIVERY_ERROR: "Hãng báo lỗi giao hàng",
  DELIVERY_FAILED: "Giao chưa thành công",
  DELIVERY_PENDING: "Chờ duyệt giao hàng",
  DELIVERY_PROOF: "Ảnh ký nhận giao hàng",
  DELIVERY_REJECTED: "Từ chối giao hàng",
  DELIVERY_REQUEST: "Yêu cầu giao hàng",
  DELIVERY_RETURNED: "Giao thất bại, hàng đã về lại kho",
  DEPARTED: "Đã khởi hành",
  DEPOSIT: "Tiền cọc",
  DEPOSIT_NOT_CONFIRMED: "Chưa xác nhận tiền cọc",
  DEPOSIT_PAID: "Đã đặt cọc",
  DESTINATION: "Kho đích",
  DESTINATION_RECEIVING: "Kho đích nhận hàng",
  DIRECT_DELIVERY: "Giao ngay khi về VN",
  DISCREPANCY: "Chênh lệch",
  DISCREPANCY_ACK: "Quyết định lệch cân",
  DISPOSAL: "Thanh lý",
  DISPOSE: "Huỷ hàng",
  DISPOSED: "Đã huỷ theo xử lý sự cố",
  DOMESTIC: "Kho nội địa",
  DOMESTIC_FEE: "Phí vận chuyển nội địa",
  DOMESTIC_SHIPPING: "Phí giao nội địa",
  DRAFT: "Nháp",
  ECONOMY: "Tiết kiệm",
  ESTIMATE: "Báo giá tạm tính",
  EXPIRED: "Hết hạn",
  EXPORTED: "Đã xuất kho",
  EXPORT_HOLD: "Đang giữ hàng tại kho nguồn",
  EXPRESS: "Chuyển phát nhanh",
  EXTRA: "Phí phát sinh",
  FAILED: "Thất bại",
  FAILED_DELIVERY: "Giao không thành công",
  FINAL: "Đợt thanh toán cuối",
  FINAL_PAYMENT: "Đợt thanh toán cuối",
  FIXED: "Cố định",
  FRAGILE: "Phụ phí hàng dễ vỡ",
  FREIGHT_ADJUSTMENT: "Điều chỉnh cước",
  FROM_SHELF: "Lấy từ kệ",
  FROM_STAGING: "Lấy từ khu nhận",
  FULL: "Thanh toán một lần",
  FULL_PAYMENT: "Thanh toán một lần",
  GATEWAY_PAYOS: "Cổng payOS",
  GATEWAY_SEPAY: "Cổng SePay",
  GOOD: "Tốt",
  GOODS: "Nhà cung cấp hàng hoá",
  HANDED_OVER: "Đã bàn giao cho hãng vận chuyển",
  HANDOVER_RECORD: "Biên bản bàn giao",
  HOLD: "Đang tạm giữ",
  IMPORT_TAX: "Thuế nhập khẩu",
  INACTIVE: "Ngừng hoạt động",
  INBOUND: "Nhập kho",
  INBOUND_APPROVED: "Đã duyệt nhập kho",
  INBOUND_PENDING: "Chờ duyệt nhập kho",
  INBOUND_PENDING_APPROVAL: "Phiếu nhập kho chờ duyệt",
  INBOUND_REJECTED: "Phiếu nhập kho bị từ chối",
  INCIDENT: "Sự cố",
  INCIDENT_PHOTO: "Ảnh hiện trạng sự cố",
  INDIVIDUAL: "Cá nhân",
  INSPECTION: "Phí kiểm hàng",
  INSURANCE: "Phí bảo hiểm hàng hoá",
  INTACT: "Nguyên vẹn",
  INTERNATIONAL: "Vận chuyển quốc tế",
  INVENTORY_NOT_AVAILABLE: "Kiện không có tồn kho sẵn sàng",
  IN_REVIEW: "Đang xem xét",
  IN_SHIPMENT: "Đã vào lô vận chuyển",
  IN_STOCK: "Đang lưu kho",
  IN_TRANSIT: "Đang vận chuyển",
  IN_TRANSIT_BACK: "Đang trên đường về kho",
  IN_WAREHOUSE: "Đang nằm kho nước ngoài",
  ISSUE: "Có sự cố",
  LOCKED: "Đã khoá",
  LOST: "Thất lạc",
  LOT_CREATED: "Lô mới tạo",
  MAIN_SERVICE: "Cước dịch vụ chính",
  MANAGER: "Quản lý",
  MANIFESTED: "Đã lên manifest",
  MANUAL: "Thủ công (kế toán ghi nhận)",
  MATCHED: "Khớp sổ",
  MERGED: "Đã gộp kiện",
  MIN_DECLARED_VALUE: "Giá trị khai báo tối thiểu",
  MIN_VOLUME: "Thể tích tối thiểu",
  MIN_WEIGHT: "Cân nặng tối thiểu",
  MISSING: "Thiếu hàng",
  MISSING_ITEMS: "Thiếu hàng",
  MOMO: "Ví MoMo",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  NEW: "Mới tạo",
  NONE: "Không cần làm gì",
  NOTIFIED_AWAITING_INBOUND: "Đã báo kho, chờ kho lập phiếu",
  NOTIFY_WAREHOUSE: "Báo kho",
  NOT_IN_STORAGE_ZONE: "Kiện không ở khu lưu kho",
  NOT_RECEIVED: "Kho chưa nhận hàng",
  NOT_REQUIRED: "Không cần duyệt giá",
  NOT_STORED: "Kiện chưa lưu kho",
  NO_DEPOSIT: "Chưa có tiền cọc",
  NO_INVOICE: "Chưa có hoá đơn",
  OCCUPIED: "Đang có hàng",
  OFFICIAL: "Báo giá chính thức",
  OFFLINE: "Tiền mặt",
  ON_HOLD: "Tạm giữ / sự cố",
  OPEN: "Đang mở",
  OPEN_INCIDENT: "Còn sự cố chưa xử lý",
  OPERATIONS: "Quản lý vận hành",
  OPERATIONSMANAGER: "Quản lý vận hành",
  OPERATIONS_MANAGER: "Quản lý vận hành",
  ORDER: "Đơn hàng",
  ORDERED: "Đã đặt NCC",
  ORDER_AUTO_COMPLETED: "Hệ thống tự hoàn tất đơn",
  ORDER_CANCELLED_BY_CUSTOMER: "Khách huỷ đơn",
  ORDER_CLOSED: "Đơn đã đóng",
  ORDER_COMPLETED_BY_CUSTOMER: "Khách xác nhận hoàn tất đơn",
  ORDER_DELIVERED: "Đã giao hàng",
  ORDER_NEED_MORE_INFO: "Yêu cầu bổ sung thông tin",
  ORDER_NOT_QUOTABLE: "Đơn không còn báo giá được",
  ORDER_REJECTED: "Từ chối đơn",
  ORIGIN: "Kho nguồn",
  OTHER: "Khác",
  OUTBOUND: "Khu xuất",
  OUT_FOR_DELIVERY: "Đang giao hàng",
  OVERSIZE: "Phụ phí quá khổ",
  OVERWEIGHT: "Phụ phí quá tải trọng",
  PACKED: "Đã đóng gói",
  PACKING: "Đóng gói",
  PACKING_FEE: "Phí đóng gói",
  PAID: "Đã thanh toán",
  PALLET: "Pallet",
  PARCEL: "Kiện hàng",
  PARCEL_NOT_INSPECTED: "Còn kiện chưa kiểm",
  PARCEL_PHOTO: "Ảnh kiện",
  PARTIAL: "Thanh toán một phần",
  PARTIALLY_DELIVERED: "Đã giao một phần",
  PARTIALLY_PAID: "Thanh toán một phần",
  PARTIALLY_RECEIVED: "Nhận một phần",
  PAYMENT_CONFIRMED: "Đã xác nhận thanh toán",
  PAYMENT_CONFIRMED_DEPOSIT: "Xác nhận tiền cọc",
  PAYMENT_CONFIRMED_FINAL_PAYMENT: "Xác nhận thanh toán đợt cuối",
  PAYMENT_CONFIRMED_FULL_PAYMENT: "Xác nhận thanh toán một lần",
  PAYMENT_CONFIRMED_REDELIVERY_FEE: "Xác nhận phí giao lại",
  PAYMENT_CONFIRMED_STORAGE_FEE: "Xác nhận phí lưu kho",
  PAYMENT_CONFIRMED_UNKNOWN: "Xác nhận một khoản thanh toán",
  PAYMENT_DUE: "Đến hạn thanh toán",
  PAYMENT_RECEIVED_UNALLOCATED: "Nhận tiền chưa phân bổ",
  PAYOS: "Chuyển khoản payOS",
  PENDING: "Đang chờ xử lý",
  PENDINGVERIFICATION: "Chờ xác minh",
  PENDING_APPROVAL: "Chờ duyệt",
  PENDING_CHECKIN: "Chờ kho nước ngoài nhận",
  PENDING_CUSTOMER_CONFIRMATION: "Chờ khách xác nhận",
  PENDING_PRICE_APPROVAL: "Chờ duyệt giá",
  PENDING_RECONCILIATION: "Chờ xác nhận đã nhận tiền mặt",
  PENDING_RETURN: "Chờ hàng quay về",
  PENDING_REVIEW: "Chờ duyệt",
  PENDING_VERIFICATION: "Chờ xác minh",
  PERCENTAGE: "Theo phần trăm",
  PERMIT: "Giấy phép hàng hạn chế",
  PER_CBM: "Theo khối (m³)",
  PER_KG: "Theo kg",
  PER_PRODUCT: "Theo sản phẩm",
  PER_VOLUME: "Theo thể tích",
  PICKED: "Đã bốc sang khu xuất",
  PICKED_UP: "Hãng đã lấy hàng",
  PICKING: "Đang bốc hàng",
  PICKING_ISSUE: "Biên bản sự cố bốc hàng",
  PICKING_UP: "Đơn vị giao đang lấy hàng",
  PICKUP: "Nhà cung cấp lấy hàng",
  PREPAID: "Trừ vào khoản trả trước",
  PREPAID_ADJUSTMENT: "Điều chỉnh khoản trả trước",
  PREPARING: "Đang chuẩn bị",
  PREPARING_EXPORT: "Đang chuẩn bị xuất kho",
  PREPAYMENT: "Phần trả trước đơn mua hộ",
  PREVIEW: "Bản xem trước",
  PRICE_DIFF: "Giá mua thực thấp hơn giá báo",
  PRICE_DIFFERENCE: "Phần chênh giá mua",
  PRICE_DIFF_RETURN: "Trả lại phần chênh giá đã thu",
  PRICE_REJECTED: "Giá bị từ chối",
  PROCESSING: "Đang xử lý",
  PURCHASE: "Mua hộ",
  PURCHASED: "Đã mua hàng",
  PURCHASE_ORDER: "Đơn mua NCC",
  PURCHASE_ORDER_CANCELLED: "Huỷ đơn mua NCC",
  PURCHASE_ORDER_PLACED: "Đã đặt đơn mua NCC",
  PURCHASE_PRICE_DECISION: "Quyết định phần chênh giá",
  PURCHASE_PROOF: "Chứng từ mua hộ",
  PURCHASE_REQUEST: "Yêu cầu mua hộ",
  PURCHASING: "Đang mua hàng",
  PUT_AWAY_PROOF: "Ảnh kiện trong ô kệ",
  QUARANTINE: "Khu cách ly",
  QUARANTINED: "Đang cách ly xử lý sự cố",
  QUOTATION: "Báo giá",
  QUOTATION_ACCEPTED: "Khách chấp nhận báo giá",
  QUOTATION_CONFIRM: "Xác nhận báo giá",
  QUOTATION_CONFIRMED: "Khách đã chốt báo giá",
  QUOTATION_PRICE_APPROVED: "Giá báo giá đã được duyệt",
  QUOTATION_PRICE_REJECTED: "Giá báo giá bị từ chối",
  QUOTATION_REJECTED: "Báo giá bị từ chối",
  QUOTATION_SENT: "Đã gửi báo giá",
  QUOTATION_SUBMITTED_FOR_PRICE_APPROVAL: "Gửi duyệt giá báo giá",
  QUOTED: "Đã báo giá",
  RAIL: "Đường sắt",
  READY: "Đã bốc xong, chờ vào lô",
  READY_TO_SHIP: "Sẵn sàng xuất kho",
  RECEIVE: "Duyệt nhận hàng",
  RECEIVED: "Đã nhận hàng",
  RECEIVED_AT_DESTINATION: "Kho đích đã nhận và kiểm",
  RECEIVED_AT_VN: "Kho Việt Nam đã nhận và kiểm hàng",
  RECEIVED_AT_WAREHOUSE: "Đã về kho, chờ chốt xử lý",
  RECEIVED_UNALLOCATED: "Đã nhận, chưa phân bổ",
  RECEIVING: "Khu nhận hàng",
  RECEIVING_COUNT_APPROVED: "Duyệt kết quả kiểm đếm",
  RECEIVING_COUNT_REJECTED: "Từ chối kết quả kiểm đếm",
  RECEIVING_DISCREPANCY_ACCEPTED: "Chấp nhận chênh lệch kiểm đếm",
  RECEIVING_NOTE: "Phiếu nhập kho",
  RECEIVING_NOTE_APPROVED_TO_RECEIVE: "Duyệt cho nhận hàng",
  RECEIVING_NOTE_COUNTED: "Kho đã kiểm đếm",
  RECEIVING_NOTE_CREATED: "Lập phiếu nhập kho",
  RECEIVING_NOTE_REJECTED: "Từ chối phiếu nhập kho",
  RECEIVING_NOT_SETTLED: "Phiếu nhập kho chưa duyệt xong",
  REDELIVER: "Giao lại cho khách",
  REDELIVERY_FEE: "Phí giao lại",
  REFUNDED: "Đã hoàn tiền",
  REFUND_CANCEL: "Hoàn tiền do huỷ đơn mua",
  REFUND_INCOMING: "Sắp nhận hoàn tiền",
  REFUND_PRICE_DIFF: "Hoàn phần chênh giá mua",
  REFUND_UNFULFILLED: "Hoàn phần không mua được / NCC giao thiếu",
  REJECTED: "Bị từ chối",
  RELEASED: "Đã xuất kho",
  RELOCATION: "Chuyển vị trí",
  REMOTE_AREA: "Phụ phí vùng xa",
  REMOVED: "Bị bỏ khỏi phiếu",
  RENOTIFY_WAREHOUSE: "Báo lại kho",
  REPLACE_PENDING_PRICE_APPROVAL: "Báo giá thay thế chờ duyệt giá",
  REQUIRES_INSPECTION: "Khi cần kiểm hàng",
  RESERVED: "Đã giữ cho phiếu xuất",
  RESOLVED: "Đã xử lý",
  RESTRICTED: "Hạn chế",
  RESTRICTED_NO_PERMIT: "Hàng hạn chế chưa có giấy phép",
  RETAIL: "Khách lẻ",
  RETURNED: "Đã hoàn về kho",
  RETURNED_TO_WAREHOUSE: "Giao không thành, đã hoàn về kho",
  RETURNING: "Đang hoàn về kho",
  ROAD: "Đường bộ",
  SALE: "Nhân viên kinh doanh",
  SALES: "Nhân viên kinh doanh",
  SEA: "Đường biển",
  SEAL_BROKEN: "Rách niêm phong",
  SELLER_SHIPPED: "NCC đã phát hàng",
  SENT: "Đã gửi",
  SENT_TO_CUSTOMER: "Đã gửi khách",
  SEPAY: "Chuyển khoản SePay",
  SERVICE: "Nhà cung cấp dịch vụ",
  SERVICE_FEE: "Phí dịch vụ",
  SHIPMENT: "Lô vận chuyển",
  SHIPPED: "Đã gửi hàng",
  SINGLE: "Xuất một đơn",
  SPLIT: "Đã tách kiện",
  STAFF: "Nhân viên",
  STANDARD: "Tiêu chuẩn",
  STORAGE: "Khu lưu kho",
  STORAGE_FEE: "Phí lưu kho",
  STORED: "Đang lưu kho",
  STORED_AT_VN: "Đang lưu kho VN",
  STORE_AT_VN: "Gửi lại kho VN",
  SUCCESS: "Thành công",
  SUPERSEDED: "Đã có báo giá thay thế",
  SUPPLIER_CONFIRMED: "NCC đã xác nhận",
  SUPPLIER_SHIPPED: "NCC đã phát hàng",
  SUPPLIER_SHORT: "NCC giao thiếu",
  SURCHARGE: "Phụ phí",
  SUSPENDED: "Tạm ngưng",
  SYSTEM_ZERO: "Hệ thống tự xác nhận (0 ₫)",
  TAX: "Thuế",
  TAX_ADJUSTMENT: "Điều chỉnh thuế",
  TAX_RECEIPT: "Biên lai thuế",
  TRANSIT: "Trung chuyển",
  UNFULFILLED: "Không mua được",
  UNPAID: "Chưa thanh toán",
  VAT: "Thuế VAT",
  VAT_ADJUSTMENT: "Điều chỉnh VAT",
  VNPAY: "VNPay",
  VN_WAREHOUSE: "Kho Việt Nam",
  VOLUMETRIC_DIVISOR: "Hệ số quy đổi thể tích",
  WAITING_DEPOSIT: "Chờ đặt cọc",
  WAITING_FINAL_PAYMENT: "Chờ thanh toán cuối",
  WAITING_PAYMENT: "Chờ thanh toán",
  WAITING_QUOTATION: "Chờ báo giá",
  WAITING_STORED: "Chờ nhập kho",
  WALLET: "Ví điện tử",
  WAREHOUSE: "Nhân viên kho",
  WAREHOUSEMANAGER: "Quản lý kho",
  WAREHOUSESTAFF: "Nhân viên kho",
  WAREHOUSETQ: "Nhân viên kho nước ngoài",
  WAREHOUSEVN: "Nhân viên kho Việt Nam",
  WAREHOUSE_MANAGER: "Quản lý kho",
  WAREHOUSE_RECEIVED: "Đã lưu kho",
  WAREHOUSE_STAFF: "Nhân viên kho",
  WAREHOUSE_STAFF_VN: "Nhân viên kho Việt Nam",
  WARNING: "Cảnh báo",
  WAYBILL: "Vận đơn",
  WEIGHT_DEVIATION: "Cân lệch bất thường",
  WET: "Ẩm ướt",
  WOODEN_BOX: "Thùng gỗ",
  WOOD_CRATE: "Phí đóng thùng gỗ",
  WRO: "Phiếu xuất kho",
  WRONG_ITEM: "Sai hàng",
  WRONG_WAREHOUSE: "Kiện không nằm ở kho nguồn của tuyến",
  WRO_APPROVAL_PROOF: "Ảnh hiện trạng lúc duyệt xuất",
  WRO_PARCEL: "Kiện trong phiếu xuất",
});
