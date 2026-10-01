/*
 * Hàm thuần của màn hình tạo đơn ký gửi: chuẩn hoá dữ liệu API, format/parse
 * input và validate biểu mẫu.
 * Tách ra đây vì chúng không đụng tới state/props — nhờ vậy ConsignmentOrder.jsx
 * chỉ còn phần thực sự phụ thuộc vòng đời React.
 */

import {
  UPLOAD_CONTAINER_KEYS,
  UPLOAD_URL_KEYS,
} from "./ConsignmentOrder.constants";

export const createUniqueId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createEmptyPackage = () => ({
  id: createUniqueId(),
  productName: "",
  productType: "",
  quantity: "",
  weight: "",
  width: "",
  height: "",
  length: "",
  declaredValue: "",
  trackingCode: "",
  packageConfigurationId: "",
  images: [],
});

export const createEmptyFormErrors = () => ({
  customerId: "",
  route: "",
  shippingOption: "",
  receiverName: "",
  receiverPhone: "",
  selectedDeliveryAddress: "",
  note: "",
  /* Lỗi cấp ĐƠN (tổng cân nặng / tổng giá trị vượt trần), không thuộc ô nào. */
  packages: "",
});

export const createEmptyAddressForm = () => ({
  provinceCode: "",
  districtCode: "",
  wardCode: "",
  detailAddress: "",
});

export const createEmptyAddressErrors = () => ({
  provinceCode: "",
  districtCode: "",
  wardCode: "",
  detailAddress: "",
});

export const isCanceledRequest = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

export const getApiErrorMessage = (error, fallbackMessage = "Đã xảy ra lỗi.") => {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  return (
    responseData?.message ||
    responseData?.title ||
    responseData?.error ||
    error?.message ||
    fallbackMessage
  );
};

export const getFieldClassName = (baseClassName, errorMessage) =>
  [baseClassName, errorMessage && "input-has-error"].filter(Boolean).join(" ");

export const sanitizeInteger = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  // Không cho giữ giá trị 0 hoặc các số 0 đứng đầu.
  // Ví dụ: "0" -> "", "0005" -> "5", "10" -> "10".
  return digits.replace(/^0+/, "");
};

export const sanitizeDecimal = (value) => {
  let normalized = String(value ?? "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const firstDotIndex = normalized.indexOf(".");

  if (firstDotIndex !== -1) {
    normalized =
      normalized.slice(0, firstDotIndex + 1) +
      normalized.slice(firstDotIndex + 1).replace(/\./g, "");
  }

  return normalized.startsWith(".") ? `0${normalized}` : normalized;
};

export const formatVnd = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
};


export const getDeliveryAddressText = (addressItem) =>
  String(
    addressItem?.fullAddress ||
      addressItem?.address ||
      "",
  ).trim();

export const isWoodCrateMeasurementField = (field) =>
  ["weight", "length", "width", "height"].includes(
    field,
  );

export const preventInvalidNumberKeys = (event) => {
  if (["-", "+", "e", "E"].includes(event.key)) {
    event.preventDefault();
  }
};

export const preventMoneyKeys = (event) => {
  if (["-", "+", "e", "E", ",", "."].includes(event.key)) {
    event.preventDefault();
  }
};

export const findArrayFromResult = (result, extraKeys = []) => {
  const candidates = [
    result,
    result?.data,
    result?.items,
    result?.results,
    result?.data?.items,
    result?.data?.results,
    ...extraKeys.flatMap((key) => [result?.[key], result?.data?.[key]]),
  ];

  return candidates.find(Array.isArray) || [];
};

export const normalizeOptionList = (result, extraKeys = []) =>
  findArrayFromResult(result, extraKeys)
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") {
        const value = String(item).trim();
        return { value, label: value };
      }

      const value = String(
        item?.value ??
          item?.code ??
          item?.route ??
          item?.shippingOption ??
          item?.productType ??
          item?.routeId ??
          item?.shippingOptionId ??
          item?.productTypeId ??
          item?.id ??
          "",
      ).trim();

      const label = String(
        item?.label ??
          item?.name ??
          item?.displayName ??
          item?.routeName ??
          item?.shippingOptionName ??
          item?.productTypeName ??
          item?.description ??
          value,
      ).trim();

      return { value, label };
    })
    .filter((item) => item.value && item.label);

export const normalizeOptionCode = (value) => {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
};


export const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      String(item ?? "").trim()
    )
    .filter(Boolean);
};

export const normalizePricingRuleIds = (value) => {
  return Array.from(
    new Set(
      normalizeStringArray(value)
    )
  );
};

export const normalizePackageConfigurationMap = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([packageId, configurationId]) => [
        String(packageId || "").trim(),
        String(configurationId || "").trim(),
      ])
      .filter(([packageId, configurationId]) =>
        Boolean(packageId && configurationId),
      ),
  );
};

export const getMissingWoodCratePackages = ({
  optionalServices,
  packages,
}) => {
  if (optionalServices?.requiresWoodenCrate !== true) {
    return [];
  }

  const configurationMap = normalizePackageConfigurationMap(
    optionalServices?.packageConfigurationByPackageId,
  );

  return packages.filter((pkg) => {
    const configurationId = String(
      configurationMap[pkg.id] ||
        pkg?.packageConfigurationId ||
        "",
    ).trim();

    return !configurationId;
  });
};

export const getShippingOptionLabel = (value, label) => {
  const normalizedValues = [
    normalizeOptionCode(value),
    normalizeOptionCode(label),
  ];

  if (
    normalizedValues.some(
      (item) =>
        item === "EXPRESS" || item === "HOA_TOC" || item.includes("EXPRESS"),
    )
  ) {
    return "Hỏa tốc";
  }

  if (
    normalizedValues.some(
      (item) =>
        item === "STANDARD" ||
        item === "TIEU_CHUAN" ||
        item.includes("STANDARD"),
    )
  ) {
    return "Tiêu chuẩn";
  }

  return String(label ?? "").trim() || String(value ?? "").trim() || "-";
};

export const normalizeShippingOptionList = (result) => {
  return normalizeOptionList(result, ["shippingOptions"]).map((option) => ({
    ...option,
    label: getShippingOptionLabel(option.value, option.label),
  }));
};

export const normalizeDeliveryAddress = (item, index = 0) => {
  if (!item) {
    return null;
  }

  if (typeof item === "string") {
    const address = item.trim();

    return address
      ? {
          id: `address-${index}`,
          apiId: "",
          address,
          fullAddress: address,
          detailAddress: "",
          provinceCode: "",
          provinceName: "",
          districtCode: "",
          districtName: "",
          wardCode: "",
          wardName: "",
          isDefault: false,
          raw: item,
        }
      : null;
  }

  const fullAddress = String(
    item.fullAddress ||
      item.address ||
      item.receiverAddress ||
      item.deliveryAddress ||
      "",
  ).trim();

  if (!fullAddress) {
    return null;
  }

  const apiId = String(
    item.deliveryAddressId || item.addressId || item.id || "",
  ).trim();

  return {
    id: apiId || `address-${index}`,
    apiId,
    address: fullAddress,
    fullAddress,
    detailAddress: String(item.detailAddress || "").trim(),
    provinceCode: String(item.provinceCode || item.province_code || "").trim(),
    provinceName: String(item.provinceName || item.province_name || "").trim(),
    districtCode: String(item.districtCode || item.district_code || "").trim(),
    districtName: String(item.districtName || item.district_name || "").trim(),
    wardCode: String(item.wardCode || item.ward_code || "").trim(),
    wardName: String(item.wardName || item.ward_name || "").trim(),
    isDefault: Boolean(item.isDefault),
    raw: item,
  };
};

export const normalizeDeliveryAddressList = (result) =>
  findArrayFromResult(result, ["addresses", "deliveryAddresses"])
    .map(normalizeDeliveryAddress)
    .filter(Boolean);

export const isLikelyUploadedImageUrl = (value) => {
  const text = String(value || "").trim();

  if (!text) {
    return false;
  }

  return (
    /^(https?:\/\/|blob:|data:image\/)/i.test(text) ||
    /^\/[^/\s]/.test(text) ||
    /(?:^|\/)(?:uploads?|images?|files?)\//i.test(text) ||
    /\.(?:jpe?g|png|webp|gif|heic|heif|avif)(?:[?#].*)?$/i.test(text)
  );
};

export const parseUploadJsonString = (value) => {
  const text = String(value || "").trim();

  if (
    !text ||
    (!text.startsWith("{") && !text.startsWith("["))
  ) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const extractUploadedImageUrls = (result) => {
  const urls = [];
  const visited = new WeakSet();

  const addUrl = (value) => {
    const text = String(value || "").trim();

    if (
      isLikelyUploadedImageUrl(text) &&
      !urls.includes(text)
    ) {
      urls.push(text);
    }
  };

  const visit = (value, depth = 0) => {
    if (value === null || value === undefined || depth > 8) {
      return;
    }

    if (typeof value === "string") {
      const parsedValue = parseUploadJsonString(value);

      if (parsedValue !== null) {
        visit(parsedValue, depth + 1);
        return;
      }

      addUrl(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    if (visited.has(value)) {
      return;
    }

    visited.add(value);

    UPLOAD_URL_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        visit(value[key], depth + 1);
      }
    });

    UPLOAD_CONTAINER_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        visit(value[key], depth + 1);
      }
    });

    Object.entries(value).forEach(([key, nestedValue]) => {
      if (
        UPLOAD_URL_KEYS.includes(key) ||
        UPLOAD_CONTAINER_KEYS.includes(key) ||
        [
          "message",
          "title",
          "error",
          "status",
          "statusCode",
          "success",
        ].includes(key)
      ) {
        return;
      }

      visit(nestedValue, depth + 1);
    });
  };

  visit(result);

  return urls;
};

export const extractUploadedImageUrl = (result) => {
  return extractUploadedImageUrls(result)[0] || "";
};

export const validatePositiveNumber = (value, label) => {
  if (value === "") {
    return `Vui lòng nhập ${label}.`;
  }

  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    return `${label} phải lớn hơn 0.`;
  }

  return "";
};

/*
 * GIỚI HẠN NGHIỆP VỤ — không còn số cứng. Admin cấu hình ở trang "Tham số vận hành"
 * (mục Giới hạn tạo đơn), màn hình đọc qua GET /api/system-settings/order-limits
 * (useOrderLimits) rồi truyền `limits` (nhánh `consignment`) vào các hàm dưới đây —
 * đúng bộ số backend dùng ở OrderService.EnsureItemsWithinLimitsAsync.
 *
 * Giá trị null = không giới hạn. Chưa tải được thì mọi giới hạn là null và màn hình không
 * chặn — backend vẫn kiểm, trả 400 nêu đúng giới hạn hiện hành.
 */
export const NO_CONSIGNMENT_LIMITS = Object.freeze({
  maxParcelQuantity: null,
  maxItemDeclaredValue: null,
  maxParcelWeightKg: null,
  maxParcelLengthCm: null,
  maxParcelWidthCm: null,
  maxParcelHeightCm: null,
  maxTotalWeightKg: null,
  maxTotalDeclaredValue: null,
  maxPackages: null,
});

/** Giới hạn có hiệu lực không (số dương hữu hạn). */
export const hasLimit = (value) => Number.isFinite(value) && value > 0;

const readLimits = (limits) => limits || NO_CONSIGNMENT_LIMITS;

/** Số kg/cm hiển thị kiểu Việt: 2,5 — không kèm số 0 thừa. */
export const formatLimitNumber = (value) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** Câu giải thích khi đơn đã đủ số kiện tối đa ("" nếu không giới hạn). */
export const getMaxPackagesMessage = (limits) => {
  const max = readLimits(limits).maxPackages;
  return hasLimit(max)
    ? `Mỗi đơn ký gửi tối đa ${max} kiện hàng. Cần gửi thêm thì tạo đơn mới.`
    : "";
};

const toText = (value) => String(value ?? "").trim();

const formatVndNumber = (value) => Number(value).toLocaleString("vi-VN");

/** Kiểm một ô số (cân nặng / kích thước / giá trị) > 0 và không vượt trần (nếu có). */
const validateMeasure = (raw, { emptyMessage, positiveMessage, max, overMessage }) => {
  if (toText(raw) === "") return emptyMessage;

  const number = Number(raw);

  if (!Number.isFinite(number) || number <= 0) return positiveMessage;
  if (hasLimit(max) && number > max) return overMessage;

  return "";
};

/*
 * MỘT Ô = MỘT HÀM KIỂM. Màn hình gọi đúng những hàm này lúc Sale đang gõ / vừa rời ô, còn
 * lúc bấm gửi thì validatePackage / validateConsignmentForm chạy lại cũng chính chúng —
 * không bao giờ có chuyện "gõ thì im, bấm gửi mới báo" hay hai nơi nói hai câu khác nhau.
 * Tham số thứ hai là giới hạn đang áp dụng (có thể null = chưa tải → không chặn trần).
 */
export const PACKAGE_FIELD_VALIDATORS = Object.freeze({
  productName: (pkg) =>
    toText(pkg?.productName) ? "" : "Vui lòng nhập tên sản phẩm.",

  productType: (pkg) => (pkg?.productType ? "" : "Vui lòng chọn loại hàng hóa."),

  quantity: (pkg, limits) => {
    if (toText(pkg?.quantity) === "") return "Vui lòng nhập số lượng.";

    const quantity = Number(pkg.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return "Số lượng phải là số nguyên từ 1 trở lên.";
    }

    const max = readLimits(limits).maxParcelQuantity;
    if (hasLimit(max) && quantity > max) {
      return `Số lượng tối đa ${max} sản phẩm trên 1 kiện hàng.`;
    }

    return "";
  },

  declaredValue: (pkg, limits) => {
    const max = readLimits(limits).maxItemDeclaredValue;
    return validateMeasure(pkg?.declaredValue, {
      emptyMessage: "Vui lòng nhập giá trị khai báo.",
      positiveMessage: "Giá trị kiện hàng phải lớn hơn 0.",
      max,
      overMessage: `Giá trị 1 kiện hàng không được vượt quá ${formatVndNumber(max)} đ.`,
    });
  },

  weight: (pkg, limits) => {
    const max = readLimits(limits).maxParcelWeightKg;
    return validateMeasure(pkg?.weight, {
      emptyMessage: "Vui lòng nhập cân nặng.",
      positiveMessage: "Cân nặng phải lớn hơn 0.",
      max,
      overMessage: `Cân nặng tối đa ${formatLimitNumber(max)} kg cho mỗi kiện hàng.`,
    });
  },

  length: (pkg, limits) => {
    const max = readLimits(limits).maxParcelLengthCm;
    return validateMeasure(pkg?.length, {
      emptyMessage: "Vui lòng nhập chiều dài.",
      positiveMessage: "Chiều dài phải lớn hơn 0.",
      max,
      overMessage: `Chiều dài tối đa ${formatLimitNumber(max)} cm.`,
    });
  },

  width: (pkg, limits) => {
    const max = readLimits(limits).maxParcelWidthCm;
    return validateMeasure(pkg?.width, {
      emptyMessage: "Vui lòng nhập chiều rộng.",
      positiveMessage: "Chiều rộng phải lớn hơn 0.",
      max,
      overMessage: `Chiều rộng tối đa ${formatLimitNumber(max)} cm.`,
    });
  },

  height: (pkg, limits) => {
    const max = readLimits(limits).maxParcelHeightCm;
    return validateMeasure(pkg?.height, {
      emptyMessage: "Vui lòng nhập chiều cao.",
      positiveMessage: "Chiều cao phải lớn hơn 0.",
      max,
      overMessage: `Chiều cao tối đa ${formatLimitNumber(max)} cm.`,
    });
  },

  images: (pkg) =>
    pkg?.images?.length ? "" : "Vui lòng tải ít nhất 1 ảnh sản phẩm.",
});

/** Kiểm MỘT ô của kiện hàng — dùng khi Sale đang gõ hoặc vừa rời ô. */
export const validatePackageField = (field, pkg, limits) =>
  PACKAGE_FIELD_VALIDATORS[field] ? PACKAGE_FIELD_VALIDATORS[field](pkg, limits) : "";

export const validatePackage = (pkg, limits) =>
  Object.fromEntries(
    Object.entries(PACKAGE_FIELD_VALIDATORS)
      .map(([field, validate]) => [field, validate(pkg, limits)])
      .filter(([, message]) => Boolean(message)),
  );

/** Số liệu cộng dồn của đơn — vừa để báo lỗi, vừa để vẽ thanh giới hạn. */
export const getOrderTotals = (packages = []) => ({
  packageCount: packages.length,

  totalWeight: packages.reduce(
    (total, pkg) => total + (Number(pkg?.weight) || 0),
    0,
  ),

  totalValue: packages.reduce(
    (total, pkg) => total + (Number(pkg?.declaredValue) || 0),
    0,
  ),
});

/** Lỗi vượt trần của cả đơn; rỗng là chưa chạm trần (hoặc không giới hạn). */
export const getOrderTotalsError = (packages = [], limits) => {
  const { packageCount, totalWeight, totalValue } = getOrderTotals(packages);
  const { maxPackages, maxTotalDeclaredValue, maxTotalWeightKg } = readLimits(limits);

  if (hasLimit(maxPackages) && packageCount > maxPackages) {
    return `Đơn đang có ${packageCount} kiện. ${getMaxPackagesMessage(limits)}`;
  }

  if (hasLimit(maxTotalDeclaredValue) && totalValue > maxTotalDeclaredValue) {
    return `Tổng giá trị hàng hóa của đơn hàng (${formatVndNumber(
      totalValue,
    )} đ) vượt quá giới hạn tối đa ${formatVndNumber(maxTotalDeclaredValue)} đ.`;
  }

  if (hasLimit(maxTotalWeightKg) && totalWeight > maxTotalWeightKg) {
    return `Tổng cân nặng toàn bộ đơn hàng (${formatLimitNumber(
      totalWeight,
    )} kg) vượt quá giới hạn tối đa ${formatLimitNumber(maxTotalWeightKg)} kg.`;
  }

  return "";
};

/** Các ô ở cột trái (khách hàng, tuyến, người nhận, địa chỉ, ghi chú). */
export const FORM_FIELD_VALIDATORS = Object.freeze({
  /*
   * Ô ĐẦU TIÊN của form và là ô duy nhất không có mặc định hợp lý: thiếu nó thì
   * POST /api/staff/consignments trả 400 "Vui lòng chọn khách hàng có sẵn hoặc nhập
   * email/số điện thoại để tìm kiếm." (CustomerLookupHelper.cs). Chặn tại chỗ để Sale
   * không điền xong cả form mới biết đơn đang treo không có chủ.
   */
  customerId: (form) =>
    toText(form?.customerId) ? "" : "Vui lòng chọn khách hàng cần tạo đơn.",

  route: (form) => (form?.route ? "" : "Vui lòng chọn tuyến hàng."),

  shippingOption: (form) =>
    form?.shippingOption ? "" : "Vui lòng chọn phương thức vận chuyển.",

  receiverName: (form) => {
    const name = toText(form?.receiverName);

    if (!name) return "Vui lòng nhập tên người nhận.";
    if (name.length < 2) return "Tên người nhận phải có ít nhất 2 ký tự.";

    return "";
  },

  receiverPhone: (form) => {
    const phone = toText(form?.receiverPhone);

    if (!phone) return "Vui lòng nhập số điện thoại.";
    if (!/^0\d{9}$/.test(phone)) {
      return "Số điện thoại phải có 10 số và bắt đầu bằng số 0.";
    }

    return "";
  },

  selectedDeliveryAddress: (form) =>
    toText(form?.selectedDeliveryAddress)
      ? ""
      : "Vui lòng thêm và chọn địa chỉ nhận hàng.",

  note: (form) =>
    toText(form?.note) ? "" : "Vui lòng nhập ghi chú cho đơn ký gửi.",
});

/** Kiểm MỘT ô của phần thông tin chung. */
export const validateFormField = (field, form) =>
  FORM_FIELD_VALIDATORS[field] ? FORM_FIELD_VALIDATORS[field](form) : "";

export const validateConsignmentForm = ({ form, packages, limits }) => {
  const formErrors = createEmptyFormErrors();

  /* Cùng bộ hàm màn hình gọi lúc Sale đang gõ — xem FORM_FIELD_VALIDATORS. */
  Object.keys(FORM_FIELD_VALIDATORS).forEach((field) => {
    formErrors[field] = validateFormField(field, form);
  });

  /* Trần của cả đơn: tổng cân nặng và tổng giá trị mọi kiện. */
  formErrors.packages = getOrderTotalsError(packages, limits);

  const missingWoodCratePackages =
    getMissingWoodCratePackages({
      optionalServices: form?.optionalServices,
      packages,
    });

  const missingWoodCratePackageIds = new Set(
    missingWoodCratePackages.map((pkg) => pkg.id),
  );

  const packageErrors = Object.fromEntries(
    packages.map((pkg) => {
      const errors = validatePackage(pkg, limits);

      if (missingWoodCratePackageIds.has(pkg.id)) {
        errors.packageConfigurationId =
          "Đã chọn đóng thùng gỗ nên bắt buộc chọn kích thước thùng cho kiện này.";
      }

      return [pkg.id, errors];
    }),
  );

  const isValid =
    !Object.values(formErrors).some(Boolean) &&
    Object.values(packageErrors).every(
      (errors) => !Object.values(errors).some(Boolean),
    );

  return {
    isValid,
    formErrors,
    packageErrors,
  };
};
