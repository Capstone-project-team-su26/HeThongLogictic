/*
 * Hàm thuần của mục "Giới hạn tạo đơn" (trang Tham số vận hành): hiển thị, đọc số Admin
 * gõ và kiểm cùng luật với backend (VCL_BLL/Helpers/OrderLimitSettings.Validate).
 */

/** Hiển thị một giới hạn: "5 kg", "10.000.000 đ", hoặc "Không giới hạn". */
export const formatOrderLimit = (value, unit) => {
  if (value === null || value === undefined || value === "") return "Không giới hạn";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Không giới hạn";
  return `${number.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit}`.trim();
};

/** "1.500.000" / "2,5" / "2.5" → số; rỗng → "". Không đoán bừa: chuỗi lạ trả NaN. */
export const parseDraftNumber = (text) => {
  const raw = String(text ?? "").trim().replace(/\s/g, "");
  if (raw === "") return "";
  /* Dấu chấm ngăn nghìn kiểu Việt (1.500.000) → bỏ; dấu phẩy thập phân → chấm. */
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".");
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
};

/** Kiểm giá trị Admin gõ — cùng luật với backend (OrderLimitSettings.Validate). */
export const validateOrderLimitDraft = (item, draft) => {
  if (draft.unlimited) {
    return item.allowUnlimited ? "" : "Giới hạn này bắt buộc phải có giá trị.";
  }

  const value = parseDraftNumber(draft.text);
  if (value === "") return "Vui lòng nhập giá trị (hoặc chọn Không giới hạn).";
  if (!Number.isFinite(value)) return "Giá trị phải là số.";
  if (value <= 0) return "Giá trị phải lớn hơn 0.";
  if (item.isInteger && !Number.isInteger(value)) return "Giá trị phải là số nguyên.";
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return "Tối đa 2 chữ số thập phân.";
  if (item.minValue && value < item.minValue) {
    return `Tối thiểu ${formatOrderLimit(item.minValue, item.unit)}.`;
  }
  if (item.maxValue && value > item.maxValue) {
    return `Tối đa ${formatOrderLimit(item.maxValue, item.unit)}.`;
  }
  return "";
};

export const draftFromItem = (item) => ({
  text: item.value === null ? "" : String(item.value).replace(".", ","),
  unlimited: item.value === null,
});

export const draftValue = (draft) => (draft.unlimited ? null : parseDraftNumber(draft.text));
