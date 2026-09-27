/**
 * Khách hàng — API THẬT (CustomerController, [Authorize(Roles = "Admin,Sale")]).
 *
 *   GET    /api/customers?search=   → { items: [CustomerResponseDto] } (backend chỉ lọc theo search)
 *   GET    /api/customers/{id}      → TRẦN CustomerResponseDto · 404 { message }
 *   POST   /api/customers           → 201 { message, customer } · 400 { message } (trùng SĐT/email...)
 *   PUT    /api/customers/{id}      → { message, customer } · 400/404 { message }
 *   DELETE /api/customers/{id}      → { message } — VÔ HIỆU HOÁ (status INACTIVE), không xoá cứng
 *
 * CustomerResponseDto { id, customerCode, fullName, email, phone, address, companyName, taxId, status }.
 * Giữ nguyên tên export + hình dạng bản ghi của bản mock (normalizeCustomer) để CustomerList,
 * CustomerDetailModal, CreateCustomerSale, EditCustomerSale không phải đổi. Trùng SĐT/email do
 * backend kiểm (câu tiếng Việt của backend hiện nguyên). Lỗi HTTP ném nguyên dạng axios.
 * Bản mock cũ (fixture @/mocks/data/people) nằm ở customerService.mock.js.
 */
import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getResponseData } from "@shared/api/apiEnvelope";

/* =========================
   COMMON HELPERS
========================= */

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizePhone = (value) => {
  return normalizeText(value).replace(/\D/g, "");
};

const normalizeEmail = (value) => {
  return normalizeText(value).toLowerCase();
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const resolveCustomerId = (customer = {}) => {
  const profile = customer?.profile || customer?.customerProfile || {};
  const candidates = [
    customer?.customerId,
    customer?.userId,
    customer?.id,
    profile?.customerId,
    profile?.userId,
    profile?.id,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return (
    candidates.find((candidate) => UUID_PATTERN.test(candidate)) ||
    candidates[0] ||
    ""
  );
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue =
    normalizeText(value).toLowerCase();

  return [
    "true",
    "1",
    "active",
    "enabled",
  ].includes(normalizedValue);
};

export const normalizeCustomerStatus = (value) => {
  const normalized = normalizeText(value)
    .replace(/[\s_-]+/g, "")
    .toUpperCase();

  const statusMap = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    PENDING: "PENDING",
    PENDINGVERIFICATION: "PENDING_VERIFICATION",
    BLOCKED: "BLOCKED",
    SUSPENDED: "SUSPENDED",
    DELETED: "DELETED",
  };

  return statusMap[normalized] || normalized;
};

const removeEmptyParams = (
  params = {}
) => {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
};

const getArrayItems = (data) => {
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
   NORMALIZE CUSTOMER
========================= */

export const normalizeCustomer = (
  customer = {}
) => {
  const id =
    resolveCustomerId(customer);

  const fullName =
    normalizeText(
      customer?.fullName
    ) ||
    normalizeText(
      customer?.name
    ) ||
    normalizeText(
      customer?.customerName
    );

  return {
    id,
    customerId: id,

    customerCode:
      normalizeText(
        customer?.customerCode
      ) ||
      normalizeText(
        customer?.code
      ),

    fullName,

    email:
      normalizeText(
        customer?.email
      ),

    phone:
      normalizeText(
        customer?.phone
      ) ||
      normalizeText(
        customer?.phoneNumber
      ),

    address:
      normalizeText(
        customer?.address
      ),

    companyName:
      normalizeText(customer?.companyName),

    taxId:
      normalizeText(customer?.taxId),

    country:
      normalizeText(
        customer?.country
      ),

    region:
      normalizeText(
        customer?.region
      ),

    status:
      normalizeCustomerStatus(customer?.status),

    isActive:
      customer?.isActive !==
        undefined
        ? normalizeBoolean(
            customer?.isActive
          )
        : normalizeCustomerStatus(customer?.status) === "ACTIVE",

    createdAt:
      customer?.createdAt || null,

    updatedAt:
      customer?.updatedAt || null,

    raw: customer,
  };
};

export const normalizeCustomerPayload = (customer = {}) => ({
  fullName: normalizeText(customer?.fullName),
  phone: normalizePhone(customer?.phone),
  email: normalizeEmail(customer?.email),
  address: normalizeText(customer?.address),
  companyName: normalizeText(customer?.companyName),
  taxId: normalizeText(customer?.taxId),
  status: normalizeCustomerStatus(customer?.status) || "ACTIVE",
});

const validateCustomerPayload = (payload) => {
  if (!payload.fullName) {
    throw new Error("Vui lòng nhập tên khách hàng.");
  }
  if (!payload.phone) {
    throw new Error("Vui lòng nhập số điện thoại.");
  }
  if (!/^0\d{9}$/.test(payload.phone)) {
    throw new Error("Số điện thoại phải bắt đầu bằng số 0 và gồm đúng 10 chữ số.");
  }
  if (!payload.email) {
    throw new Error("Vui lòng nhập email.");
  }
};

export const validateCustomerUniqueness = (
  payload,
  customers = [],
  excludedCustomerId = ""
) => {
  const normalizedExcludedId = normalizeText(excludedCustomerId);
  const normalizedPhone = normalizePhone(payload?.phone);
  const normalizedEmail = normalizeEmail(payload?.email);

  const comparableCustomers = Array.isArray(customers)
    ? customers.filter(
        (customer) =>
          resolveCustomerId(customer) !== normalizedExcludedId
      )
    : [];

  if (
    normalizedPhone &&
    comparableCustomers.some(
      (customer) => normalizePhone(customer?.phone) === normalizedPhone
    )
  ) {
    throw new Error("Số điện thoại này đã tồn tại trong danh sách khách hàng.");
  }

  if (
    normalizedEmail &&
    comparableCustomers.some(
      (customer) => normalizeEmail(customer?.email) === normalizedEmail
    )
  ) {
    throw new Error("Email này đã tồn tại trong danh sách khách hàng.");
  }
};

/* =========================
   LỌC / PHÂN TRANG PHÍA CLIENT
========================= */

/* Backend chỉ nhận ?search=; trạng thái và trang lọc tại chỗ (CustomerList tự phân trang). */
const filterCustomerRows = (rows, filters = {}) => {
  const params = removeEmptyParams(filters);
  const status = normalizeCustomerStatus(params.status);

  const filtered = rows.filter(
    (customer) => !status || status === "ALL" || customer.status === status
  );

  const page = Number(params.page ?? params.pageNumber);
  const size = Number(params.pageSize ?? params.size ?? params.limit);

  if (Number.isFinite(size) && size > 0) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
    const startIndex = (safePage - 1) * Math.trunc(size);

    return filtered.slice(startIndex, startIndex + Math.trunc(size));
  }

  return filtered;
};

/** Chặn id rỗng / sai khuôn trước khi gọi mạng. */
const requireCustomerId = (customerId) => {
  const normalizedCustomerId = normalizeText(customerId);

  if (!normalizedCustomerId) {
    throw new Error("Không tìm thấy mã khách hàng.");
  }

  if (!UUID_PATTERN.test(normalizedCustomerId)) {
    throw new Error("Mã khách hàng không đúng định dạng UUID.");
  }

  return normalizedCustomerId;
};

/* Body đúng Create/UpdateCustomerRequestDto: chuỗi rỗng tuỳ chọn gửi null. */
const toCustomerRequestBody = (payload) => ({
  fullName: payload.fullName,
  phone: payload.phone,
  email: payload.email || null,
  address: payload.address || null,
  companyName: payload.companyName || null,
  taxId: payload.taxId || null,
  status: payload.status || "ACTIVE",
});

/** POST/PUT trả { message, customer }; chấp nhận thêm bản ghi trần. */
const pickCustomerRecord = (response) => {
  const data = getResponseData(response);
  return data?.customer ?? data;
};

/* =========================
   API
========================= */

/**
 * GET /api/customers — bộ lọc { search | keyword | q, status, page, pageSize, signal }.
 * Trả MẢNG TRẦN đã chuẩn hoá.
 */
export const getCustomersApi = async (filters = {}) => {
  const search = normalizeText(filters?.search ?? filters?.keyword ?? filters?.q);

  const response = await httpClient.get(API_ENDPOINTS.customers.list, {
    params: removeEmptyParams({ search }),
    signal: filters?.signal,
  });

  const rows = getArrayItems(getResponseData(response))
    .map(normalizeCustomer)
    .filter((customer) => Boolean(customer.id));

  return filterCustomerRows(rows, filters);
};

/** GET /api/customers/{id} — 404 trả null (CustomerDetailModal hiện "Không tìm thấy"). */
export const getCustomerByIdApi = async (customerId, options = {}) => {
  const id = requireCustomerId(customerId);

  try {
    const response = await httpClient.get(API_ENDPOINTS.customers.detail(id), {
      signal: options?.signal,
    });
    const data = getResponseData(response);
    return data ? normalizeCustomer(data) : null;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

export const createCustomerApi = async (customer) => {
  const payload = normalizeCustomerPayload(customer);
  validateCustomerPayload(payload);

  const response = await httpClient.post(
    API_ENDPOINTS.customers.list,
    toCustomerRequestBody(payload)
  );

  return normalizeCustomer(pickCustomerRecord(response) || {});
};

export const updateCustomerApi = async (customerId, customer) => {
  const id = requireCustomerId(customerId);
  const payload = normalizeCustomerPayload(customer);
  validateCustomerPayload(payload);

  const response = await httpClient.put(
    API_ENDPOINTS.customers.detail(id),
    toCustomerRequestBody(payload)
  );

  const record = pickCustomerRecord(response);

  return normalizeCustomer(record && typeof record === "object" && record.id ? record : { ...payload, id });
};

/** DELETE = vô hiệu hoá (INACTIVE), giữ lịch sử đơn. */
export const deleteCustomerApi = async (customerId) => {
  const id = requireCustomerId(customerId);

  const response = await httpClient.delete(API_ENDPOINTS.customers.detail(id));

  return {
    success: true,
    customerId: id,
    message:
      normalizeText(response?.data?.message) ||
      "Đã vô hiệu hoá hồ sơ khách hàng.",
  };
};

/* =========================
   GET ACTIVE CUSTOMERS
========================= */

export const getActiveCustomersApi =
  async (filters = {}) => {
    const customers =
      await getCustomersApi(filters);

    return customers.filter(
      (customer) =>
        customer.isActive === true
    );
  };

/* =========================
   MAP CUSTOMER OPTIONS
========================= */

export const mapCustomersToOptions = (
  customers = []
) => {
  if (!Array.isArray(customers)) {
    return [];
  }

  return customers
    .filter(
      (customer) =>
        Boolean(customer?.id)
    )
    .map((customer) => {
      const fullName =
        normalizeText(
          customer?.fullName
        ) || "Khách hàng";

      const phone =
        normalizeText(
          customer?.phone
        );

      const email =
        normalizeText(
          customer?.email
        );

      const customerCode =
        normalizeText(
          customer?.customerCode
        );

      const extraInfo = [
        customerCode,
        phone,
        email,
      ]
        .filter(Boolean)
        .join(" • ");

      return {
        value: customer.id,

        label: extraInfo
          ? `${fullName} — ${extraInfo}`
          : fullName,

        id: customer.id,
        customerId: customer.id,
        customerCode,
        fullName,
        phone,
        email,
        address:
          customer?.address || "",
        status:
          customer?.status || "",
        isActive:
          customer?.isActive === true,

        searchText: [
          fullName,
          customerCode,
          phone,
          email,
          customer?.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });
};

/* =========================
   FIND CUSTOMER BY ID
========================= */

export const findCustomerById = (
  customers = [],
  customerId
) => {
  if (!Array.isArray(customers)) {
    return null;
  }

  const normalizedId =
    normalizeText(customerId);

  if (!normalizedId) {
    return null;
  }

  return (
    customers.find(
      (customer) =>
        normalizeText(
          customer?.id ??
            customer?.customerId
        ) === normalizedId
    ) || null
  );
};

/* =========================
   DEFAULT EXPORT
========================= */

const customerService = {
  normalizeCustomer,
  normalizeCustomerStatus,
  normalizeCustomerPayload,
  validateCustomerUniqueness,

  getCustomersApi,
  getCustomerByIdApi,
  createCustomerApi,
  updateCustomerApi,
  deleteCustomerApi,
  getActiveCustomersApi,

  mapCustomersToOptions,
  findCustomerById,
};

export default customerService;
