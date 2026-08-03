/**
 * Workflow "Gom hàng theo tồn kho" — wire vào BE thật.
 *
 * Mapping:
 * - Tồn kho      → GET /api/inventories
 * - Master box    → /api/consolidation (masterCode ≈ mã master box; gom theo orderIds)
 * - Lookups       → /api/warehouses|carriers|shipping-methods/active
 * - Chi tiết kiện → GET /api/parcels/{parcelId}
 * - Shipment QT   → WRO pipeline + POST /api/international-shipments
 */

import axiosInstance from "../axiosInstance";
import {
  getAdminApiData,
  getAdminApiError,
  getAdminApiList,
} from "../AdminAPI/adminService";
import { getActiveWarehousesApi } from "../SaleAPI/ConsignmentAPI/warehouseService";

export { getAdminApiError as getOperationsApiError };

/* ====================== Status meta / labels ====================== */

export const INVENTORY_STATUS_META = {
  AVAILABLE: { label: "Trong kho", tone: "success" },
  READY_FOR_CONSOLIDATION: { label: "Sẵn sàng gom", tone: "processing" },
  RESERVED: { label: "Đã giữ", tone: "warning" },
  PICKED: { label: "Đã lấy hàng", tone: "processing" },
  RELEASED: { label: "Đã xuất kho", tone: "default" },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "default" },
};

export const PACKAGE_STATUS_META = {
  OK: { label: "Bình thường", tone: "success" },
  MISSING_MEASUREMENT: { label: "Thiếu cân/đo", tone: "warning" },
  RESTRICTED: { label: "Hạn chế", tone: "error" },
  REJECTED: { label: "Từ chối", tone: "error" },
  DAMAGED_HOLD: { label: "Hư hỏng", tone: "error" },
  WAITING_CUSTOMER_CORRECTION: { label: "Chờ chỉnh sửa", tone: "warning" },
};

export const MASTER_BOX_STATUS_META = {
  DRAFT: { label: "Nháp", tone: "warning" },
  PACKED: { label: "Đã đóng gói", tone: "processing" },
  SHIPPED: { label: "Đã xuất hàng", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "error" },
};

export const SHIPMENT_STATUS_META = {
  CREATED: { label: "Mới tạo", tone: "warning" },
  CONFIRMED: { label: "Đã xác nhận", tone: "processing" },
  MANIFESTED: { label: "Đã manifest", tone: "processing" },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "processing" },
  ARRIVED: { label: "Đã đến kho đích", tone: "success" },
  ARRIVED_DESTINATION: { label: "Đã đến kho đích", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "error" },
};

const ELIGIBLE_INVENTORY_STATUSES = new Set(["AVAILABLE", "READY_FOR_CONSOLIDATION"]);
const BLOCKED_PACKAGE_STATUSES = {
  MISSING_MEASUREMENT: "Kiện chưa có cân nặng thực tế / trọng lượng tính cước.",
  RESTRICTED: "Kiện thuộc danh mục hàng hạn chế.",
  REJECTED: "Kiện đã bị từ chối.",
  DAMAGED_HOLD: "Kiện đang bị giữ do hư hỏng.",
  WAITING_CUSTOMER_CORRECTION: "Kiện đang chờ khách hàng chỉnh sửa thông tin.",
};
const ACTIVE_BOX_STATUSES = new Set(["DRAFT", "PACKED", "SHIPPED"]);

/* ============================ Helpers ============================ */

const text = (value) => String(value ?? "").trim();
const upper = (value) => text(value).toUpperCase();
const num = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function volumeM3(length, width, height) {
  if (length == null || width == null || height == null) return null;
  return Math.round(((length * width * height) / 1e6) * 1000) / 1000;
}

function detectShippingMode(method) {
  const hay = `${method?.code ?? ""} ${method?.name ?? ""} ${method?.methodCode ?? ""} ${method?.methodName ?? ""}`.toUpperCase();
  if (/SEA|LCL|FCL|OCEAN|ĐƯỜNG BIỂN|DUONG BIEN/.test(hay)) return "SEA";
  if (/EXPRESS|NHANH/.test(hay)) return "EXPRESS";
  return "AIR";
}

/** Chuẩn hoá status consolidation BE → DRAFT | PACKED | SHIPPED | CANCELLED */
export function mapConsolidationStatus(status) {
  const key = upper(status);
  if (!key) return "DRAFT";
  if (["DRAFT", "WAITING", "PENDING"].includes(key)) return "DRAFT";
  if (["PACKED", "CONSOLIDATED", "PROCESSING", "IN_PROGRESS"].includes(key)) return "PACKED";
  if (["SHIPPED", "IN_TRANSIT", "COMPLETED", "DONE", "MANIFESTED"].includes(key)) {
    return "SHIPPED";
  }
  if (["CANCELLED", "CANCELED"].includes(key)) return "CANCELLED";
  return key;
}

export function getPackageStatusMeta(parcel) {
  // Inventory list BE thường không trả L×W×H — chỉ coi thiếu cân là thiếu đo.
  if (
    parcel &&
    (parcel.packageStatus === "OK" || !parcel.packageStatus) &&
    parcel.actualWeight == null &&
    parcel.chargeableWeight == null
  ) {
    return PACKAGE_STATUS_META.MISSING_MEASUREMENT;
  }
  return (
    PACKAGE_STATUS_META[parcel?.packageStatus] ?? {
      label: parcel?.packageStatus || "—",
      tone: "default",
    }
  );
}

export function getInventoryStatusMeta(status) {
  return (
    INVENTORY_STATUS_META[status] ?? {
      label: status || "—",
      tone: "default",
    }
  );
}

function normalizePackageStatus(value) {
  const key = upper(value);
  if (
    !key ||
    ["OK", "NORMAL", "GOOD", "CHECKED_IN", "IN_WAREHOUSE", "STORED", "RECEIVED"].includes(
      key
    )
  ) {
    return "OK";
  }
  if (["RESTRICTED", "BANNED", "PROHIBITED"].includes(key)) return "RESTRICTED";
  if (["REJECTED", "REJECT"].includes(key)) return "REJECTED";
  if (["DAMAGED_HOLD", "DAMAGED", "HOLD"].includes(key)) return "DAMAGED_HOLD";
  if (
    ["WAITING_CUSTOMER_CORRECTION", "WAITING_CORRECTION", "NEED_CORRECTION"].includes(key)
  ) {
    return "WAITING_CUSTOMER_CORRECTION";
  }
  if (["MISSING_MEASUREMENT", "INCOMPLETE"].includes(key)) return "MISSING_MEASUREMENT";
  return key;
}

function normalizeInventoryStatus(value) {
  const key = upper(value);
  if (!key) return "AVAILABLE";
  if (["AVAILABLE", "READY", "IN_STOCK"].includes(key)) return "AVAILABLE";
  if (["READY_FOR_CONSOLIDATION", "READY_TO_CONSOLIDATE"].includes(key)) {
    return "READY_FOR_CONSOLIDATION";
  }
  if (["RESERVED", "ALLOCATED"].includes(key)) return "RESERVED";
  if (["PICKED"].includes(key)) return "PICKED";
  if (["RELEASED"].includes(key)) return "RELEASED";
  if (["IN_TRANSIT", "SHIPPED", "MOVING"].includes(key)) return "IN_TRANSIT";
  return key;
}

/** BE trả actualVolume / totalVolume theo cm³. */
function toCubicMeters(value) {
  const n = num(value);
  if (n == null) return null;
  // Giá trị lớn (vd 82800) chắc chắn là cm³; giá trị nhỏ vẫn /1e6 cho đồng nhất với BE.
  return Math.round((n / 1e6) * 1e6) / 1e6;
}

/* ============================ Mappers ============================ */

function mapWarehouse(row) {
  const type = upper(row?.warehouseType || row?.type || row?.role);
  let role = "ORIGIN";
  if (type === "DESTINATION") role = "DESTINATION";
  else if (type === "ORIGIN") role = "ORIGIN";
  else if (type === "BOTH" || type === "HUB") role = "BOTH";

  return {
    id: text(row?.id || row?.warehouseId),
    code: text(row?.code || row?.warehouseCode),
    name: text(row?.name || row?.warehouseName),
    warehouseType: type,
    role,
    country: text(row?.region || row?.country),
  };
}

function mapCarrier(row) {
  return {
    id: text(row?.id || row?.carrierId),
    code: text(row?.carrierCode || row?.code),
    name: text(row?.carrierName || row?.name),
  };
}

function mapShippingMethod(row) {
  const mapped = {
    id: text(row?.id || row?.shippingMethodId),
    code: text(row?.methodCode || row?.code),
    name: text(row?.methodName || row?.name),
  };
  return { ...mapped, mode: detectShippingMode(mapped) };
}

/** Map 1 dòng inventory BE → shape kiện trên UI. */
export function mapInventoryRow(row = {}, boxLookup = new Map()) {
  const length = num(row.length ?? row.Length);
  const width = num(row.width ?? row.Width);
  const height = num(row.height ?? row.Height);
  const actualWeight = num(row.actualWeight ?? row.ActualWeight ?? row.weight);
  const volumetricWeight = num(row.volumetricWeight ?? row.VolumetricWeight);
  const chargeableWeight =
    num(row.chargeableWeight ?? row.ChargeableWeight) ??
    (actualWeight != null && volumetricWeight != null
      ? Math.max(actualWeight, volumetricWeight)
      : actualWeight ?? volumetricWeight);
  // Inventory list BE: actualVolume (cm³). Consolidation parcels: L×W×H (cm).
  const volume =
    toCubicMeters(row.actualVolume ?? row.ActualVolume) ??
    volumeM3(length, width, height) ??
    toCubicMeters(row.volume ?? row.Volume);

  const parcelId = text(row.parcelId || row.ParcelId || row.packageId || "");
  const inventoryId = text(row.inventoryId || row.InventoryId || row.id);
  const orderId = text(
    row.orderId ||
      row.OrderId ||
      row.consignmentId ||
      row.ConsignmentId ||
      row.consignmentOrderId
  );
  const packageCode = text(
    row.packageCode || row.PackageCode || row.parcelCode || row.shippingCode
  );
  const box =
    boxLookup.get(parcelId) ||
    boxLookup.get(packageCode) ||
    (parcelId ? null : boxLookup.get(text(row.id)));

  let packageStatus = normalizePackageStatus(row.packageStatus ?? row.PackageStatus);
  if (packageStatus === "OK" && actualWeight == null && chargeableWeight == null) {
    packageStatus = "MISSING_MEASUREMENT";
  }

  return {
    id: inventoryId || parcelId,
    inventoryId,
    parcelId,
    parcelCode: packageCode,
    orderId,
    orderCode: text(
      row.consignmentCode || row.ConsignmentCode || row.orderCode || row.shippingCode
    ),
    customerId: text(row.customerId || row.CustomerId),
    customerName: text(row.customerName || row.CustomerName || row.customer?.fullName),
    warehouseId: text(row.warehouseId || row.WarehouseId || row.warehouse?.id),
    warehouseCode: text(row.warehouseCode || row.WarehouseCode || row.warehouse?.code),
    warehouseName: text(row.warehouseName || row.WarehouseName || row.warehouse?.name),
    binCode: text(row.binCode || row.BinCode || row.bin?.code || row.storageLocation?.binCode),
    shelfCode: text(
      row.shelfCode || row.ShelfCode || row.shelf?.code || row.storageLocation?.shelfCode
    ),
    destinationWarehouseId: text(
      row.destinationWarehouseId || row.DestinationWarehouseId || ""
    ),
    route: text(row.route || row.Route || row.shippingRoute || ""),
    shippingMethodId: text(row.shippingMethodId || row.ShippingMethodId || ""),
    serviceType: text(row.serviceType || row.ServiceType || row.shippingMethodName || ""),
    actualWeight,
    length,
    width,
    height,
    volumetricWeight,
    chargeableWeight,
    volume,
    packageStatus,
    inventoryStatus: normalizeInventoryStatus(row.status || row.inventoryStatus || row.Status),
    note: text(row.note || row.Note || row.internalNote || ""),
    masterBoxId: box?.id ?? null,
    masterBoxCode: box?.code ?? null,
    quantity: num(row.quantity ?? row.Quantity) ?? 1,
    storageDays: num(row.storageDays),
    raw: row,
  };
}

function flattenConsolidationParcels(consolidation) {
  const boxId = text(consolidation?.id);
  const boxCode = text(consolidation?.masterCode);
  const parcels = [];
  for (const order of consolidation?.orders ?? []) {
    const orderId = text(order.id || order.orderId || order.consignmentId);
    const orderCode = text(order.consignmentCode || order.orderCode);
    const route = text(order.route);
    for (const parcel of order.parcels ?? []) {
      parcels.push({
        id: text(parcel.id || parcel.parcelId),
        parcelId: text(parcel.id || parcel.parcelId),
        parcelCode: text(parcel.packageCode || parcel.parcelCode),
        orderId,
        orderCode,
        customerName: text(order.customerName || parcel.customerName),
        route,
        actualWeight: num(parcel.actualWeight),
        length: num(parcel.length),
        width: num(parcel.width),
        height: num(parcel.height),
        volumetricWeight: num(parcel.volumetricWeight),
        chargeableWeight: num(parcel.chargeableWeight),
        volume: volumeM3(num(parcel.length), num(parcel.width), num(parcel.height)),
        packageStatus: normalizePackageStatus(parcel.packageStatus),
        inventoryStatus: "RESERVED",
        masterBoxId: boxId,
        masterBoxCode: boxCode,
        note: "",
      });
    }
  }
  return parcels;
}

function buildParcelBoxLookup(consolidations) {
  const map = new Map();
  for (const item of consolidations) {
    const status = mapConsolidationStatus(item.status);
    if (!ACTIVE_BOX_STATUSES.has(status) || status === "CANCELLED") continue;
    const box = { id: text(item.id), code: text(item.masterCode), status };
    for (const parcel of flattenConsolidationParcels(item)) {
      if (parcel.parcelId) map.set(parcel.parcelId, box);
      if (parcel.parcelCode) map.set(parcel.parcelCode, box);
    }
  }
  return map;
}

function mapMasterBox(row = {}) {
  const parcels = flattenConsolidationParcels(row);
  const orderIds = [
    ...new Set(
      (row.orders ?? [])
        .map((order) => text(order.id || order.orderId || order.consignmentId))
        .filter(Boolean)
    ),
  ];
  const originWarehouseId = text(
    row.originWarehouseId ||
      row.OriginWarehouseId ||
      parcels[0]?.warehouseId ||
      ""
  );
  const destinationWarehouseId = text(
    row.destinationWarehouseId || row.DestinationWarehouseId || ""
  );

  const parcelVolume = parcels.reduce((sum, p) => sum + (Number(p.volume) || 0), 0);
  const rawTotalVolume = num(row.totalVolume);
  // BE consolidation.totalVolume đang là cm³ (vd 82801).
  const totalVolume =
    parcelVolume ||
    (rawTotalVolume != null ? toCubicMeters(rawTotalVolume) : 0) ||
    0;

  return {
    id: text(row.id),
    code: text(row.masterCode || row.code),
    originWarehouseId,
    destinationWarehouseId,
    shippingMethodId: text(row.shippingMethodId || ""),
    carrierId: text(row.carrierId || ""),
    note: text(row.note || ""),
    status: mapConsolidationStatus(row.status),
    rawStatus: text(row.status),
    shipmentId: text(row.shipmentId) || null,
    orderIds,
    parcels,
    totalWeight: num(row.totalWeight) ?? 0,
    totalVolume,
    createdAt: row.createdAt || row.CreatedAt || null,
    raw: row,
  };
}

/* =========================== Validation =========================== */

export function getParcelBlockReason(row) {
  if (!row) return "Không tìm thấy kiện hàng.";
  if (row.masterBoxId) {
    return `Kiện đã thuộc master box ${row.masterBoxCode || row.masterBoxId}.`;
  }
  const packageBlock = BLOCKED_PACKAGE_STATUSES[row.packageStatus];
  if (packageBlock) return packageBlock;
  if (!ELIGIBLE_INVENTORY_STATUSES.has(row.inventoryStatus)) {
    return "Trạng thái tồn kho phải là AVAILABLE hoặc READY_FOR_CONSOLIDATION.";
  }
  // Inventory list BE thường chỉ có actualWeight (+ actualVolume), không có L×W×H.
  if (row.actualWeight == null && row.chargeableWeight == null) {
    return "Kiện chưa có cân nặng thực tế / trọng lượng tính cước.";
  }
  if (!row.orderId) {
    return "Kiện thiếu mã đơn (order) — BE gom hàng theo orderIds.";
  }
  return null;
}

export function isParcelEligible(row) {
  return getParcelBlockReason(row) == null;
}

/* ============================ Lookups ============================ */

export async function listWarehouses() {
  const rows = await getActiveWarehousesApi();
  return rows.map(mapWarehouse).filter((row) => row.id);
}

export async function listCarriers() {
  try {
    const response = await axiosInstance.get("/api/carriers/active");
    return getAdminApiList(response).map(mapCarrier).filter((row) => row.id);
  } catch {
    const response = await axiosInstance.get("/api/carriers");
    return getAdminApiList(response).map(mapCarrier).filter((row) => row.id);
  }
}

export async function listShippingMethods() {
  try {
    const response = await axiosInstance.get("/api/shipping-methods/active");
    const rows = getAdminApiList(response).map(mapShippingMethod).filter((row) => row.id);
    if (rows.length) return rows;
  } catch {
    // Ops thường 403 với /api/shipping-methods (full) — bỏ qua.
  }
  try {
    const response = await axiosInstance.get("/api/shipping-methods");
    return getAdminApiList(response).map(mapShippingMethod).filter((row) => row.id);
  } catch {
    return [];
  }
}

/* ============================ Queries ============================ */

async function fetchConsolidations(params = {}) {
  const response = await axiosInstance.get("/api/consolidation", { params });
  const data = getAdminApiData(response);
  return Array.isArray(data) ? data : getAdminApiList(response);
}

export async function listConsolidationInventory(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.warehouseId) params.warehouseId = filters.warehouseId;
  if (filters.customerId) params.customerId = filters.customerId;

  const [inventoryResponse, consolidations] = await Promise.all([
    axiosInstance.get("/api/inventories", { params }),
    fetchConsolidations().catch(() => []),
  ]);

  const rows = getAdminApiList(inventoryResponse);
  const boxLookup = buildParcelBoxLookup(consolidations);
  return rows.map((row) => mapInventoryRow(row, boxLookup));
}

export async function listMasterBoxes(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;
  const rows = await fetchConsolidations(params);
  return rows.map(mapMasterBox);
}

export async function getMasterBoxDetail(boxId) {
  if (!boxId) throw new Error("Thiếu id master box / consolidation.");
  const response = await axiosInstance.get(
    `/api/consolidation/${encodeURIComponent(boxId)}`
  );
  const box = mapMasterBox(getAdminApiData(response));
  return {
    box,
    parcels: box.parcels,
    trackings: [
      {
        id: "status",
        entityType: "MASTER_BOX",
        entityId: box.id,
        status: box.status,
        message: `Trạng thái hiện tại: ${MASTER_BOX_STATUS_META[box.status]?.label || box.status}`,
        at: box.createdAt || new Date().toISOString(),
      },
    ],
  };
}

export async function getParcelDetail(parcelId) {
  if (!parcelId) throw new Error("Thiếu id kiện hàng.");
  const response = await axiosInstance.get(
    `/api/parcels/${encodeURIComponent(parcelId)}`
  );
  return mapInventoryRow(getAdminApiData(response));
}

/** Không có GET list shipment — suy ra từ consolidation.shipmentId. */
export async function listShipments() {
  const boxes = await listMasterBoxes();
  const map = new Map();
  for (const box of boxes) {
    if (!box.shipmentId || map.has(box.shipmentId)) continue;
    map.set(box.shipmentId, {
      id: box.shipmentId,
      code: box.shipmentId,
      originWarehouseId: box.originWarehouseId,
      destinationWarehouseId: box.destinationWarehouseId,
      carrierId: box.carrierId,
      shippingMethodId: box.shippingMethodId,
      masterBoxIds: boxes.filter((row) => row.shipmentId === box.shipmentId).map((row) => row.id),
      status: "CREATED",
      seaDetails: null,
      createdAt: box.createdAt,
    });
  }
  return [...map.values()];
}

export async function listTrackings(entityType, entityId) {
  if (entityType !== "MASTER_BOX" || !entityId) return [];
  try {
    const detail = await getMasterBoxDetail(entityId);
    return detail.trackings;
  } catch {
    return [];
  }
}

export async function suggestMasterBoxCode() {
  return "";
}

export async function suggestShipmentCode() {
  return "";
}

/* =========================== Master box (Consolidation) =========================== */

function orderIdsFromParcels(parcels) {
  return [...new Set(parcels.map((row) => text(row.orderId)).filter(Boolean))];
}

export async function createMasterBox(payload) {
  const parcelIds = [...new Set(payload?.parcelIds ?? [])];
  if (!parcelIds.length) throw new Error("Cần chọn ít nhất một kiện hàng.");

  // UI gửi parcelIds — lấy lại inventory để suy ra orderIds (BE nhận orderIds).
  const inventory = await listConsolidationInventory(
    payload?.originWarehouseId ? { warehouseId: payload.originWarehouseId } : {}
  );
  const selected = inventory.filter((row) => parcelIds.includes(row.id) || parcelIds.includes(row.parcelId));
  if (!selected.length) throw new Error("Không tìm thấy kiện đã chọn trong tồn kho.");

  for (const row of selected) {
    const reason = getParcelBlockReason(row);
    if (reason) throw new Error(`${row.parcelCode || row.id}: ${reason}`);
  }

  const warehouseIds = new Set(selected.map((row) => row.warehouseId).filter(Boolean));
  if (warehouseIds.size > 1) {
    throw new Error("Chỉ được gom các kiện cùng một kho xuất vào một master box.");
  }

  const orderIds = orderIdsFromParcels(selected);
  if (!orderIds.length) {
    throw new Error("Các kiện đã chọn thiếu orderId — không gọi được API consolidation.");
  }

  const createResponse = await axiosInstance.post("/api/consolidation", {
    orderIds,
    status: payload?.status || "waiting",
  });
  let created = mapMasterBox(getAdminApiData(createResponse));

  const code = text(payload?.code);
  if (code && created.id) {
    try {
      const updateResponse = await axiosInstance.put(
        `/api/consolidation/${encodeURIComponent(created.id)}`,
        {
          masterCode: code,
          status: created.rawStatus || "waiting",
          orderIds: created.orderIds.length ? created.orderIds : orderIds,
        }
      );
      created = mapMasterBox(getAdminApiData(updateResponse));
    } catch {
      // tạo thành công rồi — bỏ qua lỗi đổi mã
    }
  }

  return created;
}

export async function addParcelsToMasterBox(boxId, parcelIds) {
  if (!boxId) throw new Error("Thiếu id master box.");
  const ids = [...new Set(parcelIds ?? [])];
  if (!ids.length) throw new Error("Cần chọn ít nhất một kiện hàng.");

  const [detail, inventory] = await Promise.all([
    getMasterBoxDetail(boxId),
    listConsolidationInventory(),
  ]);
  const box = detail.box;
  if (box.status !== "DRAFT") {
    throw new Error("Chỉ thêm kiện vào master box đang ở trạng thái nháp.");
  }

  const selected = inventory.filter((row) => ids.includes(row.id) || ids.includes(row.parcelId));
  for (const row of selected) {
    const reason = getParcelBlockReason(row);
    if (reason) throw new Error(`${row.parcelCode || row.id}: ${reason}`);
    if (box.originWarehouseId && row.warehouseId && row.warehouseId !== box.originWarehouseId) {
      throw new Error(
        `${row.parcelCode}: chỉ được gom các kiện cùng một kho xuất vào một master box.`
      );
    }
  }

  const mergedOrderIds = [
    ...new Set([...box.orderIds, ...orderIdsFromParcels(selected)]),
  ];
  const response = await axiosInstance.put(
    `/api/consolidation/${encodeURIComponent(boxId)}`,
    {
      masterCode: box.code || undefined,
      status: box.rawStatus || "waiting",
      orderIds: mergedOrderIds,
      shipmentId: box.shipmentId || undefined,
    }
  );
  return mapMasterBox(getAdminApiData(response));
}

export async function removeParcelFromMasterBox(boxId, parcelId) {
  if (!boxId) throw new Error("Thiếu id master box.");
  if (!parcelId) throw new Error("Thiếu id kiện hàng.");

  const detail = await getMasterBoxDetail(boxId);
  const box = detail.box;
  if (box.status !== "DRAFT") {
    throw new Error("Chỉ rút kiện khỏi master box đang ở trạng thái nháp.");
  }

  const target =
    detail.parcels.find((row) => row.id === parcelId || row.parcelId === parcelId) ?? null;
  if (!target) throw new Error("Kiện hàng không thuộc master box này.");

  // BE gom theo order — rút kiện = bỏ cả order của kiện đó.
  const nextOrderIds = box.orderIds.filter((id) => id !== target.orderId);
  if (nextOrderIds.length === box.orderIds.length) {
    throw new Error("Không xác định được order của kiện để cập nhật consolidation.");
  }
  if (!nextOrderIds.length) {
    throw new Error("Không thể để master box trống order. Hãy hủy lô gom nếu cần.");
  }

  const response = await axiosInstance.put(
    `/api/consolidation/${encodeURIComponent(boxId)}`,
    {
      masterCode: box.code || undefined,
      status: box.rawStatus || "waiting",
      orderIds: nextOrderIds,
      shipmentId: box.shipmentId || undefined,
    }
  );
  return mapMasterBox(getAdminApiData(response));
}

export async function confirmMasterBoxPacking(boxId) {
  if (!boxId) throw new Error("Thiếu id master box.");
  const detail = await getMasterBoxDetail(boxId);
  const box = detail.box;
  if (box.status !== "DRAFT") {
    throw new Error("Chỉ xác nhận đóng gói cho master box đang nháp.");
  }
  if (!detail.parcels.length && !box.orderIds.length) {
    throw new Error("Master box chưa có kiện hàng nào.");
  }

  const response = await axiosInstance.put(
    `/api/consolidation/${encodeURIComponent(boxId)}`,
    {
      masterCode: box.code || undefined,
      status: "packed",
      orderIds: box.orderIds,
      shipmentId: box.shipmentId || undefined,
    }
  );
  return mapMasterBox(getAdminApiData(response));
}

/* ============================ WRO + Shipment ============================ */

/**
 * Pipeline BE:
 * Create WRO (AVAILABLE) → APPROVED → picking-list → confirm picking (PACKING)
 * → complete (RELEASED) → POST /api/international-shipments
 */
async function resolveAvailableInventoryForBoxes(masterBoxIds) {
  const details = await Promise.all(masterBoxIds.map((id) => getMasterBoxDetail(id)));
  const wantedCodes = new Set();
  const wantedParcelIds = new Set();
  for (const detail of details) {
    for (const parcel of detail.parcels ?? []) {
      if (parcel.parcelCode) wantedCodes.add(upper(parcel.parcelCode));
      if (parcel.parcelId) wantedParcelIds.add(text(parcel.parcelId));
    }
  }
  if (!wantedCodes.size && !wantedParcelIds.size) {
    throw new Error("Các master box đã chọn chưa có kiện — không tạo được WRO.");
  }

  const response = await axiosInstance.get("/api/inventories", {
    params: { status: "AVAILABLE" },
  });
  const available = getAdminApiList(response).map((row) => mapInventoryRow(row));
  const matched = available.filter(
    (row) =>
      (row.parcelCode && wantedCodes.has(upper(row.parcelCode))) ||
      (row.parcelId && wantedParcelIds.has(text(row.parcelId)))
  );

  if (!matched.length) {
    throw new Error(
      "Không tìm thấy tồn kho AVAILABLE khớp kiện trong master box. WRO chỉ tạo được từ inventory đang AVAILABLE."
    );
  }

  const missing = [...wantedCodes].filter(
    (code) => !matched.some((row) => upper(row.parcelCode) === code)
  );
  if (missing.length) {
    throw new Error(
      `Thiếu tồn kho AVAILABLE cho kiện: ${missing.slice(0, 5).join(", ")}${
        missing.length > 5 ? "…" : ""
      }`
    );
  }

  return { details, items: matched };
}

async function createAndReleaseWro(payload, inventoryRows) {
  const receiverName = text(payload.receiverName);
  const receiverPhone = text(payload.receiverPhone);
  const deliveryAddress = text(payload.deliveryAddress);
  if (!receiverName || !receiverPhone || !deliveryAddress) {
    throw new Error("Cần nhập người nhận, SĐT và địa chỉ giao để tạo WRO.");
  }

  const createItems = inventoryRows.map((row) => ({
    inventoryId: row.inventoryId || row.id,
    quantity: Math.max(1, Number(row.quantity) || 1),
  }));

  const createResponse = await axiosInstance.post("/api/warehouse-release-requests", {
    receiverName,
    receiverPhone,
    deliveryAddress,
    shelfCode: payload.shelfCode || undefined,
    items: createItems,
  });
  const created = getAdminApiData(createResponse);
  const wroId = text(created?.wroId || created?.id || created?.WroId);
  if (!wroId) throw new Error("Tạo WRO thành công nhưng không nhận được wroId.");

  // Duyệt
  await axiosInstance.put(`/api/warehouse-release-requests/${encodeURIComponent(wroId)}/status`, {
    status: "APPROVED",
  });

  // Tạo phiếu picking
  const pickingResponse = await axiosInstance.post(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/picking-list`
  );
  const picking = getAdminApiData(pickingResponse);
  const pickingListId = text(
    picking?.pickingListId || picking?.id || picking?.PickingListId
  );
  if (!pickingListId) throw new Error("Tạo phiếu picking thành công nhưng thiếu pickingListId.");

  const pickingItems = (picking?.items || created?.items || []).map((item) => ({
    inventoryId: text(item.inventoryId || item.InventoryId),
    quantity: Math.max(1, Number(item.quantity ?? item.Quantity) || 1),
  })).filter((item) => item.inventoryId);

  if (!pickingItems.length) {
    throw new Error("Phiếu picking không có item để xác nhận.");
  }

  // Xác nhận lấy hàng → WRO = PACKING
  await axiosInstance.put(
    `/api/picking-lists/${encodeURIComponent(pickingListId)}/confirm`,
    { items: pickingItems }
  );

  // Hoàn tất xuất kho → WRO = RELEASED
  await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/complete`,
    { items: pickingItems }
  );

  return {
    wroId,
    wroCode: text(created?.wroCode || created?.WroCode),
    items: pickingItems,
  };
}

/**
 * Tạo shipment quốc tế.
 * - Có `wroRequestIds` → gọi thẳng /api/international-shipments
 * - Có `masterBoxIds` → tự chạy pipeline WRO đến RELEASED rồi tạo shipment
 */
export async function createShipment(payload) {
  let wroRequestIds = [...new Set(payload?.wroRequestIds ?? [])].filter(Boolean);
  const masterBoxIds = [...new Set(payload?.masterBoxIds ?? [])].filter(Boolean);

  let originWarehouseId = text(payload?.originWarehouseId);
  let destinationWarehouseId = text(payload?.destinationWarehouseId);

  if (!wroRequestIds.length) {
    if (!masterBoxIds.length) {
      throw new Error("Cần chọn master box hoặc truyền wroRequestIds để tạo shipment.");
    }

    const { details, items } = await resolveAvailableInventoryForBoxes(masterBoxIds);
    if (!originWarehouseId) {
      originWarehouseId =
        text(details[0]?.box?.originWarehouseId) || text(items[0]?.warehouseId);
    }
    if (!destinationWarehouseId) {
      destinationWarehouseId = text(details[0]?.box?.destinationWarehouseId);
    }
    if (!originWarehouseId) throw new Error("Cần chọn kho xuất.");
    if (!destinationWarehouseId) throw new Error("Cần chọn kho đích.");

    const wro = await createAndReleaseWro(
      { ...payload, originWarehouseId, destinationWarehouseId },
      items
    );
    wroRequestIds = [wro.wroId];
  }

  if (!originWarehouseId) throw new Error("Cần chọn kho xuất.");
  if (!destinationWarehouseId) throw new Error("Cần chọn kho đích.");

  const methods = await listShippingMethods();
  const method =
    methods.find((row) => row.id === payload.shippingMethodId) ||
    methods.find((row) => row.code === payload.shippingMethodId);

  const response = await axiosInstance.post("/api/international-shipments", {
    wroRequestIds,
    originWarehouseId,
    destinationWarehouseId,
    carrierId: payload.carrierId || undefined,
    shippingMethod: method?.code || method?.name || payload.shippingMethodId || undefined,
  });
  const shipment = getAdminApiData(response);
  const shipmentId = text(shipment?.shipmentId || shipment?.id || shipment?.ShipmentId);

  // Gắn shipmentId lại consolidation nếu có
  if (shipmentId && masterBoxIds.length) {
    await Promise.allSettled(
      masterBoxIds.map(async (boxId) => {
        const detail = await getMasterBoxDetail(boxId);
        await axiosInstance.put(`/api/consolidation/${encodeURIComponent(boxId)}`, {
          masterCode: detail.box.code || undefined,
          status: detail.box.rawStatus || "shipped",
          orderIds: detail.box.orderIds,
          shipmentId,
        });
      })
    );
  }

  return {
    id: shipmentId,
    code: text(shipment?.shipmentCode || shipment?.ShipmentCode || shipmentId),
    originWarehouseId,
    destinationWarehouseId,
    carrierId: text(shipment?.carrierId || payload.carrierId),
    shippingMethodId: payload.shippingMethodId,
    masterBoxIds,
    wroRequestIds,
    status: text(shipment?.status || "CREATED"),
    raw: shipment,
  };
}
