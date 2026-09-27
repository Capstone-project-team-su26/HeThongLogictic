/**
 * Nạp dữ liệu cho một hộp xác nhận, theo KHOÁ của thứ đang được xác nhận.
 *
 * Mẫu lặp lại ở mọi màn duyệt: bấm "Duyệt" trên một dòng bảng → hộp mở → phải nạp chi tiết
 * phiếu để người duyệt thấy đủ → trong lúc nạp thì khoá nút gửi. Hook gói đúng việc đó, không
 * biết gì về nghiệp vụ: màn tự truyền hàm `load` gọi API thật của mình.
 *
 *   const review = useSubmitReviewData(target?.id, () => getXxxDetail(target.id));
 *   // review = { loading, data, error }
 *
 * - `key` rỗng (hộp đóng) → không gọi gì, trả { loading: false, data: null }.
 * - Đổi `key` / đóng hộp → kết quả cũ bị xoá, lời gọi đang bay bị bỏ qua. Mở lại luôn nạp
 *   mới, không hiện số cũ.
 */

import { useEffect, useRef, useState } from "react";

const readError = (reason) =>
  reason?.response?.data?.message || reason?.message || "Không tải được dữ liệu.";

const EMPTY = Object.freeze({ key: "", data: null, error: "" });

export default function useSubmitReviewData(key, load) {
  const normalizedKey = key === null || key === undefined ? "" : String(key);
  const [result, setResult] = useState(EMPTY);

  /* Giữ hàm load mới nhất mà không bắt effect chạy lại mỗi lần render (màn hay truyền arrow). */
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!normalizedKey) return undefined;

    let cancelled = false;

    Promise.resolve()
      .then(() => loadRef.current?.())
      .then(
        (data) => {
          if (!cancelled) setResult({ key: normalizedKey, data: data ?? null, error: "" });
        },
        (reason) => {
          if (!cancelled) setResult({ key: normalizedKey, data: null, error: readError(reason) });
        },
      );

    return () => {
      cancelled = true;
      setResult(EMPTY);
    };
  }, [normalizedKey]);

  if (!normalizedKey) return { loading: false, data: null, error: "" };
  if (result.key !== normalizedKey) return { loading: true, data: null, error: "" };
  return { loading: false, data: result.data, error: result.error };
}
