/**
 * Kiểm tra OFFLINE các module api/ đã nối backend thật (đợt BÁO GIÁ KÝ GỬI).
 *
 * Quyết định đã chốt: KHÔNG gọi production, KHÔNG tạo dữ liệu thật. Script này:
 *
 * - chặn http/https/net/tls/fetch của Node TRƯỚC khi nạp bất cứ module sản phẩm
 *   nào — lời gọi nào lọt ra mạng đều bị ghi lại và làm script FAIL;
 * - nạp module sản phẩm qua Vite SSR (alias @/ @shared/ @features/ chạy như trong
 *   app), với envDir rỗng để .env của máy dev không ghi đè base URL;
 * - thay adapter của axios instance bằng adapter GIẢ, trả response mẫu bám đúng
 *   code backend VCL_API (controller + DTO), kể cả các mã lỗi 400/401/403;
 * - mỗi hành vi là một kịch bản PASS/FAIL riêng;
 * - cộng phép kiểm TĨNH: không file nào (ngoài src/mocks và *.mock.js) còn import bản mock,
 *   và các màn vừa gỡ mock import đúng bản thật.
 *
 *   node tools/verify-api.mjs     (hoặc npm run verify:api)
 *
 * Thoát mã 1 nếu có kịch bản FAIL hoặc có request ra mạng.
 */
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

import { AxiosError, AxiosHeaders } from "axios";
import { createServer } from "vite";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/* =========================================================
   0. CHẶN MẠNG — cài trước khi nạp bất cứ module sản phẩm nào
   ========================================================= */

const networkAttempts = [];

const describeTarget = (args) => {
  const [first] = args;

  if (typeof first === "string" || first instanceof URL) return String(first);
  if (first && typeof first === "object") {
    return `${first.protocol || ""}//${first.hostname || first.host || "?"}${first.path || ""}`;
  }
  return "?";
};

const blockNetwork = (label) =>
  function blocked(...args) {
    networkAttempts.push(`${label} ${describeTarget(args)}`);
    throw new Error(`verify-api: đã chặn truy cập mạng (${label})`);
  };

http.request = blockNetwork("http.request");
http.get = blockNetwork("http.get");
https.request = blockNetwork("https.request");
https.get = blockNetwork("https.get");
net.connect = blockNetwork("net.connect");
net.createConnection = blockNetwork("net.createConnection");
tls.connect = blockNetwork("tls.connect");
globalThis.fetch = async (...args) => {
  networkAttempts.push(`fetch ${describeTarget(args)}`);
  throw new Error("verify-api: đã chặn fetch()");
};

/*
 * Node ≥ 25 tự có localStorage/sessionStorage toàn cục (Web Storage thử nghiệm).
 * Gỡ chúng đi TRƯỚC khi nạp module — không gọi getter, nên không in cảnh báo —
 * để phép kiểm "httpClient không đụng storage ở top-level" giống SSR thật.
 */
for (const name of ["localStorage", "sessionStorage"]) {
  if (Object.getOwnPropertyDescriptor(globalThis, name)?.configurable) {
    delete globalThis[name];
  }
}

/* =========================================================
   1. VITE SSR — .env của dev KHÔNG được nạp (envDir rỗng)
   ========================================================= */

const emptyEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), "vcl-admin-verify-api-"));
delete process.env.VITE_API_BASE_URL;

const createSsrServer = () =>
  createServer({
    configFile: path.join(ROOT, "vite.config.js"),
    root: ROOT,
    envDir: emptyEnvDir,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false },
  });

const server = await createSsrServer();
const load = (rel) => server.ssrLoadModule(rel);

/* Nạp khi CHƯA có window/storage giả: httpClient không được đụng tới chúng ở top-level. */
const hadWindowAtLoad = typeof globalThis.window !== "undefined";
const hadStorageAtLoad =
  typeof globalThis.localStorage !== "undefined" ||
  typeof globalThis.sessionStorage !== "undefined";

let loadError = null;
let mods = {};

try {
  mods = {
    http: await load("/src/shared/api/httpClient.js"),
    envelope: await load("/src/shared/api/apiEnvelope.js"),
    auth: await load("/src/features/auth/api/authService.js"),
    consignment: await load("/src/features/consignment/api/consignmentService.js"),
    quotation: await load("/src/features/consignment/api/quotationService.js"),
    master: await load("/src/features/consignment/api/consignmentMasterService.js"),
    warehouse: await load("/src/features/warehouse/api/warehouseService.js"),
    servicePricing: await load("/src/features/pricing/api/servicePricingService.js"),
    pricingRule: await load("/src/features/pricing/api/pricingRuleService.js"),
    systemParameter: await load("/src/features/pricing/api/systemParameterService.js"),
    packageConfig: await load("/src/features/pricing/api/packageConfigurationService.js"),
    orderStatus: await load("/src/features/consignment/constants/orderStatus.js"),
    receivingNotes: await load("/src/features/receiving/api/receivingNoteService.js"),
    actionQueue: await load("/src/features/settlement/api/actionQueueService.js"),
    finance: await load("/src/features/admin/api/adminFinanceService.js"),
    warehouseManager: await load("/src/features/warehouse/api/warehouseManagerService.js"),
    warehouseAdmin: await load("/src/features/warehouse/api/warehouseAdminService.js"),
    catalogAdmin: await load("/src/features/catalog/api/catalogAdminService.js"),
    adminSvc: await load("/src/features/admin/api/adminService.js"),
    adminUser: await load("/src/features/admin/api/adminUserService.js"),
    receipt: await load("/src/features/consignment/api/consignmentReceiptService.js"),
    customerLookup: await load("/src/features/customer/api/customerLookupService.js"),
    receiptUrl: await load("/src/shared/utils/receiptUrl.js"),
    dashboard: await load("/src/features/dashboard/api/dashboardService.js"),
    purchaseOrder: await load("/src/features/purchase/api/purchaseOrderService.js"),
    /* Chat CSKH nhân viên (26/09/2026): hội thoại + upload ảnh THẬT, badge chưa đọc. */
    conversation: await load("/src/features/chat/api/conversationApi.js"),
    chatUpload: await load("/src/features/chat/api/chatImageUploadApi.js"),
    chatHelpers: await load("/src/features/chat/pages/CustomerServiceChat/CustomerServiceChat.helpers.js"),
    saleBadges: await load("/src/features/workspace/api/saleBadgeService.js"),
    /* Gỡ mock còn lại (27/09/2026): upload shared, tỷ giá, hàng cấm, AI Sales, khách hàng, địa chỉ GoShip. */
    uploadShared: await load("/src/shared/api/uploadImage.js"),
    exchangeRate: await load("/src/features/pricing/api/exchangeRateService.js"),
    restricted: await load("/src/features/catalog/api/restrictedItemService.js"),
    saleAi: await load("/src/features/chat/api/saleAiService.js"),
    customerSvc: await load("/src/features/customer/api/customerService.js"),
    address: await load("/src/shared/api/vietnamAddressService.js"),
    purchaseRequest: await load("/src/features/purchase/api/purchaseRequestService.js"),
    /* Ảnh tiếp nhận kho VN (30/09/2026): biên bản kiểm kiện + lô trả kèm ảnh VN_ARRIVAL_PROOF. */
    inspection: await load("/src/features/operations/api/parcelInspectionService.js"),
    attachmentSvc: await load("/src/features/attachments/api/attachmentService.js"),
    /* Giới hạn tạo đơn do Admin cấu hình (30/09/2026): API + helper form Sale + mục Admin. */
    orderLimits: await load("/src/shared/api/orderLimitsApi.js"),
    orderLimitsSection: await load("/src/features/pricing/components/OrderLimitsSection/OrderLimitsSection.helpers.js"),
    consignmentOrderHelpers: await load("/src/features/consignment/pages/ConsignmentOrder/ConsignmentOrder.helpers.js"),
    buyOrderHelpers: await load("/src/features/purchase/pages/ConsignmentBuyOrder/ConsignmentBuyOrder.helpers.js"),
  };
} catch (error) {
  loadError = error;
}

/* =========================================================
   2. MÔI TRƯỜNG TRÌNH DUYỆT GIẢ (storage + window.location)
   ========================================================= */

class MemoryStorage {
  #map = new Map();
  get length() {
    return this.#map.size;
  }
  key(index) {
    return Array.from(this.#map.keys())[index] ?? null;
  }
  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }
  setItem(key, value) {
    this.#map.set(key, String(value));
  }
  removeItem(key) {
    this.#map.delete(key);
  }
  clear() {
    this.#map.clear();
  }
}

const defineGlobal = (name, value) =>
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

defineGlobal("sessionStorage", new MemoryStorage());
defineGlobal("localStorage", new MemoryStorage());

const fakeLocation = {
  pathname: "/sale/consignments",
  replaced: [],
  replace(url) {
    this.replaced.push(url);
  },
};

defineGlobal("window", {
  location: fakeLocation,
  sessionStorage: globalThis.sessionStorage,
  localStorage: globalThis.localStorage,
  atob: (value) => Buffer.from(String(value), "base64").toString("binary"),
});

/* =========================================================
   3. ADAPTER AXIOS GIẢ
   ========================================================= */

const SERVER_DATE = "Thu, 18 Sep 2026 03:00:00 GMT";

let requests = [];
let routes = [];

const parseBody = (data) => {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const matchRoute = (req) =>
  routes.find(
    (route) =>
      route.method === req.method &&
      (route.url instanceof RegExp ? route.url.test(req.url) : route.url === req.url),
  );

const fakeAdapter = async (config) => {
  const headers = AxiosHeaders.from(config.headers);
  const req = {
    method: String(config.method || "get").toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    params: config.params ? { ...config.params } : undefined,
    body: parseBody(config.data),
    authorization: headers.get("Authorization") ?? null,
    timeout: config.timeout,
  };
  requests.push(req);

  const route = matchRoute(req);
  const reply = route
    ? route.reply(req, config)
    : {
        status: 599,
        data: { message: `verify-api: không có response mẫu cho ${req.method} ${req.url}` },
      };

  if (reply.networkError) {
    throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, {});
  }

  const response = {
    data: reply.data,
    status: reply.status,
    statusText: String(reply.status),
    headers: AxiosHeaders.from({ date: SERVER_DATE, ...(reply.headers || {}) }),
    config,
    request: {},
  };

  if (config.validateStatus ? config.validateStatus(response.status) : response.status < 300) {
    return response;
  }

  throw new AxiosError(
    `Request failed with status code ${response.status}`,
    response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    response.request,
    response,
  );
};

const ok = (data, status = 200) => ({ status, data });
const fail = (status, data) => ({ status, data });

/* =========================================================
   4. KHUNG KIỂM TRA
   ========================================================= */

const results = [];
const problems = [];
let capturedLogs = [];

const silenceConsole = () => {
  const original = { error: console.error, warn: console.warn, info: console.info };
  capturedLogs = [];
  for (const level of ["error", "warn", "info"]) {
    console[level] = (...args) => capturedLogs.push(`[${level}] ${args.map(String).join(" ")}`);
  }
  return () => Object.assign(console, original);
};

const resetState = ({ token = null, pathname = "/sale/consignments", extra = {} } = {}) => {
  requests = [];
  routes = [];
  sessionStorage.clear();
  localStorage.clear();
  if (token) sessionStorage.setItem("accessToken", token);
  Object.entries(extra).forEach(([key, value]) => sessionStorage.setItem(key, value));
  fakeLocation.pathname = pathname;
  fakeLocation.replaced = [];
};

const check = async (scenario, run) => {
  let detail;
  const restore = silenceConsole();
  try {
    detail = await run();
  } catch (error) {
    detail = `ném lỗi ngoài dự kiến: ${String(error?.message ?? error).split("\n")[0]}`;
  } finally {
    restore();
  }
  const passed = detail === true;
  results.push({ scenario, passed });
  console.log(`${passed ? "PASS" : "FAIL"}  ${scenario}${passed ? "" : ` — ${detail}`}`);
  if (!passed) {
    problems.push(`${scenario}: ${detail}`);
    capturedLogs.slice(0, 3).forEach((line) => console.log(`        ${line.slice(0, 240)}`));
  }
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const expectEqual = (label, got, want) =>
  same(got, want) ? true : `${label} = ${JSON.stringify(got)} (cần ${JSON.stringify(want)})`;

const expectTrue = (label, value) => (value ? true : `${label} không đúng`);

const all = (...checks) => checks.find((c) => c !== true) ?? true;

const rejection = async (promise) => {
  try {
    const value = await promise;
    return { resolved: true, value };
  } catch (error) {
    return { resolved: false, error };
  }
};

const onlyRequest = () => (requests.length === 1 ? requests[0] : null);

const storageKeys = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index)).sort();

/* =========================================================
   5. DỮ LIỆU MẪU (bám đúng DTO của backend)
   ========================================================= */

const ORDER_ID = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const QUOTATION_ID = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const WAREHOUSE_ID = "5F8A0B1C-2D3E-4F5A-6B7C-8D9E0F1A2B3C";
const SERVICE_PRICING_ID = "7c6b5a49-3827-4615-9403-2b1a0c9d8e7f";
const ITEM_ID = "11111111-2222-4333-8444-555555555555";
const INSPECTION_RULE_ID = "99999999-8888-4777-8666-555555555555";

const LOGIN_RESPONSE = {
  token: "jwt.header.payload",
  expiresAt: "2026-09-19T10:00:00Z",
  userId: "0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0",
  fullName: "Nguyễn Văn Sale",
  role: "Sale",
  region: "",
};

const CUSTOMER_BLOCKED_MESSAGE =
  "Tài khoản khách hàng không dùng được cho trang quản trị.";

const ORDER_ROW = {
  orderId: ORDER_ID,
  consignmentCode: "VCL-20260917161921-540135",
  orderType: "CONSIGNMENT",
  customerName: "Nguyễn Văn A",
  consignmentType: "Express",
  status: "PENDING_REVIEW",
  totalWeight: 6.7,
  totalVolume: 36000,
  route: "Trung quốc --> Việt Nam",
  receiverName: "[DEMO] Đơn 01",
  requiresInspection: true,
  createdAt: "2026-09-17T16:19:21Z",
  warehouseId: WAREHOUSE_ID,
  pricingRuleIds: [INSPECTION_RULE_ID],
  itemNames: ["Bình gốm"],
};

const ORDER_DETAIL = {
  ...ORDER_ROW,
  note: "[DEMO] Đơn 01",
  customer: { fullName: "Nguyễn Văn A", phone: "0900000000" },
  items: [
    {
      id: ITEM_ID,
      productName: "Bình gốm",
      productType: "11111111-0000-0000-0000-000000000001",
      quantity: 2,
      weight: 5.5,
      length: 40,
      width: 30,
      height: 30,
      declaredValue: 1500000,
      packageConfigurationId: "99999999-2222-2222-2222-222222222222",
      packageConfiguration: {
        id: "99999999-2222-2222-2222-222222222222",
        configCode: "MEDIUM",
        configName: "Thùng gỗ vừa",
        length: 60,
        width: 40,
        height: 40,
        maxWeight: 20,
        packageFee: 25000,
        status: "ACTIVE",
      },
      services: [
        {
          pricingRuleId: INSPECTION_RULE_ID,
          code: "SUR_INSPECTION",
          name: "Phụ phí kiểm hàng",
          ruleType: "SURCHARGE",
          calculationType: "FIXED",
          value: 10000,
        },
      ],
    },
  ],
  quotation: {
    quotationId: QUOTATION_ID,
    quoteType: "ESTIMATE",
    status: "DRAFT",
    taxAndDuty: 120000,
    totalEstimatedCost: 2350000,
    warehouseId: WAREHOUSE_ID,
  },
};

const DRAFT_QUOTATION = {
  quotationId: QUOTATION_ID,
  orderId: ORDER_ID,
  quoteType: "ESTIMATE",
  status: "DRAFT",
  consignmentCode: ORDER_ROW.consignmentCode,
  totalWeight: 6.7,
  chargeableWeight: 7.2,
  estimatedFreightCharge: 720000,
  domesticShippingFee: 50000,
  serviceFee: 80000,
  taxAndDuty: 120000,
  vat: 100000,
  importTax: 20000,
  totalEstimatedCost: 970000,
  priceApprovalStatus: "NOT_REQUIRED",
  canCustomerAccept: false,
  createdAt: "2026-09-17T16:19:21Z",
  additionalFees: [
    {
      id: "fee-1",
      feeType: "SURCHARGE",
      code: "SUR_INSPECTION",
      pricingRuleId: INSPECTION_RULE_ID,
      feeId: INSPECTION_RULE_ID,
      orderItemId: ITEM_ID,
      itemName: "Bình gốm",
      label: "Phụ phí kiểm hàng",
      amount: 10000,
      enabled: true,
    },
    {
      id: "fee-2",
      feeType: "PACKING_FEE",
      code: "",
      pricingRuleId: null,
      /* Đúng như backend thật: feeId = pricingRuleId ?? id → dòng không quy tắc trả ID DÒNG PHÍ. */
      feeId: "fee-2",
      orderItemId: ITEM_ID,
      itemName: "Bình gốm",
      feeName: "Phí thùng gỗ",
      amount: 25000,
      enabled: true,
    },
    {
      id: "fee-3",
      feeType: "SURCHARGE",
      code: "SUR_BULKY",
      pricingRuleId: "aaaa1111-2222-4333-8444-555566667777",
      feeId: "aaaa1111-2222-4333-8444-555566667777",
      orderItemId: null,
      itemName: null,
      label: "Phụ phí hàng cồng kềnh",
      amount: 45000,
      enabled: true,
    },
  ],
  parcels: [],
};

/* =========================================================
   6. KỊCH BẢN
   ========================================================= */

if (loadError) {
  problems.push(`KHÔNG NẠP ĐƯỢC MODULE: ${String(loadError.message).split("\n")[0]}`);
} else {
  const {
    http: httpMod,
    envelope,
    auth,
    consignment,
    quotation,
    master,
    warehouse,
    servicePricing,
    pricingRule,
    systemParameter,
    packageConfig,
    receivingNotes,
    actionQueue,
    finance,
    warehouseManager,
    warehouseAdmin,
    catalogAdmin,
    adminSvc,
    adminUser,
    receipt,
    receiptUrl,
    customerLookup,
    dashboard,
    purchaseOrder,
    conversation,
    chatUpload,
    chatHelpers,
    saleBadges,
    uploadShared,
    exchangeRate,
    restricted,
    saleAi,
    customerSvc,
    address,
    purchaseRequest,
    inspection,
    attachmentSvc,
    orderLimits,
    orderLimitsSection,
    consignmentOrderHelpers,
    buyOrderHelpers,
  } = mods;

  const httpClient = httpMod.default;
  httpClient.defaults.adapter = fakeAdapter;
  /* Instance upload riêng (timeout dài) — shared và chat dùng CHUNG một instance; cũng phải
     đi qua adapter giả. */
  uploadShared.uploadAxios.defaults.adapter = fakeAdapter;
  chatUpload.chatUploadAxios.defaults.adapter = fakeAdapter;

  /* ---------- Hạ tầng httpClient ---------- */

  await check("httpClient: nạp được qua Vite SSR khi chưa có window/storage", () =>
    all(
      expectEqual("window lúc nạp", hadWindowAtLoad, false),
      expectEqual("storage lúc nạp", hadStorageAtLoad, false),
      expectTrue("export default là axios instance", typeof httpClient?.get === "function"),
    ),
  );

  await check(
    "httpClient: base URL mặc định https://api-vcl.vnlogistic.click, timeout 30 giây",
    () =>
      all(
        expectEqual("API_BASE_URL", httpMod.API_BASE_URL, "https://api-vcl.vnlogistic.click"),
        expectEqual("defaults.baseURL", httpClient.defaults.baseURL, "https://api-vcl.vnlogistic.click"),
        expectEqual("defaults.timeout", httpClient.defaults.timeout, 30000),
      ),
  );

  await check("httpClient: gắn Bearer từ sessionStorage cho API nghiệp vụ", async () => {
    resetState({ token: "tok-session" });
    routes = [
      {
        method: "GET",
        url: "/api/warehouses/active",
        reply: () => ok({ items: [] }),
      },
    ];
    await warehouse.getActiveWarehousesApi();
    return expectEqual("Authorization", onlyRequest()?.authorization, "Bearer tok-session");
  });

  await check("httpClient: KHÔNG gắn Authorization cho /api/Auth/*", async () => {
    resetState({ token: "tok-cu" });
    routes = [{ method: "POST", url: "/api/Auth/login", reply: () => ok(LOGIN_RESPONSE) }];
    await auth.loginApi({ email: "demo.sale@vcl-demo.example", password: "x" });
    return expectEqual("Authorization", onlyRequest()?.authorization, null);
  });

  await check(
    "httpClient: 401 body RỖNG → dọn phiên và chuyển về /login (dùng expireAuthSession)",
    async () => {
      resetState({
        token: "tok-het-han",
        extra: { user: "{}", role: "sale", isAuth: "true", refreshToken: "r", tokenExpiresAt: "1" },
      });
      routes = [
        {
          method: "GET",
          url: `/api/orders/consignments/${ORDER_ID}`,
          reply: () => fail(401, ""),
        },
      ];
      const { resolved, error } = await rejection(consignment.getConsignmentDetailApi(ORDER_ID));
      return all(
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual("status", error?.response?.status, 401),
        expectEqual("đã dọn sạch khoá phiên", storageKeys(sessionStorage), []),
        expectEqual("chuyển hướng", fakeLocation.replaced, ["/login"]),
      );
    },
  );

  await check(
    "httpClient: 401 có { message } là lỗi nghiệp vụ → chỉ ném lỗi, KHÔNG đăng xuất",
    async () => {
      resetState({ token: "tok-ok", extra: { role: "sale", isAuth: "true" } });
      routes = [
        {
          method: "GET",
          url: `/api/orders/consignments/${ORDER_ID}`,
          reply: () => fail(401, { message: "Bạn không có quyền xem đơn hàng này." }),
        },
      ];
      const { resolved, error } = await rejection(consignment.getConsignmentDetailApi(ORDER_ID));
      return all(
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual("message giữ nguyên", error?.response?.data?.message, "Bạn không có quyền xem đơn hàng này."),
        expectEqual("phiên còn nguyên", storageKeys(sessionStorage), ["accessToken", "isAuth", "role"]),
        expectEqual("không chuyển hướng", fakeLocation.replaced, []),
      );
    },
  );

  await check("httpClient: 403 có { message } → chỉ ném lỗi, KHÔNG đăng xuất", async () => {
    resetState({ token: "tok-admin", extra: { role: "admin", isAuth: "true" } });
    routes = [
      {
        method: "PUT",
        url: `/api/quotations/${QUOTATION_ID}/price-approval`,
        reply: () => fail(403, { message: "Người lập báo giá không được tự duyệt giá ngoại lệ." }),
      },
    ];
    const { resolved, error } = await rejection(
      quotation.decideQuotationPriceApprovalApi(QUOTATION_ID, { decision: "APPROVED" }),
    );
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("status", error?.response?.status, 403),
      expectEqual(
        "message giữ nguyên",
        error?.response?.data?.message,
        "Người lập báo giá không được tự duyệt giá ngoại lệ.",
      ),
      expectEqual("phiên còn nguyên", storageKeys(sessionStorage), ["accessToken", "isAuth", "role"]),
      expectEqual("không chuyển hướng", fakeLocation.replaced, []),
    );
  });

  /* ---------- Bóc vỏ response ---------- */

  await check("apiEnvelope: bóc đúng ba kiểu bọc của backend", () =>
    all(
      expectEqual("{ message, data }", envelope.getResponseData({ data: { message: "m", data: 7 } }), 7),
      expectEqual("object trần giữ nguyên", envelope.getResponseData({ data: { token: "t" } }), { token: "t" }),
      expectEqual("{ items }", envelope.getArrayItems({ items: [1, 2] }), [1, 2]),
      expectEqual(
        "phân trang",
        envelope.getPagedData({ items: [1], totalCount: 21, pageNumber: 2, pageSize: 10 }),
        { items: [1], totalCount: 21, pageNumber: 2, pageSize: 10, totalPages: 3 },
      ),
    ),
  );

  /* ---------- Đăng nhập ---------- */

  await check("loginApi: POST /api/Auth/login, trả object TRẦN (không có khoá data)", async () => {
    resetState();
    routes = [{ method: "POST", url: "/api/Auth/login", reply: () => ok(LOGIN_RESPONSE) }];
    const result = await auth.loginApi({ email: " demo.sale@vcl-demo.example ", password: "pw" });
    const req = onlyRequest();
    return all(
      expectEqual("endpoint", [req?.method, req?.url], ["POST", "/api/Auth/login"]),
      expectEqual("email đã trim", req?.body?.email, "demo.sale@vcl-demo.example"),
      expectEqual("KHÔNG có khoá data", Object.prototype.hasOwnProperty.call(result, "data"), false),
      expectEqual("token + role", [result.token, result.role], ["jwt.header.payload", "Sale"]),
    );
  });

  await check("loginApi: role Customer bị chặn bằng lỗi DẠNG AXIOS 403", async () => {
    resetState();
    routes = [
      {
        method: "POST",
        url: "/api/Auth/login",
        reply: () => ok({ ...LOGIN_RESPONSE, role: "Customer" }),
      },
    ];
    const { resolved, error } = await rejection(
      auth.loginApi({ email: "demo.khach1@vcl-demo.example", password: "pw" }),
    );
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("isAxiosError", error?.isAxiosError, true),
      expectEqual("status", error?.response?.status, 403),
      expectEqual("message", error?.response?.data?.message, CUSTOMER_BLOCKED_MESSAGE),
    );
  });

  await check("loginApi: role nội bộ khác (OperationsManager) KHÔNG bị chặn", async () => {
    resetState();
    routes = [
      {
        method: "POST",
        url: "/api/Auth/login",
        reply: () => ok({ ...LOGIN_RESPONSE, role: "OperationsManager", region: "CN" }),
      },
    ];
    const result = await auth.loginApi({ email: "demo.quanlykho@vcl-demo.example", password: "pw" });
    return expectEqual("role", result.role, "OperationsManager");
  });

  await check("profile: GET trả object phẳng; PUT trả { message } nên đọc lại hồ sơ", async () => {
    resetState({ token: "tok" });
    const profile = {
      id: LOGIN_RESPONSE.userId,
      fullName: "Nguyễn Văn Sale",
      email: "demo.sale@vcl-demo.example",
      phone: "0900000000",
      role: "Sale",
      status: "ACTIVE",
    };
    routes = [
      { method: "GET", url: "/api/User/profile", reply: () => ok(profile) },
      {
        method: "PUT",
        url: "/api/User/profile",
        reply: () => ok({ message: "Cập nhật thông tin cá nhân thành công." }),
      },
    ];
    const got = await auth.getUserProfileApi();
    const updated = await auth.updateUserProfileApi({
      fullName: "Nguyễn Văn Sale 2",
      phone: "0911111111",
      country: "VN",
      address: "HCM",
    });
    return all(
      expectEqual("hồ sơ phẳng", [got.fullName, got.phone], ["Nguyễn Văn Sale", "0900000000"]),
      expectEqual("không lồng user/profile", Object.prototype.hasOwnProperty.call(got, "user"), false),
      expectEqual("PUT rồi GET lại", requests.map((r) => `${r.method} ${r.url}`), [
        "GET /api/User/profile",
        "PUT /api/User/profile",
        "GET /api/User/profile",
      ]),
      expectEqual("giá trị vừa lưu thắng", [updated.fullName, updated.country], ["Nguyễn Văn Sale 2", "VN"]),
    );
  });

  await check("profile: thiếu token thì chặn TRƯỚC khi gọi mạng", async () => {
    resetState();
    const { resolved, error } = await rejection(auth.getUserProfileApi());
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("message", error?.message, "Không tìm thấy token. Vui lòng đăng nhập lại."),
      expectEqual("không gọi request nào", requests.length, 0),
    );
  });

  /* ---------- Danh sách + chi tiết đơn ---------- */

  await check(
    "getConsignmentsApi: LUÔN gửi orderType=CONSIGNMENT + status/pageNumber/pageSize/searchCode",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "GET",
          url: "/api/orders/consignments",
          reply: () =>
            ok({
              message: "Lấy danh sách yêu cầu ký gửi thành công.",
              data: {
                items: [ORDER_ROW],
                totalCount: 14,
                pageNumber: 2,
                pageSize: 10,
                totalPages: 2,
              },
            }),
        },
      ];
      const page = await consignment.getConsignmentsApi({
        status: "PENDING_REVIEW",
        pageNumber: 2,
        pageSize: 10,
        searchCode: "VCL-2026",
      });
      const req = onlyRequest();
      return all(
        expectEqual("params", req?.params, {
          orderType: "CONSIGNMENT",
          status: "PENDING_REVIEW",
          searchCode: "VCL-2026",
          pageNumber: 2,
          pageSize: 10,
        }),
        expectEqual("hình dạng phân trang", [page.totalCount, page.pageNumber, page.totalPages], [14, 2, 2]),
        expectEqual("dòng đã chuẩn hoá", [page.items[0].orderId, page.items[0].status], [ORDER_ID, "PENDING_REVIEW"]),
      );
    },
  );

  await check("getConsignmentsApi: status ALL / rỗng thì không gửi tham số status", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: "/api/orders/consignments",
        reply: () => ok({ message: "ok", data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 10 } }),
      },
    ];
    await consignment.getConsignmentsApi({ status: "ALL" });
    return expectEqual("params", onlyRequest()?.params, {
      orderType: "CONSIGNMENT",
      pageNumber: 1,
      pageSize: 10,
    });
  });

  await check(
    "getConsignmentDetailApi: bóc { message, data }, giữ nguyên items[].services và packageConfiguration",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "GET",
          url: `/api/orders/consignments/${ORDER_ID}`,
          reply: () => ok({ message: "Lấy chi tiết yêu cầu ký gửi thành công.", data: ORDER_DETAIL }),
        },
      ];
      const detail = await consignment.getConsignmentDetailApi(ORDER_ID);
      return all(
        expectEqual("đã bóc data", Object.prototype.hasOwnProperty.call(detail, "message"), false),
        expectEqual("mã đơn", detail.consignmentCode, "VCL-20260917161921-540135"),
        expectEqual("dịch vụ theo kiện", detail.items?.[0]?.services?.[0]?.code, "SUR_INSPECTION"),
        expectEqual("thùng gỗ", detail.items?.[0]?.packageConfiguration?.configCode, "MEDIUM"),
        expectEqual("báo giá nháp đi kèm", detail.quotation?.status, "DRAFT"),
      );
    },
  );

  /* ---------- Đổi trạng thái ---------- */

  await check("updateConsignmentStatusApi: NEED_MORE_INFO kèm lý do → PUT .../status", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "PUT",
        url: `/api/orders/consignments/${ORDER_ID}/status`,
        reply: () =>
          ok({
            message: "Cập nhật trạng thái thành công.",
            status: "NEED_MORE_INFO",
            consignmentCode: ORDER_ROW.consignmentCode,
            receiptPdfUrl: null,
          }),
      },
    ];
    const result = await consignment.updateConsignmentStatusApi(ORDER_ID, {
      status: "NEED_MORE_INFO",
      rejectionReason: "Thiếu ảnh sản phẩm",
    });
    const req = onlyRequest();
    return all(
      expectEqual("body", req?.body, {
        status: "NEED_MORE_INFO",
        rejectionReason: "Thiếu ảnh sản phẩm",
      }),
      expectEqual("status trả về", result.status, "NEED_MORE_INFO"),
      expectEqual("nhãn tiếng Việt", result.statusDisplayName, "Cần bổ sung thông tin"),
    );
  });

  await check("updateConsignmentStatusApi: REJECTED cũng bắt buộc lý do", async () => {
    resetState({ token: "tok" });
    const { resolved, error } = await rejection(
      consignment.updateConsignmentStatusApi(ORDER_ID, { status: "REJECTED", rejectionReason: "" }),
    );
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("message", error?.message, "Vui lòng nhập lý do từ chối ít nhất 3 ký tự."),
      expectEqual("không gọi request nào", requests.length, 0),
    );
  });

  await check("updateConsignmentStatusApi: APPROVED bị chặn NGAY tại giao diện", async () => {
    resetState({ token: "tok" });
    const { resolved, error } = await rejection(
      consignment.updateConsignmentStatusApi(ORDER_ID, {
        status: "APPROVED",
        rejectionReason: "Duyệt đơn",
      }),
    );
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectTrue("nhắc bỏ bước duyệt đơn", String(error?.message).includes("bỏ bước duyệt đơn")),
      expectEqual("không gọi request nào", requests.length, 0),
    );
  });

  await check("approveConsignmentApi: đã ngừng dùng, ném lỗi rõ ràng chứ không gọi API", async () => {
    resetState({ token: "tok" });
    const { resolved, error } = await rejection(consignment.approveConsignmentApi(ORDER_ID));
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("code", error?.code, "API_NOT_WIRED"),
      expectEqual("không gọi request nào", requests.length, 0),
    );
  });

  /* ---------- Báo giá ---------- */

  await check(
    "sendQuotationApi: gửi đúng hợp đồng backend, có dòng sửa phí THEO KIỆN và overrideReason",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "POST",
          url: `/api/orders/${ORDER_ID}/quotation/send`,
          reply: () =>
            ok({
              message: "Đã gửi báo giá cho khách hàng.",
              status: "QUOTATION_SENT",
              consignment: { orderId: ORDER_ID, status: "QUOTATION_SENT" },
            }),
        },
      ];

      const result = await consignment.sendQuotationApi(ORDER_ID, {
        warehouseId: WAREHOUSE_ID,
        servicePricingId: SERVICE_PRICING_ID,
        serviceType: "EXPRESS",
        weightKg: 6.7,
        volumeM3: 0.036,
        packageCount: 1,
        declaredValue: 1500000,
        salesNote: "Báo giá theo cân nặng khai báo",
        overrideReason: "Giảm phí kiểm hàng cho khách quen",
        quotation: {
          additionalFees: [
            {
              feeId: "aaaa1111-2222-4333-8444-555566667777",
              label: "Phụ phí hàng cồng kềnh",
              amount: 50000,
              enabled: true,
            },
            {
              feeId: INSPECTION_RULE_ID,
              orderItemId: ITEM_ID,
              amount: 5000,
              enabled: true,
            },
          ],
        },
      });

      const body = onlyRequest()?.body;
      const fees = body?.quotation?.additionalFees ?? [];

      return all(
        expectEqual("endpoint", onlyRequest()?.url, `/api/orders/${ORDER_ID}/quotation/send`),
        expectEqual("warehouseId", body?.warehouseId, WAREHOUSE_ID),
        expectEqual("overrideReason", body?.overrideReason, "Giảm phí kiểm hàng cho khách quen"),
        expectEqual("phí cả đơn KHÔNG có orderItemId", "orderItemId" in fees[0], false),
        expectEqual("phí theo kiện có orderItemId + feeId", [fees[1]?.orderItemId, fees[1]?.feeId], [
          ITEM_ID,
          INSPECTION_RULE_ID,
        ]),
        expectEqual("vat/importTax null khi không ghi đè", [body?.quotation?.vat, body?.quotation?.importTax], [
          null,
          null,
        ]),
        expectEqual(
          "KHÔNG gửi lại tổng tiền tính ở client",
          ["totalEstimatedCost", "estimatedFreightCharge", "serviceFee"].some(
            (key) => key in (body?.quotation ?? {}),
          ),
          false,
        ),
        expectEqual("trả về status", result.status, "QUOTATION_SENT"),
      );
    },
  );

  await check("sendQuotationApi: enabled=false gửi amount 0 (miễn phí dịch vụ của kiện)", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "POST",
        url: `/api/orders/${ORDER_ID}/quotation/send`,
        reply: () => ok({ message: "ok", status: "PENDING_PRICE_APPROVAL", consignment: null }),
      },
    ];
    const result = await consignment.sendQuotationApi(ORDER_ID, {
      warehouseId: WAREHOUSE_ID,
      servicePricingId: SERVICE_PRICING_ID,
      serviceType: "EXPRESS",
      weightKg: 6.7,
      volumeM3: 0.036,
      packageCount: 1,
      overrideReason: "Miễn phí kiểm hàng theo cam kết",
      quotation: {
        additionalFees: [
          { feeId: INSPECTION_RULE_ID, orderItemId: ITEM_ID, amount: 0, enabled: false },
        ],
      },
    });
    const fee = onlyRequest()?.body?.quotation?.additionalFees?.[0];
    return all(
      expectEqual("enabled", fee?.enabled, false),
      expectEqual("amount", fee?.amount, 0),
      expectEqual(
        "status PENDING_PRICE_APPROVAL được trả nguyên cho màn hình",
        result.status,
        "PENDING_PRICE_APPROVAL",
      ),
    );
  });

  await check("sendQuotationApi: gửi vat/importTax khi Sale chốt tay", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "POST",
        url: `/api/orders/${ORDER_ID}/quotation/send`,
        reply: () => ok({ message: "ok", status: "PENDING_PRICE_APPROVAL", consignment: null }),
      },
    ];
    await consignment.sendQuotationApi(ORDER_ID, {
      warehouseId: WAREHOUSE_ID,
      servicePricingId: SERVICE_PRICING_ID,
      serviceType: "EXPRESS",
      weightKg: 6.7,
      volumeM3: 0.036,
      packageCount: 1,
      overrideReason: "Chốt thuế theo tờ khai",
      quotation: { additionalFees: [], vat: 90000, importTax: 30000 },
    });
    return expectEqual(
      "thuế đã chốt tay",
      [onlyRequest()?.body?.quotation?.vat, onlyRequest()?.body?.quotation?.importTax],
      [90000, 30000],
    );
  });

  await check(
    "sendQuotationApi: thiếu lý do giá ngoại lệ → backend 400, câu lỗi tiếng Việt giữ nguyên",
    async () => {
      resetState({ token: "tok" });
      const message =
        "Báo giá có giá ngoài bảng giá: Phụ phí kiểm hàng kiện Bình gốm 5.000đ (bảng giá: 10.000đ). Ghi lý do (overrideReason hoặc ghi chú Sales) để gửi Admin duyệt.";
      routes = [
        {
          method: "POST",
          url: `/api/orders/${ORDER_ID}/quotation/send`,
          reply: () => fail(400, { message }),
        },
      ];
      const { resolved, error } = await rejection(
        consignment.sendQuotationApi(ORDER_ID, {
          warehouseId: WAREHOUSE_ID,
          servicePricingId: SERVICE_PRICING_ID,
          serviceType: "EXPRESS",
          weightKg: 6.7,
          volumeM3: 0.036,
          packageCount: 1,
          quotation: {
            additionalFees: [
              { feeId: INSPECTION_RULE_ID, orderItemId: ITEM_ID, amount: 5000, enabled: true },
            ],
          },
        }),
      );
      return all(
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual("status", error?.response?.status, 400),
        expectEqual("message", error?.response?.data?.message, message),
      );
    },
  );

  await check("sendQuotationApi: thiếu kho → chặn trước khi gọi mạng", async () => {
    resetState({ token: "tok" });
    const { resolved, error } = await rejection(
      consignment.sendQuotationApi(ORDER_ID, {
        servicePricingId: SERVICE_PRICING_ID,
        serviceType: "EXPRESS",
        weightKg: 1,
        volumeM3: 1,
        packageCount: 1,
      }),
    );
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("message", error?.message, "Vui lòng chọn kho xử lý."),
      expectEqual("không gọi request nào", requests.length, 0),
    );
  });

  /* ---------- Đọc báo giá + duyệt giá ---------- */

  await check(
    "getOrderQuotationApi: bóc data, nhóm được phí theo kiện và tách phí cả đơn",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "GET",
          url: `/api/orders/${ORDER_ID}/quotation`,
          reply: () => ok({ message: "Lấy thông tin báo giá thành công.", data: DRAFT_QUOTATION }),
        },
      ];
      const detail = await quotation.getOrderQuotationApi(ORDER_ID);
      const groups = quotation.groupFeesByOrderItem(detail.additionalFees);
      const orderFees = quotation.getOrderLevelFees(detail.additionalFees);
      return all(
        expectEqual("status", detail.status, "DRAFT"),
        expectEqual("số nhóm kiện", groups.length, 1),
        expectEqual("tên kiện", groups[0].itemName, "Bình gốm"),
        expectEqual("tổng phí của kiện", groups[0].total, 35000),
        expectEqual("phí thùng gỗ không có feeId (không sửa được)", groups[0].fees[1].feeId, null),
        expectEqual("phí thùng: feeId = id dòng phí thì KHÔNG coi là quy tắc", groups[0].fees[1].pricingRuleId, null),
        expectEqual(
          "dịch vụ theo kiện: feeId là PRICING_RULES.id, không phải id dòng phí",
          [groups[0].fees[0].feeId, groups[0].fees[0].pricingRuleId],
          [INSPECTION_RULE_ID, INSPECTION_RULE_ID],
        ),
        expectEqual(
          "backend cũ thiếu pricingRuleId nhưng feeId khác id → vẫn giữ feeId",
          quotation.normalizeQuotationFee({ id: "line-9", feeId: INSPECTION_RULE_ID }).pricingRuleId,
          INSPECTION_RULE_ID,
        ),
        expectEqual("phí cả đơn", [orderFees.length, orderFees[0].amount], [1, 45000]),
      );
    },
  );

  await check("getOrderQuotationApi: 404 + allowMissing → trả null thay vì ném lỗi", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: `/api/orders/${ORDER_ID}/quotation`,
        reply: () => fail(404, { message: "Chưa có báo giá nào được tạo cho đơn hàng." }),
      },
    ];
    const withFlag = await quotation.getOrderQuotationApi(ORDER_ID, { allowMissing: true });
    const strict = await rejection(quotation.getOrderQuotationApi(ORDER_ID));
    return all(
      expectEqual("allowMissing → null", withFlag, null),
      expectEqual("không có cờ thì vẫn ném lỗi", strict.resolved, false),
    );
  });

  await check("getRequoteGuard: báo giá đã duyệt & gửi khách thì Sale không lập lại (cờ backend + suy luận dự phòng)", async () => {
    resetState({ token: "tok" });
    const blockedReason =
      "Báo giá đã được Admin duyệt và gửi khách — không lập lại được. Chỉ lập báo giá mới khi khách từ chối báo giá, báo giá hết hạn hoặc Admin từ chối giá ngoại lệ.";
    routes = [
      {
        method: "GET",
        url: `/api/orders/${ORDER_ID}/quotation`,
        reply: () =>
          ok({
            message: "Lấy thông tin báo giá thành công.",
            data: {
              ...DRAFT_QUOTATION,
              status: "PENDING",
              priceApprovalStatus: "APPROVED",
              canSalesRequote: false,
              requoteState: "APPROVED_SENT_TO_CUSTOMER",
              requoteBlockedReason: blockedReason,
            },
          }),
      },
    ];
    const detail = await quotation.getOrderQuotationApi(ORDER_ID);
    const fromApi = quotation.getRequoteGuard(detail);
    const now = Date.parse("2026-09-27T00:00:00Z");
    const guess = (q) => quotation.getRequoteGuard(q, { now });
    const future = "2026-10-01T00:00:00";
    const past = "2026-09-20T00:00:00";
    return all(
      expectEqual("cờ backend được giữ", [detail.canSalesRequote, detail.requoteState], [false, "APPROVED_SENT_TO_CUSTOMER"]),
      expectEqual("khoá theo cờ backend", [fromApi.allowed, fromApi.state, fromApi.reason, fromApi.fromBackend], [false, "APPROVED_SENT_TO_CUSTOMER", blockedReason, true]),
      expectEqual("khách không có cờ → null", quotation.normalizeQuotationDetail({ status: "PENDING" }).canSalesRequote, null),
      expectEqual("dự phòng: PENDING + APPROVED còn hạn → khoá", [guess({ status: "PENDING", priceApprovalStatus: "APPROVED", expiredAt: future }).allowed, guess({ status: "PENDING", priceApprovalStatus: "APPROVED", expiredAt: future }).state], [false, "APPROVED_SENT_TO_CUSTOMER"]),
      expectEqual("dự phòng: PENDING theo bảng giá còn hạn → khoá", guess({ status: "PENDING", priceApprovalStatus: "NOT_REQUIRED", expiredAt: future }).allowed, false),
      expectEqual("dự phòng: hết hạn → lập lại được", [guess({ status: "PENDING", expiredAt: past }).allowed, guess({ status: "PENDING", expiredAt: past }).state], [true, "EXPIRED"]),
      expectEqual("dự phòng: khách từ chối → lập lại được", guess({ status: "REJECTED" }).allowed, true),
      expectEqual("dự phòng: Admin từ chối giá → lập lại được", guess({ status: "PRICE_REJECTED" }).state, "PRICE_REJECTED"),
      expectEqual("dự phòng: chờ Admin duyệt → thay bản đang chờ", [guess({ status: "PENDING_PRICE_APPROVAL" }).allowed, guess({ status: "PENDING_PRICE_APPROVAL" }).label], [true, "Chờ Admin duyệt giá"]),
      expectEqual("dự phòng: khách đã chấp nhận → khoá", guess({ status: "ACCEPTED" }).allowed, false),
      expectEqual("chưa có báo giá → mở", quotation.getRequoteGuard(null).allowed, true),
    );
  });

  await check("price-approval: APPROVED không cần note; body đúng hợp đồng", async () => {
    resetState({ token: "tok-admin" });
    routes = [
      {
        method: "PUT",
        url: `/api/quotations/${QUOTATION_ID}/price-approval`,
        reply: () =>
          ok({
            message: "Đã duyệt giá ngoại lệ và gửi báo giá cho khách.",
            status: "PENDING",
            rejectionReason: null,
            consignment: { orderId: ORDER_ID, status: "QUOTATION_SENT" },
          }),
      },
    ];
    const result = await quotation.decideQuotationPriceApprovalApi(QUOTATION_ID, {
      decision: "approved",
      note: "",
    });
    return all(
      expectEqual("body", onlyRequest()?.body, { decision: "APPROVED", note: null }),
      expectEqual("status", result.status, "PENDING"),
      expectEqual("message", result.message, "Đã duyệt giá ngoại lệ và gửi báo giá cho khách."),
    );
  });

  await check("price-approval: REJECTED thiếu note bị chặn TRƯỚC khi gọi mạng", async () => {
    resetState({ token: "tok-admin" });
    const { resolved, error } = await rejection(
      quotation.decideQuotationPriceApprovalApi(QUOTATION_ID, { decision: "REJECTED" }),
    );
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("message", error?.message, "Từ chối giá ngoại lệ thì bắt buộc ghi lý do."),
      expectEqual("không gọi request nào", requests.length, 0),
    );
  });

  await check("price-approval: decision lạ bị chặn", async () => {
    resetState({ token: "tok-admin" });
    const { resolved, error } = await rejection(
      quotation.decideQuotationPriceApprovalApi(QUOTATION_ID, { decision: "MAYBE", note: "x" }),
    );
    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("message", error?.message, "Quyết định phải là APPROVED hoặc REJECTED."),
      expectEqual("không gọi request nào", requests.length, 0),
    );
  });

  await check(
    "hàng đợi duyệt giá: quét đơn theo trạng thái, giữ lại báo giá PENDING_PRICE_APPROVAL",
    async () => {
      resetState({ token: "tok-admin" });

      const pending = {
        ...DRAFT_QUOTATION,
        status: "PENDING_PRICE_APPROVAL",
        priceApprovalStatus: "PENDING",
        overrideReason: "Giảm phí kiểm hàng — Phụ phí kiểm hàng kiện Bình gốm 5.000đ (bảng giá: 10.000đ)",
      };

      const seenStatuses = [];
      const fetchOrders = async ({ status, pageNumber }) => {
        seenStatuses.push(status);
        return {
          items: pageNumber === 1 && status === "PENDING_REVIEW" ? [ORDER_ROW] : [],
          totalCount: 1,
          pageNumber,
          pageSize: 50,
          totalPages: 1,
        };
      };

      routes = [
        {
          method: "GET",
          url: `/api/orders/${ORDER_ID}/quotation`,
          reply: () => ok({ message: "ok", data: pending }),
        },
      ];

      const queue = await quotation.getPendingPriceApprovalQueueApi({ fetchOrders });

      return all(
        expectEqual("quét đủ 5 trạng thái", seenStatuses, [
          "PENDING_REVIEW",
          "NEED_MORE_INFO",
          "QUOTATION_SENT",
          "QUOTATION_REJECTED",
          "APPROVED",
        ]),
        expectEqual("chỉ đọc báo giá của đơn đã quét", requests.length, 1),
        expectEqual("số dòng chờ duyệt", queue.rows.length, 1),
        expectEqual("đơn kèm báo giá", queue.rows[0].order.consignmentCode, ORDER_ROW.consignmentCode),
        expectEqual("có lý do ngoại lệ để Admin đọc", Boolean(queue.rows[0].quotation.overrideReason), true),
        expectEqual("đếm đơn đã quét", queue.scannedOrders, 1),
      );
    },
  );

  /* ---------- Sale tạo đơn ký gửi HỘ KHÁCH ---------- */

  const STAFF_CUSTOMER_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

  const STAFF_ITEM = {
    productName: "Bình gốm",
    productType: "Đồ gốm",
    quantity: 2,
    weight: 2.5,
    width: 30,
    height: 20,
    length: 40,
    declaredValue: 1500000,
    referenceUrls: ["https://cdn.example.test/a.jpg"],
    domesticTrackingCode: "SPX123",
    packageConfigurationId: null,
  };

  const STAFF_PAYLOAD = {
    customerId: STAFF_CUSTOMER_ID,
    route: "CN_VN",
    shippingOption: "EXPRESS",
    receiverName: "Trần Thị B",
    receiverPhone: "0912345678",
    receiverAddress: "12 Lê Lợi, Bến Nghé, Quận 1, TP Hồ Chí Minh",
    defaultDestinationHandling: "DIRECT_DELIVERY",
    note: "Giao giờ hành chính",
    items: [STAFF_ITEM],
  };

  await check(
    "createConsignmentApi: POST /api/staff/consignments, body ĐÚNG CreateConsignmentByStaffRequest (không thừa khoá)",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "POST",
          url: "/api/staff/consignments",
          reply: () =>
            ok(
              {
                message: "Tạo yêu cầu ký gửi thay khách hàng thành công.",
                data: {
                  orderId: ORDER_ID,
                  consignmentCode: "VCL-20260922101500-110022",
                  customerId: STAFF_CUSTOMER_ID,
                  status: "APPROVED",
                  itemCount: 1,
                },
              },
              201,
            ),
        },
      ];

      /* Màn hình còn giữ vài khoá của luồng cũ; chúng KHÔNG được lọt vào body. */
      const result = await consignment.createConsignmentApi({
        ...STAFF_PAYLOAD,
        pricingRuleIds: [INSPECTION_RULE_ID],
        requiresInspection: true,
        requiresPacking: true,
        requiresWoodenCrate: false,
        requiresInsurance: true,
      });

      const req = onlyRequest();

      return all(
        expectEqual("endpoint", [req?.method, req?.url], ["POST", "/api/staff/consignments"]),
        expectEqual(
          "đúng bộ khoá của DTO",
          Object.keys(req?.body ?? {}).sort(),
          [
            "customerId",
            "defaultDestinationHandling",
            "items",
            "note",
            "receiverAddress",
            "receiverName",
            "receiverPhone",
            "route",
            "shippingOption",
          ],
        ),
        expectEqual("customerId đi đúng chỗ", req?.body?.customerId, STAFF_CUSTOMER_ID),
        expectEqual(
          "kiện hàng đúng khoá ConsignmentItemRequest",
          Object.keys(req?.body?.items?.[0] ?? {}).sort(),
          [
            "declaredValue",
            "domesticTrackingCode",
            "height",
            "length",
            "packageConfigurationId",
            "productName",
            "productType",
            "quantity",
            "referenceUrls",
            "weight",
            "width",
          ],
        ),
        expectEqual("đã bóc { message, data }", result?.consignmentCode, "VCL-20260922101500-110022"),
        expectEqual("đơn Sale tạo hộ vào thẳng APPROVED", result?.status, "APPROVED"),
      );
    },
  );

  /*
   * Lỗi thật đã gặp: Sale chọn "Thùng cỡ vừa" → toast "Kiện 1: packageConfigurationId
   * không đúng định dạng UUID." Id lấy từ GET /api/package-configurations là id SEED
   * 99999999-2222-2222-2222-222222222222 (không theo version/variant RFC 4122) và regex
   * cũ chặn nó ngay ở FE. Body phải mang đúng GUID đó; không chọn thùng → null.
   */
  const SEED_PACKAGE_CONFIGURATION_ID = "99999999-2222-2222-2222-222222222222";
  const GUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  await check(
    "createConsignmentApi + previewConsignmentApi: packageConfigurationId là GUID seed của thùng (không RFC 4122) vẫn đi nguyên trong body; trống → null",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "POST",
          url: "/api/staff/consignments/preview",
          reply: () => ok({ message: "Ước tính chi phí đơn ký gửi thành công.", data: { totalEstimatedCost: 1 } }),
        },
        {
          method: "POST",
          url: "/api/staff/consignments",
          reply: () =>
            ok(
              {
                message: "Tạo yêu cầu ký gửi thay khách hàng thành công.",
                data: { orderId: ORDER_ID, status: "APPROVED", itemCount: 2 },
              },
              201,
            ),
        },
      ];

      const payload = {
        ...STAFF_PAYLOAD,
        items: [
          { ...STAFF_ITEM, packageConfigurationId: ` ${SEED_PACKAGE_CONFIGURATION_ID} ` },
          { ...STAFF_ITEM, productName: "Không đóng thùng", packageConfigurationId: "" },
        ],
      };

      await consignment.previewConsignmentApi(payload);
      await consignment.createConsignmentApi(payload);

      const [previewReq, createReq] = requests;
      const sentIds = (req) => (req?.body?.items ?? []).map((item) => item.packageConfigurationId);

      return all(
        expectEqual("gọi preview rồi tạo", [previewReq?.url, createReq?.url], ["/api/staff/consignments/preview", "/api/staff/consignments"]),
        expectEqual("preview mang đúng GUID thùng, kiện không thùng = null", sentIds(previewReq), [SEED_PACKAGE_CONFIGURATION_ID, null]),
        expectEqual("tạo đơn mang đúng GUID thùng, kiện không thùng = null", sentIds(createReq), [SEED_PACKAGE_CONFIGURATION_ID, null]),
        expectEqual("giá trị gửi đi có dạng GUID", GUID_SHAPE.test(sentIds(createReq)[0] ?? ""), true),
      );
    },
  );

  await check(
    "createConsignmentApi: packageConfigurationId là mã thùng (MEDIUM) thay vì GUID → chặn tại FE, không gọi mạng",
    async () => {
      resetState({ token: "tok" });
      routes = [];

      const { resolved, error } = await rejection(
        consignment.createConsignmentApi({
          ...STAFF_PAYLOAD,
          items: [{ ...STAFF_ITEM, packageConfigurationId: "MEDIUM" }],
        }),
      );

      return all(
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual("câu lỗi", error?.message, "Kiện 1: packageConfigurationId không đúng định dạng UUID."),
        expectEqual("không gửi request nào", requests.length, 0),
      );
    },
  );

  await check(
    "createConsignmentApi: thiếu cả ba khoá tra khách → chặn tại FE, không gọi mạng",
    async () => {
      resetState({ token: "tok" });
      routes = [];

      const { resolved, error } = await rejection(
        consignment.createConsignmentApi({
          ...STAFF_PAYLOAD,
          customerId: "",
        }),
      );

      return all(
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual(
          "đúng câu của CustomerLookupHelper",
          error?.message,
          "Vui lòng chọn khách hàng có sẵn hoặc nhập email/số điện thoại để tìm kiếm.",
        ),
        expectEqual("không gửi request nào", requests.length, 0),
      );
    },
  );

  await check(
    "createConsignmentApi: 404 không tra ra khách → câu tiếng Việt của backend",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "POST",
          url: "/api/staff/consignments",
          reply: () =>
            fail(404, {
              message: `Không tìm thấy khách hàng với ID ${STAFF_CUSTOMER_ID}`,
            }),
        },
      ];

      const { resolved, error } = await rejection(
        consignment.createConsignmentApi(STAFF_PAYLOAD),
      );

      return all(
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual("status còn nguyên cho chỗ gọi", error?.response?.status, 404),
        expectEqual(
          "message hiện lên màn",
          error?.message,
          `Không tìm thấy khách hàng với ID ${STAFF_CUSTOMER_ID}`,
        ),
      );
    },
  );

  await check(
    "createConsignmentApi: 400 hàng cấm → giữ nguyên câu backend",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "POST",
          url: "/api/staff/consignments",
          reply: () =>
            fail(400, {
              message:
                "Không thể tạo ký gửi. Các mặt hàng sau thuộc danh mục cấm: Pin lithium",
            }),
        },
      ];

      const { resolved, error } = await rejection(
        consignment.createConsignmentApi(STAFF_PAYLOAD),
      );

      return all(
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual(
          "message",
          error?.message,
          "Không thể tạo ký gửi. Các mặt hàng sau thuộc danh mục cấm: Pin lithium",
        ),
      );
    },
  );

  await check(
    "validateConsignmentItemsApi: canCreate=false → ném lỗi kèm tên mặt hàng cấm",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "POST",
          url: "/api/orders/consignments/validate-items",
          reply: () =>
            ok({
              message: "Kiểm tra hàng hóa thành công.",
              data: {
                canCreate: false,
                results: [
                  {
                    productName: "Pin lithium",
                    level: "BANNED",
                    matchedItem: "Pin",
                    reason: "Hàng nguy hiểm",
                  },
                ],
              },
            }),
        },
      ];

      const { resolved, error } = await rejection(
        consignment.validateConsignmentItemsApi([STAFF_ITEM]),
      );

      const req = onlyRequest();

      return all(
        expectEqual("endpoint", [req?.method, req?.url], ["POST", "/api/orders/consignments/validate-items"]),
        expectEqual("body bọc { items }", Object.keys(req?.body ?? {}), ["items"]),
        expectEqual("phải ném lỗi", resolved, false),
        expectEqual(
          "message",
          error?.message,
          "Không thể tạo đơn: các mặt hàng sau thuộc danh mục cấm — Pin lithium.",
        ),
      );
    },
  );

  await check(
    "validateConsignmentItemsApi: chỉ có hàng hạn chế → vẫn cho tạo, trả warnings",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "POST",
          url: "/api/orders/consignments/validate-items",
          reply: () =>
            ok({
              message: "Kiểm tra hàng hóa thành công.",
              data: {
                canCreate: true,
                results: [
                  { productName: "Bình gốm", level: "RESTRICTED", matchedItem: "Gốm sứ" },
                ],
              },
            }),
        },
      ];

      const result = await consignment.validateConsignmentItemsApi([STAFF_ITEM]);

      return all(
        expectEqual("canCreate", result.canCreate, true),
        expectEqual("giữ cảnh báo", result.warnings?.[0]?.level, "RESTRICTED"),
      );
    },
  );

  await check(
    "searchCustomersApi: GET /api/customers?search=, bóc { items }, bỏ bản ghi thiếu id",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "GET",
          url: "/api/customers",
          reply: () =>
            ok({
              items: [
                {
                  id: STAFF_CUSTOMER_ID,
                  customerCode: "KH-0007",
                  fullName: "Nguyễn Văn A",
                  email: "a@example.test",
                  phone: "0900000000",
                  address: "Hà Nội",
                  status: "ACTIVE",
                },
                { fullName: "Bản ghi hỏng, không có id" },
              ],
            }),
        },
      ];

      const rows = await customerLookup.searchCustomersApi({ search: " nguyen " });
      const req = onlyRequest();

      return all(
        expectEqual("endpoint", [req?.method, req?.url], ["GET", "/api/customers"]),
        expectEqual("từ khoá đã trim", req?.params, { search: "nguyen" }),
        expectEqual("bỏ bản ghi thiếu id", rows.length, 1),
        expectEqual(
          "đủ ba thông tin cho thẻ ghim",
          [rows[0].fullName, rows[0].phone, rows[0].email],
          ["Nguyễn Văn A", "0900000000", "a@example.test"],
        ),
        expectEqual("id chính là Customer.Id", rows[0].id, STAFF_CUSTOMER_ID),
      );
    },
  );

  await check(
    "getCustomerDeliveryAddressesApi: sổ địa chỉ theo KHÁCH, không phải theo tài khoản Sale",
    async () => {
      resetState({ token: "tok" });
      routes = [
        {
          method: "GET",
          url: `/api/customers/${STAFF_CUSTOMER_ID}/delivery-addresses`,
          reply: () =>
            ok({
              message: "Lấy sổ địa chỉ của khách hàng thành công.",
              data: [
                { id: "aaaaaaaa-1111-4111-8111-111111111111", address: "12 Lê Lợi, Quận 1", isDefault: true },
              ],
            }),
        },
      ];

      const rows = await customerLookup.getCustomerDeliveryAddressesApi(
        STAFF_CUSTOMER_ID,
      );

      return all(
        expectEqual(
          "endpoint",
          onlyRequest()?.url,
          `/api/customers/${STAFF_CUSTOMER_ID}/delivery-addresses`,
        ),
        expectEqual("KHÔNG gọi /api/delivery-addresses", requests.length, 1),
        expectEqual("đã bóc { message, data }", rows.length, 1),
        expectEqual("địa chỉ", rows[0].address, "12 Lê Lợi, Quận 1"),
      );
    },
  );

  await check("getCustomerDeliveryAddressesApi: id sai khuôn → chặn trước khi gọi", async () => {
    resetState({ token: "tok" });
    routes = [];

    const { resolved, error } = await rejection(
      customerLookup.getCustomerDeliveryAddressesApi("khong-phai-uuid"),
    );

    return all(
      expectEqual("phải ném lỗi", resolved, false),
      expectEqual("message", error?.message, "Mã khách hàng không đúng định dạng UUID."),
      expectEqual("không gửi request nào", requests.length, 0),
    );
  });

  /* ---------- Danh mục ---------- */

  await check("warehouses/active: bọc { items }, chỉ giữ kho ORIGIN đang hoạt động", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: "/api/warehouses/active",
        reply: () =>
          ok({
            items: [
              {
                id: WAREHOUSE_ID,
                name: "Kho Quảng Châu",
                code: "CN_WH",
                address: "Quảng Châu, Trung Quốc",
                contactPhone: "+86 20 8888 6666",
                region: "CN",
                regionCode: "CN",
                warehouseType: "ORIGIN",
                isActive: true,
              },
              {
                id: "DF34760C-0C3E-48AD-BDD6-3A30A4EC402A",
                name: "Kho HCM - Tân Bình",
                code: "VN_WH",
                address: "Tân Bình, TP.HCM",
                region: "VN",
                warehouseType: "DESTINATION",
                isActive: true,
              },
              {
                id: "00000000-0000-4000-8000-000000000000",
                name: "Kho Seoul (ngưng)",
                code: "KR_WH",
                region: "KR",
                warehouseType: "ORIGIN",
                isActive: false,
              },
            ],
          }),
      },
    ];
    const origins = await warehouse.getOriginWarehousesApi();
    return all(
      expectEqual("chỉ 1 kho ORIGIN đang hoạt động", origins.length, 1),
      expectEqual("mảng TRẦN đã chuẩn hoá", [origins[0].id, origins[0].warehouseType], [WAREHOUSE_ID, "ORIGIN"]),
      expectEqual("giữ region để dò theo tuyến", [origins[0].region, origins[0].regionCode], ["CN", "CN"]),
    );
  });

  await check("service-pricings: MẢNG TRẦN, lọc lại theo tuyến + phương án tại chỗ", async () => {
    resetState({ token: "tok" });
    /* Backend trả MẢNG TRẦN cho /api/service-pricings. */
    routes = [
      {
        method: "GET",
        url: "/api/service-pricings",
        reply: () =>
          ok([
            {
              id: SERVICE_PRICING_ID,
              serviceType: "Express",
              originCountry: "CN",
              destinationCountry: "VN",
              unitType: "KG",
              price: 10000,
              currency: "VND",
              effectiveDate: "2026-09-01T00:00:00Z",
            },
            {
              id: "0d1e2f30-4152-4364-8576-98a7b6c5d4e3",
              serviceType: "Standard",
              originCountry: "KR",
              destinationCountry: "VN",
              unitType: "KG",
              price: 8000,
              currency: "VND",
            },
          ]),
      },
    ];

    const all_ = await servicePricing.getServicePricingsApi();
    const matched = servicePricing.findMatchingServicePricing(all_, {
      serviceType: "EXPRESS",
      originCountry: "CN",
      destinationCountry: "VN",
    });
    return all(
      expectEqual("số dòng", all_.length, 2),
      expectEqual("đã chuẩn hoá hoa/thường", all_[0].serviceType, "EXPRESS"),
      expectEqual("khớp đúng tuyến + phương án", matched?.id, SERVICE_PRICING_ID),
    );
  });

  await check("pricing-rules: MẢNG TRẦN, luôn gửi orderType khi màn báo giá yêu cầu", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: "/api/pricing-rules",
        reply: () =>
          ok([
            {
              id: INSPECTION_RULE_ID,
              ruleName: "Phụ phí kiểm hàng",
              ruleCode: "SUR_INSPECTION",
              ruleType: "SURCHARGE",
              calculationType: "FIXED",
              value: 10000,
              isRequired: false,
              status: "ACTIVE",
            },
            {
              id: "bbbb2222-3333-4444-8555-666677778888",
              ruleName: "Hệ số quy đổi thể tích",
              ruleCode: "VOLUMETRIC_DIVISOR",
              ruleType: "SYSTEM",
              calculationType: "FIXED",
              value: 5000,
              isRequired: true,
              status: "INACTIVE",
            },
          ]),
      },
    ];
    const rules = await pricingRule.getActivePricingRulesApi({ orderType: "CONSIGNMENT" });
    return all(
      expectEqual("params", onlyRequest()?.params, { orderType: "CONSIGNMENT" }),
      expectEqual("chỉ rule ACTIVE", rules.length, 1),
      expectEqual("đã chuẩn hoá", [rules[0].ruleCode, rules[0].value], ["SUR_INSPECTION", 10000]),
    );
  });

  /*
   * Tham số vận hành nằm ở HAI bảng và backend đọc mỗi mã từ đúng một bảng. Kiểm thử này
   * giữ đúng điều đó: ghi nhầm bảng thì số trên màn hình đổi mà hệ thống vẫn chạy như cũ,
   * và không có lỗi nào nổi lên để ai đó phát hiện.
   */
  await check("Tham số vận hành: đọc cả hai bảng, ghi vào ĐÚNG bảng của từng mã", async () => {
    const FEE_ID = "cccc1111-2222-4333-8444-555566667777";
    const RULE_ID = "dddd1111-2222-4333-8444-555566667777";

    resetState({ token: "tok", pathname: "/admin/system-parameters" });
    routes = [
      {
        method: "GET",
        url: "/api/additional-service-fees",
        reply: () =>
          ok([
            {
              id: FEE_ID,
              feeName: "Tỷ lệ cọc đơn ký gửi",
              feeCode: "DEPOSIT_RATE",
              calculationType: "PERCENTAGE",
              value: 50,
              unit: "%",
              isActive: true,
            },
          ]),
      },
      {
        method: "GET",
        url: "/api/pricing-rules",
        reply: () =>
          ok([
            {
              id: RULE_ID,
              ruleName: "Hệ số quy đổi thể tích",
              ruleCode: "VOLUMETRIC_DIVISOR",
              ruleType: "VOLUMETRIC_DIVISOR",
              calculationType: "FIXED",
              value: 5000,
              status: "ACTIVE",
            },
          ]),
      },
      { method: "PUT", url: `/api/additional-service-fees/${FEE_ID}`, reply: () => ok({ id: FEE_ID }) },
      { method: "PUT", url: `/api/pricing-rules/${RULE_ID}`, reply: () => ok({ id: RULE_ID }) },
      { method: "POST", url: "/api/additional-service-fees", reply: () => ok({ id: "moi" }, 201) },
    ];

    const records = await systemParameter.getSystemParametersApi();

    const depositDef = { code: "DEPOSIT_RATE", source: systemParameter.SOURCE_FEE, label: "Tỷ lệ cọc", calculationType: "PERCENTAGE", unit: "%" };
    const divisorDef = { code: "VOLUMETRIC_DIVISOR", source: systemParameter.SOURCE_RULE, label: "Hệ số quy đổi" };
    const cancelDef = { code: "PURCHASE_CANCEL_FEE_RATE", source: systemParameter.SOURCE_FEE, label: "Phí huỷ", calculationType: "PERCENTAGE", unit: "%" };

    const deposit = systemParameter.findParameterRecord(records, depositDef);
    const divisor = systemParameter.findParameterRecord(records, divisorDef);
    const cancel = systemParameter.findParameterRecord(records, cancelDef);

    requests = [];
    await systemParameter.saveSystemParameterApi({ definition: depositDef, record: deposit, value: 40 });
    const depositReq = onlyRequest();

    requests = [];
    await systemParameter.saveSystemParameterApi({ definition: divisorDef, record: divisor, value: 6000 });
    const divisorReq = onlyRequest();

    /* Mã chưa có dòng nào: lần lưu đầu phải TẠO, không phải sửa. */
    requests = [];
    await systemParameter.saveSystemParameterApi({ definition: cancelDef, record: cancel, value: 10 });
    const createReq = onlyRequest();

    let refusedNegative = false;
    try {
      await systemParameter.saveSystemParameterApi({ definition: depositDef, record: deposit, value: -1 });
    } catch {
      refusedNegative = true;
    }

    return all(
      expectEqual("đọc đủ hai nguồn", records.length, 2),
      expectEqual("mã ở bảng phí không lẫn sang bảng quy tắc", [deposit?.source, divisor?.source], ["fee", "rule"]),
      expectEqual("mã chưa cấu hình trả null", cancel, null),
      expectEqual("sửa DEPOSIT_RATE → PUT bảng phí", [depositReq?.method, depositReq?.url], ["PUT", `/api/additional-service-fees/${FEE_ID}`]),
      expectEqual("giữ nguyên mã và cách tính khi ghi", [depositReq?.body?.feeCode, depositReq?.body?.calculationType, depositReq?.body?.value], ["DEPOSIT_RATE", "PERCENTAGE", 40]),
      expectEqual("sửa VOLUMETRIC_DIVISOR → PUT bảng quy tắc", [divisorReq?.method, divisorReq?.url], ["PUT", `/api/pricing-rules/${RULE_ID}`]),
      expectEqual("PUT quy tắc gửi đủ trường bắt buộc", [divisorReq?.body?.ruleCode, divisorReq?.body?.ruleType, divisorReq?.body?.status, divisorReq?.body?.value], ["VOLUMETRIC_DIVISOR", "VOLUMETRIC_DIVISOR", "ACTIVE", 6000]),
      expectEqual("mã chưa có dòng → POST tạo mới", [createReq?.method, createReq?.url, createReq?.body?.feeCode], ["POST", "/api/additional-service-fees", "PURCHASE_CANCEL_FEE_RATE"]),
      expectEqual("giá trị âm bị chặn tại chỗ", refusedNegative, true),
    );
  });

  /* ---------- Giới hạn tạo đơn do Admin cấu hình ---------- */

  const ORDER_LIMIT_ITEMS = [
    { key: "ORDER_MAX_TOTAL_WEIGHT_KG", scope: "CONSIGNMENT", label: "Tổng cân nặng tối đa của đơn ký gửi", unit: "kg", value: 5, defaultValue: 5, allowUnlimited: true, isInteger: false, minValue: 0.01, maxValue: 100000, updatedAt: "2026-09-30T08:00:00Z", updatedByName: "Admin A" },
    { key: "ORDER_MAX_PACKAGES", scope: "CONSIGNMENT", label: "Số kiện tối đa của một đơn ký gửi", unit: "kiện", value: 50, defaultValue: 50, allowUnlimited: false, isInteger: true, minValue: 1, maxValue: 500 },
    { key: "PURCHASE_MAX_ITEM_QUANTITY", scope: "PURCHASE", label: "Số lượng tối đa mỗi sản phẩm mua hộ", unit: "cái", value: 999, defaultValue: 999, allowUnlimited: true, isInteger: true, minValue: 1, maxValue: 1000000 },
  ];
  const orderLimitsBody = (overrides = {}) => ({
    message: "Lấy cấu hình giới hạn đơn hàng thành công.",
    data: {
      consignment: { maxParcelWeightKg: 3, maxParcelLengthCm: 100, maxParcelWidthCm: 200, maxParcelHeightCm: 50, maxParcelQuantity: 5, maxItemDeclaredValue: 6000000, maxTotalWeightKg: 5, maxTotalDeclaredValue: 10000000, maxPackages: 50, ...overrides },
      purchase: { maxItems: 50, maxItemQuantity: 999 },
      items: ORDER_LIMIT_ITEMS,
      updatedAt: "2026-09-30T08:00:00Z",
      updatedByName: "Admin A",
    },
  });

  await check("Giới hạn tạo đơn: form Sale đọc GET /api/system-settings/order-limits, null = không giới hạn", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "GET", url: "/api/system-settings/order-limits", reply: () => ok(orderLimitsBody({ maxTotalWeightKg: null })) }];
    const got = await orderLimits.getOrderLimitsApi();
    return all(
      expectEqual("GET đúng endpoint + token", [onlyRequest()?.method, onlyRequest()?.url, onlyRequest()?.authorization], ["GET", "/api/system-settings/order-limits", "Bearer tok"]),
      expectEqual("đã tải", got.loaded, true),
      expectEqual("ký gửi", [got.consignment.maxTotalWeightKg, got.consignment.maxTotalDeclaredValue, got.consignment.maxParcelWeightKg], [null, 10000000, 3]),
      expectEqual("mua hộ", [got.purchase.maxItems, got.purchase.maxItemQuantity], [50, 999]),
    );
  });

  await check("Giới hạn tạo đơn: tải lỗi → form Sale không chặn bằng số cũ (backend kiểm)", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "GET", url: "/api/system-settings/order-limits", reply: () => fail(500, { message: "Lỗi" }) }];
    const got = await orderLimits.getOrderLimitsApi();
    const heavy = [{ weight: "40", declaredValue: "90000000" }];
    return all(
      expectEqual("loaded = false", got.loaded, false),
      expectEqual("tổng đơn không bị chặn", consignmentOrderHelpers.getOrderTotalsError(heavy, got.consignment), ""),
      expectEqual("cân 1 kiện không bị chặn", consignmentOrderHelpers.validatePackageField("weight", { weight: "40" }, got.consignment), ""),
      expectEqual("số lượng mua hộ không bị chặn", buyOrderHelpers.getPurchaseQuantityRangeMessage(got.purchase), "Số lượng phải là số nguyên từ 1 trở lên."),
    );
  });

  await check("Giới hạn tạo đơn: form Sale kiểm theo số Admin đặt (8 kg / 4 kg / 20tr / SL 3)", async () => {
    const limits = { ...orderLimits.NO_ORDER_LIMITS.consignment, maxTotalWeightKg: 8, maxParcelWeightKg: 4, maxTotalDeclaredValue: 20000000, maxPackages: 50 };
    const seven = [{ weight: "3.5", declaredValue: "1" }, { weight: "3.5", declaredValue: "1" }];
    const nine = [{ weight: "3", declaredValue: "1" }, { weight: "3", declaredValue: "1" }, { weight: "3", declaredValue: "1" }];
    const rich = new Array(4).fill({ weight: "1", declaredValue: "6000000" });
    const item = { productLink: "https://shop.example/a", sourceWebsite: "shop", productType: "x", productName: "a", quantity: "4", attributes: "đỏ", note: "", images: [] };
    return all(
      expectEqual("7 kg ≤ 8 → không lỗi (trước đây trần 5 kg)", consignmentOrderHelpers.getOrderTotalsError(seven, limits), ""),
      expectTrue("9 kg > 8 → lỗi nêu 8 kg", consignmentOrderHelpers.getOrderTotalsError(nine, limits).includes("8 kg")),
      expectTrue("24tr > 20tr → lỗi nêu 20.000.000 đ", consignmentOrderHelpers.getOrderTotalsError(rich, limits).includes("20.000.000 đ")),
      expectTrue("51 kiện → lỗi nêu 50", consignmentOrderHelpers.getOrderTotalsError(new Array(51).fill({}), limits).includes("50")),
      expectTrue("kiện 4,5 kg > 4 → lỗi nêu 4 kg", consignmentOrderHelpers.validatePackageField("weight", { weight: "4.5" }, limits).includes("4 kg")),
      expectEqual("kiện 4 kg → không lỗi", consignmentOrderHelpers.validatePackageField("weight", { weight: "4" }, limits), ""),
      expectTrue("mua hộ SL 4 > 3 → lỗi", String(buyOrderHelpers.validateItem(item, { maxItems: 50, maxItemQuantity: 3 }).quantity).includes("3")),
      expectEqual("mua hộ SL 3 → không lỗi", buyOrderHelpers.validateItem({ ...item, quantity: "3" }, { maxItems: 50, maxItemQuantity: 3 }).quantity ?? "", ""),
    );
  });

  await check("Giới hạn tạo đơn (Admin): đọc đủ nhãn/đơn vị/người sửa; PUT { items:[{key,value}], note }; nhật ký", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/system-settings/order-limits", reply: () => ok(orderLimitsBody()) },
      {
        method: "PUT",
        url: "/api/system-settings/order-limits",
        reply: (req) => ok({ message: "Đã cập nhật giới hạn đơn hàng.", data: { ...orderLimitsBody().data, items: ORDER_LIMIT_ITEMS.map((i) => (i.key === req.body.items[0].key ? { ...i, value: req.body.items[0].value } : i)) } }),
      },
      {
        method: "GET",
        url: "/api/system-settings/order-limits/history",
        reply: () => ok({ message: "ok", data: [{ id: "h1", key: "ORDER_MAX_TOTAL_WEIGHT_KG", label: "Tổng cân nặng", unit: "kg", oldValue: 5, newValue: null, changedAt: "2026-09-30T08:00:00Z", changedByName: "Admin A", note: "Tết" }] }),
      },
    ];
    const settings = await orderLimits.getOrderLimitSettingsApi();
    requests = [];
    const saved = await orderLimits.updateOrderLimitSettingsApi({ ORDER_MAX_TOTAL_WEIGHT_KG: null }, "  Mùa cao điểm ");
    const put = onlyRequest();
    requests = [];
    const history = await orderLimits.getOrderLimitHistoryApi(10);
    const histReq = onlyRequest();
    return all(
      expectEqual("đọc 3 dòng + người sửa", [settings.items.length, settings.items[0].updatedByName, settings.updatedByName], [3, "Admin A", "Admin A"]),
      expectEqual("PUT body", [put?.method, put?.url, JSON.stringify(put?.body)], ["PUT", "/api/system-settings/order-limits", JSON.stringify({ items: [{ key: "ORDER_MAX_TOTAL_WEIGHT_KG", value: null }], note: "Mùa cao điểm" })]),
      expectEqual("sau lưu: không giới hạn", saved.items.find((i) => i.key === "ORDER_MAX_TOTAL_WEIGHT_KG")?.value, null),
      expectEqual("nhật ký: take + null→không giới hạn", [histReq?.params?.take, history[0]?.newValue, history[0]?.changedByName], [10, null, "Admin A"]),
    );
  });

  await check("Giới hạn tạo đơn (Admin): 403 / 400 → câu tiếng Việt của backend", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "PUT", url: "/api/system-settings/order-limits", reply: () => fail(400, { message: "\"Số kiện tối đa của một đơn ký gửi\" bắt buộc phải có giới hạn." }) }];
    let message = "";
    try {
      await orderLimits.updateOrderLimitSettingsApi({ ORDER_MAX_PACKAGES: null });
    } catch (error) {
      message = orderLimits.getOrderLimitsApiError(error);
    }
    return expectTrue("hiện đúng câu backend", message.includes("bắt buộc phải có giới hạn"));
  });

  await check("Giới hạn tạo đơn (Admin): kiểm ô nhập cùng luật backend", () => {
    const { validateOrderLimitDraft, parseDraftNumber, formatOrderLimit } = orderLimitsSection;
    const weight = ORDER_LIMIT_ITEMS[0];
    const packages = ORDER_LIMIT_ITEMS[1];
    return all(
      expectEqual("đọc 10.000.000 / 2,5", [parseDraftNumber("10.000.000"), parseDraftNumber("2,5"), parseDraftNumber("")], [10000000, 2.5, ""]),
      expectEqual("2,5 kg hợp lệ", validateOrderLimitDraft(weight, { text: "2,5", unlimited: false }), ""),
      expectEqual("2,55 kg hợp lệ (không lỗi làm tròn)", validateOrderLimitDraft(weight, { text: "2,55", unlimited: false }), ""),
      expectTrue("0 → lỗi", validateOrderLimitDraft(weight, { text: "0", unlimited: false }) !== ""),
      expectTrue("âm/chữ → lỗi", validateOrderLimitDraft(weight, { text: "-3", unlimited: false }) !== ""),
      expectEqual("không giới hạn được phép", validateOrderLimitDraft(weight, { text: "", unlimited: true }), ""),
      expectTrue("số kiện không được bỏ giới hạn", validateOrderLimitDraft(packages, { text: "", unlimited: true }) !== ""),
      expectTrue("số kiện lẻ → lỗi", validateOrderLimitDraft(packages, { text: "2,5", unlimited: false }) !== ""),
      expectTrue("số kiện > 500 → lỗi", validateOrderLimitDraft(packages, { text: "501", unlimited: false }) !== ""),
      expectEqual("hiển thị", [formatOrderLimit(10000000, "đ"), formatOrderLimit(2.5, "kg"), formatOrderLimit(null, "kg")], ["10.000.000 đ", "2,5 kg", "Không giới hạn"]),
    );
  });

  await check("package-configurations: MẢNG TRẦN, lọc ACTIVE", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: "/api/package-configurations",
        reply: () =>
          ok([
            {
              id: "99999999-2222-2222-2222-222222222222",
              configCode: "MEDIUM",
              configName: "Thùng gỗ vừa",
              length: 60,
              width: 40,
              height: 40,
              maxWeight: 20,
              packageFee: 25000,
              status: "ACTIVE",
            },
            {
              id: "99999999-9999-9999-9999-999999999999",
              configCode: "OLD",
              configName: "Thùng cũ",
              packageFee: 1000,
              status: "INACTIVE",
            },
          ]),
      },
    ];
    const configs = await packageConfig.getActivePackageConfigurationsApi();
    return all(
      expectEqual("chỉ ACTIVE", configs.length, 1),
      expectEqual("mã thùng", configs[0].configCode, "MEDIUM"),
    );
  });

  await check("product-types: bọc { message, data }, trả mảng { id, name }", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: "/api/product-types",
        reply: () =>
          ok({
            message: "ok",
            data: [
              { id: "11111111-0000-0000-0000-000000000001", name: "Điện tử" },
              { id: "", name: "Thiếu id" },
            ],
          }),
      },
    ];
    const types = await master.getProductTypesApi();
    return all(
      expectEqual("bỏ bản ghi thiếu id", types.length, 1),
      expectEqual("bản ghi", [types[0].id, types[0].name], [
        "11111111-0000-0000-0000-000000000001",
        "Điện tử",
      ]),
    );
  });

  await check("routes / shipping-options: mảng CHUỖI được gói thành { value, label }", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: "/api/orders/consignments/routes",
        reply: () => ok({ message: "ok", data: ["Trung quốc --> Việt Nam", "Hàn Quốc --> Việt Nam"] }),
      },
      {
        method: "GET",
        url: "/api/orders/consignments/shipping-options",
        reply: () => ok({ message: "ok", data: ["Express", "Standard"] }),
      },
    ];
    const routeRows = await master.getConsignmentRoutesApi();
    const optionRows = await master.getConsignmentShippingOptionsApi({ route: "CN-VN" });
    return all(
      expectEqual("tuyến", [routeRows[0].value, routeRows[0].label], [
        "Trung quốc --> Việt Nam",
        "Trung quốc --> Việt Nam",
      ]),
      expectEqual("phương án có nhãn tiếng Việt", [optionRows[0].value, optionRows[0].label], [
        "Express",
        "Hỏa tốc",
      ]),
      expectEqual("gửi kèm route", requests[1]?.params, { route: "CN-VN" }),
    );
  });

  /* ---------- Đợt 3: phiếu nhập kho (quản lý kho duyệt) ---------- */

  const NOTE_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";
  const PAYMENT_ID = "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a";
  const MANAGER_ID = "e3f4a5b6-c7d8-4e9f-8a1b-2c3d4e5f6a7b";

  await check("Phiếu nhập kho: danh sách gửi status/search/pageSize≤200; tab \"Cần quyết định\" bỏ status và lọc awaitingApproval", async () => {
    resetState({ token: "tok" });
    const rows = [
      { id: NOTE_ID, receivingNoteCode: "WRN-1", status: "PENDING_APPROVAL", awaitingApproval: true, approvalStage: "RECEIVE" },
      { id: "n2", receivingNoteCode: "WRN-2", status: "RECEIVED", awaitingApproval: true, approvalStage: "DISCREPANCY" },
      { id: "n3", receivingNoteCode: "WRN-3", status: "ACTIVE", awaitingApproval: false },
    ];
    routes = [{ method: "GET", url: "/api/warehouse-receiving-notes", reply: (req) => ok({ message: "ok", data: { items: req.params.status ? rows.slice(0, 1) : rows, totalCount: 3, pageNumber: 1, pageSize: 200, totalPages: 1 } }) }];
    const byStatus = await receivingNotes.listReceivingNotes({ status: "PENDING_APPROVAL", search: " WRN " });
    const awaiting = await receivingNotes.listReceivingNotes({ status: receivingNotes.AWAITING_TAB_KEY });
    return all(
      expectEqual("params theo status", requests[0]?.params, { status: "PENDING_APPROVAL", search: "WRN", pageNumber: 1, pageSize: 200 }),
      expectEqual("kết quả theo status", [byStatus.items.length, byStatus.totalCount], [1, 3]),
      expectEqual("tab cần quyết định không gửi status", "status" in (requests[1]?.params || {}), false),
      expectEqual("chỉ phiếu chờ quyết định", awaiting.items.map((r) => r.approvalStage), ["RECEIVE", "DISCREPANCY"]),
      expectEqual("nhãn giai đoạn", receivingNotes.getApprovalStageMeta("discrepancy")?.label, "Xem chênh lệch"),
    );
  });

  await check("Phiếu nhập kho: bước DISCREPANCY_ACK (lệch cân đã tự chốt) vào tab \"Cần quyết định\", chỉ cho chấp nhận; số đếm đầu trang tính trên mọi phiếu", async () => {
    resetState({ token: "tok" });
    const rows = [
      { id: "a1", status: "APPROVED", awaitingApproval: true, approvalStage: "DISCREPANCY_ACK", hasDiscrepancy: true },
      { id: "a2", status: "RECEIVED", awaitingApproval: true, approvalStage: "DISCREPANCY", hasDiscrepancy: true },
      { id: "a3", status: "PENDING_APPROVAL", awaitingApproval: true, approvalStage: "RECEIVE", hasDiscrepancy: false },
      { id: "a4", status: "APPROVED", awaitingApproval: false, approvalStage: null, hasDiscrepancy: true },
    ];
    routes = [{ method: "GET", url: "/api/warehouse-receiving-notes", reply: () => ok({ message: "ok", data: { items: rows, totalCount: 4, pageNumber: 1, pageSize: 200, totalPages: 1 } }) }];
    const awaiting = await receivingNotes.listReceivingNotes({ status: receivingNotes.AWAITING_TAB_KEY });
    const summary = await receivingNotes.getReceivingSummary({ search: " WRN " });
    return all(
      expectEqual("tab cần quyết định có phiếu lệch cân", awaiting.items.map((r) => r.id), ["a1", "a2", "a3"]),
      expectEqual("summary không gửi status", requests[1]?.params, { search: "WRN", pageNumber: 1, pageSize: 200 }),
      expectEqual("số đếm", summary, { awaiting: 3, discrepancyAwaiting: 2, discrepancy: 3 }),
      expectEqual("nhãn giai đoạn lệch cân", receivingNotes.getApprovalStageMeta("discrepancy_ack")?.label, "Quyết định lệch cân"),
      expectEqual("bước lệch", ["DISCREPANCY", "DISCREPANCY_ACK", "RECEIVE"].map(receivingNotes.isDiscrepancyStage), [true, true, false]),
      expectEqual("được từ chối", ["DISCREPANCY", "DISCREPANCY_ACK", "RECEIVE"].map(receivingNotes.canRejectAtStage), [true, false, true]),
    );
  });

  await check("Phiếu nhập kho: duyệt PUT /status { APPROVED, reason }; không lý do thì không gửi reason; từ chối thiếu lý do chặn tại chỗ", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "PUT", url: `/api/warehouse-receiving-notes/${NOTE_ID}/status`, reply: (req) => ok({ message: "ok", data: { id: NOTE_ID, status: req.body.status === "APPROVED" ? "ACTIVE" : "REJECTED" } }) }];
    const approved = await receivingNotes.approveReceivingNote(NOTE_ID, "  Admin duyệt thay  ");
    await receivingNotes.approveReceivingNote(NOTE_ID);
    await receivingNotes.rejectReceivingNote(NOTE_ID, "Sai kho");
    const before = requests.length;
    const { resolved } = await rejection(receivingNotes.rejectReceivingNote(NOTE_ID, "  "));
    return all(
      expectEqual("body duyệt có lý do", requests[0]?.body, { status: "APPROVED", reason: "Admin duyệt thay" }),
      expectEqual("body duyệt không lý do", requests[1]?.body, { status: "APPROVED" }),
      expectEqual("body từ chối", requests[2]?.body, { status: "REJECTED", rejectionReason: "Sai kho" }),
      expectEqual("bóc data", approved?.status, "ACTIVE"),
      expectEqual("từ chối rỗng không gọi mạng", [resolved, requests.length], [false, before]),
    );
  });

  await check("Sale lập phiếu: GET action-queue bóc data.items (việc bấm được lên đầu); POST phiếu đọc khoá receivingNote; thiếu kho chặn tại chỗ", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/orders/action-queue", reply: () => ok({ message: "ok", data: { items: [
        { orderId: "o2", handlingGroup: "DIRECT_DELIVERY", canAct: false, arrivedAt: "2026-09-10T00:00:00Z" },
        { orderId: ORDER_ID, rowKey: `${ORDER_ID}:RECEIVING_NOTE`, handlingGroup: "RECEIVING_NOTE", nextAction: "CREATE_RECEIVING_NOTE", canAct: true, receivingWarehouseId: WAREHOUSE_ID, arrivedAt: "2026-09-17T00:00:00Z" },
      ] } }) },
      { method: "POST", url: "/api/warehouse-receiving-notes", reply: () => ok({ message: "Gửi phiếu tiếp nhận kho thành công.", receivingNote: { id: NOTE_ID, receivingNoteCode: "WRN-9", status: "PENDING_APPROVAL" } }, 201) },
    ];
    const queue = await actionQueue.listActionQueue();
    const created = await actionQueue.createReceivingNote({ orderId: ORDER_ID, warehouseId: WAREHOUSE_ID, note: " Hẹn thứ 6 " });
    const before = requests.length;
    const { resolved } = await rejection(actionQueue.createReceivingNote({ orderId: ORDER_ID, warehouseId: "" }));
    return all(
      expectEqual("thứ tự", queue.map((r) => r.handlingGroup), ["RECEIVING_NOTE", "DIRECT_DELIVERY"]),
      expectEqual("rowKey tự dựng khi thiếu", queue[1]?.rowKey, "o2-DIRECT_DELIVERY"),
      expectEqual("body POST", requests[1]?.body, { consignmentOrderId: ORDER_ID, warehouseId: WAREHOUSE_ID, warehouseNote: "Hẹn thứ 6" }),
      expectEqual("đọc receivingNote", [created?.receivingNoteCode, created?.status], ["WRN-9", "PENDING_APPROVAL"]),
      expectEqual("thiếu kho không gọi mạng", [resolved, requests.length], [false, before]),
    );
  });

  await check("Tài chính: pending-approval phân trang; approve gửi { transactionCode, receivedAmount, note }; thiếu receivedAmount chặn tại chỗ; reject bắt lý do", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/admin/finance/transactions/pending-approval", reply: () => ok({ message: "ok", data: { items: [{ paymentId: PAYMENT_ID, amount: 705000, paymentMethod: "offline", status: "pending_reconciliation" }], totalCount: 1, pageNumber: 1, pageSize: 20, totalPages: 1 } }) },
      { method: "PUT", url: `/api/admin/finance/transactions/${PAYMENT_ID}/approve`, reply: () => ok({ message: "ok", data: { paymentId: PAYMENT_ID, paymentStatus: "PAID", orderStatusBefore: "WAITING_DEPOSIT", orderStatusAfter: "DEPOSIT_PAID", amount: 705000 } }) },
      { method: "PUT", url: `/api/admin/finance/transactions/${PAYMENT_ID}/reject`, reply: () => ok({ message: "ok", data: { paymentId: PAYMENT_ID, paymentStatus: "CANCELLED" } }) },
    ];
    const pending = await finance.getAdminPendingTransactions({ source: "CONSIGNMENT" });
    const approved = await finance.approveAdminTransaction(PAYMENT_ID, { transactionCode: " FT123 ", receivedAmount: "705000", note: "" });
    await finance.rejectAdminTransaction(PAYMENT_ID, " Không thấy tiền ");
    const before = requests.length;
    const noAmount = await rejection(finance.approveAdminTransaction(PAYMENT_ID, { transactionCode: "FT1" }));
    const noReason = await rejection(finance.rejectAdminTransaction(PAYMENT_ID, " "));
    return all(
      expectEqual("params pending", requests[0]?.params, { pageNumber: 1, pageSize: 20, source: "CONSIGNMENT" }),
      expectEqual("chuẩn hoá pending", [pending.items[0]?.paymentMethod, pending.items[0]?.status, pending.totalCount], ["OFFLINE", "PENDING_RECONCILIATION", 1]),
      expectEqual("body approve", requests[1]?.body, { transactionCode: "FT123", receivedAmount: 705000, note: null }),
      expectEqual("kết quả approve", [approved.paymentStatus, approved.orderStatusAfter], ["PAID", "DEPOSIT_PAID"]),
      expectEqual("body reject", requests[2]?.body, { reason: "Không thấy tiền" }),
      expectEqual("chặn tại chỗ", [noAmount.resolved, noReason.resolved, requests.length], [false, false, before]),
    );
  });

  /*
   * HOÀN TIỀN MUA HỘ (backend mới — chỉ có trên env test). Response mẫu chép từ
   * tests/purchase_refund_flow.py kịch bản A của VCL_API (đặt 5 áo × 200.000, NCC chỉ có 3).
   */
  const PR_ID = "aaaaaaaa-1111-4222-8333-444444444444";
  const PO_ID = "bbbbbbbb-1111-4222-8333-444444444444";
  const PR_ITEM_ID = "cccccccc-1111-4222-8333-444444444444";
  const REFUND_ID = "dddddddd-1111-4222-8333-444444444444";
  const DIFF_REFUND_ID = "eeeeeeee-1111-4222-8333-444444444444";
  const UNFULFILLED_REFUND = {
    refundId: REFUND_ID, purchaseRequestId: PR_ID, purchaseOrderId: null, refundType: "REFUND_UNFULFILLED",
    refundTypeText: "Hoàn phần không mua được / NCC giao thiếu", amount: 421600, status: "PENDING", statusText: "Chờ hoàn tiền",
    goodsAmount: 400000, priceDifferenceAmount: 0, serviceFeeAmount: 20000, vatAmount: 1600, importTaxAdjustment: 0, cancelFeeAmount: 0,
    isLegacy: false,
    lines: [{ lineId: "l1", purchaseRequestItemId: PR_ITEM_ID, productName: "Ao thun", reasonCode: "UNFULFILLED", reasonText: "Không mua được",
      quantity: 2, unitPrice: 200000, goodsAmount: 400000, priceDifferenceAmount: 0, serviceFeeAmount: 20000, vatAmount: 1600,
      importTaxAdjustment: 0, importTaxInRefund: false, cancelFeeAmount: 0, amount: 421600,
      formula: "tiền hàng 2 × 200.000đ = 400.000đ + phí mua hộ 20.000đ (50.000đ × 400.000đ / 1.000.000đ) + VAT 8% phí 1.600đ = 421.600đ" }],
  };
  const SUMMARY = { purchaseRequestId: PR_ID, purchaseCode: "PR-1", totalCollected: 1086400, totalRefunded: 0, totalPendingRefund: 451600, refundableRemaining: 634800, refunds: [UNFULFILLED_REFUND, { refundId: DIFF_REFUND_ID, refundType: "REFUND_PRICE_DIFF", amount: 30000, status: "PENDING", lines: [] }] };

  await check("Hoàn mua hộ: GET /purchase-requests/{id}/refunds bóc data, giữ số backend, mã lạ hiện nguyên mã", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "GET", url: `/api/purchase-requests/${PR_ID}/refunds`, reply: () => ok({ message: "OK", data: { ...SUMMARY, refunds: [...SUMMARY.refunds, { refundId: "x", refundType: "REFUND_NEW_KIND", amount: "5000", status: "WEIRD", lines: [{ reasonCode: "NEW_REASON", amount: 5000 }] }] } }) }];
    const summary = await purchaseOrder.getPurchaseRequestRefunds(PR_ID);
    const [first, , odd] = summary.refunds;
    return all(
      expectEqual("sổ", [summary.totalCollected, summary.totalRefunded, summary.totalPendingRefund, summary.refundableRemaining], [1086400, 0, 451600, 634800]),
      expectEqual("khoản", [first.amount, first.typeLabel, first.statusMeta.label, first.lines[0].reasonLabel, first.lines[0].formula.slice(0, 9)], [421600, "Không mua được / NCC giao thiếu", "Chờ chuyển tiền", "Không mua được (NCC hết hàng / mua ít hơn khách đặt)", "tiền hàng"]),
      expectEqual("mã lạ", [odd.typeLabel, odd.statusMeta.label, odd.lines[0].reasonLabel, odd.amount], ["REFUND_NEW_KIND", "WEIRD", "NEW_REASON", 5000]),
    );
  });

  await check("Hoàn mua hộ: close-unfulfilled chỉ gửi danh sách khi có; thiếu lý do chặn tại chỗ; trả { refund, summary, requestStatus }", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "POST", url: `/api/purchase-requests/${PR_ID}/close-unfulfilled`, reply: () => ok({ message: "ok", data: { refund: UNFULFILLED_REFUND, summary: SUMMARY, requestStatus: "PURCHASING" } }) }];
    const all1 = await purchaseOrder.closeUnfulfilledPurchase(PR_ID, { reason: " NCC chỉ còn 3 áo " });
    const some = await purchaseOrder.closeUnfulfilledPurchase(PR_ID, {
      reason: "NCC giao thiếu 1 áo",
      purchaseRequestItemIds: [PR_ITEM_ID, ""],
      supplierShortages: [{ purchaseOrderId: PO_ID, purchaseRequestItemId: PR_ITEM_ID, quantity: "1" }, { purchaseOrderId: PO_ID, purchaseRequestItemId: PR_ITEM_ID, quantity: 0 }],
    });
    const before = requests.length;
    const noReason = await rejection(purchaseOrder.closeUnfulfilledPurchase(PR_ID, { reason: " " }));
    return all(
      expectEqual("body tất cả", requests[0]?.body, { reason: "NCC chỉ còn 3 áo" }),
      expectEqual("body chọn + giao thiếu", requests[1]?.body, { reason: "NCC giao thiếu 1 áo", purchaseRequestItemIds: [PR_ITEM_ID], supplierShortages: [{ purchaseOrderId: PO_ID, purchaseRequestItemId: PR_ITEM_ID, quantity: 1 }] }),
      expectEqual("kết quả", [all1.refund.amount, all1.refund.lines.length, all1.summary.totalPendingRefund, some.requestStatus], [421600, 1, 451600, "PURCHASING"]),
      expectEqual("thiếu lý do không gọi mạng", [noReason.resolved, requests.length], [false, before]),
    );
  });

  await check("Hoàn mua hộ: đã chuyển tiền — yêu cầu gửi refundId trên URL + { transactionCode, amount }; đơn mua gửi { transactionCode, refundId, amount }; thiếu mã GD chặn tại chỗ", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "POST", url: `/api/purchase-requests/${PR_ID}/refunds/${REFUND_ID}/complete`, reply: () => ok({ message: "ok", data: { ...SUMMARY, totalRefunded: 421600, totalPendingRefund: 30000 } }) },
      { method: "POST", url: `/api/purchase-orders/${PO_ID}/refund/complete`, reply: () => ok({ message: "ok", data: { purchaseOrderId: PO_ID, status: "ORDERED", refundAmount: 30000, refundStatus: "REFUNDED", totalRefundAmount: 230800, warehouseInvoiceStatus: "pending", refunds: [{ refundId: DIFF_REFUND_ID, refundType: "REFUND_PRICE_DIFF", amount: 30000, status: "REFUNDED" }] } }) },
      { method: "POST", url: `/api/purchase-orders/${PO_ID}/cancel`, reply: (req) => ok({ message: "ok", data: { purchaseOrderId: PO_ID, status: "CANCELLED", cancelFeeAmount: req.body.cause === "CUSTOMER" ? 72000 : 0 } }) },
    ];
    const summary = await purchaseOrder.completePurchaseRequestRefund(PR_ID, REFUND_ID, { transactionCode: " RF-A ", amount: 421600 });
    const order = await purchaseOrder.completePurchaseRefund(PO_ID, { transactionCode: "RF-A2", refundId: DIFF_REFUND_ID, amount: 30000 });
    await purchaseOrder.cancelPurchaseOrder(PO_ID, { reason: "Khách đổi ý" });
    await purchaseOrder.cancelPurchaseOrder(PO_ID, { reason: "NCC huỷ", cause: "supplier" });
    const before = requests.length;
    const noCode = await rejection(purchaseOrder.completePurchaseRequestRefund(PR_ID, REFUND_ID, { transactionCode: "" }));
    const badCause = await rejection(purchaseOrder.cancelPurchaseOrder(PO_ID, { reason: "x", cause: "SALE" }));
    return all(
      expectEqual("body yêu cầu", requests[0]?.body, { transactionCode: "RF-A", amount: 421600 }),
      expectEqual("sổ sau khi đóng", [summary.totalRefunded, summary.totalPendingRefund], [421600, 30000]),
      expectEqual("body đơn mua", requests[1]?.body, { transactionCode: "RF-A2", refundId: DIFF_REFUND_ID, amount: 30000 }),
      expectEqual("đơn chuẩn hoá refunds", [order.refunds[0].statusMeta.label, order.totalRefundAmount, order.warehouseInvoiceStatus, purchaseOrder.hasPendingRefund(order)], ["Đã chuyển trả khách", 230800, "PENDING", false]),
      expectEqual("huỷ gửi cause", [requests[2]?.body, requests[3]?.body], [{ reason: "Khách đổi ý", cause: "CUSTOMER" }, { reason: "NCC huỷ", cause: "SUPPLIER" }]),
      expectEqual("chặn tại chỗ", [noCode.resolved, badCause.resolved, requests.length], [false, false, before]),
    );
  });

  /*
   * ĐƠN MUA NCC — "NCC đã phát hàng" bấm MỘT lần (27/09/2026): trước đây hộp đóng cả khi lỗi và bảng
   * chỉ đổi sau khi tải lại cả danh sách. Nay: bộ chạy theo đơn chặn gửi lần hai, dòng cập nhật từ
   * phản hồi backend (đúng dòng), lỗi trả về cho hộp hiện chứ không nuốt.
   */
  await check("Đơn mua NCC: bấm \"NCC đã phát hàng\" một lần → PUT /progress đúng 1 lần, đúng dòng đổi sang SUPPLIER_SHIPPED; lỗi không nuốt", async () => {
    resetState({ token: "t" });
    const helpers = await load("/src/features/purchase/pages/SupplierOrdersPage/SupplierOrdersPage.helpers.js");
    const other = { purchaseOrderId: "other-po", purchaseOrderCode: "PO-2", status: "SUPPLIER_CONFIRMED" };
    const rows = [other, { purchaseOrderId: PO_ID, purchaseOrderCode: "PO-1", status: "SUPPLIER_CONFIRMED", supplierName: "NCC A" }];
    routes = [{
      method: "PUT",
      url: `/api/purchase-orders/${PO_ID}/progress`,
      reply: (req) => ok({ message: "Đã cập nhật tiến độ NCC.", data: { purchaseOrderId: PO_ID.toUpperCase(), purchaseOrderCode: "PO-1", status: req.body.status, domesticTrackingCode: req.body.domesticTrackingCode, supplierName: "NCC A" } }),
    }];
    const runAction = helpers.createOrderActionRunner();
    const send = () => runAction(PO_ID, () => purchaseOrder.updatePurchaseOrderProgress(PO_ID, { status: "SUPPLIER_SHIPPED", domesticTrackingCode: " VD123 ", domesticCarrier: "" }));
    /* Bấm đúp: lần hai tới khi lần một chưa xong. */
    const [first, second] = await Promise.all([send(), send()]);
    const next = helpers.applyOrderUpdate(rows, first.order, { statusFilter: "" });
    const updatedRow = next?.find((row) => row.purchaseOrderId === PO_ID.toUpperCase() || row.purchaseOrderId === PO_ID);
    const filtered = helpers.applyOrderUpdate(rows, first.order, { statusFilter: "SUPPLIER_CONFIRMED" });
    const noData = helpers.applyOrderUpdate(rows, null);

    /* Lỗi backend: trả { ok:false, error } để hộp hiện câu lỗi, rồi mở khoá gửi lại được. */
    routes = [{ method: "PUT", url: `/api/purchase-orders/${PO_ID}/progress`, reply: () => fail(400, { message: "Chỉ ghi NCC phát hàng cho đơn đã đặt / đã xác nhận." }) }];
    const before = requests.length;
    const failed = await send();
    const retry = await send();

    return all(
      expectEqual("số lần gọi PUT", requests.slice(0, before).filter((req) => req.method === "PUT").length, 1),
      expectEqual("body", requests[0]?.body, { status: "SUPPLIER_SHIPPED", domesticTrackingCode: "VD123" }),
      expectEqual("kết quả hai lần bấm", [first.ok, Boolean(second.skipped)], [true, true]),
      expectEqual("dòng đổi trạng thái + nút", [updatedRow?.status, updatedRow?.domesticTrackingCode, helpers.getNextProgressStep(updatedRow?.status), helpers.getAvailableActions(updatedRow, "sale").progress], ["SUPPLIER_SHIPPED", "VD123", null, false]),
      expectEqual("dòng khác giữ nguyên", [next?.length, next?.[0]], [2, other]),
      expectEqual("đang lọc trạng thái cũ → dòng rời bảng", filtered?.map((row) => row.purchaseOrderCode), ["PO-2"]),
      expectEqual("phản hồi thiếu → tải lại (null)", noData, null),
      expectEqual("lỗi trả về, không nuốt", [failed.ok, purchaseOrder.getPurchaseOrderApiError(failed.error)], [false, "Chỉ ghi NCC phát hàng cho đơn đã đặt / đã xác nhận."]),
      expectEqual("lỗi xong gửi lại được", [Boolean(retry.skipped), requests.length - before], [false, 2]),
    );
  });

  await check("Đơn mua NCC: cột Thao tác — \"NCC giao thiếu\" chỉ ở SUPPLIER_SHIPPED, mỗi trạng thái một bước kế tiếp", async () => {
    const helpers = await load("/src/features/purchase/pages/SupplierOrdersPage/SupplierOrdersPage.helpers.js");
    const can = (status, role = "sale") => helpers.getAvailableActions({ status, refunds: [] }, role);
    const steps = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED", "SUPPLIER_CONFIRMED", "SUPPLIER_SHIPPED", "CANCELLED"];
    const saleMain = steps.map((status) => {
      const c = can(status);
      return [c.submit && "Gửi duyệt", c.place && "Đã đặt NCC", c.progress && helpers.getNextProgressStep(status)?.label].filter(Boolean);
    });
    return all(
      expectEqual("giao thiếu (Sale)", steps.map((status) => can(status).closeShortage), [false, false, false, false, false, true, false]),
      expectEqual("giao thiếu (Admin)", steps.map((status) => can(status, "admin").closeShortage), [false, false, false, false, false, true, false]),
      expectEqual("nút chính của Sale", saleMain, [["Gửi duyệt"], [], ["Đã đặt NCC"], ["NCC đã xác nhận đơn"], ["NCC đã phát hàng"], [], []]),
      expectEqual("SUPPLIER_CONFIRMED không có giao thiếu", [can("SUPPLIER_CONFIRMED").progress, can("SUPPLIER_CONFIRMED").closeShortage], [true, false]),
      expectEqual("Admin duyệt chỉ ở chờ duyệt", steps.map((status) => can(status, "admin").decide), [false, true, false, false, false, false, false]),
    );
  });

  /*
   * CHẶNG THẬT CỦA YÊU CẦU MUA HỘ (30/09/2026): Sale thấy "Hoàn tất nghiệp vụ" (nhãn server của
   * PURCHASE_REQUESTS.status = COMPLETED) trên cả yêu cầu mới tất toán đợt cuối đời cũ, đơn kho
   * còn WAREHOUSE_RECEIVED. Dữ liệu mẫu chép từ production 30/09 (4 yêu cầu COMPLETED: 2 hoàn tất
   * thật, 2 đời cũ). "Đơn đã hoàn tất" chỉ khi mọi đơn kho COMPLETED và không còn khoản hoàn chờ.
   */
  await check("Chặng mua hộ: COMPLETED đời cũ (đơn kho còn ở kho nguồn) KHÔNG là \"Đơn đã hoàn tất\"; bảng chặng + ô lọc không còn \"Hoàn tất nghiệp vụ\"", async () => {
    const stageMod = await load("/src/features/purchase/api/purchaseRequestStage.js");
    const po = (requestId, status, warehouseOrderStatus, extra = {}) => ({ purchaseRequestId: requestId, status, warehouseOrderStatus, refunds: [], ...extra });
    const ctx = stageMod.buildPurchaseStageContext({
      purchaseOrders: [
        po("REQ-DONE", "SUPPLIER_SHIPPED", "COMPLETED", { orderedAt: "2026-09-27T16:34:05Z", supplierShippedAt: "2026-09-27T16:35:00Z" }),
        po("REQ-SHIP", "SUPPLIER_SHIPPED", "DEPOSIT_PAID"),
        po("REQ-ORIGIN", "SUPPLIER_SHIPPED", "WAREHOUSE_RECEIVED"),
        po("REQ-ORDER", "ORDERED", "DEPOSIT_PAID"),
        po("REQ-REFUND", "SUPPLIER_SHIPPED", "COMPLETED", { refunds: [{ status: "PENDING", amount: 5000 }] }),
        po("REQ-SPLIT", "SUPPLIER_SHIPPED", "AT_DESTINATION_WAREHOUSE"),
        po("REQ-SPLIT", "SUPPLIER_SHIPPED", "DELIVERED"),
        po("REQ-SPLIT", "CANCELLED", "CANCELLED"),
        po("REQ-OPEN", "SUPPLIER_SHIPPED", "COMPLETED"),
      ],
      warehouseOrders: [
        { consignmentCode: "PUR-LEGACY", status: "WAREHOUSE_RECEIVED" },
        { consignmentCode: "PUR-LEGACY-OK", status: "COMPLETED" },
        { consignmentCode: "PUR-DONE-1", status: "COMPLETED" },
      ],
    });
    const stage = (request, context = ctx) => stageMod.derivePurchaseStage(request, context).stage;
    const S = stageMod.PURCHASE_STAGE;
    const done = stageMod.derivePurchaseStage({ purchaseRequestId: "REQ-DONE", purchaseCode: "PUR-DONE", status: "COMPLETED" }, ctx);
    const legacy = stageMod.derivePurchaseStage({ purchaseRequestId: "REQ-LEGACY", purchaseCode: "PUR-LEGACY", status: "COMPLETED" }, ctx);
    const labels = stageMod.PURCHASE_STAGE_FILTER_OPTIONS.map((option) => option.label);
    const detailHelpers = await load("/src/features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail.helpers.js");
    const shown = [
      detailHelpers.getQuotationStatusInfo("PENDING_CUSTOMER_REVIEW").label,
      detailHelpers.getFeeTypeLabel("SOME_NEW_FEE"),
      detailHelpers.getStatusInfo("WAITING_SOMETHING", "WAITING_SOMETHING").label,
      detailHelpers.getStatusInfo("COMPLETED", "Hoàn tất nghiệp vụ").label,
      detailHelpers.getStatusInfo("PAID", "Đã trả trước, chờ đặt mua").label,
    ];
    const englishLike = shown.filter((label) => /^[A-Za-z ]+$/.test(label) || /_/.test(label));
    const detailLabelsCheck = expectEqual("chi tiết: mã lạ không thành chữ Anh / mã thô; COMPLETED không còn \"Hoàn tất nghiệp vụ\"", [englishLike, shown[3], shown[4]], [[], "Đã đóng yêu cầu", "Đã trả trước, chờ đặt mua"]);

    return all(
      expectEqual("hoàn tất thật", [done.stage, done.label, done.isFullyCompleted, Boolean(done.milestones.orderedAt)], [S.COMPLETED, "Đơn đã hoàn tất", true, true]),
      expectEqual("COMPLETED đời cũ, đơn kho WAREHOUSE_RECEIVED", [legacy.stage, legacy.label, legacy.isFullyCompleted], [S.IN_TRANSIT, "Đang vận chuyển", false]),
      expectEqual("đời cũ đơn kho COMPLETED", stage({ purchaseRequestId: "X", purchaseCode: "PUR-LEGACY-OK", status: "COMPLETED" }), S.COMPLETED),
      expectEqual("mã → chặng trước khi có đơn mua", ["PENDING_REVIEW", "IN_REVIEW", "NEED_MORE_INFO", "QUOTED", "WAITING_PAYMENT", "PAID", "CANCELLED", "REJECTED", "QUOTATION_REJECTED"].map((status) => stage({ purchaseRequestId: "none", purchaseCode: "PUR-NONE", status })),
        [S.AWAITING_QUOTE, S.AWAITING_QUOTE, S.NEED_MORE_INFO, S.AWAITING_PAYMENT, S.AWAITING_PAYMENT, S.PREPAID, S.CANCELLED, S.REJECTED, S.REJECTED]),
      expectEqual("theo đơn mua NCC / đơn kho", [
        stage({ purchaseRequestId: "REQ-ORDER", status: "PURCHASING" }),
        stage({ purchaseRequestId: "REQ-SHIP", status: "PURCHASING" }),
        stage({ purchaseRequestId: "REQ-ORIGIN", status: "PURCHASING" }),
        stage({ purchaseRequestId: "REQ-SPLIT", status: "PURCHASING" }),
      ], [S.ORDERING_SUPPLIER, S.IN_TRANSIT, S.IN_TRANSIT, S.ARRIVED_VN]),
      expectEqual("còn khoản hoàn chờ chuyển", stage({ purchaseRequestId: "REQ-REFUND", status: "COMPLETED" }), S.AWAITING_REFUND),
      expectEqual("đơn kho xong nhưng yêu cầu chưa chốt", stage({ purchaseRequestId: "REQ-OPEN", status: "PURCHASING" }), S.DELIVERED),
      expectEqual("còn dòng chưa lập đơn mua", stage({ purchaseRequestId: "REQ-OPEN", status: "COMPLETED", openLineCount: 1 }), S.ORDERING_SUPPLIER),
      expectEqual("không tải được đối chiếu → không tự nhận hoàn tất", [stage({ purchaseRequestId: "REQ-DONE", status: "COMPLETED" }, null), stage({ purchaseRequestId: "REQ-DONE", status: "PAID" }, null)], [S.UNVERIFIED, S.PREPAID]),
      expectEqual("lọc", [stageMod.matchesPurchaseStage(done, "COMPLETED"), stageMod.matchesPurchaseStage(legacy, "COMPLETED"), stageMod.matchesPurchaseStage(legacy, "ALL")], [true, false, true]),
      expectTrue("ô lọc có \"Đơn đã hoàn tất\", không có \"Hoàn tất nghiệp vụ\"", labels.includes("Đơn đã hoàn tất") && !labels.some((label) => /nghiệp vụ/i.test(label))),
      expectEqual("nhãn theo mã COMPLETED", stageMod.getPurchaseRequestStatusLabel("COMPLETED", "Hoàn tất nghiệp vụ"), "Đã đóng yêu cầu"),
      /* Backend mới trả overallStage (suy từ đủ dữ liệu) → FE tin backend; mã lạ thì tự suy. */
      detailLabelsCheck,
      expectEqual("ưu tiên overallStage của backend", [
        stage({ purchaseRequestId: "REQ-DONE", purchaseCode: "PUR-DONE", status: "COMPLETED", overallStage: "AWAITING_REFUND" }),
        stage({ purchaseRequestId: "x", status: "COMPLETED", overallStage: "COMPLETED" }, null),
        stage({ purchaseRequestId: "x", status: "COMPLETED", overallStage: "WEIRD" }, null),
      ], [S.AWAITING_REFUND, S.COMPLETED, S.UNVERIFIED]),
    );
  });

  await check("Chặng mua hộ: getPurchaseStageContextApi đọc GET /api/purchase-orders + GET /api/orders/consignments?orderType=PURCHASE; một nguồn lỗi → không ném, COMPLETED thành \"Chưa đối chiếu\"", async () => {
    resetState({ token: "tok" });
    const REQ = "cccccccc-1111-4222-8333-444444444444";
    const stageMod = await load("/src/features/purchase/api/purchaseRequestStage.js");
    routes = [
      { method: "GET", url: "/api/purchase-orders", reply: () => ok({ message: "OK", data: { items: [{ purchaseRequestId: REQ.toUpperCase(), status: "SUPPLIER_SHIPPED", warehouseOrderStatus: "COMPLETED", refunds: [] }], totalCount: 1 } }) },
      { method: "GET", url: "/api/orders/consignments", reply: () => ok({ message: "OK", data: { items: [{ orderId: "o1", consignmentCode: "PUR-OLD", status: "WAREHOUSE_RECEIVED" }], totalCount: 1 } }) },
    ];
    const ctx = await purchaseRequest.getPurchaseStageContextApi();
    const listCalls = requests.map((req) => [req.url, req.params?.orderType ?? null, req.params?.pageSize ?? null]);
    routes.push({ method: "GET", url: "/api/purchase-requests", reply: () => ok({ message: "OK", data: { items: [], totalCount: 0 } }) });
    await purchaseRequest.getPurchaseRequestsApi({ stage: " completed ", pageSize: 1000 });
    const stageParam = requests.find((req) => req.url === "/api/purchase-requests")?.params?.stage;
    const fullDone = stageMod.derivePurchaseStage({ purchaseRequestId: REQ, purchaseCode: "PUR-NEW", status: "COMPLETED" }, ctx).stage;
    const legacy = stageMod.derivePurchaseStage({ purchaseRequestId: "other", purchaseCode: "PUR-OLD", status: "COMPLETED" }, ctx).stage;

    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: `/api/purchase-requests/${REQ}/purchase-orders`, reply: () => ok({ message: "OK", data: [] }) },
      { method: "GET", url: "/api/orders/consignments", reply: () => fail(500, { message: "lỗi" }) },
    ];
    const scoped = await purchaseRequest.getPurchaseStageContextApi({ purchaseRequestId: REQ, purchaseCode: "PUR-OLD" });
    const scopedParams = requests.find((req) => req.url === "/api/orders/consignments")?.params;

    return all(
      expectEqual("hai nguồn", listCalls, [["/api/purchase-orders", null, 100], ["/api/orders/consignments", "PURCHASE", 500]]),
      expectEqual("gửi stage cho backend mới", stageParam, "COMPLETED"),
      expectEqual("suy chặng", [ctx.loaded, fullDone, legacy], [true, stageMod.PURCHASE_STAGE.COMPLETED, stageMod.PURCHASE_STAGE.IN_TRANSIT]),
      expectEqual("chi tiết: đọc theo yêu cầu + searchCode", [scopedParams?.searchCode, scopedParams?.orderType], ["PUR-OLD", "PURCHASE"]),
      expectEqual("nguồn lỗi → null, không ném", [scoped.purchaseOrdersLoaded, scoped.warehouseOrdersLoaded, stageMod.derivePurchaseStage({ purchaseRequestId: REQ, purchaseCode: "PUR-OLD", status: "COMPLETED" }, scoped).stage], [true, false, stageMod.PURCHASE_STAGE.UNVERIFIED]),
    );
  });

  await check("Tổng quan: ba endpoint /api/staff|operations|admin/dashboard bóc { data }, giữ số backend, thiếu trường → 0/[]; 403 ném lỗi", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/staff/dashboard", reply: () => ok({ message: "ok", data: {
        totalOrders: 3, consignmentTotal: 2, purchaseTotal: 1,
        exchangeRates: [{ currencyCode: "cny", currencyName: "Nhân dân tệ", rateToVnd: 3600 }],
        routes: [{ countryCode: "KR", countryName: "Hàn Quốc", consignmentCount: 2, purchaseCount: 1, total: 3, percent: 100 }],
        statusGroups: [{ key: "PENDING", label: "Chờ duyệt", count: 3, percent: 100, consignmentCount: 2, purchaseCount: 1, statuses: [{ key: "CONSIGNMENT:PENDING_REVIEW", label: "Ký gửi · Chờ duyệt", count: 2, percent: 67 }] }],
        last7Days: [{ date: "2026-09-26", consignmentCount: 2, purchaseCount: 1, total: 3 }],
        workQueue: { consignmentsToReview: 2 },
        recentConsignments: [{ orderId: ORDER_ID, consignmentCode: "KG-1", status: "PENDING_REVIEW", statusText: "Chờ duyệt" }],
      } }) },
      { method: "GET", url: "/api/operations/dashboard", reply: () => ok({ message: "ok", data: {
        stockTotals: { storedParcels: 5, occupancyPercent: 12.5 },
        flow7Days: [{ date: "2026-09-26", originInbound: 4, exported: 2, arrivedVn: 1, dispatchedDelivery: 0 }],
        processingTimes: [{ key: "WRO", label: "Phiếu xuất kho", averageMinutes: null, sampleCount: 0 }, { key: "DELIVERY", averageMinutes: 2.5, sampleCount: 3 }],
      } }) },
      { method: "GET", url: "/api/admin/dashboard", reply: () => fail(403, { message: "Forbidden" }) },
    ];
    const sale = await dashboard.getSaleDashboardApi();
    const ops = await dashboard.getOperationsDashboardApi();
    const { resolved, error } = await rejection(dashboard.getAdminDashboardApi());
    return all(
      expectEqual("url", requests.map((r) => [r.method, r.url]), [["GET", "/api/staff/dashboard"], ["GET", "/api/operations/dashboard"], ["GET", "/api/admin/dashboard"]]),
      expectEqual("số Sale giữ nguyên", [sale.totalOrders, sale.routes[0].percent, sale.statusGroups[0].statuses[0].count, sale.last7Days[0].total], [3, 100, 2, 3]),
      expectEqual("tỷ giá chuẩn hoá mã", [sale.exchangeRates[0].currencyCode, sale.exchangeRates[0].rateToVnd], ["CNY", 3600]),
      expectEqual("thiếu trường → 0", [sale.workQueue.consignmentsToReview, sale.workQueue.purchasesToQuote, sale.recentPurchaseRequests.length], [2, 0, 0]),
      expectEqual("mã đơn ký gửi → orderCode", [sale.recentConsignments[0].orderId, sale.recentConsignments[0].orderCode], [ORDER_ID, "KG-1"]),
      expectEqual("vận hành", [ops.stockTotals.storedParcels, ops.stockTotals.occupancyPercent, ops.flow7Days[0].originInbound, ops.warehouses.length], [5, 12.5, 4, 0]),
      expectEqual("chưa có mẫu → averageMinutes null", [ops.processingTimes[0].averageMinutes, ops.processingTimes[1].averageMinutes], [null, 2.5]),
      expectEqual("403 ném lỗi", [resolved, error?.response?.status ?? error?.status], [false, 403]),
    );
  });

  await check("Quản lý kho: GET manager bóc data; PUT { managerId|null, reason } bắt lý do; ứng viên chỉ OperationsManager đang hoạt động", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/manager`, reply: () => ok({ data: { warehouseId: WAREHOUSE_ID, warehouseName: "Kho Quảng Châu", managerId: MANAGER_ID, managerName: "Quản lý A", history: [{ managerName: "Quản lý A", changedAt: "2026-09-17T00:00:00Z" }] } }) },
      { method: "PUT", url: `/api/warehouses/${WAREHOUSE_ID}/manager`, reply: (req) => ok({ message: "ok", data: { managerId: req.body.managerId } }) },
      { method: "GET", url: "/api/User", reply: () => ok([
        { id: MANAGER_ID, fullName: "Quản lý A", role: "OperationsManager", status: "Active" },
        { id: "u2", fullName: "Quản lý khoá", role: "Operations Manager", status: "Locked" },
        { id: "u3", fullName: "Sale B", role: "Sale", status: "Active" },
      ]) },
    ];
    const info = await warehouseManager.getWarehouseManager(WAREHOUSE_ID);
    await warehouseManager.assignWarehouseManager(WAREHOUSE_ID, { managerId: MANAGER_ID, reason: " Phân công " });
    await warehouseManager.assignWarehouseManager(WAREHOUSE_ID, { managerId: null, reason: "Bỏ gán" });
    const candidates = await warehouseManager.getWarehouseManagerCandidates();
    const before = requests.length;
    const { resolved } = await rejection(warehouseManager.assignWarehouseManager(WAREHOUSE_ID, { managerId: MANAGER_ID, reason: "" }));
    return all(
      expectEqual("quản lý", [info.managerName, info.history.length], ["Quản lý A", 1]),
      expectEqual("body gán", requests[1]?.body, { managerId: MANAGER_ID, reason: "Phân công" }),
      expectEqual("body bỏ gán", requests[2]?.body, { managerId: null, reason: "Bỏ gán" }),
      expectEqual("ứng viên", candidates.map((u) => u.id), [MANAGER_ID]),
      expectEqual("thiếu lý do không gọi mạng", [resolved, requests.length], [false, before]),
    );
  });

  /* ---------- Gán nhân viên kho vào kho (adminUserService + warehouseManagerService) ---------- */

  const STAFF_USER_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  const WAREHOUSE_ID_2 = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

  await check("Người dùng: GET /api/User giữ nguyên field + assignedWarehouses (thiếu → []); nhận diện vai trò kho", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/User", reply: () => ok([
        { id: STAFF_USER_ID, fullName: "Kho A", role: "Warehouse Staff VN", region: "CN", status: "Active", assignedWarehouses: [{ warehouseId: WAREHOUSE_ID, warehouseCode: "GZ-01", warehouseName: "Kho Quảng Châu", region: "CN" }] },
        { id: "u2", fullName: "Sale B", role: "Sale", status: "Active" },
      ]) },
    ];
    const users = await adminSvc.getAdminUsers();
    const roles = ["Warehouse", "Warehouse Staff", "WarehouseStaff", "WarehouseTQ", "WarehouseVN", "Warehouse Staff Cam", "warehouse_staff"];
    const notRoles = ["WarehouseManager", "Warehouse Manager", "Sale", "OperationsManager", "", null];
    return all(
      expectEqual("url", requests.map((r) => [r.method, r.url]), [["GET", "/api/User"]]),
      expectEqual("giữ field", [users[0].id, users[0].fullName, users[0].region, users[0].status], [STAFF_USER_ID, "Kho A", "CN", "Active"]),
      expectEqual("kho phụ trách", users[0].assignedWarehouses.map((w) => [w.warehouseId, w.warehouseName, w.region]), [[WAREHOUSE_ID, "Kho Quảng Châu", "CN"]]),
      expectEqual("thiếu assignedWarehouses → []", users[1].assignedWarehouses, []),
      expectEqual("vai trò kho", roles.map(adminUser.isWarehouseRole), roles.map(() => true)),
      expectEqual("không phải vai trò kho", notRoles.map(adminUser.isWarehouseRole), notRoles.map(() => false)),
    );
  });

  await check("Người dùng: adminService re-export ĐÚNG 6 hàm thật của adminUserService; POST/PUT role/lock/unlock gửi đúng body; 409 giữ message", async () => {
    resetState({ token: "tok" });
    const names = ["getAdminUsers", "getAdminUserDetail", "createAdminUser", "updateAdminUserRole", "lockAdminUser", "unlockAdminUser"];
    routes = [
      { method: "GET", url: `/api/User/${STAFF_USER_ID}`, reply: () => ok({ id: STAFF_USER_ID, fullName: "Kho A", role: "WarehouseStaff", region: "CN" }) },
      { method: "POST", url: "/api/User", reply: () => ok({ id: "new-user-id" }, 201) },
      { method: "PUT", url: `/api/User/${STAFF_USER_ID}/role`, reply: () => ok({ message: "Đã cập nhật vai trò." }) },
      { method: "PUT", url: `/api/User/${STAFF_USER_ID}/lock`, reply: () => ok({ message: "Đã khoá." }) },
      { method: "PUT", url: `/api/User/${STAFF_USER_ID}/unlock`, reply: () => ok({ message: "Đã mở khoá." }) },
    ];
    const detail = await adminSvc.getAdminUserDetail(STAFF_USER_ID);
    const created = await adminSvc.createAdminUser({ fullName: "Kho B", email: "b@vcl.vn", password: "secret1", phone: "0900000000", role: "WarehouseStaff", region: "" });
    await adminSvc.updateAdminUserRole(STAFF_USER_ID, { role: "WarehouseStaff", region: null });
    await adminSvc.lockAdminUser(STAFF_USER_ID);
    await adminSvc.unlockAdminUser(STAFF_USER_ID);
    const okRequests = requests.slice();
    routes = [{ method: "POST", url: "/api/User", reply: () => fail(409, { message: "Email đã tồn tại." }) }];
    const dup = await rejection(adminSvc.createAdminUser({ fullName: "X", email: "b@vcl.vn", password: "secret1", phone: "0900000001", role: "Sale", region: null }));
    routes = [{ method: "PUT", url: `/api/User/${STAFF_USER_ID}/role`, reply: () => fail(400, { message: "Tài khoản đang được gán kho, bỏ gán trước khi đổi vùng." }) }];
    const assigned = await rejection(adminSvc.updateAdminUserRole(STAFF_USER_ID, { role: "WarehouseStaff", region: "VN" }));
    const before = requests.length;
    const noId = await rejection(adminSvc.lockAdminUser(""));
    return all(
      expectEqual("cùng tham chiếu", names.filter((name) => adminSvc[name] !== adminUser[name]), []),
      expectEqual("url", okRequests.map((r) => [r.method, r.url]), [
        ["GET", `/api/User/${STAFF_USER_ID}`],
        ["POST", "/api/User"],
        ["PUT", `/api/User/${STAFF_USER_ID}/role`],
        ["PUT", `/api/User/${STAFF_USER_ID}/lock`],
        ["PUT", `/api/User/${STAFF_USER_ID}/unlock`],
      ]),
      expectEqual("chi tiết", [detail.id, detail.region, detail.assignedWarehouses], [STAFF_USER_ID, "CN", []]),
      expectEqual("body tạo", okRequests[1].body, { fullName: "Kho B", email: "b@vcl.vn", password: "secret1", phone: "0900000000", role: "WarehouseStaff", region: "" }),
      expectEqual("201 { id }", created, { id: "new-user-id" }),
      expectEqual("body đổi vai trò", okRequests[2].body, { role: "WarehouseStaff", region: null }),
      expectEqual("409 giữ message", [dup.resolved, adminSvc.getAdminApiError(dup.error, "x")], [false, "Email đã tồn tại."]),
      expectEqual("400 đổi vùng giữ message", [assigned.resolved, adminSvc.getAdminApiError(assigned.error, "x")], [false, "Tài khoản đang được gán kho, bỏ gán trước khi đổi vùng."]),
      expectEqual("thiếu id không gọi mạng", [noId.resolved, requests.length], [false, before]),
    );
  });

  await check("Gán kho: GET /api/users/{id}/warehouses bóc data; PUT thay toàn bộ { warehouseIds, note|null }; [] = bỏ gán; lỗi giữ nguyên message, 403 rỗng → câu tiếng Việt", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: `/api/users/${STAFF_USER_ID}/warehouses`, reply: () => ok({ data: {
        userId: STAFF_USER_ID, fullName: "Kho A", email: "a@vcl.vn", role: "WarehouseStaff", region: null, isWarehouseRole: true,
        warehouses: [{ warehouseId: WAREHOUSE_ID, warehouseCode: "GZ-01", warehouseName: "Kho Quảng Châu", region: "CN", isActive: true, note: "Trực ca sáng", assignedAt: "2026-09-20T02:00:00Z", assignedById: "admin-1", assignedByName: "Admin" }],
      } }) },
      { method: "PUT", url: `/api/users/${STAFF_USER_ID}/warehouses`, reply: (req) => ok({ message: "Đã cập nhật kho phụ trách.", data: {
        userId: STAFF_USER_ID, role: "WarehouseStaff", region: "CN", isWarehouseRole: true,
        warehouses: req.body.warehouseIds.map((id) => ({ warehouseId: id, region: "CN", isActive: true })),
        regionChanged: true, previousRegion: null,
      } }) },
      { method: "GET", url: "/api/warehouses", reply: () => ok({ items: [
        { id: WAREHOUSE_ID, name: "Kho Quảng Châu", code: "GZ-01", region: "CN", isActive: true, warehouseType: "ORIGIN" },
        { id: WAREHOUSE_ID_2, name: "Kho cũ", code: "OLD", regionCode: "CN", isActive: false },
      ] }) },
    ];
    const detail = await adminUser.getUserWarehousesApi(STAFF_USER_ID);
    const saved = await adminUser.assignUserWarehousesApi(STAFF_USER_ID, { warehouseIds: [WAREHOUSE_ID, ` ${WAREHOUSE_ID} `, "", WAREHOUSE_ID_2], note: "   " });
    await adminUser.assignUserWarehousesApi(STAFF_USER_ID, { warehouseIds: [], note: " Nghỉ việc " });
    const catalog = await adminUser.getAssignableWarehousesApi();
    const okRequests = requests.slice();

    routes = [{ method: "PUT", url: `/api/users/${STAFF_USER_ID}/warehouses`, reply: () => fail(400, { message: "Các kho phải cùng một vùng." }) }];
    const bad = await rejection(adminUser.assignUserWarehousesApi(STAFF_USER_ID, { warehouseIds: [WAREHOUSE_ID] }));
    routes = [{ method: "PUT", url: `/api/users/${STAFF_USER_ID}/warehouses`, reply: () => fail(403, "") }];
    const forbidden = await rejection(adminUser.assignUserWarehousesApi(STAFF_USER_ID, { warehouseIds: [WAREHOUSE_ID] }));
    const before = requests.length;
    const noId = await rejection(adminUser.assignUserWarehousesApi(" ", { warehouseIds: [] }));

    return all(
      expectEqual("url", okRequests.map((r) => [r.method, r.url]), [
        ["GET", `/api/users/${STAFF_USER_ID}/warehouses`],
        ["PUT", `/api/users/${STAFF_USER_ID}/warehouses`],
        ["PUT", `/api/users/${STAFF_USER_ID}/warehouses`],
        ["GET", "/api/warehouses"],
      ]),
      expectEqual("chi tiết", [detail.isWarehouseRole, detail.region, detail.warehouses[0].assignedByName, detail.warehouses[0].note], [true, null, "Admin", "Trực ca sáng"]),
      expectEqual("body gán: bỏ trùng/rỗng, note trắng → null", okRequests[1].body, { warehouseIds: [WAREHOUSE_ID, WAREHOUSE_ID_2], note: null }),
      expectEqual("body bỏ gán", okRequests[2].body, { warehouseIds: [], note: "Nghỉ việc" }),
      expectEqual("kết quả lưu", [saved.message, saved.data.regionChanged, saved.data.previousRegion, saved.data.region, saved.data.warehouses.length], ["Đã cập nhật kho phụ trách.", true, null, "CN", 2]),
      expectEqual("danh mục kho", catalog.map((w) => [w.id, w.region, w.isActive]), [[WAREHOUSE_ID, "CN", true], [WAREHOUSE_ID_2, "CN", false]]),
      expectEqual("400 giữ message", [bad.resolved, adminUser.getAdminUserApiError(bad.error)], [false, "Các kho phải cùng một vùng."]),
      expectEqual("403 rỗng", [forbidden.resolved, adminUser.getAdminUserApiError(forbidden.error)], [false, "Tài khoản của bạn không có quyền thực hiện thao tác này."]),
      expectEqual("403 không đăng xuất", fakeLocation.replaced, []),
      expectEqual("thiếu id không gọi mạng", [noId.resolved, requests.length], [false, before]),
    );
  });

  /* ---------- Màn Quản lý người dùng: 58 bản ghi hiện đủ, ô tổng đúng định nghĩa, tạo không N+1 ---------- */

  const make58Users = () => {
    const staffRoles = ["Sale", "Delivery", "OperationsManager", "WarehouseStaff", "Admin"];
    const staff = Array.from({ length: 50 }, (_, i) => ({
      id: `staff-${i}`, fullName: `NV ${i}`, email: `nv${i}@vcl.vn`, phone: `09000000${String(i).padStart(2, "0")}`,
      role: staffRoles[i % staffRoles.length], userType: "Employee", status: i === 3 ? "Locked" : "Active",
      region: i % 2 ? "VN" : "CN", createdAt: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T02:00:00`,
      assignedWarehouses: i === 3 ? [{ warehouseId: WAREHOUSE_ID, warehouseCode: "GZ-01", warehouseName: "Kho Quảng Châu", region: "CN" }] : [],
    }));
    const customers = Array.from({ length: 8 }, (_, i) => ({
      id: `cus-${i}`, fullName: `KH ${i}`, email: `kh${i}@mail.vn`, phone: `09100000${String(i).padStart(2, "0")}`,
      role: "Customer", userType: "Customer", status: "Active", region: null, createdAt: "2026-09-10T02:00:00", assignedWarehouses: [],
    }));
    return [...staff, ...customers];
  };

  await check("Quản lý người dùng: API trả 58 bản ghi → bảng giữ đủ 58 (một request, không gọi kho từng người); ô tổng = 50 nhân viên + 8 khách = 58; bộ lọc áp đúng", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "GET", url: "/api/User", reply: () => ok(make58Users()) }];
    const users = await adminSvc.getAdminUsers();
    const summary = adminUser.summarizeAdminUsers(users);
    const f = (opts) => adminUser.filterAdminUsers(users, opts).length;
    return all(
      expectEqual("chỉ một request", requests.map((r) => [r.method, r.url]), [["GET", "/api/User"]]),
      expectEqual("bảng đủ bản ghi (không lọc)", f({}), 58),
      expectEqual("ô tổng", summary, { total: 58, staff: 50, customers: 8 }),
      expectEqual("lọc vai trò Customer", f({ role: "Customer" }), 8),
      expectEqual("lọc vai trò Sale", f({ role: "Sale" }), 10),
      expectEqual("lọc loại TK Employee", f({ userType: "Employee" }), 50),
      expectEqual("lọc Đã khóa", f({ status: adminUser.LOCKED_STATUS_FILTER }), 1),
      expectEqual("lọc Active (không tính tài khoản khoá)", f({ status: "Active" }), 57),
      expectEqual("tìm theo tên kho phụ trách", f({ query: "quảng châu" }), 1),
      expectEqual("khách trống userType vẫn là khách theo role", adminUser.isCustomerAccount({ role: "customer" }), true),
    );
  });

  await check("Quản lý người dùng: tạo tài khoản = ĐÚNG MỘT request POST, chèn bản ghi mới vào bảng (không tải lại, không N+1); phân quyền / khoá / gán kho vá đúng dòng", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/User", reply: () => ok(make58Users()) },
      { method: "POST", url: "/api/User", reply: () => ok({ id: "new-id" }, 201) },
    ];
    let users = await adminSvc.getAdminUsers();
    requests = [];
    const payload = { fullName: "Kho Mới", email: "khomoi@vcl.vn", password: "secret1", phone: "0988888888", role: "WarehouseStaff", region: "vn" };
    const created = await adminSvc.createAdminUser(payload);
    const record = adminUser.buildCreatedAdminUser(payload, created, new Date("2026-09-27T03:00:00Z"));
    users = adminUser.upsertAdminUser(users, record);
    const afterCreate = requests.map((r) => [r.method, r.url]);
    const again = adminUser.upsertAdminUser(users, record);
    const summary = adminUser.summarizeAdminUsers(users);

    const patchedRole = adminUser.patchAdminUser(users, "staff-0", (u) => adminUser.applyRoleUpdate(u, { role: "Warehouse Staff", region: null }));
    const locked = adminUser.patchAdminUser(users, "staff-1", (u) => adminUser.applyLockState(u, true));
    const assigned = adminUser.patchAdminUser(users, "new-id", (u) => adminUser.applyWarehouseAssignment(u, { region: "VN", warehouses: [{ warehouseId: WAREHOUSE_ID, warehouseName: "Kho HN", region: "VN" }] }));

    const pageSource = fs.readFileSync(path.join(ROOT, "src/features/admin/pages/AdminUsersPage/AdminUsersPage.jsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const submitCreate = pageSource.slice(pageSource.indexOf("const submitCreate"), pageSource.indexOf("const openRoleEditor"));
    return all(
      expectEqual("request khi tạo", afterCreate, [["POST", "/api/User"]]),
      expectEqual("bản ghi mới", [record.id, record.userType, record.status, record.region, record.role, record.assignedWarehouses, record.createdAt], ["new-id", "Employee", "Active", "VN", "WarehouseStaff", [], "2026-09-27T03:00:00.000Z"]),
      expectEqual("bảng 59 dòng, mới ở đầu", [users.length, users[0].id], [59, "new-id"]),
      expectEqual("chèn lại cùng id không nhân đôi", again.length, 59),
      expectEqual("ô tổng sau tạo", summary, { total: 59, staff: 51, customers: 8 }),
      expectEqual("thiếu id → null (trang tải lại một lần)", adminUser.buildCreatedAdminUser(payload, {}), null),
      expectEqual("đổi vai trò: chuẩn hoá tên, vùng rỗng giữ nguyên", [patchedRole[1].role, patchedRole[1].region], ["WarehouseStaff", "CN"]),
      expectEqual("khoá", [locked[2].status, adminUser.isLockedAdminUser(locked[2])], ["Locked", true]),
      expectEqual("gán kho", [assigned[0].region, assigned[0].assignedWarehouses.map((w) => w.warehouseName)], ["VN", ["Kho HN"]]),
      expectEqual("dòng khác giữ tham chiếu", locked[5] === users[5], true),
      expectEqual("trang không gọi kho từng người / không cắt danh sách", [
        /getUserWarehousesApi|\/warehouses`/.test(pageSource),
        /(users|filteredUsers|list)\s*\.slice\(|\btake\b|pageSize:\s*50\b/.test(pageSource),
        /dataSource=\{filteredUsers\}/.test(pageSource),
      ], [false, false, true]),
      expectEqual("tạo xong không tải lại cả danh sách (chỉ khi thiếu id)", [/await\s+loadUsers\(/.test(submitCreate), /if \(!createdUser\) loadUsers\(\)/.test(submitCreate), /savingRef\.current/.test(submitCreate)], [false, true, true]),
    );
  });

  await check("Nhân viên kho của kho: GET /api/warehouses/{id}/staff bóc data.staff (chỉ đọc)", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/staff`, reply: () => ok({ data: {
        warehouseId: WAREHOUSE_ID, warehouseCode: "GZ-01", warehouseName: "Kho Quảng Châu", region: "CN",
        staff: [{ userId: STAFF_USER_ID, fullName: "Kho A", email: "a@vcl.vn", role: "WarehouseStaff", region: "CN", status: "Active", assignedAt: "2026-09-20T02:00:00Z", assignedByName: "Admin", note: null }],
      } }) },
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID_2}/staff`, reply: () => ok({ data: { warehouseId: WAREHOUSE_ID_2, staff: [] } }) },
    ];
    const one = await warehouseManager.getWarehouseStaff(WAREHOUSE_ID);
    const empty = await warehouseManager.getWarehouseStaff(WAREHOUSE_ID_2);
    return all(
      expectEqual("url", requests.map((r) => [r.method, r.url]), [["GET", `/api/warehouses/${WAREHOUSE_ID}/staff`], ["GET", `/api/warehouses/${WAREHOUSE_ID_2}/staff`]]),
      expectEqual("kho", [one.warehouseCode, one.region], ["GZ-01", "CN"]),
      expectEqual("nhân viên", one.staff.map((m) => [m.userId, m.assignedByName, m.note]), [[STAFF_USER_ID, "Admin", null]]),
      expectEqual("rỗng", empty.staff, []),
    );
  });

  /* ---------- Sơ đồ kho Admin (warehouseAdminService, adminService re-export) ---------- */

  const WH_ZONE_ID = "a1a1a1a1-0000-4000-8000-000000000001";
  const WH_SHELF_ID = "b2b2b2b2-0000-4000-8000-000000000002";
  const WH_BIN_ID = "c3c3c3c3-0000-4000-8000-000000000003";
  const WH_LAYOUT_ID = "d4d4d4d4-0000-4000-8000-000000000004";
  const WH_LOCATION_ROW = {
    locationId: WH_BIN_ID, binCode: "B01", shelfId: WH_SHELF_ID, shelfCode: "S01", zoneId: WH_ZONE_ID,
    zoneName: "Khu lưu kho A", zoneType: "storage", warehouseId: WAREHOUSE_ID, warehouseName: "Kho Quảng Châu (Trung Quốc)",
    maxVolume: 500000, maxWeight: 100, isActive: true, note: "",
  };

  await check("Sơ đồ kho Admin: adminService re-export ĐÚNG hàm thật của warehouseAdminService, file adminService không import httpClient", () => {
    const names = [
      "getWarehouses", "createWarehouse", "updateWarehouse", "deleteWarehouse",
      "getWarehouseLocations", "getActiveWarehouseLocations", "createWarehouseLocation", "updateWarehouseLocation", "deleteWarehouseLocation",
      "getWarehouseLayout", "getWarehouseLayoutZones", "getWarehouseLayoutStatus",
      "createWarehouseLayoutItem", "updateWarehouseLayoutItem", "deleteWarehouseLayoutItem",
      "getInventories", "getWarehouseInventories",
    ];
    const source = fs.readFileSync(path.join(ROOT, "src/features/admin/api/adminService.js"), "utf8");
    return all(
      expectEqual("hàm khác tham chiếu", names.filter((name) => adminSvc[name] !== warehouseAdmin[name]), []),
      expectTrue("adminService không dính httpClient", !/\bhttpClient\b|from\s*"axios"/.test(source.replace(/\/\*[\s\S]*?\*\//g, ""))),
    );
  });

  await check("Sơ đồ kho Admin: GET /api/warehouses bóc { items } + lọc loại kho tại chỗ; ô kệ { items } → id = locationId, zoneType viết hoa", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/warehouses", reply: () => ok({ items: [
        { id: WAREHOUSE_ID, name: "Kho Quảng Châu (Trung Quốc)", code: "KHO_QUANG_CHAU", address: "Quảng Châu", region: "CN", warehouseType: "ORIGIN", isActive: true },
        { id: "w2", name: "Kho Hà Nội", code: "KHO_HN", region: "VN", warehouseType: "DESTINATION", isActive: true },
      ] }) },
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/locations`, reply: () => ok({ items: [WH_LOCATION_ROW] }) },
    ];
    const origin = await adminSvc.getWarehouses({ warehouseType: "origin", isActive: true });
    const locations = await adminSvc.getWarehouseLocations(WAREHOUSE_ID);
    const { resolved } = await rejection(adminSvc.getWarehouseLocations(""));
    return all(
      expectEqual("kho ORIGIN", origin.map((w) => [w.id, w.name, w.code, w.region]), [[WAREHOUSE_ID, "Kho Quảng Châu (Trung Quốc)", "KHO_QUANG_CHAU", "CN"]]),
      expectEqual("params kho", requests[0]?.params, { isActive: true }),
      expectEqual("ô kệ", [locations[0].id, locations[0].binId, locations[0].zoneType, locations[0].acceptsStorage, locations[0].shelfCode], [WH_BIN_ID, WH_BIN_ID, "STORAGE", true, "S01"]),
      expectEqual("thiếu mã kho không gọi mạng", [resolved, requests.length], [false, 2]),
    );
  });

  await check("Sơ đồ kho Admin: thêm ô kệ — khu MỚI gửi zoneType, khu cũ không gửi; loại khu lạ chặn tại chỗ; PUT/DELETE /api/warehouse-locations/{id}", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "POST", url: `/api/warehouses/${WAREHOUSE_ID}/locations`, reply: (req) => ok({ ...WH_LOCATION_ROW, zoneName: req.body.zoneName, binCode: req.body.binCode }, 201) },
      { method: "PUT", url: `/api/warehouse-locations/${WH_BIN_ID}`, reply: (req) => ok({ ...WH_LOCATION_ROW, isActive: req.body.isActive }) },
      { method: "DELETE", url: `/api/warehouse-locations/${WH_BIN_ID}`, reply: () => ok({ message: "Xóa vị trí kho thành công." }) },
    ];
    const created = await adminSvc.createWarehouseLocation(WAREHOUSE_ID, { zoneName: " Khu mới ", zoneType: "storage", shelfCode: "S09", binCode: "B99", maxVolume: 300000, maxWeight: 50, isActive: true, note: " x " });
    await adminSvc.createWarehouseLocation(WAREHOUSE_ID, { zoneName: "Khu lưu kho A", shelfCode: "S01", binCode: "B02", maxVolume: 300000, maxWeight: 50, note: "y" });
    const updated = await adminSvc.updateWarehouseLocation(WH_BIN_ID, { zoneName: "Khu lưu kho A", shelfCode: "S01", binCode: "B01", maxVolume: 300000, maxWeight: 50, isActive: false, note: "z" });
    const removed = await adminSvc.deleteWarehouseLocation(WH_BIN_ID);
    const before = requests.length;
    const { resolved } = await rejection(adminSvc.createWarehouseLocation(WAREHOUSE_ID, { zoneName: "K", zoneType: "KHO_LA", shelfCode: "S", binCode: "B" }));
    return all(
      expectEqual("body khu mới", requests[0]?.body, { zoneName: "Khu mới", zoneType: "STORAGE", shelfCode: "S09", binCode: "B99", maxVolume: 300000, maxWeight: 50, isActive: true, note: "x" }),
      expectTrue("khu cũ không gửi zoneType", requests[1]?.body && !("zoneType" in requests[1].body)),
      expectEqual("kết quả", [created.id, created.binCode, updated.isActive, removed.success, removed.message], [WH_BIN_ID, "B99", false, true, "Xóa vị trí kho thành công."]),
      expectEqual("loại khu lạ không gọi mạng", [resolved, requests.length], [false, before]),
    );
  });

  await check("Sơ đồ kho Admin: layout / layout/zones / layout/status bóc { data }, đổi rowIndex→gridRow, displayLabel→label; status tổng hợp theo ô gắn bin", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/layout`, reply: () => ok({ message: "ok", data: [
        { id: WH_LAYOUT_ID, warehouseId: WAREHOUSE_ID, zoneId: WH_ZONE_ID, shelfId: WH_SHELF_ID, binId: WH_BIN_ID, rowIndex: 0, columnIndex: 2, displayLabel: "B01", layoutType: "BIN", status: "INACTIVE", zoneName: "Khu lưu kho A", shelfCode: "S01", binCode: "B01" },
      ] }) },
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/layout/zones`, reply: () => ok({ message: "ok", data: [
        { zoneId: WH_ZONE_ID, zoneCode: "", zoneName: "Khu lưu kho A", zoneType: "STORAGE", status: "ACTIVE", shelves: [{ shelfId: WH_SHELF_ID, shelfCode: "S01", bins: [{ binId: WH_BIN_ID, binCode: "B01", status: "ACTIVE", maxVolume: 500000, maxWeight: 100 }, { binId: "x", binCode: "B02", status: "INACTIVE", maxVolume: 1000, maxWeight: 1 }] }] },
        { zoneId: "z2", zoneCode: "RCV", zoneName: "Khu nhận", zoneType: "RECEIVING", status: "ACTIVE", shelves: [] },
      ] }) },
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/layout/status`, reply: () => ok({ message: "ok", data: [
        { layoutId: WH_LAYOUT_ID, binId: WH_BIN_ID, status: "FULL", currentItemCount: 3, currentWeight: 99, utilizationRate: 1.2 },
        { layoutId: "l2", binId: "b2", status: "AVAILABLE", currentItemCount: 0, currentWeight: 0, utilizationRate: 0 },
        { layoutId: "l3", binId: null, status: "AVAILABLE", currentItemCount: 0 },
      ] }) },
    ];
    const [layout] = await adminSvc.getWarehouseLayout(WAREHOUSE_ID);
    const zones = await adminSvc.getWarehouseLayoutZones(WAREHOUSE_ID);
    const status = await adminSvc.getWarehouseLayoutStatus(WAREHOUSE_ID);
    return all(
      expectEqual("ô sơ đồ", [layout.id, layout.label, layout.gridRow, layout.gridColumn, layout.zoneCode, layout.isActive], [WH_LAYOUT_ID, "B01", 0, 2, "Khu lưu kho A", false]),
      expectEqual("cây khu", [zones.totalZones, zones.totalShelves, zones.totalBins, zones.zones[0].zoneCode, zones.zones[0].activeBins, zones.zones[1].shelfCount], [2, 1, 2, "Khu lưu kho A", 1, 0]),
      expectEqual("trạng thái", [status.items.length, status.binLayoutItems, status.fullBins, status.occupiedBins, status.occupancyRate, status.totalItemCount], [3, 2, 1, 1, 50, 3]),
    );
  });

  await check("Sơ đồ kho Admin: thêm ô sơ đồ — mã khu → zoneId, nhãn trùng mã ô → BIN; khu không có thì báo lỗi, KHÔNG POST; sửa giữ liên kết cũ; xoá DELETE", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/zones`, reply: () => ok({ message: "ok", data: [{ zoneId: WH_ZONE_ID, zoneCode: "", zoneName: "Khu lưu kho A", zoneType: "STORAGE" }] }) },
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/locations`, reply: () => ok({ items: [WH_LOCATION_ROW] }) },
      { method: "POST", url: `/api/warehouses/${WAREHOUSE_ID}/layout`, reply: (req) => ok({ message: "ok", data: { id: WH_LAYOUT_ID, ...req.body } }, 201) },
      { method: "GET", url: `/api/warehouses/${WAREHOUSE_ID}/layout`, reply: () => ok({ message: "ok", data: [
        { id: WH_LAYOUT_ID, zoneId: WH_ZONE_ID, shelfId: WH_SHELF_ID, binId: WH_BIN_ID, rowIndex: 1, columnIndex: 1, displayLabel: "B01", layoutType: "BIN", status: "ACTIVE", width: 2, height: 1, colorCode: "#fff", zoneName: "Khu lưu kho A", binCode: "B01" },
      ] }) },
      { method: "PUT", url: `/api/warehouses/${WAREHOUSE_ID}/layout/${WH_LAYOUT_ID}`, reply: (req) => ok({ message: "ok", data: { id: WH_LAYOUT_ID, ...req.body } }) },
      { method: "DELETE", url: `/api/warehouses/${WAREHOUSE_ID}/layout/${WH_LAYOUT_ID}`, reply: () => ok({ message: "Xóa vị trí sơ đồ kho thành công." }) },
    ];
    const created = await adminSvc.createWarehouseLayoutItem(WAREHOUSE_ID, { zoneCode: "khu lưu kho a", label: "b01", gridRow: 0, gridColumn: 3, isActive: true });
    const postBody = requests.find((r) => r.method === "POST")?.body;
    const before = requests.length;
    const missing = await rejection(adminSvc.createWarehouseLayoutItem(WAREHOUSE_ID, { zoneCode: "Khu Z", label: "X", gridRow: 1, gridColumn: 1 }));
    const postsAfterMissing = requests.slice(before).filter((r) => r.method === "POST").length;
    await adminSvc.updateWarehouseLayoutItem(WAREHOUSE_ID, WH_LAYOUT_ID, { zoneCode: "Khu lưu kho A", label: "B01", gridRow: 4, gridColumn: 5, isActive: false });
    const putBody = requests.find((r) => r.method === "PUT")?.body;
    const removed = await adminSvc.deleteWarehouseLayoutItem(WAREHOUSE_ID, WH_LAYOUT_ID);
    return all(
      expectEqual("body POST", postBody, { zoneId: WH_ZONE_ID, shelfId: WH_SHELF_ID, binId: WH_BIN_ID, rowIndex: 0, columnIndex: 3, displayLabel: "b01", layoutType: "BIN", status: "ACTIVE", width: null, height: null, colorCode: null }),
      expectEqual("kết quả tạo", [created.label, created.gridColumn], ["b01", 3]),
      expectEqual("khu không có", [missing.resolved, postsAfterMissing, /Khu Z/.test(missing.error?.message || "")], [false, 0, true]),
      expectEqual("body PUT", putBody, { zoneId: WH_ZONE_ID, shelfId: WH_SHELF_ID, binId: WH_BIN_ID, rowIndex: 4, columnIndex: 5, displayLabel: "B01", layoutType: "BIN", status: "INACTIVE", width: 2, height: 1, colorCode: "#fff" }),
      expectEqual("xoá", [removed.success, removed.message], [true, "Xóa vị trí sơ đồ kho thành công."]),
    );
  });

  await check("Sơ đồ kho Admin: GET /api/inventories?warehouseId= bóc { items }, bỏ RELEASED khi không lọc status; lỗi 403 ném nguyên dạng axios", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/inventories", reply: (req) => (req.params?.warehouseId === "forbidden" ? fail(403, { message: "Không có quyền." }) : ok({ message: "ok", items: [
        { inventoryId: "i1", binId: WH_BIN_ID, binCode: "B01", status: "AVAILABLE", quantity: 1, packageCode: "PCL-1", actualVolume: 1000 },
        { inventoryId: "i2", binId: WH_BIN_ID, binCode: "B01", status: "released", quantity: 1, packageCode: "PCL-2" },
      ] })) },
    ];
    const rows = await adminSvc.getInventories({ warehouseId: WAREHOUSE_ID });
    const withReleased = await adminSvc.getWarehouseInventories(WAREHOUSE_ID, { includeReleased: true });
    const { resolved, error } = await rejection(adminSvc.getInventories({ warehouseId: "forbidden" }));
    return all(
      expectEqual("params", requests[0]?.params, { warehouseId: WAREHOUSE_ID }),
      expectEqual("bỏ RELEASED", rows.map((r) => [r.id, r.binId, r.status]), [["i1", WH_BIN_ID, "AVAILABLE"]]),
      expectEqual("includeReleased", withReleased.length, 2),
      expectEqual("403", [resolved, error?.response?.status, error?.response?.data?.message], [false, 403, "Không có quyền."]),
    );
  });

  /* ---------- Danh mục nền Admin (catalogAdminService, adminService re-export) ---------- */

  const CAT_ID = "e5e5e5e5-0000-4000-8000-000000000005";
  const CAT_CARRIER_ID = "f6f6f6f6-0000-4000-8000-000000000006";
  const CATALOG_NAMES = [
    "ShippingMethod", "PackageConfiguration", "AdditionalServiceFee", "ServicePricing", "PricingRule",
    "RestrictedItem", "ProductType", "UnitOfMeasure", "Supplier", "ShippingRoute", "ExchangeRate",
  ].flatMap((name) => [`create${name}`, `update${name}`, `delete${name}`, `get${name}Detail`]).concat([
    "getShippingMethods", "getPackageConfigurations", "getAdditionalServiceFees", "getServicePricings", "getPricingRules",
    "getRestrictedItems", "getProductTypes", "getUnitsOfMeasure", "getSuppliers", "getShippingRoutes", "getExchangeRates",
  ]);

  await check("Danh mục Admin: adminService re-export ĐÚNG 55 hàm thật của catalogAdminService, adminService không còn mock/httpClient", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/features/admin/api/adminService.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    return all(
      expectEqual("số hàm", CATALOG_NAMES.length, 55),
      expectEqual("hàm khác tham chiếu", CATALOG_NAMES.filter((name) => typeof catalogAdmin[name] !== "function" || adminSvc[name] !== catalogAdmin[name]), []),
      expectTrue("adminService không dính httpClient", !/\bhttpClient\b|from\s*"axios"/.test(source)),
      expectTrue("adminService không còn đọc dữ liệu mẫu", !/@\/mocks\//.test(source)),
    );
  });

  await check("Danh mục Admin: phương thức vận chuyển — GET { data } → mảng; POST/PUT body đúng DTO; PUT chỉ { message } → không bịa bản ghi; DELETE 500 → hiện nguyên `error`", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/shipping-methods", reply: () => ok({ message: "ok", data: [{ id: CAT_ID, methodName: "Đường bộ", methodCode: "ROAD", estimatedTransitTime: "5-7 ngày", isActive: false, createdAt: "2026-09-01T00:00:00Z" }] }) },
      { method: "POST", url: "/api/shipping-methods", reply: (req) => ok({ message: "Tạo phương thức vận chuyển thành công.", data: { id: "new", ...req.body } }, 201) },
      { method: "PUT", url: `/api/shipping-methods/${CAT_ID}`, reply: () => ok({ message: "Cập nhật phương thức vận chuyển thành công." }) },
      { method: "DELETE", url: `/api/shipping-methods/${CAT_ID}`, reply: () => fail(500, { error: "An error occurred while saving the entity changes.", status: 500 }) },
    ];
    const list = await adminSvc.getShippingMethods();
    const created = await adminSvc.createShippingMethod({ methodName: " Đường biển ", methodCode: "SEA", description: "", estimatedTransitTime: "20 ngày", applicableCondition: null, internalNote: " n ", isActive: true });
    const updated = await adminSvc.updateShippingMethod(CAT_ID, { methodName: "Đường bộ", methodCode: "ROAD", isActive: false });
    const removed = await rejection(adminSvc.deleteShippingMethod(CAT_ID));
    return all(
      expectEqual("danh sách", list.map((m) => [m.id, m.methodCode, m.isActive]), [[CAT_ID, "ROAD", false]]),
      expectEqual("body POST", requests[1]?.body, { methodName: "Đường biển", methodCode: "SEA", description: null, estimatedTransitTime: "20 ngày", applicableCondition: null, isActive: true, internalNote: "n" }),
      expectEqual("tạo", [created.id, created.methodCode], ["new", "SEA"]),
      expectEqual("body PUT", requests[2]?.body, { methodName: "Đường bộ", methodCode: "ROAD", description: null, estimatedTransitTime: null, applicableCondition: null, isActive: false, internalNote: null }),
      expectEqual("kết quả PUT", updated, { id: CAT_ID, success: true, message: "Cập nhật phương thức vận chuyển thành công." }),
      expectEqual("xoá đang dùng", [removed.resolved, adminSvc.getAdminApiError(removed.error, "x")], [false, "An error occurred while saving the entity changes."]),
    );
  });

  await check("Danh mục Admin: cấu hình đóng gói — GET mảng trần; POST số + status; thiếu kích thước chặn tại chỗ; PUT { data } → chuẩn hoá; DELETE = ngừng sử dụng", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/package-configurations", reply: () => ok([{ id: CAT_ID, configCode: "BOX_S", configName: "Thùng S", length: 30, width: 20, height: 20, maxWeight: 5, packageFee: 15000, status: "ACTIVE" }]) },
      { method: "POST", url: "/api/package-configurations", reply: (req) => ok({ message: "Tạo cấu hình thùng thành công.", data: { id: "new", ...req.body } }, 201) },
      { method: "PUT", url: `/api/package-configurations/${CAT_ID}`, reply: (req) => ok({ message: "ok", data: { id: CAT_ID, ...req.body } }) },
      { method: "DELETE", url: `/api/package-configurations/${CAT_ID}`, reply: () => ok({ message: "Đã ngưng sử dụng cấu hình thùng." }) },
    ];
    const list = await adminSvc.getPackageConfigurations();
    await adminSvc.createPackageConfiguration({ configCode: "BOX_M", configName: "Thùng M", length: "40", width: 30, height: 30, maxWeight: 10, packageFee: 0, status: "ACTIVE" });
    const before = requests.length;
    const missing = await rejection(adminSvc.createPackageConfiguration({ configCode: "X", configName: "X", length: null, width: 1, height: 1, maxWeight: 1, packageFee: 1 }));
    const afterMissing = requests.length;
    const updated = await adminSvc.updatePackageConfiguration(CAT_ID, { configCode: "BOX_S", configName: "Thùng S", length: 30, width: 20, height: 20, maxWeight: 5, packageFee: 16000, status: "INACTIVE" });
    const removed = await adminSvc.deletePackageConfiguration(CAT_ID);
    return all(
      expectEqual("danh sách", list.map((c) => [c.id, c.configCode, c.packageFee, c.status]), [[CAT_ID, "BOX_S", 15000, "ACTIVE"]]),
      expectEqual("body POST", requests[1]?.body, { configCode: "BOX_M", configName: "Thùng M", length: 40, width: 30, height: 30, maxWeight: 10, packageFee: 0, status: "ACTIVE" }),
      expectEqual("thiếu kích thước không gọi mạng", [missing.resolved, afterMissing], [false, before]),
      expectEqual("PUT", [requests.at(-2)?.method, updated.packageFee, updated.status], ["PUT", 16000, "INACTIVE"]),
      expectEqual("xoá", removed.message, "Đã ngưng sử dụng cấu hình thùng."),
    );
  });

  await check("Danh mục Admin: phí dịch vụ bổ sung — bảng RIÊNG /api/additional-service-fees (không ghi vào pricing-rules); activeOnly gửi backend, bộ lọc khác lọc tại chỗ", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/additional-service-fees", reply: () => ok({ message: "ok", data: [
        { id: CAT_ID, feeCode: "DEPOSIT_RATE", feeName: "Tỷ lệ cọc", calculationType: "PERCENTAGE", value: 30, unit: "%", isActive: true },
        { id: "f2", feeCode: "INSURANCE", feeName: "Bảo hiểm", calculationType: "FIXED", value: 10000, isActive: true },
      ] }) },
      { method: "POST", url: "/api/additional-service-fees", reply: (req) => ok({ message: "ok", data: { id: "new", ...req.body } }, 201) },
      { method: "PUT", url: `/api/additional-service-fees/${CAT_ID}`, reply: () => ok({ message: "Cập nhật cấu hình phí dịch vụ bổ sung thành công." }) },
    ];
    const pct = await adminSvc.getAdditionalServiceFees({ isActive: true, calculationType: "percentage" });
    await adminSvc.createAdditionalServiceFee({ feeName: "Phí kiểm đếm", feeCode: "COUNT_FEE", calculationType: "fixed", value: 5000, unit: "", description: "", isActive: true });
    const updated = await adminSvc.updateAdditionalServiceFee(CAT_ID, { feeName: "Tỷ lệ cọc", feeCode: "DEPOSIT_RATE", calculationType: "PERCENTAGE", value: 40, unit: "%", isActive: true });
    return all(
      expectEqual("params", requests[0]?.params, { activeOnly: true }),
      expectEqual("lọc tại chỗ", pct.map((f) => [f.id, f.value]), [[CAT_ID, 30]]),
      expectEqual("body POST", requests[1]?.body, { feeName: "Phí kiểm đếm", feeCode: "COUNT_FEE", calculationType: "FIXED", value: 5000, unit: null, isActive: true, description: null }),
      expectEqual("PUT đúng bảng", [requests[2]?.method, requests[2]?.url, requests[2]?.body?.value, updated.success], ["PUT", `/api/additional-service-fees/${CAT_ID}`, 40, true]),
      expectTrue("không đụng pricing-rules", !requests.some((r) => r.url.includes("pricing-rules"))),
    );
  });

  await check("Danh mục Admin: bảng giá dịch vụ — GET dùng servicePricingService thật; POST carrierId rỗng → null, currency viết hoa; PUT /api/service-pricings/{id}", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/service-pricings", reply: () => ok([{ id: SERVICE_PRICING_ID, carrierId: null, serviceType: "EXPRESS", originCountry: "CN", destinationCountry: "VN", unitType: "KG", price: 45000, currency: "VND", effectiveDate: "2026-09-01T00:00:00Z", boxPricingRules: [] }]) },
      { method: "POST", url: "/api/service-pricings", reply: (req) => ok({ id: "new", ...req.body, boxPricingRules: [] }, 201) },
      { method: "PUT", url: `/api/service-pricings/${SERVICE_PRICING_ID}`, reply: () => ok({ message: "Cập nhật bảng giá dịch vụ thành công." }) },
    ];
    const list = await adminSvc.getServicePricings();
    await adminSvc.createServicePricing({ carrierId: "", serviceType: "STANDARD", originCountry: "CN", destinationCountry: "VN", unitType: "KG", price: 30000, currency: "vnd", effectiveDate: "2026-10-01T00:00:00.000Z" });
    await adminSvc.updateServicePricing(SERVICE_PRICING_ID, { carrierId: CAT_CARRIER_ID, serviceType: "EXPRESS", originCountry: "CN", destinationCountry: "VN", unitType: "KG", price: 46000, currency: "VND", effectiveDate: null });
    return all(
      expectEqual("danh sách", list.map((p) => [p.id, p.serviceType, p.price]), [[SERVICE_PRICING_ID, "EXPRESS", 45000]]),
      expectEqual("body POST", requests[1]?.body, { carrierId: null, serviceType: "STANDARD", originCountry: "CN", destinationCountry: "VN", unitType: "KG", price: 30000, currency: "VND", effectiveDate: "2026-10-01T00:00:00.000Z" }),
      expectEqual("body PUT", [requests[2]?.url, requests[2]?.body?.carrierId, requests[2]?.body?.effectiveDate], [`/api/service-pricings/${SERVICE_PRICING_ID}`, CAT_CARRIER_ID, null]),
    );
  });

  await check("Danh mục Admin: quy tắc tính giá — POST/PUT /api/pricing-rules body đủ DTO; thiếu giá trị chặn tại chỗ; lỗi 400 ValidationProblemDetails hiện câu tiếng Việt trong `errors`", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/pricing-rules", reply: () => ok([{ id: INSPECTION_RULE_ID, ruleCode: "INSPECTION", ruleName: "Kiểm hàng", ruleType: "INSPECTION", calculationType: "FIXED", value: 20000, status: "ACTIVE" }]) },
      { method: "POST", url: "/api/pricing-rules", reply: (req) => (req.body.ruleCode === "BAD" ? fail(400, { title: "One or more validation errors occurred.", status: 400, errors: { RuleName: ["Tên rule phụ phí không được quá 255 ký tự."] } }) : ok({ id: "new", ...req.body }, 201)) },
      { method: "PUT", url: `/api/pricing-rules/${INSPECTION_RULE_ID}`, reply: () => ok({ message: "Cập nhật cấu hình giá thành công." }) },
    ];
    const list = await adminSvc.getPricingRules();
    const created = await adminSvc.createPricingRule({ servicePricingId: "", ruleName: "Đóng gỗ", ruleCode: "WOOD_CRATE", ruleType: "WOODEN_BOX", conditionType: "", conditionValue: null, calculationType: "per_kg", value: 3000, minAmount: null, maxAmount: 500000, isRequired: false, status: "ACTIVE", description: "" });
    const before = requests.length;
    const missing = await rejection(adminSvc.createPricingRule({ ruleName: "x", ruleCode: "X", ruleType: "OTHER", calculationType: "FIXED", value: null }));
    const afterMissing = requests.length;
    const bad = await rejection(adminSvc.createPricingRule({ ruleName: "x", ruleCode: "BAD", ruleType: "OTHER", calculationType: "FIXED", value: 1 }));
    await adminSvc.updatePricingRule(INSPECTION_RULE_ID, { servicePricingId: SERVICE_PRICING_ID, ruleName: "Kiểm hàng", ruleCode: "INSPECTION", ruleType: "INSPECTION", calculationType: "FIXED", value: 25000, isRequired: true, status: "INACTIVE" });
    return all(
      expectEqual("danh sách", list.map((r) => [r.id, r.ruleCode, r.value]), [[INSPECTION_RULE_ID, "INSPECTION", 20000]]),
      expectEqual("body POST", requests[1]?.body, { servicePricingId: null, ruleName: "Đóng gỗ", ruleCode: "WOOD_CRATE", ruleType: "WOODEN_BOX", conditionType: null, conditionValue: null, calculationType: "PER_KG", value: 3000, minAmount: null, maxAmount: 500000, isRequired: false, status: "ACTIVE", description: null }),
      expectEqual("tạo", [created.id, created.ruleCode], ["new", "WOOD_CRATE"]),
      expectEqual("thiếu giá trị không gọi mạng", [missing.resolved, afterMissing], [false, before]),
      expectEqual("lỗi 400", adminSvc.getAdminApiError(bad.error, "x"), "Tên rule phụ phí không được quá 255 ký tự."),
      expectEqual("body PUT", [requests.at(-1)?.method, requests.at(-1)?.body?.servicePricingId, requests.at(-1)?.body?.status, requests.at(-1)?.body?.isRequired], ["PUT", SERVICE_PRICING_ID, "INACTIVE", true]),
    );
  });

  await check("Danh mục Admin: hàng cấm — GET/POST/PUT /api/restricted-items; mức kiểm soát lạ chặn tại chỗ", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/restricted-items", reply: () => ok([{ id: CAT_ID, itemName: "Pin lithium", country: "VN", restrictionType: "restricted", note: null, isActive: true }]) },
      { method: "POST", url: "/api/restricted-items", reply: (req) => ok({ id: "new", ...req.body }, 201) },
      { method: "PUT", url: `/api/restricted-items/${CAT_ID}`, reply: () => ok({ message: "Cập nhật mặt hàng thành công." }) },
    ];
    const list = await adminSvc.getRestrictedItems();
    await adminSvc.createRestrictedItem({ itemName: " Dao ", country: "", restrictionType: "banned", note: "", isActive: true });
    const before = requests.length;
    const badType = await rejection(adminSvc.createRestrictedItem({ itemName: "x", restrictionType: "CAM" }));
    const afterBadType = requests.length;
    const updated = await adminSvc.updateRestrictedItem(CAT_ID, { itemName: "Pin lithium", country: "VN", restrictionType: "WARNING", note: "n", isActive: false });
    return all(
      expectEqual("danh sách", list.map((i) => [i.id, i.restrictionType, i.note]), [[CAT_ID, "RESTRICTED", ""]]),
      expectEqual("body POST", requests[1]?.body, { itemName: "Dao", country: null, restrictionType: "BANNED", note: null, isActive: true }),
      expectEqual("loại lạ không gọi mạng", [badType.resolved, afterBadType], [false, before]),
      expectEqual("PUT", [requests.at(-1)?.body, updated.message], [{ itemName: "Pin lithium", country: "VN", restrictionType: "WARNING", note: "n", isActive: false }, "Cập nhật mặt hàng thành công."]),
    );
  });

  await check("Ảnh tiếp nhận kho VN — GET /api/parcel-inspections trả photos[]; toàn cảnh lô ghép arrivalPhotos của lô (kể cả kiện chưa đếm); backend cũ thiếu trường → mảng rỗng", async () => {
    resetState({ token: "tok" });
    const SHIP = "5a1e0000-0000-0000-0000-00000000aa01";
    const P1 = "5a1e0000-0000-0000-0000-00000000bb01";
    const P2 = "5a1e0000-0000-0000-0000-00000000bb02";
    const photo = (id, entityId) => ({
      id,
      entityType: "PARCEL",
      entityId,
      documentType: "VN_ARRIVAL_PROOF",
      fileName: "anh.jpg",
      contentType: "image/jpeg",
      downloadUrl: `/api/attachments/${id}/download`,
    });
    routes = [
      {
        method: "GET",
        url: "/api/parcel-inspections",
        reply: () =>
          ok({
            message: "Lấy biên bản kiểm đếm thành công.",
            data: {
              summary: { total: 1, withDiscrepancy: 1, recentDiscrepancy: 1, damagedParcels: 1 },
              items: [{ inspectionId: "i1", parcelId: P1, packageCode: "PCL-1", shipmentId: SHIP, hasDiscrepancy: true, photos: [photo("f1", P1)] }],
            },
          }),
      },
      {
        method: "GET",
        url: `/api/international-shipments/${SHIP}`,
        reply: () =>
          ok({
            message: "ok",
            data: {
              shipmentId: SHIP,
              shipmentCode: "INTL-1",
              arrivalPhotos: [],
              parcels: [
                { parcelId: P1, packageCode: "PCL-1", weight: 2, arrivalPhotos: [photo("f1", P1)] },
                { parcelId: P2, packageCode: "PCL-2", weight: 1 },
              ],
            },
          }),
      },
    ];
    const list = await inspection.listParcelInspections({ onlyDiscrepancy: true });
    const overview = await inspection.getShipmentInspectionOverview(SHIP);
    return all(
      expectEqual("params", requests[0]?.params, { onlyDiscrepancy: true }),
      expectEqual("ảnh biên bản", list.items[0].photos.map((p) => [p.id, p.documentType]), [["f1", "VN_ARRIVAL_PROOF"]]),
      expectEqual("ảnh theo kiện trong lô", overview.parcels.map((p) => [p.packageCode, p.photos.length]), [["PCL-1", 1], ["PCL-2", 0]]),
      expectEqual("nhãn loại giấy tờ", attachmentSvc.getDocumentTypeLabel("VN_ARRIVAL_PROOF"), "Ảnh tiếp nhận kho VN"),
      expectTrue("ảnh là ảnh", attachmentSvc.isImageAttachment(list.items[0].photos[0])),
    );
  });

  await check("Danh mục Admin: loại hàng — GET /api/product-types/all; POST /api/product-types; PUT/DELETE /{id}; lỗi 400 khi xoá hiện nguyên câu backend", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/product-types/all", reply: () => ok({ message: "ok", data: [{ id: CAT_ID, name: "Điện tử", importTaxRate: 10, isActive: false }] }) },
      { method: "POST", url: "/api/product-types", reply: (req) => ok({ message: "Thêm loại hàng thành công.", data: { id: "new", ...req.body } }, 201) },
      { method: "PUT", url: `/api/product-types/${CAT_ID}`, reply: () => ok({ message: "Cập nhật loại hàng thành công." }) },
      { method: "DELETE", url: `/api/product-types/${CAT_ID}`, reply: () => fail(400, { message: "Loại hàng đã được ngừng sử dụng trước đó." }) },
    ];
    const list = await adminSvc.getProductTypes();
    const created = await adminSvc.createProductType({ name: "Mỹ phẩm", importTaxRate: null, isActive: true });
    await adminSvc.updateProductType(CAT_ID, { name: "Điện tử", importTaxRate: "12.5", isActive: true });
    const removed = await rejection(adminSvc.deleteProductType(CAT_ID));
    return all(
      expectEqual("danh sách", list.map((p) => [p.id, p.name, p.importTaxRate, p.isActive]), [[CAT_ID, "Điện tử", 10, false]]),
      expectEqual("body POST", [requests[1]?.url, requests[1]?.body], ["/api/product-types", { name: "Mỹ phẩm", importTaxRate: null, isActive: true }]),
      expectEqual("tạo", created.id, "new"),
      expectEqual("body PUT", requests[2]?.body, { name: "Điện tử", importTaxRate: 12.5, isActive: true }),
      expectEqual("xoá", [removed.resolved, adminSvc.getAdminApiError(removed.error, "x")], [false, "Loại hàng đã được ngừng sử dụng trước đó."]),
    );
  });

  await check("Danh mục Admin: đơn vị tính — GET /api/units-of-measure/all; mô tả trống gửi \"\" (không null), thứ tự trống KHÔNG gửi", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/units-of-measure/all", reply: () => ok({ message: "ok", data: [{ id: CAT_ID, unitCode: "PCS", unitName: "Cái", description: "", displayOrder: 1, isActive: true }] }) },
      { method: "POST", url: "/api/units-of-measure", reply: (req) => ok({ message: "ok", data: { id: "new", ...req.body } }, 201) },
      { method: "PUT", url: `/api/units-of-measure/${CAT_ID}`, reply: () => ok({ message: "Cập nhật đơn vị tính thành công." }) },
    ];
    const list = await adminSvc.getUnitsOfMeasure();
    await adminSvc.createUnitOfMeasure({ unitCode: "BOX", unitName: "Hộp", description: null, displayOrder: null, isActive: true });
    await adminSvc.updateUnitOfMeasure(CAT_ID, { unitCode: "PCS", unitName: "Cái", description: " d ", displayOrder: 3, isActive: false });
    return all(
      expectEqual("danh sách", list.map((u) => [u.id, u.unitCode, u.displayOrder]), [[CAT_ID, "PCS", 1]]),
      expectEqual("body POST", requests[1]?.body, { unitCode: "BOX", unitName: "Hộp", description: "", isActive: true }),
      expectEqual("body PUT", requests[2]?.body, { unitCode: "PCS", unitName: "Cái", description: "d", displayOrder: 3, isActive: false }),
    );
  });

  await check("Danh mục Admin: nhà cung cấp — GET { data }; POST chuỗi rỗng thay null, email sai chặn tại chỗ; PUT /api/suppliers/{id}", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/suppliers", reply: () => ok({ message: "ok", data: [{ id: CAT_ID, supplierCode: "NCC01", supplierName: "Trung chuyển A", supplierType: "transit", country: "CN", isActive: true }] }) },
      { method: "POST", url: "/api/suppliers", reply: (req) => ok({ message: "ok", data: { id: "new", ...req.body } }, 201) },
      { method: "PUT", url: `/api/suppliers/${CAT_ID}`, reply: () => ok({ message: "Cập nhật nhà cung cấp thành công." }) },
    ];
    const list = await adminSvc.getSuppliers();
    await adminSvc.createSupplier({ supplierCode: "NCC02", supplierName: "Lấy hàng B", supplierType: "pickup", country: null, contactPerson: null, phone: null, email: "b@ncc.vn", address: null, note: null, isActive: true });
    const before = requests.length;
    const badEmail = await rejection(adminSvc.createSupplier({ supplierCode: "X", supplierName: "X", supplierType: "GOODS", email: "" }));
    const afterBadEmail = requests.length;
    await adminSvc.updateSupplier(CAT_ID, { supplierCode: "NCC01", supplierName: "Trung chuyển A", supplierType: "TRANSIT", country: "CN", email: "a@ncc.cn", isActive: false });
    return all(
      expectEqual("danh sách", list.map((s) => [s.id, s.supplierType]), [[CAT_ID, "TRANSIT"]]),
      expectEqual("body POST", requests[1]?.body, { supplierCode: "NCC02", supplierName: "Lấy hàng B", supplierType: "PICKUP", country: "", contactPerson: "", phone: "", email: "b@ncc.vn", address: "", note: "", isActive: true }),
      expectEqual("email sai không gọi mạng", [badEmail.resolved, afterBadEmail], [false, before]),
      expectEqual("PUT", [requests.at(-1)?.url, requests.at(-1)?.body?.isActive], [`/api/suppliers/${CAT_ID}`, false]),
    );
  });

  await check("Danh mục Admin: tuyến vận chuyển qua adminService → transportCatalogService (GET không kèm params, POST đủ hai kho)", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/shipping-routes", reply: () => ok({ message: "ok", data: [{ id: CAT_ID, routeCode: "CN-VN", routeName: "Quảng Châu → Hà Nội", originWarehouseId: WAREHOUSE_ID, destinationWarehouseId: "w2" }] }) },
      { method: "POST", url: "/api/shipping-routes", reply: (req) => ok({ message: "ok", data: { id: "new", ...req.body } }, 201) },
      { method: "DELETE", url: `/api/shipping-routes/${CAT_ID}`, reply: () => ok({ message: "Xóa tuyến vận chuyển thành công." }) },
    ];
    const list = await adminSvc.getShippingRoutes({ signal: new AbortController().signal });
    await adminSvc.createShippingRoute({ routeCode: "CN-VN2", routeName: "Tuyến 2", originCountry: "CN", destinationCountry: "VN", transportMode: "road", originWarehouseId: WAREHOUSE_ID, destinationWarehouseId: "w2", isActive: true });
    const removed = await adminSvc.deleteShippingRoute(CAT_ID);
    return all(
      expectEqual("danh sách", list.map((r) => [r.id, r.routeCode]), [[CAT_ID, "CN-VN"]]),
      expectEqual("GET không params (signal không lọt vào query)", requests[0]?.params, {}),
      expectEqual("body POST", [requests[1]?.body?.transportMode, requests[1]?.body?.originWarehouseId], ["ROAD", WAREHOUSE_ID]),
      expectEqual("xoá", [removed.id, removed.message], [CAT_ID, "Xóa tuyến vận chuyển thành công."]),
    );
  });

  await check("Danh mục Admin: tỷ giá — GET mặc định lấy cả tỷ giá tắt; POST có mã, PUT KHÔNG gửi mã; trùng mã 400 hiện nguyên câu; DELETE 204", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/exchange-rates", reply: (req) => ok([{ id: CAT_ID, currencyCode: "cny", currencyName: "Nhân dân tệ", rateToVnd: 3500, isActive: true }, ...(req.params?.activeOnly ? [] : [{ id: "r2", currencyCode: "THB", rateToVnd: 700, isActive: false }])]) },
      { method: "POST", url: "/api/exchange-rates", reply: (req) => (req.body.currencyCode === "CNY" ? fail(400, { message: "Đã có cấu hình tỷ giá cho CNY. Vui lòng sửa bản ghi hiện có." }) : ok({ id: "new", ...req.body }, 201)) },
      { method: "PUT", url: `/api/exchange-rates/${CAT_ID}`, reply: (req) => ok({ id: CAT_ID, currencyCode: "CNY", ...req.body }) },
      { method: "DELETE", url: `/api/exchange-rates/${CAT_ID}`, reply: () => ok(null, 204) },
    ];
    const all_ = await adminSvc.getExchangeRates();
    const active = await adminSvc.getExchangeRates({ activeOnly: true });
    const created = await adminSvc.createExchangeRate({ currencyCode: " thb ", currencyName: "", rateToVnd: "700", isActive: true, note: "" });
    const dup = await rejection(adminSvc.createExchangeRate({ currencyCode: "CNY", rateToVnd: 3600 }));
    const updated = await adminSvc.updateExchangeRate(CAT_ID, { currencyCode: "USD", currencyName: "Nhân dân tệ", rateToVnd: 3550, isActive: true, note: "cập nhật" });
    const removed = await adminSvc.deleteExchangeRate(CAT_ID);
    return all(
      expectEqual("params", [requests[0]?.params, requests[1]?.params], [{}, { activeOnly: true }]),
      expectEqual("danh sách", [all_.length, active.length, all_[0].currencyCode, all_[1].isActive], [2, 1, "CNY", false]),
      expectEqual("body POST", requests[2]?.body, { currencyCode: "THB", currencyName: null, rateToVnd: 700, isActive: true, note: null }),
      expectEqual("tạo", [created.id, created.currencyCode], ["new", "THB"]),
      expectEqual("trùng mã", adminSvc.getAdminApiError(dup.error, "x"), "Đã có cấu hình tỷ giá cho CNY. Vui lòng sửa bản ghi hiện có."),
      expectEqual("body PUT không có mã", requests.find((r) => r.method === "PUT")?.body, { currencyName: "Nhân dân tệ", rateToVnd: 3550, isActive: true, note: "cập nhật" }),
      expectEqual("PUT trả bản ghi", [updated.currencyCode, updated.rateToVnd], ["CNY", 3550]),
      expectEqual("xoá 204", [removed.success, removed.message], [true, "Đã xoá tỷ giá."]),
    );
  });

  await check("PDF phiếu: GET /receipt responseType blob → Blob PDF; lỗi blob JSON → hiện message backend; link công khai đổi host", async () => {
    resetState({ token: "tok" });
    routes = [{ method: "GET", url: `/api/orders/consignments/${ORDER_ID}/receipt`, reply: (req, config) => (config.responseType === "blob" ? ok(new Blob(["%PDF-1.4"], { type: "application/pdf" })) : fail(400, { message: "thiếu blob" })) }];
    const blob = await receipt.getConsignmentReceiptApi(ORDER_ID);
    routes = [{ method: "GET", url: `/api/orders/consignments/${ORDER_ID}/receipt`, reply: () => fail(404, new Blob([JSON.stringify({ message: "Đơn chưa có phiếu." })], { type: "application/json" })) }];
    const { error } = await rejection(receipt.getConsignmentReceiptApi(ORDER_ID));
    const legacy = "https://api-vcl.zushin.io.vn/api/public/receipts/abc";
    return all(
      expectEqual("blob pdf", [blob instanceof Blob, blob.type], [true, "application/pdf"]),
      expectEqual("message backend", error?.message, "Đơn chưa có phiếu."),
      expectEqual("đổi host", receiptUrl.toPublicReceiptUrl(legacy), "https://api-vcl.vnlogistic.click/api/public/receipts/abc"),
      expectEqual("tải về", receiptUrl.toPublicReceiptUrl(legacy, { download: true }), "https://api-vcl.vnlogistic.click/api/public/receipts/abc?download=true"),
    );
  });

  /* ---------- Chat CSKH nhân viên: /api/conversations THẬT + upload ảnh thật ---------- */

  /*
   * Lỗi đã sửa (26/09/2026): conversationApi.js của admin-ui là MOCK → Sale không thấy tin
   * khách gửi từ web khách, trả lời cũng không tới khách. Response mẫu bám đúng
   * ConversationController / ConversationService / ConversationDtos của VCL_API.
   */
  const CHAT_ID = "c0a80101-7a1b-4c2d-8e3f-4a5b6c7d8e9f";
  const CHAT_ID_2 = "c0a80102-7a1b-4c2d-8e3f-4a5b6c7d8e9f";
  const CHAT_CUSTOMER_USER = "a1b2c3d4-0000-4000-8000-000000000001";
  const CHAT_SALE_USER = LOGIN_RESPONSE.userId;
  const chatFile = (name, type, size = 3) => new File([new Uint8Array(size)], name, { type });
  const chatDto = (extra = {}) => ({
    id: CHAT_ID,
    customerId: "b1b2c3d4-0000-4000-8000-000000000002",
    customerName: "Nguyễn Văn A",
    customerCode: "KH0001",
    salesId: null,
    salesName: null,
    relatedType: "CONSIGNMENT",
    relatedId: ORDER_ID,
    relatedCode: ORDER_ROW.consignmentCode,
    status: "OPEN",
    createdAt: "2026-09-26T01:00:00",
    updatedAt: "2026-09-26T01:05:00",
    unreadCount: 0,
    messages: [],
    ...extra,
  });

  await check("Chat CSKH (Sale): GET /api/conversations mảng trần → hộp thư có khách, mã đơn THẬT, số tin chưa đọc, tóm tắt; không có khoá messages/data", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: "/api/conversations",
        reply: () => ok([
          chatDto({ unreadCount: 2 }),
          chatDto({ id: CHAT_ID_2, relatedType: null, relatedId: null, relatedCode: null, salesId: CHAT_SALE_USER, salesName: "Nguyễn Văn Sale", unreadCount: 0 }),
        ]),
      },
    ];
    const list = await conversation.getConversationsApi();
    const [linked, general] = list;
    const groups = chatHelpers.buildConversationGroups(list);
    return all(
      expectEqual("request", `${requests[0]?.method} ${requests[0]?.url} ${requests[0]?.authorization}`, "GET /api/conversations Bearer tok"),
      expectEqual("tiêu đề = tên khách", [chatHelpers.getConversationTitle(linked), chatHelpers.getConversationTitle(general)], ["Nguyễn Văn A", "Nguyễn Văn A"]),
      expectEqual("liên kết đơn in đủ mã thật", chatHelpers.getConversationSubtitle(linked), "Yêu cầu ký gửi · VCL-20260917161921-540135"),
      expectEqual("hội thoại chung", chatHelpers.getConversationSubtitle(general), "Yêu cầu hỗ trợ chung"),
      expectEqual("chưa đọc", [chatHelpers.getUnreadCount(linked), groups[0]?.unreadCount], [2, 2]),
      expectEqual("tóm tắt", [linked.lastMessage, general.lastMessage], ["2 tin nhắn mới từ khách hàng", "Đang trao đổi với khách hàng"]),
      expectEqual("nhân viên", [linked.staffName, general.staffName], [null, "Nguyễn Văn Sale"]),
      expectEqual("không có khoá messages/data", ["messages" in linked, "data" in linked], [false, false])
    );
  });

  await check("Chat CSKH (Sale): chi tiết — tin khách mang tên khách, tin Sale là của mình, tin chỉ có ảnh ẩn câu thay thế; relatedCode null KHÔNG hiện GUID; id sai → 404 không gọi mạng", async () => {
    resetState({ token: "tok" });
    routes = [
      {
        method: "GET",
        url: `/api/conversations/${CHAT_ID}`,
        reply: () => ok(chatDto({
          salesId: CHAT_SALE_USER,
          salesName: "Nguyễn Văn Sale",
          messages: [
            { id: "m1", conversationId: CHAT_ID, senderId: CHAT_CUSTOMER_USER, senderRole: "Customer", content: "Đơn của tôi tới đâu rồi?", attachmentUrl: null, isRead: true, createdAt: "2026-09-26T01:00:00" },
            { id: "m2", conversationId: CHAT_ID, senderId: CHAT_CUSTOMER_USER, senderRole: "Customer", content: "Đã gửi một hình ảnh", attachmentUrl: "https://res.cloudinary.test/vcl/a.jpg", isRead: true, createdAt: "2026-09-26T01:01:00" },
            { id: "m3", conversationId: CHAT_ID, senderId: CHAT_SALE_USER, senderRole: "Sale", content: "Hàng đang ở kho VN.", attachmentUrl: null, isRead: false, createdAt: "2026-09-26T01:05:00" },
          ],
        })),
      },
      { method: "GET", url: `/api/conversations/${CHAT_ID_2}`, reply: () => ok(chatDto({ id: CHAT_ID_2, relatedCode: null })) },
    ];
    const detail = await conversation.getConversationDetailApi(CHAT_ID);
    const orphan = await conversation.getConversationDetailApi(CHAT_ID_2);
    const beforeBad = requests.length;
    const bad = await rejection(conversation.getConversationDetailApi("mock-0001"));
    const [first, image, sale] = detail.messages;
    return all(
      expectEqual("không bọc data/conversation", ["data" in detail, "conversation" in detail], [false, false]),
      expectEqual("tin khách", [chatHelpers.getMessageSenderName(first), chatHelpers.isMessageMine(first, CHAT_SALE_USER, "Sale")], ["Nguyễn Văn A", false]),
      expectEqual("tin chỉ có ảnh", [image.content, chatHelpers.getMessageAttachment(image)], ["", "https://res.cloudinary.test/vcl/a.jpg"]),
      expectEqual("tin Sale", [sale.senderName, chatHelpers.isMessageMine(sale, CHAT_SALE_USER, "Sale")], ["Nguyễn Văn Sale", true]),
      expectEqual("tóm tắt = tin cuối", detail.lastMessage, "Hàng đang ở kho VN."),
      expectEqual("AI nhận mã đơn thật", chatHelpers.buildAiContextFromConversation(detail)?.orderCode, ORDER_ROW.consignmentCode),
      expectEqual("mất mã đơn → không in GUID", [chatHelpers.getConversationSubtitle(orphan), chatHelpers.buildAiContextFromConversation(orphan)?.orderCode], ["Yêu cầu ký gửi", ""]),
      expectEqual("id sai → 404, không gọi mạng", [bad.resolved, bad.error?.response?.status, requests.length - beforeBad], [false, 404, 0])
    );
  });

  await check("Chat CSKH LUỒNG THẬT: khách gửi → Sale thấy hội thoại + badge chưa đọc → mở (PUT read) → trả lời chữ + ảnh thật (POST /api/uploads/images) → backend tự gán Sale → khách thấy tin của Sale", async () => {
    resetState({ token: "tok" });
    /* "Server" giả giữ trạng thái giống ConversationService. */
    const server = { salesId: null, messages: [
      { id: "k1", conversationId: CHAT_ID, senderId: CHAT_CUSTOMER_USER, senderRole: "Customer", content: "Cho tôi hỏi đơn VCL-20260917161921-540135", attachmentUrl: null, isRead: false, createdAt: "2026-09-26T01:00:00" },
    ] };
    const unreadForSale = () => server.messages.filter((m) => m.senderRole === "Customer" && !m.isRead).length;
    const snapshot = (withMessages) => chatDto({
      salesId: server.salesId,
      salesName: server.salesId ? "Nguyễn Văn Sale" : null,
      unreadCount: unreadForSale(),
      updatedAt: server.messages[server.messages.length - 1].createdAt,
      messages: withMessages ? server.messages.map((m) => ({ ...m })) : [],
    });
    routes = [
      { method: "GET", url: "/api/conversations", reply: () => ok([snapshot(false)]) },
      { method: "GET", url: `/api/conversations/${CHAT_ID}`, reply: () => ok(snapshot(true)) },
      { method: "PUT", url: `/api/conversations/${CHAT_ID}/read`, reply: () => { server.messages.forEach((m) => { if (m.senderRole === "Customer") m.isRead = true; }); return ok({ message: "Đã đánh dấu đọc tin nhắn." }); } },
      { method: "POST", url: "/api/uploads/images", reply: (req) => ok({ message: "Upload 1 ảnh thành công.", urls: req.body.getAll("files").map((f) => `https://res.cloudinary.test/vcl/${f.name}`) }) },
      {
        method: "POST",
        url: `/api/conversations/${CHAT_ID}/messages`,
        reply: (req) => {
          if (!server.salesId) server.salesId = CHAT_SALE_USER;
          const message = { id: `s${server.messages.length}`, conversationId: CHAT_ID, senderId: CHAT_SALE_USER, senderRole: "Sale", content: req.body.content, attachmentUrl: req.body.attachmentUrl ?? null, isRead: false, createdAt: `2026-09-26T01:1${server.messages.length}:00` };
          server.messages.push(message);
          return ok(message);
        },
      },
    ];

    const inbox = await conversation.getConversationsApi();
    const badges = await saleBadges.loadSaleBadges();
    const opened = await conversation.getConversationDetailApi(CHAT_ID);
    await conversation.markConversationAsReadApi(CHAT_ID);
    const afterRead = await conversation.getConversationsApi();
    const textReply = await conversation.sendConversationMessageApi(CHAT_ID, { content: "Đơn đang ở kho VN ạ", attachmentUrl: null, sentAtUtc: "x", clientTimeZone: "Asia/Ho_Chi_Minh" });
    const [imageUrl] = await chatUpload.uploadChatImages([chatFile("hang.jpg", "image/jpeg")]);
    await conversation.sendConversationMessageApi(CHAT_ID, { content: "", attachmentUrl: imageUrl, sentAtUtc: "x" });
    const reloaded = await conversation.getConversationDetailApi(CHAT_ID);
    const badgesAfter = await saleBadges.loadSaleBadges();
    const sends = requests.filter((r) => r.method === "POST" && r.url.endsWith("/messages"));
    const upload = requests.find((r) => r.url === "/api/uploads/images");
    const [, reply, imageReply] = reloaded.messages;
    return all(
      expectEqual("Sale thấy hội thoại + chưa đọc", [inbox.length, inbox[0]?.unreadCount, inbox[0]?.lastMessage], [1, 1, "1 tin nhắn mới từ khách hàng"]),
      expectEqual("badge Chăm sóc khách hàng", [badges.support, badgesAfter.support], [1, 0]),
      expectEqual("tin khách trong khung chat", opened.messages[0]?.content, "Cho tôi hỏi đơn VCL-20260917161921-540135"),
      expectEqual("đọc xong hết chưa đọc", afterRead[0]?.unreadCount, 0),
      expectEqual("body trả lời chỉ đúng DTO", sends.map((r) => r.body), [
        { content: "Đơn đang ở kho VN ạ", attachmentUrl: null },
        { content: "Đã gửi một hình ảnh", attachmentUrl: "https://res.cloudinary.test/vcl/hang.jpg" },
      ]),
      expectEqual("upload thật", [upload?.authorization, upload?.timeout > 30000, upload?.body?.getAll?.("files")?.length], ["Bearer tok", true, 1]),
      expectEqual("tin trả về", [textReply?.senderRole, textReply?.content], ["Sale", "Đơn đang ở kho VN ạ"]),
      expectEqual("backend gán Sale", [reloaded.staffName, chatHelpers.hasAssignedStaff(reloaded)], ["Nguyễn Văn Sale", true]),
      expectEqual("tin Sale bên phải", [chatHelpers.isMessageMine(reply, CHAT_SALE_USER, "Sale"), chatHelpers.isMessageMine(reloaded.messages[0], CHAT_SALE_USER, "Sale")], [true, false]),
      expectEqual("tin ảnh hiện ảnh, ẩn câu thay thế", [imageReply?.content, chatHelpers.getMessageAttachment(imageReply)], ["", "https://res.cloudinary.test/vcl/hang.jpg"]),
      /* Phía khách (web khách) đọc cùng MessageDto: senderRole "Sale" + content thật đã lưu. */
      expectEqual("khách đọc được tin Sale", server.messages.filter((m) => m.senderRole === "Sale").map((m) => m.content), ["Đơn đang ở kho VN ạ", "Đã gửi một hình ảnh"])
    );
  });

  await check("Chat CSKH (Sale): chặn tại chỗ (rỗng, > 2000, URL ảnh > 500); 400 ModelState → câu tiếng Việt; 403 rỗng khi tạo hội thoại → câu tiếng Việt; 403 có message giữ nguyên", async () => {
    resetState({ token: "tok" });
    const empty = await rejection(conversation.sendConversationMessageApi(CHAT_ID, { content: "  ", attachmentUrl: null }));
    const tooLong = await rejection(conversation.sendConversationMessageApi(CHAT_ID, { content: "x".repeat(2001) }));
    const longUrl = await rejection(conversation.sendConversationMessageApi(CHAT_ID, { content: "", attachmentUrl: `https://x.test/${"a".repeat(500)}` }));
    const blocked = requests.length;
    routes = [
      { method: "POST", url: `/api/conversations/${CHAT_ID}/messages`, reply: () => fail(400, { title: "One or more validation errors occurred.", errors: { Content: ["Nội dung tin nhắn không được để trống."] } }) },
      { method: "POST", url: "/api/conversations", reply: () => fail(403, "") },
      { method: "GET", url: `/api/conversations/${CHAT_ID}`, reply: () => fail(403, { message: "Cuộc trao đổi này đã được phân công cho Sales khác." }) },
    ];
    const invalid = await rejection(conversation.sendConversationMessageApi(CHAT_ID, { content: "hi" }));
    const create = await rejection(conversation.createConversationApi({ message: "Xin chào" }));
    const taken = await rejection(conversation.getConversationDetailApi(CHAT_ID));
    return all(
      expectEqual("chặn tại chỗ", [empty.resolved, tooLong.resolved, longUrl.resolved, blocked], [false, false, false, 0]),
      expectEqual("400 → message", chatHelpers.getApiErrorText(invalid.error, ""), "Nội dung tin nhắn không được để trống."),
      expectTrue("403 rỗng khi tạo → tiếng Việt", /Chỉ khách hàng mới tạo/.test(chatHelpers.getApiErrorText(create.error, ""))),
      expectEqual("403 có message giữ nguyên", chatHelpers.getApiErrorText(taken.error, ""), "Cuộc trao đổi này đã được phân công cho Sales khác."),
      expectEqual("không đăng xuất", fakeLocation.replaced, [])
    );
  });

  await check("Chat CSKH (Sale): ảnh chặn đúng giới hạn backend trước khi gửi (JPG/PNG/WEBP theo MIME, ≤ 5MB, không rỗng); 413 HTML → câu tiếng Việt", async () => {
    resetState({ token: "tok" });
    const tryPick = (file) => {
      try {
        chatHelpers.validateImageFile(file);
        return "ok";
      } catch (error) {
        return error.message;
      }
    };
    const heic = await rejection(chatUpload.uploadChatImages([chatFile("iphone.heic", "image/heic")]));
    const big = await rejection(chatUpload.uploadChatImages([chatFile("to.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)]));
    const blank = await rejection(chatUpload.uploadChatImages([chatFile("rong.png", "image/png", 0)]));
    const blocked = requests.length;
    routes = [{ method: "POST", url: "/api/uploads/images", reply: () => fail(413, "<html><body>413 Request Entity Too Large</body></html>") }];
    const tooLarge = await rejection(chatUpload.uploadChatImages([chatFile("y.jpg", "image/jpeg")]));
    return all(
      expectEqual("jpg đúng 5MB", tryPick(chatFile("a.jpg", "image/jpeg", 5 * 1024 * 1024)), "ok"),
      expectTrue("> 5MB", /5MB/.test(tryPick(chatFile("b.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)))),
      expectTrue("đuôi .jpg nhưng MIME rỗng", /JPG, PNG hoặc WEBP/.test(tryPick(chatFile("c.jpg", "")))),
      expectTrue("rỗng", /rỗng/.test(tryPick(chatFile("e.png", "image/png", 0)))),
      expectEqual("upload chặn tại chỗ", [heic.resolved, big.resolved, blank.resolved, blocked], [false, false, false, 0]),
      expectTrue("413 HTML → tiếng Việt", !tooLarge.resolved && /quá lớn/.test(tooLarge.error?.message) && !/<html/.test(tooLarge.error?.message))
    );
  });
  /* =========================================================
     ĐỢT 27/09/2026 — GỠ MOCK CÒN LẠI: upload ảnh, tỷ giá, hàng cấm, trợ lý AI, khách hàng,
     danh mục địa chỉ GoShip. Response mẫu bám UploadsController / ExchangeRateController /
     RestrictedItemController / AiController / CustomerController / GoshipController.
     ========================================================= */

  const upFile = (name, type = "image/jpeg", size = 1000) => new File([new Uint8Array(size)], name, { type });
  const uploadRoute = {
    method: "POST",
    url: "/api/uploads/images",
    reply: (req) => ok({ message: "Upload 1 ảnh thành công.", urls: req.body.getAll("files").map((f) => `https://res.cloudinary.test/vcl/${f.name}`) }),
  };

  await check("Upload ảnh (shared, THẬT): mỗi request MỘT ảnh field \"files\", đúng thứ tự; uploadImage → chuỗi URL; uploadImages → { url, urls, data[].url }; % tới 100", async () => {
    resetState({ token: "tok" });
    routes = [uploadRoute];
    const percents = [];
    const many = await uploadShared.uploadImages([upFile("a.jpg"), upFile("b.png", "image/png"), upFile("c.webp", "image/webp")], (p) => percents.push(p));
    const one = await uploadShared.uploadImage(upFile("mot.jpg"));
    const posts = requests.filter((r) => r.url === "/api/uploads/images");
    return all(
      expectEqual("số request", posts.length, 4),
      expectEqual("mỗi request 1 file", posts.map((r) => r.body.getAll("files").length), [1, 1, 1, 1]),
      expectEqual("token + timeout dài", [posts[0].authorization, posts[0].timeout > 30000], ["Bearer tok", true]),
      expectEqual("urls đúng thứ tự", many.urls, ["https://res.cloudinary.test/vcl/a.jpg", "https://res.cloudinary.test/vcl/b.png", "https://res.cloudinary.test/vcl/c.webp"]),
      expectEqual("url + data", [many.url, many.data.map((d) => d.url).length, many.success], ["https://res.cloudinary.test/vcl/a.jpg", 3, true]),
      expectEqual("uploadImage trả chuỗi", one, "https://res.cloudinary.test/vcl/mot.jpg"),
      expectEqual("% cuối", percents[percents.length - 1], 100),
      expectEqual("chat dùng chung instance", chatUpload.chatUploadAxios === uploadShared.uploadAxios, true)
    );
  });

  await check("Upload ảnh (shared): chặn trước HEIC / > 5MB / rỗng / > 10 ảnh; 400 { message } → câu backend; server trả URL không phải http(s) → lỗi, không nhận URL giả", async () => {
    resetState({ token: "tok" });
    const heic = await rejection(uploadShared.uploadImages([upFile("x.heic", "image/heic")]));
    const big = await rejection(uploadShared.uploadImage(upFile("to.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)));
    const eleven = await rejection(uploadShared.uploadImages(Array.from({ length: 11 }, (_, i) => upFile(`${i}.jpg`))));
    const blocked = requests.length;
    routes = [{ method: "POST", url: "/api/uploads/images", reply: () => fail(400, { message: "File thứ 1 (a.jpg): chỉ chấp nhận ảnh JPG, PNG hoặc WEBP." }) }];
    const bad = await rejection(uploadShared.uploadImage(upFile("a.jpg")));
    routes = [{ method: "POST", url: "/api/uploads/images", reply: () => ok({ message: "ok", urls: ["cdn/giả.jpg"] }) }];
    const notHttp = await rejection(uploadShared.uploadImage(upFile("b.jpg")));
    routes = [{ method: "POST", url: "/api/uploads/images", reply: () => fail(500, { message: "Cloudinary chưa được cấu hình." }) }];
    const noCloud = await rejection(uploadShared.uploadImages([upFile("c.jpg")]));
    return all(
      expectEqual("chặn tại chỗ", [heic.resolved, big.resolved, eleven.resolved, blocked], [false, false, false, 0]),
      expectTrue("HEIC tiếng Việt", /JPG, PNG hoặc WEBP/.test(heic.error?.message)),
      expectTrue("> 10 ảnh", /tối đa 10/.test(eleven.error?.message)),
      expectEqual("400 giữ câu backend", bad.error?.message, "File thứ 1 (a.jpg): chỉ chấp nhận ảnh JPG, PNG hoặc WEBP."),
      expectTrue("URL không http(s) bị từ chối", !notHttp.resolved && /không trả đường dẫn/.test(notHttp.error?.message)),
      expectEqual("500 cấu hình", noCloud.error?.message, "Cloudinary chưa được cấu hình.")
    );
  });

  await check("Tỷ giá (THẬT): GET /api/exchange-rates?activeOnly=true; mã tắt/thiếu → null (không số mặc định); quy đổi làm tròn như backend; convert gọi /convert", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/exchange-rates", reply: (req) => ok([{ id: "r1", currencyCode: "cny", currencyName: "Nhân dân tệ", rateToVnd: 3612.5, isActive: true }, ...(req.params?.activeOnly ? [] : [{ id: "r2", currencyCode: "KRW", rateToVnd: 19, isActive: false }])]) },
      { method: "GET", url: "/api/exchange-rates/convert", reply: (req) => (req.params.currency === "JPY" ? fail(404, { message: "Chưa cấu hình tỷ giá cho JPY. Vui lòng liên hệ Admin bổ sung." }) : ok({ currency: "CNY", exchangeRate: 3612.5, amountOriginal: req.params.amount, amountVnd: 144139 })) },
    ];
    const active = await exchangeRate.getExchangeRatesApi({ activeOnly: true });
    const all_ = await exchangeRate.getExchangeRatesApi({ activeOnly: false });
    const conv = await exchangeRate.convertCurrencyApi("cny", 39.9);
    const jpy = await rejection(exchangeRate.convertCurrencyApi("JPY", 10));
    const listReq = requests.find((r) => r.url === "/api/exchange-rates");
    return all(
      expectEqual("activeOnly gửi lên", listReq?.params, { activeOnly: true }),
      expectEqual("chuẩn hoá", [active.length, active[0].currencyCode, active[0].rateToVnd], [1, "CNY", 3612.5]),
      expectEqual("tìm tỷ giá đang bật", exchangeRate.findActiveExchangeRate(active, "CNY")?.id, "r1"),
      expectEqual("mã tắt → null", exchangeRate.findActiveExchangeRate(all_, "KRW"), null),
      expectEqual("mã thiếu → null", exchangeRate.findActiveExchangeRate(active, "JPY"), null),
      expectEqual("39,9 CNY × 3612,5", exchangeRate.convertToVndWithRate(39.9, 3612.5), Math.round(39.9 * 3612.5)),
      expectEqual("không tỷ giá → 0", exchangeRate.convertToVndWithRate(10, 0), 0),
      expectEqual("convert", [conv.amountVnd, requests.find((r) => r.url.endsWith("/convert"))?.params], [144139, { currency: "CNY", amount: 39.9 }]),
      expectEqual("404 giữ câu backend", jpy.error?.response?.data?.message, "Chưa cấu hình tỷ giá cho JPY. Vui lòng liên hệ Admin bổ sung.")
    );
  });

  await check("Báo giá mua hộ: gửi currency + GIÁ NGOẠI TỆ (giữ lẻ 2 số) để backend tự quy đổi; VND vẫn làm tròn đồng", async () => {
    resetState({ token: "tok" });
    const PR_ID = "d1d2d3d4-0000-4000-8000-000000000009";
    routes = [{ method: "POST", url: `/api/purchase-requests/${PR_ID}/quotation`, reply: (req) => ok({ quotationId: "q1", currency: req.body.currency }) }];
    await purchaseRequest.createPurchaseRequestQuotationApi(PR_ID, { currency: "cny", purchaseFee: 30000, items: [{ purchaseRequestItemId: "i1", unitPrice: 39.9 }, { purchaseRequestItemId: "i2", unitPrice: 12.346 }] });
    await purchaseRequest.createPurchaseRequestQuotationApi(PR_ID, { purchaseFee: 30000, items: [{ purchaseRequestItemId: "i1", unitPrice: 144139.6 }] });
    const [foreign, vnd] = requests.map((r) => r.body);
    return all(
      expectEqual("currency", [foreign.currency, vnd.currency], ["CNY", undefined]),
      expectEqual("giá ngoại tệ giữ lẻ", foreign.items.map((i) => i.unitPrice), [39.9, 12.35]),
      expectEqual("VND làm tròn", vnd.items[0].unitPrice, 144140)
    );
  });

  await check("Hàng cấm (THẬT): GET /api/restricted-items qua catalogAdminService; quốc gia tự do (\"Trung Quốc\"/\"CN\") về China; lọc client; chi tiết 404 ném lỗi axios", async () => {
    resetState({ token: "tok" });
    routes = [
      { method: "GET", url: "/api/restricted-items", reply: () => ok([
        { id: "a1", itemName: "Pin lithium rời", country: "Trung Quốc", restrictionType: "banned", note: "Cấm bay", isActive: true },
        { id: "a2", itemName: "Nước hoa", country: "VN", restrictionType: "RESTRICTED", note: "", isActive: false },
      ]) },
      { method: "GET", url: "/api/restricted-items/zz", reply: () => fail(404, { message: "Không tìm thấy mặt hàng cấm/hạn chế." }) },
    ];
    const list = await restricted.getRestrictedItemsApi();
    const china = await restricted.getRestrictedItemsApi({ country: "China" });
    const active = await restricted.getActiveRestrictedItemsApi();
    const kw = await restricted.getRestrictedItemListApi({ keyword: "nước" });
    const missing = await rejection(restricted.getRestrictedItemDetailApi("zz"));
    return all(
      expectEqual("chuẩn hoá", list.map((i) => [i.country, i.countryDisplayName, i.restrictionTypeDisplayName]), [["China", "Trung Quốc", "Cấm vận chuyển"], ["Vietnam", "Việt Nam", "Hạn chế"]]),
      expectEqual("lọc quốc gia / đang áp dụng / từ khoá", [china.map((i) => i.id), active.map((i) => i.id), kw.map((i) => i.id)], [["a1"], ["a1"], ["a2"]]),
      expectEqual("404", [missing.resolved, missing.error?.response?.data?.message], [false, "Không tìm thấy mặt hàng cấm/hạn chế."]),
      expectEqual("không query lên server", requests.filter((r) => r.url === "/api/restricted-items").every((r) => !r.params), true)
    );
  });

  await check("Trợ lý AI Sales (THẬT): POST /api/ai/sales/order-status-query; bỏ customerId không phải GUID, relatedId không GUID → orderCode; nhãn tiếng Việt; 404 hiện câu backend, không trả lời giả", async () => {
    resetState({ token: "tok" });
    const ORDER = "e1e2e3e4-0000-4000-8000-000000000001";
    routes = [{ method: "POST", url: "/api/ai/sales/order-status-query", reply: (req) => (req.body.orderCode === "VCL-KHONG-CO" ? fail(404, { message: "Không tìm thấy dữ liệu đơn hàng, kiện hàng hoặc khách hàng liên quan đến câu hỏi." }) : ok({
      answer: "Đơn đang chờ tất toán.", relatedOrders: [{ orderId: ORDER, orderCode: "VCL-1", orderType: "CONSIGNMENT", customerName: "A", customerPhone: "0900000000", status: "WAITING_PAYMENT", createdAt: "2026-09-20T00:00:00Z" }],
      relatedParcels: [], currentStatus: "WAITING_PAYMENT", paymentStatus: "Chưa thanh toán (UNPAID)", warehouseStatus: "Chưa nhập kho", shipmentStatus: "Chưa ghép lô vận chuyển quốc tế (NOT_ASSIGNED)", nextActionSuggestion: "Nhắc khách tất toán.", dataSources: ["Orders"], warning: null,
    })) }];
    const res = await saleAi.querySalesOrderStatus({ message: " Kiểm tra đơn ", orderCode: "VCL-1", customerId: "khach-01", relatedType: "consignment", relatedId: ORDER });
    await saleAi.querySalesOrderStatus({ message: "hỏi", relatedId: "VCL-2", relatedType: "CONSIGNMENT" });
    const nf = await rejection(saleAi.querySalesOrderStatus({ message: "hỏi", orderCode: "VCL-KHONG-CO" }));
    const empty = await rejection(saleAi.querySalesOrderStatus({ message: "  " }));
    const [first, second] = requests.map((r) => r.body);
    return all(
      expectEqual("body 1", first, { message: "Kiểm tra đơn", orderCode: "VCL-1", relatedType: "CONSIGNMENT", relatedId: ORDER }),
      expectEqual("body 2 (relatedId không GUID → orderCode)", second, { message: "hỏi", orderCode: "VCL-2" }),
      expectEqual("kết quả", [res.answer, res.labels.currentStatus, res.relatedOrders.length], ["Đơn đang chờ tất toán.", "Chờ tất toán", 1]),
      expectEqual("404 → câu backend", saleAi.getSalesAiError(nf.error), "Không tìm thấy dữ liệu đơn hàng, kiện hàng hoặc khách hàng liên quan đến câu hỏi."),
      expectEqual("câu hỏi rỗng chặn tại chỗ", [empty.resolved, requests.length], [false, 3])
    );
  });

  await check("Khách hàng (THẬT): GET ?search=; lọc trạng thái client; POST/PUT body đúng DTO; DELETE = vô hiệu hoá (câu backend); chi tiết 404 → null", async () => {
    resetState({ token: "tok" });
    const CUS = "c1c2c3c4-0000-4000-8000-000000000001";
    routes = [
      { method: "GET", url: "/api/customers", reply: () => ok({ items: [
        { id: CUS, customerCode: "KH0001", fullName: "Nguyễn Văn A", email: "a@x.vn", phone: "0900000001", address: "", companyName: null, taxId: null, status: "ACTIVE" },
        { id: "c1c2c3c4-0000-4000-8000-000000000002", customerCode: "KH0002", fullName: "B", email: "", phone: "0900000002", address: "", status: "INACTIVE" },
      ] }) },
      { method: "POST", url: "/api/customers", reply: (req) => ok({ message: "Tạo hồ sơ khách hàng thành công.", customer: { id: "new-id", customerCode: "KH0003", ...req.body } }, 201) },
      { method: "PUT", url: `/api/customers/${CUS}`, reply: (req) => ok({ message: "Cập nhật hồ sơ khách hàng thành công.", customer: { id: CUS, customerCode: "KH0001", ...req.body } }) },
      { method: "DELETE", url: `/api/customers/${CUS}`, reply: () => ok({ message: "Vô hiệu hóa hồ sơ khách hàng thành công." }) },
      { method: "GET", url: "/api/customers/c1c2c3c4-0000-4000-8000-000000000009", reply: () => fail(404, { message: "Không tìm thấy khách hàng" }) },
    ];
    const listAll = await customerSvc.getCustomersApi({ search: "nguyen" });
    const inactive = await customerSvc.getCustomersApi({ status: "INACTIVE" });
    const created = await customerSvc.createCustomerApi({ fullName: " C ", phone: "090-000-0003", email: "C@X.VN", address: "" });
    const updated = await customerSvc.updateCustomerApi(CUS, { fullName: "A2", phone: "0900000001", email: "a@x.vn", status: "ACTIVE" });
    const removed = await customerSvc.deleteCustomerApi(CUS);
    const missing = await customerSvc.getCustomerByIdApi("c1c2c3c4-0000-4000-8000-000000000009");
    const post = requests.find((r) => r.method === "POST");
    return all(
      expectEqual("search gửi lên", requests[0].params, { search: "nguyen" }),
      expectEqual("chuẩn hoá + lọc", [listAll.length, listAll[0].isActive, inactive.map((c) => c.customerCode)], [2, true, ["KH0002"]]),
      expectEqual("body POST", post?.body, { fullName: "C", phone: "0900000003", email: "c@x.vn", address: null, companyName: null, taxId: null, status: "ACTIVE" }),
      expectEqual("tạo / sửa", [created.id, created.customerCode, updated.fullName], ["new-id", "KH0003", "A2"]),
      expectEqual("xoá = vô hiệu hoá", removed.message, "Vô hiệu hóa hồ sơ khách hàng thành công."),
      expectEqual("404 → null", missing, null)
    );
  });

  await check("Địa chỉ GoShip (THẬT): tỉnh/huyện/xã từ /api/Goship/*; cache tỉnh; dò tên cũ (bỏ tiền tố/dấu); lỗi không rơi về danh sách giả; ghép chuỗi bằng tên GoShip; chặn khi chưa đủ 3 cấp", async () => {
    resetState({ token: "tok" });
    address.clearAddressCache();
    let failCities = true;
    routes = [
      { method: "GET", url: "/api/Goship/cities", reply: () => (failCities ? fail(500, { message: "GoShip lỗi" }) : ok({ message: "ok", items: [{ id: 100, name: "Hồ Chí Minh" }, { id: 101, name: "Hà Nội" }] })) },
      { method: "GET", url: "/api/Goship/cities/100/districts", reply: () => ok({ message: "ok", items: [{ id: 1001, name: "Quận 1" }, { id: 1010, name: "Quận 10" }] }) },
      { method: "GET", url: "/api/Goship/districts/1001/wards", reply: () => ok({ message: "ok", items: [{ id: 50, name: "Phường Bến Nghé" }] }) },
    ];
    const firstFail = await rejection(address.getProvinces());
    failCities = false;
    const provinces = await address.getProvinces();
    await address.getProvinces();
    const cityCalls = requests.filter((r) => r.url === "/api/Goship/cities").length;
    const resolved = await address.resolveAddressByNames({ province: "TP. Hồ Chí Minh", district: "quan 1", ward: "Bến Nghé" });
    const partial = await address.resolveAddressByNames({ province: "Hồ Chí Minh", district: "Quận 99", ward: "X" });
    const full = await address.getFullAddressByCodes({ provinceCode: "100", districtCode: "1001", wardCode: "50", detailAddress: "12 Lê Lợi" });
    return all(
      expectEqual("lỗi lần đầu → ném, không danh sách giả", [firstFail.resolved, firstFail.error?.response?.status], [false, 500]),
      expectEqual("tỉnh", provinces.map((p) => [p.value, p.label, p.code, p.name]), [["100", "Hồ Chí Minh", "100", "Hồ Chí Minh"], ["101", "Hà Nội", "101", "Hà Nội"]]),
      expectEqual("cache tỉnh (lỗi không cache)", cityCalls, 2),
      expectEqual("dò tên cũ", [resolved.matched, resolved.provinceCode, resolved.districtCode, resolved.wardCode, resolved.wardName], [true, "100", "1001", "50", "Phường Bến Nghé"]),
      expectEqual("khớp một phần", [partial.matched, partial.provinceCode, partial.districtCode], [false, "100", ""]),
      expectEqual("ghép bằng tên GoShip", full.fullAddress, "12 Lê Lợi, Phường Bến Nghé, Quận 1, Hồ Chí Minh"),
      expectEqual("tách chuỗi", address.splitVietnamAddress("12 Lê Lợi, Phường Bến Nghé, Quận 1, Hồ Chí Minh"), { addressDetail: "12 Lê Lợi", ward: "Phường Bến Nghé", district: "Quận 1", province: "Hồ Chí Minh" }),
      expectTrue("chưa đủ 3 cấp → lỗi", Boolean(address.getAddressSelectionError({ touched: true, empty: false, complete: false }))),
      expectEqual("chưa sửa / xoá trắng / đủ → hợp lệ", [address.getAddressSelectionError(null), address.getAddressSelectionError({ touched: true, empty: true }), address.getAddressSelectionError({ touched: true, complete: true })], ["", "", ""]),
      expectEqual("địa chỉ giao đủ mã + tên", [address.isDeliveryAddressComplete({ province: "Hồ Chí Minh", district: "Quận 1", ward: "Phường Bến Nghé" }), address.isDeliveryAddressComplete({ provinceCode: "100", province: "Hồ Chí Minh", districtCode: "1001", district: "Quận 1", wardCode: "50", ward: "Phường Bến Nghé" })], [false, true])
    );
  });
}

/* =========================================================
   7. KIỂM TĨNH — KHÔNG CÒN FILE NÀO (ngoài mock) IMPORT BẢN MOCK
   ========================================================= */

/*
 * Từ 27/09/2026 mọi màn nội bộ đều chạy API thật: danh sách OUT_OF_WAVE_IMPORTS (ServicePricings,
 * modal báo giá mua hộ, chat, giấy tờ ký gửi...) đã được chuyển hết sang bản thật. Phép kiểm
 * đảo lại: file nào trong src/ (trừ src/mocks/** và chính các bản *.mock.js) còn import `*.mock`
 * hoặc `@/mocks` là FAIL — lọt lại là màn đó hiện dữ liệu giả.
 */
const walkSource = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSource(full, out);
    else if (/\.(jsx?|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
};

await check("Không file nào ngoài src/mocks và *.mock.js còn import bản mock (*.mock / @/mocks)", () => {
  const wrong = [];
  const importPattern = /(?:import|export)\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g;

  for (const file of walkSource(path.join(ROOT, "src"))) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    if (rel.startsWith("src/mocks/") || /\.mock\.js$/.test(rel)) continue;

    const source = fs.readFileSync(file, "utf8");
    const leaked = [...source.matchAll(importPattern)]
      .map((match) => match[1])
      .filter((spec) => /\.mock(\.js)?$/.test(spec) || spec.startsWith("@/mocks"));

    if (leaked.length) wrong.push(`${rel}: ${leaked.join(", ")}`);
  }

  return wrong.length === 0 ? true : wrong.slice(0, 6).join("; ");
});

/* Các màn tiền/nghiệp vụ vừa chuyển phải import ĐÚNG bản thật (không chỉ "không import mock"). */
const MUST_IMPORT_REAL = {
  "src/features/pricing/pages/ServicePricings/ServicePricings.jsx": [
    "@features/pricing/api/servicePricingService",
    "@features/pricing/api/packageConfigurationService",
    "@features/pricing/api/exchangeRateService",
  ],
  "src/features/pricing/pages/ServicePricings/ServicePricings.helpers.js": [
    "@features/pricing/api/servicePricingService",
    "@features/pricing/api/exchangeRateService",
  ],
  "src/features/purchase/components/CreatePurchaseRequestQuotationModal/CreatePurchaseRequestQuotationModal.jsx": [
    "@features/pricing/api/servicePricingService",
    "@features/pricing/api/exchangeRateService",
  ],
  "src/features/chat/components/SalesAiAssistantPanel/SalesAiAssistantPanel.jsx": [
    "@features/consignment/api/consignmentService",
  ],
  "src/features/chat/pages/CustomerServiceChat/CustomerServiceChat.constants.js": [
    "@features/consignment/api/consignmentService",
  ],
  "src/features/documents/pages/ConsignmentDocumentsList/ConsignmentDocumentsList.jsx": [
    "@features/consignment/api/consignmentService",
    "@features/consignment/api/consignmentReceiptService",
  ],
  "src/features/chat/api/chatImageUploadApi.js": ["@shared/api/uploadImage"],
  "src/features/catalog/api/restrictedItemService.js": ["@features/catalog/api/catalogAdminService"],
  "src/features/pricing/api/exchangeRateService.js": ["@features/catalog/api/catalogAdminService"],
  "src/features/purchase/pages/ConsignmentBuyOrder/ConsignmentBuyOrder.jsx": [
    "@features/customer/api/customerLookupService",
    "@shared/components/AddressSelect/AddressSelect",
  ],
  "src/features/consignment/pages/ConsignmentOrder/ConsignmentOrder.jsx": [
    "@shared/components/AddressSelect/AddressSelect",
  ],
  "src/features/settlement/pages/SaleReleasePage/SaleReleasePage.jsx": [
    "@shared/components/AddressSelect/DeliveryAddressPicker",
  ],
  "src/features/settlement/pages/SaleDeliveriesPage/SaleDeliveriesPage.jsx": [
    "@shared/components/AddressSelect/DeliveryAddressPicker",
  ],
};

await check("Màn vừa gỡ mock import đúng bản THẬT (bảng giá, tỷ giá, báo giá mua hộ, chat, giấy tờ, upload, hàng cấm, địa chỉ GoShip)", () => {
  const wrong = [];
  const importPattern = /import\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g;

  for (const [rel, wants] of Object.entries(MUST_IMPORT_REAL)) {
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const specifiers = [...source.matchAll(importPattern)].map((match) => match[1].replace(/\.js$/, ""));
    for (const want of wants) {
      if (!specifiers.includes(want)) wrong.push(`${rel}: thiếu import "${want}"`);
    }
  }

  /* Không còn ô GÕ TAY phường/quận/tỉnh ở hai màn giao hàng. */
  for (const rel of [
    "src/features/settlement/pages/SaleReleasePage/SaleReleasePage.jsx",
    "src/features/settlement/pages/SaleDeliveriesPage/SaleDeliveriesPage.jsx",
  ]) {
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (/addonBefore="(Phường\/Xã|Quận\/Huyện|Tỉnh\/Thành phố)"|\["(ward|district|province)", "/.test(source)) {
      wrong.push(`${rel}: còn ô gõ tay tỉnh/quận/phường`);
    }
  }

  /* Không còn tỷ giá mặc định hard-code. */
  for (const rel of [
    "src/features/pricing/pages/ServicePricings/ServicePricings.jsx",
    "src/features/pricing/pages/ServicePricings/ServicePricings.helpers.js",
    "src/features/purchase/components/CreatePurchaseRequestQuotationModal/CreatePurchaseRequestQuotationModal.jsx",
  ]) {
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (/DEFAULT_RATES|rateToVnd:\s*\d|\?\s*20\s*:\s*code === "JPY"|convertCurrencyApi/.test(source)) {
      wrong.push(`${rel}: còn tỷ giá mặc định / quy đổi không qua tỷ giá thật`);
    }
  }

  return wrong.length === 0 ? true : wrong.join("; ");
});

/*
 * Chat CSKH nhân viên phải dùng bản THẬT: conversationApi.mock.js / @/mocks mà lọt lại vào màn
 * chat là Sale lại không thấy tin khách. Upload đi qua chatImageUploadApi (lớp mỏng trên
 * @shared/api/uploadImage — đã là API thật từ 27/09/2026), màn chat không import shared trực tiếp.
 */
const CHAT_MUST_USE_REAL = {
  "src/features/chat/pages/CustomerServiceChat/CustomerServiceChat.jsx": [
    "@features/chat/api/conversationApi",
    "@features/chat/api/chatImageUploadApi",
  ],
  "src/features/workspace/api/saleBadgeService.js": ["@features/chat/api/conversationApi"],
};

await check("Chat CSKH nhân viên import bản THẬT (conversationApi + chatImageUploadApi), không còn *.mock / @/mocks / @shared/api/uploadImage; barrel chat không re-export bản mock", () => {
  const wrong = [];
  const importPattern = /import\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g;

  for (const [rel, wants] of Object.entries(CHAT_MUST_USE_REAL)) {
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const specifiers = [...source.matchAll(importPattern)].map((match) => match[1].replace(/\.js$/, ""));

    for (const want of wants) {
      if (!specifiers.includes(want)) wrong.push(`${rel}: thiếu import "${want}"`);
    }

    const leaked = specifiers.filter(
      (spec) => /\.mock$/.test(spec) || spec.startsWith("@/mocks") || spec === "@shared/api/uploadImage",
    );
    if (leaked.length) wrong.push(`${rel}: còn import ${leaked.join(", ")}`);
  }

  if (/\.mock["']/.test(fs.readFileSync(path.join(ROOT, "src/features/chat/index.js"), "utf8"))) {
    wrong.push("src/features/chat/index.js: re-export bản mock");
  }

  return wrong.length === 0 ? true : wrong.join("; ");
});

await check("Quy tắc phụ phí (ServicePricings) đọc quy tắc tính phí THẬT, không qua bản mock", () => {
  const wrong = [];
  for (const rel of [
    "src/features/pricing/pages/ServicePricings/ServicePricings.jsx",
    "src/features/pricing/pages/ServicePricings/ServicePricings.helpers.js",
  ]) {
    const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
    if (/api\/pricingRuleService\.mock"/.test(source)) wrong.push(`${rel} còn import pricingRuleService.mock`);
    if (!/api\/pricingRuleService"/.test(source)) wrong.push(`${rel} không import pricingRuleService thật`);
  }
  return wrong.length === 0 ? true : wrong.join("; ");
});

await check("Quy tắc phụ phí: rule hệ thống hiện đơn vị (cm³/kg, kg), không hiện \"Cố định\"", async () => {
  const helpers = await load("/src/features/pricing/pages/ServicePricings/ServicePricings.helpers.js");
  const divisorRule = { ruleCode: "VOLUMETRIC_DIVISOR", ruleType: "VOLUMETRIC_DIVISOR", calculationType: "FIXED", calculationTypeDisplayName: "Cố định", value: 5000 };
  const byTypeOnly = { ruleCode: "HE_SO", ruleType: "VOLUMETRIC_DIVISOR", calculationType: "FIXED", calculationTypeDisplayName: "Cố định", value: 6000 };
  const minWeightRule = { ruleCode: "MIN_WEIGHT", ruleType: "MIN_WEIGHT", calculationType: "FIXED", calculationTypeDisplayName: "Cố định", value: 1 };
  const feeRule = { ruleCode: "DOMESTIC_FEE", ruleType: "DOMESTIC_FEE", calculationType: "FIXED", calculationTypeDisplayName: "Cố định", value: 5000 };
  return all(
    expectEqual("hệ số DIM", helpers.formatRuleValue(divisorRule), "5.000 cm³/kg"),
    expectEqual("hệ số theo ruleType", helpers.formatRuleValue(byTypeOnly), "6.000 cm³/kg"),
    expectEqual("cân tối thiểu", helpers.formatRuleValue(minWeightRule), "1 kg"),
    expectEqual("nhãn giá trị", [helpers.getRuleValueUnit(divisorRule), helpers.getRuleValueUnit(minWeightRule)], ["Hệ số quy đổi", "Cân tối thiểu"]),
    expectTrue("rule hệ thống không hiện Cố định", !helpers.getRuleCalculationDisplay(divisorRule).includes("Cố định") && !helpers.getRuleCalculationDisplay(minWeightRule).includes("Cố định")),
    expectEqual("phí thường vẫn hiện Cố định", helpers.getRuleCalculationDisplay(feeRule), "Cố định")
  );
});

await check("Chi tiết đơn (Admin): DIM từng dòng chia đúng hệ số đang hiện; lệch với API thì báo", async () => {
  const helpers = await load("/src/features/consignment/pages/ConsignmentDetail/ConsignmentDetail.helpers.js");
  const item = { length: 50, width: 40, height: 30, weight: 2, volumetricWeight: 12 };
  const sameDivisor = helpers.resolveItemDim(item, 5000);
  const otherDivisor = helpers.resolveItemDim(item, 6000);
  const noDivisor = helpers.resolveItemDim(item, 0);
  return all(
    expectEqual("hệ số 5000", [sameDivisor.dimKg, sameDivisor.source, sameDivisor.isApiMismatch], [12, "DIVISOR", false]),
    expectEqual("hệ số 6000 → tính theo 6000, báo lệch API", [otherDivisor.dimKg, otherDivisor.source, otherDivisor.isApiMismatch], [10, "DIVISOR", true]),
    expectEqual("chưa có hệ số → số API", [noDivisor.dimKg, noDivisor.source], [12, "API"]),
    expectEqual("tổng dùng cùng số", helpers.calculateItemDimKg(item, 6000), 10)
  );
});

await check("Bản sao *.mock.js không được nối mạng", () => {
  const copies = [
    "src/features/consignment/api/consignmentService.mock.js",
    "src/features/consignment/api/consignmentMasterService.mock.js",
    "src/features/pricing/api/pricingRuleService.mock.js",
    "src/features/pricing/api/servicePricingService.mock.js",
    "src/features/pricing/api/packageConfigurationService.mock.js",
    "src/features/warehouse/api/warehouseService.mock.js",
    "src/features/consignment/api/consignmentReceiptService.mock.js",
    "src/features/chat/api/conversationApi.mock.js",
    /* Bản sao lưu của đợt gỡ mock 27/09/2026. */
    "src/shared/api/uploadImage.mock.js",
    "src/features/pricing/api/exchangeRateService.mock.js",
    "src/features/catalog/api/restrictedItemService.mock.js",
    "src/features/chat/api/saleAiService.mock.js",
    "src/features/customer/api/customerService.mock.js",
    "src/features/consignment/api/deliveryAddressService.mock.js",
    "src/shared/api/vietnamAddressService.mock.js",
  ];

  const wrong = [];

  for (const rel of copies) {
    const file = path.join(ROOT, rel);

    if (!fs.existsSync(file)) {
      wrong.push(`${rel}: thiếu file`);
      continue;
    }

    const source = fs.readFileSync(file, "utf8");

    if (/httpClient|from\s*"axios"/.test(source)) {
      wrong.push(`${rel}: đã dính httpClient/axios`);
    }
    if (!/@\/mocks\//.test(source)) {
      wrong.push(`${rel}: không còn đọc dữ liệu mẫu`);
    }
  }

  return wrong.length === 0 ? true : wrong.join("; ");
});

await server.close();

/* ---------- Base URL từ biến môi trường (server Vite riêng) ---------- */

if (!loadError) {
  process.env.VITE_API_BASE_URL = "https://api.example.test/";
  const envServer = await createSsrServer();
  await check('httpClient: VITE_API_BASE_URL ghi đè base URL và bị cắt "/" cuối', async () => {
    const envHttp = await envServer.ssrLoadModule("/src/shared/api/httpClient.js");
    return expectEqual("baseURL", envHttp.default.defaults.baseURL, "https://api.example.test");
  });
  await envServer.close();
  delete process.env.VITE_API_BASE_URL;
}

fs.rmSync(emptyEnvDir, { recursive: true, force: true });

/* =========================================================
   8. BÁO CÁO
   ========================================================= */

await check("Không có request nào ra mạng thật", () =>
  networkAttempts.length === 0
    ? true
    : `bị chặn ${networkAttempts.length} lần: ${networkAttempts.slice(0, 3).join("; ")}`,
);

const passed = results.filter((r) => r.passed).length;
console.log(`\nkịch bản đạt    : ${passed}/${results.length}`);
console.log(`request ra mạng  : ${networkAttempts.length}`);

if (problems.length) {
  console.log(`\n${problems.length} VẤN ĐỀ:`);
  problems.forEach((p) => console.log(`  ${p}`));
  process.exit(1);
}

console.log("\nMọi kịch bản đạt, không có request nào ra mạng.");
process.exit(0);
