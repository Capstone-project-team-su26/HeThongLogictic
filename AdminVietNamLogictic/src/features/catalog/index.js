/**
 * Bề mặt công khai của feature "catalog" — dữ liệu danh mục nền của hệ thống.
 *
 * Module này sở hữu ba thứ:
 *  1. AdminResourcePage — khung CRUD dùng chung, nhận cấu hình columns/fields/api
 *     rồi tự dựng bảng + form + drawer chi tiết; 13 màn danh mục sinh ra từ nó.
 *  2. 13 trang danh mục Admin (kho, đơn vị vận chuyển, phương thức/tuyến vận
 *     chuyển, cấu hình đóng gói, phí dịch vụ, bảng giá, quy tắc giá, tỷ giá,
 *     hàng hạn chế, loại hàng, đơn vị tính, nhà cung cấp) + màn tra cứu hàng
 *     cấm/hạn chế của Sale.
 *  3. Mock service hàng cấm/hạn chế, kèm hằng RESTRICTION_TYPE mà cả
 *     RestrictedItems và FieldLabelTooltip (ngoài feature) đang dùng.
 *
 * VỀ VA CHẠM TÊN GIỮA CÁC "export *": feature này chỉ có DUY NHẤT một module
 * api (api/restrictedItemService.js), nên "export *" bên dưới không có "export *"
 * thứ hai nào để giao nhau — không thể tái hiện lỗi ESM âm thầm biến một tên
 * trùng thành undefined. Nếu sau này thêm module api thứ hai vào feature, phải
 * đối chiếu tập tên trước: có trùng thì chuyển sang re-export tường minh kèm
 * alias, đừng để hai "export *" cùng đưa ra một tên.
 */

/* Khung CRUD dùng chung — đưa ra ngoài vì nó là điểm mở rộng của feature:
   thêm một màn danh mục mới chỉ cần truyền cấu hình vào component này. */
export { default as AdminResourcePage } from "./components/AdminResourcePage/AdminResourcePage";

/* Màn tra cứu hàng cấm/hạn chế (khu vực Sale). RestrictedItemsLoading trong
   cùng file là skeleton nội bộ của riêng màn này nên không đưa ra. */
export { default as RestrictedItems } from "./pages/RestrictedItems/RestrictedItems";

/* 13 màn danh mục Admin. AdminCatalogPages.jsx KHÔNG có default export — toàn
   bộ là named, nên liệt kê tường minh thay vì "export *" để tên nào lọt ra
   khỏi barrel cũng nhìn thấy được ngay tại đây. */
export {
  AdditionalServiceFeesAdminPage,
  CarriersAdminPage,
  ExchangeRatesAdminPage,
  PackageConfigurationsAdminPage,
  PricingRulesAdminPage,
  ProductTypesAdminPage,
  RestrictedItemsAdminPage,
  ServicePricingsAdminPage,
  ShippingMethodsAdminPage,
  ShippingRoutesAdminPage,
  SuppliersAdminPage,
  UnitsOfMeasureAdminPage,
  WarehousesAdminPage,
} from "./pages/AdminCatalogPages";

/* Mock service hàng hạn chế: 6 named export (RESTRICTION_TYPE,
   normalizeRestrictedItem, getRestrictedItemsApi, getRestrictedItemListApi,
   getRestrictedItemDetailApi, getActiveRestrictedItemsApi). */
export * from "./api/restrictedItemService";

/* File trên có CẢ default (object gom đủ 6 tên trên) lẫn named. "export *"
   không bao giờ kéo theo default, nên phải nêu riêng — đặt tên theo module để
   không đụng tên nào khác trong barrel. */
export { default as restrictedItemService } from "./api/restrictedItemService";

/* Hãng + tuyến vận chuyển — đã nối API thật. Tên đuôi "Api" không trùng tên nào của
   restrictedItemService, vẫn liệt kê tay cho chắc. */
export {
  getCarriersApi,
  getActiveCarriersApi,
  getCarrierDetailApi,
  createCarrierApi,
  updateCarrierApi,
  deleteCarrierApi,
  getShippingRoutesApi,
  getShippingRouteDetailApi,
  createShippingRouteApi,
  updateShippingRouteApi,
  deleteShippingRouteApi,
} from "./api/transportCatalogService";
