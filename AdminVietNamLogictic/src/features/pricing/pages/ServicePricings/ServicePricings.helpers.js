/*
 * Hàm thuần phục vụ hiển thị của trang ServicePricings: chuẩn hoá chuỗi, dịch
 * mã sang nhãn tiếng Việt, ghép kích thước kiện và quy đổi ngoại tệ ước tính.
 *
 * Tách khỏi ServicePricings.jsx vì tất cả chỉ phụ thuộc vào tham số của chính
 * nó cùng các hằng cùng thư mục — không chạm state, props hay hook — nên đọc
 * và sửa ở đây an toàn hơn là lần giữa hơn nghìn dòng JSX.
 */

import {
  PRICING_RULE_CODE,
} from "@features/pricing/api/pricingRuleService.mock";
import {
  formatVnd,
} from "@features/pricing/api/servicePricingService.mock";

import {
  RULE_CODE_LABELS,
  RULE_TYPE_LABELS,
  UNIT_TYPE_LABELS,
} from "./ServicePricings.constants";

/* Mọi hàm dưới đây đều đi qua đây trước để null/undefined không lọt vào nhãn. */
export const normalizeText = (value) =>
  String(value ?? "").trim();

export const getUnitTypeDisplayName = (
  value
) => {
  const normalized =
    normalizeText(value).toUpperCase();

  return (
    UNIT_TYPE_LABELS[normalized] ||
    normalizeText(value) ||
    "Theo cấu hình"
  );
};

export const getRuleCodeDisplayName = (
  rule
) => {
  const code =
    normalizeText(
      rule?.ruleCode
    ).toUpperCase();

  return (
    RULE_CODE_LABELS[code] ||
    normalizeText(rule?.ruleName) ||
    "Quy tắc tính phí"
  );
};

export const getRuleTypeDisplayName = (
  value
) => {
  const normalized =
    normalizeText(value).toUpperCase();

  return (
    RULE_TYPE_LABELS[normalized] ||
    "Phụ phí theo cấu hình"
  );
};

/* Cấu hình CUSTOM không có số đo cố định nên hiện chữ thay vì "0 × 0 × 0". */
export const getPackageDimensionDisplay = (
  configuration
) => {
  const code =
    normalizeText(
      configuration?.configCode
    ).toUpperCase();

  if (code === "CUSTOM") {
    return "Theo kích thước thực tế";
  }

  const length =
    Number(configuration?.length) || 0;
  const width =
    Number(configuration?.width) || 0;
  const height =
    Number(configuration?.height) || 0;

  return `${length} × ${width} × ${height} cm`;
};

/* Quy tắc phần trăm và hệ số quy đổi không phải tiền, nên không format VNĐ. */
export const formatRuleValue = (rule) => {
  if (
    rule?.calculationType ===
    "PERCENTAGE"
  ) {
    return `${rule.value}%`;
  }

  if (
    rule?.ruleCode ===
    PRICING_RULE_CODE.VOLUMETRIC_DIVISOR
  ) {
    return new Intl.NumberFormat(
      "vi-VN"
    ).format(rule.value);
  }

  return formatVnd(rule?.value);
};

export const getRuleValueUnit = (rule) => {
  if (
    rule?.calculationType ===
    "PERCENTAGE"
  ) {
    return "Tỷ lệ";
  }

  if (
    rule?.ruleCode ===
    PRICING_RULE_CODE.VOLUMETRIC_DIVISOR
  ) {
    return "Hệ số";
  }

  return "Mức phí";
};

/* Đoán ngoại tệ theo tuyến rồi quy đổi; thiếu tỷ giá thì dùng mức mặc định. */
export const getForeignCurrencyEstimate = (vndPrice, origin, rates = []) => {
  const price = Number(vndPrice) || 0;
  if (price <= 0) return null;

  const originUpper = String(origin || "").toUpperCase();
  let code = "USD";
  let flag = "🇺🇸";

  if (originUpper.includes("KR") || originUpper.includes("KOREA") || originUpper.includes("HÀN")) {
    code = "KRW";
    flag = "🇰🇷";
  } else if (originUpper.includes("JP") || originUpper.includes("JAPAN") || originUpper.includes("NHẬT")) {
    code = "JPY";
    flag = "🇯🇵";
  } else if (originUpper.includes("CN") || originUpper.includes("CHINA") || originUpper.includes("TRUNG")) {
    code = "CNY";
    flag = "🇨🇳";
  } else if (originUpper.includes("US") || originUpper.includes("USA") || originUpper.includes("MỸ")) {
    code = "USD";
    flag = "🇺🇸";
  }

  const foundRate = rates.find((r) => String(r.currencyCode || "").toUpperCase() === code);
  const rateToVnd = foundRate?.rateToVnd || (code === "KRW" ? 20 : code === "JPY" ? 180 : code === "CNY" ? 3650 : 26000);

  const foreignAmount = (price / rateToVnd).toFixed(code === "KRW" || code === "JPY" ? 0 : 2);
  return {
    code,
    flag,
    amount: new Intl.NumberFormat("vi-VN").format(foreignAmount),
    rateToVnd,
  };
};
