/* =========================================================
   tablePagination.js — cấu hình phân trang DÙNG CHUNG cho mọi bảng/danh sách của nhân viên.

   Quy ước (Sale / OM / Admin):
     - cỡ trang 10 / 20 / 50 / 100 (mặc định 20 cho danh sách chính, 10 cho bảng phụ);
     - luôn hiện chọn cỡ trang + câu "Hiển thị x–y / N <đơn vị>";
     - nhãn tiếng Việt ("20 / trang", "Đến trang") đến từ ConfigProvider vi_VN ở AppProviders.

   Thuần logic — dùng được cho antd <Table pagination={...}> lẫn <Pagination {...}>.

   Phân trang PHÍA CLIENT (API trả cả mảng):
     <Table pagination={tablePagination({ unit: "phiếu" })} />
       → antd tự giữ trang + cỡ trang.
   Phân trang PHÍA SERVER (API nhận pageNumber/pageSize, trả totalCount):
     <Table pagination={tablePagination({ unit: "lô", current: page, pageSize, total,
                                          onChange: (p, s) => ... })} />
   ========================================================= */

export const TABLE_PAGE_SIZE_OPTIONS = Object.freeze([10, 20, 50, 100]);

export const DEFAULT_TABLE_PAGE_SIZE = 20;

/** "Hiển thị 21–40 / 57 phiếu" — cùng một câu cho mọi bảng. */
export const formatTableRange = (total, [from, to] = [0, 0], unit = "") => {
  const count = Math.max(0, Number(total) || 0);
  const range = count === 0 ? "0" : `${from}–${to}`;

  return `Hiển thị ${range} / ${count}${unit ? ` ${unit}` : ""}`;
};

/**
 * @param {{ unit?: string, defaultPageSize?: number, hideOnSinglePage?: boolean,
 *           size?: "small" | "default", current?: number, pageSize?: number,
 *           total?: number, onChange?: (page: number, pageSize: number) => void,
 *           disabled?: boolean }} [options]
 *   current/pageSize/total/onChange chỉ truyền khi phân trang phía server (bảng có kiểm soát).
 */
export const tablePagination = ({
  unit = "",
  defaultPageSize = DEFAULT_TABLE_PAGE_SIZE,
  hideOnSinglePage = false,
  size,
  ...controlled
} = {}) => {
  const config = {
    defaultPageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS.map(String),
    showSizeChanger: true,
    hideOnSinglePage,
    showTotal: (total, range) => formatTableRange(total, range, unit),
  };

  if (size) config.size = size;

  /* Chỉ gắn khoá có giá trị: gắn `current: undefined` biến bảng không kiểm soát thành có
     kiểm soát và kẹt ở trang 1. */
  Object.entries(controlled).forEach(([key, value]) => {
    if (value !== undefined) config[key] = value;
  });

  return config;
};

/** Bảng phụ trong Drawer/Modal (kiện của một lô, đơn của một chuyến...): 10 dòng, ẩn khi ≤ 1 trang. */
export const subTablePagination = (unit = "") =>
  tablePagination({ unit, defaultPageSize: 10, hideOnSinglePage: true, size: "small" });
