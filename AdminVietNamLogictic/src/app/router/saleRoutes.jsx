/**
 * Khu vực KINH DOANH (Sale) — /sale
 *
 * Thứ tự import giữ nguyên bản gốc: nhiều stylesheet trang khai báo selector
 * dùng chung, nên thứ tự nạp quyết định cái nào thắng. Đổi thứ tự = đổi giao diện.
 */
import { Navigate, Route } from "react-router-dom";

import { SALE } from "./paths";

import SaleDashboard from "@features/dashboard/pages/SaleDashboard/SaleDashboard";
import PendingConsignmentList from "@features/consignment/pages/PendingConsignmentList/PendingConsignmentList";
import ConsignmentDetail from "@features/consignment/pages/ConsignmentDetail/ConsignmentDetail";
import SaleSettlementPage from "@features/settlement/pages/SaleSettlementPage/SaleSettlementPage";
import SaleReleasePage from "@features/settlement/pages/SaleReleasePage/SaleReleasePage";
import CreateConsignmentQuotation from "@features/consignment/pages/CreateConsignmentQuotation/CreateConsignmentQuotation";
import CustomerList from "@features/customer/pages/CustomerList/CustomerList";
import RestrictedItems from "@features/catalog/pages/RestrictedItems/RestrictedItems";
import ServicePricings from "@features/pricing/pages/ServicePricings/ServicePricings";
import PendingConsignmentListHistory from "@features/history/pages/PendingConsignmentListHistory/PendingConsignmentListHistory";
import PendingPurchaseRequestListHistory from "@features/history/pages/PendingPurchaseRequestListHistory/PendingPurchaseRequestListHistory";
import OrderPaymentHistory from "@features/payment/pages/OrderPaymentHistory/OrderPaymentHistory";
import PurchaseRequestList from "@features/purchase/pages/PurchaseRequestList/PurchaseRequestList";
import PurchaseRequestDetail from "@features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail";
import ConsignmentBuyOrder from "@features/purchase/pages/ConsignmentBuyOrder/ConsignmentBuyOrder";
import ConsignmentOrder from "@features/consignment/pages/ConsignmentOrder/ConsignmentOrder";
import CustomerServiceChat from "@features/chat/pages/CustomerServiceChat/CustomerServiceChat";
import ConsignmentDocumentsList from "@features/documents/pages/ConsignmentDocumentsList/ConsignmentDocumentsList";
import PurchaseDocumentsList from "@features/documents/pages/PurchaseDocumentsList/PurchaseDocumentsList";
import SaleShipmentsPage from "@features/shipment/pages/SaleShipmentsPage/SaleShipmentsPage";
import SaleDeliveriesPage from "@features/settlement/pages/SaleDeliveriesPage/SaleDeliveriesPage";
import OrderTrackingListPage from "@features/tracking/pages/OrderTrackingListPage/OrderTrackingListPage";
import OrderTrackingDetailPage from "@features/tracking/pages/OrderTrackingDetailPage/OrderTrackingDetailPage";
import SaleIncidentsPage from "@features/incident/pages/SaleIncidentsPage/SaleIncidentsPage";

/** Bỏ tiền tố "/sale/" vì các Route này là con của <Route path="/sale">. */
const rel = (fullPath) => fullPath.replace(`${SALE.base}/`, "");

export const saleRoutes = (
  <>
    {/* Vào "/sale" hoặc "/sale/dashboard" đều ra bảng điều khiển */}
    <Route index element={<SaleDashboard />} />
    <Route path={rel(SALE.dashboard)} element={<SaleDashboard />} />

    {/* Đơn ký gửi */}
    <Route path={rel(SALE.consignments)} element={<PendingConsignmentList />} />
    <Route path={rel(SALE.consignmentDetail())} element={<ConsignmentDetail />} />
    <Route
      path={rel(SALE.consignmentCreateQuotation())}
      element={<CreateConsignmentQuotation />}
    />

    {/* Tạo đơn hộ khách */}
    <Route path={rel(SALE.createBuyOrder)} element={<ConsignmentBuyOrder />} />
    <Route
      path={rel(SALE.createConsignmentOrder)}
      element={<ConsignmentOrder />}
    />

    {/* Chặng cuối: chốt tiền với khách rồi cho hàng rời kho */}
    <Route path={rel(SALE.settlements)} element={<SaleSettlementPage />} />
    <Route path={rel(SALE.releases)} element={<SaleReleasePage />} />

    <Route path={rel(SALE.customers)} element={<CustomerList />} />
    <Route path={rel(SALE.restrictedItems)} element={<RestrictedItems />} />
    <Route path={rel(SALE.servicePricings)} element={<ServicePricings />} />

    {/* Lịch sử */}
    <Route
      path={rel(SALE.historyOrder)}
      element={<PendingConsignmentListHistory />}
    />
    <Route
      path={rel(SALE.historyPurchaseRequests)}
      element={<PendingPurchaseRequestListHistory />}
    />

    {/* Chứng từ */}
    <Route
      path={rel(SALE.documentsConsignments)}
      element={<ConsignmentDocumentsList />}
    />
    <Route
      path={rel(SALE.documentsPurchaseRequests)}
      element={<PurchaseDocumentsList />}
    />

    <Route
      path={rel(SALE.orderPaymentHistory())}
      element={<OrderPaymentHistory />}
    />

    {/* Mua hộ */}
    <Route path={rel(SALE.purchaseRequests)} element={<PurchaseRequestList />} />
    <Route
      path={rel(SALE.purchaseRequestDetail())}
      element={<PurchaseRequestDetail />}
    />

    {/* Chặng sau kho nguồn: lô về VN, giao hàng, theo dõi đơn, sự cố */}
    <Route path={rel(SALE.shipments)} element={<SaleShipmentsPage />} />
    <Route path={rel(SALE.deliveries)} element={<SaleDeliveriesPage />} />
    <Route
      path={rel(SALE.tracking)}
      element={<OrderTrackingListPage basePath={SALE.base} />}
    />
    <Route
      path={rel(SALE.trackingDetail())}
      element={<OrderTrackingDetailPage basePath={SALE.base} />}
    />
    <Route path={rel(SALE.incidents)} element={<SaleIncidentsPage />} />

    {/* URL cũ đã bỏ (WRO theo loại xuất SINGLE/BATCH, đơn GoShip mock) — chuyển hướng cho bookmark cũ */}
    <Route path="wro/*" element={<Navigate to={SALE.shipments} replace />} />
    <Route path="goship-orders" element={<Navigate to={SALE.deliveries} replace />} />

    <Route
      path={rel(SALE.customerService)}
      element={<CustomerServiceChat />}
    />
  </>
);

export default saleRoutes;
