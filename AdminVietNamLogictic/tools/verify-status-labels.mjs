/**
 * Soát nhãn tiếng Việt cho MỌI mã trạng thái / loại / vai trò backend có thể trả.
 *
 *   node tools/verify-status-labels.mjs
 *
 * Danh sách mã chuẩn: tools/status-codes.json — gom từ hằng số VCL_BLL / VCL_DLL (ShipmentMilestones,
 * ExportFlowStatuses, VnArrivalStatuses, PurchaseFlow, PurchaseRequestService, OrderService.*,
 * WarehouseReceivingNoteService, DeliveryRequestService, ParcelReturnService, GoshipService,
 * StaffRoleHelper…). Backend thêm mã mới thì thêm vào file đó trước.
 *
 * Ba lớp kiểm:
 *   1. Lưới an toàn: mọi mã (kể cả mã cũ) qua `labelOf(null, mã)` ra chữ tiếng Việt thật — không
 *      rơi xuống nhãn chung "Trạng thái khác", không còn dạng MÃ_MÁY.
 *   2. Bảng của từng họ: mọi mã HIỆN HÀNH của họ phải có mặt trong đúng bảng nhãn của họ đó (không
 *      chỉ nhờ bảng chung), và hàm hiển thị thật của màn hình trả chữ tiếng Việt.
 *   3. Vài kịch bản: mốc lô RECEIVED_AT_DESTINATION, chữ server là mã thô, mã lạ.
 *
 * Thoát mã 1 nếu có lỗi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CODES = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "status-codes.json"), "utf8"));
const FAMILIES = CODES.families;

const server = await createServer({
  configFile: path.join(ROOT, "vite.config.js"),
  root: ROOT,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

const load = (rel) => server.ssrLoadModule("/" + rel);
const problems = [];
const warnings = [];
let checked = 0;

try {
  const S = await load("src/shared/utils/statusLabel.js");
  const GENERIC = new Set([
    S.GENERIC_STATUS_LABEL,
    S.EMPTY_LABEL,
    "Loại khác",
    "Vai trò khác",
    "Phương thức khác",
    "Khoản thu khác",
    "Loại kho khác",
    "Loại giấy tờ khác",
    "Sự cố khác",
    "Cách xử lý khác",
    "Trạng thái báo giá khác",
    "Tình trạng khác",
  ]);
  const bad = (label) => !label || GENERIC.has(label) || S.isCodeLike(label);

  /* ---- 1. Lưới an toàn: mọi mã backend ---- */
  for (const [family, { codes = [], legacy = [] }] of Object.entries(FAMILIES)) {
    for (const code of [...codes, ...legacy]) {
      checked += 1;
      const label = S.labelOf(null, code);
      if (bad(label)) problems.push(`BẢNG CHUNG  ${family}.${code} → "${label}"`);
    }
  }
  const leaked = S.getUnlabelledCodes();
  if (leaked.length) problems.push(`MÃ RƠI XUỐNG NHÃN CHUNG: ${leaked.join(", ")}`);

  /* ---- 2. Bảng riêng của từng họ + hàm hiển thị thật ---- */
  const shipment = await load("src/features/shipment/api/internationalShipmentService.js");
  const wro = await load("src/features/operations/api/warehouseReleaseService.js");
  const approval = await load("src/features/operations/api/destinationApprovalService.js");
  const inspection = await load("src/features/operations/api/parcelInspectionService.js");
  const receiving = await load("src/features/receiving/api/receivingNoteService.js");
  const tracking = await load("src/features/tracking/api/orderTrackingService.js");
  const incident = await load("src/features/incident/api/parcelIncidentService.js");
  const attachments = await load("src/features/attachments/api/attachmentService.js");
  const purchaseOrder = await load("src/features/purchase/api/purchaseOrderService.js");
  const quotation = await load("src/features/consignment/api/quotationService.js");
  const orderStatus = await load("src/features/consignment/constants/orderStatus.js");
  const payment = await load("src/shared/utils/paymentStatus.js");
  const inventory = await load("src/features/operations/api/inventoryService.js");

  const keysOf = (map) =>
    new Set(Array.isArray(map) ? map.map((item) => S.normalizeCode(item.value)) : Object.keys(map));

  /* [họ, bảng, hàm hiển thị, (tuỳ chọn) chuẩn hoá mã trước khi tra bảng] */
  const SPECS = [
    ["shipmentStatus", shipment.SHIPMENT_STATUS_META, (c) => shipment.getShipmentStatusMeta(c).label],
    ["shipmentEvent", shipment.SHIPMENT_STATUS_META, (c) => shipment.getShipmentStatusMeta(c).label],
    ["trackingStage", tracking.TRACKING_STAGES, (c) => tracking.getStageMeta(c).label],
    ["wroStatus", wro.WRO_STATUS_META, (c) => wro.getWroStatusMeta(c).label],
    ["wroParcelStatus", wro.WRO_PARCEL_STATUS_META, (c) => wro.getWroParcelStatusMeta(c).label],
    ["inboundStatus", approval.INBOUND_STATUS_META, (c) => approval.getInboundStatusMeta(c).label],
    ["deliveryStatus", approval.DELIVERY_STATUS_META, (c) => approval.getDeliveryStatusMeta(c).label],
    ["receivingCondition", inspection.CONDITION_META, (c) => inspection.getConditionMeta(c).label],
    ["wrnStatus", receiving.RECEIVING_STATUS_META, (c) => receiving.getReceivingStatusMeta(c).label],
    ["wrnApprovalStage", receiving.RECEIVING_APPROVAL_STAGE_META, (c) => receiving.getApprovalStageMeta(c)?.label],
    ["incidentType", incident.INCIDENT_TYPE_LABELS, (c) => incident.getIncidentTypeLabel(c)],
    ["incidentStatus", incident.INCIDENT_STATUS_META, (c) => incident.getIncidentStatusMeta(c).label],
    ["incidentResolution", incident.RESOLUTION_LABELS, (c) => incident.getResolutionLabel(c)],
    ["documentType", attachments.DOCUMENT_TYPE_LABELS, (c) => attachments.getDocumentTypeLabel(c)],
    ["purchaseOrderStatus", purchaseOrder.PURCHASE_ORDER_STATUS_META, (c) => purchaseOrder.getPurchaseOrderStatusMeta(c).label],
    ["quotationStatus", quotation.QUOTATION_STATUS_LABELS, (c) => quotation.getQuotationStatusLabel(c)],
    ["paymentStatus", payment.PAYMENT_STATUS_META, (c) => payment.getPaymentStatusMeta(c).label],
    ["aggregatePaymentStatus", payment.PAYMENT_STATUS_META, (c) => payment.getPaymentStatusMeta(c).label],
    ["parcelStatus", S.PARCEL_STATUS_LABELS, (c) => S.getParcelStatusLabel(c)],
    ["paymentMethod", S.PAYMENT_METHOD_LABELS, (c) => S.getPaymentMethodLabel(c)],
    ["installmentType", S.INSTALLMENT_TYPE_LABELS, (c) => S.getInstallmentTypeLabel(c)],
    ["purchasePaymentType", S.INSTALLMENT_TYPE_LABELS, (c) => S.getInstallmentTypeLabel(c)],
    ["role", S.ROLE_LABELS, (c) => S.getRoleLabel(c), (c) => c.replace(/[\s_-]+/g, "")],
    ["userStatus", S.USER_STATUS_LABELS, (c) => S.getUserStatusLabel(c), (c) => c.replace(/[\s_-]+/g, "")],
    ["warehouseType", S.WAREHOUSE_TYPE_LABELS, (c) => S.getWarehouseTypeLabel(c)],
    ["calculationType", S.CALCULATION_TYPE_LABELS, (c) => S.labelOf(S.CALCULATION_TYPE_LABELS, c)],
    ["conditionType", S.CONDITION_TYPE_LABELS, (c) => S.labelOf(S.CONDITION_TYPE_LABELS, c)],
    ["ruleType", S.RULE_TYPE_LABELS, (c) => S.labelOf(S.RULE_TYPE_LABELS, c)],
    ["transportMode", S.TRANSPORT_MODE_LABELS, (c) => S.labelOf(S.TRANSPORT_MODE_LABELS, c)],
    ["supplierType", S.SUPPLIER_TYPE_LABELS, (c) => S.labelOf(S.SUPPLIER_TYPE_LABELS, c)],
    ["restrictionType", S.RESTRICTION_TYPE_LABELS, (c) => S.labelOf(S.RESTRICTION_TYPE_LABELS, c)],
    ["orderHistoryEvent", S.ORDER_HISTORY_EVENT_LABELS, (c) => S.getOrderHistoryEventLabel(c)],
    ["inventoryStatus", inventory.INVENTORY_STATUS_META, (c) => inventory.getInventoryStatusMeta(c).label],
  ];

  /*
   * Chỗ còn thiếu nằm trong file đang do agent khác giữ (không được sửa lúc này). Vẫn in ra để
   * không bị quên, nhưng không làm đỏ script. Sửa xong file đó thì xoá dòng tương ứng ở đây.
   */
  const KNOWN_GAPS = new Set([]);

  for (const [family, map, render, keyOf = (c) => c] of SPECS) {
    const spec = FAMILIES[family];
    if (!spec) {
      problems.push(`HỌ MÃ ${family} không có trong tools/status-codes.json`);
      continue;
    }
    const keys = keysOf(map || {});
    for (const code of spec.codes) {
      checked += 1;
      const where = `${family}.${code}`;
      if (!keys.has(keyOf(code))) {
        (KNOWN_GAPS.has(where) ? warnings : problems).push(`THIẾU TRONG BẢNG HỌ  ${where}`);
      }
      const label = render(code);
      if (bad(label)) {
        (KNOWN_GAPS.has(where) ? warnings : problems).push(`HIỂN THỊ  ${where} → "${label}"`);
      }
    }
  }

  /* Trạng thái đơn ký gửi: 19 mã đích + mã cũ chuẩn hoá được + mã backend ngoài 19 mã. */
  for (const code of [...FAMILIES.orderStatus.codes, ...(FAMILIES.orderStatus.legacy || [])]) {
    checked += 1;
    const label = orderStatus.getOrderStatusLabel(code);
    if (bad(label)) problems.push(`HIỂN THỊ  orderStatus.${code} → "${label}"`);
  }

  /* ---- 3. Kịch bản ---- */
  const expect = (name, actual, wanted) => {
    checked += 1;
    if (actual !== wanted) problems.push(`KỊCH BẢN  ${name}: được "${actual}", cần "${wanted}"`);
  };
  expect(
    "mốc lô RECEIVED_AT_DESTINATION (server trả statusText là mã thô)",
    S.textOr("RECEIVED_AT_DESTINATION", shipment.getShipmentStatusMeta("RECEIVED_AT_DESTINATION").label),
    "Kho đích đã nhận lô",
  );
  expect("mốc lô ARRIVED_DESTINATION", shipment.getShipmentStatusMeta("ARRIVED_DESTINATION").label, "Đã về kho đích");
  expect("chữ server tiếng Việt được giữ", S.textOr("Đã về Việt Nam", "x"), "Đã về Việt Nam");
  expect("mã lạ không in mã", S.labelOf(null, "SOMETHING_NEW_FROM_BACKEND"), S.GENERIC_STATUS_LABEL);
  expect("mã lạ đoán theo hậu tố", S.labelOf(null, "BATCH_CANCELLED"), "Đã huỷ");
  expect("chữ tiếng Anh 'Pending' được dịch", S.labelOf(null, "Pending"), S.COMMON_CODE_LABELS.PENDING);
  expect("vai trò viết khác chuẩn", S.getRoleLabel("Warehouse Staff VN"), "Nhân viên kho Việt Nam");
  expect("mã đơn lạ", orderStatus.getOrderStatusLabel("FOO"), "Trạng thái khác");
  expect("mã tiền tệ không bị dịch", S.displayCode("VCL-2026-0001"), "VCL-2026-0001");
  expect("phương thức MANUAL", S.getPaymentMethodLabel("MANUAL"), "Thủ công (kế toán ghi nhận)");
  expect("phương thức PREPAID", S.getPaymentMethodLabel("PREPAID"), "Trừ vào khoản trả trước");
  /* Lựa chọn "Thanh toán tiền mặt" ở web khách gửi mã OFFLINE — khoản thu mang đúng mã này. */
  expect("phương thức OFFLINE (thanh toán tiền mặt)", S.getPaymentMethodLabel("OFFLINE"), "Tiền mặt");
  expect(
    "mã chèn trong câu server được dịch",
    S.translateCodesInText("Chỉ nhận đơn ở trạng thái SUPPLIER_CONFIRMED"),
    `Chỉ nhận đơn ở trạng thái “${S.COMMON_CODE_LABELS.SUPPLIER_CONFIRMED}”`,
  );
  expect("cụm tiếng Anh 'Waiting for payment' được dịch", S.isCodeLike("Waiting for payment"), true);
  expect("tồn kho IN_STOCK", inventory.getInventoryStatusMeta("IN_STOCK").label, "Đang lưu kho");
  expect("tồn kho mã lạ không in mã", inventory.getInventoryStatusMeta("SOME_NEW_STOCK_STATE").label, S.GENERIC_STATUS_LABEL);
} finally {
  await server.close();
}

for (const line of warnings) console.warn("CẢNH BÁO (file do agent khác giữ)  " + line);
if (problems.length) {
  console.error(`\n${problems.length} lỗi nhãn trạng thái:\n` + problems.map((p) => "  - " + p).join("\n"));
  process.exit(1);
}
console.log(`Nhãn trạng thái: ${checked} phép kiểm đạt · ${Object.keys(FAMILIES).length} họ mã · ${warnings.length} cảnh báo.`);
