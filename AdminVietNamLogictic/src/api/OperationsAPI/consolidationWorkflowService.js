/**
 * Workflow "Gom hàng theo tồn kho" — wire vào BE thật.
 *
 * Mapping:
 * - Tồn kho      → GET /api/inventories
 * - Master box    → /api/consolidation (masterCode ≈ mã master box; gom theo orderIds)
 * - Lookups       → /api/warehouses|carriers|shipping-methods/active|shipping-routes
 * - Chi tiết kiện → GET /api/parcels/{parcelId}
 * - Shipment QT   → WRO: AVAILABLE → RELEASE_APPROVED → picking → route@PACKING → complete(RELEASED) → POST /api/international-shipments
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
  CREATED: { label: "Mới tạo", tone: "warning", tab: "PREPARING" },
  LOT_CREATED: { label: "Lô mới tạo", tone: "warning", tab: "PREPARING" },
  PREPARING: { label: "Đang chuẩn bị", tone: "warning", tab: "PREPARING" },
  MANIFESTED: { label: "Đã manifest", tone: "processing", tab: "PREPARING" },
  CUSTOMS_EXPORT_PENDING: {
    label: "Chờ thông quan xuất",
    tone: "warning",
    tab: "CUSTOMS",
  },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "processing", tab: "IN_TRANSIT" },
  CUSTOMS_IMPORT_PENDING: {
    label: "Chờ thông quan nhập",
    tone: "warning",
    tab: "CUSTOMS",
  },
  ARRIVED: { label: "Đã đến kho đích", tone: "success", tab: "ARRIVED" },
  ARRIVED_DESTINATION: { label: "Đã đến kho đích", tone: "success", tab: "ARRIVED" },
  ARRIVED_IN_VN: { label: "Đã đến kho VN", tone: "success", tab: "ARRIVED" },
  CUSTOMS_REJECTED: { label: "Hải quan từ chối", tone: "error", tab: "ISSUE" },
  HOLD: { label: "Tạm giữ", tone: "error", tab: "ISSUE" },
  ISSUE: { label: "Sự cố", tone: "error", tab: "ISSUE" },
  CANCELLED: { label: "Đã hủy", tone: "error", tab: "ISSUE" },
};

/** 5 tab màn Vận chuyển — khớp BE statusTab. */
export const SHIPMENT_STATUS_TABS = [
  { key: "PREPARING", label: "Đang chuẩn bị" },
  { key: "IN_TRANSIT", label: "Đang đi" },
  { key: "CUSTOMS", label: "Thông quan" },
  { key: "ARRIVED", label: "Đã đến" },
  { key: "ISSUE", label: "Sự cố" },
];

/** targetStatus → các status hiện tại được phép chuyển tới (mirror BE). */
const SHIPMENT_ALLOWED_FROM = {
  MANIFESTED: ["CREATED"],
  CUSTOMS_EXPORT_PENDING: ["MANIFESTED", "CUSTOMS_REJECTED", "HOLD"],
  IN_TRANSIT: ["CUSTOMS_EXPORT_PENDING", "MANIFESTED", "HOLD"],
  CUSTOMS_IMPORT_PENDING: ["IN_TRANSIT", "CUSTOMS_REJECTED", "HOLD"],
  ARRIVED_DESTINATION: ["CUSTOMS_IMPORT_PENDING", "IN_TRANSIT"],
  CUSTOMS_REJECTED: ["CUSTOMS_EXPORT_PENDING", "CUSTOMS_IMPORT_PENDING"],
  HOLD: [
    "CREATED",
    "MANIFESTED",
    "CUSTOMS_EXPORT_PENDING",
    "IN_TRANSIT",
    "CUSTOMS_IMPORT_PENDING",
    "CUSTOMS_REJECTED",
  ],
  ISSUE: [
    "CREATED",
    "MANIFESTED",
    "CUSTOMS_EXPORT_PENDING",
    "IN_TRANSIT",
    "CUSTOMS_IMPORT_PENDING",
    "CUSTOMS_REJECTED",
    "HOLD",
  ],
};

export function mapShipmentStatusToTab(status) {
  const key = upper(status);
  return SHIPMENT_STATUS_META[key]?.tab || "PREPARING";
}

export function getNextShipmentStatuses(currentStatus) {
  const current = upper(currentStatus);
  return Object.entries(SHIPMENT_ALLOWED_FROM)
    .filter(([, from]) => from.some((item) => upper(item) === current))
    .map(([target]) => target);
}

export const WRO_STATUS_META = {
  RELEASE_PENDING: { label: "Chờ duyệt", tone: "warning" },
  RELEASE_APPROVED: { label: "Đã duyệt", tone: "processing" },
  RELEASE_REJECTED: { label: "Từ chối", tone: "error" },
  PICKING: { label: "Đang lấy hàng", tone: "processing" },
  PICKED: { label: "Đã lấy hàng", tone: "processing" },
  PACKING: { label: "Đang đóng gói", tone: "processing" },
  PACKED: { label: "Đã đóng gói", tone: "processing" },
  RELEASED: { label: "Đã xuất kho", tone: "success" },
  HANDED_OVER: { label: "Đã bàn giao", tone: "success" },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "processing" },
  ARRIVED_IN_VN: { label: "Đã về VN (Thông quan)", tone: "purple" },
  COMPLETED: { label: "Hoàn thành", tone: "success" },
  DELIVERED: { label: "Đã giao hàng", tone: "success" },
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
    contactPerson: text(row?.contactPerson || row?.ContactPerson),
    contactPhone: text(row?.contactPhone || row?.ContactPhone),
    raw: row,
  };
}

function mapShippingMethod(row) {
  const mapped = {
    id: text(row?.id || row?.shippingMethodId),
    code: text(row?.methodCode || row?.code),
    name: text(row?.methodName || row?.name),
    estimatedTransitTime: text(row?.estimatedTransitTime || row?.EstimatedTransitTime),
    description: text(row?.description || row?.Description),
    raw: row,
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

function mapShipment(row) {
  const status = upper(row?.status || row?.Status);
  const id = text(row?.shipmentId || row?.id || row?.ShipmentId);
  return {
    id,
    code: text(row?.shipmentCode || row?.ShipmentCode || id),
    status,
    statusTab: text(row?.statusTab || row?.StatusTab) || mapShipmentStatusToTab(status),
    originWarehouseId: text(row?.originWarehouseId || row?.OriginWarehouseId),
    originWarehouseName: text(row?.originWarehouseName || row?.OriginWarehouseName),
    destinationWarehouseId: text(
      row?.destinationWarehouseId || row?.DestinationWarehouseId
    ),
    destinationWarehouseName: text(
      row?.destinationWarehouseName || row?.DestinationWarehouseName
    ),
    carrierId: text(row?.carrierId || row?.CarrierId) || null,
    carrierName: text(row?.carrierName || row?.CarrierName),
    shippingMethod: text(row?.shippingMethod || row?.ShippingMethod),
    shippingRouteId: text(row?.shippingRouteId || row?.ShippingRouteId) || null,
    shippingRouteName: text(row?.shippingRouteName || row?.ShippingRouteName),
    totalPackages: num(row?.totalPackages ?? row?.TotalPackages) ?? 0,
    totalWeight: num(row?.totalWeight ?? row?.TotalWeight) ?? 0,
    shippedAt: row?.shippedAt || row?.ShippedAt || null,
    deliveredAt: row?.deliveredAt || row?.DeliveredAt || null,
    pdfUrls: Array.isArray(row?.pdfUrls)
      ? row.pdfUrls.filter(Boolean)
      : Array.isArray(row?.PdfUrls)
        ? row.PdfUrls.filter(Boolean)
        : [],
    exportImageUrls: Array.isArray(row?.exportImageUrls)
      ? row.exportImageUrls.filter(Boolean)
      : Array.isArray(row?.ExportImageUrls)
        ? row.ExportImageUrls.filter(Boolean)
        : [],
    customsDocUrls: Array.isArray(row?.customsDocUrls)
      ? row.customsDocUrls.filter(Boolean)
      : Array.isArray(row?.CustomsDocUrls)
        ? row.CustomsDocUrls.filter(Boolean)
        : [],
    wroRequests: (row?.wroRequests || row?.WroRequests || []).map((item) => ({
      wroRequestId: text(item?.wroRequestId || item?.WroRequestId),
      wroCode: text(item?.wroCode || item?.WroCode),
    })),
    parcels: (row?.parcels || row?.Parcels || []).map((item) => ({
      parcelId: text(item?.parcelId || item?.ParcelId),
      packageCode: text(item?.packageCode || item?.PackageCode),
      weight: num(item?.weight ?? item?.Weight),
      // Đơn và khách của kiện: màn chênh lệch kiểm đếm cần biết kiện lệch là của ai để
      // OM gọi báo khách, khỏi phải tra ngược từng mã kiện.
      orderId: text(item?.orderId || item?.OrderId),
      orderCode: text(item?.orderCode || item?.OrderCode),
      customerName: text(item?.customerName || item?.CustomerName),
    })),
    raw: row,
  };
}

/** GET /api/international-shipments — có statusTab (5 tab). */
export async function listShipments(filters = {}) {
  const params = {
    pageNumber: filters.pageNumber ?? 1,
    pageSize: filters.pageSize ?? 50,
  };
  if (filters.statusTab) params.statusTab = filters.statusTab;
  if (filters.status) params.status = filters.status;
  if (filters.originWarehouseId) params.originWarehouseId = filters.originWarehouseId;
  if (filters.search) params.search = filters.search;

  try {
    const response = await axiosInstance.get("/api/international-shipments", { params });
    const data = getAdminApiData(response);
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.Items)
        ? data.Items
        : Array.isArray(data)
          ? data
          : getAdminApiList(response);
    return {
      items: items.map(mapShipment).filter((row) => row.id),
      totalCount: num(data?.totalCount ?? data?.TotalCount) ?? items.length,
      pageNumber: num(data?.pageNumber ?? data?.PageNumber) ?? params.pageNumber,
      pageSize: num(data?.pageSize ?? data?.PageSize) ?? params.pageSize,
    };
  } catch {
    // Fallback cũ: suy từ consolidation nếu API list chưa deploy.
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
        status: "CREATED",
        statusTab: "PREPARING",
        pdfUrls: [],
        exportImageUrls: [],
        customsDocUrls: [],
        wroRequests: [],
        parcels: [],
        totalPackages: 0,
        totalWeight: 0,
      });
    }
    let items = [...map.values()];
    if (filters.statusTab) {
      items = items.filter((row) => row.statusTab === filters.statusTab);
    }
    return { items, totalCount: items.length, pageNumber: 1, pageSize: items.length };
  }
}

export async function getShipmentDetail(shipmentId) {
  if (!shipmentId) throw new Error("Thiếu id lô vận chuyển.");
  const response = await axiosInstance.get(
    `/api/international-shipments/${encodeURIComponent(shipmentId)}`
  );
  return mapShipment(getAdminApiData(response));
}

export async function updateShipmentStatus(shipmentId, status, note = "") {
  if (!shipmentId) throw new Error("Thiếu id lô vận chuyển.");
  if (!status) throw new Error("Thiếu trạng thái mới.");
  const response = await axiosInstance.put(
    `/api/international-shipments/${encodeURIComponent(shipmentId)}/status`,
    { status: upper(status), note: text(note) || undefined }
  );
  return getAdminApiData(response);
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
 * Tạo lô quốc tế từ WRO đã RELEASED (BE bắt buộc).
 * Op duyệt WRO riêng; kho picking/đóng gói/complete → RELEASED rồi mới gom lô.
 */
export async function createShipment(payload) {
  const wroRequestIds = [...new Set(payload?.wroRequestIds ?? [])].filter(Boolean);
  if (!wroRequestIds.length) {
    throw new Error(
      "Cần chọn ít nhất một phiếu WRO ở trạng thái RELEASED để gom lô."
    );
  }

  const originWarehouseId = text(payload?.originWarehouseId);
  const destinationWarehouseId = text(payload?.destinationWarehouseId);
  if (!originWarehouseId) throw new Error("Cần chọn kho xuất.");
  if (!destinationWarehouseId) throw new Error("Cần chọn kho đích.");

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
  const shipment = mapShipment(getAdminApiData(response));

  const masterBoxIds = [...new Set(payload?.masterBoxIds ?? [])].filter(Boolean);
  if (shipment.id && masterBoxIds.length) {
    await Promise.allSettled(
      masterBoxIds.map(async (boxId) => {
        const detail = await getMasterBoxDetail(boxId);
        await axiosInstance.put(`/api/consolidation/${encodeURIComponent(boxId)}`, {
          masterCode: detail.box.code || undefined,
          status: detail.box.rawStatus || "shipped",
          orderIds: detail.box.orderIds,
          shipmentId: shipment.id,
        });
      })
    );
  }

  return {
    ...shipment,
    shippingMethod,
    shippingMethodId: text(payload.shippingMethodId),
    shippingRoute: text(payload.shippingRoute),
    masterBoxIds,
    wroRequestIds,
  };
}

function mapWro(row) {
  const id = text(row?.wroId || row?.WroId || row?.id || row?.requestId);
  const status = upper(row?.status || row?.Status);
  return {
    id,
    wroId: id,
    code: text(row?.wroCode || row?.WroCode || id),
    wroCode: text(row?.wroCode || row?.WroCode || id),
    exportType: upper(row?.exportType || row?.ExportType || "SINGLE"),
    exportBarcode: text(row?.exportBarcode || row?.ExportBarcode),
    status,
    createdByName: text(row?.createdByName || row?.CreatedByName),
    createdByUserRole: text(row?.createdByUserRole || row?.CreatedByUserRole),
    warehouseName: text(row?.warehouseName || row?.WarehouseName),
    warehouseAddress: text(row?.warehouseAddress || row?.WarehouseAddress),
    warehouseContactPhone: text(row?.warehouseContactPhone || row?.WarehouseContactPhone),
    customerId: text(row?.customerId || row?.CustomerId),
    customerName: text(row?.customerName || row?.CustomerName),
    orderId: text(row?.orderId || row?.OrderId),
    orderCode: text(row?.orderCode || row?.OrderCode),
    receiverName: text(row?.receiverName || row?.ReceiverName || row?.consigneeName),
    receiverPhone: text(row?.receiverPhone || row?.ReceiverPhone || row?.consigneePhone),
    deliveryAddress: text(
      row?.deliveryAddress ||
        row?.DeliveryAddress ||
        row?.receiverAddress ||
        row?.ReceiverAddress ||
        row?.consigneeAddress
    ),
    receiverAddress: text(row?.receiverAddress || row?.ReceiverAddress),
    consigneeName: text(row?.consigneeName || row?.ConsigneeName),
    consigneePhone: text(row?.consigneePhone || row?.ConsigneePhone),
    consigneeAddress: text(row?.consigneeAddress || row?.ConsigneeAddress),
    shelfCode: text(row?.shelfCode || row?.ShelfCode),
    exportReason: text(row?.exportReason || row?.ExportReason),
    carrierId: text(row?.carrierId || row?.CarrierId) || null,
    carrierName: text(row?.carrierName || row?.CarrierName),
    shippingRouteId: text(row?.shippingRouteId || row?.ShippingRouteId) || null,
    shippingRoute: text(row?.shippingRoute || row?.ShippingRoute),
    driverName: text(row?.driverName || row?.DriverName),
    driverPhone: text(row?.driverPhone || row?.DriverPhone),
    vehicleNumber: text(row?.vehicleNumber || row?.VehicleNumber),
    trackingNumber: text(row?.trackingNumber || row?.TrackingNumber),
    customsStatus: text(row?.customsStatus || row?.CustomsStatus),
    customsStatusText: text(row?.customsStatusText || row?.CustomsStatusText),
    customsDocumentUrls: Array.isArray(row?.customsDocumentUrls)
      ? row.customsDocumentUrls.filter(Boolean)
      : Array.isArray(row?.CustomsDocumentUrls)
        ? row.CustomsDocumentUrls.filter(Boolean)
        : [],
    totalQuantity: num(row?.totalQuantity ?? row?.TotalQuantity) ?? 0,
    createdAt: row?.createdAt || row?.CreatedAt || null,
    items: (row?.items || row?.Items || []).map((item) => ({
      itemId: text(item?.itemId || item?.ItemId),
      inventoryId: text(item?.inventoryId || item?.InventoryId),
      quantity: num(item?.quantity ?? item?.Quantity) ?? 1,
      orderId: text(item?.orderId || item?.OrderId),
      orderCode: text(item?.orderCode || item?.OrderCode),
      consignmentType: text(item?.consignmentType || item?.ConsignmentType),
      packageCode: text(item?.packageCode || item?.PackageCode),
      productName: text(item?.productName || item?.ProductName),
      zoneName: text(item?.zoneName || item?.ZoneName),
      binCode: text(item?.binCode || item?.BinCode),
      shelfCode: text(item?.shelfCode || item?.ShelfCode),
      actualWeight: num(item?.actualWeight ?? item?.ActualWeight),
      length: num(item?.length ?? item?.Length),
      width: num(item?.width ?? item?.Width),
      height: num(item?.height ?? item?.Height),
    })),
    raw: row,
  };
}

export async function listWroRequests(filters = {}) {
  const params = {
    pageIndex: filters.pageIndex ?? 1,
    pageSize: filters.pageSize ?? 50,
  };
  if (filters.status) params.status = filters.status;
  if (filters.searchTerm || filters.search) {
    params.searchTerm = filters.searchTerm || filters.search;
  }

  const response = await axiosInstance.get("/api/warehouse-release-requests", {
    params,
  });
  const data = getAdminApiData(response);
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.Items)
      ? data.Items
      : getAdminApiList(response);

  return {
    items: items.map(mapWro).filter((row) => row.id),
    totalCount: num(data?.totalCount ?? data?.TotalCount) ?? items.length,
    pageIndex: num(data?.pageIndex ?? data?.PageIndex) ?? params.pageIndex,
    pageSize: num(data?.pageSize ?? data?.PageSize) ?? params.pageSize,
  };
}

export async function getWroDetail(wroId) {
  if (!wroId) throw new Error("Thiếu id phiếu WRO.");
  const response = await axiosInstance.get(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}`
  );
  return mapWro(getAdminApiData(response));
}

/**
 * Duyệt WRO — OM nhập mã chuyến bay + giấy tờ thông quan (BE bắt buộc).
 * @param {string} wroId
 * @param {{ vehicleNumber: string, customsDocumentUrls: string[], trackingNumber?: string, note?: string }} payload
 */
export async function approveWro(wroId, payload = {}) {
  if (!wroId) throw new Error("Thiếu id phiếu WRO.");
  const vehicleNumber = text(payload.vehicleNumber || payload.flightNumber);
  const customsDocumentUrls = [
    ...new Set(
      (payload.customsDocumentUrls || []).map((url) => text(url)).filter(Boolean)
    ),
  ];

  const body = {
    status: "RELEASE_APPROVED",
    vehicleNumber: vehicleNumber || undefined,
    trackingNumber: text(payload.trackingNumber) || undefined,
    customsDocumentUrls: customsDocumentUrls.length ? customsDocumentUrls : undefined,
    note: text(payload.note) || undefined,
  };

  const response = await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/status`,
    body
  );
  return getAdminApiData(response);
}

export async function rejectWro(wroId, rejectionReason = "") {
  if (!wroId) throw new Error("Thiếu id phiếu WRO.");
  const response = await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/status`,
    {
      status: "RELEASE_REJECTED",
      rejectionReason: text(rejectionReason) || undefined,
    }
  );
  return getAdminApiData(response);
}

export async function updateWroStatus(wroId, status, rejectionReason = "") {
  if (!wroId) throw new Error("Thiếu id phiếu WRO.");
  if (!status) throw new Error("Thiếu trạng thái mới.");
  const response = await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/status`,
    {
      status: text(status),
      rejectionReason: rejectionReason ? text(rejectionReason) : undefined,
    }
  );
  return getAdminApiData(response);
}

/** Tạo WRO ở RELEASE_PENDING — không auto duyệt / picking. */
export async function createWroRequest(payload) {
  const items = (payload?.items ?? [])
    .map((item) => ({
      inventoryId: text(item.inventoryId || item.id),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }))
    .filter((item) => item.inventoryId);
  if (!items.length) throw new Error("Cần chọn ít nhất một tồn kho để tạo WRO.");

  const response = await axiosInstance.post("/api/warehouse-release-requests", {
    shelfCode: text(payload?.shelfCode) || undefined,
    exportReason: text(payload?.exportReason) || undefined,
    carrierId: text(payload?.carrierId) || undefined,
    customsDocumentUrls: Array.isArray(payload?.customsDocumentUrls)
      ? payload.customsDocumentUrls.filter(Boolean)
      : undefined,
    receiverName: text(payload?.receiverName) || undefined,
    receiverPhone: text(payload?.receiverPhone) || undefined,
    receiverAddress: text(payload?.receiverAddress) || undefined,
    items,
  });
  return mapWro(getAdminApiData(response));
}

/**
 * Gửi thông báo cho khách hàng về phiếu xuất kho WRO.
 * API: POST /api/warehouse-release-requests/{wroId}/notify-customer
 * @param {string} wroId
 * @param {Object} [payload={}]
 */
export async function notifyWroCustomer(wroId, payload = {}) {
  if (!wroId) throw new Error("Thiếu id phiếu WRO.");
  const response = await axiosInstance.post(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/notify-customer`,
    payload
  );
  return getAdminApiData(response);
}

export async function notifyCustomerWro(wroId, payload = {}) {
  return notifyWroCustomer(wroId, payload);
}

/* ===== merged from upstream (operator-flow) ===== */

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

export function toConsolidationApiStatus(uiOrRawStatus) {
  const mapped = mapConsolidationStatus(uiOrRawStatus);
  if (mapped === "PACKED") return "CONSOLIDATED";
  if (mapped === "SHIPPED") return "SHIPPED";
  if (mapped === "CANCELLED") return "CANCELLED";
  return "DRAFT";
}

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

export async function updateWroShippingRoute(wroId, payload = {}) {
  if (!wroId) throw new Error("Thiếu id phiếu WRO.");
  const body = {
    carrierId: text(payload.carrierId) || undefined,
    shippingMethodId: text(payload.shippingMethodId) || undefined,
    shippingRouteId: text(payload.shippingRouteId) || undefined,
    shippingRoute: text(payload.shippingRoute) || undefined,
    estimatedDeliveryDays:
      payload.estimatedDeliveryDays != null && payload.estimatedDeliveryDays !== ""
        ? Number(payload.estimatedDeliveryDays)
        : undefined,
    driverName: text(payload.driverName) || undefined,
    driverPhone: text(payload.driverPhone) || undefined,
    vehicleNumber: text(payload.vehicleNumber) || undefined,
    trackingNumber: text(payload.trackingNumber) || undefined,
    handoverNotes: text(payload.handoverNotes) || undefined,
    customsDocumentUrls: Array.isArray(payload.customsDocumentUrls)
      ? payload.customsDocumentUrls.map((url) => text(url)).filter(Boolean)
      : undefined,
    note: text(payload.note) || undefined,
  };

  const response = await axiosInstance.put(
    `/api/warehouse-release-requests/${encodeURIComponent(wroId)}/shipping-route`,
    body
  );
  return getAdminApiData(response);
}

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

export async function createShipmentFromApprovedWro(wroId, payload) {
  if (!wroId) throw new Error("Thiếu id yêu cầu xuất kho.");
  await processApprovedWroToReleased(wroId, payload);
  return createShipment({ ...payload, wroRequestIds: [wroId] });
}

export async function uploadOperationsFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosInstance.post("/api/uploads/image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return getAdminApiData(response);
}
