import { Navigate, Route, Routes } from "react-router-dom";

import Login from "../pages/LoginPage/Login";
import MainLayout from "../layouts/mainLayout";
import RequireAuth from "./PrivateRoute";
import {
  clearAuthSession,
  isAccessTokenExpired,
} from "../utils/Common/authSession";

import SaleDashboard from "../pages/SalePage/SaleDashboard/SaleDashboard";

import PendingConsignmentList from "../pages/SalePage/ConsignmentsPage/PendingConsignmentList";

import ConsignmentDetail from "../pages/SalePage/ConsignmentsPage/ConsigmentsDetail/ConsignmentDetail";
import SaleSettlementPage from "../pages/SalePage/SettlementPage/SaleSettlementPage";
import SaleReleasePage from "../pages/SalePage/SettlementPage/SaleReleasePage";

import CreateConsignmentQuotation from "../pages/SalePage/ConsignmentsPage/CreateConsigmentsQotation/CreateConsignmentQuotation";

import CustomerList from "../pages/SalePage/CusTomerPagesale/CustomerList";
import RestrictedItems from "../pages/SalePage/BanItem/RestrictedItems";
import ServicePricings from "../pages/SalePage/ServicePricingRule/ServicePricings";
import PendingConsignmentListHistory from "../pages/SalePage/HistorySalePage/HistoryOrderPage/PendingConsignmentListHistory";
import PendingPurchaseRequestListHistory from "../pages/SalePage/HistorySalePage/HistoryPurchasePage/PendingPurchaseRequestListHistory";
import OrderPaymentHistory from "../pages/SalePage/HistorySalePage/HistoryOrderPage/OrderDetailhisstory/OrderPaymentHistory";
import PurchaseRequestList from "../pages/SalePage/PurchasePage/PurchaseRequestList";
import PurchaseRequestDetail from "../pages/SalePage/PurchasePage/PurchaseRequetDetail/PurchaseRequestDetail";
import ConsignmentBuyOrder from "../pages/SalePage/CreateRequestPage/CreateRequestBuyCuspage/ConsignmentBuyOrder";
import ConsignmentOrder from "../pages/SalePage/CreateRequestPage/CreateRequestOrderCusPage/ConsignmentOrder";
import CustomerServiceChat from "../pages/SalePage/Chat/CustomerServiceChat";
import ConsignmentDocumentsList from "../pages/SalePage/DocumentsPage/ConsignmentDocumentsPage/ConsignmentDocumentsList";
import PurchaseDocumentsList from "../pages/SalePage/DocumentsPage/PurchaseDocumentsPage/PurchaseDocumentsList";
import SaleWroPage from "../pages/SalePage/SaleWroPage";

/* ================= ADMIN ================= */

import AdminDashboard from "../pages/AdminPage/AdminDashboard";
import AdminUsersPage from "../pages/AdminPage/AdminUsersPage";
import WarehouseLocationsPage from "../pages/AdminPage/WarehouseLocationsPage";
import AdminCashFlowPage from "../pages/AdminPage/AdminCashFlowPage";
import AdminDeliveriesPage from "../pages/AdminPage/AdminDeliveriesPage";
import {
  AdditionalServiceFeesAdminPage,
  CarriersAdminPage,
  ExchangeRatesAdminPage,
  PackageConfigurationsAdminPage,
  PricingRulesAdminPage,
  ProductTypesAdminPage,
  RestrictedItemsAdminPage,
  ServicePricingsAdminPage,
  ShippingMethodsAdminPage,
  ShippingRoutesAdminPage,
  SuppliersAdminPage,
  UnitsOfMeasureAdminPage,
  WarehousesAdminPage,
} from "../pages/AdminPage/AdminCatalogPages";

/* ================= OPERATIONS ================= */

import OperationsDashboard from "../pages/OperationsPage/OperationsDashboard";
import OperationsParcelsPage from "../pages/OperationsPage/OperationsParcelsPage";
import OperationsWroPage from "../pages/OperationsPage/OperationsWroPage";
import OperationsShipmentsPage from "../pages/OperationsPage/OperationsShipmentsPage";
import OperationsInboundApprovalsPage from "../pages/OperationsPage/OperationsInboundApprovalsPage";
import OperationsDeliveryApprovalsPage from "../pages/OperationsPage/OperationsDeliveryApprovalsPage";
import OperationsParcelReturnsPage from "../pages/OperationsPage/OperationsParcelReturnsPage";
import OperationsInspectionsPage from "../pages/OperationsPage/OperationsInspectionsPage";
import OperationsPurchaseStorePage from "../pages/OperationsPage/OperationsPurchaseStorePage";

/* ================= ROLE CONFIG ================= */

const ROLE_HOME = {
  admin: "/admin",
  sale: "/sale/consignments",
  operationsmanager: "/operations-manager",
};

const normalizeRole = (role) => {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

/* ================= REDIRECT COMPONENT ================= */

function RoleRedirect() {
  const accessToken = sessionStorage.getItem("accessToken");

  const isAuth = sessionStorage.getItem("isAuth") === "true";

  const role = normalizeRole(sessionStorage.getItem("role"));

  const isLoggedIn = Boolean(
    accessToken && isAuth && !isAccessTokenExpired(accessToken)
  );

  if (!isLoggedIn) {
    clearAuthSession();

    return <Navigate to="/login" replace />;
  }

  const homePath = ROLE_HOME[role];

  // Có token nhưng role không hợp lệ
  if (!homePath) {
    clearAuthSession();

    return <Navigate to="/login" replace />;
  }

  return <Navigate to={homePath} replace />;
}

/* ================= LOGIN ROUTE ================= */

function LoginRoute() {
  const accessToken = sessionStorage.getItem("accessToken");

  const isAuth = sessionStorage.getItem("isAuth") === "true";

  const role = normalizeRole(sessionStorage.getItem("role"));

  const homePath = ROLE_HOME[role];

  if (accessToken && isAuth && !isAccessTokenExpired(accessToken) && homePath) {
    return <Navigate to={homePath} replace />;
  }

  return <Login />;
}

/* ================= NOT FOUND ================= */

function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "64px",
            color: "#1d4ed8",
          }}
        >
          404
        </h1>

        <p
          style={{
            marginTop: "8px",
            color: "#64748b",
          }}
        >
          Không tìm thấy trang bạn yêu cầu.
        </p>
      </div>
    </div>
  );
}

/* ================= ROUTES ================= */

export default function AppRoutes() {
  return (
    <Routes>
      {/* ================= LOGIN ================= */}

      <Route path="/login" element={<LoginRoute />} />

      {/* ================= ADMIN ================= */}

      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="user" element={<Navigate to="/admin/users" replace />} />
        <Route path="roles" element={<Navigate to="/admin/users" replace />} />
        <Route
          path="settings"
          element={<Navigate to="/admin/warehouses" replace />}
        />
        <Route
          path="warehouse-locations"
          element={<WarehouseLocationsPage />}
        />
        <Route path="warehouses" element={<WarehousesAdminPage />} />
        <Route path="carriers" element={<CarriersAdminPage />} />
        <Route path="shipping-methods" element={<ShippingMethodsAdminPage />} />
        <Route
          path="package-configurations"
          element={<PackageConfigurationsAdminPage />}
        />
        <Route
          path="additional-service-fees"
          element={<AdditionalServiceFeesAdminPage />}
        />
        <Route path="service-pricings" element={<ServicePricingsAdminPage />} />
        <Route path="pricing-rules" element={<PricingRulesAdminPage />} />
        <Route path="exchange-rates" element={<ExchangeRatesAdminPage />} />
        <Route path="restricted-items" element={<RestrictedItemsAdminPage />} />
        <Route path="product-types" element={<ProductTypesAdminPage />} />
        <Route path="units-of-measure" element={<UnitsOfMeasureAdminPage />} />
        <Route path="suppliers" element={<SuppliersAdminPage />} />
        <Route path="shipping-routes" element={<ShippingRoutesAdminPage />} />

        {/* Giám sát vận hành (chỉ xem) */}
        <Route
          path="consignments"
          element={<PendingConsignmentList basePath="/admin" readOnly />}
        />
        <Route
          path="consignments/:orderId"
          element={<ConsignmentDetail readOnly />}
        />
        <Route
          path="consignments/:orderId/payments"
          element={<OrderPaymentHistory basePath="/admin" readOnly />}
        />
        <Route
          path="inventory"
          element={<OperationsParcelsPage readOnly />}
        />
        <Route
          path="wro"
          element={<OperationsWroPage readOnly />}
        />
        <Route path="deliveries" element={<AdminDeliveriesPage />} />
        <Route path="cash-flow" element={<AdminCashFlowPage />} />
      </Route>

      {/* ================= SALE ================= */}

      <Route
        path="/sale"
        element={
          <RequireAuth role="sale">
            <MainLayout />
          </RequireAuth>
        }
      >
        {/* Truy cập /sale hoặc /sale/dashboard */}
        <Route index element={<SaleDashboard />} />
        <Route path="dashboard" element={<SaleDashboard />} />

        {/* Danh sách đơn ký gửi */}
        <Route path="consignments" element={<PendingConsignmentList />} />

        <Route
          path="create-order/buy-orders"
          element={<ConsignmentBuyOrder />}
        />

        <Route path="create-order/consignment" element={<ConsignmentOrder />} />

        {/* Chặng cuối: chốt tiền với khách rồi cho hàng rời kho */}
        <Route path="settlements" element={<SaleSettlementPage />} />
        <Route path="releases" element={<SaleReleasePage />} />

        {/* Chi tiết đơn ký gửi */}
        <Route path="consignments/:orderId" element={<ConsignmentDetail />} />

        {/* Màn hình tạo báo giá riêng */}
        <Route
          path="consignments/:orderId/create-quotation"
          element={<CreateConsignmentQuotation />}
        />

        <Route path="customers" element={<CustomerList />} />

        <Route path="/sale/restricted-items" element={<RestrictedItems />} />

        <Route path="/sale/service-pricings" element={<ServicePricings />} />
        <Route
          path="history/order"
          element={<PendingConsignmentListHistory />}
        />

        <Route
          path="history/purchase-requests"
          element={<PendingPurchaseRequestListHistory />}
        />

        <Route
          path="documents/consignments"
          element={<ConsignmentDocumentsList />}
        />

        <Route
          path="documents/purchase-requests"
          element={<PurchaseDocumentsList />}
        />

        <Route
          path="orders/:orderId/payments/history"
          element={<OrderPaymentHistory />}
        />
        <Route path="purchase-requests" element={<PurchaseRequestList />} />

        <Route
          path="purchase-requests/:purchaseRequestId"
          element={<PurchaseRequestDetail />}
        />

        <Route
          path="wro/express"
          element={<SaleWroPage exportTypeFilter="SINGLE" />}
        />
        <Route
          path="wro/batch"
          element={<SaleWroPage exportTypeFilter="BATCH" />}
        />
        <Route path="wro" element={<SaleWroPage />} />

        <Route path="customer-service" element={<CustomerServiceChat />} />
      </Route>

      {/* ========== OPERATIONS MANAGER ========== */}

      <Route
        path="/operations-manager"
        element={
          <RequireAuth role="operationsmanager">
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<OperationsDashboard />} />
        <Route path="wro" element={<OperationsWroPage />} />
        <Route path="shipments" element={<OperationsShipmentsPage />} />
        <Route path="parcels" element={<OperationsParcelsPage />} />
        <Route path="purchase-store" element={<OperationsPurchaseStorePage />} />
        <Route path="inbound-approvals" element={<OperationsInboundApprovalsPage />} />
        <Route path="delivery-approvals" element={<OperationsDeliveryApprovalsPage />} />
        <Route path="parcel-returns" element={<OperationsParcelReturnsPage />} />
        <Route path="inspections" element={<OperationsInspectionsPage />} />
        <Route path="releases" element={<Navigate to="/operations-manager/wro" replace />} />
      </Route>

      {/* ================= ROOT ================= */}

      <Route path="/" element={<RoleRedirect />} />

      {/* ================= FALLBACK ================= */}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
