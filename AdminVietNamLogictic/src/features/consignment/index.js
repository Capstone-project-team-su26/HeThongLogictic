/**
 * Bề mặt công khai của feature KÝ GỬI (consignment).
 *
 * Feature này sở hữu toàn bộ luồng đơn ký gửi hàng: khách/sale tạo đơn ký gửi
 * (ConsignmentOrder), sale duyệt danh sách đơn chờ (PendingConsignmentList),
 * xem chi tiết đơn (ConsignmentDetail) rồi lập & gửi báo giá
 * (CreateConsignmentQuotation). Kèm theo là ba component form dùng trong các
 * trang đó và bốn module api MOCK: đơn ký gửi, master data (loại hàng / tuyến /
 * tuỳ chọn vận chuyển / kho / bảng giá), phiếu biên nhận PDF và sổ địa chỉ nhận hàng.
 *
 * VÌ SAO có barrel: các feature khác (chat, dashboard, documents, history,
 * purchase) đang trỏ thẳng vào đường dẫn sâu bên trong feature này. Barrel gom
 * một điểm vào duy nhất để sau này đổi cấu trúc thư mục bên trong mà không phải
 * sửa mọi nơi đang import.
 *
 * Feature không có thư mục styles/ riêng: mỗi component/page giữ file .css cạnh
 * nó và tự import, nên barrel không (và không bao giờ) re-export CSS.
 */

/* =========================
   PAGES
========================= */

export { default as PendingConsignmentList } from "./pages/PendingConsignmentList/PendingConsignmentList";
export { default as ConsignmentDetail } from "./pages/ConsignmentDetail/ConsignmentDetail";
export { default as ConsignmentOrder } from "./pages/ConsignmentOrder/ConsignmentOrder";
export { default as CreateConsignmentQuotation } from "./pages/CreateConsignmentQuotation/CreateConsignmentQuotation";
export { default as AdminPriceApprovalList } from "./pages/AdminPriceApprovalList/AdminPriceApprovalList";

/* =========================
   COMPONENTS
========================= */

export { default as ConsignmentOrderConfirm } from "./components/ConsignmentOrderConfirm/ConsignmentOrderConfirm";
export { default as ConfirmConsignmentQuotation } from "./components/ConfirmConsignmentQuotation/ConfirmConsignmentQuotation";

/*
 * Tóm tắt đầy đủ một đơn cho hộp xác nhận trước khi ghi (lập phiếu, giao hàng, báo kho...).
 * Hook nạp dữ liệu thật, panel trình bày — tách hai mảnh để trang còn khoá được nút gửi
 * trong lúc đang tải. Tên đã đối chiếu: không trùng export nào khác trong barrel này.
 */
export { default as OrderReviewPanel } from "./components/OrderReviewPanel/OrderReviewPanel";
export { default as useOrderReview } from "./hooks/useOrderReview";

/**
 * PackageOptionalServices có CẢ default (component) LẪN named
 * (EMPTY_PACKAGE_SERVICES — state rỗng để form reset về), nên đưa ra cả hai.
 *
 * LƯU Ý cho ai gom super-barrel: CẢ HAI tên này đều đụng với @features/purchase.
 * Hàm default bên đó cũng khai đúng tên `PackageOptionalServices` (nên purchase
 * đã nhường tên trần và tự xuất dưới alias PackageOptionalServicesS1), còn
 * EMPTY_PACKAGE_SERVICES bên đó là MỘT OBJECT KHÁC — dư 8 khoá thùng gỗ
 * (woodCrate*) mà bản ký gửi này không có. Hai binding khác nhau, nên đừng đặt
 * `export * from "@features/consignment"` cạnh `export * from "@features/purchase"`:
 * ESM sẽ biến EMPTY_PACKAGE_SERVICES thành undefined một cách âm thầm.
 */
export {
  default as PackageOptionalServices,
  EMPTY_PACKAGE_SERVICES,
} from "./components/PackageOptionalServices/PackageOptionalServices";

/* =========================
   TRẠNG THÁI ĐƠN KÝ GỬI
========================= */

/**
 * 19 mã đích, nhãn tiếng Việt và hàm chuẩn hóa mã cũ — nguồn duy nhất trong app.
 * Tên trong module này (ORDER_STATUS*, LEGACY_ORDER_STATUS_MAP,
 * normalizeOrderStatus, getOrderStatusLabel) không trùng tên nào khác của barrel.
 */
export * from "./constants/orderStatus";

/* =========================
   API — MOCK
========================= */

/**
 * Hai module này không giao tên với bất kỳ module api nào khác trong feature,
 * nên spread thẳng bằng export * cho khỏi phải bảo trì danh sách tên.
 */
export * from "./api/consignmentMasterService";
export * from "./api/deliveryAddressService";

/**
 * CỐ TÌNH KHÔNG dùng `export *` cho hai module dưới đây.
 *
 * consignmentService.js có dòng `export { getConsignmentReceiptApi }` — nó
 * re-export lại đúng hàm của consignmentReceiptService.js, nên tên này lộ ra từ
 * cả hai module. Hiện tại hai nguồn cùng trỏ về MỘT binding gốc, mà quy tắc ESM
 * chỉ coi là nhập nhằng khi hai `export *` trỏ về HAI binding KHÁC nhau — nên
 * `export *` cả hai vẫn chạy được ở thời điểm này.
 *
 * Vẫn viết tường minh vì đó là một quả mìn hẹn giờ: chỉ cần sau này ai đó định
 * nghĩa một getConsignmentReceiptApi riêng trong consignmentService.js (thay vì
 * re-export), hai binding lập tức khác nhau và ESM sẽ ÂM THẦM loại tên đó khỏi
 * namespace của barrel — `import { getConsignmentReceiptApi } from "@features/consignment"`
 * thành undefined / SyntaxError mà build không hề cảnh báo. Liệt kê tay thì chỗ
 * trùng nằm ngay trước mắt và mỗi tên chỉ có đúng một nguồn.
 */
export {
  normalizeCreateConsignmentPayload,
  normalizeQuotationPayload,
  normalizeConsignmentStatusPayload,
  calculateVolumeM3FromItems,
  convertM3ToCm3,
  createConsignmentApi,
  validateConsignmentItemsApi,
  getConsignmentsApi,
  getConsignmentDetailApi,
  updateConsignmentStatusApi,
  approveConsignmentApi,
  rejectConsignmentApi,
  estimateQuotationApi,
  sendQuotationApi,
} from "./api/consignmentService";

export { getConsignmentReceiptApi } from "./api/consignmentReceiptService";

/**
 * Báo giá: đọc báo giá của đơn + Admin duyệt giá ngoại lệ.
 *
 * Liệt kê tay (không `export *`) vì module này có hằng QUOTATION_STATUS /
 * PRICE_APPROVAL_* dễ đụng tên nếu sau này gom super-barrel.
 */
export {
  QUOTATION_STATUS,
  PRICE_APPROVAL_STATUS,
  PRICE_APPROVAL_DECISION,
  normalizeQuotationFee,
  normalizeQuotationDetail,
  groupFeesByOrderItem,
  getOrderLevelFees,
  getOrderQuotationApi,
  getQuotationByIdApi,
  decideQuotationPriceApprovalApi,
  getPendingPriceApprovalQueueApi,
} from "./api/quotationService";

/* =========================
   API — DEFAULT OBJECT
========================= */

/**
 * Ba module api còn kèm default là object gom sẵn các hàm của chính nó; đặt tên
 * theo module để chỗ nào muốn gọi kiểu consignmentService.getConsignmentsApi()
 * vẫn dùng được. Riêng consignmentReceiptService không có mặt ở đây vì default
 * của nó chính là hàm getConsignmentReceiptApi đã export ở trên.
 */
export { default as consignmentService } from "./api/consignmentService";
export { default as quotationService } from "./api/quotationService";
export { default as consignmentMasterService } from "./api/consignmentMasterService";
export { default as deliveryAddressService } from "./api/deliveryAddressService";
