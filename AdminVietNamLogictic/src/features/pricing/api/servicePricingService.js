/**
 * BẢNG GIÁ VẬN CHUYỂN — ĐÃ NỐI API THẬT (đợt báo giá ký gửi).
 *
 * - GET /api/service-pricings        → MẢNG TRẦN các dòng giá (không cần đăng nhập)
 * - GET /api/service-pricings/{id}   → object trần
 *
 * Mỗi dòng: { id, carrierId, serviceType, originCountry, destinationCountry,
 * unitType, price, currency, effectiveDate, ... }. `serviceType` chính là
 * `shippingOption` khách chọn ("Express", "Standard"); cặp originCountry–
 * destinationCountry là tuyến ("CN"–"VN" ↔ route "CN-VN").
 *
 * Hình dạng trả về GIỮ NGUYÊN hợp đồng cũ: mảng đã qua `normalizeServicePricing`.
 * Backend chưa nhận bộ lọc qua query string nên `filters` vẫn được áp tại chỗ
 * bằng chính `filterServicePricings` — bỏ đi là các ô lọc trên giao diện im lặng
 * ngừng hoạt động.
 *
 * Các hàm thuần (formatVnd, mapServicePricingsToOptions, findServicePricingById,
 * filterServicePricings, findMatchingServicePricing) không dính mạng, giữ nguyên.
 *
 * Màn ngoài luồng ký gửi (SaleDashboard, mua hộ, danh mục bảng giá của Admin)
 * dùng bản sao ./servicePricingService.mock.js.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getResponseData,
} from "@shared/api/apiEnvelope";

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
  const response = await httpClient.get(
    API_ENDPOINTS.servicePricings.list,
    { signal: filters?.signal }
  );

  const normalized = getArrayItems(
    getResponseData(response)
  )
    .map(normalizeServicePricing)
    .filter((pricing) => Boolean(pricing.id));

  /*
   * Backend trả nguyên danh sách, không nhận bộ lọc. Lọc lại bằng đúng
   * filterServicePricings mà giao diện đang dùng để kết quả của cùng một bộ
   * tham số không lệch giữa danh sách và bộ lọc phía UI.
   */
  return filterServicePricings(normalized, {
    serviceType: filters?.serviceType,
    originCountry: filters?.originCountry,
    destinationCountry: filters?.destinationCountry,
    unitType: filters?.unitType,
    carrierId: filters?.carrierId,
  });
};

export const getServicePricingDetailApi = async (
  servicePricingId
) => {
  const id = normalizeText(servicePricingId);

  if (!id) {
    throw new Error("Không tìm thấy mã bảng giá dịch vụ.");
  }

  const response = await httpClient.get(
    API_ENDPOINTS.servicePricings.detail(id)
  );

  return normalizeServicePricing(
    getResponseData(response) || {}
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
