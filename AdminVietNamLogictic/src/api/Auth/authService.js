import axiosInstance from "../axiosInstance";
import { API_ENDPOINTS } from "../apiEndpoints";

/* =========================
   RESPONSE HELPER
========================= */

const getResponseData = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    null
  );
};

const getAccessToken = () => {
  const token = sessionStorage.getItem(
    "accessToken"
  );

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

/* =========================
   ĐĂNG NHẬP
========================= */

export const loginApi = async ({
  email,
  password,
}) => {
  const response = await axiosInstance.post(
    API_ENDPOINTS.auth.login,
    {
      email: String(email || "").trim(),
      password,
    }
  );

  return getResponseData(response);
};

/* =========================
   LẤY THÔNG TIN PROFILE
========================= */

export const getUserProfileApi = async () => {
  const token = getAccessToken();

  const response = await axiosInstance.get(
    API_ENDPOINTS.auth.profile,
    {
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return getResponseData(response);
};

/* =========================
   CẬP NHẬT PROFILE
========================= */

export const updateUserProfileApi = async ({
  fullName,
  phone,
  country,
  address,
}) => {
  const token = getAccessToken();

  const payload = {
    fullName: String(fullName || "").trim(),
    phone: String(phone || "").trim(),
    country: String(country || "").trim(),
    address: String(address || "").trim(),
  };

  if (!payload.fullName) {
    throw new Error(
      "Vui lòng nhập họ và tên."
    );
  }

  if (payload.phone && !/^0\d{9}$/.test(payload.phone)) {
    throw new Error(
      "Số điện thoại phải bắt đầu bằng 0 và gồm đúng 10 chữ số."
    );
  }

  const response = await axiosInstance.put(
    API_ENDPOINTS.auth.profile,
    payload,
    {
      headers: {
        Accept: "*/*",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return getResponseData(response);
};
