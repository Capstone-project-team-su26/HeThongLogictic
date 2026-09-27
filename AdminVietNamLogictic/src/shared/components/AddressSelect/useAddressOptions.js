/* =========================================================
   useAddressOptions — nạp danh mục tỉnh → quận/huyện → phường/xã (GoShip thật)
   cho MỌI màn chọn địa chỉ của web nội bộ (hồ sơ khách, hồ sơ cá nhân, Sale tạo đơn hộ
   khách ký gửi / mua hộ, yêu cầu xuất kho, giao hàng).

   - Tỉnh nạp một lần (addressApi cache cả phiên); huyện/xã nạp theo mã cha đang chọn.
   - Đổi mã cha thì danh sách con tự về rỗng (không cần màn hình tự dọn).
   - Lỗi/timeout: trả `error` là câu tiếng Việt + `retry()` để hiện nút "Thử lại";
     KHÔNG rơi về danh sách giả.
   ========================================================= */

import { useCallback, useEffect, useState } from "react";

import {
  getDistrictsByProvinceCode,
  getProvinces,
  getWardsByDistrictCode,
} from "@shared/api/vietnamAddressService";
import { isCanceledRequest as isCancel } from "@shared/api/httpClient";

/** Câu báo lỗi hiển thị dưới ô chọn. */
export const getAddressLoadErrorMessage = (error, label) => {
  if (error?.code === "NO_ACCESS_TOKEN") {
    return error.message;
  }

  if (error?.code === "ECONNABORTED" || /timeout/i.test(String(error?.message ?? ""))) {
    return `Tải danh sách ${label} quá lâu. Vui lòng bấm "Thử lại".`;
  }

  if (!error?.response) {
    return `Không kết nối được máy chủ để tải danh sách ${label}. Kiểm tra mạng rồi bấm "Thử lại".`;
  }

  return `Không tải được danh sách ${label} từ đơn vị vận chuyển. Vui lòng bấm "Thử lại".`;
};

const loadProvinces = (_parent, options) => getProvinces(options);

const useOptionList = (parentKey, loader, label) => {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ requestKey: "", options: [], error: "" });

  const parent = parentKey === undefined || parentKey === null ? "" : String(parentKey);
  const requestKey = parent ? `${parent}#${attempt}` : "";

  useEffect(() => {
    if (!requestKey) return undefined;

    const controller = new AbortController();

    loader(parent, { signal: controller.signal }).then(
      (options) => {
        setState({ requestKey, options: Array.isArray(options) ? options : [], error: "" });
      },
      (error) => {
        if (isCancel(error)) return;

        setState({ requestKey, options: [], error: getAddressLoadErrorMessage(error, label) });
      },
    );

    return () => controller.abort();
  }, [requestKey, parent, loader, label]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const settled = Boolean(requestKey) && state.requestKey === requestKey;

  return {
    options: settled ? state.options : [],
    loading: Boolean(requestKey) && !settled,
    error: settled ? state.error : "",
    retry,
  };
};

/**
 * @param {{ provinceCode?: string, districtCode?: string, enabled?: boolean }} params
 * @returns {{ provinces: AddressList, districts: AddressList, wards: AddressList }}
 *
 * @typedef {{ options: Array<{ value: string, label: string, name: string, code: string }>,
 *             loading: boolean, error: string, retry: () => void }} AddressList
 */
export default function useAddressOptions({
  provinceCode = "",
  districtCode = "",
  enabled = true,
} = {}) {
  const provinces = useOptionList(enabled ? "all" : "", loadProvinces, "tỉnh/thành phố");

  const districts = useOptionList(
    enabled ? provinceCode : "",
    getDistrictsByProvinceCode,
    "quận/huyện",
  );

  const wards = useOptionList(
    enabled && provinceCode ? districtCode : "",
    getWardsByDistrictCode,
    "phường/xã",
  );

  return { provinces, districts, wards };
}
