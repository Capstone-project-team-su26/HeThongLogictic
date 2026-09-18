// Các hàm thuần dùng cho modal báo giá yêu cầu mua hộ.
// Tách khỏi component vì chúng chỉ phụ thuộc tham số đầu vào và các hằng cấp module,
// không đọc state/props/ref/context nên đứng riêng vẫn cho ra kết quả y hệt.
import {
  PRICING_RULE_CODE,
} from "@features/pricing/api/pricingRuleService.mock";

export const normalizeText = (value) =>
  String(value ?? "").trim();

export const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

export const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

export const normalizeMoney = (
  value
) => {
  return Math.max(
    0,
    normalizeNumber(value)
  );
};

export const roundMoney = (value) =>
  Math.round(
    normalizeMoney(value)
  );

export const formatCurrency = (value) => {
  return `${new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }
  ).format(
    roundMoney(value)
  )} ₫`;
};

export const formatNumber = (value) => {
  return new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      useGrouping: true,
    }
  ).format(
    normalizeNumber(value)
  );
};

export const moneyFormatter = (value) => {
  const number = normalizeMoney(
    String(value ?? "")
      .replace(/[^\d.-]/g, "")
  );

  return new Intl.NumberFormat(
    "vi-VN",
    {
      maximumFractionDigits: 0,
    }
  ).format(number);
};

export const moneyParser = (value) => {
  return normalizeMoney(
    String(value ?? "")
      .replace(/[^\d]/g, "")
  );
};

export const getItemId = (item) =>
  normalizeText(
    item?.itemId ??
    item?.purchaseRequestItemId
  );

export const getRuleId = (rule) =>
  normalizeText(
    rule?.id ??
    rule?.pricingRuleId ??
    rule?.ruleId
  );

export const getRuleCode = (rule) =>
  normalizeUpperText(
    rule?.ruleCode
  );

export const getCalculationType = (
  rule
) =>
  normalizeUpperText(
    rule?.calculationType
  );

export const getMinRequiredOrderAmount = (rule) => {
  const condVal = normalizeNumber(rule?.conditionValue, 0);
  if (condVal > 0) {
    return condVal;
  }
  const minAmt = normalizeNumber(rule?.minAmount, 0);
  if (minAmt > 0) {
    return minAmt;
  }
  return 0;
};

export const getRuleScopeLabel = (
  rule,
  packageCount = 1
) => {
  const code =
    getRuleCode(rule);
  const minRequired = getMinRequiredOrderAmount(rule);

  const map = {
    WOOD_CRATE:
      packageCount > 1
        ? `Tính theo sản phẩm (${packageCount} sản phẩm)`
        : "Theo 1 sản phẩm",

    DOMESTIC_FEE:
      "Vận chuyển nội địa",

    SUR_INSURANCE_3PERCENT:
      minRequired > 0
        ? `Theo tổng tiền sản phẩm (Đơn ≥ ${formatCurrency(minRequired)})`
        : "Theo tổng tiền sản phẩm",

    IMPORT_TAX:
      "Theo tổng tiền sản phẩm",

    VAT:
      "Theo tổng chi phí đơn hàng",

    SUR_INSPECTION:
      "Theo đơn",

    PACKAGE_CONFIGURATION:
      "Theo cấu hình kiện hàng",
  };

  return (
    map[code] ||
    (getCalculationType(rule) ===
      "PERCENTAGE"
      ? "Theo tổng tiền sản phẩm"
      : "Theo đơn")
  );
};

export const clampAmount = (
  value,
  minAmount,
  maxAmount
) => {
  let result =
    normalizeMoney(value);

  const minimum =
    minAmount === null ||
      minAmount === undefined ||
      minAmount === ""
      ? null
      : normalizeMoney(
        minAmount
      );

  const maximum =
    maxAmount === null ||
      maxAmount === undefined ||
      maxAmount === ""
      ? null
      : normalizeMoney(
        maxAmount
      );

  if (minimum !== null) {
    result = Math.max(
      result,
      minimum
    );
  }

  if (maximum !== null) {
    result = Math.min(
      result,
      maximum
    );
  }

  return roundMoney(result);
};

export const calculateRuleAmountWithContext = (
  rule,
  { productSubtotal = 0, purchaseFee = 0, shippingFee = 0, packageCount = 1 } = {}
) => {
  if (!rule) return 0;
  const ruleCode = getRuleCode(rule);
  const calculationType = getCalculationType(rule);
  const conditionType = normalizeUpperText(rule?.conditionType);
  const ruleValue = normalizeMoney(rule?.value);

  if (ruleCode === PRICING_RULE_CODE.VOLUMETRIC_DIVISOR) {
    return 0;
  }

  let percentageBase = productSubtotal;

  if (ruleCode === PRICING_RULE_CODE.VAT) {
    if (conditionType === "FREIGHT_PLUS_SERVICE") {
      percentageBase = normalizeMoney(shippingFee) + normalizeMoney(purchaseFee);
    } else {
      percentageBase =
        normalizeMoney(productSubtotal) +
        normalizeMoney(purchaseFee) +
        normalizeMoney(shippingFee);
    }
  }

  let rawAmount =
    calculationType === "PERCENTAGE"
      ? percentageBase * (ruleValue / 100)
      : ruleValue;

  if (ruleCode === PRICING_RULE_CODE.WOOD_CRATE) {
    const totalPkgs = Math.max(1, packageCount);
    rawAmount = rawAmount * totalPkgs;
  }

  return clampAmount(
    rawAmount,
    rule?.minAmount,
    rule?.maxAmount
  );
};

export const getRuleValueLabel = (
  rule
) => {
  if (
    getCalculationType(rule) ===
    "PERCENTAGE"
  ) {
    return `${formatNumber(
      rule?.value
    )}%`;
  }

  return formatCurrency(
    rule?.value
  );
};

export const buildInitialPrices = (
  items = []
) => {
  return items.reduce(
    (result, item) => {
      const itemId =
        getItemId(item);

      if (itemId) {
        result[itemId] = 0;
      }

      return result;
    },
    {}
  );
};
