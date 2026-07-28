import React, { useEffect, useMemo, useState } from "react";
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
import "./PackageOptionalServicesS1.css";


const ACTIVE_STATUS = "ACTIVE";
const VOLUMETRIC_DIVISOR_CODE = "VOLUMETRIC_DIVISOR";


const HIDDEN_RULE_CODES = new Set([
  "DOMESTIC_FEE",
]);


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
  woodCratePackageCount: 0,
  woodCrateQuantity: 0,
  woodCrateUnitFee: 0,
  woodCrateBaseFeePerPackage: 0,
  woodCrateBaseFee: 0,
  woodCrateConfigurationFee: 0,
  woodCrateTotalFee: 0,
  woodCrateCompleted: false,
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



const getPackageDisplayName = (
  packageItem,
  index,
) =>
  String(
    packageItem?.productName ||
      packageItem?.name ||
      `Sản phẩm ${index + 1}`,
  ).trim();

const getProductQuantity = (packageItem) => {
  const quantity = Number(packageItem?.quantity);

  return Number.isInteger(quantity) && quantity > 0
    ? quantity
    : 0;
};

const isValidHttpUrl = (value) => {
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

const getProductImageValue = (packageItem = {}) =>
  packageItem?.image ||
  packageItem?.imageUrl ||
  (Array.isArray(packageItem?.imageUrls)
    ? packageItem.imageUrls.find(Boolean)
    : null);

const getIncompleteProductFields = (
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

const getIncompleteProducts = (packages) =>
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

const formatIncompleteProductsMessage = (
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
const calculateWoodCratePricing = ({
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

const WoodCrateByProductPanel = ({
  packages,
  unitFee,
}) => {
  const normalizedPackages =
    Array.isArray(packages)
      ? packages.filter(Boolean)
      : [];

  const pricing =
    calculateWoodCratePricing({
      packages: normalizedPackages,
      unitFee,
      enabled: true,
    });

  return (
    <section
      className="wood-crate-configuration-panel"
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      <div className="wood-crate-configuration-panel__header">
        <div>
          <span>ĐÓNG THÙNG GỖ THEO KIỆN</span>

          <strong>
            Mỗi sản phẩm được tính là một kiện
          </strong>

          <p>
            Số lượng bên trong một sản phẩm không làm tăng
            số kiện. Ví dụ sản phẩm có số lượng 10 vẫn chỉ
            được tính là 1 kiện đóng thùng gỗ.
          </p>

          <span className="wood-crate-auto-service-badge is-enabled">
            <CheckOutlined />
            {pricing.packageCount} kiện từ{" "}
            {pricing.packageCount} sản phẩm
          </span>
        </div>

        <div className="wood-crate-configuration-panel__base-fee">
          <small>Phí đóng thùng</small>

          <strong>
            {formatMoney(unitFee)}
          </strong>

          <span>/ kiện</span>
        </div>
      </div>

      {normalizedPackages.length === 0 ? (
        <div className="wood-crate-configuration-panel__state is-warning">
          <InfoCircleOutlined />
          Chưa có sản phẩm để tính số kiện đóng thùng gỗ.
        </div>
      ) : (
        <div className="wood-crate-package-list">
          {normalizedPackages.map(
            (packageItem, index) => (
              <article
                key={
                  packageItem?.id ||
                  packageItem?.itemId ||
                  `purchase-product-${index + 1}`
                }
                className="wood-crate-package-card"
              >
                <div className="wood-crate-package-card__heading">
                  <div>
                    <span>Kiện {index + 1}</span>

                    <strong>
                      {getPackageDisplayName(
                        packageItem,
                        index,
                      )}
                    </strong>

                    <small>
                      Số lượng sản phẩm:{" "}
                      {formatNumber(
                        getProductQuantity(
                          packageItem,
                        ),
                      )}
                      {" • "}Tính phí: 1 kiện
                    </small>
                  </div>

                  <span className="wood-crate-package-card__required">
                    1 KIỆN
                  </span>
                </div>
              </article>
            ),
          )}
        </div>
      )}

      <div className="wood-crate-price-summary is-complete">
        <div className="wood-crate-price-summary__selected-count">
          <span>Tổng số kiện</span>

          <strong>
            {pricing.packageCount}
          </strong>
        </div>

        <div>
          <span>Đơn giá mỗi kiện</span>

          <strong>
            {formatMoney(
              pricing.unitFee,
            )}
          </strong>
        </div>

        <div className="wood-crate-price-summary__total">
          <span>
            Tổng phí đóng thùng gỗ
          </span>

          <strong>
            {formatMoney(
              pricing.totalFee,
            )}
          </strong>
        </div>
      </div>
    </section>
  );
};

export default function PackageOptionalServices({
  value = EMPTY_PACKAGE_SERVICES,
  packages = [],
  disabled = false,
  onChange,

  triggerTitle = "Dịch vụ bổ sung cho đơn mua hộ",
  triggerDescription = "",

  modalEyebrow = "DỊCH VỤ BỔ SUNG",
  modalTitle = "Lựa chọn dịch vụ cho đơn mua hộ",
  modalDescription =
    "Danh sách được cập nhật trực tiếp từ bảng giá hệ thống. Khi có dịch vụ mới, giao diện sẽ tự động hiển thị thêm.",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pricingRules, setPricingRules] = useState([]);
  const [hiddenPricingRuleIds, setHiddenPricingRuleIds] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState("");
  const [draftSelectedCodes, setDraftSelectedCodes] = useState([]);


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


  const selectedCodes = useMemo(
    () => getInitialSelectedCodes(value, pricingRules),
    [pricingRules, value],
  );


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

    const timeoutId = window.setTimeout(
      () => setDraftSelectedCodes(selectedCodes),
      0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [
    isOpen,
    selectedCodes,
  ]);

  const selectedRules = useMemo(() => {
    const selectedSet = new Set(selectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [pricingRules, selectedCodes]);

  const selectedDraftRules = useMemo(() => {
    const selectedSet = new Set(draftSelectedCodes);
    return pricingRules.filter((rule) => selectedSet.has(rule.ruleCode));
  }, [draftSelectedCodes, pricingRules]);

  const woodCrateRule = useMemo(
    () =>
      pricingRules.find(
        (rule) =>
          rule.ruleCode ===
          "WOOD_CRATE",
      ) || null,
    [pricingRules],
  );

  const isDraftWoodCrateSelected =
    draftSelectedCodes.includes(
      "WOOD_CRATE",
    );

  const normalizedPackages = useMemo(
    () =>
      Array.isArray(packages)
        ? packages.filter(Boolean)
        : [],
    [packages],
  );

  const incompleteWoodCrateProducts =
    useMemo(
      () =>
        getIncompleteProducts(
          normalizedPackages,
        ),
      [normalizedPackages],
    );

  const allProductsReadyForWoodCrate =
    normalizedPackages.length > 0 &&
    incompleteWoodCrateProducts.length === 0;

  const incompleteProductsMessage =
    useMemo(
      () =>
        formatIncompleteProductsMessage(
          incompleteWoodCrateProducts,
        ),
      [incompleteWoodCrateProducts],
    );

  const woodCrateUnitFee =
    toFiniteNumberOrNull(
      woodCrateRule?.value,
    ) ?? 0;

  const draftWoodCratePricing =
    useMemo(
      () =>
        calculateWoodCratePricing({
          packages:
            normalizedPackages,
          unitFee:
            woodCrateUnitFee,
          enabled:
            isDraftWoodCrateSelected,
        }),
      [
        normalizedPackages,
        woodCrateUnitFee,
        isDraftWoodCrateSelected,
      ],
    );

  /*
   * Nếu người dùng đã chọn đóng thùng gỗ rồi thêm một dòng
   * sản phẩm trống hoặc xóa dữ liệu bắt buộc, tự bỏ riêng
   * WOOD_CRATE. Các dịch vụ VAT, thuế, bảo hiểm... vẫn giữ nguyên.
   */
  useEffect(() => {
    if (
      !value?.requiresWoodenCrate ||
      allProductsReadyForWoodCrate
    ) {
      return;
    }

    const nextRuleCodes =
      sanitizeSelectedRuleCodes(
        value?.selectedRuleCodes ??
          value?.selectedPricingRuleCodes ??
          value?.pricingRuleCodes,
      ).filter(
        (ruleCode) =>
          ruleCode !== "WOOD_CRATE",
      );

    const woodCrateRuleId =
      normalizeRuleId(
        woodCrateRule?.id,
      );

    const nextPricingRuleIds =
      sanitizeSelectedPricingRuleIds(
        value?.selectedPricingRuleIds ??
          value?.pricingRuleIds,
        hiddenPricingRuleIds,
      ).filter(
        (ruleId) =>
          !woodCrateRuleId ||
          ruleId !== woodCrateRuleId,
      );

    const hasOtherPackingService =
      pricingRules.some(
        (rule) =>
          rule.ruleCode !== "WOOD_CRATE" &&
          nextRuleCodes.includes(
            rule.ruleCode,
          ) &&
          (
            rule.ruleCode.includes(
              "PACKING",
            ) ||
            rule.ruleType.includes(
              "PACKING",
            )
          ),
      );

    onChange?.({
      ...value,
      requiresPacking:
        hasOtherPackingService,
      requiresWoodenCrate: false,
      selectedRuleCodes:
        nextRuleCodes,
      selectedPricingRuleIds:
        nextPricingRuleIds,
      pricingRuleIds:
        nextPricingRuleIds,
      woodCratePackageCount: 0,
      woodCrateQuantity: 0,
      woodCrateUnitFee: 0,
      woodCrateBaseFeePerPackage: 0,
      woodCrateBaseFee: 0,
      woodCrateConfigurationFee: 0,
      woodCrateTotalFee: 0,
      woodCrateCompleted: false,
      packageConfigurationByPackageId: {},
      selectedPackageConfigurations: [],
    });

    AuthNotify.warning(
      "Đã bỏ đóng thùng gỗ",
      "Bạn vừa thêm hoặc xóa dữ liệu bắt buộc của sản phẩm. Vui lòng nhập đủ thông tin rồi chọn lại đóng thùng gỗ.",
    );
  }, [
    allProductsReadyForWoodCrate,
    hiddenPricingRuleIds,
    onChange,
    pricingRules,
    value,
    value?.requiresWoodenCrate,
    value?.pricingRuleIds,
    value?.selectedPricingRuleIds,
    value?.selectedPricingRuleCodes,
    value?.selectedRuleCodes,
    value?.pricingRuleCodes,
    woodCrateRule?.id,
  ]);

  /*
   * Khi thêm/xóa sản phẩm sau khi đã chọn đóng thùng gỗ,
   * tự đồng bộ số kiện và tổng phí vào form cha.
   */
  useEffect(() => {
    if (
      !value?.requiresWoodenCrate ||
      !allProductsReadyForWoodCrate
    ) {
      return;
    }

    const pricing =
      calculateWoodCratePricing({
        packages:
          normalizedPackages,
        unitFee:
          woodCrateUnitFee ||
          value?.woodCrateUnitFee ||
          value?.woodCrateBaseFeePerPackage,
        enabled: true,
      });

    const currentCount =
      Number(
        value?.woodCratePackageCount ??
        value?.woodCrateQuantity,
      ) || 0;

    const currentTotal =
      Number(
        value?.woodCrateTotalFee,
      ) || 0;

    if (
      currentCount ===
        pricing.packageCount &&
      currentTotal ===
        pricing.totalFee
    ) {
      return;
    }

    onChange?.({
      ...value,
      woodCratePackageCount:
        pricing.packageCount,
      woodCrateQuantity:
        pricing.packageCount,
      woodCrateUnitFee:
        pricing.unitFee,
      woodCrateBaseFeePerPackage:
        pricing.unitFee,
      woodCrateBaseFee:
        pricing.totalFee,
      woodCrateConfigurationFee: 0,
      woodCrateTotalFee:
        pricing.totalFee,
      woodCrateCompleted:
        pricing.packageCount > 0,
      packageConfigurationByPackageId: {},
      selectedPackageConfigurations: [],
    });
  }, [
    allProductsReadyForWoodCrate,
    normalizedPackages,
    onChange,
    value,
    value?.requiresWoodenCrate,
    value?.woodCratePackageCount,
    value?.woodCrateQuantity,
    value?.woodCrateTotalFee,
    value?.woodCrateUnitFee,
    value?.woodCrateBaseFeePerPackage,
    woodCrateUnitFee,
  ]);

  const hasChanges = useMemo(
    () =>
      !areCodeArraysEqual(
        selectedCodes,
        draftSelectedCodes,
      ),
    [
      draftSelectedCodes,
      selectedCodes,
    ],
  );

  const handleOpen = () => {
    if (disabled) {
      return;
    }

    setDraftSelectedCodes(selectedCodes);
    setIsOpen(true);
  };

  const handleToggle = (rule) => {
    if (
      disabled ||
      isHiddenRule(rule) ||
      !isRuleSelectable(rule) ||
      rule.isRequired
    ) {
      return;
    }

    const isCurrentlySelected =
      draftSelectedCodes.includes(
        rule.ruleCode,
      );

    if (
      rule.ruleCode === "WOOD_CRATE" &&
      !isCurrentlySelected &&
      !allProductsReadyForWoodCrate
    ) {
      AuthNotify.warning(
        normalizedPackages.length === 0
          ? "Chưa có sản phẩm"
          : "Chưa nhập đủ dữ liệu sản phẩm",
        normalizedPackages.length === 0
          ? "Vui lòng thêm ít nhất một sản phẩm trước khi chọn đóng thùng gỗ."
          : `Vui lòng hoàn tất các trường bắt buộc trước khi chọn đóng thùng gỗ. ${incompleteProductsMessage}`,
      );
      return;
    }

    setDraftSelectedCodes((currentCodes) => {
      const nextCodes =
        new Set(currentCodes);

      if (
        nextCodes.has(rule.ruleCode)
      ) {
        nextCodes.delete(
          rule.ruleCode,
        );
      } else {
        nextCodes.add(
          rule.ruleCode,
        );
      }

      return Array.from(nextCodes);
    });
  };


  const handleClose = () => {
    setDraftSelectedCodes(selectedCodes);
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
          selectedSet.has(
            rule.ruleCode,
          ) &&
          isRuleSelectable(rule),
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
        "WOOD_CRATE",
      );

    const woodCratePricing =
      calculateWoodCratePricing({
        packages:
          normalizedPackages,
        unitFee:
          woodCrateUnitFee,
        enabled:
          requiresWoodenCrate,
      });

    if (
      requiresWoodenCrate &&
      !allProductsReadyForWoodCrate
    ) {
      AuthNotify.warning(
        normalizedPackages.length === 0
          ? "Chưa có sản phẩm"
          : "Chưa nhập đủ dữ liệu sản phẩm",
        normalizedPackages.length === 0
          ? "Vui lòng thêm ít nhất một sản phẩm trước khi chọn đóng thùng gỗ."
          : `Vui lòng hoàn tất các trường bắt buộc trước khi lưu dịch vụ đóng thùng gỗ. ${incompleteProductsMessage}`,
      );
      return;
    }

    const nextValue = {
      ...value,

      requiresPacking:
        selectedRuleCodes.some(
          (code) =>
            code.includes(
              "PACKING",
            ),
        ) ||
        requiresWoodenCrate,

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

      /*
       * Giữ tương thích với dữ liệu cũ.
       * API mua hộ có thể chỉ dùng pricingRuleIds.
       */
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
      pricingRuleIds:
        selectedPricingRuleIds,

      /*
       * Mua hộ không chọn kích thước/cấu hình thùng.
       * Mỗi dòng sản phẩm là 1 kiện, không nhân quantity.
       */
      woodCratePackageCount:
        woodCratePricing.packageCount,
      woodCrateQuantity:
        woodCratePricing.packageCount,
      woodCrateUnitFee:
        woodCratePricing.unitFee,
      woodCrateBaseFeePerPackage:
        woodCratePricing.unitFee,
      woodCrateBaseFee:
        woodCratePricing.totalFee,
      woodCrateConfigurationFee: 0,
      woodCrateTotalFee:
        woodCratePricing.totalFee,
      woodCrateCompleted:
        !requiresWoodenCrate ||
        woodCratePricing.packageCount > 0,

      packageConfigurationByPackageId: {},
      selectedPackageConfigurations: [],
    };

    try {
      onChange?.(nextValue);
      setIsOpen(false);

      if (
        activeSelectedRules.length > 0
      ) {
        AuthNotify.success(
          "Đã lưu dịch vụ bổ sung",
          `Đã chọn: ${activeSelectedRules
            .map(getRuleDisplayName)
            .join(", ")}.`,
        );
      } else {
        AuthNotify.success(
          "Đã cập nhật dịch vụ",
          "Đơn mua hộ không chọn dịch vụ bổ sung.",
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

                  {rule.ruleCode ===
                    "WOOD_CRATE" &&
                    Number(
                      value?.woodCrateTotalFee,
                    ) > 0 && (
                      <b className="package-services-trigger__wood-price">
                        {formatMoney(
                          value.woodCrateTotalFee,
                        )}
                      </b>
                    )}
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
                : `Đang hiển thị ${pricingRules.length} dịch vụ. Hệ số quy đổi thể tích không hiển thị trong danh sách lựa chọn.`}
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
              const woodCrateProductDataMissing =
                rule.ruleCode === "WOOD_CRATE" &&
                !checked &&
                !allProductsReadyForWoodCrate;

              const itemDisabled =
                disabled ||
                !selectable ||
                rule.isRequired ||
                woodCrateProductDataMissing;

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
                  style={{ "--service-index": ruleIndex }}
                  className={[
                    "package-services-modal__item",
                    checked && "package-services-modal__item--selected",
                    itemDisabled && "package-services-modal__item--disabled",
                    woodCrateProductDataMissing &&
                      "package-services-modal__item--measurement-required",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleToggle(rule)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
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
                      style={{ pointerEvents: "none" }}
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
                      <strong>{getRuleDisplayName(rule)}</strong>

                      <Tooltip placement="top" title={formatRuleInformation(rule)}>
                        <InfoCircleOutlined
                          aria-label={`Thông tin ${getRuleDisplayName(rule)}`}
                          className="package-services-modal__info-icon"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        />
                      </Tooltip>
                    </span>

                    <span className="package-services-modal__rule-meta">
                      <b title={rule.ruleCode || undefined}>
                        {getRuleCodeLabel(rule)}
                      </b>

                      <i title={rule.ruleType || undefined}>
                        {getRuleTypeLabel(rule)}
                      </i>

                      <em
                        className={`status-${getStatusClassName(rule.status)}`}
                      >
                        {getStatusLabel(rule.status)}
                      </em>
                    </span>

                    <span className="package-services-modal__description">
                      {formatRuleDescription(rule.description)}
                    </span>

                    {woodCrateProductDataMissing && (
                      <span className="package-services-modal__measurement-warning">
                        <InfoCircleOutlined />
                        {normalizedPackages.length === 0
                          ? "Thêm ít nhất một sản phẩm trước khi chọn."
                          : `Còn ${incompleteWoodCrateProducts.length} sản phẩm chưa nhập đủ dữ liệu bắt buộc.`}
                      </span>
                    )}

                  </span>

                  <span className="package-services-modal__fee">
                    <small>
                      {rule.ruleCode === "WOOD_CRATE"
                        ? "Phí đóng thùng / kiện"
                        : getCalculationTypeLabel(
                            rule.calculationType,
                          )}
                    </small>

                    <strong>
                      {formatRuleFee(rule)}
                    </strong>

                    {rule.ruleCode ===
                      "WOOD_CRATE" &&
                      checked && (
                        <em className="package-services-modal__wood-total">
                          {draftWoodCratePricing.packageCount}
                          {" kiện × "}
                          {formatMoney(
                            draftWoodCratePricing.unitFee,
                          )}
                          {" = "}
                          {formatMoney(
                            draftWoodCratePricing.totalFee,
                          )}
                        </em>
                      )}
                  </span>
                </div>

                {rule.ruleCode ===
                  "WOOD_CRATE" &&
                  checked && (
                    <WoodCrateByProductPanel
                      packages={
                        normalizedPackages
                      }
                      unitFee={
                        woodCrateUnitFee
                      }
                    />
                  )}
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

          {draftWoodCratePricing.totalFee > 0 && (
            <div className="package-services-modal__wood-summary">
              <span>
                Tổng phí đóng thùng gỗ
              </span>

              <strong>
                {formatMoney(
                  draftWoodCratePricing.totalFee,
                )}
              </strong>
            </div>
          )}
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
