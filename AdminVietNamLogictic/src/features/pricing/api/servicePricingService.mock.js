/* =========================================================
   BẢN SAO MOCK TẠM THỜI — ĐỪNG NỐI API VÀO FILE NÀY.

   Đợt này chỉ nối API thật cho luồng BÁO GIÁ KÝ GỬI của Sale/Admin. Các màn
   ngoài luồng đó (mua hộ, SaleDashboard, chứng từ, chat, danh mục bảng giá,
   màn Sale tạo đơn hộ khách) vẫn phải chạy bằng dữ liệu mẫu, nên chúng trỏ vào
   bản sao này thay vì bản gốc đã nối backend.

   Đây là BẢN CHÉP NGUYÊN VĂN của module cùng tên (bỏ đuôi .mock) tại thời điểm
   nối API. Khi đợt sau nối nốt các màn kia: sửa import của màn đó về module gốc
   rồi XOÁ file này. Không thêm tính năng mới vào đây, không re-export từ barrel.
   ========================================================= */

/**
 * MOCK bảng giá dịch vụ vận chuyển — bản chỉ-giao-diện.
 *
 * Tầng HTTP đã bị gỡ hẳn: không axiosInstance, không API_ENDPOINTS, không token.
 * Dữ liệu lấy từ bộ mẫu `servicePricings` trong @/mocks/data/catalog rồi đi qua
 * đúng `normalizeServicePricing` của bản thật, nên hình dạng bản ghi mà
 * ServicePricings.jsx, SaleDashboard.jsx, CreateConsignmentQuotation.jsx và
 * CreatePurchaseRequestQuotationModal.jsx đang đọc không lệch một field nào.
 *
 * Các hàm thuần (formatVnd, mapServicePricingsToOptions, findServicePricingById,
 * filterServicePricings, findMatchingServicePricing) vốn không gọi server nên
 * được giữ NGUYÊN VĂN — chúng là logic hiển thị, không phải tầng dữ liệu.
 *
 * CẮM API THẬT TRỞ LẠI: hai hàm async bên dưới đều có khối "// [API THẬT]" ghi
 * lại endpoint cũ. Chỉ cần thay phần đọc `readServicePricingRows()` bằng lời gọi
 * axiosInstance tương ứng, vẫn trả qua `normalizeServicePricing` là xong.
 */

import {
  servicePricings as servicePricingFixtures,
} from "@/mocks/data/catalog";
import {
  createApiError,
  deepClone,
  delay,
} from "@/mocks/mockUtils";

/* =========================
   ĐỌC FIXTURE
========================= */

/*
 * Đọc fixture ở THỜI ĐIỂM GỌI, không chụp bản sao lúc import.
 *
 * adminService CRUD trực tiếp trên chính mảng `servicePricings` này (unshift /
 * Object.assign / splice). Chụp một lần lúc nạp module thì bảng giá admin vừa
 * thêm không bao giờ hiện ở ServicePricings, SaleDashboard hay hai modal báo giá;
 * dòng admin vừa sửa vẫn hiện giá cũ — nghĩa là báo giá dựng trên đó ra số tiền
 * sai; còn dòng admin vừa xoá thì vẫn nằm trong danh sách và vẫn mở được drawer.
 * Ba module cùng mảng (pricingRule / packageConfiguration / exchangeRate) đều đọc
 * muộn như thế này, giữ đồng nhất để admin và sale luôn thấy cùng một sự thật.
 *
 * deepClone để một màn sort/mutate tại chỗ không làm hỏng dữ liệu màn khác.
 */
const readServicePricingRows = () =>
  deepClone(servicePricingFixtures);

/* =========================
   NORMALIZE HELPERS
========================= */

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

/*
 * Bản thật gửi filters lên server dưới dạng query param sau khi bỏ giá trị rỗng.
 * Mock lọc tại chỗ, nên vẫn phải bỏ giá trị rỗng trước — nếu không, filter rỗng
 * sẽ loại hết bản ghi và danh sách trắng trơn.
 */
const removeEmptyParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );

const COUNTRY_LABELS = {
  VN: "Việt Nam",
  VIETNAM: "Việt Nam",
  CN: "Trung Quốc",
  CHINA: "Trung Quốc",
  KR: "Hàn Quốc",
  KOREA: "Hàn Quốc",
  SOUTHKOREA: "Hàn Quốc",
  JP: "Nhật Bản",
  JAPAN: "Nhật Bản",
};

const SERVICE_TYPE_LABELS = {
  EXPRESS: "Hỏa tốc",
  STANDARD: "Tiêu chuẩn",
  ECONOMY: "Tiết kiệm",
};

const getCountryDisplayName = (value) => {
  const normalized = normalizeUpperText(value).replace(
    /[^A-Z0-9]/g,
    ""
  );
  return COUNTRY_LABELS[normalized] || normalizeText(value) || "—";
};

const getServiceTypeDisplayName = (value) => {
  const normalized = normalizeUpperText(value);
  return SERVICE_TYPE_LABELS[normalized] || normalizeText(value) || "—";
};

const formatEffectiveDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value) || "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

/* =========================
   NORMALIZE SERVICE PRICING
========================= */

export const normalizeServicePricing = (
  pricing = {}
) => {
  const serviceType = normalizeUpperText(pricing?.serviceType);
  const originCountry = normalizeUpperText(pricing?.originCountry);
  const destinationCountry = normalizeUpperText(pricing?.destinationCountry);
  const currency = normalizeUpperText(pricing?.currency) || "VND";
  const price = normalizeNumber(pricing?.price, 0);
  const effectiveDate = pricing?.effectiveDate || null;

  return {
    ...pricing,
    id: normalizeText(pricing?.id),
    carrierId: normalizeText(pricing?.carrierId) || null,
    serviceType,
    serviceTypeDisplayName: getServiceTypeDisplayName(serviceType),
    originCountry,
    originCountryDisplayName: getCountryDisplayName(originCountry),
    destinationCountry,
    destinationCountryDisplayName: getCountryDisplayName(destinationCountry),
    routeDisplayName:
      `${getCountryDisplayName(originCountry)} → ` +
      getCountryDisplayName(destinationCountry),
    unitType: normalizeUpperText(pricing?.unitType),
    price,
    formattedPrice:
      currency === "VND"
        ? formatVnd(price)
        : `${price.toLocaleString("vi-VN")} ${currency}`,
    currency,
    effectiveDate,
    effectiveDateDisplay: formatEffectiveDate(effectiveDate),
    boxPricingRules: Array.isArray(pricing?.boxPricingRules)
      ? pricing.boxPricingRules
      : [],
  };
};

/* =========================
   GET SERVICE PRICINGS
========================= */

export const getServicePricingsApi = async (
  filters = {}
) => {
  // [API THẬT] GET API_ENDPOINTS.servicePricings.list
  //            params: removeEmptyParams(filters), headers: Bearer token
  await delay(220, filters?.signal);

  const appliedFilters = removeEmptyParams({
    serviceType: filters?.serviceType,
    originCountry: filters?.originCountry,
    destinationCountry: filters?.destinationCountry,
    unitType: filters?.unitType,
    carrierId: filters?.carrierId,
  });

  const normalized = readServicePricingRows()
    .map(normalizeServicePricing)
    .filter((pricing) => Boolean(pricing.id));

  /*
   * Bản thật để server lọc; mock lọc lại bằng chính filterServicePricings để
   * kết quả của tham số y hệt, khỏi lệch giữa danh sách và bộ lọc phía UI.
   */
  return filterServicePricings(
    normalized,
    appliedFilters
  );
};

export const getServicePricingDetailApi = async (
  servicePricingId
) => {
  const id = normalizeText(servicePricingId);

  if (!id) {
    throw new Error("Không tìm thấy mã bảng giá dịch vụ.");
  }

  // [API THẬT] GET API_ENDPOINTS.servicePricings.detail(id)
  await delay(200);

  const found = readServicePricingRows().find(
    (pricing) => normalizeText(pricing?.id) === id
  );

  /*
   * Bản thật trả 404 khi không có bản ghi; dựng lại lỗi dạng axios để nhánh
   * catch của ServicePricings.jsx đọc được error.response.data.message.
   */
  if (!found) {
    throw createApiError(
      404,
      "Không tìm thấy bảng giá dịch vụ."
    );
  }

  return normalizeServicePricing(
    deepClone(found)
  );
};

export const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(normalizeNumber(value, 0));

/* =========================
   MAP TO SELECT OPTIONS
========================= */

export const mapServicePricingsToOptions = (
  servicePricings = []
) => {
  if (!Array.isArray(servicePricings)) {
    return [];
  }

  return servicePricings.map((pricing) => {
    const serviceLabel =
      pricing.serviceType === "EXPRESS"
        ? "Hỏa tốc"
        : pricing.serviceType === "STANDARD"
          ? "Tiêu chuẩn"
          : pricing.serviceType === "ECONOMY"
            ? "Tiết kiệm"
            : pricing.serviceType;

    const unitLabel =
      pricing.unitType === "KG"
        ? "kg"
        : pricing.unitType === "M3"
          ? "m³"
          : pricing.unitType === "PACKAGE"
            ? "kiện"
            : pricing.unitType;

    const priceLabel = new Intl.NumberFormat(
      "vi-VN",
      {
        style: "currency",
        currency: pricing.currency || "VND",
        maximumFractionDigits: 0,
      }
    ).format(
      normalizeNumber(pricing.price, 0)
    );

    return {
      value: pricing.id,
      label:
        `${serviceLabel} • ` +
        `${pricing.originCountry} → ` +
        `${pricing.destinationCountry} • ` +
        `${priceLabel}/${unitLabel}`,

      ...pricing,

      searchText: [
        serviceLabel,
        pricing.serviceType,
        pricing.originCountry,
        pricing.destinationCountry,
        pricing.unitType,
        pricing.price,
        pricing.currency,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });
};

/* =========================
   FIND / FILTER HELPERS
========================= */

export const findServicePricingById = (
  servicePricings = [],
  servicePricingId
) => {
  if (!Array.isArray(servicePricings)) {
    return null;
  }

  const normalizedId =
    normalizeText(servicePricingId);

  if (!normalizedId) {
    return null;
  }

  return (
    servicePricings.find(
      (pricing) =>
        normalizeText(pricing?.id) ===
        normalizedId
    ) || null
  );
};

export const filterServicePricings = (
  servicePricings = [],
  filters = {}
) => {
  if (!Array.isArray(servicePricings)) {
    return [];
  }

  const serviceType = normalizeUpperText(
    filters?.serviceType
  );
  const originCountry = normalizeUpperText(
    filters?.originCountry
  );
  const destinationCountry =
    normalizeUpperText(
      filters?.destinationCountry
    );
  const unitType = normalizeUpperText(
    filters?.unitType
  );
  const carrierId = normalizeText(
    filters?.carrierId
  );

  return servicePricings.filter((pricing) => {
    if (
      serviceType &&
      pricing.serviceType !== serviceType
    ) {
      return false;
    }

    if (
      originCountry &&
      pricing.originCountry !== originCountry
    ) {
      return false;
    }

    if (
      destinationCountry &&
      pricing.destinationCountry !==
        destinationCountry
    ) {
      return false;
    }

    if (
      unitType &&
      pricing.unitType !== unitType
    ) {
      return false;
    }

    if (
      carrierId &&
      pricing.carrierId !== carrierId
    ) {
      return false;
    }

    return true;
  });
};

export const findMatchingServicePricing = (
  servicePricings = [],
  filters = {}
) => {
  const matches = filterServicePricings(
    servicePricings,
    filters
  );

  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort((a, b) => {
    const dateA = new Date(
      a?.effectiveDate || 0
    ).getTime();

    const dateB = new Date(
      b?.effectiveDate || 0
    ).getTime();

    return dateB - dateA;
  })[0];
};

const servicePricingService = {
  normalizeServicePricing,
  getServicePricingsApi,
  getServicePricingDetailApi,
  formatVnd,
  mapServicePricingsToOptions,
  findServicePricingById,
  filterServicePricings,
  findMatchingServicePricing,
};

export default servicePricingService;
