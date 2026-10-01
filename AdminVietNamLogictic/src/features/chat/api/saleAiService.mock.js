/**
 * MOCK trợ lý AI của Sales — BẢN SAO LƯU, không màn nào import (bản thật: saleAiService.js).
 *
 * Bản thật POST "/api/ai/sales/order-status-query" qua axios instance dùng chung rồi đưa
 * response cho normalizeSalesOrderStatusResponse. Ở đây chỉ đúng MỘT hàm đổi ruột:
 * querySalesOrderStatus dựng sẵn một "response giả" cùng hình dạng { data: { data } }
 * rồi cho đi qua chính normalizeSalesOrderStatusResponse cũ. Nhờ vậy toàn bộ logic
 * đặt nhãn tiếng Việt, soạn câu trả lời khách và sinh cảnh báo vẫn là code gốc,
 * không phải bản viết lại — sai lệch nhãn là không thể xảy ra.
 *
 * Các hàm thuần (mapStatusLabel, normalizeSalesOrderStatusResponse, buildCustomerReply,
 * buildWarnings, getSalesAiError) được giữ NGUYÊN VĂN vì chúng không hề gọi mạng.
 *
 * CẮM API THẬT TRỞ LẠI: chỉ cần sửa lại thân querySalesOrderStatus — import
 * axios instance dùng chung rồi POST "/api/ai/sales/order-status-query" với
 * buildPayload(payload) và { signal: options.signal }, cuối cùng trả
 * normalizeSalesOrderStatusResponse(response). buildPayload cố ý còn nguyên bên
 * dưới (kể cả phần lọc trường rỗng) nên không phải dựng lại body request.
 */
import {
  createApiError,
  deepClone,
  delay,
  isoDaysAgo,
  isoHoursAgo,
  normalizeText,
} from "@/mocks/mockUtils";
import {
  getOrderStatusLabel,
  LEGACY_ORDER_STATUS_MAP,
  ORDER_STATUS_LABELS,
} from "@features/consignment";
import { labelOf } from "@shared/utils/statusLabel";

/*
 * Nhãn trạng thái ĐƠN (19 mã đích + mã cũ) lấy từ module dùng chung của feature
 * consignment. Bảng dưới chỉ còn các mã KHÔNG phải trạng thái đơn mà hồ sơ AI trả về
 * cho kho / lô / kiện, và được tra TRƯỚC mã cũ của đơn (RECEIVED ở đây là "đã nhận kiện").
 */
const NON_ORDER_STATUS_LABELS = {
  CANCELED: "Đã hủy",
  RECEIVED: "Đã nhận kiện",
  RELEASE_PENDING: "Chờ xuất kho",
  RELEASED: "Đã xuất kho",
  NOT_ASSIGNED: "Chưa ghép lô vận chuyển quốc tế",
};

const lookupStatusLabel = (code) => {
  if (ORDER_STATUS_LABELS[code]) return ORDER_STATUS_LABELS[code];
  if (NON_ORDER_STATUS_LABELS[code]) return NON_ORDER_STATUS_LABELS[code];
  if (LEGACY_ORDER_STATUS_MAP[code] || code.startsWith("CUSTOMS_")) {
    return getOrderStatusLabel(code);
  }
  return "";
};

const PAYMENT_LABELS = {
  PENDING: "Chưa thanh toán",
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  SUCCESS: "Đã thanh toán",
  FAILED: "Thanh toán thất bại",
  CANCELED: "Đã hủy thanh toán",
  CANCELLED: "Đã hủy thanh toán",
};

const trimOrNull = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const extractStatusCode = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const paren = text.match(/\(([A-Z0-9_]+)\)\s*$/);
  if (paren?.[1]) return paren[1];

  const tokens = text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g);
  if (tokens?.length) return tokens[tokens.length - 1];

  return text.toUpperCase().replace(/\s+/g, "_");
};

export const mapStatusLabel = (value, kind = "order") => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const code = extractStatusCode(text);
  if (kind === "payment" && PAYMENT_LABELS[code]) {
    return PAYMENT_LABELS[code];
  }
  const statusLabel = lookupStatusLabel(code);
  if (statusLabel) return statusLabel;

  if (/chưa thanh toán/i.test(text)) return "Chưa thanh toán";
  if (/đã thanh toán/i.test(text)) return "Đã thanh toán";
  if (/chưa ghép/i.test(text)) return "Chưa ghép lô vận chuyển quốc tế";
  if (/đã nhập kho|checked.?in/i.test(text)) return "Đã nhập kho";

  /* Mã máy còn lại: dịch qua bảng nhãn chung — không bao giờ in "Received at destination". */
  if (/^[A-Z0-9_\- :()]+$/.test(text) && /[A-Z]{3,}/.test(text)) {
    return labelOf(null, code);
  }

  return text;
};

const buildPayload = ({
  message,
  orderCode,
  customerId,
  relatedType,
  relatedId,
} = {}) => {
  const payload = { message: String(message ?? "").trim() };
  const optionalFields = {
    orderCode: trimOrNull(orderCode),
    customerId: trimOrNull(customerId),
    relatedType: trimOrNull(relatedType),
    relatedId: trimOrNull(relatedId),
  };

  for (const [key, value] of Object.entries(optionalFields)) {
    if (value) payload[key] = value;
  }

  return payload;
};

/* =========================================================
   HỒ SƠ AI MẪU (fixture tự chứa)

   Mỗi bản ghi là một "hồ sơ" mà backend AI vốn tổng hợp từ nhiều bảng: đơn ký gửi /
   mua hộ, thanh toán, tồn kho, lô vận chuyển quốc tế. Trường currentStatus cố ý
   trộn hai dạng backend thật hay trả — mã trần ("CHECKED_IN") và câu tiếng Việt kèm
   mã trong ngoặc ("Đã nhận kiện tại kho (RECEIVED)") — để nhánh đọc mã của
   mapStatusLabel được chạy thật chứ không nằm chờ.

   Mã đơn dùng đúng các mã đang có trong src/mocks/data/consignments.js,
   purchaseRequests.js và operations.js: Sales tra cứu mã thấy ở màn danh sách thì
   panel AI vẫn ra hồ sơ, không rơi vào nhánh "không tìm thấy".

   customerId / customerName PHẢI là chủ đơn thật của chính mã đơn đó (tra qua
   customerIndex trong hai file fixture trên, rồi lấy CONSIGNMENT_CUSTOMERS /
   PURCHASE_CUSTOMERS). Hai lý do, cả hai đều nhìn thấy được trên giao diện:
     - findDossier() còn một nhánh tra theo customerId — ConsignmentDetail bấm
       "Hỏi AI trạng thái" truyền customer id của đơn, nên id bịa ra là nhánh đó
       chết, và đơn nào chưa có hồ sơ sẽ rơi thẳng vào "không tìm thấy" thay vì ra
       một đơn khác của cùng khách.
     - buildRelatedOrders() gom "đơn cùng khách" theo customerId để dựng Select
       "Đơn liên quan"; gán sai là dropdown gợi ý đơn của người khác.
   `currentStatus` cũng đi theo trạng thái thật của đơn trong fixture: đơn ký gửi dùng
   19 mã đích của features/consignment/constants/orderStatus.js.
========================================================= */

const DATA_SOURCES_CONSIGNMENT = [
  "consignment_orders",
  "payments",
  "warehouse_inventory",
  "international_shipments",
];

const DATA_SOURCES_PURCHASE = [
  "purchase_requests",
  "payments",
  "warehouse_inventory",
  "international_shipments",
];

const parcel = ({
  parcelId,
  packageCode,
  status,
  warehouseName = "Kho Quảng Châu (WH-CN-GZ)",
  weightKg = 10.5,
  binCode = "A01-03",
  checkedInDaysAgo = 3,
}) => ({
  parcelId,
  packageCode,
  status,
  warehouseName,
  weightKg,
  binCode,
  checkedInAt: isoDaysAgo(checkedInDaysAgo),
});

const AI_DOSSIERS = [
  {
    orderCode: "VCL-20260901083012-104233",
    orderId: "ord-cnm-001",
    orderType: "CONSIGNMENT",
    customerId: "c0570001-0000-4000-8000-000000000001",
    customerName: "Nguyễn Thị Bích Hằng",
    currentStatus: "PENDING_REVIEW",
    paymentStatus: "PENDING",
    warehouseStatus: "",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Đơn ký gửi gồm 2 dòng hàng (loa bluetooth, tai nghe) đang chờ nghiệp vụ duyệt hồ sơ. " +
      "Ước tính cước 4.850.000 VND, khách yêu cầu kiểm tra nguồn điện trước khi đóng thùng. " +
      "Chưa phát sinh thanh toán và chưa có kiện nào về kho Quảng Châu.",
    nextActionSuggestion:
      "Duyệt hồ sơ ký gửi và gửi báo giá cho khách trong hôm nay.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoHoursAgo(9),
  },
  {
    orderCode: "VCL-20260901094455-118902",
    orderId: "ord-cnm-002",
    orderType: "CONSIGNMENT",
    customerId: "c0570002-0000-4000-8000-000000000002",
    customerName: "Trần Quốc Duy",
    currentStatus: "PENDING_REVIEW",
    paymentStatus: "UNPAID",
    warehouseStatus: "",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Đơn phụ kiện điện thoại nhận từ kho Nghĩa Ô đang chờ xử lý. " +
      "Khách khai 6 thùng nhưng phiếu nội địa chỉ có 5 mã vận đơn, cần đối chiếu lại trước khi báo giá.",
    nextActionSuggestion:
      "Xác nhận lại số lượng thùng với khách rồi cập nhật phiếu ký gửi.",
    warning: "Số kiện khách khai lệch với mã vận đơn nội địa.",
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoHoursAgo(14),
  },
  {
    orderCode: "VCL-20260828093310-152904",
    orderId: "ord-cnm-003",
    orderType: "CONSIGNMENT",
    customerId: "c0570006-0000-4000-8000-000000000006",
    customerName: "Đặng Thị Kim Ngân",
    currentStatus: "QUOTATION_SENT",
    paymentStatus: "PENDING",
    warehouseStatus: "",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Báo giá 7.320.000 VND (cước biển LCL + phí kiểm hàng) đã gửi khách qua Zalo. " +
      "Đơn vẫn nằm ở bước chờ khách xác nhận báo giá, chưa chốt để chuyển kho.",
    nextActionSuggestion:
      "Gọi nhắc khách xác nhận báo giá, hạn giữ giá còn 2 ngày.",
    warning: "Báo giá đã gửi 3 ngày, khách chưa phản hồi.",
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoHoursAgo(30),
  },
  {
    orderCode: "VCL-20260825084733-181664",
    orderId: "ord-cnm-004",
    orderType: "CONSIGNMENT",
    customerId: "c0570001-0000-4000-8000-000000000001",
    customerName: "Nguyễn Thị Bích Hằng",
    currentStatus: "WAITING_DEPOSIT",
    paymentStatus: "PENDING",
    warehouseStatus: "",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Khách đã đồng ý báo giá 10.500.000 VND, đơn chuyển sang chờ đặt cọc 30% (3.150.000 VND). " +
      "Kho Quảng Châu giữ chỗ cho chuyến bay ngày 06/09, quá hạn cọc sẽ nhả chỗ.",
    nextActionSuggestion:
      "Nhắc khách chuyển cọc 3.150.000 VND để giữ chỗ chuyến bay 06/09.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoHoursAgo(20),
  },
  {
    orderCode: "VCL-20260823103041-204915",
    orderId: "ord-cnm-005",
    orderType: "CONSIGNMENT",
    customerId: "c0570003-0000-4000-8000-000000000003",
    customerName: "Lê Minh Khoa",
    currentStatus: "DEPOSIT_PAID",
    paymentStatus: "DEPOSIT_PAID",
    warehouseStatus: "",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Khách đã cọc 4.200.000 VND lúc 10:31 ngày 23/08, còn lại 9.800.000 VND thu khi giao. " +
      "Hàng đang trên đường từ xưởng Đông Quản về kho Quảng Châu, dự kiến nhập kho trong 2 ngày.",
    nextActionSuggestion:
      "Theo dõi mã vận đơn nội địa, nhắc kho nhận kiện đúng tên khách.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoHoursAgo(26),
  },
  {
    orderCode: "VCL-20260816104408-271455",
    orderId: "ord-cnm-006",
    orderType: "CONSIGNMENT",
    customerId: "c0570002-0000-4000-8000-000000000002",
    customerName: "Trần Quốc Duy",
    currentStatus: "Đã nhận kiện tại kho Trung Quốc (CHECKED_IN)",
    paymentStatus: "PAID",
    warehouseStatus: "CHECKED_IN",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Kho Quảng Châu đã nhận và cân lại 2 kiện, tổng 18,6 kg, quy đổi thể tích 21,4 kg. " +
      "Khách đã thanh toán đủ 8.940.000 VND. Đơn chưa được ghép vào lô vận chuyển quốc tế nào.",
    nextActionSuggestion:
      "Đề nghị vận hành ghép 2 kiện vào lô bay SHP kế tiếp đi Hà Nội.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [
      parcel({
        parcelId: "pcl-cnm-006-1",
        packageCode: "PCL-20260816111203-402118",
        status: "Đã nhập kho",
        weightKg: 10.2,
        binCode: "A03-02",
        checkedInDaysAgo: 5,
      }),
      parcel({
        parcelId: "pcl-cnm-006-2",
        packageCode: "PCL-20260816113517-402590",
        status: "Đã nhập kho",
        weightKg: 8.4,
        binCode: "A03-03",
        checkedInDaysAgo: 5,
      }),
    ],
    updatedAt: isoHoursAgo(36),
  },
  {
    orderCode: "VCL-20260815152139-284007",
    orderId: "ord-cnm-007",
    orderType: "CONSIGNMENT",
    customerId: "c0570003-0000-4000-8000-000000000003",
    customerName: "Lê Minh Khoa",
    currentStatus: "CHECKED_IN",
    paymentStatus: "PAID",
    warehouseStatus: "CHECKED_IN",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "3 kiện quần áo thu đông đã nhập kho Quảng Châu, tổng 34,8 kg, đã thanh toán 12.100.000 VND. " +
      "Kiện đầu tiên lưu kho 6 ngày, sang ngày thứ 8 bắt đầu tính phí lưu kho 15.000 VND/kiện/ngày.",
    nextActionSuggestion:
      "Ghép lô sớm để khách không phát sinh phí lưu kho.",
    warning:
      "Kiện PCL-20260815154402-390221 đã lưu kho 6 ngày, sắp phát sinh phí lưu kho.",
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [
      parcel({
        parcelId: "pcl-cnm-007-1",
        packageCode: "PCL-20260815154402-390221",
        status: "Đã nhập kho",
        weightKg: 14.6,
        binCode: "B02-01",
        checkedInDaysAgo: 6,
      }),
      parcel({
        parcelId: "pcl-cnm-007-2",
        packageCode: "PCL-20260815160930-390884",
        status: "Đã nhập kho",
        weightKg: 11.9,
        binCode: "B02-02",
        checkedInDaysAgo: 6,
      }),
      parcel({
        parcelId: "pcl-cnm-007-3",
        packageCode: "PCL-20260816090215-391402",
        status: "Chờ xếp kệ",
        weightKg: 8.3,
        binCode: "B02-03",
        checkedInDaysAgo: 5,
      }),
    ],
    updatedAt: isoHoursAgo(44),
  },
  {
    orderCode: "VCL-20260818094911-258873",
    orderId: "ord-cnm-008",
    orderType: "CONSIGNMENT",
    customerId: "c0570008-0000-4000-8000-000000000008",
    customerName: "Hoàng Thị Mỹ Duyên",
    currentStatus: "IN_TRANSIT",
    paymentStatus: "PAID",
    warehouseStatus: "RELEASED",
    shipmentStatus: "Đang vận chuyển quốc tế (IN_TRANSIT)",
    answer:
      "Đơn đã xuất kho Quảng Châu theo phiếu WRO-20260818103055-660214 và ghép vào lô " +
      "SHP-20260818120400-701338 (đường bay Quảng Châu - Hà Nội). Dự kiến hạ cánh sau 2 ngày, " +
      "sau đó chuyển kho Hà Nội để chia hàng.",
    nextActionSuggestion:
      "Thông báo mốc dự kiến về kho Hà Nội cho khách, kèm mã lô SHP-20260818120400-701338.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [
      parcel({
        parcelId: "pcl-cnm-008-1",
        packageCode: "PCL-20260818101144-518720",
        status: "Đang vận chuyển",
        weightKg: 12.7,
        binCode: "A05-01",
        checkedInDaysAgo: 9,
      }),
      parcel({
        parcelId: "pcl-cnm-008-2",
        packageCode: "PCL-20260818102830-519104",
        status: "Đang vận chuyển",
        weightKg: 9.4,
        binCode: "A05-02",
        checkedInDaysAgo: 9,
      }),
    ],
    updatedAt: isoHoursAgo(52),
  },
  {
    orderCode: "VCL-20260812142310-317744",
    orderId: "ord-cnm-009",
    orderType: "CONSIGNMENT",
    customerId: "c0570006-0000-4000-8000-000000000006",
    customerName: "Đặng Thị Kim Ngân",
    currentStatus: "RELEASE_PENDING",
    paymentStatus: "PAID",
    warehouseStatus: "RELEASE_PENDING",
    shipmentStatus: "",
    answer:
      "Hàng đã về kho Hà Nội, phiếu xuất kho WRO-20260901084512-773051 đang chờ kho xác nhận. " +
      "Khách đã thanh toán đủ 6.480.000 VND và hẹn nhận trong chiều nay.",
    nextActionSuggestion:
      "Nhắc kho Hà Nội xác nhận phiếu xuất WRO-20260901084512-773051 để giao đúng hẹn.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [
      parcel({
        parcelId: "pcl-cnm-009-1",
        packageCode: "PCL-20260812150140-601937",
        status: "Chờ xuất kho",
        warehouseName: "Kho Hà Nội (WH-VN-HN)",
        weightKg: 15.2,
        binCode: "H01-04",
        checkedInDaysAgo: 4,
      }),
    ],
    updatedAt: isoHoursAgo(6),
  },
  {
    orderCode: "VCL-20260810133422-338466",
    orderId: "ord-cnm-010",
    orderType: "CONSIGNMENT",
    customerId: "c0570008-0000-4000-8000-000000000008",
    customerName: "Hoàng Thị Mỹ Duyên",
    currentStatus: "Đã giao cho khách (COMPLETED)",
    paymentStatus: "PAID",
    warehouseStatus: "RELEASED",
    shipmentStatus: "Đã nhận tại kho Việt Nam (RECEIVED)",
    answer:
      "Đơn đã giao thành công tại 128 Nguyễn Trãi, Thanh Xuân, Hà Nội và thu đủ 9.760.000 VND. " +
      "Khách đã ký nhận, không có khiếu nại về tình trạng hàng.",
    nextActionSuggestion:
      "Gửi tin cảm ơn và mời khách đánh giá dịch vụ.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [
      parcel({
        parcelId: "pcl-cnm-010-1",
        packageCode: "PCL-20260810140255-582410",
        status: "Đã xuất kho",
        warehouseName: "Kho Hà Nội (WH-VN-HN)",
        weightKg: 13.8,
        binCode: "H02-01",
        checkedInDaysAgo: 12,
      }),
    ],
    updatedAt: isoHoursAgo(70),
  },
  {
    orderCode: "VCL-20260808091544-349920",
    orderId: "ord-cnm-011",
    orderType: "CONSIGNMENT",
    customerId: "c0570001-0000-4000-8000-000000000001",
    customerName: "Nguyễn Thị Bích Hằng",
    currentStatus: "COMPLETED",
    paymentStatus: "PAID",
    warehouseStatus: "RELEASED",
    shipmentStatus: "",
    answer:
      "Đơn đã hoàn tất, tổng thu 15.240.000 VND, đối soát công nợ ngày 08/09 không lệch. " +
      "Hồ sơ đã đóng, chỉ còn lưu trữ để tra cứu.",
    nextActionSuggestion:
      "Không còn việc cần xử lý, có thể dùng đơn này làm tham chiếu khi khách hỏi lại.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoDaysAgo(4),
  },
  {
    orderCode: "VCL-20260807154708-358173",
    orderId: "ord-cnm-012",
    orderType: "CONSIGNMENT",
    customerId: "c0570002-0000-4000-8000-000000000002",
    customerName: "Trần Quốc Duy",
    currentStatus: "REJECTED",
    paymentStatus: "CANCELED",
    warehouseStatus: "",
    shipmentStatus: "",
    answer:
      "Đơn bị từ chối vì có 4 cục pin rời thuộc danh mục hàng hạn chế vận chuyển hàng không. " +
      "Khoản cọc 1.200.000 VND đã hoàn cho khách ngày 08/09.",
    nextActionSuggestion:
      "Tư vấn khách tách pin rời sang tuyến đường biển hoặc bỏ dòng hàng này rồi tạo đơn mới.",
    warning: "Hàng nằm trong danh mục hạn chế: pin lithium rời.",
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoDaysAgo(5),
  },
  {
    orderCode: "VCL-20260806112239-366408",
    orderId: "ord-cnm-013",
    orderType: "CONSIGNMENT",
    customerId: "c0570003-0000-4000-8000-000000000003",
    customerName: "Lê Minh Khoa",
    currentStatus: "CANCELLED",
    paymentStatus: "CANCELLED",
    warehouseStatus: "",
    shipmentStatus: "",
    answer:
      "Khách tự huỷ đơn trước khi hàng về kho vì xưởng Trung Quốc giao chậm. " +
      "Không phát sinh cước, không có kiện nào nhập kho.",
    nextActionSuggestion:
      "Ghi nhận lý do huỷ vào lịch sử khách hàng để lần sau chốt hạn giao với xưởng.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [],
    updatedAt: isoDaysAgo(6),
  },
  {
    orderCode: "PUR-20260902081522-410233",
    orderId: "ord-pur-001",
    orderType: "PURCHASE",
    customerId: "c0570101-0000-4000-8000-000000000001",
    customerName: "Đỗ Thanh Huyền",
    currentStatus: "PENDING_REVIEW",
    paymentStatus: "PENDING",
    warehouseStatus: "",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Yêu cầu mua hộ 6 sản phẩm trên 1688, tiền hàng tạm tính 12.640.000 VND (tỷ giá 3.560 VND/CNY). " +
      "Đang chờ Sales rà giá và duyệt trước khi báo khách đặt cọc.",
    nextActionSuggestion:
      "Rà lại giá 2 dòng hàng biến động rồi gửi báo giá mua hộ cho khách.",
    warning: null,
    dataSources: DATA_SOURCES_PURCHASE,
    relatedParcels: [],
    updatedAt: isoHoursAgo(5),
  },
  {
    orderCode: "PUR-20260828101244-471530",
    orderId: "ord-pur-002",
    orderType: "PURCHASE",
    customerId: "c0570102-0000-4000-8000-000000000002",
    customerName: "Nguyễn Bá Long",
    currentStatus: "Đã phê duyệt (APPROVED)",
    paymentStatus: "PAID",
    warehouseStatus: "CHECKED_IN",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "Đơn mua hộ đã được duyệt, khách thanh toán đủ 18.320.000 VND. " +
      "Xưởng đã giao 2 kiện về kho Quảng Châu, đang chờ ghép lô vận chuyển quốc tế.",
    nextActionSuggestion:
      "Đề nghị vận hành ghép lô để hàng kịp chuyến biển cuối tuần.",
    warning: null,
    dataSources: DATA_SOURCES_PURCHASE,
    relatedParcels: [
      parcel({
        parcelId: "pcl-pur-002-1",
        packageCode: "PCL-20260830092211-455170",
        status: "Đã nhập kho",
        weightKg: 16.5,
        binCode: "C01-02",
        checkedInDaysAgo: 4,
      }),
      parcel({
        parcelId: "pcl-pur-002-2",
        packageCode: "PCL-20260830094508-455612",
        status: "Đã nhập kho",
        weightKg: 12.1,
        binCode: "C01-03",
        checkedInDaysAgo: 4,
      }),
    ],
    updatedAt: isoHoursAgo(28),
  },
  {
    orderCode: "PUR-20260824131044-511982",
    orderId: "ord-pur-003",
    orderType: "PURCHASE",
    customerId: "c0570106-0000-4000-8000-000000000006",
    customerName: "Hồ Gia Bảo",
    currentStatus: "IN_TRANSIT",
    paymentStatus: "PAID",
    warehouseStatus: "RELEASED",
    shipmentStatus: "IN_TRANSIT",
    answer:
      "Đơn mua hộ 22.150.000 VND đã xuất kho theo phiếu WRO-20260828142011-748330, " +
      "ghép lô SHP-20260828153300-762904 đi đường biển về cảng Hải Phòng, dự kiến 9 ngày.",
    nextActionSuggestion:
      "Cập nhật mốc cảng Hải Phòng cho khách, nhắc chuẩn bị nhận hàng tuần sau.",
    warning: null,
    dataSources: DATA_SOURCES_PURCHASE,
    relatedParcels: [
      parcel({
        parcelId: "pcl-pur-003-1",
        packageCode: "PCL-20260826104733-521840",
        status: "Đang vận chuyển",
        weightKg: 28.4,
        binCode: "C02-01",
        checkedInDaysAgo: 8,
      }),
    ],
    updatedAt: isoDaysAgo(3),
  },
  {
    orderCode: "VCL-20260819111027-246650",
    orderId: "ord-cnm-014",
    orderType: "CONSIGNMENT",
    customerId: "c0570007-0000-4000-8000-000000000007",
    customerName: "Bùi Anh Tuấn",
    currentStatus: "CHECKED_IN",
    paymentStatus: "PAID",
    warehouseStatus: "CHECKED_IN",
    shipmentStatus: "NOT_ASSIGNED",
    answer:
      "2 kiện đã nhập kho Quảng Châu (21,1 kg thực tế), khách thanh toán đủ 7.450.000 VND. " +
      "Tuyến đã chọn là hàng không nhanh về Hà Nội nhưng chưa có lô nào nhận 2 kiện này.",
    nextActionSuggestion:
      "Ghép 2 kiện vào lô bay gần nhất để giữ cam kết 3 ngày với khách.",
    warning: null,
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [
      parcel({
        parcelId: "pcl-cnm-014-1",
        packageCode: "PCL-20260819113047-295805",
        status: "Đã nhập kho",
        weightKg: 12.4,
        binCode: "A01-03",
        checkedInDaysAgo: 4,
      }),
      parcel({
        parcelId: "pcl-cnm-014-2",
        packageCode: "PCL-20260819114215-471902",
        status: "Đã nhập kho",
        weightKg: 8.7,
        binCode: "A01-04",
        checkedInDaysAgo: 4,
      }),
    ],
    updatedAt: isoHoursAgo(18),
  },
  {
    orderCode: "PUR-20260814092044-590135",
    orderId: "ord-pur-004",
    orderType: "PURCHASE",
    customerId: "c0570101-0000-4000-8000-000000000001",
    customerName: "Đỗ Thanh Huyền",
    currentStatus: "COMPLETED",
    paymentStatus: "PAID",
    warehouseStatus: "RELEASED",
    shipmentStatus: "Đã nhận tại kho Việt Nam (RECEIVED)",
    answer:
      "Đơn mua hộ đồ gốm đã giao xong và tất toán: tiền hàng cùng cước tổng 11.980.000 VND, " +
      "kiện 21,9 kg xuất kho theo phiếu WRO-20260820091500-330842 và khách đã ký nhận. " +
      "Phần thu vượt 320.000 VND đã hoàn lại vào ví của khách.",
    nextActionSuggestion:
      "Không còn việc cần xử lý; gửi tin cảm ơn và mời khách đánh giá dịch vụ mua hộ.",
    warning: null,
    dataSources: DATA_SOURCES_PURCHASE,
    relatedParcels: [
      parcel({
        parcelId: "pcl-pur-004-1",
        packageCode: "PCL-20260816114850-330117",
        status: "Đã xuất kho",
        warehouseName: "Kho Hồ Chí Minh (WH-VN-HCM)",
        weightKg: 21.9,
        binCode: "S01-02",
        checkedInDaysAgo: 12,
      }),
    ],
    updatedAt: isoHoursAgo(22),
  },
  {
    orderCode: "VCL-20260817132650-263092",
    orderId: "ord-cnm-015",
    orderType: "CONSIGNMENT",
    customerId: "c0570001-0000-4000-8000-000000000001",
    customerName: "Nguyễn Thị Bích Hằng",
    currentStatus: "IN_TRANSIT",
    paymentStatus: "PAID",
    warehouseStatus: "RELEASED",
    shipmentStatus: "IN_TRANSIT",
    answer:
      "Kiện 26,3 kg đi theo lô ghép container SHP-20260822081200-118655 và đã cập cảng Cát Lái, " +
      "hiện đang làm thủ tục thông quan nhập khẩu. Khách đã thanh toán 5.860.000 VND, " +
      "dự kiến về kho Hồ Chí Minh sau 2 ngày kể từ khi thông quan xong.",
    nextActionSuggestion:
      "Theo dõi tờ khai hải quan, báo khách mốc thông quan và lịch chia hàng tại kho Hồ Chí Minh.",
    warning: "Đơn đang chờ thông quan tại cảng Cát Lái, mốc về kho có thể trượt nếu hải quan yêu cầu bổ sung chứng từ.",
    dataSources: DATA_SOURCES_CONSIGNMENT,
    relatedParcels: [
      parcel({
        parcelId: "pcl-cnm-015-1",
        packageCode: "PCL-20260819082044-662038",
        status: "Đang vận chuyển",
        weightKg: 26.3,
        binCode: "B01-02",
        checkedInDaysAgo: 7,
      }),
    ],
    updatedAt: isoDaysAgo(2),
  },
];

/* =========================================================
   TRA CỨU HỒ SƠ
========================================================= */

const compareKey = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Tìm hồ sơ theo đúng thứ tự ưu tiên backend vẫn dùng: mã đơn trước, rồi id đơn
 * hoặc mã kiện đính theo hội thoại, cuối cùng mới tới khách hàng.
 *
 * Panel Sales có lúc chỉ có customerId (mở từ hội thoại chưa gắn đơn), nên nhánh
 * cuối là bắt buộc — thiếu nó panel sẽ luôn rơi vào "không tìm thấy đơn".
 */
const findDossier = ({ orderCode, relatedId, customerId }) => {
  const code = compareKey(orderCode);
  if (code) {
    const byCode = AI_DOSSIERS.find(
      (item) =>
        compareKey(item.orderCode) === code ||
        compareKey(item.orderId) === code
    );
    if (byCode) return byCode;
  }

  const id = compareKey(relatedId);
  if (id) {
    const byId = AI_DOSSIERS.find(
      (item) =>
        compareKey(item.orderId) === id ||
        compareKey(item.orderCode) === id ||
        item.relatedParcels.some(
          (row) =>
            compareKey(row.parcelId) === id ||
            compareKey(row.packageCode) === id
        )
    );
    if (byId) return byId;
  }

  const customer = compareKey(customerId);
  if (customer) {
    const byCustomer = AI_DOSSIERS.find(
      (item) => compareKey(item.customerId) === customer
    );
    if (byCustomer) return byCustomer;
  }

  return null;
};

/**
 * Rút hồ sơ thành phần tử relatedOrders đúng những khoá panel đọc qua toOrderOption:
 * orderCode, orderId, orderType, customerName, status.
 *
 * status để dạng nhãn tiếng Việt vì panel in thẳng selectedOrder.status lên thẻ
 * "Trạng thái đơn" khi chưa có kết quả AI — in mã trần ra đó thì khó đọc.
 */
const toRelatedOrder = (item) => ({
  orderCode: item.orderCode,
  orderId: item.orderId,
  orderType: item.orderType,
  customerId: item.customerId,
  customerName: item.customerName,
  status: mapStatusLabel(item.currentStatus),
  statusCode: item.currentStatus,
  updatedAt: item.updatedAt,
});

/** Đơn cùng khách được xếp sau đơn đang tra, để Select "Đơn liên quan" có nhiều lựa chọn. */
const buildRelatedOrders = (dossier) => {
  const siblings = AI_DOSSIERS.filter(
    (item) =>
      item.orderCode !== dossier.orderCode &&
      compareKey(item.customerId) === compareKey(dossier.customerId)
  );

  return [dossier, ...siblings].slice(0, 5).map(toRelatedOrder);
};

/* Panel gửi bốn câu hỏi mẫu khác nhau; nhận diện ý định để câu trả lời không
   giống nhau y đúc giữa các nút, người xem demo mới thấy AI "phản ứng". */
const detectIntent = (message) => {
  const text = normalizeText(message);

  if (/soan|tra loi|phan hoi|reply/.test(text)) return "reply";
  if (/van de|can xu ly|issue|vuong/.test(text)) return "issues";
  if (/tom tat|nam nhanh|summary/.test(text)) return "summary";

  return "status";
};

const INTENT_LEADS = {
  status: "Trạng thái tra cứu theo dữ liệu nội bộ:",
  reply: "Dữ liệu để soạn phản hồi cho khách (Sales rà lại trước khi gửi):",
  issues: "Những điểm cần Sales xử lý trước khi cập nhật cho khách:",
  summary: "Tóm tắt nhanh cho Sales:",
};

/** Dựng đúng phần "data" mà backend AI trả về, chưa qua chuẩn hoá. */
const buildDossierData = (dossier, intent) => ({
  answer: `${INTENT_LEADS[intent] || INTENT_LEADS.status}\n${dossier.answer}`,
  relatedOrders: buildRelatedOrders(dossier),
  relatedParcels: deepClone(dossier.relatedParcels),
  currentStatus: dossier.currentStatus,
  paymentStatus: dossier.paymentStatus,
  warehouseStatus: dossier.warehouseStatus,
  shipmentStatus: dossier.shipmentStatus,
  nextActionSuggestion: dossier.nextActionSuggestion,
  dataSources: [...dossier.dataSources],
  warning: dossier.warning,
});

/**
 * Không tra ra đơn nào thì vẫn phải trả object đủ khoá.
 *
 * relatedParcels được panel gọi .map() KHÔNG có optional chaining, nên trả mảng rỗng
 * chứ tuyệt đối không undefined — thiếu chỗ này là màn hình trắng chứ không phải lỗi nhẹ.
 */
const buildNotFoundData = (payload) => {
  const hint =
    payload.orderCode ||
    payload.relatedId ||
    payload.customerId ||
    "thông tin trong hội thoại";

  return {
    answer:
      `Em chưa tra được đơn nào khớp với ${hint}. ` +
      "Có thể mã đơn thuộc khách khác hoặc đơn đã được lưu trữ. " +
      "Sales kiểm tra lại mã đơn hoặc chọn đơn trong danh sách gợi ý bên dưới.",
    relatedOrders: AI_DOSSIERS.slice(0, 5).map(toRelatedOrder),
    relatedParcels: [],
    currentStatus: "",
    paymentStatus: "",
    warehouseStatus: "",
    shipmentStatus: "",
    nextActionSuggestion:
      "Xác nhận lại mã đơn với khách rồi tra cứu lại.",
    dataSources: ["consignment_orders", "purchase_requests"],
    warning: `Không tìm thấy đơn khớp với ${hint}.`,
  };
};

export const normalizeSalesOrderStatusResponse = (response) => {
  const data = response?.data?.data ?? response?.data ?? {};
  const relatedOrders = toArray(data?.relatedOrders);
  const relatedParcels = toArray(data?.relatedParcels);
  const currentStatus = data?.currentStatus || "";
  const paymentStatus = data?.paymentStatus || "";
  const warehouseStatus = data?.warehouseStatus || "";
  const shipmentStatus = data?.shipmentStatus || "";

  return {
    answer: data?.answer || "",
    relatedOrders,
    relatedParcels,
    currentStatus,
    paymentStatus,
    warehouseStatus,
    shipmentStatus,
    nextActionSuggestion: data?.nextActionSuggestion || "",
    dataSources: toArray(data?.dataSources),
    warning: data?.warning || null,
    labels: {
      currentStatus: mapStatusLabel(currentStatus, "order"),
      paymentStatus: mapStatusLabel(paymentStatus, "payment"),
      warehouseStatus: mapStatusLabel(warehouseStatus, "order"),
      shipmentStatus: mapStatusLabel(shipmentStatus, "order"),
    },
  };
};

export const buildCustomerReply = ({
  orderCode,
  result,
  tone = "default",
} = {}) => {
  if (!result) return "";

  const code = trimOrNull(orderCode) || result.relatedOrders?.[0]?.orderCode || "của anh/chị";
  const status = result.labels?.currentStatus || mapStatusLabel(result.currentStatus);
  const payment = result.labels?.paymentStatus || mapStatusLabel(result.paymentStatus, "payment");
  const shipment = result.labels?.shipmentStatus || mapStatusLabel(result.shipmentStatus);
  const warehouse = result.labels?.warehouseStatus || mapStatusLabel(result.warehouseStatus);

  const parts = [];
  if (status) {
    parts.push(`đơn hàng ${code} hiện ${status.toLowerCase()}`);
  } else {
    parts.push(`đơn hàng ${code}`);
  }

  const issues = [];
  if (payment && /chưa|pending|unpaid/i.test(`${payment} ${result.paymentStatus}`)) {
    issues.push("đơn vẫn đang chờ xác nhận thanh toán");
  }
  if (shipment && /chưa ghép|not_assigned|chưa được ghép/i.test(`${shipment} ${result.shipmentStatus}`)) {
    issues.push("chưa được ghép vào chuyến vận chuyển quốc tế");
  }
  if (warehouse && /chờ xuất|release_pending/i.test(`${warehouse} ${result.warehouseStatus}`)) {
    issues.push("yêu cầu xuất kho đang chờ xử lý");
  }

  let reply = `Dạ em kiểm tra thấy ${parts.join(", ")}.`;
  if (issues.length) {
    reply += ` Tuy nhiên ${issues.join(" và ")}.`;
  } else if (warehouse) {
    reply += ` Phía kho: ${warehouse.toLowerCase()}.`;
  }

  if (issues.some((item) => /thanh toán/i.test(item))) {
    reply +=
      " Sau khi thanh toán được xác nhận, bên em sẽ tiếp tục xử lý và cập nhật trạng thái vận chuyển cho anh/chị ạ.";
  } else {
    reply += " Bên em sẽ tiếp tục theo dõi và cập nhật sớm nhất cho anh/chị ạ.";
  }

  if (tone === "short") {
    reply = `Dạ đơn ${code} hiện ${status ? status.toLowerCase() : "đang được xử lý"}.`;
    if (issues.length) {
      reply += ` Hiện còn ${issues[0]}.`;
    }
    reply += " Em sẽ cập nhật tiếp cho anh/chị ạ.";
  }

  if (tone === "friendly") {
    reply = reply
      .replaceAll("anh/chị", "anh/chị")
      .replace(
        "Bên em sẽ tiếp tục theo dõi và cập nhật sớm nhất cho anh/chị ạ.",
        "Anh/chị yên tâm, bên em theo dõi sát và sẽ báo lại ngay khi có cập nhật mới ạ."
      );
  }

  return reply;
};

export const buildWarnings = (result) => {
  if (!result) return [];
  const warnings = [];

  if (result.warning) warnings.push(String(result.warning));

  const payment = `${result.paymentStatus || ""} ${result.labels?.paymentStatus || ""}`;
  const shipment = `${result.shipmentStatus || ""} ${result.labels?.shipmentStatus || ""}`;

  if (/chưa thanh toán|pending|unpaid/i.test(payment)) {
    warnings.push("Đơn đang chờ thanh toán trước khi ghép lô vận chuyển quốc tế.");
  } else if (/chưa ghép|not_assigned/i.test(shipment)) {
    warnings.push("Đơn chưa được ghép vào chuyến vận chuyển quốc tế.");
  }

  if (result.nextActionSuggestion) {
    const suggestion = String(result.nextActionSuggestion).trim();
    if (
      suggestion &&
      !/kiểm tra chi tiết|lịch sử xử lý/i.test(suggestion) &&
      !warnings.includes(suggestion)
    ) {
      warnings.push(suggestion);
    }
  }

  return [...new Set(warnings)];
};

export const getSalesAiError = (error) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.title === "string" && data.title.trim()) return data.title;

  const validationMessages = data?.errors
    ? Object.values(data.errors).flat().filter(Boolean)
    : [];
  return validationMessages.join(" ") || error?.message || "Không thể hỏi AI.";
};

/**
 * Hỏi AI về trạng thái đơn — bản mock.
 *
 * Giữ đúng chữ ký cũ (payload, options) và vẫn trả kết quả ĐÃ chuẩn hoá, vì panel
 * đọc thẳng data.labels.* chứ không tự chuẩn hoá lại. Trễ 520ms để nút "Hỏi AI"
 * kịp hiện spinner như khi gọi model thật, và delay nhận options.signal nên đổi đơn
 * liên tục sẽ ném CanceledError đúng kiểu axios thay vì bắn toast đỏ.
 */
export const querySalesOrderStatus = async (payload, options = {}) => {
  const body = buildPayload(payload);

  /* Backend validate message rỗng bằng 400; giữ nguyên để nhánh catch của panel
     có thứ hiển thị qua getSalesAiError. */
  if (!body.message) {
    throw createApiError(400, "Nội dung câu hỏi không được để trống.");
  }

  await delay(520, options?.signal);

  const dossier = findDossier(body);
  const data = dossier
    ? buildDossierData(dossier, detectIntent(body.message))
    : buildNotFoundData(body);

  /* Bọc lại thành { data: { data } } rồi đi qua đúng normalize của bản thật —
     mock không được tự dựng object kết quả, tránh lệch khoá với component. */
  return normalizeSalesOrderStatusResponse({ data: { data } });
};

const saleAiService = {
  querySalesOrderStatus,
  mapStatusLabel,
  buildCustomerReply,
  buildWarnings,
};

export default saleAiService;
