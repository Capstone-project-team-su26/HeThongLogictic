/**
 * Workflow "Gom hàng theo tồn kho" — wire vào BE thật.
 *
 * Mapping (Swagger Consolidation):
 * - Master box    → /api/consolidation
 *   DTO: id, masterCode, totalWeight, totalVolume(cm³), status, shipmentId, orders[]
 *   Status đọc/ghi chuẩn: DRAFT | CONSOLIDATED | SHIPPED | CANCELLED
 *     (BE cũng chấp nhận waiting/packed — FE chuẩn hoá về swagger)
 *   DELETE /api/consolidation/{id} = xóa/hủy lô
 * - Tồn kho      → GET /api/inventories ({ items } hoặc mảng)
 * - Lookups       → /api/warehouses|carriers|shipping-methods/active|shipping-routes
 * - Chi tiết kiện → GET /api/parcels/{parcelId}
 * - Shipment QT   → WRO pipeline → POST /api/international-shipments
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
  PACKED: { label: "Đã gom", tone: "processing" }, // UI cho CONSOLIDATED
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

export const WRO_STATUS_META = {
  PENDING: { label: "Chờ duyệt", tone: "warning" },
  PENDING_REVIEW: { label: "Chờ xem xét", tone: "warning" },
  RELEASE_PENDING: { label: "Chờ duyệt xuất kho", tone: "warning" },
  RELEASE_APPROVED: { label: "Đã duyệt xuất kho", tone: "processing" },
  PICKING: { label: "Đang lấy hàng", tone: "processing" },
  PACKING: { label: "Đang đóng gói", tone: "processing" },
  RELEASED: { label: "Đã xuất kho", tone: "success" },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "processing" },
  HANDED_OVER: { label: "Đã bàn giao", tone: "success" },
  COMPLETED: { label: "Hoàn tất", tone: "success" },
  REJECTED: { label: "Đã từ chối", tone: "error" },
  CANCELLED: { label: "Đã hủy", tone: "error" },
};

/** Status còn cần OP duyệt / từ chối (BE thật: WarehouseTQ gửi RELEASE_PENDING / PENDING_REVIEW). */
export const WRO_NEEDS_APPROVAL_STATUSES = new Set([
  "PENDING",
  "PENDING_REVIEW",
  "RELEASE_PENDING",
]);

export function wroNeedsApproval(status) {
  return WRO_NEEDS_APPROVAL_STATUSES.has(upper(status));
}

export function getWroStatusMeta(status) {
  return (
    WRO_STATUS_META[upper(status)] ?? {
      label: status || "—",
      tone: "default",
    }
  );
}

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

export const TRANSPORT_MODES = [
  { value: "AIR", label: "Hàng không (AIR)" },
  { value: "SEA", label: "Đường biển (SEA)" },
  { value: "ROAD", label: "Đường bộ (ROAD)" },
  { value: "RAIL", label: "Đường sắt (RAIL)" },
];

function detectShippingMode(method) {
  const hay = `${method?.code ?? ""} ${method?.name ?? ""} ${method?.methodCode ?? ""} ${method?.methodName ?? ""}`.toUpperCase();
  if (/SEA|LCL|FCL|OCEAN|ĐƯỜNG BIỂN|DUONG BIEN/.test(hay)) return "SEA";
  if (/ROAD|LAND|TRUCK|ĐƯỜNG BỘ|DUONG BO/.test(hay)) return "ROAD";
  if (/RAIL|TRAIN|ĐƯỜNG SẮT|DUONG SAT/.test(hay)) return "RAIL";
  if (/AIR|BAY|HÀNG KHÔNG|HANG KHONG|EXPRESS|NHANH/.test(hay)) return "AIR";
  return "";
}

/**
 * Chuẩn hoá status consolidation BE → DRAFT | PACKED | SHIPPED | CANCELLED.
 * Swagger ví dụ: DRAFT, CONSOLIDATED. Thực tế BE còn waiting/packed/"string".
 */
export function mapConsolidationStatus(status) {
  const key = upper(status);
  if (!key || key === "STRING" || key === "NULL" || key === "UNDEFINED") {
    return "DRAFT";
  }
  if (["DRAFT", "WAITING", "PENDING", "NEW", "OPEN"].includes(key)) return "DRAFT";
  if (
    ["PACKED", "CONSOLIDATED", "PROCESSING", "IN_PROGRESS", "CONFIRMED"].includes(key)
  ) {
    return "PACKED";
  }
  if (["SHIPPED", "IN_TRANSIT", "COMPLETED", "DONE", "MANIFESTED"].includes(key)) {
    return "SHIPPED";
  }
  if (["CANCELLED", "CANCELED"].includes(key)) return "CANCELLED";
  return "DRAFT";
}

/** Status gửi lên PUT/POST — khớp swagger (DRAFT / CONSOLIDATED / …). */
export function toConsolidationApiStatus(uiOrRawStatus) {
  const mapped = mapConsolidationStatus(uiOrRawStatus);
  if (mapped === "PACKED") return "CONSOLIDATED";
  if (mapped === "SHIPPED") return "SHIPPED";
  if (mapped === "CANCELLED") return "CANCELLED";
  return "DRAFT";
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

function mapShippingRoute(row) {
  return {
    id: text(row?.id || row?.shippingRouteId || row?.routeId),
    code: text(row?.routeCode || row?.code),
    name: text(row?.routeName || row?.name),
    originCountry: text(row?.originCountry),
    destinationCountry: text(row?.destinationCountry),
    transportMode: upper(row?.transportMode || row?.TransportMode),
    originWarehouseId: text(row?.originWarehouseId),
    destinationWarehouseId: text(row?.destinationWarehouseId),
    carrierId: text(row?.carrierId),
    estimatedTransitDays: num(row?.estimatedTransitDays),
    isActive: row?.isActive !== false,
  };
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
  const orders = Array.isArray(row.orders) ? row.orders : [];
  const orderIds = [
    ...new Set(
      orders
        .map((order) => text(order.id || order.orderId || order.consignmentId))
        .filter(Boolean)
    ),
  ];
  const firstOrder = orders[0] || {};
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
  // Swagger/BE: ConsolidationResponseDto.totalVolume là cm³ (vd 64000 → 0.064 m³).
  const totalVolume =
    parcelVolume ||
    (rawTotalVolume != null ? toCubicMeters(rawTotalVolume) : 0) ||
    0;

  const status = mapConsolidationStatus(row.status);

  return {
    id: text(row.id),
    code: text(row.masterCode || row.code),
    originWarehouseId,
    destinationWarehouseId,
    route: text(firstOrder.route || row.route || ""),
    shippingMethodId: text(row.shippingMethodId || ""),
    carrierId: text(row.carrierId || ""),
    note: text(row.note || ""),
    status,
    rawStatus: text(row.status),
    apiStatus: toConsolidationApiStatus(status),
    shipmentId: text(row.shipmentId) || null,
    orderIds,
    parcels,
    totalWeight: num(row.totalWeight) ?? 0,
    totalVolume,
    createdAt: row.createdAt || row.CreatedAt || null,
    raw: row,
  };
}

/** Bổ sung kho xuất từ inventory — ConsolidationResponseDto không có warehouseId. */
export function enrichMasterBoxesWithInventory(boxes, inventory = []) {
  const byParcelId = new Map();
  const byCode = new Map();
  for (const row of inventory) {
    if (row.parcelId) byParcelId.set(text(row.parcelId), row);
    if (row.parcelCode) byCode.set(upper(row.parcelCode), row);
  }

  return (boxes || []).map((box) => {
    if (box.originWarehouseId) return box;
    const fromParcels = (box.parcels || [])
      .map(
        (parcel) =>
          byParcelId.get(text(parcel.parcelId || parcel.id)) ||
          byCode.get(upper(parcel.parcelCode))
      )
      .find(Boolean);
    const fromLookup =
      fromParcels ||
      inventory.find((row) => row.masterBoxId && row.masterBoxId === box.id);
    if (!fromLookup?.warehouseId) return box;
    return {
      ...box,
      originWarehouseId: text(fromLookup.warehouseId),
    };
  });
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

export async function listShippingRoutes(filters = {}) {
  try {
    const params = {};
    if (filters.transportMode) params.transportMode = filters.transportMode;
    if (filters.isActive != null) params.isActive = filters.isActive;
    const response = await axiosInstance.get("/api/shipping-routes", { params });
    return getAdminApiList(response).map(mapShippingRoute).filter((row) => row.id || row.code);
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
  let box = mapMasterBox(getAdminApiData(response));
  if (!box.originWarehouseId && box.parcels?.length) {
    try {
      const inventoryResponse = await axiosInstance.get("/api/inventories");
      const inventory = getAdminApiList(inventoryResponse).map((row) =>
        mapInventoryRow(row)
      );
      box = enrichMasterBoxesWithInventory([box], inventory)[0] || box;
    } catch {
      // optional enrich
    }
  }
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
  // BE tự sinh dạng MBX-yyyyMMddHHmmss-###### khi POST; FE gợi ý cùng pattern để ops thấy trước.
  const now = new Date();
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  return `MBX-${stamp}-${suffix}`;
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
    status: "DRAFT",
  });
  let created = mapMasterBox(getAdminApiData(createResponse));

  const code = text(payload?.code);
  if (code && created.id) {
    try {
      const updateResponse = await axiosInstance.put(
        `/api/consolidation/${encodeURIComponent(created.id)}`,
        {
          masterCode: code,
          status: "DRAFT",
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
      status: toConsolidationApiStatus(box.status),
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
    throw new Error("Không thể để master box trống order. Hãy xóa lô gom nếu cần.");
  }

  const response = await axiosInstance.put(
    `/api/consolidation/${encodeURIComponent(boxId)}`,
    {
      masterCode: box.code || undefined,
      status: toConsolidationApiStatus(box.status),
      orderIds: nextOrderIds,
      shipmentId: box.shipmentId || undefined,
    }
  );
  return mapMasterBox(getAdminApiData(response));
}

/** Hủy/xóa lô gom — DELETE /api/consolidation/{id}. */
export function canDeleteMasterBox(box) {
  if (!box?.id) return false;
  if (box.shipmentId) return false;
  return box.status === "DRAFT" || box.status === "PACKED";
}

export async function deleteMasterBox(boxId) {
  if (!boxId) throw new Error("Thiếu id master box / consolidation.");
  const detail = await getMasterBoxDetail(boxId);
  const box = detail.box;
  if (!canDeleteMasterBox(box)) {
    if (box.shipmentId) {
      throw new Error("Master box đã gắn shipment — không thể xóa lô.");
    }
    throw new Error("Chỉ xóa được master box đang nháp hoặc đã gom (chưa xuất hàng).");
  }
  await axiosInstance.delete(`/api/consolidation/${encodeURIComponent(boxId)}`);
  return box;
}

export async function confirmMasterBoxPacking(boxId) {
  if (!boxId) throw new Error("Thiếu id master box.");
  const detail = await getMasterBoxDetail(boxId);
  const box = detail.box;
  if (box.status !== "DRAFT") {
    throw new Error("Chỉ xác nhận gom cho master box đang nháp.");
  }
  if (!detail.parcels.length && !box.orderIds.length) {
    throw new Error("Master box chưa có kiện hàng nào.");
  }

  const response = await axiosInstance.put(
    `/api/consolidation/${encodeURIComponent(boxId)}`,
    {
      masterCode: box.code || undefined,
      status: "CONSOLIDATED",
      orderIds: box.orderIds,
      shipmentId: box.shipmentId || undefined,
    }
  );
  return mapMasterBox(getAdminApiData(response));
}

/* ============================ WRO + Shipment ============================ */

/**
 * Pipeline BE (đã smoke-test):
 * POST WRO từ inventory AVAILABLE       (WRO → PENDING)
 * → PUT status = RELEASE_APPROVED       (staff duyệt trên tab "Duyệt xuất kho")
 * → POST picking-list
 * → PUT picking confirm  (WRO → PACKING)
 * → PUT shipping-route   (vẫn PACKING; gán sau RELEASED sẽ nhảy IN_TRANSIT)
 * → PUT complete         (WRO → RELEASED)
 * → POST /api/international-shipments
 *
 * Lưu ý: kiện đã gom consolidation (packed) thường RESERVED — BE từ chối tạo WRO.
 */
const WRO_CREATABLE_STATUSES = new Set(["AVAILABLE", "READY_FOR_CONSOLIDATION"]);

function mapWroRow(row) {
  const items = row?.items || row?.Items || [];
  const mappedItems = items.map((item) => ({
    inventoryId: text(item?.inventoryId || item?.InventoryId),
    parcelId: text(item?.parcelId || item?.ParcelId),
    parcelCode: text(
      item?.parcelCode ||
        item?.ParcelCode ||
        item?.packageCode ||
        item?.PackageCode
    ),
    productName: text(item?.productName || item?.ProductName),
    quantity: num(item?.quantity ?? item?.Quantity) ?? 1,
  }));
  const totalQuantity =
    num(row?.totalQuantity ?? row?.TotalQuantity) ??
    mappedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return {
    id: text(row?.wroId || row?.id || row?.WroId || row?.requestId),
    code: text(row?.wroCode || row?.WroCode || row?.code),
    status: upper(row?.status || row?.Status) || "RELEASE_PENDING",
    exportReason: text(row?.exportReason || row?.ExportReason),
    rejectionReason: text(row?.rejectionReason || row?.RejectionReason),
    shelfCode: text(row?.shelfCode || row?.ShelfCode),
    carrierId: text(row?.carrierId || row?.CarrierId),
    carrierName: text(row?.carrierName || row?.CarrierName),
    warehouseName: text(row?.warehouseName || row?.WarehouseName),
    customerName: text(row?.customerName || row?.CustomerName),
    createdByName: text(row?.createdByName || row?.CreatedByName),
    createdByUserRole: text(row?.createdByUserRole || row?.CreatedByUserRole),
    receiverName: text(row?.receiverName || row?.consigneeName || row?.ReceiverName),
    items: mappedItems,
    itemCount: mappedItems.length || totalQuantity || 0,
    totalQuantity,
    createdAt: row?.createdAt || row?.CreatedAt || null,
    raw: row,
  };
}

export async function listWroRequests({ status, search, pageIndex, pageSize } = {}) {
  const wantsApprovalOnly = upper(status) === "NEEDS_APPROVAL";
  const response = await axiosInstance.get("/api/warehouse-release-requests", {
    params: {
      // BE filter 1 status; "NEEDS_APPROVAL" = lấy all rồi lọc client-side
      Status: wantsApprovalOnly ? undefined : text(status) || undefined,
      SearchTerm: text(search) || undefined,
      PageIndex: pageIndex ?? 1,
      PageSize: pageSize ?? 50,
    },
  });
  let rows = getAdminApiList(response).map(mapWroRow);
  if (wantsApprovalOnly) {
    rows = rows.filter((row) => wroNeedsApproval(row.status));
  }
  return rows;
}

export async function getWroDetail(requestId) {
  if (!requestId) throw new Error("Thiếu id yêu cầu xuất kho.");
  const response = await axiosInstance.get(
    `/api/warehouse-release-requests/${encodeURIComponent(requestId)}`
  );
  return mapWroRow(getAdminApiData(response));
}

export async function approveWro(requestId) {
  const response = await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(requestId)}/status`,
    { status: "RELEASE_APPROVED" }
  );
  return mapWroRow(getAdminApiData(response) ?? { wroId: requestId, status: "RELEASE_APPROVED" });
}

export async function rejectWro(requestId, rejectionReason) {
  const reason = text(rejectionReason);
  if (!reason) throw new Error("Cần nhập lý do từ chối.");
  const response = await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(requestId)}/status`,
    { status: "REJECTED", rejectionReason: reason }
  );
  return mapWroRow(getAdminApiData(response) ?? { wroId: requestId, status: "REJECTED" });
}

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

  const response = await axiosInstance.get("/api/inventories");
  const inventoryRows = getAdminApiList(response).map((row) => mapInventoryRow(row));

  const matchesWanted = (row) =>
    (row.parcelCode && wantedCodes.has(upper(row.parcelCode))) ||
    (row.parcelId && wantedParcelIds.has(text(row.parcelId)));

  const found = inventoryRows.filter(matchesWanted);
  const matched = found.filter((row) =>
    WRO_CREATABLE_STATUSES.has(row.inventoryStatus || "AVAILABLE")
  );

  if (!matched.length) {
    if (found.length) {
      const sample = found
        .slice(0, 5)
        .map((row) => `${row.parcelCode || row.parcelId}=${row.inventoryStatus || "?"}`)
        .join(", ");
      throw new Error(
        `BE chỉ cho tạo WRO từ tồn AVAILABLE. Kiện trong master box đang: ${sample}. ` +
          "Hãy tạo WRO + shipment trước khi pack consolidation, hoặc hủy/mở lại box để trả kiện về AVAILABLE."
      );
    }
    throw new Error(
      "Không tìm thấy tồn kho khớp kiện trong master box trên /api/inventories."
    );
  }

  const matchedCodes = new Set(matched.map((row) => upper(row.parcelCode)).filter(Boolean));
  const matchedParcelIds = new Set(matched.map((row) => text(row.parcelId)).filter(Boolean));
  const missingCodes = [...wantedCodes].filter((code) => {
    if (matchedCodes.has(code)) return false;
    const row = found.find((item) => upper(item.parcelCode) === code);
    return !(row?.parcelId && matchedParcelIds.has(text(row.parcelId)));
  });
  if (missingCodes.length) {
    const blocked = found
      .filter((row) => !WRO_CREATABLE_STATUSES.has(row.inventoryStatus || ""))
      .map((row) => `${row.parcelCode}=${row.inventoryStatus}`)
      .slice(0, 5);
    throw new Error(
      `Thiếu tồn AVAILABLE cho kiện: ${missingCodes.slice(0, 5).join(", ")}` +
        (blocked.length ? ` (${blocked.join(", ")})` : "")
    );
  }

  const byId = new Map();
  for (const row of matched) {
    const key = text(row.inventoryId || row.id);
    if (key && !byId.has(key)) byId.set(key, row);
  }
  return { details, items: [...byId.values()] };
}

async function assignWroShippingRoute(wroId, payload) {
  const body = {
    carrierId: text(payload.carrierId) || undefined,
    shippingMethodId: text(payload.shippingMethodId) || undefined,
    shippingRoute: text(payload.shippingRoute) || undefined,
    estimatedDeliveryDays:
      payload.estimatedDeliveryDays != null && payload.estimatedDeliveryDays !== ""
        ? Number(payload.estimatedDeliveryDays)
        : undefined,
    note: text(payload.note) || undefined,
  };
  if (
    !body.carrierId &&
    !body.shippingMethodId &&
    !body.shippingRoute &&
    body.estimatedDeliveryDays == null &&
    !body.note
  ) {
    return;
  }
  await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/shipping-route`,
    body
  );
}

async function createWroOnly(payload, inventoryRows) {
  const createItems = inventoryRows.map((row) => ({
    inventoryId: row.inventoryId || row.id,
    quantity: Math.max(1, Number(row.quantity) || 1),
  }));

  const createResponse = await axiosInstance.post("/api/warehouse-release-requests", {
    shelfCode: payload.shelfCode || undefined,
    exportReason: text(payload.exportReason) || undefined,
    carrierId: text(payload.carrierId) || undefined,
    items: createItems,
  });
  const created = getAdminApiData(createResponse);
  const wroId = text(created?.wroId || created?.id || created?.WroId);
  if (!wroId) throw new Error("Tạo WRO thành công nhưng không nhận được wroId.");

  return {
    wroId,
    wroCode: text(created?.wroCode || created?.WroCode),
    status: upper(created?.status || created?.Status) || "RELEASE_PENDING",
    items: createItems,
  };
}

/**
 * WRO đã RELEASE_APPROVED → picking → confirm (PACKING) → gán tuyến → complete (RELEASED).
 */
export async function processApprovedWroToReleased(wroId, payload = {}) {
  const detail = await getWroDetail(wroId);

  const pickingResponse = await axiosInstance.post(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/picking-list`
  );
  const picking = getAdminApiData(pickingResponse);
  const pickingListId = text(
    picking?.pickingListId || picking?.id || picking?.PickingListId
  );
  if (!pickingListId) throw new Error("Tạo phiếu picking thành công nhưng thiếu pickingListId.");

  // Dùng inventoryId từ response picking/WRO (BE có thể đổi id so với request)
  const pickingItems = (picking?.items || detail.raw?.items || [])
    .map((item) => ({
      inventoryId: text(item.inventoryId || item.InventoryId),
      quantity: Math.max(1, Number(item.quantity ?? item.Quantity) || 1),
    }))
    .filter((item) => item.inventoryId);

  if (!pickingItems.length) {
    throw new Error("Phiếu picking không có item để xác nhận.");
  }

  // Confirm → WRO = PACKING
  await axiosInstance.put(
    `/api/picking-lists/${encodeURIComponent(pickingListId)}/confirm`,
    { items: pickingItems }
  );

  // Gán tuyến khi đang PACKING (gán sau RELEASED sẽ đẩy sang IN_TRANSIT)
  await assignWroShippingRoute(wroId, payload);

  // Complete từ PACKING → RELEASED (không gọi /packing trước)
  await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/complete`,
    { items: pickingItems }
  );

  return { wroId, items: pickingItems };
}

/**
 * Tạo shipment quốc tế.
 * - Có `wroRequestIds` (đã RELEASED) → gọi thẳng /api/international-shipments
 * - Có `masterBoxIds` → chỉ tạo WRO ở trạng thái PENDING; ops duyệt ở tab "Duyệt xuất kho"
 *   rồi mới chạy picking → RELEASED → shipment.
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

    const { items } = await resolveAvailableInventoryForBoxes(masterBoxIds);
    const wro = await createWroOnly(payload, items);

    return {
      id: wro.wroId,
      code: wro.wroCode || wro.wroId,
      pendingWro: true,
      wroId: wro.wroId,
      wroCode: wro.wroCode,
      wroRequestIds: [wro.wroId],
      masterBoxIds,
      status: upper(created?.status || created?.Status) || "RELEASE_PENDING",
      raw: null,
    };
  }

  // WRO có sẵn: gán tuyến chỉ khi chưa RELEASED/IN_TRANSIT — best-effort, không chặn shipment
  await Promise.allSettled(
    wroRequestIds.map((wroId) => assignWroShippingRoute(wroId, payload))
  );

  if (!originWarehouseId) throw new Error("Cần chọn kho xuất.");
  if (!destinationWarehouseId) throw new Error("Cần chọn kho đích.");

  // CreateInternationalShipmentDto.shippingMethod = hình thức (AIR/SEA/ROAD/RAIL), không phải catalog methodId
  const shippingMethod = upper(
    payload.shippingMethod || payload.transportMode || ""
  );

  const response = await axiosInstance.post("/api/international-shipments", {
    wroRequestIds,
    originWarehouseId,
    destinationWarehouseId,
    carrierId: text(payload.carrierId) || undefined,
    shippingMethod: shippingMethod || undefined,
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
          status: "SHIPPED",
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
    shippingMethod,
    shippingMethodId: text(payload.shippingMethodId),
    shippingRoute: text(payload.shippingRoute),
    masterBoxIds,
    wroRequestIds,
    status: text(shipment?.status || "CREATED"),
    raw: shipment,
  };
}

/**
 * WRO đã duyệt (RELEASE_APPROVED) → hoàn tất xuất kho (RELEASED) → tạo shipment quốc tế.
 */
export async function createShipmentFromApprovedWro(wroId, payload) {
  if (!wroId) throw new Error("Thiếu id yêu cầu xuất kho.");
  await processApprovedWroToReleased(wroId, payload);
  return createShipment({ ...payload, wroRequestIds: [wroId] });
}
