import axiosInstance from "../axiosInstance";
import {
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "../../utils/timeUtc";

const normalizeText = (value) => String(value ?? "").trim();

const requireId = (value, label) => {
  const id = normalizeText(value);
  if (!id) throw new Error(`Không tìm thấy ${label}.`);
  return encodeURIComponent(id);
};

const getUtcHeaders = () => {
  const browserTime = getBrowserTimeInfo();
  return {
    "X-Client-Time-Utc": getSyncedNowUtcIso(),
    "X-Client-Time-Zone": browserTime.timeZone,
    "X-Client-Utc-Offset": browserTime.utcOffsetText,
  };
};

const requestConfig = (options = {}, extra = {}) => ({
  ...extra,
  signal: options.signal,
  headers: { ...getUtcHeaders(), ...(extra.headers || {}) },
});

export const getAdminApiData = (response) => {
  const responseData = response?.data ?? response;
  return responseData?.data ?? responseData;
};

export const getAdminApiList = (response) => {
  const data = getAdminApiData(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const getAdminApiError = (error, fallbackMessage) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.title === "string") return data.title;

  const validationMessages = data?.errors
    ? Object.values(data.errors).flat().filter(Boolean)
    : [];
  return validationMessages.join(" ") || error?.message || fallbackMessage;
};

/* ==================== USERS ==================== */
export const getAdminUsers = async (options = {}) => {
  const response = await axiosInstance.get("/api/User", requestConfig(options));
  return getAdminApiList(response);
};

export const getAdminUserDetail = async (userId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/User/${requireId(userId, "mã người dùng")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createAdminUser = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/User", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateAdminUserRole = async (userId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/User/${requireId(userId, "mã người dùng")}/role`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const lockAdminUser = async (userId, options = {}) => {
  const response = await axiosInstance.put(
    `/api/User/${requireId(userId, "mã người dùng")}/lock`,
    null,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const unlockAdminUser = async (userId, options = {}) => {
  const response = await axiosInstance.put(
    `/api/User/${requireId(userId, "mã người dùng")}/unlock`,
    null,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== WAREHOUSES ==================== */
export const getWarehouses = async (params = {}, options = {}) => {
  const response = await axiosInstance.get(
    "/api/warehouses",
    requestConfig(options, { params })
  );
  return getAdminApiList(response);
};

export const createWarehouse = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/warehouses", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateWarehouse = async (warehouseId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteWarehouse = async (warehouseId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const getWarehouseLocations = async (warehouseId, params = {}, options = {}) => {
  const response = await axiosInstance.get(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/locations`,
    requestConfig(options, { params })
  );
  return getAdminApiList(response);
};

export const createWarehouseLocation = async (warehouseId, payload, options = {}) => {
  const response = await axiosInstance.post(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/locations`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const updateWarehouseLocation = async (locationId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/warehouse-locations/${requireId(locationId, "mã vị trí")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteWarehouseLocation = async (locationId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/warehouse-locations/${requireId(locationId, "mã vị trí")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== CARRIERS ==================== */
export const getCarriers = async (options = {}) => {
  const response = await axiosInstance.get("/api/carriers", requestConfig(options));
  return getAdminApiList(response);
};

export const getCarrierDetail = async (carrierId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/carriers/${requireId(carrierId, "mã đơn vị vận chuyển")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createCarrier = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/carriers", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateCarrier = async (carrierId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/carriers/${requireId(carrierId, "mã đơn vị vận chuyển")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteCarrier = async (carrierId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/carriers/${requireId(carrierId, "mã đơn vị vận chuyển")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== SHIPPING METHODS ==================== */
export const getShippingMethods = async (options = {}) => {
  const response = await axiosInstance.get("/api/shipping-methods", requestConfig(options));
  return getAdminApiList(response);
};

export const getShippingMethodDetail = async (methodId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/shipping-methods/${requireId(methodId, "mã phương thức")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createShippingMethod = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/shipping-methods", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateShippingMethod = async (methodId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/shipping-methods/${requireId(methodId, "mã phương thức")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteShippingMethod = async (methodId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/shipping-methods/${requireId(methodId, "mã phương thức")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== PACKAGE CONFIGURATIONS ==================== */
export const getPackageConfigurations = async (options = {}) => {
  const response = await axiosInstance.get("/api/package-configurations", requestConfig(options));
  return getAdminApiList(response);
};

export const getPackageConfigurationDetail = async (configurationId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/package-configurations/${requireId(configurationId, "mã cấu hình đóng gói")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createPackageConfiguration = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/package-configurations", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updatePackageConfiguration = async (configurationId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/package-configurations/${requireId(configurationId, "mã cấu hình đóng gói")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deletePackageConfiguration = async (configurationId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/package-configurations/${requireId(configurationId, "mã cấu hình đóng gói")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== ADDITIONAL SERVICE FEES ==================== */
export const getAdditionalServiceFees = async (params = {}, options = {}) => {
  const response = await axiosInstance.get(
    "/api/additional-service-fees",
    requestConfig(options, { params })
  );
  return getAdminApiList(response);
};

export const getAdditionalServiceFeeDetail = async (feeId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/additional-service-fees/${requireId(feeId, "mã phí")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createAdditionalServiceFee = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/additional-service-fees", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateAdditionalServiceFee = async (feeId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/additional-service-fees/${requireId(feeId, "mã phí")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteAdditionalServiceFee = async (feeId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/additional-service-fees/${requireId(feeId, "mã phí")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== SERVICE PRICINGS ==================== */
export const getServicePricings = async (options = {}) => {
  const response = await axiosInstance.get("/api/service-pricings", requestConfig(options));
  return getAdminApiList(response);
};

export const getServicePricingDetail = async (pricingId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/service-pricings/${requireId(pricingId, "mã bảng giá")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createServicePricing = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/service-pricings", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateServicePricing = async (pricingId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/service-pricings/${requireId(pricingId, "mã bảng giá")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteServicePricing = async (pricingId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/service-pricings/${requireId(pricingId, "mã bảng giá")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== PRICING RULES ==================== */
export const getPricingRules = async (options = {}) => {
  const response = await axiosInstance.get("/api/pricing-rules", requestConfig(options));
  return getAdminApiList(response);
};

export const getPricingRuleDetail = async (ruleId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/pricing-rules/${requireId(ruleId, "mã quy tắc giá")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createPricingRule = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/pricing-rules", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updatePricingRule = async (ruleId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/pricing-rules/${requireId(ruleId, "mã quy tắc giá")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deletePricingRule = async (ruleId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/pricing-rules/${requireId(ruleId, "mã quy tắc giá")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== RESTRICTED ITEMS ==================== */
export const getRestrictedItems = async (options = {}) => {
  const response = await axiosInstance.get("/api/restricted-items", requestConfig(options));
  return getAdminApiList(response);
};

export const getRestrictedItemDetail = async (itemId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/restricted-items/${requireId(itemId, "mã mặt hàng")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createRestrictedItem = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/restricted-items", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateRestrictedItem = async (itemId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/restricted-items/${requireId(itemId, "mã mặt hàng")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteRestrictedItem = async (itemId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/restricted-items/${requireId(itemId, "mã mặt hàng")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== PRODUCT TYPES ==================== */
export const getProductTypes = async (options = {}) => {
  const response = await axiosInstance.get("/api/product-types/all", requestConfig(options));
  return getAdminApiList(response);
};

export const getProductTypeDetail = async (productTypeId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/product-types/${requireId(productTypeId, "mã loại hàng")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createProductType = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/product-types", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateProductType = async (productTypeId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/product-types/${requireId(productTypeId, "mã loại hàng")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteProductType = async (productTypeId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/product-types/${requireId(productTypeId, "mã loại hàng")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== UNITS OF MEASURE ==================== */
export const getUnitsOfMeasure = async (options = {}) => {
  const response = await axiosInstance.get("/api/units-of-measure/all", requestConfig(options));
  return getAdminApiList(response);
};

export const getUnitOfMeasureDetail = async (unitId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/units-of-measure/${requireId(unitId, "mã đơn vị tính")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createUnitOfMeasure = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/units-of-measure", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateUnitOfMeasure = async (unitId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/units-of-measure/${requireId(unitId, "mã đơn vị tính")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteUnitOfMeasure = async (unitId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/units-of-measure/${requireId(unitId, "mã đơn vị tính")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== SUPPLIERS ==================== */
export const getSuppliers = async (options = {}) => {
  const response = await axiosInstance.get("/api/suppliers", requestConfig(options));
  return getAdminApiList(response);
};

export const getSupplierDetail = async (supplierId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/suppliers/${requireId(supplierId, "mã nhà cung cấp")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createSupplier = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/suppliers", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateSupplier = async (supplierId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/suppliers/${requireId(supplierId, "mã nhà cung cấp")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteSupplier = async (supplierId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/suppliers/${requireId(supplierId, "mã nhà cung cấp")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== SHIPPING ROUTES ==================== */
export const getShippingRoutes = async (options = {}) => {
  const response = await axiosInstance.get("/api/shipping-routes", requestConfig(options));
  return getAdminApiList(response);
};

export const getShippingRouteDetail = async (routeId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/shipping-routes/${requireId(routeId, "mã tuyến vận chuyển")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const createShippingRoute = async (payload, options = {}) => {
  const response = await axiosInstance.post("/api/shipping-routes", payload, requestConfig(options));
  return getAdminApiData(response);
};

export const updateShippingRoute = async (routeId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/shipping-routes/${requireId(routeId, "mã tuyến vận chuyển")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteShippingRoute = async (routeId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/shipping-routes/${requireId(routeId, "mã tuyến vận chuyển")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== WAREHOUSE LAYOUT ==================== */
export const getWarehouseLayout = async (warehouseId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/layout`,
    requestConfig(options)
  );
  return getAdminApiList(response);
};

export const createWarehouseLayoutItem = async (warehouseId, payload, options = {}) => {
  const response = await axiosInstance.post(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/layout`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const updateWarehouseLayoutItem = async (warehouseId, layoutId, payload, options = {}) => {
  const response = await axiosInstance.put(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/layout/${requireId(layoutId, "mã ô layout")}`,
    payload,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

export const deleteWarehouseLayoutItem = async (warehouseId, layoutId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/layout/${requireId(layoutId, "mã ô layout")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

/* ==================== EXCHANGE RATES (bảng giá tiền tệ) ==================== */
const normalizeExchangeRateRecord = (item = {}) => {
  const currencyCode = normalizeText(item?.currencyCode ?? item?.currency).toUpperCase();
  return {
    id: item?.id ?? item?.exchangeRateId ?? "",
    currencyCode,
    currencyName: item?.currencyName ?? "",
    rateToVnd: Number(item?.rateToVnd ?? item?.exchangeRate ?? 0) || 0,
    isActive: Boolean(item?.isActive ?? true),
    note: item?.note ?? "",
    createdAt: item?.createdAt ?? null,
    updatedAt: item?.updatedAt ?? null,
  };
};

export const getExchangeRates = async (options = {}) => {
  const activeOnly = options.activeOnly === true;
  const response = await axiosInstance.get(
    "/api/exchange-rates",
    requestConfig(options, { params: { activeOnly } })
  );
  return getAdminApiList(response).map(normalizeExchangeRateRecord);
};

export const getExchangeRateDetail = async (rateId, options = {}) => {
  const response = await axiosInstance.get(
    `/api/exchange-rates/${requireId(rateId, "mã tỷ giá")}`,
    requestConfig(options)
  );
  return normalizeExchangeRateRecord(getAdminApiData(response));
};

export const createExchangeRate = async (payload, options = {}) => {
  const body = {
    currencyCode: normalizeText(payload?.currencyCode).toUpperCase(),
    currencyName: normalizeText(payload?.currencyName) || undefined,
    rateToVnd: Number(payload?.rateToVnd) || 0,
    isActive: payload?.isActive !== false,
    note: normalizeText(payload?.note) || undefined,
  };
  const response = await axiosInstance.post(
    "/api/exchange-rates",
    body,
    requestConfig(options)
  );
  return normalizeExchangeRateRecord(getAdminApiData(response));
};

export const updateExchangeRate = async (rateId, payload, options = {}) => {
  const body = {
    currencyName: normalizeText(payload?.currencyName) || undefined,
    rateToVnd: Number(payload?.rateToVnd) || 0,
    isActive: payload?.isActive !== false,
    note: normalizeText(payload?.note) || undefined,
  };
  const response = await axiosInstance.put(
    `/api/exchange-rates/${requireId(rateId, "mã tỷ giá")}`,
    body,
    requestConfig(options)
  );
  return normalizeExchangeRateRecord(getAdminApiData(response));
};

export const deleteExchangeRate = async (rateId, options = {}) => {
  const response = await axiosInstance.delete(
    `/api/exchange-rates/${requireId(rateId, "mã tỷ giá")}`,
    requestConfig(options)
  );
  return getAdminApiData(response);
};

