/**
 * DANH MỤC DÙNG CHUNG CỦA LUỒNG KÝ GỬI — ĐÃ NỐI API THẬT (đợt báo giá ký gửi).
 *
 * - GET /api/product-types                        → { message, data: [ { id, name } ] }
 * - GET /api/orders/consignments/routes           → { message, data: [ ... ] }
 * - GET /api/orders/consignments/shipping-options?route=  → { message, data: [ ... ] }
 *
 * Tên export, thứ tự tham số (kể cả options { route, signal }) và hình dạng giá
 * trị trả về giữ y hệt bản mock trước đó: cả ba hàm trả MẢNG TRẦN các bản ghi.
 * Riêng routes/shipping-options được bù thêm cặp { value, label } vì component
 * dò value theo thứ tự value → code → route → ... → id; thiếu nó thì payload tạo
 * đơn mang UUID thay vì mã tuyến.
 *
 * getConsignmentMasterDataApi gọi song song kho / bảng giá / quy định phí rồi
 * trả ĐÚNG bộ key cũ (productTypes, warehouses, warehouseOptions,
 * originWarehouses, destinationWarehouses, servicePricings,
 * servicePricingOptions, pricingRules).
 *
 * Màn Sale tạo đơn hộ khách và luồng mua hộ (ngoài đợt này) dùng bản sao
 * ./consignmentMasterService.mock.js.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";

/* =========================================================
   HELPER TEXT / SỐ
   Cùng cách chuẩn hoá với các service thật để hình dạng trả về không lệch.
========================================================= */

const trimText = (value) => String(value ?? "").trim();

const upperText = (value) => trimText(value).toUpperCase();

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const toPositiveNumber = (value, fallback = 0) =>
  Math.max(0, toNumber(value, fallback));

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const formatVndCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(toNumber(value, 0));

/* =========================================================
   LOẠI HÀNG HOÁ (productTypes)
========================================================= */

/**
 * Loại hàng hoá cho select tạo đơn và cho map id -> tên ở màn chi tiết.
 *
 * Backend chỉ trả loại đang dùng, dạng { message, data: [ { id, name } ] }.
 * Giữ nguyên hợp đồng cũ: MẢNG TRẦN các bản ghi `{ ...item, id, name }`.
 * Màn chi tiết đơn dựng Map id -> name từ đây để dịch `productType` (UUID) của
 * từng kiện thành tên loại hàng — bản ghi thiếu id hoặc name bị loại luôn.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export const getProductTypesApi = async ({ signal } = {}) => {
  const response = await httpClient.get(
    API_ENDPOINTS.productTypes,
    { signal }
  );

  return getArrayItems(getResponseData(response))
    .map((item) => ({
      ...item,
      id: trimText(item?.id ?? item?.value ?? item?.code),
      name: trimText(item?.name ?? item?.label ?? item?.displayName),
    }))
    .filter((item) => item.id && item.name);
};

/* =========================================================
   TUYẾN HÀNG (routes) & PHƯƠNG ÁN VẬN CHUYỂN (shippingOptions)
========================================================= */

/*
 * Hai endpoint này trả MẢNG CHUỖI: routes là nhãn hiển thị đã dịch sẵn
 * ("Trung quốc --> Việt Nam"), shipping-options là mã phương án ("Express",
 * "Standard") — chính là `serviceType` của bảng giá.
 *
 * Component dò `value` theo thứ tự value → code → route → ... → id, nên chuỗi
 * trần phải được gói lại thành bản ghi có đủ các khoá đó; nếu không, payload tạo
 * đơn sẽ mang UUID hoặc undefined thay vì mã tuyến / mã phương án.
 * Backend có trả sẵn object thì giữ nguyên object đó.
 */
const toRouteRecord = (item) => {
  if (item && typeof item === "object") {
    const code = trimText(
      item?.value ?? item?.code ?? item?.route ?? item?.routeCode
    );
    const name = trimText(
      item?.label ?? item?.routeName ?? item?.name ?? code
    );

    return {
      ...item,
      value: code || name,
      label: name || code,
      code: code || name,
      route: code || name,
      routeCode: code || name,
      routeName: name || code,
      isActive: item?.isActive !== false,
    };
  }

  const value = trimText(item);

  return {
    value,
    label: value,
    code: value,
    route: value,
    routeCode: value,
    routeName: value,
    isActive: true,
  };
};

const SHIPPING_OPTION_LABELS = {
  EXPRESS: "Hỏa tốc",
  STANDARD: "Tiêu chuẩn",
  ECONOMY: "Tiết kiệm",
};

const toShippingOptionRecord = (item, route) => {
  const code = trimText(
    item && typeof item === "object"
      ? item?.value ?? item?.code ?? item?.shippingOption ?? item?.serviceType
      : item
  );

  const label =
    (item && typeof item === "object"
      ? trimText(item?.label ?? item?.shippingOptionName ?? item?.name)
      : "") ||
    SHIPPING_OPTION_LABELS[upperText(code)] ||
    code;

  return {
    ...(item && typeof item === "object" ? item : {}),
    value: code,
    label,
    code,
    shippingOption: code,
    shippingOptionName: label,
    route: trimText(route),
    isActive: true,
  };
};

/**
 * Tuyến hàng cho ô "TUYẾN HÀNG".
 *
 * GET /api/orders/consignments/routes → { message, data: [ "Trung quốc --> Việt Nam", ... ] }.
 * Backend chỉ trả tuyến CÓ dòng giá đang áp dụng, nên tuyến hiện ra luôn báo giá được.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Array<object>>}
 */
export const getConsignmentRoutesApi = async ({ signal } = {}) => {
  const response = await httpClient.get(
    API_ENDPOINTS.consignments.routes,
    { signal }
  );

  return getArrayItems(getResponseData(response))
    .map(toRouteRecord)
    .filter((route) => Boolean(route.value));
};

/**
 * Phương án vận chuyển, lọc theo tuyến đang chọn.
 *
 * GET /api/orders/consignments/shipping-options?route= → { message, data: [ "Express", ... ] }.
 *
 * @param {{ route?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<Array<object>>}
 */
export const getConsignmentShippingOptionsApi = async ({
  route,
  signal,
} = {}) => {
  const response = await httpClient.get(
    API_ENDPOINTS.consignments.shippingOptions,
    {
      params: removeEmptyParams({ route }),
      signal,
    }
  );

  return getArrayItems(getResponseData(response))
    .map((item) => toShippingOptionRecord(item, route))
    .filter((option) => Boolean(option.value));
};

/* =========================================================
   TỔNG HỢP DANH MỤC (master data)
========================================================= */

const COUNTRY_LABELS = {
  VN: "Việt Nam",
  VIETNAM: "Việt Nam",
  CN: "Trung Quốc",
  CHINA: "Trung Quốc",
  KR: "Hàn Quốc",
  KOREA: "Hàn Quốc",
  JP: "Nhật Bản",
  JAPAN: "Nhật Bản",
};

const SERVICE_TYPE_LABELS = {
  EXPRESS: "Hỏa tốc",
  STANDARD: "Tiêu chuẩn",
  ECONOMY: "Tiết kiệm",
};

const getCountryDisplayName = (value) => {
  const normalized = upperText(value).replace(/[^A-Z0-9]/g, "");

  return COUNTRY_LABELS[normalized] || trimText(value) || "—";
};

const getServiceTypeDisplayName = (value) =>
  SERVICE_TYPE_LABELS[upperText(value)] || trimText(value) || "—";

const formatEffectiveDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return trimText(value) || "—";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

/* Giữ đúng 6 field mà normalizeWarehouse của warehouseService trả về. */
const normalizeWarehouseRecord = (warehouse = {}) => ({
  id: trimText(warehouse?.id || warehouse?.warehouseId),
  name: trimText(
    warehouse?.name || warehouse?.warehouseName || "Kho hàng"
  ),
  code: trimText(warehouse?.code || warehouse?.warehouseCode),
  address: trimText(warehouse?.address || warehouse?.location),
  warehouseType: trimText(warehouse?.warehouseType || warehouse?.type),
  isActive: warehouse?.isActive !== false,
});

/* Bản sao của mapWarehousesToOptions: value/label + searchText cho ô tìm kiếm. */
const mapWarehouseOptions = (warehouses = []) =>
  warehouses
    .filter((warehouse) => Boolean(warehouse?.id) && Boolean(warehouse?.name))
    .map((warehouse) => {
      const id = trimText(warehouse?.id);
      const name = trimText(warehouse?.name);
      const code = trimText(warehouse?.code);
      const address = trimText(warehouse?.address);
      const warehouseType = trimText(warehouse?.warehouseType);

      return {
        value: id,
        label: code ? `${name} (${code})` : name,

        id,
        name,
        code,
        address,
        warehouseType,
        isActive: warehouse?.isActive === true,

        searchText: [name, code, address, warehouseType]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

/* Bản sao của normalizeServicePricing: cột "Tuyến" và "Đơn giá" đọc các field này. */
const normalizeServicePricingRecord = (pricing = {}) => {
  const serviceType = upperText(pricing?.serviceType);
  const originCountry = upperText(pricing?.originCountry);
  const destinationCountry = upperText(pricing?.destinationCountry);
  const currency = upperText(pricing?.currency) || "VND";
  const price = toNumber(pricing?.price, 0);
  const effectiveDate = pricing?.effectiveDate || null;

  return {
    ...pricing,
    id: trimText(pricing?.id),
    carrierId: trimText(pricing?.carrierId) || null,
    serviceType,
    serviceTypeDisplayName: getServiceTypeDisplayName(serviceType),
    originCountry,
    originCountryDisplayName: getCountryDisplayName(originCountry),
    destinationCountry,
    destinationCountryDisplayName: getCountryDisplayName(destinationCountry),
    routeDisplayName:
      `${getCountryDisplayName(originCountry)} → ` +
      getCountryDisplayName(destinationCountry),
    unitType: upperText(pricing?.unitType),
    price,
    formattedPrice:
      currency === "VND"
        ? formatVndCurrency(price)
        : `${price.toLocaleString("vi-VN")} ${currency}`,
    currency,
    effectiveDate,
    effectiveDateDisplay: formatEffectiveDate(effectiveDate),
    boxPricingRules: Array.isArray(pricing?.boxPricingRules)
      ? pricing.boxPricingRules
      : [],
  };
};

/* Bản sao của mapServicePricingsToOptions. */
const mapServicePricingOptions = (servicePricings = []) =>
  servicePricings.map((pricing) => {
    const serviceLabel = getServiceTypeDisplayName(pricing?.serviceType);

    const unitLabel =
      pricing?.unitType === "KG"
        ? "kg"
        : pricing?.unitType === "M3"
          ? "m³"
          : pricing?.unitType === "PACKAGE"
            ? "kiện"
            : pricing?.unitType;

    const priceLabel = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: pricing?.currency || "VND",
      maximumFractionDigits: 0,
    }).format(toNumber(pricing?.price, 0));

    return {
      value: pricing?.id,
      label:
        `${serviceLabel} • ` +
        `${pricing?.originCountry} → ` +
        `${pricing?.destinationCountry} • ` +
        `${priceLabel}/${unitLabel}`,

      ...pricing,

      searchText: [
        serviceLabel,
        pricing?.serviceType,
        pricing?.originCountry,
        pricing?.destinationCountry,
        pricing?.unitType,
        pricing?.price,
        pricing?.currency,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

/* Bản sao của normalizePricingRule: isActive suy ra từ status như bản thật. */
const normalizePricingRuleRecord = (rule = {}) => {
  const calculationType = upperText(rule?.calculationType);
  const status = upperText(rule?.status);

  return {
    ...rule,
    id: trimText(rule?.id),
    servicePricingId: trimText(rule?.servicePricingId) || null,
    ruleName: trimText(rule?.ruleName),
    ruleCode: upperText(rule?.ruleCode),
    ruleType: upperText(rule?.ruleType),
    conditionType: upperText(rule?.conditionType) || null,
    conditionValue:
      rule?.conditionValue !== undefined &&
      rule?.conditionValue !== null &&
      rule?.conditionValue !== ""
        ? trimText(rule?.conditionValue)
        : null,
    calculationType,
    calculationTypeDisplayName:
      calculationType === "PERCENTAGE"
        ? "Phần trăm"
        : calculationType === "FIXED"
          ? "Cố định"
          : calculationType || "—",
    value: toPositiveNumber(rule?.value, 0),
    minAmount: toNullableNumber(rule?.minAmount),
    maxAmount: toNullableNumber(rule?.maxAmount),
    isRequired: rule?.isRequired === true,
    status,
    isActive: status === "ACTIVE",
    description: trimText(rule?.description),
    createdAt: rule?.createdAt || null,
    updatedAt: rule?.updatedAt || null,
  };
};

/*
 * Bản thật đẩy filters xuống query string cho backend lọc. Mock lọc tại chỗ theo
 * đúng tên field, so sánh không phân biệt hoa thường; bỏ qua field rỗng và field
 * mà bản ghi không có, để tham số phụ (page, size, sort...) không làm rỗng danh sách.
 */
const applyFieldFilters = (records = [], filters = {}) => {
  const entries = Object.entries(filters || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  if (!entries.length) {
    return records;
  }

  return records.filter((record) =>
    entries.every(([key, value]) => {
      if (record?.[key] === undefined || record?.[key] === null) {
        return true;
      }

      return upperText(record[key]) === upperText(value);
    })
  );
};

/**
 * Nạp một lượt toàn bộ danh mục mà form ký gửi cần.
 *
 * Gọi song song 4 API (loại hàng, kho đang hoạt động, bảng giá, quy định phí)
 * rồi trả OBJECT đã tổng hợp — không phải response axios. Bộ key giữ nguyên
 * hợp đồng cũ để không màn nào phải sửa.
 *
 * @param {{
 *   warehouseFilters?: object,
 *   servicePricingFilters?: object,
 *   pricingRuleFilters?: object,
 *   activeWarehousesOnly?: boolean,
 *   activeRulesOnly?: boolean,
 *   signal?: AbortSignal,
 * }} [options]
 */
export const getConsignmentMasterDataApi = async ({
  warehouseFilters = {},
  servicePricingFilters = {},
  pricingRuleFilters = {},
  activeWarehousesOnly = true,
  activeRulesOnly = true,
  signal,
} = {}) => {
  const [
    productTypes,
    warehouseRows,
    servicePricingRows,
    pricingRuleRows,
  ] = await Promise.all([
    getProductTypesApi({ signal }),

    httpClient
      .get(
        activeWarehousesOnly
          ? API_ENDPOINTS.warehouses.active
          : API_ENDPOINTS.warehouses.list,
        { signal }
      )
      .then((response) => getArrayItems(getResponseData(response))),

    httpClient
      .get(API_ENDPOINTS.servicePricings.list, { signal })
      .then((response) => getArrayItems(getResponseData(response))),

    httpClient
      .get(API_ENDPOINTS.pricingRules.list, {
        params: removeEmptyParams({
          orderType: pricingRuleFilters?.orderType ?? "CONSIGNMENT",
        }),
        signal,
      })
      .then((response) => getArrayItems(getResponseData(response))),
  ]);

  const warehouses = applyFieldFilters(
    warehouseRows
      .map(normalizeWarehouseRecord)
      .filter((warehouse) => Boolean(warehouse.id) && Boolean(warehouse.name))
      .filter((warehouse) =>
        activeWarehousesOnly ? warehouse.isActive : true
      ),
    warehouseFilters
  );

  const servicePricings = applyFieldFilters(
    servicePricingRows
      .map(normalizeServicePricingRecord)
      .filter((pricing) => Boolean(pricing.id)),
    servicePricingFilters
  );

  const pricingRules = applyFieldFilters(
    pricingRuleRows
      .map(normalizePricingRuleRecord)
      .filter((rule) => Boolean(rule.id))
      .filter((rule) => (activeRulesOnly ? rule.isActive : true)),
    /* orderType đã đẩy xuống server, bỏ khỏi bộ lọc tại chỗ. */
    { ...pricingRuleFilters, orderType: undefined }
  );

  return {
    productTypes,
    warehouses,
    warehouseOptions: mapWarehouseOptions(warehouses),
    originWarehouses: warehouses.filter(
      (warehouse) => upperText(warehouse?.warehouseType) === "ORIGIN"
    ),
    destinationWarehouses: warehouses.filter(
      (warehouse) => upperText(warehouse?.warehouseType) === "DESTINATION"
    ),
    servicePricings,
    servicePricingOptions: mapServicePricingOptions(servicePricings),
    pricingRules,
  };
};

const consignmentMasterService = {
  getProductTypesApi,
  getConsignmentRoutesApi,
  getConsignmentShippingOptionsApi,
  getConsignmentMasterDataApi,
};

export default consignmentMasterService;
