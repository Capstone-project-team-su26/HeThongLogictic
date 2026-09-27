/* =========================================================
   AddressSelect — ô chọn tỉnh / quận-huyện / phường-xã dùng chung cho web nội bộ
   (chép thiết kế web khách, 27/09/2026).

   - Có ô tìm kiếm; gõ không dấu vẫn tìm được ("ba ria" → "Bà Rịa - Vũng Tàu").
   - Lỗi tải danh mục (loadError) → câu tiếng Việt + nút "Thử lại" (onRetry).
   - onChange trả về mã (chuỗi) như thẻ <select> cũ trả event.target.value; bỏ chọn → "".
   - value không nằm trong options (đang tải / mã cũ) thì hiện placeholder, không hiện mã.
   ========================================================= */

import { useMemo } from "react";
import { Button, Select } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import { normalizeAddressKeyword } from "@shared/api/vietnamAddressService";

import "./AddressSelect.css";

const filterOption = (input, option) =>
  normalizeAddressKeyword(option?.label).includes(normalizeAddressKeyword(input));

export default function AddressSelect({
  id,
  value,
  options = [],
  loading = false,
  loadError = "",
  onRetry,
  disabled = false,
  placeholder = "Chọn",
  invalid = false,
  errorClassName = "",
  ariaLabel,
  onChange,
  onBlur,
}) {
  const selectOptions = useMemo(
    () => options.map((option) => ({ value: String(option.value), label: option.label })),
    [options],
  );

  const stringValue = value === undefined || value === null ? "" : String(value);
  const selected = selectOptions.some((option) => option.value === stringValue)
    ? stringValue
    : undefined;

  return (
    <div
      className={[
        "address-select",
        invalid && "address-select--invalid",
        invalid && errorClassName,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Select
        id={id}
        size="large"
        className="address-select__control"
        value={selected}
        options={selectOptions}
        placeholder={loading ? "Đang tải dữ liệu..." : placeholder}
        loading={loading}
        disabled={disabled || loading}
        status={invalid || loadError ? "error" : undefined}
        showSearch={{ filterOption }}
        notFoundContent={
          loadError ? "Chưa tải được danh sách" : "Không tìm thấy — thử gõ tên khác"
        }
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onChange={(next) => onChange?.(next === undefined || next === null ? "" : String(next))}
        onBlur={onBlur}
      />

      {loadError ? (
        <div className="address-select__load-error" role="alert">
          <span>{loadError}</span>
          {onRetry ? (
            <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
              Thử lại
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
