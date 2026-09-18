import IncidentWorkspace from "@features/incident/components/IncidentWorkspace/IncidentWorkspace";

/** Quản lý kho / OM quyết định sự cố hàng hoá ở kho VN (api-hang-ve-viet-nam.md mục E). */
export default function OperationsIncidentsPage() {
  return (
    <IncidentWorkspace
      mode="decide"
      eyebrow="BỘ PHẬN VẬN HÀNH (OPS)"
      title="Quyết Định Sự Cố Hàng Hoá"
      subtitle="Kiện lỗi lúc kho VN tiếp nhận, cân lệch > 10% và khiếu nại sau giao. Xem ảnh hiện trạng, lựa chọn của khách rồi quyết nhận hàng / bồi thường / huỷ hàng. Người lập biên bản không tự quyết được."
    />
  );
}
