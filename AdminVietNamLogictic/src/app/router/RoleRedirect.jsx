import { Navigate } from "react-router-dom";

import { clearAuthSession, isAccessTokenExpired } from "@shared/utils/authSession";

import { COMMON } from "./paths";
import { getRoleHome } from "./roles";

/** Đọc phiên đăng nhập hiện tại, trả về null nếu không dùng được. */
const readSession = () => {
  const accessToken = sessionStorage.getItem("accessToken");
  const isAuth = sessionStorage.getItem("isAuth") === "true";
  const role = sessionStorage.getItem("role");

  if (!accessToken || !isAuth || isAccessTokenExpired(accessToken)) return null;

  const home = getRoleHome(role);
  return home ? { home } : null;
};

/**
 * Cửa vào "/" — đẩy thẳng về trang chủ của vai trò đang đăng nhập.
 * Phiên hỏng hoặc vai trò lạ thì dọn sạch rồi về màn đăng nhập.
 */
export function RoleRedirect() {
  const session = readSession();

  if (!session) {
    clearAuthSession();
    return <Navigate to={COMMON.login} replace />;
  }

  return <Navigate to={session.home} replace />;
}

/**
 * Màn đăng nhập — đã có phiên hợp lệ thì không cho quay lại, đẩy về trang chủ.
 * Bọc quanh <Login /> thay vì để logic này nằm trong chính màn đăng nhập.
 */
export function RedirectIfAuthenticated({ children }) {
  const session = readSession();

  return session ? <Navigate to={session.home} replace /> : children;
}
