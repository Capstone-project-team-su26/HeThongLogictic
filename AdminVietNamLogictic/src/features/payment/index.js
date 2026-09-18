/**
 * Bề mặt công khai của feature "payment".
 *
 * Feature này sở hữu ĐÚNG MỘT nghiệp vụ: xem LỊCH SỬ THANH TOÁN CỦA MỘT ĐƠN.
 * Nó gồm trang OrderPaymentHistory (tổng quan tiền của đơn: tổng bill, đã trả,
 * còn lại, thông tin khách, báo giá, cùng danh sách từng giao dịch) và tầng mock
 * orderPaymentService — nơi chuẩn hoá dữ liệu về đúng hình dạng mà trang
 * destructure, nên fixture thiếu khoá nào cũng không làm màn hình trắng.
 *
 * OrderPaymentHistory nhận props (orderId, basePath, readOnly) chứ không chỉ đọc
 * useParams, vì cả hai vai trò đều dùng lại chính nó: saleRoutes gắn bản mặc định,
 * adminRoutes gắn bản basePath={ADMIN.base} readOnly. Đó là lý do trang này thuộc
 * bề mặt công khai thật sự chứ không phải chi tiết nội bộ của một route.
 *
 * VỀ NGUY CƠ VA CHẠM TÊN KHI DÙNG `export *` — đã soát TRƯỚC khi viết barrel:
 * feature chỉ có DUY NHẤT một module api (api/orderPaymentService.js), nên chỉ có
 * đúng một dòng `export *` và không tồn tại giao nhau để ESM âm thầm biến một tên
 * thành undefined. Tên named duy nhất module đó đưa ra là getOrderPaymentHistoryApi,
 * không trùng tên page cũng không trùng alias default bên dưới.
 * Nếu sau này feature có thêm module api thứ hai, phải đối chiếu tập tên của hai
 * module TRƯỚC khi thêm `export *` thứ hai; có trùng thì re-export tường minh kèm
 * alias thay vì spread.
 *
 * Hình dạng export của từng file đã được xác minh trực tiếp trong mã nguồn, không
 * suy đoán từ tên file. Feature không có thư mục components/ hay styles/ dùng chung:
 * OrderPaymentHistory.css nằm cạnh page và được chính page `import` như side-effect.
 * CSS không bao giờ đi qua barrel, để thứ tự nạp CSS giữ y hệt bản gốc.
 */

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

/* Trang chỉ có `export default`, không có named export nào — CopyValue và
   PaymentHistoryLoading là hai component nội bộ, cố ý không đưa ra ngoài. */
export { default as OrderPaymentHistory } from "./pages/OrderPaymentHistory/OrderPaymentHistory";

/* ------------------------------------------------------------------ */
/* API (mock)                                                          */
/* ------------------------------------------------------------------ */

/* orderPaymentService.js có CẢ default (object gom hàm, tiện gọi kiểu
   orderPaymentService.getOrderPaymentHistoryApi) LẪN named export, nên re-export
   cả hai. `export *` không bao giờ chuyển tiếp default, vì vậy dòng alias bên
   dưới là bắt buộc chứ không phải thừa. */
export { default as orderPaymentService } from "./api/orderPaymentService";
export * from "./api/orderPaymentService";
