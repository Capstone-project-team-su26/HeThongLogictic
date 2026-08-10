import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

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

export const CURRENCY_NAMES = {
  CNY: "Nhân dân tệ",
  JPY: "Yên Nhật",
  KRW: "Won Hàn Quốc",
  USD: "Đô la Mỹ",
  VND: "Việt Nam Đồng",
};

/* =========================================================
   RESPONSE / AUTH HELPERS
========================================================= */

const getResponseData = (response) =>
  response?.data?.data ?? response?.data ?? null;

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error("Không tìm thấy token. Vui lòng đăng nhập lại.");
  }

  return token;
};

const getAuthHeaders = () => ({
  Accept: "*/*",
  Authorization: `Bearer ${getAccessToken()}`,
});

const normalizeText = (value) => String(value ?? "").trim();

const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getApiErrorMessage = (error, defaultMessage) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.title ||
    error?.message ||
    defaultMessage
  );
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
    isActive: Boolean(item?.isActive ?? true),
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

/* =========================================================
   API METHODS
========================================================= */

/**
  * Lấy danh sách tỷ giá hối đoái.
  * GET /api/exchange-rates?activeOnly=true
  *
  * @param {Object} options
  * @param {boolean} [options.activeOnly=true] Chỉ lấy các tỷ giá đang hoạt động
  */
export const getExchangeRatesApi = async (options = {}) => {
  const activeOnly = options?.activeOnly !== false;

  try {
    const response = await axiosInstance.get(API_ENDPOINTS.exchangeRates.list, {
      params: { activeOnly },
      headers: getAuthHeaders(),
    });

    const data = getResponseData(response);
    const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

    return list.map(normalizeExchangeRateItem);
  } catch (error) {
    console.error("GET EXCHANGE RATES ERROR:", error);
    throw new Error(
      getApiErrorMessage(error, "Không thể lấy danh sách tỷ giá hối đoái."),
      { cause: error }
    );
  }
};

/**
  * Quy đổi số tiền từ ngoại tệ sang Việt Nam Đồng (VND).
  * GET /api/exchange-rates/convert?currency=KRW&amount=2
  *
  * @param {string|Object} currencyOrParams Mã tiền tệ (KRW, USD, CNY, JPY) hoặc object { currency, amount }
  * @param {number} [amountValue] Số lượng ngoại tệ cần quy đổi
  */
export const convertCurrencyApi = async (currencyOrParams, amountValue) => {
  let currency = "";
  let amount = 0;

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

  try {
    const response = await axiosInstance.get(API_ENDPOINTS.exchangeRates.convert, {
      params: {
        currency,
        amount,
      },
      headers: getAuthHeaders(),
    });

    const data = getResponseData(response);

    return normalizeConvertResult(data);
  } catch (error) {
    console.error("CONVERT CURRENCY ERROR:", error);
    throw new Error(
      getApiErrorMessage(error, `Không thể quy đổi số tiền cho tiền tệ ${currency}.`),
      { cause: error }
    );
  }
};
