/**
 * Khu vực KINH DOANH (Sale) — /sale
 *
 * Menu Sale chỉ còn 8 mục: mỗi mục là một "nhóm việc" (SaleWorkspacePage) gom các màn
 * cùng mục đích thành tab trong một trang. Route ở đây vì vậy chia làm ba loại:
 *
 *   1. Nhóm việc   — /sale/consignments, /sale/queue, ... (tab nằm ở ?tab=)
 *   2. Màn chi tiết — /sale/consignments/:orderId, /sale/tracking/:orderId, ...
 *   3. Chuyển hướng — đường dẫn cũ của từng màn, nay trỏ vào đúng tab của nhóm.
 *
 * Thứ tự import giữ nguyên bản gốc: nhiều stylesheet trang khai báo selector dùng chung,
 * nên thứ tự nạp quyết định cái nào thắng. Đổi thứ tự = đổi giao diện. Phần lớn trang giờ
 * được nạp qua constants/saleWorkspaces.jsx (thứ tự trong file đó cũng theo bản gốc).
 */
import { Route } from "react-router-dom";

import LegacyRedirect from "./LegacyRedirect";
import { SALE } from "./paths";

import SaleWorkspacePage from "@features/workspace/pages/SaleWorkspacePage/SaleWorkspacePage";
import { SALE_WORKSPACE_KEYS } from "@features/workspace/constants/saleWorkspaces";

import SaleDashboard from "@features/dashboard/pages/SaleDashboard/SaleDashboard";
import ConsignmentDetail from "@features/consignment/pages/ConsignmentDetail/ConsignmentDetail";
import CreateConsignmentQuotation from "@features/consignment/pages/CreateConsignmentQuotation/CreateConsignmentQuotation";
import OrderPaymentHistory from "@features/payment/pages/OrderPaymentHistory/OrderPaymentHistory";
import PurchaseRequestDetail from "@features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail";
import OrderTrackingListPage from "@features/tracking/pages/OrderTrackingListPage/OrderTrackingListPage";
import OrderTrackingDetailPage from "@features/tracking/pages/OrderTrackingDetailPage/OrderTrackingDetailPage";

/** Bỏ tiền tố "/sale/" vì các Route này là con của <Route path="/sale">. */
const rel = (fullPath) => fullPath.replace(`${SALE.base}/`, "");

export const saleRoutes = (
  <>
    {/* Vào "/sale" hoặc "/sale/dashboard" đều ra bảng điều khiển */}
    <Route index element={<SaleDashboard />} />
    <Route path={rel(SALE.dashboard)} element={<SaleDashboard />} />

    {/* --- 6 nhóm việc --- */}
    <Route
      path={rel(SALE.createOrder)}
      element={<SaleWorkspacePage group={SALE_WORKSPACE_KEYS.createOrder} />}
    />
    <Route
      path={rel(SALE.consignments)}
      element={<SaleWorkspacePage group={SALE_WORKSPACE_KEYS.consignments} />}
    />
    <Route
      path={rel(SALE.purchaseRequests)}
      element={<SaleWorkspacePage group={SALE_WORKSPACE_KEYS.purchases} />}
    />
    <Route
      path={rel(SALE.queue)}
      element={<SaleWorkspacePage group={SALE_WORKSPACE_KEYS.queue} />}
    />
    <Route
      path={rel(SALE.customers)}
      element={<SaleWorkspacePage group={SALE_WORKSPACE_KEYS.customers} />}
    />
    <Route
      path={rel(SALE.lookup)}
      element={<SaleWorkspacePage group={SALE_WORKSPACE_KEYS.lookup} />}
    />

    {/* --- Màn chi tiết (mở từ danh sách trong nhóm việc) --- */}
    <Route path={rel(SALE.consignmentDetail())} element={<ConsignmentDetail />} />
    <Route
      path={rel(SALE.consignmentCreateQuotation())}
      element={<CreateConsignmentQuotation />}
    />
    <Route
      path={rel(SALE.purchaseRequestDetail())}
      element={<PurchaseRequestDetail />}
    />
    <Route
      path={rel(SALE.orderPaymentHistory())}
      element={<OrderPaymentHistory />}
    />

    {/* Theo dõi đơn: một màn, không chia tab */}
    <Route
      path={rel(SALE.tracking)}
      element={<OrderTrackingListPage basePath={SALE.base} />}
    />
    <Route
      path={rel(SALE.trackingDetail())}
      element={<OrderTrackingDetailPage basePath={SALE.base} />}
    />

    {/* --- Đường dẫn cũ của từng màn --- */}
    <Route
      path={rel(SALE.createConsignmentOrder)}
      element={<LegacyRedirect to={SALE.tab(SALE.createOrder, "consignment")} />}
    />
    <Route
      path={rel(SALE.createBuyOrder)}
      element={<LegacyRedirect to={SALE.tab(SALE.createOrder, "buy-orders")} />}
    />

    <Route
      path={rel(SALE.historyOrder)}
      element={<LegacyRedirect to={SALE.tab(SALE.consignments, "history")} />}
    />
    <Route
      path={rel(SALE.documentsConsignments)}
      element={<LegacyRedirect to={SALE.tab(SALE.consignments, "documents")} />}
    />
    <Route
      path={rel(SALE.historyPurchaseRequests)}
      element={
        <LegacyRedirect to={SALE.tab(SALE.purchaseRequests, "history")} />
      }
    />
    <Route
      path={rel(SALE.documentsPurchaseRequests)}
      element={
        <LegacyRedirect to={SALE.tab(SALE.purchaseRequests, "documents")} />
      }
    />

    <Route
      path={rel(SALE.releases)}
      element={<LegacyRedirect to={SALE.tab(SALE.queue, "releases")} />}
    />
    <Route
      path={rel(SALE.shipments)}
      element={<LegacyRedirect to={SALE.tab(SALE.queue, "shipments")} />}
    />
    <Route
      path={rel(SALE.settlements)}
      element={<LegacyRedirect to={SALE.tab(SALE.queue, "settlements")} />}
    />
    <Route
      path={rel(SALE.deliveries)}
      element={<LegacyRedirect to={SALE.tab(SALE.queue, "deliveries")} />}
    />
    <Route
      path={rel(SALE.incidents)}
      element={<LegacyRedirect to={SALE.tab(SALE.queue, "incidents")} />}
    />

    <Route
      path={rel(SALE.customerService)}
      element={<LegacyRedirect to={SALE.tab(SALE.customers, "support")} />}
    />

    <Route
      path={rel(SALE.servicePricings)}
      element={<LegacyRedirect to={SALE.tab(SALE.lookup, "pricing")} />}
    />
    <Route
      path={rel(SALE.restrictedItems)}
      element={<LegacyRedirect to={SALE.tab(SALE.lookup, "restricted")} />}
    />

    {/* URL cũ đã bỏ hẳn (WRO theo loại xuất SINGLE/BATCH, đơn GoShip mock) */}
    <Route
      path="wro/*"
      element={<LegacyRedirect to={SALE.tab(SALE.queue, "shipments")} />}
    />
    <Route
      path="goship-orders"
      element={<LegacyRedirect to={SALE.tab(SALE.queue, "deliveries")} />}
    />
  </>
);

export default saleRoutes;
