/*
 * Hằng tĩnh của trang ServicePricings: theme ConfigProvider, hai danh sách
 * option cho bộ lọc và ba từ điển nhãn tiếng Việt.
 *
 * Tách khỏi ServicePricings.jsx vì đây là dữ liệu chết — không đọc state/props,
 * không đổi giữa các lần render — nên để chung với JSX chỉ làm loãng phần logic
 * thật sự của trang. Giá trị giữ nguyên từng ký tự để giao diện không đổi.
 */

/* Font stack dùng lại nguyên bản của trang, gộp sẵn thành chuỗi cho antd. */
export const SERVICE_PRICINGS_FONT_FAMILY = [
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(", ");

/* Theme riêng của trang: bọc toàn bộ màn hình qua ConfigProvider. */
export const SERVICE_PRICINGS_THEME = {
  token: {
    fontFamily:
      SERVICE_PRICINGS_FONT_FAMILY,
    fontSize: 14,
    lineHeight: 1.5,
    colorText: "#172033",
    colorTextSecondary: "#526176",
    borderRadius: 11,
    controlHeight: 42,
  },

  components: {
    Button: {
      fontWeight: 600,
      controlHeight: 42,
    },

    Input: {
      fontSize: 14,
      activeShadow: "none",
    },

    Select: {
      fontSize: 14,
      optionFontSize: 14,
    },

    Tabs: {
      titleFontSize: 14,
      horizontalItemPadding: "12px 0",
    },

    Modal: {
      titleFontSize: 18,
      titleLineHeight: 1.4,
    },

    Tag: {
      fontSize: 12,
      lineHeight: 1.5,
    },

    Tooltip: {
      fontSize: 13,
    },
  },
};

/* Option cho hai Select lọc ở thanh công cụ; "ALL" là giá trị mặc định. */
export const SERVICE_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả dịch vụ",
  },
  {
    value: "Express",
    label: "Hỏa tốc",
  },
  {
    value: "Standard",
    label: "Tiêu chuẩn",
  },
  {
    value: "Economy",
    label: "Tiết kiệm",
  },
];

export const COUNTRY_OPTIONS = [
  {
    value: "ALL",
    label: "Tất cả quốc gia",
  },
  {
    value: "CN",
    label: "Trung Quốc",
  },
  {
    value: "KR",
    label: "Hàn Quốc",
  },
  {
    value: "JP",
    label: "Nhật Bản",
  },
  {
    value: "VN",
    label: "Việt Nam",
  },
];

/* Ba bảng tra nhãn: khoá là mã viết hoa từ dữ liệu, giá trị là nhãn hiển thị. */
export const UNIT_TYPE_LABELS = {
  KG: "Theo kg",
  KILOGRAM: "Theo kg",
  M3: "Theo m³",
  CBM: "Theo m³",
  PACKAGE: "Theo kiện",
  PARCEL: "Theo kiện",
  ORDER: "Theo đơn",
  ITEM: "Theo sản phẩm",
  BOX: "Theo thùng",
};

export const RULE_CODE_LABELS = {
  WOOD_CRATE: "Phí đóng thùng gỗ",
  DOMESTIC_FEE:
    "Phí vận chuyển nội địa",
  VAT: "Thuế giá trị gia tăng",
  VOLUMETRIC_DIVISOR:
    "Hệ số khối lượng thể tích",
  MIN_WEIGHT: "Cân tối thiểu",
  SUR_INSPECTION:
    "Phụ phí kiểm hàng",
  IMPORT_TAX: "Thuế nhập khẩu",
  SUR_INSURANCE_3PERCENT:
    "Phụ phí bảo hiểm",
};

export const RULE_TYPE_LABELS = {
  WOOD_BOX: "Đóng kiện gỗ",
  WOOD_CRATE: "Đóng kiện gỗ",
  DOMESTIC: "Vận chuyển nội địa",
  DOMESTIC_FEE:
    "Vận chuyển nội địa",
  VAT: "Thuế giá trị gia tăng",
  TAX: "Thuế và nghĩa vụ",
  VOLUMETRIC:
    "Khối lượng thể tích",
  VOLUMETRIC_WEIGHT:
    "Khối lượng thể tích",
  VOLUMETRIC_DIVISOR:
    "Khối lượng thể tích",
  MIN_WEIGHT: "Cân tối thiểu",
  INSPECTION: "Kiểm hàng",
  IMPORT_TAX: "Thuế nhập khẩu",
  INSURANCE: "Bảo hiểm",
  SURCHARGE: "Phụ phí",
};
