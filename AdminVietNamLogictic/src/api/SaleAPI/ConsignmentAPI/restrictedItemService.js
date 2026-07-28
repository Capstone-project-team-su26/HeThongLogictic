import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

export const RESTRICTION_TYPE = {
  BANNED: "BANNED",
  RESTRICTED: "RESTRICTED",
  WARNING: "WARNING",
};

const getResponseData = (response) =>
  response?.data?.data ?? response?.data ?? null;

const getArrayItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const normalizeId = (value) => {
  const id = normalizeText(value);
  if (!id) {
    throw new Error("Không tìm thấy mã hàng hạn chế.");
  }
  return id;
};

const removeEmptyParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined && value !== null && value !== ""
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

const RESTRICTION_LABELS = {
  BANNED: "Cấm vận chuyển",
  RESTRICTED: "Hạn chế",
  WARNING: "Cảnh báo",
};

export const normalizeRestrictedItem = (item = {}) => {
  const country = normalizeText(item?.country);
  const restrictionType = normalizeUpperText(
    item?.restrictionType
  );

  return {
    ...item,
    id: normalizeText(item?.id),
    itemName: normalizeText(item?.itemName),
    country,
    countryDisplayName:
      COUNTRY_LABELS[normalizeUpperText(country)] || country || "—",
    restrictionType,
    restrictionTypeDisplayName:
      RESTRICTION_LABELS[restrictionType] || restrictionType || "—",
    note: normalizeText(item?.note),
    isActive: item?.isActive === true,
  };
};

export const getRestrictedItemsApi = async (filters = {}) => {
  const { signal, ...queryFilters } = filters || {};
  const response = await axiosInstance.get(
    API_ENDPOINTS.restrictedItems.list,
    {
      params: removeEmptyParams(queryFilters),
      signal,
    }
  );

  return getArrayItems(getResponseData(response))
    .map(normalizeRestrictedItem)
    .filter((item) => Boolean(item.id));
};

export const getRestrictedItemListApi = (filters = {}) =>
  getRestrictedItemsApi(filters);

export const getRestrictedItemDetailApi = async (
  restrictedItemId
) => {
  const id = normalizeId(restrictedItemId);
  const response = await axiosInstance.get(
    API_ENDPOINTS.restrictedItems.detail(id)
  );
  return normalizeRestrictedItem(getResponseData(response) || {});
};

export const getActiveRestrictedItemsApi = async (filters = {}) => {
  const items = await getRestrictedItemsApi(filters);
  return items.filter((item) => item.isActive);
};

const restrictedItemService = {
  RESTRICTION_TYPE,
  normalizeRestrictedItem,
  getRestrictedItemsApi,
  getRestrictedItemListApi,
  getRestrictedItemDetailApi,
  getActiveRestrictedItemsApi,
};

export default restrictedItemService;
