/**
 * Sổ địa chỉ nhận hàng CỦA CHÍNH NGƯỜI GỌI — API THẬT (DeliveryAddressController).
 *
 *   GET    /api/delivery-addresses        → { message, data: [DeliveryAddressResponse] } (mọi vai trò)
 *   POST   /api/delivery-addresses        → [Authorize(Roles = "Customer")] — nhân viên 403
 *   DELETE /api/delivery-addresses/{id}   → [Authorize(Roles = "Customer")] — nhân viên 403
 *
 * LƯU Ý (27/09/2026): KHÔNG màn nào của admin-ui còn dùng module này. Sale tạo đơn hộ khách
 * (ConsignmentOrder, ConsignmentBuyOrder) đọc/ghi sổ của KHÁCH ĐÃ CHỌN qua
 * @features/customer/api/customerLookupService (/api/customers/{customerId}/delivery-addresses).
 * Giữ lại bề mặt cũ (3 hàm + default) cho barrel @features/consignment; 403 được đổi thành câu
 * tiếng Việt DELIVERY_ADDRESS_FORBIDDEN. Bản mock cũ nằm ở deliveryAddressService.mock.js.
 */
import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";

const normalizeText = (value) => String(value ?? "").trim();

const requestDeliveryAddressApi = async (request) => {
  try {
    return await request();
  } catch (error) {
    if (error?.response?.status === 403) {
      const permissionError = new Error(
        "Tài khoản nhân viên không được sửa sổ địa chỉ này. " +
          "Hãy dùng sổ địa chỉ của khách (chọn khách hàng trước).",
        { cause: error }
      );

      permissionError.code = "DELIVERY_ADDRESS_FORBIDDEN";
      permissionError.status = 403;
      throw permissionError;
    }

    throw error;
  }
};

/** GET — MẢNG TRẦN bản ghi địa chỉ nguyên dạng backend. */
export const getDeliveryAddressesApi = async ({ signal } = {}) =>
  requestDeliveryAddressApi(async () => {
    const response = await httpClient.get(API_ENDPOINTS.deliveryAddresses.list, { signal });
    return getArrayItems(getResponseData(response));
  });

/** POST { address } — chỉ tài khoản Customer. Trả ĐÚNG MỘT object địa chỉ đã tạo. */
export const createDeliveryAddressApi = async (addressData = {}) => {
  const address = normalizeText(
    typeof addressData === "string"
      ? addressData
      : addressData?.address ?? addressData?.fullAddress ?? addressData?.receiverAddress
  );

  if (!address) {
    throw new Error("Vui lòng nhập địa chỉ nhận hàng.");
  }

  return requestDeliveryAddressApi(async () => {
    const response = await httpClient.post(API_ENDPOINTS.deliveryAddresses.list, { address });
    return getResponseData(response);
  });
};

/** DELETE — chỉ tài khoản Customer. */
export const deleteDeliveryAddressApi = async (addressId) => {
  const id = normalizeText(addressId);
  if (!id) throw new Error("Không tìm thấy mã địa chỉ cần xóa.");

  return requestDeliveryAddressApi(async () => {
    const response = await httpClient.delete(API_ENDPOINTS.deliveryAddresses.detail(id));
    return getResponseData(response) ?? { id };
  });
};

export default {
  getDeliveryAddressesApi,
  createDeliveryAddressApi,
  deleteDeliveryAddressApi,
};
