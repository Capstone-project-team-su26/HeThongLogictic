import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";
import { getConsignmentReceiptApi } from "./consignmentReceiptService";

/* =========================
   RESPONSE HELPER
========================= */

const getResponseData = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    null
  );
};

/* =========================
   TOKEN HELPER
========================= */

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

const getAuthHeaders = ({
  contentType = false,
} = {}) => {
  const token = getAccessToken();

  return {
    Accept: "text/plain",
    Authorization: `Bearer ${token}`,
    ...(contentType
      ? {
          "Content-Type":
            "application/json",
        }
      : {}),
  };
};

/* =========================
   NORMALIZE
========================= */

const normalizeOrderId = (orderId) => {
  const value = String(
    orderId || ""
  ).trim();

  if (!value) {
    throw new Error(
      "Không tìm thấy mã đơn ký gửi."
    );
  }

  return value;
};

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const normalizePositiveNumber = (
  value,
  fallback = 0
) => {
  return Math.max(
    0,
    normalizeNumber(value, fallback)
  );
};

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuid = (value, fieldName) => {
  const id = normalizeText(value);
  if (!id) return null;
  if (!UUID_PATTERN.test(id)) {
    throw new Error(`${fieldName} không đúng định dạng UUID.`);
  }
  return id;
};

const normalizeUuidArray = (value, fieldName) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => normalizeUuid(item, fieldName))
        .filter(Boolean)
    )
  );
};

const normalizeConsignmentItem = (item = {}, index = 0) => {
  const productName = normalizeText(item?.productName);
  const productType = normalizeText(item?.productType);
  const quantity = Math.trunc(normalizeNumber(item?.quantity));

  if (!productName) {
    throw new Error(`Kiện ${index + 1}: vui lòng nhập tên sản phẩm.`);
  }
  if (!productType) {
    throw new Error(`Kiện ${index + 1}: vui lòng chọn loại sản phẩm.`);
  }
  if (quantity < 1 || quantity > 2147483647) {
    throw new Error(`Kiện ${index + 1}: số lượng phải từ 1 đến 2147483647.`);
  }

  const referenceUrls = Array.from(
    new Set(
      (Array.isArray(item?.referenceUrls) ? item.referenceUrls : [])
        .map(normalizeText)
        .filter(Boolean)
    )
  );

  return {
    productName,
    productType,
    quantity,
    weight: normalizePositiveNumber(item?.weight),
    width: normalizePositiveNumber(item?.width),
    height: normalizePositiveNumber(item?.height),
    length: normalizePositiveNumber(item?.length),
    declaredValue: normalizePositiveNumber(item?.declaredValue),
    referenceUrls,
    domesticTrackingCode: normalizeText(item?.domesticTrackingCode) || null,
    packageConfigurationId: normalizeUuid(
      item?.packageConfigurationId,
      `Kiện ${index + 1}: packageConfigurationId`
    ),
  };
};

/**
 * Nguyện vọng của khách khi hàng về kho VN.
 *
 * BE chỉ nhận hai giá trị này; thứ khác coi như khách chưa chọn và lúc hàng về mặc định
 * giao ngay. Trả null thay vì đoán để kho biết mà hỏi lại khách.
 *
 * @param {unknown} value
 * @returns {"DIRECT_DELIVERY" | "STORE_AT_VN" | null}
 */
const normalizeDestinationHandling = (value) => {
  const normalized = String(value ?? "").trim().toUpperCase();

  return normalized === "DIRECT_DELIVERY" || normalized === "STORE_AT_VN"
    ? normalized
    : null;
};

export const normalizeCreateConsignmentPayload = (payload = {}) => {
  const route = normalizeText(payload?.route);
  const shippingOption = normalizeText(payload?.shippingOption);
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizeConsignmentItem)
    : [];

  if (!route) throw new Error("Vui lòng chọn tuyến hàng.");
  if (!shippingOption) throw new Error("Vui lòng chọn phương thức vận chuyển.");
  if (!items.length) throw new Error("Vui lòng thêm ít nhất một kiện hàng.");

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
    pricingRuleIds: normalizeUuidArray(
      payload?.pricingRuleIds,
      "pricingRuleIds"
    ),
    requiresInspection: Boolean(payload?.requiresInspection),
    requiresPacking: Boolean(payload?.requiresPacking),
    requiresWoodenCrate: Boolean(payload?.requiresWoodenCrate),
    requiresInsurance: Boolean(payload?.requiresInsurance),
    defaultDestinationHandling: normalizeDestinationHandling(
      payload?.defaultDestinationHandling
    ),
    note: normalizeText(payload?.note) || null,
    items,
  };
};

export const createConsignmentApi = async (payload = {}) => {
  const requestBody = normalizeCreateConsignmentPayload(payload);
  const response = await axiosInstance.post(
    API_ENDPOINTS.consignments.list,
    requestBody,
    { headers: getAuthHeaders({ contentType: true }) }
  );
  return getResponseData(response);
};

export const validateConsignmentItemsApi = async (items = []) => {
  const normalizedItems = Array.isArray(items)
    ? items.map(normalizeConsignmentItem)
    : [];
  if (!normalizedItems.length) {
    throw new Error("Vui lòng thêm ít nhất một kiện hàng để kiểm tra.");
  }

  const response = await axiosInstance.post(
    API_ENDPOINTS.consignments.validateItems,
    { items: normalizedItems },
    { headers: getAuthHeaders({ contentType: true }) }
  );
  return getResponseData(response);
};

/* =========================
   UNIT HELPER
========================= */

/**
 * Kích thước đầu vào: cm
 * Kết quả trả về: m³
 *
 * Công thức:
 * length × width × height × quantity
 * chia 1.000.000
 */
export const calculateVolumeM3FromItems = (
  items = []
) => {
  if (!Array.isArray(items)) {
    return 0;
  }

  const totalVolumeM3 = items.reduce(
    (total, item) => {
      const lengthCm =
        normalizePositiveNumber(
          item?.length
        );

      const widthCm =
        normalizePositiveNumber(
          item?.width
        );

      const heightCm =
        normalizePositiveNumber(
          item?.height
        );

      const quantity = Math.max(
        1,
        Math.trunc(
          normalizeNumber(
            item?.quantity,
            1
          )
        )
      );

      const itemVolumeCm3 =
        lengthCm *
        widthCm *
        heightCm *
        quantity;

      return (
        total +
        itemVolumeCm3 / 1_000_000
      );
    },
    0
  );

  return Number(
    totalVolumeM3.toFixed(6)
  );
};

/**
 * Đổi m³ sang cm³.
 */
export const convertM3ToCm3 = (
  volumeM3
) => {
  const value =
    normalizePositiveNumber(volumeM3);

  return Number(
    (value * 1_000_000).toFixed(2)
  );
};

/* =========================
   QUOTATION PAYLOAD
========================= */

const normalizeAdditionalFees = (
  additionalFees
) => {
  if (!Array.isArray(additionalFees)) {
    return [];
  }

  return additionalFees.map((fee) => ({
    feeId: normalizeText(fee?.feeId),
    code: normalizeText(fee?.code),
    label: normalizeText(fee?.label),
    amount: normalizePositiveNumber(
      fee?.amount
    ),
    enabled:
      fee?.enabled !== false,
  }));
};

export const normalizeQuotationPayload = (
  payload = {}
) => {
  const servicePricingId =
    normalizeText(
      payload?.servicePricingId
    );

  const serviceType =
    normalizeText(payload?.serviceType);

  const salesNote =
    normalizeText(payload?.salesNote);

  const quotation =
    payload?.quotation &&
    typeof payload.quotation ===
      "object"
      ? payload.quotation
      : {};

  const submittedAtUtc =
    normalizeText(
      payload?.submittedAtUtc
    );

  const clientSubmittedAtUtc =
    normalizeText(
      payload?.clientSubmittedAtUtc
    ) || submittedAtUtc;

  return {
    submittedAtUtc,
    clientSubmittedAtUtc,
    clientTimeZone: normalizeText(
      payload?.clientTimeZone
    ),
    clientUtcOffset: normalizeText(
      payload?.clientUtcOffset
    ),
    clientUtcOffsetMinutes:
      normalizeNumber(
        payload?.clientUtcOffsetMinutes,
        0
      ),
    warehouseId: normalizeText(
      payload?.warehouseId
    ),
    servicePricingId,
    serviceType,
    weightKg: normalizePositiveNumber(
      payload?.weightKg
    ),
    volumeM3: normalizePositiveNumber(
      payload?.volumeM3
    ),
    packageCount: Math.max(
      1,
      Math.trunc(
        normalizeNumber(
          payload?.packageCount,
          1
        )
      )
    ),
    declaredValue:
      normalizePositiveNumber(
        payload?.declaredValue
      ),
    salesNote,
    quotation: {
      servicePricingId:
        normalizeText(
          quotation?.servicePricingId
        ) || servicePricingId,
      serviceType:
        normalizeText(
          quotation?.serviceType
        ) || serviceType,
      originCountry:
        normalizeText(
          quotation?.originCountry
        ),
      destinationCountry:
        normalizeText(
          quotation?.destinationCountry
        ),
      unitType:
        normalizeText(
          quotation?.unitType
        ),
      unitPrice:
        normalizePositiveNumber(
          quotation?.unitPrice
        ),
      currency:
        normalizeText(
          quotation?.currency
        ),
      totalWeight:
        normalizePositiveNumber(
          quotation?.totalWeight
        ),
      totalVolume:
        normalizePositiveNumber(
          quotation?.totalVolume
        ),
      volumetricWeight:
        normalizePositiveNumber(
          quotation?.volumetricWeight
        ),
      chargeableWeight:
        normalizePositiveNumber(
          quotation?.chargeableWeight
        ),
      mainServiceAmount:
        normalizePositiveNumber(
          quotation?.mainServiceAmount
        ),
      additionalFees:
        normalizeAdditionalFees(
          quotation?.additionalFees
        ),
      discountPercent:
        normalizePositiveNumber(
          quotation?.discountPercent
        ),
      subtotal:
        normalizePositiveNumber(
          quotation?.subtotal
        ),
      discount:
        normalizePositiveNumber(
          quotation?.discount
        ),
      total:
        normalizePositiveNumber(
          quotation?.total
        ),
      estimatedFreightCharge:
        normalizePositiveNumber(
          quotation
            ?.estimatedFreightCharge
        ),
      serviceFee:
        normalizePositiveNumber(
          quotation?.serviceFee
        ),
      totalEstimatedCost:
        normalizePositiveNumber(
          quotation
            ?.totalEstimatedCost
        ),
      vat: normalizePositiveNumber(
        quotation?.vat
      ),
      importTax:
        normalizePositiveNumber(
          quotation?.importTax
        ),
      salesNote:
        normalizeText(
          quotation?.salesNote
        ) || salesNote,
    },
  };
};

const validateQuotationPayload = (
  payload
) => {
  if (!payload?.warehouseId) {
    throw new Error(
      "Vui lòng chọn kho xử lý."
    );
  }

  if (!payload?.servicePricingId) {
    throw new Error(
      "Vui lòng chọn bảng giá dịch vụ."
    );
  }

  if (!payload?.serviceType) {
    throw new Error(
      "Vui lòng chọn loại dịch vụ."
    );
  }

  if (payload.weightKg <= 0) {
    throw new Error(
      "Khối lượng phải lớn hơn 0 kg."
    );
  }

  if (payload.volumeM3 <= 0) {
    throw new Error(
      "Thể tích phải lớn hơn 0 m³."
    );
  }

  if (payload.packageCount <= 0) {
    throw new Error(
      "Số kiện phải lớn hơn 0."
    );
  }
};

/* =========================
   STATUS PAYLOAD
========================= */

const REVIEW_STATUSES = new Set([
  "APPROVED",
  "REJECTED",
]);

export const normalizeConsignmentStatusPayload =
  (payload = {}) => {
    const status = normalizeText(
      payload?.status
    ).toUpperCase();

    const rejectionReason =
      normalizeText(
        payload?.rejectionReason
      );

    if (!REVIEW_STATUSES.has(status)) {
      throw new Error(
        "Trạng thái chỉ được phép là APPROVED hoặc REJECTED."
      );
    }

    if (
      status === "REJECTED" &&
      rejectionReason.length < 3
    ) {
      throw new Error(
        "Vui lòng nhập lý do từ chối ít nhất 3 ký tự."
      );
    }

    return {
      status,
      rejectionReason:
        status === "REJECTED"
          ? rejectionReason
          : "",
    };
  };

/* =========================
   LẤY DANH SÁCH ĐƠN KÝ GỬI
========================= */

export const getConsignmentsApi =
  async (filters = {}) => {
    const params =
      removeEmptyParams({
        ...filters,

        pageNumber:
          filters?.pageNumber ??
          filters?.page ??
          1,

        pageSize:
          filters?.pageSize ??
          filters?.limit ??
          10,
      });

    const response =
      await axiosInstance.get(
        API_ENDPOINTS.consignments.list,
        {
          params,
          headers: getAuthHeaders(),
        }
      );

    const data =
      getResponseData(response);

    const items =
      Array.isArray(data?.items)
        ? data.items.map(
            (item) => ({
              ...item,

              orderId:
                normalizeText(
                  item?.orderId ??
                    item?.id
                ),

              consignmentCode:
                normalizeText(
                  item?.consignmentCode
                ),

              customerName:
                normalizeText(
                  item?.customerName
                ),

              consignmentType:
                normalizeText(
                  item?.consignmentType
                ),

              status:
                normalizeText(
                  item?.status
                ).toUpperCase(),

              totalWeight:
                normalizePositiveNumber(
                  item?.totalWeight
                ),

              totalVolume:
                normalizePositiveNumber(
                  item?.totalVolume
                ),

              route:
                normalizeText(
                  item?.route
                ),

              receiverName:
                normalizeText(
                  item?.receiverName
                ),

              receiverPhone:
                normalizeText(
                  item?.receiverPhone
                ),

              receiverAddress:
                normalizeText(
                  item?.receiverAddress
                ),

              requiresInspection:
                Boolean(
                  item?.requiresInspection
                ),

              createdAt:
                normalizeText(
                  item?.createdAt
                ),

              warehouseId:
                normalizeText(
                  item?.warehouseId
                ) || null,

              pricingRuleIds:
                Array.isArray(
                  item?.pricingRuleIds
                )
                  ? item.pricingRuleIds
                      .map(normalizeText)
                      .filter(Boolean)
                  : [],

              itemNames:
                Array.isArray(
                  item?.itemNames
                )
                  ? item.itemNames
                      .map(normalizeText)
                      .filter(Boolean)
                  : [],
            })
          )
        : [];

    const pageNumber =
      Math.max(
        1,
        Math.trunc(
          normalizePositiveNumber(
            data?.pageNumber,
            params?.pageNumber ?? 1
          )
        )
      );

    const pageSize =
      Math.max(
        1,
        Math.trunc(
          normalizePositiveNumber(
            data?.pageSize,
            params?.pageSize ?? 10
          )
        )
      );

    const totalCount =
      Math.max(
        0,
        Math.trunc(
          normalizePositiveNumber(
            data?.totalCount,
            items.length
          )
        )
      );

    const totalPagesFromApi =
      Math.max(
        0,
        Math.trunc(
          normalizePositiveNumber(
            data?.totalPages
          )
        )
      );

    const totalPages =
      totalPagesFromApi > 0
        ? totalPagesFromApi
        : totalCount > 0
          ? Math.ceil(
              totalCount /
                pageSize
            )
          : 0;

    return {
      items,
      totalCount,
      pageNumber,
      pageSize,
      totalPages,

      hasPreviousPage:
        pageNumber > 1,

      hasNextPage:
        totalPages > 0 &&
        pageNumber < totalPages,

      raw: data,
    };
  };

/* =========================
   LẤY CHI TIẾT ĐƠN KÝ GỬI
========================= */

export const getConsignmentDetailApi =
  async (orderId) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const response =
      await axiosInstance.get(
        API_ENDPOINTS.consignments.detail(normalizedOrderId),
        {
          headers: getAuthHeaders(),
        }
      );

    const data =
      getResponseData(response);

    if (
      !data ||
      typeof data !== "object"
    ) {
      throw new Error(
        "API không trả về dữ liệu chi tiết đơn ký gửi."
      );
    }

    return {
      ...data,

      orderId:
        normalizeText(
          data?.orderId ??
            data?.id
        ),

      consignmentCode:
        normalizeText(
          data?.consignmentCode
        ),

      status:
        normalizeText(
          data?.status ??
            data?.orderStatus ??
            data?.consignmentStatus
        ).toUpperCase(),

      consignmentType:
        normalizeText(
          data?.consignmentType
        ),

      orderType:
        normalizeText(
          data?.orderType
        ).toUpperCase(),

      totalWeight:
        normalizePositiveNumber(
          data?.totalWeight
        ),

      totalVolume:
        normalizePositiveNumber(
          data?.totalVolume
        ),

      route:
        normalizeText(
          data?.route
        ),

      receiverName:
        normalizeText(
          data?.receiverName
        ),

      receiverPhone:
        normalizeText(
          data?.receiverPhone
        ),

      receiverAddress:
        normalizeText(
          data?.receiverAddress
        ),

      requiresInspection:
        Boolean(
          data?.requiresInspection
        ),

      warehouseId:
        normalizeText(
          data?.warehouseId
        ) || null,

      pricingRuleIds:
        Array.isArray(
          data?.pricingRuleIds
        )
          ? data.pricingRuleIds
              .map(normalizeText)
              .filter(Boolean)
          : [],

      itemNames:
        Array.isArray(
          data?.itemNames
        )
          ? data.itemNames
              .map(normalizeText)
              .filter(Boolean)
          : [],

      items:
        Array.isArray(
          data?.items
        )
          ? data.items
          : [],

      customer:
        data?.customer &&
        typeof data.customer ===
          "object"
          ? data.customer
          : null,

      quotation:
        data?.quotation &&
        typeof data.quotation ===
          "object"
          ? data.quotation
          : null,
    };
  };

/* =========================
   CẬP NHẬT TRẠNG THÁI ĐƠN
   ACCEPTED -> APPROVED / REJECTED
========================= */

export const updateConsignmentStatusApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeConsignmentStatusPayload(
        requestPayload
      );

    const response =
      await axiosInstance.put(
        API_ENDPOINTS.consignments.status(normalizedOrderId),
        payload,
        {
          headers: getAuthHeaders({
            contentType: true,
          }),
        }
      );

    return getResponseData(response);
  };

export const approveConsignmentApi =
  async (orderId) => {
    return updateConsignmentStatusApi(
      orderId,
      {
        status: "APPROVED",
        rejectionReason: "",
      }
    );
  };

export const rejectConsignmentApi =
  async (
    orderId,
    rejectionReason
  ) => {
    return updateConsignmentStatusApi(
      orderId,
      {
        status: "REJECTED",
        rejectionReason,
      }
    );
  };

/* =========================
   TẠO BÁO GIÁ TẠM TÍNH
========================= */

export const estimateQuotationApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeQuotationPayload(
        requestPayload
      );

    validateQuotationPayload(payload);

    const response =
      await axiosInstance.post(
        API_ENDPOINTS.consignments.estimateQuotation(
          normalizedOrderId
        ),
        payload,
        {
          headers: getAuthHeaders({
            contentType: true,
          }),
        }
      );

    return getResponseData(response);
  };

/* =========================
   GỬI BÁO GIÁ CHÍNH THỨC
========================= */

export const sendQuotationApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeQuotationPayload(
        requestPayload
      );

    validateQuotationPayload(payload);

    const response =
      await axiosInstance.post(
        API_ENDPOINTS.consignments.sendQuotation(
          normalizedOrderId
        ),
        payload,
        {
          headers: getAuthHeaders({
            contentType: true,
          }),
        }
      );

    return getResponseData(response);
  };

export { getConsignmentReceiptApi };

/* =====================================================
   DEFAULT EXPORT
===================================================== */

const consignmentService = {
  calculateVolumeM3FromItems,
  convertM3ToCm3,
  normalizeQuotationPayload,
  normalizeConsignmentStatusPayload,
  normalizeCreateConsignmentPayload,
  createConsignmentApi,
  validateConsignmentItemsApi,
  getConsignmentsApi,
  getConsignmentDetailApi,
  updateConsignmentStatusApi,
  approveConsignmentApi,
  rejectConsignmentApi,
  estimateQuotationApi,
  sendQuotationApi,
  getConsignmentReceiptApi,
};

export default consignmentService;
