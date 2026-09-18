/**
 * Bề mặt công khai của feature "history" — hai màn TRA CỨU LỊCH SỬ của khu vực Sale.
 *
 * Feature này sở hữu đúng hai trang, cùng một khuôn: bảng danh sách có bộ lọc trạng thái,
 * lọc khoảng ngày và phân trang, dùng để soi lại các yêu cầu đã đi qua hệ thống —
 * PendingConsignmentListHistory cho phiếu gửi hàng, PendingPurchaseRequestListHistory cho
 * yêu cầu mua hộ. Cả hai được gắn vào route ở @app/router/saleRoutes.jsx.
 *
 * Feature CỐ TÌNH không có thư mục api/ riêng: đây là màn đọc lại dữ liệu của nghiệp vụ
 * khác, nên nó gọi thẳng getConsignmentsApi (@features/consignment/api/consignmentService)
 * và getPurchaseRequestsApi (@features/purchase/api/purchaseRequestService). Barrel này
 * KHÔNG tái xuất hai hàm đó — chúng thuộc bề mặt công khai của feature chủ sở hữu, kéo qua
 * đây chỉ tạo thêm một đường dẫn thứ hai tới cùng một hàm và mở đường cho va chạm tên.
 *
 * Vì không có module api nào ở đây nên barrel này không dùng "export *" lần nào; không có
 * hai nhánh nào cùng đưa ra một tên để ESM âm thầm biến thành undefined.
 *
 * Cả hai file chỉ có export default, không file nào có named export phụ, nên tái xuất theo
 * đúng tên component. CSS đi cạnh từng page và không bao giờ đi qua barrel.
 */

export { default as PendingConsignmentListHistory } from "./pages/PendingConsignmentListHistory/PendingConsignmentListHistory";
export { default as PendingPurchaseRequestListHistory } from "./pages/PendingPurchaseRequestListHistory/PendingPurchaseRequestListHistory";
