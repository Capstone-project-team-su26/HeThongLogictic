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
  LinkOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import FieldLabelTooltip from "@shared/components/FieldLabelTooltip/FieldLabelTooltip";
import PackageOptionalServicesS1, {
  EMPTY_PACKAGE_SERVICES,
} from "@features/purchase/components/PackageOptionalServicesS1/PackageOptionalServicesS1";

import {
  getConsignmentRoutesApi,
  getConsignmentShippingOptionsApi,
  getProductTypesApi,
/*
 * API THẬT: tuyến và phương thức vận chuyển đọc từ bảng giá đang hiệu lực. Bản mock liệt kê
 * cả "Tiết kiệm" và "Đường biển" — production không bán hai phương thức đó, chọn vào thì
 * backend không tìm ra dòng giá để tính cước.
 */
} from "@features/consignment/api/consignmentMasterService";

/*
 * Sổ địa chỉ THEO KHÁCH ĐÃ CHỌN (API thật): GET/POST /api/customers/{customerId}/delivery-addresses.
 * Không dùng /api/delivery-addresses (sổ của chính người gọi — token Sale ra địa chỉ nhân viên).
 * Nhân viên KHÔNG có quyền xoá địa chỉ của khách (DELETE chỉ Customer) nên không có nút xoá.
 */
import {
  createCustomerDeliveryAddressApi,
  getCustomerDeliveryAddressesApi,
} from "@features/customer/api/customerLookupService";

import { createPurchaseRequestApi } from "@features/purchase/api/purchaseRequestService";
import CustomerPickerField from "@features/customer/components/CustomerPickerField/CustomerPickerField";

/* Danh mục hành chính GoShip THẬT — ghép địa chỉ bằng đúng tên GoShip. */
import { getFullAddressByCodes } from "@shared/api/vietnamAddressService";
import AddressSelect from "@shared/components/AddressSelect/AddressSelect";
import useAddressOptions from "@shared/components/AddressSelect/useAddressOptions";

import ConsignmentBuyOrderConfirm from "@features/purchase/components/ConsignmentBuyOrderConfirm/ConsignmentBuyOrderConfirm";

import {
  INITIAL_ADDRESS_SELECT,
  INITIAL_FORM,
  MAX_IMAGES_PER_ITEM,
  PURCHASE_FIELD_MAX_LENGTH,
} from "./ConsignmentBuyOrder.constants";

import {
  createEmptyFormErrors,
  createEmptyItem,
  createUniqueId,
  getAddressOptionName,
  getApiErrorMessage,
  getClientTimePayload,
  getFieldClassName,
  getFileIdentity,
  getGeneralNoteMaxLength,
  getItemImages,
  getSourceWebsiteFromLink,
  isCanceledRequest,
  isValidHttpUrl,
  getMaxPurchaseItemsMessage,
  hasPurchaseLimit,
  normalizeDeliveryAddress,
  normalizeDeliveryAddressList,
  normalizeOptionList,
  normalizeShippingOptionList,
  normalizeStringArray,
  preventInvalidNumberKeys,
  sanitizeInteger,
  uploadProductImages,
  validateBuyOrderForm,
  validateProductImageFile,
} from "./ConsignmentBuyOrder.helpers";
import useOrderLimits from "@shared/hooks/useOrderLimits";

import "./ConsignmentBuyOrder.css";
import "@shared/styles/create-request.css";

const FieldError = ({ message }) => {
  if (!message) {
    return null;
  }

  return (
    <div className="purchase-buy-field-error-message">
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
  <div className="purchase-buy-input-field-group">
    <label className="purchase-buy-field-label purchase-buy-required-label">
      <EnvironmentOutlined />
      {label}
    </label>

    <select
      value={value}
      disabled={disabled || loading}
      aria-invalid={Boolean(error)}
      className={getFieldClassName("purchase-buy-custom-select", error)}
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

export default function ConsignmentBuyOrder() {
  const navigate = useNavigate();

  const fileInputRefs = useRef({});

  const itemsRef = useRef([]);

  const [form, setForm] = useState(INITIAL_FORM);

  /*
   * Khách hàng của đơn — KHÁC người nhận. Không có khoá này thì backend không tra được
   * đơn thuộc về ai và trả 400, nên màn chặn ngay tại chỗ.
   */
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerError, setCustomerError] = useState("");

  const [items, setItems] = useState([createEmptyItem()]);

  /* Giới hạn số dòng / số lượng do Admin cấu hình; chưa tải / lỗi → không chặn, backend kiểm. */
  const { purchase: purchaseLimits } = useOrderLimits();
  const maxPurchaseItemsMessage = getMaxPurchaseItemsMessage(purchaseLimits);

  const [formErrors, setFormErrors] = useState(createEmptyFormErrors());

  const [itemErrors, setItemErrors] = useState({});

  const [routeOptions, setRouteOptions] = useState([]);

  const [shippingOptions, setShippingOptions] = useState([]);

  const [productTypeOptions, setProductTypeOptions] = useState([]);

  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const [addressList, setAddressList] = useState([]);

  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);

  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const [newAddressInput, setNewAddressInput] = useState("");

  const [newAddressError, setNewAddressError] = useState("");

  const [newAddressSelect, setNewAddressSelect] = useState(
    INITIAL_ADDRESS_SELECT,
  );

  /* Tỉnh → huyện → xã GoShip thật; huyện/xã tự về rỗng khi đổi mã cha. */
  const addressLists = useAddressOptions({
    provinceCode: newAddressSelect.provinceCode,
    districtCode: newAddressSelect.districtCode,
    enabled: isAddingAddress,
  });

  const provinceOptions = addressLists.provinces.options;

  const districtOptions = addressLists.districts.options;

  const wardOptions = addressLists.wards.options;

  const [activeLightboxImg, setActiveLightboxImg] = useState(null);

  const [isConfirming, setIsConfirming] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [submitMessage, setSubmitMessage] = useState(
    "Đang chuẩn bị tạo yêu cầu...",
  );

  const clearItemError = (itemId, field) => {
    setItemErrors((previous) => ({
      ...previous,
      [itemId]: {
        ...(previous[itemId] || {}),
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

  const handleOptionalServicesChange = (nextServices) => {
    if (isSubmitting) {
      return;
    }

    const selectedPricingRuleIds = normalizeStringArray(
      nextServices?.selectedPricingRuleIds ??
        nextServices?.pricingRuleIds,
    );

    const selectedRuleCodes = normalizeStringArray(
      nextServices?.selectedRuleCodes ??
        nextServices?.selectedPricingRuleCodes ??
        nextServices?.pricingRuleCodes,
    );

    setForm((previous) => ({
      ...previous,
      optionalServices: {
        ...EMPTY_PACKAGE_SERVICES,
        ...previous.optionalServices,
        ...nextServices,
        requiresPacking: Boolean(nextServices?.requiresPacking),
        requiresWoodenCrate: Boolean(nextServices?.requiresWoodenCrate),
        requiresInsurance: Boolean(nextServices?.requiresInsurance),
        selectedRuleCodes,
        selectedPricingRuleIds,
        pricingRuleIds: selectedPricingRuleIds,
      },
    }));
  };

  const selectedCustomerId = selectedCustomer?.id || "";

  const loadDeliveryAddresses = useCallback(
    async (options = {}) => {
      if (!selectedCustomerId) {
        setAddressList([]);
        return [];
      }

      const result = await getCustomerDeliveryAddressesApi(
        selectedCustomerId,
        options,
      );

      const list = normalizeDeliveryAddressList(result);

      setAddressList(list);

      return list;
    },
    [selectedCustomerId],
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

        const [
          routesResult,
          shippingOptionsResult,
          productTypesResult,
        ] = await Promise.all([
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

        const normalizedRoutes = normalizeOptionList(
          routesResult,
          ["routes"],
        );

        const normalizedShippingOptions =
          normalizeShippingOptionList(
            shippingOptionsResult,
          );

        const normalizedProductTypes = normalizeOptionList(
          productTypesResult,
          ["productTypes"],
        );

        setRouteOptions(normalizedRoutes);

        setShippingOptions(normalizedShippingOptions);

        setProductTypeOptions(normalizedProductTypes);

        if (!normalizedRoutes.length || !normalizedShippingOptions.length) {
          setFormErrors((previous) => ({
            ...previous,
            ...(!normalizedRoutes.length
              ? {
                  route:
                    "Chưa có dữ liệu tuyến hàng. Vui lòng tải lại trang.",
                }
              : {}),
            ...(!normalizedShippingOptions.length
              ? {
                  shippingOption:
                    "Chưa có dữ liệu phương thức vận chuyển. Vui lòng tải lại trang.",
                }
              : {}),
          }));
        }
      } catch (error) {
        if (!isCanceledRequest(error)) {
          AuthNotify.error(
            "Không tải được dữ liệu",
            getApiErrorMessage(
              error,
              "Không thể tải tuyến hàng, phương thức vận chuyển hoặc loại sản phẩm.",
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

        /* Đổi khách → bỏ địa chỉ của khách trước, nạp sổ của khách mới. */
        updateForm("selectedDeliveryAddress", "");

        const list = await loadDeliveryAddresses({
          signal: controller.signal,
        });

        const defaultAddress = list.find((item) => item.isDefault);

        if (defaultAddress) {
          updateForm("selectedDeliveryAddress", defaultAddress.address);
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
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => {
        getItemImages(item).forEach((image) => {
          if (image?.previewUrl) {
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
          ".purchase-buy-input-has-error, .purchase-buy-upload-has-error, .purchase-buy-address-list-has-error",
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 100);
  };

  /* ================= ADDRESS ================= */

  const resetNewAddressForm = () => {
    setNewAddressSelect(INITIAL_ADDRESS_SELECT);
    setNewAddressInput("");
  };

  const updateNewAddressSelect = (field, value) => {
    setNewAddressSelect((previous) => {
      if (field === "provinceCode") {
        return {
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

    setNewAddressError("");
  };

  const buildAddressPayload = async () => {
    const detailAddress = newAddressInput.trim();

    if (!newAddressSelect.provinceCode) {
      throw new Error("Vui lòng chọn tỉnh/thành phố.");
    }

    if (!newAddressSelect.districtCode) {
      throw new Error("Vui lòng chọn quận/huyện.");
    }

    if (!newAddressSelect.wardCode) {
      throw new Error("Vui lòng chọn phường/xã.");
    }

    if (!detailAddress) {
      throw new Error("Vui lòng nhập số nhà, tên đường.");
    }

    const provinceName = getAddressOptionName(
      provinceOptions,
      newAddressSelect.provinceCode,
    );

    const districtName = getAddressOptionName(
      districtOptions,
      newAddressSelect.districtCode,
    );

    const wardName = getAddressOptionName(
      wardOptions,
      newAddressSelect.wardCode,
    );

    const addressResult = await getFullAddressByCodes({
      provinceCode: newAddressSelect.provinceCode,
      districtCode: newAddressSelect.districtCode,
      wardCode: newAddressSelect.wardCode,
      detailAddress,
    });

    const fullAddress =
      addressResult?.fullAddress ||
      [detailAddress, wardName, districtName, provinceName]
        .filter(Boolean)
        .join(", ");

    return {
      address: fullAddress,
      fullAddress,
      detailAddress,
      provinceCode: newAddressSelect.provinceCode,
      provinceName,
      districtCode: newAddressSelect.districtCode,
      districtName,
      wardCode: newAddressSelect.wardCode,
      wardName,
      ...getClientTimePayload(),
    };
  };

  const handleSaveAddress = async () => {
    if (isSubmitting || isSavingAddress) {
      return;
    }

    if (!selectedCustomerId) {
      setNewAddressError("Vui lòng chọn khách hàng trước khi thêm địa chỉ nhận hàng.");
      return;
    }

    let addressPayload;

    try {
      addressPayload = await buildAddressPayload();
    } catch (error) {
      const message = error?.message || "Vui lòng kiểm tra lại địa chỉ.";

      setNewAddressError(message);
      return;
    }

    const address = addressPayload.address.trim();

    const addressExists = addressList.some(
      (item) => item.address.trim().toLowerCase() === address.toLowerCase(),
    );

    if (addressExists) {
      setNewAddressError("Địa chỉ này đã có trong danh sách.");
      return;
    }

    try {
      setIsSavingAddress(true);
      setNewAddressError("");

      const createdResult = await createCustomerDeliveryAddressApi(
        selectedCustomerId,
        { address },
      );

      let refreshedAddresses;

      try {
        refreshedAddresses = await loadDeliveryAddresses();
      } catch {
        const createdAddress = normalizeDeliveryAddress(
          createdResult?.data || createdResult || addressPayload,
          addressList.length,
        ) || {
          id: createUniqueId(),
          apiId: "",
          ...addressPayload,
          isDefault: false,
        };

        refreshedAddresses = [...addressList, createdAddress];

        setAddressList(refreshedAddresses);
      }

      const selectedAddress =
        refreshedAddresses.find(
          (item) => item.address.trim().toLowerCase() === address.toLowerCase(),
        )?.address || address;

      updateForm("selectedDeliveryAddress", selectedAddress);

      resetNewAddressForm();
      setNewAddressError("");
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

  /* ================= ITEMS ================= */

  const handleItemChange = (itemId, field, value) => {
    setItems((previous) =>
      previous.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );

    clearItemError(itemId, field);
  };

  const handleProductLinkBlur = (item) => {
    if (item.sourceWebsite.trim() || !isValidHttpUrl(item.productLink)) {
      return;
    }

    handleItemChange(
      item.id,
      "sourceWebsite",
      getSourceWebsiteFromLink(item.productLink),
    );
  };

  const isItemLimitReached =
    hasPurchaseLimit(purchaseLimits.maxItems) && items.length >= purchaseLimits.maxItems;

  /* Chỗ còn lại cho ghi chú Sale gõ, sau khi trừ phần backend tự nối thêm. */
  const generalNoteMaxLength = getGeneralNoteMaxLength(form.optionalServices);

  const handleAddItem = () => {
    if (isSubmitting || isItemLimitReached) {
      return;
    }

    setItems((previous) =>
      hasPurchaseLimit(purchaseLimits.maxItems) && previous.length >= purchaseLimits.maxItems
        ? previous
        : [...previous, createEmptyItem()],
    );

    setFormErrors((previous) => ({ ...previous, items: "" }));
  };

  const handleDeleteItem = (itemId) => {
    if (isSubmitting) {
      return;
    }

    if (items.length <= 1) {
      AuthNotify.warning(
        "Không thể xóa",
        "Yêu cầu mua hộ phải có tối thiểu 1 sản phẩm.",
      );
      return;
    }

    const targetItem = items.find((item) => item.id === itemId);

    getItemImages(targetItem).forEach((image) => {
      if (image?.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });

    setItems((previous) => previous.filter((item) => item.id !== itemId));

    setItemErrors((previous) => {
      const nextErrors = {
        ...previous,
      };

      delete nextErrors[itemId];

      return nextErrors;
    });

    delete fileInputRefs.current[itemId];
  };

  /* ================= IMAGE ================= */

  const handleFileChange = (itemId, event) => {
    const selectedFiles = Array.from(event.target.files || []);

    event.target.value = "";

    if (!selectedFiles.length || isSubmitting) {
      return;
    }

    const currentItem = items.find((item) => item.id === itemId);
    const currentImages = getItemImages(currentItem);
    const remainingSlots = MAX_IMAGES_PER_ITEM - currentImages.length;

    if (remainingSlots <= 0) {
      AuthNotify.warning(
        "Đã đủ số ảnh",
        `Mỗi sản phẩm được tải tối đa ${MAX_IMAGES_PER_ITEM} ảnh.`,
      );
      return;
    }

    const existingIdentities = new Set(
      currentImages.map((image) => getFileIdentity(image?.fileObj)),
    );

    const acceptedFiles = [];
    const rejectedMessages = [];

    selectedFiles.forEach((file) => {
      try {
        validateProductImageFile(file);

        const identity = getFileIdentity(file);

        if (existingIdentities.has(identity)) {
          rejectedMessages.push(`Ảnh "${file.name}" đã được chọn.`);
          return;
        }

        existingIdentities.add(identity);
        acceptedFiles.push(file);
      } catch (error) {
        rejectedMessages.push(error?.message || `Ảnh "${file.name}" không hợp lệ.`);
      }
    });

    const filesToAdd = acceptedFiles.slice(0, remainingSlots);

    if (acceptedFiles.length > remainingSlots) {
      rejectedMessages.push(
        `Chỉ thêm ${remainingSlots} ảnh để không vượt quá ${MAX_IMAGES_PER_ITEM} ảnh/sản phẩm.`,
      );
    }

    if (!filesToAdd.length) {
      AuthNotify.warning(
        "Không thể thêm ảnh",
        rejectedMessages[0] || "Không có ảnh hợp lệ để thêm.",
      );
      return;
    }

    const newImages = filesToAdd.map((file) => ({
      id: createUniqueId(),
      fileObj: file,
      previewUrl: URL.createObjectURL(file),
    }));

    setItems((previous) =>
      previous.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextImages = [...getItemImages(item), ...newImages];

        return {
          ...item,
          images: nextImages,

          // Ảnh đầu tiên dùng làm ảnh đại diện cho component cũ.
          image: nextImages[0] || null,
        };
      }),
    );

    clearItemError(itemId, "image");

    AuthNotify.success(
      "Đã thêm ảnh",
      `Đã thêm ${newImages.length} ảnh sản phẩm.`,
    );

    if (rejectedMessages.length) {
      AuthNotify.warning(
        "Một số ảnh không được thêm",
        rejectedMessages.join(" "),
      );
    }
  };

  const handleRemoveImage = (
    event,
    itemId,
    imageId,
    previewUrl,
  ) => {
    event.stopPropagation();

    if (isSubmitting) {
      return;
    }

    let remainingCount = 0;

    setItems((previous) =>
      previous.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextImages = getItemImages(item).filter(
          (image) => image.id !== imageId,
        );

        remainingCount = nextImages.length;

        return {
          ...item,
          images: nextImages,
          image: nextImages[0] || null,
        };
      }),
    );

    setItemErrors((previous) => ({
      ...previous,
      [itemId]: {
        ...(previous[itemId] || {}),
        image:
          remainingCount === 0
            ? "Vui lòng tải ít nhất một ảnh sản phẩm."
            : "",
      },
    }));

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (activeLightboxImg === previewUrl) {
      setActiveLightboxImg(null);
    }
  };

  /* ================= VALIDATE & SUBMIT ================= */

  const validateForm = () => {
    const result = validateBuyOrderForm({
      form,
      items,
      purchaseLimits,
    });

    setFormErrors(result.formErrors);

    setItemErrors(result.itemErrors);

    /* Chưa chọn khách thì backend chắc chắn từ chối — chặn ngay, báo tại ô. */
    const missingCustomer = !selectedCustomer?.id;

    setCustomerError(missingCustomer ? "Vui lòng chọn khách hàng cần tạo yêu cầu." : "");

    if (missingCustomer) {
      AuthNotify.warning(
        "Chưa chọn khách hàng",
        "Yêu cầu mua hộ phải thuộc về một khách hàng có trong hệ thống.",
      );

      scrollToFirstError();

      return false;
    }

    if (!result.isValid) {
      AuthNotify.warning(
        "Thông tin chưa đầy đủ",
        "Vui lòng kiểm tra các trường được đánh dấu màu đỏ.",
      );

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

  const handleCloseConfirmation = () => {
    if (isSubmitting) {
      return;
    }

    setIsConfirming(false);

    window.setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 0);
  };

  const handleCreateBuyOrder = async () => {
    if (isSubmitting || !validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      const requestItems = [];

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];

        setSubmitMessage(
          `Đang upload ảnh sản phẩm ${index + 1}/${items.length}...`,
        );

        const productImages = getItemImages(item);
        const imageUrls = await uploadProductImages(
          productImages.map((image) => image.fileObj),
          (percent) => {
            setSubmitMessage(
              `Đang upload ${productImages.length} ảnh sản phẩm ${index + 1}/${items.length}: ${percent}%`,
            );
          },
        );

        requestItems.push({
          productLink: item.productLink.trim(),
          sourceWebsite: item.sourceWebsite.trim(),
          productType: item.productType,
          productName: item.productName.trim(),
          quantity: Number(item.quantity),
          attributes: item.attributes.trim(),
          note: item.note.trim(),
          imageUrls,
        });
      }

      setSubmitMessage("Đang gửi yêu cầu mua hộ...");

      const selectedPricingRuleIds = normalizeStringArray(
        form.optionalServices?.selectedPricingRuleIds ??
          form.optionalServices?.pricingRuleIds,
      );

      const result = await createPurchaseRequestApi({
        customerId: selectedCustomer?.id || "",
        route: form.route,
        shippingOption: form.shippingOption,
        receiverName: form.receiverName.trim(),
        receiverPhone: form.receiverPhone.trim(),
        receiverAddress: form.selectedDeliveryAddress.trim(),
        pricingRuleIds: selectedPricingRuleIds,
        requiresPacking: Boolean(form.optionalServices?.requiresPacking),
        requiresWoodenCrate: Boolean(
          form.optionalServices?.requiresWoodenCrate,
        ),
        requiresInsurance: Boolean(
          form.optionalServices?.requiresInsurance,
        ),
        generalNote: form.generalNote.trim(),
        items: requestItems,
      });

      AuthNotify.success(
        "Tạo yêu cầu thành công",
        result?.message || "Yêu cầu mua hộ đã được tiếp nhận.",
      );

      navigate("/sale/purchase-requests");
    } catch (error) {
      AuthNotify.error(
        "Tạo yêu cầu thất bại",
        getApiErrorMessage(
          error,
          "Không thể tạo yêu cầu mua hộ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSubmitting(false);

      setSubmitMessage("Đang chuẩn bị tạo yêu cầu...");
    }
  };

  if (isConfirming) {
    return (
      <ConsignmentBuyOrderConfirm
        form={form}
        customer={selectedCustomer}
        items={items}
        routeOptions={routeOptions}
        shippingOptions={shippingOptions}
        productTypeOptions={productTypeOptions}
        isSubmitting={isSubmitting}
        submitMessage={submitMessage}
        onBack={handleCloseConfirmation}
        onConfirm={handleCreateBuyOrder}
      />
    );
  }

  return (
    <div
      className={[
        "purchase-buy-order-page",
        isSubmitting && "purchase-buy-consignment-is-submitting",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="purchase-buy-consignment-layout-grid">
        <div className="purchase-buy-layout-left-fixed-sidebar">
          <div className="purchase-buy-page-header-title-box">
            <div className="purchase-buy-title-icon-orange">
              <ShoppingCartOutlined />
            </div>

            <div className="purchase-buy-title-text-group">
              <h2>MUA HỘ HÀNG HÓA</h2>
              <p>TẠO YÊU CẦU MỚI</p>
            </div>
          </div>

          <div className="purchase-buy-left-unified-wrapper-box">
            <div className="purchase-buy-left-inner-section">
              <label className="purchase-buy-field-label purchase-buy-required-label">
                KHÁCH HÀNG CỦA ĐƠN
              </label>

              <CustomerPickerField
                value={selectedCustomer?.id || ""}
                customer={selectedCustomer}
                disabled={isSubmitting}
                error={customerError}
                onSelect={(customer) => {
                  setSelectedCustomer(customer);
                  setCustomerError("");
                }}
              />

              {customerError && (
                <div className="purchase-buy-field-error-message">{customerError}</div>
              )}
            </div>

            <div className="purchase-buy-left-inner-section purchase-buy-border-top-dash">
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

              <div className="purchase-buy-route-select-helper">
                <InfoCircleOutlined />

                <span>
                  Chọn tuyến vận chuyển phù hợp với quốc gia mua hàng và địa chỉ
                  nhận hàng.
                </span>
              </div>

              <div style={{ marginTop: 16 }}>
                <SelectField
                  label="PHƯƠNG THỨC VẬN CHUYỂN"
                  value={form.shippingOption}
                  error={formErrors.shippingOption}
                  options={shippingOptions}
                  loading={isLoadingOptions}
                  disabled={isSubmitting}
                  placeholder="-- Chọn phương thức vận chuyển --"
                  onChange={(value) =>
                    updateForm("shippingOption", value)
                  }
                />
              </div>
            </div>

            <div className="purchase-buy-left-inner-section purchase-buy-border-top-dash">
              <div
                className="purchase-buy-input-field-group"
                style={{
                  marginBottom: 12,
                }}
              >
                <label className="purchase-buy-field-label purchase-buy-required-label">
                  TÊN NGƯỜI NHẬN
                </label>

                <input
                  type="text"
                  value={form.receiverName}
                  disabled={isSubmitting}
                  maxLength={PURCHASE_FIELD_MAX_LENGTH.receiverName}
                  placeholder="Nhập tên người nhận..."
                  className={getFieldClassName(
                    "purchase-buy-custom-input",
                    formErrors.receiverName,
                  )}
                  onChange={(event) =>
                    updateForm("receiverName", event.target.value)
                  }
                />

                <FieldError message={formErrors.receiverName} />
              </div>

              <div className="purchase-buy-input-field-group">
                <label className="purchase-buy-field-label purchase-buy-required-label">
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
                    "purchase-buy-custom-input",
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

            <div className="purchase-buy-left-inner-section purchase-buy-border-top-dash">
              <label className="purchase-buy-field-label">
                <EnvironmentOutlined />
                ĐỊA CHỈ ĐANG CHỌN
              </label>

              <div
                className={getFieldClassName(
                  "purchase-buy-static-display-box purchase-buy-address-received-highlight",
                  formErrors.selectedDeliveryAddress,
                )}
              >
                {form.selectedDeliveryAddress || "Chưa chọn địa chỉ"}
              </div>

              <FieldError message={formErrors.selectedDeliveryAddress} />
            </div>

            <div className="purchase-buy-left-inner-section purchase-buy-border-top-dash">
              <div className="purchase-buy-inner-section-title purchase-buy-required-label">
                CHỌN ĐỊA CHỈ NHẬN HÀNG
              </div>

              {!isAddingAddress ? (
                <>
                  <button
                    type="button"
                    className="purchase-buy-btn-add-address"
                    disabled={
                      isSubmitting ||
                      isLoadingAddresses ||
                      isSavingAddress ||
                      !selectedCustomerId
                    }
                    title={
                      selectedCustomerId
                        ? undefined
                        : "Chọn khách hàng trước để thêm địa chỉ vào sổ của khách"
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
                    <div className="purchase-buy-address-empty-message">
                      <LoadingOutlined spin />
                      <span>Đang tải danh sách địa chỉ...</span>
                    </div>
                  ) : addressList.length ? (
                    <div
                      className={[
                        "purchase-buy-address-scroll-container",
                        formErrors.selectedDeliveryAddress &&
                          "purchase-buy-address-list-has-error",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {addressList.map((addressItem, index) => {
                        const isSelected =
                          form.selectedDeliveryAddress === addressItem.address;

                        return (
                          <div
                            key={
                              addressItem.id ||
                              `${addressItem.address}-${index}`
                            }
                            role="button"
                            tabIndex={0}
                            className={[
                              "purchase-buy-address-item-clickable",
                              isSelected && "purchase-buy-is-active",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() =>
                              updateForm(
                                "selectedDeliveryAddress",
                                addressItem.address,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();

                                updateForm(
                                  "selectedDeliveryAddress",
                                  addressItem.address,
                                );
                              }
                            }}
                          >
                            <span className="purchase-buy-address-text-truncate">
                              <strong>{addressItem.address}</strong>
                            </span>

                            {addressItem.isDefault && (
                              <span className="purchase-buy-address-default-badge">
                                Mặc định
                              </span>
                            )}

                            {isSelected && (
                              <CheckOutlined className="purchase-buy-check-active-icon" />
                            )}

                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className={[
                        "purchase-buy-address-empty-message",
                        formErrors.selectedDeliveryAddress &&
                          "purchase-buy-address-list-has-error",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {selectedCustomerId
                        ? "Khách này chưa có địa chỉ nhận hàng nào trong sổ."
                        : "Chọn khách hàng để xem sổ địa chỉ nhận hàng của khách."}
                    </div>
                  )}
                </>
              ) : (
                <div className="purchase-buy-add-address-inline-form">
                  <label className="purchase-buy-field-label purchase-buy-required-label">
                    ĐỊA CHỈ NHẬN HÀNG MỚI
                  </label>

                  <div className="purchase-buy-address-api-grid">
                    <div className="purchase-buy-input-field-group">
                      <label className="purchase-buy-field-label purchase-buy-required-label">
                        TỈNH / THÀNH PHỐ
                      </label>

                      <AddressSelect
                        value={newAddressSelect.provinceCode}
                        options={addressLists.provinces.options}
                        loading={addressLists.provinces.loading}
                        loadError={addressLists.provinces.error}
                        onRetry={addressLists.provinces.retry}
                        disabled={isSubmitting || isSavingAddress}
                        placeholder="Chọn tỉnh/thành"
                        invalid={Boolean(newAddressError && !newAddressSelect.provinceCode)}
                        errorClassName="purchase-buy-input-has-error"
                        ariaLabel="TỈNH / THÀNH PHỐ"
                        onChange={(value) => updateNewAddressSelect("provinceCode", value)}
                      />
                    </div>

                    <div className="purchase-buy-input-field-group">
                      <label className="purchase-buy-field-label purchase-buy-required-label">
                        QUẬN / HUYỆN
                      </label>

                      <AddressSelect
                        value={newAddressSelect.districtCode}
                        options={addressLists.districts.options}
                        loading={addressLists.districts.loading}
                        loadError={addressLists.districts.error}
                        onRetry={addressLists.districts.retry}
                        disabled={isSubmitting || isSavingAddress || !newAddressSelect.provinceCode}
                        placeholder="Chọn quận/huyện"
                        invalid={Boolean(newAddressError && newAddressSelect.provinceCode && !newAddressSelect.districtCode)}
                        errorClassName="purchase-buy-input-has-error"
                        ariaLabel="QUẬN / HUYỆN"
                        onChange={(value) => updateNewAddressSelect("districtCode", value)}
                      />
                    </div>

                    <div className="purchase-buy-input-field-group">
                      <label className="purchase-buy-field-label purchase-buy-required-label">
                        PHƯỜNG / XÃ
                      </label>

                      <AddressSelect
                        value={newAddressSelect.wardCode}
                        options={addressLists.wards.options}
                        loading={addressLists.wards.loading}
                        loadError={addressLists.wards.error}
                        onRetry={addressLists.wards.retry}
                        disabled={isSubmitting || isSavingAddress || !newAddressSelect.districtCode}
                        placeholder="Chọn phường/xã"
                        invalid={Boolean(newAddressError && newAddressSelect.districtCode && !newAddressSelect.wardCode)}
                        errorClassName="purchase-buy-input-has-error"
                        ariaLabel="PHƯỜNG / XÃ"
                        onChange={(value) => updateNewAddressSelect("wardCode", value)}
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    value={newAddressInput}
                    disabled={isSubmitting || isSavingAddress}
                    placeholder="Số nhà, tên đường..."
                    className={getFieldClassName(
                      "purchase-buy-custom-input purchase-buy-small-input",
                      newAddressError,
                    )}
                    onChange={(event) => {
                      setNewAddressInput(event.target.value);
                      setNewAddressError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !isSavingAddress) {
                        event.preventDefault();

                        handleSaveAddress();
                      }
                    }}
                  />

                  <div className="purchase-buy-address-preview-box">
                    <span>Địa chỉ sẽ lưu</span>
                    <strong>
                      {[
                        newAddressInput.trim(),
                        getAddressOptionName(
                          wardOptions,
                          newAddressSelect.wardCode,
                        ),
                        getAddressOptionName(
                          districtOptions,
                          newAddressSelect.districtCode,
                        ),
                        getAddressOptionName(
                          provinceOptions,
                          newAddressSelect.provinceCode,
                        ),
                      ]
                        .filter(Boolean)
                        .join(", ") || "Chưa đủ thông tin địa chỉ"}
                    </strong>
                  </div>

                  <FieldError message={newAddressError} />

                  <div className="purchase-buy-inline-form-actions">
                    <button
                      type="button"
                      className="purchase-buy-btn-inline-cancel"
                      disabled={isSubmitting || isSavingAddress}
                      onClick={() => {
                        setIsAddingAddress(false);
                        resetNewAddressForm();
                        setNewAddressError("");
                      }}
                    >
                      Hủy
                    </button>

                    <button
                      type="button"
                      className="purchase-buy-btn-inline-save"
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

        <div className="purchase-buy-layout-right-scrollable-form">
          <div className="purchase-buy-scrollable-content-wrapper">
            {items.map((item, index) => {
              const errors = itemErrors[item.id] || {};
              const itemImages = getItemImages(item);

              return (
                <section key={item.id} className="purchase-buy-form-main-card">
                  <div className="purchase-buy-form-step-header">
                    <div className="purchase-buy-step-header-left">
                      <div className="purchase-buy-step-number-circle">
                        {index + 1}
                      </div>

                      <h3>THÔNG TIN SẢN PHẨM {index + 1}</h3>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        className="purchase-buy-btn-delete-package"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <DeleteOutlined />
                        Xóa sản phẩm
                      </button>
                    )}
                  </div>

                  <div className="purchase-buy-input-field-group purchase-buy-product-link-field">
                    <label className="purchase-buy-field-label purchase-buy-required-label">
                      <LinkOutlined />
                      LINK SẢN PHẨM
                    </label>

                    <input
                      type="url"
                      value={item.productLink}
                      disabled={isSubmitting}
                      maxLength={PURCHASE_FIELD_MAX_LENGTH.productLink}
                      placeholder="https://example.com/san-pham..."
                      className={getFieldClassName(
                        "purchase-buy-custom-input",
                        errors.productLink,
                      )}
                      onChange={(event) =>
                        handleItemChange(
                          item.id,
                          "productLink",
                          event.target.value,
                        )
                      }
                      onBlur={() => handleProductLinkBlur(item)}
                    />

                    <FieldError message={errors.productLink} />
                  </div>

                  <div className="purchase-buy-form-row-2col purchase-buy-product-basic-grid">
                    <div className="purchase-buy-input-field-group">
                      <div className="purchase-buy-field-label-row">
                        <label className="purchase-buy-field-label purchase-buy-required-label">
                          WEBSITE NGUỒN
                        </label>

                        <Tooltip
                          title="Nhập tên website bán sản phẩm, ví dụ: amazon.com, shopee.vn hoặc taobao.com."
                          placement="top"
                        >
                          <InfoCircleOutlined
                            style={{
                              color: "#1890ff",
                              cursor: "pointer",
                              fontSize: "14px",
                              flexShrink: 0,
                            }}
                          />
                        </Tooltip>
                      </div>

                      <input
                        type="text"
                        value={item.sourceWebsite}
                        disabled={isSubmitting}
                        maxLength={PURCHASE_FIELD_MAX_LENGTH.sourceWebsite}
                        placeholder="Ví dụ: amazon.com"
                        className={getFieldClassName(
                          "purchase-buy-custom-input",
                          errors.sourceWebsite,
                        )}
                        onChange={(event) =>
                          handleItemChange(
                            item.id,
                            "sourceWebsite",
                            event.target.value,
                          )
                        }
                      />

                      <FieldError message={errors.sourceWebsite} />
                    </div>

                    <div className="purchase-buy-input-field-group">
                      <label className="purchase-buy-field-label purchase-buy-required-label">
                        LOẠI SẢN PHẨM
                      </label>

                      <select
                        value={item.productType}
                        disabled={isSubmitting || isLoadingOptions}
                        className={getFieldClassName(
                          "purchase-buy-custom-select",
                          errors.productType,
                        )}
                        onChange={(event) =>
                          handleItemChange(
                            item.id,
                            "productType",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          {isLoadingOptions
                            ? "Đang tải loại sản phẩm..."
                            : "-- Chọn loại sản phẩm --"}
                        </option>

                        {productTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>

                      <FieldError message={errors.productType} />
                    </div>
                  </div>

                  <div className="purchase-buy-form-row-2col">
                    <div className="purchase-buy-input-field-group">
                      <label className="purchase-buy-field-label purchase-buy-required-label">
                        TÊN SẢN PHẨM
                      </label>

                      <input
                        type="text"
                        value={item.productName}
                        disabled={isSubmitting}
                        maxLength={PURCHASE_FIELD_MAX_LENGTH.productName}
                        placeholder="Nhập tên sản phẩm..."
                        className={getFieldClassName(
                          "purchase-buy-custom-input",
                          errors.productName,
                        )}
                        onChange={(event) =>
                          handleItemChange(
                            item.id,
                            "productName",
                            event.target.value,
                          )
                        }
                      />

                      <FieldError message={errors.productName} />
                    </div>

                    <div className="purchase-buy-input-field-group">
                      <label className="purchase-buy-field-label purchase-buy-required-label">
                        SỐ LƯỢNG
                      </label>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity}
                        disabled={isSubmitting}
                        maxLength={
                          hasPurchaseLimit(purchaseLimits.maxItemQuantity)
                            ? String(purchaseLimits.maxItemQuantity).length
                            : 9
                        }
                        placeholder={
                          hasPurchaseLimit(purchaseLimits.maxItemQuantity)
                            ? `Từ 1 đến ${purchaseLimits.maxItemQuantity}`
                            : "VD: 1"
                        }
                        className={getFieldClassName(
                          "purchase-buy-custom-input",
                          errors.quantity,
                        )}
                        onKeyDown={preventInvalidNumberKeys}
                        onChange={(event) =>
                          handleItemChange(
                            item.id,
                            "quantity",
                            sanitizeInteger(event.target.value),
                          )
                        }
                      />

                      <FieldError message={errors.quantity} />
                    </div>
                  </div>

                  <div className="purchase-buy-input-field-group purchase-buy-product-attributes-field">
                    <div className="purchase-buy-field-label-row">
                      <label className="purchase-buy-field-label purchase-buy-required-label">
                        THUỘC TÍNH SẢN PHẨM
                      </label>

                      <Tooltip
                        title="Nhập đặc điểm cần mua chính xác như màu sắc, kích thước, phiên bản hoặc dung lượng."
                        placement="top"
                      >
                        <InfoCircleOutlined
                          role="button"
                          tabIndex={0}
                          aria-label="Hướng dẫn nhập thuộc tính sản phẩm"
                          style={{
                            color: "#1890ff",
                            cursor: "pointer",
                            fontSize: "14px",
                            flexShrink: 0,
                            marginLeft: "6px",
                          }}
                        />
                      </Tooltip>
                    </div>

                    <input
                      type="text"
                      value={item.attributes}
                      disabled={isSubmitting}
                      maxLength={PURCHASE_FIELD_MAX_LENGTH.attributes}
                      placeholder="Ví dụ: Màu đen, Size M, phiên bản 256GB..."
                      className={getFieldClassName(
                        "purchase-buy-custom-input",
                        errors.attributes,
                      )}
                      onChange={(event) =>
                        handleItemChange(
                          item.id,
                          "attributes",
                          event.target.value,
                        )
                      }
                    />

                    <FieldError message={errors.attributes} />
                  </div>

                  <div className="purchase-buy-input-field-group">
                    <label className="purchase-buy-field-label">
                      GHI CHÚ SẢN PHẨM
                    </label>

                    <textarea
                      rows={3}
                      value={item.note}
                      disabled={isSubmitting}
                      maxLength={PURCHASE_FIELD_MAX_LENGTH.note}
                      placeholder="Nhập yêu cầu riêng cho sản phẩm..."
                      className={getFieldClassName(
                        "purchase-buy-custom-textarea",
                        errors.note,
                      )}
                      onChange={(event) =>
                        handleItemChange(item.id, "note", event.target.value)
                      }
                    />

                    <div className="purchase-buy-sub-helper-text">
                      {item.note.length}/{PURCHASE_FIELD_MAX_LENGTH.note} ký tự
                    </div>

                    <FieldError message={errors.note} />
                  </div>

                  <div className="purchase-buy-input-field-group purchase-buy-package-image-section">
                    <label className="purchase-buy-field-label purchase-buy-required-label">
                      ẢNH SẢN PHẨM
                    </label>

                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      disabled={
                        isSubmitting ||
                        itemImages.length >= MAX_IMAGES_PER_ITEM
                      }
                      style={{
                        display: "none",
                      }}
                      ref={(element) => {
                        fileInputRefs.current[item.id] = element;
                      }}
                      onChange={(event) => handleFileChange(item.id, event)}
                    />

                    {itemImages.length === 0 ? (
                      <div
                        role="button"
                        tabIndex={0}
                        className={[
                          "purchase-buy-upload-dropzone-box-clickable",
                          errors.image && "purchase-buy-upload-has-error",
                          isSubmitting && "purchase-buy-upload-is-disabled",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            fileInputRefs.current[item.id]?.click();
                          }
                        }}
                      >
                        <CloudUploadOutlined className="purchase-buy-upload-big-icon" />

                        <span className="purchase-buy-upload-main-text">
                          Bấm để chọn nhiều ảnh sản phẩm
                        </span>

                        <span className="purchase-buy-upload-sub-text">
                          JPG, PNG, WEBP — tối đa 5MB/ảnh — tối đa {MAX_IMAGES_PER_ITEM} ảnh
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="purchase-buy-image-previews-grid purchase-buy-animation-fade-in">
                          {itemImages.map((image, imageIndex) => (
                            <div
                              key={image.id}
                              className="purchase-buy-preview-image-item"
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setActiveLightboxImg(image.previewUrl)
                              }
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  setActiveLightboxImg(image.previewUrl);
                                }
                              }}
                            >
                              <img
                                src={image.previewUrl}
                                alt={`${item.productName || `Sản phẩm ${index + 1}`} - ảnh ${imageIndex + 1}`}
                              />

                              <span
                                style={{
                                  position: "absolute",
                                  left: 8,
                                  bottom: 8,
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  background: "rgba(15, 23, 42, 0.72)",
                                  color: "#fff",
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {imageIndex + 1}
                              </span>

                              <button
                                type="button"
                                className="purchase-buy-btn-remove-preview-img"
                                disabled={isSubmitting}
                                aria-label={`Xóa ảnh ${imageIndex + 1}`}
                                onClick={(event) =>
                                  handleRemoveImage(
                                    event,
                                    item.id,
                                    image.id,
                                    image.previewUrl,
                                  )
                                }
                              >
                                <CloseOutlined />
                              </button>
                            </div>
                          ))}

                          {itemImages.length < MAX_IMAGES_PER_ITEM && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() =>
                                fileInputRefs.current[item.id]?.click()
                              }
                              style={{
                                minHeight: 132,
                                border: "1.5px dashed #94a3b8",
                                borderRadius: 14,
                                background: "#f8fafc",
                                color: "#475569",
                                cursor: isSubmitting ? "not-allowed" : "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                fontWeight: 700,
                              }}
                            >
                              <PlusOutlined />
                              Thêm ảnh
                            </button>
                          )}
                        </div>

                        <div className="purchase-buy-sub-helper-text">
                          Đã chọn {itemImages.length}/{MAX_IMAGES_PER_ITEM} ảnh.
                          Có thể chọn nhiều ảnh cùng lúc.
                        </div>
                      </>
                    )}

                    <FieldError message={errors.image} />
                  </div>
                </section>
              );
            })}

            <button
              type="button"
              disabled={isSubmitting || isItemLimitReached}
              className={[
                "purchase-buy-add-package-dashed-trigger",
                (isSubmitting || isItemLimitReached) &&
                  "purchase-buy-add-package-disabled",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={handleAddItem}
            >
              <PlusCircleOutlined className="purchase-buy-plus-dashed-icon" />
              <span>
                THÊM SẢN PHẨM MUA HỘ ({items.length}
                {hasPurchaseLimit(purchaseLimits.maxItems) ? `/${purchaseLimits.maxItems}` : ""})
              </span>
            </button>

            <FieldError
              message={
                formErrors.items ||
                (isItemLimitReached ? maxPurchaseItemsMessage : "")
              }
            />
            <div
              className="purchase-buy-form-main-card purchase-buy-general-note-card"
              style={{
                marginTop: "1.25rem",
                marginBottom: "1.5rem",
              }}
            >
              <div className="purchase-buy-form-step-header">
                <div className="purchase-buy-step-header-left">
                  <div className="purchase-buy-step-number-circle">
                    <InfoCircleOutlined />
                  </div>

                  <h3>GHI CHÚ CHUNG VÀ DỊCH VỤ BỔ SUNG</h3>
                </div>
              </div>

              <div className="purchase-buy-general-note-section">
                <FieldLabelTooltip
                  label="CHỌN DỊCH VỤ BỔ SUNG"
                  tooltip="Các dịch vụ này không bắt buộc. Chi phí chính thức sẽ được kiểm tra và xác nhận trong báo giá."
                />

                <PackageOptionalServicesS1
                  value={form.optionalServices}
                  packages={items}
                  disabled={isSubmitting}
                  onChange={handleOptionalServicesChange}
                  triggerTitle="Dịch vụ bổ sung cho đơn mua hộ"
                  modalTitle="Lựa chọn dịch vụ cho đơn mua hộ"
                  modalDescription="Giữ nguyên toàn bộ phí từ bảng giá hệ thống. Riêng đóng thùng gỗ được tính theo số dòng sản phẩm: mỗi sản phẩm là một kiện, không nhân theo số lượng."
                />
              </div>

              <div className="purchase-buy-general-note-divider" />

              <div className="purchase-buy-input-field-group">
                <FieldLabelTooltip
                  label="GHI CHÚ ĐƠN HÀNG"
                  tooltip="Nhập các yêu cầu chung cho đơn mua hộ như thuộc tính cần lưu ý, cách đóng gói, yêu cầu bảo quản hoặc thông tin cần nhân viên xử lý biết."
                />

                <textarea
                  rows={4}
                  value={form.generalNote}
                  disabled={isSubmitting}
                  maxLength={generalNoteMaxLength}
                  placeholder="Nhập ghi chú chung, yêu cầu đóng gói hoặc thông tin cần lưu ý cho toàn bộ yêu cầu mua hộ..."
                  className={getFieldClassName(
                    "purchase-buy-custom-textarea",
                    formErrors.generalNote,
                  )}
                  onChange={(event) =>
                    updateForm("generalNote", event.target.value)
                  }
                />

                <div className="purchase-buy-textarea-meta">
                  <span>
                    Không bắt buộc. Hệ thống tự ghi thêm các dịch vụ đã chọn và
                    câu &quot;Đơn do nhân viên lên hộ khách&quot; vào cuối ghi chú.
                  </span>

                  <strong>
                    {form.generalNote.length}/{generalNoteMaxLength} ký tự
                  </strong>
                </div>

                <FieldError message={formErrors.generalNote} />
              </div>
            </div>

            <div className="purchase-buy-sticky-action-notice-bar">
              <div className="purchase-buy-notice-left-message">
                <InfoCircleOutlined className="purchase-buy-info-notice-icon" />

                <p>
                  <strong>LƯU Ý:</strong> Việt Nam Logictic sẽ kiểm tra link,
                  thuộc tính và số lượng trước khi tiến hành báo giá.
                </p>
              </div>

              <button
                type="button"
                className="purchase-buy-btn-final-submit-order"
                disabled={isSubmitting}
                onClick={handleOpenConfirmation}
              >
                {isSubmitting ? (
                  <>
                    <LoadingOutlined spin />
                    ĐANG TẠO YÊU CẦU...
                  </>
                ) : (
                  <>
                    <CheckOutlined />
                    XÁC NHẬN YÊU CẦU MUA HỘ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isSubmitting && (
        <div
          className="purchase-buy-create-order-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="purchase-buy-create-order-loading-card">
            <div className="purchase-buy-create-order-loading-icon">
              <LoadingOutlined spin />
            </div>

            <h3>ĐANG TẠO YÊU CẦU MUA HỘ</h3>

            <p>{submitMessage}</p>

            <div className="purchase-buy-create-order-loading-bar">
              <span />
            </div>

            <small>Vui lòng không đóng hoặc tải lại trang.</small>
          </div>
        </div>
      )}

      {activeLightboxImg && (
        <div
          className="purchase-buy-lightbox-overlay-modal"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div
            className="purchase-buy-lightbox-content-box purchase-buy-animate-zoom-in"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={activeLightboxImg}
              alt="Phóng to"
              className="purchase-buy-lightbox-main-img"
            />
          </div>

          <span className="purchase-buy-lightbox-hint-text">
            Bấm vào vùng trống để đóng
          </span>
        </div>
      )}
    </div>
  );
}
