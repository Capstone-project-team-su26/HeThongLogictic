/**
 * Bộ đơn KÝ GỬI mẫu — nguồn dữ liệu duy nhất cho mọi mock liên quan đến ký gửi.
 *
 * Được dùng chéo bởi consignment, admin (chỉ xem), history, documents, payment và
 * settlement, nên orderId / consignmentCode phải ỔN ĐỊNH: chúng là khoá điều hướng
 * (`/sale/consignments/:orderId`) và là khoá tra cứu chéo giữa các màn. Vì vậy id ở
 * đây được sinh theo khuôn cố định thay vì random mỗi lần nạp module.
 *
 * Hình dạng bản ghi lấy đúng theo consignmentService.js: một bản ghi vừa đủ cho
 * getConsignmentsApi (danh sách) lẫn getConsignmentDetailApi (chi tiết). Danh sách
 * chỉ đọc phần nông nên khoá dư của chi tiết không gây hại; ngược lại thiếu một khoá
 * chi tiết là màn chi tiết trắng.
 *
 * BA CHỖ DỄ SAI HÌNH DẠNG, đã đối chiếu với component tiêu thụ:
 *   1. totalVolume tính bằng cm³ (KHÔNG phải m³). PendingConsignmentList và
 *      ConsignmentDetail đều đọc totalVolume như cm³ rồi tự chia 1.000.000 khi cần
 *      hiển thị m³. Trả m³ ở đây thì thể tích hiện ra bé đi một triệu lần.
 *   2. Thể tích và khối lượng của kiện KHÔNG nhân số lượng: calculateItemVolumeCm3
 *      coi mỗi dòng là một kiện. Tổng ở đây được tính đúng theo cách đó để phần
 *      "TỔNG CỘNG" của bảng kiện hàng khớp với ô tổng phía trên.
 *   3. Báo giá phải thoả totalEstimatedCost = freight + domestic + service + tax,
 *      vì ConsignmentDetail đối soát đúng bốn khoản này rồi báo "Tổng báo giá đang
 *      lệch" nếu chênh quá 1 ₫.
 */

import {
  isoDaysAgo,
  isoHoursAgo,
  normalizeText,
} from "@/mocks/mockUtils";

import {
  findPricingRuleByCode,
  volumetricDivisor,
} from "@/mocks/data/catalog";

/* =========================================================
   ID DÙNG CHUNG GIỮA CÁC MOCK

   Kho, loại hàng, cấu hình đóng gói và cấu hình phí đều nằm ở mock khác nhưng
   được tra cứu bằng id từ đơn hàng. Gom hằng số ở đây và export ra để mock nào
   cần cũng dùng đúng một bộ id — lệch id là màn hình hiện "Chưa phân loại",
   "—" hoặc bỏ trắng khoản phí.
========================================================= */

/** UUID có khuôn hợp lệ theo UUID_PATTERN của service thật, nhưng đọc được bằng mắt. */
const uuidOf = (groupHex, index) =>
  `${groupHex}-0000-4000-8000-${String(
    index
  ).padStart(12, "0")}`;

export const PRICING_RULE_IDS = {
  WOOD_CRATE: uuidOf("aaaa0001", 1),
  DOMESTIC_FEE: uuidOf("aaaa0002", 2),
  VAT: uuidOf("aaaa0003", 3),
  VOLUMETRIC_DIVISOR: uuidOf(
    "aaaa0004",
    4
  ),
  SUR_INSPECTION: uuidOf("aaaa0005", 5),
  IMPORT_TAX: uuidOf("aaaa0006", 6),
  SUR_INSURANCE_3PERCENT: uuidOf(
    "aaaa0007",
    7
  ),
};

/**
 * Hệ số quy đổi thể tích của hệ thống — ĐỌC TỪ catalog `pricingRules`
 * (rule VOLUMETRIC_DIVISOR), không khai lại con số ở đây.
 *
 * Mỗi kiện đã mang sẵn volumetricWeight nên màn chi tiết không phụ thuộc mock
 * cấu hình phí để hiện DIM. Giữ tên export cũ để mock nào đang import vẫn chạy.
 */
export const VOLUMETRIC_DIVISOR = volumetricDivisor;

/**
 * Tỷ lệ cọc (%) lúc dựng bộ mẫu — đọc rule DEPOSIT_RATE của catalog `pricingRules`.
 * Catalog luôn khai rule này; thiếu thì báo giá mẫu không có cọc thay vì bịa con số.
 */
const SEED_DEPOSIT_PERCENT =
  Number(findPricingRuleByCode("DEPOSIT_RATE")?.value) || 0;

export const WAREHOUSES = [
  {
    id: uuidOf("bbbb0001", 1),
    code: "WH-CN-GZ",
    name: "Kho Quảng Châu",
    country: "CN",
    region: "CN",
  },
  {
    id: uuidOf("bbbb0002", 2),
    code: "WH-CN-YW",
    name: "Kho Nghĩa Ô",
    country: "CN",
    region: "CN",
  },
  {
    id: uuidOf("bbbb0003", 3),
    code: "WH-VN-HN",
    name: "Kho Hà Nội",
    country: "VN",
    region: "VN",
  },
  {
    id: uuidOf("bbbb0004", 4),
    code: "WH-VN-SG",
    name: "Kho Hồ Chí Minh",
    country: "VN",
    region: "VN",
  },
];

const warehouseByCode = (code) =>
  WAREHOUSES.find(
    (warehouse) =>
      warehouse.code === code
  ) || WAREHOUSES[0];

export const PRODUCT_TYPES = [
  {
    id: uuidOf("dddd0001", 1),
    key: "ELECTRONICS",
    name: "Điện tử",
  },
  {
    id: uuidOf("dddd0002", 2),
    key: "APPAREL",
    name: "May mặc",
  },
  {
    id: uuidOf("dddd0003", 3),
    key: "HOUSEWARE",
    name: "Gia dụng",
  },
  {
    id: uuidOf("dddd0004", 4),
    key: "MECHANICAL",
    name: "Cơ khí",
  },
  {
    id: uuidOf("dddd0005", 5),
    key: "TOY",
    name: "Đồ chơi",
  },
  {
    id: uuidOf("dddd0006", 6),
    key: "COSMETIC",
    name: "Mỹ phẩm",
  },
  {
    id: uuidOf("dddd0007", 7),
    key: "ACCESSORY",
    name: "Phụ kiện",
  },
];

const productTypeByKey = (key) =>
  PRODUCT_TYPES.find(
    (type) => type.key === key
  ) || PRODUCT_TYPES[0];

export const PACKAGE_CONFIGURATIONS = [
  {
    id: uuidOf("eeee0001", 1),
    configCode: "SMALL",
    configName: "Thùng nhỏ",
    length: 30,
    width: 25,
    height: 20,
    maxWeight: 5,
    packageFee: 25000,
    maxFee: 0,
    status: "ACTIVE",
  },
  {
    id: uuidOf("eeee0002", 2),
    configCode: "MEDIUM",
    configName: "Thùng vừa",
    length: 45,
    width: 35,
    height: 30,
    maxWeight: 15,
    packageFee: 45000,
    maxFee: 0,
    status: "ACTIVE",
  },
  {
    id: uuidOf("eeee0003", 3),
    configCode: "LARGE",
    configName: "Thùng lớn",
    length: 60,
    width: 45,
    height: 40,
    maxWeight: 30,
    packageFee: 75000,
    maxFee: 0,
    status: "ACTIVE",
  },
  {
    id: uuidOf("eeee0004", 4),
    configCode: "CUSTOM",
    configName:
      "Đóng gói theo kích thước thực tế",
    length: 0,
    width: 0,
    height: 0,
    maxWeight: 0,
    /* CUSTOM tính theo 1.000 cm³ nên packageFee là đơn giá, không phải phí trọn gói. */
    packageFee: 1200,
    maxFee: 900000,
    status: "ACTIVE",
  },
];

const packageConfigByCode = (code) =>
  PACKAGE_CONFIGURATIONS.find(
    (config) =>
      config.configCode === code
  ) || PACKAGE_CONFIGURATIONS[1];

/* =========================================================
   KHÁCH HÀNG
========================================================= */

export const CONSIGNMENT_CUSTOMERS = [
  {
    customerId: uuidOf("c0570001", 1),
    customerCode: "CUS-000101",
    fullName: "Nguyễn Thị Bích Hằng",
    email: "hang.nguyen@vcl-demo.vn",
    phone: "0903456781",
  },
  {
    customerId: uuidOf("c0570002", 2),
    customerCode: "CUS-000102",
    fullName: "Trần Quốc Duy",
    email: "duy.tran@vcl-demo.vn",
    phone: "0912345672",
  },
  {
    customerId: uuidOf("c0570003", 3),
    customerCode: "CUS-000103",
    fullName: "Lê Minh Khoa",
    email: "khoa.le@vcl-demo.vn",
    phone: "0987654323",
  },
  {
    customerId: uuidOf("c0570004", 4),
    customerCode: "CUS-000104",
    fullName: "Phạm Thu Trang",
    email: "trang.pham@vcl-demo.vn",
    phone: "0938271644",
  },
  {
    customerId: uuidOf("c0570005", 5),
    customerCode: "CUS-000105",
    fullName: "Võ Hoàng Nam",
    email: "nam.vo@vcl-demo.vn",
    phone: "0977112235",
  },
  {
    customerId: uuidOf("c0570006", 6),
    customerCode: "CUS-000106",
    fullName: "Đặng Thị Kim Ngân",
    email: "ngan.dang@vcl-demo.vn",
    phone: "0965883126",
  },
  {
    customerId: uuidOf("c0570007", 7),
    customerCode: "CUS-000107",
    fullName: "Bùi Anh Tuấn",
    email: "tuan.bui@vcl-demo.vn",
    phone: "0946225507",
  },
  {
    customerId: uuidOf("c0570008", 8),
    customerCode: "CUS-000108",
    fullName: "Hoàng Thị Mỹ Duyên",
    email: "duyen.hoang@vcl-demo.vn",
    phone: "0932004488",
  },
];

const RECEIVERS = [
  {
    name: "Nguyễn Thị Bích Hằng",
    phone: "0903456781",
    address:
      "72 Nguyễn Trãi, phường Thanh Xuân Trung, quận Thanh Xuân, Hà Nội",
  },
  {
    name: "Trần Quốc Duy",
    phone: "0912345672",
    address:
      "145 Lê Lợi, phường Bến Thành, quận 1, TP Hồ Chí Minh",
  },
  {
    name: "Lê Minh Khoa",
    phone: "0987654323",
    address:
      "38 Trần Phú, phường Điện Biên, quận Ba Đình, Hà Nội",
  },
  {
    name: "Phạm Thu Trang",
    phone: "0938271644",
    address:
      "210 Nguyễn Văn Linh, phường Nam Dương, quận Hải Châu, Đà Nẵng",
  },
  {
    name: "Võ Hoàng Nam",
    phone: "0977112235",
    address:
      "17 Hùng Vương, phường Vĩnh Ninh, TP Huế",
  },
  {
    name: "Đặng Thị Kim Ngân",
    phone: "0965883126",
    address:
      "455 Cách Mạng Tháng Tám, phường 13, quận 10, TP Hồ Chí Minh",
  },
  {
    name: "Bùi Anh Tuấn",
    phone: "0946225507",
    address:
      "89 Hoàng Văn Thụ, phường Quang Trung, TP Hải Dương",
  },
  {
    name: "Hoàng Thị Mỹ Duyên",
    phone: "0932004488",
    address:
      "26 Phan Đình Phùng, phường Tân Lợi, TP Buôn Ma Thuột",
  },
  {
    name: "Trịnh Văn Lộc",
    phone: "0921778899",
    address:
      "301 Trần Hưng Đạo, phường An Cư, quận Ninh Kiều, Cần Thơ",
  },
  {
    name: "Ngô Bảo Châu",
    phone: "0918334455",
    address:
      "12 Lý Thường Kiệt, phường Bạch Đằng, TP Hạ Long",
  },
];

/* =========================================================
   ẢNH SẢN PHẨM

   Bản UI-only chạy được cả khi không có mạng, nên ảnh phải là data URI. Link ảnh
   ngoài sẽ hiện ô vỡ và làm thư viện ảnh của màn chi tiết trông như lỗi.
========================================================= */

const productPhoto = (
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
   FACTORY KIỆN HÀNG
========================================================= */

let itemSequence = 0;

const round = (value, decimals = 4) => {
  const factor = 10 ** decimals;

  return (
    Math.round(
      (Number(value) || 0) * factor
    ) / factor
  );
};

const makeItem = ({
  productName,
  productTypeKey,
  quantity = 1,
  weight,
  length,
  width,
  height,
  declaredValue,
  domesticTrackingCode = null,
  packageCode = "MEDIUM",
  photoLabels = [],
  photoColor = "#e2e8f0",
}) => {
  itemSequence += 1;

  const productType = productTypeByKey(
    productTypeKey
  );

  const packageConfig =
    packageConfigByCode(packageCode);

  const volumeCm3 =
    length * width * height;

  /* CUSTOM tính phí theo 1.000 cm³ và bị chặn bởi maxFee; các thùng chuẩn thu trọn gói. */
  const estimatedFee =
    packageConfig.configCode ===
    "CUSTOM"
      ? Math.min(
          Math.round(
            (volumeCm3 / 1000) *
              packageConfig.packageFee
          ),
          packageConfig.maxFee
        )
      : packageConfig.packageFee;

  const photos = (
    photoLabels.length > 0
      ? photoLabels
      : [productName]
  ).map((label) =>
    productPhoto(label, photoColor)
  );

  return {
    id: uuidOf("17e00000", itemSequence),
    itemId: uuidOf(
      "17e00000",
      itemSequence
    ),

    productName,

    /* productType là UUID đúng như API trả; productTypeName giữ để màn chi tiết
       hiện được tên loại hàng ngay cả khi mock loại hàng chưa nạp xong. */
    productType: productType.id,
    productTypeId: productType.id,
    productTypeName: productType.name,

    quantity,
    weight,
    actualWeight: weight,

    length,
    width,
    height,

    volumetricWeight: round(
      volumeCm3 / VOLUMETRIC_DIVISOR
    ),

    declaredValue,

    referenceUrls: photos,
    imageUrls: photos,

    domesticTrackingCode,

    packageConfigurationId:
      packageConfig.id,

    packageConfiguration: {
      id: packageConfig.id,
      configCode:
        packageConfig.configCode,
      configName:
        packageConfig.configName,
      displayName:
        packageConfig.configName,
      length: packageConfig.length,
      width: packageConfig.width,
      height: packageConfig.height,
      maxWeight:
        packageConfig.maxWeight,
      packageFee:
        packageConfig.packageFee,
      maxFee: packageConfig.maxFee,
      estimatedFee,
      status: packageConfig.status,
    },
  };
};

/* =========================================================
   FACTORY LÔ VẬN CHUYỂN

   Hình dạng lấy từ ShipmentJourney.jsx: mảng group, mỗi group có parcels, mỗi
   parcel có thể có inspection. Thiếu statusText thì thẻ hiện "Đang xử lý".
========================================================= */

let shipmentSequence = 0;

const makeShipment = ({
  code,
  status,
  statusText,
  originWarehouseName = "Kho Quảng Châu",
  destinationWarehouseName = "Kho Hà Nội",
  carrierTrackingCode = null,
  shippedAt = null,
  deliveredAt = null,
  parcels = [],
}) => {
  shipmentSequence += 1;

  return {
    shipmentId: uuidOf(
      "5b100000",
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
          "9a4c0000",
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
   FACTORY BÁO GIÁ
========================================================= */

let quotationSequence = 0;

const buildQuotation = (
  order,
  {
    quoteType = "OFFICIAL",
    status = "SENT",
    unitPrice = 52000,
    domesticShippingFee = 180000,
    serviceRate = 0.05,
    taxRate = 0.08,
    createdDaysAgo = 1,
    expiresInDays = 5,
    paymentStatus = "",
    note = "Báo giá áp dụng cho lô hàng hiện tại, chưa gồm phát sinh kiểm hoá.",
  } = {}
) => {
  quotationSequence += 1;

  const chargeableWeight = round(
    Math.max(
      order.totalWeight,
      order.totalDimWeight
    ),
    4
  );

  const estimatedFreightCharge =
    Math.round(
      chargeableWeight * unitPrice
    );

  const serviceFee = Math.round(
    estimatedFreightCharge * serviceRate
  );

  const vat = Math.round(
    (estimatedFreightCharge +
      serviceFee) *
      0.08
  );

  const importTax = Math.round(
    order.declaredValue * taxRate
  );

  const taxAndDuty = vat + importTax;

  const subtotal =
    estimatedFreightCharge +
    domesticShippingFee +
    serviceFee;

  /* Đối soát của màn chi tiết cộng đúng bốn khoản này; đặt tổng bằng đúng tổng
     bốn khoản để không bao giờ hiện cảnh báo "Tổng báo giá đang lệch". */
  const totalEstimatedCost =
    subtotal + taxAndDuty;

  return {
    quotationId: uuidOf(
      "9c0a0000",
      quotationSequence
    ),
    id: uuidOf(
      "9c0a0000",
      quotationSequence
    ),

    orderId: order.orderId,
    consignmentCode:
      order.consignmentCode,

    quoteType,
    status,
    paymentStatus,
    depositStatus: paymentStatus,

    /* Để trống servicePricingId: màn lập báo giá sẽ tự dò bảng giá khớp tuyến và
       loại dịch vụ, an toàn hơn là ghim một id có thể không tồn tại ở mock pricing. */
    servicePricingId: null,
    serviceType: order.consignmentType,

    warehouseId: order.warehouseId,
    originCountry: "CN",
    destinationCountry: "VN",

    unitType: "KG",
    unitPrice,
    currency: "VND",

    totalWeight: order.totalWeight,
    totalVolume: order.totalVolume,
    volumetricWeight:
      order.totalDimWeight,
    chargeableWeight,
    packageCount: order.packageCount,
    declaredValue: order.declaredValue,

    mainServiceAmount:
      estimatedFreightCharge,

    additionalFees: [
      {
        feeId: PRICING_RULE_IDS.DOMESTIC_FEE,
        code: "DOMESTIC_FEE",
        label:
          "Phí vận chuyển nội địa Việt Nam",
        amount: domesticShippingFee,
        enabled: true,
      },
      {
        feeId: PRICING_RULE_IDS.VAT,
        code: "VAT",
        label: "Thuế giá trị gia tăng",
        amount: vat,
        enabled: true,
      },
      {
        feeId:
          PRICING_RULE_IDS.IMPORT_TAX,
        code: "IMPORT_TAX",
        label: "Thuế nhập khẩu",
        amount: importTax,
        enabled: true,
      },
    ],

    discountPercent: 0,
    subtotal,
    discount: 0,
    total: totalEstimatedCost,

    estimatedFreightCharge,
    domesticShippingFee,
    serviceFee,
    taxAndDuty,
    vat,
    importTax,
    totalEstimatedCost,

    depositPercent: SEED_DEPOSIT_PERCENT,
    depositAmount: Math.round(
      (totalEstimatedCost *
        SEED_DEPOSIT_PERCENT) /
        100
    ),

    salesNote: note,
    note,

    createdAt: isoDaysAgo(
      createdDaysAgo
    ),
    expiredAt: isoDaysAgo(
      createdDaysAgo - expiresInDays
    ),
  };
};

/* =========================================================
   FACTORY ĐƠN KÝ GỬI
========================================================= */

const DESTINATION_HANDLING_TEXT = {
  DIRECT_DELIVERY:
    "Giao ngay khi hàng về Việt Nam",
  STORE_AT_VN:
    "Gửi lại kho Việt Nam",
};

let orderSequence = 0;

const makeConsignment = ({
  code,
  status,
  statusDisplayName,
  consignmentType = "STANDARD",
  customerIndex = 0,
  receiverIndex = 0,
  warehouseCode = "WH-CN-GZ",
  route = "CN → VN",
  requiresInspection = false,
  requiresPacking = true,
  requiresWoodenCrate = false,
  requiresInsurance = false,
  destinationHandling = "DIRECT_DELIVERY",
  note = "",
  rejectionReason = null,
  createdDaysAgo = 3,
  statusUpdatedHoursAgo = 6,
  paymentStatus = "",
  paymentConfirmedDaysAgo = null,
  warehouseNotifiedDaysAgo = null,
  warehouseNotifiedNote = null,
  items = [],
  quotationOptions = null,
  shipments = [],
}) => {
  orderSequence += 1;

  const orderId = uuidOf(
    "0dea0000",
    orderSequence
  );

  const customer =
    CONSIGNMENT_CUSTOMERS[
      customerIndex %
        CONSIGNMENT_CUSTOMERS.length
    ];

  const receiver =
    RECEIVERS[
      receiverIndex % RECEIVERS.length
    ];

  const warehouse =
    warehouseByCode(warehouseCode);

  /* Tổng cộng theo đúng cách component tính lại: mỗi dòng là một kiện, không
     nhân số lượng. Lệch chỗ này là ô tổng và dòng TỔNG CỘNG của bảng đá nhau. */
  const totalWeight = round(
    items.reduce(
      (total, item) =>
        total + item.weight,
      0
    ),
    4
  );

  const totalVolume = round(
    items.reduce(
      (total, item) =>
        total +
        item.length *
          item.width *
          item.height,
      0
    ),
    4
  );

  const totalDimWeight = round(
    items.reduce(
      (total, item) =>
        total + item.volumetricWeight,
      0
    ),
    4
  );

  const declaredValue = items.reduce(
    (total, item) =>
      total + item.declaredValue,
    0
  );

  const totalQuantity = items.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  const order = {
    orderId,
    id: orderId,

    consignmentCode: code,
    orderCode: code,
    trackingCode: code,

    orderType: "CONSIGNMENT",
    consignmentType,
    shippingOption: consignmentType,

    status,
    statusDisplayName,
    orderStatus: status,
    consignmentStatus: status,
    paymentStatus,
    depositStatus: paymentStatus,
    rejectionReason,

    route,

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

    receiverName: receiver.name,
    receiverPhone: receiver.phone,
    receiverAddress: receiver.address,

    warehouseId: warehouse.id,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,

    requiresInspection,
    requiresPacking,
    requiresWoodenCrate,
    requiresInsurance,

    defaultDestinationHandling:
      destinationHandling,
    defaultDestinationHandlingText:
      destinationHandling
        ? DESTINATION_HANDLING_TEXT[
            destinationHandling
          ]
        : "",

    note,

    /* Chỉ khai những khoản khách thực sự chọn; màn chi tiết đếm size của tập này
       để hiện "n khoản phí áp dụng cho đơn". */
    pricingRuleIds: [
      PRICING_RULE_IDS.DOMESTIC_FEE,
      PRICING_RULE_IDS.VAT,
      PRICING_RULE_IDS.IMPORT_TAX,
      ...(requiresInspection
        ? [
            PRICING_RULE_IDS.SUR_INSPECTION,
          ]
        : []),
      ...(requiresWoodenCrate
        ? [PRICING_RULE_IDS.WOOD_CRATE]
        : []),
      ...(requiresInsurance
        ? [
            PRICING_RULE_IDS.SUR_INSURANCE_3PERCENT,
          ]
        : []),
    ],

    itemNames: items.map(
      (item) => item.productName
    ),

    totalWeight,
    weightKg: totalWeight,

    /* cm³ — xem ghi chú đầu file. */
    totalVolume,
    totalVolumeM3: round(
      totalVolume / 1_000_000,
      6
    ),

    totalDimWeight,
    declaredValue,
    totalQuantity,
    packageCount: items.length,
    itemCount: items.length,

    /* Để null để màn Giấy tờ gọi mock xuất phiếu thay vì mở một URL không tồn tại. */
    receiptPdfUrl: null,

    createdAt: isoDaysAgo(
      createdDaysAgo
    ),
    updatedAt: isoHoursAgo(
      statusUpdatedHoursAgo
    ),
    statusUpdatedAt: isoHoursAgo(
      statusUpdatedHoursAgo
    ),
    quotationCreatedAt: null,
    paymentConfirmedAt:
      paymentConfirmedDaysAgo === null
        ? null
        : isoDaysAgo(
            paymentConfirmedDaysAgo
          ),
    warehouseNotifiedAt:
      warehouseNotifiedDaysAgo === null
        ? null
        : isoDaysAgo(
            warehouseNotifiedDaysAgo
          ),
    warehouseNotifiedNote,

    items,
    shipments,
    quotation: null,
  };

  if (quotationOptions) {
    order.quotation = buildQuotation(
      order,
      quotationOptions
    );

    order.quotationCreatedAt =
      order.quotation.createdAt;
  }

  return order;
};

/* =========================================================
   KIỆN HÀNG MẪU
========================================================= */

const speakerItem = () =>
  makeItem({
    productName:
      "Loa bluetooth mini công suất 20W",
    productTypeKey: "ELECTRONICS",
    quantity: 24,
    weight: 12.4,
    length: 48,
    width: 36,
    height: 32,
    declaredValue: 8400000,
    domesticTrackingCode:
      "SF7712889034",
    packageCode: "MEDIUM",
    photoLabels: [
      "Loa bluetooth 20W",
      "Hộp loa",
    ],
    photoColor: "#dbeafe",
  });

const earphoneItem = () =>
  makeItem({
    productName:
      "Tai nghe không dây TWS hộp sạc",
    productTypeKey: "ELECTRONICS",
    quantity: 60,
    weight: 6.8,
    length: 40,
    width: 30,
    height: 24,
    declaredValue: 12600000,
    domesticTrackingCode:
      "YT4423190876",
    packageCode: "SMALL",
    photoColor: "#e0f2fe",
  });

const jacketItem = () =>
  makeItem({
    productName:
      "Áo khoác phao nữ dáng dài",
    productTypeKey: "APPAREL",
    quantity: 40,
    weight: 22.5,
    length: 60,
    width: 45,
    height: 42,
    declaredValue: 15200000,
    domesticTrackingCode:
      "JD9981223451",
    packageCode: "LARGE",
    photoColor: "#fae8ff",
  });

const sneakerItem = () =>
  makeItem({
    productName:
      "Giày sneaker thể thao nam size 39-43",
    productTypeKey: "APPAREL",
    quantity: 30,
    weight: 18.2,
    length: 62,
    width: 44,
    height: 40,
    declaredValue: 13500000,
    packageCode: "LARGE",
    photoColor: "#fee2e2",
  });

const riceCookerItem = () =>
  makeItem({
    productName:
      "Nồi cơm điện tách đường 1.8L",
    productTypeKey: "HOUSEWARE",
    quantity: 8,
    weight: 26.4,
    length: 68,
    width: 48,
    height: 46,
    declaredValue: 9800000,
    domesticTrackingCode:
      "ZTO5567012388",
    packageCode: "CUSTOM",
    photoColor: "#dcfce7",
  });

const ledItem = () =>
  makeItem({
    productName:
      "Đèn LED trang trí dây 10m",
    productTypeKey: "HOUSEWARE",
    quantity: 50,
    weight: 9.6,
    length: 42,
    width: 34,
    height: 26,
    declaredValue: 4200000,
    packageCode: "MEDIUM",
    photoColor: "#fef9c3",
  });

const bearingItem = () =>
  makeItem({
    productName:
      "Vòng bi công nghiệp 6205-2RS",
    productTypeKey: "MECHANICAL",
    quantity: 200,
    weight: 42.8,
    length: 45,
    width: 40,
    height: 35,
    declaredValue: 18600000,
    domesticTrackingCode:
      "STO3390125577",
    packageCode: "CUSTOM",
    photoColor: "#e2e8f0",
  });

const cncPartItem = () =>
  makeItem({
    productName:
      "Linh kiện trục máy CNC bằng thép",
    productTypeKey: "MECHANICAL",
    quantity: 12,
    weight: 68.5,
    length: 92,
    width: 58,
    height: 46,
    declaredValue: 42500000,
    packageCode: "CUSTOM",
    photoColor: "#e5e7eb",
  });

const legoItem = () =>
  makeItem({
    productName:
      "Bộ xếp hình khối 1200 chi tiết",
    productTypeKey: "TOY",
    quantity: 25,
    weight: 15.4,
    length: 55,
    width: 42,
    height: 38,
    declaredValue: 7600000,
    packageCode: "LARGE",
    photoColor: "#ffedd5",
  });

const cosmeticItem = () =>
  makeItem({
    productName:
      "Bộ dưỡng da 5 bước chiết xuất trà xanh",
    productTypeKey: "COSMETIC",
    quantity: 36,
    weight: 11.2,
    length: 44,
    width: 34,
    height: 28,
    declaredValue: 16800000,
    domesticTrackingCode:
      "YD8812334099",
    packageCode: "MEDIUM",
    photoColor: "#fce7f3",
  });

const phoneAccessoryItem = () =>
  makeItem({
    productName:
      "Ốp lưng và kính cường lực điện thoại",
    productTypeKey: "ACCESSORY",
    quantity: 300,
    weight: 8.4,
    length: 38,
    width: 30,
    height: 22,
    declaredValue: 5400000,
    packageCode: "SMALL",
    photoColor: "#ede9fe",
  });

const smartWatchItem = () =>
  makeItem({
    productName:
      "Đồng hồ thông minh màn hình AMOLED",
    productTypeKey: "ELECTRONICS",
    quantity: 45,
    weight: 7.9,
    length: 40,
    width: 32,
    height: 25,
    declaredValue: 21500000,
    packageCode: "SMALL",
    photoColor: "#cffafe",
  });

const keyboardItem = () =>
  makeItem({
    productName:
      "Bàn phím cơ RGB switch quang học",
    productTypeKey: "ELECTRONICS",
    quantity: 20,
    weight: 16.6,
    length: 58,
    width: 40,
    height: 30,
    declaredValue: 14200000,
    packageCode: "LARGE",
    photoColor: "#dbeafe",
  });

const fabricItem = () =>
  makeItem({
    productName:
      "Vải cotton cuộn khổ 1m6",
    productTypeKey: "APPAREL",
    quantity: 6,
    weight: 54.2,
    length: 170,
    width: 40,
    height: 40,
    declaredValue: 19400000,
    packageCode: "CUSTOM",
    photoColor: "#f1f5f9",
  });

const chairItem = () =>
  makeItem({
    productName:
      "Ghế công thái học lưới tựa cao",
    productTypeKey: "HOUSEWARE",
    quantity: 4,
    weight: 62.8,
    length: 86,
    width: 66,
    height: 54,
    declaredValue: 24600000,
    packageCode: "CUSTOM",
    photoColor: "#e7e5e4",
  });

/* =========================================================
   BỘ 27 ĐƠN KÝ GỬI

   `status` chỉ dùng 19 mã đích của features/consignment/constants/orderStatus.js
   (state-machines.md §1) và `statusDisplayName` phải trùng nhãn ở đó — mã cũ đã được
   chuẩn hóa ngay trong dữ liệu (tools/verify-mocks.mjs chặn mã lạ). Bộ lọc trạng thái
   của PendingConsignmentList được dựng từ chính dữ liệu này (nó nạp pageSize 1000 rồi
   gom status), nên mã nào có mặt ở đây thì tab đó có ít nhất một dòng khớp.
   Riêng STORED_AT_VN chưa có đơn: chưa đơn nào có phiếu nhập kho VN đã duyệt.
========================================================= */

export const consignments = [
  makeConsignment({
    code: "VCL-20260901083012-104233",
    status: "PENDING_REVIEW",
    statusDisplayName: "Chờ duyệt",
    consignmentType: "STANDARD",
    customerIndex: 0,
    receiverIndex: 0,
    createdDaysAgo: 0.4,
    statusUpdatedHoursAgo: 9,
    requiresInspection: true,
    note: "Khách nhờ kiểm kỹ nguồn điện trước khi đóng thùng.",
    items: [
      speakerItem(),
      earphoneItem(),
    ],
  }),

  makeConsignment({
    code: "VCL-20260901094455-118902",
    status: "PENDING_REVIEW",
    statusDisplayName: "Chờ duyệt",
    consignmentType: "STANDARD",
    customerIndex: 1,
    receiverIndex: 1,
    warehouseCode: "WH-CN-YW",
    createdDaysAgo: 0.8,
    statusUpdatedHoursAgo: 14,
    items: [phoneAccessoryItem()],
  }),

  makeConsignment({
    code: "VCL-20260831112033-127641",
    status: "NEED_MORE_INFO",
    statusDisplayName:
      "Cần bổ sung thông tin",
    consignmentType: "STANDARD",
    customerIndex: 2,
    receiverIndex: 2,
    createdDaysAgo: 1.6,
    statusUpdatedHoursAgo: 20,
    note: "Thiếu ảnh nhãn hàng và mã nội địa của kiện thứ hai.",
    items: [ledItem()],
  }),

  makeConsignment({
    code: "VCL-20260830145522-133870",
    status: "PENDING_REVIEW",
    statusDisplayName:
      "Chờ duyệt",
    consignmentType: "EXPRESS",
    customerIndex: 3,
    receiverIndex: 3,
    createdDaysAgo: 2.4,
    statusUpdatedHoursAgo: 26,
    requiresInspection: true,
    items: [
      cosmeticItem(),
      smartWatchItem(),
    ],
  }),

  makeConsignment({
    code: "VCL-20260829101245-141285",
    status: "APPROVED",
    statusDisplayName: "Đã xác nhận",
    consignmentType: "STANDARD",
    customerIndex: 4,
    receiverIndex: 4,
    createdDaysAgo: 3.2,
    statusUpdatedHoursAgo: 30,
    requiresPacking: true,
    items: [jacketItem()],
    quotationOptions: {
      quoteType: "ESTIMATE",
      status: "DRAFT",
      createdDaysAgo: 2.6,
      note: "Báo giá tạm tính, chờ Sale rà lại phí nội địa.",
    },
  }),

  makeConsignment({
    code: "VCL-20260828093310-152904",
    status: "QUOTATION_SENT",
    statusDisplayName:
      "Đã gửi báo giá",
    consignmentType: "STANDARD",
    customerIndex: 5,
    receiverIndex: 5,
    createdDaysAgo: 4.1,
    statusUpdatedHoursAgo: 33,
    items: [
      riceCookerItem(),
      ledItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "SENT",
      createdDaysAgo: 3.4,
    },
  }),

  makeConsignment({
    code: "VCL-20260827154417-160538",
    status: "WAITING_DEPOSIT",
    statusDisplayName:
      "Chờ đặt cọc",
    consignmentType: "EXPRESS",
    customerIndex: 6,
    receiverIndex: 6,
    createdDaysAgo: 5.3,
    statusUpdatedHoursAgo: 40,
    requiresInsurance: true,
    items: [keyboardItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 4.6,
    },
  }),

  makeConsignment({
    code: "VCL-20260826112905-174120",
    status: "QUOTATION_REJECTED",
    statusDisplayName:
      "Khách từ chối báo giá",
    consignmentType: "STANDARD",
    customerIndex: 7,
    receiverIndex: 7,
    createdDaysAgo: 6.2,
    statusUpdatedHoursAgo: 44,
    rejectionReason:
      "Khách thấy phí vận chuyển nội địa cao hơn dự kiến, xin báo giá lại.",
    items: [sneakerItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "REJECTED",
      createdDaysAgo: 5.5,
    },
  }),

  makeConsignment({
    code: "VCL-20260825084733-181664",
    status: "WAITING_DEPOSIT",
    statusDisplayName: "Chờ đặt cọc",
    consignmentType: "STANDARD",
    customerIndex: 0,
    receiverIndex: 8,
    createdDaysAgo: 7.1,
    statusUpdatedHoursAgo: 48,
    items: [
      bearingItem(),
      cncPartItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "SENT",
      createdDaysAgo: 6.4,
      paymentStatus: "WAITING_DEPOSIT",
    },
  }),

  makeConsignment({
    code: "VCL-20260824161208-190377",
    status: "WAITING_PAYMENT",
    statusDisplayName:
      "Chờ tất toán",
    consignmentType: "EXPRESS",
    customerIndex: 1,
    receiverIndex: 9,
    createdDaysAgo: 8.3,
    statusUpdatedHoursAgo: 52,
    requiresWoodenCrate: true,
    items: [chairItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 7.5,
      paymentStatus: "WAITING_PAYMENT",
    },
  }),

  makeConsignment({
    code: "VCL-20260823103041-204915",
    status: "DEPOSIT_PAID",
    statusDisplayName: "Đã đặt cọc",
    consignmentType: "STANDARD",
    customerIndex: 2,
    receiverIndex: 0,
    createdDaysAgo: 9.4,
    statusUpdatedHoursAgo: 56,
    paymentStatus: "DEPOSIT_PAID",
    paymentConfirmedDaysAgo: 8.2,
    items: [
      fabricItem(),
      jacketItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 8.8,
      paymentStatus: "DEPOSIT_PAID",
    },
  }),

  makeConsignment({
    code: "VCL-20260822141522-213308",
    status: "PAID",
    statusDisplayName:
      "Đã tất toán",
    consignmentType: "STANDARD",
    customerIndex: 3,
    receiverIndex: 1,
    createdDaysAgo: 10.2,
    statusUpdatedHoursAgo: 60,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 9.1,
    items: [legoItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 9.6,
      paymentStatus: "PAID",
    },
  }),

  makeConsignment({
    code: "VCL-20260821092217-225471",
    status: "APPROVED",
    statusDisplayName: "Đã xác nhận",
    consignmentType: "STANDARD",
    customerIndex: 4,
    receiverIndex: 2,
    createdDaysAgo: 11.5,
    statusUpdatedHoursAgo: 64,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 10.4,
    requiresInspection: true,
    items: [
      speakerItem(),
      phoneAccessoryItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 10.9,
      paymentStatus: "PAID",
    },
  }),

  makeConsignment({
    code: "VCL-20260820153344-238019",
    status: "APPROVED",
    statusDisplayName:
      "Đã xác nhận",
    consignmentType: "STANDARD",
    customerIndex: 5,
    receiverIndex: 3,
    warehouseCode: "WH-CN-YW",
    createdDaysAgo: 12.4,
    statusUpdatedHoursAgo: 68,
    paymentStatus: "DEPOSIT_PAID",
    paymentConfirmedDaysAgo: 11.6,
    items: [earphoneItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 11.8,
      paymentStatus: "DEPOSIT_PAID",
    },
  }),

  makeConsignment({
    code: "VCL-20260819111027-246650",
    status: "CHECKED_IN",
    statusDisplayName:
      "Đã nhập kho gốc",
    consignmentType: "STANDARD",
    customerIndex: 6,
    receiverIndex: 4,
    createdDaysAgo: 13.6,
    statusUpdatedHoursAgo: 30,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 12.7,
    items: [
      riceCookerItem(),
      ledItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 13.1,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260819111027-300118",
        status: "CREATED",
        statusText: "Đã lập lô",
        carrierTrackingCode: null,
        parcels: [
          {
            code: "PCL-20260819111027-500221",
            status: "IN_TRANSIT",
            statusText:
              "Đã nhận tại kho Quảng Châu",
            weight: 26.4,
          },
          {
            code: "PCL-20260819111027-500222",
            status: "IN_TRANSIT",
            statusText:
              "Đã nhận tại kho Quảng Châu",
            weight: 9.6,
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260818094911-258873",
    status: "IN_TRANSIT",
    statusDisplayName:
      "Đang vận chuyển quốc tế",
    consignmentType: "STANDARD",
    customerIndex: 7,
    receiverIndex: 5,
    createdDaysAgo: 14.8,
    statusUpdatedHoursAgo: 18,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 13.9,
    items: [
      bearingItem(),
      keyboardItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 14.2,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260818094911-300224",
        status: "IN_TRANSIT",
        statusText:
          "Đang trên đường về Việt Nam",
        carrierTrackingCode:
          "CNVN-778812004",
        shippedAt: isoDaysAgo(3.2),
        parcels: [
          {
            code: "PCL-20260818094911-500331",
            status: "IN_TRANSIT",
            statusText:
              "Đang vận chuyển",
            weight: 42.8,
          },
          {
            code: "PCL-20260818094911-500332",
            status: "IN_TRANSIT",
            statusText:
              "Đang vận chuyển",
            weight: 16.6,
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260817132650-263092",
    status: "IN_TRANSIT",
    statusDisplayName:
      "Đang vận chuyển quốc tế",
    consignmentType: "EXPRESS",
    customerIndex: 0,
    receiverIndex: 6,
    createdDaysAgo: 15.9,
    statusUpdatedHoursAgo: 12,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 15.1,
    items: [smartWatchItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 15.4,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260817132650-300337",
        status: "CUSTOMS_IMPORT_PENDING",
        statusText:
          "Chờ thông quan nhập khẩu",
        carrierTrackingCode:
          "CNVN-778901337",
        shippedAt: isoDaysAgo(4.5),
        parcels: [
          {
            code: "PCL-20260817132650-500441",
            status: "ARRIVED_DESTINATION",
            statusText:
              "Đã tới cửa khẩu",
            weight: 7.9,
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260816104408-271455",
    status: "CHECKED_IN",
    statusDisplayName:
      "Đã nhập kho gốc",
    consignmentType: "STANDARD",
    customerIndex: 1,
    receiverIndex: 7,
    createdDaysAgo: 17.2,
    statusUpdatedHoursAgo: 10,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 16.4,
    requiresInspection: true,
    items: [
      cosmeticItem(),
      phoneAccessoryItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 16.7,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260816104408-300449",
        status: "ARRIVED_VN",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-779012449",
        shippedAt: isoDaysAgo(6.4),
        deliveredAt: isoDaysAgo(1.1),
        parcels: [
          {
            code: "PCL-20260816104408-500551",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Kho Việt Nam đã nhận",
            weight: 11.2,
            inspection: {
              hasDiscrepancy: false,
              summary:
                "Đủ 36 hộp, không móp méo",
              note: "",
              inspectedAt:
                isoHoursAgo(26),
            },
          },
          {
            code: "PCL-20260816104408-500552",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Kho Việt Nam đã nhận",
            weight: 8.4,
            inspection: {
              hasDiscrepancy: true,
              summary:
                "Thiếu 4 kính cường lực so với khai báo",
              note: "Đã chụp ảnh niêm phong bị rách khi mở kiện",
              inspectedAt:
                isoHoursAgo(25),
            },
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260815152139-284007",
    status: "ARRIVED_DESTINATION",
    statusDisplayName:
      "Đã tới kho VN",
    consignmentType: "STANDARD",
    customerIndex: 2,
    receiverIndex: 8,
    createdDaysAgo: 18.4,
    statusUpdatedHoursAgo: 22,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 17.5,
    items: [legoItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 17.9,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260815152139-300556",
        status: "ARRIVED",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-779123556",
        shippedAt: isoDaysAgo(7.8),
        deliveredAt: isoDaysAgo(2.3),
        parcels: [
          {
            code: "PCL-20260815152139-500661",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Đã nhập kho Hà Nội",
            weight: 15.4,
            inspection: {
              hasDiscrepancy: false,
              summary:
                "Đủ 25 bộ, nguyên đai nguyên kiện",
              note: "",
              inspectedAt:
                isoHoursAgo(50),
            },
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260814113025-291560",
    status: "ARRIVED_DESTINATION",
    statusDisplayName:
      "Đã tới kho VN",
    consignmentType: "STANDARD",
    customerIndex: 3,
    receiverIndex: 9,
    createdDaysAgo: 19.6,
    statusUpdatedHoursAgo: 16,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 18.7,
    destinationHandling: "STORE_AT_VN",
    items: [
      fabricItem(),
      chairItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 19.1,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260814113025-300663",
        status: "ARRIVED_VN",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-779234663",
        shippedAt: isoDaysAgo(9.2),
        deliveredAt: isoDaysAgo(1.8),
        parcels: [
          {
            code: "PCL-20260814113025-500771",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Chờ lập phiếu nhập kho",
            weight: 54.2,
            destinationHandling:
              "STORE_AT_VN",
            destinationHandlingText:
              "Gửi lại kho Việt Nam",
            inspection: {
              hasDiscrepancy: false,
              summary:
                "Đủ 6 cuộn, đo lại đúng khổ 1m6",
              note: "",
              inspectedAt:
                isoHoursAgo(40),
            },
          },
          {
            code: "PCL-20260814113025-500772",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Chờ lập phiếu nhập kho",
            weight: 62.8,
            destinationHandling:
              "STORE_AT_VN",
            destinationHandlingText:
              "Gửi lại kho Việt Nam",
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260813094752-305118",
    status: "ARRIVED_DESTINATION",
    statusDisplayName:
      "Đã tới kho VN",
    consignmentType: "STANDARD",
    customerIndex: 4,
    receiverIndex: 0,
    createdDaysAgo: 21.3,
    statusUpdatedHoursAgo: 34,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 20.4,
    destinationHandling: "STORE_AT_VN",
    warehouseNotifiedDaysAgo: 2.1,
    warehouseNotifiedNote:
      "Khách xin lưu kho thêm 30 ngày, đã báo kho xếp kệ A3.",
    items: [cncPartItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 20.8,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260813094752-300775",
        status: "ARRIVED",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-779345775",
        shippedAt: isoDaysAgo(11.4),
        deliveredAt: isoDaysAgo(3.6),
        parcels: [
          {
            code: "PCL-20260813094752-500881",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Đã lưu kho Hà Nội",
            weight: 68.5,
            destinationHandling:
              "STORE_AT_VN",
            destinationHandlingText:
              "Gửi lại kho Việt Nam",
            inspection: {
              hasDiscrepancy: false,
              summary:
                "Đủ 12 trục, đúng bản vẽ",
              note: "",
              inspectedAt:
                isoHoursAgo(80),
            },
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260812142310-317744",
    status: "PAID",
    statusDisplayName:
      "Đã tất toán",
    consignmentType: "EXPRESS",
    customerIndex: 5,
    receiverIndex: 1,
    createdDaysAgo: 22.5,
    statusUpdatedHoursAgo: 8,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 21.7,
    items: [
      speakerItem(),
      earphoneItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 22.1,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260812142310-300882",
        status: "ARRIVED",
        statusText:
          "Đã về kho Hồ Chí Minh",
        destinationWarehouseName:
          "Kho Hồ Chí Minh",
        carrierTrackingCode:
          "CNVN-779456882",
        shippedAt: isoDaysAgo(12.8),
        deliveredAt: isoDaysAgo(1.2),
        parcels: [
          {
            code: "PCL-20260812142310-500991",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Chờ giao nội địa",
            weight: 12.4,
          },
          {
            code: "PCL-20260812142310-500992",
            status:
              "RECEIVED_AT_DESTINATION",
            statusText:
              "Chờ giao nội địa",
            weight: 6.8,
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260811101858-326035",
    status: "DELIVERING",
    statusDisplayName:
      "Đang giao hàng",
    consignmentType: "STANDARD",
    customerIndex: 6,
    receiverIndex: 2,
    createdDaysAgo: 24.1,
    statusUpdatedHoursAgo: 5,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 23.2,
    items: [sneakerItem()],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 23.6,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260811101858-300993",
        status: "ARRIVED",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-779567993",
        shippedAt: isoDaysAgo(14.2),
        deliveredAt: isoDaysAgo(2.4),
        parcels: [
          {
            code: "PCL-20260811101858-501101",
            status: "DELIVERED",
            statusText:
              "Đang giao tới người nhận",
            weight: 18.2,
            inspection: {
              hasDiscrepancy: false,
              summary:
                "Đủ 30 đôi, đúng size",
              note: "",
              inspectedAt:
                isoHoursAgo(52),
            },
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260810133422-338466",
    status: "DELIVERED",
    statusDisplayName:
      "Đã giao hàng",
    consignmentType: "STANDARD",
    customerIndex: 7,
    receiverIndex: 3,
    createdDaysAgo: 26.4,
    statusUpdatedHoursAgo: 28,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 25.5,
    items: [
      ledItem(),
      keyboardItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 25.9,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260810133422-301105",
        status: "ARRIVED",
        statusText:
          "Đã về kho Việt Nam",
        carrierTrackingCode:
          "CNVN-779678105",
        shippedAt: isoDaysAgo(16.6),
        deliveredAt: isoDaysAgo(4.1),
        parcels: [
          {
            code: "PCL-20260810133422-501211",
            status: "DELIVERED",
            statusText:
              "Đã giao người nhận",
            weight: 9.6,
          },
          {
            code: "PCL-20260810133422-501212",
            status: "DELIVERED",
            statusText:
              "Đã giao người nhận",
            weight: 16.6,
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260808091544-349920",
    status: "COMPLETED",
    statusDisplayName: "Hoàn tất",
    consignmentType: "STANDARD",
    customerIndex: 0,
    receiverIndex: 4,
    createdDaysAgo: 29.2,
    statusUpdatedHoursAgo: 72,
    paymentStatus: "PAID",
    paymentConfirmedDaysAgo: 28.3,
    items: [
      riceCookerItem(),
      cosmeticItem(),
    ],
    quotationOptions: {
      quoteType: "OFFICIAL",
      status: "ACCEPTED",
      createdDaysAgo: 28.7,
      paymentStatus: "PAID",
    },
    shipments: [
      makeShipment({
        code: "SHP-20260808091544-301213",
        status: "ARRIVED",
        statusText:
          "Đã hoàn tất hành trình",
        carrierTrackingCode:
          "CNVN-779789213",
        shippedAt: isoDaysAgo(20.4),
        deliveredAt: isoDaysAgo(7.2),
        parcels: [
          {
            code: "PCL-20260808091544-501321",
            status: "DELIVERED",
            statusText:
              "Đã giao và ký nhận",
            weight: 26.4,
          },
          {
            code: "PCL-20260808091544-501322",
            status: "DELIVERED",
            statusText:
              "Đã giao và ký nhận",
            weight: 11.2,
          },
        ],
      }),
    ],
  }),

  makeConsignment({
    code: "VCL-20260807154708-358173",
    status: "REJECTED",
    statusDisplayName: "Đã từ chối",
    consignmentType: "STANDARD",
    customerIndex: 1,
    receiverIndex: 5,
    createdDaysAgo: 30.6,
    statusUpdatedHoursAgo: 76,
    rejectionReason:
      "Hàng thuộc nhóm pin lithium rời, không nhận vận chuyển đường bộ.",
    items: [smartWatchItem()],
  }),

  makeConsignment({
    code: "VCL-20260806112239-366408",
    status: "CANCELLED",
    statusDisplayName: "Đã hủy",
    consignmentType: "STANDARD",
    customerIndex: 2,
    receiverIndex: 6,
    createdDaysAgo: 32.4,
    statusUpdatedHoursAgo: 84,
    rejectionReason:
      "Khách tự huỷ vì đã mua được nguồn hàng trong nước.",
    items: [phoneAccessoryItem()],
  }),
];

/* =========================================================
   SELECTOR
========================================================= */

/**
 * Tra đơn theo id điều hướng.
 *
 * Route truyền vào orderId, nhưng vài chỗ (state của navigate, màn Giấy tờ) lại
 * giữ `id`. Nhận cả hai, và nhận luôn mã đơn để lỡ có nơi truyền mã thì màn chi
 * tiết vẫn mở được thay vì báo "Không tìm thấy mã đơn ký gửi".
 */
export const findConsignmentById = (
  orderId
) => {
  const needle = String(orderId ?? "")
    .trim()
    .toLowerCase();

  if (!needle) {
    return null;
  }

  return (
    consignments.find(
      (order) =>
        order.orderId.toLowerCase() ===
          needle ||
        order.consignmentCode.toLowerCase() ===
          needle
    ) || null
  );
};

/** Tra theo mã vận đơn / mã đơn, không phân biệt hoa thường. */
export const findConsignmentByCode = (
  code
) => {
  const needle = String(code ?? "")
    .trim()
    .toLowerCase();

  if (!needle) {
    return null;
  }

  return (
    consignments.find(
      (order) =>
        order.consignmentCode.toLowerCase() ===
          needle ||
        order.orderCode.toLowerCase() ===
          needle ||
        order.trackingCode.toLowerCase() ===
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
export const findConsignmentsByStatus =
  (status) => {
    const needle = normalizeText(
      status
    ).toUpperCase();

    if (
      !needle ||
      needle === "ALL"
    ) {
      return [...consignments];
    }

    return consignments.filter(
      (order) =>
        String(order.status)
          .trim()
          .toUpperCase() === needle
    );
  };

/**
 * 19 mã trạng thái đơn đích, đúng thứ tự ORDER_STATUS_ORDER của
 * features/consignment/constants/orderStatus.js (mock không import features nên
 * chép lại; tools/verify-mocks.mjs so khớp hai bên).
 */
export const CONSIGNMENT_STATUSES = Object.freeze([
  "PENDING_REVIEW",
  "NEED_MORE_INFO",
  "REJECTED",
  "QUOTATION_SENT",
  "QUOTATION_REJECTED",
  "WAITING_DEPOSIT",
  "DEPOSIT_PAID",
  "APPROVED",
  "CHECKED_IN",
  "IN_TRANSIT",
  "ARRIVED_VN",
  "ARRIVED_DESTINATION",
  "WAITING_PAYMENT",
  "PAID",
  "STORED_AT_VN",
  "DELIVERING",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
]);

/** Nhãn tiếng Việt của 19 mã trên — trùng ORDER_STATUS_LABELS (verify-mocks so khớp). */
export const CONSIGNMENT_STATUS_LABELS = Object.freeze({
  PENDING_REVIEW: "Chờ duyệt",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  REJECTED: "Đã từ chối",
  QUOTATION_SENT: "Đã gửi báo giá",
  QUOTATION_REJECTED: "Khách từ chối báo giá",
  WAITING_DEPOSIT: "Chờ đặt cọc",
  DEPOSIT_PAID: "Đã đặt cọc",
  APPROVED: "Đã xác nhận",
  CHECKED_IN: "Đã nhập kho gốc",
  IN_TRANSIT: "Đang vận chuyển quốc tế",
  ARRIVED_VN: "Đã về Việt Nam",
  ARRIVED_DESTINATION: "Đã tới kho VN",
  WAITING_PAYMENT: "Chờ tất toán",
  PAID: "Đã tất toán",
  STORED_AT_VN: "Đang lưu kho VN",
  DELIVERING: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
});

export default consignments;
