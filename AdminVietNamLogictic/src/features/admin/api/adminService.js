/*
 * Bề mặt API quản trị dùng chung (từng là MOCK của bản chỉ-giao-diện).
 *
 * Bề mặt public giữ nguyên 100% — 81 named export, không có default export, đúng thứ
 * tự tham số (id trước, payload, rồi options mang AbortSignal) — để AdminUsersPage,
 * AdminCatalogPages/AdminResourcePage, WarehouseLocationsPage và PurchaseRequestDetail
 * không phải đổi import.
 *
 * getAdminApiData / getAdminApiList / getAdminApiError giữ nguyên chữ ký: bảy
 * service khác (adminFinanceService, receivingNoteService, settlementService,
 * warehouseReleaseService, parcelIncidentService, ...) đang import lại chúng.
 *
 * NGOẠI LỆ ĐÃ NỐI THẬT: nhóm kho / ô kệ / sơ đồ kho / tồn kho (17 tên) được re-export
 * từ @features/warehouse/api/warehouseAdminService — xem mục "WAREHOUSES + VỊ TRÍ KHO";
 * sáu hàm người dùng re-export từ ./adminUserService — xem mục "USERS (API THẬT)";
 * 55 hàm danh mục nền (11 nhóm) re-export từ @features/catalog/api/catalogAdminService —
 * xem mục "DANH MỤC NỀN (API THẬT)". Từ 26/09/2026 file này KHÔNG còn dữ liệu giả nào:
 * chỉ còn ba helper bóc dữ liệu/bóc lỗi + các re-export, và vẫn không import httpClient.
 */

export const getAdminApiData = (response) => {
  const responseData = response?.data ?? response;
  return responseData?.data ?? responseData;
};

export const getAdminApiList = (response) => {
  const data = getAdminApiData(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const getAdminApiError = (error, fallbackMessage) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  /* Lỗi 500 của backend có message chung chung, lý do thật nằm ở `error` — ghép cả hai. */
  if (typeof data?.message === "string") {
    return typeof data?.error === "string" && data.error.trim() && data.error !== data.message
      ? `${data.message} ${data.error}`
      : data.message;
  }
  if (typeof data?.error === "string") return data.error;

  /* 400 tự động của [ApiController] là ValidationProblemDetails: `title` chỉ là câu chung
     tiếng Anh, câu thật (ErrorMessage tiếng Việt của DTO) nằm trong `errors` — ưu tiên errors. */
  const validationMessages = data?.errors
    ? Object.values(data.errors).flat().filter(Boolean)
    : [];
  if (validationMessages.length) return validationMessages.join(" ");
  if (typeof data?.title === "string") return data.title;
  return error?.message || fallbackMessage;
};

/* ==================== USERS (API THẬT) ==================== */

/*
 * ĐÃ NỐI API THẬT (26/09/2026, cùng tính năng gán nhân viên kho vào kho): dữ liệu giả của sáu
 * hàm người dùng đã XOÁ. Code thật nằm ở ./adminUserService (đúng tên + chữ ký cũ); ở đây chỉ
 * re-export để AdminUsersPage vẫn import từ adminService như trước:
 *
 *   getAdminUsers(options)                    → GET  /api/User (mảng trần, có assignedWarehouses)
 *   getAdminUserDetail(userId, options)       → GET  /api/User/{id}
 *   createAdminUser(payload, options)         → POST /api/User → 201 { id }; 409 email trùng
 *   updateAdminUserRole(userId, payload, opt) → PUT  /api/User/{id}/role { role, region }
 *   lockAdminUser / unlockAdminUser(userId)   → PUT  /api/User/{id}/lock | /unlock
 *
 * Re-export (không import httpClient trực tiếp) để phần còn lại của file vẫn là mock thuần và
 * vẫn qua được phép soát mạng của tools/verify-mocks.mjs.
 */
export {
  createAdminUser,
  getAdminUserDetail,
  getAdminUsers,
  lockAdminUser,
  unlockAdminUser,
  updateAdminUserRole,
} from "./adminUserService";

/* ==================== WAREHOUSES + VỊ TRÍ KHO (API THẬT) ==================== */

/*
 * ĐÃ NỐI API THẬT (26/09/2026): nhóm kho / ô kệ / sơ đồ lưới / tồn kho không còn là
 * dữ liệu giả trong bộ nhớ — màn "Sơ đồ kho" của Admin phải thấy đúng kho, khu, kệ, ô
 * như app kho Trung Quốc. Code thật nằm ở @features/warehouse/api/warehouseAdminService
 * (cùng endpoint với app kho); ở đây chỉ re-export để giữ nguyên tên + chữ ký cũ:
 *
 *   getWarehouses / createWarehouse / updateWarehouse / deleteWarehouse
 *       → GET|POST /api/warehouses, PUT|DELETE /api/warehouses/{id}
 *   getWarehouseLocations / getActiveWarehouseLocations / createWarehouseLocation
 *       → GET|POST /api/warehouses/{id}/locations, GET .../locations/active
 *   updateWarehouseLocation / deleteWarehouseLocation → PUT|DELETE /api/warehouse-locations/{id}
 *   getWarehouseLayout / getWarehouseLayoutZones / getWarehouseLayoutStatus
 *       → GET /api/warehouses/{id}/layout, .../layout/zones, .../layout/status
 *   create/update/deleteWarehouseLayoutItem → POST|PUT|DELETE /api/warehouses/{id}/layout[/{layoutId}]
 *   getInventories / getWarehouseInventories → GET /api/inventories
 *
 * Re-export (không import httpClient trực tiếp) để phần còn lại của file vẫn là mock
 * thuần và vẫn qua được phép soát mạng của tools/verify-mocks.mjs.
 */
export {
  createWarehouse,
  createWarehouseLayoutItem,
  createWarehouseLocation,
  deleteWarehouse,
  deleteWarehouseLayoutItem,
  deleteWarehouseLocation,
  getActiveWarehouseLocations,
  getInventories,
  getWarehouseInventories,
  getWarehouseLayout,
  getWarehouseLayoutStatus,
  getWarehouseLayoutZones,
  getWarehouseLocations,
  getWarehouses,
  updateWarehouse,
  updateWarehouseLayoutItem,
  updateWarehouseLocation,
} from "@features/warehouse/api/warehouseAdminService";

/* ==================== DANH MỤC NỀN (API THẬT) ==================== */

/*
 * ĐÃ NỐI API THẬT (26/09/2026): 11 nhóm danh mục nền không còn là dữ liệu giả trong bộ nhớ —
 * Admin sửa danh mục là ghi thẳng xuống DB. Code thật nằm ở
 * @features/catalog/api/catalogAdminService; ở đây chỉ re-export giữ nguyên tên + chữ ký cũ:
 *
 *   ShippingMethod*        → GET|POST /api/shipping-methods, GET|PUT|DELETE /api/shipping-methods/{id}
 *   PackageConfiguration*  → GET|POST /api/package-configurations, GET|PUT|DELETE .../{id}
 *   AdditionalServiceFee*  → GET|POST /api/additional-service-fees, GET|PUT|DELETE .../{id}
 *   ServicePricing*        → GET|POST /api/service-pricings, GET|PUT|DELETE .../{id}
 *   PricingRule*           → GET|POST /api/pricing-rules, GET|PUT|DELETE .../{id}
 *   RestrictedItem*        → GET|POST /api/restricted-items, GET|PUT|DELETE .../{id}
 *   ProductType*           → GET /api/product-types/all, POST /api/product-types, GET|PUT|DELETE .../{id}
 *   UnitOfMeasure*         → GET /api/units-of-measure/all, POST /api/units-of-measure, GET|PUT|DELETE .../{id}
 *   Supplier*              → GET|POST /api/suppliers, GET|PUT|DELETE /api/suppliers/{id}
 *   ShippingRoute*         → GET|POST /api/shipping-routes, GET|PUT|DELETE .../{id} (qua transportCatalogService)
 *   ExchangeRate*          → GET|POST /api/exchange-rates, GET|PUT|DELETE /api/exchange-rates/{id}
 *
 * Hãng vận chuyển (carriers) trang gọi thẳng @features/catalog/api/transportCatalogService.
 */
export {
  createAdditionalServiceFee,
  createExchangeRate,
  createPackageConfiguration,
  createPricingRule,
  createProductType,
  createRestrictedItem,
  createServicePricing,
  createShippingMethod,
  createShippingRoute,
  createSupplier,
  createUnitOfMeasure,
  deleteAdditionalServiceFee,
  deleteExchangeRate,
  deletePackageConfiguration,
  deletePricingRule,
  deleteProductType,
  deleteRestrictedItem,
  deleteServicePricing,
  deleteShippingMethod,
  deleteShippingRoute,
  deleteSupplier,
  deleteUnitOfMeasure,
  getAdditionalServiceFeeDetail,
  getAdditionalServiceFees,
  getExchangeRateDetail,
  getExchangeRates,
  getPackageConfigurationDetail,
  getPackageConfigurations,
  getPricingRuleDetail,
  getPricingRules,
  getProductTypeDetail,
  getProductTypes,
  getRestrictedItemDetail,
  getRestrictedItems,
  getServicePricingDetail,
  getServicePricings,
  getShippingMethodDetail,
  getShippingMethods,
  getShippingRouteDetail,
  getShippingRoutes,
  getSupplierDetail,
  getSuppliers,
  getUnitOfMeasureDetail,
  getUnitsOfMeasure,
  updateAdditionalServiceFee,
  updateExchangeRate,
  updatePackageConfiguration,
  updatePricingRule,
  updateProductType,
  updateRestrictedItem,
  updateServicePricing,
  updateShippingMethod,
  updateShippingRoute,
  updateSupplier,
  updateUnitOfMeasure,
} from "@features/catalog/api/catalogAdminService";
