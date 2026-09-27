/**
 * MOCK khách hàng — BẢN SAO LƯU, không màn nào import (bản thật: customerService.js).
 *
 * Tầng HTTP đã bị gỡ hẳn: không axiosInstance, không API_ENDPOINTS, không đọc
 * accessToken. Dữ liệu lấy từ bộ mẫu `customers` trong @/mocks/data/people và
 * vẫn đi qua đúng `normalizeCustomer` của bản thật, nên hình dạng bản ghi mà
 * CustomerList.jsx, CustomerDetailModal.jsx, CreateCustomerSale.jsx và
 * EditCustomerSale.jsx đọc không đổi một field nào.
 *
 * Hai chỗ mong manh phải giữ nguyên, ghi lại để về sau không ai lỡ tay phá:
 *
 * 1. Mọi hàm nhận customerId đều chặn id không đúng khuôn UUID TRƯỚC khi tra
 *    cứu, y như bản thật. Bỏ kiểm tra này thì các màn không còn thấy thông báo
 *    "Mã khách hàng không đúng định dạng UUID." mà bản thật vẫn bắn ra.
 * 2. Hàm ghi phải mutate `customerStore` — không chỉ trả về bản ghi mới.
 *    CustomerList.onSaved gọi lại loadCustomers() rồi ĐI TÌM khách vừa lưu
 *    trong danh sách mới theo id/email/phone để đẩy lên đầu bảng; nếu store
 *    không thay đổi thì tạo xong danh sách vẫn y như cũ và người xem tưởng
 *    tính năng hỏng.
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm gọi mạng bên dưới có một khối "// [API THẬT]"
 * ghi rõ method + endpoint cũ. Chỉ cần thay phần đọc/ghi `customerStore` bằng
 * lời gọi axiosInstance tương ứng rồi trả kết quả qua cùng `normalizeCustomer`;
 * toàn bộ phần chuẩn hoá, kiểm tra hợp lệ và kiểm tra trùng lặp phía dưới giữ
 * nguyên dùng được.
 */

import { customers as customerFixtures } from "@/mocks/data/people";
import {
  createApiError,
  deepClone,
  delay,
  matchesKeyword,
  nowIso,
} from "@/mocks/mockUtils";

/* =========================
   COMMON HELPERS
========================= */

/* Chú ý: `normalizeText` của mockUtils bóc dấu và hạ chữ thường (dùng để tìm
   kiếm), còn ở đây chỉ cần trim để giữ nguyên tên tiếng Việt có dấu. Hai hàm
   trùng tên nhưng khác việc, nên bản này phải là bản cục bộ. */
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
   STORE TRONG BỘ NHỚ
========================= */

/*
 * Clone một lần rồi giữ suốt phiên: tạo / sửa / xoá mutate đúng mảng này nên
 * mọi màn hình mở sau đó đều thấy cùng một danh sách. Tải lại trang thì về
 * nguyên trạng — đúng như kỳ vọng của một bản demo.
 */
const customerStore = deepClone(customerFixtures);

/* Bản thật đẩy bộ lọc lên server qua query params; mock không có server nên
   lọc tại chỗ trên cùng những trường mà thanh tìm kiếm của UI đang dò. */
const SEARCH_FIELDS = [
  "fullName",
  "customerCode",
  "email",
  "phone",
  "address",
  "region",
  "country",
  "companyName",
  "taxId",
];

const filterCustomerRows = (rows, filters = {}) => {
  const params = removeEmptyParams(filters);

  const keyword =
    params.search ??
    params.keyword ??
    params.q ??
    "";

  const status = normalizeCustomerStatus(params.status);

  const filtered = rows.filter((customer) => {
    if (
      status &&
      status !== "ALL" &&
      normalizeCustomerStatus(customer?.status) !== status
    ) {
      return false;
    }

    return matchesKeyword(customer, keyword, SEARCH_FIELDS);
  });

  /* Chỉ cắt trang khi lời gọi có nói tới trang: bản thật trả MẢNG TRẦN (không
     phải object phân trang), và CustomerList tự phân trang phía client — cắt
     vô điều kiện ở đây sẽ làm mất bản ghi khỏi bảng. */
  const page = Number(params.page ?? params.pageNumber);
  const size = Number(params.pageSize ?? params.size ?? params.limit);

  if (Number.isFinite(size) && size > 0) {
    const safePage =
      Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
    const startIndex = (safePage - 1) * Math.trunc(size);

    return filtered.slice(startIndex, startIndex + Math.trunc(size));
  }

  return filtered;
};

/** Tra cứu bản ghi GỐC trong store để hàm ghi mutate trực tiếp lên nó. */
const findStoreIndexById = (customerId) => {
  const normalizedId = normalizeText(customerId);

  return customerStore.findIndex(
    (customer) => resolveCustomerId(customer) === normalizedId
  );
};

/** Chặn id rỗng / sai khuôn đúng thứ tự và đúng câu chữ như bản thật. */
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

/*
 * Mã khách hàng chạy tiếp số lớn nhất đang có thay vì lấy theo độ dài mảng:
 * xoá một khách rồi tạo khách mới sẽ không đẻ ra mã trùng với người còn lại.
 */
const nextCustomerCode = () => {
  const maxNumber = customerStore.reduce((result, customer) => {
    const digits = normalizeText(customer?.customerCode).match(/(\d+)\s*$/);
    const number = digits ? Number(digits[1]) : 0;

    return Number.isFinite(number) && number > result ? number : result;
  }, 0);

  return `KH-${String(maxNumber + 1).padStart(4, "0")}`;
};

/*
 * Id khách hàng mới — KHÔNG dùng nextUuid() của mockUtils.
 *
 * Bộ sinh đó chỉ cho ra 16 giá trị rồi lặp lại, mà bộ đếm còn dùng chung với các
 * module mock khác; tạo đủ số khách (hoặc tạo sau khi màn khác đã tiêu bộ đếm) là
 * hai bản ghi trùng id. Khi đó findStoreIndexById() luôn trả về bản ghi đầu tiên,
 * nên bấm Sửa / Xóa trên khách mới lại đụng vào khách cũ, và antd Table báo trùng
 * rowKey. Bộ đếm tăng đơn điệu dưới đây không bao giờ lặp trong một phiên.
 *
 * Nhóm thứ hai để "9000" trong khi fixture dùng "100X", nên id tạo lúc chạy không
 * thể trùng với id khách hàng có sẵn trong @/mocks/data/people.
 */
let customerIdSequence = 0;

const nextCustomerId = () => {
  customerIdSequence += 1;

  /* Chữ số thập phân cũng là chữ số hex hợp lệ, và khuôn UUID (version 4, variant 8-b)
     phải giữ vì requireCustomerId() chặn id sai khuôn trước khi tra cứu. */
  return `8b3c5d90-9000-4b8c-9d31-${String(customerIdSequence).padStart(12, "0")}`;
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
  // [API THẬT] GET API_ENDPOINTS.customers.list, params = removeEmptyParams(filters)
  await delay(220, filters?.signal);

  const data = filterCustomerRows(customerStore, filters);

  return getArrayItems(deepClone(data))
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
    requireCustomerId(customerId);

  // [API THẬT] GET API_ENDPOINTS.customers.detail(normalizedCustomerId)
  await delay(220);

  const index = findStoreIndexById(normalizedCustomerId);

  /* Không tìm thấy thì trả null y như bản thật khi payload rỗng:
     CustomerDetailModal hiện khối "Không tìm thấy thông tin khách hàng."
     thay vì bắn toast đỏ. */
  if (index < 0) {
    return null;
  }

  return normalizeCustomer(deepClone(customerStore[index]));
};

export const createCustomerApi = async (customer) => {
  const payload = normalizeCustomerPayload(customer);
  validateCustomerPayload(payload);
  const customers = await getCustomersApi();
  validateCustomerUniqueness(payload, customers);

  // [API THẬT] POST API_ENDPOINTS.customers.list, body = payload
  await delay(260);

  const timestamp = nowIso();
  const status = payload.status || "ACTIVE";

  /* Dựng đủ những field mà createCustomer trong mocks/data/people sinh ra:
     CustomerList đọc region/country để ghép địa chỉ, và id phải hợp khuôn UUID
     nếu không nút "Xem chi tiết" / "Sửa" của chính khách vừa tạo sẽ báo lỗi. */
  const created = {
    id: nextCustomerId(),
    customerId: "",
    customerCode: nextCustomerCode(),
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    address: payload.address,
    region: "",
    country: "Việt Nam",
    companyName: payload.companyName,
    taxId: payload.taxId,
    status,
    isActive: status === "ACTIVE",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  created.customerId = created.id;

  /* Đưa lên đầu store để lần loadCustomers() ngay sau đó thấy khách mới nhất
     ở trên cùng — CustomerList vẫn tự tìm và ghim lên đầu, nhưng thứ tự này
     giúp bảng không nhảy khi người xem đang nhìn. */
  customerStore.unshift(created);

  return normalizeCustomer(deepClone(created));
};

export const updateCustomerApi = async (customerId, customer) => {
  const normalizedCustomerId = requireCustomerId(customerId);

  const payload = normalizeCustomerPayload(customer);
  validateCustomerPayload(payload);
  const customers = await getCustomersApi();
  validateCustomerUniqueness(payload, customers, normalizedCustomerId);

  // [API THẬT] PUT API_ENDPOINTS.customers.detail(normalizedCustomerId), body = payload
  await delay(260);

  const index = findStoreIndexById(normalizedCustomerId);

  if (index < 0) {
    throw createApiError(404, "Không tìm thấy khách hàng cần cập nhật.");
  }

  const current = customerStore[index];

  /* Merge chứ không thay cả bản ghi: payload không mang region/country/
     customerCode, ghi đè thẳng là mất cột địa chỉ và mã khách trên bảng. */
  const updated = {
    ...current,
    ...payload,
    status: payload.status || normalizeCustomerStatus(current?.status),
    isActive: (payload.status || normalizeCustomerStatus(current?.status)) === "ACTIVE",
    updatedAt: nowIso(),
  };

  customerStore[index] = updated;

  return normalizeCustomer(deepClone(updated));
};

export const deleteCustomerApi = async (customerId) => {
  const normalizedCustomerId = requireCustomerId(customerId);

  // [API THẬT] DELETE API_ENDPOINTS.customers.detail(normalizedCustomerId)
  await delay(240);

  const index = findStoreIndexById(normalizedCustomerId);

  if (index < 0) {
    throw createApiError(404, "Không tìm thấy khách hàng cần xóa.");
  }

  const [removed] = customerStore.splice(index, 1);

  /* Bản thật trả payload xác nhận của server; CustomerList không đọc giá trị
     này, chỉ cần lời gọi resolve để toast "Đã xóa" chạy rồi tải lại danh sách. */
  return {
    success: true,
    customerId: normalizedCustomerId,
    customerCode: normalizeText(removed?.customerCode),
    message: "Đã xóa khách hàng khỏi hệ thống.",
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
