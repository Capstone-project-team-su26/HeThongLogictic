/* =========================
   HÀM THUẦN CỦA TRANG LẬP BÁO GIÁ
   Chỉ phụ thuộc tham số và hằng số, không chạm state/hook,
   nên tách ra được mà không đổi thứ component render.
========================= */

import {
  PRICING_RULE_CODE,
} from "@features/pricing/api/pricingRuleService";
import {
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "@shared/utils/timeUtc";

import { normalizeOrderStatus } from "../../constants/orderStatus";

import {
  DIM_DECIMAL_PLACES,
  ORDER_STATUS_CONFIG,
  WAREHOUSE_COUNTRY_KEYWORDS,
} from "./CreateConsignmentQuotation.constants";

/* =========================
   HÀM CHUẨN HÓA
========================= */

export const normalizeText = (value) =>
  String(value ?? "").trim();

export const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

export const normalizePositiveNumber = (
  value,
  fallback = 0
) => {
  return Math.max(
    0,
    normalizeNumber(value, fallback)
  );
};

export const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

export const normalizeSearchText = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toUpperCase();

export const roundToDecimals = (
  value,
  decimals = DIM_DECIMAL_PLACES
) => {
  const factor = 10 ** decimals;

  return (
    Math.round(
      (
        normalizeNumber(value, 0) +
        Number.EPSILON
      ) *
      factor
    ) / factor
  );
};

export const roundMoney = (value) =>
  Math.round(
    normalizePositiveNumber(value)
  );

export const getClientUtcPayload = () => {
  const browserTime =
    getBrowserTimeInfo();
  const submittedAtUtc =
    getSyncedNowUtcIso();

  return {
    submittedAtUtc,
    clientSubmittedAtUtc:
      submittedAtUtc,
    clientTimeZone:
      browserTime.timeZone,
    clientUtcOffset:
      browserTime.utcOffsetText,
    clientUtcOffsetMinutes:
      browserTime.utcOffsetMinutes,
  };
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundMoney(value));
};

export const formatMeasurement = (
  value,
  maximumFractionDigits = 4
) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
    useGrouping: true,
  }).format(number);
};

export const formatDimWeight = (value) => {
  const number =
    normalizePositiveNumber(value);

  return new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits:
        DIM_DECIMAL_PLACES,

      maximumFractionDigits:
        DIM_DECIMAL_PLACES,

      useGrouping: true,
    }
  ).format(
    roundToDecimals(
      number,
      DIM_DECIMAL_PLACES
    )
  );
};

export const translateConsignmentType = (
  value
) => {
  const normalizedValue =
    normalizeSearchText(value)
      .replace(/[^A-Z0-9]/g, "");

  const map = {
    EXPRESS: "Hỏa tốc",
    EXPEDITED: "Hỏa tốc",
    HOATOC: "Hỏa tốc",
    STANDARD: "Tiêu chuẩn",
    TIEUCHUAN: "Tiêu chuẩn",
    ECONOMY: "Tiết kiệm",
    TIETKIEM: "Tiết kiệm",
  };

  return (
    map[normalizedValue] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

export const normalizeServiceTypeCode = (
  value
) => {
  const normalizedValue =
    normalizeSearchText(value)
      .replace(/[^A-Z0-9]/g, "");

  const map = {
    EXPRESS: "EXPRESS",
    EXPEDITED: "EXPRESS",
    HOATOC: "EXPRESS",
    STANDARD: "STANDARD",
    TIEUCHUAN: "STANDARD",
    ECONOMY: "ECONOMY",
    TIETKIEM: "ECONOMY",
  };

  return (
    map[normalizedValue] ||
    normalizedValue
  );
};

export const normalizeCountryCode = (
  value
) => {
  const normalizedValue =
    normalizeSearchText(value)
      .replace(/[^A-Z0-9]/g, "");

  const map = {
    CN: "CN",
    CHINA: "CN",
    TRUNGQUOC: "CN",

    JP: "JP",
    JAPAN: "JP",
    NHATBAN: "JP",

    KR: "KR",
    KOREA: "KR",
    SOUTHKOREA: "KR",
    HANQUOC: "KR",

    VN: "VN",
    VIETNAM: "VN",
  };

  return (
    map[normalizedValue] ||
    normalizedValue
  );
};

export const getCountryName = (code) => {
  const map = {
    CN: "Trung Quốc",
    JP: "Nhật Bản",
    KR: "Hàn Quốc",
    VN: "Việt Nam",
  };

  return map[code] || code || "Chưa xác định";
};

export const parseRouteCountries = (route) => {
  const parts = normalizeText(route)
    .split(/-->|->|→|⇒| đến /i)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    originCountry:
      parts[0] || "",
    destinationCountry:
      parts[parts.length - 1] || "",
  };
};

export const getOrderStatus = (status) => {
  return (
    ORDER_STATUS_CONFIG[
    normalizeUpperText(
      normalizeOrderStatus(status)
    )
    ] || {
      label:
        normalizeText(status) ||
        "Chưa xác định",
      className: "is-default",
    }
  );
};

export const getUnitTypeLabel = (unitType) => {
  const map = {
    KG: "Theo khối lượng tính cước",
    M3: "Theo thể tích",
    PACKAGE: "Theo số kiện",
  };

  return (
    map[normalizeUpperText(unitType)] ||
    "Theo đơn vị của bảng giá"
  );
};

export const getUnitSuffix = (unitType) => {
  const map = {
    KG: "kg",
    M3: "m³",
    PACKAGE: "kiện",
  };

  return (
    map[normalizeUpperText(unitType)] ||
    ""
  );
};

/* =========================
   KIỆN HÀNG VÀ DIM
========================= */

export const getItemWeightKg = (item) =>
  normalizePositiveNumber(
    item?.weight ??
    item?.actualWeight ??
    item?.totalWeight ??
    item?.weightKg
  );

export const getItemLengthCm = (item) =>
  normalizePositiveNumber(
    item?.length ??
    item?.lengthCm
  );

export const getItemWidthCm = (item) =>
  normalizePositiveNumber(
    item?.width ??
    item?.widthCm
  );

export const getItemHeightCm = (item) =>
  normalizePositiveNumber(
    item?.height ??
    item?.heightCm
  );

export const getItemDeclaredValue = (item) =>
  normalizePositiveNumber(
    item?.declaredValue
  );

export const calculateItemVolumeCm3 = (
  item
) => {
  const length = getItemLengthCm(item);
  const width = getItemWidthCm(item);
  const height = getItemHeightCm(item);

  if (
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return 0;
  }

  return length * width * height;
};

export const calculateItemDimKg = (
  item,
  divisor
) => {
  const returnedDim =
    Number(item?.volumetricWeight);

  if (
    Number.isFinite(returnedDim) &&
    returnedDim >= 0
  ) {
    return returnedDim;
  }

  const validDivisor =
    normalizePositiveNumber(divisor);

  if (validDivisor <= 0) {
    return 0;
  }

  return (
    calculateItemVolumeCm3(item) /
    validDivisor
  );
};

/* =========================
   CHỌN KHO THEO TUYẾN
========================= */

export const warehouseMatchesCountry = (
  warehouse,
  countryCode
) => {
  if (!countryCode) {
    return false;
  }

  /*
   * Backend trả `region` / `regionCode` là mã quốc gia ISO ("CN", "KR", "JP").
   * Đây là cách khớp CHẮC CHẮN nhất — mã kho và địa chỉ chỉ là phương án dự phòng
   * cho dữ liệu cũ chưa điền vùng.
   */
  const region = normalizeSearchText(
    warehouse?.regionCode ||
    warehouse?.region
  );

  if (region && region === countryCode) {
    return true;
  }

  const code =
    normalizeSearchText(
      warehouse?.code
    );

  if (
    code === countryCode ||
    code.startsWith(`${countryCode}-`) ||
    code.startsWith(countryCode)
  ) {
    return true;
  }

  const searchableText =
    normalizeSearchText(
      [
        warehouse?.name,
        warehouse?.code,
        warehouse?.address,
      ]
        .filter(Boolean)
        .join(" ")
    );

  const keywords =
    WAREHOUSE_COUNTRY_KEYWORDS[
    countryCode
    ] || [];

  return keywords.some((keyword) =>
    searchableText.includes(
      normalizeSearchText(keyword)
    )
  );
};

/* =========================
   PHỤ PHÍ KHÁCH ĐÃ CHỌN
========================= */

export const getSelectedRuleIds = (detail) => {
  return new Set(
    Array.isArray(detail?.pricingRuleIds)
      ? detail.pricingRuleIds
        .map(normalizeText)
        .filter(Boolean)
      : []
  );
};

export const isRuleSelectedByCustomer = (
  rule,
  detail
) => {
  const ruleId =
    normalizeText(rule?.id);

  const ruleCode =
    normalizeUpperText(
      rule?.ruleCode
    );

  const selectedIds =
    getSelectedRuleIds(detail);

  if (
    ruleId &&
    selectedIds.has(ruleId)
  ) {
    return true;
  }

  const note =
    normalizeUpperText(
      detail?.note
    );

  if (
    ruleCode &&
    note.includes(ruleCode)
  ) {
    return true;
  }

  if (
    ruleCode ===
    PRICING_RULE_CODE
      .SUR_INSPECTION &&
    detail?.requiresInspection === true
  ) {
    return true;
  }

  return false;
};

export const isRuleEligible = (
  rule,
  {
    declaredValue = 0,
    requiresInspection = false,
  } = {}
) => {
  const conditionType =
    normalizeUpperText(
      rule?.conditionType
    );

  if (
    conditionType ===
    "REQUIRES_INSPECTION"
  ) {
    return Boolean(
      requiresInspection
    );
  }

  if (
    conditionType ===
    "MIN_DECLARED_VALUE"
  ) {
    return (
      normalizePositiveNumber(
        declaredValue
      ) >=
      normalizePositiveNumber(
        rule?.conditionValue
      )
    );
  }

  return true;
};

/* =========================
   KẾT QUẢ TÍNH BÁO GIÁ
========================= */

/**
 * Tiền do Sale GHI ĐÈ: trả `null` khi ô để trống.
 *
 * Khác getFiniteMoney (luôn trả một con số): ở đây `null` mang nghĩa nghiệp vụ
 * "không ghi đè, để backend tự tính theo cấu hình". Gửi 0 thay cho null là nói
 * với backend rằng Sale chốt thuế bằng 0.
 */
export const normalizeNullableMoney = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) &&
    number > 0
    ? Math.round(number)
    : null;
};

export const getFiniteMoney = (
  ...values
) => {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return Math.round(
        Math.max(0, number)
      );
    }
  }

  return 0;
};
