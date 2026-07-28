import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";
import {
  getActiveWarehousesApi,
  getWarehousesApi,
  mapWarehousesToOptions,
} from "./warehouseService";
import {
  getServicePricingsApi,
  mapServicePricingsToOptions,
} from "./servicePricingService";
import {
  getActivePricingRulesApi,
  getPricingRulesApi,
} from "./pricingRuleService";

const getResponseData = (response) =>
  response?.data?.data ?? response?.data ?? null;

const getArrayItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getNamedArrayItems = (data, keys = []) => {
  const directItems = getArrayItems(data);
  if (directItems.length) return directItems;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }

  return [];
};

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

export const getProductTypesApi = async ({ signal } = {}) => {
  const response = await axiosInstance.get(
    API_ENDPOINTS.productTypes,
    { signal }
  );

  return getNamedArrayItems(getResponseData(response), ["productTypes"])
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        const value = normalizeText(item);
        return { id: value, name: value };
      }

      return {
        ...item,
        id: normalizeText(item?.id ?? item?.value ?? item?.code),
        name: normalizeText(item?.name ?? item?.label ?? item?.displayName),
      };
    })
    .filter((item) => item.id && item.name);
};

export const getConsignmentRoutesApi = async ({ signal } = {}) => {
  const response = await axiosInstance.get(
    API_ENDPOINTS.consignments.routes,
    { signal }
  );

  return getNamedArrayItems(getResponseData(response), ["routes"]);
};

export const getConsignmentShippingOptionsApi = async ({
  route,
  signal,
} = {}) => {
  const response = await axiosInstance.get(
    API_ENDPOINTS.consignments.shippingOptions,
    {
      params: route ? { route: normalizeText(route) } : undefined,
      signal,
    }
  );

  return getNamedArrayItems(getResponseData(response), ["shippingOptions"]);
};

export const getConsignmentMasterDataApi = async ({
  warehouseFilters = {},
  servicePricingFilters = {},
  pricingRuleFilters = {},
  activeWarehousesOnly = true,
  activeRulesOnly = true,
} = {}) => {
  const [productTypes, warehouses, servicePricings, pricingRules] =
    await Promise.all([
      getProductTypesApi(),
      activeWarehousesOnly
        ? getActiveWarehousesApi(warehouseFilters)
        : getWarehousesApi(warehouseFilters),
      getServicePricingsApi(servicePricingFilters),
      activeRulesOnly
        ? getActivePricingRulesApi(pricingRuleFilters)
        : getPricingRulesApi(pricingRuleFilters),
    ]);

  return {
    productTypes,
    warehouses,
    warehouseOptions: mapWarehousesToOptions(warehouses),
    originWarehouses: warehouses.filter(
      (warehouse) =>
        normalizeUpperText(warehouse?.warehouseType) === "ORIGIN"
    ),
    destinationWarehouses: warehouses.filter(
      (warehouse) =>
        normalizeUpperText(warehouse?.warehouseType) === "DESTINATION"
    ),
    servicePricings,
    servicePricingOptions:
      mapServicePricingsToOptions(servicePricings),
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
