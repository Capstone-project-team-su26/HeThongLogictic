/**
 * Khu vực QUẢN TRỊ (Admin) — /admin
 *
 * Gồm ba nhóm: quản trị người dùng, danh mục dữ liệu nền (13 màn sinh từ
 * AdminCatalogPages), và giám sát vận hành ở chế độ chỉ xem — dùng lại chính
 * màn của Sale/Operations với cờ readOnly thay vì dựng bản sao.
 */
import { Navigate, Route } from "react-router-dom";

import { ADMIN } from "./paths";

import AdminDashboard from "@features/dashboard/pages/AdminDashboard/AdminDashboard";
import AdminUsersPage from "@features/admin/pages/AdminUsersPage/AdminUsersPage";
import WarehouseLocationsPage from "@features/warehouse/pages/WarehouseLocationsPage/WarehouseLocationsPage";
import AdminCashFlowPage from "@features/admin/pages/AdminCashFlowPage/AdminCashFlowPage";
import AdminDeliveriesPage from "@features/admin/pages/AdminDeliveriesPage/AdminDeliveriesPage";
import AdminShipmentsPage from "@features/shipment/pages/AdminShipmentsPage/AdminShipmentsPage";
import AdminReceivingNotesPage from "@features/receiving/pages/AdminReceivingNotesPage/AdminReceivingNotesPage";
import AdminWarehouseManagersPage from "@features/warehouse/pages/AdminWarehouseManagersPage/AdminWarehouseManagersPage";
import {
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
} from "@features/catalog/pages/AdminCatalogPages";

/* Duyệt giá ngoại lệ — thao tác riêng của Admin, không phải màn chỉ xem. */
import AdminPriceApprovalList from "@features/consignment/pages/AdminPriceApprovalList/AdminPriceApprovalList";
import SupplierOrdersPage from "@features/purchase/pages/SupplierOrdersPage/SupplierOrdersPage";

/* Màn dùng chung với Sale / Operations, chỉ khác cờ readOnly. */
import PendingConsignmentList from "@features/consignment/pages/PendingConsignmentList/PendingConsignmentList";
import ConsignmentDetail from "@features/consignment/pages/ConsignmentDetail/ConsignmentDetail";
import OrderPaymentHistory from "@features/payment/pages/OrderPaymentHistory/OrderPaymentHistory";
import OperationsParcelsPage from "@features/operations/pages/OperationsParcelsPage/OperationsParcelsPage";
import OperationsWroPage from "@features/operations/pages/OperationsWroPage/OperationsWroPage";
import WarehouseZonesPage from "@features/warehouse/pages/WarehouseZonesPage/WarehouseZonesPage";
import AdminCompensationsPage from "@features/incident/pages/AdminCompensationsPage/AdminCompensationsPage";
import OrderTrackingListPage from "@features/tracking/pages/OrderTrackingListPage/OrderTrackingListPage";
import OrderTrackingDetailPage from "@features/tracking/pages/OrderTrackingDetailPage/OrderTrackingDetailPage";

const rel = (fullPath) => fullPath.replace(`${ADMIN.base}/`, "");

export const adminRoutes = (
  <>
    <Route index element={<AdminDashboard />} />

    <Route path={rel(ADMIN.users)} element={<AdminUsersPage />} />

    <Route
      path={rel(ADMIN.priceApprovals)}
      element={<AdminPriceApprovalList />}
    />
    <Route
      path={rel(ADMIN.purchaseOrders)}
      element={<SupplierOrdersPage />}
    />

    {/* URL cũ còn nằm trong bookmark của nhân sự — giữ lại chuyển hướng */}
    <Route path="user" element={<Navigate to={ADMIN.users} replace />} />
    <Route path="roles" element={<Navigate to={ADMIN.users} replace />} />
    <Route path="settings" element={<Navigate to={ADMIN.warehouses} replace />} />

    {/* Danh mục dữ liệu nền */}
    <Route
      path={rel(ADMIN.warehouseLocations)}
      element={<WarehouseLocationsPage />}
    />
    <Route path={rel(ADMIN.warehouses)} element={<WarehousesAdminPage />} />
    <Route
      path={rel(ADMIN.warehouseManagers)}
      element={<AdminWarehouseManagersPage />}
    />
    <Route path={rel(ADMIN.carriers)} element={<CarriersAdminPage />} />
    <Route
      path={rel(ADMIN.shippingMethods)}
      element={<ShippingMethodsAdminPage />}
    />
    <Route
      path={rel(ADMIN.packageConfigurations)}
      element={<PackageConfigurationsAdminPage />}
    />
    {/* Phí dịch vụ bổ sung đã gộp vào Quy tắc tính giá: giữ đường dẫn cũ, chuyển hướng. */}
    <Route
      path={rel(ADMIN.additionalServiceFees)}
      element={<Navigate to={ADMIN.pricingRules} replace />}
    />
    <Route
      path={rel(ADMIN.servicePricings)}
      element={<ServicePricingsAdminPage />}
    />
    <Route path={rel(ADMIN.pricingRules)} element={<PricingRulesAdminPage />} />
    <Route
      path={rel(ADMIN.exchangeRates)}
      element={<ExchangeRatesAdminPage />}
    />
    <Route
      path={rel(ADMIN.restrictedItems)}
      element={<RestrictedItemsAdminPage />}
    />
    <Route path={rel(ADMIN.productTypes)} element={<ProductTypesAdminPage />} />
    <Route
      path={rel(ADMIN.unitsOfMeasure)}
      element={<UnitsOfMeasureAdminPage />}
    />
    <Route path={rel(ADMIN.suppliers)} element={<SuppliersAdminPage />} />
    <Route
      path={rel(ADMIN.shippingRoutes)}
      element={<ShippingRoutesAdminPage />}
    />

    {/* Giám sát vận hành — chỉ xem */}
    <Route
      path={rel(ADMIN.consignments)}
      element={<PendingConsignmentList basePath={ADMIN.base} readOnly />}
    />
    <Route
      path={rel(ADMIN.consignmentDetail())}
      element={<ConsignmentDetail readOnly />}
    />
    <Route
      path={rel(ADMIN.consignmentPayments())}
      element={<OrderPaymentHistory basePath={ADMIN.base} readOnly />}
    />
    <Route path={rel(ADMIN.inventory)} element={<OperationsParcelsPage />} />
    {/* Admin duyệt thay quản lý kho được, nhưng backend bắt buộc ghi lý do. */}
    <Route path={rel(ADMIN.wro)} element={<OperationsWroPage requireReason />} />
    <Route path={rel(ADMIN.warehouseZones)} element={<WarehouseZonesPage eyebrow="QUẢN TRỊ HỆ THỐNG" />} />
    <Route path={rel(ADMIN.incidents)} element={<AdminCompensationsPage />} />
    <Route
      path={rel(ADMIN.tracking)}
      element={<OrderTrackingListPage basePath={ADMIN.base} eyebrow="QUẢN TRỊ HỆ THỐNG" />}
    />
    <Route
      path={rel(ADMIN.trackingDetail())}
      element={<OrderTrackingDetailPage basePath={ADMIN.base} canComplete />}
    />

    <Route path={rel(ADMIN.shipments)} element={<AdminShipmentsPage />} />
    <Route
      path={rel(ADMIN.receivingNotes)}
      element={<AdminReceivingNotesPage />}
    />
    <Route path={rel(ADMIN.deliveries)} element={<AdminDeliveriesPage />} />
    <Route path={rel(ADMIN.cashFlow)} element={<AdminCashFlowPage />} />
  </>
);

export default adminRoutes;
