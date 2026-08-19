import ShipmentWorkspace from "../../../components/Shipment/ShipmentWorkspace";
import "../../OperationsPage/OperationsPage.css";
import "../../OperationsPage/OperationsWroPage/OperationsWroPage.css";

/**
 * Màn theo dõi lô của Sale — nơi bấm hai mốc "hàng về VN".
 *
 * Trước đây sale báo hàng về ở màn phiếu xuất kho, nhưng mốc đó chỉ đổi trạng thái tờ phiếu chứ
 * không chạm tới kiện hàng, nên kho VN mở app ra chẳng có gì để đối soát. Mốc thật nằm trên LÔ và
 * ở đây; bấm xong hệ thống tự báo khách và mở khoá cho kho đối soát.
 *
 * Hai mốc đầu (sẵn sàng xuất kho, đối tác đã lấy hàng) vẫn hiện nhưng khoá — đó là việc của kho.
 */
export default function SaleShipmentsPage() {
  return (
    <ShipmentWorkspace
      eyebrow="KINH DOANH (SALE)"
      title="Theo Dõi Lô Về Việt Nam"
      subtitle="Tra cứu lô đang trên đường và xác nhận hai mốc hàng về: về tới Việt Nam, rồi về tới kho. Khách được thông báo tự động ở mốc đầu."
      allowedActors={["sale"]}
      defaultTab="IN_TRANSIT"
    />
  );
}
