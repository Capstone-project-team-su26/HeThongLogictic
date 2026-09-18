import ShipmentWorkspace from "@features/shipment/components/ShipmentWorkspace/ShipmentWorkspace";
import "@features/operations/styles/OperationsPage.css";

/**
 * Quản lý kho xem lô vận chuyển quốc tế.
 *
 * Lập lô / bàn giao là việc của nhân viên kho trên app kho (OM không thao tác kho). OM được
 * backend cho ghi mốc hành trình và tải tờ khai / biên bản sự cố giống Sale, nên giữ nút ghi mốc.
 */
export default function OperationsShipmentsPage() {
  return (
    <div className="ops-page">
      <section className="ops-page__hero">
        <div>
          <span>BỘ PHẬN VẬN HÀNH (OPS)</span>
          <h1>Lô Vận Chuyển Quốc Tế</h1>
          <p>Theo dõi lô từ lúc lập nháp, bàn giao cho hãng tới khi về kho đích.</p>
        </div>
      </section>
      <ShipmentWorkspace canUpdate defaultTab="IN_TRANSIT" />
    </div>
  );
}
