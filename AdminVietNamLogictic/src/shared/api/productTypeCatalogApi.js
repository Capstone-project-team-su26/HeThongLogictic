/* =========================================================
   productTypeCatalogApi — API THẬT, danh mục loại hàng để dịch Id → tên khi hiển thị.

   GET /api/product-types  (không cần đăng nhập)  → { message, data: [ { id, name } ] }

   Chỉ dùng làm LƯỚI AN TOÀN cho màn hiển thị: backend đã trả `productTypeName` kèm dòng hàng,
   nhưng dòng nào thiếu (endpoint cũ, dữ liệu cũ) thì màn hình tra ở đây thay vì in GUID.

   - Tải MỘT lần cho cả phiên trang, mọi màn dùng chung (promise cache ở cấp module).
   - Tải lỗi thì không cache, lần sau gọi lại tải lại; lỗi không bao giờ ném ra ngoài —
     trả Map rỗng, màn hình hiện "Chưa phân loại".
   - Form chọn loại hàng vẫn dùng getProductTypesApi của @features/consignment (đầy đủ bản ghi);
     file này ở shared/ vì `shared/` không được import `features/`.
   ========================================================= */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getArrayItems, getResponseData } from "@shared/api/apiEnvelope";
import { buildProductTypeNameMap } from "@shared/utils/productTypeLabel";

let cachedPromise = null;
let cachedMap = null;

/** Map id (viết thường) → tên đã tải xong, hoặc null nếu chưa tải. */
export const peekProductTypeNameMap = () => cachedMap;

/**
 * Map id (viết thường) → tên loại hàng. Không bao giờ reject.
 * @returns {Promise<Map<string, string>>}
 */
export const getProductTypeNameMapApi = () => {
  if (cachedMap) return Promise.resolve(cachedMap);
  if (cachedPromise) return cachedPromise;

  cachedPromise = httpClient
    .get(API_ENDPOINTS.productTypes)
    .then((response) => {
      cachedMap = buildProductTypeNameMap(getArrayItems(getResponseData(response)));
      return cachedMap;
    })
    .catch(() => {
      cachedPromise = null;
      return new Map();
    });

  return cachedPromise;
};

/** Xoá cache (Admin vừa sửa danh mục, hoặc kiểm thử). */
export const resetProductTypeNameMapCache = () => {
  cachedPromise = null;
  cachedMap = null;
};
