import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

/* =========================
   RESPONSE / AUTH HELPERS
========================= */

const getResponseData = (response) =>
  response?.data?.data ?? response?.data ?? null;

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

const getAuthHeaders = () => ({
  Accept: "*/*",
  Authorization: `Bearer ${getAccessToken()}`,
});

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const removeEmptyParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );

const getArrayItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

/* =========================
   NORMALIZE WAREHOUSE
========================= */

export const normalizeWarehouse = (
  warehouse = {}
) => ({
  id: normalizeText(warehouse?.id || warehouse?.warehouseId || warehouse?._id),
  name: normalizeText(warehouse?.name || warehouse?.warehouseName || warehouse?.title || "Kho hàng"),
  code: normalizeText(warehouse?.code || warehouse?.warehouseCode),
  address: normalizeText(warehouse?.address || warehouse?.location || warehouse?.fullAddress),
  warehouseType: normalizeText(
    warehouse?.warehouseType || warehouse?.type
  ),
  isActive: warehouse?.isActive !== false,
});

/* =========================
   WAREHOUSE API
========================= */

export const getWarehousesApi = async (
  filters = {}
) => {
  const response = await axiosInstance.get(
    API_ENDPOINTS.warehouses.list,
    {
      params: removeEmptyParams(filters),
    }
  );

  const data = getResponseData(response);

  return getArrayItems(data)
    .map(normalizeWarehouse)
    .filter(
      (warehouse) =>
        Boolean(warehouse.id) &&
        Boolean(warehouse.name)
    );
};

export const getActiveWarehousesApi = async (
  filters = {}
) => {
  const response = await axiosInstance.get(
    API_ENDPOINTS.warehouses.active,
    {
      params: removeEmptyParams(filters),
    }
  );

  const data = getResponseData(response);

  return getArrayItems(data)
    .map(normalizeWarehouse)
    .filter(
      (warehouse) =>
        Boolean(warehouse.id) &&
        Boolean(warehouse.name)
    );
};

export const getOriginWarehousesApi = async (
  filters = {}
) => {
  const warehouses =
    await getActiveWarehousesApi(filters);

  return warehouses.filter(
    (warehouse) =>
      normalizeUpperText(
        warehouse?.warehouseType
      ) === "ORIGIN"
  );
};

export const getDestinationWarehousesApi =
  async (filters = {}) => {
    const warehouses =
      await getActiveWarehousesApi(filters);

    return warehouses.filter(
      (warehouse) =>
        normalizeUpperText(
          warehouse?.warehouseType
        ) === "DESTINATION"
    );
  };

/* =========================
   WAREHOUSE HELPERS
========================= */

export const mapWarehousesToOptions = (
  warehouses = []
) => {
  if (!Array.isArray(warehouses)) {
    return [];
  }

  return warehouses
    .filter(
      (warehouse) =>
        Boolean(warehouse?.id) &&
        Boolean(warehouse?.name)
    )
    .map((warehouse) => {
      const id = normalizeText(warehouse?.id);
      const name = normalizeText(
        warehouse?.name
      );
      const code = normalizeText(
        warehouse?.code
      );
      const address = normalizeText(
        warehouse?.address
      );
      const warehouseType = normalizeText(
        warehouse?.warehouseType
      );

      return {
        value: id,
        label: code
          ? `${name} (${code})`
          : name,

        id,
        name,
        code,
        address,
        warehouseType,
        isActive:
          warehouse?.isActive === true,

        searchText: [
          name,
          code,
          address,
          warehouseType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });
};

export const findWarehouseById = (
  warehouses = [],
  warehouseId
) => {
  if (!Array.isArray(warehouses)) {
    return null;
  }

  const normalizedId =
    normalizeText(warehouseId);

  if (!normalizedId) {
    return null;
  }

  return (
    warehouses.find(
      (warehouse) =>
        normalizeText(warehouse?.id) ===
        normalizedId
    ) || null
  );
};

export const findWarehouseByCode = (
  warehouses = [],
  warehouseCode
) => {
  if (!Array.isArray(warehouses)) {
    return null;
  }

  const normalizedCode =
    normalizeUpperText(warehouseCode);

  if (!normalizedCode) {
    return null;
  }

  return (
    warehouses.find(
      (warehouse) =>
        normalizeUpperText(
          warehouse?.code
        ) === normalizedCode
    ) || null
  );
};

const warehouseService = {
  normalizeWarehouse,
  getWarehousesApi,
  getActiveWarehousesApi,
  getOriginWarehousesApi,
  getDestinationWarehousesApi,
  mapWarehousesToOptions,
  findWarehouseById,
  findWarehouseByCode,
};

export default warehouseService;
