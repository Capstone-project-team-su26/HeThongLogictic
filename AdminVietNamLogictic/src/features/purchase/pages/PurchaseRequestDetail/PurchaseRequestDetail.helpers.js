/*
 * Hàm thuần dùng chung cho trang chi tiết yêu cầu mua hộ:
 * chuẩn hoá chuỗi, dịch nhãn và định dạng số/tiền/thời gian.
 * Không hàm nào ở đây chạm tới state hay props,
 * nên tách ra được mà phần hiển thị vẫn y nguyên.
 */
import {
  PRICING_RULE_CODE,
} from "@features/pricing/api/pricingRuleService.mock";

import {
  apiToUtcIso,
  formatUtcDateTime,
  formatVietnamDateTime,
} from "@shared/utils/timeUtc";

import {
  FEE_TYPE_LABELS,
  QUOTATION_STATUS_CONFIG,
  STATUS_CONFIG,
} from "./PurchaseRequestDetail.constants";

export const normalizeText = (value) =>
  String(value ?? "").trim();

export const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

export const getQuotationStatusInfo = (
  value
) => {
  const code =
    normalizeUpperText(value);

  return (
    QUOTATION_STATUS_CONFIG[
    code
    ] || {
      label:
        code
          .replace(/_/g, " ")
          .toLocaleLowerCase(
            "vi-VN"
          )
          .replace(
            /(^|\s)\S/g,
            (character) =>
              character
                .toLocaleUpperCase(
                  "vi-VN"
                )
          ) ||
        "Chưa xác định",

      className:
        "is-default",
    }
  );
};

export const getFeeTypeLabel = (
  value
) => {
  const code =
    normalizeUpperText(value);

  return (
    FEE_TYPE_LABELS[code] ||
    code
      .replace(/_/g, " ")
      .toLocaleLowerCase(
        "vi-VN"
      )
      .replace(
        /(^|\s)\S/g,
        (character) =>
          character
            .toLocaleUpperCase(
              "vi-VN"
            )
      ) ||
    "Phụ phí"
  );
};

export const getFeeToneClass = (
  value
) => {
  const code =
    normalizeUpperText(value);

  if (
    code === "TAX"
  ) {
    return "is-tax";
  }

  if (
    code === "INSURANCE"
  ) {
    return "is-insurance";
  }

  if (
    code === "WOOD_BOX" ||
    code === "INSPECTION"
  ) {
    return "is-service";
  }

  return "is-default";
};

export const formatFeeCalculation = (fee) => {
  const calculationType = normalizeUpperText(fee?.calculationType);

  if (calculationType === "PERCENTAGE") {
    return `${formatNumber(fee?.value)}%`;
  }

  return "Cố định";
};

export const getStatusInfo = (value, statusDisplayName) => {
  const code = normalizeUpperText(value);
  const matched = STATUS_CONFIG[code];

  if (matched) {
    return {
      ...matched,
      label: statusDisplayName || matched.label,
    };
  }

  return {
    label:
      statusDisplayName ||
      code
        .replace(/_/g, " ")
        .toLocaleLowerCase("vi-VN")
        .replace(
          /(^|\s)\S/g,
          (character) =>
            character.toLocaleUpperCase("vi-VN")
        ) ||
      "Chưa xác định",
    className: "is-default",
  };
};

/*
 * API trả thời gian UTC.
 * Chuẩn hóa về UTC+0 trước,
 * sau đó hiển thị theo giờ Việt Nam UTC+7.
 */
export const normalizeApiTimeToUtc = (
  value
) => {
  return apiToUtcIso(
    value,
    {
      apiTimeMode: "utc",
    }
  );
};

export const formatDateTime = (value) => {
  const utcIso =
    normalizeApiTimeToUtc(
      value
    );

  if (!utcIso) {
    return "—";
  }

  return formatVietnamDateTime(
    utcIso,
    {
      apiTimeMode: "utc",
      fallback: "—",
    }
  );
};

export const formatDateUtcTitle = (
  value
) => {
  const utcIso =
    normalizeApiTimeToUtc(
      value
    );

  if (!utcIso) {
    return "";
  }

  return `UTC+0: ${formatUtcDateTime(
    utcIso,
    {
      apiTimeMode: "utc",
      fallback: "—",
    }
  )}`;
};

export const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }
  ).format(number);
};

export const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0 ₫";
  }

  return `${new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }
  ).format(
    Math.round(number)
  )} ₫`;
};

export const formatPricingRuleValue = (
  rule
) => {
  const value =
    Number(rule?.value) || 0;

  const calculationType =
    normalizeUpperText(
      rule?.calculationType
    );

  const ruleCode =
    normalizeUpperText(
      rule?.ruleCode
    );

  if (
    ruleCode ===
    PRICING_RULE_CODE
      .VOLUMETRIC_DIVISOR
  ) {
    return formatNumber(value);
  }

  if (
    calculationType ===
    "PERCENTAGE"
  ) {
    return `${new Intl.NumberFormat(
      "vi-VN",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    ).format(value)}%`;
  }

  return formatCurrency(value);
};

export const formatPricingLimit = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "Không giới hạn";
  }

  return formatCurrency(value);
};

export const getPricingRuleUnitLabel = (
  rule
) => {
  const ruleCode =
    normalizeUpperText(
      rule?.ruleCode
    );

  const conditionType =
    normalizeUpperText(
      rule?.conditionType
    );

  const map = {
    [PRICING_RULE_CODE.WOOD_CRATE]:
      "Một lần cho toàn đơn",

    [PRICING_RULE_CODE.DOMESTIC_FEE]:
      "Theo đơn",

    [PRICING_RULE_CODE.SUR_INSPECTION]:
      "Theo đơn",

    [PRICING_RULE_CODE.SUR_INSURANCE_3PERCENT]:
      "Theo giá trị khai báo",

    [PRICING_RULE_CODE.VAT]:
      "Theo phí vận chuyển và dịch vụ",

    [PRICING_RULE_CODE.IMPORT_TAX]:
      "Theo giá trị khai báo",

    [PRICING_RULE_CODE.VOLUMETRIC_DIVISOR]:
      "Hệ số quy đổi, không phải khoản phí",
  };

  return (
    map[ruleCode] ||
    (conditionType ===
      "MIN_DECLARED_VALUE"
      ? "Áp dụng theo giá trị khai báo tối thiểu"
      : "Theo cấu hình hệ thống")
  );
};

export const getPricingRuleCalculationLabel = (
  rule
) => {
  const calculationType =
    normalizeUpperText(
      rule?.calculationType
    );

  if (
    calculationType ===
    "PERCENTAGE"
  ) {
    return "Phần trăm";
  }

  if (
    calculationType === "FIXED"
  ) {
    return "Cố định";
  }

  return (
    rule?.calculationTypeDisplayName ||
    calculationType ||
    "Chưa xác định"
  );
};

export const translateShippingOption = (
  value
) => {
  const map = {
    STANDARD: "Tiêu chuẩn",
    EXPRESS: "Hỏa tốc",
    ECONOMY: "Tiết kiệm",
  };

  const code =
    normalizeUpperText(value);

  return (
    map[code] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

export const translateCountry = (value) => {
  const code =
    normalizeText(value)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(/Đ/g, "D")
      .replace(/đ/g, "d")
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toUpperCase();

  const map = {
    CN: "Trung Quốc",
    CHINA: "Trung Quốc",
    TRUNGQUOC: "Trung Quốc",
    JP: "Nhật Bản",
    JAPAN: "Nhật Bản",
    NHATBAN: "Nhật Bản",
    KR: "Hàn Quốc",
    KOREA: "Hàn Quốc",
    SOUTHKOREA: "Hàn Quốc",
    HANQUOC: "Hàn Quốc",
    VN: "Việt Nam",
    VIETNAM: "Việt Nam",
    USA: "Hoa Kỳ",
    UNITEDSTATES: "Hoa Kỳ",
  };

  return (
    map[code] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

export const translateRoute = (value) => {
  const text = normalizeText(value);

  if (!text) {
    return "Chưa xác định";
  }

  const parts = text
    .split(
      /\s*(?:-->|->|→|⇒|đến|to|-)\s*/i
    )
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts
      .map(translateCountry)
      .join(" → ");
  }

  return translateCountry(text);
};
