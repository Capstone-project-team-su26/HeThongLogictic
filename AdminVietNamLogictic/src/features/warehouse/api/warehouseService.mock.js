/* =========================================================
   BẢN SAO MOCK TẠM THỜI — ĐỪNG NỐI API VÀO FILE NÀY.

   Đợt này chỉ nối API thật cho luồng BÁO GIÁ KÝ GỬI của Sale/Admin. Các màn
   ngoài luồng đó (mua hộ, SaleDashboard, chứng từ, chat, danh mục bảng giá,
   màn Sale tạo đơn hộ khách) vẫn phải chạy bằng dữ liệu mẫu, nên chúng trỏ vào
   bản sao này thay vì bản gốc đã nối backend.

   Đây là BẢN CHÉP NGUYÊN VĂN của module cùng tên (bỏ đuôi .mock) tại thời điểm
   nối API. Khi đợt sau nối nốt các màn kia: sửa import của màn đó về module gốc
   rồi XOÁ file này. Không thêm tính năng mới vào đây, không re-export từ barrel.
   ========================================================= */

/**
 * MOCK — danh mục kho hàng (bản CHỈ GIAO DIỆN).
 *
 * Bản này gỡ hẳn tầng HTTP: hai endpoint /api/warehouses và
 * /api/warehouses/active được thay bằng bộ kho mẫu trong
 * src/mocks/data/catalog.js. Muốn cắm API thật trở lại thì chỉ thay THÂN của
 * getWarehousesApi và getActiveWarehousesApi bằng lời gọi axios cũ
 * (axiosInstance.get(API_ENDPOINTS.warehouses.list / .active, { params:
 * removeEmptyParams(filters) }) rồi getResponseData → getArrayItems →
 * normalizeWarehouse). Hai hàm ORIGIN/DESTINATION đã tự gọi lại
 * getActiveWarehousesApi nên không cần sửa gì thêm.
 *
 * Bốn hàm thuần (normalizeWarehouse, mapWarehousesToOptions,
 * findWarehouseById, findWarehouseByCode) KHÔNG dính HTTP nên được giữ nguyên
 * từng dòng — chúng là hợp đồng dữ liệu mà nhiều màn hình dựa vào.
 *
 * Hình dạng trả về giữ y hệt bản thật: cả bốn hàm API trả MẢNG TRẦN các bản ghi
 * đã chuẩn hoá đúng 6 field (id, name, code, address, warehouseType, isActive),
 * KHÔNG phải response axios và cũng không bọc { items, totalCount }.
 * ConfirmPurchaseModal và PurchaseRequestDetail đều kiểm tra
 * Array.isArray(result.value) && length > 0 trước khi dùng, nên trả sai kiểu là
 * ô chọn kho rỗng chứ không phải lỗi build.
 *
 * Lưu ý có chủ ý: normalizeWarehouse cắt bỏ region/city/country của fixture,
 * đúng như bản thật. ConfirmPurchaseModal có đọc warehouse.region /
 * warehouse.country nhưng ghép bằng .filter(Boolean) nên undefined vô hại —
 * việc dò kho theo tuyến vẫn chạy nhờ code ("CN-…") và address ("Trung Quốc").
 */

import { delay } from "@/mocks/mockUtils";
import { warehouses as catalogWarehouses } from "@/mocks/data/catalog";

/* =========================
   RESPONSE / AUTH HELPERS
========================= */

/*
 * Bản chỉ-giao-diện không còn token nên getAccessToken/getAuthHeaders của bản
 * thật bị bỏ: chúng chỉ tồn tại để dựng header Authorization, và giữ lại sẽ ném
 * "Vui lòng đăng nhập lại" ngay khi mở màn hình mà chẳng có server nào để gọi.
 */

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

/* Bỏ dấu để ô tìm kiếm gõ "quang chau" vẫn khớp "Quảng Châu". */
const toSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

/* =========================
   NORMALIZE WAREHOUSE
========================= */

export const normalizeWarehouse = (
  warehouse = {}
) => ({
  id: normalizeText(warehouse?.id || warehouse?.warehouseId || warehouse?._id),
  name: normalizeText(warehouse?.name || warehouse?.warehouseName || warehouse?.title || "Kho hàng"),
  code: normalizeText(warehouse?.code || warehouse?.warehouseCode),
  address: normalizeText(warehouse?.address || warehouse?.location || warehouse?.fullAddress),
  warehouseType: normalizeText(
    warehouse?.warehouseType || warehouse?.type
  ),
  isActive: warehouse?.isActive !== false,
});

/* =========================
   LỌC TẠI CHỖ THAY CHO QUERY PARAMS
========================= */

/*
 * Bản thật đẩy `filters` xuống server qua query string. Mock phải tự lọc, nếu
 * không thì mọi bộ lọc gửi kèm sẽ bị phớt lờ và danh sách luôn ra đủ 13 kho.
 * Lọc trên bản ghi GỐC (còn region/city/country) vì normalizeWarehouse cắt mất
 * các field đó — lọc sau khi chuẩn hoá là mất luôn khả năng tìm theo khu vực.
 */
const matchesFilters = (
  warehouse,
  filters = {}
) => {
  const keyword = toSearchText(
    filters?.keyword ??
      filters?.search ??
      filters?.searchTerm ??
      filters?.name ??
      ""
  );

  if (keyword) {
    const haystack = toSearchText(
      [
        warehouse?.code,
        warehouse?.name,
        warehouse?.address,
        warehouse?.region,
        warehouse?.city,
        warehouse?.country,
        warehouse?.warehouseType,
        warehouse?.contactPerson,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!haystack.includes(keyword)) {
      return false;
    }
  }

  const warehouseType = normalizeUpperText(
    filters?.warehouseType ?? filters?.type
  );

  if (
    warehouseType &&
    normalizeUpperText(warehouse?.warehouseType) !==
      warehouseType
  ) {
    return false;
  }

  const region = normalizeUpperText(filters?.region);

  if (
    region &&
    normalizeUpperText(warehouse?.region) !== region
  ) {
    return false;
  }

  const city = normalizeUpperText(filters?.city);

  if (
    city &&
    normalizeUpperText(warehouse?.city) !== city
  ) {
    return false;
  }

  const country = normalizeUpperText(filters?.country);

  if (
    country &&
    normalizeUpperText(warehouse?.country) !== country
  ) {
    return false;
  }

  if (
    filters?.isActive !== undefined &&
    filters?.isActive !== null &&
    filters?.isActive !== "" &&
    (warehouse?.isActive !== false) !==
      Boolean(filters.isActive)
  ) {
    return false;
  }

  return true;
};

/* =========================
   WAREHOUSE API
========================= */

export const getWarehousesApi = async (
  filters = {}
) => {
  /* Giữ await để skeleton/loading của các màn gọi song song vẫn kịp hiện. */
  await delay(240, filters?.signal);

  return catalogWarehouses
    .filter((warehouse) =>
      matchesFilters(warehouse, filters)
    )
    .map(normalizeWarehouse)
    .filter(
      (warehouse) =>
        Boolean(warehouse.id) &&
        Boolean(warehouse.name)
    );
};

export const getActiveWarehousesApi = async (
  filters = {}
) => {
  await delay(260, filters?.signal);

  // /active đã lọc kho ngừng hoạt động; field có thể không có isActive.
  return catalogWarehouses
    .filter(
      (warehouse) =>
        warehouse?.isActive !== false &&
        matchesFilters(warehouse, filters)
    )
    .map(normalizeWarehouse)
    .filter(
      (warehouse) =>
        Boolean(warehouse.id) &&
        Boolean(warehouse.name)
    );
};

export const getOriginWarehousesApi = async (
  filters = {}
) => {
  const warehouses =
    await getActiveWarehousesApi(filters);

  return warehouses.filter(
    (warehouse) =>
      normalizeUpperText(
        warehouse?.warehouseType
      ) === "ORIGIN"
  );
};

export const getDestinationWarehousesApi =
  async (filters = {}) => {
    const warehouses =
      await getActiveWarehousesApi(filters);

    return warehouses.filter(
      (warehouse) =>
        normalizeUpperText(
          warehouse?.warehouseType
        ) === "DESTINATION"
    );
  };

/* =========================
   WAREHOUSE HELPERS
========================= */

export const mapWarehousesToOptions = (
  warehouses = []
) => {
  if (!Array.isArray(warehouses)) {
    return [];
  }

  return warehouses
    .filter(
      (warehouse) =>
        Boolean(warehouse?.id) &&
        Boolean(warehouse?.name)
    )
    .map((warehouse) => {
      const id = normalizeText(warehouse?.id);
      const name = normalizeText(
        warehouse?.name
      );
      const code = normalizeText(
        warehouse?.code
      );
      const address = normalizeText(
        warehouse?.address
      );
      const warehouseType = normalizeText(
        warehouse?.warehouseType
      );

      return {
        value: id,
        label: code
          ? `${name} (${code})`
          : name,

        id,
        name,
        code,
        address,
        warehouseType,
        isActive:
          warehouse?.isActive === true,

        searchText: [
          name,
          code,
          address,
          warehouseType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });
};

export const findWarehouseById = (
  warehouses = [],
  warehouseId
) => {
  if (!Array.isArray(warehouses)) {
    return null;
  }

  const normalizedId =
    normalizeText(warehouseId);

  if (!normalizedId) {
    return null;
  }

  return (
    warehouses.find(
      (warehouse) =>
        normalizeText(warehouse?.id) ===
        normalizedId
    ) || null
  );
};

export const findWarehouseByCode = (
  warehouses = [],
  warehouseCode
) => {
  if (!Array.isArray(warehouses)) {
    return null;
  }

  const normalizedCode =
    normalizeUpperText(warehouseCode);

  if (!normalizedCode) {
    return null;
  }

  return (
    warehouses.find(
      (warehouse) =>
        normalizeUpperText(
          warehouse?.code
        ) === normalizedCode
    ) || null
  );
};

const warehouseService = {
  normalizeWarehouse,
  getWarehousesApi,
  getActiveWarehousesApi,
  getOriginWarehousesApi,
  getDestinationWarehousesApi,
  mapWarehousesToOptions,
  findWarehouseById,
  findWarehouseByCode,
};

export default warehouseService;
