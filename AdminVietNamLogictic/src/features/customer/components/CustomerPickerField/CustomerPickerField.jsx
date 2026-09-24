/**
 * Ô CHỌN KHÁCH HÀNG cho các màn nhân viên tạo đơn hộ khách.
 *
 * Vì sao cần: "người nhận" và "khách hàng" là hai người khác nhau — khách A hoàn toàn có
 * thể gửi hàng cho người nhận B. Thiếu ô này thì đơn tạo ra không biết thuộc về ai, và
 * backend cũng từ chối vì không tra được khách.
 *
 * Tìm theo tên / mã khách / số điện thoại / email — backend lọc sẵn, màn chỉ chờ 350ms cho
 * người dùng gõ xong rồi mới gọi, và huỷ lời gọi cũ để kết quả không về lộn xộn.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, Spin, Tag, Typography } from "antd";
import { SearchOutlined, UserOutlined } from "@ant-design/icons";

import { searchCustomersApi } from "@features/customer/api/customerLookupService";

import "./CustomerPickerField.css";

const { Text } = Typography;

export default function CustomerPickerField({
  value = "",
  customer = null,
  disabled = false,
  error = "",
  onSelect,
  onClear,
}) {
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(!value);

  const controllerRef = useRef(null);

  useEffect(() => {
    const term = keyword.trim();

    if (!searching || term.length < 2) {
      setRows([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      setLoading(true);

      searchCustomersApi({ search: term, signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) setRows(Array.isArray(result) ? result : []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setRows([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [keyword, searching]);

  const selectedLine = useMemo(() => {
    if (!customer) return "";

    return [customer.phone, customer.email].filter(Boolean).join(" · ");
  }, [customer]);

  /* Đã chọn khách: hiện thẻ ghim, giấu ô tìm cho gọn màn. */
  if (value && customer && !searching) {
    return (
      <div className="customer-picker customer-picker--picked">
        <div className="customer-picker__avatar">
          <UserOutlined />
        </div>

        <div className="customer-picker__info">
          <span className="customer-picker__eyebrow">ĐANG TẠO ĐƠN CHO</span>
          <strong>{customer.fullName || customer.name || "—"}</strong>
          {selectedLine && <Text type="secondary">{selectedLine}</Text>}
          {customer.customerCode && <Tag>{customer.customerCode}</Tag>}
        </div>

        <Button size="small" disabled={disabled} onClick={() => setSearching(true)}>
          Đổi khách
        </Button>
      </div>
    );
  }

  return (
    <div className={`customer-picker${error ? " customer-picker--error" : ""}`}>
      <Input
        allowClear
        disabled={disabled}
        value={keyword}
        prefix={<SearchOutlined />}
        placeholder="Tìm khách theo tên, mã khách, số điện thoại hoặc email"
        onChange={(event) => setKeyword(event.target.value)}
      />

      {loading && (
        <div className="customer-picker__loading">
          <Spin size="small" /> <Text type="secondary">Đang tìm…</Text>
        </div>
      )}

      {!loading && keyword.trim().length >= 2 && !rows.length && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Không tìm thấy khách khớp từ khoá"
        />
      )}

      {rows.length > 0 && (
        <ul className="customer-picker__list">
          {rows.slice(0, 8).map((row) => (
            <li key={row.id || row.customerId}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelect?.(row);
                  setSearching(false);
                  setKeyword("");
                  setRows([]);
                }}
              >
                <strong>{row.fullName || row.name || "—"}</strong>
                <span>{[row.phone, row.email].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value && customer && (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSearching(false);
            setKeyword("");
          }}
        >
          Huỷ, giữ khách đang chọn
        </Button>
      )}

      {!value && onClear && null}
    </div>
  );
}
