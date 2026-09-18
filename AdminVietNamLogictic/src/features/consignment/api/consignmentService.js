/**
 * ĐƠN KÝ GỬI (Sale / Admin) — ĐÃ NỐI API THẬT (đợt báo giá ký gửi).
 *
 * Các API được nối trong đợt này:
 *   GET  /api/orders/consignments?orderType=CONSIGNMENT&status=&pageNumber=&pageSize=&searchCode=
 *        → { message, data: { items, totalCount, pageNumber, pageSize, totalPages } }
 *   GET  /api/orders/consignments/{orderId}
 *        → { message, data } — kèm items[].packageConfiguration và items[].services
 *   PUT  /api/orders/consignments/{orderId}/status
 *        → { message, status, consignmentCode, receiptPdfUrl }
 *   POST /api/orders/{orderId}/quotation/send
 *        → { message, status, consignment }
 *
 * BA THAY ĐỔI NGHIỆP VỤ PHẢI NHỚ (backend đã đổi, không phải lỗi giao diện):
 *
 * 1. KHÔNG CÒN bước "Duyệt đơn". PUT .../status chỉ nhận `REJECTED` hoặc
 *    `NEED_MORE_INFO`, và BẮT BUỘC có `rejectionReason`. Gửi `APPROVED` bị 400,
 *    nên normalizeConsignmentStatusPayload chặn ngay tại giao diện để người dùng
 *    thấy câu tiếng Việt thay vì lỗi server.
 * 2. Danh sách LUÔN phải truyền `orderType=CONSIGNMENT`, nếu không đơn mua hộ
 *    (mã PUR-) lẫn vào màn ký gửi.
 * 3. Báo giá: dịch vụ theo từng kiện và phí thùng gỗ do HỆ THỐNG tự tính, Sale
 *    không nhập lại. Dòng phí có `orderItemId` là lệnh SỬA tiền dịch vụ của
 *    đúng kiện đó. Sửa khác bảng giá (lệch > 1đ) thì bắt buộc có `overrideReason`
 *    (hoặc salesNote) và báo giá chuyển `PENDING_PRICE_APPROVAL` chờ Admin duyệt
 *    — khách CHƯA thấy bản đó.
 *
 * NGOÀI PHẠM VI ĐỢT NÀY: createConsignmentApi / validateConsignmentItemsApi /
 * estimateQuotationApi / approveConsignmentApi. Màn "Sale tạo đơn hộ khách" vẫn
 * chạy dữ liệu mẫu qua ./consignmentService.mock.js, nên bốn hàm này ở bản THẬT
 * ném lỗi có nội dung rõ ràng thay vì im lặng gọi sai endpoint. Tên export và thứ
 * tự tham số giữ nguyên để hợp đồng api-contract.json không vỡ.
 *
 * Mọi hàm chuẩn hoá thuần (normalize* / calculate* / convert*) giữ nguyên từng
 * dòng: chúng là nơi duy nhất chặn dữ liệu sai trước khi gửi đi.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getPagedData,
  getResponseData,
  removeEmptyParams as dropEmptyParams,
} from "@shared/api/apiEnvelope";

import {
  getOrderStatusLabel,
  normalizeOrderStatus,
} from "../constants/orderStatus";

import { getConsignmentReceiptApi } from "./consignmentReceiptService";


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

/* =========================
   NHÃN TRẠNG THÁI

   Danh sách và màn chi tiết ưu tiên statusDisplayName hơn mã trạng thái, nên mọi
   chỗ đọc nhãn đều đi qua module trạng thái đơn dùng chung
   (constants/orderStatus.js — file này được so byte giữa ba app, đừng sửa).
========================= */

const statusDisplayNameOf = (status) =>
  getOrderStatusLabel(status);

/*
 * Tiền do Sale ghi đè: `null` nghĩa là "không ghi đè, để backend tự tính".
 * normalizePositiveNumber trả 0 cho giá trị trống, mà 0 với backend vẫn là một
 * con số hợp lệ — nên thuế phải dùng hàm riêng này.
 */
const normalizeNullableMoney = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
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
/* =========================
   MAP DỮ LIỆU TRẢ VỀ

   Giữ đúng phép chuẩn hoá của bản thật: spread bản ghi gốc trước rồi ghi đè các khoá
   đã chuẩn hoá, để khoá phụ (statusDisplayName, orderCode, shipments, receiptPdfUrl...)
   vẫn tới được component.
========================= */

const mapListItem = (item = {}) => ({
  ...item,

  orderId: normalizeText(
    item?.orderId ?? item?.id
  ),

  consignmentCode: normalizeText(
    item?.consignmentCode
  ),

  customerName: normalizeText(
    item?.customerName
  ),

  consignmentType: normalizeText(
    item?.consignmentType
  ),

  status: normalizeText(
    item?.status
  ).toUpperCase(),

  totalWeight: normalizePositiveNumber(
    item?.totalWeight
  ),

  totalVolume: normalizePositiveNumber(
    item?.totalVolume
  ),

  route: normalizeText(item?.route),

  receiverName: normalizeText(
    item?.receiverName
  ),

  receiverPhone: normalizeText(
    item?.receiverPhone
  ),

  receiverAddress: normalizeText(
    item?.receiverAddress
  ),

  requiresInspection: Boolean(
    item?.requiresInspection
  ),

  createdAt: normalizeText(
    item?.createdAt
  ),

  warehouseId:
    normalizeText(item?.warehouseId) ||
    null,

  pricingRuleIds: Array.isArray(
    item?.pricingRuleIds
  )
    ? item.pricingRuleIds
        .map(normalizeText)
        .filter(Boolean)
    : [],

  itemNames: Array.isArray(
    item?.itemNames
  )
    ? item.itemNames
        .map(normalizeText)
        .filter(Boolean)
    : [],
});

const mapDetail = (data = {}) => ({
  ...data,

  orderId: normalizeText(
    data?.orderId ?? data?.id
  ),

  consignmentCode: normalizeText(
    data?.consignmentCode
  ),

  status: normalizeText(
    data?.status ??
      data?.orderStatus ??
      data?.consignmentStatus
  ).toUpperCase(),

  consignmentType: normalizeText(
    data?.consignmentType
  ),

  orderType: normalizeText(
    data?.orderType
  ).toUpperCase(),

  totalWeight: normalizePositiveNumber(
    data?.totalWeight
  ),

  totalVolume: normalizePositiveNumber(
    data?.totalVolume
  ),

  route: normalizeText(data?.route),

  receiverName: normalizeText(
    data?.receiverName
  ),

  receiverPhone: normalizeText(
    data?.receiverPhone
  ),

  receiverAddress: normalizeText(
    data?.receiverAddress
  ),

  requiresInspection: Boolean(
    data?.requiresInspection
  ),

  warehouseId:
    normalizeText(data?.warehouseId) ||
    null,

  pricingRuleIds: Array.isArray(
    data?.pricingRuleIds
  )
    ? data.pricingRuleIds
        .map(normalizeText)
        .filter(Boolean)
    : [],

  itemNames: Array.isArray(
    data?.itemNames
  )
    ? data.itemNames
        .map(normalizeText)
        .filter(Boolean)
    : [],

  items: Array.isArray(data?.items)
    ? data.items
    : [],

  customer:
    data?.customer &&
    typeof data.customer === "object"
      ? data.customer
      : null,

  quotation:
    data?.quotation &&
    typeof data.quotation === "object"
      ? data.quotation
      : null,
});
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

  return additionalFees.map((fee) => {
    const orderItemId = normalizeText(
      fee?.orderItemId
    );

    const row = {
      feeId: normalizeText(fee?.feeId),
      code: normalizeText(fee?.code),
      label: normalizeText(fee?.label),
      amount: normalizePositiveNumber(
        fee?.amount
      ),
      enabled:
        fee?.enabled !== false,
    };

    /*
     * Dòng CÓ orderItemId là lệnh sửa số tiền dịch vụ của ĐÚNG kiện đó
     * (enabled: false = miễn phí dịch vụ). Dòng KHÔNG có orderItemId là phụ phí
     * cả đơn. Gửi nhầm orderItemId rỗng lên là backend hiểu thành phí cả đơn,
     * nên chỉ đính khoá này khi thật sự có giá trị.
     */
    return orderItemId
      ? { ...row, orderItemId }
      : row;
  });
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

    /*
     * Lý do Sale nhập giá khác bảng giá. Backend BẮT BUỘC có overrideReason
     * (hoặc salesNote) khi phát hiện giá ngoại lệ, nếu không sẽ trả 400.
     */
    overrideReason: normalizeText(
      payload?.overrideReason
    ),

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
      /*
       * vat / importTax chỉ được gửi khi Sale THẬT SỰ ghi đè. Backend coi
       * "> 0 và lệch số tính theo cấu hình" là giá ngoại lệ phải chờ Admin
       * duyệt; gửi 0 hoặc gửi lại đúng số cũ thì không sao, nhưng gửi null là
       * cách duy nhất nói rõ "để hệ thống tự tính".
       */
      vat: normalizeNullableMoney(
        quotation?.vat
      ),
      importTax:
        normalizeNullableMoney(
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

   Backend ĐÃ BỎ bước "Duyệt đơn": PUT /api/orders/consignments/{id}/status chỉ
   nhận REJECTED hoặc NEED_MORE_INFO và BẮT BUỘC có lý do (từ chối hay xin bổ
   sung mà không nói lý do thì khách không biết phải làm gì). Gửi APPROVED bị
   400 — chặn ngay ở đây để người dùng thấy câu tiếng Việt.
========================= */

const REVIEW_STATUSES = new Set([
  "NEED_MORE_INFO",
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
        status === "APPROVED"
          ? "Hệ thống đã bỏ bước duyệt đơn. Sale gửi báo giá trực tiếp, hoặc chọn Yêu cầu bổ sung / Từ chối."
          : "Trạng thái chỉ được phép là NEED_MORE_INFO hoặc REJECTED."
      );
    }

    if (rejectionReason.length < 3) {
      throw new Error(
        status === "REJECTED"
          ? "Vui lòng nhập lý do từ chối ít nhất 3 ký tự."
          : "Vui lòng nhập nội dung cần khách bổ sung, ít nhất 3 ký tự."
      );
    }

    return {
      status,
      rejectionReason,
    };
  };

/* =========================
   LẤY DANH SÁCH ĐƠN KÝ GỬI
========================= */

const LIST_KEYWORD_FIELDS = [
  "consignmentCode",
  "orderCode",
  "trackingCode",
  "customerName",
  "customerPhone",
  "receiverName",
  "receiverPhone",
  "receiverAddress",
  "route",
  "itemNames",
];

const toTime = (value) => {
  const time = new Date(
    value ?? 0
  ).getTime();

  return Number.isFinite(time)
    ? time
    : 0;
};

/*
 * Bộ lọc backend CHƯA nhận (từ khoá tự do, loại dịch vụ, kho, khoảng ngày) được
 * áp lại trên trang vừa tải. Bỏ hẳn thì các ô lọc đó im lặng ngừng hoạt động;
 * lọc ở đây thì ít nhất trang đang xem đúng, còn tổng số vẫn là số của server.
 */
const matchesLocalFilters = (row, filters = {}) => {
  const keyword = normalizeText(
    filters?.keyword ??
      filters?.search ??
      filters?.searchText ??
      filters?.q
  );

  if (
    keyword &&
    !matchesKeyword(row, keyword, LIST_KEYWORD_FIELDS)
  ) {
    return false;
  }

  const consignmentType = normalizeText(
    filters?.consignmentType
  ).toUpperCase();

  if (
    consignmentType &&
    normalizeText(row?.consignmentType).toUpperCase() !==
      consignmentType
  ) {
    return false;
  }

  const warehouseId = normalizeText(
    filters?.warehouseId
  );

  if (
    warehouseId &&
    normalizeText(row?.warehouseId) !== warehouseId
  ) {
    return false;
  }

  const createdTime = toTime(row?.createdAt);

  if (
    filters?.fromDate &&
    createdTime < toTime(filters.fromDate)
  ) {
    return false;
  }

  if (
    filters?.toDate &&
    createdTime > toTime(filters.toDate)
  ) {
    return false;
  }

  return true;
};

/* So khớp từ khoá không dấu trên vài trường của dòng danh sách. */
const toSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const matchesKeyword = (record, keyword, fields = []) => {
  const needle = toSearchText(keyword);

  if (!needle) return true;

  return fields.some((field) => {
    const value = record?.[field];

    if (Array.isArray(value)) {
      return value.some((entry) =>
        toSearchText(entry).includes(needle)
      );
    }

    return toSearchText(value).includes(needle);
  });
};


/* =========================
   DANH SÁCH ĐƠN KÝ GỬI
========================= */

/*
 * GET /api/orders/consignments — LUÔN kèm orderType=CONSIGNMENT.
 *
 * Backend chỉ hiểu bốn tham số: status, searchCode, pageNumber, pageSize. Các bộ
 * lọc còn lại của giao diện (từ khoá tự do, loại dịch vụ, kho, khoảng ngày) được
 * áp TẠI CHỖ trên trang vừa tải về — chấp nhận được vì cả hai màn dùng hàm này
 * đều lọc theo trạng thái ở server trước, rồi mới lọc mịn trên trang.
 *
 * Trả về đúng hình dạng cũ: { items, totalCount, pageNumber, pageSize, totalPages }.
 */
export const getConsignmentsApi =
  async (filters = {}) => {
    const pageNumber =
      filters?.pageNumber ??
      filters?.page ??
      1;

    const pageSize =
      filters?.pageSize ??
      filters?.limit ??
      10;

    /* Mã trạng thái cũ trong bookmark được chuẩn hoá về mã đích trước khi gửi. */
    const status = normalizeText(
      normalizeOrderStatus(filters?.status)
    ).toUpperCase();

    const searchCode = normalizeText(
      filters?.searchCode ??
        filters?.keyword ??
        filters?.search ??
        filters?.searchText ??
        filters?.q
    );

    const response = await httpClient.get(
      API_ENDPOINTS.consignments.list,
      {
        params: dropEmptyParams({
          orderType: "CONSIGNMENT",
          status:
            status && status !== "ALL"
              ? status
              : undefined,
          searchCode,
          pageNumber,
          pageSize,
        }),
        signal: filters?.signal,
      }
    );

    const page = getPagedData(
      getResponseData(response),
      { pageNumber, pageSize }
    );

    const rows = page.items
      .map(mapListItem)
      .filter((row) =>
        matchesLocalFilters(row, filters)
      );

    return {
      ...page,
      items: rows,
    };
  };

/* =========================
   CHI TIẾT ĐƠN KÝ GỬI
========================= */

/*
 * GET /api/orders/consignments/{orderId} → { message, data }.
 *
 * `data.items[]` mang theo `packageConfiguration` (thùng gỗ khách chọn) và
 * `services[]` (dịch vụ theo từng kiện). Màn chi tiết và màn lập báo giá đều
 * đọc hai khoá đó, nên mapDetail chỉ chuẩn hoá phần header và giữ nguyên items.
 */
export const getConsignmentDetailApi =
  async (orderId) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const response = await httpClient.get(
      API_ENDPOINTS.consignments.detail(
        normalizedOrderId
      )
    );

    const data = getResponseData(response);

    if (!data || typeof data !== "object") {
      throw new Error(
        "Không đọc được chi tiết đơn ký gửi."
      );
    }

    return mapDetail(data);
  };

/* =========================
   CẬP NHẬT TRẠNG THÁI ĐƠN
   Chỉ NEED_MORE_INFO / REJECTED — xem ghi chú đầu file.
========================= */

export const updateConsignmentStatusApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeConsignmentStatusPayload(
        requestPayload
      );

    const response = await httpClient.put(
      API_ENDPOINTS.consignments.status(
        normalizedOrderId
      ),
      payload
    );

    /* Controller trả thẳng { message, status, consignmentCode, receiptPdfUrl }. */
    const body = response?.data ?? {};

    return {
      orderId: normalizedOrderId,
      consignmentCode: normalizeText(
        body?.consignmentCode
      ),
      status:
        normalizeText(body?.status).toUpperCase() ||
        payload.status,
      statusDisplayName:
        statusDisplayNameOf(
          body?.status || payload.status
        ),
      rejectionReason:
        payload.rejectionReason,
      receiptPdfUrl:
        normalizeText(body?.receiptPdfUrl) ||
        null,
      success: true,
      message:
        normalizeText(body?.message) ||
        "Cập nhật trạng thái thành công.",
    };
  };

export const rejectConsignmentApi =
  async (orderId, rejectionReason) =>
    updateConsignmentStatusApi(orderId, {
      status: "REJECTED",
      rejectionReason,
    });

/* =========================
   GỬI BÁO GIÁ CHÍNH THỨC
========================= */

/*
 * POST /api/orders/{orderId}/quotation/send
 *
 * Thân request đúng hợp đồng backend — CHỈ những khoá backend đọc:
 *   { warehouseId, servicePricingId, serviceType, weightKg, volumeM3,
 *     packageCount, declaredValue, salesNote, overrideReason,
 *     quotation: { additionalFees: [...], vat, importTax, ... } }
 *
 * Những con số khác mà màn lập báo giá tính ở client (cước, phí đóng gói, tổng
 * tiền) KHÔNG được gửi: backend tính lại toàn bộ theo bảng giá. Gửi lên chỉ
 * khiến mọi báo giá bị coi là "giá ngoại lệ" và kẹt chờ Admin duyệt.
 *
 * Trả về nguyên { message, status, consignment } vì `status` quyết định câu
 * thông báo: `QUOTATION_SENT` (khách đã thấy) hay `PENDING_PRICE_APPROVAL`
 * (chờ Admin duyệt giá, khách chưa thấy).
 */
export const sendQuotationApi =
  async (orderId, requestPayload) => {
    const normalizedOrderId =
      normalizeOrderId(orderId);

    const payload =
      normalizeQuotationPayload(
        requestPayload
      );

    validateQuotationPayload(payload);

    const response = await httpClient.post(
      API_ENDPOINTS.consignments.sendQuotation(
        normalizedOrderId
      ),
      dropEmptyParams({
        warehouseId: payload.warehouseId,
        servicePricingId:
          payload.servicePricingId,
        serviceType: payload.serviceType,
        weightKg: payload.weightKg,
        volumeM3: payload.volumeM3,
        packageCount: payload.packageCount,
        declaredValue:
          payload.declaredValue,
        salesNote: payload.salesNote,
        overrideReason:
          payload.overrideReason,

        quotation: {
          servicePricingId:
            payload.quotation
              .servicePricingId,
          serviceType:
            payload.quotation.serviceType,
          additionalFees:
            payload.quotation
              .additionalFees,

          /* null = để backend tự tính theo cấu hình thuế. */
          vat: payload.quotation.vat,
          importTax:
            payload.quotation.importTax,

          salesNote:
            payload.quotation.salesNote,
        },
      })
    );

    const body = response?.data ?? {};

    return {
      message: normalizeText(body?.message),
      status: normalizeText(
        body?.status
      ).toUpperCase(),
      consignment:
        body?.consignment ?? null,
    };
  };


/* =========================
   NGOÀI PHẠM VI ĐỢT NÀY

   Bốn hàm dưới đây thuộc màn "Sale tạo đơn hộ khách" và bước báo giá tạm tính —
   chưa nằm trong đợt nối API này. Màn đó đang trỏ vào ./consignmentService.mock.js
   nên không hàm nào ở đây bị gọi lúc chạy; giữ export để hợp đồng API không vỡ,
   và ném lỗi rõ ràng để lần sau không ai vô tình dùng nhầm.
========================= */

const outOfScope = (name, hint) => {
  const error = new Error(
    `${name} chưa được nối API thật trong đợt báo giá ký gửi. ${hint}`
  );

  error.code = "API_NOT_WIRED";

  return error;
};

export const createConsignmentApi = async (payload = {}) => {
  /* Vẫn chuẩn hoá trước để lỗi dữ liệu lộ ra ngay, đúng thứ tự của bản cũ. */
  normalizeCreateConsignmentPayload(payload);

  throw outOfScope(
    "createConsignmentApi",
    "Sale tạo đơn hộ khách dùng POST /api/staff/consignments — sẽ nối ở đợt sau."
  );
};

export const validateConsignmentItemsApi = async (items = []) => {
  void items;

  throw outOfScope(
    "validateConsignmentItemsApi",
    "Kiểm hàng cấm dùng POST /api/orders/consignments/validate-items — sẽ nối ở đợt sau."
  );
};

export const estimateQuotationApi = async (orderId, requestPayload) => {
  void orderId;
  void requestPayload;

  throw outOfScope(
    "estimateQuotationApi",
    "Backend không còn API báo giá tạm tính cho Sale: bản nháp được sinh sẵn khi khách tạo đơn, đọc qua getOrderQuotationApi của quotationService."
  );
};

export const approveConsignmentApi = async (orderId) => {
  void orderId;

  throw outOfScope(
    "approveConsignmentApi",
    "Backend đã bỏ bước duyệt đơn: Sale xem xong báo giá luôn, hoặc yêu cầu bổ sung / từ chối."
  );
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
