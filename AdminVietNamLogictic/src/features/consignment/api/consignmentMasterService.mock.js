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
 * MOCK — danh mục dùng chung của luồng ký gửi (bản CHỈ GIAO DIỆN).
 *
 * Bản này gỡ hẳn tầng HTTP: ba endpoint /api/product-types,
 * /api/orders/consignments/routes và /api/orders/consignments/shipping-options
 * được thay bằng dữ liệu mẫu trong src/mocks/data. Muốn cắm API thật trở lại thì
 * chỉ thay THÂN từng hàm bằng lời gọi axios cũ: tên export, thứ tự tham số
 * (kể cả options { route, signal }) và hình dạng giá trị trả về ở đây giữ y hệt
 * bản thật, nên không component nào phải sửa.
 *
 * Một chỗ khác bản thật có chủ ý: getConsignmentMasterDataApi không còn gọi sang
 * warehouseService / servicePricingService / pricingRuleService nữa mà đọc thẳng
 * catalog. Lý do là để phần tổng hợp này không phụ thuộc vòng vào ba module khác
 * (chúng cũng đã thành mock, không còn tầng HTTP) — đổi lại nó vẫn trả về ĐÚNG bộ
 * key cũ (productTypes, warehouses, warehouseOptions, originWarehouses,
 * destinationWarehouses, servicePricings, servicePricingOptions, pricingRules) và
 * chuẩn hoá từng bản ghi y như ba service đó, nên không màn nào phân biệt được.
 */

import { deepClone, delay } from "@/mocks/mockUtils";
import {
  pricingRules as catalogPricingRules,
  productTypes as catalogProductTypes,
  servicePricings as catalogServicePricings,
  shippingRoutes as catalogShippingRoutes,
  warehouses as catalogWarehouses,
} from "@/mocks/data/catalog";
import { PRODUCT_TYPES } from "@/mocks/data/consignments";

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

/*
 * PRODUCT_TYPES của bộ đơn ký gửi phải đứng đầu và giữ NGUYÊN id: màn
 * ConsignmentDetail dựng Map id -> name từ danh sách này để dịch field
 * productType (UUID) trong đơn thành tên loại hàng. Đổi id là ô "Loại hàng"
 * của mọi kiện hàng trống ngay, dù không có lỗi nào bắn ra.
 */

/*
 * Catalog có bộ loại hàng riêng, rộng hơn, dùng để dropdown tạo đơn có đủ lựa
 * chọn. Năm tên dưới đây trùng nghĩa với bộ canonical ở trên nên bị loại, tránh
 * select hiện hai dòng gần giống nhau ("Điện tử" và "Đồ điện tử và phụ kiện").
 */
const DUPLICATED_CATALOG_PRODUCT_TYPE_NAMES = new Set([
  "Quần áo, phụ kiện may mặc",
  "Đồ điện tử và phụ kiện",
  "Đồ gia dụng",
  "Mỹ phẩm, chăm sóc cá nhân",
  "Đồ chơi trẻ em",
]);

const buildProductTypeRecords = () => {
  const extraTypes = catalogProductTypes.filter(
    (item) =>
      /* Loại hàng đã ngừng nhận thì không nên còn nằm trong ô chọn của đơn mới. */
      item?.isActive !== false &&
      !DUPLICATED_CATALOG_PRODUCT_TYPE_NAMES.has(trimText(item?.name))
  );

  return [...PRODUCT_TYPES, ...extraTypes];
};

/**
 * Loại hàng hoá cho select tạo đơn và cho map id -> tên ở màn chi tiết.
 *
 * Bản thật trả MẢNG TRẦN các bản ghi đã chuẩn hoá `{ ...item, id, name }` —
 * không phải response axios — nên mock trả đúng mảng đó.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export const getProductTypesApi = async ({ signal } = {}) => {
  await delay(undefined, signal);

  return deepClone(
    buildProductTypeRecords()
      .map((item) => ({
        ...item,
        id: trimText(item?.id ?? item?.value ?? item?.code),
        name: trimText(item?.name ?? item?.label ?? item?.displayName),
      }))
      .filter((item) => item.id && item.name)
  );
};

/* =========================================================
   TUYẾN HÀNG (routes)
========================================================= */

/*
 * normalizeOptionList trong ConsignmentOrder / ConsignmentBuyOrder lấy value
 * theo thứ tự value -> code -> route -> ... -> id. Nếu chỉ trả bản ghi catalog
 * thô thì value rơi vào `id` (UUID) và payload tạo đơn mang UUID thay vì mã
 * tuyến, nên ở đây gán thẳng value/label và để cả code/route/routeCode cùng trị.
 */
/*
 * Quốc gia đi có kho gửi hàng đang hoạt động.
 *
 * Màn lập báo giá tách tuyến của đơn thành cặp quốc gia rồi dò kho gửi hàng theo mã
 * kho (getOriginWarehousesApi chỉ trả kho ORIGIN). Catalog hiện chỉ có kho ORIGIN ở
 * Trung Quốc, nên một đơn tạo theo tuyến Hàn/Nhật/nội địa sẽ tạo được nhưng KHÔNG bao
 * giờ lập được báo giá: màn báo giá chặn với "không tìm thấy kho gửi hàng phù hợp".
 * Vì vậy ô chọn chỉ đưa ra những tuyến đi trọn được vòng nghiệp vụ.
 */
const originCountriesWithWarehouse = new Set(
  catalogWarehouses
    .filter(
      (warehouse) =>
        warehouse?.isActive !== false &&
        upperText(warehouse?.warehouseType) === "ORIGIN"
    )
    .map((warehouse) =>
      upperText(warehouse?.code).split("-")[0]
    )
    .filter(Boolean)
);

const buildRouteRecords = () =>
  catalogShippingRoutes
    .filter(
      (route) =>
        route?.isActive !== false &&
        originCountriesWithWarehouse.has(
          upperText(route?.originCountry)
        )
    )
    .map((route) => {
      const code = trimText(route?.routeCode);
      const name = trimText(route?.routeName);

      return {
        value: code,
        label: name,

        id: route?.id,
        routeId: route?.id,
        code,
        route: code,
        routeCode: code,
        routeName: name,

        originCountry: upperText(route?.originCountry),
        destinationCountry: upperText(route?.destinationCountry),
        transportMode: upperText(route?.transportMode),
        estimatedTransitDays: toNullableNumber(route?.estimatedTransitDays),
        note: trimText(route?.note),
        isActive: true,
      };
    })
    .filter((route) => route.value && route.label);

/**
 * Danh sách tuyến hàng cho ô "TUYẾN HÀNG".
 *
 * Bản thật trả mảng bản ghi THÔ của backend (getNamedArrayItems, không map lại),
 * nên mock cũng trả mảng trần; component tự chuẩn hoá về { value, label }.
 * Mảng rỗng sẽ làm form hiện lỗi "Chưa có dữ liệu tuyến hàng", vì vậy luôn có
 * dữ liệu ở đây.
 *
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Array<object>>}
 */
export const getConsignmentRoutesApi = async ({ signal } = {}) => {
  await delay(undefined, signal);

  return deepClone(buildRouteRecords());
};

/* =========================================================
   HÌNH THỨC VẬN CHUYỂN (shippingOptions)
========================================================= */

/*
 * Hai mã STANDARD / EXPRESS là giá trị mà CẢ hệ thống đang hiểu: form dịch chúng
 * ra "Tiêu chuẩn" / "Hỏa tốc", và bộ đơn mẫu lưu consignmentType đúng hai mã này.
 * Thêm mã lạ vào đây thì đơn tạo mới sẽ hiện mã thô ở màn danh sách và chi tiết.
 */
const SHIPPING_OPTION_CATALOG = [
  {
    code: "STANDARD",
    name: "Tiêu chuẩn",
    description: "Gom hàng theo lịch xuất định kỳ, cước thấp nhất.",
  },
  {
    code: "EXPRESS",
    name: "Hỏa tốc",
    description: "Ưu tiên xuất trước và thông quan luồng nhanh, có phụ phí.",
  },
];

/* Tuyến biển và tuyến sắt chạy theo chuyến cố định nên không có lịch hỏa tốc. */
const NO_EXPRESS_TRANSPORT_MODES = new Set(["SEA", "RAIL"]);

const findRouteByCode = (route) => {
  const wanted = upperText(route);

  if (!wanted) {
    return null;
  }

  return (
    catalogShippingRoutes.find(
      (item) =>
        upperText(item?.routeCode) === wanted ||
        upperText(item?.routeName) === wanted
    ) || null
  );
};

const buildShippingOptionRecords = (route) => {
  const matchedRoute = findRouteByCode(route);

  /*
   * Không nhận diện được tuyến (chưa chọn, hoặc đơn cũ lưu tuyến dạng khác) thì
   * trả đủ hai hình thức: thà nhiều lựa chọn hơn là để select trống không chọn được.
   */
  const allowExpress =
    !matchedRoute ||
    !NO_EXPRESS_TRANSPORT_MODES.has(upperText(matchedRoute?.transportMode));

  return SHIPPING_OPTION_CATALOG.filter(
    (option) => allowExpress || option.code !== "EXPRESS"
  ).map((option) => ({
    value: option.code,
    label: option.name,

    code: option.code,
    shippingOption: option.code,
    shippingOptionName: option.name,
    description: option.description,

    route: trimText(matchedRoute?.routeCode ?? route),
    transportMode: upperText(matchedRoute?.transportMode),
    estimatedTransitDays: toNullableNumber(
      matchedRoute?.estimatedTransitDays
    ),
    isActive: true,
  }));
};

/**
 * Hình thức vận chuyển, lọc theo tuyến đang chọn.
 *
 * Bản thật trả mảng bản ghi thô; component tự map sang { value, label } rồi tự
 * đổi nhãn STANDARD/EXPRESS sang tiếng Việt.
 *
 * @param {{ route?: string, signal?: AbortSignal }} [options]
 * @returns {Promise<Array<object>>}
 */
export const getConsignmentShippingOptionsApi = async ({
  route,
  signal,
} = {}) => {
  await delay(undefined, signal);

  return deepClone(buildShippingOptionRecords(route));
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
 * Bản thật gọi song song 4 API rồi trả OBJECT đã tổng hợp (không phải response
 * axios). Mock giữ đúng bộ key đó; độ trễ chỉ tính một lần vì bản thật cũng
 * chạy Promise.all.
 *
 * @param {{
 *   warehouseFilters?: object,
 *   servicePricingFilters?: object,
 *   pricingRuleFilters?: object,
 *   activeWarehousesOnly?: boolean,
 *   activeRulesOnly?: boolean,
 * }} [options]
 */
export const getConsignmentMasterDataApi = async ({
  warehouseFilters = {},
  servicePricingFilters = {},
  pricingRuleFilters = {},
  activeWarehousesOnly = true,
  activeRulesOnly = true,
} = {}) => {
  const productTypes = await getProductTypesApi();

  const warehouses = applyFieldFilters(
    catalogWarehouses
      .map(normalizeWarehouseRecord)
      .filter((warehouse) => Boolean(warehouse.id) && Boolean(warehouse.name))
      .filter((warehouse) =>
        activeWarehousesOnly ? warehouse.isActive : true
      ),
    warehouseFilters
  );

  const servicePricings = applyFieldFilters(
    catalogServicePricings
      .map(normalizeServicePricingRecord)
      .filter((pricing) => Boolean(pricing.id)),
    servicePricingFilters
  );

  const pricingRules = applyFieldFilters(
    catalogPricingRules
      .map(normalizePricingRuleRecord)
      .filter((rule) => Boolean(rule.id))
      .filter((rule) => (activeRulesOnly ? rule.isActive : true)),
    pricingRuleFilters
  );

  return deepClone({
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
  });
};

const consignmentMasterService = {
  getProductTypesApi,
  getConsignmentRoutesApi,
  getConsignmentShippingOptionsApi,
  getConsignmentMasterDataApi,
};

export default consignmentMasterService;
