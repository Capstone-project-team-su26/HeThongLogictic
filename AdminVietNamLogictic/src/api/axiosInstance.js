import axios from "axios";
import {
  expireAuthSession,
  getStoredAccessToken,
  isAccessTokenExpired,
} from "../utils/Common/authSession";

const baseURL =
  import.meta.env.VITE_API_BASE_URL?.replace(
    /\/+$/,
    "",
  );

if (!baseURL) {
  throw new Error(
    "Không tìm thấy VITE_API_BASE_URL trong file .env",
  );
}

const axiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();

    if (token && isAccessTokenExpired(token)) {
      expireAuthSession();

      const error = new Error(
        "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
      );
      error.code = "AUTH_SESSION_EXPIRED";
      return Promise.reject(error);
    }

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = String(error?.config?.url || "")
      .toLowerCase()
      .includes("/api/auth/login");

    if (error?.response?.status === 401 && !isLoginRequest) {
      expireAuthSession();
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
