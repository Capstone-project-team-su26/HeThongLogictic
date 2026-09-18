/*
 * MOCK cho bản CHỈ-GIAO-DIỆN: tầng HTTP đã bị gỡ, không còn axiosInstance.
 *
 * Bề mặt public giữ nguyên 100% so với bản thật — 86 named export, không có
 * default export, đúng thứ tự tham số (id trước, payload, rồi options mang
 * AbortSignal) — để AdminUsersPage, AdminCatalogPages/AdminResourcePage,
 * WarehouseLocationsPage, ConfirmPurchaseModal và PurchaseRequestDetail không
 * phải sửa một dòng nào.
 *
 * Hình dạng trả về được giữ theo đúng từng hàm của bản thật:
 *  - các hàm danh sách đi qua getAdminApiList => trả MẢNG TRẦN (AdminResourcePage
 *    làm `setItems(data)` rồi `items.filter`, mảng sai kiểu là bảng rỗng);
 *  - các hàm chi tiết / ghi đi qua getAdminApiData => trả OBJECT bản ghi;
 *  - riêng nhóm exchange-rates còn đi qua normalizeExchangeRateRecord, nên bộ
 *    normalize đó được giữ y nguyên ở đây.
 *
 * getAdminApiData / getAdminApiList / getAdminApiError giữ nguyên từng dòng: bảy
 * service khác (adminFinanceService, receivingNoteService, settlementService,
 * warehouseReleaseService, parcelIncidentService, ...) đang import lại chúng.
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm đều có comment "API thật:" ghi đúng method +
 * endpoint + params/body cũ. Việc cần làm là khôi phục `axiosInstance`,
 * `requestConfig()` (đã giữ lại phần header UTC ở dạng comment bên dưới) rồi bỏ
 * phần đọc/ghi fixture, còn lại giữ nguyên — normalize và thông báo lỗi đã đúng.
 */

import {
  createApiError,
  deepClone,
  delay,
  nowIso,
} from "@/mocks/mockUtils";
import {
  exchangeRates,
  packageConfigurations,
  pricingRules,
  productTypes,
  restrictedItems,
  servicePricings,
  shippingMethods,
  shippingRoutes,
  suppliers,
  unitsOfMeasure,
  warehouses,
} from "@/mocks/data/catalog";
import {
  customers,
  getWarehouseLayoutItemsFor,
  getWarehouseLocationsFor,
  users,
  warehouseRefs,
} from "@/mocks/data/people";

/*
 * Bản thật còn gắn ba header X-Client-Time-* lấy từ @shared/utils/timeUtc
 * (getBrowserTimeInfo + getSyncedNowUtcIso). Mock không gửi request nào nên
 * không import nữa; khi cắm API thật trở lại thì dựng lại getUtcHeaders() và
 * requestConfig(options, extra) đúng như cũ.
 */

const trimText = (value) => String(value ?? "").trim();

/*
 * Giữ nguyên hợp đồng lỗi của bản thật: id rỗng ném Error THƯỜNG (không phải
 * lỗi axios), và getAdminApiError sẽ rơi xuống error.message để hiện đúng câu
 * tiếng Việt này trên toast. Bỏ encodeURIComponent vì không còn URL nào.
 */
const requireId = (value, label) => {
  const id = trimText(value);
  if (!id) throw new Error(`Không tìm thấy ${label}.`);
  return id;
};

export const getAdminApiData = (response) => {
  const responseData = response?.data ?? response;
  return responseData?.data ?? responseData;
};

export const getAdminApiList = (response) => {
  const data = getAdminApiData(response);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

export const getAdminApiError = (error, fallbackMessage) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  /* Lỗi 500 của backend có message chung chung, lý do thật nằm ở `error` — ghép cả hai. */
  if (typeof data?.message === "string") {
    return typeof data?.error === "string" && data.error.trim() && data.error !== data.message
      ? `${data.message} ${data.error}`
      : data.message;
  }
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.title === "string") return data.title;

  const validationMessages = data?.errors
    ? Object.values(data.errors).flat().filter(Boolean)
    : [];
  return validationMessages.join(" ") || error?.message || fallbackMessage;
};

/* ==================== HẠ TẦNG MOCK DÙNG CHUNG ==================== */

/*
 * Sinh id dạng UUID v4 tất định.
 *
 * KHÔNG dùng nextUuid() của mockUtils ở đây: bộ sinh đó lặp lại sau mỗi 16 lần
 * gọi, mà file này phải cấp id cho tới 60 ô kệ của một kho — id trùng là antd
 * Table cảnh báo rowKey và hai ô kệ dính vào nhau khi sửa/xoá.
 */
let idSequence = 0;

const hexOf = (value, length) =>
  Math.abs(Math.trunc(Number(value) || 0))
    .toString(16)
    .padStart(length, "0")
    .slice(-length);

const scopedUuid = (tag, scope, index) =>
  `${tag}-${hexOf(scope, 4)}-4${hexOf(index, 3)}-8${hexOf(scope * 31 + index, 3)}-${hexOf(scope, 4)}${hexOf(index, 8)}`;

/* Bản ghi do người dùng tạo trong phiên: scope riêng 0x0fff để không đụng seed. */
const mintUuid = (tag = "9f0ad1c2") => {
  idSequence += 1;
  return scopedUuid(tag, 4095, idSequence);
};

const sameId = (record, id) =>
  String(record?.id ?? "") === String(id ?? "") ||
  String(record?.resourceId ?? "") === String(id ?? "") ||
  String(record?.configurationId ?? "") === String(id ?? "");

const findRecord = (collection, id, label) => {
  const record = collection.find((row) => sameId(row, id));

  /* 404 phải có hình dạng lỗi axios: nhánh catch của component đọc
     error.response.data.message để đổ vào toast đỏ. */
  if (!record) throw createApiError(404, `Không tìm thấy ${label}.`);
  return record;
};

/**
 * Đọc danh sách: luôn trả BẢN SAO SÂU.
 *
 * Fixture là singleton của module, trả thẳng tham chiếu là một màn sort tại chỗ
 * làm lệch thứ tự của mọi màn còn lại.
 */
const listRecords = async (collection, options = {}, filter) => {
  await delay(220, options?.signal);
  const rows = typeof filter === "function" ? collection.filter(filter) : collection;
  return deepClone(rows);
};

const detailRecord = async (collection, id, label, options = {}) => {
  const recordId = requireId(id, label);
  await delay(180, options?.signal);
  return deepClone(findRecord(collection, recordId, label));
};

/*
 * Ghi: mutate thẳng fixture trong bộ nhớ.
 *
 * AdminResourcePage tạo/sửa xong là gọi lại api.list(), nên nếu không mutate thì
 * bản ghi vừa lưu biến mất và người xem tưởng lệnh lưu thất bại. Bản mới được
 * unshift lên đầu để thấy ngay mà không phải phân trang.
 */
const createRecord = async (collection, payload, options = {}, defaults = {}) => {
  await delay(260, options?.signal);

  const timestamp = nowIso();
  const record = {
    id: mintUuid(),
    ...defaults,
    ...deepClone(payload || {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  collection.unshift(record);
  return deepClone(record);
};

const updateRecord = async (collection, id, payload, label, options = {}) => {
  const recordId = requireId(id, label);
  await delay(260, options?.signal);

  const record = findRecord(collection, recordId, label);
  Object.assign(record, deepClone(payload || {}), { updatedAt: nowIso() });
  return deepClone(record);
};

/*
 * Xoá: cắt hẳn khỏi fixture.
 *
 * Bản thật trả 204 (getAdminApiData ra undefined) nên component không đọc gì cả;
 * ở đây trả một object thành công gọn để luồng toast vẫn có dữ liệu nếu sau này
 * cần. Cắt hẳn thay vì tắt isActive vì AdminResourcePage nạp lại cả danh mục —
 * bấm xoá mà dòng vẫn nằm đó thì người dùng sẽ bấm lại lần nữa.
 */
const removeRecord = async (collection, id, label, options = {}) => {
  const recordId = requireId(id, label);
  await delay(240, options?.signal);

  const index = collection.findIndex((row) => sameId(row, recordId));
  if (index === -1) throw createApiError(404, `Không tìm thấy ${label}.`);

  const [removed] = collection.splice(index, 1);
  return { id: removed?.id ?? recordId, success: true, message: `Đã xoá ${label}.` };
};

/* Lọc nhẹ theo params để chữ ký (params, options) không chỉ để trưng. */
const matchesParams = (record, params = {}, fields = []) => {
  return fields.every((field) => {
    const expected = params?.[field];
    if (expected === undefined || expected === null || expected === "") return true;
    if (typeof expected === "boolean") return Boolean(record?.[field]) === expected;
    return String(record?.[field] ?? "").toLowerCase() === String(expected).toLowerCase();
  });
};

/* ==================== USERS ==================== */

/*
 * AdminUsersPage đọc: id (rowKey), fullName, email, phone, role, userType,
 * region, status, isLocked, createdAt. Drawer chi tiết in ra MỌI field vô hướng
 * và lấy tên field làm nhãn, nên tuyệt đối không nhét password vào bản ghi.
 */
export const getAdminUsers = async (options = {}) => {
  /* API thật: GET /api/User */
  return listRecords(users, options);
};

export const getAdminUserDetail = async (userId, options = {}) => {
  /* API thật: GET /api/User/{userId} */
  return detailRecord(users, userId, "mã người dùng", options);
};

export const createAdminUser = async (payload, options = {}) => {
  /* API thật: POST /api/User với body { fullName, email, password, phone, role, region } */
  await delay(320, options?.signal);

  const email = trimText(payload?.email).toLowerCase();
  const phone = trimText(payload?.phone).replace(/\D/g, "");

  /* BE chặn trùng email/điện thoại; giữ lại để nhánh catch + toast đỏ của màn
     tạo tài khoản vẫn có đường chạy thật, không chỉ có nhánh thành công. */
  if (users.some((user) => trimText(user.email).toLowerCase() === email)) {
    throw createApiError(409, "Email đã tồn tại trong hệ thống.");
  }
  if (users.some((user) => trimText(user.phone).replace(/\D/g, "") === phone)) {
    throw createApiError(409, "Số điện thoại đã tồn tại trong hệ thống.");
  }

  const timestamp = nowIso();
  const role = trimText(payload?.role) || "Sale";
  const id = mintUuid("3f1a7c20");

  const record = {
    id,
    userId: id,
    fullName: trimText(payload?.fullName),
    email,
    phone,
    role,
    roleName: role,
    userType: "Employee",
    region: trimText(payload?.region) || "VN",
    status: "Active",
    isLocked: false,
    isActive: true,
    country: "Việt Nam",
    address: trimText(payload?.address),
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: "",
  };

  users.unshift(record);
  return deepClone(record);
};

export const updateAdminUserRole = async (userId, payload, options = {}) => {
  /* API thật: PUT /api/User/{userId}/role với body { role, region } */
  const id = requireId(userId, "mã người dùng");
  await delay(280, options?.signal);

  const user = findRecord(users, id, "mã người dùng");
  const role = trimText(payload?.role) || user.role;

  Object.assign(user, {
    role,
    roleName: role,
    region: payload?.region === null ? null : trimText(payload?.region) || user.region,
    updatedAt: nowIso(),
  });

  return deepClone(user);
};

export const lockAdminUser = async (userId, options = {}) => {
  /* API thật: PUT /api/User/{userId}/lock (không body) */
  const id = requireId(userId, "mã người dùng");
  await delay(240, options?.signal);

  const user = findRecord(users, id, "mã người dùng");

  /* isLockedUser() đọc isLocked trước, nhưng cột "Trạng thái" và ô lọc còn đọc
     status — đặt cả hai để hai chỗ không nói ngược nhau. */
  Object.assign(user, {
    isLocked: true,
    isActive: false,
    status: "Locked",
    updatedAt: nowIso(),
  });

  return deepClone(user);
};

export const unlockAdminUser = async (userId, options = {}) => {
  /* API thật: PUT /api/User/{userId}/unlock (không body) */
  const id = requireId(userId, "mã người dùng");
  await delay(240, options?.signal);

  const user = findRecord(users, id, "mã người dùng");

  Object.assign(user, {
    isLocked: false,
    isActive: true,
    status: "Active",
    updatedAt: nowIso(),
  });

  return deepClone(user);
};

/* ==================== WAREHOUSES ==================== */

export const getWarehouses = async (params = {}, options = {}) => {
  /* API thật: GET /api/warehouses với params { isActive, warehouseType, region } */
  return listRecords(warehouses, options, (warehouse) =>
    matchesParams(warehouse, params, ["isActive", "warehouseType", "region", "country"])
  );
};

export const createWarehouse = async (payload, options = {}) => {
  /* API thật: POST /api/warehouses */
  return createRecord(warehouses, payload, options, {
    warehouseType: "DESTINATION",
    country: "VN",
    isActive: true,
  });
};

export const updateWarehouse = async (warehouseId, payload, options = {}) => {
  /* API thật: PUT /api/warehouses/{warehouseId} */
  return updateRecord(warehouses, warehouseId, payload, "mã kho", options);
};

export const deleteWarehouse = async (warehouseId, options = {}) => {
  /* API thật: DELETE /api/warehouses/{warehouseId} */
  return removeRecord(warehouses, warehouseId, "mã kho", options);
};

/* ==================== VỊ TRÍ KHO (bin / ô kệ) ==================== */

/*
 * Sơ đồ 60 ô kệ nằm trong @/mocks/data/people, nhưng id kho ở đó là bộ
 * warehouseRefs riêng, còn danh sách kho của màn hình lại lấy từ catalog.
 * Nên phải ánh xạ: kho Trung Quốc soi sang sơ đồ Quảng Châu / Bằng Tường, kho
 * Việt Nam soi sang Hà Nội / TP.HCM, luân phiên theo vị trí trong danh mục để
 * mỗi kho có một mặt bằng khác nhau chứ không phải 13 kho cùng một sơ đồ.
 */
const LAYOUT_SOURCE_POOL = {
  CN: [warehouseRefs.guangzhou.id, warehouseRefs.pingxiang.id],
  VN: [warehouseRefs.hanoi.id, warehouseRefs.hochiminh.id],
};

const warehouseIndexOf = (warehouseId) =>
  warehouses.findIndex((warehouse) => String(warehouse.id) === trimText(warehouseId));

const resolveLayoutSourceId = (warehouseId) => {
  const key = trimText(warehouseId);

  /* Nếu gọi thẳng bằng id của warehouseRefs thì dùng luôn, khỏi ánh xạ. */
  if (Object.values(warehouseRefs).some((ref) => ref.id === key)) return key;

  const index = warehouseIndexOf(key);
  if (index < 0) return warehouseRefs.hanoi.id;

  const warehouse = warehouses[index];

  /* Ba kho trùng tên giữa hai bộ dữ liệu (Kho tổng Hà Nội, Kho tổng TP. Hồ Chí
     Minh, Kho trung chuyển Bằng Tường) thì lấy đúng sơ đồ của chính nó — tên khu
     và ghi chú từng ô mới khớp với địa bàn kho đang xem. */
  const byName = Object.values(warehouseRefs).find((ref) => ref.name === warehouse?.name);
  if (byName) return byName.id;

  const country = String(warehouse?.country ?? "VN").toUpperCase();
  const pool = LAYOUT_SOURCE_POOL[country] || LAYOUT_SOURCE_POOL.VN;
  return pool[index % pool.length];
};

/*
 * Scope id theo CHÍNH mã kho, cấp số thứ tự lần đầu gặp và giữ nguyên đến hết
 * phiên: hai kho không bao giờ dùng chung id ô kệ, nhờ đó sửa/xoá theo
 * locationId (findInBuckets quét mọi kho đã nạp) luôn trúng đúng bản ghi.
 *
 * KHÔNG dùng vị trí trong danh mục làm scope: xoá một kho ở màn "Quản lý kho"
 * làm mọi kho phía sau tụt một bậc, kho tụt vào chỗ trống sẽ sinh ra đúng bộ id
 * ô kệ mà kho khác đã nạp trước đó — sửa một ô ở kho này là ghi sang ô của kho
 * kia. Mã kho không đổi khi mảng danh mục xê dịch nên hết hẳn đường trùng.
 */
const scopeRegistry = new Map();

const scopeOf = (warehouseId) => {
  const key = trimText(warehouseId);
  if (!key) return 0;

  if (!scopeRegistry.has(key)) {
    scopeRegistry.set(key, scopeRegistry.size + 1);
  }

  return scopeRegistry.get(key);
};

const LOCATION_ID_TAG = "b17c0a10";
const LAYOUT_ID_TAG = "c28d1b20";

const locationStore = new Map();
const layoutStore = new Map();
const inventoryStore = new Map();

const seedLocations = (warehouseId) => {
  const source = getWarehouseLocationsFor(resolveLayoutSourceId(warehouseId));
  const warehouse = warehouses[warehouseIndexOf(warehouseId)] ?? null;
  const scope = scopeOf(warehouseId);

  return deepClone(source).map((location, index) => {
    const id = scopedUuid(LOCATION_ID_TAG, scope, index + 1);

    return {
      ...location,
      id,
      locationId: id,
      warehouseId: trimText(warehouseId),
      warehouseCode: warehouse?.code ?? location.warehouseCode,
      warehouseName: warehouse?.name ?? location.warehouseName,
    };
  });
};

const seedLayoutItems = (warehouseId) => {
  const source = getWarehouseLayoutItemsFor(resolveLayoutSourceId(warehouseId));
  const scope = scopeOf(warehouseId);

  return deepClone(source).map((item, index) => {
    const id = scopedUuid(LAYOUT_ID_TAG, scope, index + 1);

    return {
      ...item,
      id,
      layoutId: id,
      warehouseId: trimText(warehouseId),
    };
  });
};

const getLocationBucket = (warehouseId) => {
  const key = trimText(warehouseId);
  if (!locationStore.has(key)) locationStore.set(key, seedLocations(key));
  return locationStore.get(key);
};

const getLayoutBucket = (warehouseId) => {
  const key = trimText(warehouseId);
  if (!layoutStore.has(key)) layoutStore.set(key, seedLayoutItems(key));
  return layoutStore.get(key);
};

/* Sửa/xoá vị trí chỉ nhận locationId (không kèm mã kho), nên phải quét mọi kho
   đã nạp. Kho chưa nạp thì chắc chắn người dùng chưa mở được nút sửa/xoá. */
const findInBuckets = (store, id, label) => {
  const key = trimText(id);

  for (const bucket of store.values()) {
    const index = bucket.findIndex((row) => String(row.id) === key || String(row.locationId ?? row.layoutId) === key);
    if (index !== -1) return { bucket, index, record: bucket[index] };
  }

  throw createApiError(404, `Không tìm thấy ${label}.`);
};

export const getWarehouseLocations = async (warehouseId, params = {}, options = {}) => {
  /* API thật: GET /api/warehouses/{warehouseId}/locations với params { isActive, zoneName } */
  const id = requireId(warehouseId, "mã kho");
  await delay(240, options?.signal);

  const rows = getLocationBucket(id).filter((location) =>
    matchesParams(location, params, ["isActive", "zoneName", "shelfCode", "binCode"])
  );

  return deepClone(rows);
};

export const getActiveWarehouseLocations = async (warehouseId, params = {}, options = {}) => {
  /* API thật: GET /api/warehouses/{warehouseId}/locations/active */
  const id = requireId(warehouseId, "mã kho");
  await delay(220, options?.signal);

  const rows = getLocationBucket(id).filter(
    (location) =>
      location.isActive !== false &&
      matchesParams(location, params, ["zoneName", "shelfCode", "binCode"])
  );

  return deepClone(rows);
};

export const createWarehouseLocation = async (warehouseId, payload, options = {}) => {
  /* API thật: POST /api/warehouses/{warehouseId}/locations */
  const id = requireId(warehouseId, "mã kho");
  await delay(280, options?.signal);

  const bucket = getLocationBucket(id);
  const warehouse = warehouses[warehouseIndexOf(id)] ?? null;
  const timestamp = nowIso();
  const locationId = mintUuid(LOCATION_ID_TAG);
  const binCode = trimText(payload?.binCode);

  /* zoneCode/code là bản sao của zoneName/binCode: WarehouseLocationsPage gom
     cây theo zoneName || zoneCode và sắp xếp theo binCode || code, thiếu một
     nhánh là ô mới rơi vào khu "Chung". */
  const record = {
    id: locationId,
    locationId,
    warehouseId: id,
    warehouseCode: warehouse?.code ?? "",
    warehouseName: warehouse?.name ?? "",
    zoneName: trimText(payload?.zoneName),
    zoneCode: trimText(payload?.zoneName),
    shelfCode: trimText(payload?.shelfCode),
    binCode,
    code: binCode,
    maxVolume: payload?.maxVolume ?? null,
    maxWeight: payload?.maxWeight ?? null,
    isActive: payload?.isActive !== false,
    note: payload?.note ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  bucket.push(record);

  /* Ô mới chưa có kiện: xoá cache tồn kho để lần đọc sau tính lại tỷ lệ lấp đầy. */
  inventoryStore.delete(id);

  return deepClone(record);
};

export const updateWarehouseLocation = async (locationId, payload, options = {}) => {
  /* API thật: PUT /api/warehouse-locations/{locationId} */
  const id = requireId(locationId, "mã vị trí");
  await delay(260, options?.signal);

  const { record } = findInBuckets(locationStore, id, "mã vị trí");

  Object.assign(record, deepClone(payload || {}), {
    zoneCode: trimText(payload?.zoneName) || record.zoneCode,
    code: trimText(payload?.binCode) || record.code,
    updatedAt: nowIso(),
  });

  /* Tắt/bật một ô là đổi tập ô còn dùng được: bỏ cache tồn kho để lần đọc sau
     tính lại, nếu không thì thống kê lấp đầy vẫn đếm kiện trong ô vừa tắt. */
  inventoryStore.delete(trimText(record.warehouseId));

  return deepClone(record);
};

export const deleteWarehouseLocation = async (locationId, options = {}) => {
  /* API thật: DELETE /api/warehouse-locations/{locationId} */
  const id = requireId(locationId, "mã vị trí");
  await delay(240, options?.signal);

  const { bucket, index, record } = findInBuckets(locationStore, id, "mã vị trí");
  bucket.splice(index, 1);
  inventoryStore.delete(trimText(record.warehouseId));

  return { id, success: true, message: "Đã xoá vị trí kho." };
};

/* Hãng vận chuyển đã nối API thật ở @features/catalog/api/transportCatalogService. */

/* ==================== SHIPPING METHODS ==================== */
export const getShippingMethods = async (options = {}) => {
  /* API thật: GET /api/shipping-methods */
  return listRecords(shippingMethods, options);
};

export const getShippingMethodDetail = async (methodId, options = {}) => {
  /* API thật: GET /api/shipping-methods/{methodId} */
  return detailRecord(shippingMethods, methodId, "mã phương thức", options);
};

export const createShippingMethod = async (payload, options = {}) => {
  /* API thật: POST /api/shipping-methods */
  return createRecord(shippingMethods, payload, options, { isActive: true });
};

export const updateShippingMethod = async (methodId, payload, options = {}) => {
  /* API thật: PUT /api/shipping-methods/{methodId} */
  return updateRecord(shippingMethods, methodId, payload, "mã phương thức", options);
};

export const deleteShippingMethod = async (methodId, options = {}) => {
  /* API thật: DELETE /api/shipping-methods/{methodId} */
  return removeRecord(shippingMethods, methodId, "mã phương thức", options);
};

/* ==================== PACKAGE CONFIGURATIONS ==================== */
export const getPackageConfigurations = async (options = {}) => {
  /* API thật: GET /api/package-configurations */
  return listRecords(packageConfigurations, options);
};

export const getPackageConfigurationDetail = async (configurationId, options = {}) => {
  /* API thật: GET /api/package-configurations/{configurationId} */
  return detailRecord(packageConfigurations, configurationId, "mã cấu hình đóng gói", options);
};

export const createPackageConfiguration = async (payload, options = {}) => {
  /*
   * API thật: POST /api/package-configurations
   * estimatedFee để null: getPackageConfigurationFee() ưu tiên estimatedFee nếu
   * khác null, điền sẵn là mọi phép tính phí theo thể tích bị bỏ qua.
   */
  return createRecord(packageConfigurations, payload, options, {
    status: "ACTIVE",
    estimatedFee: null,
  });
};

export const updatePackageConfiguration = async (configurationId, payload, options = {}) => {
  /* API thật: PUT /api/package-configurations/{configurationId} */
  return updateRecord(
    packageConfigurations,
    configurationId,
    payload,
    "mã cấu hình đóng gói",
    options
  );
};

export const deletePackageConfiguration = async (configurationId, options = {}) => {
  /* API thật: DELETE /api/package-configurations/{configurationId} */
  return removeRecord(packageConfigurations, configurationId, "mã cấu hình đóng gói", options);
};

/* ==================== ADDITIONAL SERVICE FEES ==================== */

/*
 * Không còn bộ phí dịch vụ bổ sung riêng: phụ phí nằm chung MỘT danh mục pricingRules
 * (catalog). "Phí dịch vụ bổ sung" = quy tắc giá mang `feeCode`. Năm hàm dưới giữ nguyên
 * tên, chữ ký và HÌNH DẠNG trả về cũ ({ id, feeCode, feeName, calculationType, value,
 * unit, description, isActive, createdAt, updatedAt }) nhưng đọc/ghi trên pricingRules,
 * nên sửa ở đây hay ở màn Quy tắc tính giá đều là cùng một bản ghi.
 */
const isAdditionalFeeRule = (rule) => Boolean(trimText(rule?.feeCode));

const toAdditionalServiceFee = (rule) => ({
  id: rule.id,
  feeCode: trimText(rule.feeCode),
  feeName: rule.ruleName ?? "",
  calculationType: rule.calculationType ?? "",
  value: rule.value ?? null,
  unit: rule.unit ?? "",
  description: rule.description ?? "",
  isActive: String(rule.status ?? "").toUpperCase() === "ACTIVE",
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt,
});

/* Chỉ chép những khoá phí có mặt trong payload sang khoá tương ứng của quy tắc giá. */
const toPricingRulePatch = (payload = {}, { isCreate = false } = {}) => {
  const source = deepClone(payload || {});
  const patch = {};
  if ("feeCode" in source) {
    patch.feeCode = trimText(source.feeCode).toUpperCase();
    /* ruleCode chỉ lấy từ feeCode khi TẠO mới; khi sửa giữ nguyên mã quy tắc
       (vd. SUR_INSPECTION không được thành INSPECTION_FEE). */
    if (isCreate) patch.ruleCode = patch.feeCode;
  }
  if ("feeName" in source) patch.ruleName = source.feeName;
  if ("calculationType" in source) patch.calculationType = source.calculationType;
  if ("value" in source) patch.value = source.value;
  if ("unit" in source) patch.unit = source.unit;
  if ("description" in source) patch.description = source.description;
  if ("isActive" in source) patch.status = source.isActive === false ? "INACTIVE" : "ACTIVE";
  return patch;
};

const findAdditionalFeeRule = (feeId) => {
  const rule = findRecord(pricingRules, feeId, "mã phí");
  if (!isAdditionalFeeRule(rule)) throw createApiError(404, "Không tìm thấy mã phí.");
  return rule;
};

export const getAdditionalServiceFees = async (params = {}, options = {}) => {
  /* API thật (cũ): GET /api/additional-service-fees với params { isActive, calculationType } */
  await delay(220, options?.signal);
  return deepClone(
    pricingRules
      .filter(isAdditionalFeeRule)
      .map(toAdditionalServiceFee)
      .filter((fee) => matchesParams(fee, params, ["isActive", "calculationType", "feeCode"]))
  );
};

export const getAdditionalServiceFeeDetail = async (feeId, options = {}) => {
  /* API thật (cũ): GET /api/additional-service-fees/{feeId} */
  const recordId = requireId(feeId, "mã phí");
  await delay(180, options?.signal);
  return deepClone(toAdditionalServiceFee(findAdditionalFeeRule(recordId)));
};

export const createAdditionalServiceFee = async (payload, options = {}) => {
  /* API thật (cũ): POST /api/additional-service-fees — nay tạo một quy tắc giá có feeCode */
  const created = await createRecord(
    pricingRules,
    toPricingRulePatch({ isActive: true, ...(payload || {}) }, { isCreate: true }),
    options,
    {
      servicePricingId: null,
      ruleType: "SETTLEMENT_FEE",
      conditionType: null,
      conditionValue: null,
      minAmount: null,
      maxAmount: null,
      isRequired: false,
    }
  );
  return toAdditionalServiceFee(created);
};

export const updateAdditionalServiceFee = async (feeId, payload, options = {}) => {
  /* API thật (cũ): PUT /api/additional-service-fees/{feeId} */
  const recordId = requireId(feeId, "mã phí");
  findAdditionalFeeRule(recordId);
  const updated = await updateRecord(
    pricingRules,
    recordId,
    toPricingRulePatch(payload),
    "mã phí",
    options
  );
  return toAdditionalServiceFee(updated);
};

export const deleteAdditionalServiceFee = async (feeId, options = {}) => {
  /* API thật (cũ): DELETE /api/additional-service-fees/{feeId} */
  const recordId = requireId(feeId, "mã phí");
  findAdditionalFeeRule(recordId);
  return removeRecord(pricingRules, recordId, "mã phí", options);
};

/* ==================== SERVICE PRICINGS ==================== */
export const getServicePricings = async (options = {}) => {
  /* API thật: GET /api/service-pricings */
  return listRecords(servicePricings, options);
};

export const getServicePricingDetail = async (pricingId, options = {}) => {
  /* API thật: GET /api/service-pricings/{pricingId} */
  return detailRecord(servicePricings, pricingId, "mã bảng giá", options);
};

export const createServicePricing = async (payload, options = {}) => {
  /*
   * API thật: POST /api/service-pricings
   * currency luôn phải có: cột "Đơn giá" (type money) render `price + currency`,
   * thiếu là bảng hiện "12.000 ₫" cho cả dòng tính bằng CNY.
   * boxPricingRules để mảng rỗng — component chỉ kiểm Array.isArray.
   */
  return createRecord(servicePricings, payload, options, {
    currency: "VND",
    boxPricingRules: [],
  });
};

export const updateServicePricing = async (pricingId, payload, options = {}) => {
  /* API thật: PUT /api/service-pricings/{pricingId} */
  return updateRecord(servicePricings, pricingId, payload, "mã bảng giá", options);
};

export const deleteServicePricing = async (pricingId, options = {}) => {
  /* API thật: DELETE /api/service-pricings/{pricingId} */
  return removeRecord(servicePricings, pricingId, "mã bảng giá", options);
};

/* ==================== PRICING RULES ==================== */
export const getPricingRules = async (options = {}) => {
  /* API thật: GET /api/pricing-rules */
  return listRecords(pricingRules, options);
};

export const getPricingRuleDetail = async (ruleId, options = {}) => {
  /* API thật: GET /api/pricing-rules/{ruleId} */
  return detailRecord(pricingRules, ruleId, "mã quy tắc giá", options);
};

export const createPricingRule = async (payload, options = {}) => {
  /* API thật: POST /api/pricing-rules */
  return createRecord(pricingRules, payload, options, {
    status: "ACTIVE",
    isRequired: false,
  });
};

export const updatePricingRule = async (ruleId, payload, options = {}) => {
  /* API thật: PUT /api/pricing-rules/{ruleId} */
  return updateRecord(pricingRules, ruleId, payload, "mã quy tắc giá", options);
};

export const deletePricingRule = async (ruleId, options = {}) => {
  /* API thật: DELETE /api/pricing-rules/{ruleId} */
  return removeRecord(pricingRules, ruleId, "mã quy tắc giá", options);
};

/* ==================== RESTRICTED ITEMS ==================== */
export const getRestrictedItems = async (options = {}) => {
  /* API thật: GET /api/restricted-items */
  return listRecords(restrictedItems, options);
};

export const getRestrictedItemDetail = async (itemId, options = {}) => {
  /* API thật: GET /api/restricted-items/{itemId} */
  return detailRecord(restrictedItems, itemId, "mã mặt hàng", options);
};

export const createRestrictedItem = async (payload, options = {}) => {
  /* API thật: POST /api/restricted-items */
  return createRecord(restrictedItems, payload, options, {
    restrictionType: "WARNING",
    isActive: true,
  });
};

export const updateRestrictedItem = async (itemId, payload, options = {}) => {
  /* API thật: PUT /api/restricted-items/{itemId} */
  return updateRecord(restrictedItems, itemId, payload, "mã mặt hàng", options);
};

export const deleteRestrictedItem = async (itemId, options = {}) => {
  /* API thật: DELETE /api/restricted-items/{itemId} */
  return removeRecord(restrictedItems, itemId, "mã mặt hàng", options);
};

/* ==================== PRODUCT TYPES ==================== */
export const getProductTypes = async (options = {}) => {
  /* API thật: GET /api/product-types/all (endpoint /all trả cả loại đang tắt) */
  return listRecords(productTypes, options);
};

export const getProductTypeDetail = async (productTypeId, options = {}) => {
  /* API thật: GET /api/product-types/{productTypeId} */
  return detailRecord(productTypes, productTypeId, "mã loại hàng", options);
};

export const createProductType = async (payload, options = {}) => {
  /* API thật: POST /api/product-types */
  return createRecord(productTypes, payload, options, { isActive: true });
};

export const updateProductType = async (productTypeId, payload, options = {}) => {
  /* API thật: PUT /api/product-types/{productTypeId} */
  return updateRecord(productTypes, productTypeId, payload, "mã loại hàng", options);
};

export const deleteProductType = async (productTypeId, options = {}) => {
  /* API thật: DELETE /api/product-types/{productTypeId} */
  return removeRecord(productTypes, productTypeId, "mã loại hàng", options);
};

/* ==================== UNITS OF MEASURE ==================== */
export const getUnitsOfMeasure = async (options = {}) => {
  /* API thật: GET /api/units-of-measure/all */
  return listRecords(unitsOfMeasure, options);
};

export const getUnitOfMeasureDetail = async (unitId, options = {}) => {
  /* API thật: GET /api/units-of-measure/{unitId} */
  return detailRecord(unitsOfMeasure, unitId, "mã đơn vị tính", options);
};

export const createUnitOfMeasure = async (payload, options = {}) => {
  /* API thật: POST /api/units-of-measure */
  return createRecord(unitsOfMeasure, payload, options, {
    isActive: true,
    displayOrder: unitsOfMeasure.length + 1,
  });
};

export const updateUnitOfMeasure = async (unitId, payload, options = {}) => {
  /* API thật: PUT /api/units-of-measure/{unitId} */
  return updateRecord(unitsOfMeasure, unitId, payload, "mã đơn vị tính", options);
};

export const deleteUnitOfMeasure = async (unitId, options = {}) => {
  /* API thật: DELETE /api/units-of-measure/{unitId} */
  return removeRecord(unitsOfMeasure, unitId, "mã đơn vị tính", options);
};

/* ==================== SUPPLIERS ==================== */
export const getSuppliers = async (options = {}) => {
  /* API thật: GET /api/suppliers */
  return listRecords(suppliers, options);
};

export const getSupplierDetail = async (supplierId, options = {}) => {
  /* API thật: GET /api/suppliers/{supplierId} */
  return detailRecord(suppliers, supplierId, "mã nhà cung cấp", options);
};

export const createSupplier = async (payload, options = {}) => {
  /* API thật: POST /api/suppliers */
  return createRecord(suppliers, payload, options, { country: "CN", isActive: true });
};

export const updateSupplier = async (supplierId, payload, options = {}) => {
  /* API thật: PUT /api/suppliers/{supplierId} */
  return updateRecord(suppliers, supplierId, payload, "mã nhà cung cấp", options);
};

export const deleteSupplier = async (supplierId, options = {}) => {
  /* API thật: DELETE /api/suppliers/{supplierId} */
  return removeRecord(suppliers, supplierId, "mã nhà cung cấp", options);
};

/* ==================== SHIPPING ROUTES ==================== */

/*
 * ConfirmPurchaseModal dò kho theo tuyến bằng routeCode || code và
 * routeName || name, rồi lấy originWarehouseId/destinationWarehouseId — bốn
 * field đó phải luôn có mặt, id kho phải là id thật trong danh mục kho.
 */
export const getShippingRoutes = async (options = {}) => {
  /* API thật: GET /api/shipping-routes */
  return listRecords(shippingRoutes, options);
};

export const getShippingRouteDetail = async (routeId, options = {}) => {
  /* API thật: GET /api/shipping-routes/{routeId} */
  return detailRecord(shippingRoutes, routeId, "mã tuyến vận chuyển", options);
};

export const createShippingRoute = async (payload, options = {}) => {
  /* API thật: POST /api/shipping-routes */
  return createRecord(shippingRoutes, payload, options, {
    originCountry: "CN",
    destinationCountry: "VN",
    transportMode: "ROAD",
    isActive: true,
  });
};

export const updateShippingRoute = async (routeId, payload, options = {}) => {
  /* API thật: PUT /api/shipping-routes/{routeId} */
  return updateRecord(shippingRoutes, routeId, payload, "mã tuyến vận chuyển", options);
};

export const deleteShippingRoute = async (routeId, options = {}) => {
  /* API thật: DELETE /api/shipping-routes/{routeId} */
  return removeRecord(shippingRoutes, routeId, "mã tuyến vận chuyển", options);
};

/* ==================== WAREHOUSE LAYOUT (sơ đồ lưới) ==================== */

/*
 * Tổng hợp khu vực từ chính bộ ô kệ đang nằm trong bộ nhớ, chứ không lấy bản
 * tổng hợp tĩnh của people: thêm/xoá một ô là số liệu trên tab "Tình trạng" phải
 * nhích theo, nếu không người xem tưởng nút Lưu không ăn.
 */
const summarizeZones = (locations = []) => {
  const zones = new Map();

  locations.forEach((location) => {
    const zoneName = location.zoneName || location.zoneCode || "Chung";

    if (!zones.has(zoneName)) {
      zones.set(zoneName, {
        zoneCode: location.zoneCode || zoneName,
        zoneName,
        shelves: new Set(),
        totalBins: 0,
        activeBins: 0,
        maxVolume: 0,
        maxWeight: 0,
      });
    }

    const zone = zones.get(zoneName);
    zone.shelves.add(location.shelfCode);
    zone.totalBins += 1;
    zone.maxVolume += Number(location.maxVolume) || 0;
    zone.maxWeight += Number(location.maxWeight) || 0;
    if (location.isActive !== false) zone.activeBins += 1;
  });

  return [...zones.values()]
    .map((zone) => ({
      zoneCode: zone.zoneCode,
      zoneName: zone.zoneName,
      shelfCount: zone.shelves.size,
      totalBins: zone.totalBins,
      activeBins: zone.activeBins,
      inactiveBins: zone.totalBins - zone.activeBins,
      maxVolume: zone.maxVolume,
      maxWeight: zone.maxWeight,
    }))
    .sort((a, b) => String(a.zoneName).localeCompare(String(b.zoneName), "vi"));
};

export const getWarehouseLayout = async (warehouseId, options = {}) => {
  /*
   * API thật: GET /api/warehouses/{warehouseId}/layout — qua getAdminApiList nên
   * PHẢI là mảng: WarehouseLayoutGridView đọc zoneCode, label, gridRow,
   * gridColumn, maxVolume của từng ô.
   */
  const id = requireId(warehouseId, "mã kho");
  await delay(240, options?.signal);
  return deepClone(getLayoutBucket(id));
};

export const getWarehouseLayoutZones = async (warehouseId, options = {}) => {
  /* API thật: GET /api/warehouses/{warehouseId}/layout/zones — qua getAdminApiData nên là object. */
  const id = requireId(warehouseId, "mã kho");
  await delay(200, options?.signal);

  const zones = summarizeZones(getLocationBucket(id));

  return {
    warehouseId: id,
    totalZones: zones.length,
    totalShelves: zones.reduce((sum, zone) => sum + zone.shelfCount, 0),
    zones,
  };
};

export const getWarehouseLayoutStatus = async (warehouseId, options = {}) => {
  /* API thật: GET /api/warehouses/{warehouseId}/layout/status — object thống kê lấp đầy. */
  const id = requireId(warehouseId, "mã kho");
  await delay(200, options?.signal);

  const locations = getLocationBucket(id);
  const zones = summarizeZones(locations);
  const totalBins = locations.length;
  const activeBins = locations.filter((location) => location.isActive !== false).length;

  /* Số ô "đang có hàng" đếm từ chính bộ tồn kho trả cho màn hình, để con số trên
     thẻ thống kê và số kiện đếm được trong từng ô không nói ngược nhau. */
  const occupiedBins = new Set(
    getInventoryBucket(id).map((inventory) => inventory.binId)
  ).size;

  return {
    warehouseId: id,
    totalZones: zones.length,
    totalShelves: zones.reduce((sum, zone) => sum + zone.shelfCount, 0),
    totalBins,
    activeBins,
    inactiveBins: totalBins - activeBins,
    occupiedBins,
    availableBins: Math.max(0, activeBins - occupiedBins),
    occupancyRate: activeBins ? Math.round((occupiedBins / activeBins) * 100) : 0,
    totalMaxVolume: locations.reduce((sum, item) => sum + (Number(item.maxVolume) || 0), 0),
    totalMaxWeight: locations.reduce((sum, item) => sum + (Number(item.maxWeight) || 0), 0),
    updatedAt: nowIso(),
    zones,
  };
};

export const createWarehouseLayoutItem = async (warehouseId, payload, options = {}) => {
  /* API thật: POST /api/warehouses/{warehouseId}/layout */
  const id = requireId(warehouseId, "mã kho");
  await delay(280, options?.signal);

  const bucket = getLayoutBucket(id);
  const timestamp = nowIso();
  const layoutId = mintUuid(LAYOUT_ID_TAG);

  const record = {
    id: layoutId,
    layoutId,
    warehouseId: id,
    zoneCode: trimText(payload?.zoneCode),
    zoneName: trimText(payload?.zoneCode),
    label: trimText(payload?.label),
    gridRow: Number(payload?.gridRow) || 1,
    gridColumn: Number(payload?.gridColumn) || 1,
    maxVolume: payload?.maxVolume ?? null,
    maxWeight: payload?.maxWeight ?? null,
    isActive: payload?.isActive !== false,
    note: payload?.note ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  bucket.push(record);
  return deepClone(record);
};

export const updateWarehouseLayoutItem = async (warehouseId, layoutId, payload, options = {}) => {
  /* API thật: PUT /api/warehouses/{warehouseId}/layout/{layoutId} */
  const id = requireId(warehouseId, "mã kho");
  const itemId = requireId(layoutId, "mã ô layout");
  await delay(260, options?.signal);

  const bucket = getLayoutBucket(id);
  const record = bucket.find((item) => String(item.id) === itemId || String(item.layoutId) === itemId);
  if (!record) throw createApiError(404, "Không tìm thấy mã ô layout.");

  Object.assign(record, deepClone(payload || {}), {
    zoneName: trimText(payload?.zoneCode) || record.zoneName,
    updatedAt: nowIso(),
  });

  return deepClone(record);
};

export const deleteWarehouseLayoutItem = async (warehouseId, layoutId, options = {}) => {
  /* API thật: DELETE /api/warehouses/{warehouseId}/layout/{layoutId} */
  const id = requireId(warehouseId, "mã kho");
  const itemId = requireId(layoutId, "mã ô layout");
  await delay(240, options?.signal);

  const bucket = getLayoutBucket(id);
  const index = bucket.findIndex(
    (item) => String(item.id) === itemId || String(item.layoutId) === itemId
  );
  if (index === -1) throw createApiError(404, "Không tìm thấy mã ô layout.");

  bucket.splice(index, 1);
  return { id: itemId, success: true, message: "Đã xoá ô sơ đồ kho." };
};

/* ==================== EXCHANGE RATES (bảng giá tiền tệ) ==================== */

/*
 * Giữ nguyên bộ normalize của bản thật: AdminResourcePage đọc currencyCode
 * (cột tag + ô lọc), currencyName, rateToVnd (cột number), isActive (chip trạng
 * thái) và note. rateToVnd phải là số — cột number gọi toLocaleString.
 */
const normalizeExchangeRateRecord = (item = {}) => {
  const currencyCode = trimText(item?.currencyCode ?? item?.currency).toUpperCase();
  return {
    id: item?.id ?? item?.exchangeRateId ?? "",
    currencyCode,
    currencyName: item?.currencyName ?? "",
    rateToVnd: Number(item?.rateToVnd ?? item?.exchangeRate ?? 0) || 0,
    isActive: Boolean(item?.isActive ?? true),
    note: item?.note ?? "",
    createdAt: item?.createdAt ?? null,
    updatedAt: item?.updatedAt ?? null,
  };
};

export const getExchangeRates = async (options = {}) => {
  /*
   * API thật: GET /api/exchange-rates với params { activeOnly }.
   * AdminCatalogPages gọi getExchangeRates({ activeOnly: true }) nên phải lọc,
   * còn SaleDashboard/ServicePricings đi qua exchangeRateService riêng.
   */
  const activeOnly = options.activeOnly === true;
  await delay(220, options?.signal);

  const rows = activeOnly
    ? exchangeRates.filter((rate) => rate.isActive !== false)
    : exchangeRates;

  return deepClone(rows).map(normalizeExchangeRateRecord);
};

export const getExchangeRateDetail = async (rateId, options = {}) => {
  /* API thật: GET /api/exchange-rates/{rateId} */
  const id = requireId(rateId, "mã tỷ giá");
  await delay(180, options?.signal);
  return normalizeExchangeRateRecord(deepClone(findRecord(exchangeRates, id, "mã tỷ giá")));
};

export const createExchangeRate = async (payload, options = {}) => {
  /* API thật: POST /api/exchange-rates với body đã dựng sẵn dưới đây. */
  const body = {
    currencyCode: trimText(payload?.currencyCode).toUpperCase(),
    currencyName: trimText(payload?.currencyName) || undefined,
    rateToVnd: Number(payload?.rateToVnd) || 0,
    isActive: payload?.isActive !== false,
    note: trimText(payload?.note) || undefined,
  };

  await delay(280, options?.signal);

  /*
   * Mỗi mã tiền tệ chỉ một dòng — trùng mã là báo giá không biết lấy tỷ giá nào.
   *
   * Nhưng ô "Mã tiền tệ" của ExchangeRatesAdminPage chỉ cho chọn CNY/JPY/KRW/USD,
   * mà cả bốn mã đó đều đã có sẵn trong danh mục (và phải giữ, vì bộ quy đổi ở
   * SaleDashboard, ServicePricings và modal báo giá mua hộ đọc đúng bốn mã này).
   * Nếu ném 409 thì nút "Thêm tỷ giá" KHÔNG BAO GIỜ chạy được — mọi lựa chọn đều
   * ra toast đỏ. Nên ở đây giữ đúng ràng buộc một-dòng-một-mã bằng cách ghi đè
   * dòng cũ thay vì báo lỗi: bảng nạp lại vẫn đủ 12 dòng và hiện ngay tỷ giá mới.
   * Khi cắm API thật trở lại thì để BE quyết định (409 hoặc upsert tuỳ endpoint).
   */
  const existing = exchangeRates.find(
    (rate) => rate.currencyCode === body.currencyCode
  );

  if (existing) {
    Object.assign(existing, {
      currencyName: body.currencyName ?? existing.currencyName,
      rateToVnd: body.rateToVnd,
      isActive: body.isActive,
      note: body.note ?? "",
      updatedAt: nowIso(),
    });

    return normalizeExchangeRateRecord(deepClone(existing));
  }

  const timestamp = nowIso();
  const record = {
    id: mintUuid("0b82f100"),
    currencyCode: body.currencyCode,
    currencyName: body.currencyName ?? "",
    rateToVnd: body.rateToVnd,
    isActive: body.isActive,
    note: body.note ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  exchangeRates.unshift(record);
  return normalizeExchangeRateRecord(deepClone(record));
};

export const updateExchangeRate = async (rateId, payload, options = {}) => {
  /* API thật: PUT /api/exchange-rates/{rateId} — body không đổi mã tiền tệ. */
  const id = requireId(rateId, "mã tỷ giá");

  const body = {
    currencyName: trimText(payload?.currencyName) || undefined,
    rateToVnd: Number(payload?.rateToVnd) || 0,
    isActive: payload?.isActive !== false,
    note: trimText(payload?.note) || undefined,
  };

  await delay(260, options?.signal);

  const record = findRecord(exchangeRates, id, "mã tỷ giá");

  Object.assign(record, {
    currencyName: body.currencyName ?? record.currencyName,
    rateToVnd: body.rateToVnd,
    isActive: body.isActive,
    note: body.note ?? "",
    updatedAt: nowIso(),
  });

  return normalizeExchangeRateRecord(deepClone(record));
};

export const deleteExchangeRate = async (rateId, options = {}) => {
  /* API thật: DELETE /api/exchange-rates/{rateId} */
  return removeRecord(exchangeRates, rateId, "mã tỷ giá", options);
};

/* ==================== INVENTORIES (danh sách tồn kho) ==================== */

/*
 * Kiện đang nằm trong ô kệ.
 *
 * WarehouseLayeredView khớp kiện vào ô bằng inv.binId === location.id HOẶC
 * inv.binCode === location.binCode, còn BinInventoryModal đọc: inventoryId /
 * parcelId (rowKey), packageCode, consignmentCode, customerName, customerCode,
 * customerPhone, actualWeight, actualVolume (cm³), quantity, storedAt hoặc
 * createdAt, storageDays, storageHours.
 *
 * Dữ liệu được dựng từ chính bộ ô kệ của kho đang xem + danh sách khách hàng
 * trong people, chứ không dùng lại bộ kiện của màn Tồn kho: bộ đó đã gắn kiện
 * vào mã ô và id kho của riêng nó, mượn sang đây sẽ thành hai màn hình khai một
 * kiện ở hai chỗ khác nhau.
 */
const pad = (value, length) => String(value).padStart(length, "0");

/* Mã kiện/mã đơn theo đúng khuôn hệ thống: PCL-20260712105447-295805. */
const businessCode = (prefix, seq) =>
  `${prefix}-2026${pad(7 + (seq % 3), 2)}${pad(8 + (seq % 20), 2)}${pad(8 + (seq % 12), 2)}${pad((seq * 7) % 60, 2)}${pad((seq * 23) % 60, 2)}-${pad(100000 + ((seq * 7919) % 900000), 6)}`;

const INVENTORY_STATUS_CYCLE = [
  "AVAILABLE",
  "AVAILABLE",
  "AVAILABLE",
  "READY_FOR_CONSOLIDATION",
  "AVAILABLE",
  "RESERVED",
];

const INVENTORY_NOTES = [
  "Khách nhờ bọc thêm một lớp xốp, hàng gốm.",
  "Kiện chờ ghép lô về tỉnh, không xuất lẻ.",
  "",
  "Đã kiểm đếm hai lần, khách VIP.",
  "",
  "Hàng dễ vỡ, không xếp tầng trên.",
];

/*
 * Hệ số quy đổi thể tích đọc từ rule VOLUMETRIC_DIVISOR của pricingRules (cùng mảng màn
 * Quy tắc tính giá sửa). Thiếu/sai → mặc định 6000 kèm cảnh báo.
 */
const DEFAULT_VOLUMETRIC_DIVISOR = 6000;
const readVolumetricDivisor = () => {
  const rule = pricingRules.find(
    (item) =>
      item?.ruleCode === "VOLUMETRIC_DIVISOR" &&
      String(item?.status ?? "").trim().toUpperCase() === "ACTIVE"
  );
  const raw = rule?.value;
  const value = raw === null || raw === undefined || String(raw).trim() === "" ? NaN : Number(raw);
  if (Number.isFinite(value) && value > 0) return value;
  console.warn(
    `[adminService] Thiếu rule VOLUMETRIC_DIVISOR hợp lệ trong pricingRules, dùng mặc định ${DEFAULT_VOLUMETRIC_DIVISOR}.`
  );
  return DEFAULT_VOLUMETRIC_DIVISOR;
};

const buildInventories = (warehouseId) => {
  const locations = getLocationBucket(warehouseId).filter(
    (location) => location.isActive !== false
  );
  const warehouse = warehouses[warehouseIndexOf(warehouseId)] ?? null;
  const rows = [];
  const volumetricDivisor = readVolumetricDivisor();

  let seq = 0;

  locations.forEach((location, index) => {
    /* Chừa ~30% ô trống: kho nào cũng đầy thì nút "Xem kiện hàng" mất ý nghĩa,
       mà kho trống trơn thì không kiểm được modal chi tiết kiện. */
    if (index % 10 >= 7) return;

    /* Vài ô chứa hai kiện để cột số kiện trên sơ đồ có nhiều hơn một giá trị. */
    const parcelCount = index % 10 === 3 ? 2 : 1;

    for (let slot = 0; slot < parcelCount; slot += 1) {
      seq += 1;

      const customer = customers[(seq - 1) % customers.length];
      const inventoryId = `inv-${pad(scopeOf(warehouseId), 2)}-${pad(seq, 3)}`;
      const parcelId = `pcl-${pad(scopeOf(warehouseId), 2)}-${pad(seq, 3)}`;
      const parcelCode = businessCode("PCL", seq);
      const orderCode = businessCode(seq % 2 === 0 ? "VCL" : "PUR", seq + 3);

      const length = 30 + ((seq * 7) % 30);
      const width = 24 + ((seq * 5) % 20);
      const height = 18 + ((seq * 3) % 16);
      const actualWeight = Math.round((4 + ((seq * 13) % 180) / 10) * 10) / 10;
      const volumeCm3 = length * width * height;
      const volumetricWeight = Math.round((volumeCm3 / volumetricDivisor) * 100) / 100;
      const storageDays = 1 + (seq % 9);
      const storageHours = (seq * 5) % 24;

      rows.push({
        id: inventoryId,
        inventoryId,
        parcelId,
        parcelCode,
        packageCode: parcelCode,
        orderId: `ord-${pad(seq, 3)}`,
        orderCode,
        consignmentCode: orderCode,

        customerId: customer.id,
        customerCode: customer.customerCode,
        customerName: customer.fullName,
        customerPhone: customer.phone,

        warehouseId: trimText(warehouseId),
        warehouseCode: warehouse?.code ?? location.warehouseCode ?? "",
        warehouseName: warehouse?.name ?? location.warehouseName ?? "",

        binId: location.id,
        binCode: location.binCode,
        shelfCode: location.shelfCode,
        zoneName: location.zoneName,

        status: INVENTORY_STATUS_CYCLE[seq % INVENTORY_STATUS_CYCLE.length],
        inventoryStatus: INVENTORY_STATUS_CYCLE[seq % INVENTORY_STATUS_CYCLE.length],
        packageStatus: "OK",

        quantity: 1 + (seq % 3),
        length,
        width,
        height,
        actualWeight,
        volumetricWeight,
        chargeableWeight: Math.max(actualWeight, volumetricWeight),
        actualVolume: volumeCm3,
        volume: Math.round((volumeCm3 / 1e6) * 1000) / 1000,

        storedAt: location.createdAt,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
        storageDays,
        storageHours,
        note: INVENTORY_NOTES[seq % INVENTORY_NOTES.length],
      });
    }
  });

  return rows;
};

/* Cache theo kho: mỗi lần đọc lại mà số kiện nhảy loạn thì thẻ thống kê và sơ đồ
   sẽ lệch nhau ngay trong cùng một lần tải. */
const getInventoryBucket = (warehouseId) => {
  const key = trimText(warehouseId);
  if (!inventoryStore.has(key)) inventoryStore.set(key, buildInventories(key));
  return inventoryStore.get(key);
};

export const getInventories = async (params = {}, options = {}) => {
  /* API thật: GET /api/inventories với params { warehouseId, status, binCode, ... } */
  await delay(240, options?.signal);

  const warehouseId = trimText(params?.warehouseId);
  if (!warehouseId) return [];

  const rows = getInventoryBucket(warehouseId).filter((inventory) =>
    matchesParams(inventory, params, ["status", "inventoryStatus", "binCode", "shelfCode"])
  );

  return deepClone(rows);
};

export const getWarehouseInventories = async (warehouseId, params = {}, options = {}) => {
  /* API thật: GET /api/inventories với params { warehouseId, ...params } */
  return getInventories({ warehouseId, ...params }, options);
};
