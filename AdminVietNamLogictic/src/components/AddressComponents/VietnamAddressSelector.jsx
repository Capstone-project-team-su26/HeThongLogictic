import { useEffect, useMemo, useState } from "react";
import { Alert, Input, Select } from "antd";
import { EnvironmentOutlined, HomeOutlined } from "@ant-design/icons";
import {
  composeVietnamAddress,
  getVietnamDistrictsApi,
  getVietnamProvincesApi,
  getVietnamWardsApi,
} from "../../api/AddressAPI/vietnamAddressService";
import "./VietnamAddressSelector.css";

const toOptions = (items = []) =>
  items.map((item) => ({ value: item.code, label: item.name }));

const getStreetFromExistingAddress = (address) =>
  String(address ?? "").split(",")[0]?.trim() || "";

const getNextValue = (next, key, currentValue) =>
  Object.prototype.hasOwnProperty.call(next, key) ? next[key] : currentValue;

export default function VietnamAddressSelector({
  initialAddress = "",
  onAddressChange,
  disabled = false,
}) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [provinceCode, setProvinceCode] = useState();
  const [districtCode, setDistrictCode] = useState();
  const [wardCode, setWardCode] = useState();
  const [street, setStreet] = useState(initialAddress);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getVietnamProvincesApi()
      .then((items) => {
        if (active) setProvinces(items);
      })
      .catch(() => {
        if (active) {
          setError(
            "Không tải được danh mục địa chỉ. Bạn vẫn có thể nhập địa chỉ thủ công."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const buildAddress = (next = {}) => {
    const nextProvinceCode = getNextValue(next, "provinceCode", provinceCode);
    const nextDistrictCode = getNextValue(next, "districtCode", districtCode);
    const nextWardCode = getNextValue(next, "wardCode", wardCode);
    const province = provinces.find((item) => item.code === nextProvinceCode);
    const district = districts.find((item) => item.code === nextDistrictCode);
    const ward = wards.find((item) => item.code === nextWardCode);

    return composeVietnamAddress({
      street: next.street ?? street,
      ward: ward?.name,
      district: district?.name,
      province: province?.name,
    });
  };

  const emitAddress = (next = {}) => {
    onAddressChange?.(buildAddress(next));
  };

  const handleProvinceChange = async (code) => {
    const nextStreet =
      !provinceCode && street === initialAddress
        ? getStreetFromExistingAddress(initialAddress)
        : street;

    setStreet(nextStreet);
    setProvinceCode(code);
    setDistrictCode(undefined);
    setWardCode(undefined);
    setDistricts([]);
    setWards([]);
    setError("");

    if (!code) {
      emitAddress({
        street: nextStreet,
        provinceCode: undefined,
        districtCode: undefined,
        wardCode: undefined,
      });
      return;
    }

    try {
      setLoading(true);
      const items = await getVietnamDistrictsApi(code);
      setDistricts(items);
      emitAddress({
        street: nextStreet,
        provinceCode: code,
        districtCode: undefined,
        wardCode: undefined,
      });
    } catch {
      setError("Không tải được danh sách Quận/Huyện.");
    } finally {
      setLoading(false);
    }
  };

  const handleDistrictChange = async (code) => {
    setDistrictCode(code);
    setWardCode(undefined);
    setWards([]);
    setError("");

    if (!code) {
      emitAddress({ districtCode: undefined, wardCode: undefined });
      return;
    }

    try {
      setLoading(true);
      const items = await getVietnamWardsApi(code);
      setWards(items);
      emitAddress({ districtCode: code, wardCode: undefined });
    } catch {
      setError("Không tải được danh sách Phường/Xã.");
    } finally {
      setLoading(false);
    }
  };

  const preview = useMemo(
    () => {
      const province = provinces.find((item) => item.code === provinceCode);
      const district = districts.find((item) => item.code === districtCode);
      const ward = wards.find((item) => item.code === wardCode);

      return composeVietnamAddress({
        street,
        ward: ward?.name,
        district: district?.name,
        province: province?.name,
      });
    },
    [districtCode, districts, provinceCode, provinces, street, wardCode, wards]
  );

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
          emitAddress({ street: value });
        }}
      />

      <div className="vietnam-address-selector__grid">
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          loading={loading}
          disabled={disabled}
          value={provinceCode}
          options={toOptions(provinces)}
          placeholder="Tỉnh / Thành phố"
          onChange={handleProvinceChange}
        />
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          loading={loading}
          disabled={disabled || !provinceCode}
          value={districtCode}
          options={toOptions(districts)}
          placeholder="Quận / Huyện"
          onChange={handleDistrictChange}
        />
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          loading={loading}
          disabled={disabled || !districtCode}
          value={wardCode}
          options={toOptions(wards)}
          placeholder="Phường / Xã"
          onChange={(code) => {
            setWardCode(code);
            emitAddress({ wardCode: code });
          }}
        />
      </div>

      {preview && (
        <div className="vietnam-address-selector__preview">
          <EnvironmentOutlined />
          <span>{preview}</span>
        </div>
      )}

      {error && <Alert type="warning" showIcon message={error} />}
    </div>
  );
}
