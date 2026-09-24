/**
 * Bề mặt công khai của feature MUA HỘ (purchase).
 *
 * Feature này sở hữu toàn bộ luồng đơn mua hộ: sale tạo đơn mua hộ hộ khách
 * (ConsignmentBuyOrder), xem danh sách yêu cầu mua hộ (PurchaseRequestList) rồi mở
 * chi tiết một đơn để lập báo giá (PurchaseRequestDetail), và quản lý ĐƠN MUA NHÀ
 * CUNG CẤP của luồng chuẩn (SupplierOrdersPage).
 *
 * Hai màn của luồng cũ đã bị XOÁ: popup 5 nấc "Xác nhận mua hộ" (Sale tự bấm tiến độ
 * không cần chứng cứ) và "Duyệt nhập kho mua hộ" (đánh dấu đã nhập kho trước khi kho
 * cân đếm). Luồng chuẩn thay bằng đơn mua NCC có người duyệt và phiếu tiếp nhận thật.
 *
 * VÌ SAO có barrel: các feature khác (chat, dashboard, documents, history,
 * operations) và cả router đang trỏ thẳng vào đường dẫn sâu bên trong feature này.
 * Barrel gom một điểm vào duy nhất để sau này đổi cấu trúc thư mục bên trong mà
 * không phải sửa mọi nơi đang import.
 *
 * Feature không có thư mục styles/ riêng: mỗi component/page giữ file .css cạnh nó
 * và tự import, nên barrel không (và không bao giờ) re-export CSS.
 */

/* =========================
   PAGES
========================= */

export { default as PurchaseRequestList } from "./pages/PurchaseRequestList/PurchaseRequestList";
export { default as PurchaseRequestDetail } from "./pages/PurchaseRequestDetail/PurchaseRequestDetail";
export { default as ConsignmentBuyOrder } from "./pages/ConsignmentBuyOrder/ConsignmentBuyOrder";

/* =========================
   COMPONENTS
========================= */

export { default as ConsignmentBuyOrderConfirm } from "./components/ConsignmentBuyOrderConfirm/ConsignmentBuyOrderConfirm";
export { default as CreatePurchaseRequestQuotationModal } from "./components/CreatePurchaseRequestQuotationModal/CreatePurchaseRequestQuotationModal";

/**
 * PackageOptionalServicesS1 có CẢ default (component) LẪN named
 * (EMPTY_PACKAGE_SERVICES — state rỗng để form reset về), nên đưa ra cả hai.
 *
 * VÌ SAO đặt tên theo file S1 chứ không theo tên hàm bên trong: hàm default trong file
 * đó khai là `PackageOptionalServices`, TRÙNG y hệt tên component của feature ký gửi
 * (@features/consignment). Đây là hai bản khác nhau (bản S1 dùng nhãn "đơn mua hộ"),
 * và consignment/index.js đã chiếm tên trần đó. Lấy tên S1 ở đây thì một super-barrel
 * gom cả hai feature vẫn phân biệt được, đúng luôn cách ConsignmentBuyOrder đang nhập.
 *
 * LƯU Ý cho ai gom barrel: EMPTY_PACKAGE_SERVICES cũng là tên mà consignment/index.js
 * xuất ra, nhưng là MỘT OBJECT KHÁC (bộ khoá cấu hình thùng gỗ không giống nhau). Đừng
 * `export *` cả hai barrel vào cùng một chỗ — tên này sẽ nhập nhằng và thành undefined.
 */
export {
  default as PackageOptionalServicesS1,
  EMPTY_PACKAGE_SERVICES,
} from "./components/PackageOptionalServicesS1/PackageOptionalServicesS1";

/* =========================
   API — MOCK
========================= */

/*
 * API — cố tình liệt kê tường minh, không `export *`: hai module api của feature này
 * từng có tên trùng nhau và ESM sẽ âm thầm biến tên trùng thành undefined.
 */
export {
  PURCHASE_REQUEST_STATUS,
  PURCHASE_SHIPPING_OPTION,
  normalizeCreatePurchaseRequestPayload,
  createPurchaseRequestApi,
  getPurchaseRequestsApi,
  getPurchaseRequestDetailApi,
  createPurchaseRequestQuotationApi,
} from "./api/purchaseRequestService";

/* =========================
   API — DEFAULT OBJECT
========================= */

/**
 * purchaseRequestService.js còn kèm default là object gom sẵn các hàm của chính nó;
 * đặt tên theo module để chỗ nào muốn gọi kiểu
 * purchaseRequestService.getPurchaseRequestsApi() vẫn dùng được.
 *
 */
export { default as purchaseRequestService } from "./api/purchaseRequestService";

/* Luồng mua hộ chuẩn (API thật) — màn đơn mua nhà cung cấp và tầng gọi API của nó. */
export { default as SupplierOrdersPage } from "./pages/SupplierOrdersPage/SupplierOrdersPage";
export * from "./api/purchaseOrderService";
export * from "./api/purchaseCatalogService";
