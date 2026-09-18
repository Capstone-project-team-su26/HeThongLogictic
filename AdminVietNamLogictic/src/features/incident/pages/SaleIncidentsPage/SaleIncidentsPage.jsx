import IncidentWorkspace from "@features/incident/components/IncidentWorkspace/IncidentWorkspace";

/** Sale xem sự cố (chỉ đọc) để trả lời khách; quyết định thuộc quản lý kho. */
export default function SaleIncidentsPage() {
  return (
    <IncidentWorkspace
      mode="view"
      eyebrow="KINH DOANH (SALE)"
      title="Sự Cố Hàng Hoá"
      subtitle="Theo dõi sự cố của đơn khách: loại sự cố, ảnh hiện trạng, khách đã chọn gì và quản lý kho quyết thế nào. Sự cố mở chặn tất toán và lập yêu cầu giao cho kiện đó."
    />
  );
}
