/*
 * Khu kho + kiện nằm sai khu — ĐÃ NỐI API THẬT (api-kho-xep-ke-theo-khu.md mục A1, A2, D).
 *
 *   GET /api/warehouses/{warehouseId}/zones              → { message, data: Zone[] }
 *   PUT /api/warehouse-zones/{zoneId}                    { zoneType, status, zoneName, zoneCode }
 *   GET /api/warehouses/{warehouseId}/misplaced-parcels  → { message, data: MisplacedParcel[] }
 *
 * Luật chính: hàng lưu kho chỉ được nằm ở ô thuộc khu STORAGE đang dùng. Khu lưu kho đang
 * chứa hàng không đổi loại / không ngừng dùng được — backend trả 400 kèm số kiện, FE hiện nguyên.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getZoneApiError };

export const ZONE_TYPE_OPTIONS = Object.freeze([
  { value: "RECEIVING", label: "Khu nhận", color: "blue" },
  { value: "QUARANTINE", label: "Khu cách ly", color: "red" },
  { value: "STORAGE", label: "Khu lưu kho", color: "green" },
  { value: "OUTBOUND", label: "Khu xuất", color: "purple" },
]);

export const getZoneTypeMeta = (zoneType) =>
  ZONE_TYPE_OPTIONS.find((item) => item.value === String(zoneType || "").toUpperCase()) || {
    value: "",
    label: "Chưa phân loại",
    color: "default",
  };

const trimText = (value) => String(value ?? "").trim();

const requireId = (value, message) => {
  const id = trimText(value);
  if (!id) throw new Error(message);
  return id;
};

/** Danh sách khu của kho (xếp nhận → cách ly → lưu kho → xuất) — MẢNG TRẦN. */
export const listWarehouseZones = async (warehouseId) => {
  const response = await httpClient.get(
    API_ENDPOINTS.warehouseZones.list(requireId(warehouseId, "Chưa chọn kho.")),
  );
  return getArrayItems(getResponseData(response));
};

/** Khai loại khu / đổi tên, mã / bật-tắt khu. `zoneType` bắt buộc. */
export const updateWarehouseZone = async (zoneId, { zoneType, status, zoneName, zoneCode } = {}) => {
  const type = trimText(zoneType).toUpperCase();
  if (!ZONE_TYPE_OPTIONS.some((item) => item.value === type)) {
    throw new Error("Chọn loại khu: nhận, cách ly, lưu kho hoặc xuất.");
  }

  const response = await httpClient.put(
    API_ENDPOINTS.warehouseZones.update(requireId(zoneId, "Thiếu mã khu.")),
    {
      zoneType: type,
      ...(trimText(status) ? { status: trimText(status).toUpperCase() } : {}),
      ...(trimText(zoneName) ? { zoneName: trimText(zoneName) } : {}),
      ...(trimText(zoneCode) ? { zoneCode: trimText(zoneCode) } : {}),
    },
  );
  return getResponseData(response);
};

/** Kiện đang nằm sai khu (khu nhận/xuất/cách ly, khu chưa phân loại, khu/ô ngừng dùng). */
export const listMisplacedParcels = async (warehouseId) => {
  const response = await httpClient.get(
    API_ENDPOINTS.warehouseZones.misplacedParcels(requireId(warehouseId, "Chưa chọn kho.")),
  );
  return getArrayItems(getResponseData(response));
};

export default { listWarehouseZones, updateWarehouseZone, listMisplacedParcels, getZoneTypeMeta };
