/**
 * MOCK hàng cấm và hạn chế — BẢN SAO LƯU, không màn nào import (bản thật: restrictedItemService.js).
 *
 * Tầng HTTP đã bị gỡ: không axiosInstance, không API_ENDPOINTS. Dữ liệu lấy từ
 * bộ mẫu `restrictedItems` trong @/mocks/data/catalog và được chuẩn hoá bằng
 * đúng `normalizeRestrictedItem` của bản thật, nên hình dạng bản ghi mà
 * RestrictedItems.jsx và FieldLabelTooltip.jsx đọc không đổi một field nào.
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm bên dưới có một khối "// [API THẬT]" ghi rõ
 * endpoint cũ. Chỉ cần thay phần đọc `readRestrictedItemStore()` bằng lời gọi
 * axiosInstance tương ứng rồi trả về qua cùng `normalizeRestrictedItem` là xong;
 * phần chuẩn hoá và lọc phía dưới giữ nguyên được.
 */

import {
  restrictedItems as restrictedItemFixtures,
} from "@/mocks/data/catalog";
import {
  createApiError,
  deepClone,
  delay,
  matchesKeyword,
} from "@/mocks/mockUtils";

export const RESTRICTION_TYPE = {
  BANNED: "BANNED",
  RESTRICTED: "RESTRICTED",
  WARNING: "WARNING",
};

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const normalizeId = (value) => {
  const id = normalizeText(value);
  if (!id) {
    throw new Error("Không tìm thấy mã hàng hạn chế.");
  }
  return id;
};

const COUNTRY_LABELS = {
  VN: "Việt Nam",
  VIETNAM: "Việt Nam",
  CN: "Trung Quốc",
  CHINA: "Trung Quốc",
  KR: "Hàn Quốc",
  KOREA: "Hàn Quốc",
  SOUTHKOREA: "Hàn Quốc",
  JP: "Nhật Bản",
  JAPAN: "Nhật Bản",
};

const RESTRICTION_LABELS = {
  BANNED: "Cấm vận chuyển",
  RESTRICTED: "Hạn chế",
  WARNING: "Cảnh báo",
};

export const normalizeRestrictedItem = (item = {}) => {
  const country = normalizeText(item?.country);
  const restrictionType = normalizeUpperText(
    item?.restrictionType
  );

  return {
    ...item,
    id: normalizeText(item?.id),
    itemName: normalizeText(item?.itemName),
    country,
    countryDisplayName:
      COUNTRY_LABELS[normalizeUpperText(country)] || country || "—",
    restrictionType,
    restrictionTypeDisplayName:
      RESTRICTION_LABELS[restrictionType] || restrictionType || "—",
    note: normalizeText(item?.note),
    isActive: item?.isActive === true,
  };
};

/* =========================================================
   BỘ DỮ LIỆU TRONG BỘ NHỚ
========================================================= */

/*
 * Bộ mẫu lưu mã quốc gia ngắn (CN/VN), nhưng dropdown "Quốc gia" trong
 * RestrictedItems.jsx lọc bằng cách so `item.country` với đúng chuỗi
 * "Vietnam"/"China"/"Korea"/"Japan". Nếu trả nguyên mã thì chọn quốc gia nào
 * bảng cũng rỗng, nên đổi mã sang tên dài — COUNTRY_LABELS vẫn map được cả hai
 * dạng, countryDisplayName do đó vẫn ra "Việt Nam"/"Trung Quốc".
 */
const COUNTRY_CODE_TO_NAME = {
  VN: "Vietnam",
  VIETNAM: "Vietnam",
  CN: "China",
  CHINA: "China",
  KR: "Korea",
  KOREA: "Korea",
  JP: "Japan",
  JAPAN: "Japan",
};

const toCanonicalCountry = (value) => {
  const raw = normalizeText(value);
  return (
    COUNTRY_CODE_TO_NAME[normalizeUpperText(raw)] || raw
  );
};

/*
 * Đọc fixture Ở THỜI ĐIỂM GỌI, không chụp một bản clone lúc import.
 *
 * Mock adminService CRUD thẳng trên chính mảng `restrictedItems` này (màn "Hàng
 * cấm và hạn chế" bên Trung tâm quản trị). Nếu chụp ảnh lúc import thì mặt hàng
 * admin vừa thêm không bao giờ hiện ở màn tra cứu của Sale, còn mặt hàng admin
 * vừa xoá vẫn nằm trong bảng — bấm xem chi tiết là ăn toast đỏ 404 dù dòng đang
 * hiển thị ngay trước mắt.
 */
const readRestrictedItemStore = () =>
  deepClone(restrictedItemFixtures).map(
    (item) => ({
      ...item,
      country: toCanonicalCountry(
        item?.country
      ),
    })
  );

/* =========================================================
   LỌC PHÍA CLIENT (thay cho query params của bản thật)
========================================================= */

const SEARCH_FIELDS = [
  "itemName",
  "note",
  "country",
];

/*
 * Bản thật đẩy bộ lọc lên server qua params. Mock không có server nên lọc tại
 * đây, chấp nhận đủ các tên field mà những nơi gọi có thể dùng (keyword/search/q,
 * isActive/activeOnly) để không màn nào nhận về danh sách rỗng oan.
 */
const applyFilters = (items, filters = {}) => {
  const keyword =
    filters?.keyword ??
    filters?.search ??
    filters?.searchTerm ??
    filters?.q ??
    "";

  const country = normalizeUpperText(
    filters?.country ?? filters?.countryCode ?? ""
  );

  const restrictionType = normalizeUpperText(
    filters?.restrictionType ?? filters?.type ?? ""
  );

  const activeFilter =
    filters?.isActive ?? filters?.activeOnly ?? null;

  return items.filter((item) => {
    if (
      keyword &&
      !matchesKeyword(item, keyword, SEARCH_FIELDS)
    ) {
      return false;
    }

    /* "ALL" là giá trị mặc định của dropdown, không phải một quốc gia. */
    if (
      country &&
      country !== "ALL" &&
      normalizeUpperText(item?.country) !== country &&
      COUNTRY_CODE_TO_NAME[country] !==
        normalizeText(item?.country)
    ) {
      return false;
    }

    if (
      restrictionType &&
      restrictionType !== "ALL" &&
      normalizeUpperText(item?.restrictionType) !==
        restrictionType
    ) {
      return false;
    }

    if (
      activeFilter !== null &&
      activeFilter !== undefined &&
      activeFilter !== ""
    ) {
      const wantActive =
        activeFilter === true ||
        normalizeUpperText(activeFilter) === "TRUE";

      if (wantActive && item?.isActive !== true) {
        return false;
      }

      if (!wantActive && item?.isActive === true) {
        return false;
      }
    }

    return true;
  });
};

/* =========================================================
   ĐỌC DANH SÁCH
========================================================= */

/*
 * Trả MẢNG TRẦN đã chuẩn hoá, y như bản thật (nó tự bóc data rồi map).
 * RestrictedItems.jsx gọi không tham số và dùng thẳng kết quả cho setItems.
 */
export const getRestrictedItemsApi = async (filters = {}) => {
  const { signal, ...queryFilters } = filters || {};

  // [API THẬT] GET API_ENDPOINTS.restrictedItems.list, params: queryFilters
  await delay(240, signal);

  return applyFilters(
    readRestrictedItemStore(),
    queryFilters
  )
    .map(normalizeRestrictedItem)
    .filter((item) => Boolean(item.id));
};

/*
 * FieldLabelTooltip.jsx gọi hàm này với { signal } của AbortController và tự
 * huỷ request cũ mỗi lần mở popup, nên signal phải được chuyển tiếp xuống delay.
 */
export const getRestrictedItemListApi = (filters = {}) =>
  getRestrictedItemsApi(filters);

/* =========================================================
   ĐỌC CHI TIẾT
========================================================= */

export const getRestrictedItemDetailApi = async (
  restrictedItemId
) => {
  const id = normalizeId(restrictedItemId);

  // [API THẬT] GET API_ENDPOINTS.restrictedItems.detail(id)
  await delay(200);

  const found = readRestrictedItemStore().find(
    (item) => normalizeText(item?.id) === id
  );

  /*
   * Bản thật để axios ném lỗi 404; modal chi tiết đọc
   * error.response.data.message nên phải dựng lỗi có đủ cụm response.
   */
  if (!found) {
    throw createApiError(
      404,
      "Không tìm thấy mặt hàng hạn chế."
    );
  }

  return normalizeRestrictedItem(deepClone(found));
};

/* =========================================================
   ĐỌC DANH SÁCH ĐANG ÁP DỤNG
========================================================= */

export const getActiveRestrictedItemsApi = async (filters = {}) => {
  const items = await getRestrictedItemsApi(filters);
  return items.filter((item) => item.isActive);
};

const restrictedItemService = {
  RESTRICTION_TYPE,
  normalizeRestrictedItem,
  getRestrictedItemsApi,
  getRestrictedItemListApi,
  getRestrictedItemDetailApi,
  getActiveRestrictedItemsApi,
};

export default restrictedItemService;
