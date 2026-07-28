import AdminResourcePage from "./AdminResourcePage";
import {
  createAdditionalServiceFee, createCarrier, createPackageConfiguration,
  createPricingRule, createRestrictedItem, createServicePricing, createShippingMethod,
  createWarehouse, deleteAdditionalServiceFee, deleteCarrier, deletePackageConfiguration,
  deletePricingRule, deleteRestrictedItem, deleteServicePricing, deleteShippingMethod,
  deleteWarehouse, getAdditionalServiceFeeDetail, getAdditionalServiceFees,
  getCarrierDetail, getCarriers, getPackageConfigurationDetail, getPackageConfigurations,
  getPricingRuleDetail, getPricingRules, getRestrictedItemDetail, getRestrictedItems,
  getServicePricingDetail, getServicePricings, getShippingMethodDetail, getShippingMethods,
  getWarehouses, updateAdditionalServiceFee, updateCarrier, updatePackageConfiguration,
  updatePricingRule, updateRestrictedItem, updateServicePricing, updateShippingMethod,
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
  columns: [{ name: "name", label: "Tên kho" }, { name: "code", label: "Mã kho" }, { name: "region", label: "Khu vực" }, { name: "warehouseType", label: "Loại kho", type: "tag" }, { ...boolField, type: "active" }],
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
  columns: [{ name: "serviceType", label: "Dịch vụ" }, { name: "route", label: "Tuyến", type: "route" }, { name: "unitType", label: "Đơn vị", type: "tag" }, { name: "price", label: "Đơn giá", type: "money" }, { name: "effectiveDate", label: "Hiệu lực", type: "date" }],
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
  columns: [{ name: "itemName", label: "Tên mặt hàng" }, { name: "country", label: "Quốc gia" }, { name: "restrictionType", label: "Mức kiểm soát", type: "restriction" }, { name: "note", label: "Ghi chú" }, { ...boolField, type: "active" }],
  fields: [{ name: "itemName", label: "Tên mặt hàng", required: true }, { name: "country", label: "Quốc gia", required: true }, { name: "restrictionType", label: "Mức kiểm soát", type: "select", required: true, options: ["BANNED", "RESTRICTED", "WARNING"].map(value => ({ value, label: value })) }, { name: "note", label: "Ghi chú", type: "textarea", span: 2 }, boolField],
});
