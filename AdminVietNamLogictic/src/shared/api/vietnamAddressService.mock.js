/**
 * MOCK danh mục hành chính Việt Nam — BẢN SAO LƯU, không màn nào import (bản thật: vietnamAddressService.js, GoShip).
 *
 * Bản thật gọi provinces.open-api.vn (một axios instance riêng, không đi qua
 * tầng HTTP dùng chung). Bản này đọc fixture trong @/mocks/data/addresses.js.
 * CẮM API THẬT TRỞ LẠI: dựng lại `addressApi` bằng axios với
 * baseURL "https://provinces.open-api.vn/api/v1", rồi trong ba hàm loader dưới đây
 * thay lời gọi list*Seeds bằng GET "/p/", GET "/p/{code}?depth=2" (lấy
 * response.data.districts) và GET "/d/{code}?depth=2" (lấy response.data.wards).
 * Mọi thứ còn lại — normalizeLocation, composeVietnamAddress, getFullAddressByCodes —
 * giữ nguyên vì chúng chỉ làm việc trên dữ liệu đã chuẩn hoá.
 *
 * HÌNH DẠNG TRẢ VỀ PHẢI GIỮ ĐÚNG:
 * ba hàm loader trả MẢNG TRẦN đã chuẩn hoá (không phải response axios, không bọc
 * { data }), vì component gán thẳng kết quả vào state rồi map ra <option>.
 *
 * Mỗi bản ghi mang ĐỦ HAI CẶP KHOÁ:
 * - code / name  -> VietnamAddressSelector map sang { value: item.code, label: item.name },
 *   và ConsignmentOrder tra tên bằng String(item.code) === String(code).
 * - value / label -> ConsignmentOrder + ConsignmentBuyOrder render trực tiếp
 *   <option value={item.value}>{item.label}</option>, và ConsignmentBuyOrder tra tên
 *   NGƯỢC LẠI bằng String(option.value) === String(value).
 * Thiếu value/label thì hai màn đặt đơn hiện dropdown rỗng tuếch mà không lỗi gì;
 * thiếu code/name thì ô địa chỉ của VietnamAddressSelector không dựng được chuỗi.
 * value luôn ĐÚNG BẰNG code để mã lấy từ <select> tra lại được trong fixture.
 */

import {
  listDistrictSeeds,
  listProvinceSeeds,
  listWardSeeds,
  toCodename,
} from "@/mocks/data/addresses";
import { delay } from "@/mocks/mockUtils";

/**
 * Chuẩn hoá một đơn vị hành chính về đúng hình dạng bản thật trả ra, cộng thêm
 * cặp value/label mà hai màn đặt đơn cần.
 */
const normalizeLocation = (item = {}) => {
  const code = String(item?.code ?? "");
  const name = String(item?.name ?? "").trim();

  return {
    code,
    name,

    codename: String(
      item?.codename ?? toCodename(name)
    ).trim(),

    divisionType: String(
      item?.division_type ?? item?.divisionType ?? ""
    ).trim(),

    /* value phải là chuỗi giống code: <select> luôn trả string, và mã đó được
       dùng lại làm tham số cho getVietnamWardsApi / getFullAddressByCodes. */
    value: code,
    label: name,
  };
};

const normalizeList = (items) =>
  (Array.isArray(items) ? items : [])
    .map(normalizeLocation)
    .filter((item) => item.code && item.name);

/**
 * Đọc options cuối danh sách tham số.
 *
 * Hai màn đặt đơn gọi getProvinces({ signal }) và
 * getDistrictsByProvinceCode(code, { signal }) — bản thật bỏ qua signal, nhưng mock
 * tôn trọng nó để lần gọi bị huỷ (đổi tỉnh, StrictMode gọi effect hai lần) reject
 * bằng CanceledError. Nhánh catch của cả hai màn đã nhận diện lỗi huỷ và bỏ qua,
 * nên không có toast đỏ giả nào bật lên.
 */
const readSignal = (options) =>
  options?.signal ?? undefined;

export const getVietnamProvincesApi = async (options) => {
  await delay(220, readSignal(options));

  return normalizeList(listProvinceSeeds());
};

export const getVietnamDistrictsApi = async (
  provinceCode,
  options
) => {
  const code = String(provinceCode ?? "").trim();

  /* Chưa chọn tỉnh thì trả mảng rỗng NGAY, không delay: bản thật cũng resolve
     tức thì, và ô Quận/Huyện đang bị disable nên không cần nhịp loading nào. */
  if (!code) return [];

  await delay(200, readSignal(options));

  return normalizeList(listDistrictSeeds(code));
};

export const getVietnamWardsApi = async (
  districtCode,
  options
) => {
  const code = String(districtCode ?? "").trim();

  if (!code) return [];

  await delay(200, readSignal(options));

  return normalizeList(listWardSeeds(code));
};

/**
 * Ghép địa chỉ đầy đủ theo thứ tự "số nhà, phường/xã, quận/huyện, tỉnh/thành".
 *
 * PHẢI GIỮ ĐỒNG BỘ (không async): VietnamAddressSelector gọi hàm này ngay trong
 * useMemo và trong handler để lấy chuỗi trả về tức thì; biến thành Promise là ô
 * xem trước hiện "[object Promise]".
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

export const getProvinces = (options) =>
  getVietnamProvincesApi(options);

export const getDistrictsByProvinceCode = (
  provinceCode,
  options
) => getVietnamDistrictsApi(provinceCode, options);

export const getWardsByDistrictCode = (
  districtCode,
  options
) => getVietnamWardsApi(districtCode, options);

/**
 * Tra ba cấp cùng lúc rồi trả object đã chuẩn hoá.
 *
 * Hai màn đặt đơn đọc addressResult?.province?.name, ?.district?.name, ?.ward?.name
 * và ?.fullAddress — bốn khoá này bắt buộc phải có mặt, và ba khoá đầu là null (chứ
 * không phải undefined) khi không tra được, đúng như bản thật.
 */
export const getFullAddressByCodes = async ({
  provinceCode,
  districtCode,
  wardCode,
  detailAddress = "",
} = {}) => {
  const [provinces, districts, wards] = await Promise.all([
    getVietnamProvincesApi(),
    getVietnamDistrictsApi(provinceCode),
    getVietnamWardsApi(districtCode),
  ]);

  const province = provinces.find(
    (item) => String(item.code) === String(provinceCode)
  );
  const district = districts.find(
    (item) => String(item.code) === String(districtCode)
  );
  const ward = wards.find(
    (item) => String(item.code) === String(wardCode)
  );

  return {
    province: province || null,
    district: district || null,
    ward: ward || null,
    fullAddress: composeVietnamAddress({
      street: detailAddress,
      ward: ward?.name,
      district: district?.name,
      province: province?.name,
    }),
  };
};

export default {
  getVietnamProvincesApi,
  getVietnamDistrictsApi,
  getVietnamWardsApi,
  composeVietnamAddress,
  getProvinces,
  getDistrictsByProvinceCode,
  getWardsByDistrictCode,
  getFullAddressByCodes,
};
