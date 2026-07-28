import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";
import {
  getPackageConfigurationsApi,
  suggestPackageConfigurationApi,
} from "./packageConfigurationService";

/* =========================
   CONSTANTS
========================= */

export const PRICING_RULE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const PRICING_RULE_CODE = {
  WOOD_CRATE: "WOOD_CRATE",
  DOMESTIC_FEE: "DOMESTIC_FEE",
  VAT: "VAT",
  VOLUMETRIC_DIVISOR: "VOLUMETRIC_DIVISOR",
  SUR_INSPECTION: "SUR_INSPECTION",
  IMPORT_TAX: "IMPORT_TAX",
  SUR_INSURANCE_3PERCENT: "SUR_INSURANCE_3PERCENT",
};

export const CALCULATION_TYPE = {
  FIXED: "FIXED",
  PERCENTAGE: "PERCENTAGE",
};

export const CONDITION_TYPE = {
  FREIGHT_PLUS_SERVICE: "FREIGHT_PLUS_SERVICE",
  DECLARED_VALUE: "DECLARED_VALUE",
  MIN_DECLARED_VALUE: "MIN_DECLARED_VALUE",
  REQUIRES_INSPECTION: "REQUIRES_INSPECTION",
};

/* =========================
   RESPONSE / AUTH HELPERS
========================= */

const getResponseData = (response) =>
  response?.data?.data ??
  response?.data ??
  null;

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

const getAuthHeaders = () => ({
  Accept: "*/*",
  Authorization: `Bearer ${getAccessToken()}`,
});

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const normalizePositiveNumber = (
  value,
  fallback = 0
) => {
  return Math.max(
    0,
    normalizeNumber(value, fallback)
  );
};

const normalizeNullableNumber = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const removeEmptyParams = (
  params = {}
) => {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
};

const getArrayItems = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.content)) {
    return data.content;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
};

const roundMoney = (value) => {
  return Math.round(
    normalizePositiveNumber(value)
  );
};

const clampAmount = (
  amount,
  minAmount,
  maxAmount
) => {
  let result =
    normalizePositiveNumber(amount);

  if (
    minAmount !== null &&
    minAmount !== undefined
  ) {
    result = Math.max(
      result,
      normalizePositiveNumber(minAmount)
    );
  }

  if (
    maxAmount !== null &&
    maxAmount !== undefined
  ) {
    result = Math.min(
      result,
      normalizePositiveNumber(maxAmount)
    );
  }

  return roundMoney(result);
};

/* =========================
   NORMALIZE PRICING RULE
========================= */

export const normalizePricingRule = (
  rule = {}
) => {
  const calculationType = normalizeUpperText(
    rule?.calculationType
  );
  const status = normalizeUpperText(rule?.status);

  return {
    ...rule,
    id: normalizeText(rule?.id),

  servicePricingId:
    normalizeText(
      rule?.servicePricingId
    ) || null,

  ruleName:
    normalizeText(rule?.ruleName),

  ruleCode:
    normalizeUpperText(rule?.ruleCode),

  ruleType:
    normalizeUpperText(rule?.ruleType),

  conditionType:
    normalizeUpperText(
      rule?.conditionType
    ) || null,

  conditionValue:
    rule?.conditionValue !== undefined &&
    rule?.conditionValue !== null &&
    rule?.conditionValue !== ""
      ? normalizeText(
          rule?.conditionValue
        )
      : null,

  calculationType,

  calculationTypeDisplayName:
    calculationType === "PERCENTAGE"
      ? "Phần trăm"
      : calculationType === "FIXED"
        ? "Cố định"
        : calculationType || "—",

  value:
    normalizePositiveNumber(
      rule?.value,
      0
    ),

  minAmount:
    normalizeNullableNumber(
      rule?.minAmount
    ),

  maxAmount:
    normalizeNullableNumber(
      rule?.maxAmount
    ),

  isRequired:
    rule?.isRequired === true,

  status,

  isActive:
    status === PRICING_RULE_STATUS.ACTIVE,

  description:
    normalizeText(rule?.description),

  createdAt:
    rule?.createdAt || null,

  updatedAt:
    rule?.updatedAt || null,
  };
};

/* =========================
   PRICING RULE API
========================= */

export const getPricingRulesApi = async (
  filters = {}
) => {
  const {
    signal,
    onlyActive,
    ...queryFilters
  } = filters || {};

  const response =
    await axiosInstance.get(
      API_ENDPOINTS.pricingRules.list,
      {
        params:
          removeEmptyParams(queryFilters),

        signal,

        headers:
          getAuthHeaders(),
      }
    );

  const data =
    getResponseData(response);

  const rules = getArrayItems(data)
    .map(normalizePricingRule)
    .filter(
      (rule) =>
        Boolean(rule.id) &&
        Boolean(rule.ruleCode)
    );

  return onlyActive === true
    ? rules.filter((rule) => rule.status === PRICING_RULE_STATUS.ACTIVE)
    : rules;
};

export const getPricingRules = (options = {}) =>
  getPricingRulesApi(options);

export const getPackageConfigurations = (options = {}) =>
  getPackageConfigurationsApi(options);

export const suggestPackageConfiguration = (payload = {}) =>
  suggestPackageConfigurationApi(payload);

export const getPricingRuleDetailApi = async (
  pricingRuleId
) => {
  const id = normalizeText(pricingRuleId);

  if (!id) {
    throw new Error("Không tìm thấy mã quy tắc tính phí.");
  }

  const response = await axiosInstance.get(
    API_ENDPOINTS.pricingRules.detail(id),
    { headers: getAuthHeaders() }
  );

  return normalizePricingRule(
    getResponseData(response) || {}
  );
};

export const getActivePricingRulesApi =
  async (filters = {}) => {
    const rules =
      await getPricingRulesApi(filters);

    return rules.filter(
      (rule) =>
        rule.status ===
        PRICING_RULE_STATUS.ACTIVE
    );
  };

/* =========================
   STATUS HELPERS
========================= */

export const isPricingRuleActive = (
  rule
) => {
  return (
    normalizeUpperText(
      rule?.status
    ) ===
    PRICING_RULE_STATUS.ACTIVE
  );
};

export const filterPricingRulesByStatus = (
  pricingRules = [],
  status = PRICING_RULE_STATUS.ACTIVE
) => {
  if (!Array.isArray(pricingRules)) {
    return [];
  }

  const normalizedStatus =
    normalizeUpperText(status);

  return pricingRules.filter(
    (rule) =>
      normalizeUpperText(
        rule?.status
      ) === normalizedStatus
  );
};

/* =========================
   RULE LOOKUP HELPERS
========================= */

export const findPricingRuleByCode = (
  pricingRules = [],
  ruleCode
) => {
  if (!Array.isArray(pricingRules)) {
    return null;
  }

  const normalizedCode =
    normalizeUpperText(ruleCode);

  if (!normalizedCode) {
    return null;
  }

  return (
    pricingRules.find(
      (rule) =>
        normalizeUpperText(
          rule?.ruleCode
        ) === normalizedCode
    ) || null
  );
};

export const getPricingRuleValue = (
  pricingRules = [],
  ruleCode,
  fallback = 0
) => {
  const rule =
    findPricingRuleByCode(
      pricingRules,
      ruleCode
    );

  if (!rule) {
    return fallback;
  }

  return normalizeNumber(
    rule?.value,
    fallback
  );
};

export const mapPricingRulesByCode = (
  pricingRules = []
) => {
  if (!Array.isArray(pricingRules)) {
    return {};
  }

  return pricingRules.reduce(
    (result, rule) => {
      const code =
        normalizeUpperText(
          rule?.ruleCode
        );

      if (code) {
        result[code] = rule;
      }

      return result;
    },
    {}
  );
};

/* =========================
   RULE ELIGIBILITY
========================= */

export const isPricingRuleEligible = (
  rule,
  {
    declaredValue = 0,
    requiresInspection = false,
  } = {}
) => {
  if (!rule || !isPricingRuleActive(rule)) {
    return false;
  }

  const conditionType =
    normalizeUpperText(
      rule?.conditionType
    );

  if (
    conditionType ===
    CONDITION_TYPE.REQUIRES_INSPECTION
  ) {
    return Boolean(requiresInspection);
  }

  if (
    conditionType ===
    CONDITION_TYPE.MIN_DECLARED_VALUE
  ) {
    const minimumDeclaredValue =
      normalizePositiveNumber(
        rule?.conditionValue
      );

    return (
      normalizePositiveNumber(
        declaredValue
      ) >= minimumDeclaredValue
    );
  }

  return true;
};

/* =========================
   CALCULATE ONE RULE
========================= */

export const calculatePricingRuleAmount = (
  rule,
  {
    declaredValue = 0,
    freightCharge = 0,

    /*
     * serviceFeeForVat phải là phí dịch vụ
     * được tính VAT.
     *
     * Theo mô tả API:
     * VAT không bao gồm DOMESTIC_FEE.
     */
    serviceFeeForVat = 0,

    packageCount = 0,
    requiresInspection = false,
  } = {}
) => {
  if (
    !isPricingRuleEligible(
      rule,
      {
        declaredValue,
        requiresInspection,
      }
    )
  ) {
    return 0;
  }

  const ruleCode =
    normalizeUpperText(
      rule?.ruleCode
    );

  const calculationType =
    normalizeUpperText(
      rule?.calculationType
    );

  const conditionType =
    normalizeUpperText(
      rule?.conditionType
    );

  const ruleValue =
    normalizePositiveNumber(
      rule?.value
    );

  let amount;

  /*
   * Hệ số DIM không phải một khoản phí.
   */
  if (
    ruleCode ===
    PRICING_RULE_CODE.VOLUMETRIC_DIVISOR
  ) {
    return 0;
  }

  /*
   * Đóng thùng gỗ:
   * 35.000 VND / kiện.
   */
  if (
    ruleCode ===
    PRICING_RULE_CODE.WOOD_CRATE
  ) {
    amount =
      ruleValue *
      Math.max(
        0,
        Math.trunc(
          normalizePositiveNumber(
            packageCount
          )
        )
      );

    return clampAmount(
      amount,
      rule?.minAmount,
      rule?.maxAmount
    );
  }

  if (
    calculationType ===
    CALCULATION_TYPE.PERCENTAGE
  ) {
    let percentageBase;

    if (
      conditionType ===
      CONDITION_TYPE.FREIGHT_PLUS_SERVICE
    ) {
      percentageBase =
        normalizePositiveNumber(
          freightCharge
        ) +
        normalizePositiveNumber(
          serviceFeeForVat
        );
    } else {
      /*
       * IMPORT_TAX và bảo hiểm
       * đều tính trên declaredValue.
       */
      percentageBase =
        normalizePositiveNumber(
          declaredValue
        );
    }

    amount =
      percentageBase *
      (ruleValue / 100);
  } else {
    amount = ruleValue;
  }

  return clampAmount(
    amount,
    rule?.minAmount,
    rule?.maxAmount
  );
};

/* =========================
   CALCULATE FULL BREAKDOWN
========================= */

export const calculatePricingBreakdown = ({
  pricingRules = [],

  freightCharge = 0,
  declaredValue = 0,
  packageCount = 0,

  /*
   * Tổng phí cấu hình kiện hàng được lấy từ
   * /api/package-configurations.
   *
   * Giá trị này đã được tính theo từng dòng kiện
   * và không nhân thêm quantity.
   */
  packageConfigurationFee = 0,

  requiresInspection = false,

  /*
   * Các rule tùy chọn được người dùng bật.
   * Ví dụ:
   * {
   *   WOOD_CRATE: true,
   *   DOMESTIC_FEE: true,
   *   SUR_INSURANCE_3PERCENT: true
   * }
   */
  enabledRuleCodes = {},
} = {}) => {
  const activeRules =
    filterPricingRulesByStatus(
      pricingRules,
      PRICING_RULE_STATUS.ACTIVE
    );

  const ruleMap =
    mapPricingRulesByCode(
      activeRules
    );

  const isEnabled = (code) => {
    const rule = ruleMap[code];

    if (!rule) {
      return false;
    }

    if (rule.isRequired) {
      return true;
    }

    return (
      enabledRuleCodes?.[code] ===
      true
    );
  };

  const woodCrateFee =
    isEnabled(
      PRICING_RULE_CODE.WOOD_CRATE
    )
      ? calculatePricingRuleAmount(
          ruleMap[
            PRICING_RULE_CODE
              .WOOD_CRATE
          ],
          {
            packageCount,
            declaredValue,
            requiresInspection,
          }
        )
      : 0;

  const domesticFee =
    isEnabled(
      PRICING_RULE_CODE.DOMESTIC_FEE
    )
      ? calculatePricingRuleAmount(
          ruleMap[
            PRICING_RULE_CODE
              .DOMESTIC_FEE
          ],
          {
            declaredValue,
            requiresInspection,
          }
        )
      : 0;

  const inspectionRule =
    ruleMap[
      PRICING_RULE_CODE
        .SUR_INSPECTION
    ];

  const inspectionFee =
    requiresInspection &&
    inspectionRule
      ? calculatePricingRuleAmount(
          inspectionRule,
          {
            declaredValue,
            requiresInspection,
          }
        )
      : 0;

  const insuranceRule =
    ruleMap[
      PRICING_RULE_CODE
        .SUR_INSURANCE_3PERCENT
    ];

  const insuranceFee =
    isEnabled(
      PRICING_RULE_CODE
        .SUR_INSURANCE_3PERCENT
    ) &&
    insuranceRule
      ? calculatePricingRuleAmount(
          insuranceRule,
          {
            declaredValue,
            requiresInspection,
          }
        )
      : 0;

  /*
   * Phí dịch vụ dùng để tính VAT.
   * Không cộng DOMESTIC_FEE theo mô tả API.
   */
  const normalizedPackageConfigurationFee =
    roundMoney(packageConfigurationFee);

  const serviceFeeForVat =
    normalizedPackageConfigurationFee +
    woodCrateFee +
    inspectionFee +
    insuranceFee;

  const vatRule =
    ruleMap[
      PRICING_RULE_CODE.VAT
    ];

  const vat =
    vatRule
      ? calculatePricingRuleAmount(
          vatRule,
          {
            freightCharge,
            serviceFeeForVat,
            declaredValue,
            requiresInspection,
          }
        )
      : 0;

  const importTaxRule =
    ruleMap[
      PRICING_RULE_CODE.IMPORT_TAX
    ];

  const importTax =
    importTaxRule
      ? calculatePricingRuleAmount(
          importTaxRule,
          {
            declaredValue,
            requiresInspection,
          }
        )
      : 0;

  const serviceFee =
    normalizedPackageConfigurationFee +
    woodCrateFee +
    domesticFee +
    inspectionFee +
    insuranceFee;

  const total =
    roundMoney(
      normalizePositiveNumber(
        freightCharge
      ) +
      serviceFee +
      vat +
      importTax
    );

  return {
    freightCharge:
      roundMoney(freightCharge),

    packageConfigurationFee:
      normalizedPackageConfigurationFee,

    woodCrateFee,
    domesticFee,
    inspectionFee,
    insuranceFee,

    serviceFeeForVat:
      roundMoney(serviceFeeForVat),

    serviceFee:
      roundMoney(serviceFee),

    vat,
    importTax,
    taxAndDuty:
      roundMoney(vat + importTax),

    total,

    volumetricDivisor:
      getPricingRuleValue(
        activeRules,
        PRICING_RULE_CODE
          .VOLUMETRIC_DIVISOR,
        null
      ),
  };
};

/* =========================
   COMMON PRICING VALUES
========================= */

export const getCommonPricingValues = (
  pricingRules = []
) => ({
  woodCrateFee:
    getPricingRuleValue(
      pricingRules,
      PRICING_RULE_CODE.WOOD_CRATE,
      0
    ),

  domesticFee:
    getPricingRuleValue(
      pricingRules,
      PRICING_RULE_CODE.DOMESTIC_FEE,
      0
    ),

  vatPercent:
    getPricingRuleValue(
      pricingRules,
      PRICING_RULE_CODE.VAT,
      0
    ),

  volumetricDivisor:
    getPricingRuleValue(
      pricingRules,
      PRICING_RULE_CODE
        .VOLUMETRIC_DIVISOR,
      null
    ),

  inspectionFee:
    getPricingRuleValue(
      pricingRules,
      PRICING_RULE_CODE
        .SUR_INSPECTION,
      0
    ),

  importTaxPercent:
    getPricingRuleValue(
      pricingRules,
      PRICING_RULE_CODE.IMPORT_TAX,
      0
    ),

  insurancePercent:
    getPricingRuleValue(
      pricingRules,
      PRICING_RULE_CODE
        .SUR_INSURANCE_3PERCENT,
      0
    ),

  insuranceMinimumDeclaredValue:
    normalizePositiveNumber(
      findPricingRuleByCode(
        pricingRules,
        PRICING_RULE_CODE
          .SUR_INSURANCE_3PERCENT
      )?.conditionValue
    ),
});

/* =========================
   DEFAULT EXPORT
========================= */

const pricingRuleService = {
  PRICING_RULE_STATUS,
  PRICING_RULE_CODE,
  CALCULATION_TYPE,
  CONDITION_TYPE,

  normalizePricingRule,

  getPricingRulesApi,
  getPricingRules,
  getPricingRuleDetailApi,
  getActivePricingRulesApi,
  getPackageConfigurations,
  suggestPackageConfiguration,

  isPricingRuleActive,
  filterPricingRulesByStatus,

  findPricingRuleByCode,
  getPricingRuleValue,
  mapPricingRulesByCode,

  isPricingRuleEligible,
  calculatePricingRuleAmount,
  calculatePricingBreakdown,

  getCommonPricingValues,
};

export default pricingRuleService;
