/* Định dạng số / màu series dùng chung cho các bảng tổng quan (không tính số liệu). */

/** Màu series theo thứ tự cố định (bảng màu phân loại đã kiểm thử mù màu, 4 ô đầu). */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

const numberFormatter = new Intl.NumberFormat("vi-VN");

export const formatCount = (value) => numberFormatter.format(Number(value) || 0);

export const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );

/** Số tiền gọn cho nhãn cột: 1,2 tỷ · 350 tr · 12 N. */
export const formatCompactVnd = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} N`;
  return numberFormatter.format(n);
};

/** "yyyy-MM-dd" → "dd/MM"; "yyyy-MM" → "MM/yyyy". */
export const formatDayLabel = (iso) => {
  const [, m, d] = String(iso).split("-");
  return m && d ? `${d}/${m}` : String(iso);
};

export const formatMonthLabel = (iso) => {
  const [y, m] = String(iso).split("-");
  return y && m ? `${m}/${y}` : String(iso);
};

