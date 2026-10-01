// Các hàm tiện ích cấp module của trang mua hộ: chuẩn hoá dữ liệu API,
// định dạng chuỗi, kiểm tra hợp lệ và dựng payload.
// Chúng không đọc state/props/ref nên tách ra được, giúp file trang
// chỉ còn phần gắn với vòng đời React.

import { uploadImages } from "@shared/api/uploadImage";

import {
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "@shared/utils/timeUtc";

import {
  MAX_IMAGE_SIZE,
  PURCHASE_FIELD_MAX_LENGTH,
  PURCHASE_SERVICE_NOTES,
  STAFF_CREATED_NOTE,
} from "./ConsignmentBuyOrder.constants";

/*
 * `purchaseLimits` dưới đây là nhánh `purchase` của giới hạn Admin cấu hình
 * ({ maxItems, maxItemQuantity }; null = không giới hạn / chưa tải được → không chặn,
 * backend vẫn kiểm và báo 400 nêu đúng giới hạn).
 */
export const hasPurchaseLimit = (value) => Number.isFinite(value) && value > 0;

/** Câu báo lỗi dùng chung cho ô Số lượng. */
export const getPurchaseQuantityRangeMessage = (purchaseLimits) =>
  hasPurchaseLimit(purchaseLimits?.maxItemQuantity)
    ? `Số lượng từ 1 đến ${purchaseLimits.maxItemQuantity}.`
    : "Số lượng phải là số nguyên từ 1 trở lên.";

/** Câu giải thích khi đã đủ số dòng sản phẩm tối đa ("" nếu không giới hạn). */
export const getMaxPurchaseItemsMessage = (purchaseLimits) =>
  hasPurchaseLimit(purchaseLimits?.maxItems)
    ? `Mỗi yêu cầu mua hộ tối đa ${purchaseLimits.maxItems} sản phẩm. Cần mua thêm thì tạo yêu cầu mới.`
    : "";

/** "" nếu `value` (sau khi trim) không vượt `max` ký tự, ngược lại là câu báo lỗi. */
const validateMaxLength = (value, max, label) =>
  String(value ?? "").trim().length > max
    ? `${label} tối đa ${max} ký tự.`
    : "";

/*
 * Ghi chú chung đúng như backend sẽ lưu: ghi chú Sale gõ (trim) + câu của từng dịch vụ
 * được tick + câu "Đơn do nhân viên lên hộ khách", nối bằng ". ".
 */
export const buildStoredGeneralNote = (generalNote, optionalServices) =>
  [
    String(generalNote ?? "").trim(),
    ...PURCHASE_SERVICE_NOTES.filter(({ key }) =>
      Boolean(optionalServices?.[key]),
    ).map(({ text }) => text),
    STAFF_CREATED_NOTE,
  ]
    .filter(Boolean)
    .join(". ");

/**
 * Số ký tự tối đa Sale còn được gõ vào ô ghi chú chung, sau khi trừ phần backend tự nối
 * (câu dịch vụ + câu "đơn do nhân viên lên hộ" + các dấu ". " ngăn cách).
 */
export const getGeneralNoteMaxLength = (optionalServices) =>
  Math.max(
    0,
    PURCHASE_FIELD_MAX_LENGTH.generalNote -
      buildStoredGeneralNote("", optionalServices).length -
      ". ".length,
  );

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
  /* Lỗi cấp YÊU CẦU (quá số dòng sản phẩm tối đa), không thuộc ô nào. */
  items: "",
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

  const productImageUrls = imageUrls.slice(0, files.length);

  /* Backend nối các URL ảnh của một sản phẩm bằng "|" và giới hạn tổng độ dài. */
  if (
    productImageUrls.join("|").length > PURCHASE_FIELD_MAX_LENGTH.imageUrls
  ) {
    throw new Error(
      "Đường dẫn ảnh của một sản phẩm quá dài để lưu. Vui lòng bớt số ảnh của sản phẩm đó.",
    );
  }

  return productImageUrls;
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

export const validateItem = (item, purchaseLimits) => {
  const errors = {};

  const limits = PURCHASE_FIELD_MAX_LENGTH;

  if (!item.productLink.trim()) {
    errors.productLink = "Vui lòng nhập liên kết sản phẩm.";
  } else if (!isValidHttpUrl(item.productLink)) {
    errors.productLink =
      "Liên kết sản phẩm phải là đường dẫn đầy đủ bắt đầu bằng http:// hoặc https://.";
  } else {
    errors.productLink = validateMaxLength(
      item.productLink,
      limits.productLink,
      "Liên kết sản phẩm",
    );
  }

  errors.sourceWebsite = !item.sourceWebsite.trim()
    ? "Vui lòng nhập website nguồn."
    : validateMaxLength(item.sourceWebsite, limits.sourceWebsite, "Website nguồn");

  errors.productType = !item.productType
    ? "Vui lòng chọn loại sản phẩm."
    : validateMaxLength(item.productType, limits.productType, "Loại sản phẩm");

  errors.productName = !item.productName.trim()
    ? "Vui lòng nhập tên sản phẩm."
    : validateMaxLength(item.productName, limits.productName, "Tên sản phẩm");

  const quantity = Number(item.quantity);

  if (item.quantity === "") {
    errors.quantity = "Vui lòng nhập số lượng.";
  } else if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    (hasPurchaseLimit(purchaseLimits?.maxItemQuantity) &&
      quantity > purchaseLimits.maxItemQuantity)
  ) {
    errors.quantity = getPurchaseQuantityRangeMessage(purchaseLimits);
  }

  errors.attributes = !item.attributes.trim()
    ? "Vui lòng nhập thuộc tính sản phẩm."
    : validateMaxLength(item.attributes, limits.attributes, "Thuộc tính sản phẩm");

  errors.note = validateMaxLength(item.note, limits.note, "Ghi chú sản phẩm");

  if (!getItemImages(item).length) {
    errors.image = "Vui lòng tải ít nhất một ảnh sản phẩm.";
  }

  /* Bỏ các khoá rỗng để `errors` chỉ chứa lỗi thật. */
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  );
};

export const validateBuyOrderForm = ({ form, items, purchaseLimits }) => {
  const formErrors = createEmptyFormErrors();

  if (!form.route) {
    formErrors.route = "Vui lòng chọn tuyến hàng.";
  }

  if (!form.shippingOption) {
    formErrors.shippingOption =
      "Vui lòng chọn phương thức vận chuyển.";
  }

  const limits = PURCHASE_FIELD_MAX_LENGTH;

  if (!form.receiverName.trim()) {
    formErrors.receiverName = "Vui lòng nhập tên người nhận.";
  } else if (form.receiverName.trim().length < 2) {
    formErrors.receiverName = "Tên người nhận phải có ít nhất 2 ký tự.";
  } else {
    formErrors.receiverName = validateMaxLength(
      form.receiverName,
      limits.receiverName,
      "Tên người nhận",
    );
  }

  if (!form.receiverPhone.trim()) {
    formErrors.receiverPhone = "Vui lòng nhập số điện thoại.";
  } else if (!/^0\d{9}$/.test(form.receiverPhone.trim())) {
    formErrors.receiverPhone =
      "Số điện thoại phải có 10 số và bắt đầu bằng số 0.";
  } else {
    formErrors.receiverPhone = validateMaxLength(
      form.receiverPhone,
      limits.receiverPhone,
      "Số điện thoại",
    );
  }

  if (!form.selectedDeliveryAddress.trim()) {
    formErrors.selectedDeliveryAddress =
      "Vui lòng thêm và chọn địa chỉ nhận hàng.";
  } else {
    formErrors.selectedDeliveryAddress = validateMaxLength(
      form.selectedDeliveryAddress,
      limits.receiverAddress,
      "Địa chỉ nhận hàng",
    );
  }

  const storedGeneralNoteLength = buildStoredGeneralNote(
    form.generalNote,
    form.optionalServices,
  ).length;

  if (storedGeneralNoteLength > limits.generalNote) {
    formErrors.generalNote = `Ghi chú chung quá dài: khi ghép với các dịch vụ đã chọn và câu "${STAFF_CREATED_NOTE}" sẽ thành ${storedGeneralNoteLength}/${limits.generalNote} ký tự. Vui lòng rút gọn ghi chú (tối đa ${getGeneralNoteMaxLength(form.optionalServices)} ký tự).`;
  }

  if (hasPurchaseLimit(purchaseLimits?.maxItems) && items.length > purchaseLimits.maxItems) {
    formErrors.items = `Yêu cầu đang có ${items.length} sản phẩm. ${getMaxPurchaseItemsMessage(purchaseLimits)}`;
  }

  const itemErrors = Object.fromEntries(
    items.map((item) => [item.id, validateItem(item, purchaseLimits)]),
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
