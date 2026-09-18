/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "settlement" — chặng cuối của Sale:
 * tất toán theo cân đo VN, đơn hàng cần xử lý, yêu cầu giao hàng.
 *
 * Hai module api/ (settlementService, actionQueueService) KHÔNG trùng tên export — đã đối
 * chiếu: settlementService không còn listActionQueue / createReceivingNote (hai hàm đó chỉ còn
 * ở actionQueueService). Vẫn liệt kê tay actionQueueService cho chắc, tránh ESM âm thầm loại
 * tên nếu sau này ai thêm trùng.
 */

export { default as SaleSettlementPage } from "./pages/SaleSettlementPage/SaleSettlementPage";
export { default as SaleReleasePage } from "./pages/SaleReleasePage/SaleReleasePage";
export { default as SaleDeliveriesPage } from "./pages/SaleDeliveriesPage/SaleDeliveriesPage";

export * from "./api/settlementService";
export { default as settlementService } from "./api/settlementService";

export {
  listActionQueue,
  createReceivingNote,
  getActionQueueApiError,
  RECEIVING_NOTE_GROUP,
} from "./api/actionQueueService";
