import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

/* =========================================================
   CONSTANTS
========================================================= */

export const PURCHASE_REQUEST_STATUS = {
  PENDING_REVIEW: "PENDING_REVIEW",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  QUOTATION_SENT: "QUOTATION_SENT",
  WAITING_DEPOSIT: "WAITING_DEPOSIT",
  DEPOSIT_PAID: "DEPOSIT_PAID",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const PURCHASE_SHIPPING_OPTION = {
  STANDARD: "STANDARD",
  EXPRESS: "EXPRESS",
  ECONOMY: "ECONOMY",
};

/* =========================================================
   RESPONSE HELPER
========================================================= */

const getResponseData = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    null
  );
};

/* =========================================================
   TOKEN HELPER
========================================================= */

const getAccessToken = () => {
  const token =
    sessionStorage.getItem(
      "accessToken"
    );

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

const getAuthHeaders = () => {
  return {
    Accept: "*/*",
    Authorization: `Bearer ${getAccessToken()}`,
  };
};

/* =========================================================
   PARAMS HELPER
========================================================= */

const removeEmptyParams = (
  params = {}
) => {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
};

const normalizePositiveInteger = (
  value,
  fallback
) => {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return Math.trunc(number);
};

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeUpperText = (
  value
) => {
  return normalizeText(value)
    .toUpperCase();
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuidArray = (value, fieldName) => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .map((id) => {
          if (!UUID_PATTERN.test(id)) {
            throw new Error(`${fieldName} không đúng định dạng UUID.`);
          }
          return id;
        })
    )
  );
};

const normalizePurchaseRequestItemPayload = (item = {}, index = 0) => {
  const productLink = normalizeText(item?.productLink);
  const productType = normalizeText(item?.productType);
  const quantity = Math.trunc(Number(item?.quantity));

  if (!productLink) {
    throw new Error(`Sản phẩm ${index + 1}: vui lòng nhập liên kết sản phẩm.`);
  }
  if (!productType) {
    throw new Error(`Sản phẩm ${index + 1}: vui lòng chọn loại sản phẩm.`);
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 2147483647) {
    throw new Error(`Sản phẩm ${index + 1}: số lượng phải từ 1 đến 2147483647.`);
  }

  return {
    productLink,
    sourceWebsite: normalizeText(item?.sourceWebsite) || null,
    productType,
    productName: normalizeText(item?.productName) || null,
    quantity,
    attributes: normalizeText(item?.attributes) || null,
    note: normalizeText(item?.note) || null,
    imageUrls: Array.from(
      new Set(
        (Array.isArray(item?.imageUrls) ? item.imageUrls : [])
          .map((url) => normalizeText(url))
          .filter(Boolean)
      )
    ),
  };
};

export const normalizeCreatePurchaseRequestPayload = (payload = {}) => {
  const route = normalizeText(payload?.route);
  const shippingOption = normalizeText(payload?.shippingOption);
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizePurchaseRequestItemPayload)
    : [];

  if (!route) throw new Error("Vui lòng chọn tuyến hàng.");
  if (!shippingOption) throw new Error("Vui lòng chọn phương thức vận chuyển.");
  if (!items.length) throw new Error("Vui lòng thêm ít nhất một sản phẩm.");

  const receiverPhone = normalizeText(payload?.receiverPhone);
  if (receiverPhone && !/^0\d{9}$/.test(receiverPhone)) {
    throw new Error("Số điện thoại người nhận phải bắt đầu bằng 0 và gồm đúng 10 chữ số.");
  }

  return {
    route,
    shippingOption,
    receiverName: normalizeText(payload?.receiverName) || null,
    receiverPhone: receiverPhone || null,
    receiverAddress: normalizeText(payload?.receiverAddress) || null,
    pricingRuleIds: normalizeUuidArray(payload?.pricingRuleIds, "pricingRuleIds"),
    requiresPacking: Boolean(payload?.requiresPacking),
    requiresWoodenCrate: Boolean(payload?.requiresWoodenCrate),
    requiresInsurance: Boolean(payload?.requiresInsurance),
    generalNote: normalizeText(payload?.generalNote) || null,
    items,
  };
};

export const createPurchaseRequestApi = async (payload = {}) => {
  const requestBody = normalizeCreatePurchaseRequestPayload(payload);
  const response = await axiosInstance.post(
    API_ENDPOINTS.purchaseRequests.list,
    requestBody,
    {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    }
  );

  return getResponseData(response);
};

const normalizeNonNegativeNumber = (
  value,
  fieldLabel,
  fallback = 0
) => {
  const normalizedValue =
    value === undefined ||
      value === null ||
      value === ""
      ? fallback
      : Number(value);

  if (
    !Number.isFinite(
      normalizedValue
    ) ||
    normalizedValue < 0
  ) {
    throw new Error(
      `${fieldLabel} phải là số lớn hơn hoặc bằng 0.`
    );
  }

  return normalizedValue;
};

/* =========================================================
   ERROR HELPER
========================================================= */

const getApiErrorMessage = (
  error,
  fallbackMessage
) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.title ||
    error?.message ||
    fallbackMessage
  );
};

/* =========================================================
   NORMALIZE LIST ITEM
========================================================= */

const normalizePurchaseRequestListItem = (item = {}) => {
  return {
    ...item,
    purchaseRequestId: item?.purchaseRequestId ?? item?.id ?? "",

    purchaseCode: item?.purchaseCode ?? item?.code ?? "",

    customerId: item?.customerId ?? "",

    route: item?.route ?? "",

    shippingOption: item?.shippingOption ?? null,

    receiverName: item?.receiverName ?? "",

    itemCount:
      Number(item?.itemCount) ||
      (Array.isArray(item?.items) ? item.items.length : 0),

    totalQuantity: Number(item?.totalQuantity) || 0,

    status: item?.status ?? "",

    generalNote: item?.generalNote ?? "",

    createdAt: item?.createdAt ?? null,
    quotationCreatedAt: item?.quotationCreatedAt ?? null,
    statusUpdatedAt: item?.statusUpdatedAt ?? null,

    items: Array.isArray(item?.items)
      ? item.items.map((purchaseItem = {}) => ({
        ...purchaseItem,
        productName: purchaseItem?.productName ?? "",

        quantity: Number(purchaseItem?.quantity) || 0,
      }))
      : [],
  };
};

/* =========================================================
   NORMALIZE LIST RESPONSE
========================================================= */

const normalizePurchaseRequestPage =
  (
    data = {},
    fallbackParams = {}
  ) => {
    const items =
      Array.isArray(data?.items)
        ? data.items.map(
          normalizePurchaseRequestListItem
        )
        : [];

    const pageNumber =
      normalizePositiveInteger(
        data?.pageNumber,
        normalizePositiveInteger(
          fallbackParams?.pageNumber,
          1
        )
      );

    const pageSize =
      normalizePositiveInteger(
        data?.pageSize,
        normalizePositiveInteger(
          fallbackParams?.pageSize,
          10
        )
      );

    const totalCount = Math.max(
      0,
      Number(data?.totalCount) ||
      items.length
    );

    const totalPages = Math.max(
      1,
      normalizePositiveInteger(
        data?.totalPages,
        Math.ceil(
          totalCount / pageSize
        ) || 1
      )
    );

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
    };
  };

/* =========================================================
   NORMALIZE DETAIL ITEM
========================================================= */

const normalizePurchaseRequestItem =
  (item = {}) => {
    return {
      itemId:
        item?.itemId ?? "",

      productLink:
        item?.productLink ?? "",

      sourceWebsite:
        item?.sourceWebsite ?? "",

      productType:
        item?.productType ?? "",

      productName:
        item?.productName ?? "",

      quantity:
        Number(item?.quantity) || 0,

      attributes:
        item?.attributes ?? "",

      note:
        item?.note ?? "",

      imageUrls:
        Array.isArray(
          item?.imageUrls
        )
          ? item.imageUrls
            .map(normalizeText)
            .filter(Boolean)
          : [],
    };
  };

/* =========================================================
   NORMALIZE DETAIL RESPONSE
========================================================= */

const normalizePurchaseRequestDetail =
  (data = {}) => {
    return {
      purchaseRequestId:
        data?.purchaseRequestId ?? "",

      purchaseCode:
        data?.purchaseCode ?? "",

      customerId:
        data?.customerId ?? "",

      customerName:
        data?.customerName ?? "",

      createdByName:
        data?.createdByName ?? "",

      route:
        data?.route ?? "",

      shippingOption:
        data?.shippingOption ?? null,

      receiverName:
        data?.receiverName ?? "",

      receiverPhone:
        data?.receiverPhone ?? "",

      receiverAddress:
        data?.receiverAddress ?? "",

      requiresPacking:
        Boolean(
          data?.requiresPacking
        ),

      requiresWoodenCrate:
        Boolean(
          data?.requiresWoodenCrate
        ),

      requiresInsurance:
        Boolean(
          data?.requiresInsurance
        ),

      pricingRuleIds:
        Array.isArray(
          data?.pricingRuleIds
        )
          ? data.pricingRuleIds
            .map(normalizeText)
            .filter(Boolean)
          : [],

      generalNote:
        data?.generalNote ?? "",

      status:
        data?.status ?? "",

      reason:
        data?.reason ?? null,

      createdAt:
        data?.createdAt ?? null,
      quotationCreatedAt:
        data?.quotationCreatedAt ?? null,
      statusUpdatedAt:
        data?.statusUpdatedAt ?? null,

      totalQuantity:
        Number(
          data?.totalQuantity
        ) || 0,

      items:
        Array.isArray(data?.items)
          ? data.items.map(
            normalizePurchaseRequestItem
          )
          : [],

      quotation:
        data?.quotation ?? null,
    };
  };

/* =========================================================
   NORMALIZE CREATE QUOTATION PAYLOAD
========================================================= */

const normalizeQuotationItem = (
  item = {},
  index = 0
) => {
  const purchaseRequestItemId =
    normalizeText(
      item?.purchaseRequestItemId ??
      item?.itemId
    );

  if (!purchaseRequestItemId) {
    throw new Error(
      `Sản phẩm thứ ${index + 1} chưa có purchaseRequestItemId.`
    );
  }

  return {
    purchaseRequestItemId,

    unitPrice:
      normalizeNonNegativeNumber(
        item?.unitPrice,
        `Đơn giá sản phẩm thứ ${index + 1}`
      ),
  };
};

const normalizeQuotationAdditionalFee =
  (
    fee = {},
    index = 0
  ) => {
    const pricingRuleId =
      normalizeText(
        fee?.pricingRuleId ??
        fee?.id
      );

    if (!pricingRuleId) {
      throw new Error(
        `Phụ phí thứ ${index + 1} chưa có pricingRuleId.`
      );
    }

    return {
      pricingRuleId,

      feeName:
        normalizeText(
          fee?.feeName ??
          fee?.ruleName
        ),

      feeType:
        normalizeText(
          fee?.feeType ??
          fee?.ruleType
        ),

      calculationType:
        normalizeUpperText(
          fee?.calculationType
        ),

      value:
        normalizeNonNegativeNumber(
          fee?.value,
          `Giá trị cấu hình phụ phí thứ ${index + 1}`
        ),

      amount:
        normalizeNonNegativeNumber(
          fee?.amount,
          `Số tiền phụ phí thứ ${index + 1}`
        ),

      note:
        normalizeText(
          fee?.note
        ),
    };
  };

const normalizeCreateQuotationPayload =
  (payload = {}) => {
    const items =
      Array.isArray(payload?.items)
        ? payload.items
        : [];

    if (items.length === 0) {
      throw new Error(
        "Báo giá phải có ít nhất một sản phẩm."
      );
    }

    const additionalFees =
      Array.isArray(
        payload?.additionalFees
      )
        ? payload.additionalFees
        : [];

    return {
      purchaseFee:
        normalizeNonNegativeNumber(
          payload?.purchaseFee,
          "Phí mua hộ"
        ),

      shippingFee:
        normalizeNonNegativeNumber(
          payload?.shippingFee,
          "Phí vận chuyển"
        ),

      note:
        normalizeText(
          payload?.note
        ),

      items:
        items.map(
          normalizeQuotationItem
        ),

      additionalFees:
        additionalFees.map(
          normalizeQuotationAdditionalFee
        ),
    };
  };

/* =========================================================
   VALIDATE ID
========================================================= */

const validatePurchaseRequestId =
  (purchaseRequestId) => {
    const normalizedId =
      normalizeText(
        purchaseRequestId
      );

    if (!normalizedId) {
      throw new Error(
        "Không tìm thấy purchaseRequestId."
      );
    }

    return normalizedId;
  };

/* =========================================================
   GET PURCHASE REQUEST LIST
   GET /api/purchase-requests
========================================================= */

/**
 * @param {Object} filters
 * @param {number} filters.pageNumber
 * @param {number} filters.pageSize
 * @param {string} filters.status
 * @param {string} filters.search
 * @param {string} filters.customerId
 * @param {string} filters.route
 * @param {string} filters.shippingOption
 * @param {string} filters.fromDate
 * @param {string} filters.toDate
 */
export const getPurchaseRequestsApi =
  async (filters = {}) => {
    const searchText =
      normalizeText(
        filters?.search ??
        filters?.searchKeyword ??
        filters?.keyword
      ) || undefined;

    const params =
      removeEmptyParams({
        pageNumber:
          normalizePositiveInteger(
            filters?.pageNumber,
            1
          ),

        pageSize:
          normalizePositiveInteger(
            filters?.pageSize,
            10
          ),

        status:
          filters?.status
            ? normalizeUpperText(
              filters.status
            )
            : undefined,

        searchKeyword: searchText,
        search: searchText,

        customerId:
          normalizeText(
            filters?.customerId
          ) || undefined,

        route:
          normalizeText(
            filters?.route
          ) || undefined,

        shippingOption:
          filters?.shippingOption
            ? normalizeUpperText(
              filters.shippingOption
            )
            : undefined,

        fromDate:
          normalizeText(
            filters?.fromDate
          ) || undefined,

        toDate:
          normalizeText(
            filters?.toDate
          ) || undefined,
      });

    try {
      const response =
        await axiosInstance.get(
          API_ENDPOINTS.purchaseRequests.list,
          {
            params,
            headers:
              getAuthHeaders(),
          }
        );

      const data =
        getResponseData(response);

      return normalizePurchaseRequestPage(
        data,
        params
      );
    } catch (error) {
      console.error(
        "GET PURCHASE REQUESTS ERROR:",
        error
      );

      throw new Error(
        getApiErrorMessage(
          error,
          "Không thể lấy danh sách yêu cầu mua hộ."
        ),
        { cause: error }
      );
    }
  };

/* =========================================================
   GET PURCHASE REQUEST DETAIL
   GET /api/purchase-requests/{purchaseRequestId}
========================================================= */

export const getPurchaseRequestDetailApi =
  async (purchaseRequestId) => {
    const normalizedId =
      validatePurchaseRequestId(
        purchaseRequestId
      );

    try {
      const response =
        await axiosInstance.get(
          API_ENDPOINTS.purchaseRequests.detail(normalizedId),
          {
            headers:
              getAuthHeaders(),
          }
        );

      const data =
        getResponseData(response);

      return normalizePurchaseRequestDetail(
        data
      );
    } catch (error) {
      console.error(
        "GET PURCHASE REQUEST DETAIL ERROR:",
        error
      );

      throw new Error(
        getApiErrorMessage(
          error,
          "Không thể lấy chi tiết yêu cầu mua hộ."
        ),
        { cause: error }
      );
    }
  };

/* =========================================================
   CREATE PURCHASE REQUEST QUOTATION
   POST /api/purchase-requests/{purchaseRequestId}/quotation
========================================================= */

/**
 * Tạo báo giá cho yêu cầu mua hộ.
 *
 * @param {string} purchaseRequestId
 * @param {Object} payload
 * @param {number} payload.purchaseFee
 * @param {number} payload.shippingFee
 * @param {string} payload.note
 * @param {Array} payload.items
 * @param {Array} payload.additionalFees
 */
export const createPurchaseRequestQuotationApi =
  async (
    purchaseRequestId,
    payload = {}
  ) => {
    const normalizedId =
      validatePurchaseRequestId(
        purchaseRequestId
      );

    const requestBody =
      normalizeCreateQuotationPayload(
        payload
      );

    try {
      const response =
        await axiosInstance.post(
          API_ENDPOINTS.purchaseRequests.quotation(normalizedId),
          requestBody,
          {
            headers: {
              ...getAuthHeaders(),

              "Content-Type":
                "application/json",
            },
          }
        );

      return getResponseData(
        response
      );
    } catch (error) {
      console.error(
        "CREATE PURCHASE REQUEST QUOTATION ERROR:",
        error
      );

      throw new Error(
        getApiErrorMessage(
          error,
          "Không thể tạo báo giá yêu cầu mua hộ."
        ),
        { cause: error }
      );
    }
  };

/* =========================================================
   CONFIRM PURCHASE
   PUT /api/purchase-requests/{purchaseRequestId}/confirm-purchase
========================================================= */

export const confirmPurchaseApi = async (purchaseRequestId, payload = {}) => {
  const normalizedId = validatePurchaseRequestId(purchaseRequestId);

  const requestBody = {
    status: normalizeUpperText(payload?.status || "PURCHASED"),
    proofImages: Array.isArray(payload?.proofImages)
      ? payload.proofImages.map(normalizeText).filter(Boolean)
      : [],
    generalNote: normalizeText(payload?.generalNote) || null,
  };

  const endpointUrl =
    typeof API_ENDPOINTS?.purchaseRequests?.confirmPurchase === "function"
      ? API_ENDPOINTS.purchaseRequests.confirmPurchase(normalizedId)
      : `/api/purchase-requests/${encodeURIComponent(normalizedId)}/confirm-purchase`;

  try {
    const response = await axiosInstance.put(endpointUrl, requestBody, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });

    return getResponseData(response);
  } catch (error) {
    console.error("CONFIRM PURCHASE ERROR:", error);
    throw new Error(
      getApiErrorMessage(error, "Không thể xác nhận mua hộ."),
      { cause: error }
    );
  }
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

const purchaseRequestService = {
  normalizeCreatePurchaseRequestPayload,
  createPurchaseRequestApi,
  getPurchaseRequestsApi,
  getPurchaseRequestDetailApi,
  createPurchaseRequestQuotationApi,
  confirmPurchaseApi,
};

export default purchaseRequestService;
