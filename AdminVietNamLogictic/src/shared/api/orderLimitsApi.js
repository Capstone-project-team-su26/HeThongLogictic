/* =========================================================
   orderLimitsApi — API THẬT giới hạn tạo đơn ký gửi / mua hộ do Admin cấu hình.

   GET /api/system-settings/order-limits          (mọi tài khoản đăng nhập)
     → { message, data: { consignment, purchase, items[], updatedAt, updatedByName } }
   PUT /api/system-settings/order-limits          (chỉ Admin)
     body { items: [{ key, value }], note? } — value null = không giới hạn
   GET /api/system-settings/order-limits/history  (chỉ Admin) → nhật ký ai sửa, lúc nào

   Form tạo đơn (Sale tạo hộ ký gửi / mua hộ) dùng getOrderLimitsApi: KHÔNG BAO GIỜ ném
   lỗi (trừ huỷ request) — tải lỗi thì mọi giới hạn = null, form không chặn theo số cũ đã
   có thể lỗi thời, backend vẫn kiểm và trả 400 nêu đúng giới hạn hiện hành.
   ========================================================= */

import httpClient, { isCanceledRequest } from "@shared/api/httpClient";
import { getResponseData } from "@shared/api/apiEnvelope";

export const ORDER_LIMITS_ENDPOINT = "/api/system-settings/order-limits";
export const ORDER_LIMITS_HISTORY_ENDPOINT = "/api/system-settings/order-limits/history";

/** Không giới hạn gì — dùng khi chưa tải xong hoặc tải lỗi. */
export const NO_ORDER_LIMITS = Object.freeze({
  consignment: Object.freeze({
    maxParcelWeightKg: null,
    maxParcelLengthCm: null,
    maxParcelWidthCm: null,
    maxParcelHeightCm: null,
    maxParcelQuantity: null,
    maxItemDeclaredValue: null,
    maxTotalWeightKg: null,
    maxTotalDeclaredValue: null,
    maxPackages: null,
  }),
  purchase: Object.freeze({
    maxItems: null,
    maxItemQuantity: null,
  }),
});

/** Số dương hữu hạn thì giữ, còn lại (null, 0, âm, chữ) coi là không giới hạn. */
export const toOrderLimit = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const pickLimits = (source, template) =>
  Object.freeze(
    Object.fromEntries(Object.keys(template).map((key) => [key, toOrderLimit(source?.[key])])),
  );

/** Chuẩn hoá body backend (có hoặc không bọc { data }) về đúng hình NO_ORDER_LIMITS. */
export const normalizeOrderLimits = (body) => {
  const payload = getResponseData(body);

  return Object.freeze({
    consignment: pickLimits(payload?.consignment, NO_ORDER_LIMITS.consignment),
    purchase: pickLimits(payload?.purchase, NO_ORDER_LIMITS.purchase),
  });
};

/** Form tạo đơn: giới hạn đang áp dụng; lỗi → NO_ORDER_LIMITS + loaded = false. */
export const getOrderLimitsApi = async (options = {}) => {
  try {
    const response = await httpClient.get(ORDER_LIMITS_ENDPOINT, { signal: options?.signal });
    return { ...normalizeOrderLimits(response), loaded: true };
  } catch (error) {
    if (isCanceledRequest(error)) throw error;

    console.warn(
      "Không tải được giới hạn tạo đơn, để backend kiểm:",
      error?.response?.data?.message || error?.message,
    );
    return { ...NO_ORDER_LIMITS, loaded: false };
  }
};

/* ---------------- Trang Admin ---------------- */

const normalizeItem = (item = {}) => ({
  key: String(item.key ?? ""),
  scope: String(item.scope ?? ""),
  label: String(item.label ?? item.key ?? ""),
  unit: String(item.unit ?? ""),
  description: String(item.description ?? ""),
  value: toOrderLimit(item.value),
  defaultValue: toOrderLimit(item.defaultValue),
  allowUnlimited: item.allowUnlimited === true,
  isInteger: item.isInteger === true,
  minValue: Number(item.minValue) || 0,
  maxValue: Number(item.maxValue) || 0,
  updatedAt: item.updatedAt ?? null,
  updatedByName: item.updatedByName ?? null,
});

/** Trang Admin: đủ nhãn, đơn vị, khoảng hợp lệ, người sửa. Lỗi thì NÉM để trang báo. */
export const getOrderLimitSettingsApi = async (options = {}) => {
  const response = await httpClient.get(ORDER_LIMITS_ENDPOINT, { signal: options?.signal });
  const payload = getResponseData(response) || {};

  return {
    items: Array.isArray(payload.items) ? payload.items.map(normalizeItem) : [],
    updatedAt: payload.updatedAt ?? null,
    updatedByName: payload.updatedByName ?? null,
  };
};

/**
 * Admin lưu một hoặc nhiều giới hạn. `values` = { KEY: number | null } (null = không giới hạn).
 * Trả về cấu hình mới (cùng hình getOrderLimitSettingsApi).
 */
export const updateOrderLimitSettingsApi = async (values = {}, note = "") => {
  const items = Object.entries(values).map(([key, value]) => ({
    key,
    value: value === null || value === undefined || value === "" ? null : Number(value),
  }));
  const body = { items };
  if (String(note ?? "").trim()) body.note = String(note).trim();

  const response = await httpClient.put(ORDER_LIMITS_ENDPOINT, body);
  const payload = getResponseData(response) || {};

  return {
    message: response?.data?.message || "Đã cập nhật giới hạn đơn hàng.",
    items: Array.isArray(payload.items) ? payload.items.map(normalizeItem) : [],
    updatedAt: payload.updatedAt ?? null,
    updatedByName: payload.updatedByName ?? null,
  };
};

/** Nhật ký thay đổi (mới nhất trước). */
export const getOrderLimitHistoryApi = async (take = 20, options = {}) => {
  const response = await httpClient.get(ORDER_LIMITS_HISTORY_ENDPOINT, {
    params: { take },
    signal: options?.signal,
  });
  const payload = getResponseData(response);

  return (Array.isArray(payload) ? payload : []).map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label || row.key,
    unit: row.unit || "",
    oldValue: toOrderLimit(row.oldValue),
    newValue: toOrderLimit(row.newValue),
    changedAt: row.changedAt ?? null,
    changedByName: row.changedByName ?? null,
    note: row.note ?? null,
  }));
};

/** Câu lỗi tiếng Việt từ response backend. */
export const getOrderLimitsApiError = (error, fallback = "Không lưu được giới hạn đơn hàng.") =>
  error?.response?.data?.message ||
  error?.response?.data?.title ||
  (error?.response ? fallback : "Không kết nối được máy chủ. Vui lòng thử lại.");
