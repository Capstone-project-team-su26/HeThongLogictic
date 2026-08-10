import axiosInstance from "../../axiosInstance";
import { API_ENDPOINTS } from "../../apiEndpoints";

/* =========================
   CONSTANTS
========================= */

export const PACKAGE_CONFIGURATION_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
};

export const PACKAGE_CONFIGURATION_CODE = {
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
  CUSTOM: "CUSTOM",
};

const PACKAGE_CONFIGURATION_LABELS = {
  SMALL: "Thùng nhỏ",
  MEDIUM: "Thùng vừa",
  LARGE: "Thùng lớn",
  CUSTOM: "Đóng gói theo kích thước thực tế",
};

/* =========================
   RESPONSE / AUTH HELPERS
========================= */

const getResponseData = (response) =>
  response?.data?.data ??
  response?.data ??
  null;

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

const getAuthHeaders = () => ({
  Accept: "*/*",
  Authorization: `Bearer ${getAccessToken()}`,
});

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const normalizeNumber = (
  value,
  fallback = 0
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const normalizePositiveNumber = (
  value,
  fallback = 0
) => {
  return Math.max(
    0,
    normalizeNumber(value, fallback)
  );
};

const normalizeNullableNumber = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const removeEmptyParams = (
  params = {}
) => {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
  );
};

const getArrayItems = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

/* =========================
   DISPLAY HELPERS
========================= */

export const getPackageConfigurationDisplayName = (
  configurationOrCode
) => {
  const code =
    typeof configurationOrCode === "object"
      ? normalizeUpperText(
          configurationOrCode?.configCode
        )
      : normalizeUpperText(
          configurationOrCode
        );

  if (PACKAGE_CONFIGURATION_LABELS[code]) {
    return PACKAGE_CONFIGURATION_LABELS[code];
  }

  if (
    typeof configurationOrCode === "object"
  ) {
    return (
      normalizeText(
        configurationOrCode?.configName
      ) || "Cấu hình đóng gói"
    );
  }

  return "Cấu hình đóng gói";
};

/* =========================
   NORMALIZE
========================= */

export const normalizePackageConfiguration = (
  configuration = {}
) => {
  const configCode =
    normalizeUpperText(
      configuration?.configCode
    );

  return {
    id:
      normalizeText(configuration?.id),

    configCode,

    configName:
      normalizeText(
        configuration?.configName
      ),

    displayName:
      getPackageConfigurationDisplayName({
        configCode,
        configName:
          configuration?.configName,
      }),

    length:
      normalizePositiveNumber(
        configuration?.length
      ),

    width:
      normalizePositiveNumber(
        configuration?.width
      ),

    height:
      normalizePositiveNumber(
        configuration?.height
      ),

    maxWeight:
      normalizePositiveNumber(
        configuration?.maxWeight
      ),

    packageFee:
      normalizePositiveNumber(
        configuration?.packageFee
      ),

    estimatedFee:
      normalizeNullableNumber(
        configuration?.estimatedFee
      ),

    status:
      normalizeUpperText(
        configuration?.status
      ),
  };
};

/* =========================
   API
========================= */

export const getPackageConfigurationsApi =
  async (filters = {}) => {
    const {
      signal,
      onlyActive,
      ...queryFilters
    } = filters || {};

    const response =
      await axiosInstance.get(
        API_ENDPOINTS.packageConfigurations.list,
        {
          params:
            removeEmptyParams(queryFilters),

          signal,

          headers:
            getAuthHeaders(),
        }
      );

    const data =
      getResponseData(response);

    const configurations = getArrayItems(data)
      .map(
        normalizePackageConfiguration
      )
      .filter(
        (configuration) =>
          Boolean(configuration.id) &&
          Boolean(
            configuration.configCode
          )
      );

    return onlyActive === true
      ? configurations.filter(
          (configuration) =>
            configuration.status === PACKAGE_CONFIGURATION_STATUS.ACTIVE
        )
      : configurations;
  };

export const getActivePackageConfigurationsApi =
  async (filters = {}) => {
    const configurations =
      await getPackageConfigurationsApi(
        filters
      );

    return configurations.filter(
      (configuration) =>
        configuration.status ===
        PACKAGE_CONFIGURATION_STATUS.ACTIVE
    );
  };

export const suggestPackageConfigurationApi = async (item = {}) => {
  const payload = {
    length: normalizePositiveNumber(item?.length),
    width: normalizePositiveNumber(item?.width),
    height: normalizePositiveNumber(item?.height),
    weight: normalizePositiveNumber(item?.weight),
  };

  const response = await axiosInstance.post(
    API_ENDPOINTS.packageConfigurations.suggest,
    payload,
    {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    }
  );

  const data = getResponseData(response);
  const configuration =
    data?.configuration ||
    data?.packageConfiguration ||
    data?.suggestion ||
    data;

  return normalizePackageConfiguration(configuration || {});
};

/* =========================
   LOOKUP HELPERS
========================= */

export const findPackageConfigurationById = (
  configurations = [],
  configurationId
) => {
  if (!Array.isArray(configurations)) {
    return null;
  }

  const normalizedId =
    normalizeText(configurationId);

  if (!normalizedId) {
    return null;
  }

  return (
    configurations.find(
      (configuration) =>
        normalizeText(
          configuration?.id
        ) === normalizedId
    ) || null
  );
};

export const findPackageConfigurationByCode = (
  configurations = [],
  configCode
) => {
  if (!Array.isArray(configurations)) {
    return null;
  }

  const normalizedCode =
    normalizeUpperText(configCode);

  if (!normalizedCode) {
    return null;
  }

  return (
    configurations.find(
      (configuration) =>
        normalizeUpperText(
          configuration?.configCode
        ) === normalizedCode
    ) || null
  );
};

/* =========================
   OPTION HELPERS
========================= */

export const mapPackageConfigurationsToOptions = (
  configurations = []
) => {
  if (!Array.isArray(configurations)) {
    return [];
  }

  return configurations.map(
    (configuration) => {
      const normalized =
        normalizePackageConfiguration(
          configuration
        );

      const dimensionLabel =
        normalized.configCode ===
        PACKAGE_CONFIGURATION_CODE.CUSTOM
          ? "Kích thước theo thực tế"
          : `${normalized.length} × ${normalized.width} × ${normalized.height} cm`;

      const feeLabel =
        new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(
          getPackageConfigurationFee(
            normalized
          )
        );

      return {
        value: normalized.id,

        label:
          `${normalized.displayName} • ` +
          `${dimensionLabel} • ` +
          `Tối đa ${normalized.maxWeight} kg • ` +
          `${feeLabel}`,

        ...normalized,

        searchText: [
          normalized.displayName,
          normalized.configName,
          normalized.configCode,
          dimensionLabel,
          normalized.maxWeight,
          normalized.packageFee,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    }
  );
};

/* =========================
   FEE HELPERS
========================= */

export const getPackageConfigurationFee = (
  configuration,
  item = null
) => {
  if (!configuration) {
    return 0;
  }

  const normalized =
    normalizePackageConfiguration(
      configuration
    );

  /*
   * Ưu tiên dùng mức phí đã được API tính sẵn (estimatedFee).
   */
  if (normalized.estimatedFee !== null && normalized.estimatedFee !== undefined) {
    return normalizePositiveNumber(
      normalized.estimatedFee
    );
  }

  const baseFee = normalizePositiveNumber(
    normalized.packageFee
  );
  if (baseFee <= 0) return 0;

  const maxFee = Number(normalized.maxFee ?? normalized.maxPackageFee);
  const hasMaxFee = Number.isFinite(maxFee) && maxFee > 0;

  const configCode = String(normalized.configCode ?? "").toUpperCase();
  const isCustom = configCode === "CUSTOM" || configCode.includes("CUSTOM");

  if (isCustom && item) {
    const length = normalizePositiveNumber(item?.length ?? item?.lengthCm);
    const width = normalizePositiveNumber(item?.width ?? item?.widthCm);
    const height = normalizePositiveNumber(item?.height ?? item?.heightCm);
    const volumeCm3 = length * width * height;

    if (volumeCm3 > 0) {
      const calculatedFee = Math.round((volumeCm3 / 1000) * baseFee);
      return hasMaxFee ? Math.min(calculatedFee, maxFee) : calculatedFee;
    }
  }

  return baseFee;
};

export const resolveItemPackageConfiguration = (
  item,
  configurations = []
) => {
  if (item?.packageConfiguration) {
    return normalizePackageConfiguration(
      item.packageConfiguration
    );
  }

  return findPackageConfigurationById(
    configurations,
    item?.packageConfigurationId
  );
};

export const calculateItemPackageFee = (
  item,
  configurations = []
) => {
  const configuration =
    resolveItemPackageConfiguration(
      item,
      configurations
    );

  return getPackageConfigurationFee(
    configuration,
    item
  );
};

export const calculateItemsPackageFee = (
  items = [],
  configurations = []
) => {
  if (!Array.isArray(items)) {
    return 0;
  }

  return Math.round(
    items.reduce(
      (total, item) =>
        total +
        calculateItemPackageFee(
          item,
          configurations
        ),
      0
    )
  );
};

/* =========================
   VALIDATION HELPERS
========================= */

export const validatePackageConfigurationForItem =
  (
    item,
    configuration
  ) => {
    const normalized =
      normalizePackageConfiguration(
        configuration
      );

    if (!normalized.id) {
      return {
        valid: false,
        message:
          "Không tìm thấy cấu hình đóng gói.",
      };
    }

    if (
      normalized.configCode ===
      PACKAGE_CONFIGURATION_CODE.CUSTOM
    ) {
      return {
        valid: true,
        message:
          "Kiện hàng sử dụng cấu hình đóng gói theo kích thước thực tế.",
      };
    }

    const itemWeight =
      normalizePositiveNumber(
        item?.weight
      );

    const itemLength =
      normalizePositiveNumber(
        item?.length
      );

    const itemWidth =
      normalizePositiveNumber(
        item?.width
      );

    const itemHeight =
      normalizePositiveNumber(
        item?.height
      );

    const exceededFields = [];

    if (
      normalized.maxWeight > 0 &&
      itemWeight > normalized.maxWeight
    ) {
      exceededFields.push(
        `trọng lượng tối đa ${normalized.maxWeight} kg`
      );
    }

    if (
      normalized.length > 0 &&
      itemLength > normalized.length
    ) {
      exceededFields.push(
        `chiều dài tối đa ${normalized.length} cm`
      );
    }

    if (
      normalized.width > 0 &&
      itemWidth > normalized.width
    ) {
      exceededFields.push(
        `chiều rộng tối đa ${normalized.width} cm`
      );
    }

    if (
      normalized.height > 0 &&
      itemHeight > normalized.height
    ) {
      exceededFields.push(
        `chiều cao tối đa ${normalized.height} cm`
      );
    }

    if (exceededFields.length > 0) {
      return {
        valid: false,
        message:
          `Kiện hàng vượt quá ${exceededFields.join(", ")}.`,
      };
    }

    return {
      valid: true,
      message:
        "Kiện hàng phù hợp với cấu hình đóng gói đã chọn.",
    };
  };

/* =========================
   DEFAULT EXPORT
========================= */

const packageConfigurationService = {
  PACKAGE_CONFIGURATION_STATUS,
  PACKAGE_CONFIGURATION_CODE,

  getPackageConfigurationDisplayName,
  normalizePackageConfiguration,

  getPackageConfigurationsApi,
  getActivePackageConfigurationsApi,
  suggestPackageConfigurationApi,

  findPackageConfigurationById,
  findPackageConfigurationByCode,
  mapPackageConfigurationsToOptions,

  getPackageConfigurationFee,
  resolveItemPackageConfiguration,
  calculateItemPackageFee,
  calculateItemsPackageFee,

  validatePackageConfigurationForItem,
};

export default packageConfigurationService;
