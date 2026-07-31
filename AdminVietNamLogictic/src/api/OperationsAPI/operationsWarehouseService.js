import axiosInstance from "../axiosInstance";
import { getAdminApiData, getAdminApiError, getAdminApiList } from "../AdminAPI/adminService";
import { getActiveWarehousesApi } from "../SaleAPI/ConsignmentAPI/warehouseService";

export { getAdminApiError as getOperationsApiError };

const requireId = (value, label) => {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(`Không tìm thấy ${label}.`);
  return encodeURIComponent(id);
};

/** Ops dùng endpoint active — `/api/warehouses` (full list) chỉ Admin → 403. */
export async function listActiveWarehouses() {
  return getActiveWarehousesApi();
}

/** Ops đọc vị trí qua `/locations/active`; fallback full list nếu BE không có route active. */
export async function listWarehouseLocations(warehouseId) {
  const encoded = requireId(warehouseId, "mã kho");
  try {
    const response = await axiosInstance.get(
      `/api/warehouses/${encoded}/locations/active`
    );
    return getAdminApiList(response);
  } catch (error) {
    if (error?.response?.status === 404) {
      const response = await axiosInstance.get(
        `/api/warehouses/${encoded}/locations`
      );
      return getAdminApiList(response);
    }
    throw error;
  }
}

export async function createStorageLocation(warehouseId, payload) {
  const response = await axiosInstance.post(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/locations`,
    payload
  );
  return getAdminApiData(response);
}

export async function updateStorageLocation(locationId, payload) {
  const response = await axiosInstance.put(
    `/api/warehouse-locations/${requireId(locationId, "mã vị trí")}`,
    payload
  );
  return getAdminApiData(response);
}

export async function deleteStorageLocation(locationId) {
  const response = await axiosInstance.delete(
    `/api/warehouse-locations/${requireId(locationId, "mã vị trí")}`
  );
  return getAdminApiData(response);
}

export async function listWarehouseLayout(warehouseId) {
  const response = await axiosInstance.get(
    `/api/warehouses/${requireId(warehouseId, "mã kho")}/layout`
  );
  return getAdminApiList(response);
}

export function formatWarehouseType(type) {
  const key = String(type ?? "").trim().toLowerCase();
  if (key === "origin") return "Kho xuất phát";
  if (key === "destination") return "Kho đích";
  return type || "—";
}

export function groupLocations(locations) {
  const zones = new Map();
  for (const loc of locations || []) {
    const zoneName = loc.zoneName || loc.zoneCode || "Chưa có zone";
    const shelfCode = loc.shelfCode || "Chưa có shelf";
    if (!zones.has(zoneName)) zones.set(zoneName, new Map());
    const shelves = zones.get(zoneName);
    if (!shelves.has(shelfCode)) shelves.set(shelfCode, []);
    shelves.get(shelfCode).push(loc);
  }

  return [...zones.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "vi"))
    .map(([zoneName, shelves]) => ({
      zoneName,
      shelves: [...shelves.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "vi"))
        .map(([shelfCode, bins]) => ({
          shelfCode,
          bins: bins.sort((a, b) =>
            String(a.binCode || a.code || "").localeCompare(
              String(b.binCode || b.code || ""),
              "vi"
            )
          ),
        })),
    }));
}
