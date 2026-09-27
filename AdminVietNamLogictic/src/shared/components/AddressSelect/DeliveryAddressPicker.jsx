/* =========================================================
   DeliveryAddressPicker — số nhà + Tỉnh/Quận/Phường (danh mục GoShip THẬT) cho các form lưu
   TÊN tách rời (yêu cầu giao hàng: addressDetail / ward / district / province).

   value = { addressDetail, province, district, ward, provinceCode, districtCode, wardCode }.
   onChange(patch) trả cả MÃ (chỉ dùng trong FE để nạp cấp con) lẫn TÊN GoShip (thứ backend lưu
   và GoshipService.ResolveAddressCodesAsync dò lại khi tạo vận đơn).

   Tên đã lưu mà chưa có mã (mở form từ đơn cũ) → tự dò mã theo tên (resolveAddressByNames).
   Khớp tới đâu giữ tới đó, phần không khớp bị xoá tên + cảnh báo kèm chuỗi đã lưu, để màn cha
   CHẶN GỬI tới khi chọn đủ (isDeliveryAddressComplete).
   ========================================================= */

import { useEffect, useRef, useState } from "react";
import { Alert, Input, Space } from "antd";

import { resolveAddressByNames } from "@shared/api/vietnamAddressService";
import { isCanceledRequest } from "@shared/api/httpClient";

import AddressSelect from "./AddressSelect";
import useAddressOptions from "./useAddressOptions";

const findName = (list, code) =>
  list.options.find((option) => option.value === String(code ?? ""))?.name || "";

export default function DeliveryAddressPicker({ value = {}, savedText = "", onChange, disabled = false }) {
  const lists = useAddressOptions({
    provinceCode: value.provinceCode,
    districtCode: value.districtCode,
  });

  /* null | { status: "resolving" | "unmatched" | "error", text } */
  const [savedState, setSavedState] = useState(null);
  const onChangeRef = useRef(onChange);
  const resolveSeq = useRef(0);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const needsResolve =
    !value.provinceCode && Boolean(String(value.province ?? "").trim());
  const resolveInput = needsResolve
    ? `${value.province}|${value.district ?? ""}|${value.ward ?? ""}`
    : "";

  /* Dò mã GoShip cho tên đã lưu (một lần mỗi bộ tên). */
  useEffect(() => {
    if (!resolveInput) return undefined;

    const [province, district, ward] = resolveInput.split("|");
    const text = [ward, district, province].filter(Boolean).join(", ");
    const seq = ++resolveSeq.current;
    const controller = new AbortController();

    setSavedState({ status: "resolving", text });

    resolveAddressByNames({ province, district, ward }, { signal: controller.signal }).then(
      (resolved) => {
        if (seq !== resolveSeq.current) return;
        onChangeRef.current?.({
          provinceCode: resolved.provinceCode,
          province: resolved.provinceName,
          districtCode: resolved.districtCode,
          district: resolved.districtName,
          wardCode: resolved.wardCode,
          ward: resolved.wardName,
        });
        setSavedState(resolved.matched ? null : { status: "unmatched", text });
      },
      (error) => {
        if (seq !== resolveSeq.current || isCanceledRequest(error)) return;
        /* Không dò được: xoá tên cũ để buộc chọn lại từ danh mục (không gửi tên chưa kiểm). */
        onChangeRef.current?.({ province: "", district: "", ward: "" });
        setSavedState({ status: "error", text });
      }
    );

    return () => controller.abort();
  }, [resolveInput]);

  const select = (patch) => {
    resolveSeq.current += 1;
    setSavedState((current) => (current?.status === "resolving" ? { ...current, status: "unmatched" } : current));
    onChange?.(patch);
  };

  const shownSaved = savedState ? savedText || savedState.text : "";

  return (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      <Input
        addonBefore="Số nhà, đường"
        value={value.addressDetail}
        disabled={disabled}
        onChange={(event) => onChange?.({ addressDetail: event.target.value })}
      />

      {savedState ? (
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
          description={shownSaved ? `Địa chỉ đã lưu: ${shownSaved}` : undefined}
        />
      ) : null}

      <AddressSelect
        value={value.provinceCode}
        options={lists.provinces.options}
        loading={lists.provinces.loading}
        loadError={lists.provinces.error}
        onRetry={lists.provinces.retry}
        disabled={disabled}
        placeholder="Tỉnh / Thành phố"
        ariaLabel="Tỉnh / Thành phố"
        onChange={(code) =>
          select({
            provinceCode: code,
            province: findName(lists.provinces, code),
            districtCode: "",
            district: "",
            wardCode: "",
            ward: "",
          })
        }
      />
      <AddressSelect
        value={value.districtCode}
        options={lists.districts.options}
        loading={lists.districts.loading}
        loadError={lists.districts.error}
        onRetry={lists.districts.retry}
        disabled={disabled || !value.provinceCode}
        placeholder="Quận / Huyện"
        ariaLabel="Quận / Huyện"
        onChange={(code) =>
          select({
            districtCode: code,
            district: findName(lists.districts, code),
            wardCode: "",
            ward: "",
          })
        }
      />
      <AddressSelect
        value={value.wardCode}
        options={lists.wards.options}
        loading={lists.wards.loading}
        loadError={lists.wards.error}
        onRetry={lists.wards.retry}
        disabled={disabled || !value.districtCode}
        placeholder="Phường / Xã"
        ariaLabel="Phường / Xã"
        onChange={(code) => select({ wardCode: code, ward: findName(lists.wards, code) })}
      />
    </Space>
  );
}
