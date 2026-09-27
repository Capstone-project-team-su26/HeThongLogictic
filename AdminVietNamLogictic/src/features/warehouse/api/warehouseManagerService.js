/*
 * Quản lý kho được gán — ĐÃ NỐI API THẬT (đợt 3, api-ky-gui-1.md bước 7).
 *
 *   GET /api/warehouses/{warehouseId}/manager
 *       → { data: { warehouseId, warehouseName, managerId, managerName, history[] } }
 *       history[]: { managerId, managerName, previousManagerId, previousManagerName,
 *                    changedByName, reason, changedAt }
 *   PUT /api/warehouses/{warehouseId}/manager   (Admin)
 *       { managerId: guid | null, reason }  — bắt buộc lý do; null = bỏ gán
 *       (kho chưa có quản lý thì OperationsManager / Admin duyệt phiếu).
 *   GET /api/User  → MẢNG TRẦN tài khoản { id, fullName, email, phone, role, status, region }
 *
 * Backend chỉ nhận người có vai trò quản lý kho (OperationsManager) đang hoạt động.
 * Phiếu đang chờ duyệt tự chuyển quyền duyệt sang quản lý mới.
 *
 *   GET /api/warehouses/{warehouseId}/staff   (Admin, OperationsManager, Sale — CHỈ ĐỌC)
 *       → { data: { warehouseId, warehouseCode, warehouseName, region,
 *                   staff: [{ userId, fullName, email, role, region, status,
 *                             assignedAt, assignedByName, note }] } }
 *       Nhân viên kho được Admin gán vào kho (gán ở màn Quản lý người dùng). Kho chưa gán
 *       ai thì nhân viên kho CÙNG VÙNG vẫn thao tác được như cũ.
 */

import httpClient from "@shared/api/httpClient";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";

const MANAGER_ROLES = new Set(["OPERATIONSMANAGER", "OPERATIONS", "MANAGER", "WAREHOUSEMANAGER"]);

const normalizeRole = (role) =>
  String(role ?? "")
    .replace(/[\s_-]/g, "")
    .toUpperCase();

const requireId = (value, message) => {
  const id = String(value ?? "").trim();
  if (!id) throw new Error(message);
  return id;
};

/** Quản lý hiện tại + lịch sử đổi quản lý của một kho. */
export const getWarehouseManager = async (warehouseId, options = {}) => {
  const id = requireId(warehouseId, "Thiếu mã kho.");
  const response = await httpClient.get(
    `/api/warehouses/${encodeURIComponent(id)}/manager`,
    { signal: options?.signal },
  );

  const data = getResponseData(response) || {};

  return {
    warehouseId: data.warehouseId ?? id,
    warehouseName: data.warehouseName ?? "",
    managerId: data.managerId ?? null,
    managerName: data.managerName ?? "",
    history: Array.isArray(data.history) ? data.history : [],
  };
};

/**
 * Gán / đổi / bỏ quản lý kho.
 *
 * @param {string} warehouseId
 * @param {{ managerId: string|null, reason: string }} payload
 */
export const assignWarehouseManager = async (warehouseId, { managerId = null, reason } = {}) => {
  const id = requireId(warehouseId, "Thiếu mã kho.");
  const cleanReason = String(reason ?? "").trim();
  if (!cleanReason) throw new Error("Đổi quản lý kho phải ghi lý do.");

  const response = await httpClient.put(`/api/warehouses/${encodeURIComponent(id)}/manager`, {
    managerId: managerId ? String(managerId).trim() : null,
    reason: cleanReason,
  });

  return getResponseData(response);
};

/** Tài khoản gán làm quản lý kho được: vai trò quản lý kho và đang hoạt động. */
export const getWarehouseManagerCandidates = async (options = {}) => {
  const response = await httpClient.get("/api/User", { signal: options?.signal });

  return getArrayItems(getResponseData(response))
    .filter((user) => MANAGER_ROLES.has(normalizeRole(user?.role)))
    .filter((user) => String(user?.status ?? "").trim().toUpperCase() === "ACTIVE")
    .sort((left, right) =>
      String(left?.fullName ?? "").localeCompare(String(right?.fullName ?? ""), "vi"),
    );
};

/** Nhân viên kho được gán vào một kho (chỉ đọc). */
export const getWarehouseStaff = async (warehouseId, options = {}) => {
  const id = requireId(warehouseId, "Thiếu mã kho.");
  const response = await httpClient.get(
    `/api/warehouses/${encodeURIComponent(id)}/staff`,
    { signal: options?.signal },
  );

  const data = getResponseData(response) || {};
  const staff = Array.isArray(data.staff) ? data.staff : [];

  return {
    warehouseId: data.warehouseId ?? id,
    warehouseCode: data.warehouseCode ?? "",
    warehouseName: data.warehouseName ?? "",
    region: data.region ?? "",
    staff: staff
      .filter((member) => member && member.userId)
      .map((member) => ({
        userId: member.userId,
        fullName: member.fullName ?? "",
        email: member.email ?? "",
        role: member.role ?? "",
        region: member.region ?? "",
        status: member.status ?? "",
        assignedAt: member.assignedAt ?? null,
        assignedByName: member.assignedByName ?? "",
        note: member.note ?? null,
      })),
  };
};

export default {
  getWarehouseManager,
  assignWarehouseManager,
  getWarehouseManagerCandidates,
  getWarehouseStaff,
};
