/*
 * Tồn kho — ĐÃ NỐI API THẬT (api-kho-xep-ke-theo-khu.md mục G).
 *
 *   GET /api/inventories?warehouseId=&customerId=&status=&regionCode=
 *       → { message, items: [ { inventoryId, customerName, consignmentCode, packageCode, binCode,
 *            warehouseName, status, storedAt, actualWeight, storageDays, ... } ] }
 *
 * `status`: AVAILABLE (trên kệ) · RESERVED (giữ cho phiếu xuất) · PICKED (đã bốc sang khu xuất)
 * · RELEASED (đã xuất khỏi kho). Màn tồn kho mặc định bỏ RELEASED.
 * Không truyền regionCode: backend tự lấy vùng trong token nếu tài khoản có vùng.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData, removeEmptyParams } from "@shared/api/apiEnvelope";
import { getAdminApiError } from "@features/admin/api/adminService";

export { getAdminApiError as getInventoryApiError };

export const INVENTORY_STATUS_META = Object.freeze({
  AVAILABLE: { label: "Trên kệ, khả dụng", color: "success" },
  RESERVED: { label: "Giữ cho phiếu xuất", color: "gold" },
  PICKED: { label: "Đã bốc sang khu xuất", color: "processing" },
  RELEASED: { label: "Đã xuất khỏi kho", color: "default" },
});

export const getInventoryStatusMeta = (status) =>
  INVENTORY_STATUS_META[String(status || "").toUpperCase()] || { label: status || "—", color: "default" };

/** Danh sách tồn — MẢNG TRẦN. */
export const listInventories = async ({ warehouseId = "", status = "" } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.inventories, {
    params: removeEmptyParams({ warehouseId, status }),
  });
  return getArrayItems(getResponseData(response));
};

export default { listInventories, getInventoryStatusMeta };
