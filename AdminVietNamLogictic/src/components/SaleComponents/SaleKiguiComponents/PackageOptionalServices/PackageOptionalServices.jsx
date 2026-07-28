import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckOutlined,
  CloseOutlined,
  GiftOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  CarOutlined,
} from "@ant-design/icons";
import { Checkbox, Modal, Tooltip } from "antd";

import pricingRuleService from "../../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import "./PackageOptionalServices.css";

const ACTIVE_STATUS = "ACTIVE";
const VOLUMETRIC_DIVISOR_CODE = "VOLUMETRIC_DIVISOR";
const WOOD_CRATE_CODE = "WOOD_CRATE";
const INSURANCE_CODE = "SUR_INSURANCE_3PERCENT";

/*
 * Các quy tắc chỉ dùng để hệ thống tính phí,
 * không hiển thị trong danh sách dịch vụ để khách hàng lựa chọn.
 */
const HIDDEN_RULE_CODES = new Set([
  "DOMESTIC_FEE",
]);

/*
 * ID hiện tại của DOMESTIC_FEE.
 * Vẫn giữ kiểm tra theo ruleCode/ruleType để không phụ thuộc hoàn toàn vào ID.
 */
const HIDDEN_RULE_IDS = new Set([
  "0385131b-214c-49b8-9de2-116d62f27111",
]);

const normalizeRuleId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();


const STATUS_LABELS = {
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

const CALCULATION_TYPE_LABELS = {
  FIXED: "Phí cố định",
  PERCENTAGE: "Tính theo phần trăm",
  PER_UNIT: "Tính theo đơn vị",
  RANGE: "Tính theo khoảng",
  FORMULA: "Tính theo công thức",
};

const RULE_CODE_LABELS = {
  WOOD_CRATE: "Đóng thùng gỗ",
  DOMESTIC_FEE: "Phí vận chuyển nội địa",
  SUR_INSPECTION: "Phụ phí kiểm hàng",
  SUR_INSURANCE_3PERCENT: "Phụ phí bảo hiểm",
};

const RULE_TYPE_LABELS = {
  WOOD_BOX: "Thùng gỗ",
  DOMESTIC_FEE: "Vận chuyển nội địa",
  INSPECTION: "Kiểm hàng",
  INSURANCE: "Bảo hiểm hàng hóa",
  PACKING: "Đóng gói hàng hóa",
};

const CONDITION_TYPE_LABELS = {
  REQUIRES_INSPECTION: "Áp dụng khi yêu cầu kiểm hàng",
  MIN_DECLARED_VALUE: "Giá trị khai báo tối thiểu",
  MAX_DECLARED_VALUE: "Giá trị khai báo tối đa",
  REQUIRES_INSURANCE: "Áp dụng khi yêu cầu bảo hiểm",
};

const LEGACY_RULE_KEYS = {
  WOOD_CRATE: "requiresWoodenCrate",
  SUR_INSURANCE_3PERCENT: "requiresInsurance",
  SUR_INSPECTION: "requiresInspection",
};

// Shared initial form state used by the create-request page.
// eslint-disable-next-line react-refresh/only-export-components
export const EMPTY_PACKAGE_SERVICES = {
  requiresPacking: false,
  requiresWoodenCrate: false,
  requiresInsurance: false,
  requiresInspection: false,
  selectedRuleCodes: [],
  selectedPricingRuleIds: [],
  packageConfigurationByPackageId: {},
  selectedPackageConfigurations: [],
};

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const isHiddenRule = (rule) => {
  const ruleCode = normalizeCode(rule?.ruleCode);
  const ruleType = normalizeCode(rule?.ruleType);
  const ruleId = normalizeRuleId(rule?.id || rule?.pricingRuleId);

  return (
    HIDDEN_RULE_CODES.has(ruleCode) ||
    HIDDEN_RULE_CODES.has(ruleType) ||
    HIDDEN_RULE_IDS.has(ruleId)
  );
};

const sanitizeSelectedRuleCodes = (value) => {
  return Array.from(
    new Set(
      normalizeStringArray(value)
        .map(normalizeCode)
        .filter(Boolean)
        .filter((ruleCode) => !HIDDEN_RULE_CODES.has(ruleCode)),
    ),
  );
};

const sanitizeSelectedPricingRuleIds = (
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

const areStringArraysEqual = (first = [], second = []) => {
  if (first.length !== second.length) {
    return false;
  }

  return first.every(
    (value, index) => value === second[index],
  );
};

const isCanceledRequest = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

const toFiniteNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeRule = (rule = {}) => ({
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

const normalizeRulesFromApi = (result) => {
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


const normalizePackageConfiguration = (configuration = {}) => ({
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

const normalizePackageConfigurationsFromApi = (result) => {
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

const normalizePackageItems = (packages = []) => {
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

const isInsuranceRule = (rule) => {
  const code = normalizeCode(rule?.ruleCode);
  const type = normalizeCode(rule?.ruleType);

  return (
    code === INSURANCE_CODE ||
    code.includes("INSURANCE") ||
    type.includes("INSURANCE")
  );
};

const isWoodCrateRule = (rule) => {
  const code = normalizeCode(rule?.ruleCode);
  const type = normalizeCode(rule?.ruleType);

  return (
    code === WOOD_CRATE_CODE ||
    code.includes("WOOD") ||
    type.includes("WOOD")
  );
};

const hasPositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
};

const hasCompleteInsuranceInput = (packageItem) =>
  hasPositiveNumber(packageItem?.declaredValue);

const hasCompleteWoodCrateInput = (packageItem) => {
  const quantity = Number(packageItem?.quantity);

  return (
    Number.isInteger(quantity) &&
    quantity > 0 &&
    ["weight", "length", "width", "height"].every((field) =>
      hasPositiveNumber(packageItem?.[field]),
    )
  );
};

const getRuleAvailability = (rule, packageItems = []) => {
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

const normalizePackageConfigurationMap = (value) => {
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

const getPackageConfigurationMapFromValue = (value) => {
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

const areConfigurationMapsEqual = (
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

const getPackageSuggestionPayload = (pkg) => {
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

const formatPackageDimensions = (pkg) => {
  return `${formatNumber(pkg?.length)} × ${formatNumber(
    pkg?.width,
  )} × ${formatNumber(pkg?.height)} cm • ${formatNumber(
    pkg?.weight,
  )} kg`;
};

const formatConfigurationDimensions = (configuration) => {
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

const formatMoney = (value) => {
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

const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 4,
  }).format(number);
};

const formatConditionUnit = (conditionType) => {
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

const getStatusLabel = (status) => {
  const normalizedStatus = normalizeCode(status);

  return (
    STATUS_LABELS[normalizedStatus] ||
    "Chưa xác định"
  );
};

const getStatusClassName = (status) => {
  const normalizedStatus = normalizeCode(status);

  return normalizedStatus
    ? normalizedStatus.toLowerCase().replaceAll("_", "-")
    : "unknown";
};

const getCalculationTypeLabel = (calculationType) => {
  const normalizedType = normalizeCode(calculationType);

  return (
    CALCULATION_TYPE_LABELS[normalizedType] ||
    "Cách tính theo chính sách"
  );
};

const getRuleDisplayName = (rule) => {
  const code = normalizeCode(rule?.ruleCode);

  return (
    String(rule?.ruleName || "").trim() ||
    RULE_CODE_LABELS[code] ||
    "Dịch vụ bổ sung"
  );
};

const getRuleCodeLabel = (rule) => {
  const code = normalizeCode(rule?.ruleCode);

  return (
    RULE_CODE_LABELS[code] ||
    getRuleDisplayName(rule)
  );
};

const getRuleTypeLabel = (rule) => {
  const type = normalizeCode(rule?.ruleType);

  return (
    RULE_TYPE_LABELS[type] ||
    "Dịch vụ"
  );
};

const getConditionTypeLabel = (conditionType) => {
  const normalizedCondition = normalizeCode(conditionType);

  return (
    CONDITION_TYPE_LABELS[normalizedCondition] ||
    "Điều kiện theo chính sách dịch vụ"
  );
};

const formatRuleDescription = (description) => {
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

const formatRuleFee = (rule) => {
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

const formatRuleInformation = (rule) => {
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

const getRuleIcon = (rule) => {
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

const isRuleSelectable = (rule) =>
  normalizeCode(rule?.status) === ACTIVE_STATUS;

const getInitialSelectedCodes = (value, rules) => {
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

const areCodeArraysEqual = (first = [], second = []) => {
  const firstSet = new Set(first.map(normalizeCode).filter(Boolean));
  const secondSet = new Set(second.map(normalizeCode).filter(Boolean));

  if (firstSet.size !== secondSet.size) {
    return false;
  }

  return Array.from(firstSet).every((code) => secondSet.has(code));
};

export default function PackageOptionalServices({
  value = EMPTY_PACKAGE_SERVICES,
  packages = [],
  disabled = false,
  onChange,

  triggerTitle = "Dịch vụ bổ sung cho đơn ký gửi",
  triggerDescription = "",

  modalEyebrow = "DỊCH VỤ BỔ SUNG",
  modalTitle = "Lựa chọn dịch vụ cho đơn ký gửi",
  modalDescription =
    "Danh sách được cập nhật trực tiếp từ bảng giá hệ thống. Khi có dịch vụ mới, giao diện sẽ tự động hiển thị thêm.",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pricingRules, setPricingRules] = useState([]);
  const [hiddenPricingRuleIds, setHiddenPricingRuleIds] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState("");
  const [draftSelectedCodes, setDraftSelectedCodes] = useState([]);

  const [
    packageConfigurations,
    setPackageConfigurations,
  ] = useState([]);
  const [
    packageConfigurationsLoading,
    setPackageConfigurationsLoading,
  ] = useState(true);
  const [
    packageConfigurationsError,
    setPackageConfigurationsError,
  ] = useState("");

  const [
    draftPackageConfigurationByPackageId,
    setDraftPackageConfigurationByPackageId,
  ] = useState({});

  const [
    suggestedConfigurationByPackageId,
    setSuggestedConfigurationByPackageId,
  ] = useState({});

  const [
    suggestionLoadingByPackageId,
    setSuggestionLoadingByPackageId,
  ] = useState({});

  const [
    suggestionErrorByPackageId,
    setSuggestionErrorByPackageId,
  ] = useState({});

  const [
    autoSuggestionSignatureByPackageId,
    setAutoSuggestionSignatureByPackageId,
  ] = useState({});

  /*
   * Chỉ cho phép tự động gọi API gợi ý sau khi người dùng
   * CHỦ ĐỘNG bấm chọn "Đóng thùng gỗ" trong lần mở modal hiện tại.
   *
   * Nhờ vậy:
   * - Mở modal không tự POST gợi ý.
   * - Nhập/sửa kích thước không tự POST nếu chưa chọn thùng gỗ.
   * - Dữ liệu WOOD_CRATE cũ trong form cha cũng không làm API tự chạy.
   */
  const [
    woodCrateAutoSuggestionEnabled,
    setWoodCrateAutoSuggestionEnabled,
  ] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPricingRules = async () => {
      try {
        setPricingLoading(true);
        setPricingError("");

        // Gọi đúng endpoint và lấy TOÀN BỘ dữ liệu thật từ API.
        // Không truyền ruleCodes, không dùng mảng dữ liệu mẫu.
        const result = await pricingRuleService.getPricingRules({
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        const normalizedRules = normalizeRulesFromApi(result);

        const hiddenRules = normalizedRules.filter(isHiddenRule);
        const visibleRules = normalizedRules.filter(
          (rule) => !isHiddenRule(rule),
        );

        setHiddenPricingRuleIds(
          hiddenRules
            .map((rule) => normalizeRuleId(rule.id))
            .filter(Boolean),
        );

        setPricingRules(visibleRules);
      } catch (error) {
        if (controller.signal.aborted || isCanceledRequest(error)) {
          return;
        }

        console.error(
          "[PackageOptionalServices] Lỗi tải /api/pricing-rules:",
          error,
        );

        setPricingRules([]);
        setPricingError(
          error?.message || "Không thể tải danh sách quy tắc tính phí.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setPricingLoading(false);
        }
      }
    };

    fetchPricingRules();

    return () => controller.abort();
  }, []);

  const loadPackageConfigurations = useCallback(
    async (options = {}) => {
      const { signal } = options;

      try {
        setPackageConfigurationsLoading(true);
        setPackageConfigurationsError("");

        if (
          typeof pricingRuleService.getPackageConfigurations !==
          "function"
        ) {
          throw new Error(
            "pricingRuleService chưa có hàm getPackageConfigurations.",
          );
        }

        const result =
          await pricingRuleService.getPackageConfigurations({
            signal,
            onlyActive: true,
          });

        if (signal?.aborted) {
          return [];
        }

        const configurations =
          normalizePackageConfigurationsFromApi(result);

        setPackageConfigurations(configurations);

        return configurations;
      } catch (error) {
        if (
          signal?.aborted ||
          isCanceledRequest(error)
        ) {
          return [];
        }

        console.error(
          "[PackageOptionalServices] Lỗi tải /api/package-configurations:",
          error,
        );

        const message =
          error?.message ||
          "Không thể tải danh sách kích thước thùng.";

        setPackageConfigurations([]);
        setPackageConfigurationsError(message);

        return [];
      } finally {
        if (!signal?.aborted) {
          setPackageConfigurationsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      loadPackageConfigurations({
        signal: controller.signal,
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadPackageConfigurations]);

  const packageItems = useMemo(
    () => normalizePackageItems(packages),
    [packages],
  );

  const selectedPackageConfigurationByPackageId =
    useMemo(
      () =>
        getPackageConfigurationMapFromValue(value),
      [value],
    );

  const selectedCodes = useMemo(
    () => getInitialSelectedCodes(value, pricingRules),
    [pricingRules, value],
  );

  /*
   * Tự động loại DOMESTIC_FEE khỏi state của component cha.
   * Điều này xử lý trường hợp ID/code cũ đã tồn tại nhưng người dùng
   * không mở modal và không bấm "Lưu lựa chọn".
   */
  useEffect(() => {
    const currentRuleCodes = normalizeStringArray(
      value?.selectedRuleCodes ??
        value?.selectedPricingRuleCodes ??
        value?.pricingRuleCodes,
    ).map(normalizeCode);

    const currentPricingRuleIds = normalizeStringArray(
      value?.selectedPricingRuleIds ??
        value?.pricingRuleIds,
    ).map(normalizeRuleId);

    const sanitizedRuleCodes =
      sanitizeSelectedRuleCodes(currentRuleCodes);

    const sanitizedPricingRuleIds =
      sanitizeSelectedPricingRuleIds(
        currentPricingRuleIds,
        hiddenPricingRuleIds,
      );

    const hasHiddenRuleCode =
      !areStringArraysEqual(
        currentRuleCodes,
        sanitizedRuleCodes,
      );

    const hasHiddenRuleId =
      !areStringArraysEqual(
        currentPricingRuleIds,
        sanitizedPricingRuleIds,
      );

    if (!hasHiddenRuleCode && !hasHiddenRuleId) {
      return;
    }

    onChange?.({
      ...value,
      selectedRuleCodes: sanitizedRuleCodes,
      selectedPricingRuleIds: sanitizedPricingRuleIds,
    });
  }, [
    hiddenPricingRuleIds,
    onChange,
    value,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const timeoutId = window.setTimeout(() => {
      setDraftSelectedCodes(selectedCodes);
      setDraftPackageConfigurationByPackageId(
        selectedPackageConfigurationByPackageId,
      );
      setSuggestionErrorByPackageId({});
      setAutoSuggestionSignatureByPackageId({});
      setWoodCrateAutoSuggestionEnabled(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    isOpen,
    selectedCodes,
    selectedPackageConfigurationByPackageId,
  ]);

  const selectedRules = useMemo(() => {
    const selectedSet = new Set(selectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [pricingRules, selectedCodes]);

  /*
   * Khi người dùng xóa dữ liệu bắt buộc sau khi đã chọn dịch vụ,
   * tự động bỏ dịch vụ không còn đủ điều kiện khỏi form cha.
   */
  useEffect(() => {
    if (pricingLoading || !pricingRules.length) {
      return;
    }

    const selectedSet = new Set(selectedCodes);
    const unavailableSelectedRules = pricingRules.filter(
      (rule) =>
        !rule.isRequired &&
        selectedSet.has(rule.ruleCode) &&
        !getRuleAvailability(rule, packageItems).available,
    );

    if (!unavailableSelectedRules.length) {
      return;
    }

    const unavailableCodes = new Set(
      unavailableSelectedRules.map((rule) => rule.ruleCode),
    );

    const nextSelectedRules = pricingRules.filter(
      (rule) =>
        !isHiddenRule(rule) &&
        selectedSet.has(rule.ruleCode) &&
        !unavailableCodes.has(rule.ruleCode) &&
        isRuleSelectable(rule),
    );

    const selectedRuleCodes = sanitizeSelectedRuleCodes(
      nextSelectedRules.map((rule) => rule.ruleCode),
    );

    const selectedPricingRuleIds = sanitizeSelectedPricingRuleIds(
      nextSelectedRules.map((rule) => rule.id),
      hiddenPricingRuleIds,
    );

    const requiresWoodenCrate = nextSelectedRules.some(isWoodCrateRule);
    const requiresInsurance = nextSelectedRules.some(isInsuranceRule);

    onChange?.({
      ...value,
      requiresPacking: nextSelectedRules.some((rule) =>
        rule.ruleCode.includes("PACKING"),
      ),
      requiresWoodenCrate,
      requiresInsurance,
      requiresInspection: nextSelectedRules.some(
        (rule) =>
          rule.ruleCode.includes("INSPECTION") ||
          rule.ruleType.includes("INSPECTION"),
      ),
      selectedRuleCodes,
      selectedPricingRuleIds,
      ...(requiresWoodenCrate
        ? {}
        : {
            packageConfigurationByPackageId: {},
            selectedPackageConfigurations: [],
            woodCrateBaseFeePerPackage: 0,
            woodCrateBaseFee: 0,
            woodCrateConfigurationFee: 0,
            woodCrateTotalFee: 0,
            woodCrateCompleted: false,
          }),
    });
  }, [
    hiddenPricingRuleIds,
    onChange,
    packageItems,
    pricingLoading,
    pricingRules,
    selectedCodes,
    value,
  ]);

  const selectedDraftRules = useMemo(() => {
    const selectedSet = new Set(draftSelectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [draftSelectedCodes, pricingRules]);

  const hasChanges = useMemo(
    () =>
      !areCodeArraysEqual(
        selectedCodes,
        draftSelectedCodes,
      ) ||
      !areConfigurationMapsEqual(
        selectedPackageConfigurationByPackageId,
        draftPackageConfigurationByPackageId,
      ),
    [
      draftPackageConfigurationByPackageId,
      draftSelectedCodes,
      selectedCodes,
      selectedPackageConfigurationByPackageId,
    ],
  );

  const handleSelectPackageConfiguration = (
    packageId,
    configurationId,
  ) => {
    if (disabled) {
      return;
    }

    setDraftPackageConfigurationByPackageId(
      (previous) => ({
        ...previous,
        [packageId]: configurationId,
      }),
    );

    setSuggestionErrorByPackageId(
      (previous) => ({
        ...previous,
        [packageId]: "",
      }),
    );
  };

  const handleSuggestPackageConfiguration =
    useCallback(
      async (
        packageItem,
        {
          silent = false,
        } = {},
      ) => {
        const packageId =
          String(packageItem?.id || "").trim();

        if (!packageId) {
          return null;
        }

        const requestPayload =
          getPackageSuggestionPayload(packageItem);

        if (!requestPayload) {
          const message =
            "Cần nhập đầy đủ dài, rộng, cao và trọng lượng lớn hơn 0 trước khi gợi ý thùng.";

          setSuggestionErrorByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: message,
            }),
          );

          if (!silent) {
            AuthNotify.warning(
              "Chưa đủ thông tin kiện",
              message,
            );
          }

          return null;
        }

        try {
          setSuggestionLoadingByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: true,
            }),
          );

          setSuggestionErrorByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: "",
            }),
          );

          if (
            typeof pricingRuleService
              .suggestPackageConfiguration !==
            "function"
          ) {
            throw new Error(
              "pricingRuleService chưa có hàm suggestPackageConfiguration.",
            );
          }

          const suggestion =
            await pricingRuleService
              .suggestPackageConfiguration(
                requestPayload,
              );

          const normalizedSuggestion =
            normalizePackageConfiguration(
              suggestion,
            );

          const suggestedId =
            normalizedSuggestion.id;

          if (!suggestedId) {
            throw new Error(
              "API gợi ý không trả về packageConfigurationId.",
            );
          }

          setPackageConfigurations(
            (previous) => {
              const exists = previous.some(
                (configuration) =>
                  configuration.id ===
                  suggestedId,
              );

              return exists
                ? previous
                : [
                    ...previous,
                    normalizedSuggestion,
                  ];
            },
          );

          setSuggestedConfigurationByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: suggestedId,
            }),
          );

          setDraftPackageConfigurationByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: suggestedId,
            }),
          );

          if (!silent) {
            AuthNotify.success(
              "Đã gợi ý kích thước thùng",
              `${packageItem.displayName}: ${normalizedSuggestion.configName}.`,
            );
          }

          return normalizedSuggestion;
        } catch (error) {
          if (isCanceledRequest(error)) {
            return null;
          }

          const message =
            error?.message ||
            "Không thể gợi ý kích thước thùng.";

          console.error(
            "[PackageOptionalServices] Lỗi POST /api/package-configurations/suggest:",
            error,
          );

          setSuggestionErrorByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: message,
            }),
          );

          if (!silent) {
            AuthNotify.error(
              "Gợi ý thùng thất bại",
              message,
            );
          }

          return null;
        } finally {
          setSuggestionLoadingByPackageId(
            (previous) => ({
              ...previous,
              [packageId]: false,
            }),
          );
        }
      },
      [],
    );

  useEffect(() => {
    const hasWoodCrateSelected =
      draftSelectedCodes.includes(
        WOOD_CRATE_CODE,
      );

    if (
      !isOpen ||
      !hasWoodCrateSelected ||
      !woodCrateAutoSuggestionEnabled ||
      packageConfigurationsLoading ||
      packageConfigurationsError ||
      !packageItems.length
    ) {
      return;
    }

    const pendingPackages = packageItems.filter(
      (packageItem) => {
        const packageId = packageItem.id;
        const payload =
          getPackageSuggestionPayload(packageItem);

        if (
          !payload ||
          draftPackageConfigurationByPackageId[
            packageId
          ] ||
          suggestionLoadingByPackageId[packageId]
        ) {
          return false;
        }

        const signature = [
          payload.length,
          payload.width,
          payload.height,
          payload.weight,
        ].join("|");

        return (
          autoSuggestionSignatureByPackageId[
            packageId
          ] !== signature
        );
      },
    );

    if (!pendingPackages.length) {
      return;
    }

    // Record packages queued by this effect before starting async suggestions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoSuggestionSignatureByPackageId(
      (previous) => {
        const next = {
          ...previous,
        };

        pendingPackages.forEach(
          (packageItem) => {
            const payload =
              getPackageSuggestionPayload(
                packageItem,
              );

            next[packageItem.id] = [
              payload.length,
              payload.width,
              payload.height,
              payload.weight,
            ].join("|");
          },
        );

        return next;
      },
    );

    pendingPackages.forEach(
      (packageItem) => {
        handleSuggestPackageConfiguration(
          packageItem,
          {
            silent: true,
          },
        );
      },
    );
  }, [
    autoSuggestionSignatureByPackageId,
    draftPackageConfigurationByPackageId,
    draftSelectedCodes,
    handleSuggestPackageConfiguration,
    isOpen,
    packageConfigurationsError,
    packageConfigurationsLoading,
    packageItems,
    suggestionLoadingByPackageId,
    woodCrateAutoSuggestionEnabled,
  ]);

  const handleOpen = () => {
    if (disabled) {
      return;
    }

    setDraftSelectedCodes(selectedCodes);
    setDraftPackageConfigurationByPackageId(
      selectedPackageConfigurationByPackageId,
    );
    setSuggestionErrorByPackageId({});
    setAutoSuggestionSignatureByPackageId({});
    setWoodCrateAutoSuggestionEnabled(false);
    setIsOpen(true);
  };

  const handleToggle = (rule) => {
    if (
      disabled ||
      isHiddenRule(rule) ||
      !isRuleSelectable(rule) ||
      rule.isRequired ||
      !getRuleAvailability(rule, packageItems).available
    ) {
      return;
    }

    const normalizedRuleCode = normalizeCode(rule?.ruleCode);
    const isCurrentlySelected =
      draftSelectedCodes.includes(normalizedRuleCode);

    /*
     * Bật quyền tự gợi ý CHỈ tại thao tác người dùng chọn WOOD_CRATE.
     * Nếu WOOD_CRATE đã có sẵn từ value cũ khi mở modal thì API không tự POST.
     */
    if (normalizedRuleCode === WOOD_CRATE_CODE) {
      const willSelectWoodCrate = !isCurrentlySelected;

      setWoodCrateAutoSuggestionEnabled(
        willSelectWoodCrate,
      );

      if (willSelectWoodCrate) {
        // Cho phép tạo một lượt gợi ý mới sau cú bấm chọn này.
        setAutoSuggestionSignatureByPackageId({});
      } else {
        /*
         * Bỏ chọn đóng thùng gỗ phải xóa toàn bộ lựa chọn kích thước.
         * Dữ liệu gợi ý AI cũ không được giữ lại để tự kích hoạt về sau.
         */
        setDraftPackageConfigurationByPackageId({});
        setSuggestedConfigurationByPackageId({});
        setSuggestionErrorByPackageId({});
        setAutoSuggestionSignatureByPackageId({});
      }
    }

    setDraftSelectedCodes((currentCodes) => {
      const nextCodes = new Set(currentCodes);

      if (nextCodes.has(normalizedRuleCode)) {
        nextCodes.delete(normalizedRuleCode);
      } else {
        nextCodes.add(normalizedRuleCode);
      }

      return Array.from(nextCodes);
    });
  };

  const handleClose = () => {
    setDraftSelectedCodes(selectedCodes);
    setDraftPackageConfigurationByPackageId(
      selectedPackageConfigurationByPackageId,
    );
    setSuggestionErrorByPackageId({});
    setWoodCrateAutoSuggestionEnabled(false);
    setIsOpen(false);
  };

  const handleSave = () => {
    if (disabled) {
      return;
    }

    const selectedSet = new Set(
      sanitizeSelectedRuleCodes(
        draftSelectedCodes,
      ),
    );

    const activeSelectedRules =
      pricingRules.filter(
        (rule) =>
          !isHiddenRule(rule) &&
          selectedSet.has(rule.ruleCode) &&
          isRuleSelectable(rule) &&
          getRuleAvailability(rule, packageItems).available,
      );

    const selectedRuleCodes =
      sanitizeSelectedRuleCodes(
        activeSelectedRules.map(
          (rule) => rule.ruleCode,
        ),
      );

    const selectedPricingRuleIds =
      sanitizeSelectedPricingRuleIds(
        activeSelectedRules.map(
          (rule) => rule.id,
        ),
        hiddenPricingRuleIds,
      );

    const requiresWoodenCrate =
      selectedRuleCodes.includes(
        WOOD_CRATE_CODE,
      );

    let packageConfigurationByPackageId = {};
    let selectedPackageConfigurations = [];
    let woodCrateOrderFee = 0;
    let woodCrateConfigurationFee = 0;
    let woodCrateTotalFee = 0;
    let woodCrateCompleted = false;

    if (requiresWoodenCrate) {
      if (!packageItems.length) {
        AuthNotify.warning(
          "Chưa có kiện hàng",
          "Hãy thêm ít nhất một kiện trước khi chọn đóng thùng gỗ.",
        );
        return;
      }

      const validConfigurationIds = new Set(
        packageConfigurations
          .map((configuration) => String(configuration?.id || "").trim())
          .filter(Boolean),
      );

      const missingPackages = packageItems.filter((packageItem) => {
        const configurationId = String(
          draftPackageConfigurationByPackageId[packageItem.id] || "",
        ).trim();

        return (
          !configurationId ||
          !validConfigurationIds.has(configurationId)
        );
      });

      if (missingPackages.length) {
        AuthNotify.warning(
          "Bắt buộc chọn kích thước thùng",
          `Đã chọn đóng thùng gỗ nên phải chọn cấu hình kích thước hợp lệ cho: ${missingPackages
            .map((packageItem) => packageItem.displayName)
            .join(", ")}.`,
        );
        return;
      }

      packageConfigurationByPackageId = Object.fromEntries(
        packageItems.map((packageItem) => [
          packageItem.id,
          String(
            draftPackageConfigurationByPackageId[packageItem.id],
          ).trim(),
        ]),
      );

      selectedPackageConfigurations = packageItems.map((packageItem) => {
        const packageConfigurationId =
          packageConfigurationByPackageId[packageItem.id];

        const configuration = packageConfigurations.find(
          (item) => item.id === packageConfigurationId,
        );

        return {
          packageId: packageItem.id,
          packageIndex: packageItem.index,
          productName: packageItem.displayName,
          packageConfigurationId,
          configCode: configuration?.configCode || "",
          configName:
            configuration?.configName || "Cấu hình đóng gói",
          length: Number(configuration?.length) || 0,
          width: Number(configuration?.width) || 0,
          height: Number(configuration?.height) || 0,
          maxWeight: Number(configuration?.maxWeight) || 0,
          packageFee: Number(configuration?.packageFee) || 0,
        };
      });

      const woodCrateRule = activeSelectedRules.find(isWoodCrateRule);

      // Phí rule đóng thùng được tính một lần cho toàn bộ đơn.
      woodCrateOrderFee = Number(woodCrateRule?.value) || 0;
      woodCrateConfigurationFee = selectedPackageConfigurations.reduce(
        (total, configuration) =>
          total + (Number(configuration?.packageFee) || 0),
        0,
      );
      woodCrateTotalFee =
        woodCrateOrderFee + woodCrateConfigurationFee;
      woodCrateCompleted =
        selectedPackageConfigurations.length === packageItems.length;
    }

    const nextValue = {
      ...value,
      requiresPacking:
        selectedRuleCodes.some(
          (code) =>
            code.includes("PACKING"),
        ),
      requiresWoodenCrate,
      requiresInsurance:
        activeSelectedRules.some(
          (rule) =>
            rule.ruleCode.includes(
              "INSURANCE",
            ) ||
            rule.ruleType.includes(
              "INSURANCE",
            ),
        ),
      requiresInspection:
        activeSelectedRules.some(
          (rule) =>
            rule.ruleCode.includes(
              "INSPECTION",
            ) ||
            rule.ruleType.includes(
              "INSPECTION",
            ),
        ),
      selectedRuleCodes,
      selectedPricingRuleIds,
      packageConfigurationByPackageId,
      selectedPackageConfigurations,
      woodCrateBaseFeePerPackage: 0,
      woodCrateOrderFee,
      woodCrateBaseFee: woodCrateOrderFee,
      woodCrateConfigurationFee,
      woodCrateTotalFee,
      woodCrateCompleted,
    };

    try {
      onChange?.(nextValue);
      setWoodCrateAutoSuggestionEnabled(false);
      setIsOpen(false);

      if (activeSelectedRules.length > 0) {
        AuthNotify.success(
          "Đã lưu dịch vụ bổ sung",
          `Đã chọn: ${activeSelectedRules
            .map(getRuleDisplayName)
            .join(", ")}.`,
        );
      } else {
        AuthNotify.success(
          "Đã cập nhật dịch vụ",
          "Đơn ký gửi không chọn dịch vụ bổ sung.",
        );
      }
    } catch (error) {
      AuthNotify.error(
        "Không thể lưu dịch vụ",
        error?.message ||
          "Đã xảy ra lỗi khi lưu lựa chọn dịch vụ.",
      );
    }
  };

  const renderPackageConfigurationPanel =
    () => {
      if (
        !draftSelectedCodes.includes(
          WOOD_CRATE_CODE,
        )
      ) {
        return null;
      }

      return (
        <div className="package-config-panel">
          <div className="package-config-panel__header">
            <div>
              <strong>
                Chọn kích thước thùng cho từng kiện hàng (bắt buộc)
              </strong>
              <span>
                Sau khi bạn chọn đóng thùng gỗ, hệ thống
                mới gọi API để gợi ý dựa trên dài, rộng,
                cao và trọng lượng của kiện hàng.
              </span>
            </div>

            <button
              type="button"
              className="package-config-panel__reload"
              disabled={
                disabled ||
                packageConfigurationsLoading
              }
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                loadPackageConfigurations();

                setAutoSuggestionSignatureByPackageId(
                  {},
                );
              }}
            >
              {packageConfigurationsLoading ? (
                <LoadingOutlined spin />
              ) : (
                <InfoCircleOutlined />
              )}
              Tải lại cấu hình hệ thống
            </button>
          </div>

          {packageConfigurationsLoading ? (
            <div className="package-config-panel__state">
              <LoadingOutlined spin />
              <span>
                Đang tải danh sách kích thước
                thùng...
              </span>
            </div>
          ) : packageConfigurationsError ? (
            <div className="package-config-panel__state is-error">
              <InfoCircleOutlined />
              <div>
                <strong>
                  Không tải được cấu hình thùng
                </strong>
                <span>
                  {packageConfigurationsError}
                </span>
              </div>
            </div>
          ) : !packageItems.length ? (
            <div className="package-config-panel__state">
              <InfoCircleOutlined />
              <span>
                Chưa có kiện hàng để lựa chọn cấu
                hình đóng gói.
              </span>
            </div>
          ) : (
            <div className="package-config-panel__packages">
              {packageItems.map(
                (packageItem) => {
                  const selectedConfigurationId =
                    draftPackageConfigurationByPackageId[
                      packageItem.id
                    ];

                  const suggestedConfigurationId =
                    suggestedConfigurationByPackageId[
                      packageItem.id
                    ];

                  const isSuggesting =
                    Boolean(
                      suggestionLoadingByPackageId[
                        packageItem.id
                      ],
                    );

                  const suggestionError =
                    suggestionErrorByPackageId[
                      packageItem.id
                    ];

                  const selectedConfiguration =
                    packageConfigurations.find(
                      (configuration) =>
                        configuration.id ===
                        selectedConfigurationId,
                    );

                  return (
                    <div
                      key={packageItem.id}
                      className="package-config-package"
                    >
                      <div className="package-config-package__heading">
                        <div>
                          <strong>
                            Kiện{" "}
                            {packageItem.index + 1}:{" "}
                            {
                              packageItem.displayName
                            }
                          </strong>
                          <span>
                            {formatPackageDimensions(
                              packageItem,
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="package-config-package__suggest"
                          disabled={
                            disabled ||
                            isSuggesting
                          }
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            handleSuggestPackageConfiguration(
                              packageItem,
                            );
                          }}
                        >
                          {isSuggesting ? (
                            <LoadingOutlined spin />
                          ) : (
                            <InfoCircleOutlined />
                          )}
                          {isSuggesting
                            ? "Đang gợi ý"
                            : suggestedConfigurationId
                              ? "Gợi ý lại"
                              : "Gợi ý kích thước"}
                        </button>
                      </div>

                      {suggestionError && (
                        <div className="package-config-package__error">
                          <InfoCircleOutlined />
                          <span>
                            {suggestionError}
                          </span>
                        </div>
                      )}

                      <div className="package-config-options">
                        {packageConfigurations.map(
                          (configuration) => {
                            const isSelected =
                              selectedConfigurationId ===
                              configuration.id;

                            const isSuggested =
                              suggestedConfigurationId ===
                              configuration.id;

                            const isCustom =
                              configuration.configCode ===
                              "CUSTOM";

                            return (
                              <button
                                key={
                                  configuration.id
                                }
                                type="button"
                                className={[
                                  "package-config-option",
                                  isSelected &&
                                    "package-config-option--selected",
                                  isCustom &&
                                    "package-config-option--custom",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={(
                                  event,
                                ) => {
                                  event.preventDefault();
                                  event.stopPropagation();

                                  handleSelectPackageConfiguration(
                                    packageItem.id,
                                    configuration.id,
                                  );
                                }}
                              >
                                <span className="package-config-option__top">
                                  <strong>
                                    {
                                      configuration.configName
                                    }
                                  </strong>

                                  {isSuggested && (
                                    <small>
                                      Hệ thống gợi ý
                                    </small>
                                  )}
                                </span>

                                <span className="package-config-option__code">
                                  {
                                    configuration.configCode
                                  }
                                </span>

                                <span className="package-config-option__dimension">
                                  {formatConfigurationDimensions(
                                    configuration,
                                  )}
                                </span>

                                <span className="package-config-option__meta">
                                  <span>
                                    {isCustom
                                      ? "Theo thông số thực tế"
                                      : `Tối đa ${formatNumber(
                                          configuration.maxWeight,
                                        )} kg`}
                                  </span>

                                  <b>
                                    {formatMoney(
                                      configuration.packageFee,
                                    )}
                                  </b>
                                </span>

                                {isSelected && (
                                  <span className="package-config-option__selected">
                                    <CheckOutlined />
                                    Đã chọn
                                  </span>
                                )}
                              </button>
                            );
                          },
                        )}
                      </div>

                      <div className="package-config-package__footer">
                        {selectedConfiguration ? (
                          <>
                            <CheckOutlined />
                            <span>
                              Đã chọn{" "}
                              <strong>
                                {
                                  selectedConfiguration.configName
                                }
                              </strong>{" "}
                              cho kiện này.
                            </span>
                          </>
                        ) : (
                          <>
                            <InfoCircleOutlined />
                            <span>
                              Chưa chọn cấu hình
                              thùng.
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      );
    };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={[
          "package-services-trigger",
          selectedRules.length > 0 && "package-services-trigger--active",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={handleOpen}
      >
        <span className="package-services-trigger__icon" aria-hidden="true">
          <GiftOutlined />
        </span>

        <span className="package-services-trigger__body">
          <span className="package-services-trigger__title-row">
            <strong>{triggerTitle}</strong>

            <Tooltip
              placement="top"
              title="Danh sách dịch vụ được tải trực tiếp từ hệ thống và tự động cập nhật khi bảng giá thay đổi."
            >
              <InfoCircleOutlined
                aria-label="Thông tin dịch vụ bổ sung"
                className="package-services-trigger__info"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
            </Tooltip>
          </span>

          {selectedRules.length > 0 ? (
            <span className="package-services-trigger__chips">
              {selectedRules.map((rule) => (
                <span key={rule.id || rule.ruleCode}>
                  <CheckOutlined />
                  {getRuleDisplayName(rule)}
                </span>
              ))}
            </span>
          ) : (
            <span className="package-services-trigger__description">
              {pricingLoading
                ? "Đang tải dữ liệu bảng giá..."
                : triggerDescription ||
                  `${pricingRules.length} dịch vụ đang có trên hệ thống.`}
            </span>
          )}
        </span>

        <span
          className={[
            "package-services-trigger__status",
            selectedRules.length > 0 ? "is-active" : "is-optional",
          ].join(" ")}
        >
          <span className="package-services-trigger__status-dot" />
          {selectedRules.length > 0
            ? `${selectedRules.length} đã chọn`
            : "Không bắt buộc"}
        </span>
      </button>

      <Modal
        open={isOpen}
        centered
        width={1040}
        footer={null}
        closable={!disabled}
        mask={{ closable: !disabled }}
        keyboard={!disabled}
        destroyOnHidden
        closeIcon={<CloseOutlined />}
        className="package-services-modal"
        onCancel={handleClose}
      >
        <div className="package-services-modal__header">
          <span
            className="package-services-modal__header-icon"
            aria-hidden="true"
          >
            <GiftOutlined />
          </span>

          <div className="package-services-modal__header-content">
            <span className="package-services-modal__eyebrow">
              {modalEyebrow}
            </span>
            <h2>{modalTitle}</h2>
            <p>{modalDescription}</p>
          </div>
        </div>

        <div className="package-services-modal__notice">
          {pricingLoading ? <LoadingOutlined spin /> : <InfoCircleOutlined />}
          <span>
            {pricingLoading
              ? "Đang tải danh sách dịch vụ..."
              : pricingError
                ? pricingError
                : `Đang hiển thị ${pricingRules.length} dịch vụ.`}
          </span>
        </div>

        <div className="package-services-modal__list">
          {pricingLoading ? (
            <div className="package-services-modal__api-state">
              <LoadingOutlined spin />
              <strong>Đang tải danh sách dịch vụ</strong>
              <span>Vui lòng chờ trong giây lát.</span>
            </div>
          ) : pricingError ? (
            <div className="package-services-modal__api-state is-error">
              <InfoCircleOutlined />
              <strong>Không tải được danh sách dịch vụ</strong>
              <span>{pricingError}</span>
            </div>
          ) : pricingRules.length === 0 ? (
            <div className="package-services-modal__api-state">
              <InfoCircleOutlined />
              <strong>Chưa có dịch vụ bổ sung</strong>
              <span>Hệ thống hiện chưa có dịch vụ phù hợp để lựa chọn.</span>
            </div>
          ) : (
            pricingRules.map((rule, ruleIndex) => {
              const Icon = getRuleIcon(rule);
              const checked = draftSelectedCodes.includes(rule.ruleCode);
              const selectable = isRuleSelectable(rule);
              const availability = getRuleAvailability(
                rule,
                packageItems,
              );
              const itemDisabled =
                disabled ||
                !selectable ||
                rule.isRequired ||
                !availability.available;
              const isWoodCrateService = isWoodCrateRule(rule);
              const isInsuranceService = isInsuranceRule(rule);

              return (
                <React.Fragment
                  key={
                    rule.id ||
                    rule.ruleCode ||
                    ruleIndex
                  }
                >
                  <div
                    role="checkbox"
                    tabIndex={itemDisabled ? -1 : 0}
                    aria-checked={checked}
                    aria-disabled={itemDisabled}
                    style={{
                      "--service-index":
                        ruleIndex,
                    }}
                    className={[
                      "package-services-modal__item",
                      checked &&
                        "package-services-modal__item--selected",
                      isWoodCrateService &&
                        checked &&
                        "package-services-modal__item--wood-open",
                      itemDisabled &&
                        "package-services-modal__item--disabled",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      handleToggle(rule)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        handleToggle(rule);
                      }
                    }}
                  >
                    <span className="package-services-modal__checkbox">
                      <Checkbox
                        checked={checked}
                        disabled={itemDisabled}
                        tabIndex={-1}
                        style={{
                          pointerEvents:
                            "none",
                        }}
                      />
                    </span>

                    <span
                      className="package-services-modal__service-icon"
                      aria-hidden="true"
                    >
                      <Icon />
                    </span>

                    <span className="package-services-modal__content">
                      <span className="package-services-modal__title-row">
                        <strong>
                          {getRuleDisplayName(
                            rule,
                          )}
                        </strong>

                        <Tooltip
                          placement="top"
                          title={formatRuleInformation(
                            rule,
                          )}
                        >
                          <InfoCircleOutlined
                            aria-label={`Thông tin ${getRuleDisplayName(
                              rule,
                            )}`}
                            className="package-services-modal__info-icon"
                            onClick={(
                              event,
                            ) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                          />
                        </Tooltip>
                      </span>

                      <span className="package-services-modal__rule-meta">
                        <b
                          title={
                            rule.ruleCode ||
                            undefined
                          }
                        >
                          {getRuleCodeLabel(
                            rule,
                          )}
                        </b>

                        <i
                          title={
                            rule.ruleType ||
                            undefined
                          }
                        >
                          {getRuleTypeLabel(
                            rule,
                          )}
                        </i>

                        <em
                          className={`status-${getStatusClassName(
                            rule.status,
                          )}`}
                        >
                          {getStatusLabel(
                            rule.status,
                          )}
                        </em>
                      </span>

                      <span className="package-services-modal__description">
                        {formatRuleDescription(
                          rule.description,
                        )}
                      </span>

                      {!availability.available && (
                        <span className="package-services-modal__requirement">
                          <InfoCircleOutlined />
                          {availability.reason}
                        </span>
                      )}
                    </span>

                    <span className="package-services-modal__fee">
                      <small>
                        {isWoodCrateService
                          ? "Theo cấu hình thùng"
                          : getCalculationTypeLabel(
                              rule.calculationType,
                            )}
                      </small>

                      <strong>
                        {isWoodCrateService
                          ? checked
                            ? "Chọn bên dưới"
                            : "Chưa chọn thùng"
                          : formatRuleFee(
                              rule,
                            )}
                      </strong>

                      {isInsuranceService && (
                        <span className="package-services-modal__fee-limits">
                          <span>
                            Tối thiểu:
                            <b>
                              {rule.minAmount === null
                                ? "Không quy định"
                                : formatMoney(rule.minAmount)}
                            </b>
                          </span>
                          <span>
                            Tối đa:
                            <b>
                              {rule.maxAmount === null
                                ? "Không giới hạn"
                                : formatMoney(rule.maxAmount)}
                            </b>
                          </span>
                        </span>
                      )}
                    </span>
                  </div>

                  {isWoodCrateService &&
                    checked &&
                    renderPackageConfigurationPanel()}
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="package-services-modal__summary">
          <div className="package-services-modal__summary-count">
            <span>Dịch vụ đã chọn</span>
            <strong>{selectedDraftRules.length}</strong>
          </div>
          <p>
            {selectedDraftRules.length > 0
              ? selectedDraftRules
                  .map(getRuleDisplayName)
                  .join(", ")
              : "Chưa chọn dịch vụ bổ sung"}
          </p>
        </div>

        <div className="package-services-modal__footer">
          <button
            type="button"
            className="package-services-modal__cancel"
            disabled={disabled}
            onClick={handleClose}
          >
            <CloseOutlined />
            Hủy
          </button>

          <button
            type="button"
            className={[
              "package-services-modal__save",
              hasChanges && "has-changes",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled || pricingLoading || Boolean(pricingError)}
            onClick={handleSave}
          >
            <CheckOutlined />
            Lưu lựa chọn
          </button>
        </div>
      </Modal>
    </>
  );
}
