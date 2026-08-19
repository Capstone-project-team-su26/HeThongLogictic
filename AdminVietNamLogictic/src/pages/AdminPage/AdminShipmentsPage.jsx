import ShipmentWorkspace from "../../components/Shipment/ShipmentWorkspace";
import "../OperationsPage/OperationsPage.css";
import "../OperationsPage/OperationsWroPage/OperationsWroPage.css";

/**
 * Admin nhìn toàn bộ lô của mọi kho.
 *
 * Mở tab "Tất cả" và bật cả hai vai: admin là người gỡ kẹt khi kho hoặc sale vắng mặt, nên không
 * khoá nút nào ở FE — chốt quyền thật nằm ở BE.
 */
export default function AdminShipmentsPage() {
  return (
    <ShipmentWorkspace
      eyebrow="QUẢN TRỊ HỆ THỐNG"
      title="Lô Vận Chuyển Quốc Tế"
      subtitle="Toàn bộ lô đang chạy và đã về, kèm hành trình từng mốc, phiếu xuất kho và kiện thành phần."
      allowedActors={["sale", "warehouse"]}
      defaultTab=""
    />
  );
}
