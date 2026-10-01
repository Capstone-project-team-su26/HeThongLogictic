import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  UserOutlined,
} from "@ant-design/icons";
import FieldLabelTooltip from "@shared/components/FieldLabelTooltip/FieldLabelTooltip";
import uploadImage from "@shared/api/uploadImage";
import ConsignmentOrderConfirm from "@features/consignment/components/ConsignmentOrderConfirm/ConsignmentOrderConfirm";
import "./ConsignmentOrder.css";
import "@shared/styles/create-request.css";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  createConsignmentApi,
  previewConsignmentApi,
  validateConsignmentItemsApi,
} from "@features/consignment/api/consignmentService";
import {
  getConsignmentRoutesApi,
  getConsignmentShippingOptionsApi,
  getProductTypesApi,
} from "@features/consignment/api/consignmentMasterService";
/*
 * Sổ địa chỉ lấy theo KHÁCH ĐÃ CHỌN, không phải theo tài khoản đang đăng nhập.
 * GET /api/delivery-addresses (deliveryAddressService) trả sổ địa chỉ của chính
 * người gọi — gọi bằng token Sale thì ra địa chỉ của nhân viên, vô nghĩa với đơn
 * tạo hộ. Endpoint đúng là GET /api/customers/{customerId}/delivery-addresses.
 */
import {
  createCustomerDeliveryAddressApi,
  getCustomerDeliveryAddressesApi,
  searchCustomersApi,
} from "@features/customer/api/customerLookupService";
/* Danh mục hành chính GoShip THẬT (GET /api/Goship/...) — ghép địa chỉ bằng đúng tên GoShip. */
import { getFullAddressByCodes } from "@shared/api/vietnamAddressService";
import AddressSelect from "@shared/components/AddressSelect/AddressSelect";
import useAddressOptions from "@shared/components/AddressSelect/useAddressOptions";
import { Tooltip } from "antd";
import PackageOptionalServices from "@features/consignment/components/PackageOptionalServices/PackageOptionalServices";
import pricingRuleService from "@features/pricing/api/pricingRuleService";
import {
  ACCEPTED_IMAGE_TYPES,
  DESTINATION_HANDLING_OPTIONS,
  INITIAL_FORM,
  MAX_IMAGES_PER_PACKAGE,
  MAX_IMAGE_SIZE,
  PACKAGE_NUMBER_FIELDS,
} from "./ConsignmentOrder.constants";
import {
  createEmptyAddressErrors,
  createEmptyAddressForm,
  createEmptyFormErrors,
  createEmptyPackage,
  createUniqueId,
  extractUploadedImageUrl,
  formatVnd,
  getApiErrorMessage,
  getDeliveryAddressText,
  getFieldClassName,
  isCanceledRequest,
  isWoodCrateMeasurementField,
  normalizeDeliveryAddressList,
  normalizeOptionList,
  normalizePackageConfigurationMap,
  normalizePricingRuleIds,
  normalizeShippingOptionList,
  normalizeStringArray,
  preventInvalidNumberKeys,
  preventMoneyKeys,
  sanitizeDecimal,
  sanitizeInteger,
  validateConsignmentForm,
  validateFormField,
  validatePackageField,
  getOrderTotals,
  getOrderTotalsError,
  FORM_FIELD_VALIDATORS,
  formatLimitNumber,
  getMaxPackagesMessage,
  hasLimit,
} from "./ConsignmentOrder.helpers";
import useOrderLimits from "@shared/hooks/useOrderLimits";

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

/**
 * Thanh giới hạn: xanh khi còn thoải mái, vàng từ 80% trần, đỏ khi vượt. Để Sale biết TRƯỚC
 * khi khai thêm kiện, thay vì bị server trả 400 sau khi điền xong cả form.
 */
const LimitMeter = ({ label, value, max, text }) => {
  const ratio = max > 0 ? value / max : 0;

  const tone = ratio > 1 ? "over" : ratio >= 0.8 ? "near" : "ok";

  return (
    <div className={`order-limit-bar__item order-limit-bar__item--${tone}`}>
      <span className="order-limit-bar__label">{label}</span>

      <strong>{text}</strong>

      {max > 0 && (
        <span className="order-limit-bar__track">
          <span
            className="order-limit-bar__fill"
            style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
          />
        </span>
      )}
    </div>
  );
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
  onBlur,
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
      onBlur={onBlur}
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

/* Ô chọn tỉnh/huyện/xã có tìm không dấu + lỗi tải "Thử lại" (AddressSelect dùng chung). */
const AddressSelectField = ({ label, value, error, list, disabled, placeholder, onChange }) => (
  <div className="input-field-group">
    <label className="field-label required-label">
      <EnvironmentOutlined />
      {label}
    </label>

    <AddressSelect
      value={value}
      options={list.options}
      loading={list.loading}
      loadError={list.error}
      onRetry={list.retry}
      disabled={disabled}
      placeholder={placeholder}
      invalid={Boolean(error)}
      errorClassName="input-has-error"
      ariaLabel={label}
      onChange={onChange}
    />

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

  /*
   * Giới hạn tạo đơn do Admin cấu hình (không còn số cứng). Chưa tải / tải lỗi thì mọi
   * giới hạn là null: màn hình không chặn trần, backend kiểm và báo lỗi nêu đúng giới hạn.
   */
  const { consignment: limits } = useOrderLimits();
  const maxPackagesMessage = getMaxPackagesMessage(limits);

  /*
   * Ô nào đã rời con trỏ một lần. Giá trị SAI (quá cân, quá kích thước, quá số lượng) báo
   * ngay từ phím gõ; ô còn TRỐNG thì chỉ nhắc sau khi đã rời ô, để Sale mới mở form không bị
   * đỏ rực cả màn.
   */
  const [touchedFields, setTouchedFields] = useState({});
  const [touchedPackageFields, setTouchedPackageFields] = useState({});

  /*
   * Ô CHỌN KHÁCH HÀNG.
   *
   * `customerKeyword` là chữ Sale đang gõ, `customerResults` là kết quả
   * GET /api/customers?search= — backend lọc sẵn theo tên / mã / email / SĐT / địa chỉ.
   * Chọn xong thì đóng ô tìm và chỉ còn thẻ "Đang tạo đơn cho ..."; muốn đổi khách phải
   * bấm nút, để không ai lỡ tay đổi chủ đơn khi đang cuộn form.
   */
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState("");
  const [isPickingCustomer, setIsPickingCustomer] = useState(true);

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

  /*
   * Sổ địa chỉ CỦA KHÁCH đã chọn (chỉ đọc). Sale không thêm/sửa/xoá được:
   * POST|PUT|DELETE /api/delivery-addresses đều [Authorize(Roles = "Customer")].
   * Địa chỉ giao khác sổ thì Sale gõ tay — DTO nhận ReceiverAddress dạng chuỗi.
   */
  const [addressList, setAddressList] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [addressListError, setAddressListError] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState(
    createEmptyAddressForm(),
  );
  const [newAddressErrors, setNewAddressErrors] = useState(
    createEmptyAddressErrors(),
  );
  const [newAddressError, setNewAddressError] = useState("");

  /* Tỉnh → huyện → xã GoShip thật; huyện/xã tự về rỗng khi đổi mã cha. */
  const addressLists = useAddressOptions({
    provinceCode: newAddressForm.provinceCode,
    districtCode: newAddressForm.districtCode,
    enabled: isAddingAddress,
  });
  const provinceOptions = addressLists.provinces.options;
  const districtOptions = addressLists.districts.options;
  const wardOptions = addressLists.wards.options;

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
              /* Bỏ VAT / thuế nhập khẩu / phí mua hộ — xem chú thích ở PackageOptionalServices. */
              orderType: "CONSIGNMENT",
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

  /* Đang gõ: có nội dung thì kiểm ngay; trống thì chỉ nhắc khi ô đã từng rời con trỏ. */
  const resolveLiveError = (message, rawValue, isTouched, isBlur) => {
    if (isBlur || isTouched) {
      return message;
    }

    return String(rawValue ?? "").trim() === "" ? "" : message;
  };

  const updateForm = useCallback(
    (field, value) => {
      setForm((previous) => {
        const nextForm = { ...previous, [field]: value };

        /* Ô không có luật kiểm (ví dụ lựa chọn dịch vụ) thì khỏi ghi rác vào formErrors. */
        if (FORM_FIELD_VALIDATORS[field]) {
          const message = validateFormField(field, nextForm);

          setFormErrors((previousErrors) => ({
            ...previousErrors,
            [field]: resolveLiveError(
              message,
              value,
              touchedFields[field],
              false,
            ),
          }));
        }

        return nextForm;
      });
    },
    [touchedFields],
  );

  const handleFormFieldBlur = (field) => {
    setTouchedFields((previous) => ({ ...previous, [field]: true }));

    if (!FORM_FIELD_VALIDATORS[field]) {
      return;
    }

    setFormErrors((previous) => ({
      ...previous,
      [field]: validateFormField(field, form),
    }));
  };

  /* ================= KHÁCH HÀNG ================= */

  /*
   * Chọn khách = ghi customerId (Customer.Id thật) + bản ghi để vẽ thẻ. Đi qua
   * updateForm nên lỗi "Vui lòng chọn khách hàng cần tạo đơn." tắt ngay lúc chọn,
   * đúng cách mọi ô khác trong màn này cư xử.
   */
  const handleSelectCustomer = (customer) => {
    if (isSubmitting || !customer?.id) {
      return;
    }

    setTouchedFields((previous) => ({ ...previous, customerId: true }));

    updateForm("customer", customer);
    updateForm("customerId", customer.id);

    setIsPickingCustomer(false);
    setCustomerKeyword("");
    setCustomerResults([]);
    setCustomerSearchError("");

    /* Sổ địa chỉ và địa chỉ đang chọn thuộc về khách cũ — dọn sạch trước khi tải sổ mới. */
    setAddressList([]);
    setAddressListError("");
    setIsAddingAddress(false);
    resetNewAddressForm();
    updateForm("selectedDeliveryAddress", "");
  };

  /* Đổi khách: mở lại ô tìm, KHÔNG xoá customerId cho tới khi chọn được người mới,
     để Sale bấm nhầm rồi bấm Hủy thì đơn vẫn còn chủ. */
  const handleChangeCustomer = () => {
    if (isSubmitting) {
      return;
    }

    setIsPickingCustomer(true);
    setCustomerKeyword("");
    setCustomerResults([]);
    setCustomerSearchError("");
  };

  /*
   * Tìm khách: chờ 350ms sau phím cuối rồi mới gọi, và huỷ lời gọi cũ khi Sale gõ tiếp —
   * nếu không, gõ "nguyen" là sáu request và kết quả về sau chưa chắc là của chữ mới nhất.
   * Từ khoá rỗng vẫn gọi để mở ô ra đã có sẵn danh sách khách mà chọn.
   */
  useEffect(() => {
    if (!isPickingCustomer) {
      return undefined;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearchingCustomers(true);
        setCustomerSearchError("");

        const customers = await searchCustomersApi({
          search: customerKeyword.trim(),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setCustomerResults(customers);
      } catch (error) {
        if (isCanceledRequest(error)) return;

        setCustomerResults([]);
        setCustomerSearchError(
          getApiErrorMessage(
            error,
            "Không tải được danh sách khách hàng. Vui lòng thử lại.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingCustomers(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [customerKeyword, isPickingCustomer]);

  const resetNewAddressForm = () => {
    setNewAddressForm(createEmptyAddressForm());
    setNewAddressErrors(createEmptyAddressErrors());
    setNewAddressError("");
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

  const loadCustomerDeliveryAddresses = useCallback(
    async (customerId, options = {}) => {
      const result = await getCustomerDeliveryAddressesApi(customerId, options);
      const list = normalizeDeliveryAddressList(result);

      setAddressList(list);
      return list;
    },
    [],
  );

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

  /*
   * Sổ địa chỉ đi theo KHÁCH đang chọn. Chưa chọn khách thì không gọi API nào cả —
   * trước đây màn này gọi GET /api/delivery-addresses bằng token Sale và hiện sổ địa
   * chỉ của chính nhân viên như thể là của khách.
   */
  useEffect(() => {
    const controller = new AbortController();

    const loadAddresses = async () => {
      /* Đổi khách xong mà chưa chọn ai: dọn sổ cũ, không gọi API nào. */
      if (!form.customerId) {
        setAddressList([]);
        setAddressListError("");
        setIsLoadingAddresses(false);
        return;
      }

      try {
        setIsLoadingAddresses(true);
        setAddressListError("");

        const list = await loadCustomerDeliveryAddresses(form.customerId, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const defaultAddress =
          list.find((item) => item.isDefault) || list[0] || null;

        if (defaultAddress) {
          updateForm(
            "selectedDeliveryAddress",
            getDeliveryAddressText(defaultAddress),
          );
        }
      } catch (error) {
        if (!isCanceledRequest(error)) {
          const message = getApiErrorMessage(
            error,
            "Không thể tải sổ địa chỉ của khách hàng.",
          );

          setAddressList([]);
          setAddressListError(message);

          AuthNotify.error("Không tải được địa chỉ", message);
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
  }, [form.customerId, loadCustomerDeliveryAddresses, updateForm]);

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

  /* Số liệu cộng dồn để vẽ thanh giới hạn — cập nhật theo từng phím gõ. */
  const orderTotals = useMemo(() => getOrderTotals(packages), [packages]);
  const isPackageLimitReached =
    hasLimit(limits.maxPackages) && packages.length >= limits.maxPackages;

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

  /*
   * "Dùng địa chỉ này" — ghép tỉnh/huyện/xã + số nhà thành MỘT CHUỖI, LƯU vào sổ địa
   * chỉ của khách rồi mới đưa vào ReceiverAddress của đơn.
   *
   * Trước đây phần này không gọi API nào: POST /api/delivery-addresses là
   * [Authorize(Roles = "Customer")], token Sale chỉ ăn 403, nên địa chỉ gõ tay chỉ
   * sống được đúng một đơn rồi mất — lần sau Sale phải gõ lại từ đầu.
   *
   * Nay có đường riêng cho nhân viên (POST /api/customers/{id}/delivery-addresses).
   * Lưu HỎNG thì vẫn cho dùng địa chỉ đó cho đơn đang tạo và nói rõ là chưa lưu được:
   * việc chính của màn này là tạo đơn, không phải quản lý sổ địa chỉ.
   */
  const handleUseManualAddress = async () => {
    if (isSubmitting) {
      return;
    }

    if (!validateNewAddressForm()) {
      setNewAddressError("Vui lòng kiểm tra lại thông tin địa chỉ.");
      return;
    }

    setNewAddressError("");

    const detailAddress = newAddressForm.detailAddress.trim();

    let addressResult;

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

    const provinceName =
      addressResult?.province?.name ||
      getAddressOptionName(provinceOptions, newAddressForm.provinceCode);
    const districtName =
      addressResult?.district?.name ||
      getAddressOptionName(districtOptions, newAddressForm.districtCode);
    const wardName =
      addressResult?.ward?.name ||
      getAddressOptionName(wardOptions, newAddressForm.wardCode);

    const address = (
      addressResult?.fullAddress ||
      [detailAddress, wardName, districtName, provinceName]
        .filter(Boolean)
        .join(", ")
    ).trim();

    if (!address) {
      setNewAddressError("Địa chỉ nhận hàng không hợp lệ.");
      return;
    }

    /*
     * Chỉ đánh dấu ô đã "chạm" — KHÔNG gọi handleFormFieldBlur ở đây: hàm đó kiểm
     * trên biến `form` của lần render hiện tại, mà địa chỉ vừa đặt chưa kịp vào state,
     * nên sẽ báo "chưa chọn địa chỉ" ngay sau khi vừa chọn. updateForm đã tự xoá lỗi.
     */
    let savedToBook = false;

    if (form.customerId) {
      try {
        await createCustomerDeliveryAddressApi(form.customerId, { address });
        savedToBook = true;
        await loadCustomerDeliveryAddresses(form.customerId);
      } catch (error) {
        console.error(
          "[ConsignmentOrder] Không lưu được địa chỉ vào sổ của khách:",
          error,
        );
      }
    }

    updateForm("selectedDeliveryAddress", address);
    setTouchedFields((previous) => ({
      ...previous,
      selectedDeliveryAddress: true,
    }));

    resetNewAddressForm();
    setIsAddingAddress(false);

    if (savedToBook) {
      AuthNotify.success(
        "Đã chọn địa chỉ giao hàng",
        "Địa chỉ đã được lưu vào sổ của khách, lần sau chọn lại không phải gõ.",
      );
    } else {
      AuthNotify.warning(
        "Đã chọn địa chỉ giao hàng",
        "Chưa lưu được vào sổ địa chỉ của khách — địa chỉ này chỉ dùng cho đơn đang tạo.",
      );
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

    /*
     * Kiểm ngay từng phím gõ, đồng thời cộng lại trần CẢ ĐƠN: một kiện nặng thêm có thể làm
     * cả đơn vượt tổng cân nặng Admin cho phép dù kiện đó vẫn hợp lệ.
     */
    const nextPackages = packages.map((item) =>
      item.id === packageId ? { ...item, [field]: value } : item,
    );

    const changedPackage =
      nextPackages.find((item) => item.id === packageId) || {};

    setPackageErrors((previous) => ({
      ...previous,
      [packageId]: {
        ...(previous[packageId] || {}),
        [field]: resolveLiveError(
          validatePackageField(field, changedPackage, limits),
          value,
          touchedPackageFields[`${packageId}:${field}`],
          false,
        ),
      },
    }));

    setFormErrors((previous) => ({
      ...previous,
      packages: getOrderTotalsError(nextPackages, limits),
    }));

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

  /**
   * Rời ô thì kiểm đầy đủ (kể cả "chưa nhập"). `overrideValue` dành cho ô số: lúc rời ô,
   * giá trị vừa chuẩn hoá ("1." -> "1") chưa kịp vào state.
   */
  const handlePackageFieldBlur = (packageId, field, overrideValue) => {
    setTouchedPackageFields((previous) => ({
      ...previous,
      [`${packageId}:${field}`]: true,
    }));

    const pkg = packages.find((item) => item.id === packageId);

    if (!pkg) {
      return;
    }

    const target =
      overrideValue === undefined ? pkg : { ...pkg, [field]: overrideValue };

    setPackageErrors((previous) => ({
      ...previous,
      [packageId]: {
        ...(previous[packageId] || {}),
        [field]: validatePackageField(field, target, limits),
      },
    }));
  };

  const handleDecimalBlur = (packageId, field, value) => {
    if (!value) {
      handlePackageFieldBlur(packageId, field);
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

    handlePackageFieldBlur(packageId, field, normalizedValue);
  };

  const handleAddPackage = () => {
    if (isSubmitting || isPackageLimitReached) {
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
      limits,
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

  /**
   * Payload gửi backend — dùng cho CẢ ước tính lẫn tạo đơn thật.
   *
   * Ảnh kiện không ảnh hưởng tới tiền nên bản ước tính bỏ qua bước upload. Mọi trường
   * còn lại giữ y hệt: lệch một trường là backend tính ra số khác, mà đúng cái cần ở đây
   * là hai bên phải ra cùng một số.
   */
  const buildItemPayload = (pkg, referenceUrls = []) => ({
    productName: pkg.productName.trim(),
    productType: pkg.productType,
    quantity: Number(pkg.quantity),
    weight: Number(pkg.weight),
    width: Number(pkg.width),
    height: Number(pkg.height),
    length: Number(pkg.length),
    declaredValue: Number(pkg.declaredValue),
    referenceUrls,
    domesticTrackingCode: pkg.trackingCode.trim() || null,
    packageConfigurationId:
      form.optionalServices?.requiresWoodenCrate === true
        ? normalizePackageConfigurationMap(
            form.optionalServices?.packageConfigurationByPackageId,
          )[pkg.id] || null
        : null,
  });

  const buildRequestPayload = (items) => ({
    /* Chủ đơn. Backend tra bằng đúng Customer.Id này (CustomerLookupHelper). */
    customerId: form.customerId,
    route: form.route,
    shippingOption: form.shippingOption,
    receiverName: form.receiverName.trim(),
    receiverPhone: form.receiverPhone.trim(),
    receiverAddress: form.selectedDeliveryAddress.trim(),
    defaultDestinationHandling: form.defaultDestinationHandling,
    note: form.note.trim(),
    items,
  });

  /*
   * Ước tính chi phí do BACKEND tính, lấy khi mở màn xác nhận. Màn này không tự cộng tiền:
   * trình duyệt và backend tính bằng hai đoạn mã khác nhau thì số sớm muộn cũng lệch.
   */
  const [estimate, setEstimate] = useState(null);
  const [estimateError, setEstimateError] = useState("");
  const [isEstimating, setIsEstimating] = useState(false);

  const handleOpenConfirmation = () => {
    if (isSubmitting || !validateForm()) {
      return;
    }

    setIsConfirming(true);

    /*
     * Hỏi backend giá ngay khi mở màn xác nhận, để Sale đọc cho khách nghe đúng con số hệ
     * thống sẽ phát hành. Hỏng thì màn vẫn mở và nói rõ là chưa lấy được ước tính.
     */
    setIsEstimating(true);
    setEstimateError("");
    setEstimate(null);

    previewConsignmentApi(
      buildRequestPayload(packages.map((pkg) => buildItemPayload(pkg))),
    )
      .then((result) => {
        setEstimate(result || null);
        setIsEstimating(false);
      })
      .catch((error) => {
        setEstimate(null);
        setEstimateError(
          error?.message || "Chưa lấy được ước tính chi phí.",
        );
        setIsEstimating(false);
      });

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

        /* Cùng một hàm dựng với bản ước tính — khác đúng mỗi danh sách ảnh. */
        items.push(buildItemPayload(pkg, referenceUrls));
      }

      setSubmitMessage("Đang kiểm tra thông tin kiện hàng...");

      const requestItems = items;

      await validateConsignmentItemsApi(requestItems);

      setSubmitMessage("Đang gửi yêu cầu tạo đơn ký gửi...");

      /*
       * Payload bám đúng CreateConsignmentByStaffRequest của
       * POST /api/staff/consignments — không thừa một khoá nào.
       *
       * KHÔNG CÒN gửi pricingRuleIds / requiresInspection / requiresPacking /
       * requiresWoodenCrate / requiresInsurance: DTO của luồng Sale tạo hộ không khai
       * báo field nào như vậy. Backend nhận dịch vụ THEO TỪNG KIỆN qua
       * items[].services[].pricingRuleId; màn này lại đang gom dịch vụ ở cấp đơn nên
       * chưa nối được — xem ghi chú trong PackageOptionalServices.
       */
      const requestPayload = {
        /* Chủ đơn. Backend tra bằng đúng Customer.Id này (CustomerLookupHelper). */
        customerId: form.customerId,

        route: form.route,
        shippingOption: form.shippingOption,
        receiverName:
          form.receiverName.trim(),
        receiverPhone:
          form.receiverPhone.trim(),
        receiverAddress:
          form.selectedDeliveryAddress.trim(),

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
        estimate={estimate}
        estimateError={estimateError}
        isEstimating={isEstimating}
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
            {/*
              Ô ĐẦU TIÊN của form và là thứ bắt buộc: đơn Sale tạo hộ phải có chủ.
              Chọn xong thì phần tìm kiếm biến mất, chỉ còn thẻ ghim "Đang tạo đơn cho ..."
              đứng trên cùng — Sale cuộn tới đâu cũng biết mình đang lên đơn cho ai.
            */}
            <div className="left-inner-section customer-picker-section">
              <div className="inner-section-title required-label">
                KHÁCH HÀNG CỦA ĐƠN
              </div>

              {form.customerId && !isPickingCustomer ? (
                <div className="customer-selected-card">
                  <div className="customer-selected-card__head">
                    <UserOutlined />
                    <span>Đang tạo đơn cho</span>
                  </div>

                  <div className="customer-selected-card__name">
                    {form.customer?.fullName || "Khách hàng"}
                  </div>

                  <div className="customer-selected-card__meta">
                    <span>{form.customer?.phone || "Chưa có SĐT"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{form.customer?.email || "Chưa có email"}</span>
                  </div>

                  {form.customer?.customerCode && (
                    <div className="customer-selected-card__code">
                      Mã khách: {form.customer.customerCode}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn-change-customer"
                    disabled={isSubmitting}
                    onClick={handleChangeCustomer}
                  >
                    Đổi khách hàng
                  </button>
                </div>
              ) : (
                <div className="customer-picker-box">
                  <div className="input-field-group">
                    <input
                      type="text"
                      value={customerKeyword}
                      disabled={isSubmitting}
                      placeholder="Tìm theo tên, số điện thoại hoặc email..."
                      className={getFieldClassName(
                        "custom-input",
                        formErrors.customerId,
                      )}
                      onChange={(event) =>
                        setCustomerKeyword(event.target.value)
                      }
                      onBlur={() => handleFormFieldBlur("customerId")}
                    />

                    <FieldError message={formErrors.customerId} />
                  </div>

                  {isSearchingCustomers ? (
                    <div className="customer-picker-message">
                      <LoadingOutlined spin />
                      <span>Đang tìm khách hàng...</span>
                    </div>
                  ) : customerSearchError ? (
                    <div className="customer-picker-message customer-picker-message--error">
                      {customerSearchError}
                    </div>
                  ) : customerResults.length ? (
                    <div className="customer-result-list">
                      {customerResults.map((customer) => (
                        <div
                          key={customer.id}
                          role="button"
                          tabIndex={0}
                          className={[
                            "customer-result-item",
                            customer.id === form.customerId && "is-active",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => handleSelectCustomer(customer)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleSelectCustomer(customer);
                            }
                          }}
                        >
                          <strong>{customer.fullName || "Khách hàng"}</strong>

                          <span className="customer-result-item__meta">
                            {[customer.phone, customer.email]
                              .filter(Boolean)
                              .join(" · ") || "Chưa có SĐT / email"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="customer-picker-message">
                      {customerKeyword.trim()
                        ? "Không tìm thấy khách hàng nào khớp từ khoá này."
                        : "Chưa có khách hàng nào để chọn."}
                    </div>
                  )}

                  {form.customerId && (
                    <button
                      type="button"
                      className="btn-inline-cancel"
                      disabled={isSubmitting}
                      onClick={() => setIsPickingCustomer(false)}
                    >
                      Hủy, giữ khách đang chọn
                    </button>
                  )}
                </div>
              )}
            </div>
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
                onBlur={() => handleFormFieldBlur("route")}
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
                onBlur={() => handleFormFieldBlur("shippingOption")}
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
                  onBlur={() => handleFormFieldBlur("receiverName")}
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
                  onBlur={() => handleFormFieldBlur("receiverPhone")}
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
                SỔ ĐỊA CHỈ CỦA KHÁCH
              </div>

              {!form.customerId ? (
                <div className="address-empty-message">
                  Chọn khách hàng ở đầu biểu mẫu để xem sổ địa chỉ nhận hàng
                  của khách.
                </div>
              ) : !isAddingAddress ? (
                <>
                  <button
                    type="button"
                    className="btn-add-address"
                    disabled={isSubmitting || isLoadingAddresses}
                    onClick={() => {
                      setIsAddingAddress(true);
                      setNewAddressError("");
                    }}
                  >
                    <PlusOutlined />
                    NHẬP ĐỊA CHỈ GIAO KHÁC
                  </button>

                  <div className="route-select-helper">
                    <InfoCircleOutlined />
                    <span>
                      Địa chỉ nhập tay sẽ được lưu vào sổ của khách để lần sau
                      chọn lại, không phải gõ lại. Sửa và xoá vẫn do khách tự làm
                      bên app khách.
                    </span>
                  </div>

                  {isLoadingAddresses ? (
                    <div className="address-empty-message">
                      <LoadingOutlined spin />
                      <span>Đang tải sổ địa chỉ của khách...</span>
                    </div>
                  ) : addressListError ? (
                    <div className="address-empty-message address-list-has-error">
                      {addressListError}
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
                      Khách này chưa có địa chỉ nào trong sổ. Hãy bấm “Nhập địa
                      chỉ giao khác” để gõ địa chỉ người nhận.
                    </div>
                  )}
                </>
              ) : (
                <div className="add-address-inline-form">
                  <AddressSelectField
                    label="TỈNH / THÀNH PHỐ"
                    value={newAddressForm.provinceCode}
                    error={newAddressErrors.provinceCode}
                    list={addressLists.provinces}
                    disabled={isSubmitting}
                    placeholder="-- Chọn tỉnh/thành phố --"
                    onChange={(value) =>
                      updateNewAddressForm("provinceCode", value)
                    }
                  />

                  <AddressSelectField
                    label="QUẬN / HUYỆN"
                    value={newAddressForm.districtCode}
                    error={newAddressErrors.districtCode}
                    list={addressLists.districts}
                    disabled={isSubmitting ||
                      !newAddressForm.provinceCode}
                    placeholder="-- Chọn quận/huyện --"
                    onChange={(value) =>
                      updateNewAddressForm("districtCode", value)
                    }
                  />

                  <AddressSelectField
                    label="PHƯỜNG / XÃ"
                    value={newAddressForm.wardCode}
                    error={newAddressErrors.wardCode}
                    list={addressLists.wards}
                    disabled={isSubmitting ||
                      !newAddressForm.districtCode}
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
                      disabled={isSubmitting}
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
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleUseManualAddress();
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
                      onClick={handleUseManualAddress}
                    >
                      <CheckOutlined />
                      Dùng địa chỉ này
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="layout-right-scrollable-form">
          <div className="scrollable-content-wrapper">
            <div className="order-limit-bar">
              <div className="order-limit-bar__item">
                <span className="order-limit-bar__label">Số kiện</span>
                <strong>
                  {orderTotals.packageCount}
                  {hasLimit(limits.maxPackages) ? ` / ${limits.maxPackages}` : ""}
                </strong>
              </div>

              <LimitMeter
                label="Tổng cân nặng"
                value={orderTotals.totalWeight}
                max={limits.maxTotalWeightKg}
                text={
                  hasLimit(limits.maxTotalWeightKg)
                    ? `${formatLimitNumber(orderTotals.totalWeight)} / ${formatLimitNumber(
                        limits.maxTotalWeightKg,
                      )} kg`
                    : `${formatLimitNumber(orderTotals.totalWeight)} kg`
                }
              />

              <LimitMeter
                label="Tổng giá trị"
                value={orderTotals.totalValue}
                max={limits.maxTotalDeclaredValue}
                text={
                  hasLimit(limits.maxTotalDeclaredValue)
                    ? `${orderTotals.totalValue.toLocaleString("vi-VN")} / ${limits.maxTotalDeclaredValue.toLocaleString(
                        "vi-VN",
                      )} đ`
                    : `${orderTotals.totalValue.toLocaleString("vi-VN")} đ`
                }
              />
            </div>

            <FieldError message={formErrors.packages} />

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
                        onBlur={() =>
                          handlePackageFieldBlur(pkg.id, "productName")
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
                        onBlur={() =>
                          handlePackageFieldBlur(pkg.id, "productType")
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
                      <div className="field-label-with-hint">
                        <label className="field-label required-label">
                          SỐ LƯỢNG SẢN PHẨM
                        </label>

                        {hasLimit(limits.maxParcelQuantity) && (
                          <span className="field-limit-hint">
                            tối đa {limits.maxParcelQuantity}
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={pkg.quantity}
                        disabled={isSubmitting}
                        placeholder="VD: 2"
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
                        onBlur={() => handlePackageFieldBlur(pkg.id, "quantity")}
                      />

                      <FieldError message={errors.quantity} />
                    </div>

                    <div className="input-field-group">
                      <div className="field-label-with-hint">
                        <label className="field-label required-label">
                          GIÁ TRỊ KIỆN HÀNG (VND)
                        </label>

                        {hasLimit(limits.maxItemDeclaredValue) && (
                          <span className="field-limit-hint">
                            tối đa {limits.maxItemDeclaredValue.toLocaleString("vi-VN")} đ / kiện
                          </span>
                        )}
                      </div>

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
                        onBlur={() =>
                          handlePackageFieldBlur(pkg.id, "declaredValue")
                        }
                      />

                      <FieldError message={errors.declaredValue} />
                    </div>
                  </div>

                  <div className="form-row-4col">
                    {PACKAGE_NUMBER_FIELDS.map((fieldItem) => {
                      const fieldLimit = limits[fieldItem.limitKey];
                      const limitText = hasLimit(fieldLimit)
                        ? `tối đa ${formatLimitNumber(fieldLimit)} ${fieldItem.unit}${fieldItem.hintSuffix}`
                        : "";

                      return (
                      <div key={fieldItem.field} className="input-field-group">
                        <div className="field-label-with-hint">
                          <FieldLabelTooltip
                            label={fieldItem.label}
                            required
                            tooltip={
                              limitText
                                ? `${fieldItem.tooltip} (${limitText}).`
                                : `${fieldItem.tooltip}.`
                            }
                            className="package-dimension-label"
                          />

                          {limitText && (
                            <span className="field-limit-hint">{limitText}</span>
                          )}
                        </div>

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
                      );
                    })}
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
              disabled={isSubmitting || isPackageLimitReached}
              className={[
                "add-package-dashed-trigger",
                (isSubmitting || isPackageLimitReached) && "add-package-disabled",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={handleAddPackage}
            >
              <PlusCircleOutlined className="plus-dashed-icon" />
              <span>THÊM KIỆN HÀNG MỚI</span>
            </button>

            {isPackageLimitReached && (
              <FieldError message={maxPackagesMessage} />
            )}

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
                  onBlur={() => handleFormFieldBlur("note")}
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
