import { Navigate, useLocation } from "react-router-dom";

import {
  clearAuthSession,
  isAccessTokenExpired,
} from "@shared/utils/authSession";

import { COMMON } from "./paths";
import { getRoleFallbackHome, isKnownRole, normalizeRole } from "./roles";

/**
 * Cổng chặn của mọi khu vực có phân quyền.
 *
 *   <RequireAuth role="admin">...</RequireAuth>
 *   <RequireAuth roles={["Admin", "Sale"]}>...</RequireAuth>
 *
 * Ba lớp chặn, theo đúng thứ tự: chưa đăng nhập / token hết hạn → về login;
 * role lạ (BE đổi tên vai trò mà FE chưa biết) → xoá phiên rồi về login;
 * đúng đăng nhập nhưng sai khu vực → đá về trang chủ của vai trò đó.
 */
export default function RequireAuth({ children, role, roles }) {
  const location = useLocation();

  const accessToken = sessionStorage.getItem("accessToken");
  const isAuth = sessionStorage.getItem("isAuth") === "true";
  const storedRole = sessionStorage.getItem("role");
  const userRole = normalizeRole(storedRole);

  if (!isAuth || !accessToken || isAccessTokenExpired(accessToken)) {
    clearAuthSession();

    return (
      <Navigate
        to={COMMON.login}
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (!isKnownRole(userRole)) {
    clearAuthSession();
    return <Navigate to={COMMON.login} replace />;
  }

  const requiredRoles = (Array.isArray(roles) ? roles : role ? [role] : [])
    .map(normalizeRole)
    .filter(Boolean);

  const hasPermission =
    requiredRoles.length === 0 || requiredRoles.includes(userRole);

  if (!hasPermission) {
    const homePath = getRoleFallbackHome(userRole);

    // Đá về đúng URL đang đứng sẽ tạo vòng lặp Navigate vô tận.
    if (location.pathname === homePath) {
      return <Navigate to={COMMON.unauthorized} replace />;
    }

    return <Navigate to={homePath} replace />;
  }

  return children;
}
