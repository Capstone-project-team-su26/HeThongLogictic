/*
 * Hàm thuần dùng cho màn hình chi tiết đơn ký gửi.
 *
 * Tách khỏi ConsignmentDetail.jsx vì các hàm này chỉ phụ thuộc tham số
 * và bảng tra tĩnh, không đọc state/props/hook nào, nên đọc và thử riêng
 * được mà không cần dựng cả trang.
 *
 * Thứ tự khai báo giữ nguyên như file gốc để quan hệ phụ thuộc
 * giữa các hàm không đổi.
 */

import { normalizeOrderStatus } from "../../constants/orderStatus";

import {
  DIM_DECIMAL_PLACES,
  ORDER_STATUS_CONFIG,
  QUOTATION_STATUS_CONFIG,
  STATUS_LABEL_MAP,
} from "./ConsignmentDetail.constants";

/* =========================
   BASIC HELPERS
========================= */

export const normalizeText = (value) => {
  return String(value ?? "").trim();
};

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

export const roundToDecimals = (
  value,
  decimals = DIM_DECIMAL_PLACES
) => {
  const number = normalizeNumber(value, 0);
  const factor = 10 ** decimals;

  return Math.round(
    (number + Number.EPSILON) * factor
  ) / factor;
};

export const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0 ₫";
  }

  const roundedAmount = Math.round(number);

  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(roundedAmount)} ₫`;
};

/**
 * Định dạng số đo linh hoạt:
 * 27   -> 27
 * 3.2  -> 3,2
 * 3.25 -> 3,25
 *
 * Không ép số 0 ở cuối.
 */
export const formatMeasurement = (
  value,
  maximumFractionDigits = 4
) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  const safeDigits = Math.max(
    0,
    Math.min(
      10,
      Math.trunc(
        normalizeNumber(
          maximumFractionDigits,
          4
        )
      )
    )
  );

  const roundedNumber = Number(
    number.toFixed(safeDigits)
  );

  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits:
      safeDigits,
    useGrouping: true,
  }).format(roundedNumber);
};

/**
 * DIM giữ tối đa 4 chữ số thập phân nhưng không ép số 0 ở cuối.
 * 6      -> 6
 * 6.25   -> 6,25
 * 0.0016 -> 0,0016
 */
export const formatDimWeight = (value) => {
  return formatMeasurement(
    roundToDecimals(
      value,
      DIM_DECIMAL_PLACES
    ),
    DIM_DECIMAL_PLACES
  );
};

export const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const translateStatusLabel = (
  value
) => {
  const normalizedStatus =
    normalizeText(value)
      .toUpperCase();

  if (!normalizedStatus) {
    return "Chưa xác định";
  }

  return (
    STATUS_LABEL_MAP[
    normalizedStatus
    ] ||
    "Trạng thái khác"
  );
};

export const translateCountryName = (
  value
) => {
  const originalValue =
    normalizeText(value);

  const normalizedValue =
    originalValue
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(/Đ/g, "D")
      .replace(/đ/g, "d")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

  const countryMap = {
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
  };

  return (
    countryMap[normalizedValue] ||
    originalValue ||
    "Chưa xác định"
  );
};

export const translateRoute = (value) => {
  const routeText =
    normalizeText(value);

  if (!routeText) {
    return "Chưa xác định";
  }

  const routeParts = routeText
    .split(
      /\s*(?:-->|->|→|⇒|đến|to)\s*/i
    )
    .map((part) => part.trim())
    .filter(Boolean);

  if (routeParts.length >= 2) {
    return routeParts
      .map(translateCountryName)
      .join(" → ");
  }

  return translateCountryName(
    routeText
  );
};

export const translateConsignmentType = (
  value
) => {
  const originalValue =
    normalizeText(value);

  const normalizedValue =
    originalValue
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const typeMap = {
    express: "Hỏa tốc",
    expedited: "Hỏa tốc",
    priority: "Ưu tiên",
    standard: "Tiêu chuẩn",
    normal: "Tiêu chuẩn",
    economy: "Tiết kiệm",
  };

  if (typeMap[normalizedValue]) {
    return typeMap[normalizedValue];
  }

  /*
   * Nếu API đã trả tiếng Việt thì giữ nguyên.
   * Không đưa mã tiếng Anh chưa dịch ra giao diện.
   */
  if (
    /[À-ỹ]/.test(
      originalValue
    )
  ) {
    return originalValue;
  }

  return originalValue
    ? "Loại dịch vụ khác"
    : "Chưa xác định";
};

export const translateQuoteType = (
  value
) => {
  const quoteTypeMap = {
    ESTIMATE: "Báo giá tạm tính",
    TEMPORARY: "Báo giá tạm tính",
    OFFICIAL: "Báo giá chính thức",
  };

  const normalizedValue =
    normalizeText(value)
      .toUpperCase();

  return (
    quoteTypeMap[
    normalizedValue
    ] ||
    (normalizedValue
      ? "Loại báo giá khác"
      : "—")
  );
};

export const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalizeText(value)
  );
};

export const translateCalculationType = (value) => {
  const typeMap = {
    FIXED: "Mức phí cố định",
    PERCENTAGE: "Tính theo tỷ lệ phần trăm",
  };

  const normalizedValue =
    normalizeText(value).toUpperCase();

  return (
    typeMap[normalizedValue] ||
    "Cách tính theo cấu hình hệ thống"
  );
};

export const translateConditionType = (value) => {
  const conditionMap = {
    "": "Áp dụng theo cấu hình của đơn hàng",
    "VND/KIỆN": "Tính theo từng kiện hàng",
    FREIGHT_PLUS_SERVICE:
      "Tính trên phí vận chuyển quốc tế và phí dịch vụ",
    DECLARED_VALUE:
      "Tính trên tổng giá trị hàng hóa khai báo",
    MIN_DECLARED_VALUE:
      "Áp dụng khi giá trị hàng hóa đạt mức tối thiểu",
    REQUIRES_INSPECTION:
      "Áp dụng khi khách hàng yêu cầu kiểm hàng",
  };

  const normalizedValue =
    normalizeText(value).toUpperCase();

  return (
    conditionMap[normalizedValue] ||
    "Áp dụng theo điều kiện của hệ thống"
  );
};

export const translatePackageConfiguration = (
  packageConfig
) => {
  const code = normalizeText(
    packageConfig?.configCode
  ).toUpperCase();

  const nameMap = {
    SMALL: "Thùng nhỏ",
    MEDIUM: "Thùng vừa",
    LARGE: "Thùng lớn",
    CUSTOM: "Đóng gói theo kích thước thực tế",
  };

  return (
    nameMap[code] ||
    normalizeText(packageConfig?.configName) ||
    "Cấu hình đóng gói"
  );
};

export const formatSystemDescription = (value) => {
  return normalizeText(value)
    .replace(/FreightCharge/gi, "phí vận chuyển quốc tế")
    .replace(/ServiceFee/gi, "phí dịch vụ")
    .replace(/DOMESTIC_FEE/gi, "phí vận chuyển nội địa")
    .replace(/DeclaredValue/gi, "giá trị hàng hóa khai báo")
    .replace(/declared value/gi, "giá trị hàng hóa khai báo")
    .replace(/ImportTax/gi, "thuế nhập khẩu")
    .replace(/fallback/gi, "mức áp dụng mặc định")
    .replace(/WOOD_CRATE/gi, "đóng thùng gỗ")
    .replace(/SUR_INSPECTION/gi, "phí kiểm hàng")
    .replace(
      /SUR_INSURANCE_3PERCENT/gi,
      "phí bảo hiểm hàng hóa"
    )
    .replace(/VOLUMETRIC_DIVISOR/gi, "hệ số quy đổi thể tích")
    .replace(/VAT/gi, "thuế giá trị gia tăng");
};

export const formatOrderNote = (value) => {
  const text = formatSystemDescription(value);

  return text || "Không có ghi chú";
};

export const getOrderStatus = (status) => {
  /* Mã cũ còn sót được quy về mã đích trước khi tra bảng. */
  const normalizedStatus =
    normalizeText(
      normalizeOrderStatus(status)
    ).toUpperCase();

  return (
    ORDER_STATUS_CONFIG[
    normalizedStatus
    ] || {
      label:
        translateStatusLabel(
          normalizedStatus
        ),
      className: "is-default",
    }
  );
};

export const getQuotationStatus = (
  status
) => {
  const normalizedStatus =
    normalizeText(status)
      .toUpperCase();

  return (
    QUOTATION_STATUS_CONFIG[
    normalizedStatus
    ] || {
      label:
        translateStatusLabel(
          normalizedStatus
        ),
      className: "is-default",
    }
  );
};

export const convertCm3ToM3 = (
  volumeCm3
) => {
  return (
    normalizePositiveNumber(
      volumeCm3
    ) / 1_000_000
  );
};

/* =========================
   ITEM HELPERS
========================= */

export const getItemName = (item) => {
  return (
    normalizeText(item?.name) ||
    normalizeText(
      item?.productName
    ) ||
    normalizeText(
      item?.itemName
    ) ||
    "Sản phẩm"
  );
};

export const getItemWeightKg = (item) => {
  return normalizePositiveNumber(
    item?.weight ??
    item?.actualWeight ??
    item?.totalWeight ??
    item?.weightKg
  );
};

export const getItemLengthCm = (item) => {
  return normalizePositiveNumber(
    item?.length ??
    item?.lengthCm
  );
};

export const getItemWidthCm = (item) => {
  return normalizePositiveNumber(
    item?.width ??
    item?.widthCm
  );
};

export const getItemHeightCm = (item) => {
  return normalizePositiveNumber(
    item?.height ??
    item?.heightCm
  );
};

export const getItemQuantity = (item) => {
  return Math.max(
    0,
    Math.trunc(
      normalizePositiveNumber(
        item?.quantity
      )
    )
  );
};

export const getItemDeclaredValue = (item) => {
  return normalizePositiveNumber(
    item?.declaredValue
  );
};

export const getItemDomesticTrackingCode = (
  item
) => {
  return normalizeText(
    item?.domesticTrackingCode ??
    item?.trackingNumber
  );
};


/* =========================
   IMAGE HELPERS
========================= */

export const collectImageUrls = (source) => {
  if (
    source === undefined ||
    source === null ||
    source === ""
  ) {
    return [];
  }

  if (Array.isArray(source)) {
    return source.flatMap(
      collectImageUrls
    );
  }

  if (typeof source === "object") {
    const directUrl =
      source?.url ??
      source?.imageUrl ??
      source?.fileUrl ??
      source?.src ??
      source?.path ??
      source?.secureUrl;

    if (directUrl) {
      return collectImageUrls(
        directUrl
      );
    }

    return collectImageUrls(
      source?.images ??
      source?.urls ??
      source?.files ??
      source?.attachments ??
      []
    );
  }

  const text =
    normalizeText(source);

  if (!text) {
    return [];
  }

  if (
    (text.startsWith("[") &&
      text.endsWith("]")) ||
    (text.startsWith("{") &&
      text.endsWith("}"))
  ) {
    try {
      return collectImageUrls(
        JSON.parse(text)
      );
    } catch {
      // Tiếp tục dùng như URL thường.
    }
  }

  return [text];
};

export const getItemImageUrls = (item) => {
  const sources = [
    item?.referenceUrls,
    item?.imageUrls,
    item?.images,
    item?.productImages,
    item?.referenceImages,
    item?.attachments,
    item?.imageUrl,
    item?.productImageUrl,
    item?.thumbnailUrl,
  ];

  return Array.from(
    new Set(
      sources
        .flatMap(collectImageUrls)
        .map(normalizeText)
        .filter(Boolean)
    )
  );
};

export const getItemPackageConfiguration = (
  item
) => {
  return (
    item?.packageConfiguration ||
    null
  );
};

export const getItemPackageFee = (item) => {
  const config = getItemPackageConfiguration(item);
  if (!config) return 0;

  const estimatedFee = Number(config?.estimatedFee);
  if (Number.isFinite(estimatedFee) && estimatedFee > 0) {
    return estimatedFee;
  }

  const baseFee = normalizePositiveNumber(config?.packageFee);
  if (baseFee <= 0) return 0;

  const maxFee = Number(config?.maxFee ?? config?.maxPackageFee);
  const hasMaxFee = Number.isFinite(maxFee) && maxFee > 0;

  const configCode = String(config?.configCode ?? "").toUpperCase();
  const isCustom = configCode === "CUSTOM" || configCode.includes("CUSTOM");

  if (isCustom) {
    const volumeCm3 = calculateItemVolumeCm3(item);
    if (volumeCm3 > 0) {
      const calculatedFee = Math.round((volumeCm3 / 1000) * baseFee);
      return hasMaxFee ? Math.min(calculatedFee, maxFee) : calculatedFee;
    }
  }

  return baseFee;
};

/**
 * Dịch vụ khách chọn cho RIÊNG kiện này (kiểm hàng, bảo hiểm, đóng lại carton...).
 *
 * Backend trả `items[].services[]` dạng
 * { pricingRuleId, code, name, ruleType, calculationType, value, minAmount, maxAmount, description }.
 * Sale cần nhìn thấy đúng thứ khách đã chọn trước khi báo giá, vì hệ thống tự
 * tính phí cho từng dịch vụ này và Sale chỉ được sửa số tiền, không chọn lại.
 */
export const getItemServices = (item) =>
  Array.isArray(item?.services)
    ? item.services.filter(Boolean)
    : [];

/** Nhãn ngắn của một dịch vụ theo kiện, kèm cách tính để Sale hiểu con số. */
export const describeItemService = (service) => {
  const name =
    normalizeText(service?.name) ||
    normalizeText(service?.code) ||
    "Dịch vụ";

  const calculationType = String(
    service?.calculationType ?? ""
  ).toUpperCase();

  const value = Number(service?.value);

  if (!Number.isFinite(value) || value <= 0) {
    return name;
  }

  if (calculationType === "PERCENTAGE") {
    return `${name} · ${value}% giá trị khai báo`;
  }

  if (calculationType === "PER_KG") {
    return `${name} · ${formatCurrency(value)}/kg`;
  }

  if (calculationType === "PER_PRODUCT") {
    return `${name} · ${formatCurrency(value)}/sản phẩm`;
  }

  return `${name} · ${formatCurrency(value)}`;
};

export const getItemApiDimWeight = (item) => {
  const value = Number(
    item?.volumetricWeight
  );

  return Number.isFinite(value) &&
    value >= 0
    ? value
    : null;
};

export const calculateItemVolumeCm3 = (
  item
) => {
  const length = getItemLengthCm(
    item
  );
  const width = getItemWidthCm(item);
  const height = getItemHeightCm(
    item
  );

  if (
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return 0;
  }

  /*
   * Mỗi dòng sản phẩm được tính là 1 kiện.
   * Không nhân thêm quantity.
   */
  return length * width * height;
};

export const calculateItemDimKg = (
  item,
  divisor
) => {
  /*
   * Ưu tiên khối lượng quy đổi đã có trong dữ liệu kiện hàng.
   * Chỉ tự tính khi kiện hàng chưa có khối lượng quy đổi
   * và hệ thống có hệ số quy đổi hợp lệ.
   */
  const apiDimWeight =
    getItemApiDimWeight(item);

  if (apiDimWeight !== null) {
    return apiDimWeight;
  }

  const volumeCm3 =
    calculateItemVolumeCm3(item);

  const divisorValue =
    normalizePositiveNumber(divisor);

  if (
    volumeCm3 <= 0 ||
    divisorValue <= 0
  ) {
    return 0;
  }

  return volumeCm3 / divisorValue;
};

export const getProductTypeId = (item) => {
  return normalizeText(
    item?.productTypeId ??
    item?.productTypeID ??
    item?.productType?.id ??
    item?.productType?.productTypeId
  );
};

export const getProductTypeName = (
  item,
  productTypeMap
) => {
  /*
   * Ưu tiên tên loại hàng nếu dữ liệu chi tiết
   * đã trả trực tiếp productTypeName.
   */
  const directName =
    normalizeText(
      item?.productTypeName
    ) ||
    normalizeText(
      item?.productType?.name
    );

  if (directName) {
    return directName;
  }

  /*
   * Trường productType có thể là:
   * - Tên loại hàng, ví dụ "Điện tử"
   * - ID loại hàng dạng UUID
   */
  const productTypeValue =
    typeof item?.productType ===
      "string"
      ? normalizeText(
        item.productType
      )
      : "";

  if (productTypeValue) {
    const mappedName =
      productTypeMap.get(
        productTypeValue
      ) ||
      productTypeMap.get(
        productTypeValue.toLowerCase()
      );

    if (mappedName) {
      return mappedName;
    }

    return isUuid(productTypeValue)
      ? "Chưa phân loại"
      : productTypeValue;
  }

  const productTypeId =
    getProductTypeId(item);

  if (!productTypeId) {
    return "Chưa phân loại";
  }

  return (
    productTypeMap.get(
      productTypeId
    ) ||
    productTypeMap.get(
      productTypeId.toLowerCase()
    ) ||
    "Chưa phân loại"
  );
};
