/**
 * MOCK yêu cầu MUA HỘ — bản chỉ-giao-diện.
 *
 * Tầng HTTP đã bị gỡ: mỗi hàm dưới đây đọc/ghi bộ dữ liệu mẫu trong bộ nhớ
 * (@/mocks/data/purchaseRequests) thay vì gọi server. Bề mặt public giữ y nguyên bản
 * thật — đúng tên export, đúng thứ tự tham số, đúng hình dạng trả về — vì KHÔNG được
 * sửa một dòng nào trong component.
 *
 * Nhóm normalize* là code thuần (không mạng) nên được giữ nguyên logic của bản thật:
 * chúng vẫn là nơi duy nhất chặn dữ liệu sai trước khi "gửi đi", và cũng là nơi quyết
 * định hình dạng mà PurchaseRequestList / PurchaseRequestDetail / PurchaseDocumentsList
 * đang destructure. Đổi chúng là màn hình rỗng lúc chạy chứ không phải lỗi build.
 *
 * Hai thứ bị bỏ so với bản thật, cố ý:
 *   - getResponseData(): không còn response axios để bóc (data.data ?? data).
 *   - getAuthHeaders(): bản thật ném lỗi khi thiếu sessionStorage.accessToken; bản
 *     UI-only không có phiên thật nên chặn token ở đây chỉ làm mọi màn trắng xoá.
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm async có một mốc "THẬT:" ghi rõ endpoint và cách bản
 * gốc bóc dữ liệu. Chỉ cần thay phần thân sau `await delay(...)` bằng lời gọi axios
 * tương ứng — phần chuẩn hoá payload và hình dạng trả về đã đúng sẵn.
 */

import {
  createApiError,
  deepClone,
  delay,
  matchesKeyword,
  nextId,
  nextUuid,
  nowIso,
  paginate,
} from "@/mocks/mockUtils";

import purchaseRequestStore, {
  PURCHASE_CUSTOMERS,
  findPurchaseRequestById,
} from "@/mocks/data/purchaseRequests";

import {
  findPricingRuleByCode,
  findProductTypeById,
  findShippingRouteByCode,
} from "@/mocks/data/catalog";

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
   NORMALIZE LIST ITEM
========================================================= */

/* Trạng thái mà khách đã trả phần trả trước (mock không có sổ thanh toán riêng). */
const PREPAID_REQUEST_STATUSES = new Set([
  "DEPOSIT_PAID",
  "PAID",
  "PURCHASING",
  "PROCESSING",
  "COMPLETED",
]);

/**
 * Số liệu lập đơn mua của một yêu cầu — cùng luật backend (PurchaseRequestListItemDto):
 * chỉ tính khi báo giá đã ACCEPTED; một dòng còn mua được nếu có trong báo giá, không nằm
 * trong đơn mua chưa huỷ nào và SL khách đặt − SL đã đóng "không mua được" > 0.
 * Mock không có kho đơn mua / khoản hoàn nên hai phần đó mặc định rỗng.
 */
const buildPurchaseLineSummary = (item = {}) => {
  const quotation = item?.quotation || null;
  /* Bộ dữ liệu mẫu còn dùng mã đời cũ (CONFIRMED / CUSTOMER_CONFIRMED) cho báo giá khách đã chấp nhận. */
  const accepted = ["ACCEPTED", "CONFIRMED", "CUSTOMER_CONFIRMED"].includes(
    normalizeUpperText(quotation?.status)
  );

  const quotedIds = new Set(
    (Array.isArray(quotation?.items) ? quotation.items : [])
      .map((line) => normalizeText(line?.purchaseRequestItemId).toLowerCase())
      .filter(Boolean)
  );

  const openLines = accepted
    ? (Array.isArray(item?.items) ? item.items : []).filter(
      (line) =>
        quotedIds.has(normalizeText(line?.itemId ?? line?.purchaseRequestItemId).toLowerCase()) &&
        (Number(line?.quantity) || 0) > 0
    )
    : [];

  return {
    activePurchaseOrderCount: 0,
    openLineCount: openLines.length,
    openQuantity: openLines.reduce(
      (total, line) => total + (Number(line?.quantity) || 0),
      0
    ),
    closedQuantity: 0,
    prepaidAmount: PREPAID_REQUEST_STATUSES.has(normalizeUpperText(item?.status))
      ? Number(quotation?.depositAmount ?? quotation?.totalAmount) || 0
      : 0,
  };
};

const normalizePurchaseRequestListItem = (item = {}) => {
  const lineSummary = buildPurchaseLineSummary(item);

  return {
    ...item,
    purchaseRequestId: item?.purchaseRequestId ?? item?.id ?? "",
    purchaseCode: item?.purchaseCode ?? item?.code ?? "",
    customerId: item?.customerId ?? "",
    customerName: item?.customerName ?? item?.receiverName ?? item?.customer?.fullName ?? "",
    customerPhone: item?.customerPhone ?? item?.receiverPhone ?? item?.phone ?? item?.customer?.phone ?? "",
    customerCode: item?.customerCode ?? item?.customer?.customerCode ?? null,

    /* Trường mới của PurchaseRequestListItemDto (màn Đơn mua NCC dùng để chọn yêu cầu). */
    activePurchaseOrderCount:
      Number(item?.activePurchaseOrderCount ?? lineSummary.activePurchaseOrderCount) || 0,
    openLineCount: Number(item?.openLineCount ?? lineSummary.openLineCount) || 0,
    openQuantity: Number(item?.openQuantity ?? lineSummary.openQuantity) || 0,
    closedQuantity: Number(item?.closedQuantity ?? lineSummary.closedQuantity) || 0,
    prepaidAmount: Number(item?.prepaidAmount ?? lineSummary.prepaidAmount) || 0,

    receiverName: item?.receiverName ?? item?.customerName ?? "",
    receiverPhone: item?.receiverPhone ?? item?.customerPhone ?? item?.phone ?? item?.customer?.phone ?? "",
    receiverAddress: item?.receiverAddress ?? item?.address ?? "",
    route: item?.route ?? "",
    shippingOption: item?.shippingOption ?? null,
    status: item?.status ?? "",
    statusDisplayName: item?.statusDisplayName ?? "",
    receiptPdfUrl: item?.receiptPdfUrl ?? null,
    warehouseName: item?.warehouseName ?? "",
    itemCount:
      Number(item?.itemCount) ||
      (Array.isArray(item?.items) ? item.items.length : 0),
    totalQuantity: Number(item?.totalQuantity) || 0,
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
    quotation: item?.quotation ?? null,
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
      ...data,
      purchaseRequestId:
        data?.purchaseRequestId ?? data?.id ?? "",

      purchaseCode:
        data?.purchaseCode ?? data?.code ?? "",

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

      statusDisplayName:
        data?.statusDisplayName ?? "",

      warehouseId:
        data?.warehouseId ?? null,

      warehouseName:
        data?.warehouseName ?? "",

      proofImages:
        Array.isArray(data?.proofImages) ? data.proofImages : [],

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

      /* Ship nội địa từ NCC — nguồn duy nhất của khoản này (xem createPurchaseRequestQuotationApi). */
      domesticShippingFee:
        normalizeNonNegativeNumber(
          payload?.domesticShippingFee ?? 0,
          "Ship nội địa"
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
   TRUY XUẤT BỘ DỮ LIỆU MẪU
========================================================= */

/**
 * Lấy bản ghi gốc trong bộ nhớ để ĐỌC hoặc GHI.
 *
 * Trả về chính tham chiếu trong store (không clone) vì các hàm ghi phải mutate được;
 * hàm đọc tự deepClone trước khi trả cho component.
 */
const requirePurchaseRequest = (
  purchaseRequestId
) => {
  const request =
    findPurchaseRequestById(
      purchaseRequestId
    );

  if (!request) {
    throw createApiError(
      404,
      `Không tìm thấy yêu cầu mua hộ ${purchaseRequestId}.`
    );
  }

  return request;
};

const toTime = (value) => {
  const time = new Date(
    value ?? 0
  ).getTime();

  return Number.isFinite(time)
    ? time
    : 0;
};

/**
 * Trường được quét khi người dùng gõ vào ô tìm kiếm.
 *
 * Placeholder của PurchaseRequestList hứa "Tìm mã yêu cầu, người nhận, sản phẩm..."
 * nên ba nhóm đó bắt buộc phải có; matchesKeyword đi xuyên mảng nên "items.productName"
 * cho phép gõ tên một sản phẩm là ra cả đơn chứa nó.
 */
const LIST_KEYWORD_FIELDS = [
  "purchaseCode",
  "code",
  "customerName",
  "customerPhone",
  "receiverName",
  "receiverPhone",
  "receiverAddress",
  "route",
  "warehouseName",
  "generalNote",
  "statusDisplayName",
  "customer.fullName",
  "customer.customerCode",
  "items.productName",
  "items.productLink",
];

/* =========================================================
   GET PURCHASE REQUEST LIST
   GET /api/purchase-requests
========================================================= */

/**
 * THẬT: GET /api/purchase-requests?pageNumber&pageSize&status&searchKeyword...
 * Bản thật bóc getResponseData(response) rồi đưa qua normalizePurchaseRequestPage,
 * nên hình dạng trả về là { items, totalCount, pageNumber, pageSize, totalPages }
 * và ĐÁNH SỐ TRANG TỪ 1 — mock giữ đúng năm khoá đó, không thêm bớt.
 *
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

    await delay(
      240,
      filters?.signal
    );

    const fromTime = params?.fromDate
      ? toTime(params.fromDate)
      : 0;

    const toDateTime = params?.toDate
      ? toTime(params.toDate)
      : 0;

    const rows = purchaseRequestStore
      .filter((request) => {
        /* "ALL" là giá trị của tab "Tất cả trạng thái", không phải một mã trạng thái. */
        if (
          params.status &&
          params.status !== "ALL" &&
          normalizeUpperText(
            request.status
          ) !== params.status
        ) {
          return false;
        }

        if (
          params.customerId &&
          request.customerId !==
            params.customerId
        ) {
          return false;
        }

        if (
          params.route &&
          normalizeText(
            request.route
          ) !== params.route
        ) {
          return false;
        }

        if (
          params.shippingOption &&
          normalizeUpperText(
            request.shippingOption
          ) !== params.shippingOption
        ) {
          return false;
        }

        const createdTime = toTime(
          request.createdAt
        );

        if (
          fromTime &&
          createdTime < fromTime
        ) {
          return false;
        }

        if (
          toDateTime &&
          createdTime > toDateTime
        ) {
          return false;
        }

        return matchesKeyword(
          request,
          params.search,
          LIST_KEYWORD_FIELDS
        );
      })
      /* Mới nhất trước: cả màn danh sách và màn lịch sử đều tự sort lại, nhưng phân
         trang phải cắt trên thứ tự này để trang 1 luôn là đơn vừa phát sinh. */
      .sort(
        (first, second) =>
          toTime(second.createdAt) -
          toTime(first.createdAt)
      );

    const page = paginate(rows, {
      pageNumber: params.pageNumber,
      pageSize: params.pageSize,
    });

    return normalizePurchaseRequestPage(
      page,
      params
    );
  };

/* =========================================================
   GET PURCHASE REQUEST DETAIL
   GET /api/purchase-requests/{purchaseRequestId}
========================================================= */

/**
 * THẬT: GET /api/purchase-requests/{purchaseRequestId} — getResponseData(response)
 * rồi normalizePurchaseRequestDetail.
 *
 * Bộ dữ liệu mẫu nhận cả purchaseRequestId lẫn purchaseCode vì màn Giấy tờ và state
 * của navigate không luôn giữ được id điều hướng.
 */
export const getPurchaseRequestDetailApi =
  async (purchaseRequestId) => {
    const normalizedId =
      validatePurchaseRequestId(
        purchaseRequestId
      );

    await delay();

    const request =
      requirePurchaseRequest(
        normalizedId
      );

    return normalizePurchaseRequestDetail(
      deepClone(request)
    );
  };

/* =========================================================
   CREATE PURCHASE REQUEST
   POST /api/purchase-requests
========================================================= */

/** Nhân sự nội bộ đứng tên đơn tạo từ màn Sale — hiện ở ô "Người tạo" của chi tiết. */
const MOCK_CREATED_BY_NAME =
  "Sale Nguyễn Hữu Phát";

/**
 * Kho nguồn mặc định cho đơn tạo mới.
 *
 * Lấy theo bản ghi mẫu đầu tiên có kho thay vì tự sinh id: màn chi tiết dò kho theo
 * warehouseId trong danh sách kho hệ thống, nên id lạ là ô kho hiện "—".
 * Chốt một lần lúc nạp module để những đơn chèn thêm sau không đổi kho.
 */
const DEFAULT_WAREHOUSE =
  purchaseRequestStore.find(
    (request) =>
      Boolean(request?.warehouseId)
  ) || {};

/**
 * Đổi mã tuyến của form thành chuỗi tuyến mà giao diện đang hiểu.
 *
 * translateRoute của màn danh sách cắt chuỗi theo dấu "-" rồi dịch từng phần, nên để
 * nguyên mã "CNVN-GZ-HN-ROAD" sẽ ra chuỗi vô nghĩa. Bộ đơn mẫu lưu dạng "CN → VN",
 * vì vậy tra tuyến trong catalog để lấy hai đầu quốc gia; không tra được thì giữ mã gốc.
 */
const toDisplayRoute = (routeCode) => {
  const route =
    findShippingRouteByCode(
      routeCode
    );

  if (
    route?.originCountry &&
    route?.destinationCountry
  ) {
    return `${route.originCountry} → ${route.destinationCountry}`;
  }

  return routeCode;
};

/**
 * Tên loại hàng theo id mà form gửi lên.
 *
 * Ô chọn loại hàng của form trộn hai nguồn: bộ loại hàng nghiệp vụ (đang dùng trong bộ
 * đơn mẫu) và bộ loại hàng trong catalog. Tra catalog trước, không thấy thì dò ngược
 * chính các sản phẩm mẫu — nhờ vậy id nào cũng ra được tên, khỏi phải nhân đôi bảng id.
 */
const resolveProductTypeName = (
  productTypeId
) => {
  const catalogType =
    findProductTypeById(
      productTypeId
    );

  if (catalogType?.name) {
    return catalogType.name;
  }

  for (const request of purchaseRequestStore) {
    const matched = (
      Array.isArray(request?.items)
        ? request.items
        : []
    ).find(
      (item) =>
        item?.productType ===
          productTypeId &&
        item?.productTypeName
    );

    if (matched) {
      return matched.productTypeName;
    }
  }

  return "";
};

const buildStoredItem = (item) => {
  return {
    itemId: nextUuid(),

    productLink: item.productLink,
    sourceWebsite:
      item.sourceWebsite,

    productType: item.productType,

    /* Tên loại hàng chỉ để các màn tra chéo đọc cho đẹp; bản chi tiết vẫn strip đi
       đúng như normalizePurchaseRequestItem của bản thật. */
    productTypeName:
      resolveProductTypeName(
        item.productType
      ),

    productName: item.productName,
    quantity: item.quantity,
    attributes: item.attributes,
    note: item.note,
    imageUrls: item.imageUrls,

    /* Chưa khảo giá nên để 0: màn lập báo giá lấy con số này làm mức khởi điểm. */
    referenceUnitPrice: 0,
  };
};

/**
 * THẬT: POST /api/purchase-requests — trả về getResponseData(response).
 *
 * Bản thật trả bản ghi vừa tạo; ConsignmentBuyOrder chỉ đọc `result?.message` cho toast
 * rồi điều hướng về danh sách. Mock chèn bản ghi đầy đủ lên đầu bộ dữ liệu để đơn mới
 * nằm ngay trang 1 và mở được bằng màn chi tiết.
 */
export const createPurchaseRequestApi = async (payload = {}) => {
  const requestBody = normalizeCreatePurchaseRequestPayload(payload);

  await delay();

  const items = requestBody.items.map(
    buildStoredItem
  );

  /* Xoay khách theo số đơn đang có để đơn tạo mới không dồn hết vào một người. */
  const customer =
    PURCHASE_CUSTOMERS[
      purchaseRequestStore.length %
        PURCHASE_CUSTOMERS.length
    ];

  const purchaseRequestId =
    nextUuid();

  const purchaseCode =
    nextId("PUR");

  const createdAt = nowIso();

  const request = {
    purchaseRequestId,
    id: purchaseRequestId,

    purchaseCode,
    code: purchaseCode,

    /* Đơn vừa gửi đi luôn ở trạng thái chờ duyệt; để statusDisplayName rỗng cho màn
       danh sách và màn chi tiết tự dịch theo cách diễn đạt riêng của từng màn. */
    status:
      PURCHASE_REQUEST_STATUS.PENDING_REVIEW,
    statusDisplayName: "",

    route: toDisplayRoute(
      requestBody.route
    ),
    shippingOption:
      requestBody.shippingOption,

    customerId: customer.customerId,
    customerName: customer.fullName,
    customerPhone: customer.phone,

    customer: {
      id: customer.customerId,
      customerId: customer.customerId,
      customerCode:
        customer.customerCode,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
    },

    createdByName:
      MOCK_CREATED_BY_NAME,

    receiverName:
      requestBody.receiverName ||
      customer.fullName,
    receiverPhone:
      requestBody.receiverPhone ||
      customer.phone,
    receiverAddress:
      requestBody.receiverAddress ||
      "",

    warehouseId:
      DEFAULT_WAREHOUSE.warehouseId ??
      null,
    warehouseCode:
      DEFAULT_WAREHOUSE.warehouseCode ??
      "",
    warehouseName:
      DEFAULT_WAREHOUSE.warehouseName ??
      "",

    /* Màn chi tiết dò lần lượt warehouseName -> destinationWarehouseName ->
       originWarehouseName, nên khai cả ba để không rơi về "—". */
    originWarehouseName:
      DEFAULT_WAREHOUSE.originWarehouseName ??
      DEFAULT_WAREHOUSE.warehouseName ??
      "",
    destinationWarehouseName:
      DEFAULT_WAREHOUSE.destinationWarehouseName ??
      "",

    requiresPacking:
      requestBody.requiresPacking,
    requiresWoodenCrate:
      requestBody.requiresWoodenCrate,
    requiresInsurance:
      requestBody.requiresInsurance,

    pricingRuleIds:
      requestBody.pricingRuleIds,

    generalNote:
      requestBody.generalNote || "",
    reason: null,

    itemCount: items.length,
    totalQuantity: items.reduce(
      (total, item) =>
        total + item.quantity,
      0
    ),

    /* Null giống bộ dữ liệu mẫu: màn Giấy tờ có nhánh dự phòng khi thiếu PDF (mở modal chi
       tiết / báo "Chưa có phiếu PDF"), còn URL giả chỉ cho ra khung xem trước trắng. */
    receiptPdfUrl: null,

    proofImages: [],

    createdAt,
    statusUpdatedAt: createdAt,
    quotationCreatedAt: null,

    items,
    shipments: [],
    quotation: null,
  };

  purchaseRequestStore.unshift(
    request
  );

  return {
    ...normalizePurchaseRequestDetail(
      deepClone(request)
    ),

    message:
      "Yêu cầu mua hộ đã được tiếp nhận.",
  };
};

/* =========================================================
   CREATE PURCHASE REQUEST QUOTATION
   POST /api/purchase-requests/{purchaseRequestId}/quotation
========================================================= */

/**
 * Id quy tắc phí cho hai khoản mà form gửi ở cấp cao nhất chứ không nằm trong
 * additionalFees.
 *
 * QuotationView dùng fee.id làm React key và đối soát "productsSubtotal + tổng
 * additionalFees" với totalAmount, nên hai khoản này phải xuất hiện trong danh sách
 * phụ phí với id RIÊNG. "Phí mua hộ" không có mã trong catalog (bộ mã chỉ phủ phụ phí
 * vận chuyển) nên dùng đúng id mà bộ báo giá mẫu đang dùng, để cùng một khoản phí
 * không mang hai id khác nhau giữa đơn mẫu và đơn vừa báo giá.
 */
const PURCHASE_SERVICE_FEE_RULE_ID =
  "aaaa0008-0000-4000-8000-000000000008";

/**
 * KHÔNG dùng id của quy tắc DOMESTIC_FEE cho khoản này.
 *
 * Ô "phí vận chuyển" là số Sale tự gõ ở cấp cao nhất, không phải ship nội địa; khoản ship
 * nội địa (nếu có) đã mang id quy tắc DOMESTIC_FEE. Cho hai dòng cùng pricingRuleId là dữ
 * liệu sai, nên khoản tổng hợp này mang id riêng, cùng khuôn với "Phí mua hộ" và cũng không
 * trùng quy tắc nào trong catalog.
 */
const SHIPPING_SERVICE_FEE_RULE_ID =
  "aaaa0009-0000-4000-8000-000000000009";

/** Gán id hiển thị cho từng dòng phụ phí, tránh hai dòng đè React key lên nhau. */
const withUniqueFeeIds = (fees) => {
  const usedIds = new Set();

  return fees.map((fee) => {
    let id = normalizeText(
      fee.pricingRuleId
    );

    if (!id || usedIds.has(id)) {
      id = nextUuid();
    }

    usedIds.add(id);

    return { ...fee, id };
  });
};

const VAT_RULE_ID =
  findPricingRuleByCode("VAT")?.id ||
  "";

const DOMESTIC_FEE_RULE_ID =
  findPricingRuleByCode("DOMESTIC_FEE")?.id ||
  "";

const isDomesticFeeLine = (fee) =>
  (DOMESTIC_FEE_RULE_ID &&
    normalizeText(fee?.pricingRuleId) ===
      DOMESTIC_FEE_RULE_ID) ||
  normalizeUpperText(fee?.feeType) ===
    "DOMESTIC_FEE";

const IMPORT_TAX_RULE_ID =
  findPricingRuleByCode(
    "IMPORT_TAX"
  )?.id || "";

/**
 * Tách riêng VAT và thuế nhập khẩu ra khỏi danh sách phụ phí.
 *
 * Màn chi tiết có hai ô đọc thẳng quotation.vat / quotation.importTax, còn phần đối soát lại
 * cộng từ additionalFees — nên hai con số này phải bóc ra từ chính danh sách phí.
 *
 * KHÔNG phân loại chỉ bằng feeType: modal gửi feeType = ruleType của catalog ("VAT",
 * "IMPORT_TAX"), nhưng bộ báo giá mẫu và cả BE thật đều dùng chung một mã "TAX" cho hai loại
 * thuế. Nếu chỉ so feeType thì với dữ liệu kiểu "TAX", ô VAT hiện 0 ₫ còn ô thuế nhập khẩu
 * gánh cả hai. Vì vậy so pricingRuleId trước — đó là thứ chỉ đúng một quy tắc — rồi mới rơi
 * về feeType, và mỗi khoản chỉ được xếp vào MỘT nhóm.
 */
const splitTaxAmounts = (fees) => {
  let vat = 0;
  let importTax = 0;

  for (const fee of fees) {
    const ruleId = normalizeText(
      fee.pricingRuleId
    );

    const feeType = normalizeUpperText(
      fee.feeType
    );

    const isVat =
      (VAT_RULE_ID &&
        ruleId === VAT_RULE_ID) ||
      feeType === "VAT";

    if (isVat) {
      vat += fee.amount;
      continue;
    }

    const isImportTax =
      (IMPORT_TAX_RULE_ID &&
        ruleId ===
          IMPORT_TAX_RULE_ID) ||
      feeType === "IMPORT_TAX" ||
      feeType === "TAX";

    if (isImportTax) {
      importTax += fee.amount;
    }
  }

  return { vat, importTax };
};

/**
 * THẬT: POST /api/purchase-requests/{purchaseRequestId}/quotation — trả về
 * getResponseData(response).
 *
 * Modal chỉ đọc `result` để gọi onSuccess rồi tải lại chi tiết, nên phần quan trọng là
 * GHI: báo giá phải được đính vào bản ghi trong bộ nhớ, nếu không lần loadDetail ngay
 * sau đó lại thấy quotation = null và nút "Tạo báo giá" hiện lại như chưa làm gì.
 *
 * Tổng tiền tính đúng công thức của modal (productSubtotal + phí mua hộ + phí vận
 * chuyển + ship nội địa + phụ phí) để QuotationView không bật cảnh báo "Tổng báo giá
 * chưa khớp".
 *
 * @param {string} purchaseRequestId
 * @param {Object} payload
 * @param {number} payload.purchaseFee
 * @param {number} payload.shippingFee
 * @param {number} [payload.domesticShippingFee]
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

    await delay();

    const request =
      requirePurchaseRequest(
        normalizedId
      );

    const items =
      requestBody.items.map(
        (quotationItem) => {
          const requestItem =
            (Array.isArray(
              request.items
            )
              ? request.items
              : []
            ).find(
              (current) =>
                current.itemId ===
                quotationItem.purchaseRequestItemId
            ) || {};

          const quantity =
            Number(
              requestItem.quantity
            ) || 0;

          return {
            quotationItemId:
              nextUuid(),

            /* Trùng itemId của yêu cầu — màn lập báo giá gửi lại chính id này. */
            purchaseRequestItemId:
              quotationItem.purchaseRequestItemId,

            productName:
              requestItem.productName ??
              "",

            unitPrice:
              quotationItem.unitPrice,

            quantity,

            lineTotal:
              quotationItem.unitPrice *
              quantity,
          };
        }
      );

    const productsSubtotal =
      items.reduce(
        (total, item) =>
          total + item.lineTotal,
        0
      );

    const leadingFees = [];

    if (requestBody.purchaseFee > 0) {
      leadingFees.push({
        pricingRuleId:
          PURCHASE_SERVICE_FEE_RULE_ID,
        feeName: "Phí mua hộ",
        feeType: "SERVICE_FEE",
        calculationType: "FIXED",
        value: requestBody.purchaseFee,
        amount: requestBody.purchaseFee,
        note: "Phí dịch vụ mua hộ tại Trung Quốc",
      });
    }

    if (requestBody.shippingFee > 0) {
      leadingFees.push({
        pricingRuleId:
          SHIPPING_SERVICE_FEE_RULE_ID,
        feeName:
          "Phí vận chuyển Trung Quốc - Việt Nam",
        feeType: "MAIN_SERVICE",
        calculationType: "FIXED",
        value: requestBody.shippingFee,
        amount: requestBody.shippingFee,
        note: "Gồm chặng nội địa Trung Quốc và chặng quốc tế",
      });
    }

    /*
     * Ship nội địa tính ĐÚNG MỘT LẦN, như backend: ô domesticShippingFee > 0 là nguồn duy
     * nhất (mọi phụ phí DOMESTIC_FEE bị bỏ qua); ô = 0 mà có phụ phí DOMESTIC_FEE (client
     * cũ) thì lấy tổng các dòng đó làm ship nội địa.
     */
    const domesticFeeLines =
      requestBody.additionalFees.filter(
        isDomesticFeeLine
      );

    const domesticShippingFee =
      requestBody.domesticShippingFee > 0
        ? requestBody.domesticShippingFee
        : domesticFeeLines.reduce(
          (total, fee) =>
            total + fee.amount,
          0
        );

    if (domesticShippingFee > 0) {
      leadingFees.push({
        pricingRuleId:
          DOMESTIC_FEE_RULE_ID ||
          nextUuid(),
        feeName: "Ship nội địa từ NCC",
        feeType: "DOMESTIC_FEE",
        calculationType: "FIXED",
        value: domesticShippingFee,
        amount: domesticShippingFee,
        note: "Phí NCC giao tới kho nguồn",
      });
    }

    const additionalFees =
      withUniqueFeeIds([
        ...leadingFees,
        ...requestBody.additionalFees.filter(
          (fee) => !isDomesticFeeLine(fee)
        ),
      ]);

    const additionalFeeTotal =
      additionalFees.reduce(
        (total, fee) =>
          total + fee.amount,
        0
      );

    const totalAmount =
      productsSubtotal +
      additionalFeeTotal;

    const taxAmounts = splitTaxAmounts(
      additionalFees
    );

    const createdAt = nowIso();

    const quotationId = nextUuid();

    const quotation = {
      quotationId,
      id: quotationId,

      purchaseRequestId:
        request.purchaseRequestId,
      purchaseCode:
        request.purchaseCode,

      status:
        "PENDING_CUSTOMER_CONFIRMATION",

      productsSubtotal,
      purchaseFee:
        requestBody.purchaseFee,
      shippingFee:
        requestBody.shippingFee,
      domesticShippingFee,

      vat: taxAmounts.vat,
      importTax: taxAmounts.importTax,

      totalAmount,

      depositPercent: 70,
      depositAmount: Math.round(
        totalAmount * 0.7
      ),

      note: requestBody.note,
      items,
      additionalFees,

      createdAt,

      /* Báo giá mua hộ có hiệu lực 5 ngày, đúng như bộ báo giá mẫu. */
      expiredAt: new Date(
        toTime(createdAt) +
          5 * 24 * 60 * 60 * 1000
      ).toISOString(),
    };

    request.quotation = quotation;
    request.quotationCreatedAt =
      createdAt;
    request.status =
      PURCHASE_REQUEST_STATUS.QUOTATION_SENT;
    request.statusDisplayName = "";
    request.statusUpdatedAt =
      createdAt;

    return {
      ...deepClone(quotation),

      message:
        "Báo giá mua hộ đã được gửi lên hệ thống.",
    };
  };

/* =========================================================
   CONFIRM PURCHASE
   PUT /api/purchase-requests/{purchaseRequestId}/confirm-purchase
========================================================= */

/**
 * THẬT: PUT /api/purchase-requests/{purchaseRequestId}/confirm-purchase — trả về
 * getResponseData(response).
 *
 * Nơi gọi cập nhật lạc quan bằng `data?.status` rồi tải lại chi tiết, nên bản ghi trong
 * bộ nhớ phải được ghi thật; không ghi là trạng thái nhảy về giá trị cũ ngay sau toast.
 */
export const confirmPurchaseApi = async (purchaseRequestId, payload = {}) => {
  const normalizedId = validatePurchaseRequestId(purchaseRequestId);

  const requestBody = {
    status: normalizeUpperText(payload?.status || "PURCHASED"),
    proofImages: Array.isArray(payload?.proofImages)
      ? payload.proofImages.map(normalizeText).filter(Boolean)
      : [],
    generalNote: normalizeText(payload?.generalNote) || null,
  };

  await delay();

  const request = requirePurchaseRequest(normalizedId);

  const statusUpdatedAt = nowIso();

  request.status = requestBody.status;

  /* Trạng thái mới do người dùng chọn, để rỗng nhãn cho từng màn tự dịch theo bộ nhãn
     riêng của nó (danh sách và chi tiết dùng hai cách diễn đạt khác nhau). */
  request.statusDisplayName = "";
  request.statusUpdatedAt = statusUpdatedAt;

  /* Ảnh bằng chứng gộp thêm, không ghi đè: mỗi lần cập nhật tiến độ là một đợt ảnh. */
  if (requestBody.proofImages.length > 0) {
    request.proofImages = [
      ...(Array.isArray(request.proofImages) ? request.proofImages : []),
      ...requestBody.proofImages,
    ];
  }

  if (requestBody.generalNote) {
    request.generalNote = requestBody.generalNote;
  }

  return {
    ...normalizePurchaseRequestDetail(deepClone(request)),

    message: "Đã cập nhật tiến độ mua hộ.",
  };
};

/* =========================================================
   DEFAULT EXPORT
========================================================= */

/* Giữ nguyên đường re-export của bản thật: OperationsPurchaseStorePage nhập hàm này
   trực tiếp từ ./confirmPurchaseApi, nhưng bề mặt public của module không được thiếu. */

const purchaseRequestService = {
  normalizeCreatePurchaseRequestPayload,
  createPurchaseRequestApi,
  getPurchaseRequestsApi,
  getPurchaseRequestDetailApi,
  createPurchaseRequestQuotationApi,
  confirmPurchaseApi,
};

export default purchaseRequestService;
