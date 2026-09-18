/*
 * Hàm thuần dùng để chuẩn hoá dữ liệu API, kiểm tra điều kiện áp dụng và
 * định dạng chuỗi hiển thị cho PackageOptionalServices.
 *
 * Không hàm nào ở đây đọc state/props hay gọi hook, nên tách ra file riêng
 * giúp component chỉ còn phần điều phối giao diện.
 *
 * Thứ tự khai báo giữ nguyên như file gốc: một vài hàm (getRuleAvailability,
 * formatPackageDimensions) gọi tới formatMoney/formatNumber khai báo bên dưới,
 * chỉ hợp lệ vì chúng được gọi lúc chạy chứ không phải lúc nạp module.
 */

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
  INSURANCE_CODE,
  LEGACY_RULE_KEYS,
  RULE_CODE_LABELS,
  RULE_TYPE_LABELS,
  STATUS_LABELS,
  VOLUMETRIC_DIVISOR_CODE,
  WOOD_CRATE_CODE,
} from "./PackageOptionalServices.constants";

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


export const normalizePackageConfiguration = (configuration = {}) => ({
  ...configuration,
  id: String(
    configuration?.id ||
      configuration?.packageConfigurationId ||
      configuration?.configurationId ||
      "",
  ).trim(),
  packageConfigurationId: String(
    configuration?.packageConfigurationId ||
      configuration?.id ||
      configuration?.configurationId ||
      "",
  ).trim(),
  configCode: normalizeCode(
    configuration?.configCode ||
      configuration?.code,
  ),
  configName: String(
    configuration?.configName ||
      configuration?.name ||
      configuration?.displayName ||
      "Cấu hình đóng gói",
  ).trim(),
  length: toFiniteNumberOrNull(configuration?.length) ?? 0,
  width: toFiniteNumberOrNull(configuration?.width) ?? 0,
  height: toFiniteNumberOrNull(configuration?.height) ?? 0,
  maxWeight:
    toFiniteNumberOrNull(
      configuration?.maxWeight ??
        configuration?.maximumWeight,
    ) ?? 0,
  packageFee:
    toFiniteNumberOrNull(
      configuration?.packageFee ??
        configuration?.fee ??
        configuration?.price,
    ) ?? 0,
  status: normalizeCode(
    configuration?.status ||
      ACTIVE_STATUS,
  ),
});

export const normalizePackageConfigurationsFromApi = (result) => {
  const candidates = [
    result,
    result?.items,
    result?.packageConfigurations,
    result?.configurations,
    result?.data,
    result?.data?.items,
    result?.data?.packageConfigurations,
    result?.data?.configurations,
  ];

  const configurations =
    candidates.find(Array.isArray) || [];

  return configurations
    .filter(
      (item) =>
        item &&
        typeof item === "object",
    )
    .map(normalizePackageConfiguration)
    .filter(
      (item) =>
        item.id &&
        (
          !item.status ||
          item.status === ACTIVE_STATUS
        ),
    );
};

export const normalizePackageItems = (packages = []) => {
  if (!Array.isArray(packages)) {
    return [];
  }

  return packages.map((pkg, index) => {
    const packageId = String(
      pkg?.id ||
        pkg?.packageId ||
        pkg?.parcelId ||
        `package-${index + 1}`,
    ).trim();

    return {
      raw: pkg,
      id: packageId,
      index,
      displayName:
        String(pkg?.productName || "").trim() ||
        `Kiện hàng ${index + 1}`,
      length: toFiniteNumberOrNull(pkg?.length) ?? 0,
      width: toFiniteNumberOrNull(pkg?.width) ?? 0,
      height: toFiniteNumberOrNull(pkg?.height) ?? 0,
      weight: toFiniteNumberOrNull(pkg?.weight) ?? 0,
      quantity: toFiniteNumberOrNull(pkg?.quantity) ?? 0,
      declaredValue: toFiniteNumberOrNull(pkg?.declaredValue) ?? 0,
    };
  });
};

export const isInsuranceRule = (rule) => {
  const code = normalizeCode(rule?.ruleCode);
  const type = normalizeCode(rule?.ruleType);

  return (
    code === INSURANCE_CODE ||
    code.includes("INSURANCE") ||
    type.includes("INSURANCE")
  );
};

export const isWoodCrateRule = (rule) => {
  const code = normalizeCode(rule?.ruleCode);
  const type = normalizeCode(rule?.ruleType);

  return (
    code === WOOD_CRATE_CODE ||
    code.includes("WOOD") ||
    type.includes("WOOD")
  );
};

export const hasPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
};

export const hasCompleteInsuranceInput = (packageItem) =>
  hasPositiveNumber(packageItem?.declaredValue);

export const hasCompleteWoodCrateInput = (packageItem) => {
  const quantity = Number(packageItem?.quantity);

  return (
    Number.isInteger(quantity) &&
    quantity > 0 &&
    ["weight", "length", "width", "height"].every((field) =>
      hasPositiveNumber(packageItem?.[field]),
    )
  );
};

export const getRuleAvailability = (rule, packageItems = []) => {
  if (isInsuranceRule(rule)) {
    if (!packageItems.length) {
      return {
        available: false,
        reason: "Hãy thêm ít nhất một kiện hàng trước khi chọn bảo hiểm.",
      };
    }

    const incompletePackages = packageItems.filter(
      (packageItem) => !hasCompleteInsuranceInput(packageItem),
    );

    if (incompletePackages.length) {
      return {
        available: false,
        reason:
          "Vui lòng nhập GIÁ TRỊ KIỆN HÀNG (VND) lớn hơn 0 cho tất cả kiện trước khi chọn bảo hiểm.",
      };
    }

    const totalDeclaredValue = packageItems.reduce(
      (total, packageItem) =>
        total + (Number(packageItem.declaredValue) || 0),
      0,
    );

    const conditionType = normalizeCode(rule?.conditionType);
    const conditionValue = toFiniteNumberOrNull(rule?.conditionValue);

    if (
      conditionType === "MIN_DECLARED_VALUE" &&
      conditionValue !== null &&
      totalDeclaredValue < conditionValue
    ) {
      return {
        available: false,
        reason: `Tổng giá trị khai báo phải từ ${formatMoney(
          conditionValue,
        )} mới được chọn bảo hiểm.`,
      };
    }

    if (
      conditionType === "MAX_DECLARED_VALUE" &&
      conditionValue !== null &&
      totalDeclaredValue > conditionValue
    ) {
      return {
        available: false,
        reason: `Tổng giá trị khai báo không được vượt quá ${formatMoney(
          conditionValue,
        )} để áp dụng bảo hiểm này.`,
      };
    }
  }

  if (isWoodCrateRule(rule)) {
    if (!packageItems.length) {
      return {
        available: false,
        reason: "Hãy thêm ít nhất một kiện hàng trước khi chọn đóng thùng gỗ.",
      };
    }

    const incompletePackages = packageItems.filter(
      (packageItem) => !hasCompleteWoodCrateInput(packageItem),
    );

    if (incompletePackages.length) {
      return {
        available: false,
        reason:
          "Vui lòng nhập đầy đủ số lượng, cân nặng, chiều dài, chiều rộng và chiều cao lớn hơn 0 cho tất cả kiện trước khi chọn đóng thùng gỗ.",
      };
    }
  }

  return {
    available: true,
    reason: "",
  };
};

export const normalizePackageConfigurationMap = (value) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([packageId, configurationId]) => [
        String(packageId || "").trim(),
        String(configurationId || "").trim(),
      ])
      .filter(
        ([packageId, configurationId]) =>
          packageId &&
          configurationId,
      ),
  );
};

export const getPackageConfigurationMapFromValue = (value) => {
  const directMap =
    normalizePackageConfigurationMap(
      value?.packageConfigurationByPackageId ??
        value?.packageConfigurationsByPackageId ??
        value?.selectedPackageConfigurationByPackageId,
    );

  if (Object.keys(directMap).length) {
    return directMap;
  }

  if (
    Array.isArray(
      value?.selectedPackageConfigurations,
    )
  ) {
    return Object.fromEntries(
      value.selectedPackageConfigurations
        .map((item) => [
          String(
            item?.packageId ||
              item?.id ||
              "",
          ).trim(),
          String(
            item?.packageConfigurationId ||
              item?.configurationId ||
              "",
          ).trim(),
        ])
        .filter(
          ([packageId, configurationId]) =>
            packageId &&
            configurationId,
        ),
    );
  }

  return {};
};

export const areConfigurationMapsEqual = (
  first = {},
  second = {},
) => {
  const firstEntries = Object.entries(
    normalizePackageConfigurationMap(first),
  ).sort(([firstKey], [secondKey]) =>
    firstKey.localeCompare(secondKey),
  );

  const secondEntries = Object.entries(
    normalizePackageConfigurationMap(second),
  ).sort(([firstKey], [secondKey]) =>
    firstKey.localeCompare(secondKey),
  );

  return (
    firstEntries.length === secondEntries.length &&
    firstEntries.every(
      ([key, value], index) =>
        key === secondEntries[index]?.[0] &&
        value === secondEntries[index]?.[1],
    )
  );
};

export const getPackageSuggestionPayload = (pkg) => {
  const payload = {
    length: Number(pkg?.length),
    width: Number(pkg?.width),
    height: Number(pkg?.height),
    weight: Number(pkg?.weight),
  };

  const isValid = Object.values(payload).every(
    (value) =>
      Number.isFinite(value) &&
      value > 0,
  );

  return isValid ? payload : null;
};

export const formatPackageDimensions = (pkg) => {
  return `${formatNumber(pkg?.length)} × ${formatNumber(
    pkg?.width,
  )} × ${formatNumber(pkg?.height)} cm • ${formatNumber(
    pkg?.weight,
  )} kg`;
};

export const formatConfigurationDimensions = (configuration) => {
  if (
    normalizeCode(configuration?.configCode) ===
    "CUSTOM"
  ) {
    return "Kích thước tùy chỉnh theo kiện hàng";
  }

  return `${formatNumber(
    configuration?.length,
  )} × ${formatNumber(
    configuration?.width,
  )} × ${formatNumber(
    configuration?.height,
  )} cm`;
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

  /*
   * Chỉ nối conditionType vào tiền khi đây thật sự là đơn vị tiền.
   * Ví dụ: "VND/kiện" -> "/kiện".
   * Các điều kiện nghiệp vụ như REQUIRES_INSPECTION không phải đơn vị
   * nên tuyệt đối không nối vào số tiền.
   */
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
