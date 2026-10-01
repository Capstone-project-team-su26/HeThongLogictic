/**
 * Hàng cấm và hạn chế — API THẬT (RestrictedItemController, [Authorize], đọc: mọi nhân viên).
 *
 *   GET /api/restricted-items       → MẢNG TRẦN RestrictedItemDto
 *       { id, itemName, country, restrictionType, note, isActive } — backend KHÔNG nhận bộ lọc
 *   GET /api/restricted-items/{id}  → TRẦN · 404 { message }
 *
 * Gọi lại đúng hai hàm catalogAdminService.getRestrictedItems / getRestrictedItemDetail (trang
 * danh mục Admin đang dùng), rồi chuẩn hoá về hình dạng cũ mà RestrictedItems.jsx và
 * FieldLabelTooltip.jsx đọc (countryDisplayName, restrictionTypeDisplayName...). Bộ lọc
 * keyword/country/restrictionType/activeOnly chạy phía client vì backend trả nguyên danh sách.
 * Bản mock cũ (fixture @/mocks/data/catalog) nằm ở restrictedItemService.mock.js.
 */
import {
  getRestrictedItemDetail,
  getRestrictedItems,
} from "@features/catalog/api/catalogAdminService";
import { labelOf } from "@shared/utils/statusLabel";

export const RESTRICTION_TYPE = {
  BANNED: "BANNED",
  RESTRICTED: "RESTRICTED",
  WARNING: "WARNING",
};

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

/* Bỏ dấu + khoảng trắng để "Trung Quốc", "trung quoc", "CN" cùng về một khoá. */
const toCountryKey = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

/*
 * Country trong DB là chữ tự do Admin gõ. Dropdown "Quốc gia" của RestrictedItems.jsx so
 * item.country với "Vietnam"/"China"/"Korea"/"Japan", nên quy các cách viết quen thuộc về
 * đúng tên đó; cách viết lạ thì giữ nguyên (vẫn hiện, chỉ không khớp bộ lọc quốc gia).
 */
const COUNTRY_KEY_TO_NAME = {
  VN: "Vietnam",
  VIETNAM: "Vietnam",
  CN: "China",
  CHINA: "China",
  TRUNGQUOC: "China",
  KR: "Korea",
  KOREA: "Korea",
  SOUTHKOREA: "Korea",
  HANQUOC: "Korea",
  JP: "Japan",
  JAPAN: "Japan",
  NHATBAN: "Japan",
};

const COUNTRY_NAME_LABELS = {
  Vietnam: "Việt Nam",
  China: "Trung Quốc",
  Korea: "Hàn Quốc",
  Japan: "Nhật Bản",
};

const RESTRICTION_LABELS = {
  BANNED: "Cấm vận chuyển",
  RESTRICTED: "Hạn chế",
  WARNING: "Cảnh báo",
};

export const normalizeRestrictedItem = (item = {}) => {
  const rawCountry = normalizeText(item?.country);
  const country = COUNTRY_KEY_TO_NAME[toCountryKey(rawCountry)] || rawCountry;
  const restrictionType = normalizeUpperText(item?.restrictionType);

  return {
    ...item,
    id: normalizeText(item?.id),
    itemName: normalizeText(item?.itemName),
    country,
    countryDisplayName: COUNTRY_NAME_LABELS[country] || country || "—",
    restrictionType,
    restrictionTypeDisplayName: labelOf(RESTRICTION_LABELS, restrictionType, {
      generic: "Loại hạn chế khác",
    }),
    note: normalizeText(item?.note),
    isActive: item?.isActive !== false,
  };
};

/* =========================================================
   LỌC PHÍA CLIENT (backend không nhận query)
========================================================= */

const includesKeyword = (item, keyword) => {
  const needle = normalizeText(keyword).toLowerCase();

  if (!needle) return true;

  return [item?.itemName, item?.note, item?.country, item?.countryDisplayName]
    .join(" ")
    .toLowerCase()
    .includes(needle);
};

const applyFilters = (items, filters = {}) => {
  const keyword =
    filters?.keyword ?? filters?.search ?? filters?.searchTerm ?? filters?.q ?? "";

  const countryFilter = normalizeText(filters?.country ?? filters?.countryCode ?? "");
  const countryName = COUNTRY_KEY_TO_NAME[toCountryKey(countryFilter)] || countryFilter;

  const restrictionType = normalizeUpperText(
    filters?.restrictionType ?? filters?.type ?? ""
  );

  const activeFilter = filters?.isActive ?? filters?.activeOnly ?? null;

  return items.filter((item) => {
    if (!includesKeyword(item, keyword)) return false;

    /* "ALL" là giá trị mặc định của dropdown, không phải một quốc gia. */
    if (
      countryName &&
      normalizeUpperText(countryName) !== "ALL" &&
      normalizeUpperText(item?.country) !== normalizeUpperText(countryName)
    ) {
      return false;
    }

    if (
      restrictionType &&
      restrictionType !== "ALL" &&
      item?.restrictionType !== restrictionType
    ) {
      return false;
    }

    if (activeFilter !== null && activeFilter !== undefined && activeFilter !== "") {
      const wantActive =
        activeFilter === true || normalizeUpperText(activeFilter) === "TRUE";

      if (wantActive !== (item?.isActive === true)) return false;
    }

    return true;
  });
};

/* =========================================================
   API
========================================================= */

/** Trả MẢNG TRẦN đã chuẩn hoá. Lỗi HTTP ném nguyên dạng axios (trang đọc response.data.message). */
export const getRestrictedItemsApi = async (filters = {}) => {
  const { signal, ...queryFilters } = filters || {};

  const rows = await getRestrictedItems({ signal });

  return applyFilters(rows.map(normalizeRestrictedItem), queryFilters).filter(
    (item) => Boolean(item.id)
  );
};

/* FieldLabelTooltip.jsx truyền { signal } của AbortController — chuyển tiếp xuống axios. */
export const getRestrictedItemListApi = (filters = {}) =>
  getRestrictedItemsApi(filters);

export const getRestrictedItemDetailApi = async (restrictedItemId, options = {}) => {
  const id = normalizeText(restrictedItemId);

  if (!id) {
    throw new Error("Không tìm thấy mã hàng hạn chế.");
  }

  return normalizeRestrictedItem(await getRestrictedItemDetail(id, options));
};

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
