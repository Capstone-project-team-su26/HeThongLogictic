/*
 * Tài khoản nội bộ + kho phụ trách của nhân viên kho — ĐÃ NỐI API THẬT.
 *
 * Màn Quản lý người dùng (AdminUsersPage) trước đây chạy trên mock adminService. Tính năng
 * "gán nhân viên kho vào từng kho" chỉ có nghĩa trên id tài khoản THẬT, nên sáu hàm người dùng
 * được nối thật TẠI ĐÂY với ĐÚNG tên + chữ ký cũ (getAdminUsers, getAdminUserDetail,
 * createAdminUser, updateAdminUserRole, lockAdminUser, unlockAdminUser); adminService.js
 * re-export lại chúng (không import httpClient) nên trang vẫn import từ adminService như cũ.
 *
 *   GET  /api/User                       → MẢNG TRẦN { id, fullName, email, phone, role, userType,
 *        status, region, createdAt, assignedWarehouses: [{ warehouseId, warehouseCode,
 *        warehouseName, region }] }
 *   GET  /api/User/{id}                  → object tài khoản
 *   POST /api/User                       { fullName, email, password, phone, role, region }
 *        → 201 { id }; 409 email trùng.
 *   PUT  /api/User/{id}/role             { role, region } — KHÔNG gán được Admin; region rỗng =
 *        GIỮ NGUYÊN (không xoá được vùng); đổi vai trò khỏi vai trò kho hoặc đổi vùng khi tài
 *        khoản đang được gán kho → 400 (hiện nguyên message).
 *   PUT  /api/User/{id}/lock | /unlock   (không body)
 *   GET  /api/users/{id}/warehouses      (Admin, OperationsManager)
 *        → { data: { userId, fullName, email, role, region, isWarehouseRole,
 *                    warehouses: [{ warehouseId, warehouseCode, warehouseName, region,
 *                                   isActive, note, assignedAt, assignedById, assignedByName }] } }
 *   PUT  /api/users/{id}/warehouses      (chỉ Admin) { warehouseIds: string[], note: string|null }
 *        THAY TOÀN BỘ danh sách — mảng rỗng = bỏ gán hết (quay về giới hạn theo vùng).
 *        → { message, data: { ...như GET, regionChanged, previousRegion } }
 *        Server chặn (400 + message tiếng Việt): chỉ vai trò kho; kho phải đang hoạt động;
 *        các kho CÙNG một vùng; tài khoản đã có vùng khác vùng kho. Tài khoản trống vùng thì
 *        server tự đặt vùng = vùng của kho.
 *   GET  /api/warehouses                 (Admin) → { items: [...] } — nguồn để chọn kho.
 *
 * Lỗi: { message } (400/404). 403 từ attribute có thể body RỖNG → getAdminUserApiError tự
 * điền câu tiếng Việt thay vì "Request failed with status code 403".
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";

const text = (value) => String(value ?? "").trim();

const requireId = (value, message) => {
  const id = text(value);
  if (!id) throw new Error(message);
  return id;
};

/* =========================
   HÀM THUẦN
========================= */

/**
 * Vai trò kho trong DB có nhiều biến thể (Warehouse, Warehouse Staff, WarehouseStaff,
 * WarehouseTQ, WarehouseVN, Warehouse Staff VN/QT/Cam...). Khớp đúng backend
 * `StaffRoleHelper.IsWarehouseStaffRole`: bỏ khoảng trắng / gạch dưới / gạch ngang, viết hoa,
 * bắt đầu bằng WAREHOUSE và KHÔNG bắt đầu bằng WAREHOUSEMANAGER (quản lý kho).
 */
export const isWarehouseRole = (role) => {
  const key = String(role ?? "").replace(/[\s_-]/g, "").toUpperCase();
  return key.startsWith("WAREHOUSE") && !key.startsWith("WAREHOUSEMANAGER");
};

/** Khoá so sánh vùng: cắt khoảng trắng + viết hoa. Rỗng = chưa có vùng. */
export const toRegionKey = (region) => text(region).toUpperCase();

export const normalizeAssignedWarehouse = (item = {}) => ({
  warehouseId: text(item?.warehouseId ?? item?.id),
  warehouseCode: text(item?.warehouseCode ?? item?.code),
  warehouseName: text(item?.warehouseName ?? item?.name),
  region: text(item?.region ?? item?.regionCode),
  isActive: item?.isActive !== false,
  note: item?.note ?? null,
  assignedAt: item?.assignedAt ?? null,
  assignedById: item?.assignedById ?? null,
  assignedByName: item?.assignedByName ?? "",
});

const normalizeWarehouseList = (list) =>
  (Array.isArray(list) ? list : [])
    .map(normalizeAssignedWarehouse)
    .filter((warehouse) => warehouse.warehouseId);

/** Tài khoản từ GET /api/User: giữ nguyên mọi field, chỉ bảo đảm id + assignedWarehouses là mảng. */
export const normalizeAdminUser = (user = {}) => ({
  ...user,
  id: user?.id ?? user?.userId,
  assignedWarehouses: normalizeWarehouseList(user?.assignedWarehouses),
});

const normalizeUserWarehouses = (data = {}, fallbackUserId = "") => ({
  userId: text(data?.userId) || fallbackUserId,
  fullName: data?.fullName ?? "",
  email: data?.email ?? "",
  role: data?.role ?? "",
  region: data?.region ?? null,
  isWarehouseRole:
    typeof data?.isWarehouseRole === "boolean" ? data.isWarehouseRole : isWarehouseRole(data?.role),
  warehouses: normalizeWarehouseList(data?.warehouses),
});

/** Kho để chọn — đủ trường cho bộ lọc vùng / trạng thái của hộp gán kho. */
export const normalizeAssignableWarehouse = (warehouse = {}) => ({
  id: text(warehouse?.id ?? warehouse?.warehouseId),
  name: text(warehouse?.name ?? warehouse?.warehouseName),
  code: text(warehouse?.code ?? warehouse?.warehouseCode),
  region: text(warehouse?.region ?? warehouse?.regionCode),
  isActive: warehouse?.isActive !== false,
  warehouseType: text(warehouse?.warehouseType ?? warehouse?.type),
});

/**
 * Câu lỗi để hiện: ưu tiên nguyên `message` của server. 403 body rỗng (chặn từ attribute)
 * và 404 body rỗng (server chưa có route) được đổi thành câu tiếng Việt dễ hiểu.
 */
export const getAdminUserApiError = (error, fallbackMessage = "Không thực hiện được thao tác.") => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  if (typeof data?.message === "string" && data.message.trim()) return data.message.trim();
  if (typeof data?.title === "string" && data.title.trim()) return data.title.trim();

  const validation = data?.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  if (validation.length) return validation.join(" ");

  const status = error?.response?.status;
  if (status === 403) return "Tài khoản của bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return `${fallbackMessage} (máy chủ không tìm thấy dữ liệu hoặc chưa hỗ trợ chức năng này).`;
  return error?.message || fallbackMessage;
};

/* =========================
   HÀM THUẦN CHO MÀN QUẢN LÝ NGƯỜI DÙNG
   (tách khỏi component để tools/verify-api.mjs kiểm được bằng dữ liệu mẫu)
========================= */

/**
 * GET /api/User trả MỌI tài khoản, không phân trang (UserController.GetAllUsers →
 * UserService.GetAllUsersAsync = cả bảng User), gồm cả khách hàng tự đăng ký
 * (AuthService đặt UserType "Customer"). Tài khoản do Admin tạo có UserType "Employee".
 * "Nhân viên" = mọi tài khoản KHÔNG phải khách (kể cả bản ghi cũ trống userType).
 */
export const isCustomerAccount = (user) =>
  text(user?.userType).toLowerCase() === "customer" || text(user?.role).toLowerCase() === "customer";

export const isLockedAdminUser = (user) => {
  if (typeof user?.isLocked === "boolean") return user.isLocked;
  return text(user?.status).toUpperCase().includes("LOCK");
};

/** Số cho ô tổng: total = đúng số bản ghi API trả; staff + customers = total. */
export const summarizeAdminUsers = (users) => {
  const list = Array.isArray(users) ? users : [];
  const customers = list.filter(isCustomerAccount).length;
  return { total: list.length, staff: list.length - customers, customers };
};

/** Giá trị bộ lọc Trạng thái cho "Đã khóa" (các trạng thái khác lọc theo đúng chuỗi status). */
export const LOCKED_STATUS_FILTER = "__locked__";

/** Lọc bảng — KHÔNG cắt số lượng; phân trang do bảng tự làm trên toàn bộ kết quả. */
export const filterAdminUsers = (users, { query = "", role = null, userType = null, status = null } = {}) => {
  const keyword = text(query).toLocaleLowerCase("vi");
  return (Array.isArray(users) ? users : []).filter((user) => {
    if (role && user.role !== role) return false;
    if (userType && user.userType !== userType) return false;
    if (status === LOCKED_STATUS_FILTER) {
      if (!isLockedAdminUser(user)) return false;
    } else if (status && (isLockedAdminUser(user) || (user.status || "—") !== status)) {
      return false;
    }
    if (!keyword) return true;
    return [
      user.fullName,
      user.email,
      user.phone,
      user.role,
      user.region,
      user.status,
      ...(user.assignedWarehouses || []).flatMap((warehouse) => [
        warehouse.warehouseName,
        warehouse.warehouseCode,
      ]),
    ].some((value) => String(value ?? "").toLocaleLowerCase("vi").includes(keyword));
  });
};

/** Khớp UserService.NormalizeRole của backend (chỉ hai biến thể có dấu cách). */
export const normalizeStaffRole = (role) => {
  const value = text(role);
  if (value.toLowerCase() === "warehouse staff") return "WarehouseStaff";
  if (value.toLowerCase() === "operations manager") return "OperationsManager";
  return value;
};

/** Vùng như backend trả (enum RegionCode.ToString() → viết hoa); rỗng → null. */
const toRegionValue = (region) => text(region).toUpperCase() || null;

/**
 * Bản ghi cho tài khoản vừa tạo, dựng từ đúng dữ liệu đã gửi + id của 201 { id } — khớp
 * UserService.CreateEmployeeAsync (UserType "Employee", Status "Active", chưa gán kho) để
 * chèn thẳng vào bảng mà KHÔNG phải tải lại cả danh sách. createdAt là giờ máy khách
 * (lệch vài giây với server; "Tải lại" sẽ lấy giờ chuẩn). Không có id → null.
 */
export const buildCreatedAdminUser = (payload = {}, created = {}, now = new Date()) => {
  const id = text(created?.id ?? created?.userId);
  if (!id) return null;
  return normalizeAdminUser({
    id,
    fullName: payload?.fullName ?? "",
    email: payload?.email ?? "",
    phone: payload?.phone ?? "",
    role: normalizeStaffRole(payload?.role),
    userType: "Employee",
    status: "Active",
    region: toRegionValue(payload?.region),
    createdAt: now.toISOString(),
    assignedWarehouses: [],
  });
};

/** Thêm (hoặc thay nếu trùng id) một tài khoản, trả mảng mới. */
export const upsertAdminUser = (users, user) => {
  if (!user?.id) return users;
  const list = Array.isArray(users) ? users : [];
  const index = list.findIndex((item) => String(item.id) === String(user.id));
  if (index < 0) return [user, ...list];
  return list.map((item, position) => (position === index ? user : item));
};

/** Cập nhật đúng một tài khoản theo id, các bản ghi khác giữ nguyên tham chiếu. */
export const patchAdminUser = (users, userId, update) =>
  (Array.isArray(users) ? users : []).map((user) =>
    String(user.id) === String(userId) ? { ...user, ...update(user) } : user,
  );

/** Sau PUT /api/User/{id}/role thành công: region rỗng = server GIỮ NGUYÊN vùng cũ. */
export const applyRoleUpdate = (user, { role, region } = {}) => ({
  role: normalizeStaffRole(role),
  region: toRegionValue(region) ?? user?.region ?? null,
});

/** Sau PUT lock/unlock thành công (server đặt Status "Locked" / "Active"). */
export const applyLockState = (user, locked) => ({
  status: locked ? "Locked" : "Active",
  ...(typeof user?.isLocked === "boolean" ? { isLocked: locked } : {}),
});

/** Sau PUT /api/users/{id}/warehouses: response đã có danh sách kho + vùng mới của tài khoản. */
export const applyWarehouseAssignment = (user, data = {}) => ({
  region: data?.region ?? user?.region ?? null,
  assignedWarehouses: normalizeWarehouseList(data?.warehouses),
});

/* =========================
   TÀI KHOẢN
========================= */

/* Tên + chữ ký giữ đúng bản mock cũ của adminService: (options) → MẢNG TRẦN. */
export const getAdminUsers = async (options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.users.list, { signal: options?.signal });
  return getArrayItems(getResponseData(response)).map(normalizeAdminUser);
};

export const getAdminUserDetail = async (userId, options = {}) => {
  const id = requireId(userId, "Không tìm thấy mã người dùng.");
  const response = await httpClient.get(API_ENDPOINTS.users.detail(id), { signal: options?.signal });
  const data = getResponseData(response);
  return data && typeof data === "object" ? normalizeAdminUser(data) : null;
};

/* Backend trả 201 { id } — trả nguyên object đó; trang dựng bản ghi bằng buildCreatedAdminUser
   rồi chèn vào bảng, không tải lại cả danh sách. */
export const createAdminUser = async (payload = {}, options = {}) => {
  const response = await httpClient.post(
    API_ENDPOINTS.users.list,
    {
      fullName: payload?.fullName,
      email: payload?.email,
      password: payload?.password,
      phone: payload?.phone,
      role: payload?.role,
      region: payload?.region ?? null,
    },
    { signal: options?.signal },
  );
  return getResponseData(response);
};

export const updateAdminUserRole = async (userId, payload = {}, options = {}) => {
  const id = requireId(userId, "Không tìm thấy mã người dùng.");
  const response = await httpClient.put(
    API_ENDPOINTS.users.role(id),
    { role: payload?.role, region: payload?.region ?? null },
    { signal: options?.signal },
  );
  return getResponseData(response);
};

export const lockAdminUser = async (userId, options = {}) => {
  const id = requireId(userId, "Không tìm thấy mã người dùng.");
  return getResponseData(
    await httpClient.put(API_ENDPOINTS.users.lock(id), undefined, { signal: options?.signal }),
  );
};

export const unlockAdminUser = async (userId, options = {}) => {
  const id = requireId(userId, "Không tìm thấy mã người dùng.");
  return getResponseData(
    await httpClient.put(API_ENDPOINTS.users.unlock(id), undefined, { signal: options?.signal }),
  );
};

/* =========================
   KHO PHỤ TRÁCH
========================= */

/** Kho phụ trách hiện tại của một tài khoản (kèm người gán / lúc gán / ghi chú). */
export const getUserWarehousesApi = async (userId, options = {}) => {
  const id = requireId(userId, "Không tìm thấy mã người dùng.");
  const response = await httpClient.get(API_ENDPOINTS.users.warehouses(id), {
    signal: options?.signal,
  });
  return normalizeUserWarehouses(getResponseData(response) || {}, id);
};

/**
 * THAY TOÀN BỘ danh sách kho phụ trách. `warehouseIds` rỗng = bỏ gán hết.
 * Trả { message, data } — data có thêm regionChanged / previousRegion.
 */
export const assignUserWarehousesApi = async (userId, { warehouseIds = [], note = null } = {}) => {
  const id = requireId(userId, "Không tìm thấy mã người dùng.");
  const ids = [...new Set((Array.isArray(warehouseIds) ? warehouseIds : []).map(text).filter(Boolean))];
  const cleanNote = text(note);

  const response = await httpClient.put(API_ENDPOINTS.users.warehouses(id), {
    warehouseIds: ids,
    note: cleanNote || null,
  });

  const body = response?.data;
  const data = getResponseData(response) || {};
  return {
    message: typeof body?.message === "string" ? body.message : "",
    data: {
      ...normalizeUserWarehouses(data, id),
      regionChanged: data?.regionChanged === true,
      previousRegion: data?.previousRegion ?? null,
    },
  };
};

/** Danh mục kho (GET /api/warehouses, Admin) để chọn trong hộp gán kho. */
export const getAssignableWarehousesApi = async (options = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.warehouses.list, { signal: options?.signal });
  return getArrayItems(getResponseData(response))
    .map(normalizeAssignableWarehouse)
    .filter((warehouse) => warehouse.id);
};

export default {
  isWarehouseRole,
  toRegionKey,
  normalizeAssignedWarehouse,
  normalizeAdminUser,
  normalizeAssignableWarehouse,
  getAdminUserApiError,
  isCustomerAccount,
  isLockedAdminUser,
  summarizeAdminUsers,
  filterAdminUsers,
  normalizeStaffRole,
  buildCreatedAdminUser,
  upsertAdminUser,
  patchAdminUser,
  applyRoleUpdate,
  applyLockState,
  applyWarehouseAssignment,
  getAdminUsers,
  getAdminUserDetail,
  createAdminUser,
  updateAdminUserRole,
  lockAdminUser,
  unlockAdminUser,
  getUserWarehousesApi,
  assignUserWarehousesApi,
  getAssignableWarehousesApi,
};
