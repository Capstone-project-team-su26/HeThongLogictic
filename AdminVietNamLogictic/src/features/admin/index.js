/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "admin".
 *
 * Module này sở hữu hai thứ rất khác nhau, nên đọc kỹ trước khi import:
 *
 * 1) BA TRANG QUẢN TRỊ chạy trong vùng gác quyền admin (khai báo ở
 *    @app/router/adminRoutes): quản lý người dùng, dòng tiền và đơn giao.
 *
 * 2) HAI MOCK API, trong đó adminService là module dùng chung LỚN NHẤT của cả
 *    dự án — nó là nơi CRUD gần như toàn bộ danh mục nền (kho, vị trí kho, nhà
 *    vận chuyển, phương thức giao, cấu hình đóng gói, phí dịch vụ, bảng giá,
 *    quy tắc giá, hàng cấm, loại hàng, đơn vị đo, nhà cung cấp, tuyến vận
 *    chuyển, sơ đồ kho, tỷ giá, tồn kho) cộng ba helper bóc dữ liệu/bóc lỗi.
 *    Rất nhiều feature khác (catalog, warehouse, purchase, operations,
 *    receiving, settlement, pricing) đang import trực tiếp từ đây, nên coi
 *    86 tên của adminService là API thật sự công khai, đừng đổi tên chúng.
 *
 * Module này KHÔNG sở hữu: việc gác route theo vai trò (@app/router/RequireAuth),
 * dữ liệu mẫu (@/mocks/data/*), và trang AdminDashboard (nằm ở features/dashboard,
 * nó chỉ mượn styles/AdminPage.css của feature này).
 *
 * VỀ NGUY CƠ VA CHẠM TÊN KHI DÙNG `export *` — đã kiểm tra trước khi viết:
 * hai module api của feature này giao nhau BẰNG RỖNG (adminFinanceService chỉ
 * có 6 tên, đều chứa cụm AdminFinance, AdminPendingTransactions hoặc
 * AdminTransaction, không tên nào trùng trong 86 tên của adminService).
 * Vì vậy hai dòng `export *` dưới đây không thể khiến ESM âm thầm biến một
 * tên thành undefined, và không cần alias.
 *
 * Nhưng CẢNH BÁO cho ai gộp barrel cấp trên: adminService trùng tên
 * getPackageConfigurations và getPricingRules với
 * features/pricing/api/pricingRuleService.js. Nếu một barrel tổng cùng
 * `export * from "@features/admin"` và `export * from "@features/pricing"`,
 * đúng hai tên đó sẽ thành undefined. Ở barrel tổng phải re-export tường minh
 * kèm alias cho một trong hai bên. (Ví dụ getWarehouses trong đề bài thì KHÔNG
 * va chạm: features/warehouse/api/warehouseService.js xuất
 * getWarehousesApi — có hậu tố Api — nên hai tên khác nhau.)
 *
 * styles/AdminPage.css không bao giờ re-export ở đây: nó là side-effect import,
 * nơi nào cần thì tự `import "@features/admin/styles/AdminPage.css"` để giữ
 * nguyên thứ tự nạp CSS như bản gốc. Lưu ý CHỈ AdminUsersPage và
 * AdminCashFlowPage nạp file này; AdminDeliveriesPage cố tình nạp
 * @features/operations/styles/OperationsPage.css vì nó là bản sao chỉ-đọc của
 * màn duyệt bên OM, phải trông giống bên đó chứ không giống hai trang kia.
 * Ngoài feature này còn ba nơi mượn AdminPage.css (catalog/AdminResourcePage,
 * dashboard/AdminDashboard, warehouse/WarehouseLocationsPage) — đừng đổi tên
 * class hay xoá file vì tưởng chỉ admin dùng.
 */

/* ------------------------------------------------------------------ */
/* Pages — cả ba đều `export default function`, không có named export. */
/* ------------------------------------------------------------------ */

/* Quản lý người dùng: tạo, đổi vai trò, khoá/mở khoá tài khoản. */
export { default as AdminUsersPage } from "./pages/AdminUsersPage/AdminUsersPage";

/* Dòng tiền: tổng quan thu chi, đơn, giao dịch và duyệt/từ chối thanh toán. */
export { default as AdminCashFlowPage } from "./pages/AdminCashFlowPage/AdminCashFlowPage";

/* Theo dõi đơn giao ở góc nhìn admin. */
export { default as AdminDeliveriesPage } from "./pages/AdminDeliveriesPage/AdminDeliveriesPage";

/* ------------------------------------------------------------------ */
/* API mock                                                            */
/* ------------------------------------------------------------------ */

/*
 * adminService.js: 86 named export, KHÔNG có default — nên chỉ spread, không
 * có gì để re-export dạng default. Spread an toàn vì không giao tên với module
 * api còn lại của feature (xem ghi chú va chạm ở đầu file).
 */
export * from "./api/adminService";

/*
 * adminFinanceService.js có CẢ named LẪN default, nên re-export cả hai:
 * 6 hàm rời ở dòng dưới, và default là object gom đúng 6 hàm đó lại — giữ lại
 * để code cũ quen gọi kiểu adminFinanceService.getAdminFinanceSummary(...)
 * vẫn chạy được.
 */
export * from "./api/adminFinanceService";
export { default as adminFinanceService } from "./api/adminFinanceService";
