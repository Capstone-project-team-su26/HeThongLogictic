import { Route, Routes } from "react-router-dom";

import Login from "@features/auth/pages/Login/Login";
import MainLayout from "@layouts/MainLayout/MainLayout";
import NotFound from "@app/pages/NotFound/NotFound";

import { ADMIN, COMMON, OPERATIONS, SALE } from "./paths";
import { ROLES } from "./roles";
import RequireAuth from "./RequireAuth";
import { RedirectIfAuthenticated, RoleRedirect } from "./RoleRedirect";

/*
 * Thứ tự ba dòng import dưới đây có ý nghĩa: nó quyết định thứ tự nạp CSS của
 * toàn bộ màn hình, đúng như bản gốc (Sale → Admin → Operations). Đừng sắp lại.
 */
import saleRoutes from "./saleRoutes";
import adminRoutes from "./adminRoutes";
import operationsRoutes from "./operationsRoutes";

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path={COMMON.login}
        element={
          <RedirectIfAuthenticated>
            <Login />
          </RedirectIfAuthenticated>
        }
      />

      <Route
        path={ADMIN.base}
        element={
          <RequireAuth role={ROLES.admin}>
            <MainLayout />
          </RequireAuth>
        }
      >
        {adminRoutes}
      </Route>

      <Route
        path={SALE.base}
        element={
          <RequireAuth role={ROLES.sale}>
            <MainLayout />
          </RequireAuth>
        }
      >
        {saleRoutes}
      </Route>

      <Route
        path={OPERATIONS.base}
        element={
          <RequireAuth role={ROLES.operationsManager}>
            <MainLayout />
          </RequireAuth>
        }
      >
        {operationsRoutes}
      </Route>

      <Route path={COMMON.root} element={<RoleRedirect />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
