/*
 * Hàm thuần dùng cho màn hình danh sách khách hàng.
 *
 * Tách khỏi CustomerList.jsx vì các hàm này chỉ phụ thuộc tham số của chính
 * chúng, bảng tra tĩnh và normalizeCustomerStatus của tầng api — không đọc
 * state/props/ref/context và không gọi hook nào, nên đọc và thử riêng được
 * mà không cần dựng cả trang.
 *
 * Thứ tự khai báo giữ nguyên như file gốc để quan hệ phụ thuộc giữa các hàm
 * không đổi.
 */

import { normalizeCustomerStatus } from "@features/customer/api/customerService";

import { CUSTOMER_STATUS_CONFIG } from "./CustomerList.constants";

/* =========================
   BASIC HELPERS
========================= */

export const normalizeText = (value) => {
  return String(value ?? "").trim();
};

/* Bỏ dấu tiếng Việt và hạ chữ thường để so khớp từ khóa tìm kiếm không phụ
   thuộc cách người dùng gõ có dấu hay không. */
export const normalizeSearchText = (value) => {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
};

/* Lấy giá trị đầu tiên thật sự có nội dung — dữ liệu khách hàng đến từ nhiều
   nguồn nên cùng một thông tin có thể nằm ở nhiều khóa khác nhau. */
export const pickValue = (...values) => {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      normalizeText(value) !== ""
    ) {
      return value;
    }
  }

  return "";
};

/* Payload danh sách có thể là mảng trần hoặc bọc trong nhiều lớp khóa khác
   nhau, nên phải dò lần lượt thay vì tin vào một khuôn cố định. */
export const getArrayItems = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.customers)) {
    return data.customers;
  }

  return [];
};

/* =========================
   CUSTOMER MAPPER
========================= */

export const normalizeCustomerRecord = (
  customer = {}
) => {
  const raw =
    customer?.raw || customer;

  const profile =
    raw?.profile ||
    raw?.user ||
    raw?.account ||
    {};

  const id = normalizeText(
    pickValue(
      customer?.id,
      customer?.customerId,
      raw?.id,
      raw?.customerId,
      raw?.userId,
      profile?.id,
      profile?.userId
    )
  );

  const status = normalizeCustomerStatus(
    pickValue(
      customer?.status,
      raw?.status,
      raw?.accountStatus,
      profile?.status
    )
  );

  const explicitIsActive =
    pickValue(
      customer?.isActive,
      raw?.isActive,
      raw?.active,
      profile?.isActive
    );

  const isActive =
    typeof explicitIsActive ===
    "boolean"
      ? explicitIsActive
      : status === "ACTIVE";

  return {
    ...customer,

    id,
    customerId: id,

    customerCode: normalizeText(
      pickValue(
        customer?.customerCode,
        raw?.customerCode,
        raw?.code,
        profile?.customerCode,
        profile?.code
      )
    ),

    fullName: normalizeText(
      pickValue(
        customer?.fullName,
        raw?.fullName,
        raw?.name,
        raw?.customerName,
        profile?.fullName,
        profile?.name
      )
    ),

    email: normalizeText(
      pickValue(
        customer?.email,
        raw?.email,
        profile?.email
      )
    ),

    phone: normalizeText(
      pickValue(
        customer?.phone,
        raw?.phone,
        raw?.phoneNumber,
        profile?.phone,
        profile?.phoneNumber
      )
    ),

    address: normalizeText(
      pickValue(
        customer?.address,
        raw?.address,
        raw?.fullAddress,
        profile?.address
      )
    ),

    companyName: normalizeText(
      pickValue(
        customer?.companyName,
        raw?.companyName,
        profile?.companyName
      )
    ),

    taxId: normalizeText(
      pickValue(
        customer?.taxId,
        raw?.taxId,
        profile?.taxId
      )
    ),

    region: normalizeText(
      pickValue(
        customer?.region,
        raw?.region,
        raw?.province,
        raw?.city,
        profile?.region,
        profile?.province,
        profile?.city
      )
    ),

    country: normalizeText(
      pickValue(
        customer?.country,
        raw?.country,
        profile?.country
      )
    ),

    status,
    isActive,

    createdAt: pickValue(
      customer?.createdAt,
      raw?.createdAt,
      raw?.registeredAt,
      profile?.createdAt
    ),

    updatedAt: pickValue(
      customer?.updatedAt,
      raw?.updatedAt,
      profile?.updatedAt
    ),

    raw,
  };
};

/* =========================
   STATUS HELPERS
========================= */

/* Bản ghi cũ có thể chỉ có cờ isActive mà chưa có status, nên phải suy ngược
   ra mã trạng thái để phần lọc và phần thống kê dùng chung một nguồn. */
export const getCustomerStatusCode = (customer) => {
  const status = normalizeCustomerStatus(customer?.status);

  if (status) {
    return status;
  }

  return customer?.isActive === true
    ? "ACTIVE"
    : "INACTIVE";
};

export const getCustomerStatus = (customer) => {
  const statusCode =
    getCustomerStatusCode(customer);

  return (
    CUSTOMER_STATUS_CONFIG[
      statusCode
    ] || {
      label: "Chưa xác định",
      className: "is-unknown",
    }
  );
};

/* =========================
   DISPLAY FORMATTERS
========================= */

export const formatDate = (value) => {
  if (!value) {
    return "Chưa cập nhật";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa cập nhật";
  }

  return new Intl.DateTimeFormat(
    "vi-VN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date);
};

export const getAvatarLetter = (fullName) => {
  return (
    normalizeText(fullName)
      .charAt(0)
      .toUpperCase() || "K"
  );
};

/* Ghép địa chỉ từ nhiều trường rời và khử trùng lặp, vì tỉnh/quốc gia hay bị
   lặp lại ngay trong chuỗi address. */
export const getCustomerAddress = (customer) => {
  const values = [
    customer?.address,
    customer?.region,
    customer?.country,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return [...new Set(values)].join(", ");
};
