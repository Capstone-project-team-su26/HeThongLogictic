/**
 * Nạp ĐẦY ĐỦ thông tin một đơn để hiện trong hộp xác nhận trước khi ghi.
 *
 * Hàng đợi / danh sách chỉ mang phần đầu đơn (mã, tên khách, kho). Hộp xác nhận thì phải cho
 * người bấm thấy trọn vẹn: khách (kèm mã khách), hàng từng dòng, kiện, báo giá, tiền đã trả.
 * Hook gọi hai API THẬT song song:
 *
 *   GET /api/orders/consignments/{orderId}           → getConsignmentDetailApi
 *       (khách, người nhận, items[] kèm thùng + dịch vụ, quotation, shipments[].parcels[])
 *   GET /api/orders/{orderId}/payments/history        → getOrderPaymentHistoryApi
 *       (customer.customerCode — chi tiết đơn KHÔNG có mã khách; tổng hoá đơn, đã trả,
 *        còn lại, từng đợt cọc / thanh toán cuối)
 *
 * Hai lời gọi độc lập: hỏng cái này vẫn hiện cái kia, mỗi cái một thông báo lỗi riêng.
 *
 * Không gọi setState đồng bộ trong effect: kết quả được đánh dấu bằng `key` (orderId) và
 * `loading` suy ra từ việc key đã khớp orderId đang xem hay chưa. Đổi đơn giữa chừng thì kết
 * quả cũ bị bỏ qua (cờ `cancelled`), không có chuyện hộp của đơn B hiện hàng của đơn A.
 */

import { useEffect, useState } from "react";

import { getConsignmentDetailApi } from "../api/consignmentService";
/*
 * Cố ý đi đường sâu thay vì barrel "@features/payment": barrel đó kéo theo trang
 * OrderPaymentHistory, mà trang này lại import barrel "@features/consignment" → vòng import
 * consignment ↔ payment, và CSS của trang thanh toán bị nạp sớm hơn thứ tự gốc (xem
 * ARCHITECTURE.md mục "Vì sao thứ tự import ba file route lại quan trọng"). Module api chỉ
 * có hàm thuần, không CSS, không vòng.
 */
import { getOrderPaymentHistoryApi } from "@features/payment/api/orderPaymentService";

const readError = (reason, fallback) =>
  reason?.response?.data?.message || reason?.message || fallback;

const EMPTY = Object.freeze({
  key: "",
  detail: null,
  detailError: "",
  payment: null,
  paymentError: "",
});

/**
 * @param {string} orderId  đơn cần xem; rỗng = không nạp gì
 * @param {{ enabled?: boolean, withPayments?: boolean }} [options]
 *   - enabled: false khi hộp xác nhận đang đóng (khỏi gọi API thừa)
 *   - withPayments: false ở màn không cần phần tiền
 */
export default function useOrderReview(orderId, { enabled = true, withPayments = true } = {}) {
  const [result, setResult] = useState(EMPTY);

  const id = String(orderId ?? "").trim();
  const active = Boolean(enabled && id);
  const requestKey = active ? `${id}|${withPayments ? "p" : "-"}` : "";

  useEffect(() => {
    if (!requestKey) return undefined;

    let cancelled = false;

    Promise.allSettled([
      getConsignmentDetailApi(id),
      withPayments ? getOrderPaymentHistoryApi(id) : Promise.resolve(null),
    ]).then(([detailResult, paymentResult]) => {
      if (cancelled) return;

      setResult({
        key: requestKey,
        detail: detailResult.status === "fulfilled" ? detailResult.value : null,
        detailError:
          detailResult.status === "rejected"
            ? readError(detailResult.reason, "Không đọc được chi tiết đơn.")
            : "",
        payment: paymentResult.status === "fulfilled" ? paymentResult.value : null,
        paymentError:
          paymentResult.status === "rejected"
            ? readError(paymentResult.reason, "Không đọc được các khoản thanh toán của đơn.")
            : "",
      });
    });

    return () => {
      cancelled = true;
      /* Đóng hộp (hoặc đổi đơn) thì xoá kết quả: mở lại lần sau phải nạp mới và khoá nút
         gửi trong lúc nạp, không được hiện số cũ như thể đã cập nhật. */
      setResult(EMPTY);
    };
  }, [requestKey, id, withPayments]);

  if (!active) return { ...EMPTY, loading: false };

  /* Kết quả đang giữ là của đơn khác (hoặc chưa có) → coi như đang tải. */
  if (result.key !== requestKey) return { ...EMPTY, loading: true };

  return { ...result, loading: false };
}
