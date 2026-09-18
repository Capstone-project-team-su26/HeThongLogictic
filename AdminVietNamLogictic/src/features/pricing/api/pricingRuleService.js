/**
 * QUY ĐỊNH PHÍ (pricing rules) — ĐÃ NỐI API THẬT (đợt báo giá ký gửi).
 *
 * - GET /api/pricing-rules?orderType=CONSIGNMENT → MẢNG TRẦN (không cần đăng nhập).
 *   `orderType=CONSIGNMENT` bỏ các phí chỉ của luồng mua hộ. Màn báo giá ký gửi
 *   LUÔN truyền tham số này; các màn khác truyền orderType riêng của mình.
 * - GET /api/pricing-rules/{id} → object trần.
 *
 * Mỗi rule: { id, servicePricingId, ruleName, ruleCode, ruleType, conditionType,
 * conditionValue, calculationType, value, minAmount, maxAmount, isRequired,
 * status, description }.
 *
 * Toàn bộ phần normalize / lookup / eligibility / calculate là logic THUẦN và
 * được giữ nguyên từng dòng — chúng quyết định con số hiện trên màn báo giá và
 * là export công khai của module.
 *
 * getPackageConfigurations / suggestPackageConfiguration vẫn uỷ quyền sang
 * packageConfigurationService (cũng đã nối thật), đúng như bản gốc.
 *
 * Màn ngoài luồng ký gửi (mua hộ, danh mục bảng giá của Admin, Sale tạo đơn hộ
 * khách) dùng bản sao ./pricingRuleService.mock.js.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getResponseData } from "@shared/api/apiEnvelope";

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
   HELPERS
========================= */

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

/*
 * Bản thật dùng hàm này để dọn query trước khi gửi lên server. Mock giữ lại và
 * dùng cho việc lọc tại chỗ, nhờ đó bộ lọc rỗng ("", null, undefined) không biến
 * thành điều kiện "phải bằng chuỗi rỗng" rồi trả về danh sách trống.
 */
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

/*
 * Giữ nguyên bộ dò mảng của bản thật: server có lúc trả mảng trần, có lúc bọc
 * trong items/data/content/results. Mock cho fixture đi qua đúng cửa này để khi
 * cắm axios trở lại thì không phải sửa gì thêm.
 */
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
   LỌC TẠI CHỖ THAY QUERY STRING
========================= */

const toCodeList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map(normalizeUpperText)
      .filter(Boolean);
  }

  return normalizeUpperText(value)
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
};

/*
 * Các component hiện chỉ truyền `signal` và `onlyActive`, nhưng bản thật đẩy mọi
 * key còn lại thành query string. Mock nhận diện những key hay gặp để nếu sau này
 * một màn nào bật bộ lọc lên thì danh sách vẫn co lại đúng, thay vì im lặng trả
 * về nguyên bộ và làm người xem tưởng bộ lọc bị hỏng.
 */
const matchesQueryFilters = (rule, queryFilters) => {
  const {
    status,
    ruleCode,
    ruleCodes,
    ruleType,
    calculationType,
    conditionType,
    servicePricingId,
    isRequired,
    keyword,
    search,
    q,
  } = queryFilters;

  if (
    status !== undefined &&
    rule.status !== normalizeUpperText(status)
  ) {
    return false;
  }

  const wantedCodes = [
    ...toCodeList(ruleCode),
    ...toCodeList(ruleCodes),
  ];

  if (
    wantedCodes.length > 0 &&
    !wantedCodes.includes(rule.ruleCode)
  ) {
    return false;
  }

  if (
    ruleType !== undefined &&
    rule.ruleType !== normalizeUpperText(ruleType)
  ) {
    return false;
  }

  if (
    calculationType !== undefined &&
    rule.calculationType !==
      normalizeUpperText(calculationType)
  ) {
    return false;
  }

  if (
    conditionType !== undefined &&
    rule.conditionType !==
      normalizeUpperText(conditionType)
  ) {
    return false;
  }

  if (
    servicePricingId !== undefined &&
    normalizeText(rule.servicePricingId) !==
      normalizeText(servicePricingId)
  ) {
    return false;
  }

  if (isRequired !== undefined) {
    const wanted =
      isRequired === true ||
      normalizeText(isRequired) === "true";

    if (rule.isRequired !== wanted) {
      return false;
    }
  }

  const text = normalizeText(
    keyword ?? search ?? q
  ).toLowerCase();

  if (text) {
    const haystack = [
      rule.ruleName,
      rule.ruleCode,
      rule.ruleType,
      rule.description,
      rule.calculationTypeDisplayName,
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(text)) {
      return false;
    }
  }

  return true;
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

  const response = await httpClient.get(
    API_ENDPOINTS.pricingRules.list,
    {
      /* Backend chỉ hiểu orderType; các bộ lọc khác vẫn lọc tại chỗ bên dưới. */
      params: removeEmptyParams({
        orderType: queryFilters?.orderType,
      }),
      signal,
    }
  );

  const activeFilters =
    removeEmptyParams(queryFilters);

  const rules = getArrayItems(
    getResponseData(response)
  )
    .map(normalizePricingRule)
    .filter(
      (rule) =>
        Boolean(rule.id) &&
        Boolean(rule.ruleCode)
    )
    .filter((rule) =>
      matchesQueryFilters(rule, activeFilters)
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

  const response = await httpClient.get(
    API_ENDPOINTS.pricingRules.detail(id)
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
   * Đóng thùng gỗ: giá trị rule × số kiện. Catalog để rule WOOD_CRATE value 0
   * (BY_SIZE) vì phí thật tính theo cỡ từng kiện ở cấu hình đóng gói WOOD_CRATE_*.
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
