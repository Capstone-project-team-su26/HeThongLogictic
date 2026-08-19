import ReceivingNotesWorkspace from "../../components/ReceivingNotes/ReceivingNotesWorkspace";
import "../OperationsPage/OperationsPage.css";
import "../OperationsPage/OperationsWroPage/OperationsWroPage.css";

/**
 * Admin tra cứu toàn bộ phiếu tiếp nhận của mọi kho.
 *
 * Mở sẵn tab "Tất cả" thay vì "Chờ duyệt": admin vào đây để tra một đơn cụ thể hoặc soát lại
 * lịch sử duyệt, không phải để làm hàng đợi. Nút duyệt vẫn bật vì admin có quyền gỡ kẹt khi OM
 * vắng — chốt quyền thật nằm ở BE.
 */
export default function AdminReceivingNotesPage() {
  return (
    <ReceivingNotesWorkspace
      eyebrow="QUẢN TRỊ HỆ THỐNG"
      title="Phiếu Tiếp Nhận Kho Gốc"
      subtitle="Toàn bộ phiếu tiếp nhận của mọi kho, kèm biên bản đối chiếu khai báo với thực tế và dấu vết ai đã duyệt."
      defaultStatus=""
      canApprove
    />
  );
}
