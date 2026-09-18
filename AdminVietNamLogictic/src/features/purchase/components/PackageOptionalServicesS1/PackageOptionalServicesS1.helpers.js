import {
  CarOutlined,
  GiftOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import {
  ACTIVE_STATUS,
  CALCULATION_TYPE_LABELS,
  CONDITION_TYPE_LABELS,
  HIDDEN_RULE_CODES,
  HIDDEN_RULE_IDS,
  LEGACY_RULE_KEYS,
  RULE_CODE_LABELS,
  RULE_TYPE_LABELS,
  STATUS_LABELS,
  VOLUMETRIC_DIVISOR_CODE,
} from "./PackageOptionalServicesS1.constants";

/*
 * Hàm thuần của PackageOptionalServicesS1: chuẩn hoá dữ liệu bảng giá,
 * định dạng tiền/số, dựng nhãn hiển thị và kiểm tra dữ liệu sản phẩm.
 * Không hàm nào đọc state, props hay gọi hook nên tách ra được mà
 * component vẫn chạy y hệt; đổi lại phần JSX không còn bị đẩy xuống
 * dưới hàng trăm dòng tiện ích.
 */

export const normalizeRuleId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

export const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

export const isHiddenRule = (rule) => {
  const ruleCode = normalizeCode(rule?.ruleCode);
  const ruleType = normalizeCode(rule?.ruleType);
  const ruleId = normalizeRuleId(rule?.id || rule?.pricingRuleId);

  return (
    HIDDEN_RULE_CODES.has(ruleCode) ||
    HIDDEN_RULE_CODES.has(ruleType) ||
    HIDDEN_RULE_IDS.has(ruleId)
  );
};

export const sanitizeSelectedRuleCodes = (value) => {
  return Array.from(
    new Set(
      normalizeStringArray(value)
        .map(normalizeCode)
        .filter(Boolean)
        .filter((ruleCode) => !HIDDEN_RULE_CODES.has(ruleCode)),
    ),
  );
};

export const sanitizeSelectedPricingRuleIds = (
  value,
  hiddenRuleIds = [],
) => {
  const blockedIds = new Set([
    ...Array.from(HIDDEN_RULE_IDS),
    ...normalizeStringArray(hiddenRuleIds).map(normalizeRuleId),
  ]);

  return Array.from(
    new Set(
      normalizeStringArray(value)
        .map(normalizeRuleId)
        .filter(Boolean)
        .filter((ruleId) => !blockedIds.has(ruleId)),
    ),
  );
};

export const areStringArraysEqual = (first = [], second = []) => {
  if (first.length !== second.length) {
    return false;
  }

  return first.every(
    (value, index) => value === second[index],
  );
};

export const isCanceledRequest = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

export const toFiniteNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const normalizeRule = (rule = {}) => ({
  ...rule,
  id: String(rule?.id || rule?.pricingRuleId || "").trim(),
  servicePricingId:
    String(rule?.servicePricingId || "").trim() || null,
  ruleName: String(rule?.ruleName || "").trim(),
  ruleCode: normalizeCode(rule?.ruleCode),
  ruleType: normalizeCode(rule?.ruleType),
  conditionType:
    rule?.conditionType === null || rule?.conditionType === undefined
      ? null
      : String(rule.conditionType).trim(),
  conditionValue:
    rule?.conditionValue === null || rule?.conditionValue === undefined
      ? null
      : String(rule.conditionValue).trim(),
  calculationType: normalizeCode(rule?.calculationType),
  value: toFiniteNumberOrNull(rule?.value),
  minAmount: toFiniteNumberOrNull(rule?.minAmount),
  maxAmount: toFiniteNumberOrNull(rule?.maxAmount),
  isRequired: Boolean(rule?.isRequired),
  status: normalizeCode(rule?.status),
  description: String(rule?.description || "").trim(),
});

export const normalizeRulesFromApi = (result) => {
  const candidates = [
    result,
    result?.items,
    result?.pricingRules,
    result?.rules,
    result?.data,
    result?.data?.items,
    result?.data?.pricingRules,
    result?.data?.rules,
  ];

  const rawRules = candidates.find(Array.isArray) || [];

  return rawRules
    .filter((rule) => rule && typeof rule === "object")
    .map(normalizeRule)
    .filter((rule) => rule.id || rule.ruleCode)
    .filter(
      (rule) =>
        rule.ruleCode !== VOLUMETRIC_DIVISOR_CODE &&
        rule.ruleType !== VOLUMETRIC_DIVISOR_CODE,
    );
};

export const formatMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(number);
};

export const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 4,
  }).format(number);
};

export const formatConditionUnit = (conditionType) => {
  const value = String(conditionType || "").trim();

  if (!value) {
    return "";
  }


  const unitMatch = value.match(
    /^(?:VND|VNĐ|₫|Đ)\s*\/\s*(.+)$/i,
  );

  if (!unitMatch?.[1]) {
    return "";
  }

  return `/${unitMatch[1].trim()}`;
};

export const getStatusLabel = (status) => {
  const normalizedStatus = normalizeCode(status);

  return (
    STATUS_LABELS[normalizedStatus] ||
    "Chưa xác định"
  );
};

export const getStatusClassName = (status) => {
  const normalizedStatus = normalizeCode(status);

  return normalizedStatus
    ? normalizedStatus.toLowerCase().replaceAll("_", "-")
    : "unknown";
};

export const getCalculationTypeLabel = (calculationType) => {
  const normalizedType = normalizeCode(calculationType);

  return (
    CALCULATION_TYPE_LABELS[normalizedType] ||
    "Cách tính theo chính sách"
  );
};

export const getRuleDisplayName = (rule) => {
  const code = normalizeCode(rule?.ruleCode);

  return (
    String(rule?.ruleName || "").trim() ||
    RULE_CODE_LABELS[code] ||
    "Dịch vụ bổ sung"
  );
};

export const getRuleCodeLabel = (rule) => {
  const code = normalizeCode(rule?.ruleCode);

  return (
    RULE_CODE_LABELS[code] ||
    getRuleDisplayName(rule)
  );
};

export const getRuleTypeLabel = (rule) => {
  const type = normalizeCode(rule?.ruleType);

  return (
    RULE_TYPE_LABELS[type] ||
    "Dịch vụ"
  );
};

export const getConditionTypeLabel = (conditionType) => {
  const normalizedCondition = normalizeCode(conditionType);

  return (
    CONDITION_TYPE_LABELS[normalizedCondition] ||
    "Điều kiện theo chính sách dịch vụ"
  );
};

export const formatRuleDescription = (description) => {
  const value = String(description || "").trim();

  if (!value) {
    return "Hệ thống chưa cung cấp mô tả cho dịch vụ này.";
  }

  return value
    .replace(/declared\s*value/gi, "giá trị khai báo")
    .replace(/\b(\d+)\s*k\b/gi, (_, amount) => {
      const numericAmount = Number(amount) * 1000;
      return formatMoney(numericAmount);
    })
    .replace(/\b(\d+)\s*tr\b/gi, "$1 triệu đồng");
};

export const formatRuleFee = (rule) => {
  const calculationType = normalizeCode(rule?.calculationType);
  const value = toFiniteNumberOrNull(rule?.value);
  const unit = formatConditionUnit(rule?.conditionType);

  if (value === null) {
    return "Chưa có mức phí";
  }

  if (calculationType === "PERCENTAGE") {
    return `${formatNumber(value)}%`;
  }

  if (calculationType === "FIXED") {
    return `${formatMoney(value)}${unit}`;
  }

  return unit
    ? `${formatNumber(value)}${unit}`
    : formatNumber(value);
};

export const formatRuleInformation = (rule) => {
  const parts = [];
  const conditionCode = normalizeCode(rule?.conditionType);
  const conditionUnit = formatConditionUnit(rule?.conditionType);
  const conditionNumber = toFiniteNumberOrNull(rule?.conditionValue);

  parts.push(formatRuleDescription(rule?.description));

  if (conditionUnit) {
    parts.push(
      `Đơn vị tính: ${String(rule.conditionType).trim()}.`,
    );
  } else if (conditionCode === "REQUIRES_INSPECTION") {
    parts.push("Áp dụng khi đơn hàng có yêu cầu kiểm hàng.");
  } else if (conditionCode === "MIN_DECLARED_VALUE") {
    parts.push(
      conditionNumber === null
        ? "Áp dụng từ mức giá trị khai báo tối thiểu theo chính sách."
        : `Áp dụng từ giá trị khai báo ${formatMoney(conditionNumber)}.`,
    );
  } else if (conditionCode === "MAX_DECLARED_VALUE") {
    parts.push(
      conditionNumber === null
        ? "Áp dụng đến mức giá trị khai báo tối đa theo chính sách."
        : `Áp dụng đến giá trị khai báo ${formatMoney(conditionNumber)}.`,
    );
  } else if (rule?.conditionType) {
    parts.push(
      `Điều kiện áp dụng: ${getConditionTypeLabel(rule.conditionType)}.`,
    );

    if (rule?.conditionValue) {
      parts.push(
        conditionNumber === null
          ? `Giá trị điều kiện: ${rule.conditionValue}.`
          : `Giá trị điều kiện: ${formatMoney(conditionNumber)}.`,
      );
    }
  }

  if (rule?.minAmount !== null) {
    parts.push(`Phí tối thiểu: ${formatMoney(rule.minAmount)}.`);
  }

  if (rule?.maxAmount !== null) {
    parts.push(`Phí tối đa: ${formatMoney(rule.maxAmount)}.`);
  }

  return parts.filter(Boolean).join(" ");
};

export const getRuleIcon = (rule) => {
  const code = normalizeCode(rule?.ruleCode);
  const type = normalizeCode(rule?.ruleType);

  if (code.includes("WOOD") || type.includes("WOOD")) {
    return InboxOutlined;
  }

  if (code.includes("INSURANCE") || type.includes("INSURANCE")) {
    return SafetyCertificateOutlined;
  }

  if (code.includes("DOMESTIC") || type.includes("DOMESTIC")) {
    return CarOutlined;
  }

  return GiftOutlined;
};

export const isRuleSelectable = (rule) =>
  normalizeCode(rule?.status) === ACTIVE_STATUS;

export const getInitialSelectedCodes = (value, rules) => {
  const selectedCodes = new Set();

  const codeCandidates = [
    value?.selectedRuleCodes,
    value?.selectedPricingRuleCodes,
    value?.pricingRuleCodes,
  ];

  codeCandidates.forEach((candidate) => {
    sanitizeSelectedRuleCodes(candidate).forEach((code) => {
      selectedCodes.add(code);
    });
  });

  Object.entries(LEGACY_RULE_KEYS).forEach(([ruleCode, legacyKey]) => {
    if (value?.[legacyKey]) {
      selectedCodes.add(ruleCode);
    }
  });

  rules.forEach((rule) => {
    if (rule.isRequired && isRuleSelectable(rule)) {
      selectedCodes.add(rule.ruleCode);
    }
  });

  return Array.from(selectedCodes);
};

export const areCodeArraysEqual = (first = [], second = []) => {
  const firstSet = new Set(first.map(normalizeCode).filter(Boolean));
  const secondSet = new Set(second.map(normalizeCode).filter(Boolean));

  if (firstSet.size !== secondSet.size) {
    return false;
  }

  return Array.from(firstSet).every((code) => secondSet.has(code));
};



export const getPackageDisplayName = (
  packageItem,
  index,
) =>
  String(
    packageItem?.productName ||
      packageItem?.name ||
      `Sản phẩm ${index + 1}`,
  ).trim();

export const getProductQuantity = (packageItem) => {
  const quantity = Number(packageItem?.quantity);

  return Number.isInteger(quantity) && quantity > 0
    ? quantity
    : 0;
};

export const isValidHttpUrl = (value) => {
  try {
    const url = new URL(
      String(value || "").trim(),
    );

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
};

export const getProductImageValue = (packageItem = {}) =>
  packageItem?.image ||
  packageItem?.imageUrl ||
  (Array.isArray(packageItem?.imageUrls)
    ? packageItem.imageUrls.find(Boolean)
    : null);

export const getIncompleteProductFields = (
  packageItem = {},
) => {
  const missingFields = [];

  if (
    !String(packageItem?.productLink || "").trim() ||
    !isValidHttpUrl(packageItem?.productLink)
  ) {
    missingFields.push("link sản phẩm");
  }

  if (!String(packageItem?.sourceWebsite || "").trim()) {
    missingFields.push("website nguồn");
  }

  if (!String(packageItem?.productType || "").trim()) {
    missingFields.push("loại sản phẩm");
  }

  if (!String(packageItem?.productName || "").trim()) {
    missingFields.push("tên sản phẩm");
  }

  if (getProductQuantity(packageItem) <= 0) {
    missingFields.push("số lượng");
  }

  if (!String(packageItem?.attributes || "").trim()) {
    missingFields.push("thuộc tính");
  }

  if (!getProductImageValue(packageItem)) {
    missingFields.push("ảnh sản phẩm");
  }

  return missingFields;
};

export const getIncompleteProducts = (packages) =>
  (Array.isArray(packages) ? packages : [])
    .filter(Boolean)
    .map((packageItem, index) => ({
      packageItem,
      index,
      missingFields:
        getIncompleteProductFields(packageItem),
    }))
    .filter(
      ({ missingFields }) =>
        missingFields.length > 0,
    );

export const formatIncompleteProductsMessage = (
  incompleteProducts,
) =>
  incompleteProducts
    .map(
      ({ packageItem, index, missingFields }) =>
        `${getPackageDisplayName(
          packageItem,
          index,
        )}: ${missingFields.join(", ")}`,
    )
    .join(" | ");

/*
 * Quy tắc mua hộ:
 * - Mỗi dòng sản phẩm được tính là 1 kiện đóng thùng gỗ.
 * - quantity chỉ là số lượng sản phẩm trong kiện, không nhân số kiện.
 */
export const calculateWoodCratePricing = ({
  packages,
  unitFee,
  enabled,
}) => {
  const normalizedPackages =
    Array.isArray(packages)
      ? packages.filter(Boolean)
      : [];

  const packageCount = enabled
    ? normalizedPackages.length
    : 0;

  const safeUnitFee =
    enabled
      ? Number(unitFee) || 0
      : 0;

  return {
    packageCount,
    unitFee: safeUnitFee,
    totalFee:
      packageCount * safeUnitFee,
  };
};
