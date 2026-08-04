import AdminResourcePage from "./AdminResourcePage";
import {
  createAdditionalServiceFee, createCarrier, createPackageConfiguration,
  createPricingRule, createProductType, createRestrictedItem, createServicePricing,
  createShippingMethod, createShippingRoute, createSupplier, createUnitOfMeasure,
  createWarehouse, deleteAdditionalServiceFee, deleteCarrier, deletePackageConfiguration,
  deletePricingRule, deleteProductType, deleteRestrictedItem, deleteServicePricing,
  deleteShippingMethod, deleteShippingRoute, deleteSupplier, deleteUnitOfMeasure,
  deleteWarehouse, getAdditionalServiceFeeDetail, getAdditionalServiceFees,
  getCarrierDetail, getCarriers, getPackageConfigurationDetail, getPackageConfigurations,
  getPricingRuleDetail, getPricingRules, getProductTypeDetail, getProductTypes,
  getRestrictedItemDetail, getRestrictedItems,
  getServicePricingDetail, getServicePricings, getShippingMethodDetail, getShippingMethods,
  getShippingRouteDetail, getShippingRoutes, getSupplierDetail, getSuppliers,
  getUnitOfMeasureDetail, getUnitsOfMeasure,
  getWarehouses, updateAdditionalServiceFee, updateCarrier, updatePackageConfiguration,
  updatePricingRule, updateProductType, updateRestrictedItem, updateServicePricing,
  updateShippingMethod, updateShippingRoute, updateSupplier, updateUnitOfMeasure,
  updateWarehouse,
} from "../../api/AdminAPI/adminService";

const boolField = { name: "isActive", label: "Đang hoạt động", type: "switch", defaultValue: true };
const statusField = { name: "status", label: "Trạng thái", type: "select", defaultValue: "ACTIVE", options: [
  { value: "ACTIVE", label: "Đang hoạt động" }, { value: "INACTIVE", label: "Ngừng hoạt động" },
] };
const page = (props) => <AdminResourcePage {...props} />;

const warehouseApi = { list: getWarehouses, create: createWarehouse, update: updateWarehouse, remove: deleteWarehouse };
export const WarehousesAdminPage = () => page({
  title: "Quản lý kho", singular: "kho", description: "Dữ liệu kho được đồng bộ trực tiếp từ hệ thống.",
  searchFields: ["name", "code", "address", "region"], api: warehouseApi,
  columns: [{ name: "name", label: "Tên kho" }, { name: "code", label: "Mã kho" }, { name: "region", label: "Khu vực", filterable: true }, { name: "warehouseType", label: "Loại kho", type: "tag" }, { ...boolField, type: "active" }],
  fields: [{ name: "name", label: "Tên kho", required: true }, { name: "code", label: "Mã kho", required: true }, { name: "address", label: "Địa chỉ", type: "textarea", span: 2, required: true }, { name: "region", label: "Khu vực" }, { name: "warehouseType", label: "Loại kho", type: "select", required: true, options: ["ORIGIN", "DESTINATION", "TRANSIT"].map(value => ({ value, label: value })) }, boolField],
});

const carrierApi = { list: getCarriers, detail: getCarrierDetail, create: createCarrier, update: updateCarrier, remove: deleteCarrier };
export const CarriersAdminPage = () => page({
  title: "Đơn vị vận chuyển", singular: "đơn vị vận chuyển", description: "Quản lý đối tác vận chuyển và thông tin kết nối.", searchFields: ["carrierName", "carrierCode", "carrierType", "contactEmail"], api: carrierApi,
  columns: [{ name: "carrierName", label: "Tên đơn vị" }, { name: "carrierCode", label: "Mã" }, { name: "carrierType", label: "Loại", type: "tag" }, { name: "contactEmail", label: "Email" }, { ...boolField, type: "active" }],
  fields: [{ name: "carrierName", label: "Tên đơn vị", required: true }, { name: "carrierCode", label: "Mã đơn vị", required: true }, { name: "carrierType", label: "Loại đơn vị" }, { name: "apiUrl", label: "API URL", type: "url" }, { name: "contactEmail", label: "Email", type: "email" }, { name: "contactPhone", label: "Số điện thoại" }, { name: "supportedShippingMethods", label: "Phương thức hỗ trợ" }, { name: "supportedRegions", label: "Khu vực hỗ trợ" }, { name: "internalNotes", label: "Ghi chú nội bộ", type: "textarea", span: 2 }, boolField],
});

const shippingApi = { list: getShippingMethods, detail: getShippingMethodDetail, create: createShippingMethod, update: updateShippingMethod, remove: deleteShippingMethod };
export const ShippingMethodsAdminPage = () => page({
  title: "Phương thức vận chuyển", singular: "phương thức vận chuyển", description: "Danh mục phương thức vận chuyển lấy trực tiếp từ API.", searchFields: ["methodName", "methodCode", "description"], api: shippingApi,
  columns: [{ name: "methodName", label: "Tên phương thức" }, { name: "methodCode", label: "Mã" }, { name: "estimatedTransitTime", label: "Thời gian dự kiến" }, { ...boolField, type: "active" }],
  fields: [{ name: "methodName", label: "Tên phương thức", required: true }, { name: "methodCode", label: "Mã phương thức", required: true }, { name: "estimatedTransitTime", label: "Thời gian dự kiến" }, { name: "applicableCondition", label: "Điều kiện áp dụng" }, { name: "description", label: "Mô tả", type: "textarea", span: 2 }, { name: "internalNote", label: "Ghi chú nội bộ", type: "textarea", span: 2 }, boolField],
});

const packageApi = { list: getPackageConfigurations, detail: getPackageConfigurationDetail, create: createPackageConfiguration, update: updatePackageConfiguration, remove: deletePackageConfiguration };
export const PackageConfigurationsAdminPage = () => page({
  title: "Cấu hình đóng gói", singular: "cấu hình đóng gói", description: "Quản lý kích thước, tải trọng và phí đóng gói.", searchFields: ["configName", "configCode", "status"], api: packageApi,
  columns: [{ name: "configName", label: "Tên cấu hình" }, { name: "configCode", label: "Mã" }, { name: "dimensions", label: "Kích thước", type: "dimensions" }, { name: "maxWeight", label: "Tải trọng", type: "weight" }, { name: "packageFee", label: "Phí", type: "money" }, { ...statusField, type: "status" }],
  fields: [{ name: "configName", label: "Tên cấu hình", required: true }, { name: "configCode", label: "Mã cấu hình", required: true }, ...["length", "width", "height", "maxWeight", "packageFee"].map(name => ({ name, label: ({ length: "Dài (cm)", width: "Rộng (cm)", height: "Cao (cm)", maxWeight: "Tải trọng (kg)", packageFee: "Phí đóng gói" })[name], type: "number", min: 0 })), statusField],
});

const feeApi = { list: getAdditionalServiceFees, detail: getAdditionalServiceFeeDetail, create: createAdditionalServiceFee, update: updateAdditionalServiceFee, remove: deleteAdditionalServiceFee };
export const AdditionalServiceFeesAdminPage = () => page({
  title: "Phí dịch vụ bổ sung", singular: "phí dịch vụ", description: "Quản lý các khoản phí bổ sung từ API.", searchFields: ["feeName", "feeCode", "calculationType"], api: feeApi,
  columns: [{ name: "feeName", label: "Tên phí" }, { name: "feeCode", label: "Mã" }, { name: "calculationType", label: "Cách tính", type: "tag" }, { name: "value", label: "Giá trị", type: "number" }, { name: "unit", label: "Đơn vị" }, { ...boolField, type: "active" }],
  fields: [{ name: "feeName", label: "Tên phí", required: true }, { name: "feeCode", label: "Mã phí", required: true }, { name: "calculationType", label: "Cách tính", type: "select", required: true, options: ["FIXED", "PERCENTAGE", "PER_KG", "PER_CBM", "PER_PRODUCT"].map(value => ({ value, label: value })) }, { name: "value", label: "Giá trị", type: "number", min: 0, required: true }, { name: "unit", label: "Đơn vị" }, { name: "description", label: "Mô tả", type: "textarea", span: 2 }, boolField],
});

const pricingApi = { list: getServicePricings, detail: getServicePricingDetail, create: createServicePricing, update: updateServicePricing, remove: deleteServicePricing };
export const ServicePricingsAdminPage = () => page({
  title: "Bảng giá vận chuyển", singular: "bảng giá", description: "Đơn giá theo tuyến và loại dịch vụ từ backend.", searchFields: ["serviceType", "originCountry", "destinationCountry", "carrierId"], api: pricingApi,
  columns: [{ name: "serviceType", label: "Dịch vụ", filterable: true }, { name: "route", label: "Tuyến", type: "route" }, { name: "unitType", label: "Đơn vị", type: "tag" }, { name: "price", label: "Đơn giá", type: "money" }, { name: "effectiveDate", label: "Hiệu lực", type: "date" }],
  fields: [{ name: "carrierId", label: "Mã đơn vị vận chuyển", required: true }, { name: "serviceType", label: "Loại dịch vụ", required: true }, { name: "originCountry", label: "Nước đi", required: true }, { name: "destinationCountry", label: "Nước đến", required: true }, { name: "unitType", label: "Đơn vị tính", required: true }, { name: "price", label: "Đơn giá", type: "number", min: 0, required: true }, { name: "currency", label: "Tiền tệ", defaultValue: "VND", required: true }, { name: "effectiveDate", label: "Ngày hiệu lực", type: "datetime-local", required: true }],
});

const ruleApi = { list: getPricingRules, detail: getPricingRuleDetail, create: createPricingRule, update: updatePricingRule, remove: deletePricingRule };
export const PricingRulesAdminPage = () => page({
  title: "Quy tắc tính giá", singular: "quy tắc tính giá", description: "Quản lý điều kiện và công thức phụ phí.", searchFields: ["ruleName", "ruleCode", "ruleType", "status"], api: ruleApi,
  columns: [{ name: "ruleName", label: "Tên quy tắc" }, { name: "ruleCode", label: "Mã" }, { name: "ruleType", label: "Loại", type: "tag" }, { name: "calculationType", label: "Cách tính", type: "tag" }, { name: "value", label: "Giá trị", type: "number" }, { ...statusField, type: "status" }],
  fields: [{ name: "servicePricingId", label: "Mã bảng giá", required: true }, { name: "ruleName", label: "Tên quy tắc", required: true }, { name: "ruleCode", label: "Mã quy tắc", required: true }, { name: "ruleType", label: "Loại quy tắc", required: true }, { name: "conditionType", label: "Loại điều kiện" }, { name: "conditionValue", label: "Giá trị điều kiện" }, { name: "calculationType", label: "Cách tính", required: true }, ...["value", "minAmount", "maxAmount"].map(name => ({ name, label: ({ value: "Giá trị", minAmount: "Tối thiểu", maxAmount: "Tối đa" })[name], type: "number", min: 0 })), { name: "isRequired", label: "Bắt buộc", type: "switch" }, statusField, { name: "description", label: "Mô tả", type: "textarea", span: 2 }],
});

const restrictedApi = { list: getRestrictedItems, detail: getRestrictedItemDetail, create: createRestrictedItem, update: updateRestrictedItem, remove: deleteRestrictedItem };
export const RestrictedItemsAdminPage = () => page({
  title: "Hàng cấm và hạn chế", singular: "mặt hàng", description: "Danh mục kiểm soát hàng hóa theo quốc gia.", searchFields: ["itemName", "country", "restrictionType", "note"], api: restrictedApi,
  columns: [{ name: "itemName", label: "Tên mặt hàng" }, { name: "country", label: "Quốc gia", filterable: true }, { name: "restrictionType", label: "Mức kiểm soát", type: "restriction" }, { name: "note", label: "Ghi chú" }, { ...boolField, type: "active" }],
  fields: [{ name: "itemName", label: "Tên mặt hàng", required: true }, { name: "country", label: "Quốc gia", required: true }, { name: "restrictionType", label: "Mức kiểm soát", type: "select", required: true, options: ["BANNED", "RESTRICTED", "WARNING"].map(value => ({ value, label: value })) }, { name: "note", label: "Ghi chú", type: "textarea", span: 2 }, boolField],
});

const productTypeApi = { list: getProductTypes, detail: getProductTypeDetail, create: createProductType, update: updateProductType, remove: deleteProductType };
export const ProductTypesAdminPage = () => page({
  title: "Loại hàng", singular: "loại hàng", description: "Danh mục loại hàng hóa và thuế nhập khẩu.", searchFields: ["name"], api: productTypeApi,
  columns: [{ name: "name", label: "Tên loại hàng" }, { name: "importTaxRate", label: "Thuế NK", type: "number" }, { ...boolField, type: "active" }],
  fields: [{ name: "name", label: "Tên loại hàng", required: true }, { name: "importTaxRate", label: "Thuế nhập khẩu (%)", type: "number", min: 0, max: 100 }, boolField],
});

const unitApi = { list: getUnitsOfMeasure, detail: getUnitOfMeasureDetail, create: createUnitOfMeasure, update: updateUnitOfMeasure, remove: deleteUnitOfMeasure };
export const UnitsOfMeasureAdminPage = () => page({
  title: "Đơn vị tính", singular: "đơn vị tính", description: "Danh mục đơn vị tính cho khai báo hàng hóa.", searchFields: ["unitCode", "unitName", "description"], api: unitApi,
  columns: [{ name: "unitCode", label: "Mã" }, { name: "unitName", label: "Tên đơn vị" }, { name: "displayOrder", label: "Thứ tự", type: "number" }, { ...boolField, type: "active" }],
  fields: [{ name: "unitCode", label: "Mã đơn vị", required: true }, { name: "unitName", label: "Tên đơn vị", required: true }, { name: "description", label: "Mô tả", type: "textarea", span: 2 }, { name: "displayOrder", label: "Thứ tự hiển thị", type: "number", min: 0, max: 999 }, boolField],
});

const supplierApi = { list: getSuppliers, detail: getSupplierDetail, create: createSupplier, update: updateSupplier, remove: deleteSupplier };
export const SuppliersAdminPage = () => page({
  title: "Nhà cung cấp", singular: "nhà cung cấp", description: "Danh mục đối tác trung chuyển và lấy hàng.", searchFields: ["supplierName", "supplierCode", "supplierType", "country", "email"], api: supplierApi,
  columns: [{ name: "supplierName", label: "Tên nhà cung cấp" }, { name: "supplierCode", label: "Mã" }, { name: "supplierType", label: "Loại", type: "tag" }, { name: "country", label: "Quốc gia", filterable: true }, { ...boolField, type: "active" }],
  fields: [{ name: "supplierName", label: "Tên nhà cung cấp", required: true }, { name: "supplierCode", label: "Mã nhà cung cấp", required: true }, { name: "supplierType", label: "Loại nhà cung cấp", required: true }, { name: "country", label: "Quốc gia" }, { name: "contactPerson", label: "Người liên hệ" }, { name: "phone", label: "Điện thoại" }, { name: "email", label: "Email", type: "email" }, { name: "address", label: "Địa chỉ", type: "textarea", span: 2 }, { name: "note", label: "Ghi chú", type: "textarea", span: 2 }, boolField],
});

const shippingRouteApi = { list: getShippingRoutes, detail: getShippingRouteDetail, create: createShippingRoute, update: updateShippingRoute, remove: deleteShippingRoute };
export const ShippingRoutesAdminPage = () => page({
  title: "Tuyến vận chuyển quốc tế", singular: "tuyến vận chuyển", description: "Cấu hình tuyến, phương thức và nhà cung cấp trung chuyển.", searchFields: ["routeName", "routeCode", "transportMode", "originCountry", "destinationCountry"], api: shippingRouteApi,
  columns: [{ name: "routeName", label: "Tên tuyến" }, { name: "routeCode", label: "Mã" }, { name: "route", label: "Tuyến", type: "route" }, { name: "transportMode", label: "Phương thức", type: "tag" }, { name: "estimatedTransitDays", label: "Số ngày", type: "number" }, { ...boolField, type: "active" }],
  fields: [{ name: "routeName", label: "Tên tuyến", required: true }, { name: "routeCode", label: "Mã tuyến", required: true }, { name: "originCountry", label: "Nước đi", type: "select", required: true, options: [{ value: "CN", label: "CN — Trung Quốc" }, { value: "VN", label: "VN — Việt Nam" }, { value: "KR", label: "KR — Hàn Quốc" }, { value: "JP", label: "JP — Nhật Bản" }] }, { name: "destinationCountry", label: "Nước đến", type: "select", required: true, options: [{ value: "CN", label: "CN — Trung Quốc" }, { value: "VN", label: "VN — Việt Nam" }, { value: "KR", label: "KR — Hàn Quốc" }, { value: "JP", label: "JP — Nhật Bản" }] }, { name: "transportMode", label: "Phương thức vận chuyển", type: "select", required: true, options: ["AIR", "SEA", "ROAD", "RAIL"].map(value => ({ value, label: value })) }, { name: "originWarehouseId", label: "Kho đi", type: "select", optionsApi: getWarehouses, mapOption: (warehouse) => ({ value: warehouse.id || warehouse.warehouseId, label: warehouse.name || warehouse.code }) }, { name: "destinationWarehouseId", label: "Kho đến", type: "select", optionsApi: getWarehouses, mapOption: (warehouse) => ({ value: warehouse.id || warehouse.warehouseId, label: warehouse.name || warehouse.code }) }, { name: "carrierId", label: "Đơn vị vận chuyển", type: "select", optionsApi: getCarriers, mapOption: (carrier) => ({ value: carrier.id || carrier.carrierId, label: carrier.carrierName || carrier.carrierCode }) }, { name: "supplierId", label: "Nhà cung cấp", type: "select", optionsApi: getSuppliers, mapOption: (supplier) => ({ value: supplier.id || supplier.supplierId, label: supplier.supplierName || supplier.supplierCode }) }, { name: "estimatedTransitDays", label: "Số ngày vận chuyển dự kiến", type: "number", min: 0 }, { name: "note", label: "Ghi chú", type: "textarea", span: 2 }, boolField],
});
