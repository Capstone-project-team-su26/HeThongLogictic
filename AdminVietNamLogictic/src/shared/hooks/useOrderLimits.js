import { useEffect, useState } from "react";

import { NO_ORDER_LIMITS, getOrderLimitsApi } from "@shared/api/orderLimitsApi";

/**
 * Giới hạn tạo đơn do Admin cấu hình — tải mỗi lần mở form (Admin sửa là form mở sau thấy ngay).
 * Trong lúc tải / tải lỗi: mọi giới hạn = null → form không chặn, backend kiểm.
 *
 *   const { consignment, purchase, loaded } = useOrderLimits();
 */
export default function useOrderLimits() {
  const [limits, setLimits] = useState({ ...NO_ORDER_LIMITS, loaded: false });

  useEffect(() => {
    const controller = new AbortController();

    getOrderLimitsApi({ signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setLimits(result);
      })
      .catch(() => {
        /* Chỉ còn trường hợp huỷ request khi rời trang — bỏ qua. */
      });

    return () => controller.abort();
  }, []);

  return limits;
}
