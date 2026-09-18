/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "tracking" — theo dõi đơn, giữ hàng tại kho nguồn, chốt đơn tay.
 * Một module api/ nên `export *` an toàn.
 */

export { default as OrderTrackingListPage } from "./pages/OrderTrackingListPage/OrderTrackingListPage";
export { default as OrderTrackingDetailPage } from "./pages/OrderTrackingDetailPage/OrderTrackingDetailPage";

export * from "./api/orderTrackingService";
export { default as orderTrackingService } from "./api/orderTrackingService";
