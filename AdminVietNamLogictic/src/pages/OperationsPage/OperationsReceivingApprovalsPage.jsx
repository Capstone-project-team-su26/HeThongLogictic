import ReceivingNotesWorkspace from "../../components/ReceivingNotes/ReceivingNotesWorkspace";
import "./OperationsPage.css";
import "./OperationsWroPage/OperationsWroPage.css";

/**
 * Cửa duyệt thứ ba của Operations Manager — phiếu tiếp nhận tại kho GỐC.
 *
 * Khác hai cửa còn lại: "Duyệt nhập kho VN" là hàng đã về Việt Nam xin gửi lại kho, còn màn này
 * là lúc hàng vừa tới kho nước ngoài. Duyệt xong kho mới xếp kiện lên kệ được.
 */
export default function OperationsReceivingApprovalsPage() {
  return (
    <ReceivingNotesWorkspace
      eyebrow="BỘ PHẬN VẬN HÀNH (OPS)"
      title="Duyệt Phiếu Tiếp Nhận Kho Gốc"
      subtitle="Phiếu tự sinh khi khách thanh toán. Kho cân đếm và chốt số thực tế, bạn xem chênh lệch rồi quyết cho hàng vào kho hay bắt kiểm lại."
      defaultStatus="RECEIVED"
      canApprove
    />
  );
}
