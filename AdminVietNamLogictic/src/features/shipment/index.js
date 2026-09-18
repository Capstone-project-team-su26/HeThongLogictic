/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "shipment" — lô vận chuyển quốc tế (luồng xuất kho mới).
 *
 * Một module api/ duy nhất (internationalShipmentService) nên `export *` an toàn.
 * ShipmentJourney vẫn được màn chi tiết đơn ký gửi / mua hộ dùng để vẽ nhóm kiện theo lô.
 */

/* PAGES */
export { default as SaleShipmentsPage } from "./pages/SaleShipmentsPage/SaleShipmentsPage";
export { default as AdminShipmentsPage } from "./pages/AdminShipmentsPage/AdminShipmentsPage";
export { default as OperationsShipmentsPage } from "./pages/OperationsShipmentsPage/OperationsShipmentsPage";

/* COMPONENTS */
export { default as ShipmentWorkspace } from "./components/ShipmentWorkspace/ShipmentWorkspace";
export { default as ShipmentTimelineDrawer } from "./components/ShipmentTimelineDrawer/ShipmentTimelineDrawer";
export { default as ShipmentJourney } from "./components/ShipmentJourney/ShipmentJourney";

/* HELPERS */
export { summarizeJourney, describeJourneyScale } from "./components/ShipmentJourney/journeySummary";

/* API */
export * from "./api/internationalShipmentService";
export { default as internationalShipmentService } from "./api/internationalShipmentService";
