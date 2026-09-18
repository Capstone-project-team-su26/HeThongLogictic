/* =========================================================
   apiEnvelope.js — bóc vỏ response của backend VCL.

   Backend không thống nhất MỘT kiểu bọc (xem huong-dan-ghep-api/README.md §2),
   nên mọi module api/ đã nối thật đều đi qua ba hàm dưới đây thay vì mỗi chỗ
   tự `response.data.data ?? response.data`:

   | Kiểu bọc                                   | Ví dụ endpoint                          |
   |--------------------------------------------|-----------------------------------------|
   | { message, data }                          | đa số API nghiệp vụ                     |
   | { message, data: { items, totalCount... } }| danh sách phân trang                    |
   | { items: [...] }                           | /api/warehouses/active                  |
   | object / mảng TRẦN                         | login, /api/User/profile,               |
   |                                            | /api/pricing-rules, /api/service-pricings,|
   |                                            | /api/package-configurations             |

   QUAN TRỌNG: getResponseData chỉ bóc thêm một tầng khi `data` thật sự tồn tại.
   Payload đăng nhập là object trần và TUYỆT ĐỐI không được có khoá `data` —
   Login.jsx còn tự bóc `response?.data?.data ?? response?.data ?? response`.
   ========================================================= */

/** Bóc `{ message, data }` về chính `data`; response trần thì giữ nguyên. */
export const getResponseData = (response) => {
  const body = response?.data ?? response;

  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "data")
  ) {
    return body.data;
  }

  return body;
};

/**
 * Lấy MẢNG ra khỏi mọi kiểu bọc: mảng trần, { items }, { data: [...] },
 * { data: { items } }, hoặc các tên mảng khác backend từng dùng.
 */
export const getArrayItems = (payload) => {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  for (const key of ["items", "data", "results", "records", "content"]) {
    const value = payload[key];

    if (Array.isArray(value)) return value;

    if (value && typeof value === "object") {
      const nested = getArrayItems(value);

      if (nested.length > 0) return nested;
    }
  }

  return [];
};

/**
 * Chuẩn hoá khối phân trang `{ items, totalCount, pageNumber, pageSize, totalPages }`.
 * Backend thiếu trường nào thì suy lại từ những trường còn có, để component không
 * phải phòng thủ thêm lần nữa.
 *
 * @param {unknown} payload dữ liệu đã qua getResponseData
 * @param {{ pageNumber?: number, pageSize?: number }} [fallback] tham số đã gửi đi
 */
export const getPagedData = (payload, fallback = {}) => {
  const items = getArrayItems(payload);

  const source =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : {};

  const toPositiveInt = (value, defaultValue) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0
      ? Math.trunc(parsed)
      : defaultValue;
  };

  const pageNumber = toPositiveInt(
    source.pageNumber ?? source.page,
    toPositiveInt(fallback.pageNumber, 1),
  );

  const pageSize = toPositiveInt(
    source.pageSize ?? source.limit,
    toPositiveInt(fallback.pageSize, items.length || 10),
  );

  const totalCount = toPositiveInt(
    source.totalCount ?? source.total ?? source.totalItems,
    items.length,
  );

  const totalPages = toPositiveInt(
    source.totalPages,
    pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0,
  );

  return { items, totalCount, pageNumber, pageSize, totalPages };
};

/** Bỏ mọi tham số rỗng khỏi query string (undefined / null / "" / NaN). */
export const removeEmptyParams = (params = {}) => {
  const cleaned = {};

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (typeof value === "number" && !Number.isFinite(value)) return;

    cleaned[key] = typeof value === "string" ? value.trim() : value;
  });

  return cleaned;
};

export default {
  getResponseData,
  getArrayItems,
  getPagedData,
  removeEmptyParams,
};
