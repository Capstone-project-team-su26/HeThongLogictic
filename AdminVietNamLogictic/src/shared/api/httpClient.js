/* =========================================================
   httpClient.js — axios instance dùng chung cho mọi module api/ ĐÃ NỐI backend thật.

   Hợp đồng (README mục "Cắm API thật trở lại" + đợt nối API luồng BÁO GIÁ KÝ GỬI):
   - baseURL đọc VITE_API_BASE_URL (cắt "/" thừa ở cuối), mặc định
     https://api-vcl.vnlogistic.click. KHÔNG dùng api-vcl.zushin.io.vn: đó là một bản
     deploy khác chạy code cũ, thiếu các API dịch vụ theo kiện / duyệt giá.
   - timeout 30 giây.
   - Request: gắn Authorization: Bearer <accessToken> đọc từ sessionStorage
     (phiên của app này nằm ở sessionStorage — xem @shared/utils/authSession).
     URL /api/Auth/* thì KHÔNG gắn: đăng nhập lại khi còn token cũ sẽ bị từ chối.
   - Response lỗi:
     * 401 body RỖNG và không phải request /api/Auth/* = JWT bị từ chối → hết
       phiên: gọi expireAuthSession() của @shared/utils/authSession (dọn phiên +
       về /login). Dùng đúng cơ chế sẵn có, không dựng cơ chế thứ hai.
     * 401 / 403 có { message } là lỗi NGHIỆP VỤ (không phải chủ đơn, không đủ
       quyền, tự duyệt báo giá mình lập...) → chỉ ném lỗi, KHÔNG đăng xuất.
   - Lỗi luôn ném nguyên dạng axios để component đọc error.response.data.message
     y như trước khi tầng HTTP bị gỡ.

   Không đụng window / sessionStorage ở top-level: tools/verify-api.mjs và
   tools/verify-barrels.mjs nạp file này qua Vite SSR (Node), nơi hai thứ đó
   không tồn tại.
   ========================================================= */

import axios from "axios";

import { expireAuthSession } from "@shared/utils/authSession";

export const DEFAULT_API_BASE_URL = "https://api-vcl.vnlogistic.click";

export const DEFAULT_TIMEOUT_MS = 30_000;

const ACCESS_TOKEN_KEY = "accessToken";

export const API_BASE_URL = (
  String(import.meta.env.VITE_API_BASE_URL ?? "").trim() ||
  DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

/* =========================================================
   STORAGE — truy cập lười và luôn bọc try/catch
   ========================================================= */

const readToken = () => {
  try {
    /* globalThis chứ không phải window: file này còn được nạp trong Node (SSR). */
    return globalThis.sessionStorage?.getItem(ACCESS_TOKEN_KEY) || null;
  } catch {
    /* Trình duyệt chặn storage (chế độ riêng tư, iframe sandbox). */
    return null;
  }
};

/* =========================================================
   QUY TẮC
   ========================================================= */

const isAuthUrl = (url) => /\/api\/auth\//i.test(String(url ?? ""));

const setHeader = (headers, name, value) => {
  if (typeof headers?.set === "function") {
    headers.set(name, value);
  } else if (headers) {
    headers[name] = value;
  }
};

const deleteHeader = (headers, name) => {
  if (typeof headers?.delete === "function") {
    headers.delete(name);
  } else if (headers) {
    delete headers[name];
  }
};

const readHeader = (headers, name) => {
  if (typeof headers?.get === "function") {
    return headers.get(name);
  }

  return headers?.[name] ?? headers?.[String(name).toLowerCase()];
};

const attachToken = (config) => {
  if (isAuthUrl(config?.url)) {
    deleteHeader(config.headers, "Authorization");
    return config;
  }

  /* Hàm nào đã tự truyền token thì giữ nguyên, không ghi đè. */
  if (readHeader(config.headers, "Authorization")) {
    return config;
  }

  const token = readToken();

  if (token) {
    setHeader(config.headers, "Authorization", `Bearer ${token}`);
  }

  return config;
};

/** Nhận diện lỗi huỷ request (AbortController / CanceledError của axios). */
export const isCanceledRequest = (error) =>
  Boolean(axios.isCancel?.(error)) || error?.code === "ERR_CANCELED";

/**
 * 401 do JWT bị từ chối trả body RỖNG; 401 do nghiệp vụ trả { message }.
 * Chỉ trường hợp đầu mới là "phiên hết hạn" và mới được đăng xuất.
 */
export const isSessionExpiredError = (error) => {
  const status = error?.response?.status;
  const url = String(error?.config?.url ?? "");

  return (
    status === 401 && !isAuthUrl(url) && !error?.response?.data?.message
  );
};

const handleResponseError = (error) => {
  if (isCanceledRequest(error)) {
    return Promise.reject(error);
  }

  console.error(
    "[httpClient]",
    String(error?.config?.method || "").toUpperCase(),
    error?.config?.url,
    error?.response?.status ?? error?.code,
    error?.response?.data ?? error?.message,
  );

  if (isSessionExpiredError(error)) {
    /* expireAuthSession tự kiểm tra môi trường trình duyệt trước khi dọn. */
    expireAuthSession();
  }

  return Promise.reject(error);
};

/* =========================================================
   INSTANCE
   ========================================================= */

/**
 * Tạo một axios instance có đủ interceptor chung. Dùng khi cần instance riêng
 * (ví dụ timeout dài cho upload) mà vẫn giữ nguyên quy tắc token / 401.
 *
 * @param {import("axios").CreateAxiosDefaults} [config]
 */
export const createHttpClient = (config = {}) => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: DEFAULT_TIMEOUT_MS,
    ...config,
    headers: {
      Accept: "application/json, text/plain, */*",
      ...(config.headers || {}),
    },
  });

  instance.interceptors.request.use(attachToken);
  instance.interceptors.response.use((response) => response, handleResponseError);

  return instance;
};

const httpClient = createHttpClient();

export default httpClient;
