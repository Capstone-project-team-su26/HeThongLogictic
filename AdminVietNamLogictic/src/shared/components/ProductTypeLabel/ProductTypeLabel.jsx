import useProductTypeNames from "@shared/hooks/useProductTypeNames";
import {
  getProductTypeIdToResolve,
  resolveProductTypeLabel,
  UNCLASSIFIED_PRODUCT_TYPE_LABEL,
} from "@shared/utils/productTypeLabel";

/**
 * Tên loại hàng của một dòng hàng/kiện — không bao giờ in GUID.
 *
 * Dòng có `productTypeName` (hoặc tên lưu kiểu cũ) thì hiện ngay; dòng chỉ có Id thì tra danh
 * mục GET /api/product-types (tải một lần, cache chung cả trang), chưa tra xong hoặc không tra
 * được thì hiện "Chưa phân loại". Màn nào đã tự có map id → tên thì truyền `names` để khỏi tải.
 *
 * @param {{ item: object, names?: Map<string,string>, fallback?: string }} props
 */
export default function ProductTypeLabel({ item, names, fallback = UNCLASSIFIED_PRODUCT_TYPE_LABEL }) {
  const needsLookup = !names && Boolean(getProductTypeIdToResolve(item));
  const catalog = useProductTypeNames(needsLookup);

  return resolveProductTypeLabel(item, names || catalog, fallback);
}
