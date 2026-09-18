/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "warehouse".
 *
 * Module này sở hữu hai thứ tách bạch, đừng lẫn lộn khi import:
 *
 * 1) MÀN SƠ ĐỒ & VỊ TRÍ KHO (WarehouseLocationsPage) cùng 10 mảnh giao diện
 *    dựng nên nó: header số liệu, thanh công cụ, thẻ tổng hợp, skeleton chờ,
 *    ba kiểu xem kho (phân lớp / trạng thái lấp đầy / lưới sơ đồ) và ba modal
 *    (sửa vị trí, sửa ô sơ đồ, xem tồn trong bin).
 *
 * 2) MOCK warehouseService — bộ chọn kho dùng chung của cả dự án. Đây mới là
 *    phần được import nhiều nhất từ bên ngoài: consignment, purchase
 *    (ConfirmPurchaseModal, PurchaseRequestDetail) đều lấy danh sách kho và
 *    bốn helper thuần từ đây, nên coi 8 tên của nó là API thật sự công khai.
 *
 * Module này KHÔNG sở hữu: CRUD vị trí kho và sơ đồ kho — toàn bộ nằm ở
 * @features/admin/api/adminService (createWarehouseLocation, getWarehouseLayout,
 * getWarehouseLayoutZones, getWarehouseLayoutStatus…), và chính
 * WarehouseLocationsPage cũng đi mượn từ đó chứ không dùng warehouseService.
 * Cũng không sở hữu việc gác quyền route (@app/router/RequireAuth) và dữ liệu
 * mẫu (@/mocks/data/catalog).
 *
 * VỀ NGUY CƠ VA CHẠM TÊN KHI DÙNG `export *` — đã kiểm tra trước khi viết:
 * feature này chỉ có ĐÚNG MỘT module api (warehouseService), nên trong nội bộ
 * barrel này không thể có hai `export *` cùng đưa ra một tên, tức không có
 * đường nào để ESM âm thầm biến một tên thành undefined. Không cần alias.
 *
 * Nhưng CẢNH BÁO cho ai gộp barrel cấp trên: getWarehouses của
 * @features/admin/api/adminService TRÔNG giống nhưng KHÔNG trùng — bên này là
 * getWarehousesApi, có hậu tố Api. Đã đối chiếu bằng máy: giao của 8 tên
 * warehouseService với 86 tên adminService là RỖNG, nên
 * `export * from "@features/admin"` cộng `export * from "@features/warehouse"`
 * ở một barrel tổng vẫn an toàn. Đừng "dọn dẹp" bằng cách bỏ hậu tố Api —
 * làm vậy là tự tạo ra đúng vụ va chạm mà cái tên đang tránh.
 *
 * CSS không re-export ở đây, và feature này không có thư mục styles/ nào cả:
 * WarehouseLocationsPage cố tình nạp @features/admin/styles/AdminPage.css như
 * side-effect để trông giống hệt các màn quản trị khác. Nơi nào cần thì tự
 * import, giữ nguyên thứ tự nạp CSS như bản gốc.
 *
 * Đã mở từng file để xác minh hình dạng export thay vì suy từ tên file:
 * cả 11 file .jsx đều CHỈ có `export default function` trùng tên file, không
 * file nào có named export kèm theo.
 */

/* ------------------------------------------------------------------ */
/* PAGE — chỉ có `export default function`, không named export.        */
/* ------------------------------------------------------------------ */

/* Sơ đồ kho + CRUD vị trí/ô chứa; route khai báo ở @app/router/adminRoutes. */
export { default as WarehouseLocationsPage } from "./pages/WarehouseLocationsPage/WarehouseLocationsPage";
export { default as AdminWarehouseManagersPage } from "./pages/AdminWarehouseManagersPage/AdminWarehouseManagersPage";

/* ------------------------------------------------------------------ */
/* COMPONENTS — mười mảnh của màn sơ đồ kho, tất cả default-only.      */
/* ------------------------------------------------------------------ */

/* Dải số liệu đầu trang: tổng khu, kệ, bin đang dùng trên tổng bin. */
export { default as WarehouseHeroHeader } from "./components/WarehouseHeroHeader/WarehouseHeroHeader";

/* Thanh lọc + chuyển qua lại giữa ba kiểu xem kho bên dưới. */
export { default as WarehouseToolbar } from "./components/WarehouseToolbar/WarehouseToolbar";

/* Thẻ tổng hợp một khu/kệ, dùng lặp trong các kiểu xem. */
export { default as WarehouseSummaryCard } from "./components/WarehouseSummaryCard/WarehouseSummaryCard";

/* Khung xương lúc chờ dữ liệu, giữ chiều cao để trang không giật. */
export { default as WarehouseLoadingSkeleton } from "./components/WarehouseLoadingSkeleton/WarehouseLoadingSkeleton";

/* Kiểu xem 1 — bóc kho theo lớp khu > kệ > bin. */
export { default as WarehouseLayeredView } from "./components/WarehouseLayeredView/WarehouseLayeredView";

/* Kiểu xem 2 — tô màu theo mức lấp đầy để thấy chỗ nào còn trống. */
export { default as WarehouseOccupancyStatusView } from "./components/WarehouseOccupancyStatusView/WarehouseOccupancyStatusView";

/* Kiểu xem 3 — lưới sơ đồ đúng vị trí vật lý trong kho. */
export { default as WarehouseLayoutGridView } from "./components/WarehouseLayoutGridView/WarehouseLayoutGridView";

/* Modal thêm/sửa một vị trí kho (khu, kệ, bin, sức chứa). */
export { default as WarehouseLocationModal } from "./components/WarehouseLocationModal/WarehouseLocationModal";

/* Modal thêm/sửa một ô trên lưới sơ đồ. */
export { default as WarehouseLayoutModal } from "./components/WarehouseLayoutModal/WarehouseLayoutModal";

/* Modal xem tồn kho đang nằm trong một bin cụ thể. */
export { default as BinInventoryModal } from "./components/BinInventoryModal/BinInventoryModal";

/* ------------------------------------------------------------------ */
/* API — MOCK                                                          */
/* ------------------------------------------------------------------ */

/**
 * Module api duy nhất của feature nên spread thẳng, khỏi phải bảo trì danh sách
 * tên. Đưa ra 8 tên: bốn hàm lấy kho (getWarehousesApi, getActiveWarehousesApi,
 * getOriginWarehousesApi, getDestinationWarehousesApi) và bốn helper thuần
 * không dính HTTP (normalizeWarehouse, mapWarehousesToOptions,
 * findWarehouseById, findWarehouseByCode).
 *
 * Nhắc lại cho người gọi: cả bốn hàm API trả MẢNG TRẦN bản ghi đã chuẩn hoá,
 * không phải response axios và không bọc { items, totalCount }.
 */
export * from "./api/warehouseService";

/**
 * `export *` KHÔNG mang theo default, mà warehouseService còn một default là
 * object gom đúng 8 thành viên trên — nên phải nêu tường minh, đặt tên theo
 * module để lối gọi cũ warehouseService.getActiveWarehousesApi() vẫn chạy.
 */
export { default as warehouseService } from "./api/warehouseService";

/* ------------------------------------------------------------------ */
/* Khu kho + kiện sai khu — đã nối API thật (api-kho-xep-ke-theo-khu.md A, D).
   Sáu tên của warehouseZoneService không trùng tên nào của warehouseService (đã đối chiếu),
   nhưng vẫn liệt kê tay để ai thêm trùng sau này thì build báo lỗi ngay. */
/* ------------------------------------------------------------------ */
export { default as WarehouseZonesPage } from "./pages/WarehouseZonesPage/WarehouseZonesPage";
export {
  getZoneApiError,
  getZoneTypeMeta,
  listMisplacedParcels,
  listWarehouseZones,
  updateWarehouseZone,
  ZONE_TYPE_OPTIONS,
} from "./api/warehouseZoneService";
