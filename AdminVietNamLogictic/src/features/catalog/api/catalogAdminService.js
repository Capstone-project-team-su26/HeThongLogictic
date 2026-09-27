/*
 * Danh mục nền của Admin — ĐÃ NỐI API THẬT (11 nhóm, 55 hàm).
 *
 * Trước đây 11 nhóm này nằm trong @features/admin/api/adminService dưới dạng dữ liệu giả
 * trong bộ nhớ: Admin sửa danh mục mà KHÔNG ghi xuống DB và thấy dữ liệu khác hệ thống
 * thật. adminService re-export nguyên tên + chữ ký cũ từ đây, nên AdminCatalogPages không
 * phải đổi import.
 *
 * Endpoint (VCL_API/Controllers — trùng swagger production). "TRẦN" = object/mảng không bọc.
 *
 *   PHƯƠNG THỨC VẬN CHUYỂN  ShippingMethodsController (mọi thao tác: Admin)
 *     GET    /api/shipping-methods            → { message, data: [] } (cả phương thức đang tắt)
 *     GET    /api/shipping-methods/{id}       → { message, data }
 *     POST   /api/shipping-methods            → 201 { message, data } · 409 trùng mã
 *     PUT    /api/shipping-methods/{id}       → { message } (không trả bản ghi)
 *     DELETE /api/shipping-methods/{id}       → { message } — XOÁ CỨNG; đang được dùng thì 500
 *   CẤU HÌNH ĐÓNG GÓI  PackageConfigurationController (ghi: Admin)
 *     GET    /api/package-configurations      → MẢNG TRẦN, CHỈ thùng ACTIVE (không có "all")
 *     GET    /api/package-configurations/{id} → TRẦN
 *     POST   /api/package-configurations      → 201 { message, data }
 *     PUT    /api/package-configurations/{id} → { message, data }
 *     DELETE /api/package-configurations/{id} → { message } — chỉ chuyển INACTIVE
 *   PHÍ DỊCH VỤ BỔ SUNG  AdditionalServiceFeeController (ghi: Admin) — bảng RIÊNG, không phải pricing-rules
 *     GET    /api/additional-service-fees?activeOnly=  → { message, data: [] }
 *     GET    /api/additional-service-fees/{id}         → { message, data }
 *     POST   → 201 { message, data } · PUT → { message } · DELETE → { message } (xoá cứng)
 *   BẢNG GIÁ DỊCH VỤ  ServicePricingController (ghi: Admin)
 *     GET    /api/service-pricings(/{id})     → TRẦN (dùng lại servicePricingService)
 *     POST   → 201 TRẦN · PUT → { message } · DELETE → { message } (xoá mềm IsDeleted)
 *   QUY TẮC TÍNH GIÁ  PricingRuleController (ghi: Admin)
 *     GET    /api/pricing-rules(/{id})        → TRẦN (dùng lại pricingRuleService)
 *     POST   → 201 TRẦN · PUT → { message } · DELETE → { message } (xoá cứng)
 *   HÀNG CẤM / HẠN CHẾ  RestrictedItemController (ghi: Admin)
 *     GET    /api/restricted-items(/{id})     → TRẦN
 *     POST   → 201 TRẦN · PUT → { message } · DELETE → { message }
 *   LOẠI HÀNG  ProductTypeController
 *     GET    /api/product-types/all (Admin)   → { message, data: [] } (cả loại đã ngừng)
 *     GET    /api/product-types/{id}          → { message, data }
 *     POST   → 201 { message, data } · PUT → { message }
 *     DELETE → { message } — loại đã có trong đơn thì backend chỉ chuyển ngừng sử dụng
 *   ĐƠN VỊ TÍNH  UnitOfMeasureController (Admin) — cùng khuôn với loại hàng, list = /all
 *   NHÀ CUNG CẤP  SupplierController (đọc: mọi nhân viên · ghi: Admin)
 *     GET    /api/suppliers(/{id})            → { message, data }
 *     POST   → 201 { message, data } · PUT → { message }
 *     DELETE → { message } — đang gán cho tuyến thì chỉ chuyển ngừng sử dụng
 *   TUYẾN VẬN CHUYỂN  → dùng lại ./transportCatalogService (đã nối thật từ trước)
 *   TỶ GIÁ  ExchangeRateController (ghi: Admin)
 *     GET    /api/exchange-rates?activeOnly=  → MẢNG TRẦN
 *     GET    /api/exchange-rates/{id}         → TRẦN (Admin/Sale/OM)
 *     POST   → 201 TRẦN · 400 nếu mã tiền tệ đã có
 *     PUT    → TRẦN (KHÔNG đổi được mã tiền tệ) · DELETE → 204
 *
 * Ràng buộc body lấy từ DTO backend (Nullable enable ⇒ string không-null là BẮT BUỘC có mặt,
 * được phép chuỗi rỗng): đơn vị tính `description`, nhà cung cấp `country/contactPerson/phone/
 * address/note` luôn gửi chuỗi (không gửi null); email nhà cung cấp bị [EmailAddress] nên
 * phải là email hợp lệ; các trường decimal không-null (giá trị, kích thước…) phải là số.
 *
 * Lỗi HTTP ném nguyên dạng axios để trang đọc qua getAdminApiError (hiện đúng câu backend,
 * kể cả lỗi xoá danh mục đang được dùng). Lỗi kiểm tra tại chỗ là Error thường, không gọi mạng.
 *
 * KHÔNG import adminService ở đây (adminService re-export file này → vòng import). Import sâu
 * vào @features/pricing/api/* thay vì barrel @features/pricing: barrel kéo theo component trang.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";
import {
  getPackageConfigurationsApi,
  normalizePackageConfiguration,
} from "@features/pricing/api/packageConfigurationService";
import {
  getPricingRuleDetailApi,
  getPricingRulesApi,
  normalizePricingRule,
} from "@features/pricing/api/pricingRuleService";
import {
  getServicePricingDetailApi,
  getServicePricingsApi,
  normalizeServicePricing,
} from "@features/pricing/api/servicePricingService";
import {
  createShippingRouteApi,
  deleteShippingRouteApi,
  getShippingRouteDetailApi,
  getShippingRoutesApi,
  updateShippingRouteApi,
} from "./transportCatalogService";

const encodeId = (value) => encodeURIComponent(String(value));

const ENDPOINTS = Object.freeze({
  shippingMethods: "/api/shipping-methods",
  shippingMethodDetail: (id) => `/api/shipping-methods/${encodeId(id)}`,
  productTypesAll: `${API_ENDPOINTS.productTypes}/all`,
  productTypeDetail: (id) => `${API_ENDPOINTS.productTypes}/${encodeId(id)}`,
  unitsOfMeasure: "/api/units-of-measure",
  unitsOfMeasureAll: "/api/units-of-measure/all",
  unitOfMeasureDetail: (id) => `/api/units-of-measure/${encodeId(id)}`,
  suppliers: "/api/suppliers",
  supplierDetail: (id) => `/api/suppliers/${encodeId(id)}`,
});

export const RESTRICTION_TYPES = Object.freeze(["BANNED", "RESTRICTED", "WARNING"]);
export const SUPPLIER_TYPES = Object.freeze(["TRANSIT", "PICKUP", "GOODS", "SERVICE"]);
export const CALCULATION_TYPES = Object.freeze([
  "FIXED",
  "PERCENTAGE",
  "PER_KG",
  "PER_CBM",
  "PER_PRODUCT",
]);

/* =========================
   HELPERS
========================= */

const trimText = (value) => String(value ?? "").trim();
const upperText = (value) => trimText(value).toUpperCase();
const textOrNull = (value) => trimText(value) || null;

const requireId = (value, label) => {
  const id = trimText(value);
  if (!id) throw new Error(`Không tìm thấy ${label}.`);
  return id;
};

const toNumberOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/* decimal không-null ở backend: thiếu thì báo tại chỗ, không để JSON binder trả 400 khó đọc. */
const requireNumber = (value, label, { min = 0, exclusiveMin = false } = {}) => {
  const number = toNumberOrNull(value);
  if (number === null || number < min || (exclusiveMin && number === min)) {
    throw new Error(`${label} phải là số ${exclusiveMin ? "lớn hơn" : "không nhỏ hơn"} ${min}.`);
  }
  return number;
};

const requireText = (value, label) => {
  const text = trimText(value);
  if (!text) throw new Error(`Vui lòng nhập ${label}.`);
  return text;
};

const requireOneOf = (value, allowed, label) => {
  const code = upperText(value);
  if (!allowed.includes(code)) {
    throw new Error(`${label} chỉ nhận: ${allowed.join(", ")}.`);
  }
  return code;
};

const isActiveFlag = (value) => value !== false;

const withSignal = (options) => ({ signal: options?.signal });

/*
 * PUT/DELETE của đa số controller chỉ trả { message } — KHÔNG có bản ghi. Không tự dựng bản ghi
 * từ payload (sẽ là giả vờ đã lưu): trả id + message backend; AdminResourcePage tự nạp lại danh
 * sách sau khi lưu. Endpoint nào trả bản ghi thì chuẩn hoá bản ghi đó.
 */
const writeResult = (id, response, normalize, fallbackMessage) => {
  const data = getResponseData(response);
  if (data && typeof data === "object" && !Array.isArray(data) && (data.id || data.Id)) {
    return normalize(data);
  }
  return {
    id,
    success: true,
    message: trimText(response?.data?.message) || fallbackMessage,
  };
};

const deleteResult = (id, response, fallbackMessage) => ({
  id,
  success: true,
  message: trimText(response?.data?.message) || fallbackMessage,
});

/* =========================
   PHƯƠNG THỨC VẬN CHUYỂN
========================= */

export const normalizeShippingMethod = (method = {}) => ({
  ...method,
  id: trimText(method?.id),
  methodName: trimText(method?.methodName),
  methodCode: trimText(method?.methodCode),
  description: method?.description ?? "",
  estimatedTransitTime: method?.estimatedTransitTime ?? "",
  applicableCondition: method?.applicableCondition ?? "",
  internalNote: method?.internalNote ?? "",
  isActive: isActiveFlag(method?.isActive),
  createdAt: method?.createdAt ?? null,
});

const toShippingMethodPayload = (payload = {}) => ({
  methodName: requireText(payload?.methodName, "tên phương thức"),
  methodCode: requireText(payload?.methodCode, "mã phương thức"),
  description: textOrNull(payload?.description),
  estimatedTransitTime: textOrNull(payload?.estimatedTransitTime),
  applicableCondition: textOrNull(payload?.applicableCondition),
  isActive: isActiveFlag(payload?.isActive),
  internalNote: textOrNull(payload?.internalNote),
});

export const getShippingMethods = async (options = {}) => {
  const response = await httpClient.get(ENDPOINTS.shippingMethods, withSignal(options));
  return getArrayItems(getResponseData(response))
    .map(normalizeShippingMethod)
    .filter((method) => method.id);
};

export const getShippingMethodDetail = async (methodId, options = {}) => {
  const id = requireId(methodId, "mã phương thức");
  const response = await httpClient.get(ENDPOINTS.shippingMethodDetail(id), withSignal(options));
  return normalizeShippingMethod(getResponseData(response));
};

export const createShippingMethod = async (payload, options = {}) => {
  const response = await httpClient.post(
    ENDPOINTS.shippingMethods,
    toShippingMethodPayload(payload),
    withSignal(options),
  );
  return normalizeShippingMethod(getResponseData(response));
};

export const updateShippingMethod = async (methodId, payload, options = {}) => {
  const id = requireId(methodId, "mã phương thức");
  const response = await httpClient.put(
    ENDPOINTS.shippingMethodDetail(id),
    toShippingMethodPayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeShippingMethod, "Đã cập nhật phương thức vận chuyển.");
};

export const deleteShippingMethod = async (methodId, options = {}) => {
  const id = requireId(methodId, "mã phương thức");
  const response = await httpClient.delete(ENDPOINTS.shippingMethodDetail(id), withSignal(options));
  return deleteResult(id, response, "Đã xoá phương thức vận chuyển.");
};

/* =========================
   CẤU HÌNH ĐÓNG GÓI
========================= */

const toPackageConfigurationPayload = (payload = {}) => ({
  configCode: requireText(payload?.configCode, "mã cấu hình"),
  configName: requireText(payload?.configName, "tên cấu hình"),
  length: requireNumber(payload?.length, "Chiều dài (cm)", { exclusiveMin: true }),
  width: requireNumber(payload?.width, "Chiều rộng (cm)", { exclusiveMin: true }),
  height: requireNumber(payload?.height, "Chiều cao (cm)", { exclusiveMin: true }),
  maxWeight: requireNumber(payload?.maxWeight, "Tải trọng (kg)", { exclusiveMin: true }),
  packageFee: requireNumber(payload?.packageFee, "Phí đóng gói"),
  status: upperText(payload?.status) === "INACTIVE" ? "INACTIVE" : "ACTIVE",
});

/** GET /api/package-configurations — backend CHỈ trả thùng ACTIVE (dùng lại service thật của pricing). */
export const getPackageConfigurations = async (options = {}) =>
  getPackageConfigurationsApi({ signal: options?.signal });

export const getPackageConfigurationDetail = async (configurationId, options = {}) => {
  const id = requireId(configurationId, "mã cấu hình đóng gói");
  const response = await httpClient.get(
    API_ENDPOINTS.packageConfigurations.detail(id),
    withSignal(options),
  );
  return normalizePackageConfiguration(getResponseData(response));
};

export const createPackageConfiguration = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.packageConfigurations.list,
    toPackageConfigurationPayload(payload),
    withSignal(options),
  );
  return normalizePackageConfiguration(getResponseData(response));
};

export const updatePackageConfiguration = async (configurationId, payload, options = {}) => {
  const id = requireId(configurationId, "mã cấu hình đóng gói");
  const response = await httpClient.put(
    API_ENDPOINTS.packageConfigurations.detail(id),
    toPackageConfigurationPayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizePackageConfiguration, "Đã cập nhật cấu hình đóng gói.");
};

/** DELETE = ngừng sử dụng (INACTIVE); thùng đó biến khỏi danh sách vì GET chỉ trả ACTIVE. */
export const deletePackageConfiguration = async (configurationId, options = {}) => {
  const id = requireId(configurationId, "mã cấu hình đóng gói");
  const response = await httpClient.delete(
    API_ENDPOINTS.packageConfigurations.detail(id),
    withSignal(options),
  );
  return deleteResult(id, response, "Đã ngừng sử dụng cấu hình đóng gói.");
};

/* =========================
   PHÍ DỊCH VỤ BỔ SUNG (bảng AdditionalServiceFee)
========================= */

export const normalizeAdditionalServiceFee = (fee = {}) => ({
  ...fee,
  id: trimText(fee?.id),
  feeCode: trimText(fee?.feeCode),
  feeName: trimText(fee?.feeName),
  calculationType: upperText(fee?.calculationType),
  value: toNumberOrNull(fee?.value) ?? 0,
  unit: fee?.unit ?? "",
  description: fee?.description ?? "",
  isActive: isActiveFlag(fee?.isActive),
  createdAt: fee?.createdAt ?? null,
  updatedAt: fee?.updatedAt ?? null,
});

const toAdditionalServiceFeePayload = (payload = {}) => ({
  feeName: requireText(payload?.feeName, "tên phí"),
  feeCode: requireText(payload?.feeCode, "mã phí"),
  calculationType: requireText(payload?.calculationType, "cách tính").toUpperCase(),
  value: requireNumber(payload?.value, "Giá trị phí"),
  unit: textOrNull(payload?.unit),
  isActive: isActiveFlag(payload?.isActive),
  description: textOrNull(payload?.description),
});

const matchesFeeParams = (fee, params = {}) => {
  if (typeof params?.isActive === "boolean" && fee.isActive !== params.isActive) return false;
  const calculationType = upperText(params?.calculationType);
  if (calculationType && fee.calculationType !== calculationType) return false;
  const feeCode = upperText(params?.feeCode);
  if (feeCode && upperText(fee.feeCode) !== feeCode) return false;
  return true;
};

/** Backend chỉ nhận activeOnly; calculationType / feeCode / isActive=false lọc tại chỗ. */
export const getAdditionalServiceFees = async (params = {}, options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.additionalServiceFees.list, {
    params: removeEmptyParams({ activeOnly: params?.isActive === true ? true : undefined }),
    signal: options?.signal,
  });
  return getArrayItems(getResponseData(response))
    .map(normalizeAdditionalServiceFee)
    .filter((fee) => fee.id && matchesFeeParams(fee, params));
};

export const getAdditionalServiceFeeDetail = async (feeId, options = {}) => {
  const id = requireId(feeId, "mã phí");
  const response = await httpClient.get(
    API_ENDPOINTS.additionalServiceFees.detail(id),
    withSignal(options),
  );
  return normalizeAdditionalServiceFee(getResponseData(response));
};

export const createAdditionalServiceFee = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.additionalServiceFees.list,
    toAdditionalServiceFeePayload(payload),
    withSignal(options),
  );
  return normalizeAdditionalServiceFee(getResponseData(response));
};

export const updateAdditionalServiceFee = async (feeId, payload, options = {}) => {
  const id = requireId(feeId, "mã phí");
  const response = await httpClient.put(
    API_ENDPOINTS.additionalServiceFees.detail(id),
    toAdditionalServiceFeePayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeAdditionalServiceFee, "Đã cập nhật phí dịch vụ.");
};

export const deleteAdditionalServiceFee = async (feeId, options = {}) => {
  const id = requireId(feeId, "mã phí");
  const response = await httpClient.delete(
    API_ENDPOINTS.additionalServiceFees.detail(id),
    withSignal(options),
  );
  return deleteResult(id, response, "Đã xoá phí dịch vụ.");
};

/* =========================
   BẢNG GIÁ DỊCH VỤ
========================= */

const toServicePricingPayload = (payload = {}) => ({
  carrierId: textOrNull(payload?.carrierId),
  serviceType: requireText(payload?.serviceType, "loại dịch vụ"),
  originCountry: requireText(payload?.originCountry, "nước đi"),
  destinationCountry: requireText(payload?.destinationCountry, "nước đến"),
  unitType: requireText(payload?.unitType, "đơn vị tính"),
  price: toNumberOrNull(payload?.price),
  currency: upperText(payload?.currency) || "VND",
  effectiveDate: textOrNull(payload?.effectiveDate),
});

/** Dùng lại servicePricingService thật (GET /api/service-pricings, mảng trần). */
export const getServicePricings = async (options = {}) =>
  getServicePricingsApi({ signal: options?.signal });

export const getServicePricingDetail = async (pricingId) =>
  getServicePricingDetailApi(requireId(pricingId, "mã bảng giá"));

export const createServicePricing = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.servicePricings.list,
    toServicePricingPayload(payload),
    withSignal(options),
  );
  return normalizeServicePricing(getResponseData(response));
};

export const updateServicePricing = async (pricingId, payload, options = {}) => {
  const id = requireId(pricingId, "mã bảng giá");
  const response = await httpClient.put(
    API_ENDPOINTS.servicePricings.detail(id),
    toServicePricingPayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeServicePricing, "Đã cập nhật bảng giá.");
};

export const deleteServicePricing = async (pricingId, options = {}) => {
  const id = requireId(pricingId, "mã bảng giá");
  const response = await httpClient.delete(
    API_ENDPOINTS.servicePricings.detail(id),
    withSignal(options),
  );
  return deleteResult(id, response, "Đã xoá bảng giá.");
};

/* =========================
   QUY TẮC TÍNH GIÁ
========================= */

const toPricingRulePayload = (payload = {}) => ({
  servicePricingId: textOrNull(payload?.servicePricingId),
  ruleName: requireText(payload?.ruleName, "tên quy tắc"),
  ruleCode: requireText(payload?.ruleCode, "mã quy tắc"),
  ruleType: requireText(payload?.ruleType, "loại quy tắc"),
  conditionType: textOrNull(payload?.conditionType),
  conditionValue: textOrNull(payload?.conditionValue),
  calculationType: requireText(payload?.calculationType, "cách tính").toUpperCase(),
  value: requireNumber(payload?.value, "Giá trị"),
  minAmount: toNumberOrNull(payload?.minAmount),
  maxAmount: toNumberOrNull(payload?.maxAmount),
  isRequired: payload?.isRequired === true,
  status: upperText(payload?.status) || "ACTIVE",
  description: textOrNull(payload?.description),
});

/** Dùng lại pricingRuleService thật (GET /api/pricing-rules, mảng trần — cùng nguồn màn Quy tắc phụ phí). */
export const getPricingRules = async (options = {}) =>
  getPricingRulesApi({ signal: options?.signal });

export const getPricingRuleDetail = async (ruleId) =>
  getPricingRuleDetailApi(requireId(ruleId, "mã quy tắc giá"));

export const createPricingRule = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.pricingRules.list,
    toPricingRulePayload(payload),
    withSignal(options),
  );
  return normalizePricingRule(getResponseData(response));
};

export const updatePricingRule = async (ruleId, payload, options = {}) => {
  const id = requireId(ruleId, "mã quy tắc giá");
  const response = await httpClient.put(
    API_ENDPOINTS.pricingRules.detail(id),
    toPricingRulePayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizePricingRule, "Đã cập nhật quy tắc giá.");
};

export const deletePricingRule = async (ruleId, options = {}) => {
  const id = requireId(ruleId, "mã quy tắc giá");
  const response = await httpClient.delete(API_ENDPOINTS.pricingRules.detail(id), withSignal(options));
  return deleteResult(id, response, "Đã xoá quy tắc giá.");
};

/* =========================
   HÀNG CẤM / HẠN CHẾ
========================= */

export const normalizeAdminRestrictedItem = (item = {}) => ({
  ...item,
  id: trimText(item?.id),
  itemName: trimText(item?.itemName),
  country: item?.country ?? "",
  restrictionType: upperText(item?.restrictionType),
  note: item?.note ?? "",
  isActive: isActiveFlag(item?.isActive),
});

const toRestrictedItemPayload = (payload = {}) => ({
  itemName: requireText(payload?.itemName, "tên mặt hàng"),
  country: textOrNull(payload?.country),
  restrictionType: requireOneOf(payload?.restrictionType, RESTRICTION_TYPES, "Mức kiểm soát"),
  note: textOrNull(payload?.note),
  isActive: isActiveFlag(payload?.isActive),
});

export const getRestrictedItems = async (options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.restrictedItems.list, withSignal(options));
  return getArrayItems(getResponseData(response))
    .map(normalizeAdminRestrictedItem)
    .filter((item) => item.id);
};

export const getRestrictedItemDetail = async (itemId, options = {}) => {
  const id = requireId(itemId, "mã mặt hàng");
  const response = await httpClient.get(API_ENDPOINTS.restrictedItems.detail(id), withSignal(options));
  return normalizeAdminRestrictedItem(getResponseData(response));
};

export const createRestrictedItem = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.restrictedItems.list,
    toRestrictedItemPayload(payload),
    withSignal(options),
  );
  return normalizeAdminRestrictedItem(getResponseData(response));
};

export const updateRestrictedItem = async (itemId, payload, options = {}) => {
  const id = requireId(itemId, "mã mặt hàng");
  const response = await httpClient.put(
    API_ENDPOINTS.restrictedItems.detail(id),
    toRestrictedItemPayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeAdminRestrictedItem, "Đã cập nhật mặt hàng.");
};

export const deleteRestrictedItem = async (itemId, options = {}) => {
  const id = requireId(itemId, "mã mặt hàng");
  const response = await httpClient.delete(API_ENDPOINTS.restrictedItems.detail(id), withSignal(options));
  return deleteResult(id, response, "Đã xoá mặt hàng.");
};

/* =========================
   LOẠI HÀNG
========================= */

export const normalizeAdminProductType = (productType = {}) => ({
  ...productType,
  id: trimText(productType?.id),
  name: trimText(productType?.name),
  importTaxRate: toNumberOrNull(productType?.importTaxRate),
  isActive: isActiveFlag(productType?.isActive),
  createdAt: productType?.createdAt ?? null,
});

const toProductTypePayload = (payload = {}) => ({
  name: requireText(payload?.name, "tên loại hàng"),
  importTaxRate: toNumberOrNull(payload?.importTaxRate),
  isActive: isActiveFlag(payload?.isActive),
});

/** GET /api/product-types/all (Admin) — gồm cả loại đã ngừng sử dụng. */
export const getProductTypes = async (options = {}) => {
  const response = await httpClient.get(ENDPOINTS.productTypesAll, withSignal(options));
  return getArrayItems(getResponseData(response))
    .map(normalizeAdminProductType)
    .filter((productType) => productType.id);
};

export const getProductTypeDetail = async (productTypeId, options = {}) => {
  const id = requireId(productTypeId, "mã loại hàng");
  const response = await httpClient.get(ENDPOINTS.productTypeDetail(id), withSignal(options));
  return normalizeAdminProductType(getResponseData(response));
};

export const createProductType = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.productTypes,
    toProductTypePayload(payload),
    withSignal(options),
  );
  return normalizeAdminProductType(getResponseData(response));
};

export const updateProductType = async (productTypeId, payload, options = {}) => {
  const id = requireId(productTypeId, "mã loại hàng");
  const response = await httpClient.put(
    ENDPOINTS.productTypeDetail(id),
    toProductTypePayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeAdminProductType, "Đã cập nhật loại hàng.");
};

export const deleteProductType = async (productTypeId, options = {}) => {
  const id = requireId(productTypeId, "mã loại hàng");
  const response = await httpClient.delete(ENDPOINTS.productTypeDetail(id), withSignal(options));
  return deleteResult(id, response, "Đã xoá loại hàng.");
};

/* =========================
   ĐƠN VỊ TÍNH
========================= */

export const normalizeAdminUnitOfMeasure = (unit = {}) => ({
  ...unit,
  id: trimText(unit?.id),
  unitCode: trimText(unit?.unitCode),
  unitName: trimText(unit?.unitName),
  description: unit?.description ?? "",
  displayOrder: toNumberOrNull(unit?.displayOrder),
  isActive: isActiveFlag(unit?.isActive),
  createdAt: unit?.createdAt ?? null,
});

/* description là string không-null ở DTO: gửi "" chứ không gửi null. displayOrder bỏ trống thì
   KHÔNG gửi — backend tự lấy mặc định 0 (int không nhận null). */
const toUnitOfMeasurePayload = (payload = {}) => {
  const displayOrder = toNumberOrNull(payload?.displayOrder);
  return {
    unitCode: requireText(payload?.unitCode, "mã đơn vị"),
    unitName: requireText(payload?.unitName, "tên đơn vị"),
    description: trimText(payload?.description),
    ...(displayOrder === null ? {} : { displayOrder: Math.trunc(displayOrder) }),
    isActive: isActiveFlag(payload?.isActive),
  };
};

export const getUnitsOfMeasure = async (options = {}) => {
  const response = await httpClient.get(ENDPOINTS.unitsOfMeasureAll, withSignal(options));
  return getArrayItems(getResponseData(response))
    .map(normalizeAdminUnitOfMeasure)
    .filter((unit) => unit.id);
};

export const getUnitOfMeasureDetail = async (unitId, options = {}) => {
  const id = requireId(unitId, "mã đơn vị tính");
  const response = await httpClient.get(ENDPOINTS.unitOfMeasureDetail(id), withSignal(options));
  return normalizeAdminUnitOfMeasure(getResponseData(response));
};

export const createUnitOfMeasure = async (payload, options = {}) => {
  const response = await httpClient.post(
    ENDPOINTS.unitsOfMeasure,
    toUnitOfMeasurePayload(payload),
    withSignal(options),
  );
  return normalizeAdminUnitOfMeasure(getResponseData(response));
};

export const updateUnitOfMeasure = async (unitId, payload, options = {}) => {
  const id = requireId(unitId, "mã đơn vị tính");
  const response = await httpClient.put(
    ENDPOINTS.unitOfMeasureDetail(id),
    toUnitOfMeasurePayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeAdminUnitOfMeasure, "Đã cập nhật đơn vị tính.");
};

export const deleteUnitOfMeasure = async (unitId, options = {}) => {
  const id = requireId(unitId, "mã đơn vị tính");
  const response = await httpClient.delete(ENDPOINTS.unitOfMeasureDetail(id), withSignal(options));
  return deleteResult(id, response, "Đã xoá đơn vị tính.");
};

/* =========================
   NHÀ CUNG CẤP
========================= */

export const normalizeAdminSupplier = (supplier = {}) => ({
  ...supplier,
  id: trimText(supplier?.id),
  supplierCode: trimText(supplier?.supplierCode),
  supplierName: trimText(supplier?.supplierName),
  supplierType: upperText(supplier?.supplierType),
  country: supplier?.country ?? "",
  contactPerson: supplier?.contactPerson ?? "",
  phone: supplier?.phone ?? "",
  email: supplier?.email ?? "",
  address: supplier?.address ?? "",
  note: supplier?.note ?? "",
  isActive: isActiveFlag(supplier?.isActive),
  createdAt: supplier?.createdAt ?? null,
});

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+$/;

const toSupplierPayload = (payload = {}) => {
  const email = trimText(payload?.email);
  /* [EmailAddress] của backend loại cả chuỗi rỗng — báo tại chỗ bằng tiếng Việt. */
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Email nhà cung cấp là bắt buộc và phải hợp lệ (backend kiểm tra định dạng email).");
  }
  return {
    supplierCode: requireText(payload?.supplierCode, "mã nhà cung cấp"),
    supplierName: requireText(payload?.supplierName, "tên nhà cung cấp"),
    supplierType: requireOneOf(payload?.supplierType, SUPPLIER_TYPES, "Loại nhà cung cấp"),
    country: trimText(payload?.country),
    contactPerson: trimText(payload?.contactPerson),
    phone: trimText(payload?.phone),
    email,
    address: trimText(payload?.address),
    note: trimText(payload?.note),
    isActive: isActiveFlag(payload?.isActive),
  };
};

export const getSuppliers = async (options = {}) => {
  const response = await httpClient.get(ENDPOINTS.suppliers, withSignal(options));
  return getArrayItems(getResponseData(response))
    .map(normalizeAdminSupplier)
    .filter((supplier) => supplier.id);
};

export const getSupplierDetail = async (supplierId, options = {}) => {
  const id = requireId(supplierId, "mã nhà cung cấp");
  const response = await httpClient.get(ENDPOINTS.supplierDetail(id), withSignal(options));
  return normalizeAdminSupplier(getResponseData(response));
};

export const createSupplier = async (payload, options = {}) => {
  const response = await httpClient.post(
    ENDPOINTS.suppliers,
    toSupplierPayload(payload),
    withSignal(options),
  );
  return normalizeAdminSupplier(getResponseData(response));
};

export const updateSupplier = async (supplierId, payload, options = {}) => {
  const id = requireId(supplierId, "mã nhà cung cấp");
  const response = await httpClient.put(
    ENDPOINTS.supplierDetail(id),
    toSupplierPayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeAdminSupplier, "Đã cập nhật nhà cung cấp.");
};

export const deleteSupplier = async (supplierId, options = {}) => {
  const id = requireId(supplierId, "mã nhà cung cấp");
  const response = await httpClient.delete(ENDPOINTS.supplierDetail(id), withSignal(options));
  return deleteResult(id, response, "Đã xoá nhà cung cấp.");
};

/* =========================
   TUYẾN VẬN CHUYỂN — dùng lại transportCatalogService (đã nối thật)
========================= */

/* Giữ chữ ký cũ (options) — không đẩy `signal` thành query param của GET. */
export const getShippingRoutes = async () => getShippingRoutesApi();

export const getShippingRouteDetail = async (routeId) => getShippingRouteDetailApi(routeId);

export const createShippingRoute = async (payload) => createShippingRouteApi(payload);

export const updateShippingRoute = async (routeId, payload) => updateShippingRouteApi(routeId, payload);

export const deleteShippingRoute = async (routeId) => {
  const id = requireId(routeId, "mã tuyến vận chuyển");
  const data = await deleteShippingRouteApi(id);
  return { id, success: true, message: trimText(data?.message) || "Đã xoá tuyến vận chuyển." };
};

/* =========================
   TỶ GIÁ
========================= */

export const normalizeExchangeRateRecord = (item = {}) => ({
  ...item,
  id: trimText(item?.id ?? item?.exchangeRateId),
  currencyCode: upperText(item?.currencyCode ?? item?.currency),
  currencyName: item?.currencyName ?? "",
  rateToVnd: toNumberOrNull(item?.rateToVnd ?? item?.exchangeRate) ?? 0,
  isActive: isActiveFlag(item?.isActive),
  note: item?.note ?? "",
  createdAt: item?.createdAt ?? null,
  updatedAt: item?.updatedAt ?? null,
});

const toExchangeRateUpdatePayload = (payload = {}) => ({
  currencyName: textOrNull(payload?.currencyName),
  rateToVnd: requireNumber(payload?.rateToVnd, "Tỷ giá", { exclusiveMin: true }),
  isActive: isActiveFlag(payload?.isActive),
  note: textOrNull(payload?.note),
});

/**
 * GET /api/exchange-rates — mặc định lấy CẢ tỷ giá đang tắt (Admin cần thấy để bật lại);
 * truyền { activeOnly: true } để chỉ lấy tỷ giá đang dùng.
 */
export const getExchangeRates = async (options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.exchangeRates.list, {
    params: removeEmptyParams({ activeOnly: options?.activeOnly === true ? true : undefined }),
    signal: options?.signal,
  });
  return getArrayItems(getResponseData(response))
    .map(normalizeExchangeRateRecord)
    .filter((rate) => rate.id);
};

export const getExchangeRateDetail = async (rateId, options = {}) => {
  const id = requireId(rateId, "mã tỷ giá");
  const response = await httpClient.get(API_ENDPOINTS.exchangeRates.detail(id), withSignal(options));
  return normalizeExchangeRateRecord(getResponseData(response));
};

/** POST — mã tiền tệ đã có thì backend trả 400 "Đã có cấu hình tỷ giá cho …" (hiện nguyên câu). */
export const createExchangeRate = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.exchangeRates.list,
    {
      currencyCode: requireText(payload?.currencyCode, "mã tiền tệ").toUpperCase(),
      ...toExchangeRateUpdatePayload(payload),
    },
    withSignal(options),
  );
  return normalizeExchangeRateRecord(getResponseData(response));
};

/** PUT — body KHÔNG có mã tiền tệ (backend không cho đổi mã). */
export const updateExchangeRate = async (rateId, payload, options = {}) => {
  const id = requireId(rateId, "mã tỷ giá");
  const response = await httpClient.put(
    API_ENDPOINTS.exchangeRates.detail(id),
    toExchangeRateUpdatePayload(payload),
    withSignal(options),
  );
  return writeResult(id, response, normalizeExchangeRateRecord, "Đã cập nhật tỷ giá.");
};

/** DELETE → 204 không body. */
export const deleteExchangeRate = async (rateId, options = {}) => {
  const id = requireId(rateId, "mã tỷ giá");
  const response = await httpClient.delete(API_ENDPOINTS.exchangeRates.detail(id), withSignal(options));
  return deleteResult(id, response, "Đã xoá tỷ giá.");
};

export default {
  getShippingMethods,
  getShippingMethodDetail,
  createShippingMethod,
  updateShippingMethod,
  deleteShippingMethod,
  getPackageConfigurations,
  getPackageConfigurationDetail,
  createPackageConfiguration,
  updatePackageConfiguration,
  deletePackageConfiguration,
  getAdditionalServiceFees,
  getAdditionalServiceFeeDetail,
  createAdditionalServiceFee,
  updateAdditionalServiceFee,
  deleteAdditionalServiceFee,
  getServicePricings,
  getServicePricingDetail,
  createServicePricing,
  updateServicePricing,
  deleteServicePricing,
  getPricingRules,
  getPricingRuleDetail,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  getRestrictedItems,
  getRestrictedItemDetail,
  createRestrictedItem,
  updateRestrictedItem,
  deleteRestrictedItem,
  getProductTypes,
  getProductTypeDetail,
  createProductType,
  updateProductType,
  deleteProductType,
  getUnitsOfMeasure,
  getUnitOfMeasureDetail,
  createUnitOfMeasure,
  updateUnitOfMeasure,
  deleteUnitOfMeasure,
  getSuppliers,
  getSupplierDetail,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getShippingRoutes,
  getShippingRouteDetail,
  createShippingRoute,
  updateShippingRoute,
  deleteShippingRoute,
  getExchangeRates,
  getExchangeRateDetail,
  createExchangeRate,
  updateExchangeRate,
  deleteExchangeRate,
};
