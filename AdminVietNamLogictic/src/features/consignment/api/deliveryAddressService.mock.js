/**
 * MOCK sổ địa chỉ nhận hàng — BẢN SAO LƯU, không màn nào import (bản thật: deliveryAddressService.js).
 *
 * Tầng HTTP đã bị gỡ hẳn: không axiosInstance, không API_ENDPOINTS. Dữ liệu lấy từ
 * bộ mẫu `deliveryAddresses` trong @/mocks/data/deliveryAddresses và được mutate
 * ngay trong bộ nhớ, nhờ vậy hai màn tiêu thụ (ConsignmentOrder.jsx của ký gửi và
 * ConsignmentBuyOrder.jsx của mua hộ) vẫn chạy trọn vòng thêm → tải lại → chọn →
 * xoá mà không phải sửa một dòng nào trong component.
 *
 * BỀ MẶT PUBLIC GIỮ NGUYÊN: ba named export cùng tên, cùng thứ tự tham số, cộng
 * default export gom đúng ba hàm đó.
 *
 * Hình dạng trả về giữ đúng như bản thật (bản thật bóc `response.data.data ?? response.data`):
 * - getDeliveryAddressesApi -> MẢNG TRẦN các bản ghi địa chỉ. Cả hai màn đưa kết quả
 *   qua findArrayFromResult(result, ["addresses", "deliveryAddresses"]) nên mảng trần
 *   là dạng chắc chắn nhất; bọc thêm một lớp object cũng chạy, nhưng mảng trần khớp
 *   với những gì endpoint list vốn trả.
 * - createDeliveryAddressApi -> ĐÚNG MỘT OBJECT địa chỉ đã tạo (không bọc). Nhánh
 *   catch của cả hai màn đọc `createdResult?.data || createdResult` rồi đẩy qua
 *   normalizeDeliveryAddress, nên object phải tự mang đủ address/fullAddress/id.
 * - deleteDeliveryAddressApi -> object bản ghi vừa bị xoá. Không màn nào đọc giá trị
 *   này (chúng tự lọc addressList theo apiId), nhưng trả bản ghi vẫn đúng nghĩa
 *   "thành công" và tiện khi debug.
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm có một khối "// [API THẬT]" ghi lại endpoint cũ.
 * Chỉ cần thay phần đọc/ghi `addressStore` bằng lời gọi axiosInstance tương ứng và
 * bọc lại bằng `requestDeliveryAddressApi` (đã giữ nguyên logic đổi lỗi 403 thành
 * DELIVERY_ADDRESS_FORBIDDEN) là xong; phần validate phía trên dùng lại được hết.
 */

import {
  deliveryAddresses as deliveryAddressFixtures,
  buildFullAddress,
  findDeliveryAddressById,
  findDeliveryAddressByText,
} from "@/mocks/data/deliveryAddresses";
import {
  createApiError,
  deepClone,
  delay,
  nextUuid,
  nowIso,
} from "@/mocks/mockUtils";

/* Trỏ thẳng vào mảng fixture chứ không clone: thêm/xoá phải còn hiệu lực qua các
   lần gọi sau, vì luồng thêm địa chỉ của component là "create rồi gọi lại list"
   và nó dò địa chỉ vừa tạo trong danh sách mới để đánh dấu đang chọn. */
const addressStore = deliveryAddressFixtures;

const normalizeText = (value) => String(value ?? "").trim();

/**
 * Giữ nguyên phép đổi lỗi 403 của bản thật.
 *
 * Bản mock không sinh 403, nhưng hàm này là chỗ duy nhất biết cách biến lỗi quyền
 * thành DELIVERY_ADDRESS_FORBIDDEN; xoá đi thì lúc cắm API thật trở lại rất dễ
 * quên, và màn hình sẽ chỉ hiện "Request failed with status code 403".
 */
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

/* Địa chỉ mặc định phải là DUY NHẤT: form đặt đơn lấy list.find(item => item.isDefault)
   để chọn sẵn một thẻ, có hai bản ghi true thì thẻ được chọn phụ thuộc thứ tự mảng
   và trông như chọn ngẫu nhiên. */
const clearOtherDefaults = (keepId) => {
  addressStore.forEach((item) => {
    if (item.deliveryAddressId !== keepId) {
      item.isDefault = false;
    }
  });
};

/**
 * Dựng bản ghi mới từ payload FE gửi lên.
 *
 * Backend thật chỉ nhận đúng field `address`, nên bản ghi nó trả về gần như chỉ có
 * id + address. Mock giữ thêm detailAddress/province/district/ward khi payload có,
 * bởi danh sách sau khi tải lại sẽ hiện bản ghi mới cạnh bản ghi mẫu — thiếu các
 * field đó thì bản ghi mới trông trơ trọi hơn hẳn phần còn lại.
 */
const createAddressRecord = (address, source = {}) => {
  const id = nextUuid();
  const timestamp = nowIso();

  const detailAddress = normalizeText(source?.detailAddress);
  const provinceName = normalizeText(source?.provinceName);
  const districtName = normalizeText(source?.districtName);
  const wardName = normalizeText(source?.wardName);

  /* Ưu tiên chuỗi FE đã ghép sẵn. Chỉ tự ghép lại khi payload chỉ có các mảnh rời,
     và ghép bằng đúng công thức của fixture để chuỗi so sánh vẫn khớp. */
  const fullAddress =
    address ||
    buildFullAddress({
      detailAddress,
      wardName,
      districtName,
      provinceName,
    });

  return {
    deliveryAddressId: id,
    addressId: id,
    id,

    address: fullAddress,
    fullAddress,
    receiverAddress: fullAddress,

    receiverName: normalizeText(source?.receiverName),
    receiverPhone: normalizeText(source?.receiverPhone),

    detailAddress,
    wardCode: source?.wardCode ?? "",
    wardName,
    districtCode: source?.districtCode ?? "",
    districtName,
    provinceCode: source?.provinceCode ?? "",
    provinceName,

    isDefault: source?.isDefault === true,
    note: normalizeText(source?.note),

    createdAt: normalizeText(source?.createdAtUtc) || timestamp,
    updatedAt: timestamp,
  };
};

export const getDeliveryAddressesApi = async ({ signal } = {}) => {
  // [API THẬT] GET API_ENDPOINTS.deliveryAddresses.list (/api/delivery-addresses)
  await delay(240, signal);

  return await requestDeliveryAddressApi(async () =>
    /* Clone sâu trước khi trả: component sort/normalize trên kết quả, trả tham chiếu
       thẳng vào fixture là một màn sửa dữ liệu của mọi màn còn lại. */
    deepClone(addressStore)
  );
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

  // [API THẬT] POST API_ENDPOINTS.deliveryAddresses.list, body { address }
  await delay(320);

  return await requestDeliveryAddressApi(async () => {
    /* Trùng địa chỉ thì trả lại bản ghi có sẵn thay vì báo lỗi 409: component đã tự
       chặn trùng trước khi gọi, nên tới được đây là trường hợp biên (vd bấm Lưu hai
       lần); trả bản ghi cũ giữ luồng đi tiếp và không sinh dòng rác trong danh sách. */
    const existing = findDeliveryAddressByText(address);

    if (existing) {
      return deepClone(existing);
    }

    const created = createAddressRecord(
      address,
      typeof addressData === "string" ? {} : addressData
    );

    addressStore.push(created);

    if (created.isDefault) {
      clearOtherDefaults(created.deliveryAddressId);
    }

    return deepClone(created);
  });
};

export const deleteDeliveryAddressApi = async (addressId) => {
  const id = normalizeText(addressId);
  if (!id) throw new Error("Không tìm thấy mã địa chỉ cần xóa.");

  // [API THẬT] DELETE API_ENDPOINTS.deliveryAddresses.detail(id)
  await delay(280);

  return await requestDeliveryAddressApi(async () => {
    const target = findDeliveryAddressById(id);

    /* 404 dựng bằng createApiError để toast đọc được error.response.data.message —
       nhánh catch của component đi qua getApiErrorMessage, lỗi trơ chỉ hiện chuỗi
       fallback chung chung. */
    if (!target) {
      throw createApiError(404, "Không tìm thấy địa chỉ nhận hàng cần xóa.");
    }

    const removedIndex = addressStore.indexOf(target);
    addressStore.splice(removedIndex, 1);

    /* Xoá đúng địa chỉ mặc định thì đề bạt bản ghi đầu tiên còn lại: không còn bản
       ghi nào isDefault, lần mở form sau sẽ không có thẻ nào được chọn sẵn. */
    if (target.isDefault && addressStore.length > 0) {
      addressStore[0].isDefault = true;
    }

    return deepClone(target);
  });
};

export default {
  getDeliveryAddressesApi,
  createDeliveryAddressApi,
  deleteDeliveryAddressApi,
};
