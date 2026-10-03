import { useEffect, useState } from "react";

import {
  getProductTypeNameMapApi,
  peekProductTypeNameMap,
} from "@shared/api/productTypeCatalogApi";

const EMPTY_MAP = new Map();

/**
 * Danh mục loại hàng id → tên (cache chung cả trang). Chỉ gọi API khi `enabled` — tức là có
 * dòng hàng thật sự cần tra (thiếu `productTypeName` mà chỉ có Id), dòng đã có tên thì khỏi tải.
 *
 *   const names = useProductTypeNames(needsLookup);
 *   resolveProductTypeLabel(item, names);
 */
export default function useProductTypeNames(enabled = true) {
  const [names, setNames] = useState(() => peekProductTypeNameMap() || EMPTY_MAP);

  useEffect(() => {
    if (!enabled) return undefined;

    let active = true;
    getProductTypeNameMapApi().then((map) => {
      if (active) setNames(map);
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  return names;
}
