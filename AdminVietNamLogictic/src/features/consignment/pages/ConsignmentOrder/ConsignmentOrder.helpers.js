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
  route: "",
  shippingOption: "",
  receiverName: "",
  receiverPhone: "",
  selectedDeliveryAddress: "",
  note: "",
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

export const validatePackage = (pkg) => {
  const errors = {};

  if (!pkg.productName.trim()) {
    errors.productName = "Vui lòng nhập tên sản phẩm.";
  }

  if (!pkg.productType) {
    errors.productType = "Vui lòng chọn loại hàng hóa.";
  }

  const quantity = Number(pkg.quantity);

  if (pkg.quantity === "") {
    errors.quantity = "Vui lòng nhập số lượng.";
  } else if (!Number.isInteger(quantity) || quantity < 1) {
    errors.quantity = "Số lượng phải là số nguyên từ 1 trở lên.";
  }

  const declaredValue = Number(pkg.declaredValue);

  if (pkg.declaredValue === "") {
    errors.declaredValue = "Vui lòng nhập giá trị khai báo.";
  } else if (!Number.isFinite(declaredValue) || declaredValue <= 0) {
    errors.declaredValue = "Giá trị kiện hàng phải lớn hơn 0.";
  }

  [
    ["weight", "cân nặng"],
    ["length", "chiều dài"],
    ["width", "chiều rộng"],
    ["height", "chiều cao"],
  ].forEach(([field, label]) => {
    const message = validatePositiveNumber(pkg[field], label);

    if (message) {
      errors[field] = message;
    }
  });

  if (!pkg.images.length) {
    errors.images = "Vui lòng tải ít nhất 1 ảnh sản phẩm.";
  }

  return errors;
};

export const validateConsignmentForm = ({ form, packages }) => {
  const formErrors = createEmptyFormErrors();

  if (!form.route) {
    formErrors.route = "Vui lòng chọn tuyến hàng.";
  }

  if (!form.shippingOption) {
    formErrors.shippingOption = "Vui lòng chọn phương thức vận chuyển.";
  }

  if (!form.receiverName.trim()) {
    formErrors.receiverName = "Vui lòng nhập tên người nhận.";
  } else if (form.receiverName.trim().length < 2) {
    formErrors.receiverName = "Tên người nhận phải có ít nhất 2 ký tự.";
  }

  if (!form.receiverPhone.trim()) {
    formErrors.receiverPhone = "Vui lòng nhập số điện thoại.";
  } else if (!/^0\d{9}$/.test(form.receiverPhone.trim())) {
    formErrors.receiverPhone =
      "Số điện thoại phải có 10 số và bắt đầu bằng số 0.";
  }

  if (!form.selectedDeliveryAddress.trim()) {
    formErrors.selectedDeliveryAddress =
      "Vui lòng thêm và chọn địa chỉ nhận hàng.";
  }

  if (!form.note.trim()) {
    formErrors.note = "Vui lòng nhập ghi chú cho đơn ký gửi.";
  }

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
      const errors = validatePackage(pkg);

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
