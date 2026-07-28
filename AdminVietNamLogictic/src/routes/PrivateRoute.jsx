import {
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  clearAuthSession,
  isAccessTokenExpired,
} from "../utils/Common/authSession";

const ROLE_HOME = {
  sale: "/sale",
  admin: "/admin",
  operationsmanager: "/operations-manager",
};

const normalizeRole = (role) => {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

export default function RequireAuth({
  children,
  role,
  roles,
}) {
  const location = useLocation();

  const accessToken =
    sessionStorage.getItem("accessToken");

  const isAuth =
    sessionStorage.getItem("isAuth") === "true";

  const storedRole =
    sessionStorage.getItem("role");

  const userRole = normalizeRole(storedRole);

  // Chưa đăng nhập
  if (!isAuth || !accessToken || isAccessTokenExpired(accessToken)) {
    clearAuthSession();

    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  // Token có nhưng role không hợp lệ
  if (!ROLE_HOME[userRole]) {
    clearAuthSession();

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Hỗ trợ:
  // role="Admin"
  // roles={["Admin", "Sale"]}
  const requiredRoles = (
    Array.isArray(roles)
      ? roles
      : role
        ? [role]
        : []
  )
    .map(normalizeRole)
    .filter(Boolean);

  const hasPermission =
    requiredRoles.length === 0 ||
    requiredRoles.includes(userRole);

  if (!hasPermission) {
    const homePath = ROLE_HOME[userRole];

    // Ngăn Navigate về đúng URL hiện tại gây vòng lặp
    if (location.pathname === homePath) {
      return (
        <Navigate
          to="/unauthorized"
          replace
        />
      );
    }

    return (
      <Navigate
        to={homePath}
        replace
      />
    );
  }

  return children;
}
