import { useNavigate } from "react-router-dom";

import ShipmentWorkspace from "@features/shipment/components/ShipmentWorkspace/ShipmentWorkspace";
import "@features/operations/styles/OperationsPage.css";

/**
 * Admin xem toàn bộ lô của mọi kho, kèm hành trình từng mốc.
 *
 * Backend cho Admin ghi mốc (Sale / OM / Admin), nên không khoá nút ở FE — Admin là người gỡ
 * kẹt khi Sale vắng mặt. Quyền thật nằm ở backend.
 */
export default function AdminShipmentsPage() {
  const navigate = useNavigate();

  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>QUẢN TRỊ HỆ THỐNG</span>
          <h1>Lô Vận Chuyển Quốc Tế</h1>
          <p>Toàn bộ lô đang chuẩn bị, đang chạy và đã về, kèm dòng thời gian, giấy tờ và manifest.</p>
        </div>
      </section>
      <ShipmentWorkspace canUpdate onOpenOrder={(orderId) => navigate(`/admin/tracking/${orderId}`)} />
    </div>
  );
}
