/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "pricing" — bộ máy TÍNH TIỀN của cả hệ thống.
 *
 * Module này sở hữu hai nhóm rất khác nhau về mức độ dùng chung:
 *
 * 1) MỘT TRANG duy nhất: ServicePricings — màn tra cứu bảng giá / quy tắc phí /
 *    tỷ giá / cấu hình đóng gói dành cho Sale (đăng ký ở @app/router/saleRoutes).
 *    Lưu ý đừng nhầm: màn cùng chủ đề bên Admin là ServicePricingsAdminPage và
 *    nó thuộc features/catalog, KHÔNG nằm ở đây.
 *
 * 2) BỐN MOCK API là phần dùng chung thật sự — 49 named export cộng 3 object
 *    default. Chúng không phục vụ riêng trang nào của feature này: SaleDashboard,
 *    CreateConsignmentQuotation, ConsignmentOrder, ConsignmentDetail,
 *    PackageOptionalServices, CreatePurchaseRequestQuotationModal,
 *    PurchaseRequestDetail, PackageOptionalServicesS1 đều import trực tiếp vào.
 *    Vì vậy coi toàn bộ 49 tên dưới đây là API công khai, đừng đổi tên chúng.
 *
 * Module này KHÔNG sở hữu: dữ liệu mẫu (@/mocks/data/catalog — nơi bốn service
 * này đọc/ghi chung một mảng với mock adminService), 13 màn CRUD danh mục giá
 * của Admin (@features/catalog), và việc gác route theo vai trò
 * (@app/router/RequireAuth).
 *
 * VỀ NGUY CƠ VA CHẠM TÊN KHI DÙNG `export *` — đã kiểm tra TRƯỚC khi viết file
 * này, bằng cách bóc toàn bộ `export const` của cả bốn module rồi đếm trùng:
 * GIAO NHAU BẰNG RỖNG (6 + 15 + 20 + 8 = 49 tên, tất cả đều duy nhất). Bốn dòng
 * `export *` bên dưới do đó không thể khiến ESM âm thầm biến một tên thành
 * undefined, nên không cần alias. Hai cặp dễ tưởng là trùng mà thật ra khác
 * nhau, đừng "sửa" cho gọn:
 *   - getPackageConfigurationsApi (packageConfigurationService) vs
 *     getPackageConfigurations (pricingRuleService — chỉ là wrapper gọi lại
 *     hàm kia, giữ để code cũ khỏi vỡ);
 *   - suggestPackageConfigurationApi (packageConfigurationService) vs
 *     suggestPackageConfiguration (pricingRuleService, cũng là wrapper).
 *
 * NHƯNG CẢNH BÁO cho ai gộp barrel cấp trên: đúng hai tên getPackageConfigurations
 * và getPricingRules của pricingRuleService bị TRÙNG với
 * features/admin/api/adminService.js. Nếu một barrel tổng cùng lúc
 * `export * from "@features/admin"` và `export * from "@features/pricing"`,
 * hai tên đó sẽ thành undefined. Ở barrel tổng phải re-export tường minh kèm
 * alias cho một trong hai bên (ví dụ getPricingRules as getPricingRulesFromRules).
 * Bốn tên findPackageConfigurationById / findPackageConfigurationByCode /
 * findPricingRuleByCode / findServicePricingById cũng trùng với helper trong
 * @/mocks/data/catalog.js, nhưng mocks/ không có barrel nên chưa thành vấn đề.
 *
 * CSS không bao giờ re-export ở đây: ServicePricings.css là side-effect import,
 * trang tự `import "./ServicePricings.css"` để giữ nguyên thứ tự nạp CSS như
 * bản gốc.
 */

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/*
 * ServicePricings: `export default function ServicePricings()`, không có named
 * export nào.
 *
 * Hằng và hàm thuần của trang nay nằm ở hai file anh em cùng thư mục
 * (ServicePricings.constants.js, ServicePricings.helpers.js) và có named export
 * để chính trang import lại. Chúng KHÔNG được re-export ở barrel này: phạm vi
 * dùng chỉ trong thư mục của trang, đưa ra ngoài sẽ biến chi tiết trình bày
 * thành API công khai phải giữ tương thích.
 */
export { default as ServicePricings } from "./pages/ServicePricings/ServicePricings";

/* ------------------------------------------------------------------ */
/* API mock                                                            */
/* ------------------------------------------------------------------ */

/*
 * exchangeRateService.js (API THẬT /api/exchange-rates): 8 named export, KHÔNG có
 * default — nên chỉ spread. Gồm hai hằng CURRENCY_CODES / CURRENCY_NAMES, hai bộ chuẩn
 * hoá normalizeExchangeRateItem / normalizeConvertResult, hai hàm thuần
 * findActiveExchangeRate / convertToVndWithRate và hai lời gọi getExchangeRatesApi /
 * convertCurrencyApi.
 */
export * from "./api/exchangeRateService";

/*
 * packageConfigurationService.js có CẢ named LẪN default, nên re-export cả hai:
 * 15 tên rời, và default là object gom đúng 15 tên đó — giữ lại để code quen
 * gọi kiểu packageConfigurationService.getPackageConfigurationFee(...) vẫn chạy.
 */
export * from "./api/packageConfigurationService";
export { default as packageConfigurationService } from "./api/packageConfigurationService";

/*
 * pricingRuleService.js: 20 named + default. Đây là module NẶNG nhất của feature
 * (calculatePricingBreakdown, calculatePricingRuleAmount, getCommonPricingValues
 * là nơi ra số tiền cuối cùng của báo giá), nên spread cả 20 tên rồi mới thêm
 * default object gom lại.
 */
export * from "./api/pricingRuleService";
export { default as pricingRuleService } from "./api/pricingRuleService";

/*
 * servicePricingService.js: 8 named + default. formatVnd nằm ở đây và được
 * ServicePricings, SaleDashboard cùng hai modal báo giá dùng lại, nên nó là
 * export công khai chứ không phải helper nội bộ — đừng gỡ.
 */
export * from "./api/servicePricingService";
export { default as servicePricingService } from "./api/servicePricingService";
