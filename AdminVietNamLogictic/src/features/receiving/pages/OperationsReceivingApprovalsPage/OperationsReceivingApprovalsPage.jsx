import ReceivingNotesWorkspace from "@features/receiving/components/ReceivingNotesWorkspace/ReceivingNotesWorkspace";
import "@features/operations/styles/OperationsPage.css";
import "@features/operations/styles/OperationsWroPage.css";

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
      subtitle="Duyệt phiếu Sale vừa lập để khách mang hàng tới kho, và xem biên bản khi kho kiểm đếm bị lệch. Người lập phiếu hoặc người kiểm đếm không tự duyệt được."
      defaultStatus="AWAITING"
      canApprove
    />
  );
}
