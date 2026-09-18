/**
 * XÁC THỰC — ĐÃ NỐI API THẬT (đợt báo giá ký gửi).
 *
 *   POST /api/Auth/login   → OBJECT TRẦN { token, expiresAt, userId, fullName, role, region }
 *   GET  /api/User/profile → OBJECT TRẦN { id, fullName, email, phone, role, userType,
 *                                          status, region, customerCode, ... }
 *   PUT  /api/User/profile → { message } (KHÔNG trả lại hồ sơ)
 *
 * HAI CHỖ HÌNH DẠNG CỰC DỄ VỠ — giữ nguyên ghi chú của bản trước:
 *
 * 1. Login.jsx bóc kết quả bằng `response?.data?.data ?? response?.data ?? response`.
 *    Nếu payload đăng nhập có khoá `data` thì nó bóc lầm một tầng nữa rồi mất
 *    token. Vì vậy payload đăng nhập TUYỆT ĐỐI không được có khoá `data` — và
 *    cũng vì vậy loginApi trả thẳng object của backend, không bọc thêm gì.
 * 2. UserProfileModal.unwrapProfileData còn dò tiếp `data.profile || data.user ||
 *    data.userInfo || data.account`. Nên hồ sơ cá nhân phải là object PHẲNG,
 *    không có `user` / `profile` / `userInfo` / `account` lồng trong.
 *
 * VAI TRÒ: đây là trang QUẢN TRỊ NỘI BỘ (Sale, Admin, OperationsManager,
 * WarehouseStaff, Delivery). Tài khoản `Customer` đăng nhập được ở backend nhưng
 * không có màn hình nào ở đây, nên bị chặn ngay sau khi backend trả token —
 * chặn bằng lỗi DẠNG AXIOS để Login.jsx đọc `error.response.data.message` như
 * mọi lỗi khác.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getResponseData } from "@shared/api/apiEnvelope";

/* =========================
   HELPERS
========================= */

const normalizeText = (value) => String(value ?? "").trim();

/** So vai trò bỏ qua hoa/thường và ký tự ngăn cách ("Operations Manager" → "operationsmanager"). */
const normalizeRole = (role) =>
  normalizeText(role).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Vai trò KHÔNG được dùng trang quản trị nội bộ. */
const BLOCKED_ROLES = new Set(["customer"]);

const CUSTOMER_BLOCKED_MESSAGE =
  "Tài khoản khách hàng không dùng được cho trang quản trị.";

/**
 * Dựng lỗi đúng dạng axios ném ra, để component đọc `error.response.data.message`
 * giống hệt lỗi thật từ server.
 */
const createApiError = (status, message) => {
  const error = new Error(message);

  error.name = "AxiosError";
  error.isAxiosError = true;
  error.code = status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST";
  error.status = status;
  error.config = { headers: {} };
  error.request = {};
  error.response = {
    status,
    statusText: status === 403 ? "Forbidden" : "Error",
    data: { message, error: message, title: message },
    headers: {},
    config: { headers: {} },
  };

  return error;
};

/**
 * Giữ nguyên hành vi chặn sớm của bản trước: UserProfileModal in thẳng
 * error.message ra toast, nên thiếu token phải báo "đăng nhập lại" chứ không
 * để request bay đi rồi nhận 401.
 */
const requireAccessToken = () => {
  const token = normalizeText(
    globalThis.sessionStorage?.getItem("accessToken"),
  );

  if (!token) {
    throw new Error("Không tìm thấy token. Vui lòng đăng nhập lại.");
  }

  return token;
};

/* =========================
   ĐĂNG NHẬP
========================= */

/**
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ token: string, expiresAt: string, userId: string, fullName: string, role: string, region: string }>}
 */
export const loginApi = async ({ email, password }) => {
  const response = await httpClient.post(API_ENDPOINTS.auth.login, {
    email: normalizeText(email),
    password,
  });

  /* Login trả object TRẦN; getResponseData chỉ bóc khi có khoá `data`. */
  const data = getResponseData(response) || {};

  if (BLOCKED_ROLES.has(normalizeRole(data?.role))) {
    throw createApiError(403, CUSTOMER_BLOCKED_MESSAGE);
  }

  return data;
};

/* =========================
   HỒ SƠ CÁ NHÂN
========================= */

/**
 * Hồ sơ của người đang đăng nhập — object PHẲNG (xem ghi chú 2 ở đầu file).
 */
export const getUserProfileApi = async () => {
  requireAccessToken();

  const response = await httpClient.get(API_ENDPOINTS.auth.profile);

  return getResponseData(response) || {};
};

/**
 * Cập nhật hồ sơ.
 *
 * Backend chỉ trả `{ message }`, KHÔNG trả lại hồ sơ. Hợp đồng cũ là trả về bản
 * ghi đã cập nhật, nên sau khi PUT thành công thì GET lại hồ sơ — modal dựa vào
 * giá trị trả về để vẽ lại, trả `{ message }` là mọi ô trắng trơn.
 *
 * Hai phép kiểm dưới đây chạy TRƯỚC khi gọi mạng, đúng như bản cũ: bỏ đi thì
 * form gửi tên rỗng vẫn "thành công".
 */
export const updateUserProfileApi = async ({
  fullName,
  phone,
  country,
  address,
}) => {
  requireAccessToken();

  const payload = {
    fullName: normalizeText(fullName),
    phone: normalizeText(phone),
    country: normalizeText(country),
    address: normalizeText(address),
  };

  if (!payload.fullName) {
    throw new Error("Vui lòng nhập họ và tên.");
  }

  /*
   * Backend đánh dấu Phone là [Required] và trả về ModelState (không có khoá
   * `message`) khi thiếu — toast sẽ rơi về câu mặc định vô nghĩa. Chặn tại đây
   * để người dùng đọc được đúng việc phải làm.
   */
  if (!payload.phone) {
    throw new Error("Vui lòng nhập số điện thoại.");
  }

  if (!/^0\d{9}$/.test(payload.phone)) {
    throw new Error(
      "Số điện thoại phải bắt đầu bằng 0 và gồm đúng 10 chữ số.",
    );
  }

  await httpClient.put(API_ENDPOINTS.auth.profile, payload);

  const profile = await getUserProfileApi();

  /*
   * Hồ sơ đọc lại là nguồn sự thật, nhưng backend có thể chưa lưu country/address
   * (hai trường này không nằm trong UpdateProfileRequest ở mọi phiên bản). Ghi đè
   * bằng giá trị vừa gửi để modal không "nhảy về" giá trị cũ ngay sau khi lưu.
   */
  return {
    ...profile,
    fullName: payload.fullName || profile?.fullName,
    phone: payload.phone || profile?.phone,
    country: payload.country || profile?.country,
    address: payload.address || profile?.address,
  };
};
