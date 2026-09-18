/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "documents".
 *
 * Đây là feature MỎNG NHẤT trong cây: nó chỉ sở hữu HAI TRANG TRA CỨU CHỨNG TỪ
 * cho vai trò sale (khai báo ở @app/router/saleRoutes, dưới nhóm route
 * SALE.documentsConsignments và SALE.documentsPurchaseRequests):
 *   - ConsignmentDocumentsList: chứng từ của đơn gửi hàng (consignment).
 *   - PurchaseDocumentsList:    chứng từ của yêu cầu mua hộ (purchase request).
 *
 * Module này KHÔNG sở hữu dữ liệu. Cố ý không có thư mục api/ — hai trang đọc
 * lại mock api của feature nguồn thay vì tự nuôi một tầng dữ liệu song song:
 *   - ConsignmentDocumentsList dùng getConsignmentsApi (@features/consignment/
 *     api/consignmentService) và getConsignmentReceiptApi (@features/consignment/
 *     api/consignmentReceiptService).
 *   - PurchaseDocumentsList dùng getPurchaseRequestsApi và
 *     getPurchaseRequestDetailApi (@features/purchase/api/purchaseRequestService).
 * Ai cần gọi mấy hàm đó thì import từ chính feature sở hữu chúng, KHÔNG kỳ vọng
 * tìm thấy ở barrel này — barrel này không re-export hộ dữ liệu của người khác,
 * vì làm vậy sẽ tạo ra hai đường dẫn tới cùng một hàm và che mất chủ sở hữu thật.
 *
 * VỀ NGUY CƠ VA CHẠM TÊN KHI DÙNG `export *` — đã kiểm tra trước khi viết:
 * feature này KHÔNG có module api nào, nên barrel không chứa một dòng
 * `export *` nào. Không có giao nhau nào để xử lý, và cũng không có cách nào
 * để ESM âm thầm biến một tên thành undefined ở đây. (Cạm bẫy getWarehouses
 * giữa adminService và warehouseService không liên quan tới feature này.)
 *
 * Đã kiểm từng file thay vì suy từ tên: cả hai trang chỉ có DUY NHẤT một
 * `export default function`, KHÔNG có named export nào — nên không có gì để
 * re-export thêm bên cạnh default.
 *
 * Không có components/ dùng chung và không có styles/ dùng chung: mỗi trang
 * giữ CSS riêng cạnh nó (ConsignmentDocumentsList.css, PurchaseDocumentsList.css)
 * và tự `import "./Tên.css"` như side-effect. CSS không bao giờ re-export ở đây,
 * để thứ tự nạp CSS giữ y hệt bản gốc.
 */

/* ------------------------------------------------------------------ */
/* Pages — cả hai đều `export default function`, không có named export. */
/* ------------------------------------------------------------------ */

/* Chứng từ đơn gửi hàng: lọc/tìm theo trạng thái, xem và in phiếu nhận hàng. */
export { default as ConsignmentDocumentsList } from "./pages/ConsignmentDocumentsList/ConsignmentDocumentsList";

/* Chứng từ yêu cầu mua hộ: lọc/tìm theo trạng thái, xem chi tiết từng yêu cầu. */
export { default as PurchaseDocumentsList } from "./pages/PurchaseDocumentsList/PurchaseDocumentsList";
