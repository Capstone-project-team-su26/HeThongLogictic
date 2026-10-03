/**
 * CHỐNG BẤM ĐÚP / TẢI CŨ ĐÈ TẢI MỚI cho các hàng chờ có nút thao tác trên từng dòng.
 *
 * Cùng khuôn với SupplierOrdersPage (createOrderActionRunner), tách ra đây để các màn hàng chờ
 * của Sale (tất toán, đơn cần xử lý, phiếu giao, lô về VN) dùng chung:
 *
 *  - createRowActionRunner: mỗi khoá (mã đơn / mã phiếu) chỉ MỘT lời gọi đang bay. Bấm lần hai khi
 *    lần một chưa xong (bấm đúp, Enter + chuột) trả ngay `{ ok: false, skipped: true }` — API không
 *    bị gọi lần hai. Không bao giờ ném: `{ ok: true, result }` hoặc `{ ok: false, error }` để hộp
 *    đang mở hiện câu lỗi và giữ nguyên.
 *  - createLoadSequencer: mỗi lần tải lấy một số thứ tự; chỉ lần tải MỚI NHẤT được ghi vào bảng.
 *    Lần tải bắt đầu trước thao tác mà về sau sẽ không đè dòng vừa cập nhật bằng dữ liệu cũ.
 */

const keyOf = (value) => String(value ?? "").trim().toLowerCase();

export const createRowActionRunner = () => {
  const inFlight = new Set();

  const run = async (rowKey, action) => {
    const key = keyOf(rowKey);

    if (inFlight.has(key)) return { ok: false, skipped: true };

    inFlight.add(key);

    try {
      const result = await action();

      return { ok: true, result: result ?? null };
    } catch (error) {
      return { ok: false, error };
    } finally {
      inFlight.delete(key);
    }
  };

  run.isBusy = (rowKey) => inFlight.has(keyOf(rowKey));

  return run;
};

export const createLoadSequencer = () => {
  let latest = 0;

  return {
    /** Bắt đầu một lần tải; trả số thứ tự của lần đó. */
    next: () => {
      latest += 1;
      return latest;
    },
    /** Lần tải `seq` còn là lần mới nhất không (false → bỏ kết quả của nó). */
    isLatest: (seq) => seq === latest,
  };
};

/** HTTP status của lỗi axios (0 nếu không có phản hồi). */
export const httpStatusOf = (error) => Number(error?.response?.status) || 0;
