import axios from "axios";

const addressApi = axios.create({
  baseURL: "https://provinces.open-api.vn/api/v1",
  timeout: 15000,
  headers: { Accept: "application/json" },
});

const cache = new Map();

const normalizeLocation = (item = {}) => ({
  code: String(item?.code ?? ""),
  name: String(item?.name ?? "").trim(),
  codename: String(item?.codename ?? "").trim(),
  divisionType: String(item?.division_type ?? "").trim(),
});

const getCached = async (key, loader) => {
  if (cache.has(key)) return cache.get(key);
  const data = await loader();
  cache.set(key, data);
  return data;
};

export const getVietnamProvincesApi = () =>
  getCached("provinces", async () => {
    const response = await addressApi.get("/p/");
    return (Array.isArray(response?.data) ? response.data : [])
      .map(normalizeLocation)
      .filter((item) => item.code && item.name);
  });

export const getVietnamDistrictsApi = (provinceCode) => {
  const code = String(provinceCode ?? "").trim();
  if (!code) return Promise.resolve([]);
  return getCached(`districts:${code}`, async () => {
    const response = await addressApi.get(`/p/${encodeURIComponent(code)}`, {
      params: { depth: 2 },
    });
    const items = response?.data?.districts;
    return (Array.isArray(items) ? items : [])
      .map(normalizeLocation)
      .filter((item) => item.code && item.name);
  });
};

export const getVietnamWardsApi = (districtCode) => {
  const code = String(districtCode ?? "").trim();
  if (!code) return Promise.resolve([]);
  return getCached(`wards:${code}`, async () => {
    const response = await addressApi.get(`/d/${encodeURIComponent(code)}`, {
      params: { depth: 2 },
    });
    const items = response?.data?.wards;
    return (Array.isArray(items) ? items : [])
      .map(normalizeLocation)
      .filter((item) => item.code && item.name);
  });
};

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

export const getProvinces = () => getVietnamProvincesApi();

export const getDistrictsByProvinceCode = (provinceCode) =>
  getVietnamDistrictsApi(provinceCode);

export const getWardsByDistrictCode = (districtCode) =>
  getVietnamWardsApi(districtCode);

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
