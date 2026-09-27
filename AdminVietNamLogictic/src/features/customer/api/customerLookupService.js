/**
 * TRA CỨU KHÁCH HÀNG CHO NHÂN VIÊN LÊN ĐƠN HỘ — ĐÃ NỐI API THẬT.
 *
 *   GET /api/customers?search=            → { items: [ CustomerResponseDto ] }
 *   GET /api/customers/{id}/delivery-addresses → { message, data: [ DeliveryAddressResponse ] }
 *
 * VÌ SAO LÀ MỘT MODULE RIÊNG, KHÔNG SỬA ./customerService.js:
 * customerService.js hiện vẫn là bản MOCK (đọc @/mocks/data/people) và đang nuôi
 * bốn màn danh mục khách hàng. Màn "Sale tạo đơn hộ khách" thì bắt buộc phải có
 * `customerId` THẬT, vì POST /api/staff/consignments tra khách bằng đúng id đó
 * (CustomerLookupHelper.ResolveForStaff → Customer.Id). Id của bộ dữ liệu mẫu gửi
 * lên sẽ ăn 404. Tách module để luồng tạo đơn chạy dữ liệu thật ngay mà không kéo
 * cả bốn màn kia sang API thật trong cùng một đợt.
 *
 * `id` trả về ở đây là Customer.Id — CÙNG một khoá mà hai endpoint phía sau dùng:
 * - POST /api/staff/consignments (customerId)
 * - GET  /api/customers/{customerId}/delivery-addresses
 * Đừng thay bằng userId: hai bảng khác nhau, tra chéo sẽ ra 404.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";

const normalizeText = (value) => String(value ?? "").trim();

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Ném ngay tại giao diện thay vì để backend trả 400 với câu tiếng Anh. */
export const requireCustomerId = (customerId) => {
  const id = normalizeText(customerId);

  if (!id) {
    throw new Error("Vui lòng chọn khách hàng cần tạo đơn.");
  }

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Mã khách hàng không đúng định dạng UUID.");
  }

  return id;
};

/**
 * Bản ghi khách hàng dùng cho ô chọn khách: đủ họ tên / SĐT / email để thẻ
 * "Đang tạo đơn cho ..." hiện nguyên vẹn, cộng searchText để lọc thêm tại chỗ.
 */
export const normalizeLookupCustomer = (customer = {}) => {
  const id = normalizeText(customer?.id ?? customer?.customerId);

  const fullName =
    normalizeText(customer?.fullName) ||
    normalizeText(customer?.name) ||
    normalizeText(customer?.customerName);

  const phone =
    normalizeText(customer?.phone) || normalizeText(customer?.phoneNumber);

  const email = normalizeText(customer?.email);

  const customerCode =
    normalizeText(customer?.customerCode) || normalizeText(customer?.code);

  const address = normalizeText(customer?.address);

  const status = normalizeText(customer?.status).toUpperCase();

  return {
    id,
    customerId: id,
    customerCode,
    fullName,
    phone,
    email,
    address,
    companyName: normalizeText(customer?.companyName),
    status,
    isActive:
      typeof customer?.isActive === "boolean"
        ? customer.isActive
        : status === "" || status === "ACTIVE",

    /* Bỏ dấu + hạ chữ thường: gõ "nguyen van" vẫn ra "Nguyễn Văn". */
    searchText: [fullName, customerCode, phone, email, address]
      .filter(Boolean)
      .join(" ")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase(),
  };
};

/**
 * GET /api/customers?search=
 *
 * Backend lọc sẵn theo tên / mã / email / SĐT / địa chỉ / tên công ty
 * (CustomerService.GetAllCustomersAsync), nên từ khoá được đẩy thẳng lên server.
 * Trả về MẢNG TRẦN các bản ghi đã chuẩn hoá, bỏ bản ghi không có id (không chọn
 * được thì hiện ra chỉ tổ gây nhầm).
 */
export const searchCustomersApi = async ({ search, signal } = {}) => {
  const response = await httpClient.get(API_ENDPOINTS.customers.list, {
    params: removeEmptyParams({ search }),
    signal,
  });

  return getArrayItems(getResponseData(response))
    .map(normalizeLookupCustomer)
    .filter((customer) => Boolean(customer.id));
};

/**
 * GET /api/customers/{customerId}/delivery-addresses
 *
 * Trả MẢNG TRẦN bản ghi địa chỉ nguyên dạng backend; phần chuẩn hoá về
 * { address, fullAddress, isDefault... } do normalizeDeliveryAddressList của màn
 * hình đảm nhiệm (dùng chung với luồng khách, để hai bên hiện giống hệt nhau).
 */
export const getCustomerDeliveryAddressesApi = async (
  customerId,
  { signal } = {},
) => {
  const id = requireCustomerId(customerId);

  const response = await httpClient.get(
    API_ENDPOINTS.customers.deliveryAddresses(id),
    { signal },
  );

  return getArrayItems(getResponseData(response));
};

/**
 * Nhân viên THÊM địa chỉ nhận hàng vào sổ của khách.
 *
 * POST /api/customers/{customerId}/delivery-addresses — role Admin/Sale/OperationsManager.
 * Khác POST /api/delivery-addresses: endpoint kia [Authorize(Roles = "Customer")], gọi
 * bằng token Sale chỉ ăn 403, nên trước đây Sale tạo đơn hộ khách mà khách chưa có địa
 * chỉ nào thì địa chỉ gõ tay chỉ dùng được cho đúng đơn đó rồi mất.
 *
 * Gửi lại đúng chuỗi địa chỉ đã có thì backend trả lại dòng cũ, không nhân đôi sổ.
 */
export const createCustomerDeliveryAddressApi = async (
  customerId,
  { address, signal } = {},
) => {
  const id = requireCustomerId(customerId);
  const value = String(address ?? "").trim();

  if (!value) {
    throw new Error("Địa chỉ nhận hàng không được để trống.");
  }

  const response = await httpClient.post(
    API_ENDPOINTS.customers.createDeliveryAddress(id),
    { address: value },
    { signal },
  );

  return getResponseData(response);
};

const customerLookupService = {
  requireCustomerId,
  normalizeLookupCustomer,
  searchCustomersApi,
  getCustomerDeliveryAddressesApi,
  createCustomerDeliveryAddressApi,
};

export default customerLookupService;
