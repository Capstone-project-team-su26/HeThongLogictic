import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import FieldLabelTooltip from "../../../../components/SaleComponents/SaleKiguiComponents/ToltipLapelComponents/FieldLabelTooltip";
import uploadImage from "../../../../api/Upload/UploadImage";
import ConsignmentOrderConfirm from "../../../../components/SaleComponents/SaleKiguiComponents/ConfirmKigui/ConsignmentOrderConfirm";
import "./ConsignmentOrder.css";
import "../CreateRequestPage.css";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import {
  createConsignmentApi,
  validateConsignmentItemsApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import {
  getConsignmentRoutesApi,
  getConsignmentShippingOptionsApi,
  getProductTypesApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/consignmentMasterService";
import {
  createDeliveryAddressApi,
  deleteDeliveryAddressApi,
  getDeliveryAddressesApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/deliveryAddressService";
import {
  getDistrictsByProvinceCode,
  getFullAddressByCodes,
  getProvinces,
  getWardsByDistrictCode,
} from "../../../../api/AddressAPI/vietnamAddressService";
import {
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "../../../../utils/timeUtc";
import { Tooltip } from "antd";
import PackageOptionalServices from "../../../../components/SaleComponents/SaleKiguiComponents/PackageOptionalServices/PackageOptionalServices";
import pricingRuleService from "../../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_PER_PACKAGE = 5;


const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PACKAGE_NUMBER_FIELDS = [
  {
    field: "weight",
    label: "CÂN NẶNG KIỆN HÀNG (KG)",
    tooltip: "Nhập tổng cân nặng của kiện hàng theo đơn vị kilogram (kg).",
    placeholder: "Nhập cân nặng...",
  },
  {
    field: "length",
    label: "DÀI (CM)",
    tooltip: "Nhập chiều dài của kiện hàng theo đơn vị centimet (cm).",
    placeholder: "Nhập chiều dài...",
  },
  {
    field: "width",
    label: "RỘNG (CM)",
    tooltip: "Nhập chiều rộng của kiện hàng theo đơn vị centimet (cm).",
    placeholder: "Nhập chiều rộng...",
  },
  {
    field: "height",
    label: "CAO (CM)",
    tooltip: "Nhập chiều cao của kiện hàng theo đơn vị centimet (cm).",
    placeholder: "Nhập chiều cao...",
  },
];

/**
 * Nguyện vọng của khách khi hàng cập kho VN. Để rỗng là "chưa chọn" — hợp lệ, không bắt buộc.
 */
const DESTINATION_HANDLING_OPTIONS = [
  { value: "DIRECT_DELIVERY", label: "Giao ngay khi về Việt Nam" },
  { value: "STORE_AT_VN", label: "Gửi lại kho Việt Nam (có phí lưu kho)" },
];

const INITIAL_FORM = {
  route: "",
  shippingOption: "",
  receiverName: "",
  receiverPhone: "",
  selectedDeliveryAddress: "",
  note: "",
  defaultDestinationHandling: "",
  inspectPackage: true,
  optionalServices: {
    requiresPacking: false,
    requiresWoodenCrate: false,
    requiresInsurance: false,
    requiresInspection: false,

    // Giữ lại dữ liệu rule đã chọn để tương thích component dịch vụ động.
    selectedRuleCodes: [],
    selectedPricingRuleIds: [],
    packageConfigurationByPackageId: {},
    selectedPackageConfigurations: [],
    woodCrateBaseFeePerPackage: 0,
    woodCrateOrderFee: 0,
    woodCrateBaseFee: 0,
    woodCrateConfigurationFee: 0,
    woodCrateTotalFee: 0,
    woodCrateCompleted: false,
  },
};

const createUniqueId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createEmptyPackage = () => ({
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

const createEmptyFormErrors = () => ({
  route: "",
  shippingOption: "",
  receiverName: "",
  receiverPhone: "",
  selectedDeliveryAddress: "",
  note: "",
});

const createEmptyAddressForm = () => ({
  provinceCode: "",
  districtCode: "",
  wardCode: "",
  detailAddress: "",
});

const createEmptyAddressErrors = () => ({
  provinceCode: "",
  districtCode: "",
  wardCode: "",
  detailAddress: "",
});

const isCanceledRequest = (error) =>
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.name === "AbortError";

const getApiErrorMessage = (error, fallbackMessage = "Đã xảy ra lỗi.") => {
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

const getFieldClassName = (baseClassName, errorMessage) =>
  [baseClassName, errorMessage && "input-has-error"].filter(Boolean).join(" ");

const sanitizeInteger = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  // Không cho giữ giá trị 0 hoặc các số 0 đứng đầu.
  // Ví dụ: "0" -> "", "0005" -> "5", "10" -> "10".
  return digits.replace(/^0+/, "");
};

const sanitizeDecimal = (value) => {
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

const formatVnd = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");

  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
};


const getDeliveryAddressText = (addressItem) =>
  String(
    addressItem?.fullAddress ||
      addressItem?.address ||
      "",
  ).trim();

const isWoodCrateMeasurementField = (field) =>
  ["weight", "length", "width", "height"].includes(
    field,
  );

const preventInvalidNumberKeys = (event) => {
  if (["-", "+", "e", "E"].includes(event.key)) {
    event.preventDefault();
  }
};

const preventMoneyKeys = (event) => {
  if (["-", "+", "e", "E", ",", "."].includes(event.key)) {
    event.preventDefault();
  }
};

const findArrayFromResult = (result, extraKeys = []) => {
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

const normalizeOptionList = (result, extraKeys = []) =>
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

const normalizeOptionCode = (value) => {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");
};


const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      String(item ?? "").trim()
    )
    .filter(Boolean);
};

const normalizePricingRuleIds = (value) => {
  return Array.from(
    new Set(
      normalizeStringArray(value)
    )
  );
};

const normalizePackageConfigurationMap = (value) => {
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

const getMissingWoodCratePackages = ({
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

const getShippingOptionLabel = (value, label) => {
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

const normalizeShippingOptionList = (result) => {
  return normalizeOptionList(result, ["shippingOptions"]).map((option) => ({
    ...option,
    label: getShippingOptionLabel(option.value, option.label),
  }));
};

const normalizeDeliveryAddress = (item, index = 0) => {
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

const normalizeDeliveryAddressList = (result) =>
  findArrayFromResult(result, ["addresses", "deliveryAddresses"])
    .map(normalizeDeliveryAddress)
    .filter(Boolean);

const UPLOAD_URL_KEYS = [
  "url",
  "imageUrl",
  "imageURL",
  "fileUrl",
  "fileURL",
  "secureUrl",
  "secureURL",
  "downloadUrl",
  "downloadURL",
  "location",
  "path",
];

const UPLOAD_CONTAINER_KEYS = [
  "urls",
  "imageUrls",
  "imageURLs",
  "fileUrls",
  "fileURLs",
  "paths",
  "files",
  "images",
  "items",
  "result",
  "results",
  "data",
];

const isLikelyUploadedImageUrl = (value) => {
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

const parseUploadJsonString = (value) => {
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

const extractUploadedImageUrls = (result) => {
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

const extractUploadedImageUrl = (result) => {
  return extractUploadedImageUrls(result)[0] || "";
};

const uploadPackageImage = async (file) => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Dung lượng ảnh không được vượt quá 5MB.");
  }

  const uploadResult = await uploadImage(file);
  const imageUrl = extractUploadedImageUrl(uploadResult);

  if (!imageUrl) {
    console.error(
      "[ConsignmentOrder] Response upload không tìm thấy URL:",
      uploadResult,
    );

    throw new Error(
      "API đã nhận ảnh nhưng response không chứa URL ở định dạng frontend nhận biết. Vui lòng xem Console để kiểm tra response upload.",
    );
  }

  return imageUrl;
};

const validatePositiveNumber = (value, label) => {
  if (value === "") {
    return `Vui lòng nhập ${label}.`;
  }

  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    return `${label} phải lớn hơn 0.`;
  }

  return "";
};

const validatePackage = (pkg) => {
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

const validateConsignmentForm = ({ form, packages }) => {
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

const FieldError = ({ message }) => {
  if (!message) {
    return null;
  }

  return (
    <div className="field-error-message">
      <ExclamationCircleOutlined />
      <span>{message}</span>
    </div>
  );
};

const SelectField = ({
  label,
  value,
  error,
  options,
  loading,
  disabled,
  placeholder,
  onChange,
}) => (
  <div className="input-field-group">
    <label className="field-label required-label">
      <EnvironmentOutlined />
      {label}
    </label>

    <select
      value={value}
      disabled={disabled || loading}
      aria-invalid={Boolean(error)}
      className={getFieldClassName("custom-select", error)}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{loading ? "Đang tải dữ liệu..." : placeholder}</option>

      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>

    <FieldError message={error} />
  </div>
);

export default function ConsignmentOrder() {
  const navigate = useNavigate();
  const fileInputRefs = useRef({});
  const packagesRef = useRef([]);

  const [form, setForm] = useState(INITIAL_FORM);
  const [packages, setPackages] = useState([createEmptyPackage()]);
  const [formErrors, setFormErrors] = useState(createEmptyFormErrors());
  const [packageErrors, setPackageErrors] = useState({});

  const [routeOptions, setRouteOptions] = useState([]);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [productTypeOptions, setProductTypeOptions] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [
    confirmationPricingRules,
    setConfirmationPricingRules,
  ] = useState([]);

  const [
    confirmationPackageConfigurations,
    setConfirmationPackageConfigurations,
  ] = useState([]);

  const [
    isLoadingConfirmationData,
    setIsLoadingConfirmationData,
  ] = useState(false);

  const [
    confirmationDataError,
    setConfirmationDataError,
  ] = useState("");

  const [addressList, setAddressList] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState(
    createEmptyAddressForm(),
  );
  const [newAddressErrors, setNewAddressErrors] = useState(
    createEmptyAddressErrors(),
  );
  const [newAddressError, setNewAddressError] = useState("");

  const [provinceOptions, setProvinceOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [wardOptions, setWardOptions] = useState([]);

  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingWards, setIsLoadingWards] = useState(false);

  const [activeLightboxImg, setActiveLightboxImg] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(
    "Đang chuẩn bị tạo đơn...",
  );

  useEffect(() => {
    if (!isConfirming) {
      return undefined;
    }

    const controller =
      new AbortController();

    const loadConfirmationData =
      async () => {
        try {
          setIsLoadingConfirmationData(
            true,
          );
          setConfirmationDataError("");

          const [
            pricingRulesResult,
            packageConfigurationsResult,
          ] = await Promise.allSettled([
            pricingRuleService.getPricingRules({
              signal:
                controller.signal,
              onlyActive: false,
            }),
            pricingRuleService.getPackageConfigurations({
              signal:
                controller.signal,
              onlyActive: true,
            }),
          ]);

          if (
            controller.signal.aborted
          ) {
            return;
          }

          const errorMessages = [];

          if (
            pricingRulesResult.status ===
            "fulfilled"
          ) {
            setConfirmationPricingRules(
              Array.isArray(
                pricingRulesResult.value,
              )
                ? pricingRulesResult.value
                : [],
            );
          } else {
            setConfirmationPricingRules(
              [],
            );

            errorMessages.push(
              getApiErrorMessage(
                pricingRulesResult.reason,
                "Không thể tải bảng giá dịch vụ.",
              ),
            );
          }

          if (
            packageConfigurationsResult.status ===
            "fulfilled"
          ) {
            setConfirmationPackageConfigurations(
              Array.isArray(
                packageConfigurationsResult.value,
              )
                ? packageConfigurationsResult.value
                : [],
            );
          } else {
            setConfirmationPackageConfigurations(
              [],
            );

            errorMessages.push(
              getApiErrorMessage(
                packageConfigurationsResult.reason,
                "Không thể tải cấu hình thùng.",
              ),
            );
          }

          setConfirmationDataError(
            Array.from(
              new Set(
                errorMessages.filter(
                  Boolean,
                ),
              ),
            ).join(" "),
          );
        } catch (error) {
          if (
            controller.signal.aborted
          ) {
            return;
          }

          console.error(
            "[ConsignmentOrder] Lỗi tải dữ liệu màn hình xác nhận:",
            error,
          );

          setConfirmationDataError(
            getApiErrorMessage(
              error,
              "Không thể tải đầy đủ dữ liệu màn hình xác nhận.",
            ),
          );
        } finally {
          if (
            !controller.signal.aborted
          ) {
            setIsLoadingConfirmationData(
              false,
            );
          }
        }
      };

    loadConfirmationData();

    return () =>
      controller.abort();
  }, [isConfirming]);

  const clearPackageError = (packageId, field) => {
    setPackageErrors((previous) => ({
      ...previous,
      [packageId]: {
        ...(previous[packageId] || {}),
        [field]: "",
      },
    }));
  };

  const updateForm = useCallback((field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [field]: "",
    }));
  }, []);

  const resetNewAddressForm = () => {
    setNewAddressForm(createEmptyAddressForm());
    setNewAddressErrors(createEmptyAddressErrors());
    setNewAddressError("");
    setDistrictOptions([]);
    setWardOptions([]);
  };

  const updateNewAddressForm = (field, value) => {
    setNewAddressForm((previous) => {
      if (field === "provinceCode") {
        return {
          ...previous,
          provinceCode: value,
          districtCode: "",
          wardCode: "",
        };
      }

      if (field === "districtCode") {
        return {
          ...previous,
          districtCode: value,
          wardCode: "",
        };
      }

      return {
        ...previous,
        [field]: value,
      };
    });

    if (field === "provinceCode") {
      setDistrictOptions([]);
      setWardOptions([]);
    }

    if (field === "districtCode") {
      setWardOptions([]);
    }

    setNewAddressErrors((previous) => ({
      ...previous,
      [field]: "",
      ...(field === "provinceCode"
        ? {
            districtCode: "",
            wardCode: "",
          }
        : {}),
      ...(field === "districtCode"
        ? {
            wardCode: "",
          }
        : {}),
    }));

    setNewAddressError("");
  };

  const getAddressOptionName = (options, code) =>
    options.find((item) => String(item.code) === String(code))?.name ||
    options.find((item) => String(item.value) === String(code))?.label ||
    "";

  const validateNewAddressForm = () => {
    const errors = createEmptyAddressErrors();

    if (!newAddressForm.provinceCode) {
      errors.provinceCode = "Vui lòng chọn tỉnh/thành phố.";
    }

    if (!newAddressForm.districtCode) {
      errors.districtCode = "Vui lòng chọn quận/huyện.";
    }

    if (!newAddressForm.wardCode) {
      errors.wardCode = "Vui lòng chọn phường/xã.";
    }

    if (!newAddressForm.detailAddress.trim()) {
      errors.detailAddress =
        "Vui lòng nhập số nhà, tên đường hoặc địa chỉ chi tiết.";
    }

    setNewAddressErrors(errors);

    return !Object.values(errors).some(Boolean);
  };

  const loadDeliveryAddresses = useCallback(async (options = {}) => {
    const result = await getDeliveryAddressesApi(options);
    const list = normalizeDeliveryAddressList(result);

    setAddressList(list);
    return list;
  }, []);

  useEffect(() => {
    if (!form.route) return undefined;

    const controller = new AbortController();

    getConsignmentShippingOptionsApi({
      route: form.route,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;

        const options = normalizeShippingOptionList(result);
        setShippingOptions(options);
        setForm((previous) => ({
          ...previous,
          shippingOption: options.some(
            (option) => option.value === previous.shippingOption,
          )
            ? previous.shippingOption
            : "",
        }));
      })
      .catch((error) => {
        if (!isCanceledRequest(error)) {
          AuthNotify.error(
            "Không tải được phương thức vận chuyển",
            getApiErrorMessage(error, "Vui lòng chọn lại tuyến hàng."),
          );
        }
      });

    return () => controller.abort();
  }, [form.route]);

  useEffect(() => {
    const controller = new AbortController();

    const loadOptions = async () => {
      try {
        setIsLoadingOptions(true);

        const [routesResult, shippingResult, productTypesResult] =
          await Promise.all([
            getConsignmentRoutesApi({
              signal: controller.signal,
            }),
            getConsignmentShippingOptionsApi({
              signal: controller.signal,
            }),
            getProductTypesApi({
              signal: controller.signal,
            }),
          ]);

        const normalizedRoutes = normalizeOptionList(routesResult, ["routes"]);

        const normalizedShippingOptions =
          normalizeShippingOptionList(shippingResult);

        const normalizedProductTypes = normalizeOptionList(productTypesResult, [
          "productTypes",
        ]);

        setRouteOptions(normalizedRoutes);

        setShippingOptions(normalizedShippingOptions);

        setProductTypeOptions(normalizedProductTypes);

        if (!normalizedRoutes.length) {
          setFormErrors((previous) => ({
            ...previous,
            route: "Chưa có dữ liệu tuyến hàng. Vui lòng thử tải lại trang.",
          }));
        }
      } catch (error) {
        if (!isCanceledRequest(error)) {
          AuthNotify.error(
            "Không tải được dữ liệu",
            getApiErrorMessage(
              error,
              "Không thể tải tuyến hàng, hình thức vận chuyển hoặc loại hàng hóa.",
            ),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOptions(false);
        }
      }
    };

    loadOptions();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadAddresses = async () => {
      try {
        setIsLoadingAddresses(true);

        const list = await loadDeliveryAddresses({
          signal: controller.signal,
        });

        const defaultAddress = list.find((item) => item.isDefault);

        if (defaultAddress) {
          updateForm(
            "selectedDeliveryAddress",
            getDeliveryAddressText(defaultAddress),
          );
        }
      } catch (error) {
        if (!isCanceledRequest(error)) {
          AuthNotify.error(
            "Không tải được địa chỉ",
            getApiErrorMessage(
              error,
              "Không thể tải danh sách địa chỉ nhận hàng.",
            ),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAddresses(false);
        }
      }
    };

    const timeoutId = window.setTimeout(loadAddresses, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadDeliveryAddresses, updateForm]);

  useEffect(() => {
    const controller = new AbortController();

    const loadProvinces = async () => {
      try {
        setIsLoadingProvinces(true);

        const data = await getProvinces({
          signal: controller.signal,
        });

        setProvinceOptions(data);
      } catch (error) {
        if (!isCanceledRequest(error)) {
          AuthNotify.error(
            "Không tải được địa chỉ",
            getApiErrorMessage(
              error,
              "Không thể tải danh sách tỉnh/thành phố.",
            ),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingProvinces(false);
        }
      }
    };

    loadProvinces();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadDistricts = async () => {
      if (!newAddressForm.provinceCode) {
        setDistrictOptions([]);
        setWardOptions([]);
        return;
      }

      try {
        setIsLoadingDistricts(true);

        const data = await getDistrictsByProvinceCode(
          newAddressForm.provinceCode,
          {
            signal: controller.signal,
          },
        );

        setDistrictOptions(data);
      } catch (error) {
        if (!isCanceledRequest(error)) {
          AuthNotify.error(
            "Không tải được quận/huyện",
            getApiErrorMessage(error, "Không thể tải danh sách quận/huyện."),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingDistricts(false);
        }
      }
    };

    loadDistricts();

    return () => controller.abort();
  }, [newAddressForm.provinceCode]);

  useEffect(() => {
    const controller = new AbortController();

    const loadWards = async () => {
      if (!newAddressForm.districtCode) {
        setWardOptions([]);
        return;
      }

      try {
        setIsLoadingWards(true);

        const data = await getWardsByDistrictCode(newAddressForm.districtCode, {
          signal: controller.signal,
        });

        setWardOptions(data);
      } catch (error) {
        if (!isCanceledRequest(error)) {
          AuthNotify.error(
            "Không tải được phường/xã",
            getApiErrorMessage(error, "Không thể tải danh sách phường/xã."),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingWards(false);
        }
      }
    };

    loadWards();

    return () => controller.abort();
  }, [newAddressForm.districtCode]);

  useEffect(() => {
    packagesRef.current = packages;
  }, [packages]);

  useEffect(
    () => () => {
      packagesRef.current.forEach((pkg) => {
        pkg.images.forEach((image) => {
          if (image.previewUrl) {
            URL.revokeObjectURL(image.previewUrl);
          }
        });
      });
    },
    [],
  );

  const scrollToFirstError = () => {
    window.setTimeout(() => {
      document
        .querySelector(
          ".input-has-error, .upload-has-error, .address-list-has-error",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 100);
  };

  /* ================= ADDRESS ================= */

  const handleSaveAddress = async () => {
    if (isSubmitting || isSavingAddress) {
      return;
    }

    if (!validateNewAddressForm()) {
      setNewAddressError("Vui lòng kiểm tra lại thông tin địa chỉ.");
      return;
    }

    try {
      setIsSavingAddress(true);
      setNewAddressError("");

      const detailAddress = newAddressForm.detailAddress.trim();

      let addressResult = null;

      try {
        addressResult = await getFullAddressByCodes({
          provinceCode: newAddressForm.provinceCode,
          districtCode: newAddressForm.districtCode,
          wardCode: newAddressForm.wardCode,
          detailAddress,
        });
      } catch {
        addressResult = null;
      }

      const fallbackProvinceName = getAddressOptionName(
        provinceOptions,
        newAddressForm.provinceCode,
      );
      const fallbackDistrictName = getAddressOptionName(
        districtOptions,
        newAddressForm.districtCode,
      );
      const fallbackWardName = getAddressOptionName(
        wardOptions,
        newAddressForm.wardCode,
      );

      const provinceName =
        addressResult?.province?.name || fallbackProvinceName;
      const districtName =
        addressResult?.district?.name || fallbackDistrictName;
      const wardName = addressResult?.ward?.name || fallbackWardName;

      const address =
        addressResult?.fullAddress ||
        [detailAddress, wardName, districtName, provinceName]
          .filter(Boolean)
          .join(", ");

      const normalizedAddress = address.trim();

      if (!normalizedAddress) {
        setNewAddressError("Địa chỉ nhận hàng không hợp lệ.");
        return;
      }

      const addressExists = addressList.some(
        (item) =>
          item.address.trim().toLowerCase() === normalizedAddress.toLowerCase(),
      );

      if (addressExists) {
        setNewAddressError("Địa chỉ này đã có trong danh sách.");
        return;
      }

      const browserTimeInfo = getBrowserTimeInfo();
      const createdAtUtc = getSyncedNowUtcIso();

      const addressPayload = {
        address: normalizedAddress,
        receiverAddress: normalizedAddress,
        fullAddress: normalizedAddress,
        detailAddress,
        provinceCode: Number(newAddressForm.provinceCode),
        provinceName,
        districtCode: Number(newAddressForm.districtCode),
        districtName,
        wardCode: Number(newAddressForm.wardCode),
        wardName,
        createdAtUtc,
        clientSubmittedAtUtc: createdAtUtc,
        clientTimeZone: browserTimeInfo.timeZone,
        clientUtcOffset: browserTimeInfo.utcOffsetText,
        clientUtcOffsetMinutes: browserTimeInfo.utcOffsetMinutes,
      };

      const createdResult = await createDeliveryAddressApi(addressPayload);

      let refreshedAddresses;

      try {
        refreshedAddresses = await loadDeliveryAddresses();
      } catch {
        const createdAddress = normalizeDeliveryAddress(
          createdResult?.data || createdResult,
          addressList.length,
        ) || {
          id: createUniqueId(),
          apiId: "",
          address: normalizedAddress,
          fullAddress: normalizedAddress,
          detailAddress,
          provinceCode: String(newAddressForm.provinceCode),
          provinceName,
          districtCode: String(newAddressForm.districtCode),
          districtName,
          wardCode: String(newAddressForm.wardCode),
          wardName,
          isDefault: false,
          raw: addressPayload,
        };

        refreshedAddresses = [
          ...addressList,
          {
            ...createdAddress,
            address: createdAddress.address || normalizedAddress,
            fullAddress: createdAddress.fullAddress || normalizedAddress,
            detailAddress: createdAddress.detailAddress || detailAddress,
            provinceCode:
              createdAddress.provinceCode ||
              String(newAddressForm.provinceCode),
            provinceName: createdAddress.provinceName || provinceName,
            districtCode:
              createdAddress.districtCode ||
              String(newAddressForm.districtCode),
            districtName: createdAddress.districtName || districtName,
            wardCode:
              createdAddress.wardCode || String(newAddressForm.wardCode),
            wardName: createdAddress.wardName || wardName,
          },
        ];

        setAddressList(refreshedAddresses);
      }

      const selectedAddressItem =
        refreshedAddresses.find(
          (item) =>
            item.address.trim().toLowerCase() ===
            normalizedAddress.toLowerCase(),
        ) || null;

      updateForm(
        "selectedDeliveryAddress",
        selectedAddressItem?.address || normalizedAddress,
      );

      resetNewAddressForm();
      setIsAddingAddress(false);

      AuthNotify.success(
        "Đã thêm địa chỉ",
        "Địa chỉ nhận hàng mới đã được lưu.",
      );
    } catch (error) {
      const errorMessage = getApiErrorMessage(
        error,
        "Không thể lưu địa chỉ nhận hàng.",
      );

      setNewAddressError(errorMessage);
      AuthNotify.error("Lưu địa chỉ thất bại", errorMessage);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (event, addressItem) => {
    event.preventDefault();
    event.stopPropagation();

    if (isSubmitting || isSavingAddress || deletingAddressId) {
      return;
    }

    const addressId = String(addressItem?.apiId || "").trim();

    if (!addressId) {
      AuthNotify.error(
        "Không thể xóa địa chỉ",
        "Địa chỉ này không có ID hợp lệ.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa địa chỉ "${getDeliveryAddressText(
        addressItem,
      )}" không?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingAddressId(addressId);
      await deleteDeliveryAddressApi(addressId);

      const remainingAddresses = addressList.filter(
        (item) => item.apiId !== addressId,
      );

      setAddressList(remainingAddresses);

      if (
        form.selectedDeliveryAddress ===
        getDeliveryAddressText(
          addressItem,
        )
      ) {
        updateForm(
          "selectedDeliveryAddress",
          getDeliveryAddressText(
            remainingAddresses[0],
          ),
        );
      }

      AuthNotify.success("Đã xóa địa chỉ", "Địa chỉ nhận hàng đã được xóa.");
    } catch (error) {
      AuthNotify.error(
        "Xóa địa chỉ thất bại",
        getApiErrorMessage(error, "Không thể xóa địa chỉ nhận hàng."),
      );
    } finally {
      setDeletingAddressId("");
    }
  };

  /* ================= PACKAGE ================= */

  const handleInputChange = (packageId, field, value) => {
    const shouldResetWoodCrateConfiguration =
      isWoodCrateMeasurementField(field) &&
      Boolean(
        form.optionalServices
          ?.packageConfigurationByPackageId
          ?.[packageId],
      );

    setPackages((previous) =>
      previous.map((pkg) =>
        pkg.id === packageId
          ? {
              ...pkg,
              [field]: value,
              ...(shouldResetWoodCrateConfiguration
                ? {
                    packageConfigurationId:
                      "",
                  }
                : {}),
            }
          : pkg,
      ),
    );

    clearPackageError(packageId, field);

    if (!shouldResetWoodCrateConfiguration) {
      return;
    }

    setForm((previous) => {
      const nextConfigurationMap =
        normalizePackageConfigurationMap(
          previous.optionalServices
            ?.packageConfigurationByPackageId,
        );

      delete nextConfigurationMap[packageId];

      const nextSelectedConfigurations =
        Array.isArray(
          previous.optionalServices
            ?.selectedPackageConfigurations,
        )
          ? previous.optionalServices.selectedPackageConfigurations.filter(
              (item) =>
                String(
                  item?.packageId || "",
                ).trim() !== packageId,
            )
          : [];

      const orderServiceFee =
        previous.optionalServices
          ?.requiresWoodenCrate
          ? Number(
              previous.optionalServices
                ?.woodCrateOrderFee ??
                previous.optionalServices
                  ?.woodCrateBaseFee,
            ) || 0
          : 0;

      const configurationFee =
        nextSelectedConfigurations.reduce(
          (total, item) =>
            total +
            (Number(item?.packageFee) || 0),
          0,
        );

      return {
        ...previous,
        optionalServices: {
          ...previous.optionalServices,
          packageConfigurationByPackageId:
            nextConfigurationMap,
          selectedPackageConfigurations:
            nextSelectedConfigurations,
          woodCrateOrderFee:
            orderServiceFee,
          woodCrateBaseFee:
            orderServiceFee,
          woodCrateConfigurationFee:
            configurationFee,
          woodCrateTotalFee:
            orderServiceFee + configurationFee,
          woodCrateCompleted: false,
        },
      };
    });

    setPackageErrors((previous) => ({
      ...previous,
      [packageId]: {
        ...(previous[packageId] || {}),
        packageConfigurationId:
          "Cân nặng hoặc kích thước đã thay đổi. Vui lòng chọn lại thùng gỗ.",
      },
    }));
  };

  const handleOptionalServicesChange = (
    nextServices,
  ) => {
    if (isSubmitting) {
      return;
    }

    const selectedRuleCodes =
      normalizeStringArray(
        nextServices?.selectedRuleCodes ??
          nextServices?.selectedPricingRuleCodes ??
          nextServices?.pricingRuleCodes,
      );

    const selectedPricingRuleIds =
      normalizePricingRuleIds(
        nextServices?.selectedPricingRuleIds ??
          nextServices?.pricingRuleIds,
      );

    const requiresWoodenCrate = Boolean(
      nextServices?.requiresWoodenCrate,
    );

    const packageConfigurationByPackageId =
      requiresWoodenCrate
        ? normalizePackageConfigurationMap(
            nextServices
              ?.packageConfigurationByPackageId,
          )
        : {};

    const selectedPackageConfigurations =
      requiresWoodenCrate &&
      Array.isArray(
        nextServices
          ?.selectedPackageConfigurations,
      )
        ? nextServices.selectedPackageConfigurations
            .filter(
              (item) =>
                item &&
                typeof item === "object",
            )
            .map((item) => ({
              ...item,
              packageId: String(
                item?.packageId || "",
              ).trim(),
              packageConfigurationId:
                String(
                  item
                    ?.packageConfigurationId ||
                    "",
                ).trim(),
              packageFee:
                Number(item?.packageFee) || 0,
              woodCrateBaseFee:
                Number(
                  item?.woodCrateBaseFee,
                ) || 0,
              totalFee:
                Number(item?.totalFee) || 0,
            }))
            .filter(
              (item) =>
                item.packageId &&
                item.packageConfigurationId,
            )
        : [];

    const woodCrateBaseFeePerPackage =
      requiresWoodenCrate
        ? Number(
            nextServices
              ?.woodCrateBaseFeePerPackage,
          ) || 0
        : 0;

    const woodCrateOrderFee =
      requiresWoodenCrate
        ? Number(
            nextServices?.woodCrateOrderFee ??
              nextServices?.woodCrateBaseFee,
          ) || 0
        : 0;

    const woodCrateBaseFee =
      woodCrateOrderFee;

    const woodCrateConfigurationFee =
      requiresWoodenCrate
        ? Number(
            nextServices
              ?.woodCrateConfigurationFee,
          ) || 0
        : 0;

    const woodCrateTotalFee =
      requiresWoodenCrate
        ? Number(
            nextServices?.woodCrateTotalFee,
          ) || 0
        : 0;

    const woodCrateCompleted =
      requiresWoodenCrate &&
      packages.length > 0 &&
      packages.every((pkg) =>
        Boolean(
          packageConfigurationByPackageId[pkg.id],
        ),
      );

    setPackages((previousPackages) =>
      previousPackages.map((pkg) => ({
        ...pkg,
        packageConfigurationId:
          packageConfigurationByPackageId[
            pkg.id
          ] || "",
      })),
    );

    setPackageErrors((previous) => {
      const nextErrors = {
        ...previous,
      };

      packages.forEach((pkg) => {
        if (
          !requiresWoodenCrate ||
          packageConfigurationByPackageId[pkg.id]
        ) {
          nextErrors[pkg.id] = {
            ...(nextErrors[pkg.id] || {}),
            packageConfigurationId: "",
          };
        }
      });

      return nextErrors;
    });

    setForm((previous) => ({
      ...previous,
      inspectPackage: Boolean(
        nextServices?.requiresInspection,
      ),
      optionalServices: {
        requiresPacking: Boolean(
          nextServices?.requiresPacking,
        ),
        requiresWoodenCrate,
        requiresInsurance: Boolean(
          nextServices?.requiresInsurance,
        ),
        requiresInspection: Boolean(
          nextServices?.requiresInspection,
        ),
        selectedRuleCodes,
        selectedPricingRuleIds,
        packageConfigurationByPackageId,
        selectedPackageConfigurations,
        woodCrateBaseFeePerPackage,
        woodCrateOrderFee,
        woodCrateBaseFee,
        woodCrateConfigurationFee,
        woodCrateTotalFee,
        woodCrateCompleted,
      },
    }));
  };

  const handleDecimalBlur = (packageId, field, value) => {
    if (!value) {
      return;
    }

    const normalizedValue = value.endsWith(".") ? value.slice(0, -1) : value;

    const numericValue = Number(normalizedValue);

    // Cho phép người dùng nhập tạm "0." để tiếp tục thành "0.5",
    // nhưng khi rời ô thì không chấp nhận giá trị bằng 0.
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      const fieldLabels = {
        weight: "Cân nặng",
        length: "Chiều dài",
        width: "Chiều rộng",
        height: "Chiều cao",
      };

      setPackages((previous) =>
        previous.map((pkg) =>
          pkg.id === packageId
            ? {
                ...pkg,
                [field]: "",
              }
            : pkg,
        ),
      );

      setPackageErrors((previous) => ({
        ...previous,
        [packageId]: {
          ...(previous[packageId] || {}),
          [field]: `${fieldLabels[field] || "Giá trị"} phải lớn hơn 0.`,
        },
      }));

      return;
    }

    handleInputChange(packageId, field, normalizedValue);
  };

  const handleAddPackage = () => {
    if (isSubmitting) {
      return;
    }

    const newPackage = createEmptyPackage();
    const nextPackageNumber = packages.length + 1;

    setPackages((previous) => [
      ...previous,
      newPackage,
    ]);

    setForm((previous) => {
      if (
        !previous.optionalServices
          ?.requiresWoodenCrate
      ) {
        return previous;
      }

      const orderServiceFee =
        Number(
          previous.optionalServices
            ?.woodCrateOrderFee ??
            previous.optionalServices
              ?.woodCrateBaseFee,
        ) || 0;

      const configurationFee =
        Number(
          previous.optionalServices
            ?.woodCrateConfigurationFee,
        ) || 0;

      return {
        ...previous,
        optionalServices: {
          ...previous.optionalServices,
          woodCrateOrderFee: orderServiceFee,
          woodCrateBaseFee: orderServiceFee,
          woodCrateTotalFee:
            orderServiceFee + configurationFee,
          woodCrateCompleted: false,
        },
      };
    });

    AuthNotify.success(
      "Đã thêm kiện hàng",
      `Đã thêm kiện hàng thứ ${nextPackageNumber}.`,
    );

    window.setTimeout(() => {
      document
        .getElementById(
          `consignment-package-${newPackage.id}`,
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 120);
  };

  const handleDeletePackage = (packageId) => {
    if (isSubmitting) {
      return;
    }

    if (packages.length <= 1) {
      AuthNotify.warning(
        "Không thể xóa kiện hàng",
        "Đơn ký gửi phải có tối thiểu 1 kiện hàng.",
      );
      return;
    }

    const targetPackageIndex =
      packages.findIndex(
        (pkg) => pkg.id === packageId,
      );

    const targetPackage =
      targetPackageIndex >= 0
        ? packages[targetPackageIndex]
        : null;

    if (!targetPackage) {
      AuthNotify.error(
        "Không thể xóa kiện hàng",
        "Không tìm thấy kiện hàng cần xóa.",
      );
      return;
    }

    const packageDisplayName =
      targetPackage.productName?.trim() ||
      `Kiện hàng thứ ${targetPackageIndex + 1}`;

    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa "${packageDisplayName}" không?\n\n` +
        "Toàn bộ thông tin, ảnh đã chọn và cấu hình thùng của kiện này sẽ bị xóa khỏi biểu mẫu.",
    );

    if (!confirmed) {
      return;
    }

    const deletedPreviewUrls =
      targetPackage.images
        .map((image) => image.previewUrl)
        .filter(Boolean);

    deletedPreviewUrls.forEach((previewUrl) => {
      URL.revokeObjectURL(previewUrl);
    });

    if (
      activeLightboxImg &&
      deletedPreviewUrls.includes(
        activeLightboxImg,
      )
    ) {
      setActiveLightboxImg(null);
    }

    setPackages((previous) =>
      previous.filter(
        (pkg) => pkg.id !== packageId,
      ),
    );

    setPackageErrors((previous) => {
      const nextErrors = {
        ...previous,
      };

      delete nextErrors[packageId];

      return nextErrors;
    });

    setForm((previous) => {
      const nextConfigurationMap =
        normalizePackageConfigurationMap(
          previous.optionalServices
            ?.packageConfigurationByPackageId,
        );

      delete nextConfigurationMap[packageId];

      const nextSelectedConfigurations =
        Array.isArray(
          previous.optionalServices
            ?.selectedPackageConfigurations,
        )
          ? previous.optionalServices.selectedPackageConfigurations.filter(
              (item) =>
                String(
                  item?.packageId || "",
                ).trim() !== packageId,
            )
          : [];

      const nextPackageCount = Math.max(
        packages.length - 1,
        0,
      );

      const orderServiceFee =
        previous.optionalServices
          ?.requiresWoodenCrate
          ? Number(
              previous.optionalServices
                ?.woodCrateOrderFee ??
                previous.optionalServices
                  ?.woodCrateBaseFee,
            ) || 0
          : 0;

      const nextConfigurationFee =
        nextSelectedConfigurations.reduce(
          (total, item) =>
            total +
            (Number(item?.packageFee) || 0),
          0,
        );

      const woodCrateCompleted =
        Boolean(
          previous.optionalServices
            ?.requiresWoodenCrate,
        ) &&
        nextPackageCount > 0 &&
        Object.keys(nextConfigurationMap).length ===
          nextPackageCount;

      return {
        ...previous,
        optionalServices: {
          ...previous.optionalServices,
          packageConfigurationByPackageId:
            nextConfigurationMap,
          selectedPackageConfigurations:
            nextSelectedConfigurations,
          woodCrateOrderFee:
            orderServiceFee,
          woodCrateBaseFee:
            orderServiceFee,
          woodCrateConfigurationFee:
            nextConfigurationFee,
          woodCrateTotalFee:
            orderServiceFee +
            nextConfigurationFee,
          woodCrateCompleted,
        },
      };
    });

    delete fileInputRefs.current[packageId];

    AuthNotify.success(
      "Đã xóa kiện hàng",
      `"${packageDisplayName}" đã được xóa khỏi đơn ký gửi.`,
    );
  };

  /* ================= IMAGE ================= */

  const handleFileChange = (packageId, event) => {
    const selectedFiles = Array.from(event.target.files || []);

    event.target.value = "";

    if (!selectedFiles.length) {
      return;
    }

    const targetPackage = packages.find((pkg) => pkg.id === packageId);
    const currentImageCount = targetPackage?.images?.length || 0;
    const availableSlots = MAX_IMAGES_PER_PACKAGE - currentImageCount;

    if (availableSlots <= 0) {
      AuthNotify.warning(
        "Đã đủ số lượng ảnh",
        `Mỗi kiện hàng chỉ được tải tối đa ${MAX_IMAGES_PER_PACKAGE} ảnh.`,
      );
      return;
    }

    const files = selectedFiles.slice(0, availableSlots);

    if (selectedFiles.length > availableSlots) {
      AuthNotify.warning(
        "Vượt quá số lượng ảnh",
        `Chỉ thêm ${availableSlots} ảnh còn trống. Mỗi kiện tối đa ${MAX_IMAGES_PER_PACKAGE} ảnh.`,
      );
    }

    const invalidFile = files.find(
      (file) => !ACCEPTED_IMAGE_TYPES.includes(file.type),
    );

    if (invalidFile) {
      AuthNotify.warning(
        "File không hợp lệ",
        `Ảnh "${invalidFile.name}" không phải JPG, PNG hoặc WEBP.`,
      );
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_IMAGE_SIZE);

    if (oversizedFile) {
      AuthNotify.warning(
        "Ảnh quá lớn",
        `Ảnh "${oversizedFile.name}" vượt quá 5MB.`,
      );
      return;
    }

    const newImages = files.map((file) => ({
      id: createUniqueId(),
      fileObj: file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPackages((previous) =>
      previous.map((pkg) =>
        pkg.id === packageId
          ? {
              ...pkg,
              images: [...pkg.images, ...newImages].slice(
                0,
                MAX_IMAGES_PER_PACKAGE,
              ),
            }
          : pkg,
      ),
    );

    clearPackageError(packageId, "images");

    AuthNotify.success(
      "Đã chọn ảnh",
      `Đã thêm ${files.length} ảnh. Kiện hàng hiện có ${currentImageCount + files.length}/${MAX_IMAGES_PER_PACKAGE} ảnh.`,
    );
  };

  const handleRemoveImage = (event, packageId, imageId, previewUrl) => {
    event.stopPropagation();

    if (isSubmitting) {
      return;
    }

    setPackages((previous) =>
      previous.map((pkg) => {
        if (pkg.id !== packageId) {
          return pkg;
        }

        const images = pkg.images.filter((image) => image.id !== imageId);

        if (!images.length) {
          setPackageErrors((oldErrors) => ({
            ...oldErrors,
            [packageId]: {
              ...(oldErrors[packageId] || {}),
              images: "Vui lòng tải ít nhất 1 ảnh sản phẩm.",
            },
          }));
        }

        return {
          ...pkg,
          images,
        };
      }),
    );

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (activeLightboxImg === previewUrl) {
      setActiveLightboxImg(null);
    }
  };

  /* ================= VALIDATE & SUBMIT ================= */

  const validateForm = () => {
    const result = validateConsignmentForm({
      form,
      packages,
    });

    setFormErrors(result.formErrors);
    setPackageErrors(result.packageErrors);

    if (!result.isValid) {
      const missingPackageConfigurationCount =
        Object.values(result.packageErrors)
          .filter(
            (errors) =>
              Boolean(errors?.packageConfigurationId)
          ).length;

      if (missingPackageConfigurationCount > 0) {
        AuthNotify.warning(
          "Chưa chọn kích thước thùng gỗ",
          `Còn ${missingPackageConfigurationCount} kiện chưa có cấu hình thùng. Vui lòng mở mục dịch vụ và chọn kích thước.`,
        );
      } else {
        AuthNotify.warning(
          "Thông tin chưa đầy đủ",
          "Vui lòng kiểm tra các trường được đánh dấu màu đỏ.",
        );
      }

      scrollToFirstError();
    }

    return result.isValid;
  };

  const handleOpenConfirmation = () => {
    if (isSubmitting || !validateForm()) {
      return;
    }

    setIsConfirming(true);

    window.setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 0);
  };

  const handleCreateOrder = async () => {
    if (isSubmitting) {
      return;
    }

    if (!validateForm()) {
      setIsConfirming(false);
      return;
    }

    const orderPricingRuleIds =
      normalizePricingRuleIds(
        form.optionalServices
          ?.selectedPricingRuleIds
      );

    try {
      setIsSubmitting(true);

      const items = [];

      for (let index = 0; index < packages.length; index += 1) {
        const pkg = packages[index];

        setSubmitMessage(
          `Đang upload ảnh kiện ${index + 1}/${packages.length}...`,
        );

        const referenceUrls = await Promise.all(
          pkg.images
            .slice(0, MAX_IMAGES_PER_PACKAGE)
            .map((image) => uploadPackageImage(image.fileObj)),
        );

        items.push({
          productName: pkg.productName.trim(),
          productType: pkg.productType,
          quantity: Number(pkg.quantity),
          weight: Number(pkg.weight),
          width: Number(pkg.width),
          height: Number(pkg.height),
          length: Number(pkg.length),
          declaredValue: Number(pkg.declaredValue),
          referenceUrls,
          domesticTrackingCode:
            pkg.trackingCode.trim() || null,
          packageConfigurationId:
            form.optionalServices
              ?.requiresWoodenCrate === true
              ? normalizePackageConfigurationMap(
                  form.optionalServices
                    ?.packageConfigurationByPackageId,
                )[pkg.id] || null
              : null,

        });
      }

      setSubmitMessage("Đang kiểm tra thông tin kiện hàng...");

      const requestItems = items;

      await validateConsignmentItemsApi(requestItems);

      setSubmitMessage("Đang gửi yêu cầu tạo đơn ký gửi...");

      /*
       * Payload bám đúng schema của POST /api/orders/consignments.
       * Không gửi các field mở rộng mà DTO hiện tại không khai báo.
       */
      const requestPayload = {
        route: form.route,
        shippingOption: form.shippingOption,
        receiverName:
          form.receiverName.trim(),
        receiverPhone:
          form.receiverPhone.trim(),
        receiverAddress:
          form.selectedDeliveryAddress.trim(),

        // Có thể chọn nhiều dịch vụ áp dụng cho toàn đơn.
        pricingRuleIds:
          orderPricingRuleIds,

        requiresInspection: Boolean(
          form.optionalServices
            ?.requiresInspection
        ),
        requiresPacking: Boolean(
          form.optionalServices
            ?.requiresPacking
        ),
        requiresWoodenCrate: Boolean(
          form.optionalServices
            ?.requiresWoodenCrate
        ),
        requiresInsurance: Boolean(
          form.optionalServices
            ?.requiresInsurance
        ),

        // Nguyện vọng khi hàng về VN. Rỗng = khách chưa chọn, BE hiểu là giao ngay.
        defaultDestinationHandling:
          form.defaultDestinationHandling,

        note: form.note.trim(),
        items: requestItems,
      };

      await createConsignmentApi(requestPayload);

      AuthNotify.success(
        "Tạo đơn thành công",
        "Đơn hàng ký gửi đã được tiếp nhận.",
      );

      navigate("/sale/consignments");
    } catch (error) {
      const backendErrors = error?.response?.data?.errors;

      const errorMessage = backendErrors
        ? Object.entries(backendErrors)
            .map(([key, value]) => {
              const messages = Array.isArray(value)
                ? value.join(", ")
                : String(value);

              return `${key}: ${messages}`;
            })
            .join(" | ")
        : getApiErrorMessage(
            error,
            "Không thể tạo đơn ký gửi. Vui lòng thử lại.",
          );

      AuthNotify.error("Giao dịch thất bại", errorMessage);
    } finally {
      setIsSubmitting(false);
      setSubmitMessage("Đang chuẩn bị tạo đơn...");
    }
  };

  if (isConfirming) {
    return (
      <ConsignmentOrderConfirm
        form={form}
        packages={packages}
        routeOptions={routeOptions}
        shippingOptions={shippingOptions}
        productTypeOptions={productTypeOptions}
        pricingRules={confirmationPricingRules}
        packageConfigurations={
          confirmationPackageConfigurations
        }
        masterDataLoading={
          isLoadingConfirmationData
        }
        masterDataError={
          confirmationDataError
        }
        isSubmitting={isSubmitting}
        submitMessage={submitMessage}
        onBack={() => setIsConfirming(false)}
        onConfirm={handleCreateOrder}
      />
    );
  }

  return (
    <div
      className={[
        "consignment-container",
        isSubmitting && "consignment-is-submitting",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="consignment-layout-grid">
        <div className="layout-left-fixed-sidebar">
          <div className="page-header-title-box">
            <div className="title-icon-orange">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>

            <div className="title-text-group">
              <h2>KÝ GỬI HÀNG HÓA</h2>
              <p>TẠO ĐƠN HÀNG MỚI</p>
            </div>
          </div>

          <div className="left-unified-wrapper-box">
            <div className="left-inner-section route-select-section">
              <SelectField
                label="TUYẾN HÀNG"
                value={form.route}
                error={formErrors.route}
                options={routeOptions}
                loading={isLoadingOptions}
                disabled={isSubmitting}
                placeholder="-- Chọn tuyến hàng --"
                onChange={(value) => updateForm("route", value)}
              />

              <div className="route-select-helper">
                <InfoCircleOutlined />
                <span>
                  Chọn đúng tuyến vận chuyển phù hợp với nơi gửi và nơi nhận
                  hàng.
                </span>
              </div>
            </div>

            <div className="left-inner-section border-top-dash">
              <SelectField
                label="HÌNH THỨC VẬN CHUYỂN"
                value={form.shippingOption}
                error={formErrors.shippingOption}
                options={shippingOptions}
                loading={isLoadingOptions}
                disabled={isSubmitting}
                placeholder="-- Chọn hình thức vận chuyển --"
                onChange={(value) => updateForm("shippingOption", value)}
              />
            </div>

            {/*
              Sale hỏi khách qua điện thoại rồi tick hộ. Bỏ trống vẫn tạo được đơn — lúc hàng
              về kho mặc định giao ngay, và khách gọi đổi ý thì kho vẫn ghi đè được.
            */}
            <div className="left-inner-section border-top-dash">
              <SelectField
                label="KHI HÀNG VỀ VIỆT NAM"
                value={form.defaultDestinationHandling}
                error={formErrors.defaultDestinationHandling}
                options={DESTINATION_HANDLING_OPTIONS}
                loading={false}
                disabled={isSubmitting}
                placeholder="-- Chưa chọn (mặc định giao ngay) --"
                onChange={(value) =>
                  updateForm("defaultDestinationHandling", value)
                }
              />

              <div className="route-select-helper">
                <InfoCircleOutlined />
                <span>
                  Gửi lại kho VN sẽ phát sinh phí lưu kho sau kỳ miễn phí, thu
                  một lần lúc khách đến lấy hàng.
                </span>
              </div>
            </div>

            <div className="left-inner-section border-top-dash">
              <div className="input-field-group" style={{ marginBottom: 12 }}>
                <label className="field-label required-label">
                  TÊN NGƯỜI NHẬN
                </label>

                <input
                  type="text"
                  value={form.receiverName}
                  disabled={isSubmitting}
                  placeholder="Nhập tên người nhận..."
                  className={getFieldClassName(
                    "custom-input",
                    formErrors.receiverName,
                  )}
                  onChange={(event) =>
                    updateForm("receiverName", event.target.value)
                  }
                />

                <FieldError message={formErrors.receiverName} />
              </div>

              <div className="input-field-group">
                <label className="field-label required-label">
                  SỐ ĐIỆN THOẠI
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.receiverPhone}
                  disabled={isSubmitting}
                  placeholder="Nhập số điện thoại..."
                  className={getFieldClassName(
                    "custom-input",
                    formErrors.receiverPhone,
                  )}
                  onChange={(event) =>
                    updateForm(
                      "receiverPhone",
                      event.target.value.replace(/\D/g, "").slice(0, 10),
                    )
                  }
                />

                <FieldError message={formErrors.receiverPhone} />
              </div>
            </div>

            <div className="left-inner-section border-top-dash">
              <label className="field-label">
                <EnvironmentOutlined />
                ĐỊA CHỈ NHẬN HÀNG
              </label>

              <div
                className={getFieldClassName(
                  "static-display-box address-received-highlight address-full-display",
                  formErrors.selectedDeliveryAddress,
                )}
                title={
                  form.selectedDeliveryAddress ||
                  "Chưa chọn địa chỉ"
                }
              >
                {form.selectedDeliveryAddress ||
                  "Chưa chọn địa chỉ"}
              </div>

              <FieldError message={formErrors.selectedDeliveryAddress} />
            </div>

            <div className="left-inner-section border-top-dash">
              <div className="inner-section-title required-label">
                CHỌN ĐỊA CHỈ NHẬN HÀNG
              </div>

              {!isAddingAddress ? (
                <>
                  <button
                    type="button"
                    className="btn-add-address"
                    disabled={
                      isSubmitting ||
                      isLoadingAddresses ||
                      isSavingAddress ||
                      Boolean(deletingAddressId)
                    }
                    onClick={() => {
                      setIsAddingAddress(true);
                      setNewAddressError("");
                    }}
                  >
                    <PlusOutlined />
                    THÊM ĐỊA CHỈ NHẬN HÀNG
                  </button>

                  {isLoadingAddresses ? (
                    <div className="address-empty-message">
                      <LoadingOutlined spin />
                      <span>Đang tải danh sách địa chỉ...</span>
                    </div>
                  ) : addressList.length ? (
                    <div
                      className={[
                        "address-scroll-container",
                        formErrors.selectedDeliveryAddress &&
                          "address-list-has-error",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {addressList.map((addressItem, index) => {
                        const fullAddress =
                          getDeliveryAddressText(
                            addressItem,
                          );

                        const isSelected =
                          form.selectedDeliveryAddress ===
                          fullAddress;
                        const isDeleting =
                          deletingAddressId === addressItem.apiId;

                        return (
                          <div
                            key={
                              addressItem.id ||
                              `${fullAddress}-${index}`
                            }
                            role="button"
                            tabIndex={0}
                            className={[
                              "address-item-clickable",
                              isSelected && "is-active",
                              isDeleting && "is-deleting",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() =>
                              updateForm(
                                "selectedDeliveryAddress",
                                fullAddress,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                updateForm(
                                  "selectedDeliveryAddress",
                                  fullAddress,
                                );
                              }
                            }}
                          >
                            <span className="address-text-truncate">
                              <strong title={fullAddress}>
                                {fullAddress}
                              </strong>
                            </span>

                            {addressItem.isDefault && (
                              <span className="address-default-badge">
                                Mặc định
                              </span>
                            )}

                            {isSelected && (
                              <CheckOutlined className="check-active-icon" />
                            )}

                            <button
                              type="button"
                              className="btn-delete-address"
                              disabled={
                                !addressItem.apiId ||
                                isSubmitting ||
                                isSavingAddress ||
                                Boolean(deletingAddressId)
                              }
                              onClick={(event) =>
                                handleDeleteAddress(event, addressItem)
                              }
                            >
                              {isDeleting ? (
                                <LoadingOutlined spin />
                              ) : (
                                <DeleteOutlined />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className={[
                        "address-empty-message",
                        formErrors.selectedDeliveryAddress &&
                          "address-list-has-error",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      Chưa có địa chỉ nhận hàng. Hãy thêm địa chỉ mới.
                    </div>
                  )}
                </>
              ) : (
                <div className="add-address-inline-form">
                  <SelectField
                    label="TỈNH / THÀNH PHỐ"
                    value={newAddressForm.provinceCode}
                    error={newAddressErrors.provinceCode}
                    options={provinceOptions}
                    loading={isLoadingProvinces}
                    disabled={isSubmitting || isSavingAddress}
                    placeholder="-- Chọn tỉnh/thành phố --"
                    onChange={(value) =>
                      updateNewAddressForm("provinceCode", value)
                    }
                  />

                  <SelectField
                    label="QUẬN / HUYỆN"
                    value={newAddressForm.districtCode}
                    error={newAddressErrors.districtCode}
                    options={districtOptions}
                    loading={isLoadingDistricts}
                    disabled={
                      isSubmitting ||
                      isSavingAddress ||
                      !newAddressForm.provinceCode
                    }
                    placeholder="-- Chọn quận/huyện --"
                    onChange={(value) =>
                      updateNewAddressForm("districtCode", value)
                    }
                  />

                  <SelectField
                    label="PHƯỜNG / XÃ"
                    value={newAddressForm.wardCode}
                    error={newAddressErrors.wardCode}
                    options={wardOptions}
                    loading={isLoadingWards}
                    disabled={
                      isSubmitting ||
                      isSavingAddress ||
                      !newAddressForm.districtCode
                    }
                    placeholder="-- Chọn phường/xã --"
                    onChange={(value) =>
                      updateNewAddressForm("wardCode", value)
                    }
                  />

                  <div className="input-field-group">
                    <label className="field-label required-label">
                      ĐỊA CHỈ CHI TIẾT
                    </label>

                    <input
                      type="text"
                      value={newAddressForm.detailAddress}
                      disabled={isSubmitting || isSavingAddress}
                      placeholder="Số nhà, tên đường..."
                      className={getFieldClassName(
                        "custom-input small-input",
                        newAddressErrors.detailAddress,
                      )}
                      onChange={(event) =>
                        updateNewAddressForm(
                          "detailAddress",
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !isSavingAddress) {
                          event.preventDefault();
                          handleSaveAddress();
                        }
                      }}
                    />

                    <FieldError message={newAddressErrors.detailAddress} />
                  </div>

                  <div className="selected-address-preview">
                    <EnvironmentOutlined />
                    <span>
                      {[
                        newAddressForm.detailAddress.trim(),
                        getAddressOptionName(
                          wardOptions,
                          newAddressForm.wardCode,
                        ),
                        getAddressOptionName(
                          districtOptions,
                          newAddressForm.districtCode,
                        ),
                        getAddressOptionName(
                          provinceOptions,
                          newAddressForm.provinceCode,
                        ),
                      ]
                        .filter(Boolean)
                        .join(", ") || "Địa chỉ đầy đủ sẽ hiển thị tại đây"}
                    </span>
                  </div>

                  <FieldError message={newAddressError} />

                  <div className="inline-form-actions">
                    <button
                      type="button"
                      className="btn-inline-cancel"
                      disabled={isSubmitting || isSavingAddress}
                      onClick={() => {
                        setIsAddingAddress(false);
                        resetNewAddressForm();
                      }}
                    >
                      Hủy
                    </button>

                    <button
                      type="button"
                      className="btn-inline-save"
                      disabled={isSubmitting || isSavingAddress}
                      onClick={handleSaveAddress}
                    >
                      {isSavingAddress ? (
                        <>
                          <LoadingOutlined spin />
                          Đang lưu...
                        </>
                      ) : (
                        <>
                          <CheckOutlined />
                          Lưu địa chỉ
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="layout-right-scrollable-form">
          <div className="scrollable-content-wrapper">
            {packages.map((pkg, index) => {
              const errors = packageErrors[pkg.id] || {};

              return (
                <div
                  key={pkg.id}
                  id={`consignment-package-${pkg.id}`}
                  className="form-main-card consignment-package-card"
                  style={{
                    marginBottom: "1.5rem",
                  }}
                >
                  <div className="form-step-header">
                    <div className="step-header-left">
                      <div className="step-number-circle">{index + 1}</div>

                      <h3>THÔNG TIN SẢN PHẨM KIỆN THỨ {index + 1}</h3>

                      <Tooltip
                        title={`Nhập chính xác thông tin sản phẩm thuộc kiện hàng thứ ${
                          index + 1
                        }, bao gồm tên sản phẩm, loại hàng hóa, số lượng, giá trị, cân nặng và kích thước. Để chúng tôi tính chi phí chính xác và đảm bảo kiện hàng được vận chuyển an toàn.`}
                        placement="top"
                      >
                        <InfoCircleOutlined
                          className="package-header-info-icon"
                          aria-label={`Hướng dẫn nhập thông tin kiện hàng thứ ${
                            index + 1
                          }`}
                        />
                      </Tooltip>
                    </div>

                    {packages.length > 1 && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className="btn-delete-package"
                        title={`Xóa kiện hàng thứ ${index + 1}`}
                        aria-label={`Xóa kiện hàng thứ ${index + 1}`}
                        onClick={() =>
                          handleDeletePackage(pkg.id)
                        }
                      >
                        <DeleteOutlined />
                        <span>Xóa kiện</span>
                      </button>
                    )}
                  </div>

                  <div className="form-row-2col product-main-info-row">
                    <div className="input-field-group product-main-field">
                      <FieldLabelTooltip
                        label="TÊN SẢN PHẨM"
                      
                        className="product-main-label"
                        required
                        placement="top"
                        tooltip="Nhập đúng và đầy đủ tên sản phẩm có trong kiện hàng, ví dụ: Áo thun nam, điện thoại iPhone 15 hoặc mỹ phẩm chăm sóc da."
                      />

                      <input
                        type="text"
                        value={pkg.productName}
                        disabled={isSubmitting}
                        placeholder="Nhập tên sản phẩm..."
                        autoComplete="off"
                        aria-invalid={Boolean(
                          errors.productName,
                        )}
                        className={getFieldClassName(
                          "custom-input product-main-control",
                          errors.productName,
                        )}
                        onChange={(event) =>
                          handleInputChange(
                            pkg.id,
                            "productName",
                            event.target.value,
                          )
                        }
                      />

                      <FieldError message={errors.productName} />
                    </div>

                    <div className="input-field-group product-main-field">
                      <FieldLabelTooltip
                        label="LOẠI HÀNG HÓA"
                        className="product-main-label"
                        required
                        placement="top"
                        tooltip="Chọn đúng nhóm hàng hóa để hệ thống áp dụng quy định vận chuyển, kiểm tra và bảng giá phù hợp."
                      />

                      <select
                        value={pkg.productType}
                        disabled={
                          isSubmitting ||
                          isLoadingOptions
                        }
                        aria-invalid={Boolean(
                          errors.productType,
                        )}
                        className={getFieldClassName(
                          "custom-select product-main-control",
                          errors.productType,
                        )}
                        onChange={(event) =>
                          handleInputChange(
                            pkg.id,
                            "productType",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          {isLoadingOptions
                            ? "Đang tải loại hàng hóa..."
                            : "-- Chọn loại hàng hóa --"}
                        </option>

                        {productTypeOptions.map(
                          (option) => (
                            <option
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </option>
                          ),
                        )}
                      </select>

                      <FieldError message={errors.productType} />
                    </div>
                  </div>

                  <div className="form-row-2col">
                    <div className="input-field-group">
                      <label className="field-label required-label">
                        SỐ LƯỢNG SẢN PHẨM
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={pkg.quantity}
                        disabled={isSubmitting}
                        placeholder="Nhập số lượng sản phẩm..."
                        className={getFieldClassName(
                          "custom-input",
                          errors.quantity,
                        )}
                        onKeyDown={preventInvalidNumberKeys}
                        onChange={(event) =>
                          handleInputChange(
                            pkg.id,
                            "quantity",
                            sanitizeInteger(event.target.value),
                          )
                        }
                      />

                      <FieldError message={errors.quantity} />
                    </div>

                    <div className="input-field-group">
                      <label className="field-label required-label">
                        GIÁ TRỊ KIỆN HÀNG (VND)
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatVnd(pkg.declaredValue)}
                        disabled={isSubmitting}
                        placeholder="Ví dụ: 1.500.000"
                        className={getFieldClassName(
                          "custom-input",
                          errors.declaredValue,
                        )}
                        onKeyDown={preventMoneyKeys}
                        onChange={(event) =>
                          handleInputChange(
                            pkg.id,
                            "declaredValue",
                            sanitizeInteger(event.target.value),
                          )
                        }
                      />

                      <FieldError message={errors.declaredValue} />
                    </div>
                  </div>

                  <div className="form-row-4col">
                    {PACKAGE_NUMBER_FIELDS.map((fieldItem) => (
                      <div key={fieldItem.field} className="input-field-group">
                        <FieldLabelTooltip
                          label={fieldItem.label}
                          required
                          tooltip={fieldItem.tooltip}
                          className="package-dimension-label"
                        />

                        <input
                          type="text"
                          inputMode="decimal"
                          value={pkg[fieldItem.field]}
                          disabled={isSubmitting}
                          placeholder={fieldItem.placeholder}
                          className={getFieldClassName(
                            "custom-input",
                            errors[fieldItem.field],
                          )}
                          onKeyDown={preventInvalidNumberKeys}
                          onChange={(event) =>
                            handleInputChange(
                              pkg.id,
                              fieldItem.field,
                              sanitizeDecimal(event.target.value),
                            )
                          }
                          onBlur={(event) =>
                            handleDecimalBlur(
                              pkg.id,
                              fieldItem.field,
                              event.target.value,
                            )
                          }
                        />

                        <FieldError message={errors[fieldItem.field]} />
                      </div>
                    ))}
                  </div>

                  <div
                    className="input-field-group"
                    style={{
                      marginBottom: "1.25rem",
                    }}
                  >
                    <label className="field-label">
                      MÃ VẬN ĐƠN NỘI ĐỊA (DOMESTIC TRACKING CODE)
                    </label>

                    <input
                      type="text"
                      value={pkg.trackingCode}
                      disabled={isSubmitting}
                      placeholder="Bỏ trống nếu chưa có mã..."
                      className="custom-input"
                      onChange={(event) =>
                        handleInputChange(
                          pkg.id,
                          "trackingCode",
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="input-field-group package-image-section package-image-upload-card">
                    <FieldLabelTooltip
                      label={`ẢNH SẢN PHẨM KIỆN ${index + 1}`}
                      required
                      placement="top"
                      tooltip="Tải ảnh rõ nét của sản phẩm trong kiện hàng. Hỗ trợ JPG, PNG và WEBP, dung lượng tối đa 5MB cho mỗi ảnh."
                    />

                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      disabled={
                        isSubmitting ||
                        pkg.images.length >= MAX_IMAGES_PER_PACKAGE
                      }
                      style={{ display: "none" }}
                      ref={(element) => {
                        fileInputRefs.current[pkg.id] = element;
                      }}
                      onChange={(event) => handleFileChange(pkg.id, event)}
                    />

                    <div
                      role="button"
                      tabIndex={
                        pkg.images.length >= MAX_IMAGES_PER_PACKAGE ? -1 : 0
                      }
                      aria-disabled={
                        isSubmitting ||
                        pkg.images.length >= MAX_IMAGES_PER_PACKAGE
                      }
                      className={[
                        "upload-dropzone-box-clickable",
                        errors.images && "upload-has-error",
                        isSubmitting && "upload-is-disabled",
                        pkg.images.length >= MAX_IMAGES_PER_PACKAGE &&
                          "upload-limit-reached",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        if (
                          !isSubmitting &&
                          pkg.images.length < MAX_IMAGES_PER_PACKAGE
                        ) {
                          fileInputRefs.current[pkg.id]?.click();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          (event.key === "Enter" || event.key === " ") &&
                          !isSubmitting &&
                          pkg.images.length < MAX_IMAGES_PER_PACKAGE
                        ) {
                          event.preventDefault();
                          fileInputRefs.current[pkg.id]?.click();
                        }
                      }}
                    >
                      <CloudUploadOutlined className="upload-big-icon" />

                      <span className="upload-main-text">
                        {pkg.images.length >= MAX_IMAGES_PER_PACKAGE
                          ? "Đã đủ 3 ảnh cho kiện hàng này"
                          : "Bấm để chọn ảnh cho kiện hàng này"}
                      </span>

                      <span className="upload-sub-text">
                        JPG, PNG, WEBP — tối đa 5MB/ảnh — tối đa 5 ảnh/kiện
                      </span>

                      <span className="upload-image-counter">
                        {pkg.images.length}/{MAX_IMAGES_PER_PACKAGE} ảnh
                      </span>
                    </div>

                    <FieldError message={errors.images} />

                    {pkg.images.length > 0 && (
                      <div className="image-previews-grid animation-fade-in">
                        {pkg.images.map((image, imageIndex) => (
                          <div
                            key={image.id}
                            className="preview-image-item"
                            onClick={() =>
                              setActiveLightboxImg(image.previewUrl)
                            }
                          >
                            <img
                              src={image.previewUrl}
                              alt={`Ảnh ${imageIndex + 1} của kiện ${index + 1}`}
                            />

                            <span className="preview-image-order">
                              Ảnh {imageIndex + 1}
                            </span>

                            <button
                              type="button"
                              disabled={isSubmitting}
                              className="btn-remove-preview-img"
                              title="Xóa ảnh"
                              aria-label={`Xóa ảnh ${imageIndex + 1} của kiện ${index + 1}`}
                              onClick={(event) =>
                                handleRemoveImage(
                                  event,
                                  pkg.id,
                                  image.id,
                                  image.previewUrl,
                                )
                              }
                            >
                              <CloseOutlined />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              disabled={isSubmitting}
              className={[
                "add-package-dashed-trigger",
                isSubmitting && "add-package-disabled",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={handleAddPackage}
            >
              <PlusCircleOutlined className="plus-dashed-icon" />
              <span>THÊM KIỆN HÀNG MỚI</span>
            </button>

            <div
              className="form-main-card consignment-general-note-card"
              style={{ marginTop: "1.25rem", marginBottom: "1.5rem" }}
            >
              <div className="form-step-header">
                <div className="step-header-left">
                  <div className="step-number-circle">
                    <InfoCircleOutlined />
                  </div>

                  <h3>GHI CHÚ CHUNG CHO ĐƠN KÝ GỬI & LỰA CHỌN DỊCH VỤ </h3>
                </div>
              </div>
              <FieldLabelTooltip
                  label="CHỌN LOẠI DỊCH VỤ"
                  
                />

              <PackageOptionalServices
                value={form.optionalServices}
                packages={packages}
                disabled={isSubmitting}
                triggerTitle="Dịch vụ áp dụng cho toàn bộ đơn"
                triggerDescription="Có thể chọn nhiều dịch vụ áp dụng chung cho tất cả kiện hàng."
                modalEyebrow="DỊCH VỤ TOÀN ĐƠN"
                modalTitle="Lựa chọn dịch vụ cho toàn bộ đơn ký gửi"
                modalDescription="Bảo hiểm chỉ mở khi đã nhập giá trị cho tất cả kiện. Khi chọn đóng thùng gỗ, bắt buộc chọn một cấu hình kích thước cho từng kiện trước khi lưu hoặc tạo đơn."
                onChange={handleOptionalServicesChange}
              />

              <div className="input-field-group">
                <FieldLabelTooltip
                  label="GHI CHÚ ĐƠN HÀNG"
                  required
                  tooltip="Nhập các yêu cầu chung cho đơn ký gửi như cách đóng gói, lưu ý hàng dễ vỡ, yêu cầu bảo quản hoặc những thông tin cần nhân viên xử lý biết."
                />

                <textarea
                  rows={4}
                  value={form.note}
                  disabled={isSubmitting}
                  maxLength={1000}
                  placeholder="Nhập ghi chú chung, yêu cầu đóng gói hoặc thông tin cần lưu ý cho toàn bộ đơn ký gửi..."
                  className={getFieldClassName(
                    "custom-textarea",
                    formErrors.note,
                  )}
                  onChange={(event) => updateForm("note", event.target.value)}
                />

                <div className="textarea-character-count">
                  {form.note.length}/1000 ký tự
                </div>

                <FieldError message={formErrors.note} />
              </div>
            </div>

            <div className="sticky-action-notice-bar">
              <div className="notice-left-message">
                <InfoCircleOutlined className="info-notice-icon" />

                <p>
                  <strong>LƯU Ý:</strong> Đơn hàng sẽ được nhân viên Vietnam
                  Logistics kiểm tra và xác nhận lại thông tin trước khi xử lý.
                </p>
              </div>

              <button
                type="button"
                className="btn-final-submit-order"
                disabled={isSubmitting}
                onClick={handleOpenConfirmation}
              >
                <CheckOutlined />
                {isSubmitting ? (
                  <>
                    <LoadingOutlined spin />
                    ĐANG TẠO ĐƠN...
                  </>
                ) : (
                  "XÁC NHẬN YÊU CẦU KÝ GỬI"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isSubmitting && (
        <div
          className="create-order-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="create-order-loading-card">
            <div className="create-order-loading-icon">
              <LoadingOutlined spin />
            </div>

            <h3>ĐANG TẠO ĐƠN KÝ GỬI</h3>
            <p>{submitMessage}</p>

            <div className="create-order-loading-bar">
              <span />
            </div>

            <small>Vui lòng không đóng hoặc tải lại trang.</small>
          </div>
        </div>
      )}

      {activeLightboxImg && (
        <div
          className="lightbox-overlay-modal"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div
            className="lightbox-content-box animate-zoom-in"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={activeLightboxImg}
              alt="Phóng to"
              className="lightbox-main-img"
            />
          </div>

          <span className="lightbox-hint-text">
            Bấm vào vùng trống để đóng cửa sổ
          </span>
        </div>
      )}
    </div>
  );
}
