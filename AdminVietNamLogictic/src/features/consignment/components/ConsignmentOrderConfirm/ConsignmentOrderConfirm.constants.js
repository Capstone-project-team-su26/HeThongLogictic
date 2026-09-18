/*
 * Bảng tra tĩnh dùng chung cho màn hình xác nhận đơn ký gửi.
 * Tách riêng để phần hiển thị không bị chôn dưới hàng trăm dòng dữ liệu,
 * và để thêm/sửa nhãn tiếng Việt mà không phải mở file component.
 */

export const SERVICE_LABELS = {
  WOOD_CRATE: "Đóng thùng gỗ",
  WOOD_BOX: "Đóng thùng gỗ",
  DOMESTIC_FEE: "Phí vận chuyển nội địa",
  DOMESTIC_SHIPPING_FEE:
    "Phí vận chuyển nội địa",
  LOCAL_FREIGHT:
    "Phí vận chuyển nội địa",
  LOCAL_FREIGHT_TEMP:
    "Phí vận chuyển nội địa",
  SUR_INSPECTION: "Phụ phí kiểm hàng",
  INSPECTION: "Kiểm hàng",
  CHECKING: "Kiểm hàng",
  SUR_INSURANCE_3PERCENT:
    "Bảo hiểm hàng hóa 3%",
  INSURANCE: "Bảo hiểm hàng hóa",
  PACKING: "Đóng gói hàng hóa",
  REPACKING: "Đóng gói lại hàng hóa",
  FRAGILE: "Phụ phí hàng dễ vỡ",
  STORAGE: "Phí lưu kho",
  CUSTOMS: "Dịch vụ khai báo hải quan",
};

export const SERVICE_DESCRIPTIONS = {
  WOOD_CRATE:
    "Đóng thùng gỗ chuyên dụng để bảo vệ hàng cồng kềnh, dễ vỡ hoặc có giá trị cao.",
  WOOD_BOX:
    "Đóng thùng gỗ chuyên dụng để bảo vệ hàng cồng kềnh, dễ vỡ hoặc có giá trị cao.",
  DOMESTIC_FEE:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  DOMESTIC_SHIPPING_FEE:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  LOCAL_FREIGHT:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  LOCAL_FREIGHT_TEMP:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  SUR_INSPECTION:
    "Nhân viên kiểm tra tình trạng, số lượng và thông tin hàng hóa theo yêu cầu.",
  INSPECTION:
    "Nhân viên kiểm tra tình trạng, số lượng và thông tin hàng hóa theo yêu cầu.",
  SUR_INSURANCE_3PERCENT:
    "Bảo hiểm hàng hóa được tính theo tỷ lệ phần trăm trên giá trị khai báo.",
  INSURANCE:
    "Bảo hiểm hỗ trợ giảm rủi ro mất mát hoặc hư hỏng trong quá trình vận chuyển.",
  PACKING:
    "Đóng gói lại hàng hóa để phù hợp với yêu cầu vận chuyển.",
  REPACKING:
    "Đóng gói lại hàng hóa để phù hợp với yêu cầu vận chuyển.",
  FRAGILE:
    "Phụ phí xử lý riêng đối với hàng hóa dễ vỡ.",
  STORAGE:
    "Chi phí lưu giữ hàng hóa tại kho trong thời gian quy định.",
  CUSTOMS:
    "Hỗ trợ chuẩn bị và khai báo thông tin hải quan cho lô hàng.",
};

export const SHIPPING_OPTION_LABELS = {
  STANDARD: "Tiêu chuẩn",
  EXPRESS: "Hỏa tốc",
  ECONOMY: "Tiết kiệm",
  FAST: "Nhanh",
  SUPER_EXPRESS: "Siêu tốc",
  AIR: "Đường hàng không",
  AIR_FREIGHT: "Đường hàng không",
  SEA: "Đường biển",
  SEA_FREIGHT: "Đường biển",
  ROAD: "Đường bộ",
  RAIL: "Đường sắt",
};

export const ROUTE_LABELS = {
  CHINA_VIETNAM: "Trung Quốc → Việt Nam",
  KOREA_VIETNAM: "Hàn Quốc → Việt Nam",
  JAPAN_VIETNAM: "Nhật Bản → Việt Nam",
  USA_VIETNAM: "Hoa Kỳ → Việt Nam",
  US_VIETNAM: "Hoa Kỳ → Việt Nam",
  THAILAND_VIETNAM: "Thái Lan → Việt Nam",
  SINGAPORE_VIETNAM: "Singapore → Việt Nam",
};

export const PRODUCT_TYPE_LABELS = {
  ELECTRONICS: "Điện tử và công nghệ",
  ELECTRONIC: "Điện tử và công nghệ",
  CLOTHING: "Quần áo",
  FASHION: "Thời trang",
  COSMETICS: "Mỹ phẩm",
  BEAUTY: "Sản phẩm làm đẹp",
  FOOD: "Thực phẩm",
  DRINK: "Đồ uống",
  MEDICINE: "Dược phẩm",
  PHARMACEUTICAL: "Dược phẩm",
  HOUSEHOLD: "Đồ gia dụng",
  HOME_APPLIANCE: "Thiết bị gia dụng",
  ACCESSORIES: "Phụ kiện",
  SHOES: "Giày dép",
  BOOKS: "Sách và văn phòng phẩm",
  TOYS: "Đồ chơi",
  FRAGILE: "Hàng dễ vỡ",
  OTHER: "Hàng hóa khác",
};

export const CONDITION_UNIT_LABELS = {
  "VND/KIỆN": "kiện",
  "VND/PACKAGE": "kiện",
  "VND/ĐƠN": "đơn",
  "VND/ORDER": "đơn",
  "VND/KG": "kg",
  "VND/SẢN_PHẨM": "sản phẩm",
  "VND/ITEM": "sản phẩm",
  "VND/CBM": "m³",
  "VND/M3": "m³",
};

export const PACKAGE_CONFIGURATION_LABELS = {
  SMALL: {
    name: "Thùng cỡ nhỏ",
    size: "CỠ NHỎ",
  },
  MEDIUM: {
    name: "Thùng cỡ vừa",
    size: "CỠ VỪA",
  },
  LARGE: {
    name: "Thùng cỡ lớn",
    size: "CỠ LỚN",
  },
  CUSTOM: {
    name: "Thùng tùy chỉnh",
    size: "TÙY CHỈNH",
  },
};

export const HIDDEN_SERVICE_CODES = new Set([
  "VOLUMETRIC_DIVISOR",
]);
