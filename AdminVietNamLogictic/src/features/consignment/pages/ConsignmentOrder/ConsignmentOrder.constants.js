/*
 * Dữ liệu tĩnh của màn hình tạo đơn ký gửi.
 * Tách khỏi ConsignmentOrder.jsx để phần logic màn hình không bị lẫn với
 * các bảng tra, danh sách option và state khởi tạo vốn không bao giờ đổi.
 */

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGES_PER_PACKAGE = 5;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const PACKAGE_NUMBER_FIELDS = [
  {
    field: "weight",
    label: "CÂN NẶNG KIỆN HÀNG (KG)",
    tooltip: "Nhập tổng cân nặng của kiện hàng theo đơn vị kilogram (kg).",
    placeholder: "Nhập cân nặng...",
  },
  {
    field: "length",
    label: "DÀI (CM)",
    tooltip: "Nhập chiều dài của kiện hàng theo đơn vị centimet (cm).",
    placeholder: "Nhập chiều dài...",
  },
  {
    field: "width",
    label: "RỘNG (CM)",
    tooltip: "Nhập chiều rộng của kiện hàng theo đơn vị centimet (cm).",
    placeholder: "Nhập chiều rộng...",
  },
  {
    field: "height",
    label: "CAO (CM)",
    tooltip: "Nhập chiều cao của kiện hàng theo đơn vị centimet (cm).",
    placeholder: "Nhập chiều cao...",
  },
];

/**
 * Nguyện vọng của khách khi hàng cập kho VN. Để rỗng là "chưa chọn" — hợp lệ, không bắt buộc.
 */
export const DESTINATION_HANDLING_OPTIONS = [
  { value: "DIRECT_DELIVERY", label: "Giao ngay khi về Việt Nam" },
  { value: "STORE_AT_VN", label: "Gửi lại kho Việt Nam (có phí lưu kho)" },
];

export const INITIAL_FORM = {
  route: "",
  shippingOption: "",
  receiverName: "",
  receiverPhone: "",
  selectedDeliveryAddress: "",
  note: "",
  defaultDestinationHandling: "",
  inspectPackage: true,
  optionalServices: {
    requiresPacking: false,
    requiresWoodenCrate: false,
    requiresInsurance: false,
    requiresInspection: false,

    // Giữ lại dữ liệu rule đã chọn để tương thích component dịch vụ động.
    selectedRuleCodes: [],
    selectedPricingRuleIds: [],
    packageConfigurationByPackageId: {},
    selectedPackageConfigurations: [],
    woodCrateBaseFeePerPackage: 0,
    woodCrateOrderFee: 0,
    woodCrateBaseFee: 0,
    woodCrateConfigurationFee: 0,
    woodCrateTotalFee: 0,
    woodCrateCompleted: false,
  },
};

export const UPLOAD_URL_KEYS = [
  "url",
  "imageUrl",
  "imageURL",
  "fileUrl",
  "fileURL",
  "secureUrl",
  "secureURL",
  "downloadUrl",
  "downloadURL",
  "location",
  "path",
];

export const UPLOAD_CONTAINER_KEYS = [
  "urls",
  "imageUrls",
  "imageURLs",
  "fileUrls",
  "fileURLs",
  "paths",
  "files",
  "images",
  "items",
  "result",
  "results",
  "data",
];
