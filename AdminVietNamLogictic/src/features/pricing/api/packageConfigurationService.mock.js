/* =========================================================
   BẢN SAO MOCK TẠM THỜI — ĐỪNG NỐI API VÀO FILE NÀY.

   Đợt này chỉ nối API thật cho luồng BÁO GIÁ KÝ GỬI của Sale/Admin. Các màn
   ngoài luồng đó (mua hộ, SaleDashboard, chứng từ, chat, danh mục bảng giá,
   màn Sale tạo đơn hộ khách) vẫn phải chạy bằng dữ liệu mẫu, nên chúng trỏ vào
   bản sao này thay vì bản gốc đã nối backend.

   Đây là BẢN CHÉP NGUYÊN VĂN của module cùng tên (bỏ đuôi .mock) tại thời điểm
   nối API. Khi đợt sau nối nốt các màn kia: sửa import của màn đó về module gốc
   rồi XOÁ file này. Không thêm tính năng mới vào đây, không re-export từ barrel.
   ========================================================= */

/**
 * MOCK cấu hình đóng gói — bản chỉ-giao-diện.
 *
 * Tầng HTTP đã bị gỡ hẳn: không axiosInstance, không API_ENDPOINTS, không token.
 * Nguồn dữ liệu là bộ mẫu `packageConfigurations` trong @/mocks/data/catalog —
 * chính mảng mà features/admin/api/adminService.js mutate khi CRUD danh mục,
 * nên bản ghi thêm/sửa/xoá ở trang danh mục hiện ngay ở đây mà không cần reload.
 *
 * Toàn bộ hàm thuần (normalize / find / map / fee / validate) được giữ NGUYÊN
 * logic của bản thật: chúng chỉ tính trên dữ liệu truyền vào, đổi một dòng là
 * lệch số tiền báo giá và lệch nhãn option mà component không hề biết.
 *
 * CẮM API THẬT TRỞ LẠI: chỉ hai hàm dưới đây từng gọi mạng, mỗi hàm có khối
 * "// [API THẬT]" ghi rõ endpoint cũ:
 *   - getPackageConfigurationsApi  -> GET  API_ENDPOINTS.packageConfigurations.list
 *   - suggestPackageConfigurationApi -> POST API_ENDPOINTS.packageConfigurations.suggest
 * Thay phần đọc fixture bằng lời gọi axios rồi đưa kết quả qua đúng
 * `normalizePackageConfiguration` bên dưới là xong; phần lọc/chuẩn hoá giữ nguyên.
 */

import {
  packageConfigurations as packageConfigurationFixtures,
} from "@/mocks/data/catalog";
import {
  deepClone,
  delay,
  matchesKeyword,
} from "@/mocks/mockUtils";
import {
  formatPackageConfigurationName,
  PACKAGE_CONFIGURATION_NAMES,
} from "@shared/utils/productTypeLabel";

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

const PACKAGE_CONFIGURATION_LABELS = PACKAGE_CONFIGURATION_NAMES;

/* =========================
   NORMALIZE HELPERS
========================= */

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
   FIXTURE STORE
========================= */

/*
 * Đọc fixture ở thời điểm gọi (không cache lúc import): adminService mutate
 * tại chỗ chính mảng này, cache lại là danh sách đóng băng ở lần load đầu.
 * deepClone để một màn sort/mutate tại chỗ không làm hỏng dữ liệu màn khác.
 */
const readPackageConfigurationRows = () =>
  deepClone(
    getArrayItems(
      packageConfigurationFixtures
    )
  );

/*
 * Bản thật đẩy nguyên queryFilters lên server làm query string. Mock phải tự
 * lọc, nếu không thì thanh tìm kiếm / dropdown trạng thái bấm vào chẳng đổi gì.
 */
const matchesQueryFilters = (
  configuration,
  params = {}
) => {
  const status = normalizeUpperText(
    params.status
  );

  if (
    status &&
    configuration.status !== status
  ) {
    return false;
  }

  const configCode = normalizeUpperText(
    params.configCode ?? params.code
  );

  if (
    configCode &&
    configuration.configCode !==
      configCode
  ) {
    return false;
  }

  const keyword =
    params.keyword ??
    params.search ??
    params.q ??
    "";

  return matchesKeyword(
    configuration,
    keyword,
    [
      "configCode",
      "configName",
      "displayName",
    ]
  );
};

/* =========================
   DISPLAY HELPERS
========================= */

export const getPackageConfigurationDisplayName = (
  configurationOrCode
) => {
  /* Cùng tên với web khách ("Thùng cỡ vừa"...) — xem @shared/utils/productTypeLabel. */
  if (
    configurationOrCode &&
    typeof configurationOrCode === "object"
  ) {
    return formatPackageConfigurationName(
      configurationOrCode,
      "Cấu hình đóng gói"
    );
  }

  return (
    PACKAGE_CONFIGURATION_LABELS[
      normalizeUpperText(configurationOrCode)
    ] || "Cấu hình đóng gói"
  );
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
   API (MOCK)
========================= */

export const getPackageConfigurationsApi =
  async (filters = {}) => {
    const {
      signal,
      onlyActive,
      ...queryFilters
    } = filters || {};

    /*
     * [API THẬT] GET API_ENDPOINTS.packageConfigurations.list
     *   params: removeEmptyParams(queryFilters), signal, headers: getAuthHeaders()
     * Bản thật trả MẢNG TRẦN đã chuẩn hoá (không phải response axios,
     * không object phân trang) — giữ đúng kiểu đó ở mock.
     */
    await delay(200, signal);

    const params =
      removeEmptyParams(queryFilters);

    const configurations =
      readPackageConfigurationRows()
        .map(
          normalizePackageConfiguration
        )
        .filter(
          (configuration) =>
            Boolean(configuration.id) &&
            Boolean(
              configuration.configCode
            )
        )
        .filter((configuration) =>
          matchesQueryFilters(
            configuration,
            params
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

/*
 * Thể tích quy đổi ra dm³ để so với sức chứa của từng cấu hình.
 * Dùng cho gợi ý: server thật chọn thùng nhỏ nhất còn chứa được kiện.
 */
const getVolumeCm3 = (
  length,
  width,
  height
) => length * width * height;

/*
 * Cấu hình "đóng theo thực tế" là phương án cuối khi không thùng cố định nào vừa.
 * Nhận cả CUSTOM và CUSTOM_AIR nên dùng includes thay vì so khớp tuyệt đối.
 */
const isCustomConfigCode = (configCode) =>
  normalizeUpperText(
    configCode
  ).includes(
    PACKAGE_CONFIGURATION_CODE.CUSTOM
  );

export const suggestPackageConfigurationApi = async (item = {}) => {
  const payload = {
    length: normalizePositiveNumber(item?.length),
    width: normalizePositiveNumber(item?.width),
    height: normalizePositiveNumber(item?.height),
    weight: normalizePositiveNumber(item?.weight),
  };

  /*
   * [API THẬT] POST API_ENDPOINTS.packageConfigurations.suggest với `payload`,
   * rồi lấy data?.configuration || data?.packageConfiguration || data?.suggestion || data.
   * Bản thật trả MỘT object đã chuẩn hoá (không phải mảng, không bọc response).
   */
  await delay(260);

  const sourceRows =
    readPackageConfigurationRows();

  /*
   * normalizePackageConfiguration() không giữ `maxFee` (nó liệt kê field cố định),
   * nên giữ riêng một map id -> maxFee từ fixture để còn chặn trên được mức phí
   * gợi ý của cấu hình CUSTOM — vai trò mà server thật đảm nhiệm.
   */
  const maxFeeById = new Map(
    sourceRows.map((row) => [
      normalizeText(row?.id),
      normalizeNullableNumber(
        row?.maxFee ?? row?.maxPackageFee
      ),
    ])
  );

  const rows = sourceRows
    .map(normalizePackageConfiguration)
    .filter(
      (configuration) =>
        Boolean(configuration.id) &&
        Boolean(configuration.configCode) &&
        configuration.status ===
          PACKAGE_CONFIGURATION_STATUS.ACTIVE
    );

  const fixedBoxes = rows
    .filter(
      (configuration) =>
        !isCustomConfigCode(
          configuration.configCode
        )
    )
    .sort(
      (a, b) =>
        getVolumeCm3(
          a.length,
          a.width,
          a.height
        ) -
        getVolumeCm3(
          b.length,
          b.width,
          b.height
        )
    );

  /*
   * Chọn thùng cố định nhỏ nhất mà kiện còn nhét được: đúng thứ tự ưu tiên
   * mà validatePackageConfigurationForItem() kiểm tra lại ngay sau đó, nên
   * gợi ý không bao giờ tự sinh ra cảnh báo "vượt quá kích thước".
   */
  const fittingBox = fixedBoxes.find(
    (configuration) =>
      (configuration.maxWeight <= 0 ||
        payload.weight <=
          configuration.maxWeight) &&
      (configuration.length <= 0 ||
        payload.length <=
          configuration.length) &&
      (configuration.width <= 0 ||
        payload.width <=
          configuration.width) &&
      (configuration.height <= 0 ||
        payload.height <=
          configuration.height)
  );

  const customBox =
    rows.find(
      (configuration) =>
        configuration.configCode ===
        PACKAGE_CONFIGURATION_CODE.CUSTOM
    ) ||
    rows.find((configuration) =>
      isCustomConfigCode(
        configuration.configCode
      )
    ) ||
    null;

  const configuration =
    fittingBox ||
    customBox ||
    fixedBoxes[fixedBoxes.length - 1] ||
    rows[0] ||
    null;

  if (!configuration) {
    return normalizePackageConfiguration({});
  }

  /*
   * estimatedFee CHỈ xuất hiện ở kết quả gợi ý (fixture danh sách để null):
   * getPackageConfigurationFee() ưu tiên estimatedFee, nên nếu danh sách cũng
   * điền sẵn thì mọi tính phí theo thể tích của cấu hình CUSTOM bị bỏ qua.
   */
  const volumeCm3 = getVolumeCm3(
    payload.length,
    payload.width,
    payload.height
  );

  const maxFee = maxFeeById.get(
    configuration.id
  );

  const volumetricFee = Math.round(
    (volumeCm3 / 1000) *
      configuration.packageFee
  );

  const estimatedFee =
    isCustomConfigCode(
      configuration.configCode
    ) && volumeCm3 > 0
      ? maxFee !== null &&
        maxFee !== undefined &&
        maxFee > 0
        ? Math.min(volumetricFee, maxFee)
        : volumetricFee
      : configuration.packageFee;

  return normalizePackageConfiguration({
    ...configuration,
    estimatedFee,
  });
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
