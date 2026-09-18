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
 * MOCK đơn KÝ GỬI — bản chỉ-giao-diện.
 *
 * Tầng HTTP đã được gỡ: mỗi hàm dưới đây đọc/ghi bộ dữ liệu mẫu trong bộ nhớ thay vì
 * gọi server. Bề mặt public giữ y nguyên bản thật (đúng tên export, đúng thứ tự tham
 * số, đúng hình dạng trả về) vì KHÔNG được sửa một dòng nào trong component.
 *
 * Nhóm hàm chuẩn hoá / tính toán (normalize*, calculateVolumeM3FromItems,
 * convertM3ToCm3) là code thuần, không liên quan mạng, nên được giữ nguyên logic —
 * chúng vẫn là nơi duy nhất chặn dữ liệu sai trước khi "gửi đi".
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm async bên dưới có một mốc "THẬT:" ghi rõ endpoint
 * và cách bản gốc bóc dữ liệu (getResponseData = response.data.data ?? response.data).
 * Chỉ cần thay phần thân sau `await delay(...)` bằng lời gọi axios tương ứng, phần
 * chuẩn hoá payload và hình dạng trả về đã đúng sẵn.
 */

import {
  createApiError,
  deepClone,
  delay,
  matchesKeyword,
  nextId,
  nowIso,
  paginate,
} from "@/mocks/mockUtils";

import consignmentStore, {
  CONSIGNMENT_CUSTOMERS,
  PACKAGE_CONFIGURATIONS,
  PRODUCT_TYPES,
  WAREHOUSES,
  findConsignmentById,
} from "@/mocks/data/consignments";

import {
  findPricingRuleByCode,
  findProductTypeById,
  findServicePricingById,
  findShippingRouteByCode,
  findWarehouseById,
} from "@/mocks/data/catalog";

import {
  getOrderStatusLabel,
  normalizeOrderStatus,
} from "../constants/orderStatus";

import { getConsignmentReceiptApi } from "./consignmentReceiptService.mock";

/* =========================
   THAM SỐ GIÁ (catalog pricingRules)

   Tỷ lệ cọc và hệ số quy đổi thể tích là cấu hình Admin (màn Quy tắc tính giá sửa
   thẳng trên cùng mảng pricingRules của catalog). Đọc NGAY LÚC GỌI, không chụp lúc
   import, để Admin đổi DEPOSIT_RATE 30 → 40 thì báo giá tạo sau đó dùng 40%.
   Thiếu rule / rule tắt / giá trị sai → dùng mặc định và console.warn (chỉ ở api/).
========================= */

const DEFAULT_DEPOSIT_PERCENT = 30;
const DEFAULT_VOLUMETRIC_DIVISOR = 6000;

const readActivePricingRuleValue = (ruleCode) => {
  const rule = findPricingRuleByCode(ruleCode);

  if (
    !rule ||
    String(rule.status || "ACTIVE")
      .trim()
      .toUpperCase() !== "ACTIVE"
  ) {
    return null;
  }

  /* null / chuỗi rỗng / không phải số → coi như thiếu (Number(null) === 0 sẽ âm thầm thành 0). */
  if (
    rule.value === null ||
    rule.value === undefined ||
    String(rule.value).trim() === ""
  ) {
    return null;
  }

  const value = Number(rule.value);

  return Number.isFinite(value)
    ? value
    : null;
};

const getDepositPercent = () => {
  const value =
    readActivePricingRuleValue(
      "DEPOSIT_RATE"
    );

  if (value === null || value < 0 || value > 100) {
    console.warn(
      `[consignmentService] Thiếu rule DEPOSIT_RATE hợp lệ trong pricingRules, dùng mặc định ${DEFAULT_DEPOSIT_PERCENT}%.`
    );
    return DEFAULT_DEPOSIT_PERCENT;
  }

  return value;
};

const getVolumetricDivisor = () => {
  const value =
    readActivePricingRuleValue(
      "VOLUMETRIC_DIVISOR"
    );

  if (value === null || value <= 0) {
    console.warn(
      `[consignmentService] Thiếu rule VOLUMETRIC_DIVISOR hợp lệ trong pricingRules, dùng mặc định ${DEFAULT_VOLUMETRIC_DIVISOR}.`
    );
    return DEFAULT_VOLUMETRIC_DIVISOR;
  }

  return value;
};

/* =========================
   NORMALIZE
========================= */

const normalizeOrderId = (orderId) => {
  const value = String(
    orderId || ""
  ).trim();

  if (!value) {
    throw new Error(
      "Không tìm thấy mã đơn ký gửi."
    );
  }

  return value;
};

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const normalizePositiveNumber = (
  value,
  fallback = 0
) => {
  return Math.max(
    0,
    normalizeNumber(value, fallback)
  );
};

const removeEmptyParams = (
  params = {}
) => {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value, fieldName) => {
  const id = normalizeText(value);
  if (!id) return null;
  if (!UUID_PATTERN.test(id)) {
    throw new Error(`${fieldName} không đúng định dạng UUID.`);
  }
  return id;
};

const normalizeUuidArray = (value, fieldName) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeUuid(item, fieldName))
        .filter(Boolean)
    )
  );
};

const normalizeConsignmentItem = (item = {}, index = 0) => {
  const productName = normalizeText(item?.productName);
  const productType = normalizeText(item?.productType);
  const quantity = Math.trunc(normalizeNumber(item?.quantity));

  if (!productName) {
    throw new Error(`Kiện ${index + 1}: vui lòng nhập tên sản phẩm.`);
  }
  if (!productType) {
    throw new Error(`Kiện ${index + 1}: vui lòng chọn loại sản phẩm.`);
  }
  if (quantity < 1 || quantity > 2147483647) {
    throw new Error(`Kiện ${index + 1}: số lượng phải từ 1 đến 2147483647.`);
  }

  const referenceUrls = Array.from(
    new Set(
      (Array.isArray(item?.referenceUrls) ? item.referenceUrls : [])
        .map(normalizeText)
        .filter(Boolean)
    )
  );

  return {
    productName,
    productType,
    quantity,
    weight: normalizePositiveNumber(item?.weight),
    width: normalizePositiveNumber(item?.width),
    height: normalizePositiveNumber(item?.height),
    length: normalizePositiveNumber(item?.length),
    declaredValue: normalizePositiveNumber(item?.declaredValue),
    referenceUrls,
    domesticTrackingCode: normalizeText(item?.domesticTrackingCode) || null,
    packageConfigurationId: normalizeUuid(
      item?.packageConfigurationId,
      `Kiện ${index + 1}: packageConfigurationId`
    ),
  };
};

/**
 * Nguyện vọng của khách khi hàng về kho VN.
 *
 * BE chỉ nhận hai giá trị này; thứ khác coi như khách chưa chọn và lúc hàng về mặc định
 * giao ngay. Trả null thay vì đoán để kho biết mà hỏi lại khách.
 *
 * @param {unknown} value
 * @returns {"DIRECT_DELIVERY" | "STORE_AT_VN" | null}
 */
const normalizeDestinationHandling = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();

  return normalized === "DIRECT_DELIVERY" || normalized === "STORE_AT_VN"
    ? normalized
    : null;
};

export const normalizeCreateConsignmentPayload = (payload = {}) => {
  const route = normalizeText(payload?.route);
  const shippingOption = normalizeText(payload?.shippingOption);
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizeConsignmentItem)
    : [];

  if (!route) throw new Error("Vui lòng chọn tuyến hàng.");
  if (!shippingOption) throw new Error("Vui lòng chọn phương thức vận chuyển.");
  if (!items.length) throw new Error("Vui lòng thêm ít nhất một kiện hàng.");

  const receiverPhone = normalizeText(payload?.receiverPhone);
  if (receiverPhone && !/^0\d{9}$/.test(receiverPhone)) {
    throw new Error("Số điện thoại người nhận phải bắt đầu bằng 0 và gồm đúng 10 chữ số.");
  }

  return {
    route,
    shippingOption,
    receiverName: normalizeText(payload?.receiverName) || null,
    receiverPhone: receiverPhone || null,
    receiverAddress: normalizeText(payload?.receiverAddress) || null,
    pricingRuleIds: normalizeUuidArray(
      payload?.pricingRuleIds,
      "pricingRuleIds"
    ),
    requiresInspection: Boolean(payload?.requiresInspection),
    requiresPacking: Boolean(payload?.requiresPacking),
    requiresWoodenCrate: Boolean(payload?.requiresWoodenCrate),
    requiresInsurance: Boolean(payload?.requiresInsurance),
    defaultDestinationHandling: normalizeDestinationHandling(
      payload?.defaultDestinationHandling
    ),
    note: normalizeText(payload?.note) || null,
    items,
  };
};

/* =========================
   NHÃN TRẠNG THÁI

   Danh sách và màn chi tiết ưu tiên statusDisplayName hơn mã trạng thái. Đổi status
   mà quên nhãn là chip vẫn hiện chữ cũ, nên mọi hàm GHI đều lấy nhãn từ module
   trạng thái đơn dùng chung (constants/orderStatus.js).
========================= */

const statusDisplayNameOf = (status) =>
  getOrderStatusLabel(status);

/* =========================
   TRUY CẬP BỘ DỮ LIỆU

   consignmentStore là chính mảng fixture được các mock khác (history, documents,
   payment, dashboard) import cùng một tham chiếu. Ghi tại chỗ vào phần tử của mảng
   này để một lần duyệt/gửi báo giá hiện ra ở mọi màn, đúng như server thật.
========================= */

const requireOrder = (orderId) => {
  const order = findConsignmentById(orderId);

  if (!order) {
    throw createApiError(
      404,
      `Không tìm thấy đơn ký gửi ${orderId}.`
    );
  }

  return order;
};

const touchOrder = (order) => {
  const timestamp = nowIso();

  order.updatedAt = timestamp;
  order.statusUpdatedAt = timestamp;

  return timestamp;
};

/* =========================
   MAP DỮ LIỆU TRẢ VỀ

   Giữ đúng phép chuẩn hoá của bản thật: spread bản ghi gốc trước rồi ghi đè các khoá
   đã chuẩn hoá, để khoá phụ (statusDisplayName, orderCode, shipments, receiptPdfUrl...)
   vẫn tới được component.
========================= */

const mapListItem = (item = {}) => ({
  ...item,

  orderId: normalizeText(
    item?.orderId ?? item?.id
  ),

  consignmentCode: normalizeText(
    item?.consignmentCode
  ),

  customerName: normalizeText(
    item?.customerName
  ),

  consignmentType: normalizeText(
    item?.consignmentType
  ),

  status: normalizeText(
    item?.status
  ).toUpperCase(),

  totalWeight: normalizePositiveNumber(
    item?.totalWeight
  ),

  totalVolume: normalizePositiveNumber(
    item?.totalVolume
  ),

  route: normalizeText(item?.route),

  receiverName: normalizeText(
    item?.receiverName
  ),

  receiverPhone: normalizeText(
    item?.receiverPhone
  ),

  receiverAddress: normalizeText(
    item?.receiverAddress
  ),

  requiresInspection: Boolean(
    item?.requiresInspection
  ),

  createdAt: normalizeText(
    item?.createdAt
  ),

  warehouseId:
    normalizeText(item?.warehouseId) ||
    null,

  pricingRuleIds: Array.isArray(
    item?.pricingRuleIds
  )
    ? item.pricingRuleIds
        .map(normalizeText)
        .filter(Boolean)
    : [],

  itemNames: Array.isArray(
    item?.itemNames
  )
    ? item.itemNames
        .map(normalizeText)
        .filter(Boolean)
    : [],
});

const mapDetail = (data = {}) => ({
  ...data,

  orderId: normalizeText(
    data?.orderId ?? data?.id
  ),

  consignmentCode: normalizeText(
    data?.consignmentCode
  ),

  status: normalizeText(
    data?.status ??
      data?.orderStatus ??
      data?.consignmentStatus
  ).toUpperCase(),

  consignmentType: normalizeText(
    data?.consignmentType
  ),

  orderType: normalizeText(
    data?.orderType
  ).toUpperCase(),

  totalWeight: normalizePositiveNumber(
    data?.totalWeight
  ),

  totalVolume: normalizePositiveNumber(
    data?.totalVolume
  ),

  route: normalizeText(data?.route),

  receiverName: normalizeText(
    data?.receiverName
  ),

  receiverPhone: normalizeText(
    data?.receiverPhone
  ),

  receiverAddress: normalizeText(
    data?.receiverAddress
  ),

  requiresInspection: Boolean(
    data?.requiresInspection
  ),

  warehouseId:
    normalizeText(data?.warehouseId) ||
    null,

  pricingRuleIds: Array.isArray(
    data?.pricingRuleIds
  )
    ? data.pricingRuleIds
        .map(normalizeText)
        .filter(Boolean)
    : [],

  itemNames: Array.isArray(
    data?.itemNames
  )
    ? data.itemNames
        .map(normalizeText)
        .filter(Boolean)
    : [],

  items: Array.isArray(data?.items)
    ? data.items
    : [],

  customer:
    data?.customer &&
    typeof data.customer === "object"
      ? data.customer
      : null,

  quotation:
    data?.quotation &&
    typeof data.quotation === "object"
      ? data.quotation
      : null,
});

/* =========================
   TẠO ĐƠN KÝ GỬI
========================= */

const round = (value, decimals = 4) => {
  const factor = 10 ** decimals;

  return (
    Math.round(
      (Number(value) || 0) * factor
    ) / factor
  );
};

/**
 * Tra loại hàng theo giá trị mà ô chọn của form gửi lên.
 *
 * Ô "Loại hàng" nạp từ getConsignmentMasterDataApi/getProductTypesApi, và bộ chọn đó
 * TRỘN hai nguồn: bộ loại hàng nghiệp vụ của đơn ký gửi (PRODUCT_TYPES) và phần bổ sung
 * từ catalog. Chỉ dò PRODUCT_TYPES thì mười lựa chọn kia luôn trượt, kiện vừa tạo lưu
 * productTypeName rỗng — nên phải dò tiếp catalog rồi mới chịu trả null.
 */
const findProductType = (value) => {
  const needle = normalizeText(
    value
  ).toUpperCase();

  const businessType = PRODUCT_TYPES.find(
    (type) =>
      String(
        type.id
      ).toUpperCase() === needle ||
      String(
        type.key
      ).toUpperCase() === needle ||
      String(
        type.name
      ).toUpperCase() === needle
  );

  if (businessType) {
    return businessType;
  }

  return (
    findProductTypeById(
      normalizeText(value)
    ) || null
  );
};

/**
 * Đổi mã tuyến của form thành chuỗi tuyến mà giao diện đang hiểu.
 *
 * Ô "TUYẾN HÀNG" gửi lên MÃ tuyến (vd "CNVN-GZ-HN-ROAD"), nhưng cả hệ thống đọc tuyến
 * dưới dạng cặp quốc gia "CN → VN": màn lập báo giá tách chuỗi theo dấu "→" để suy ra
 * kho gửi hàng và bảng giá, tách không ra thì nút gửi báo giá bị chặn vĩnh viễn với lời
 * báo "không tìm thấy kho gửi hàng phù hợp". Vì vậy quy đổi ngay lúc lưu, đúng như
 * purchaseRequestService đang làm cho đơn mua hộ; không tra được thì giữ mã gốc.
 */
const toDisplayRoute = (routeCode) => {
  const route = findShippingRouteByCode(
    routeCode
  );

  if (
    route?.originCountry &&
    route?.destinationCountry
  ) {
    return `${route.originCountry} → ${route.destinationCountry}`;
  }

  return routeCode;
};

const findPackageConfig = (id) =>
  PACKAGE_CONFIGURATIONS.find(
    (config) => config.id === id
  ) || null;

/**
 * Bù các khoá mà form tạo đơn không gửi nhưng màn chi tiết lại đọc.
 *
 * Payload gửi lên chỉ mang tên/kích thước/số lượng; bảng kiện hàng ở màn chi tiết
 * còn đọc productTypeName, volumetricWeight và packageConfiguration. Server thật
 * trả về sau khi tra master data, nên mock phải tra tại chỗ, nếu không kiện vừa tạo
 * hiện "—" ở ba cột đó.
 */
const buildStoredItem = (item, index) => {
  const productType = findProductType(
    item.productType
  );

  const packageConfig =
    findPackageConfig(
      item.packageConfigurationId
    ) || PACKAGE_CONFIGURATIONS[1];

  const volumeCm3 =
    item.length *
    item.width *
    item.height;

  const estimatedFee =
    packageConfig.configCode ===
    "CUSTOM"
      ? Math.min(
          Math.round(
            (volumeCm3 / 1000) *
              packageConfig.packageFee
          ),
          packageConfig.maxFee
        )
      : packageConfig.packageFee;

  const itemId = `17e0f${String(
    index + 1
  ).padStart(
    3,
    "0"
  )}-0000-4000-8000-${String(
    Date.now() + index
  )
    .slice(-12)
    .padStart(12, "0")}`;

  return {
    id: itemId,
    itemId,

    productName: item.productName,

    productType:
      productType?.id ||
      item.productType,
    productTypeId:
      productType?.id ||
      item.productType,
    productTypeName:
      productType?.name || "",

    quantity: item.quantity,
    weight: item.weight,
    actualWeight: item.weight,

    length: item.length,
    width: item.width,
    height: item.height,

    volumetricWeight: round(
      volumeCm3 / getVolumetricDivisor()
    ),

    declaredValue: item.declaredValue,

    referenceUrls: item.referenceUrls,
    imageUrls: item.referenceUrls,

    domesticTrackingCode:
      item.domesticTrackingCode,

    packageConfigurationId:
      packageConfig.id,

    packageConfiguration: {
      id: packageConfig.id,
      configCode:
        packageConfig.configCode,
      configName:
        packageConfig.configName,
      displayName:
        packageConfig.configName,
      length: packageConfig.length,
      width: packageConfig.width,
      height: packageConfig.height,
      maxWeight:
        packageConfig.maxWeight,
      packageFee:
        packageConfig.packageFee,
      maxFee: packageConfig.maxFee,
      estimatedFee,
      status: packageConfig.status,
    },
  };
};

const DESTINATION_HANDLING_TEXT = {
  DIRECT_DELIVERY:
    "Giao ngay khi hàng về Việt Nam",
  STORE_AT_VN:
    "Gửi lại kho Việt Nam",
};

/**
 * THẬT: POST /api/orders/consignments — trả về getResponseData(response).
 *
 * Bản thật trả bản ghi đơn vừa tạo. Mock dựng bản ghi đầy đủ rồi chèn lên đầu bộ dữ
 * liệu để danh sách (sắp theo createdAt giảm dần) thấy nó ngay ở trang 1, và màn chi
 * tiết mở được bằng orderId vừa sinh.
 */
export const createConsignmentApi = async (payload = {}) => {
  const requestBody =
    normalizeCreateConsignmentPayload(
      payload
    );

  await delay();

  const items = requestBody.items.map(
    buildStoredItem
  );

  /* Chọn khách theo số đơn đang có để mỗi đơn tạo mới không dồn hết vào một người. */
  const customer =
    CONSIGNMENT_CUSTOMERS[
      consignmentStore.length %
        CONSIGNMENT_CUSTOMERS.length
    ];

  const warehouse = WAREHOUSES[0];

  const code = nextId("VCL");
  const orderId = `0deaf001-0000-4000-8000-${String(
    consignmentStore.length + 1
  ).padStart(12, "0")}`;

  const totalWeight = round(
    items.reduce(
      (total, item) =>
        total + item.weight,
      0
    )
  );

  const totalVolume = round(
    items.reduce(
      (total, item) =>
        total +
        item.length *
          item.width *
          item.height,
      0
    )
  );

  const totalDimWeight = round(
    items.reduce(
      (total, item) =>
        total + item.volumetricWeight,
      0
    )
  );

  const timestamp = nowIso();

  const order = {
    orderId,
    id: orderId,

    consignmentCode: code,
    orderCode: code,
    trackingCode: code,

    orderType: "CONSIGNMENT",
    consignmentType:
      requestBody.shippingOption,
    shippingOption:
      requestBody.shippingOption,

    status: "PENDING_REVIEW",
    statusDisplayName:
      statusDisplayNameOf("PENDING_REVIEW"),
    orderStatus: "PENDING_REVIEW",
    consignmentStatus:
      "PENDING_REVIEW",
    paymentStatus: "",
    depositStatus: "",
    rejectionReason: null,

    /* Cặp quốc gia, không phải mã tuyến — xem toDisplayRoute. Giữ đúng một khoá
       `route` như bộ đơn mẫu để mọi màn đọc cùng một dạng dữ liệu. */
    route: toDisplayRoute(
      requestBody.route
    ),

    customerId: customer.customerId,
    customerName: customer.fullName,
    customerPhone: customer.phone,

    customer: {
      id: customer.customerId,
      customerId: customer.customerId,
      customerCode:
        customer.customerCode,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
    },

    receiverName:
      requestBody.receiverName || "",
    receiverPhone:
      requestBody.receiverPhone || "",
    receiverAddress:
      requestBody.receiverAddress ||
      "",

    warehouseId: warehouse.id,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,

    requiresInspection:
      requestBody.requiresInspection,
    requiresPacking:
      requestBody.requiresPacking,
    requiresWoodenCrate:
      requestBody.requiresWoodenCrate,
    requiresInsurance:
      requestBody.requiresInsurance,

    defaultDestinationHandling:
      requestBody.defaultDestinationHandling,
    defaultDestinationHandlingText:
      requestBody.defaultDestinationHandling
        ? DESTINATION_HANDLING_TEXT[
            requestBody
              .defaultDestinationHandling
          ]
        : "",

    note: requestBody.note || "",

    pricingRuleIds:
      requestBody.pricingRuleIds,

    itemNames: items.map(
      (item) => item.productName
    ),

    totalWeight,
    weightKg: totalWeight,

    /* cm³ — danh sách và chi tiết đều đọc totalVolume theo cm³ rồi tự đổi sang m³. */
    totalVolume,
    totalVolumeM3: round(
      totalVolume / 1_000_000,
      6
    ),

    totalDimWeight,
    declaredValue: items.reduce(
      (total, item) =>
        total + item.declaredValue,
      0
    ),
    totalQuantity: items.reduce(
      (total, item) =>
        total + item.quantity,
      0
    ),
    packageCount: items.length,
    itemCount: items.length,

    receiptPdfUrl: null,

    createdAt: timestamp,
    updatedAt: timestamp,
    statusUpdatedAt: timestamp,
    quotationCreatedAt: null,
    paymentConfirmedAt: null,
    warehouseNotifiedAt: null,
    warehouseNotifiedNote: null,

    items,
    shipments: [],
    quotation: null,
  };

  consignmentStore.unshift(order);

  return deepClone(order);
};

/**
 * THẬT: POST /api/orders/consignments/validate-items — trả về getResponseData(response).
 *
 * Bản thật trả kết quả kiểm tra từng kiện. Toàn bộ luật chặn nằm ở
 * normalizeConsignmentItem nên mock chỉ cần báo hợp lệ khi qua được chuẩn hoá.
 */
export const validateConsignmentItemsApi = async (items = []) => {
  const normalizedItems = Array.isArray(items)
    ? items.map(normalizeConsignmentItem)
    : [];
  if (!normalizedItems.length) {
    throw new Error("Vui lòng thêm ít nhất một kiện hàng để kiểm tra.");
  }

  await delay(160);

  return {
    valid: true,
    isValid: true,
    errors: [],
    items: normalizedItems.map(
      (item, index) => ({
        index,
        productName: item.productName,
        valid: true,
        messages: [],
      })
    ),
  };
};

/* =========================
   UNIT HELPER
========================= */

/**
 * Kích thước đầu vào: cm
 * Kết quả trả về: m³
 *
 * Công thức:
 * length × width × height × quantity
 * chia 1.000.000
 */
export const calculateVolumeM3FromItems = (
  items = []
) => {
  if (!Array.isArray(items)) {
    return 0;
  }

  const totalVolumeM3 = items.reduce(
    (total, item) => {
      const lengthCm =
        normalizePositiveNumber(
          item?.length
        );

      const widthCm =
        normalizePositiveNumber(
          item?.width
        );

      const heightCm =
        normalizePositiveNumber(
          item?.height
        );

      const quantity = Math.max(
        1,
        Math.trunc(
          normalizeNumber(
            item?.quantity,
            1
          )
        )
      );

      const itemVolumeCm3 =
        lengthCm *
        widthCm *
        heightCm *
        quantity;

      return (
        total +
        itemVolumeCm3 / 1_000_000
      );
    },
    0
  );

  return Number(
    totalVolumeM3.toFixed(6)
  );
};

/**
 * Đổi m³ sang cm³.
 */
export const convertM3ToCm3 = (
  volumeM3
) => {
  const value =
    normalizePositiveNumber(volumeM3);

  return Number(
    (value * 1_000_000).toFixed(2)
  );
};

/* =========================
   QUOTATION PAYLOAD
========================= */

const normalizeAdditionalFees = (
  additionalFees
) => {
  if (!Array.isArray(additionalFees)) {
    return [];
  }

  return additionalFees.map((fee) => ({
    feeId: normalizeText(fee?.feeId),
    code: normalizeText(fee?.code),
    label: normalizeText(fee?.label),
    amount: normalizePositiveNumber(
      fee?.amount
    ),
    enabled:
      fee?.enabled !== false,
  }));
};

export const normalizeQuotationPayload = (
  payload = {}
) => {
  const servicePricingId =
    normalizeText(
      payload?.servicePricingId
    );

  const serviceType =
    normalizeText(payload?.serviceType);

  const salesNote =
    normalizeText(payload?.salesNote);

  const quotation =
    payload?.quotation &&
    typeof payload.quotation ===
      "object"
      ? payload.quotation
      : {};

  const submittedAtUtc =
    normalizeText(
      payload?.submittedAtUtc
    );

  const clientSubmittedAtUtc =
    normalizeText(
      payload?.clientSubmittedAtUtc
    ) || submittedAtUtc;

  return {
    submittedAtUtc,
    clientSubmittedAtUtc,
    clientTimeZone: normalizeText(
      payload?.clientTimeZone
    ),
    clientUtcOffset: normalizeText(
      payload?.clientUtcOffset
    ),
    clientUtcOffsetMinutes:
      normalizeNumber(
        payload?.clientUtcOffsetMinutes,
        0
      ),
    warehouseId: normalizeText(
      payload?.warehouseId
    ),
    servicePricingId,
    serviceType,
    weightKg: normalizePositiveNumber(
      payload?.weightKg
    ),
    volumeM3: normalizePositiveNumber(
      payload?.volumeM3
    ),
    packageCount: Math.max(
      1,
      Math.trunc(
        normalizeNumber(
          payload?.packageCount,
          1
        )
      )
    ),
    declaredValue:
      normalizePositiveNumber(
        payload?.declaredValue
      ),
    salesNote,
    quotation: {
      servicePricingId:
        normalizeText(
          quotation?.servicePricingId
        ) || servicePricingId,
      serviceType:
        normalizeText(
          quotation?.serviceType
        ) || serviceType,
      originCountry:
        normalizeText(
          quotation?.originCountry
        ),
      destinationCountry:
        normalizeText(
          quotation?.destinationCountry
        ),
      unitType:
        normalizeText(
          quotation?.unitType
        ),
      unitPrice:
        normalizePositiveNumber(
          quotation?.unitPrice
        ),
      currency:
        normalizeText(
          quotation?.currency
        ),
      totalWeight:
        normalizePositiveNumber(
          quotation?.totalWeight
        ),
      totalVolume:
        normalizePositiveNumber(
          quotation?.totalVolume
        ),
      volumetricWeight:
        normalizePositiveNumber(
          quotation?.volumetricWeight
        ),
      chargeableWeight:
        normalizePositiveNumber(
          quotation?.chargeableWeight
        ),
      mainServiceAmount:
        normalizePositiveNumber(
          quotation?.mainServiceAmount
        ),
      additionalFees:
        normalizeAdditionalFees(
          quotation?.additionalFees
        ),
      discountPercent:
        normalizePositiveNumber(
          quotation?.discountPercent
        ),
      subtotal:
        normalizePositiveNumber(
          quotation?.subtotal
        ),
      discount:
        normalizePositiveNumber(
          quotation?.discount
        ),
      total:
        normalizePositiveNumber(
          quotation?.total
        ),
      estimatedFreightCharge:
        normalizePositiveNumber(
          quotation
            ?.estimatedFreightCharge
        ),
      serviceFee:
        normalizePositiveNumber(
          quotation?.serviceFee
        ),
      totalEstimatedCost:
        normalizePositiveNumber(
          quotation
            ?.totalEstimatedCost
        ),
      vat: normalizePositiveNumber(
        quotation?.vat
      ),
      importTax:
        normalizePositiveNumber(
          quotation?.importTax
        ),
      salesNote:
        normalizeText(
          quotation?.salesNote
        ) || salesNote,
    },
  };
};

const validateQuotationPayload = (
  payload
) => {
  if (!payload?.warehouseId) {
    throw new Error(
      "Vui lòng chọn kho xử lý."
    );
  }

  if (!payload?.servicePricingId) {
    throw new Error(
      "Vui lòng chọn bảng giá dịch vụ."
    );
  }

  if (!payload?.serviceType) {
    throw new Error(
      "Vui lòng chọn loại dịch vụ."
    );
  }

  if (payload.weightKg <= 0) {
    throw new Error(
      "Khối lượng phải lớn hơn 0 kg."
    );
  }

  if (payload.volumeM3 <= 0) {
    throw new Error(
      "Thể tích phải lớn hơn 0 m³."
    );
  }

  if (payload.packageCount <= 0) {
    throw new Error(
      "Số kiện phải lớn hơn 0."
    );
  }
};

/**
 * Dựng bản ghi báo giá đúng hình dạng màn chi tiết đang đối soát.
 *
 * ConsignmentDetail cộng đúng bốn khoản estimatedFreightCharge + domesticShippingFee +
 * serviceFee + taxAndDuty rồi so với totalEstimatedCost, lệch quá 1 ₫ là hiện cảnh báo
 * "Tổng báo giá đang lệch". Nhưng normalizeQuotationPayload KHÔNG giữ domesticShippingFee
 * lẫn taxAndDuty (form gửi hai khoá đó, phần chuẩn hoá lọc bỏ), nên phải suy lại:
 *   - thuế: ưu tiên vat + importTax, không có thì cộng đúng hai dòng phí VAT / IMPORT_TAX
 *     trong additionalFees — đây là nơi màn lập báo giá thực sự khai thuế;
 *   - nội địa: lấy phần còn lại của tổng, vì form gộp cả phí đóng gói, đóng kiện gỗ,
 *     phụ phí và giảm giá vào tổng mà bốn khoản trên không có chỗ chứa.
 * Nhờ vậy tổng luôn khớp tuyệt đối mà vẫn giữ đúng con số sale đã thấy trước khi gửi.
 */
const buildQuotationRecord = (
  order,
  payload,
  { status, quoteType }
) => {
  const source = payload.quotation;

  const freight =
    source.estimatedFreightCharge ||
    source.mainServiceAmount;

  const service = source.serviceFee;

  const feeAmountByCode = (code) =>
    source.additionalFees
      .filter(
        (fee) =>
          fee.enabled &&
          fee.code.toUpperCase() ===
            code
      )
      .reduce(
        (sum, fee) => sum + fee.amount,
        0
      );

  const vat =
    source.vat ||
    feeAmountByCode("VAT");

  const importTax =
    source.importTax ||
    feeAmountByCode("IMPORT_TAX");

  const tax = vat + importTax;

  const total =
    source.totalEstimatedCost ||
    Math.max(
      0,
      source.subtotal -
        source.discount
    ) + tax;

  const domesticFromFees =
    feeAmountByCode("DOMESTIC_FEE");

  const remainder = round(
    total - freight - service - tax,
    2
  );

  const domestic =
    remainder >= 0
      ? remainder
      : domesticFromFees;

  const servicePricing =
    findServicePricingById(
      source.servicePricingId
    );

  const warehouse =
    findWarehouseById(
      payload.warehouseId
    );

  const timestamp = nowIso();

  const depositPercent =
    getDepositPercent();

  return {
    quotationId: `9c0af001-0000-4000-8000-${String(
      Date.now()
    )
      .slice(-12)
      .padStart(12, "0")}`,
    id: `9c0af001-0000-4000-8000-${String(
      Date.now()
    )
      .slice(-12)
      .padStart(12, "0")}`,

    orderId: order.orderId,
    consignmentCode:
      order.consignmentCode,

    quoteType,
    status,
    paymentStatus: "",
    depositStatus: "",

    servicePricingId:
      source.servicePricingId || null,
    serviceType:
      source.serviceType ||
      servicePricing?.serviceType ||
      order.consignmentType,

    warehouseId: payload.warehouseId,
    warehouseName:
      warehouse?.name ||
      order.warehouseName ||
      "",

    originCountry:
      source.originCountry ||
      servicePricing?.originCountry ||
      "CN",
    destinationCountry:
      source.destinationCountry ||
      servicePricing?.destinationCountry ||
      "VN",

    unitType:
      source.unitType ||
      servicePricing?.unitType ||
      "KG",
    unitPrice:
      source.unitPrice ||
      servicePricing?.price ||
      0,
    currency:
      source.currency ||
      servicePricing?.currency ||
      "VND",

    totalWeight:
      source.totalWeight ||
      payload.weightKg,
    totalVolume:
      source.totalVolume ||
      convertM3ToCm3(
        payload.volumeM3
      ),
    volumetricWeight:
      source.volumetricWeight,
    chargeableWeight:
      source.chargeableWeight,
    packageCount:
      payload.packageCount,
    declaredValue:
      payload.declaredValue ||
      order.declaredValue ||
      0,

    mainServiceAmount:
      source.mainServiceAmount ||
      freight,

    additionalFees:
      source.additionalFees,

    discountPercent:
      source.discountPercent,
    subtotal: source.subtotal,
    discount: source.discount,
    total,

    estimatedFreightCharge: freight,
    domesticShippingFee: domestic,
    serviceFee: service,
    taxAndDuty: tax,
    vat,
    importTax,
    totalEstimatedCost:
      freight +
      domestic +
      service +
      tax,

    depositPercent,
    depositAmount: Math.round(
      (total * depositPercent) / 100
    ),

    salesNote: source.salesNote,
    note: source.salesNote,

    createdAt: timestamp,
    submittedAtUtc:
      payload.submittedAtUtc ||
      timestamp,
    expiredAt: new Date(
      Date.now() +
        5 * 24 * 60 * 60 * 1000
    ).toISOString(),
  };
};

/* =========================
   STATUS PAYLOAD
========================= */

const REVIEW_STATUSES = new Set([
  "APPROVED",
  "REJECTED",
]);

export const normalizeConsignmentStatusPayload =
  (payload = {}) => {
    const status = normalizeText(
      payload?.status
    ).toUpperCase();

    const rejectionReason =
      normalizeText(
        payload?.rejectionReason
      );

    if (!REVIEW_STATUSES.has(status)) {
      throw new Error(
        "Trạng thái chỉ được phép là APPROVED hoặc REJECTED."
      );
    }

    if (
      status === "REJECTED" &&
      rejectionReason.length < 3
    ) {
      throw new Error(
        "Vui lòng nhập lý do từ chối ít nhất 3 ký tự."
      );
    }

    return {
      status,
      rejectionReason:
        status === "REJECTED"
          ? rejectionReason
          : "",
    };
  };

/* =========================
   LẤY DANH SÁCH ĐƠN KÝ GỬI
========================= */

const LIST_KEYWORD_FIELDS = [
  "consignmentCode",
  "orderCode",
  "trackingCode",
  "customerName",
  "customerPhone",
  "receiverName",
  "receiverPhone",
  "receiverAddress",
  "route",
  "itemNames",
];

const toTime = (value) => {
  const time = new Date(
    value ?? 0
  ).getTime();

  return Number.isFinite(time)
    ? time
    : 0;
};

/**
 * THẬT: GET /api/orders/consignments?pageNumber&pageSize&status...
 * Bản thật gọi getResponseData(response) rồi chuẩn hoá từng dòng và tự bù phân trang.
 *
 * Lọc theo status được làm Ở ĐÂY (server-side) vì PendingConsignmentList và màn Lịch sử
 * đổi tab trạng thái rồi đọc totalCount/totalPages trả về để vẽ phân trang — lọc ở
 * component sẽ ra tổng sai.
 */
export const getConsignmentsApi =
  async (filters = {}) => {
    const params =
      removeEmptyParams({
        ...filters,

        pageNumber:
          filters?.pageNumber ??
          filters?.page ??
          1,

        pageSize:
          filters?.pageSize ??
          filters?.limit ??
          10,
      });

    await delay(
      240,
      filters?.signal
    );

    /* Lọc theo mã đích: mã cũ trong tham số (bookmark, dữ liệu lạ) được chuẩn hóa trước. */
    const status = normalizeText(
      normalizeOrderStatus(params?.status)
    ).toUpperCase();

    const keyword = normalizeText(
      params?.keyword ??
        params?.search ??
        params?.searchText ??
        params?.q
    );

    const consignmentType =
      normalizeText(
        params?.consignmentType
      ).toUpperCase();

    const customerId = normalizeText(
      params?.customerId
    );

    const warehouseId = normalizeText(
      params?.warehouseId
    );

    const fromTime = params?.fromDate
      ? toTime(params.fromDate)
      : 0;

    const toDateTime = params?.toDate
      ? toTime(params.toDate)
      : 0;

    const rows = consignmentStore
      .filter((order) => {
        if (
          status &&
          status !== "ALL" &&
          String(
            normalizeOrderStatus(
              order.status
            ) ?? ""
          )
            .trim()
            .toUpperCase() !== status
        ) {
          return false;
        }

        if (
          consignmentType &&
          String(
            order.consignmentType
          )
            .trim()
            .toUpperCase() !==
            consignmentType
        ) {
          return false;
        }

        if (
          customerId &&
          order.customerId !==
            customerId
        ) {
          return false;
        }

        if (
          warehouseId &&
          order.warehouseId !==
            warehouseId
        ) {
          return false;
        }

        const createdTime = toTime(
          order.createdAt
        );

        if (
          fromTime &&
          createdTime < fromTime
        ) {
          return false;
        }

        if (
          toDateTime &&
          createdTime > toDateTime
        ) {
          return false;
        }

        return matchesKeyword(
          order,
          keyword,
          LIST_KEYWORD_FIELDS
        );
      })
      /* Mặc định mới nhất trước, đúng như sortBy=createdAt&sortDir=desc mà dashboard gửi. */
      .sort((first, second) => {
        const direction =
          normalizeText(
            params?.sortDir
          ).toLowerCase() === "asc"
            ? -1
            : 1;

        return (
          direction *
          (toTime(second.createdAt) -
            toTime(first.createdAt))
        );
      });

    const page = paginate(rows, {
      pageNumber: params?.pageNumber,
      pageSize: params?.pageSize,
    });

    return {
      ...page,
      items: page.items.map(mapListItem),
    };
  };

/* =========================
   LẤY CHI TIẾT ĐƠN KÝ GỬI
========================= */

/**
 * THẬT: GET /api/orders/consignments/{orderId} — trả về getResponseData(response),
 * và bản thật ném lỗi khi payload rỗng.
 */
export const getConsignmentDetailApi =
  async (orderId) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    await delay();

    const order = requireOrder(
      normalizedOrderId
    );

    return mapDetail(
      deepClone(order)
    );
  };

/* =========================
   CẬP NHẬT TRẠNG THÁI ĐƠN
   ACCEPTED -> APPROVED / REJECTED
========================= */

/**
 * THẬT: PUT /api/orders/consignments/{orderId}/status — trả về getResponseData(response).
 *
 * Ghi thẳng vào bản ghi trong bộ nhớ: màn chi tiết cập nhật lạc quan rồi gọi lại
 * getConsignmentDetailApi để đối chiếu, nên không ghi là trạng thái nhảy về cũ.
 */
export const updateConsignmentStatusApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeConsignmentStatusPayload(
        requestPayload
      );

    await delay();

    const order = requireOrder(
      normalizedOrderId
    );

    order.status = payload.status;
    order.orderStatus = payload.status;
    order.consignmentStatus =
      payload.status;
    order.statusDisplayName =
      statusDisplayNameOf(
        payload.status
      );
    order.rejectionReason =
      payload.status === "REJECTED"
        ? payload.rejectionReason
        : null;

    const updatedAt =
      touchOrder(order);

    return {
      orderId: order.orderId,
      consignmentCode:
        order.consignmentCode,
      status: order.status,
      statusDisplayName:
        order.statusDisplayName,
      rejectionReason:
        order.rejectionReason,
      updatedAt,
      success: true,
      message:
        payload.status === "APPROVED"
          ? "Đã xác nhận yêu cầu ký gửi."
          : "Đã hủy yêu cầu ký gửi.",
    };
  };

export const approveConsignmentApi =
  async (orderId) => {
    return updateConsignmentStatusApi(
      orderId,
      {
        status: "APPROVED",
        rejectionReason: "",
      }
    );
  };

export const rejectConsignmentApi =
  async (
    orderId,
    rejectionReason
  ) => {
    return updateConsignmentStatusApi(
      orderId,
      {
        status: "REJECTED",
        rejectionReason,
      }
    );
  };

/* =========================
   TẠO BÁO GIÁ TẠM TÍNH
========================= */

/**
 * THẬT: POST /api/orders/consignments/{orderId}/quotations/estimate
 * — trả về getResponseData(response).
 *
 * Tạm tính nên KHÔNG ghi vào đơn: chỉ trả bảng số để màn lập báo giá đối chiếu.
 */
export const estimateQuotationApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeQuotationPayload(
        requestPayload
      );

    validateQuotationPayload(payload);

    await delay();

    const order = requireOrder(
      normalizedOrderId
    );

    return buildQuotationRecord(
      order,
      payload,
      {
        status: "DRAFT",
        quoteType: "ESTIMATE",
      }
    );
  };

/* =========================
   GỬI BÁO GIÁ CHÍNH THỨC
========================= */

/**
 * THẬT: POST /api/orders/consignments/{orderId}/quotations
 * — trả về getResponseData(response).
 *
 * Gửi thành công thì đơn chuyển sang QUOTATION_SENT và mang theo báo giá vừa lập:
 * sau khi gửi, màn lập báo giá điều hướng về chi tiết đơn và đọc detail.quotation.
 */
export const sendQuotationApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeQuotationPayload(
        requestPayload
      );

    validateQuotationPayload(payload);

    await delay();

    const order = requireOrder(
      normalizedOrderId
    );

    const quotation =
      buildQuotationRecord(
        order,
        payload,
        {
          status: "SENT",
          quoteType: "OFFICIAL",
        }
      );

    order.quotation = quotation;
    order.quotationCreatedAt =
      quotation.createdAt;
    order.status = "QUOTATION_SENT";
    order.orderStatus =
      "QUOTATION_SENT";
    order.consignmentStatus =
      "QUOTATION_SENT";
    order.statusDisplayName =
      statusDisplayNameOf("QUOTATION_SENT");

    if (payload.warehouseId) {
      order.warehouseId =
        payload.warehouseId;
    }

    touchOrder(order);

    return deepClone(quotation);
  };

export { getConsignmentReceiptApi };

/* =====================================================
   DEFAULT EXPORT
===================================================== */

const consignmentService = {
  calculateVolumeM3FromItems,
  convertM3ToCm3,
  normalizeQuotationPayload,
  normalizeConsignmentStatusPayload,
  normalizeCreateConsignmentPayload,
  createConsignmentApi,
  validateConsignmentItemsApi,
  getConsignmentsApi,
  getConsignmentDetailApi,
  updateConsignmentStatusApi,
  approveConsignmentApi,
  rejectConsignmentApi,
  estimateQuotationApi,
  sendQuotationApi,
  getConsignmentReceiptApi,
};

export default consignmentService;
