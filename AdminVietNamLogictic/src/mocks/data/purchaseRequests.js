/**
 * Bộ yêu cầu MUA HỘ mẫu — nguồn dữ liệu duy nhất cho mọi mock liên quan đến mua hộ.
 *
 * Được dùng chéo bởi purchase, admin (chỉ xem), history, documents và settlement, nên
 * purchaseRequestId / purchaseCode phải ỔN ĐỊNH: chúng là khoá điều hướng
 * (`/sale/purchase-requests/:purchaseRequestId`) và khoá tra cứu chéo giữa các màn.
 *
 * Hình dạng lấy đúng theo purchaseRequestService.js: normalizePurchaseRequestListItem
 * cho danh sách và normalizePurchaseRequestDetail cho chi tiết. Một bản ghi phục vụ cả
 * hai, vì danh sách chỉ đọc phần nông.
 *
 * ID KHO VÀ ID CẤU HÌNH PHÍ PHẢI LẤY TỪ mocks/data/catalog, KHÔNG lấy từ consignments.js.
 * Lý do: warehouseService.getActiveWarehousesApi và pricingRuleService.getActivePricingRulesApi
 * đều phục vụ đúng hai mảng `warehouses` / `pricingRules` của catalog, còn màn hình thì đối
 * chiếu id của đơn với danh sách tải từ hai API đó:
 *   - PurchaseRequestDetail so detail.pricingRuleIds với rule tải về; không khớp id là cả
 *     khối "CẤU HÌNH PHÍ DỊCH VỤ" bị ẩn (điều kiện render là pricingRuleRows.length > 0).
 *   - ConfirmPurchaseModal đặt value của ô "Kho nhận hàng dự kiến" bằng detail.warehouseId;
 *     id không có trong options thì Select hiện thẳng chuỗi UUID thay vì tên kho, và lúc
 *     submit không tra ra được warehouseName để gửi lên.
 * Bộ hằng số PRICING_RULE_IDS / WAREHOUSES của consignments.js là hệ id RIÊNG của fixture ký
 * gửi, không có mặt trong catalog — dùng lại ở đây là hai lỗi rỗng màn kể trên.
 *
 * Loại hàng vẫn dùng PRODUCT_TYPES của consignments.js: màn mua hộ chỉ hiện productType như
 * một mã để sao chép ("Mã loại hàng"), không tra tên theo id, nên đổi hệ id không mang lại
 * gì mà lại làm lệch tên loại hàng đang dùng chéo với fixture ký gửi.
 *
 * HAI CHỖ DỄ SAI HÌNH DẠNG, đã đối chiếu với component tiêu thụ:
 *   1. QuotationView đối soát productsSubtotal + tổng additionalFees với totalAmount và
 *      bật cảnh báo "Tổng báo giá chưa khớp" nếu lệch quá 1 ₫. Vì vậy MỌI khoản phí
 *      (phí mua hộ, phí vận chuyển, VAT, thuế nhập khẩu, thùng gỗ, bảo hiểm) đều phải
 *      xuất hiện trong additionalFees, không chỉ nằm ở các khoá tổng.
 *   2. quotation.items[].purchaseRequestItemId phải trùng items[].itemId của yêu cầu,
 *      vì màn lập báo giá lấy id này để gửi lại payload.
 */

import {
  isoDaysAgo,
  isoHoursAgo,
  normalizeText,
} from "@/mocks/mockUtils";

import { PRODUCT_TYPES } from "./consignments";

import {
  findPricingRuleByCode,
  warehouses as CATALOG_WAREHOUSES,
} from "./catalog";

/* =========================================================
   ID
========================================================= */

const uuidOf = (groupHex, index) =>
  `${groupHex}-0000-4000-8000-${String(
    index
  ).padStart(12, "0")}`;

const productTypeByKey = (key) =>
  PRODUCT_TYPES.find(
    (type) => type.key === key
  ) || PRODUCT_TYPES[0];

/**
 * Tra kho theo mã trong CHÍNH bộ kho mà warehouseService phục vụ.
 *
 * Mã ở đây là mã catalog ("CN-GZ-01", "VN-HN-01"), không phải mã tự đặt kiểu "WH-CN-GZ":
 * tra không ra thì rơi về kho đầu tiên, và id kho của đơn lại lệch khỏi danh sách kho mà
 * ConfirmPurchaseModal tải về.
 */
const warehouseByCode = (code) =>
  CATALOG_WAREHOUSES.find(
    (warehouse) =>
      warehouse.code === code
  ) || CATALOG_WAREHOUSES[0];

/** Kho đích mặc định khi kho nguồn nằm ở Trung Quốc — lấy đúng kho tổng Hà Nội của catalog. */
const DEFAULT_DESTINATION_WAREHOUSE =
  warehouseByCode("VN-HN-01");

/**
 * Id cấu hình phí, tra theo ruleCode trong catalog.
 *
 * Tra theo mã chứ không ghim id: admin mock có CRUD trên cùng mảng pricingRules, nên mã là
 * thứ ổn định duy nhất. Không tra ra thì trả rỗng để bộ lọc `.filter(Boolean)` bên dưới loại
 * luôn — thà thiếu một dòng phí còn hơn đưa một id rác vào pricingRuleIds.
 */
const ruleIdByCode = (code) =>
  findPricingRuleByCode(code)?.id || "";

const PRICING_RULE_IDS = {
  WOOD_CRATE: ruleIdByCode("WOOD_CRATE"),
  DOMESTIC_FEE: ruleIdByCode("DOMESTIC_FEE"),
  VAT: ruleIdByCode("VAT"),
  IMPORT_TAX: ruleIdByCode("IMPORT_TAX"),
  SUR_INSURANCE_3PERCENT: ruleIdByCode(
    "SUR_INSURANCE_3PERCENT"
  ),
};

/**
 * Phí mua hộ không có mã trong PRICING_RULE_CODE của hệ thống (bộ mã đó chỉ phủ
 * phụ phí vận chuyển). Vẫn cần một id riêng vì QuotationView dùng fee.id làm React
 * key: cho nó trùng id của một khoản khác là hai dòng phụ phí đè key lên nhau.
 */
const PURCHASE_SERVICE_FEE_RULE_ID =
  uuidOf("aaaa0008", 8);

/* =========================================================
   KHÁCH HÀNG VÀ NGƯỜI NHẬN
========================================================= */

export const PURCHASE_CUSTOMERS = [
  {
    customerId: uuidOf("c0570101", 1),
    customerCode: "CUS-000201",
    fullName: "Đỗ Thanh Huyền",
    email: "huyen.do@vcl-demo.vn",
    phone: "0905112233",
  },
  {
    customerId: uuidOf("c0570102", 2),
    customerCode: "CUS-000202",
    fullName: "Nguyễn Bá Long",
    email: "long.nguyen@vcl-demo.vn",
    phone: "0913445566",
  },
  {
    customerId: uuidOf("c0570103", 3),
    customerCode: "CUS-000203",
    fullName: "Lý Thị Cẩm Tú",
    email: "tu.ly@vcl-demo.vn",
    phone: "0978223344",
  },
  {
    customerId: uuidOf("c0570104", 4),
    customerCode: "CUS-000204",
    fullName: "Phan Đức Thắng",
    email: "thang.phan@vcl-demo.vn",
    phone: "0934667788",
  },
  {
    customerId: uuidOf("c0570105", 5),
    customerCode: "CUS-000205",
    fullName: "Vũ Thị Hồng Nhung",
    email: "nhung.vu@vcl-demo.vn",
    phone: "0967889900",
  },
  {
    customerId: uuidOf("c0570106", 6),
    customerCode: "CUS-000206",
    fullName: "Hồ Gia Bảo",
    email: "bao.ho@vcl-demo.vn",
    phone: "0942001122",
  },
];

/** Nhân sự nội bộ tạo hộ yêu cầu — hiện ở ô "Người tạo" của màn chi tiết. */
const SALE_STAFF = [
  "Sale Nguyễn Hữu Phát",
  "Sale Trần Khánh Ly",
  "Sale Lâm Quốc Hưng",
];

const RECEIVERS = [
  {
    name: "Đỗ Thanh Huyền",
    phone: "0905112233",
    address:
      "58 Nguyễn Thị Minh Khai, phường Đa Kao, quận 1, TP Hồ Chí Minh",
  },
  {
    name: "Nguyễn Bá Long",
    phone: "0913445566",
    address:
      "124 Xuân Thủy, phường Dịch Vọng Hậu, quận Cầu Giấy, Hà Nội",
  },
  {
    name: "Lý Thị Cẩm Tú",
    phone: "0978223344",
    address:
      "77 Hai Bà Trưng, phường Thạch Thang, quận Hải Châu, Đà Nẵng",
  },
  {
    name: "Phan Đức Thắng",
    phone: "0934667788",
    address:
      "9 Nguyễn Huệ, phường Vĩnh Bảo, TP Rạch Giá, Kiên Giang",
  },
  {
    name: "Vũ Thị Hồng Nhung",
    phone: "0967889900",
    address:
      "185 Quang Trung, phường Quang Vinh, TP Biên Hòa, Đồng Nai",
  },
  {
    name: "Hồ Gia Bảo",
    phone: "0942001122",
    address:
      "43 Lê Duẩn, phường Tân An, TP Buôn Ma Thuột, Đắk Lắk",
  },
  {
    name: "Mai Thị Lan Anh",
    phone: "0928556677",
    address:
      "312 Nguyễn Văn Cừ, phường An Hòa, quận Ninh Kiều, Cần Thơ",
  },
  {
    name: "Chu Văn Kiên",
    phone: "0956778899",
    address:
      "64 Trần Nguyên Hãn, phường Lê Lợi, TP Hải Phòng",
  },
];

/* =========================================================
   ẢNH — data URI để bản UI-only không phụ thuộc mạng
========================================================= */

const mockPhoto = (
  label,
  background = "#e2e8f0"
) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">` +
      `<rect width="320" height="240" fill="${background}"/>` +
      `<rect x="12" y="12" width="296" height="216" fill="none" stroke="#94a3b8" stroke-width="2"/>` +
      `<text x="160" y="128" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="#0f172a" text-anchor="middle">${label}</text>` +
      `</svg>`
  )}`;

/* =========================================================
   FACTORY SẢN PHẨM CẦN MUA HỘ
========================================================= */

let itemSequence = 0;

const makeItem = ({
  productName,
  productTypeKey,
  quantity,
  unitPrice,
  productLink,
  sourceWebsite,
  attributes = "",
  note = "",
  photoLabels = [],
  photoColor = "#e2e8f0",
}) => {
  itemSequence += 1;

  const productType = productTypeByKey(
    productTypeKey
  );

  const photos = (
    photoLabels.length > 0
      ? photoLabels
      : [productName]
  ).map((label) =>
    mockPhoto(label, photoColor)
  );

  return {
    itemId: uuidOf(
      "17e10000",
      itemSequence
    ),

    productLink,
    sourceWebsite,

    /* API trả productType là mã loại hàng; màn chi tiết hiện nó ở ô "Mã loại hàng"
       kèm nút sao chép, nên phải là UUID chứ không phải tên tiếng Việt. */
    productType: productType.id,
    productTypeName: productType.name,

    productName,
    quantity,
    attributes,
    note,
    imageUrls: photos,

    /* Đơn giá tham chiếu khách khảo giá; báo giá lấy con số này làm mức khởi điểm. */
    referenceUnitPrice: unitPrice,
  };
};

/* =========================================================
   FACTORY BÁO GIÁ MUA HỘ
========================================================= */

let quotationSequence = 0;

const buildQuotation = (
  request,
  {
    status = "PENDING_CUSTOMER_CONFIRMATION",
    purchaseFeeRate = 0.05,
    shippingFee = 1250000,
    vatRate = 0.08,
    importTaxRate = 0.1,
    woodCrateFee = 0,
    insuranceRate = 0,
    createdDaysAgo = 1,
    note = "Đơn giá đã gồm phí thanh toán hộ tại Trung Quốc, chưa gồm phát sinh kiểm hoá.",
  } = {}
) => {
  quotationSequence += 1;

  const items = request.items.map(
    (item, index) => ({
      quotationItemId: uuidOf(
        "9c1a0000",
        quotationSequence * 100 +
          index +
          1
      ),

      /* Bắt buộc trùng itemId của yêu cầu — màn lập báo giá gửi lại chính id này. */
      purchaseRequestItemId:
        item.itemId,

      productName: item.productName,
      unitPrice:
        item.referenceUnitPrice,
      quantity: item.quantity,
      lineTotal:
        item.referenceUnitPrice *
        item.quantity,
    })
  );

  const productsSubtotal = items.reduce(
    (total, item) =>
      total + item.lineTotal,
    0
  );

  const purchaseFee = Math.round(
    productsSubtotal * purchaseFeeRate
  );

  const vat = Math.round(
    (purchaseFee + shippingFee) *
      vatRate
  );

  const importTax = Math.round(
    productsSubtotal * importTaxRate
  );

  const insuranceFee = Math.round(
    productsSubtotal * insuranceRate
  );

  /* Mọi khoản phí đều phải có mặt ở đây, nếu không phần đối soát của QuotationView
     sẽ báo lệch giữa "productsSubtotal + phụ phí" và totalAmount. */
  const additionalFees = [
    {
      id: PURCHASE_SERVICE_FEE_RULE_ID,
      pricingRuleId:
        PURCHASE_SERVICE_FEE_RULE_ID,
      feeName: "Phí mua hộ",
      feeType: "SERVICE_FEE",
      calculationType: "PERCENTAGE",
      value: purchaseFeeRate * 100,
      amount: purchaseFee,
      note: "Tính trên tổng tiền hàng",
    },
    {
      id: PRICING_RULE_IDS.DOMESTIC_FEE,
      pricingRuleId:
        PRICING_RULE_IDS.DOMESTIC_FEE,
      feeName:
        "Phí vận chuyển Trung Quốc - Việt Nam",
      feeType: "MAIN_SERVICE",
      calculationType: "FIXED",
      value: shippingFee,
      amount: shippingFee,
      note: "Gồm chặng nội địa Trung Quốc và chặng quốc tế",
    },
    {
      id: PRICING_RULE_IDS.IMPORT_TAX,
      pricingRuleId:
        PRICING_RULE_IDS.IMPORT_TAX,
      feeName: "Thuế nhập khẩu",
      feeType: "TAX",
      calculationType: "PERCENTAGE",
      value: importTaxRate * 100,
      amount: importTax,
      note: "Tính trên giá trị hàng khai báo",
    },
    {
      id: PRICING_RULE_IDS.VAT,
      pricingRuleId:
        PRICING_RULE_IDS.VAT,
      feeName:
        "Thuế giá trị gia tăng",
      feeType: "TAX",
      calculationType: "PERCENTAGE",
      value: vatRate * 100,
      amount: vat,
      note: "Tính trên phí mua hộ và phí vận chuyển",
    },
  ];

  if (woodCrateFee > 0) {
    additionalFees.push({
      id: PRICING_RULE_IDS.WOOD_CRATE,
      pricingRuleId:
        PRICING_RULE_IDS.WOOD_CRATE,
      feeName: "Đóng thùng gỗ",
      feeType: "WOOD_BOX",
      calculationType: "FIXED",
      value: woodCrateFee,
      amount: woodCrateFee,
      note: "Khách yêu cầu đóng thùng gỗ chống va đập",
    });
  }

  if (insuranceFee > 0) {
    additionalFees.push({
      id: PRICING_RULE_IDS.SUR_INSURANCE_3PERCENT,
      pricingRuleId:
        PRICING_RULE_IDS.SUR_INSURANCE_3PERCENT,
      feeName: "Bảo hiểm hàng hóa",
      feeType: "INSURANCE",
      calculationType: "PERCENTAGE",
      value: insuranceRate * 100,
      amount: insuranceFee,
      note: "Tính trên tổng tiền hàng",
    });
  }

  const additionalFeeTotal =
    additionalFees.reduce(
      (total, fee) =>
        total + fee.amount,
      0
    );

  return {
    quotationId: uuidOf(
      "9c1a0000",
      quotationSequence
    ),
    id: uuidOf(
      "9c1a0000",
      quotationSequence
    ),

    purchaseRequestId:
      request.purchaseRequestId,
    purchaseCode: request.purchaseCode,

    status,

    productsSubtotal,
    purchaseFee,
    shippingFee,
    vat,
    importTax,

    /* Bằng đúng productsSubtotal + tổng phụ phí để không bật cảnh báo đối soát. */
    totalAmount:
      productsSubtotal +
      additionalFeeTotal,

    depositPercent: 70,
    depositAmount: Math.round(
      (productsSubtotal +
        additionalFeeTotal) *
        0.7
    ),

    note,
    items,
    additionalFees,

    createdAt: isoDaysAgo(
      createdDaysAgo
    ),
    expiredAt: isoDaysAgo(
      createdDaysAgo - 5
    ),
  };
};

/* =========================================================
   FACTORY LÔ VẬN CHUYỂN

   Hình dạng của ShipmentJourney.jsx: group -> parcels -> inspection.
========================================================= */

let shipmentSequence = 0;

const makeShipment = ({
  code,
  status,
  statusText,
  /* Tên kho lấy đúng theo catalog để một kho không mang hai tên giữa khối thông tin đơn
     và khối hành trình lô hàng trên cùng màn chi tiết. */
  originWarehouseName = warehouseByCode(
    "CN-GZ-01"
  ).name,
  destinationWarehouseName = DEFAULT_DESTINATION_WAREHOUSE.name,
  carrierTrackingCode = null,
  shippedAt = null,
  deliveredAt = null,
  parcels = [],
}) => {
  shipmentSequence += 1;

  return {
    shipmentId: uuidOf(
      "5b110000",
      shipmentSequence
    ),
    shipmentCode: code,
    status,
    statusText,
    originWarehouseName,
    destinationWarehouseName,
    carrierTrackingCode,
    shippedAt,
    deliveredAt,

    parcels: parcels.map(
      (parcel, index) => ({
        parcelId: uuidOf(
          "9a4d0000",
          shipmentSequence * 100 +
            index +
            1
        ),
        packageCode: parcel.code,
        status:
          parcel.status ||
          "IN_TRANSIT",
        statusText:
          parcel.statusText ||
          "Đang vận chuyển",
        weight: parcel.weight ?? 0,
        destinationHandling:
          parcel.destinationHandling ||
          "DIRECT_DELIVERY",
        destinationHandlingText:
          parcel.destinationHandlingText ||
          "Giao ngay khi hàng về Việt Nam",
        inspection:
          parcel.inspection ?? null,
      })
    ),
  };
};

/* =========================================================
   FACTORY YÊU CẦU MUA HỘ
========================================================= */

let requestSequence = 0;

const makePurchaseRequest = ({
  code,
  status,

  /*
   * Để trống statusDisplayName cho hầu hết bản ghi: màn danh sách và màn chi tiết
   * cố tình dùng hai cách diễn đạt khác nhau cho cùng một mã trạng thái ("Chờ xác
   * nhận" và "Đặt đơn hàng (Chờ duyệt)"), và cả hai chỉ tự dịch khi trường này rỗng.
   * Chỉ khai tay với mã mà màn danh sách chưa có nhãn, ví dụ PROCESSING — bỏ trống
   * là dropdown lọc hiện chuỗi mã viết thường trông như lỗi.
   */
  statusDisplayName = "",

  shippingOption = "STANDARD",
  customerIndex = 0,
  receiverIndex = 0,
  staffIndex = 0,
  warehouseCode = "CN-GZ-01",
  route = "CN → VN",
  requiresPacking = true,
  requiresWoodenCrate = false,
  requiresInsurance = false,
  generalNote = "",
  reason = null,
  createdDaysAgo = 3,
  statusUpdatedHoursAgo = 6,
  proofLabels = [],
  items = [],
  quotationOptions = null,
  shipments = [],
}) => {
  requestSequence += 1;

  const purchaseRequestId = uuidOf(
    "0deb0000",
    requestSequence
  );

  const customer =
    PURCHASE_CUSTOMERS[
      customerIndex %
        PURCHASE_CUSTOMERS.length
    ];

  const receiver =
    RECEIVERS[
      receiverIndex % RECEIVERS.length
    ];

  const warehouse =
    warehouseByCode(warehouseCode);

  const request = {
    purchaseRequestId,
    id: purchaseRequestId,

    purchaseCode: code,
    code,

    status,
    statusDisplayName,

    route,
    shippingOption,

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
      SALE_STAFF[
        staffIndex % SALE_STAFF.length
      ],

    receiverName: receiver.name,
    receiverPhone: receiver.phone,
    receiverAddress: receiver.address,

    warehouseId: warehouse.id,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,

    /* Màn chi tiết dò lần lượt warehouseName -> destinationWarehouseName ->
       originWarehouseName, nên khai cả ba để không rơi về "—". */
    originWarehouseName:
      warehouse.name,
    destinationWarehouseName:
      warehouse.country === "VN"
        ? warehouse.name
        : DEFAULT_DESTINATION_WAREHOUSE.name,

    requiresPacking,
    requiresWoodenCrate,
    requiresInsurance,

    pricingRuleIds: [
      PRICING_RULE_IDS.DOMESTIC_FEE,
      PRICING_RULE_IDS.VAT,
      PRICING_RULE_IDS.IMPORT_TAX,
      ...(requiresWoodenCrate
        ? [PRICING_RULE_IDS.WOOD_CRATE]
        : []),
      ...(requiresInsurance
        ? [
            PRICING_RULE_IDS.SUR_INSURANCE_3PERCENT,
          ]
        : []),
      /* Bỏ id rỗng: ruleIdByCode trả "" khi catalog không còn mã đó, và một chuỗi rỗng
         trong danh sách sẽ được màn chi tiết đếm là "1 cấu hình đã chọn" mà không có dòng. */
    ].filter(Boolean),

    generalNote,
    reason,

    itemCount: items.length,
    totalQuantity: items.reduce(
      (total, item) =>
        total + item.quantity,
      0
    ),

    /* Null có chủ ý, giống consignments.js: bản UI-only không sinh được file PDF thật, mà
       màn Giấy tờ đã có nhánh dự phòng sạch — "Xem trước" mở luôn modal chi tiết, "Tải phiếu"
       báo "Chưa có phiếu PDF". Ghi một URL giả vào đây thì <object type="application/pdf">
       hiện khung trắng, tệ hơn nhánh dự phòng. */
    receiptPdfUrl: null,

    proofImages: proofLabels.map(
      (label) =>
        mockPhoto(label, "#fef3c7")
    ),

    createdAt: isoDaysAgo(
      createdDaysAgo
    ),
    statusUpdatedAt: isoHoursAgo(
      statusUpdatedHoursAgo
    ),
    quotationCreatedAt: null,

    items,
    shipments,
    quotation: null,
  };

  if (quotationOptions) {
    request.quotation = buildQuotation(
      request,
      quotationOptions
    );

    request.quotationCreatedAt =
      request.quotation.createdAt;
  }

  return request;
};

/* =========================================================
   SẢN PHẨM MẪU
========================================================= */

const airFryerItem = () =>
  makeItem({
    productName:
      "Nồi chiên không dầu 5.5L cảm ứng",
    productTypeKey: "HOUSEWARE",
    quantity: 12,
    unitPrice: 1180000,
    productLink:
      "https://detail.1688.com/offer/712345678901.html",
    sourceWebsite: "1688.com",
    attributes:
      "Màu đen, điện 220V, phích cắm chuẩn Việt Nam",
    note: "Nhờ shop tháo pin rời khỏi hộp trước khi gửi kho.",
    photoLabels: [
      "Nồi chiên 5.5L",
      "Bảng điều khiển",
    ],
    photoColor: "#dcfce7",
  });

const bagItem = () =>
  makeItem({
    productName:
      "Túi xách da nữ khoá xoay",
    productTypeKey: "APPAREL",
    quantity: 30,
    unitPrice: 385000,
    productLink:
      "https://item.taobao.com/item.htm?id=680123456789",
    sourceWebsite: "taobao.com",
    attributes:
      "Màu be và nâu, mỗi màu 15 chiếc",
    photoColor: "#fae8ff",
  });

const powerBankItem = () =>
  makeItem({
    productName:
      "Sạc dự phòng 20000mAh sạc nhanh 22.5W",
    productTypeKey: "ELECTRONICS",
    quantity: 50,
    unitPrice: 268000,
    productLink:
      "https://detail.1688.com/offer/723456789012.html",
    sourceWebsite: "1688.com",
    attributes:
      "Vỏ nhựa nhám, có chứng nhận CE",
    note: "Hàng pin, cần đi tuyến chuyên pin.",
    photoColor: "#dbeafe",
  });

const kitchenSetItem = () =>
  makeItem({
    productName:
      "Bộ dao thớt nhà bếp 9 chi tiết",
    productTypeKey: "HOUSEWARE",
    quantity: 25,
    unitPrice: 420000,
    productLink:
      "https://detail.tmall.com/item.htm?id=690112233445",
    sourceWebsite: "tmall.com",
    attributes:
      "Thép không gỉ, tay cầm gỗ",
    photoColor: "#f1f5f9",
  });

const toyCarItem = () =>
  makeItem({
    productName:
      "Xe điều khiển địa hình tỉ lệ 1:16",
    productTypeKey: "TOY",
    quantity: 40,
    unitPrice: 315000,
    productLink:
      "https://detail.1688.com/offer/734567890123.html",
    sourceWebsite: "1688.com",
    attributes:
      "Hai màu xanh và đỏ, kèm pin sạc",
    photoColor: "#ffedd5",
  });

const serumItem = () =>
  makeItem({
    productName:
      "Serum dưỡng ẩm HA 30ml",
    productTypeKey: "COSMETIC",
    quantity: 120,
    unitPrice: 96000,
    productLink:
      "https://mobile.yangkeduo.com/goods.html?goods_id=550112233",
    sourceWebsite: "pinduoduo.com",
    attributes:
      "Hạn dùng còn tối thiểu 24 tháng",
    note: "Yêu cầu shop bọc chống sốc từng chai.",
    photoColor: "#fce7f3",
  });

const cncMotorItem = () =>
  makeItem({
    productName:
      "Động cơ bước NEMA 23 kèm driver",
    productTypeKey: "MECHANICAL",
    quantity: 18,
    unitPrice: 745000,
    productLink:
      "https://detail.1688.com/offer/745678901234.html",
    sourceWebsite: "1688.com",
    attributes:
      "Trục 8mm, dòng 3A, kèm cáp 2m",
    photoColor: "#e2e8f0",
  });

const phoneCaseItem = () =>
  makeItem({
    productName:
      "Ốp lưng silicon chống sốc nhiều mẫu",
    productTypeKey: "ACCESSORY",
    quantity: 400,
    unitPrice: 21000,
    productLink:
      "https://item.taobao.com/item.htm?id=681223344556",
    sourceWebsite: "taobao.com",
    attributes:
      "Trộn mẫu theo lô, không chọn hình",
    photoColor: "#ede9fe",
  });

const officeChairItem = () =>
  makeItem({
    productName:
      "Ghế xoay văn phòng lưng lưới",
    productTypeKey: "HOUSEWARE",
    quantity: 6,
    unitPrice: 1420000,
    productLink:
      "https://detail.1688.com/offer/756789012345.html",
    sourceWebsite: "1688.com",
    attributes:
      "Khung thép, tay gập, tải 120kg",
    note: "Hàng khổ lớn, cần đóng thùng gỗ.",
    photoColor: "#e7e5e4",
  });

const ledStripItem = () =>
  makeItem({
    productName:
      "Đèn LED dây COB 5m 24V",
    productTypeKey: "ELECTRONICS",
    quantity: 80,
    unitPrice: 118000,
    productLink:
      "https://detail.1688.com/offer/767890123456.html",
    sourceWebsite: "1688.com",
    attributes:
      "Ánh sáng vàng 3000K, kèm nguồn",
    photoColor: "#fef9c3",
  });

const sportShoeItem = () =>
  makeItem({
    productName:
      "Giày chạy bộ đế êm size 38-44",
    productTypeKey: "APPAREL",
    quantity: 36,
    unitPrice: 356000,
    productLink:
      "https://detail.tmall.com/item.htm?id=691223344556",
    sourceWebsite: "tmall.com",
    attributes:
      "Chia đều size, ưu tiên 41 và 42",
    photoColor: "#fee2e2",
  });

const watchItem = () =>
  makeItem({
    productName:
      "Đồng hồ thông minh chống nước IP68",
    productTypeKey: "ELECTRONICS",
    quantity: 45,
    unitPrice: 452000,
    productLink:
      "https://detail.1688.com/offer/778901234567.html",
    sourceWebsite: "1688.com",
    attributes:
      "Dây silicon, hai màu đen và hồng",
    photoColor: "#cffafe",
  });

/* =========================================================
   BỘ 21 YÊU CẦU MUA HỘ

   Mỗi trạng thái xuất hiện đúng một lần. Dropdown lọc trạng thái của
   PurchaseRequestList được dựng từ chính dữ liệu này (nạp pageSize 1000 rồi gom
   status), nên phủ đủ trạng thái ở đây đồng nghĩa mọi tab đều có ít nhất một dòng.

   Ba trạng thái đầu (PENDING_REVIEW, IN_REVIEW, APPROVED) cố tình để quotation null:
   nút "Tạo báo giá" của màn chi tiết chỉ bật khi đơn ở một trong ba trạng thái đó và
   chưa có báo giá.
========================================================= */

export const purchaseRequests = [
  makePurchaseRequest({
    code: "PUR-20260902081522-410233",
    status: "PENDING_REVIEW",
    customerIndex: 0,
    receiverIndex: 0,
    staffIndex: 0,
    createdDaysAgo: 0.3,
    statusUpdatedHoursAgo: 7,
    generalNote:
      "Khách cần gấp cho đợt khai trương, ưu tiên xử lý trong ngày.",
    items: [
      airFryerItem(),
      kitchenSetItem(),
    ],
  }),

  makePurchaseRequest({
    code: "PUR-20260902102244-418907",
    status: "IN_REVIEW",
    customerIndex: 1,
    receiverIndex: 1,
    staffIndex: 1,
    createdDaysAgo: 0.7,
    statusUpdatedHoursAgo: 11,
    generalNote:
      "Đang chờ shop xác nhận còn đủ 50 chiếc.",
    items: [powerBankItem()],
  }),

  makePurchaseRequest({
    code: "PUR-20260901134810-425518",
    status: "APPROVED",
    customerIndex: 2,
    receiverIndex: 2,
    staffIndex: 2,
    createdDaysAgo: 1.4,
    statusUpdatedHoursAgo: 18,
    requiresInsurance: true,
    generalNote:
      "Đã duyệt, chờ Sale lập báo giá chính thức.",
    items: [
      serumItem(),
      phoneCaseItem(),
    ],
  }),

  makePurchaseRequest({
    code: "PUR-20260901090133-431260",
    status: "NEED_MORE_INFO",
    customerIndex: 3,
    receiverIndex: 3,
    staffIndex: 0,
    createdDaysAgo: 1.9,
    statusUpdatedHoursAgo: 22,
    reason:
      "Liên kết sản phẩm đã hết hàng, cần khách gửi lại link khác.",
    items: [toyCarItem()],
  }),

  makePurchaseRequest({
    code: "PUR-20260831154905-440871",
    status: "DRAFT",
    customerIndex: 4,
    receiverIndex: 4,
    staffIndex: 1,
    createdDaysAgo: 2.3,
    statusUpdatedHoursAgo: 26,
    generalNote:
      "Bản nháp khách tự lưu, chưa gửi đi.",
    items: [ledStripItem()],
  }),

  makePurchaseRequest({
    code: "PUR-20260830112017-452344",
    status: "QUOTED",
    customerIndex: 5,
    receiverIndex: 5,
    staffIndex: 2,
    createdDaysAgo: 3.2,
    statusUpdatedHoursAgo: 29,
    items: [
      bagItem(),
      sportShoeItem(),
    ],
    quotationOptions: {
      status:
        "PENDING_CUSTOMER_CONFIRMATION",
      createdDaysAgo: 2.6,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260829143352-460917",
    status: "QUOTATION_SENT",
    customerIndex: 0,
    receiverIndex: 6,
    staffIndex: 0,
    createdDaysAgo: 4.1,
    statusUpdatedHoursAgo: 33,
    items: [watchItem()],
    quotationOptions: {
      status:
        "PENDING_CUSTOMER_CONFIRMATION",
      createdDaysAgo: 3.5,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260828101244-471530",
    status: "QUOTATION_CONFIRMED",
    shippingOption: "EXPRESS",
    customerIndex: 1,
    receiverIndex: 7,
    staffIndex: 1,
    createdDaysAgo: 5.2,
    statusUpdatedHoursAgo: 37,
    items: [
      airFryerItem(),
      ledStripItem(),
    ],
    quotationOptions: {
      status: "CUSTOMER_CONFIRMED",
      createdDaysAgo: 4.6,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260827092911-480166",
    status: "WAITING_PAYMENT",
    customerIndex: 2,
    receiverIndex: 0,
    staffIndex: 2,
    createdDaysAgo: 6.3,
    statusUpdatedHoursAgo: 41,
    items: [cncMotorItem()],
    quotationOptions: {
      status: "ACCEPTED",
      createdDaysAgo: 5.7,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260826155406-492703",
    status: "WAITING_DEPOSIT",
    customerIndex: 3,
    receiverIndex: 1,
    staffIndex: 0,
    createdDaysAgo: 7.4,
    statusUpdatedHoursAgo: 45,
    requiresWoodenCrate: true,
    items: [officeChairItem()],
    quotationOptions: {
      status: "ACCEPTED",
      createdDaysAgo: 6.8,
      woodCrateFee: 650000,
      shippingFee: 2450000,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260825104128-503349",
    status: "DEPOSIT_PAID",
    customerIndex: 4,
    receiverIndex: 2,
    staffIndex: 1,
    createdDaysAgo: 8.6,
    statusUpdatedHoursAgo: 49,
    items: [
      serumItem(),
      bagItem(),
    ],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 8.0,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260824131044-511982",
    status: "PAID",
    customerIndex: 5,
    receiverIndex: 3,
    staffIndex: 2,
    createdDaysAgo: 9.5,
    statusUpdatedHoursAgo: 53,
    items: [phoneCaseItem()],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 8.9,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260823093515-524617",
    status: "PURCHASED",
    customerIndex: 0,
    receiverIndex: 4,
    staffIndex: 0,
    createdDaysAgo: 10.7,
    statusUpdatedHoursAgo: 20,
    proofLabels: [
      "Hóa đơn 1688 - 12 nồi chiên",
      "Xác nhận thanh toán Alipay",
    ],
    generalNote:
      "Đã đặt hàng ngày 23/08, shop hẹn phát trong 48 giờ.",
    items: [
      airFryerItem(),
      kitchenSetItem(),
    ],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 10.1,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260822150803-533250",
    status: "SELLER_SHIPPED",
    customerIndex: 1,
    receiverIndex: 5,
    staffIndex: 1,
    createdDaysAgo: 11.8,
    statusUpdatedHoursAgo: 15,
    proofLabels: [
      "Vận đơn nội địa SF Express",
    ],
    generalNote:
      "Shop đã phát hàng, mã nội địa SF7788990011.",
    items: [toyCarItem()],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 11.2,
    },
  }),

  makePurchaseRequest({
    code: "PUR-20260821112239-545883",
    status: "ARRIVED_ORIGIN_WAREHOUSE",
    customerIndex: 2,
    receiverIndex: 6,
    staffIndex: 2,
    warehouseCode: "CN-YW-01",
    createdDaysAgo: 13.1,
    statusUpdatedHoursAgo: 12,
    proofLabels: [
      "Hóa đơn Taobao - 400 ốp lưng",
    ],
    items: [
      phoneCaseItem(),
      ledStripItem(),
    ],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 12.5,
    },
    shipments: [
      makeShipment({
        code: "SHP-20260821112239-700114",
        status: "CREATED",
        statusText: "Đã lập lô",
        originWarehouseName:
          warehouseByCode("CN-YW-01")
            .name,
        parcels: [
          {
            code: "PCL-20260821112239-800221",
            status: "IN_TRANSIT",
            statusText:
              "Đã nhận tại kho Nghĩa Ô",
            weight: 14.6,
          },
          {
            code: "PCL-20260821112239-800222",
            status: "IN_TRANSIT",
            statusText:
              "Đã nhận tại kho Nghĩa Ô",
            weight: 9.2,
          },
        ],
      }),
    ],
  }),

  makePurchaseRequest({
    code: "PUR-20260820094512-558426",
    status: "PROCESSING",
    statusDisplayName: "Đang xử lý",
    customerIndex: 3,
    receiverIndex: 7,
    staffIndex: 0,
    createdDaysAgo: 14.4,
    statusUpdatedHoursAgo: 9,
    proofLabels: [
      "Hóa đơn 1688 - 18 động cơ bước",
    ],
    generalNote:
      "Kho Trung Quốc đang gom đủ kiện để xếp lô.",
    items: [cncMotorItem()],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 13.8,
    },
    shipments: [
      makeShipment({
        code: "SHP-20260820094512-700226",
        status: "READY_TO_SHIP",
        statusText:
          "Chờ xuất lô về Việt Nam",
        parcels: [
          {
            code: "PCL-20260820094512-800331",
            status: "IN_TRANSIT",
            statusText:
              "Đã đóng lô, chờ xuất",
            weight: 22.4,
          },
        ],
      }),
    ],
  }),

  makePurchaseRequest({
    code: "PUR-20260819141805-566059",
    status: "WAITING_STORED",
    customerIndex: 4,
    receiverIndex: 0,
    staffIndex: 1,
    createdDaysAgo: 16.2,
    statusUpdatedHoursAgo: 8,
    proofLabels: [
      "Hóa đơn Tmall - 36 đôi giày",
    ],
    items: [
      sportShoeItem(),
      bagItem(),
    ],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 15.6,
    },
    shipments: [
      makeShipment({
        code: "SHP-20260819141805-700338",
        status: "ARRIVED_VN",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-881122338",
        shippedAt: isoDaysAgo(6.8),
        deliveredAt: isoDaysAgo(1.3),
        parcels: [
          {
            code: "PCL-20260819141805-800441",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Chờ lập phiếu nhập kho",
            weight: 18.9,
            destinationHandling:
              "STORE_AT_VN",
            destinationHandlingText:
              "Gửi lại kho Việt Nam",
            inspection: {
              hasDiscrepancy: false,
              summary:
                "Đủ 36 đôi, đúng bảng size",
              note: "",
              inspectedAt:
                isoHoursAgo(30),
            },
          },
          {
            code: "PCL-20260819141805-800442",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Chờ lập phiếu nhập kho",
            weight: 11.4,
            destinationHandling:
              "STORE_AT_VN",
            destinationHandlingText:
              "Gửi lại kho Việt Nam",
          },
        ],
      }),
    ],
  }),

  makePurchaseRequest({
    code: "PUR-20260817103322-578692",
    status: "STORED",
    customerIndex: 5,
    receiverIndex: 1,
    staffIndex: 2,
    createdDaysAgo: 18.5,
    statusUpdatedHoursAgo: 34,
    proofLabels: [
      "Hóa đơn Pinduoduo - 120 serum",
    ],
    generalNote:
      "Khách xin lưu kho Hà Nội thêm 15 ngày.",
    items: [serumItem()],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 17.9,
    },
    shipments: [
      makeShipment({
        code: "SHP-20260817103322-700440",
        status: "ARRIVED",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-881233440",
        shippedAt: isoDaysAgo(9.4),
        deliveredAt: isoDaysAgo(2.7),
        parcels: [
          {
            code: "PCL-20260817103322-800551",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Đã lưu kho Hà Nội",
            weight: 13.8,
            destinationHandling:
              "STORE_AT_VN",
            destinationHandlingText:
              "Gửi lại kho Việt Nam",
            inspection: {
              hasDiscrepancy: false,
              summary:
                "Đủ 120 chai, không rò rỉ",
              note: "",
              inspectedAt:
                isoHoursAgo(62),
            },
          },
        ],
      }),
    ],
  }),

  makePurchaseRequest({
    code: "PUR-20260814092044-590135",
    status: "COMPLETED",
    customerIndex: 0,
    receiverIndex: 2,
    staffIndex: 0,
    createdDaysAgo: 22.6,
    statusUpdatedHoursAgo: 70,
    proofLabels: [
      "Hóa đơn 1688 - 45 đồng hồ",
      "Biên nhận giao hàng nội địa",
    ],
    items: [
      watchItem(),
      powerBankItem(),
    ],
    quotationOptions: {
      status: "CONFIRMED",
      createdDaysAgo: 22.0,
    },
    shipments: [
      makeShipment({
        code: "SHP-20260814092044-700542",
        status: "ARRIVED",
        statusText:
          "Đã hoàn tất hành trình",
        destinationWarehouseName:
          warehouseByCode("VN-SG-01")
            .name,
        carrierTrackingCode:
          "CNVN-881344542",
        shippedAt: isoDaysAgo(14.2),
        deliveredAt: isoDaysAgo(5.6),
        parcels: [
          {
            code: "PCL-20260814092044-800661",
            status: "DELIVERED",
            statusText:
              "Đã giao và ký nhận",
            weight: 10.7,
          },
          {
            code: "PCL-20260814092044-800662",
            status: "DELIVERED",
            statusText:
              "Đã giao và ký nhận",
            weight: 16.3,
          },
        ],
      }),
    ],
  }),

  makePurchaseRequest({
    code: "PUR-20260812153911-601778",
    status: "REJECTED",
    customerIndex: 1,
    receiverIndex: 3,
    staffIndex: 1,
    createdDaysAgo: 24.8,
    statusUpdatedHoursAgo: 78,
    reason:
      "Mặt hàng thuộc nhóm pin rời không có chứng nhận, không nhận mua hộ.",
    items: [powerBankItem()],
  }),

  makePurchaseRequest({
    code: "PUR-20260810111436-613411",
    status: "CANCELLED",
    customerIndex: 2,
    receiverIndex: 4,
    staffIndex: 2,
    createdDaysAgo: 27.3,
    statusUpdatedHoursAgo: 86,
    reason:
      "Khách tự huỷ vì tỷ giá tăng, sẽ đặt lại vào tháng sau.",
    items: [
      officeChairItem(),
      kitchenSetItem(),
    ],
  }),
];

/* =========================================================
   SELECTOR
========================================================= */

/**
 * Tra yêu cầu theo id điều hướng.
 *
 * Route truyền purchaseRequestId, nhưng một số chỗ giữ `id` hoặc chỉ có mã đơn
 * (màn Giấy tờ, state của navigate). Nhận cả ba để màn chi tiết không báo
 * "Không tìm thấy purchaseRequestId".
 */
export const findPurchaseRequestById =
  (purchaseRequestId) => {
    const needle = String(
      purchaseRequestId ?? ""
    )
      .trim()
      .toLowerCase();

    if (!needle) {
      return null;
    }

    return (
      purchaseRequests.find(
        (request) =>
          request.purchaseRequestId.toLowerCase() ===
            needle ||
          request.purchaseCode.toLowerCase() ===
            needle
      ) || null
    );
  };

/** Tra theo mã yêu cầu mua hộ, không phân biệt hoa thường. */
export const findPurchaseRequestByCode =
  (code) => {
    const needle = String(code ?? "")
      .trim()
      .toLowerCase();

    if (!needle) {
      return null;
    }

    return (
      purchaseRequests.find(
        (request) =>
          request.purchaseCode.toLowerCase() ===
          needle
      ) || null
    );
  };

/**
 * Lọc theo trạng thái.
 *
 * "ALL" và giá trị rỗng trả toàn bộ, vì các màn dùng chung một hàm cho cả tab
 * "Tất cả trạng thái" lẫn tab cụ thể.
 */
export const findPurchaseRequestsByStatus =
  (status) => {
    const needle = normalizeText(
      status
    ).toUpperCase();

    if (!needle || needle === "ALL") {
      return [...purchaseRequests];
    }

    return purchaseRequests.filter(
      (request) =>
        String(request.status)
          .trim()
          .toUpperCase() === needle
    );
  };

/** Danh sách mã trạng thái đang có dữ liệu — tiện cho mock dashboard đếm theo tab. */
export const PURCHASE_REQUEST_STATUSES =
  Array.from(
    new Set(
      purchaseRequests.map(
        (request) => request.status
      )
    )
  );

export default purchaseRequests;
