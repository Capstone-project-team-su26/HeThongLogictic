/* =========================================================
   VietnamAddressSelector — số nhà + Tỉnh/Quận/Phường (danh mục GoShip THẬT) → MỘT chuỗi
   "chi tiết, phường/xã, quận/huyện, tỉnh/thành" cho hồ sơ khách (Sale) và hồ sơ cá nhân.

   - Ba ô chọn là AddressSelect (tìm không dấu; lỗi/timeout → câu tiếng Việt + "Thử lại",
     không rơi về danh sách giả).
   - Địa chỉ đã lưu được tách theo dấu phẩy rồi dò mã GoShip bằng TÊN (resolveAddressByNames).
     Không khớp đủ → giữ phần đã khớp + cảnh báo kèm nguyên chuỗi đã lưu.
   - onAddressChange(address, meta) chỉ bắn khi người dùng ĐÃ SỬA. meta = { touched, empty,
     complete, provinceName, districtName, wardName, street }. Màn cha dùng
     getAddressSelectionError(meta) để CHẶN LƯU khi mới chọn dở (chưa đủ 3 cấp).
   ========================================================= */

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Input } from "antd";
import { EnvironmentOutlined, HomeOutlined } from "@ant-design/icons";

import {
  composeVietnamAddress,
  resolveAddressByNames,
  splitVietnamAddress,
} from "@shared/api/vietnamAddressService";
import { isCanceledRequest } from "@shared/api/httpClient";
import AddressSelect from "@shared/components/AddressSelect/AddressSelect";
import useAddressOptions from "@shared/components/AddressSelect/useAddressOptions";

import "./VietnamAddressSelector.css";

const findName = (list, code) =>
  list.options.find((option) => option.value === String(code ?? ""))?.name || "";

export default function VietnamAddressSelector({
  initialAddress = "",
  onAddressChange,
  disabled = false,
}) {
  const savedText = String(initialAddress ?? "").trim();
  const savedParts = useMemo(() => splitVietnamAddress(savedText), [savedText]);

  const [street, setStreet] = useState(savedParts.addressDetail);
  const [codes, setCodes] = useState({ provinceCode: "", districtCode: "", wardCode: "" });
  const [touched, setTouched] = useState(false);
  /* { status: "resolving" | "unmatched" | "error" } — null khi khớp đủ hoặc không có địa chỉ cũ. */
  const [savedState, setSavedState] = useState(() =>
    !savedText
      ? null
      : savedParts.province
        ? { status: "resolving" }
        : { status: "unmatched" }
  );
  const resolveSeq = useRef(0);

  const lists = useAddressOptions({
    provinceCode: codes.provinceCode,
    districtCode: codes.districtCode,
    enabled: true,
  });

  /* Dò địa chỉ đã lưu một lần khi mở (màn cha đổi key khi đổi bản ghi). */
  useEffect(() => {
    if (!savedParts.province) return undefined;

    const seq = ++resolveSeq.current;
    const controller = new AbortController();

    resolveAddressByNames(savedParts, { signal: controller.signal }).then(
      (resolved) => {
        if (seq !== resolveSeq.current) return;
        setCodes({
          provinceCode: resolved.provinceCode,
          districtCode: resolved.districtCode,
          wardCode: resolved.wardCode,
        });
        setSavedState(resolved.matched ? null : { status: "unmatched" });
      },
      (error) => {
        if (seq !== resolveSeq.current || isCanceledRequest(error)) return;
        setSavedState({ status: "error" });
      }
    );

    return () => controller.abort();
  }, [savedParts]);

  const names = {
    provinceName: findName(lists.provinces, codes.provinceCode),
    districtName: findName(lists.districts, codes.districtCode),
    wardName: findName(lists.wards, codes.wardCode),
  };

  const preview = composeVietnamAddress({
    street,
    ward: names.wardName,
    district: names.districtName,
    province: names.provinceName,
  });

  const emit = (nextStreet, nextCodes, nextNames) => {
    const complete = Boolean(
      nextNames.provinceName && nextNames.districtName && nextNames.wardName
    );
    const empty =
      !String(nextStreet ?? "").trim() &&
      !nextCodes.provinceCode &&
      !nextCodes.districtCode &&
      !nextCodes.wardCode;

    onAddressChange?.(
      composeVietnamAddress({
        street: nextStreet,
        ward: nextNames.wardName,
        district: nextNames.districtName,
        province: nextNames.provinceName,
      }),
      { touched: true, empty, complete, street: String(nextStreet ?? "").trim(), ...nextNames }
    );
  };

  /* Người dùng tự chọn: huỷ lượt dò địa chỉ cũ còn đang chạy. */
  const selectLevel = (patch) => {
    resolveSeq.current += 1;
    setSavedState((current) =>
      current?.status === "resolving" ? { status: "unmatched" } : current
    );
    setTouched(true);

    const nextCodes = { ...codes, ...patch };
    setCodes(nextCodes);

    emit(street, nextCodes, {
      provinceName: findName(lists.provinces, nextCodes.provinceCode),
      districtName: patch.provinceCode !== undefined ? "" : findName(lists.districts, nextCodes.districtCode),
      wardName:
        patch.provinceCode !== undefined || patch.districtCode !== undefined
          ? ""
          : findName(lists.wards, nextCodes.wardCode),
    });
  };

  const incomplete =
    touched && (codes.provinceCode || street.trim()) && !(names.provinceName && names.districtName && names.wardName);

  return (
    <div className="vietnam-address-selector">
      <Input
        value={street}
        prefix={<HomeOutlined />}
        placeholder="Số nhà, tên đường"
        disabled={disabled}
        maxLength={160}
        onChange={(event) => {
          const value = event.target.value;
          setStreet(value);
          setTouched(true);
          emit(value, codes, names);
        }}
      />

      {savedState && savedText ? (
        <Alert
          type={savedState.status === "resolving" ? "info" : "warning"}
          showIcon
          message={
            savedState.status === "resolving"
              ? "Đang đối chiếu địa chỉ đã lưu với danh mục của đơn vị vận chuyển..."
              : savedState.status === "error"
                ? "Chưa đối chiếu được địa chỉ đã lưu — vui lòng chọn Tỉnh/Quận/Phường bên dưới"
                : "Địa chỉ đã lưu chưa khớp đủ danh mục của đơn vị vận chuyển — vui lòng chọn lại phần còn thiếu"
          }
          description={`Địa chỉ đã lưu: ${savedText}`}
        />
      ) : null}

      <div className="vietnam-address-selector__grid">
        <AddressSelect
          value={codes.provinceCode}
          options={lists.provinces.options}
          loading={lists.provinces.loading}
          loadError={lists.provinces.error}
          onRetry={lists.provinces.retry}
          disabled={disabled}
          placeholder="Tỉnh / Thành phố"
          ariaLabel="Tỉnh / Thành phố"
          onChange={(code) =>
            selectLevel({ provinceCode: code, districtCode: "", wardCode: "" })
          }
        />
        <AddressSelect
          value={codes.districtCode}
          options={lists.districts.options}
          loading={lists.districts.loading}
          loadError={lists.districts.error}
          onRetry={lists.districts.retry}
          disabled={disabled || !codes.provinceCode}
          placeholder="Quận / Huyện"
          ariaLabel="Quận / Huyện"
          onChange={(code) => selectLevel({ districtCode: code, wardCode: "" })}
        />
        <AddressSelect
          value={codes.wardCode}
          options={lists.wards.options}
          loading={lists.wards.loading}
          loadError={lists.wards.error}
          onRetry={lists.wards.retry}
          disabled={disabled || !codes.districtCode}
          placeholder="Phường / Xã"
          ariaLabel="Phường / Xã"
          onChange={(code) => selectLevel({ wardCode: code })}
        />
      </div>

      {preview && (
        <div className="vietnam-address-selector__preview">
          <EnvironmentOutlined />
          <span>{preview}</span>
        </div>
      )}

      {incomplete ? (
        <Alert
          type="error"
          showIcon
          message="Vui lòng chọn đủ Tỉnh/Thành phố, Quận/Huyện và Phường/Xã."
        />
      ) : null}
    </div>
  );
}
