import IncidentWorkspace from "@features/incident/components/IncidentWorkspace/IncidentWorkspace";

/** Admin ghi nhận đã chi bồi thường cho sự cố quản lý kho đã quyết COMPENSATE. */
export default function AdminCompensationsPage() {
  return (
    <IncidentWorkspace
      mode="compensate"
      eyebrow="QUẢN TRỊ HỆ THỐNG"
      title="Chi Bồi Thường Sự Cố"
      subtitle="Sự cố đã quyết bồi thường nhưng chưa chi: tải chứng từ chuyển tiền rồi ghi mã giao dịch. Đơn chỉ đóng được khi bồi thường đã chi."
    />
  );
}
