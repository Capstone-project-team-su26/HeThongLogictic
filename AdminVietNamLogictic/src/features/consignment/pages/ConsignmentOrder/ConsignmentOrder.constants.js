/*
 * Dữ liệu tĩnh của màn hình tạo đơn ký gửi.
 * Tách khỏi ConsignmentOrder.jsx để phần logic màn hình không bị lẫn với
 * các bảng tra, danh sách option và state khởi tạo vốn không bao giờ đổi.
 */

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGES_PER_PACKAGE = 5;

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/*
 * Bốn ô số nằm cùng một hàng nên rất hẹp: placeholder dài bị cắt giữa chừng. Giới hạn đưa
 * lên gợi ý cạnh nhãn để Sale luôn đọc được, placeholder chỉ còn ví dụ số.
 * Con số giới hạn KHÔNG ghi cứng ở đây: `limitKey` trỏ vào giới hạn Admin cấu hình
 * (GET /api/system-settings/order-limits), màn hình tự dựng câu gợi ý / tooltip.
 */
export const PACKAGE_NUMBER_FIELDS = [
  {
    field: "weight",
    label: "CÂN NẶNG (KG)",
    limitKey: "maxParcelWeightKg",
    unit: "kg",
    hintSuffix: " / kiện",
    tooltip: "Nhập tổng cân nặng của kiện hàng",
    placeholder: "VD: 1.5",
  },
  {
    field: "length",
    label: "DÀI (CM)",
    limitKey: "maxParcelLengthCm",
    unit: "cm",
    hintSuffix: "",
    tooltip: "Nhập chiều dài của kiện hàng",
    placeholder: "VD: 40",
  },
  {
    field: "width",
    label: "RỘNG (CM)",
    limitKey: "maxParcelWidthCm",
    unit: "cm",
    hintSuffix: "",
    tooltip: "Nhập chiều rộng của kiện hàng",
    placeholder: "VD: 30",
  },
  {
    field: "height",
    label: "CAO (CM)",
    limitKey: "maxParcelHeightCm",
    unit: "cm",
    hintSuffix: "",
    tooltip: "Nhập chiều cao của kiện hàng",
    placeholder: "VD: 20",
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
  /*
   * Khách hàng được tạo đơn hộ. `customerId` là Customer.Id THẬT — POST
   * /api/staff/consignments tra khách bằng đúng khoá này. `customer` chỉ giữ bản ghi
   * đã chọn để vẽ thẻ "Đang tạo đơn cho ..."; không có mặt trong payload gửi đi.
   */
  customerId: "",
  customer: null,

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
