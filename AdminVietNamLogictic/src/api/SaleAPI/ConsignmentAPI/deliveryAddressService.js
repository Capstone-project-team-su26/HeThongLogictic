import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

const getResponseData = (response) =>
  response?.data?.data ?? response?.data ?? null;

const normalizeText = (value) => String(value ?? "").trim();

const requestDeliveryAddressApi = async (request) => {
  try {
    return await request();
  } catch (error) {
    if (error?.response?.status === 403) {
      const permissionError = new Error(
        "Tài khoản hiện tại không được cấp quyền sử dụng sổ địa chỉ. " +
          "Backend cần cho phép role Sale truy cập API delivery-addresses.",
        { cause: error }
      );

      permissionError.code = "DELIVERY_ADDRESS_FORBIDDEN";
      permissionError.status = 403;
      throw permissionError;
    }

    throw error;
  }
};

export const getDeliveryAddressesApi = async ({ signal } = {}) => {
  const response = await requestDeliveryAddressApi(() =>
    axiosInstance.get(API_ENDPOINTS.deliveryAddresses.list, {
      signal,
      headers: { Accept: "*/*" },
    })
  );

  return getResponseData(response);
};

export const createDeliveryAddressApi = async (addressData = {}) => {
  const address = normalizeText(
    typeof addressData === "string"
      ? addressData
      : addressData?.address ??
          addressData?.fullAddress ??
          addressData?.receiverAddress
  );

  if (!address) {
    throw new Error("Vui lòng nhập địa chỉ nhận hàng.");
  }

  const response = await requestDeliveryAddressApi(() =>
    axiosInstance.post(
      API_ENDPOINTS.deliveryAddresses.list,
      { address },
      {
        headers: { Accept: "*/*" },
      }
    )
  );

  return getResponseData(response);
};

export const deleteDeliveryAddressApi = async (addressId) => {
  const id = normalizeText(addressId);
  if (!id) throw new Error("Không tìm thấy mã địa chỉ cần xóa.");

  const response = await requestDeliveryAddressApi(() =>
    axiosInstance.delete(API_ENDPOINTS.deliveryAddresses.detail(id), {
      headers: { Accept: "*/*" },
    })
  );

  return getResponseData(response);
};

export default {
  getDeliveryAddressesApi,
  createDeliveryAddressApi,
  deleteDeliveryAddressApi,
};
