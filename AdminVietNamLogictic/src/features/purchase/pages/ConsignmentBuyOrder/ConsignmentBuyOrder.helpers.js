// Các hàm tiện ích cấp module của trang mua hộ: chuẩn hoá dữ liệu API,
// định dạng chuỗi, kiểm tra hợp lệ và dựng payload.
// Chúng không đọc state/props/ref nên tách ra được, giúp file trang
// chỉ còn phần gắn với vòng đời React.

import { uploadImages } from "@shared/api/uploadImage";

import {
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "@shared/utils/timeUtc";

import { MAX_IMAGE_SIZE } from "./ConsignmentBuyOrder.constants";

export const createUniqueId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createEmptyItem = () => ({
  id: createUniqueId(),
  productLink: "",
  sourceWebsite: "",
  productType: "",
  productName: "",
  quantity: "",
  attributes: "",
  note: "",
  images: [],

  // Giữ field image để tương thích component xác nhận/dịch vụ cũ.
  image: null,
});

export const createEmptyFormErrors = () => ({
  route: "",
  shippingOption: "",
  receiverName: "",
  receiverPhone: "",
  selectedDeliveryAddress: "",
  generalNote: "",
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

  const validationErrors = responseData?.errors;

  if (validationErrors && typeof validationErrors === "object") {
    return Object.entries(validationErrors)
      .map(([field, value]) => {
        const messages = Array.isArray(value)
          ? value.join(", ")
          : String(value);

        return `${field}: ${messages}`;
      })
      .join(" | ");
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
  [baseClassName, errorMessage && "purchase-buy-input-has-error"]
    .filter(Boolean)
    .join(" ");

export const sanitizeInteger = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  // Không cho nhập 0 hoặc nhiều số 0 ở đầu.
  // Ví dụ: "0", "00" => ""; "01" => "1"; "10" vẫn giữ nguyên.
  return digits.replace(/^0+/, "");
};

export const preventInvalidNumberKeys = (event) => {
  if (["-", "+", "e", "E", ".", ","].includes(event.key)) {
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

        return {
          value,
          label: value,
        };
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

      return {
        value,
        label,
      };
    })
    .filter((item) => item.value && item.label);

export const normalizeCode = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

export const getShippingOptionLabel = (value, label) => {
  const normalizedValues = [
    normalizeCode(value),
    normalizeCode(label),
  ];

  if (
    normalizedValues.some(
      (item) =>
        item === "EXPRESS" ||
        item === "HOA_TOC" ||
        item.includes("EXPRESS"),
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

  if (
    normalizedValues.some(
      (item) =>
        item === "ECONOMY" ||
        item === "TIET_KIEM" ||
        item.includes("ECONOMY"),
    )
  ) {
    return "Tiết kiệm";
  }

  return String(label ?? "").trim() || String(value ?? "").trim() || "-";
};

export const normalizeShippingOptionList = (result) =>
  normalizeOptionList(result, ["shippingOptions"]).map((option) => ({
    ...option,
    label: getShippingOptionLabel(option.value, option.label),
  }));

export const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
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
        }
      : null;
  }

  const address = String(
    item.address ||
      item.receiverAddress ||
      item.fullAddress ||
      item.deliveryAddress ||
      "",
  ).trim();

  if (!address) {
    return null;
  }

  const apiId = String(
    item.deliveryAddressId || item.addressId || item.id || "",
  ).trim();

  return {
    id: apiId || `address-${index}`,
    apiId,
    address,
    fullAddress: item.fullAddress || address,
    detailAddress: item.detailAddress || "",
    provinceCode: item.provinceCode || item.province_code || "",
    provinceName: item.provinceName || item.province_name || "",
    districtCode: item.districtCode || item.district_code || "",
    districtName: item.districtName || item.district_name || "",
    wardCode: item.wardCode || item.ward_code || "",
    wardName: item.wardName || item.ward_name || "",
    isDefault: Boolean(item.isDefault),
  };
};

export const normalizeDeliveryAddressList = (result) =>
  findArrayFromResult(result, ["addresses", "deliveryAddresses"])
    .map(normalizeDeliveryAddress)
    .filter(Boolean);

export const getItemImages = (item) => {
  if (Array.isArray(item?.images)) {
    return item.images.filter(Boolean);
  }

  return item?.image ? [item.image] : [];
};

export const isUploadedImageUrl = (value) => {
  const text = String(value ?? "").trim();

  return (
    /^https?:\/\//i.test(text) ||
    /^\//.test(text) ||
    /^data:image\//i.test(text)
  );
};

/*
 * UploadImage.js chỉ cần export uploadImages().
 * Helper này đặt tại trang mua hộ để đọc được nhiều kiểu response API:
 * - ["url-1", "url-2"]
 * - { urls: [] }
 * - { imageUrls: [] }
 * - { files: [{ url: "..." }] }
 * - { data: ... }
 * - text/plain chứa JSON
 */
export const extractUploadedImageUrls = (result) => {
  const collectedUrls = [];
  const visitedObjects = new Set();

  const appendUrl = (value) => {
    const url = String(value ?? "").trim();

    if (
      isUploadedImageUrl(url) &&
      !collectedUrls.includes(url)
    ) {
      collectedUrls.push(url);
    }
  };

  const walk = (value, depth = 0) => {
    if (
      value === null ||
      value === undefined ||
      depth > 8
    ) {
      return;
    }

    if (typeof value === "string") {
      const text = value.trim();

      if (
        (text.startsWith("[") && text.endsWith("]")) ||
        (text.startsWith("{") && text.endsWith("}"))
      ) {
        try {
          walk(JSON.parse(text), depth + 1);
          return;
        } catch {
          // Response không phải JSON, tiếp tục kiểm tra URL trực tiếp.
        }
      }

      appendUrl(text);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        walk(item, depth + 1);
      });

      return;
    }

    if (
      typeof value !== "object" ||
      visitedObjects.has(value)
    ) {
      return;
    }

    visitedObjects.add(value);

    [
      "url",
      "imageUrl",
      "fileUrl",
      "secureUrl",
      "path",
      "location",
    ].forEach((key) => {
      appendUrl(value?.[key]);
    });

    [
      "urls",
      "imageUrls",
      "fileUrls",
      "files",
      "images",
      "items",
      "results",
      "data",
    ].forEach((key) => {
      walk(value?.[key], depth + 1);
    });
  };

  walk(result);

  return collectedUrls;
};

export const getFileIdentity = (file) =>
  [file?.name, file?.size, file?.lastModified]
    .map((value) => String(value ?? ""))
    .join("::");

export const validateProductImageFile = (file) => {
  if (!(file instanceof File)) {
    throw new Error("File ảnh không hợp lệ.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error(`Ảnh "${file.name}" không phải JPG, PNG hoặc WEBP.`);
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Ảnh "${file.name}" vượt quá 5MB.`);
  }

  return file;
};

export const uploadProductImages = async (
  imageFiles,
  onUploadProgress,
) => {
  const files = imageFiles.map(validateProductImageFile);
  const uploadResult = await uploadImages(files, onUploadProgress);
  const imageUrls = extractUploadedImageUrls(uploadResult);

  if (!imageUrls.length) {
    throw new Error("API upload ảnh không trả về danh sách đường dẫn ảnh hợp lệ.");
  }

  if (imageUrls.length < files.length) {
    throw new Error(
      `API chỉ trả về ${imageUrls.length}/${files.length} đường dẫn ảnh. Vui lòng thử lại.`,
    );
  }

  return imageUrls.slice(0, files.length);
};

export const isValidHttpUrl = (value) => {
  try {
    const url = new URL(String(value || "").trim());

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const getSourceWebsiteFromLink = (value) => {
  try {
    const url = new URL(String(value || "").trim());

    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const getAddressOptionName = (options, value) => {
  return (
    options.find((option) => String(option.value) === String(value))?.label ||
    ""
  );
};

export const getClientTimePayload = () => {
  const browserTime = getBrowserTimeInfo();
  const utcNow = getSyncedNowUtcIso();

  return {
    submittedAtUtc: utcNow,
    clientSubmittedAtUtc: utcNow,
    clientTimeZone: browserTime.timeZone,
    clientUtcOffset: browserTime.utcOffsetText,
    clientUtcOffsetMinutes: browserTime.utcOffsetMinutes,
  };
};

export const validateItem = (item) => {
  const errors = {};

  if (!item.productLink.trim()) {
    errors.productLink = "Vui lòng nhập liên kết sản phẩm.";
  } else if (!isValidHttpUrl(item.productLink)) {
    errors.productLink =
      "Liên kết sản phẩm phải bắt đầu bằng http:// hoặc https://.";
  }

  if (!item.sourceWebsite.trim()) {
    errors.sourceWebsite = "Vui lòng nhập website nguồn.";
  }

  if (!item.productType) {
    errors.productType = "Vui lòng chọn loại sản phẩm.";
  }

  if (!item.productName.trim()) {
    errors.productName = "Vui lòng nhập tên sản phẩm.";
  }

  const quantity = Number(item.quantity);

  if (item.quantity === "") {
    errors.quantity = "Vui lòng nhập số lượng.";
  } else if (!Number.isInteger(quantity) || quantity < 1) {
    errors.quantity = "Số lượng phải là số nguyên từ 1 trở lên.";
  } else if (quantity > 2147483647) {
    errors.quantity = "Số lượng vượt quá giới hạn cho phép.";
  }

  if (!item.attributes.trim()) {
    errors.attributes = "Vui lòng nhập thuộc tính sản phẩm.";
  }

  if (!getItemImages(item).length) {
    errors.image = "Vui lòng tải ít nhất một ảnh sản phẩm.";
  }

  return errors;
};

export const validateBuyOrderForm = ({ form, items }) => {
  const formErrors = createEmptyFormErrors();

  if (!form.route) {
    formErrors.route = "Vui lòng chọn tuyến hàng.";
  }

  if (!form.shippingOption) {
    formErrors.shippingOption =
      "Vui lòng chọn phương thức vận chuyển.";
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

  const itemErrors = Object.fromEntries(
    items.map((item) => [item.id, validateItem(item)]),
  );

  const isValid =
    !Object.values(formErrors).some(Boolean) &&
    Object.values(itemErrors).every(
      (errors) => !Object.values(errors).some(Boolean),
    );

  return {
    isValid,
    formErrors,
    itemErrors,
  };
};
