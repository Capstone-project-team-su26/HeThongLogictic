/**
 * Kiểm tra tầng mock có giữ đúng hợp đồng của tầng API thật hay không.
 *
 * Bản UI-only thay toàn bộ module api/ bằng mock, nhưng KHÔNG sửa một dòng nào
 * trong component. Điều đó chỉ đúng nếu mỗi mock giữ nguyên: tên export, có/không
 * export default, và không còn gọi mạng. Script này kiểm ba điều đó một cách máy móc,
 * cộng thêm: mọi trạng thái cấp đơn ký gửi trong mock thuộc 19 mã đích, và từng dòng
 * I/O matrix của story 1 (nhãn/chuẩn hoá mã đơn, tiền cọc, đổi DEPOSIT_RATE) chạy thật.
 *
 *   node tools/verify-mocks.mjs
 *
 * Thoát mã 1 nếu có sai lệch, để cắm được vào CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTRACT =
  process.argv[2] || path.join(ROOT, "tools", "api-contract.json");

if (!CONTRACT || !fs.existsSync(CONTRACT)) {
  console.error("Không tìm thấy hợp đồng API: " + CONTRACT);
  process.exit(2);
}

const contract = JSON.parse(fs.readFileSync(CONTRACT, "utf8"));
const problems = [];

/* ---- 1. Không còn dấu vết HTTP trong bất kỳ module api/ nào ---- */

/* Chỉ soi code thật: bỏ comment khối, comment dòng và nội dung chuỗi,
   nếu không thì chính phần "cắm API thật trở lại" trong comment sẽ bị báo nhầm. */
const stripNonCode = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');

const BANNED = [
  [/\bfrom\s*"axios"/, "import axios"],
  [/\brequire\(\s*""\s*\)/, "require() động"],
  [/\bhttpClient\b/, "dùng httpClient"],
  [/\baxiosInstance\b/, "dùng axiosInstance"],
  [/\bfetch\s*\(/, "gọi fetch()"],
  [/\bXMLHttpRequest\b/, "dùng XMLHttpRequest"],
  [/\bnavigator\.sendBeacon\b/, "dùng sendBeacon"],
  [/\bnew\s+WebSocket\b/, "mở WebSocket"],
  [/\bnew\s+EventSource\b/, "mở EventSource"],
];

/* Giữ lại làm tài liệu để cắm API thật; không phải mock nên miễn soát. */
const EXEMPT = new Set(["src/shared/api/apiEndpoints.js"]);

/*
 * Module ĐÃ NỐI BACKEND THẬT (cờ `realApi` trong hợp đồng) đương nhiên có axios /
 * httpClient trong code — bỏ riêng bước soát dấu vết mạng cho chúng. MỌI phép
 * kiểm còn lại vẫn áp dụng: đủ tên export, còn default, export không undefined,
 * bảng trạng thái đơn và I/O matrix.
 *
 * Bản sao `*.mock.js` của chúng thì KHÔNG được miễn: cả lý do tồn tại của những
 * file đó là giữ các màn ngoài đợt chạy bằng dữ liệu mẫu, nên một lời gọi mạng
 * lọt vào đấy phải làm script đỏ.
 */
const isRealApiModule = (rel) => contract[rel]?.realApi === true;

let realApiModules = 0;

for (const rel of Object.keys(contract)) {
  if (EXEMPT.has(rel)) continue;
  if (isRealApiModule(rel)) {
    realApiModules += 1;
    if (!fs.existsSync(path.join(ROOT, rel))) problems.push(`THIẾU FILE   ${rel}`);
    continue;
  }
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    problems.push(`THIẾU FILE   ${rel}`);
    continue;
  }
  const codeLines = stripNonCode(fs.readFileSync(file, "utf8")).split("\n");
  for (const [re, label] of BANNED) {
    const line = codeLines.findIndex((l) => re.test(l));
    if (line >= 0) problems.push(`CÒN MẠNG    ${rel}:${line + 1}  (${label})`);
  }
}

/* ---- 2. Export parity: nạp thật qua Vite để alias @/ hoạt động ---- */

const server = await createServer({
  configFile: path.join(ROOT, "vite.config.js"),
  root: ROOT,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
});

let okModules = 0;
let checkedNames = 0;

for (const [rel, want] of Object.entries(contract)) {
  if (EXEMPT.has(rel)) continue;
  if (!fs.existsSync(path.join(ROOT, rel))) continue;
  let mod;
  try {
    mod = await server.ssrLoadModule("/" + rel);
  } catch (e) {
    problems.push(`KHÔNG NẠP ĐƯỢC ${rel}: ${String(e.message).split("\n")[0]}`);
    continue;
  }

  const got = Object.keys(mod).filter((k) => k !== "default").sort();
  const missing = want.named.filter((n) => !got.includes(n));
  const hasDefault = "default" in mod;

  checkedNames += want.named.length;
  if (missing.length) problems.push(`THIẾU EXPORT ${rel}: ${missing.join(", ")}`);
  if (want.hasDefault && !hasDefault) problems.push(`THIẾU DEFAULT ${rel}`);

  /* Mọi export phải gọi được và không được là undefined. */
  for (const n of want.named) {
    if (got.includes(n) && mod[n] === undefined)
      problems.push(`EXPORT UNDEFINED ${rel}.${n}`);
  }

  if (!missing.length && (!want.hasDefault || hasDefault)) okModules += 1;
}

/* ---- Bảng trạng thái đơn khớp ĐÚNG bảng chốt của spec, và 3 bản orderStatus.js giống hệt ----
 * orderStatus.js có ba bản chép tay (customer / admin / warehouse, repo tách rời). Chỉ kiểm
 * "mock thuộc 19 mã" thì một bản vẫn trôi nhãn/bí danh mà không ai biết, nên ở đây so từng
 * mục với MỘT bảng kỳ vọng (Design Notes + bảng chuẩn hóa state-machines.md §1), rồi so byte
 * với bản của hai app kia nếu repo đó nằm cạnh. */
const EXPECTED_ORDER_STATUS_TABLE = [
  ["PENDING_REVIEW", "Chờ duyệt"],
  ["NEED_MORE_INFO", "Cần bổ sung thông tin"],
  ["REJECTED", "Đã từ chối"],
  ["QUOTATION_SENT", "Đã gửi báo giá"],
  ["QUOTATION_REJECTED", "Khách từ chối báo giá"],
  ["WAITING_DEPOSIT", "Chờ đặt cọc"],
  ["DEPOSIT_PAID", "Đã đặt cọc"],
  ["APPROVED", "Đã xác nhận"],
  ["CHECKED_IN", "Đã nhập kho gốc"],
  ["IN_TRANSIT", "Đang vận chuyển quốc tế"],
  ["ARRIVED_VN", "Đã về Việt Nam"],
  ["ARRIVED_DESTINATION", "Đã tới kho VN"],
  ["WAITING_PAYMENT", "Chờ tất toán"],
  ["PAID", "Đã tất toán"],
  ["STORED_AT_VN", "Đang lưu kho VN"],
  ["DELIVERING", "Đang giao hàng"],
  ["DELIVERED", "Đã giao hàng"],
  ["COMPLETED", "Hoàn tất"],
  ["CANCELLED", "Đã hủy"],
];
const EXPECTED_LEGACY_ORDER_STATUS_MAP = {
  PENDING: "PENDING_REVIEW",
  WAITING_QUOTATION: "PENDING_REVIEW",
  ACCEPTED: "PENDING_REVIEW",
  QUOTATION_ACCEPTED: "WAITING_DEPOSIT",
  QUOTATION_CONFIRMED: "WAITING_DEPOSIT",
  CONFIRMED: "WAITING_DEPOSIT",
  PENDING_PAYMENT: "WAITING_PAYMENT",
  WAITING_FINAL_PAYMENT: "WAITING_PAYMENT",
  DEPOSITED: "DEPOSIT_PAID",
  PAYMENT_CONFIRMED: "DEPOSIT_PAID",
  PROCESSING: "APPROVED",
  WAITING_FOR_PARCEL: "APPROVED",
  WAITING_PARCEL: "APPROVED",
  ARRIVED_ORIGIN_WAREHOUSE: "CHECKED_IN",
  WAREHOUSE_RECEIVED: "CHECKED_IN",
  RECEIVED: "CHECKED_IN",
  WAITING_INSPECTION: "CHECKED_IN",
  INSPECTION_COMPLETED: "CHECKED_IN",
  WAITING_PACKING: "CHECKED_IN",
  PACKED: "CHECKED_IN",
  CUSTOMS_CLEARANCE: "IN_TRANSIT",
  WAITING_STORED: "ARRIVED_DESTINATION",
  STORED: "ARRIVED_DESTINATION",
  IN_WAREHOUSE: "ARRIVED_DESTINATION",
  READY_FOR_DELIVERY: "PAID",
  DELIVERY_FAILED: "DELIVERING",
  RETURNING: "DELIVERING",
};
const ORDER_STATUS_COPIES = [
  "vcl-customer-ui/src/features/consignment/constants/orderStatus.js",
  "vcl-admin-ui/src/features/consignment/constants/orderStatus.js",
  "vcl-warehouse-staff-ui/src/features/khoqt-parcel/constants/orderStatus.js",
];

const checkOrderStatusTable = (mod, selfRel) => {
  const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const wantOrder = EXPECTED_ORDER_STATUS_TABLE.map(([code]) => code);
  const wantLabels = Object.fromEntries(EXPECTED_ORDER_STATUS_TABLE);
  if (!sameJson([...(mod.ORDER_STATUS_ORDER ?? [])], wantOrder))
    problems.push(`BẢNG MÃ ĐƠN ${selfRel}: ORDER_STATUS_ORDER lệch bảng 19 mã của spec`);
  if (!sameJson({ ...(mod.ORDER_STATUS_LABELS ?? {}) }, wantLabels)) {
    const bad = wantOrder.filter((code) => mod.ORDER_STATUS_LABELS?.[code] !== wantLabels[code]);
    const extra = Object.keys(mod.ORDER_STATUS_LABELS ?? {}).filter((code) => !(code in wantLabels));
    problems.push(
      `BẢNG MÃ ĐƠN ${selfRel}: ORDER_STATUS_LABELS lệch Design Notes (${[...bad, ...extra].join(", ") || "thứ tự khóa"})`
    );
  }
  if (!sameJson({ ...(mod.LEGACY_ORDER_STATUS_MAP ?? {}) }, EXPECTED_LEGACY_ORDER_STATUS_MAP))
    problems.push(`BẢNG MÃ ĐƠN ${selfRel}: LEGACY_ORDER_STATUS_MAP lệch bảng chuẩn hóa`);

  const workspace = path.resolve(ROOT, "..");
  const selfFile = path.join(ROOT, selfRel);
  const selfBytes = fs.readFileSync(selfFile);
  for (const copy of ORDER_STATUS_COPIES) {
    const other = path.join(workspace, copy);
    if (path.resolve(other) === path.resolve(selfFile) || !fs.existsSync(other)) continue;
    if (!selfBytes.equals(fs.readFileSync(other)))
      problems.push(`BẢN SAO LỆCH ${selfRel} khác byte với ../${copy}`);
  }
};

/* ---- 3. Trạng thái ĐƠN KÝ GỬI trong mock chỉ dùng 19 mã đích ----
   Nguồn mã: src/features/consignment/constants/orderStatus.js (state-machines.md §1).
   Chỉ soi các trường cấp ĐƠN ký gửi; trạng thái báo giá, kiện, lô, WRO, phiếu, thanh toán
   và mua hộ (PUR-) có máy trạng thái riêng nên không nằm trong danh sách dưới. */

const ORDER_STATUS_MODULE = "src/features/consignment/constants/orderStatus.js";
let orderStatusChecked = 0;

try {
  const { ORDER_STATUS_ORDER, ORDER_STATUS_LABELS } = await server.ssrLoadModule(
    "/" + ORDER_STATUS_MODULE
  );
  checkOrderStatusTable(await server.ssrLoadModule("/" + ORDER_STATUS_MODULE), ORDER_STATUS_MODULE);
  const allowed = new Set(ORDER_STATUS_ORDER);


  /* [file mock, export, hàm chọn bản ghi cấp đơn ký gửi, các trường trạng thái đơn] */
  const ORDER_STATUS_SOURCES = [
    ["src/mocks/data/consignments.js", "consignments", () => true, ["status", "orderStatus", "consignmentStatus"]],
  ];

  for (const [rel, exportName, isConsignmentOrder, fields] of ORDER_STATUS_SOURCES) {
    const mod = await server.ssrLoadModule("/" + rel);
    const rows = mod[exportName];
    if (!Array.isArray(rows)) {
      problems.push(`MÃ ĐƠN      ${rel}: không tìm thấy mảng export "${exportName}"`);
      continue;
    }
    rows.filter(isConsignmentOrder).forEach((row, index) => {
      for (const field of fields) {
        if (!(field in row)) continue;
        orderStatusChecked += 1;
        const value = row[field];
        if (!allowed.has(value)) {
          const ref = row.consignmentCode || row.orderCode || row.id || `#${index}`;
          problems.push(
            `MÃ ĐƠN SAI  ${rel} ${exportName}[${ref}].${field} = ${JSON.stringify(value)} (không thuộc 19 mã đích)`
          );
        }
      }
    });
  }

  /* Danh mục mã + nhãn khai trong mock phải trùng module (đúng thứ tự, đúng nhãn). */
  const consignmentMock = await server.ssrLoadModule("/src/mocks/data/consignments.js");
  const statusList = consignmentMock.CONSIGNMENT_STATUSES;
  if (JSON.stringify(statusList) !== JSON.stringify(ORDER_STATUS_ORDER)) {
    problems.push(
      `MÃ ĐƠN SAI  src/mocks/data/consignments.js CONSIGNMENT_STATUSES phải đúng 19 mã theo ORDER_STATUS_ORDER`
    );
  }
  const statusLabels = consignmentMock.CONSIGNMENT_STATUS_LABELS || {};
  for (const code of ORDER_STATUS_ORDER) {
    if (statusLabels[code] !== ORDER_STATUS_LABELS[code]) {
      problems.push(
        `NHÃN SAI    src/mocks/data/consignments.js CONSIGNMENT_STATUS_LABELS.${code} = ${JSON.stringify(statusLabels[code])} (cần ${JSON.stringify(ORDER_STATUS_LABELS[code])})`
      );
    }
  }
  consignmentMock.consignments.forEach((order) => {
    if (allowed.has(order.status) && order.statusDisplayName !== ORDER_STATUS_LABELS[order.status]) {
      problems.push(
        `NHÃN SAI    src/mocks/data/consignments.js consignments[${order.consignmentCode}].statusDisplayName = ${JSON.stringify(order.statusDisplayName)} (cần ${JSON.stringify(ORDER_STATUS_LABELS[order.status])})`
      );
    }
  });
} catch (e) {
  problems.push(`KHÔNG KIỂM ĐƯỢC MÃ ĐƠN: ${String(e.message).split("\n")[0]}`);
}

/* ---- 4. I/O matrix (spec-consignment-flow, story 1) ----
 *
 * Mỗi dòng matrix của story là MỘT phép kiểm chạy thật trên module sản phẩm (nạp qua
 * Vite), in PASS/FAIL theo tên kịch bản; FAIL đẩy vào `problems` để thoát mã 1.
 * Kịch bản nào tạm sửa fixture (gỡ rule, đổi DEPOSIT_RATE) đều trả lại trong `finally`.
 */

const matrixResults = [];

const checkMatrix = async (scenario, run) => {
  let detail;
  try {
    detail = await run();
  } catch (e) {
    detail = `ném lỗi: ${String(e?.message ?? e).split("\n")[0]}`;
  }
  const ok = detail === true;
  matrixResults.push({ scenario, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  I/O matrix · ${scenario}${ok ? "" : ` — ${detail}`}`);
  if (!ok) problems.push(`I/O MATRIX   ${scenario}: ${detail}`);
};

/** So kết quả thực tế với kỳ vọng; trả true hoặc câu mô tả chỗ lệch. */
const expectEqual = (label, got, want) =>
  Object.is(got, want) ? true : `${label} = ${JSON.stringify(got)} (cần ${JSON.stringify(want)})`;

const firstFailure = (...results) => results.find((r) => r !== true) ?? true;

/** Chạy fn trong lúc bắt console.warn; trả { value, warnings }. */
const captureWarn = async (fn) => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    return { value: await fn(), warnings };
  } finally {
    console.warn = original;
  }
};

/** Tạm gỡ rule `ruleCode` khỏi mảng pricingRules (cùng instance), chạy fn, rồi trả lại đúng chỗ. */
const withoutRule = async (rules, ruleCode, fn) => {
  const index = rules.findIndex((rule) => rule?.ruleCode === ruleCode);
  if (index < 0) throw new Error(`fixture không có rule ${ruleCode} để gỡ`);
  const [removed] = rules.splice(index, 1);
  try {
    return await fn();
  } finally {
    rules.splice(index, 0, removed);
  }
};

try {
  const { getOrderStatusLabel, normalizeOrderStatus } = await server.ssrLoadModule(
    "/" + ORDER_STATUS_MODULE
  );

  await checkMatrix("Mã đích: getOrderStatusLabel(\"DEPOSIT_PAID\") → \"Đã đặt cọc\"", () =>
    expectEqual("nhãn", getOrderStatusLabel("DEPOSIT_PAID"), "Đã đặt cọc")
  );
  await checkMatrix("Mã cũ: normalizeOrderStatus(\"WAREHOUSE_RECEIVED\") → \"CHECKED_IN\"", () =>
    expectEqual("mã", normalizeOrderStatus("WAREHOUSE_RECEIVED"), "CHECKED_IN")
  );
  await checkMatrix("Mã lạ: normalizeOrderStatus(\"FOO\") → \"FOO\", nhãn \"FOO\", không throw", () =>
    firstFailure(
      expectEqual("mã", normalizeOrderStatus("FOO"), "FOO"),
      expectEqual("nhãn", getOrderStatusLabel("FOO"), "FOO")
    )
  );
  await checkMatrix("Rỗng: normalizeOrderStatus(null) → null, nhãn \"—\", không throw", () =>
    firstFailure(
      expectEqual("mã", normalizeOrderStatus(null), null),
      expectEqual("nhãn", getOrderStatusLabel(null), "—")
    )
  );

  /*
   * Ba kịch bản tiền cọc dưới đây soi logic DEPOSIT_RATE của báo giá tạm tính.
   * Bản THẬT của consignmentService không còn hàm đó (backend bỏ API báo giá tạm
   * tính cho Sale), nên phép kiểm chạy trên BẢN SAO MOCK — cũng chính là bản mà
   * màn "Sale tạo đơn hộ khách" đang dùng, nên vẫn là kiểm đúng thứ đang chạy.
   */
  const { estimateQuotationApi } = await server.ssrLoadModule(
    "/src/features/consignment/api/consignmentService.mock.js"
  );
  /*
   * adminService.updatePricingRule ĐÃ NỐI API THẬT (26/09/2026, catalogAdminService — kiểm ở
   * tools/verify-api.mjs), nên không còn ghi vào fixture. Kịch bản "đổi DEPOSIT_RATE" dưới đây
   * sửa thẳng bản ghi fixture mà bản mock báo giá đọc, để vẫn soi được logic đọc cấu hình lúc gọi.
   */
  const { pricingRules, findPricingRuleByCode } = await server.ssrLoadModule("/src/mocks/data/catalog.js");
  const { consignments } = await server.ssrLoadModule("/src/mocks/data/consignments.js");

  /* Payload tối thiểu qua được validateQuotationPayload; tổng báo giá 1.000.000 ₫. */
  const order = consignments[0];
  const TOTAL = 1_000_000;
  const estimate = () =>
    estimateQuotationApi(order.orderId, {
      warehouseId: order.warehouseId || "WH-VERIFY",
      servicePricingId: "SP-VERIFY",
      serviceType: "EXPRESS",
      weightKg: 10,
      volumeM3: 0.12,
      packageCount: 1,
      quotation: { totalEstimatedCost: TOTAL },
    });

  await checkMatrix("Cọc (admin): DEPOSIT_RATE 30, tổng 1.000.000 → cọc 300.000", async () => {
    const { value: quote, warnings } = await captureWarn(estimate);
    return firstFailure(
      expectEqual("rule DEPOSIT_RATE.value", findPricingRuleByCode("DEPOSIT_RATE")?.value, 30),
      expectEqual("total", quote.total, TOTAL),
      expectEqual("depositPercent", quote.depositPercent, 30),
      expectEqual("depositAmount", quote.depositAmount, 300000),
      warnings.length === 0 || `rule có sẵn mà vẫn console.warn: ${warnings[0]}`
    );
  });

  await checkMatrix("Cọc (admin): thiếu rule DEPOSIT_RATE → dùng 30 và console.warn", async () => {
    const { value: quote, warnings } = await captureWarn(() =>
      withoutRule(pricingRules, "DEPOSIT_RATE", estimate)
    );
    return firstFailure(
      expectEqual("depositPercent", quote.depositPercent, 30),
      expectEqual("depositAmount", quote.depositAmount, 300000),
      warnings.some((w) => w.includes("DEPOSIT_RATE")) || "không có console.warn nhắc DEPOSIT_RATE"
    );
  });

  await checkMatrix("Đổi cấu hình: admin sửa DEPOSIT_RATE thành 40 → báo giá tạo sau đó dùng 40%", async () => {
    const rule = findPricingRuleByCode("DEPOSIT_RATE");
    if (!rule) return "fixture không có rule DEPOSIT_RATE";
    const originalValue = rule.value;
    const originalUpdatedAt = rule.updatedAt;
    try {
      rule.value = 40;
      const quote = await estimate();
      return firstFailure(
        expectEqual("depositPercent", quote.depositPercent, 40),
        expectEqual("depositAmount", quote.depositAmount, 400000)
      );
    } finally {
      rule.value = originalValue;
      rule.updatedAt = originalUpdatedAt;
    }
  });

  await checkMatrix("Phụ phí (admin): SUR_INSPECTION = 20.000", () =>
    expectEqual('findPricingRuleByCode("SUR_INSPECTION").value', findPricingRuleByCode("SUR_INSPECTION")?.value, 20000)
  );

  /* Hàng đợi Sale (settlementService / actionQueueService) đã nối API thật — kịch bản mock cũ
     (đếm dòng trên fixture) bị gỡ cùng các fixture finance / payments / operations. */
} catch (e) {
  problems.push(`KHÔNG CHẠY ĐƯỢC I/O MATRIX: ${String(e.message).split("\n")[0]}`);
}

await server.close();

/* ---- 5. Báo cáo ---- */

const total = Object.keys(contract).length;
console.log(`modules kiểm tra : ${total}`);
console.log(`đã nối API thật  : ${realApiModules} (miễn bước soát dấu vết mạng)`);
console.log(`đạt hợp đồng     : ${okModules}/${total}`);
console.log(`tên export soát  : ${checkedNames}`);
console.log(`trạng thái đơn   : ${orderStatusChecked} trường (19 mã đích)`);
console.log(`I/O matrix       : ${matrixResults.filter((r) => r.ok).length}/${matrixResults.length} kịch bản đạt`);

if (problems.length) {
  console.log(`\n${problems.length} VẤN ĐỀ:`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(
  "\nTầng mock giữ đúng toàn bộ hợp đồng; module chưa nối API vẫn không còn lời gọi mạng nào."
);
