/*
 * DỮ LIỆU DANH MỤC NỀN (CATALOG FIXTURES)
 *
 * Đây là nguồn dữ liệu tĩnh cho toàn bộ 13 loại tài nguyên mà
 * features/admin/api/adminService.js CRUD, và cũng là nền cho các bộ dữ liệu
 * nghiệp vụ khác (mua hộ, ký gửi, kho, thanh toán) tham chiếu tới.
 *
 * Hình dạng field được lấy từ:
 *  - features/catalog/pages/AdminCatalogPages.jsx (columns + fields của từng page)
 *  - features/catalog/components/AdminResourcePage/AdminResourcePage.jsx
 *  - các normalize* trong pricing/catalog/warehouse services
 *
 * Ba ràng buộc phải giữ, nếu vi phạm màn hình sẽ rỗng chứ không lỗi build:
 *  1. Mỗi bản ghi BẮT BUỘC có `id`: AdminResourcePage.getRecordId() dùng
 *     record.id (hoặc resourceId/configurationId) làm rowKey của antd Table.
 *  2. Các field mà form bind vào <Input> phải là chuỗi, không phải mảng —
 *     ví dụ carriers.supportedShippingMethods là text "AIR, SEA, ROAD".
 *  3. Cột type "route" / "dimensions" không đọc field cùng tên mà đọc
 *     originCountry+destinationCountry / length+width+height của bản ghi.
 */

/* ==================== HẠ TẦNG SINH ID & MỐC THỜI GIAN ==================== */

/*
 * Nhiều service chặn id không khớp UUID v4 (consignmentService,
 * purchaseRequestService, customerService dùng UUID_PATTERN;
 * ConsignmentDetail dùng isUuid() để đoán productType là id hay là tên),
 * nên id phải đúng dạng 8-4-4-4-12 với nibble version = 4 và variant = 8.
 * Sinh tất định theo (tag, vị trí) để id không đổi giữa các lần chạy —
 * các bộ dữ liệu khác có thể tham chiếu chéo an toàn.
 */
const buildId = (tag, index) => {
  const sequence = String(index).padStart(4, "0");
  return `${tag}${sequence}-4d10-4b21-8c30-9e5f${tag}${sequence}`;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/* Mốc thời gian lệch dần theo vị trí để cột sắp xếp theo ngày có dữ liệu khác nhau. */
const isoFrom = (baseIso, offsetDays) =>
  new Date(new Date(baseIso).getTime() + offsetDays * DAY_MS).toISOString();

/*
 * Gán id + mốc thời gian cho cả bộ. Spread `row` sau `id` để một bản ghi
 * vẫn ghi đè được id khi cần khớp với id thật đang hard-code trong component.
 */
const withIds = (tag, rows, options = {}) => {
  const createdBase = options.createdBase || "2026-01-06T02:15:00.000Z";
  const updatedBase = options.updatedBase || "2026-08-04T07:40:00.000Z";

  return rows.map((row, index) => ({
    id: row.id || buildId(tag, index + 1),
    ...row,
    createdAt: row.createdAt || isoFrom(createdBase, index * 3),
    updatedAt: row.updatedAt || isoFrom(updatedBase, index),
  }));
};

/* Tra cứu nội bộ để các bộ dữ liệu sau tham chiếu id của bộ trước bằng mã dễ đọc. */
const pickId = (collection, field, value) =>
  collection.find((record) => record?.[field] === value)?.id ?? null;

/* ==================== 1. KHO (warehouses) ==================== */

/*
 * warehouseType chỉ nhận ORIGIN / DESTINATION / TRANSIT (select trong form).
 * `region` là cột filterable nên cần đủ giá trị khác nhau để dropdown lọc có nghĩa.
 * `city`/`country` là field phụ: ConfirmPurchaseModal dò kho theo tuyến bằng cách
 * ghép code+name+address+region+country rồi tìm chuỗi "CN"/"TRUNG"/"QUẢNG CHÂU".
 */
export const warehouses = withIds("a01e", [
  {
    code: "CN-GZ-01",
    name: "Kho Quảng Châu 1",
    address: "Số 88, đường Trạm Tây, quận Bạch Vân, Quảng Châu, Quảng Đông, Trung Quốc",
    region: "Hoa Nam",
    city: "Quảng Châu",
    country: "CN",
    warehouseType: "ORIGIN",
    contactPerson: "Lâm Gia Hào",
    contactPhone: "+86 20 8613 4477",
    isActive: true,
  },
  {
    code: "CN-GZ-02",
    name: "Kho Quảng Châu 2 (Thạch Tỉnh)",
    address: "Khu công nghiệp Thạch Tỉnh, quận Bạch Vân, Quảng Châu, Quảng Đông, Trung Quốc",
    region: "Hoa Nam",
    city: "Quảng Châu",
    country: "CN",
    warehouseType: "ORIGIN",
    contactPerson: "Trần Vĩ Long",
    contactPhone: "+86 20 8613 5588",
    isActive: true,
  },
  {
    code: "CN-YW-01",
    name: "Kho Nghĩa Ô",
    address: "Khu B chợ quốc tế Nghĩa Ô, thành phố Nghĩa Ô, Chiết Giang, Trung Quốc",
    region: "Hoa Đông",
    city: "Nghĩa Ô",
    country: "CN",
    warehouseType: "ORIGIN",
    contactPerson: "Ngô Thiếu Bằng",
    contactPhone: "+86 579 8552 1180",
    isActive: true,
  },
  {
    code: "CN-SZ-01",
    name: "Kho Thâm Quyến",
    address: "Số 12, đường Bảo Hoa, quận Bảo An, Thâm Quyến, Quảng Đông, Trung Quốc",
    region: "Hoa Nam",
    city: "Thâm Quyến",
    country: "CN",
    warehouseType: "ORIGIN",
    contactPerson: "Hoàng Kiến Minh",
    contactPhone: "+86 755 2788 3300",
    isActive: true,
  },
  {
    code: "CN-DX-01",
    name: "Kho trung chuyển Đông Hưng",
    address: "Khu cửa khẩu Đông Hưng, Phòng Thành Cảng, Quảng Tây, Trung Quốc",
    region: "Biên giới",
    city: "Đông Hưng",
    country: "CN",
    warehouseType: "TRANSIT",
    contactPerson: "Lý Chấn Nam",
    contactPhone: "+86 770 7695 210",
    isActive: true,
  },
  {
    code: "CN-PX-01",
    name: "Kho trung chuyển Bằng Tường",
    address: "Khu logistics Bằng Tường, Sùng Tả, Quảng Tây, Trung Quốc",
    region: "Biên giới",
    city: "Bằng Tường",
    country: "CN",
    warehouseType: "TRANSIT",
    contactPerson: "Chu Vĩnh Thái",
    contactPhone: "+86 771 8532 664",
    isActive: true,
  },
  {
    code: "VN-LS-01",
    name: "Kho trung chuyển Lạng Sơn",
    address: "Khu phi thuế quan Tân Thanh, huyện Văn Lãng, tỉnh Lạng Sơn",
    region: "Biên giới",
    city: "Lạng Sơn",
    country: "VN",
    warehouseType: "TRANSIT",
    contactPerson: "Nguyễn Văn Đoài",
    contactPhone: "0912 445 108",
    isActive: true,
  },
  {
    code: "VN-HN-01",
    name: "Kho tổng Hà Nội",
    address: "Lô C4, KCN Ngọc Hồi, huyện Thanh Trì, thành phố Hà Nội",
    region: "Miền Bắc",
    city: "Hà Nội",
    country: "VN",
    warehouseType: "DESTINATION",
    contactPerson: "Phạm Thu Hường",
    contactPhone: "0243 887 4412",
    isActive: true,
  },
  {
    code: "VN-HN-02",
    name: "Kho Hà Nội 2 (Hoàng Mai)",
    address: "Số 254 đường Tam Trinh, phường Yên Sở, quận Hoàng Mai, thành phố Hà Nội",
    region: "Miền Bắc",
    city: "Hà Nội",
    country: "VN",
    warehouseType: "DESTINATION",
    contactPerson: "Đỗ Quang Khải",
    contactPhone: "0243 887 4419",
    isActive: true,
  },
  {
    code: "VN-HP-01",
    name: "Kho Hải Phòng",
    address: "Số 9 đường Ngô Quyền, phường Máy Chai, quận Ngô Quyền, thành phố Hải Phòng",
    region: "Miền Bắc",
    city: "Hải Phòng",
    country: "VN",
    warehouseType: "DESTINATION",
    contactPerson: "Vũ Thị Bích Ngân",
    contactPhone: "0225 365 7788",
    isActive: true,
  },
  {
    code: "VN-DN-01",
    name: "Kho Đà Nẵng",
    address: "Lô 24 KCN Hòa Khánh, quận Liên Chiểu, thành phố Đà Nẵng",
    region: "Miền Trung",
    city: "Đà Nẵng",
    country: "VN",
    warehouseType: "DESTINATION",
    contactPerson: "Trương Minh Nhật",
    contactPhone: "0236 374 5520",
    isActive: true,
  },
  {
    code: "VN-SG-01",
    name: "Kho tổng TP. Hồ Chí Minh",
    address: "Số 45 đường Trần Đại Nghĩa, phường Tân Tạo A, quận Bình Tân, TP. Hồ Chí Minh",
    region: "Miền Nam",
    city: "TP. Hồ Chí Minh",
    country: "VN",
    warehouseType: "DESTINATION",
    contactPerson: "Lê Hoàng Duy",
    contactPhone: "0283 754 9931",
    isActive: true,
  },
  {
    code: "VN-SG-02",
    name: "Kho TP. Hồ Chí Minh 2 (Thủ Đức)",
    address: "Số 178 đường Linh Trung, phường Linh Trung, thành phố Thủ Đức, TP. Hồ Chí Minh",
    region: "Miền Nam",
    city: "TP. Hồ Chí Minh",
    country: "VN",
    warehouseType: "DESTINATION",
    contactPerson: "Bùi Thanh Trúc",
    contactPhone: "0283 754 9944",
    /* Kho đang tạm ngưng để bộ lọc "Ngừng hoạt động" luôn có dữ liệu. */
    isActive: false,
  },
]);

/* ==================== 2. ĐƠN VỊ VẬN CHUYỂN (carriers) ==================== */

/*
 * supportedShippingMethods / supportedRegions là <Input> text nên phải là chuỗi.
 * Tên đơn vị đặt hư cấu để không gán thông tin liên hệ sai cho doanh nghiệp thật.
 */
export const carriers = withIds("b02c", [
  {
    carrierCode: "VCL-EXP",
    carrierName: "VCL Express",
    carrierType: "EXPRESS",
    apiUrl: "https://api.vcl-express.vn/v1/tracking",
    contactEmail: "ops@vcl-express.vn",
    contactPhone: "1900 6688",
    supportedShippingMethods: "AIR, ROAD",
    supportedRegions: "Trung Quốc, Việt Nam",
    internalNotes: "Đội xe nội bộ của Việt Nam Logistic, ưu tiên đơn hỏa tốc và đơn VIP.",
    isActive: true,
  },
  {
    carrierCode: "VCL-SEA",
    carrierName: "VCL Sea Line",
    carrierType: "SEA_FREIGHT",
    apiUrl: "https://api.vcl-express.vn/v1/sea",
    contactEmail: "sea@vcl-express.vn",
    contactPhone: "0225 365 1102",
    supportedShippingMethods: "SEA",
    supportedRegions: "Hoa Nam, Hải Phòng, TP. Hồ Chí Minh",
    internalNotes: "Chạy tuyến gom hàng LCL Thâm Quyến - Hải Phòng, tuần 2 chuyến.",
    isActive: true,
  },
  {
    carrierCode: "VCL-TRK",
    carrierName: "VCL Trucking",
    carrierType: "TRUCKING",
    apiUrl: "https://api.vcl-express.vn/v1/trucking",
    contactEmail: "trucking@vcl-express.vn",
    contactPhone: "0912 660 118",
    supportedShippingMethods: "ROAD",
    supportedRegions: "Quảng Tây, Lạng Sơn, Hà Nội",
    internalNotes: "Xe đầu kéo 20 tấn, nhận hàng cồng kềnh và hàng kiện gỗ.",
    isActive: true,
  },
  {
    carrierCode: "APE",
    carrierName: "An Phát Express",
    carrierType: "EXPRESS",
    apiUrl: "https://openapi.anphat-express.vn/tracking",
    contactEmail: "cskh@anphat-express.vn",
    contactPhone: "1900 5454",
    supportedShippingMethods: "AIR, ROAD",
    supportedRegions: "Toàn quốc",
    internalNotes: "Đối tác phát cuối tại miền Nam, ký hợp đồng theo năm.",
    isActive: true,
  },
  {
    carrierCode: "HNL",
    carrierName: "Hoa Nam Logistics",
    carrierType: "TRUCKING",
    apiUrl: "https://api.hoanan-logistics.cn/v2",
    contactEmail: "service@hoanan-logistics.cn",
    contactPhone: "+86 20 8890 1123",
    supportedShippingMethods: "ROAD, RAIL",
    supportedRegions: "Quảng Đông, Quảng Tây",
    internalNotes: "Gom hàng tại Quảng Châu, giao về kho Đông Hưng trong 24 giờ.",
    isActive: true,
  },
  {
    carrierCode: "DHVT",
    carrierName: "Đông Hưng Vận Tải",
    carrierType: "TRUCKING",
    apiUrl: "",
    contactEmail: "donghung.vt@mail.cn",
    contactPhone: "+86 770 7695 118",
    supportedShippingMethods: "ROAD",
    supportedRegions: "Đông Hưng, Móng Cái",
    internalNotes: "Chỉ nhận thanh toán CNY, không có API tra cứu.",
    isActive: true,
  },
  {
    carrierCode: "BTR",
    carrierName: "Bằng Tường Rail",
    carrierType: "RAIL",
    apiUrl: "https://api.bangtuong-rail.cn/track",
    contactEmail: "booking@bangtuong-rail.cn",
    contactPhone: "+86 771 8532 990",
    supportedShippingMethods: "RAIL",
    supportedRegions: "Quảng Tây, Lạng Sơn",
    internalNotes: "Giá tốt cho hàng nặng, lịch tàu 3 chuyến/tuần.",
    isActive: true,
  },
  {
    carrierCode: "TLA",
    carrierName: "Thiên Long Air Cargo",
    carrierType: "AIR_FREIGHT",
    apiUrl: "https://api.thienlong-air.vn/v1",
    contactEmail: "cargo@thienlong-air.vn",
    contactPhone: "0243 992 7710",
    supportedShippingMethods: "AIR",
    supportedRegions: "Trung Quốc, Hàn Quốc, Nhật Bản",
    internalNotes: "Dùng cho hàng giá trị cao và hàng cần chứng từ nhập nhanh.",
    isActive: true,
  },
  {
    carrierCode: "MKP",
    carrierName: "Minh Khôi Post",
    carrierType: "DOMESTIC",
    apiUrl: "https://api.minhkhoipost.vn/v1",
    contactEmail: "hotro@minhkhoipost.vn",
    contactPhone: "1900 7373",
    supportedShippingMethods: "ROAD",
    supportedRegions: "Toàn quốc",
    internalNotes: "Phát hàng lẻ nội địa, cước tính theo bảng giá riêng.",
    isActive: true,
  },
  {
    carrierCode: "NVE",
    carrierName: "Nam Việt Express",
    carrierType: "DOMESTIC",
    apiUrl: "https://api.namviet-express.vn/tracking",
    contactEmail: "kinhdoanh@namviet-express.vn",
    contactPhone: "1900 6161",
    supportedShippingMethods: "ROAD",
    supportedRegions: "Miền Trung, Miền Nam",
    internalNotes: "Đối tác dự phòng khi APE quá tải dịp cao điểm.",
    isActive: true,
  },
  {
    carrierCode: "HVC",
    carrierName: "Hải Vân Cargo",
    carrierType: "TRUCKING",
    apiUrl: "",
    contactEmail: "dieuhanh@haivancargo.vn",
    contactPhone: "0236 374 8899",
    supportedShippingMethods: "ROAD",
    supportedRegions: "Miền Trung",
    internalNotes: "Chuyên tuyến Đà Nẵng - Huế - Quảng Ngãi.",
    isActive: true,
  },
  {
    carrierCode: "TCS",
    carrierName: "Tân Cảng Sea Service",
    carrierType: "SEA_FREIGHT",
    apiUrl: "https://api.tancang-sea.vn/v1",
    contactEmail: "lcl@tancang-sea.vn",
    contactPhone: "0283 899 2020",
    supportedShippingMethods: "SEA",
    supportedRegions: "TP. Hồ Chí Minh, Hải Phòng",
    internalNotes: "Khai thác cảng Cát Lái, phù hợp hàng container nguyên.",
    isActive: true,
  },
  {
    carrierCode: "PLL",
    carrierName: "Phúc Long Logistics",
    carrierType: "EXPRESS",
    apiUrl: "",
    contactEmail: "info@phuclong-logistics.vn",
    contactPhone: "0283 665 4477",
    supportedShippingMethods: "ROAD",
    supportedRegions: "Miền Nam",
    internalNotes: "Đã dừng hợp tác từ 07/2026 do tỷ lệ hàng hư hỏng cao.",
    isActive: false,
  },
]);

/* ==================== 3. PHƯƠNG THỨC VẬN CHUYỂN (shippingMethods) ==================== */

/* estimatedTransitTime là text tự do (cột hiển thị nguyên văn), không phải số. */
export const shippingMethods = withIds("c03d", [
  {
    methodCode: "ROAD_STANDARD",
    methodName: "Đường bộ tiêu chuẩn",
    estimatedTransitTime: "5 - 7 ngày",
    applicableCondition: "Hàng thường, tổng khối dưới 3 m³",
    description: "Gom hàng tại kho Quảng Châu, xe container về kho Hà Nội qua cửa khẩu Tân Thanh.",
    internalNote: "Phương thức mặc định cho đơn ký gửi thông thường.",
    isActive: true,
  },
  {
    methodCode: "ROAD_EXPRESS",
    methodName: "Đường bộ nhanh",
    estimatedTransitTime: "3 - 4 ngày",
    applicableCondition: "Hàng thường, khách chấp nhận phụ phí hỏa tốc",
    description: "Xe chạy thẳng không gom thêm, ưu tiên thông quan luồng xanh.",
    internalNote: "Chỉ nhận trước 16h để kịp xuất xe trong ngày.",
    isActive: true,
  },
  {
    methodCode: "ROAD_ECONOMY",
    methodName: "Đường bộ tiết kiệm",
    estimatedTransitTime: "8 - 12 ngày",
    applicableCondition: "Hàng không gấp, ưu tiên giá rẻ",
    description: "Chờ đủ tải mới xuất xe, phù hợp hàng nặng giá trị thấp.",
    internalNote: "Không cam kết ngày giao, cần ghi rõ trong báo giá.",
    isActive: true,
  },
  {
    methodCode: "SEA_LCL",
    methodName: "Đường biển gom hàng LCL",
    estimatedTransitTime: "12 - 16 ngày",
    applicableCondition: "Hàng trên 2 m³, không phải hàng dễ hư",
    description: "Gom hàng lẻ tại Thâm Quyến, cập cảng Hải Phòng.",
    internalNote: "Tuần 2 chuyến, cut-off thứ Ba và thứ Sáu.",
    isActive: true,
  },
  {
    methodCode: "SEA_FCL",
    methodName: "Đường biển container nguyên",
    estimatedTransitTime: "14 - 18 ngày",
    applicableCondition: "Hàng đủ container 20ft hoặc 40ft",
    description: "Khách thuê nguyên container, VCL lo khai báo và kéo hàng về kho.",
    internalNote: "Cần đặt booking trước 7 ngày.",
    isActive: true,
  },
  {
    methodCode: "AIR_STANDARD",
    methodName: "Hàng không tiêu chuẩn",
    estimatedTransitTime: "2 - 3 ngày",
    applicableCondition: "Hàng nhẹ dưới 100 kg, không phải hàng hạn chế bay",
    description: "Bay từ Quảng Châu hoặc Thâm Quyến về Nội Bài, khai hải quan tại sân bay.",
    internalNote: "Không nhận pin rời và chất lỏng.",
    isActive: true,
  },
  {
    methodCode: "AIR_EXPRESS",
    methodName: "Hàng không hỏa tốc",
    estimatedTransitTime: "24 - 48 giờ",
    applicableCondition: "Hàng gấp, giá trị cao, đã có đủ chứng từ",
    description: "Ưu tiên chỗ trên chuyến sớm nhất, giao tận nơi trong nội thành.",
    internalNote: "Phụ phí cao, chỉ chào cho khách doanh nghiệp.",
    isActive: true,
  },
  {
    methodCode: "RAIL_STANDARD",
    methodName: "Đường sắt liên vận",
    estimatedTransitTime: "7 - 9 ngày",
    applicableCondition: "Hàng nặng trên 500 kg, không yêu cầu ngày giao chính xác",
    description: "Tàu liên vận Bằng Tường - Đồng Đăng, dỡ tại kho Lạng Sơn.",
    internalNote: "Giá tốt nhất cho hàng nặng nhưng lịch tàu hay đổi.",
    isActive: true,
  },
  {
    methodCode: "OVERSIZE_ROAD",
    methodName: "Đường bộ hàng cồng kềnh",
    estimatedTransitTime: "6 - 9 ngày",
    applicableCondition: "Kiện dài trên 150 cm hoặc nặng trên 80 kg",
    description: "Dùng xe thùng dài kèm dịch vụ đóng kiện gỗ bắt buộc.",
    internalNote: "Bắt buộc bật quy tắc WOOD_CRATE khi báo giá.",
    isActive: true,
  },
  {
    methodCode: "VALUE_AIR",
    methodName: "Hàng không giá trị cao",
    estimatedTransitTime: "3 - 4 ngày",
    applicableCondition: "Giá trị khai báo trên 50.000.000 VND",
    description: "Bắt buộc mua bảo hiểm 3% và niêm phong kiện tại kho đi.",
    internalNote: "Bộ phận kiểm hàng phải chụp ảnh trước khi niêm phong.",
    isActive: true,
  },
  {
    methodCode: "DOMESTIC_DELIVERY",
    methodName: "Giao nội địa từ kho VCL",
    estimatedTransitTime: "1 - 3 ngày",
    applicableCondition: "Sau khi hàng đã nhập kho đích tại Việt Nam",
    description: "Chuyển tiếp cho đối tác nội địa giao tới địa chỉ khách.",
    internalNote: "Cước nội địa tính theo quy tắc DOMESTIC_FEE.",
    isActive: true,
  },
  {
    methodCode: "PICKUP_AT_WAREHOUSE",
    methodName: "Khách nhận tại kho",
    estimatedTransitTime: "Trong ngày",
    applicableCondition: "Khách tự tới kho đích lấy hàng",
    description: "Không phát sinh cước nội địa, cần đối chiếu phiếu xuất kho khi giao.",
    internalNote: "Nhân viên kho phải chụp ảnh biên nhận khi khách nhận hàng.",
    isActive: true,
  },
  {
    methodCode: "ROAD_LEGACY",
    methodName: "Đường bộ (bảng giá cũ 2025)",
    estimatedTransitTime: "6 - 8 ngày",
    applicableCondition: "Hợp đồng ký trước 01/2026",
    description: "Giữ lại để tra cứu đơn cũ, không dùng cho báo giá mới.",
    internalNote: "Đã ngừng áp dụng, chỉ đọc.",
    isActive: false,
  },
]);

/* ==================== 4. CẤU HÌNH ĐÓNG GÓI (packageConfigurations) ==================== */

/*
 * Theo normalizePackageConfiguration: cần id, configCode (UPPERCASE), configName,
 * length, width, height, maxWeight, packageFee, estimatedFee, status.
 *
 * estimatedFee để null ở tất cả bản ghi danh sách: getPackageConfigurationFee()
 * ưu tiên estimatedFee nếu khác null, nên nếu điền sẵn thì mọi tính toán phí
 * theo thể tích của cấu hình CUSTOM sẽ bị bỏ qua. estimatedFee chỉ nên xuất hiện
 * ở kết quả API suggest.
 *
 * maxFee chỉ có nghĩa với cấu hình CUSTOM: phí = (thể tích cm³ / 1000) * packageFee,
 * bị chặn trên bởi maxFee.
 */
export const packageConfigurations = withIds("d04e", [
  {
    configCode: "XSMALL",
    configName: "Thùng mini",
    length: 20,
    width: 15,
    height: 10,
    maxWeight: 3,
    packageFee: 18000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "SMALL",
    configName: "Thùng nhỏ",
    length: 30,
    width: 20,
    height: 15,
    maxWeight: 5,
    packageFee: 25000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "MEDIUM",
    configName: "Thùng vừa",
    length: 45,
    width: 35,
    height: 30,
    maxWeight: 15,
    packageFee: 45000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "LARGE",
    configName: "Thùng lớn",
    length: 60,
    width: 45,
    height: 40,
    maxWeight: 30,
    packageFee: 75000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "XLARGE",
    configName: "Thùng quá khổ",
    length: 80,
    width: 60,
    height: 50,
    maxWeight: 45,
    packageFee: 120000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "CUSTOM",
    configName: "Đóng gói theo kích thước thực tế",
    /* Kích thước ở đây là giới hạn trên, phí thực tế tính theo dm³ của kiện. */
    length: 200,
    width: 150,
    height: 150,
    maxWeight: 500,
    packageFee: 12000,
    maxFee: 450000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "CUSTOM_AIR",
    configName: "Đóng gói hàng không theo thực tế",
    length: 120,
    width: 100,
    height: 100,
    maxWeight: 200,
    packageFee: 15000,
    maxFee: 520000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  /*
   * THÙNG GỖ THEO CỠ (WOOD_CRATE_*) — phí thùng gỗ tính theo cỡ của TỪNG kiện, không
   * còn phí cố định theo đơn (rule WOOD_CRATE trong pricingRules chỉ còn là cờ dịch vụ,
   * value 0). Giá mock theo pricing-rules.md: SMALL 180k, MEDIUM 280k, LARGE 430k,
   * EXTRA_LARGE 620k, LONG_BOX 540k, PALLET 750k, CUSTOM theo thể tích.
   * Hai bản ghi đầu giữ nguyên vị trí (id sinh theo vị trí), năm cỡ còn lại nối cuối bộ.
   */
  {
    configCode: "WOOD_CRATE_SMALL",
    configName: "Thùng gỗ cỡ nhỏ",
    length: 40,
    width: 30,
    height: 30,
    maxWeight: 20,
    packageFee: 180000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "WOOD_CRATE_LARGE",
    configName: "Thùng gỗ cỡ lớn",
    length: 80,
    width: 60,
    height: 50,
    maxWeight: 80,
    packageFee: 430000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "PALLET_HALF",
    configName: "Pallet nửa tải",
    length: 100,
    width: 60,
    height: 100,
    maxWeight: 300,
    packageFee: 650000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "PALLET_FULL",
    configName: "Pallet nguyên tải",
    length: 120,
    width: 100,
    height: 120,
    maxWeight: 600,
    packageFee: 980000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "PP_BAG",
    configName: "Bao dệt PP",
    length: 90,
    width: 60,
    height: 40,
    maxWeight: 25,
    packageFee: 22000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "FRAGILE_BOX",
    configName: "Thùng hàng dễ vỡ",
    length: 50,
    width: 40,
    height: 40,
    maxWeight: 12,
    packageFee: 95000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "DOC_ENVELOPE",
    configName: "Phong bì chứng từ",
    length: 35,
    width: 25,
    height: 2,
    maxWeight: 1,
    packageFee: 10000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "SMALL_2025",
    configName: "Thùng nhỏ (bảng giá 2025)",
    length: 30,
    width: 20,
    height: 15,
    maxWeight: 5,
    packageFee: 20000,
    estimatedFee: null,
    /* Giữ để tab trạng thái INACTIVE có dữ liệu. */
    status: "INACTIVE",
  },
  {
    configCode: "WOOD_CRATE_MEDIUM",
    configName: "Thùng gỗ cỡ vừa",
    length: 60,
    width: 40,
    height: 40,
    maxWeight: 45,
    packageFee: 280000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "WOOD_CRATE_EXTRA_LARGE",
    configName: "Thùng gỗ cỡ đại",
    length: 100,
    width: 80,
    height: 60,
    maxWeight: 120,
    packageFee: 620000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "WOOD_CRATE_LONG_BOX",
    configName: "Thùng gỗ dạng dài",
    length: 150,
    width: 40,
    height: 40,
    maxWeight: 90,
    packageFee: 540000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    configCode: "WOOD_CRATE_PALLET",
    configName: "Đóng pallet gỗ",
    length: 120,
    width: 100,
    height: 15,
    maxWeight: 500,
    packageFee: 750000,
    estimatedFee: null,
    status: "ACTIVE",
  },
  {
    /* Mã chứa "CUSTOM" nên packageFee là đơn giá trên 1.000 cm³ của kiện (theo thể tích). */
    configCode: "WOOD_CRATE_CUSTOM",
    configName: "Thùng gỗ tùy chỉnh theo thể tích",
    length: 200,
    width: 150,
    height: 150,
    maxWeight: 500,
    packageFee: 1200,
    estimatedFee: null,
    status: "ACTIVE",
  },
]);

/* ==================== 5. PHÍ DỊCH VỤ BỔ SUNG — ĐÃ GỘP VÀO pricingRules ==================== */

/*
 * Không còn bộ `additionalServiceFees` riêng: mọi phụ phí nằm trong MỘT danh mục
 * `pricingRules` (mục 7). Dòng nào từng là "phí dịch vụ bổ sung" mang thêm hai khoá
 * `feeCode` (mã phí cũ) và `unit`; các hàm *AdditionalServiceFee* của adminService
 * đọc/ghi thẳng trên pricingRules qua hai khoá đó và trả lại đúng hình dạng phí cũ.
 * Hai khoản trùng nghĩa được gộp vào quy tắc sẵn có (INSPECTION_FEE → SUR_INSPECTION,
 * INSURANCE_FEE → SUR_INSURANCE_3PERCENT, DOMESTIC_DELIVERY_FEE → DOMESTIC_FEE,
 * STORAGE_FEE → SUR_STORAGE, OVERSIZE_FEE → SUR_OVERSIZE); WOOD_CRATE_FEE cố định bị bỏ
 * vì phí thùng gỗ giờ tính theo cỡ từng kiện (packageConfigurations WOOD_CRATE_*).
 */

/* ==================== 6. BẢNG GIÁ VẬN CHUYỂN (servicePricings) ==================== */

const carrierId = (code) => pickId(carriers, "carrierCode", code);

/*
 * normalizeServicePricing giữ: id, carrierId, serviceType, originCountry,
 * destinationCountry, unitType, price, currency, effectiveDate, boxPricingRules.
 * Cột "Tuyến" (type route) đọc originCountry/destinationCountry, cột "Đơn giá"
 * (type money) đọc price + record.currency, nên currency phải luôn có.
 *
 * boxPricingRules để mảng rỗng: không component nào đọc field con của nó, chỉ
 * kiểm tra Array.isArray, nên dữ liệu giả trong đó chỉ tạo rủi ro.
 */
export const servicePricings = withIds("f060", [
  {
    carrierId: carrierId("VCL-EXP"),
    serviceType: "EXPRESS",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "KG",
    price: 52000,
    currency: "VND",
    effectiveDate: "2026-07-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("VCL-TRK"),
    serviceType: "STANDARD",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "KG",
    price: 32000,
    currency: "VND",
    effectiveDate: "2026-07-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("HNL"),
    serviceType: "ECONOMY",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "KG",
    price: 24000,
    currency: "VND",
    effectiveDate: "2026-04-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("BTR"),
    serviceType: "STANDARD",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "KG",
    price: 28000,
    currency: "VND",
    effectiveDate: "2026-08-15T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("VCL-EXP"),
    serviceType: "EXPRESS",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "M3",
    price: 5600000,
    currency: "VND",
    effectiveDate: "2026-07-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("VCL-TRK"),
    serviceType: "STANDARD",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "M3",
    price: 4200000,
    currency: "VND",
    effectiveDate: "2026-07-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("VCL-SEA"),
    serviceType: "ECONOMY",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "M3",
    price: 2800000,
    currency: "VND",
    effectiveDate: "2026-05-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("VCL-EXP"),
    serviceType: "EXPRESS",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "PACKAGE",
    price: 460000,
    currency: "VND",
    effectiveDate: "2026-07-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("VCL-TRK"),
    serviceType: "STANDARD",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "PACKAGE",
    price: 320000,
    currency: "VND",
    effectiveDate: "2026-07-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("HNL"),
    serviceType: "ECONOMY",
    originCountry: "CN",
    destinationCountry: "VN",
    unitType: "PACKAGE",
    price: 240000,
    currency: "VND",
    effectiveDate: "2026-04-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("TLA"),
    serviceType: "EXPRESS",
    originCountry: "KR",
    destinationCountry: "VN",
    unitType: "KG",
    price: 210000,
    currency: "VND",
    effectiveDate: "2026-06-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("TLA"),
    serviceType: "STANDARD",
    originCountry: "KR",
    destinationCountry: "VN",
    unitType: "KG",
    price: 145000,
    currency: "VND",
    effectiveDate: "2026-06-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("TLA"),
    serviceType: "STANDARD",
    originCountry: "JP",
    destinationCountry: "VN",
    unitType: "KG",
    price: 165000,
    currency: "VND",
    effectiveDate: "2026-06-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("TCS"),
    serviceType: "ECONOMY",
    originCountry: "JP",
    destinationCountry: "VN",
    unitType: "M3",
    price: 3900000,
    currency: "VND",
    effectiveDate: "2026-03-01T00:00:00.000Z",
    boxPricingRules: [],
  },
  {
    carrierId: carrierId("VCL-TRK"),
    serviceType: "STANDARD",
    originCountry: "VN",
    destinationCountry: "VN",
    unitType: "PACKAGE",
    price: 55000,
    currency: "VND",
    effectiveDate: "2026-02-01T00:00:00.000Z",
    boxPricingRules: [],
  },
]);

/* ==================== 7. QUY TẮC TÍNH GIÁ (pricingRules) ==================== */

const servicePricingIdOf = (serviceType, unitType, originCountry = "CN") =>
  servicePricings.find(
    (pricing) =>
      pricing.serviceType === serviceType &&
      pricing.unitType === unitType &&
      pricing.originCountry === originCountry
  )?.id ?? null;

/*
 * Ràng buộc quan trọng của bộ này:
 *  - ruleCode phải DUY NHẤT: mapPricingRulesByCode() gộp theo code, code trùng
 *    sẽ làm mất quy tắc.
 *  - 7 code trong PRICING_RULE_CODE phải có mặt, vì calculatePricingBreakdown
 *    tra cứu đúng các code này: WOOD_CRATE, DOMESTIC_FEE, VAT,
 *    VOLUMETRIC_DIVISOR, SUR_INSPECTION, IMPORT_TAX, SUR_INSURANCE_3PERCENT.
 *  - DEPOSIT_RATE (%) và VOLUMETRIC_DIVISOR là THAM SỐ, không phải phí: api/ đọc
 *    chúng lúc gọi (tiền cọc, cân quy đổi) nên admin sửa ở màn Quy tắc tính giá là
 *    báo giá tạo sau đó dùng ngay giá trị mới.
 *  - WOOD_CRATE chỉ còn là cờ "khách chọn thùng gỗ" (calculationType BY_SIZE,
 *    value 0): phí thật lấy theo cỡ từng kiện ở packageConfigurations WOOD_CRATE_*.
 *  - Dòng có `feeCode` là phụ phí gộp từ danh mục "phí dịch vụ bổ sung" cũ.
 *  - DOMESTIC_FEE dùng lại đúng id đang hard-code trong HIDDEN_RULE_IDS của
 *    PackageOptionalServices / PackageOptionalServicesS1, nhờ đó phí nội địa
 *    vẫn bị ẩn khỏi danh sách dịch vụ tùy chọn của khách như bản thật.
 *  - VOLUMETRIC_DIVISOR là hệ số quy đổi thể tích, KHÔNG phải khoản phí:
 *    calculatePricingRuleAmount trả 0 cho nó.
 *  - conditionValue là chuỗi (normalizePricingRule chuẩn hóa về text).
 */
export const pricingRules = withIds("0a71", [
  {
    servicePricingId: null,
    ruleName: "Đóng thùng gỗ (theo cỡ từng kiện)",
    ruleCode: "WOOD_CRATE",
    ruleType: "WOOD_BOX",
    conditionType: null,
    conditionValue: null,
    calculationType: "BY_SIZE",
    value: 0,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description:
      "Khách chọn cỡ thùng gỗ cho từng kiện; phí lấy theo cỡ ở Cấu hình đóng gói (WOOD_CRATE_SMALL … WOOD_CRATE_CUSTOM), không có phí cố định theo đơn.",
  },
  {
    /* Id thật đang được component dùng để ẩn quy tắc này khỏi màn khách chọn. */
    id: "0385131b-214c-49b8-9de2-116d62f27111",
    servicePricingId: null,
    ruleName: "Phí vận chuyển nội địa",
    ruleCode: "DOMESTIC_FEE",
    feeCode: "DOMESTIC_DELIVERY_FEE",
    unit: "VND/đơn",
    ruleType: "DOMESTIC_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 30000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Cước giao từ kho đích tới địa chỉ khách, không nằm trong cơ sở tính VAT.",
  },
  {
    servicePricingId: null,
    ruleName: "Thuế giá trị gia tăng",
    ruleCode: "VAT",
    ruleType: "VAT",
    conditionType: "FREIGHT_PLUS_SERVICE",
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 8,
    minAmount: null,
    maxAmount: null,
    isRequired: true,
    status: "ACTIVE",
    description: "Tính trên cước vận chuyển cộng phí dịch vụ, trừ phí nội địa.",
  },
  {
    servicePricingId: null,
    ruleName: "Hệ số khối lượng thể tích",
    ruleCode: "VOLUMETRIC_DIVISOR",
    ruleType: "VOLUMETRIC_WEIGHT",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 6000,
    minAmount: null,
    maxAmount: null,
    isRequired: true,
    status: "ACTIVE",
    description: "Chia thể tích (cm³) cho 6000 để ra khối lượng quy đổi (kg).",
  },
  {
    servicePricingId: null,
    ruleName: "Phụ phí kiểm hàng",
    ruleCode: "SUR_INSPECTION",
    feeCode: "INSPECTION_FEE",
    unit: "VND/kiện",
    ruleType: "INSPECTION",
    conditionType: "REQUIRES_INSPECTION",
    conditionValue: null,
    calculationType: "FIXED",
    value: 20000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Chỉ áp dụng khi đơn có yêu cầu kiểm hàng tại kho đi.",
  },
  {
    servicePricingId: null,
    ruleName: "Thuế nhập khẩu",
    ruleCode: "IMPORT_TAX",
    ruleType: "IMPORT_TAX",
    conditionType: "DECLARED_VALUE",
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 10,
    minAmount: null,
    maxAmount: null,
    isRequired: true,
    status: "ACTIVE",
    description: "Tính trên giá trị khai báo, mức chi tiết theo loại hàng.",
  },
  {
    servicePricingId: null,
    ruleName: "Phụ phí bảo hiểm 3%",
    ruleCode: "SUR_INSURANCE_3PERCENT",
    feeCode: "INSURANCE_FEE",
    unit: "% giá trị khai báo",
    ruleType: "INSURANCE",
    conditionType: "MIN_DECLARED_VALUE",
    conditionValue: "3000000",
    calculationType: "PERCENTAGE",
    value: 3,
    minAmount: 30000,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Chỉ chào khi giá trị khai báo từ 3.000.000 VND, thu tối thiểu 30.000 VND.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí đóng gói tiêu chuẩn",
    ruleCode: "PACKING_STANDARD",
    ruleType: "PACKING",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 15000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Quấn màng PE và chèn xốp chống sốc.",
  },
  {
    servicePricingId: servicePricingIdOf("STANDARD", "KG"),
    ruleName: "Phụ phí nhiên liệu",
    ruleCode: "SUR_FUEL",
    ruleType: "SURCHARGE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 2.5,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Điều chỉnh theo giá dầu, xét lại hàng tháng.",
  },
  {
    servicePricingId: null,
    ruleName: "Phụ phí vùng xa",
    ruleCode: "SUR_REMOTE_AREA",
    ruleType: "SURCHARGE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 45000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Áp dụng cho địa chỉ ngoài phạm vi giao thường của đối tác nội địa.",
  },
  {
    servicePricingId: null,
    ruleName: "Phụ phí hàng quá khổ",
    ruleCode: "SUR_OVERSIZE",
    feeCode: "OVERSIZE_FEE",
    unit: "VND/kiện",
    ruleType: "SURCHARGE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 120000,
    minAmount: null,
    maxAmount: 600000,
    isRequired: false,
    status: "ACTIVE",
    description: "Kiện dài trên 150 cm hoặc cần xe nâng, thu tối đa 600.000 VND.",
  },
  {
    servicePricingId: null,
    ruleName: "Phụ phí lưu kho quá hạn",
    ruleCode: "SUR_STORAGE",
    feeCode: "STORAGE_FEE",
    unit: "VND/kiện/ngày",
    ruleType: "SURCHARGE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 25000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Tính từ ngày thứ 8 hàng nằm tại kho đích.",
  },
  {
    servicePricingId: servicePricingIdOf("ECONOMY", "M3"),
    ruleName: "Phí bốc xếp tuyến biển",
    ruleCode: "SUR_HANDLING_SEA",
    ruleType: "SURCHARGE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 12000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Bốc xếp tại cảng cho hàng LCL, chỉ áp dụng bảng giá đường biển.",
  },
  {
    servicePricingId: null,
    ruleName: "Phụ phí cao điểm",
    ruleCode: "SUR_PEAK_SEASON",
    ruleType: "SURCHARGE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 5,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    /* Ngoài mùa cao điểm nên đang tắt, giúp bộ lọc trạng thái có dữ liệu. */
    status: "INACTIVE",
    description: "Chỉ bật trong dịp Tết Nguyên đán và Lễ Độc thân 11/11.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí phát hành chứng từ CO/CQ",
    ruleCode: "SUR_DOCUMENT",
    ruleType: "SURCHARGE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 50000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "INACTIVE",
    description: "Đã chuyển sang tính trong phí dịch vụ mua hộ từ 08/2026.",
  },
  {
    servicePricingId: null,
    ruleName: "Tỷ lệ đặt cọc",
    ruleCode: "DEPOSIT_RATE",
    ruleType: "DEPOSIT",
    conditionType: null,
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 30,
    minAmount: null,
    maxAmount: null,
    isRequired: true,
    status: "ACTIVE",
    description: "Tiền cọc = tổng báo giá × tỷ lệ này (%), thu khi khách chấp nhận báo giá chính thức.",
  },
  /* ---- Phụ phí gộp từ danh mục "phí dịch vụ bổ sung" cũ (feeCode = mã phí cũ).
     ruleType SETTLEMENT_FEE: không phải dịch vụ khách tự chọn — nằm trong
     HIDDEN_RULE_CODES của PackageOptionalServices / PackageOptionalServicesS1. ---- */
  {
    servicePricingId: null,
    ruleName: "Phí bốc xếp",
    ruleCode: "SUR_HANDLING",
    feeCode: "HANDLING_FEE",
    unit: "VND/kg",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PER_KG",
    value: 1200,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Bốc xếp thủ công cho kiện trên 50 kg.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí quấn màng PE",
    ruleCode: "SUR_PE_WRAP",
    feeCode: "PE_WRAP_FEE",
    unit: "VND/kiện",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 15000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Quấn màng chống ẩm và chống bung kiện.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí chụp ảnh hàng",
    ruleCode: "SUR_PHOTO",
    feeCode: "PHOTO_FEE",
    unit: "VND/sản phẩm",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PER_PRODUCT",
    value: 5000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Chụp ảnh từng sản phẩm gửi khách xác nhận trước khi gom kiện.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí dán nhãn phụ",
    ruleCode: "SUR_LABELING",
    feeCode: "LABELING_FEE",
    unit: "VND/sản phẩm",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PER_PRODUCT",
    value: 2000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Dán nhãn tiếng Việt theo yêu cầu khách nhập hàng thương mại.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí gom hàng nhiều nguồn",
    ruleCode: "SUR_CONSOLIDATION",
    feeCode: "CONSOLIDATION_FEE",
    unit: "VND/lần gom",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 25000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Gom nhiều mã vận đơn nội địa Trung Quốc vào một kiện.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí dịch vụ mua hộ",
    ruleCode: "PURCHASE_COMMISSION",
    feeCode: "PURCHASE_COMMISSION",
    unit: "% giá trị đơn mua hộ",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 3,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Tính trên tổng tiền hàng sau khi quy đổi CNY sang VND.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí chuyển tiền nhà cung cấp",
    ruleCode: "REMITTANCE_FEE",
    feeCode: "REMITTANCE_FEE",
    unit: "% số tiền chuyển",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 0.5,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Phí trả cho kênh chuyển tiền sang tài khoản người bán Trung Quốc.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí kiểm định chất lượng",
    ruleCode: "SUR_QC",
    feeCode: "QC_FEE",
    unit: "VND/đơn",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "FIXED",
    value: 50000,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "ACTIVE",
    description: "Kiểm tra mẫu theo checklist khách cung cấp.",
  },
  {
    servicePricingId: null,
    ruleName: "Phí thu hộ COD (ngừng áp dụng)",
    ruleCode: "COD_FEE_2025",
    feeCode: "COD_FEE_2025",
    unit: "% số tiền thu hộ",
    ruleType: "SETTLEMENT_FEE",
    conditionType: null,
    conditionValue: null,
    calculationType: "PERCENTAGE",
    value: 1.5,
    minAmount: null,
    maxAmount: null,
    isRequired: false,
    status: "INACTIVE",
    description: "Đã ngừng từ 06/2026, giữ lại để tra cứu đơn cũ.",
  },
]);

/*
 * Quy tắc hệ số quy đổi thể tích được tách riêng vì rất nhiều màn báo giá cần
 * nó ở dạng đơn lẻ (chia thể tích ra khối lượng quy đổi) chứ không phải phí.
 */
export const volumetricDivisorRule =
  pricingRules.find((rule) => rule.ruleCode === "VOLUMETRIC_DIVISOR") ?? null;

/* Giá trị hệ số, tiện cho mock nào chỉ cần con số. */
export const volumetricDivisor = volumetricDivisorRule?.value ?? 6000;

/* ==================== 8. TỶ GIÁ (exchangeRates) ==================== */

/*
 * Hình dạng theo normalizeExchangeRateRecord của adminService:
 * id, currencyCode (UPPERCASE), currencyName, rateToVnd, isActive, note,
 * createdAt, updatedAt.
 *
 * Lưu ý cho mock adminService: AdminCatalogPages gọi
 * getExchangeRates({ activeOnly: true }), nên mock phải lọc theo options.activeOnly
 * — vì vậy bộ này cố tình có cả bản ghi đang tắt.
 */
export const exchangeRates = withIds("0b82", [
  {
    currencyCode: "CNY",
    currencyName: "Nhân dân tệ",
    rateToVnd: 3680,
    isActive: true,
    note: "Tỷ giá mua hộ Taobao/1688, cập nhật mỗi sáng theo tỷ giá chợ.",
  },
  {
    currencyCode: "USD",
    currencyName: "Đô la Mỹ",
    rateToVnd: 26150,
    isActive: true,
    note: "Dùng cho hợp đồng vận tải biển và báo giá khách doanh nghiệp.",
  },
  {
    currencyCode: "JPY",
    currencyName: "Yên Nhật",
    rateToVnd: 178,
    isActive: true,
    note: "Áp dụng cho đơn ký gửi tuyến Nhật Bản.",
  },
  {
    currencyCode: "KRW",
    currencyName: "Won Hàn Quốc",
    rateToVnd: 19.4,
    isActive: true,
    note: "Áp dụng cho đơn mua hộ Coupang, Gmarket.",
  },
  {
    currencyCode: "HKD",
    currencyName: "Đô la Hồng Kông",
    rateToVnd: 3350,
    isActive: true,
    note: "Dùng khi thanh toán cho nhà cung cấp đăng ký tại Hồng Kông.",
  },
  {
    currencyCode: "TWD",
    currencyName: "Đài tệ",
    rateToVnd: 830,
    isActive: true,
    note: "Đơn lẻ tuyến Đài Loan, khối lượng nhỏ.",
  },
  {
    currencyCode: "SGD",
    currencyName: "Đô la Singapore",
    rateToVnd: 19850,
    isActive: true,
    note: "Dùng cho phí trung chuyển qua Singapore.",
  },
  {
    currencyCode: "EUR",
    currencyName: "Euro",
    rateToVnd: 28900,
    isActive: true,
    note: "Chỉ dùng khi khách yêu cầu báo giá EUR.",
  },
  {
    currencyCode: "THB",
    currencyName: "Baht Thái",
    rateToVnd: 745,
    isActive: false,
    note: "Tuyến Thái Lan đang tạm dừng.",
  },
  {
    currencyCode: "GBP",
    currencyName: "Bảng Anh",
    rateToVnd: 33200,
    isActive: false,
    note: "Chưa mở tuyến Anh, giữ để tham chiếu.",
  },
  {
    currencyCode: "AUD",
    currencyName: "Đô la Úc",
    rateToVnd: 17150,
    isActive: false,
    note: "Chưa mở tuyến Úc.",
  },
  {
    currencyCode: "MYR",
    currencyName: "Ringgit Malaysia",
    rateToVnd: 5920,
    isActive: false,
    note: "Chưa mở tuyến Malaysia.",
  },
]);

/* ==================== 9. HÀNG CẤM VÀ HẠN CHẾ (restrictedItems) ==================== */

/*
 * restrictionType chỉ nhận BANNED / RESTRICTED / WARNING (cột type "restriction"
 * đổ màu theo đúng ba giá trị này).
 * country dùng mã CN/VN để restrictedItemService map ra tên hiển thị được.
 */
export const restrictedItems = withIds("0c93", [
  {
    itemName: "Pin lithium rời, sạc dự phòng chưa đóng gói chuẩn",
    country: "CN",
    restrictionType: "BANNED",
    note: "Không nhận vận chuyển hàng không, đường bộ cần chứng nhận UN38.3.",
    isActive: true,
  },
  {
    itemName: "Chất lỏng dễ cháy, dung môi, cồn công nghiệp",
    country: "CN",
    restrictionType: "BANNED",
    note: "Thuộc nhóm hàng nguy hiểm, tuyệt đối không nhận.",
    isActive: true,
  },
  {
    itemName: "Bình gas mini, bình khí nén",
    country: "CN",
    restrictionType: "BANNED",
    note: "Bị giữ tại cửa khẩu, rủi ro mất toàn bộ lô hàng.",
    isActive: true,
  },
  {
    itemName: "Vũ khí, công cụ hỗ trợ, dao găm",
    country: "VN",
    restrictionType: "BANNED",
    note: "Vi phạm quy định nhập khẩu, chuyển hồ sơ cho bộ phận pháp chế nếu phát hiện.",
    isActive: true,
  },
  {
    itemName: "Tiền tệ, kim loại quý, đá quý",
    country: "VN",
    restrictionType: "BANNED",
    note: "Không nhận dưới mọi hình thức, kể cả khai báo thấp.",
    isActive: true,
  },
  {
    itemName: "Thuốc lá điện tử, tinh dầu vape",
    country: "VN",
    restrictionType: "BANNED",
    note: "Cấm nhập khẩu theo quy định hiện hành.",
    isActive: true,
  },
  {
    itemName: "Nước hoa, mỹ phẩm dạng lỏng trên 100 ml",
    country: "CN",
    restrictionType: "RESTRICTED",
    note: "Chỉ đi đường bộ, tối đa 5 lít mỗi đơn, phải quấn chống rò rỉ.",
    isActive: true,
  },
  {
    itemName: "Máy bay không người lái (drone)",
    country: "VN",
    restrictionType: "RESTRICTED",
    note: "Cần giấy phép nhập khẩu, sale phải xin xác nhận trước khi nhận đơn.",
    isActive: true,
  },
  {
    itemName: "Thực phẩm chức năng, vitamin",
    country: "VN",
    restrictionType: "RESTRICTED",
    note: "Tối đa 10 hộp mỗi đơn, cần ảnh nhãn sản phẩm khi khai báo.",
    isActive: true,
  },
  {
    itemName: "Thuốc kê đơn, kháng sinh",
    country: "VN",
    restrictionType: "RESTRICTED",
    note: "Chỉ nhận khi có đơn thuốc hoặc giấy phép nhập khẩu.",
    isActive: true,
  },
  {
    itemName: "Rượu trên 22 độ",
    country: "VN",
    restrictionType: "RESTRICTED",
    note: "Chịu thuế tiêu thụ đặc biệt, cần khai báo riêng và giới hạn 3 lít.",
    isActive: true,
  },
  {
    itemName: "Sách, báo, đĩa chưa qua kiểm duyệt",
    country: "VN",
    restrictionType: "RESTRICTED",
    note: "Phải qua kiểm duyệt nội dung, thời gian thông quan kéo dài.",
    isActive: true,
  },
  {
    itemName: "Hạt giống, cây trồng, đất",
    country: "VN",
    restrictionType: "RESTRICTED",
    note: "Yêu cầu kiểm dịch thực vật, khách tự chịu phí kiểm dịch.",
    isActive: true,
  },
  {
    itemName: "Thiết bị phát sóng, bộ đàm",
    country: "VN",
    restrictionType: "RESTRICTED",
    note: "Cần giấy phép tần số, mặc định từ chối nếu khách không cung cấp.",
    isActive: true,
  },
  {
    itemName: "Hàng đông lạnh, thực phẩm tươi",
    country: "CN",
    restrictionType: "WARNING",
    note: "Không có xe lạnh trên tuyến, khách tự chịu rủi ro hư hỏng.",
    isActive: true,
  },
  {
    itemName: "Đồ gốm, thủy tinh, gương kính",
    country: "CN",
    restrictionType: "WARNING",
    note: "Bắt buộc đóng kiện gỗ, không bồi thường nếu khách từ chối đóng kiện.",
    isActive: true,
  },
  {
    itemName: "Đồ chơi trẻ em có nam châm mạnh",
    country: "CN",
    restrictionType: "WARNING",
    note: "Nam châm ảnh hưởng thiết bị bay, cần bọc chống từ khi đi hàng không.",
    isActive: true,
  },
  {
    itemName: "Hàng thương hiệu chưa có giấy uỷ quyền",
    country: "VN",
    restrictionType: "WARNING",
    note: "Rủi ro bị giữ do sở hữu trí tuệ, sale phải cảnh báo khách bằng văn bản.",
    isActive: true,
  },
  {
    itemName: "Ắc quy chì (quy định cũ)",
    country: "CN",
    restrictionType: "BANNED",
    note: "Đã gộp vào nhóm pin, giữ lại để tra cứu đơn cũ.",
    isActive: false,
  },
  /*
   * Hai dòng KR/JP để ô lọc "Quốc gia" của RestrictedItems.jsx không có lựa chọn
   * chết: dropdown đó ghim cứng năm giá trị ALL/Vietnam/China/Korea/Japan, thiếu
   * dữ liệu Hàn Quốc và Nhật Bản là hai lựa chọn cuối lúc nào cũng ra bảng rỗng.
   */
  {
    itemName: "Thực phẩm chức năng, mỹ phẩm chưa công bố",
    country: "KR",
    restrictionType: "RESTRICTED",
    note: "Tuyến Hàn Quốc: cần giấy công bố sản phẩm, giới hạn 5 sản phẩm mỗi đơn.",
    isActive: true,
  },
  {
    itemName: "Đồ cũ đã qua sử dụng (máy ảnh, đồng hồ, quần áo)",
    country: "JP",
    restrictionType: "WARNING",
    note: "Tuyến Nhật Bản: khai đúng là hàng cũ, không bồi thường lỗi có sẵn.",
    isActive: true,
  },
]);

/* ==================== 10. LOẠI HÀNG (productTypes) ==================== */

/*
 * Chỉ có ba field hiển thị: name, importTaxRate, isActive.
 * ConsignmentDetail dò tên loại hàng theo productTypeId dạng UUID, nên các mock
 * đơn hàng phải gán productTypeId bằng đúng id ở đây.
 */
export const productTypes = withIds("0da4", [
  { name: "Quần áo, phụ kiện may mặc", importTaxRate: 20, isActive: true },
  { name: "Giày dép", importTaxRate: 30, isActive: true },
  { name: "Túi xách, ví da", importTaxRate: 25, isActive: true },
  { name: "Đồ điện tử và phụ kiện", importTaxRate: 10, isActive: true },
  { name: "Điện thoại, máy tính", importTaxRate: 5, isActive: true },
  { name: "Đồ gia dụng", importTaxRate: 15, isActive: true },
  { name: "Nội thất, đồ gỗ", importTaxRate: 20, isActive: true },
  { name: "Mỹ phẩm, chăm sóc cá nhân", importTaxRate: 18, isActive: true },
  { name: "Đồ chơi trẻ em", importTaxRate: 12, isActive: true },
  { name: "Văn phòng phẩm", importTaxRate: 8, isActive: true },
  { name: "Phụ tùng xe máy, ô tô", importTaxRate: 22, isActive: true },
  { name: "Máy móc, thiết bị công nghiệp", importTaxRate: 5, isActive: true },
  { name: "Vải và nguyên phụ liệu may", importTaxRate: 12, isActive: true },
  { name: "Dụng cụ thể thao", importTaxRate: 15, isActive: true },
  { name: "Hàng gốm, sứ, thủy tinh", importTaxRate: 25, isActive: true },
  { name: "Hàng mẫu không thương mại", importTaxRate: 0, isActive: false },
]);

/* ==================== 11. ĐƠN VỊ TÍNH (unitsOfMeasure) ==================== */

/* displayOrder là số, dùng cho cột sắp xếp; unitCode viết hoa không dấu. */
export const unitsOfMeasure = withIds("0eb5", [
  { unitCode: "CAI", unitName: "Cái", description: "Đơn vị lẻ mặc định cho hàng tiêu dùng.", displayOrder: 1, isActive: true },
  { unitCode: "CHIEC", unitName: "Chiếc", description: "Dùng cho quần áo, giày dép, phụ kiện.", displayOrder: 2, isActive: true },
  { unitCode: "BO", unitName: "Bộ", description: "Nhóm sản phẩm bán kèm theo bộ.", displayOrder: 3, isActive: true },
  { unitCode: "DOI", unitName: "Đôi", description: "Giày, dép, tất, găng tay.", displayOrder: 4, isActive: true },
  { unitCode: "HOP", unitName: "Hộp", description: "Hàng đóng hộp nhỏ, mỹ phẩm, thực phẩm chức năng.", displayOrder: 5, isActive: true },
  { unitCode: "TUI", unitName: "Túi", description: "Hàng đóng túi zip hoặc túi nilon.", displayOrder: 6, isActive: true },
  { unitCode: "THUNG", unitName: "Thùng", description: "Thùng carton nguyên đai nguyên kiện.", displayOrder: 7, isActive: true },
  { unitCode: "KIEN", unitName: "Kiện", description: "Đơn vị đóng kiện dùng khi tính phí đóng gói.", displayOrder: 8, isActive: true },
  { unitCode: "BAO", unitName: "Bao", description: "Bao dệt PP cho hàng rời.", displayOrder: 9, isActive: true },
  { unitCode: "CUON", unitName: "Cuộn", description: "Vải, màng nhựa, dây cáp.", displayOrder: 10, isActive: true },
  { unitCode: "TAM", unitName: "Tấm", description: "Kính, gỗ ép, tôn.", displayOrder: 11, isActive: true },
  { unitCode: "MET", unitName: "Mét", description: "Hàng bán theo chiều dài.", displayOrder: 12, isActive: true },
  { unitCode: "M2", unitName: "Mét vuông", description: "Sàn gỗ, gạch, vật liệu tấm.", displayOrder: 13, isActive: true },
  { unitCode: "M3", unitName: "Mét khối", description: "Đơn vị tính cước theo thể tích.", displayOrder: 14, isActive: true },
  { unitCode: "KG", unitName: "Kilôgam", description: "Đơn vị tính cước theo khối lượng.", displayOrder: 15, isActive: true },
  { unitCode: "TAN", unitName: "Tấn", description: "Hàng nặng đi đường sắt hoặc container.", displayOrder: 16, isActive: true },
  { unitCode: "LO", unitName: "Lô", description: "Đơn vị cũ, không dùng cho đơn mới.", displayOrder: 99, isActive: false },
]);

/* ==================== 12. NHÀ CUNG CẤP (suppliers) ==================== */

/* Tên doanh nghiệp và người liên hệ đều hư cấu. country dùng mã quốc gia. */
export const suppliers = withIds("0fc6", [
  {
    supplierCode: "NCC-GZ-001",
    supplierName: "Quảng Châu Thịnh Hưng Logistics",
    supplierType: "FORWARDER",
    country: "CN",
    contactPerson: "Lâm Thục Trân",
    phone: "+86 20 8877 4410",
    email: "sales@thinhhung-gz.cn",
    address: "Tầng 6, toà B, số 128 đường Trạm Tây, quận Bạch Vân, Quảng Châu",
    note: "Đối tác gom hàng chính tại Quảng Châu, thanh toán cuối tháng.",
    isActive: true,
  },
  {
    supplierCode: "NCC-YW-002",
    supplierName: "Nghĩa Ô Đại Thành Trading",
    supplierType: "SOURCING_AGENT",
    country: "CN",
    contactPerson: "Ngô Tử Kỳ",
    phone: "+86 579 8552 3366",
    email: "kd@daithanh-yw.cn",
    address: "Khu C chợ quốc tế Nghĩa Ô, thành phố Nghĩa Ô, Chiết Giang",
    note: "Chuyên tìm nguồn hàng phụ kiện, đồ chơi, văn phòng phẩm.",
    isActive: true,
  },
  {
    supplierCode: "NCC-SZ-003",
    supplierName: "Thâm Quyến Hoa Tín Electronics",
    supplierType: "SOURCING_AGENT",
    country: "CN",
    contactPerson: "Hoàng Duệ Văn",
    phone: "+86 755 2788 9911",
    email: "order@hoatin-sz.cn",
    address: "Số 5 đường Hoa Cường Bắc, quận Phúc Điền, Thâm Quyến",
    note: "Nguồn hàng điện tử, yêu cầu đặt cọc 50% khi lên đơn.",
    isActive: true,
  },
  {
    supplierCode: "NCC-DX-004",
    supplierName: "Đông Hưng Phú Cường Warehouse",
    supplierType: "WAREHOUSE_PARTNER",
    country: "CN",
    contactPerson: "Lý Bội San",
    phone: "+86 770 7695 335",
    email: "kho@phucuong-dx.cn",
    address: "Khu logistics cửa khẩu Đông Hưng, Phòng Thành Cảng, Quảng Tây",
    note: "Cho thuê kho trung chuyển và bốc xếp qua biên giới.",
    isActive: true,
  },
  {
    supplierCode: "NCC-PX-005",
    supplierName: "Bằng Tường Liên Vận Cargo",
    supplierType: "FORWARDER",
    country: "CN",
    contactPerson: "Chu Nhã Đình",
    phone: "+86 771 8532 778",
    email: "booking@lienvan-px.cn",
    address: "Khu ga liên vận Bằng Tường, Sùng Tả, Quảng Tây",
    note: "Đặt chỗ tàu liên vận, cần booking trước 5 ngày.",
    isActive: true,
  },
  {
    supplierCode: "NCC-LS-006",
    supplierName: "Vận tải Lạng Sơn Phát",
    supplierType: "TRUCKING",
    country: "VN",
    contactPerson: "Nguyễn Thị Hoài Thu",
    phone: "0912 778 340",
    email: "dieuhanh@langsonphat.vn",
    address: "Khu Tân Thanh, huyện Văn Lãng, tỉnh Lạng Sơn",
    note: "Kéo hàng từ cửa khẩu về kho Hà Nội, xe 8 tấn và 15 tấn.",
    isActive: true,
  },
  {
    supplierCode: "NCC-HN-007",
    supplierName: "Đại lý hải quan Tín Nghĩa",
    supplierType: "CUSTOMS_BROKER",
    country: "VN",
    contactPerson: "Trần Đức Kiên",
    phone: "0243 776 5521",
    email: "hosokhaibao@tinnghia-customs.vn",
    address: "Số 12 phố Trần Thái Tông, quận Cầu Giấy, thành phố Hà Nội",
    note: "Khai báo hải quan cho hàng thương mại và hàng cần giấy phép.",
    isActive: true,
  },
  {
    supplierCode: "NCC-HP-008",
    supplierName: "Cảng vụ Hải Phòng Minh Long",
    supplierType: "CUSTOMS_BROKER",
    country: "VN",
    contactPerson: "Vũ Hồng Quân",
    phone: "0225 368 4412",
    email: "thutuc@minhlong-hp.vn",
    address: "Số 88 đường Lê Thánh Tông, quận Ngô Quyền, thành phố Hải Phòng",
    note: "Xử lý hàng LCL cập cảng Hải Phòng.",
    isActive: true,
  },
  {
    supplierCode: "NCC-HN-009",
    supplierName: "Đóng gói Hoàng Mai Pack",
    supplierType: "PACKING_PARTNER",
    country: "VN",
    contactPerson: "Đỗ Thanh Hà",
    phone: "0983 442 117",
    email: "xuong@hoangmaipack.vn",
    address: "Số 30 ngõ 254 Tam Trinh, quận Hoàng Mai, thành phố Hà Nội",
    note: "Đóng kiện gỗ và pallet tại kho Hà Nội.",
    isActive: true,
  },
  {
    supplierCode: "NCC-SG-010",
    supplierName: "Kho vận Bình Tân Thành Đạt",
    supplierType: "WAREHOUSE_PARTNER",
    country: "VN",
    contactPerson: "Lê Ngọc Diệp",
    phone: "0283 754 6688",
    email: "kho@thanhdat-btan.vn",
    address: "Số 210 đường Trần Đại Nghĩa, quận Bình Tân, TP. Hồ Chí Minh",
    note: "Thuê thêm diện tích kho dịp cao điểm.",
    isActive: true,
  },
  {
    supplierCode: "NCC-DN-011",
    supplierName: "Vận tải Hải Vân Đà Nẵng",
    supplierType: "TRUCKING",
    country: "VN",
    contactPerson: "Trương Quốc Bảo",
    phone: "0236 374 1123",
    email: "xe@haivan-dn.vn",
    address: "Lô 30 KCN Hòa Khánh, quận Liên Chiểu, thành phố Đà Nẵng",
    note: "Trung chuyển Bắc - Trung - Nam.",
    isActive: true,
  },
  {
    supplierCode: "NCC-KR-012",
    supplierName: "Seoul Baro Forwarding",
    supplierType: "FORWARDER",
    country: "KR",
    contactPerson: "Park Ji Won",
    phone: "+82 2 6712 4480",
    email: "vn.desk@barofwd.kr",
    address: "Quận Guro, Seoul, Hàn Quốc",
    note: "Gom hàng mua hộ Coupang, Gmarket về Nội Bài.",
    isActive: true,
  },
  {
    supplierCode: "NCC-JP-013",
    supplierName: "Osaka Sakura Cargo",
    supplierType: "FORWARDER",
    country: "JP",
    contactPerson: "Sato Kenji",
    phone: "+81 6 6392 7710",
    email: "export@sakuracargo.jp",
    address: "Quận Yodogawa, Osaka, Nhật Bản",
    note: "Tuyến Nhật Bản, ưu tiên hàng nội địa Nhật.",
    isActive: true,
  },
  {
    supplierCode: "NCC-GZ-014",
    supplierName: "Quảng Châu Tân Nghiệp Cargo",
    supplierType: "FORWARDER",
    country: "CN",
    contactPerson: "Tô Kiến Bình",
    phone: "+86 20 8890 5567",
    email: "cs@tannghiep-gz.cn",
    address: "Số 66 đường Giải Phóng Bắc, quận Việt Tú, Quảng Châu",
    note: "Đã dừng hợp tác từ 05/2026 do chậm gom hàng.",
    isActive: false,
  },
]);

/* ==================== 13. TUYẾN VẬN CHUYỂN QUỐC TẾ (shippingRoutes) ==================== */

/*
 * Giới hạn khai báo theo tuyến (CAP-1, pricing-rules.md) — Admin sửa ở màn Tuyến vận
 * chuyển. Giá trị mock giống nhau cho mọi tuyến; mỗi bản ghi mang bản sao riêng nên sửa
 * một tuyến không kéo theo tuyến khác. Story này chưa nối form khai đơn vào đây.
 */
const ROUTE_DECLARATION_LIMITS = Object.freeze({
  maxItemsPerParcel: 5,
  maxParcelWeightKg: 3,
  maxParcelValue: 6000000,
  maxLengthCm: 100,
  maxWidthCm: 200,
  maxHeightCm: 50,
  maxOrderWeightKg: 5,
  maxOrderValue: 10000000,
});

const warehouseId = (code) => pickId(warehouses, "code", code);
const supplierId = (code) => pickId(suppliers, "supplierCode", code);

/*
 * originCountry / destinationCountry chỉ nhận CN, VN, KR, JP (select trong form)
 * và transportMode chỉ nhận AIR, SEA, ROAD, RAIL.
 * originWarehouseId / destinationWarehouseId / carrierId / supplierId là các
 * select nạp option từ API, nên giá trị phải là id thật của ba bộ dữ liệu trên,
 * nếu không ô select sẽ hiện id thô.
 */
export const shippingRoutes = withIds("1ad7", [
  {
    routeCode: "CNVN-GZ-HN-ROAD",
    routeName: "Quảng Châu → Hà Nội (đường bộ)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "ROAD",
    originWarehouseId: warehouseId("CN-GZ-01"),
    destinationWarehouseId: warehouseId("VN-HN-01"),
    carrierId: carrierId("VCL-TRK"),
    supplierId: supplierId("NCC-GZ-001"),
    estimatedTransitDays: 6,
    note: "Tuyến chủ lực, qua cửa khẩu Tân Thanh, xuất xe thứ Hai và thứ Năm.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-GZ-HN-AIR",
    routeName: "Quảng Châu → Hà Nội (hàng không)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "AIR",
    originWarehouseId: warehouseId("CN-GZ-02"),
    destinationWarehouseId: warehouseId("VN-HN-01"),
    carrierId: carrierId("TLA"),
    supplierId: supplierId("NCC-GZ-001"),
    estimatedTransitDays: 2,
    note: "Dành cho hàng gấp và hàng giá trị cao, không nhận pin rời.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-GZ-SG-ROAD",
    routeName: "Quảng Châu → TP. Hồ Chí Minh (đường bộ)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "ROAD",
    originWarehouseId: warehouseId("CN-GZ-01"),
    destinationWarehouseId: warehouseId("VN-SG-01"),
    carrierId: carrierId("VCL-TRK"),
    supplierId: supplierId("NCC-LS-006"),
    estimatedTransitDays: 9,
    note: "Trung chuyển tại kho Hà Nội trước khi xuống miền Nam.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-YW-HN-ROAD",
    routeName: "Nghĩa Ô → Hà Nội (đường bộ)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "ROAD",
    originWarehouseId: warehouseId("CN-YW-01"),
    destinationWarehouseId: warehouseId("VN-HN-01"),
    carrierId: carrierId("HNL"),
    supplierId: supplierId("NCC-YW-002"),
    estimatedTransitDays: 8,
    note: "Hàng phụ kiện và đồ chơi, gom tại kho Nghĩa Ô rồi về Quảng Châu.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-SZ-HP-SEA",
    routeName: "Thâm Quyến → Hải Phòng (đường biển)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "SEA",
    originWarehouseId: warehouseId("CN-SZ-01"),
    destinationWarehouseId: warehouseId("VN-HP-01"),
    carrierId: carrierId("VCL-SEA"),
    supplierId: supplierId("NCC-HP-008"),
    estimatedTransitDays: 14,
    note: "Gom hàng LCL, cut-off thứ Ba và thứ Sáu.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-SZ-SG-SEA",
    routeName: "Thâm Quyến → TP. Hồ Chí Minh (đường biển)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "SEA",
    originWarehouseId: warehouseId("CN-SZ-01"),
    destinationWarehouseId: warehouseId("VN-SG-01"),
    carrierId: carrierId("TCS"),
    supplierId: supplierId("NCC-SG-010"),
    estimatedTransitDays: 16,
    note: "Cập cảng Cát Lái, phù hợp hàng container nguyên.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-PX-LS-RAIL",
    routeName: "Bằng Tường → Lạng Sơn (đường sắt)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "RAIL",
    originWarehouseId: warehouseId("CN-PX-01"),
    destinationWarehouseId: warehouseId("VN-LS-01"),
    carrierId: carrierId("BTR"),
    supplierId: supplierId("NCC-PX-005"),
    estimatedTransitDays: 7,
    note: "Ưu tiên hàng nặng trên 500 kg, lịch tàu 3 chuyến mỗi tuần.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-DX-HN-ROAD",
    routeName: "Đông Hưng → Hà Nội (đường bộ)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "ROAD",
    originWarehouseId: warehouseId("CN-DX-01"),
    destinationWarehouseId: warehouseId("VN-HN-02"),
    carrierId: carrierId("DHVT"),
    supplierId: supplierId("NCC-DX-004"),
    estimatedTransitDays: 4,
    note: "Qua cửa khẩu Móng Cái, phù hợp hàng nhỏ lẻ đi nhanh.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-GZ-DN-ROAD",
    routeName: "Quảng Châu → Đà Nẵng (đường bộ)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "ROAD",
    originWarehouseId: warehouseId("CN-GZ-02"),
    destinationWarehouseId: warehouseId("VN-DN-01"),
    carrierId: carrierId("HVC"),
    supplierId: supplierId("NCC-DN-011"),
    estimatedTransitDays: 8,
    note: "Trung chuyển tại kho Hà Nội, giao tiếp bằng xe nội địa.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "KRVN-SEL-HN-AIR",
    routeName: "Seoul → Hà Nội (hàng không)",
    originCountry: "KR",
    destinationCountry: "VN",
    transportMode: "AIR",
    originWarehouseId: null,
    destinationWarehouseId: warehouseId("VN-HN-01"),
    carrierId: carrierId("TLA"),
    supplierId: supplierId("NCC-KR-012"),
    estimatedTransitDays: 3,
    note: "Chưa có kho riêng tại Hàn Quốc, nhận hàng tại kho đối tác.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "JPVN-OSA-HN-AIR",
    routeName: "Osaka → Hà Nội (hàng không)",
    originCountry: "JP",
    destinationCountry: "VN",
    transportMode: "AIR",
    originWarehouseId: null,
    destinationWarehouseId: warehouseId("VN-HN-01"),
    carrierId: carrierId("TLA"),
    supplierId: supplierId("NCC-JP-013"),
    estimatedTransitDays: 4,
    note: "Tuyến Nhật Bản, ưu tiên hàng nội địa và hàng mẹ bé.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "JPVN-OSA-HP-SEA",
    routeName: "Osaka → Hải Phòng (đường biển)",
    originCountry: "JP",
    destinationCountry: "VN",
    transportMode: "SEA",
    originWarehouseId: null,
    destinationWarehouseId: warehouseId("VN-HP-01"),
    carrierId: carrierId("TCS"),
    supplierId: supplierId("NCC-JP-013"),
    estimatedTransitDays: 18,
    note: "Hàng nội thất và máy móc cũ, cần kiểm định trước khi nhập.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "VNVN-HN-SG-ROAD",
    routeName: "Hà Nội → TP. Hồ Chí Minh (nội địa)",
    originCountry: "VN",
    destinationCountry: "VN",
    transportMode: "ROAD",
    originWarehouseId: warehouseId("VN-HN-01"),
    destinationWarehouseId: warehouseId("VN-SG-01"),
    carrierId: carrierId("NVE"),
    supplierId: supplierId("NCC-DN-011"),
    estimatedTransitDays: 3,
    note: "Chặng nội địa sau khi hàng đã thông quan.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: true,
  },
  {
    routeCode: "CNVN-GZ-SG-AIR",
    routeName: "Quảng Châu → TP. Hồ Chí Minh (hàng không)",
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "AIR",
    originWarehouseId: warehouseId("CN-GZ-01"),
    destinationWarehouseId: warehouseId("VN-SG-02"),
    carrierId: carrierId("PLL"),
    supplierId: supplierId("NCC-GZ-014"),
    estimatedTransitDays: 3,
    note: "Tạm dừng vì kho đích Thủ Đức và đối tác đều đã ngừng hoạt động.",
    ...ROUTE_DECLARATION_LIMITS,
    isActive: false,
  },
]);

/* ==================== SELECTOR ==================== */

const sameId = (record, id) => String(record?.id ?? "") === String(id ?? "");

/* Selector chung: dùng khi mock chỉ có id mà không biết thuộc bộ nào. */
export const findIn = (collection, id) => {
  if (!Array.isArray(collection) || id === null || id === undefined || id === "") {
    return null;
  }

  return collection.find((record) => sameId(record, id)) ?? null;
};

/* Selector theo từng loại tài nguyên, khớp thứ tự 13 loại của adminService. */
export const findWarehouseById = (id) => findIn(warehouses, id);
export const findCarrierById = (id) => findIn(carriers, id);
export const findShippingMethodById = (id) => findIn(shippingMethods, id);
export const findPackageConfigurationById = (id) => findIn(packageConfigurations, id);
/* Phí dịch vụ bổ sung = quy tắc giá có feeCode (không còn bộ riêng). */
export const findAdditionalServiceFeeById = (id) => {
  const rule = findIn(pricingRules, id);
  return rule?.feeCode ? rule : null;
};
export const findServicePricingById = (id) => findIn(servicePricings, id);
export const findPricingRuleById = (id) => findIn(pricingRules, id);
export const findExchangeRateById = (id) => findIn(exchangeRates, id);
export const findRestrictedItemById = (id) => findIn(restrictedItems, id);
export const findProductTypeById = (id) => findIn(productTypes, id);
export const findUnitOfMeasureById = (id) => findIn(unitsOfMeasure, id);
export const findSupplierById = (id) => findIn(suppliers, id);
export const findShippingRouteById = (id) => findIn(shippingRoutes, id);

/*
 * Tra cứu theo mã: các bộ dữ liệu nghiệp vụ nên dùng nhóm này thay vì
 * hard-code UUID, vì id được sinh theo vị trí trong mảng.
 */
export const findWarehouseByCode = (code) =>
  warehouses.find((warehouse) => warehouse.code === code) ?? null;
export const findCarrierByCode = (code) =>
  carriers.find((carrier) => carrier.carrierCode === code) ?? null;
export const findShippingMethodByCode = (code) =>
  shippingMethods.find((method) => method.methodCode === code) ?? null;
export const findPackageConfigurationByCode = (code) =>
  packageConfigurations.find((configuration) => configuration.configCode === code) ?? null;
export const findAdditionalServiceFeeByCode = (code) =>
  pricingRules.find((rule) => rule.feeCode && rule.feeCode === code) ?? null;
export const findPricingRuleByCode = (code) =>
  pricingRules.find((rule) => rule.ruleCode === code) ?? null;
export const findExchangeRateByCurrency = (currencyCode) =>
  exchangeRates.find((rate) => rate.currencyCode === String(currencyCode ?? "").toUpperCase()) ??
  null;
export const findProductTypeByName = (name) =>
  productTypes.find((productType) => productType.name === name) ?? null;
export const findUnitOfMeasureByCode = (code) =>
  unitsOfMeasure.find((unit) => unit.unitCode === code) ?? null;
export const findSupplierByCode = (code) =>
  suppliers.find((supplier) => supplier.supplierCode === code) ?? null;
export const findShippingRouteByCode = (code) =>
  shippingRoutes.find((route) => route.routeCode === code) ?? null;

/* Gom theo tên tài nguyên để mock adminService tra cứu động nếu cần. */
export const catalogCollections = {
  warehouses,
  carriers,
  shippingMethods,
  packageConfigurations,
  servicePricings,
  pricingRules,
  exchangeRates,
  restrictedItems,
  productTypes,
  unitsOfMeasure,
  suppliers,
  shippingRoutes,
};

const catalog = {
  ...catalogCollections,
  volumetricDivisorRule,
  volumetricDivisor,
  findIn,
};

export default catalog;
