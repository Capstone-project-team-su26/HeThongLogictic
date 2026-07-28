import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

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

/* =========================
   TOKEN HELPER
========================= */

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

const getAuthHeaders = () => {
  return {
    Accept: "*/*",
    Authorization:
      `Bearer ${getAccessToken()}`,
  };
};

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
   GET CUSTOMERS
========================= */

/**
 * GET /api/customers
 *
 * Có thể truyền bộ lọc:
 * {
 *   search,
 *   status,
 *   page,
 *   pageSize
 * }
 */
export const getCustomersApi = async (
  filters = {}
) => {
  const response =
    await axiosInstance.get(
      API_ENDPOINTS.customers.list,
      {
        params:
          removeEmptyParams(filters),

        headers:
          getAuthHeaders(),
      }
    );

  const data =
    getResponseData(response);

  return getArrayItems(data)
    .map(normalizeCustomer)
    .filter(
      (customer) =>
        Boolean(customer.id)
    );
};


/* =========================
   GET CUSTOMER BY ID
========================= */

/**
 * GET /api/customers/{customerId}
 */
export const getCustomerByIdApi = async (
  customerId
) => {
  const normalizedCustomerId =
    normalizeText(customerId);

  if (!normalizedCustomerId) {
    throw new Error(
      "Không tìm thấy mã khách hàng."
    );
  }

  if (!UUID_PATTERN.test(normalizedCustomerId)) {
    throw new Error("Mã khách hàng không đúng định dạng UUID.");
  }

  const response =
    await axiosInstance.get(
      API_ENDPOINTS.customers.detail(normalizedCustomerId),
      {
        headers:
          getAuthHeaders(),
      }
    );

  const data =
    getResponseData(response);

  if (!data) {
    return null;
  }

  return normalizeCustomer(data);
};

export const createCustomerApi = async (customer) => {
  const payload = normalizeCustomerPayload(customer);
  validateCustomerPayload(payload);
  const customers = await getCustomersApi();
  validateCustomerUniqueness(payload, customers);

  const response = await axiosInstance.post(
    API_ENDPOINTS.customers.list,
    payload,
    { headers: { ...getAuthHeaders(), "Content-Type": "application/json" } }
  );

  const data = getResponseData(response);
  return data && typeof data === "object"
    ? normalizeCustomer(data)
    : data;
};

export const updateCustomerApi = async (customerId, customer) => {
  const normalizedCustomerId = normalizeText(customerId);
  if (!normalizedCustomerId) {
    throw new Error("Không tìm thấy mã khách hàng.");
  }
  if (!UUID_PATTERN.test(normalizedCustomerId)) {
    throw new Error("Mã khách hàng không đúng định dạng UUID.");
  }

  const payload = normalizeCustomerPayload(customer);
  validateCustomerPayload(payload);
  const customers = await getCustomersApi();
  validateCustomerUniqueness(payload, customers, normalizedCustomerId);

  const response = await axiosInstance.put(
    API_ENDPOINTS.customers.detail(normalizedCustomerId),
    payload,
    { headers: { ...getAuthHeaders(), "Content-Type": "application/json" } }
  );

  const data = getResponseData(response);
  return data && typeof data === "object"
    ? normalizeCustomer(data)
    : data;
};

export const deleteCustomerApi = async (customerId) => {
  const normalizedCustomerId = normalizeText(customerId);
  if (!normalizedCustomerId) {
    throw new Error("Không tìm thấy mã khách hàng.");
  }
  if (!UUID_PATTERN.test(normalizedCustomerId)) {
    throw new Error("Mã khách hàng không đúng định dạng UUID.");
  }

  const response = await axiosInstance.delete(
    API_ENDPOINTS.customers.detail(normalizedCustomerId),
    { headers: getAuthHeaders() }
  );
  return getResponseData(response);
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
