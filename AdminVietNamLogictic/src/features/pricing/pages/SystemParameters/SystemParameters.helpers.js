/**
 * Hàm thuần của màn Tham số vận hành: định dạng, kiểm giá trị, và ghép định nghĩa với
 * bản ghi thật. Tách khỏi file trang vì chúng chỉ phụ thuộc tham số đầu vào — kiểm được
 * bằng máy, không cần dựng React.
 */

import { VALUE_KIND } from "./SystemParameters.constants";

export const toNumberOrNull = (value) => {
  const text = String(value ?? "").trim();
  if (text === "") return null;

  const parsed = Number(text.replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Hiển thị giá trị kèm đơn vị, theo đúng kiểu của tham số. */
export const formatParameterValue = (value, definition) => {
  const number = toNumberOrNull(value);
  if (number === null) return "—";

  if (definition?.kind === VALUE_KIND.MONEY) {
    return `${number.toLocaleString("vi-VN")}đ`;
  }

  if (definition?.kind === VALUE_KIND.PERCENT) {
    return `${number.toLocaleString("vi-VN")}%`;
  }

  return number.toLocaleString("vi-VN");
};

/**
 * Kiểm MỘT ô giá trị. Trả về chuỗi lỗi, rỗng nghĩa là hợp lệ.
 *
 * Dùng chung cho lúc đang gõ và lúc bấm Lưu — một nguồn luật duy nhất, giống cách các
 * form khác trong hệ thống đang làm.
 */
export const validateParameterValue = (rawValue, definition) => {
  const text = String(rawValue ?? "").trim();

  if (text === "") return "Chưa nhập giá trị.";

  const number = toNumberOrNull(text);
  if (number === null) return "Giá trị phải là số.";
  if (number < 0) return "Giá trị không được âm.";

  const min = definition?.min;
  if (Number.isFinite(min) && number < min) {
    return `Giá trị phải từ ${min.toLocaleString("vi-VN")} trở lên.`;
  }

  const max = definition?.max;
  if (Number.isFinite(max) && number > max) {
    return `Giá trị tối đa là ${max.toLocaleString("vi-VN")}${
      definition?.kind === VALUE_KIND.PERCENT ? "%" : ""
    }.`;
  }

  return "";
};

/** Kiểm ô ngưỡng điều kiện (ví dụ: bảo hiểm chỉ áp cho kiện khai giá ≥ X). */
export const validateConditionValue = (rawValue) => {
  const text = String(rawValue ?? "").trim();

  /* Để trống = bỏ ràng buộc, đó là lựa chọn hợp lệ. */
  if (text === "") return "";

  const number = toNumberOrNull(text);
  if (number === null) return "Ngưỡng phải là số.";
  if (number < 0) return "Ngưỡng không được âm.";

  return "";
};

/**
 * Ghép định nghĩa với bản ghi thật đọc từ backend.
 *
 * `record` null nghĩa là bảng chưa có dòng nào cho mã này — hệ thống đang chạy bằng giá
 * trị mặc định trong mã nguồn. Màn hình phải nói rõ điều đó, vì "5%" do ai đặt và "5%"
 * vì chưa ai đặt là hai chuyện khác nhau khi đi truy vấn về sau.
 */
export const buildParameterRow = (definition, record) => {
  const configured = Boolean(record?.id);
  const effectiveValue = configured ? record.value : definition.fallback;

  return {
    definition,
    record,
    configured,
    effectiveValue,
    /* Đã cấu hình nhưng bị tắt: hệ thống quay về dùng mặc định, dễ hiểu nhầm là vẫn áp. */
    inactive: configured && record.isActive === false,
    conditionValue: record?.conditionValue ?? "",
  };
};

/** Có gì thay đổi so với số đang lưu không — để khoá nút Lưu khi chưa sửa gì. */
export const hasParameterChanged = (row, draft) => {
  if (!draft) return false;

  const nextValue = toNumberOrNull(draft.value);
  if (nextValue === null) return false;

  if (!row.configured) return true;
  if (nextValue !== row.record.value) return true;

  if (row.definition.condition) {
    const current = String(row.conditionValue ?? "").trim();
    const next = String(draft.conditionValue ?? "").trim();
    if (current !== next) return true;
  }

  return false;
};
