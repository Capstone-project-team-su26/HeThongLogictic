/**
 * Vai trò và trang chủ tương ứng.
 *
 * Chuỗi role lấy từ phiên đăng nhập có thể là "Operations Manager",
 * "operations_manager"... nên luôn chuẩn hoá trước khi so sánh; đây là chỗ duy
 * nhất định nghĩa phép chuẩn hoá đó.
 */

export const ROLES = {
  admin: "admin",
  sale: "sale",
  operationsManager: "operationsmanager",
};

/**
 * Trang mặc định sau khi đăng nhập, theo vai trò — dùng cho RoleRedirect ("/")
 * và cho màn Login khi đã có phiên.
 */
export const ROLE_HOME = {
  [ROLES.admin]: "/admin",
  [ROLES.sale]: "/sale/consignments",
  [ROLES.operationsManager]: "/operations-manager",
};

/**
 * Trang đá về khi user ĐÃ đăng nhập nhưng vào nhầm khu vực không đúng vai trò.
 *
 * LỆCH CÓ CHỦ Ý, giữ nguyên từ bản gốc: PrivateRoute cũ đá sale về "/sale"
 * (ra SaleDashboard), trong khi RoleRedirect đưa về "/sale/consignments".
 * Hai bảng này khác nhau ngay từ đầu; gộp lại sẽ đổi hành vi nên tách rõ ra đây
 * để thấy được. Muốn thống nhất thì sửa một dòng bên dưới.
 */
export const ROLE_FALLBACK_HOME = {
  [ROLES.admin]: "/admin",
  [ROLES.sale]: "/sale",
  [ROLES.operationsManager]: "/operations-manager",
};

export const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const getRoleHome = (role) => ROLE_HOME[normalizeRole(role)] || null;

export const getRoleFallbackHome = (role) =>
  ROLE_FALLBACK_HOME[normalizeRole(role)] || null;

/** Vai trò có nằm trong hệ thống hay không. */
export const isKnownRole = (role) => Boolean(ROLE_FALLBACK_HOME[normalizeRole(role)]);
