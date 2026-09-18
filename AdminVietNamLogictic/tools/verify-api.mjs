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
 * - cộng một phép kiểm TĨNH: màn ngoài đợt này phải import bản `*.mock.js`.
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
    packageConfig: await load("/src/features/pricing/api/packageConfigurationService.js"),
    orderStatus: await load("/src/features/consignment/constants/orderStatus.js"),
    receivingNotes: await load("/src/features/receiving/api/receivingNoteService.js"),
    actionQueue: await load("/src/features/settlement/api/actionQueueService.js"),
    finance: await load("/src/features/admin/api/adminFinanceService.js"),
    warehouseManager: await load("/src/features/warehouse/api/warehouseManagerService.js"),
    receipt: await load("/src/features/consignment/api/consignmentReceiptService.js"),
    receiptUrl: await load("/src/shared/utils/receiptUrl.js"),
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
      feeId: null,
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
    packageConfig,
    receivingNotes,
    actionQueue,
    finance,
    warehouseManager,
    receipt,
    receiptUrl,
  } = mods;

  const httpClient = httpMod.default;
  httpClient.defaults.adapter = fakeAdapter;

  /* ---------- Hạ tầng httpClient ---------- */

  await check("httpClient: nạp được qua Vite SSR khi chưa có window/storage", () =>
    all(
      expectEqual("window lúc nạp", hadWindowAtLoad, false),
      expectEqual("storage lúc nạp", hadStorageAtLoad, false),
      expectTrue("export default là axios instance", typeof httpClient?.get === "function"),
    ),
  );

  await check(
    "httpClient: base URL mặc định https://vcl.henrytech.cloud, timeout 30 giây",
    () =>
      all(
        expectEqual("API_BASE_URL", httpMod.API_BASE_URL, "https://vcl.henrytech.cloud"),
        expectEqual("defaults.baseURL", httpClient.defaults.baseURL, "https://vcl.henrytech.cloud"),
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
      expectEqual("đổi host", receiptUrl.toPublicReceiptUrl(legacy), "https://vcl.henrytech.cloud/api/public/receipts/abc"),
      expectEqual("tải về", receiptUrl.toPublicReceiptUrl(legacy, { download: true }), "https://vcl.henrytech.cloud/api/public/receipts/abc?download=true"),
    );
  });
}

/* =========================================================
   7. KIỂM TĨNH — màn ngoài đợt này phải dùng bản *.mock.js
   ========================================================= */

const OUT_OF_WAVE_IMPORTS = [
  ["src/features/chat/components/SalesAiAssistantPanel/SalesAiAssistantPanel.jsx", "consignmentService"],
  ["src/features/chat/pages/CustomerServiceChat/CustomerServiceChat.constants.js", "consignmentService"],
  ["src/features/documents/pages/ConsignmentDocumentsList/ConsignmentDocumentsList.jsx", "consignmentService"],
  ["src/features/documents/pages/ConsignmentDocumentsList/ConsignmentDocumentsList.jsx", "consignmentReceiptService"],
  ["src/features/dashboard/pages/SaleDashboard/SaleDashboard.jsx", "consignmentService"],
  ["src/features/dashboard/pages/SaleDashboard/SaleDashboard.jsx", "servicePricingService"],
  ["src/features/consignment/pages/ConsignmentOrder/ConsignmentOrder.jsx", "consignmentService"],
  ["src/features/consignment/pages/ConsignmentOrder/ConsignmentOrder.jsx", "consignmentMasterService"],
  ["src/features/consignment/pages/ConsignmentOrder/ConsignmentOrder.jsx", "pricingRuleService"],
  ["src/features/consignment/components/PackageOptionalServices/PackageOptionalServices.jsx", "pricingRuleService"],
  ["src/features/purchase/pages/ConsignmentBuyOrder/ConsignmentBuyOrder.jsx", "consignmentMasterService"],
  ["src/features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail.jsx", "pricingRuleService"],
  ["src/features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail.jsx", "warehouseService"],
  ["src/features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail.helpers.js", "pricingRuleService"],
  ["src/features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail.constants.js", "pricingRuleService"],
  ["src/features/purchase/components/ConfirmPurchaseModal/ConfirmPurchaseModal.jsx", "warehouseService"],
  ["src/features/purchase/components/CreatePurchaseRequestQuotationModal/CreatePurchaseRequestQuotationModal.jsx", "pricingRuleService"],
  ["src/features/purchase/components/CreatePurchaseRequestQuotationModal/CreatePurchaseRequestQuotationModal.jsx", "servicePricingService"],
  ["src/features/purchase/components/CreatePurchaseRequestQuotationModal/CreatePurchaseRequestQuotationModal.helpers.js", "pricingRuleService"],
  ["src/features/purchase/components/PackageOptionalServicesS1/PackageOptionalServicesS1.jsx", "pricingRuleService"],
  ["src/features/pricing/pages/ServicePricings/ServicePricings.jsx", "pricingRuleService"],
  ["src/features/pricing/pages/ServicePricings/ServicePricings.jsx", "servicePricingService"],
  ["src/features/pricing/pages/ServicePricings/ServicePricings.jsx", "packageConfigurationService"],
  ["src/features/pricing/pages/ServicePricings/ServicePricings.helpers.js", "pricingRuleService"],
  ["src/features/pricing/pages/ServicePricings/ServicePricings.helpers.js", "servicePricingService"],
];

await check("Màn ngoài đợt này vẫn chạy dữ liệu mẫu (import bản *.mock)", () => {
  const wrong = [];

  for (const [rel, moduleName] of OUT_OF_WAVE_IMPORTS) {
    const file = path.join(ROOT, rel);

    if (!fs.existsSync(file)) {
      wrong.push(`${rel}: không còn file`);
      continue;
    }

    const source = fs.readFileSync(file, "utf8");
    const mockPattern = new RegExp(`api/${moduleName}\\.mock"`);
    const realPattern = new RegExp(`api/${moduleName}"`);

    if (!mockPattern.test(source)) {
      wrong.push(`${rel} không import ${moduleName}.mock`);
    }
    if (realPattern.test(source)) {
      wrong.push(`${rel} vẫn import bản THẬT ${moduleName}`);
    }
  }

  return wrong.length === 0 ? true : wrong.slice(0, 5).join("; ");
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
