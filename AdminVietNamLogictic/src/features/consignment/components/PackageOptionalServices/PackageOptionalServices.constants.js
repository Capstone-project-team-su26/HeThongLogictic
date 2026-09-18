/*
 * Dữ liệu tĩnh của PackageOptionalServices: mã nghiệp vụ, danh sách ẩn và
 * các từ điển nhãn tiếng Việt.
 *
 * Tách khỏi component vì đây là bảng tra thuần dữ liệu, không phụ thuộc state,
 * và cần được sửa/đọc độc lập với luồng render.
 */

export const ACTIVE_STATUS = "ACTIVE";
export const VOLUMETRIC_DIVISOR_CODE = "VOLUMETRIC_DIVISOR";
export const WOOD_CRATE_CODE = "WOOD_CRATE";
export const INSURANCE_CODE = "SUR_INSURANCE_3PERCENT";

/*
 * Các quy tắc chỉ dùng để hệ thống tính phí,
 * không hiển thị trong danh sách dịch vụ để khách hàng lựa chọn.
 */
export const HIDDEN_RULE_CODES = new Set([
  "DOMESTIC_FEE",
  /* Tham số cọc (ruleCode DEPOSIT_RATE, ruleType DEPOSIT) không phải dịch vụ để chọn. */
  "DEPOSIT_RATE",
  "DEPOSIT",
  /* Phí riêng của mua hộ (ruleType PURCHASE_FEE) không chào cho đơn ký gửi. */
  "PURCHASE_FEE",
  /* Phí gộp từ danh mục "phí dịch vụ bổ sung" cũ (ruleType SETTLEMENT_FEE) không phải dịch vụ để chọn. */
  "SETTLEMENT_FEE",
]);

/*
 * ID hiện tại của DOMESTIC_FEE.
 * Vẫn giữ kiểm tra theo ruleCode/ruleType để không phụ thuộc hoàn toàn vào ID.
 */
export const HIDDEN_RULE_IDS = new Set([
  "0385131b-214c-49b8-9de2-116d62f27111",
]);

export const STATUS_LABELS = {
  ACTIVE: "Đang áp dụng",
  INACTIVE: "Ngừng áp dụng",
  PENDING: "Chờ áp dụng",
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  EXPIRED: "Hết hiệu lực",
  DISABLED: "Tạm ngưng",
  DRAFT: "Bản nháp",
  DELETED: "Đã xóa",
};

export const CALCULATION_TYPE_LABELS = {
  FIXED: "Phí cố định",
  PERCENTAGE: "Tính theo phần trăm",
  PER_UNIT: "Tính theo đơn vị",
  RANGE: "Tính theo khoảng",
  FORMULA: "Tính theo công thức",
};

export const RULE_CODE_LABELS = {
  WOOD_CRATE: "Đóng thùng gỗ",
  DOMESTIC_FEE: "Phí vận chuyển nội địa",
  SUR_INSPECTION: "Phụ phí kiểm hàng",
  SUR_INSURANCE_3PERCENT: "Phụ phí bảo hiểm",
};

export const RULE_TYPE_LABELS = {
  WOOD_BOX: "Thùng gỗ",
  DOMESTIC_FEE: "Vận chuyển nội địa",
  INSPECTION: "Kiểm hàng",
  INSURANCE: "Bảo hiểm hàng hóa",
  PACKING: "Đóng gói hàng hóa",
};

export const CONDITION_TYPE_LABELS = {
  REQUIRES_INSPECTION: "Áp dụng khi yêu cầu kiểm hàng",
  MIN_DECLARED_VALUE: "Giá trị khai báo tối thiểu",
  MAX_DECLARED_VALUE: "Giá trị khai báo tối đa",
  REQUIRES_INSURANCE: "Áp dụng khi yêu cầu bảo hiểm",
};

export const LEGACY_RULE_KEYS = {
  WOOD_CRATE: "requiresWoodenCrate",
  SUR_INSURANCE_3PERCENT: "requiresInsurance",
  SUR_INSPECTION: "requiresInspection",
};
