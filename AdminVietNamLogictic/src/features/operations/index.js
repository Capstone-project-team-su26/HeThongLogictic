/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "operations" — việc của quản lý kho (OperationsManager):
 * duyệt phiếu xuất kho, duyệt nhập kho VN, duyệt yêu cầu giao, biên bản kiểm đếm, tồn kho,
 * duyệt nhập kho mua hộ.
 *
 * Đợt ghép API luồng xuất kho / hàng về VN đã XOÁ: quy trình gom lô cũ
 * (consolidationWorkflowService, master box, WRO SINGLE/BATCH, shipping-route theo phiếu),
 * SaleWroPage, màn hàng hoàn cũ (parcelReturnService), operationsMappers.
 *
 * KIỂM VA CHẠM TÊN (đã đối chiếu): bốn module api/ dưới đây không có tên export nào trùng
 * nhau — mỗi module tự đặt alias lỗi riêng (getWroApiError, getApprovalApiError,
 * getInspectionApiError, getInventoryApiError), nên `export *` an toàn. `default` của từng
 * module nêu tường minh vì `export *` không kéo theo default.
 */

/* PAGES — chỉ có default export. adminRoutes dùng lại OperationsWroPage (requireReason) và
   OperationsParcelsPage cho Admin giám sát. */
export { default as OperationsWroPage } from "./pages/OperationsWroPage/OperationsWroPage";
export { default as OperationsParcelsPage } from "./pages/OperationsParcelsPage/OperationsParcelsPage";
export { default as OperationsInboundApprovalsPage } from "./pages/OperationsInboundApprovalsPage/OperationsInboundApprovalsPage";
export { default as OperationsDeliveryApprovalsPage } from "./pages/OperationsDeliveryApprovalsPage/OperationsDeliveryApprovalsPage";
export { default as OperationsInspectionsPage } from "./pages/OperationsInspectionsPage/OperationsInspectionsPage";

/* API — đều đã nối backend thật. */
export * from "./api/warehouseReleaseService";
export * from "./api/destinationApprovalService";
export * from "./api/parcelInspectionService";
export * from "./api/inventoryService";

export { default as warehouseReleaseService } from "./api/warehouseReleaseService";
export { default as destinationApprovalService } from "./api/destinationApprovalService";
export { default as parcelInspectionService } from "./api/parcelInspectionService";
export { default as inventoryService } from "./api/inventoryService";
