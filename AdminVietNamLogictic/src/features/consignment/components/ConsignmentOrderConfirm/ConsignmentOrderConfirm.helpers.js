/*
 * Hàm thuần dùng cho màn hình xác nhận đơn ký gửi: chuẩn hoá mã, dịch nhãn,
 * định dạng số tiền và gom dữ liệu thùng gỗ.
 * Không hàm nào đọc state/props nên tách ra được mà không đổi hành vi render.
 */

import {
  CONDITION_UNIT_LABELS,
  PACKAGE_CONFIGURATION_LABELS,
  PRODUCT_TYPE_LABELS,
  ROUTE_LABELS,
  SERVICE_LABELS,
  SHIPPING_OPTION_LABELS,
} from "./ConsignmentOrderConfirm.constants";

export const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

export const isWoodCrateServiceCode = (value) => {
  const code = normalizeCode(value);

  return (
    code === "WOOD_CRATE" ||
    code === "WOOD_BOX" ||
    code.includes("WOOD_CRATE") ||
    code.includes("WOOD_BOX")
  );
};

export const normalizeId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const toFiniteNumberOrNull = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

export const hasVietnameseCharacters = (value) =>
  /[À-ỹ]/.test(String(value || ""));

export const getKnownVietnameseLabel = (
  value,
  context = "",
) => {
  const normalizedCode = normalizeCode(value);

  if (!normalizedCode) {
    return "";
  }

  if (context === "route") {
    return ROUTE_LABELS[normalizedCode] || "";
  }

  if (context === "shipping") {
    return (
      SHIPPING_OPTION_LABELS[normalizedCode] || ""
    );
  }

  if (context === "productType") {
    return PRODUCT_TYPE_LABELS[normalizedCode] || "";
  }

  return (
    SERVICE_LABELS[normalizedCode] ||
    SHIPPING_OPTION_LABELS[normalizedCode] ||
    ROUTE_LABELS[normalizedCode] ||
    PRODUCT_TYPE_LABELS[normalizedCode] ||
    ""
  );
};

export const formatCodeLabel = (value) => {
  const knownLabel =
    getKnownVietnameseLabel(value);

  if (knownLabel) {
    return knownLabel;
  }

  const rawValue = String(value || "").trim();

  if (
    rawValue &&
    hasVietnameseCharacters(rawValue)
  ) {
    return rawValue;
  }

  return "Dịch vụ bổ sung";
};

export const getServiceLabel = (
  code,
  ruleName = "",
) => {
  const normalizedCode =
    normalizeCode(code);

  const knownLabel =
    SERVICE_LABELS[normalizedCode];

  if (knownLabel) {
    return knownLabel;
  }

  const normalizedRuleName =
    String(ruleName || "").trim();

  if (
    normalizedRuleName &&
    hasVietnameseCharacters(
      normalizedRuleName,
    )
  ) {
    return normalizedRuleName;
  }

  return formatCodeLabel(
    normalizedCode,
  );
};

export const getServiceClassName = (code) => {
  const normalizedCode =
    normalizeCode(code);

  if (
    normalizedCode.includes("WOOD") ||
    normalizedCode.includes("CRATE")
  ) {
    return "is-wood";
  }

  if (
    normalizedCode.includes(
      "INSPECTION",
    )
  ) {
    return "is-inspection";
  }

  if (
    normalizedCode.includes(
      "INSURANCE",
    )
  ) {
    return "is-insurance";
  }

  if (
    normalizedCode.includes(
      "DOMESTIC",
    ) ||
    normalizedCode.includes(
      "FREIGHT",
    )
  ) {
    return "is-domestic";
  }

  if (
    normalizedCode.includes("PACKING")
  ) {
    return "is-packing";
  }

  return "is-other";
};

export const translateOptionLabel = ({
  value,
  rawLabel,
  context,
}) => {
  const label = String(
    rawLabel || value || "",
  ).trim();

  const knownFromLabel =
    getKnownVietnameseLabel(
      label,
      context,
    );

  if (knownFromLabel) {
    return knownFromLabel;
  }

  const knownFromValue =
    getKnownVietnameseLabel(
      value,
      context,
    );

  if (knownFromValue) {
    return knownFromValue;
  }

  if (
    context === "route" &&
    label
  ) {
    return label
      .replace(/\s*-->\s*/g, " → ")
      .replace(/\s*->\s*/g, " → ");
  }

  return (
    label ||
    "Chưa có thông tin"
  );
};

export const getOptionLabel = (
  options,
  value,
  context = "",
) => {
  const option = (
    Array.isArray(options)
      ? options
      : []
  ).find(
    (item) =>
      String(item?.value) ===
      String(value),
  );

  const rawLabel =
    option?.label ||
    option?.name ||
    option?.displayName ||
    value;

  return translateOptionLabel({
    value,
    rawLabel,
    context,
  });
};

export const formatVnd = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0 ₫";
  }

  return `${new Intl.NumberFormat(
    "vi-VN",
  ).format(number)} ₫`;
};

export const formatNumber = (
  value,
  maximumFractionDigits = 2,
) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat(
    "vi-VN",
    {
      maximumFractionDigits,
    },
  ).format(number);
};

export const calculatePackageVolume = (
  pkg,
) => {
  const length = Number(pkg?.length);
  const width = Number(pkg?.width);
  const height = Number(pkg?.height);

  if (
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return 0;
  }

  return length * width * height;
};

export const getLoadingProgress = (
  message = "",
) => {
  const normalizedMessage =
    String(message).toLowerCase();

  const uploadMatch =
    normalizedMessage.match(
      /(\d+)\s*\/\s*(\d+)/,
    );

  if (
    normalizedMessage.includes(
      "upload",
    ) ||
    normalizedMessage.includes(
      "tải ảnh",
    )
  ) {
    const currentPackage = Number(
      uploadMatch?.[1] || 1,
    );

    const totalPackages = Math.max(
      Number(
        uploadMatch?.[2] || 1,
      ),
      1,
    );

    return Math.min(
      78,
      Math.max(
        20,
        Math.round(
          20 +
            (currentPackage /
              totalPackages) *
              58,
        ),
      ),
    );
  }

  if (
    normalizedMessage.includes(
      "gửi yêu cầu",
    ) ||
    normalizedMessage.includes(
      "gửi đơn",
    )
  ) {
    return 92;
  }

  if (
    normalizedMessage.includes(
      "hoàn tất",
    ) ||
    normalizedMessage.includes(
      "thành công",
    )
  ) {
    return 100;
  }

  return 12;
};

export const getLoadingStage = (
  progress,
) => {
  if (progress >= 85) {
    return 3;
  }

  if (progress >= 20) {
    return 2;
  }

  return 1;
};

export const normalizeFullAddress = (
  value,
) => {
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value).trim();
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  return String(
    value?.fullAddress ||
      value?.address ||
      value?.receiverAddress ||
      value?.deliveryAddress ||
      value?.displayAddress ||
      "",
  ).trim();
};

export const normalizePricingRule = (
  rule = {},
) => ({
  ...rule,
  id: String(
    rule?.id ||
      rule?.pricingRuleId ||
      "",
  ).trim(),
  ruleCode: normalizeCode(
    rule?.ruleCode ||
      rule?.code ||
      rule?.ruleType,
  ),
  ruleType: normalizeCode(
    rule?.ruleType,
  ),
  ruleName: String(
    rule?.ruleName ||
      rule?.name ||
      "",
  ).trim(),
  description: String(
    rule?.description || "",
  ).trim(),
  calculationType: normalizeCode(
    rule?.calculationType,
  ),
  conditionType: String(
    rule?.conditionType || "",
  ).trim(),
  value:
    toFiniteNumberOrNull(
      rule?.value,
    ) ?? 0,
});

export const normalizeConfiguration = (
  configuration = {},
) => ({
  ...configuration,
  id: String(
    configuration?.id ||
      configuration
        ?.packageConfigurationId ||
      "",
  ).trim(),
  configCode: normalizeCode(
    configuration?.configCode ||
      configuration?.code,
  ),
  configName: String(
    configuration?.configName ||
      configuration?.name ||
      "",
  ).trim(),
  length:
    toFiniteNumberOrNull(
      configuration?.length,
    ) ?? 0,
  width:
    toFiniteNumberOrNull(
      configuration?.width,
    ) ?? 0,
  height:
    toFiniteNumberOrNull(
      configuration?.height,
    ) ?? 0,
  maxWeight:
    toFiniteNumberOrNull(
      configuration?.maxWeight,
    ) ?? 0,
  packageFee:
    toFiniteNumberOrNull(
      configuration?.packageFee,
    ) ?? 0,
  estimatedFee:
    toFiniteNumberOrNull(
      configuration?.estimatedFee,
    ),
});

export const getConditionUnitLabel = (
  conditionType,
) => {
  const rawConditionType =
    String(conditionType || "")
      .trim()
      .toUpperCase()
      .replaceAll(" ", "_");

  if (!rawConditionType) {
    return "";
  }

  if (
    CONDITION_UNIT_LABELS[
      rawConditionType
    ]
  ) {
    return CONDITION_UNIT_LABELS[
      rawConditionType
    ];
  }

  const unit =
    rawConditionType.includes("/")
      ? rawConditionType
          .split("/")
          .slice(1)
          .join("/")
      : rawConditionType;

  const translatedUnit = {
    PACKAGE: "kiện",
    ORDER: "đơn",
    ITEM: "sản phẩm",
    PRODUCT: "sản phẩm",
    KG: "kg",
    CBM: "m³",
    M3: "m³",
  }[unit];

  return (
    translatedUnit ||
    (
      hasVietnameseCharacters(
        conditionType,
      )
        ? String(
            conditionType,
          )
            .replace(/^VND\//i, "")
            .trim()
        : ""
    )
  );
};

export const translateSubmitMessage = (
  message,
) => {
  const rawMessage =
    String(message || "").trim();

  if (!rawMessage) {
    return "Đang chuẩn bị dữ liệu đơn hàng...";
  }

  const normalizedMessage =
    rawMessage.toLowerCase();

  if (
    normalizedMessage.includes(
      "upload",
    )
  ) {
    const match =
      rawMessage.match(
        /(\d+)\s*\/\s*(\d+)/,
      );

    return match
      ? `Đang tải ảnh kiện hàng ${match[1]}/${match[2]}...`
      : "Đang tải ảnh kiện hàng...";
  }

  if (
    normalizedMessage.includes(
      "validat",
    ) ||
    normalizedMessage.includes(
      "checking",
    )
  ) {
    return "Đang kiểm tra dữ liệu đơn hàng...";
  }

  if (
    normalizedMessage.includes(
      "sending",
    ) ||
    normalizedMessage.includes(
      "creating",
    )
  ) {
    return "Đang gửi yêu cầu tạo đơn...";
  }

  return rawMessage;
};

export const getRulePriceLabel = (
  rule,
) => {
  if (!rule) {
    return "Theo bảng giá hệ thống";
  }

  const calculationType =
    normalizeCode(
      rule.calculationType,
    );

  if (
    calculationType ===
    "PERCENTAGE"
  ) {
    return `${formatNumber(
      rule.value,
    )}%`;
  }

  const valueLabel =
    formatVnd(rule.value);

  const unitLabel =
    getConditionUnitLabel(
      rule.conditionType,
    );

  return unitLabel
    ? `${valueLabel} / ${unitLabel}`
    : valueLabel;
};

export const getConfigurationDisplay = (
  configuration = {},
) => {
  const configCode =
    normalizeCode(
      configuration?.configCode,
    ) || "CUSTOM";

  const translated =
    PACKAGE_CONFIGURATION_LABELS[
      configCode
    ];

  return {
    configCode,
    name:
      translated?.name ||
      configuration?.configName ||
      "Cấu hình thùng",
    size:
      translated?.size ||
      configCode.replaceAll(
        "_",
        " ",
      ),
  };
};

export const getConfigurationFee = (
  configuration,
) =>
  toFiniteNumberOrNull(
    configuration?.estimatedFee,
  ) ??
  toFiniteNumberOrNull(
    configuration?.packageFee,
  ) ??
  0;

export const normalizePackageImages = (
  pkg = {},
) => {
  const images = [];

  const appendImage = (
    value,
    index,
  ) => {
    const url =
      typeof value === "string"
        ? value
        : value?.previewUrl ||
          value?.url ||
          value?.imageUrl ||
          value?.referenceUrl ||
          value?.fileUrl;

    const normalizedUrl =
      String(url || "").trim();

    if (
      normalizedUrl &&
      !images.some(
        (item) =>
          item.previewUrl ===
          normalizedUrl,
      )
    ) {
      images.push({
        id:
          value?.id ||
          `${pkg?.id || "package"}-${index}`,
        previewUrl:
          normalizedUrl,
      });
    }
  };

  if (Array.isArray(pkg?.images)) {
    pkg.images.forEach(
      appendImage,
    );
  }

  if (
    Array.isArray(
      pkg?.referenceUrls,
    )
  ) {
    pkg.referenceUrls.forEach(
      appendImage,
    );
  }

  if (pkg?.referenceUrl) {
    appendImage(
      pkg.referenceUrl,
      images.length,
    );
  }

  return images;
};

export const getPackageId = (
  pkg,
  index,
) =>
  String(
    pkg?.id ||
      pkg?.packageId ||
      `package-${index + 1}`,
  ).trim();

/**
 * Phí đóng thùng gỗ tính MỘT LẦN cho cả đơn — hiện tại LUÔN bằng 0.
 *
 * Backend tính tiền thùng gỗ hoàn toàn theo cỡ thùng chọn cho TỪNG KIỆN
 * (`packageConfigurationId` → `PackageConfiguration.PackageFee`) và cố tình loại
 * WOOD/CRATE khỏi danh sách dịch vụ chọn theo kiện — lời báo lỗi của chính nó nói
 * rõ: "Thùng gỗ chọn qua cấu hình thùng (packageConfigurationId) của kiện."
 * Dòng WOOD_CRATE trong bảng quy tắc chỉ để hiện TÊN và MÔ TẢ dịch vụ cho khách tick
 * chọn; `value` của nó không phải là một khoản thu.
 *
 * Bản cũ lấy thẳng `rule.value` (35.000đ) rồi cộng vào tổng, nên màn xác nhận báo
 * 60.000đ trong khi hoá đơn sau khi tạo đơn chỉ có 25.000đ. Giữ hàm này thay vì xoá
 * để chỗ gọi không phải sửa, và để khi nào thật sự có khoản phí cả đơn thì chỉ cần
 * nối lại ở đúng một chỗ.
 */
export const getWoodCrateOrderFee = () => 0;

export const calculateWoodCrateSummary = ({
  optionalServices,
  packages,
  selectedConfigurationByPackage,
  pricingRuleByCode,
}) => {
  const enabled =
    Boolean(
      optionalServices
        ?.requiresWoodenCrate,
    );

  if (!enabled) {
    return {
      enabled: false,
      orderServiceFee: 0,
      configurationFee: 0,
      totalFee: 0,
      selectedCount: 0,
      packageCount:
        packages.length,
      rows: [],
    };
  }

  const orderServiceFee =
    getWoodCrateOrderFee({
      optionalServices,
      pricingRuleByCode,
    });

  const rows = packages
    .map((pkg, index) => {
      const packageId =
        getPackageId(
          pkg,
          index,
        );

      const configuration =
        selectedConfigurationByPackage.get(
          packageId,
        ) || null;

      if (!configuration) {
        return null;
      }

      const {
        name,
        size,
      } = getConfigurationDisplay(
        configuration,
      );

      return {
        packageId,
        packageIndex:
          index + 1,
        productName:
          String(
            pkg?.productName ||
              `Kiện hàng ${index + 1}`,
          ).trim(),
        packageDimensions:
          `${formatNumber(
            pkg?.length,
          )} × ${formatNumber(
            pkg?.width,
          )} × ${formatNumber(
            pkg?.height,
          )} cm`,
        configuration,
        configurationName:
          name,
        configurationSize:
          size,
        configurationDimensions:
          normalizeCode(
            configuration
              ?.configCode,
          ) === "CUSTOM"
            ? "Theo kích thước thực tế"
            : `${formatNumber(
                configuration
                  ?.length,
              )} × ${formatNumber(
                configuration
                  ?.width,
              )} × ${formatNumber(
                configuration
                  ?.height,
              )} cm`,
        packageFee:
          getConfigurationFee(
            configuration,
          ),
      };
    })
    .filter(Boolean);

  const computedConfigurationFee =
    rows.reduce(
      (total, row) =>
        total +
        row.packageFee,
      0,
    );

  const configurationFee =
    rows.length > 0
      ? computedConfigurationFee
      : Number(
          optionalServices
            ?.woodCrateConfigurationFee,
        ) || 0;

  return {
    enabled: true,
    orderServiceFee,
    configurationFee,
    totalFee:
      orderServiceFee +
      configurationFee,
    selectedCount:
      rows.length,
    packageCount:
      packages.length,
    rows,
  };
};
