/**
 * Khu vực VẬN HÀNH (Operations Manager) — /operations-manager
 *
 * Các "cửa duyệt" của quản lý kho: phiếu tiếp nhận kho gốc, phiếu xuất kho, sự cố hàng hoá,
 * nhập kho VN và giao hàng; cộng khu kho, tồn kho, biên bản kiểm đếm, lô vận chuyển.
 */
import { Navigate, Route } from "react-router-dom";

import { OPERATIONS } from "./paths";

import OperationsDashboard from "@features/dashboard/pages/OperationsDashboard/OperationsDashboard";
import OperationsParcelsPage from "@features/operations/pages/OperationsParcelsPage/OperationsParcelsPage";
import OperationsWroPage from "@features/operations/pages/OperationsWroPage/OperationsWroPage";
import OperationsShipmentsPage from "@features/shipment/pages/OperationsShipmentsPage/OperationsShipmentsPage";
import OperationsInboundApprovalsPage from "@features/operations/pages/OperationsInboundApprovalsPage/OperationsInboundApprovalsPage";
import OperationsReceivingApprovalsPage from "@features/receiving/pages/OperationsReceivingApprovalsPage/OperationsReceivingApprovalsPage";
import OperationsDeliveryApprovalsPage from "@features/operations/pages/OperationsDeliveryApprovalsPage/OperationsDeliveryApprovalsPage";
import OperationsInspectionsPage from "@features/operations/pages/OperationsInspectionsPage/OperationsInspectionsPage";
import OperationsPurchaseStorePage from "@features/operations/pages/OperationsPurchaseStorePage/OperationsPurchaseStorePage";
import OperationsIncidentsPage from "@features/incident/pages/OperationsIncidentsPage/OperationsIncidentsPage";
import WarehouseZonesPage from "@features/warehouse/pages/WarehouseZonesPage/WarehouseZonesPage";

const rel = (fullPath) => fullPath.replace(`${OPERATIONS.base}/`, "");

export const operationsRoutes = (
  <>
    <Route index element={<OperationsDashboard />} />

    <Route path={rel(OPERATIONS.wro)} element={<OperationsWroPage />} />
    <Route
      path={rel(OPERATIONS.shipments)}
      element={<OperationsShipmentsPage />}
    />
    <Route
      path={rel(OPERATIONS.receivingApprovals)}
      element={<OperationsReceivingApprovalsPage />}
    />
    <Route path={rel(OPERATIONS.parcels)} element={<OperationsParcelsPage />} />
    <Route
      path={rel(OPERATIONS.purchaseStore)}
      element={<OperationsPurchaseStorePage />}
    />
    <Route
      path={rel(OPERATIONS.inboundApprovals)}
      element={<OperationsInboundApprovalsPage />}
    />
    <Route
      path={rel(OPERATIONS.deliveryApprovals)}
      element={<OperationsDeliveryApprovalsPage />}
    />
    <Route
      path={rel(OPERATIONS.incidents)}
      element={<OperationsIncidentsPage />}
    />
    <Route
      path={rel(OPERATIONS.warehouseZones)}
      element={<WarehouseZonesPage />}
    />
    {/* Màn hàng hoàn cũ đã bỏ: hàng hoàn đi qua yêu cầu giao (DELIVERY_RETURNED). */}
    <Route path="parcel-returns" element={<Navigate to={OPERATIONS.deliveryApprovals} replace />} />
    <Route
      path={rel(OPERATIONS.inspections)}
      element={<OperationsInspectionsPage />}
    />

    {/* Trang "xuất kho" cũ đã gộp vào màn phiếu xuất kho */}
    <Route path="releases" element={<Navigate to={OPERATIONS.wro} replace />} />
  </>
);

export default operationsRoutes;
