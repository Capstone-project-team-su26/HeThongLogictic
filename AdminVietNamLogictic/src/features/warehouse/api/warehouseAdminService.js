/*
 * Kho · ô kệ · sơ đồ lưới · tồn kho cho màn Admin — ĐÃ NỐI API THẬT.
 *
 * Trước đây nhóm hàm này nằm trong @features/admin/api/adminService dưới dạng dữ liệu giả
 * trong bộ nhớ (kho "Kho Quảng Châu 1 (CN-GZ-01)", khu C, kệ C1/C2…), nên màn "Sơ đồ kho"
 * của Admin lệch hẳn với app kho Trung Quốc. Nay dùng CÙNG endpoint với app kho
 * (vcl-warehouse-staff-ui/src/features/khoqt-warehouse/api/warehouseService.js).
 * adminService re-export nguyên tên + chữ ký cũ từ đây, nên trang không phải đổi import.
 *
 * Endpoint (VCL_API: WarehouseController, WarehouseLocationLayoutController,
 * WarehouseZoneController, InventoryController — trùng swagger production):
 *
 *   GET    /api/warehouses?isActive=&search=&regionCode=      (Admin)  → { items: Warehouse[] }
 *   POST   /api/warehouses                                    (Admin)  → Warehouse (201, TRẦN)
 *   PUT    /api/warehouses/{id}                               (Admin)  → Warehouse (TRẦN)
 *   DELETE /api/warehouses/{id}                               (Admin)  → { message }
 *   GET    /api/warehouses/{id}/locations?isActive=                    → { items: Location[] }
 *   GET    /api/warehouses/{id}/locations/active                       → { items: Location[] }
 *   POST   /api/warehouses/{id}/locations                              → Location (201, TRẦN)
 *   PUT    /api/warehouse-locations/{locationId}                       → Location (TRẦN)
 *   DELETE /api/warehouse-locations/{locationId}                       → { message }
 *   GET    /api/warehouses/{id}/zones                                  → { message, data: Zone[] }
 *   GET    /api/warehouses/{id}/layout                                 → { message, data: LayoutItem[] }
 *   GET    /api/warehouses/{id}/layout/zones                           → { message, data: khu → kệ → ô }
 *   GET    /api/warehouses/{id}/layout/status                          → { message, data: LayoutStatus[] }
 *   POST   /api/warehouses/{id}/layout                                 → { message, data: LayoutItem }
 *   PUT    /api/warehouses/{id}/layout/{layoutId}                      → { message, data: LayoutItem }
 *   DELETE /api/warehouses/{id}/layout/{layoutId}                      → { message }
 *   GET    /api/inventories?warehouseId=&status=&customerId=           → { message, items: Inventory[] }
 *
 * Lưu ý backend:
 *  - GET /api/warehouses không gửi regionCode thì server lọc theo claim `region` của token.
 *  - Ô kệ mới ở KHU MỚI bắt buộc `zoneType` (RECEIVING · QUARANTINE · STORAGE · OUTBOUND);
 *    khu đã có thì KHÔNG gửi zoneType (đổi loại khu qua PUT /api/warehouse-zones/{zoneId}).
 *  - Ô sơ đồ lưới (layout) không có sức chứa/ghi chú: sức chứa nằm ở ô kệ (location).
 *
 * Lỗi: mọi lỗi HTTP được ném nguyên dạng axios để trang đọc qua getAdminApiError.
 * KHÔNG import adminService ở đây (adminService re-export file này → vòng import).
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";

const encodeId = (value) => encodeURIComponent(String(value));

const ENDPOINTS = Object.freeze({
  warehouseDetail: (id) => `/api/warehouses/${encodeId(id)}`,
  locations: (warehouseId) => `/api/warehouses/${encodeId(warehouseId)}/locations`,
  activeLocations: (warehouseId) =>
    `/api/warehouses/${encodeId(warehouseId)}/locations/active`,
  locationDetail: (locationId) => `/api/warehouse-locations/${encodeId(locationId)}`,
  layout: (warehouseId) => `/api/warehouses/${encodeId(warehouseId)}/layout`,
  layoutZones: (warehouseId) => `/api/warehouses/${encodeId(warehouseId)}/layout/zones`,
  layoutStatus: (warehouseId) => `/api/warehouses/${encodeId(warehouseId)}/layout/status`,
  layoutDetail: (warehouseId, layoutId) =>
    `/api/warehouses/${encodeId(warehouseId)}/layout/${encodeId(layoutId)}`,
});

export const ZONE_TYPES = Object.freeze(["RECEIVING", "QUARANTINE", "STORAGE", "OUTBOUND"]);

/* =========================
   HELPERS
========================= */

const trimText = (value) => String(value ?? "").trim();
const upperText = (value) => trimText(value).toUpperCase();
const sameText = (a, b) => trimText(a).toLocaleLowerCase("vi") === trimText(b).toLocaleLowerCase("vi");

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

const toIntOrNull = (value) => {
  const number = toNumberOrNull(value);
  return number === null ? null : Math.trunc(number);
};

const hasValue = (value) => value !== undefined && value !== null && value !== "";

const isInactiveStatus = (status) => {
  const key = upperText(status);
  return key === "INACTIVE" || key === "DISABLED";
};

const deleteResult = (id, response, fallbackMessage) => ({
  id,
  success: true,
  message: trimText(response?.data?.message) || fallbackMessage,
});

/* =========================
   KHO
========================= */

export const normalizeAdminWarehouse = (warehouse = {}) => {
  const id = trimText(warehouse?.id ?? warehouse?.warehouseId);
  const region = upperText(warehouse?.region ?? warehouse?.regionCode);

  return {
    ...warehouse,
    id,
    warehouseId: id,
    name: trimText(warehouse?.name ?? warehouse?.warehouseName),
    code: trimText(warehouse?.code ?? warehouse?.warehouseCode),
    address: trimText(warehouse?.address),
    contactPhone: trimText(warehouse?.contactPhone),
    region,
    regionCode: region,
    warehouseType: upperText(warehouse?.warehouseType ?? warehouse?.type),
    isActive: warehouse?.isActive !== false,
  };
};

/* Bộ lọc backend không nhận (warehouseType, country) vẫn lọc tại chỗ như bản cũ. */
const matchesWarehouseFilters = (warehouse, params = {}) => {
  const type = upperText(params?.warehouseType);
  if (type && warehouse.warehouseType !== type) return false;

  const country = upperText(params?.country);
  if (country && warehouse.region !== country) return false;

  return true;
};

const toWarehousePayload = (payload = {}) => ({
  name: trimText(payload?.name),
  code: trimText(payload?.code),
  address: trimText(payload?.address),
  contactPhone: trimText(payload?.contactPhone) || null,
  region: upperText(payload?.region ?? payload?.regionCode) || null,
  warehouseType: upperText(payload?.warehouseType) || "DESTINATION",
  isActive: payload?.isActive !== false,
});

/** GET /api/warehouses — MẢNG TRẦN kho đã chuẩn hoá. */
export const getWarehouses = async (params = {}, options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.warehouses.list, {
    params: removeEmptyParams({
      isActive: typeof params?.isActive === "boolean" ? params.isActive : undefined,
      search: params?.search ?? params?.keyword,
      regionCode: params?.regionCode ?? params?.region,
    }),
    signal: options?.signal,
  });

  return getArrayItems(getResponseData(response))
    .map(normalizeAdminWarehouse)
    .filter((warehouse) => warehouse.id && matchesWarehouseFilters(warehouse, params));
};

/** POST /api/warehouses. */
export const createWarehouse = async (payload, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.warehouses.list,
    toWarehousePayload(payload),
    { signal: options?.signal },
  );
  return normalizeAdminWarehouse(getResponseData(response));
};

/** PUT /api/warehouses/{warehouseId} — backend thay cả bản ghi nên gửi đủ trường. */
export const updateWarehouse = async (warehouseId, payload, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.put(
    ENDPOINTS.warehouseDetail(id),
    toWarehousePayload(payload),
    { signal: options?.signal },
  );
  return normalizeAdminWarehouse(getResponseData(response));
};

/** DELETE /api/warehouses/{warehouseId} — backend chặn kho đã có kiện / tồn kho. */
export const deleteWarehouse = async (warehouseId, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.delete(ENDPOINTS.warehouseDetail(id), {
    signal: options?.signal,
  });
  return deleteResult(id, response, "Đã xoá kho.");
};

/* =========================
   Ô KỆ (location = bin)
========================= */

/** Ô kệ: `locationId` chính là `binId` (cùng quy ước với app kho). */
export const normalizeAdminLocation = (location = {}) => {
  const id = trimText(location?.locationId ?? location?.binId ?? location?.id);
  const zoneType = upperText(location?.zoneType);
  const isActive = location?.isActive !== false;
  const binCode = trimText(location?.binCode ?? location?.code);

  return {
    ...location,
    id,
    locationId: id,
    binId: id,
    binCode,
    code: binCode,
    shelfId: trimText(location?.shelfId),
    shelfCode: trimText(location?.shelfCode),
    zoneId: trimText(location?.zoneId),
    zoneName: trimText(location?.zoneName),
    zoneType,
    warehouseId: trimText(location?.warehouseId),
    warehouseName: trimText(location?.warehouseName),
    maxVolume: toNumberOrNull(location?.maxVolume),
    maxWeight: toNumberOrNull(location?.maxWeight),
    isActive,
    note: location?.note ?? "",
    acceptsStorage: zoneType === "STORAGE" && isActive,
  };
};

const matchesLocationFilters = (location, params = {}) =>
  ["zoneName", "shelfCode", "binCode"].every((field) =>
    hasValue(params?.[field]) ? sameText(location[field], params[field]) : true,
  );

/** GET /api/warehouses/{id}/locations — MẢNG TRẦN ô kệ. */
export const getWarehouseLocations = async (warehouseId, params = {}, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.get(ENDPOINTS.locations(id), {
    params: removeEmptyParams({
      isActive: typeof params?.isActive === "boolean" ? params.isActive : undefined,
    }),
    signal: options?.signal,
  });

  return getArrayItems(getResponseData(response))
    .map(normalizeAdminLocation)
    .filter((location) => location.id && matchesLocationFilters(location, params));
};

/** GET /api/warehouses/{id}/locations/active — MẢNG TRẦN ô kệ đang dùng. */
export const getActiveWarehouseLocations = async (warehouseId, params = {}, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.get(ENDPOINTS.activeLocations(id), {
    signal: options?.signal,
  });

  return getArrayItems(getResponseData(response))
    .map(normalizeAdminLocation)
    .filter((location) => location.id && location.isActive && matchesLocationFilters(location, params));
};

/*
 * Body đúng CreateLocationRequestDto. zoneType chỉ gửi khi người dùng chọn (khu MỚI):
 * gửi kèm cho khu đã có mà khác loại là backend trả 400.
 */
const toLocationPayload = (payload = {}) => {
  const zoneType = upperText(payload?.zoneType);
  if (zoneType && !ZONE_TYPES.includes(zoneType)) {
    throw new Error("Loại khu phải là khu nhận, cách ly, lưu kho hoặc xuất.");
  }

  return {
    zoneName: trimText(payload?.zoneName),
    ...(zoneType ? { zoneType } : {}),
    shelfCode: trimText(payload?.shelfCode),
    binCode: trimText(payload?.binCode),
    maxVolume: toNumberOrNull(payload?.maxVolume),
    maxWeight: toNumberOrNull(payload?.maxWeight),
    isActive: payload?.isActive !== false,
    note: trimText(payload?.note),
  };
};

/** POST /api/warehouses/{id}/locations — backend tự tạo khu/kệ nếu chưa có. */
export const createWarehouseLocation = async (warehouseId, payload, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.post(ENDPOINTS.locations(id), toLocationPayload(payload), {
    signal: options?.signal,
  });
  return normalizeAdminLocation(getResponseData(response));
};

/** PUT /api/warehouse-locations/{locationId}. */
export const updateWarehouseLocation = async (locationId, payload, options = {}) => {
  const id = requireId(locationId, "mã vị trí");
  const response = await httpClient.put(ENDPOINTS.locationDetail(id), toLocationPayload(payload), {
    signal: options?.signal,
  });
  return normalizeAdminLocation(getResponseData(response));
};

/** DELETE /api/warehouse-locations/{locationId} — backend chặn ô còn hàng/kiện. */
export const deleteWarehouseLocation = async (locationId, options = {}) => {
  const id = requireId(locationId, "mã vị trí");
  const response = await httpClient.delete(ENDPOINTS.locationDetail(id), {
    signal: options?.signal,
  });
  return deleteResult(id, response, "Đã xoá vị trí kho.");
};

/* =========================
   SƠ ĐỒ LƯỚI (layout)
========================= */

/*
 * Ô sơ đồ: backend dùng rowIndex/columnIndex/displayLabel/status; màn Admin đọc
 * gridRow/gridColumn/label/isActive/zoneCode — giữ cả hai bộ khoá.
 */
export const normalizeLayoutItem = (item = {}) => {
  const id = trimText(item?.id ?? item?.layoutId);
  const status = upperText(item?.status) || "ACTIVE";
  const zoneName = trimText(item?.zoneName);
  const rowIndex = toIntOrNull(item?.rowIndex ?? item?.gridRow);
  const columnIndex = toIntOrNull(item?.columnIndex ?? item?.gridColumn);
  const label = trimText(item?.displayLabel ?? item?.label);

  return {
    ...item,
    id,
    layoutId: id,
    warehouseId: trimText(item?.warehouseId),
    zoneId: trimText(item?.zoneId) || null,
    shelfId: trimText(item?.shelfId) || null,
    binId: trimText(item?.binId) || null,
    zoneName,
    zoneCode: trimText(item?.zoneCode) || zoneName,
    shelfCode: trimText(item?.shelfCode),
    binCode: trimText(item?.binCode),
    label,
    displayLabel: label,
    rowIndex,
    columnIndex,
    gridRow: rowIndex,
    gridColumn: columnIndex,
    layoutType: upperText(item?.layoutType),
    status,
    isActive: !isInactiveStatus(status),
    width: toIntOrNull(item?.width),
    height: toIntOrNull(item?.height),
    colorCode: item?.colorCode ?? null,
  };
};

/** GET /api/warehouses/{id}/layout — MẢNG TRẦN ô sơ đồ. */
export const getWarehouseLayout = async (warehouseId, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.get(ENDPOINTS.layout(id), { signal: options?.signal });
  return getArrayItems(getResponseData(response)).map(normalizeLayoutItem);
};

/*
 * GET /api/warehouses/{id}/layout/zones — cây khu → kệ → ô (mọi khu của kho, kể cả khu
 * chưa có ô). Trả object { warehouseId, totalZones, totalShelves, totalBins, zones } như
 * bản cũ; mỗi khu giữ `shelves[].bins[]` gốc + số tổng hợp.
 */
export const getWarehouseLayoutZones = async (warehouseId, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.get(ENDPOINTS.layoutZones(id), { signal: options?.signal });

  const zones = getArrayItems(getResponseData(response)).map((zone) => {
    const zoneType = upperText(zone?.zoneType);
    const status = upperText(zone?.status) || "ACTIVE";
    const shelves = (Array.isArray(zone?.shelves) ? zone.shelves : []).map((shelf) => ({
      ...shelf,
      bins: Array.isArray(shelf?.bins) ? shelf.bins : [],
    }));
    const bins = shelves.flatMap((shelf) => shelf.bins);
    const activeBins = bins.filter((bin) => !isInactiveStatus(bin?.status)).length;

    return {
      ...zone,
      zoneId: trimText(zone?.zoneId),
      zoneCode: trimText(zone?.zoneCode) || trimText(zone?.zoneName),
      zoneName: trimText(zone?.zoneName),
      zoneType,
      status,
      acceptsStorage: zoneType === "STORAGE" && status === "ACTIVE",
      shelves,
      shelfCount: shelves.length,
      totalBins: bins.length,
      activeBins,
      inactiveBins: bins.length - activeBins,
      maxVolume: bins.reduce((sum, bin) => sum + (Number(bin?.maxVolume) || 0), 0),
      maxWeight: bins.reduce((sum, bin) => sum + (Number(bin?.maxWeight) || 0), 0),
    };
  });

  return {
    warehouseId: id,
    totalZones: zones.length,
    totalShelves: zones.reduce((sum, zone) => sum + zone.shelfCount, 0),
    totalBins: zones.reduce((sum, zone) => sum + zone.totalBins, 0),
    zones,
  };
};

/*
 * GET /api/warehouses/{id}/layout/status — backend trả MỖI Ô SƠ ĐỒ một dòng
 * (AVAILABLE · OCCUPIED · FULL · LOCKED · INACTIVE, currentItemCount, utilizationRate…).
 * Chỉ ô sơ đồ gắn với ô kệ (binId) mới có số lấp đầy. Trả object tổng hợp + `items`.
 */
export const getWarehouseLayoutStatus = async (warehouseId, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const response = await httpClient.get(ENDPOINTS.layoutStatus(id), { signal: options?.signal });

  const items = getArrayItems(getResponseData(response)).map((item) => ({
    ...item,
    layoutId: trimText(item?.layoutId),
    binId: trimText(item?.binId) || null,
    status: upperText(item?.status),
    currentItemCount: Number(item?.currentItemCount) || 0,
    currentWeight: Number(item?.currentWeight) || 0,
    utilizationRate: toNumberOrNull(item?.utilizationRate),
  }));

  const binItems = items.filter((item) => item.binId);
  const countStatus = (status) => binItems.filter((item) => item.status === status).length;
  const occupiedBins = binItems.filter((item) => item.currentItemCount > 0).length;
  const utilizations = binItems
    .map((item) => item.utilizationRate)
    .filter((value) => value !== null);

  return {
    warehouseId: id,
    items,
    totalLayoutItems: items.length,
    binLayoutItems: binItems.length,
    availableBins: countStatus("AVAILABLE"),
    occupiedBins,
    fullBins: countStatus("FULL"),
    lockedBins: countStatus("LOCKED"),
    inactiveBins: countStatus("INACTIVE"),
    totalItemCount: binItems.reduce((sum, item) => sum + item.currentItemCount, 0),
    totalWeight: binItems.reduce((sum, item) => sum + item.currentWeight, 0),
    occupancyRate: binItems.length ? Math.round((occupiedBins / binItems.length) * 100) : 0,
    maxUtilizationRate: utilizations.length ? Math.max(...utilizations) : null,
  };
};

/*
 * Form "Ô sơ đồ" của Admin nhập MÃ KHU + NHÃN, còn backend cần zoneId/shelfId/binId.
 * Ánh xạ: mã khu → khu của kho (theo zoneCode hoặc zoneName); nhãn trùng mã ô kệ trong
 * khu → ô BIN (gắn cả kệ + khu); trùng mã kệ → ô SHELF; còn lại là ô ZONE (hoặc OTHER khi
 * không có khu). Không có khu tương ứng thì báo lỗi chứ không tạo khu ngầm.
 */
const resolveLayoutLinks = async (warehouseId, payload = {}, options = {}) => {
  if (hasValue(payload?.zoneId) || hasValue(payload?.shelfId) || hasValue(payload?.binId)) {
    return {
      zoneId: trimText(payload?.zoneId) || null,
      shelfId: trimText(payload?.shelfId) || null,
      binId: trimText(payload?.binId) || null,
      layoutType: upperText(payload?.layoutType) || (hasValue(payload?.binId) ? "BIN" : hasValue(payload?.shelfId) ? "SHELF" : "ZONE"),
    };
  }

  const zoneKey = trimText(payload?.zoneCode ?? payload?.zoneName);
  const label = trimText(payload?.label ?? payload?.displayLabel);
  let zone = null;

  if (zoneKey) {
    const zonesResponse = await httpClient.get(API_ENDPOINTS.warehouseZones.list(warehouseId), {
      signal: options?.signal,
    });
    zone = getArrayItems(getResponseData(zonesResponse)).find(
      (item) => sameText(item?.zoneCode, zoneKey) || sameText(item?.zoneName, zoneKey),
    );

    if (!zone) {
      throw new Error(
        `Kho chưa có khu "${zoneKey}". Tạo khu bằng cách thêm ô kệ ở chế độ xem phân tầng trước.`,
      );
    }
  }

  const zoneId = trimText(zone?.zoneId ?? zone?.id) || null;

  if (label) {
    const locations = await getWarehouseLocations(warehouseId, {}, options);
    const inZone = zoneId ? locations.filter((location) => location.zoneId === zoneId) : locations;
    const bin = inZone.find((location) => sameText(location.binCode, label));

    if (bin) {
      return { zoneId: bin.zoneId || zoneId, shelfId: bin.shelfId || null, binId: bin.id, layoutType: "BIN" };
    }

    const shelf = inZone.find((location) => sameText(location.shelfCode, label));
    if (shelf) {
      return { zoneId: shelf.zoneId || zoneId, shelfId: shelf.shelfId || null, binId: null, layoutType: "SHELF" };
    }
  }

  return { zoneId, shelfId: null, binId: null, layoutType: zoneId ? "ZONE" : "OTHER" };
};

const toLayoutBody = (payload = {}, links = {}, current = null) => {
  const label = trimText(payload?.label ?? payload?.displayLabel);
  if (!label) throw new Error("Vui lòng nhập nhãn hiển thị cho ô sơ đồ kho.");

  const rowIndex = toIntOrNull(payload?.gridRow ?? payload?.rowIndex);
  const columnIndex = toIntOrNull(payload?.gridColumn ?? payload?.columnIndex);
  if (rowIndex === null || columnIndex === null || rowIndex < 0 || columnIndex < 0) {
    throw new Error("Tọa độ hàng và cột phải là số không âm.");
  }

  const status = hasValue(payload?.status)
    ? upperText(payload.status)
    : payload?.isActive === false
      ? "INACTIVE"
      : "ACTIVE";

  return {
    zoneId: links.zoneId ?? null,
    shelfId: links.shelfId ?? null,
    binId: links.binId ?? null,
    rowIndex,
    columnIndex,
    displayLabel: label,
    layoutType: links.layoutType || "OTHER",
    status,
    width: hasValue(payload?.width) ? toIntOrNull(payload.width) : current?.width ?? null,
    height: hasValue(payload?.height) ? toIntOrNull(payload.height) : current?.height ?? null,
    colorCode: hasValue(payload?.colorCode) ? trimText(payload.colorCode) : current?.colorCode ?? null,
  };
};

/** POST /api/warehouses/{id}/layout. */
export const createWarehouseLayoutItem = async (warehouseId, payload, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  toLayoutBody(payload, {}); /* chặn nhãn/tọa độ sai TRƯỚC khi gọi mạng */
  const links = await resolveLayoutLinks(id, payload, options);
  const response = await httpClient.post(ENDPOINTS.layout(id), toLayoutBody(payload, links), {
    signal: options?.signal,
  });
  return normalizeLayoutItem(getResponseData(response));
};

/*
 * PUT /api/warehouses/{id}/layout/{layoutId} — backend GHI ĐÈ mọi trường, nên đọc ô hiện
 * tại trước: mã khu + nhãn không đổi thì giữ nguyên liên kết khu/kệ/ô, kích thước, màu.
 */
export const updateWarehouseLayoutItem = async (warehouseId, layoutId, payload, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const itemId = requireId(layoutId, "mã ô layout");
  toLayoutBody(payload, {});

  const current = (await getWarehouseLayout(id, options)).find((item) => item.id === itemId);
  if (!current) throw new Error("Không tìm thấy mã ô layout.");

  const zoneKey = trimText(payload?.zoneCode ?? payload?.zoneName);
  const label = trimText(payload?.label ?? payload?.displayLabel);
  const linksUnchanged =
    !hasValue(payload?.zoneId) &&
    !hasValue(payload?.shelfId) &&
    !hasValue(payload?.binId) &&
    (sameText(zoneKey, current.zoneCode) || (!zoneKey && !current.zoneId)) &&
    sameText(label, current.label);

  const links = linksUnchanged
    ? {
        zoneId: current.zoneId,
        shelfId: current.shelfId,
        binId: current.binId,
        layoutType: current.layoutType || "OTHER",
      }
    : await resolveLayoutLinks(id, payload, options);

  const response = await httpClient.put(
    ENDPOINTS.layoutDetail(id, itemId),
    toLayoutBody(payload, links, current),
    { signal: options?.signal },
  );
  return normalizeLayoutItem(getResponseData(response));
};

/** DELETE /api/warehouses/{id}/layout/{layoutId} — backend chặn ô gắn ô kệ còn hàng. */
export const deleteWarehouseLayoutItem = async (warehouseId, layoutId, options = {}) => {
  const id = requireId(warehouseId, "mã kho");
  const itemId = requireId(layoutId, "mã ô layout");
  const response = await httpClient.delete(ENDPOINTS.layoutDetail(id, itemId), {
    signal: options?.signal,
  });
  return deleteResult(itemId, response, "Đã xoá ô sơ đồ kho.");
};

/* =========================
   TỒN KHO
========================= */

export const normalizeAdminInventory = (inventory = {}) => {
  const id = trimText(inventory?.inventoryId ?? inventory?.id);
  const status = upperText(inventory?.status);

  return {
    ...inventory,
    id,
    inventoryId: id,
    binId: trimText(inventory?.binId),
    binCode: trimText(inventory?.binCode),
    status,
    inventoryStatus: status,
    quantity: Number(inventory?.quantity) || 0,
    actualWeight: toNumberOrNull(inventory?.actualWeight),
    actualVolume: toNumberOrNull(inventory?.actualVolume),
    storageDays: Number(inventory?.storageDays) || 0,
    storageHours: Number(inventory?.storageHours) || 0,
  };
};

/*
 * GET /api/inventories — MẢNG TRẦN. Không chỉ định status thì bỏ RELEASED (đã xuất khỏi
 * kho, không còn nằm trên kệ); cần cả RELEASED thì truyền includeReleased: true.
 */
export const getInventories = async (params = {}, options = {}) => {
  const status = upperText(params?.status ?? params?.inventoryStatus);
  const response = await httpClient.get(API_ENDPOINTS.inventories, {
    params: removeEmptyParams({
      warehouseId: trimText(params?.warehouseId),
      customerId: trimText(params?.customerId),
      status,
      regionCode: params?.regionCode,
    }),
    signal: options?.signal,
  });

  return getArrayItems(getResponseData(response))
    .map(normalizeAdminInventory)
    .filter((inventory) => status || params?.includeReleased || inventory.status !== "RELEASED")
    .filter((inventory) => (hasValue(params?.binCode) ? sameText(inventory.binCode, params.binCode) : true));
};

/** GET /api/inventories?warehouseId= — MẢNG TRẦN tồn kho của một kho. */
export const getWarehouseInventories = async (warehouseId, params = {}, options = {}) =>
  getInventories({ ...params, warehouseId: requireId(warehouseId, "mã kho") }, options);

const warehouseAdminService = {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseLocations,
  getActiveWarehouseLocations,
  createWarehouseLocation,
  updateWarehouseLocation,
  deleteWarehouseLocation,
  getWarehouseLayout,
  getWarehouseLayoutZones,
  getWarehouseLayoutStatus,
  createWarehouseLayoutItem,
  updateWarehouseLayoutItem,
  deleteWarehouseLayoutItem,
  getInventories,
  getWarehouseInventories,
};

export default warehouseAdminService;
