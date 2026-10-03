/**
 * NHÃN LOẠI HÀNG + TÊN THÙNG — hàm thuần, dùng chung cho mọi màn hiện dòng hàng.
 *
 * Vì sao có file này: cột ORDER_ITEMS.PRODUCT_TYPE lưu Id của danh mục loại hàng (đơn cũ và đơn
 * sinh từ mua hộ thì lưu thẳng tên). Màn nào in `item.productType` khi API thiếu
 * `productTypeName` là người dùng thấy chuỗi GUID "11111111-0000-0000-0000-000000000001".
 * Luật ở đây: KHÔNG BAO GIỜ trả một GUID làm nhãn.
 *
 *   1. Có tên (productTypeName / categoryName / productCategoryName) và không phải GUID → tên đó.
 *   2. Giá trị gốc (productType / productTypeId / categoryId):
 *        - không phải GUID → tên lưu kiểu cũ, trả nguyên;
 *        - là GUID → tra danh mục (`nameById`, Map khoá id viết thường) → tên.
 *   3. Còn lại → "Chưa phân loại".
 *
 * Id seed của hệ thống (11111111-0000-…) KHÔNG theo RFC 4122, nên nhận diện GUID theo khuôn
 * 8-4-4-4-12 hex bất kỳ, không kiểm version/variant.
 *
 * Tên thùng: hiện giống hệt web khách — map theo mã SMALL/MEDIUM/LARGE/CUSTOM sang tiếng Việt;
 * mã khác dùng tên backend trả (`displayName`, rồi `configName`), tên tiếng Anh mặc định
 * ("Medium Box"...) được dịch, không để lọt ra màn hình.
 */

export const UNCLASSIFIED_PRODUCT_TYPE_LABEL = "Chưa phân loại";

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toText = (value) =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

/** Chuỗi có dạng GUID (8-4-4-4-12 hex, không kiểm RFC 4122). */
export const isGuidLike = (value) => GUID_PATTERN.test(toText(value));

const NAME_FIELDS = ["productTypeName", "categoryName", "productCategoryName"];
const RAW_FIELDS = ["productType", "productTypeId", "categoryId"];

/** Map id → tên từ mảng `[{ id, name }]` của GET /api/product-types (khoá id viết thường). */
export const buildProductTypeNameMap = (types = []) => {
  const map = new Map();

  (Array.isArray(types) ? types : []).forEach((type) => {
    const id = toText(type?.id ?? type?.value).toLowerCase();
    const name = toText(type?.name ?? type?.label);

    if (id && name && !isGuidLike(name)) map.set(id, name);
  });

  return map;
};

const lookupName = (nameById, id) => {
  if (!nameById || !id) return "";
  const key = id.toLowerCase();

  if (nameById instanceof Map) return toText(nameById.get(key) ?? nameById.get(id));
  if (typeof nameById === "object") return toText(nameById[key] ?? nameById[id]);
  return "";
};

/**
 * Id loại hàng (GUID) của dòng cần tra danh mục mới ra tên, hoặc "" nếu dòng đã tự có nhãn
 * (tên backend gửi, tên lưu kiểu cũ) hay không có loại nào.
 */
export const getProductTypeIdToResolve = (item) => {
  if (!item || typeof item !== "object") return "";

  if (NAME_FIELDS.some((field) => toText(item[field]) && !isGuidLike(item[field]))) return "";

  for (const field of RAW_FIELDS) {
    const raw = toText(item[field]);
    if (!raw) continue;
    return isGuidLike(raw) ? raw : "";
  }

  /* Backend lỡ gửi GUID vào chính field tên → vẫn tra được. */
  const guidInName = NAME_FIELDS.map((field) => toText(item[field])).find(isGuidLike);
  return guidInName || "";
};

/**
 * Nhãn loại hàng của một dòng hàng/kiện. Không bao giờ trả GUID.
 *
 * @param {object} item dòng hàng (order item, kiện, dòng phiếu nhập...)
 * @param {Map<string,string>|Record<string,string>} [nameById] danh mục id → tên
 * @param {string} [fallback] nhãn khi không xác định được loại
 */
export const resolveProductTypeLabel = (
  item,
  nameById,
  fallback = UNCLASSIFIED_PRODUCT_TYPE_LABEL,
) => {
  if (!item || typeof item !== "object") return fallback;

  for (const field of NAME_FIELDS) {
    const name = toText(item[field]);
    if (name && !isGuidLike(name)) return name;
  }

  for (const field of RAW_FIELDS) {
    const raw = toText(item[field]);
    if (!raw) continue;
    if (!isGuidLike(raw)) return raw;

    const name = lookupName(nameById, raw);
    if (name && !isGuidLike(name)) return name;
  }

  const guidInName = NAME_FIELDS.map((field) => toText(item[field])).find(isGuidLike);
  const name = guidInName ? lookupName(nameById, guidInName) : "";

  return name && !isGuidLike(name) ? name : fallback;
};

/* =========================================================
   TÊN THÙNG (package configuration)
   ========================================================= */

/** Cùng bảng với web khách (ConsignmentListDetailUI.constants.js của vcl-customer-ui). */
export const PACKAGE_CONFIGURATION_NAMES = Object.freeze({
  SMALL: "Thùng cỡ nhỏ",
  MEDIUM: "Thùng cỡ vừa",
  LARGE: "Thùng cỡ lớn",
  CUSTOM: "Thùng tùy chỉnh",
});

/** Dịch tên thùng tiếng Anh mặc định của seed ("Medium Box"...) — cùng luật web khách. */
export const translatePackageConfigurationName = (value) =>
  toText(value)
    .replace(/large\s*box/gi, PACKAGE_CONFIGURATION_NAMES.LARGE)
    .replace(/medium\s*box/gi, PACKAGE_CONFIGURATION_NAMES.MEDIUM)
    .replace(/small\s*box/gi, PACKAGE_CONFIGURATION_NAMES.SMALL)
    .replace(/custom\s*box/gi, PACKAGE_CONFIGURATION_NAMES.CUSTOM)
    .trim();

/**
 * Tên thùng hiển thị: mã chuẩn → tên tiếng Việt như web khách; mã khác → tên backend
 * (`displayName`, `configName`, `name`) đã dịch phần tiếng Anh mặc định; không có gì → mã.
 * Không bao giờ trả GUID.
 */
export const formatPackageConfigurationName = (config, fallback = "") => {
  if (!config || typeof config !== "object") return fallback;

  const code = toText(config.configCode ?? config.code).toUpperCase();
  if (PACKAGE_CONFIGURATION_NAMES[code]) return PACKAGE_CONFIGURATION_NAMES[code];

  const named = [config.displayName, config.configName, config.name]
    .map(translatePackageConfigurationName)
    .find((name) => name && !isGuidLike(name));
  if (named) return named;

  return code && !isGuidLike(code) ? code : fallback;
};
