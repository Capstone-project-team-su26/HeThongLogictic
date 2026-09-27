/**
 * Tỷ giá hối đoái — API THẬT (ExchangeRateController).
 *
 *   GET /api/exchange-rates?activeOnly=true  → MẢNG TRẦN ExchangeRateDto
 *       { id, currencyCode, currencyName, rateToVnd, isActive, note, createdAt, updatedAt }
 *   GET /api/exchange-rates/convert?currency=&amount=  (Admin/Sale/OM)
 *       → { currency, exchangeRate, amountOriginal, amountVnd } — amountVnd làm tròn về đồng
 *         (MidpointRounding.AwayFromZero); 404 { message } khi chưa cấu hình mã,
 *         400 { message } khi tỷ giá đang tắt / ≤ 0.
 *
 * Danh sách đọc lại qua catalogAdminService.getExchangeRates (cùng hàm trang danh mục tỷ giá
 * đang dùng) rồi chuẩn hoá về đúng hình dạng cũ mà ServicePricings và modal báo giá mua hộ
 * destructure. Bản mock cũ (fixture @/mocks/data/catalog) nằm ở exchangeRateService.mock.js.
 *
 * TIỀN: không có tỷ giá mặc định nào ở đây. Mã không có tỷ giá đang bật thì
 * findActiveExchangeRate trả null / convertCurrencyApi ném lỗi — màn hình phải chặn gửi.
 */
import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getResponseData } from "@shared/api/apiEnvelope";
import { getExchangeRates } from "@features/catalog/api/catalogAdminService";

/* =========================================================
   CONSTANTS
========================================================= */

export const CURRENCY_CODES = {
  CNY: "CNY",
  JPY: "JPY",
  KRW: "KRW",
  USD: "USD",
  VND: "VND",
};

/* Chỉ để hiện tên khi backend không gửi currencyName — không dính tới số tiền. */
export const CURRENCY_NAMES = {
  CNY: "Nhân dân tệ",
  JPY: "Yên Nhật",
  KRW: "Won Hàn Quốc",
  USD: "Đô la Mỹ",
  VND: "Việt Nam Đồng",
};

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (value) => String(value ?? "").trim();

const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/* =========================================================
   NORMALIZERS
========================================================= */

export const normalizeExchangeRateItem = (item = {}) => {
  const currencyCode = normalizeUpperText(item?.currencyCode ?? item?.currency);

  return {
    id: item?.id ?? "",
    currencyCode,
    currencyName:
      item?.currencyName || CURRENCY_NAMES[currencyCode] || currencyCode,
    rateToVnd: normalizeNumber(item?.rateToVnd ?? item?.exchangeRate, 0),
    isActive: item?.isActive !== false,
    note: item?.note ?? "",
    createdAt: item?.createdAt ?? null,
    updatedAt: item?.updatedAt ?? null,
  };
};

export const normalizeConvertResult = (data = {}) => {
  const currency = normalizeUpperText(data?.currency);
  const exchangeRate = normalizeNumber(data?.exchangeRate, 0);
  const amountOriginal = normalizeNumber(data?.amountOriginal, 0);
  const amountVnd = normalizeNumber(
    data?.amountVnd,
    amountOriginal * exchangeRate
  );

  return {
    currency,
    currencyName: CURRENCY_NAMES[currency] || currency,
    exchangeRate,
    amountOriginal,
    amountVnd,
  };
};

/**
 * Tìm tỷ giá ĐANG BẬT, > 0 của một mã trong danh sách đã tải. Không có → null
 * (không bao giờ trả số mặc định).
 */
export const findActiveExchangeRate = (rates, currencyCode) => {
  const code = normalizeUpperText(currencyCode);

  if (!code || !Array.isArray(rates)) return null;

  const found = rates.find(
    (rate) => normalizeUpperText(rate?.currencyCode) === code
  );

  if (!found || found.isActive === false || !(Number(found.rateToVnd) > 0)) {
    return null;
  }

  return found;
};

/**
 * Quy đổi ngoại tệ → VND đúng cách backend làm khi lưu báo giá
 * (Math.Round(amount × rate, 0, AwayFromZero) — với số dương trùng Math.round).
 * Chỉ để HIỂN THỊ; backend tự quy đổi lại từ tỷ giá của nó.
 */
export const convertToVndWithRate = (amount, rateToVnd) => {
  const value = Number(amount);
  const rate = Number(rateToVnd);

  if (!Number.isFinite(value) || !Number.isFinite(rate) || value <= 0 || rate <= 0) {
    return 0;
  }

  return Math.round(value * rate);
};

/* =========================================================
   API METHODS
========================================================= */

/**
 * Lấy danh sách tỷ giá hối đoái (API thật).
 *
 * @param {{ activeOnly?: boolean, signal?: AbortSignal }} [options] activeOnly mặc định true
 * @returns {Promise<Array>} mảng trần đã chuẩn hoá
 */
export const getExchangeRatesApi = async (options = {}) => {
  const activeOnly = options?.activeOnly !== false;

  const rows = await getExchangeRates({ activeOnly, signal: options?.signal });

  return rows
    .map(normalizeExchangeRateItem)
    .filter((rate) => (activeOnly ? rate.isActive : true));
};

/**
 * Quy đổi số tiền từ ngoại tệ sang VND (API thật GET /api/exchange-rates/convert).
 *
 * @param {string|Object} currencyOrParams Mã tiền tệ hoặc { currency, amount }
 * @param {number} [amountValue]
 * @returns {Promise<Object>} { currency, currencyName, exchangeRate, amountOriginal, amountVnd }
 */
export const convertCurrencyApi = async (currencyOrParams, amountValue) => {
  let currency;
  let amount;

  if (typeof currencyOrParams === "object" && currencyOrParams !== null) {
    currency = normalizeUpperText(currencyOrParams.currency);
    amount = normalizeNumber(currencyOrParams.amount, 0);
  } else {
    currency = normalizeUpperText(currencyOrParams);
    amount = normalizeNumber(amountValue, 0);
  }

  if (!currency) {
    throw new Error("Vui lòng cung cấp mã tiền tệ cần quy đổi (VD: KRW, USD, CNY, JPY).");
  }

  if (amount <= 0) {
    throw new Error("Số tiền cần quy đổi phải lớn hơn 0.");
  }

  const response = await httpClient.get(API_ENDPOINTS.exchangeRates.convert, {
    params: { currency, amount },
    signal: currencyOrParams?.signal,
  });

  const result = normalizeConvertResult(getResponseData(response));

  if (!(result.exchangeRate > 0)) {
    throw new Error(`Không thể quy đổi số tiền cho tiền tệ ${currency}.`);
  }

  return result;
};
