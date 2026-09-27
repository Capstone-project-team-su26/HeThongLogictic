/* =========================================================
   vietnamAddressService — API THẬT: danh mục hành chính GoShip qua backend VCL
   (cùng thiết kế @shared/api/addressApi.js của web khách, 27/09/2026).

   Endpoint (cần đăng nhập, backend tự gắn GoshipSettings:Token):
   - GET /api/Goship/cities                          → { message, items: [{ id, name }] }
   - GET /api/Goship/cities/{cityId}/districts        → { message, items: [{ id, name }] }
   - GET /api/Goship/districts/{districtId}/wards     → { message, items: [{ id, name }] }
   (GoshipController.GetCities / GetDistricts / GetWards; lỗi GoShip → 500 { message }.)

   VÌ SAO PHẢI LÀ DANH MỤC GOSHIP: backend KHÔNG lưu mã tỉnh/huyện/xã — sổ địa chỉ, hồ sơ
   khách, đơn chỉ lưu CHUỖI "chi tiết, phường/xã, quận/huyện, tỉnh/thành"; yêu cầu giao lưu 3
   TÊN. Lúc tạo vận đơn GoshipService.ResolveAddressCodesAsync dò lại mã GoShip bằng cách so
   TÊN (bỏ dấu, bỏ tiền tố "Tỉnh/Quận/Phường..."). Vì vậy FE ghép địa chỉ bằng ĐÚNG TÊN GoShip
   trả về. Mã (id GoShip) chỉ dùng trong FE để nạp cấp con.

   Cache: tỉnh/thành cache cả phiên (bộ nhớ + sessionStorage); quận/huyện, phường/xã cache
   theo mã cha. Lỗi KHÔNG cache và KHÔNG rơi về danh sách giả — ném lỗi để màn hình hiện câu
   báo + nút "Thử lại". Bản mock cũ (≈8 tỉnh mẫu) nằm ở vietnamAddressService.mock.js.

   GIỮ HỢP ĐỒNG CŨ của admin-ui: getVietnamProvincesApi / getVietnamDistrictsApi /
   getVietnamWardsApi / getProvinces / getDistrictsByProvinceCode / getWardsByDistrictCode trả
   MẢNG option có đủ { code, name, value, label }; composeVietnamAddress ĐỒNG BỘ;
   getFullAddressByCodes trả { province, district, ward (null nếu không tra được), fullAddress, ... }.
   ========================================================= */

import httpClient from "@shared/api/httpClient";

/** Có token đăng nhập chưa (không gọi API khi chưa có — 401 rỗng sẽ đăng xuất). */
const hasAccessToken = () => {
  try {
    return Boolean(globalThis.sessionStorage?.getItem("accessToken"));
  } catch {
    return false;
  }
};


/** Dropdown nằm trong form: đợi tối đa 15 giây rồi báo lỗi + cho thử lại. */
export const ADDRESS_REQUEST_TIMEOUT_MS = 15_000;

const CITIES_PATH = "/api/Goship/cities";
const districtsPath = (cityId) =>
  `/api/Goship/cities/${encodeURIComponent(cityId)}/districts`;
const wardsPath = (districtId) =>
  `/api/Goship/districts/${encodeURIComponent(districtId)}/wards`;

const PROVINCE_STORAGE_KEY = "vcl.goship.cities.v1";

/* =========================================================
   CHUẨN HOÁ TÊN — bỏ dấu, dùng cho ô tìm kiếm và so khớp địa chỉ cũ
   ========================================================= */

/**
 * Bỏ dấu + lowercase + gộp khoảng trắng để tìm được khi gõ không dấu.
 * Cờ "i" ở /đ/gi là bắt buộc: "Đ" hoa không tách dấu được bằng NFD.
 */
export const normalizeAddressKeyword = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const ADMIN_PREFIXES = [
  "thanh pho ",
  "tinh ",
  "tp ",
  "quan ",
  "huyen ",
  "thi xa ",
  "thi tran ",
  "phuong ",
  "xa ",
  "q ",
  "p ",
];

/**
 * Bản sao GoshipService.NormalizeLocationName (backend): bỏ dấu, "." và "," thành
 * khoảng trắng, cắt MỘT tiền tố hành chính ở đầu. "TP. Hồ Chí Minh" ≡ "Hồ Chí Minh".
 */
const normalizeLocationName = (value) => {
  const cleaned = normalizeAddressKeyword(String(value ?? "").replace(/[.,]/g, " "));

  const prefix = ADMIN_PREFIXES.find((item) => cleaned.startsWith(item));

  return (prefix ? cleaned.slice(prefix.length) : cleaned).trim();
};

/**
 * Tên đưa vào chuỗi địa chỉ. Dấu phẩy là ký tự tách 4 phần của chuỗi địa chỉ đã lưu
 * (OrderDeliveryCard.splitAddress), nên không được lọt vào tên; backend cũng coi ","
 * như khoảng trắng khi so tên nên thay bằng khoảng trắng vẫn khớp tuyệt đối.
 */
const toAddressName = (value) =>
  String(value ?? "")
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Tìm mục khớp TÊN trong danh sách đã normalize (tên cũ đã lưu → mã GoShip).
 * Khớp tuyệt đối trước; "chứa nhau" chỉ tính theo NGUYÊN TỪ và chỉ nhận khi có DUY
 * NHẤT một ứng viên, để "Quận 1" không bị gán nhầm thành "Quận 10".
 */
export const findAddressOptionByName = (options, name) => {
  const needle = normalizeLocationName(name);

  if (!needle || !Array.isArray(options)) return null;

  const exact = options.find(
    (option) => normalizeLocationName(option?.name ?? option?.label) === needle,
  );

  if (exact) return exact;

  const partial = options.filter((option) => {
    const candidate = normalizeLocationName(option?.name ?? option?.label);

    return (
      candidate &&
      (` ${candidate} `.includes(` ${needle} `) || ` ${needle} `.includes(` ${candidate} `))
    );
  });

  return partial.length === 1 ? partial[0] : null;
};

/* =========================================================
   NORMALIZE OPTION — cùng hình dạng bản mock
   ========================================================= */

export const normalizeAddressOption = (item) => {
  if (!item) return null;

  const code = item.code ?? item.id ?? item.value;
  const name = toAddressName(item.name ?? item.label ?? item.full_name ?? "");

  if (code === undefined || code === null || String(code).trim() === "" || !name) {
    return null;
  }

  return {
    value: String(code),
    code: String(code),
    label: name,
    name,
    codename: item.codename,
    divisionType: item.division_type,
    phoneCode: item.phone_code,
    provinceCode: item.province_code,
    districtCode: item.district_code,
    raw: item,
  };
};

export const normalizeAddressOptions = (items = []) => {
  if (!Array.isArray(items)) return [];

  const seen = new Set();

  return items.map(normalizeAddressOption).filter((option) => {
    if (!option || seen.has(option.value)) return false;

    seen.add(option.value);
    return true;
  });
};

/* =========================================================
   HTTP + CACHE
   ========================================================= */

const createCanceledError = () => {
  const error = new Error("canceled");

  error.name = "CanceledError";
  error.code = "ERR_CANCELED";
  error.__CANCEL__ = true;

  return error;
};

/** Gắn signal của từng người gọi vào promise dùng chung (request không bị huỷ theo). */
const withSignal = (promise, signal) => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createCanceledError());

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(createCanceledError());

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
};

const getSignal = (options = {}) =>
  typeof options?.addEventListener === "function" ? options : options?.signal;

/** { message, items } là dạng chuẩn; chấp nhận thêm data / mảng trần cho chắc. */
const pickItems = (body) => {
  const candidates = [body?.items, body?.data?.items, body?.data, body];

  return candidates.find(Array.isArray) || [];
};

const readStoredProvinces = () => {
  try {
    const raw = globalThis.sessionStorage?.getItem(PROVINCE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const storeProvinces = (items) => {
  try {
    globalThis.sessionStorage?.setItem(PROVINCE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Storage bị chặn: vẫn còn cache bộ nhớ. */
  }
};

/** key → { value } khi đã có dữ liệu, hoặc { promise } khi đang tải. */
const cache = new Map();

/** Chỉ mục mã → option để getXxxByCode / getFullAddressByCodes tra được tên. */
const provinceIndex = new Map();
const districtIndex = new Map();
const wardIndex = new Map();

const indexOptions = (index, options) => {
  options.forEach((option) => index.set(option.value, option));
};

const fetchItems = async (path) => {
  if (!hasAccessToken()) {
    const error = new Error("Vui lòng đăng nhập để tải danh mục địa chỉ.");

    error.code = "NO_ACCESS_TOKEN";
    throw error;
  }

  const response = await httpClient.get(path, {
    timeout: ADDRESS_REQUEST_TIMEOUT_MS,
  });

  return pickItems(response?.data);
};

/**
 * Tải một danh mục, dùng chung request đang bay; chỉ cache khi thành công và CÓ dữ liệu
 * (cache mảng rỗng sẽ khoá dropdown cả phiên).
 */
const loadList = (key, path, annotate, index, options = {}) => {
  const signal = getSignal(options);
  const hit = cache.get(key);

  if (hit?.value) return withSignal(Promise.resolve(hit.value), signal);
  if (hit?.promise) return withSignal(hit.promise, signal);

  const promise = fetchItems(path)
    .then((items) => {
      const normalized = normalizeAddressOptions(items.map(annotate));

      if (normalized.length > 0) {
        cache.set(key, { value: normalized });
        indexOptions(index, normalized);
      } else {
        cache.delete(key);
      }

      return normalized;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise });

  return withSignal(promise, signal);
};

const cloneOptions = (options) => options.map((option) => ({ ...option }));

/* =========================================================
   PROVINCES — TỈNH / THÀNH PHỐ
   ========================================================= */

export const getProvinces = async (options = {}) => {
  if (!cache.has("provinces")) {
    const stored = normalizeAddressOptions(readStoredProvinces() || []);

    if (stored.length > 0) {
      cache.set("provinces", { value: stored });
      indexOptions(provinceIndex, stored);
    }
  }

  const list = await loadList(
    "provinces",
    CITIES_PATH,
    (item) => ({ ...item }),
    provinceIndex,
    options,
  );

  if (list.length > 0 && !readStoredProvinces()) {
    storeProvinces(list.map((option) => option.raw));
  }

  return cloneOptions(list);
};

const toRaw = (option) =>
  option
    ? {
        ...option.raw,
        id: option.value,
        code: option.value,
        name: option.name,
        value: option.value,
        label: option.name,
      }
    : null;

export const getProvinceByCode = async (provinceCode, options = {}) => {
  if (!provinceCode) return null;

  const { depth = 1, ...requestOptions } = options;
  const key = String(provinceCode);

  if (!provinceIndex.has(key)) {
    await getProvinces(requestOptions);
  }

  const province = toRaw(provinceIndex.get(key));

  if (!province || Number(depth) < 2) return province;

  const districts = await getDistrictsByProvinceCode(key, requestOptions);

  return { ...province, districts: districts.map(toRaw) };
};

export const searchProvinces = async (keyword, options = {}) => {
  const needle = normalizeAddressKeyword(keyword);

  if (!needle) return [];

  const provinces = await getProvinces(options);

  return provinces.filter((option) =>
    normalizeAddressKeyword(option.name).includes(needle),
  );
};

/* =========================================================
   DISTRICTS — QUẬN / HUYỆN
   ========================================================= */

export const getDistrictsByProvinceCode = async (provinceCode, options = {}) => {
  if (!provinceCode) return [];

  const key = String(provinceCode);

  const list = await loadList(
    `districts:${key}`,
    districtsPath(key),
    (item) => ({ ...item, province_code: key }),
    districtIndex,
    options,
  );

  return cloneOptions(list);
};

export const getDistrictByCode = async (districtCode, options = {}) => {
  if (!districtCode) return null;

  const { depth = 1, provinceCode, ...requestOptions } = options;
  const key = String(districtCode);

  /* GoShip không có API tra một quận theo mã: nạp danh sách của tỉnh cha nếu biết. */
  if (!districtIndex.has(key) && provinceCode) {
    await getDistrictsByProvinceCode(provinceCode, requestOptions);
  }

  const district = toRaw(districtIndex.get(key));

  if (!district || Number(depth) < 2) return district;

  const wards = await getWardsByDistrictCode(key, requestOptions);

  return { ...district, wards: wards.map(toRaw) };
};

/** Tìm trong quận/huyện của options.provinceCode, hoặc mọi danh sách đã tải trong phiên. */
export const searchDistricts = async (keyword, options = {}) => {
  const needle = normalizeAddressKeyword(keyword);

  if (!needle) return [];

  const { provinceCode, ...requestOptions } = options;

  const pool = provinceCode
    ? await getDistrictsByProvinceCode(provinceCode, requestOptions)
    : Array.from(districtIndex.values());

  return cloneOptions(
    pool.filter((option) => normalizeAddressKeyword(option.name).includes(needle)),
  );
};

/* =========================================================
   WARDS — PHƯỜNG / XÃ
   ========================================================= */

export const getWardsByDistrictCode = async (districtCode, options = {}) => {
  if (!districtCode) return [];

  const key = String(districtCode);

  const list = await loadList(
    `wards:${key}`,
    wardsPath(key),
    (item) => ({ ...item, district_code: key }),
    wardIndex,
    options,
  );

  return cloneOptions(list);
};

export const getWardByCode = async (wardCode, options = {}) => {
  if (!wardCode) return null;

  const { districtCode, ...requestOptions } = options;
  const key = String(wardCode);

  if (!wardIndex.has(key) && districtCode) {
    await getWardsByDistrictCode(districtCode, requestOptions);
  }

  return toRaw(wardIndex.get(key));
};

/** Tìm trong phường/xã của options.districtCode, hoặc mọi danh sách đã tải trong phiên. */
export const searchWards = async (keyword, options = {}) => {
  const needle = normalizeAddressKeyword(keyword);

  if (!needle) return [];

  const { districtCode, ...requestOptions } = options;

  const pool = districtCode
    ? await getWardsByDistrictCode(districtCode, requestOptions)
    : Array.from(wardIndex.values());

  return cloneOptions(
    pool.filter((option) => normalizeAddressKeyword(option.name).includes(needle)),
  );
};

/* =========================================================
   FULL ADDRESS HELPER

   ConsignmentOrder / ConsignmentBuyOrder gọi lúc bấm "Lưu địa chỉ" và đọc
   province?.name, district?.name, ward?.name, fullAddress. Chuỗi ghép theo thứ tự
   "chi tiết, phường/xã, quận/huyện, tỉnh/thành" bằng TÊN GoShip.
   ========================================================= */

export const getFullAddressByCodes = async (
  { provinceCode, districtCode, wardCode, detailAddress = "" } = {},
  options = {},
) => {
  const [province, district, ward] = await Promise.all([
    provinceCode ? getProvinceByCode(provinceCode, options) : null,
    districtCode ? getDistrictByCode(districtCode, { ...options, provinceCode }) : null,
    wardCode ? getWardByCode(wardCode, { ...options, districtCode }) : null,
  ]);

  const cleanDetailAddress = String(detailAddress ?? "").trim();

  const parts = [cleanDetailAddress, ward?.name, district?.name, province?.name].filter(
    Boolean,
  );

  return {
    province,
    district,
    ward,

    provinceCode: province?.code ?? provinceCode ?? "",
    provinceName: province?.name ?? "",

    districtCode: district?.code ?? districtCode ?? "",
    districtName: district?.name ?? "",

    wardCode: ward?.code ?? wardCode ?? "",
    wardName: ward?.name ?? "",

    detailAddress: cleanDetailAddress,
    fullAddress: parts.join(", "),
  };
};

/**
 * Dò mã GoShip từ TÊN đã lưu (địa chỉ cũ, có thể nhập từ danh sách giả trước đây).
 * Khớp tới đâu trả tới đó; `matched` = true chỉ khi khớp đủ cả tỉnh, huyện, xã.
 * Lỗi mạng ném ra ngoài (trừ khi không có tên nào để dò).
 */
export const resolveAddressByNames = async (
  { province, district, ward } = {},
  options = {},
) => {
  const result = {
    provinceCode: "",
    provinceName: "",
    districtCode: "",
    districtName: "",
    wardCode: "",
    wardName: "",
    matched: false,
  };

  if (!String(province ?? "").trim()) return result;

  const provinceOption = findAddressOptionByName(await getProvinces(options), province);

  if (!provinceOption) return result;

  result.provinceCode = provinceOption.value;
  result.provinceName = provinceOption.name;

  if (!String(district ?? "").trim()) return result;

  const districtOption = findAddressOptionByName(
    await getDistrictsByProvinceCode(provinceOption.value, options),
    district,
  );

  if (!districtOption) return result;

  result.districtCode = districtOption.value;
  result.districtName = districtOption.name;

  if (!String(ward ?? "").trim()) return result;

  const wardOption = findAddressOptionByName(
    await getWardsByDistrictCode(districtOption.value, options),
    ward,
  );

  if (!wardOption) return result;

  result.wardCode = wardOption.value;
  result.wardName = wardOption.name;
  result.matched = true;

  return result;
};

/* =========================================================
   TÁCH / GHÉP CHUỖI ĐỊA CHỈ ĐÃ LƯU
   ========================================================= */

/**
 * Tách chuỗi "chi tiết, phường/xã, quận/huyện, tỉnh/thành" (thứ tự FE luôn ghép). Ít hơn 4
 * phần thì coi cả chuỗi là phần chi tiết (không đoán tỉnh/huyện/xã).
 */
export const splitVietnamAddress = (address) => {
  const parts = String(address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 4) {
    return { addressDetail: parts.join(", "), ward: "", district: "", province: "" };
  }

  const province = parts.pop();
  const district = parts.pop();
  const ward = parts.pop();

  return { addressDetail: parts.join(", "), ward, district, province };
};

/**
 * Ghép địa chỉ đầy đủ "số nhà, phường/xã, quận/huyện, tỉnh/thành" — ĐỒNG BỘ (component gọi
 * trong useMemo). Dấu phẩy trong phần chi tiết được giữ; tên cấp hành chính đã bỏ dấu phẩy.
 */
export const composeVietnamAddress = ({
  street = "",
  ward = "",
  district = "",
  province = "",
} = {}) =>
  [street, ward, district, province]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");

/**
 * Lỗi chọn địa chỉ để màn cha CHẶN LƯU (meta do VietnamAddressSelector gửi kèm onAddressChange).
 * Chưa sửa / xoá trắng → hợp lệ (giữ địa chỉ cũ / bỏ trống); đã nhập mà chưa đủ 3 cấp → lỗi.
 */
export const getAddressSelectionError = (meta) => {
  if (!meta?.touched || meta?.empty || meta?.complete) return "";

  return "Vui lòng chọn đủ Tỉnh/Thành phố, Quận/Huyện và Phường/Xã (hoặc xoá trắng địa chỉ).";
};

/**
 * Địa chỉ giao (tên tách rời) đã chọn đủ 3 cấp TỪ DANH MỤC GoShip chưa — có cả mã lẫn tên.
 * Dùng cho DeliveryAddressPicker: tên gõ tay / tên cũ chưa dò được mã thì chưa đủ.
 */
export const isDeliveryAddressComplete = (value = {}) =>
  ["provinceCode", "districtCode", "wardCode", "province", "district", "ward"].every((key) =>
    Boolean(String(value?.[key] ?? "").trim()),
  );

/* Tên cũ của admin-ui — cùng hàm với getProvinces / getDistrictsByProvinceCode / ... */
export const getVietnamProvincesApi = (options) => getProvinces(options);

export const getVietnamDistrictsApi = (provinceCode, options) =>
  getDistrictsByProvinceCode(provinceCode, options);

export const getVietnamWardsApi = (districtCode, options) =>
  getWardsByDistrictCode(districtCode, options);

export const clearAddressCache = () => {
  cache.clear();
  provinceIndex.clear();
  districtIndex.clear();
  wardIndex.clear();

  try {
    globalThis.sessionStorage?.removeItem(PROVINCE_STORAGE_KEY);
  } catch {
    /* Như trên. */
  }
};

const vietnamAddressService = {
  getVietnamProvincesApi,
  getVietnamDistrictsApi,
  getVietnamWardsApi,
  composeVietnamAddress,
  splitVietnamAddress,
  getAddressSelectionError,
  isDeliveryAddressComplete,

  getProvinces,
  getProvinceByCode,
  searchProvinces,

  getDistrictsByProvinceCode,
  getDistrictByCode,
  searchDistricts,

  getWardsByDistrictCode,
  getWardByCode,
  searchWards,

  getFullAddressByCodes,
  resolveAddressByNames,
  findAddressOptionByName,
  normalizeAddressKeyword,
  clearAddressCache,
};

export default vietnamAddressService;
