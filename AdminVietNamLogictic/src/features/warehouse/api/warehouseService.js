/* =========================================================
   DANH MỤC KHO — ĐÃ NỐI API THẬT (đợt báo giá ký gửi).

   - GET /api/warehouses?isActive=&search=&regionCode=   (role Admin)
   - GET /api/warehouses/active                          (mọi nhân viên + Customer)
     → bọc kiểu { "items": [ ... ] }, mỗi phần tử có
       { id, name, code, address, contactPhone, region, regionCode, warehouseType, isActive }

   Cả bốn hàm API vẫn trả MẢNG TRẦN các bản ghi đã chuẩn hoá — đúng hợp đồng cũ,
   nên không component nào phải sửa. getOriginWarehousesApi / getDestinationWarehousesApi
   lọc tiếp theo warehouseType trên kết quả của /active (màn báo giá chỉ được
   chọn kho ORIGIN — backend cũng chặn lại lần nữa ở POST .../quotation/send).

   normalizeWarehouse nay GIỮ THÊM region/regionCode/contactPhone: backend trả mã
   vùng ISO ("CN", "KR", "JP", "VN"), và màn lập báo giá dò kho theo quốc gia của
   tuyến — có region thì khớp chắc chắn thay vì đoán qua mã kho và địa chỉ.

   Màn ngoài luồng ký gửi (mua hộ) dùng bản sao ./warehouseService.mock.js.
   ========================================================= */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import {
  getArrayItems,
  getResponseData,
  removeEmptyParams,
} from "@shared/api/apiEnvelope";

/* =========================
   HELPERS
========================= */

/*
 * Không còn getAccessToken/getAuthHeaders riêng ở đây: httpClient đã gắn
 * Authorization từ sessionStorage cho mọi request (trừ /api/Auth/*), nên mỗi
 * module tự dựng header là thừa và dễ lệch.
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

  /* Mã vùng ISO của kho (CN / KR / JP / VN). Bản mock trước đây cắt bỏ trường
     này; giữ lại để màn báo giá dò kho theo tuyến không phải đoán qua mã kho. */
  region: normalizeUpperText(
    warehouse?.region || warehouse?.regionCode
  ),
  regionCode: normalizeUpperText(
    warehouse?.regionCode || warehouse?.region
  ),
  contactPhone: normalizeText(warehouse?.contactPhone),
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

/*
 * Một chỗ duy nhất bóc vỏ response rồi chuẩn hoá: /api/warehouses trả
 * { message, items } còn /api/warehouses/active trả { items }. Bộ lọc còn lại
 * (warehouseType, city, country, keyword) vẫn chạy tại chỗ trên bản ghi GỐC —
 * backend chưa nhận hết các tham số đó, bỏ đi là bộ lọc trên giao diện im lặng
 * ngừng hoạt động.
 */
const toWarehouseList = (response, filters = {}) =>
  getArrayItems(getResponseData(response))
    .filter((warehouse) => matchesFilters(warehouse, filters))
    .map(normalizeWarehouse)
    .filter(
      (warehouse) =>
        Boolean(warehouse.id) && Boolean(warehouse.name)
    );

/**
 * GET /api/warehouses — role Admin. Trả mảng trần đã chuẩn hoá.
 *
 * Backend nhận isActive / search / regionCode; các bộ lọc cũ của giao diện
 * (warehouseType, city, country, keyword...) được ánh xạ về ba tham số đó,
 * phần còn lại lọc tại chỗ để hành vi hiển thị không đổi.
 */
export const getWarehousesApi = async (
  filters = {}
) => {
  const { signal } = filters || {};

  const response = await httpClient.get(
    API_ENDPOINTS.warehouses.list,
    {
      params: removeEmptyParams({
        isActive: filters?.isActive,
        search:
          filters?.search ??
          filters?.keyword ??
          filters?.searchTerm ??
          filters?.name,
        regionCode:
          filters?.regionCode ??
          filters?.region ??
          filters?.country,
      }),
      signal,
    }
  );

  return toWarehouseList(response, filters);
};

/**
 * GET /api/warehouses/active — mọi nhân viên gọi được. Backend bọc { items: [...] }.
 */
export const getActiveWarehousesApi = async (
  filters = {}
) => {
  const { signal } = filters || {};

  const response = await httpClient.get(
    API_ENDPOINTS.warehouses.active,
    {
      params: removeEmptyParams({
        regionCode:
          filters?.regionCode ??
          filters?.region ??
          filters?.country,
      }),
      signal,
    }
  );

  /* /active đã bỏ kho ngừng hoạt động, nhưng vẫn lọc lại: bản ghi cũ có thể
     thiếu isActive và giao diện dựa vào cờ này để khoá ô chọn. */
  return toWarehouseList(response, filters).filter(
    (warehouse) => warehouse.isActive
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
