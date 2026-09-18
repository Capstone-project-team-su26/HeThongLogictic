/**
 * Bề mặt công khai của feature MUA HỘ (purchase).
 *
 * Feature này sở hữu toàn bộ luồng đơn mua hộ: sale tạo đơn mua hộ hộ khách
 * (ConsignmentBuyOrder), xem danh sách yêu cầu mua hộ (PurchaseRequestList) rồi mở
 * chi tiết một đơn để lập báo giá và xác nhận tiến độ mua hàng
 * (PurchaseRequestDetail). Kèm theo là bốn component form/modal dùng trong các trang
 * đó và hai module api MOCK: nghiệp vụ yêu cầu mua hộ (purchaseRequestService) và
 * nhóm hàm GHI để xác nhận mua hộ / duyệt nhập kho (confirmPurchaseApi).
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

export { default as ConfirmPurchaseModal } from "./components/ConfirmPurchaseModal/ConfirmPurchaseModal";
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

/**
 * CỐ TÌNH KHÔNG dùng `export *` cho hai module api của feature này.
 *
 * Giao nhau giữa chúng có hai tên, mỗi tên một kiểu rắc rối:
 *
 *   1. confirmPurchaseApi — TRÙNG THẬT SỰ. Cả confirmPurchaseApi.js (dòng 106) và
 *      purchaseRequestService.js (dòng 1484) đều tự khai một hàm cùng tên, và đó là
 *      HAI CÀI ĐẶT KHÁC NHAU: bản trong confirmPurchaseApi.js gửi kèm kho nhận/kho
 *      đích (warehouseId, destinationWarehouseId, warehouseName) và trả về đơn thô;
 *      bản trong purchaseRequestService.js chỉ đổi status/ảnh/ghi chú rồi trả về đơn
 *      đã normalize kèm khoá `message`. Nếu barrel `export *` cả hai module, ESM coi
 *      tên này là nhập nhằng và biến nó thành undefined một cách ÂM THẦM — không lỗi
 *      build, chỉ vỡ lúc người dùng bấm "Xác nhận mua hộ".
 *
 *   2. approveStorePurchaseApi — purchaseRequestService.js chỉ re-export lại đúng hàm
 *      của confirmPurchaseApi.js (dòng 1533), nên về lý thuyết cùng một binding và
 *      không nhập nhằng. Vẫn liệt kê tường minh cho khỏi phụ thuộc vào chi tiết đó.
 *
 * Cách xử lý: tên trần confirmPurchaseApi thuộc về confirmPurchaseApi.js — đó là bản
 * mà ConfirmPurchaseModal đang thực sự gọi. Bản của purchaseRequestService.js ra dưới
 * alias confirmPurchaseProgressApi để không ai lỡ dùng lẫn.
 */
export {
  confirmPurchaseApi,
  approveStorePurchaseApi,
} from "./api/confirmPurchaseApi";

export {
  PURCHASE_REQUEST_STATUS,
  PURCHASE_SHIPPING_OPTION,
  normalizeCreatePurchaseRequestPayload,
  createPurchaseRequestApi,
  getPurchaseRequestsApi,
  getPurchaseRequestDetailApi,
  createPurchaseRequestQuotationApi,
  confirmPurchaseApi as confirmPurchaseProgressApi,
} from "./api/purchaseRequestService";

/* =========================
   API — DEFAULT OBJECT
========================= */

/**
 * purchaseRequestService.js còn kèm default là object gom sẵn các hàm của chính nó;
 * đặt tên theo module để chỗ nào muốn gọi kiểu
 * purchaseRequestService.getPurchaseRequestsApi() vẫn dùng được.
 *
 * confirmPurchaseApi.js không có mặt ở đây vì default của nó CHÍNH LÀ hàm
 * confirmPurchaseApi đã export ở trên, thêm nữa chỉ tạo hai tên cho một thứ.
 */
export { default as purchaseRequestService } from "./api/purchaseRequestService";
