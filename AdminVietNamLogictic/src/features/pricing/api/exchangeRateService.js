/**
 * MOCK tỷ giá hối đoái — bản chỉ-giao-diện.
 *
 * Tầng HTTP đã bị gỡ: không axiosInstance, không API_ENDPOINTS, không token.
 * Dữ liệu lấy từ bộ mẫu `exchangeRates` trong @/mocks/data/catalog — CÙNG MỘT
 * mảng mà mock adminService đang CRUD, nên tỷ giá admin vừa sửa/thêm sẽ hiện
 * ngay ở SaleDashboard, ServicePricings và modal báo giá mua hộ.
 *
 * Hai bộ chuẩn hoá `normalizeExchangeRateItem` / `normalizeConvertResult` giữ
 * nguyên từng dòng của bản thật, vì chúng cũng là export công khai và là thứ
 * quyết định hình dạng bản ghi mà component destructure
 * (currencyCode, currencyName, rateToVnd, isActive, id / amountVnd, exchangeRate).
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm bên dưới có khối "// [API THẬT]" ghi rõ endpoint
 * và tham số cũ. Chỉ cần thay phần đọc `exchangeRateFixtures` bằng lời gọi
 * axiosInstance rồi đẩy kết quả qua đúng normalize* đang có là xong — phần
 * validate tham số và lọc activeOnly phía dưới dùng lại được nguyên vẹn.
 */

import { exchangeRates as exchangeRateFixtures } from "@/mocks/data/catalog";
import { createApiError, deepClone, delay } from "@/mocks/mockUtils";

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
   HELPERS
========================================================= */

const normalizeText = (value) => String(value ?? "").trim();

const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/*
 * VND không có phần thập phân, nên số tiền quy đổi làm tròn về đồng.
 * Bản thật cũng trả số nguyên; nếu để lẻ thì ô "Giá VND" của modal báo giá
 * hiện số rác kiểu 38.799999999999997.
 */
const roundVnd = (value) => Math.round(normalizeNumber(value, 0));

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
  *
  * @param {Object} options
  * @param {boolean} [options.activeOnly=true] Chỉ lấy các tỷ giá đang hoạt động
  * @returns {Promise<Array>} mảng trần đã chuẩn hoá (không bọc { items })
  */
export const getExchangeRatesApi = async (options = {}) => {
  const activeOnly = options?.activeOnly !== false;

  // [API THẬT] GET API_ENDPOINTS.exchangeRates.list?activeOnly=<activeOnly>
  await delay(200, options?.signal);

  /*
   * Bộ mẫu cố tình có cả tỷ giá đã tắt (THB, GBP, AUD, MYR) để nhánh
   * activeOnly có tác dụng thấy được: thẻ tỷ giá ở ServicePricings đều gắn
   * Tag "Active" nên chỉ được đổ về bản ghi đang bật.
   */
  const rows = activeOnly
    ? exchangeRateFixtures.filter((rate) => rate?.isActive !== false)
    : exchangeRateFixtures;

  return deepClone(rows).map(normalizeExchangeRateItem);
};

/**
  * Quy đổi số tiền từ ngoại tệ sang Việt Nam Đồng (VND).
  *
  * @param {string|Object} currencyOrParams Mã tiền tệ (KRW, USD, CNY, JPY) hoặc object { currency, amount }
  * @param {number} [amountValue] Số lượng ngoại tệ cần quy đổi
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

  // [API THẬT] GET API_ENDPOINTS.exchangeRates.convert?currency=<currency>&amount=<amount>
  await delay(220);

  const found = exchangeRateFixtures.find(
    (rate) => normalizeUpperText(rate?.currencyCode) === currency
  );

  const exchangeRate = normalizeNumber(found?.rateToVnd, 0);

  /*
   * Tiền tệ chưa có trong bảng (hoặc đã tắt) thì bản thật trả lỗi. Giữ đúng
   * việc ném lỗi để nhánh catch của SaleDashboard và modal báo giá — nhánh tự
   * nhân tay bằng rateToVnd lấy từ danh sách đã tải — vẫn còn đường chạy.
   */
  if (!found || found?.isActive === false || exchangeRate <= 0) {
    throw createApiError(
      404,
      `Không thể quy đổi số tiền cho tiền tệ ${currency}.`
    );
  }

  return normalizeConvertResult({
    currency,
    exchangeRate,
    amountOriginal: amount,
    amountVnd: roundVnd(amount * exchangeRate),
  });
};
