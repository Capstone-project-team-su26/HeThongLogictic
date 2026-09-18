/* =========================================================
   timeUtc.js
   Chuẩn hóa thời gian UTC+0 cho React/Vite/API

   Mục tiêu:
   - API trả "2026-07-01T04:26:34.9714508" vẫn convert đúng.
   - API trả "2026-07-01T04:26:34Z" vẫn đúng.
   - API trả "2026-07-01T04:26:34+07:00" vẫn đúng.
   - Browser ở Việt Nam, Mỹ, Nhật... đều hiển thị đúng local time.
   - Có thể kiểm tra lệch giờ máy so với giờ server.
   ========================================================= */

/* API của bạn nếu trả DateTime KHÔNG có Z, ví dụ:
   "2026-07-01T04:26:34.9714508"

   Nếu backend lưu UTC thì để "utc".
   Nếu backend trả giờ local Việt Nam thì đổi thành "local".
*/
export const DEFAULT_API_TIME_MODE = "utc";

/* Sai số giờ máy so với server.
   Ví dụ máy user chạy sai 2 phút thì mình cộng/trừ lại.
*/
let serverClockOffsetMs = 0;
let lastServerSyncAt = null;

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

const isNil = (value) => value === null || value === undefined || value === "";

const isValidDate = (date) => {
  return date instanceof Date && !Number.isNaN(date.getTime());
};

const hasTimezoneInfo = (value) => {
  if (typeof value !== "string") return false;

  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
};

const normalizeOffsetColon = (value) => {
  if (typeof value !== "string") return value;

  /* Convert +0700 -> +07:00 */
  return value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
};

const trimLongMilliseconds = (value) => {
  if (typeof value !== "string") return value;

  /* JS Date chỉ hỗ trợ milliseconds 3 số.
     .NET đôi khi trả .9714508 nên cần cắt thành .971
  */
  return value.replace(
    /(\.\d{3})\d+(?=Z|z|[+-]\d{2}:?\d{2}|$)/,
    "$1"
  );
};

const normalizeDateString = (value, apiTimeMode = DEFAULT_API_TIME_MODE) => {
  if (typeof value !== "string") return value;

  let text = value.trim();

  if (!text) return text;

  /* Cho phép API trả dạng "2026-07-01 04:26:34" */
  text = text.replace(" ", "T");

  text = trimLongMilliseconds(text);
  text = normalizeOffsetColon(text);

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);

  if (isDateOnly) {
    if (apiTimeMode === "utc") {
      return `${text}T00:00:00.000Z`;
    }

    return `${text}T00:00:00`;
  }

  /* Nếu API đã có Z hoặc +07:00 thì giữ nguyên */
  if (hasTimezoneInfo(text)) {
    return text;
  }

  /* Nếu API trả thiếu timezone:
     - utc: hiểu chuỗi đó là UTC+0
     - local: hiểu chuỗi đó là giờ local theo máy/browser
  */
  if (apiTimeMode === "utc") {
    return `${text}Z`;
  }

  return text;
};

/* =========================================================
   CORE PARSE / CONVERT
   ========================================================= */

/**
 * Convert mọi kiểu input thành Date object.
 *
 * @param {string | number | Date | null | undefined} value
 * @param {{ apiTimeMode?: "utc" | "local" }} options
 * @returns {Date | null}
 */
export const toDate = (value, options = {}) => {
  const { apiTimeMode = DEFAULT_API_TIME_MODE } = options;

  if (isNil(value)) return null;

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }

  if (typeof value === "string") {
    const normalized = normalizeDateString(value, apiTimeMode);
    const date = new Date(normalized);

    return isValidDate(date) ? date : null;
  }

  return null;
};

/**
 * Convert thời gian API sang ISO UTC chuẩn.
 * Output luôn dạng: 2026-07-01T04:26:34.971Z
 */
export const apiToUtcIso = (apiTime, options = {}) => {
  const date = toDate(apiTime, options);

  if (!date) return null;

  return date.toISOString();
};

/**
 * Convert thời gian API sang timestamp milliseconds.
 */
export const apiToTimestamp = (apiTime, options = {}) => {
  const date = toDate(apiTime, options);

  if (!date) return null;

  return date.getTime();
};

/**
 * Convert thời gian API sang Date object UTC.
 * Lưu ý: Date trong JS luôn là timestamp, không giữ timezone riêng.
 */
export const apiToDate = (apiTime, options = {}) => {
  return toDate(apiTime, options);
};

/* =========================================================
   FORMAT HIỂN THỊ
   ========================================================= */

/**
 * Hiển thị theo timezone của trình duyệt/máy người dùng.
 */
export const formatLocalDateTime = (value, options = {}) => {
  const {
    locale = "vi-VN",
    apiTimeMode = DEFAULT_API_TIME_MODE,
    fallback = "--",
    dateStyle,
    timeStyle,
  } = options;

  const date = toDate(value, { apiTimeMode });

  if (!date) return fallback;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: dateStyle || "short",
    timeStyle: timeStyle || "short",
  }).format(date);
};

/**
 * Hiển thị ngày giờ theo UTC+0.
 */
export const formatUtcDateTime = (value, options = {}) => {
  const {
    locale = "vi-VN",
    apiTimeMode = DEFAULT_API_TIME_MODE,
    fallback = "--",
    dateStyle,
    timeStyle,
  } = options;

  const date = toDate(value, { apiTimeMode });

  if (!date) return fallback;

  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    dateStyle: dateStyle || "short",
    timeStyle: timeStyle || "medium",
  }).format(date);
};

/**
 * Format đẹp cho Việt Nam.
 */
export const formatVietnamDateTime = (value, options = {}) => {
  const {
    apiTimeMode = DEFAULT_API_TIME_MODE,
    fallback = "--",
  } = options;

  const date = toDate(value, { apiTimeMode });

  if (!date) return fallback;

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};

/**
 * Dùng cho input type="datetime-local"
 */
export const toDateTimeLocalInputValue = (value, options = {}) => {
  const { apiTimeMode = DEFAULT_API_TIME_MODE } = options;

  const date = toDate(value, { apiTimeMode });

  if (!date) return "";

  const pad = (num) => String(num).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
};

/* =========================================================
   LOCAL -> UTC API
   ========================================================= */

/**
 * Convert giờ local của máy/browser sang UTC ISO để gửi API.
 *
 * Ví dụ input type="datetime-local" trả:
 * "2026-07-01T10:30"
 *
 * Output:
 * "2026-07-01T03:30:00.000Z" nếu browser đang ở GMT+7.
 */
export const localToUtcIso = (localValue) => {
  if (isNil(localValue)) return null;

  const date = localValue instanceof Date
    ? localValue
    : new Date(localValue);

  if (!isValidDate(date)) return null;

  return date.toISOString();
};

/**
 * Lấy thời gian hiện tại UTC theo máy.
 */
export const getBrowserNowUtcIso = () => {
  return new Date().toISOString();
};

/**
 * Lấy thời gian hiện tại UTC đã bù lệch theo server.
 * Dùng khi máy user bị sai giờ.
 */
export const getSyncedNowUtcIso = () => {
  return new Date(Date.now() + serverClockOffsetMs).toISOString();
};

/**
 * Lấy Date hiện tại đã bù lệch theo server.
 */
export const getSyncedNowDate = () => {
  return new Date(Date.now() + serverClockOffsetMs);
};

/* =========================================================
   BROWSER TIMEZONE INFO
   ========================================================= */

/**
 * Kiểm tra timezone hiện tại của trình duyệt/máy.
 */
export const getBrowserTimeInfo = () => {
  const now = new Date();

  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";

  const offsetMinutes = now.getTimezoneOffset();

  /* getTimezoneOffset:
     Việt Nam UTC+7 sẽ trả -420.
     Mình đảo lại để dễ đọc: UTC+7 => 420.
  */
  const utcOffsetMinutes = -offsetMinutes;

  const sign = utcOffsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(utcOffsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const minutes = String(absMinutes % 60).padStart(2, "0");

  return {
    timeZone,
    offsetMinutes,
    utcOffsetMinutes,
    utcOffsetText: `UTC${sign}${hours}:${minutes}`,
    browserLocalTime: now.toString(),
    browserUtcTime: now.toISOString(),
  };
};

/**
 * Kiểm tra browser có đang ở timezone Việt Nam không.
 */
export const isVietnamTimezone = () => {
  const info = getBrowserTimeInfo();

  return (
    info.timeZone === "Asia/Ho_Chi_Minh" ||
    info.utcOffsetText === "UTC+07:00"
  );
};

/* =========================================================
   SERVER CLOCK SYNC
   ========================================================= */

/**
 * Đồng bộ lệch giờ với server.
 *
 * Truyền vào thời gian server dạng:
 * - response.headers.date
 * - hoặc field API trả về: serverTimeUtc
 *
 * Ví dụ:
 * syncServerClock("Wed, 01 Jul 2026 04:26:34 GMT")
 * syncServerClock("2026-07-01T04:26:34.971Z")
 */
export const syncServerClock = (serverTime) => {
  const serverDate = toDate(serverTime, {
    apiTimeMode: "utc",
  });

  if (!serverDate) {
    return {
      ok: false,
      message: "Invalid server time",
      serverClockOffsetMs,
      lastServerSyncAt,
    };
  }

  const browserNowMs = Date.now();
  const serverNowMs = serverDate.getTime();

  serverClockOffsetMs = serverNowMs - browserNowMs;
  lastServerSyncAt = new Date();

  return {
    ok: true,
    serverTimeUtc: serverDate.toISOString(),
    browserTimeUtc: new Date(browserNowMs).toISOString(),
    offsetMs: serverClockOffsetMs,
    offsetSeconds: Math.round(serverClockOffsetMs / 1000),
    lastServerSyncAt: lastServerSyncAt.toISOString(),
  };
};

/**
 * Lấy trạng thái lệch giờ hiện tại.
 */
export const getServerClockStatus = () => {
  return {
    offsetMs: serverClockOffsetMs,
    offsetSeconds: Math.round(serverClockOffsetMs / 1000),
    lastServerSyncAt: lastServerSyncAt
      ? lastServerSyncAt.toISOString()
      : null,
    browser: getBrowserTimeInfo(),
    syncedNowUtc: getSyncedNowUtcIso(),
  };
};

/**
 * Reset bù lệch giờ server.
 */
export const resetServerClockSync = () => {
  serverClockOffsetMs = 0;
  lastServerSyncAt = null;
};

/* =========================================================
   SAFE COMPARE
   ========================================================= */

/**
 * So sánh thời gian API với hiện tại đã sync server.
 *
 * return:
 * - -1 nếu apiTime < now
 * - 0 nếu bằng
 * - 1 nếu apiTime > now
 */
export const compareApiTimeWithNow = (apiTime, options = {}) => {
  const date = toDate(apiTime, options);

  if (!date) return null;

  const target = date.getTime();
  const now = getSyncedNowDate().getTime();

  if (target < now) return -1;
  if (target > now) return 1;
  return 0;
};

export const isApiTimeExpired = (apiTime, options = {}) => {
  const result = compareApiTimeWithNow(apiTime, options);

  if (result === null) return false;

  return result < 0;
};

export const isApiTimeFuture = (apiTime, options = {}) => {
  const result = compareApiTimeWithNow(apiTime, options);

  if (result === null) return false;

  return result > 0;
};

/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

const timeUtc = {
  DEFAULT_API_TIME_MODE,

  toDate,
  apiToDate,
  apiToUtcIso,
  apiToTimestamp,

  formatLocalDateTime,
  formatUtcDateTime,
  formatVietnamDateTime,
  toDateTimeLocalInputValue,

  localToUtcIso,
  getBrowserNowUtcIso,
  getSyncedNowUtcIso,
  getSyncedNowDate,

  getBrowserTimeInfo,
  isVietnamTimezone,

  syncServerClock,
  getServerClockStatus,
  resetServerClockSync,

  compareApiTimeWithNow,
  isApiTimeExpired,
  isApiTimeFuture,
};

export default timeUtc;