import {
  useEffect,
  useMemo,
} from "react";
import {
  CheckCircleOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import {
  Carousel,
  Image,
  Tag,
  Tooltip,
} from "antd";

import "./ConsignmentOrderConfirm.css";

const SERVICE_LABELS = {
  WOOD_CRATE: "Đóng thùng gỗ",
  WOOD_BOX: "Đóng thùng gỗ",
  DOMESTIC_FEE: "Phí vận chuyển nội địa",
  DOMESTIC_SHIPPING_FEE:
    "Phí vận chuyển nội địa",
  LOCAL_FREIGHT:
    "Phí vận chuyển nội địa",
  LOCAL_FREIGHT_TEMP:
    "Phí vận chuyển nội địa",
  SUR_INSPECTION: "Phụ phí kiểm hàng",
  INSPECTION: "Kiểm hàng",
  CHECKING: "Kiểm hàng",
  SUR_INSURANCE_3PERCENT:
    "Bảo hiểm hàng hóa 3%",
  INSURANCE: "Bảo hiểm hàng hóa",
  PACKING: "Đóng gói hàng hóa",
  REPACKING: "Đóng gói lại hàng hóa",
  FRAGILE: "Phụ phí hàng dễ vỡ",
  STORAGE: "Phí lưu kho",
  CUSTOMS: "Dịch vụ khai báo hải quan",
};

const SERVICE_DESCRIPTIONS = {
  WOOD_CRATE:
    "Đóng thùng gỗ chuyên dụng để bảo vệ hàng cồng kềnh, dễ vỡ hoặc có giá trị cao.",
  WOOD_BOX:
    "Đóng thùng gỗ chuyên dụng để bảo vệ hàng cồng kềnh, dễ vỡ hoặc có giá trị cao.",
  DOMESTIC_FEE:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  DOMESTIC_SHIPPING_FEE:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  LOCAL_FREIGHT:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  LOCAL_FREIGHT_TEMP:
    "Chi phí vận chuyển hàng trong nội địa trước hoặc sau chặng vận chuyển quốc tế.",
  SUR_INSPECTION:
    "Nhân viên kiểm tra tình trạng, số lượng và thông tin hàng hóa theo yêu cầu.",
  INSPECTION:
    "Nhân viên kiểm tra tình trạng, số lượng và thông tin hàng hóa theo yêu cầu.",
  SUR_INSURANCE_3PERCENT:
    "Bảo hiểm hàng hóa được tính theo tỷ lệ phần trăm trên giá trị khai báo.",
  INSURANCE:
    "Bảo hiểm hỗ trợ giảm rủi ro mất mát hoặc hư hỏng trong quá trình vận chuyển.",
  PACKING:
    "Đóng gói lại hàng hóa để phù hợp với yêu cầu vận chuyển.",
  REPACKING:
    "Đóng gói lại hàng hóa để phù hợp với yêu cầu vận chuyển.",
  FRAGILE:
    "Phụ phí xử lý riêng đối với hàng hóa dễ vỡ.",
  STORAGE:
    "Chi phí lưu giữ hàng hóa tại kho trong thời gian quy định.",
  CUSTOMS:
    "Hỗ trợ chuẩn bị và khai báo thông tin hải quan cho lô hàng.",
};

const SHIPPING_OPTION_LABELS = {
  STANDARD: "Tiêu chuẩn",
  EXPRESS: "Hỏa tốc",
  ECONOMY: "Tiết kiệm",
  FAST: "Nhanh",
  SUPER_EXPRESS: "Siêu tốc",
  AIR: "Đường hàng không",
  AIR_FREIGHT: "Đường hàng không",
  SEA: "Đường biển",
  SEA_FREIGHT: "Đường biển",
  ROAD: "Đường bộ",
  RAIL: "Đường sắt",
};

const ROUTE_LABELS = {
  CHINA_VIETNAM: "Trung Quốc → Việt Nam",
  KOREA_VIETNAM: "Hàn Quốc → Việt Nam",
  JAPAN_VIETNAM: "Nhật Bản → Việt Nam",
  USA_VIETNAM: "Hoa Kỳ → Việt Nam",
  US_VIETNAM: "Hoa Kỳ → Việt Nam",
  THAILAND_VIETNAM: "Thái Lan → Việt Nam",
  SINGAPORE_VIETNAM: "Singapore → Việt Nam",
};

const PRODUCT_TYPE_LABELS = {
  ELECTRONICS: "Điện tử và công nghệ",
  ELECTRONIC: "Điện tử và công nghệ",
  CLOTHING: "Quần áo",
  FASHION: "Thời trang",
  COSMETICS: "Mỹ phẩm",
  BEAUTY: "Sản phẩm làm đẹp",
  FOOD: "Thực phẩm",
  DRINK: "Đồ uống",
  MEDICINE: "Dược phẩm",
  PHARMACEUTICAL: "Dược phẩm",
  HOUSEHOLD: "Đồ gia dụng",
  HOME_APPLIANCE: "Thiết bị gia dụng",
  ACCESSORIES: "Phụ kiện",
  SHOES: "Giày dép",
  BOOKS: "Sách và văn phòng phẩm",
  TOYS: "Đồ chơi",
  FRAGILE: "Hàng dễ vỡ",
  OTHER: "Hàng hóa khác",
};

const CONDITION_UNIT_LABELS = {
  "VND/KIỆN": "kiện",
  "VND/PACKAGE": "kiện",
  "VND/ĐƠN": "đơn",
  "VND/ORDER": "đơn",
  "VND/KG": "kg",
  "VND/SẢN_PHẨM": "sản phẩm",
  "VND/ITEM": "sản phẩm",
  "VND/CBM": "m³",
  "VND/M3": "m³",
};

const PACKAGE_CONFIGURATION_LABELS = {
  SMALL: {
    name: "Thùng cỡ nhỏ",
    size: "CỠ NHỎ",
  },
  MEDIUM: {
    name: "Thùng cỡ vừa",
    size: "CỠ VỪA",
  },
  LARGE: {
    name: "Thùng cỡ lớn",
    size: "CỠ LỚN",
  },
  CUSTOM: {
    name: "Thùng tùy chỉnh",
    size: "TÙY CHỈNH",
  },
};

const HIDDEN_SERVICE_CODES = new Set([
  "VOLUMETRIC_DIVISOR",
]);

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

const isWoodCrateServiceCode = (value) => {
  const code = normalizeCode(value);

  return (
    code === "WOOD_CRATE" ||
    code === "WOOD_BOX" ||
    code.includes("WOOD_CRATE") ||
    code.includes("WOOD_BOX")
  );
};

const normalizeId = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const toFiniteNumberOrNull = (value) => {
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

const hasVietnameseCharacters = (value) =>
  /[À-ỹ]/.test(String(value || ""));

const getKnownVietnameseLabel = (
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

const formatCodeLabel = (value) => {
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

const getServiceLabel = (
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

const getServiceClassName = (code) => {
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

const translateOptionLabel = ({
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

const getOptionLabel = (
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

const formatVnd = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0 ₫";
  }

  return `${new Intl.NumberFormat(
    "vi-VN",
  ).format(number)} ₫`;
};

const formatNumber = (
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

const calculatePackageVolume = (
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

const getLoadingProgress = (
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

const getLoadingStage = (
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

const normalizeFullAddress = (
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

const normalizePricingRule = (
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

const normalizeConfiguration = (
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

const getConditionUnitLabel = (
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

const translateSubmitMessage = (
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

const getRulePriceLabel = (
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

const getConfigurationDisplay = (
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

const getConfigurationFee = (
  configuration,
) =>
  toFiniteNumberOrNull(
    configuration?.estimatedFee,
  ) ??
  toFiniteNumberOrNull(
    configuration?.packageFee,
  ) ??
  0;

const normalizePackageImages = (
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

const getPackageId = (
  pkg,
  index,
) =>
  String(
    pkg?.id ||
      pkg?.packageId ||
      `package-${index + 1}`,
  ).trim();

const getWoodCrateOrderFee = ({
  optionalServices,
  pricingRuleByCode,
}) => {
  const rule =
    pricingRuleByCode instanceof Map
      ? pricingRuleByCode.get(
          "WOOD_CRATE",
        ) || null
      : null;

  const savedConfigurations =
    Array.isArray(
      optionalServices
        ?.selectedPackageConfigurations,
    )
      ? optionalServices
          .selectedPackageConfigurations
      : [];

  /*
   * Ưu tiên giá rule API.
   * Các field cũ chỉ dùng làm fallback tương thích.
   */
  return (
    Number(rule?.value) ||
    Number(
      optionalServices
        ?.woodCrateOrderFee,
    ) ||
    Number(
      savedConfigurations?.[0]
        ?.woodCrateOrderFee,
    ) ||
    Number(
      savedConfigurations?.[0]
        ?.woodCrateBaseFee,
    ) ||
    Number(
      optionalServices
        ?.woodCrateBaseFeePerPackage,
    ) ||
    Number(
      optionalServices
        ?.woodCrateBaseFee,
    ) ||
    0
  );
};

const calculateWoodCrateSummary = ({
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

function PriceInfoLabel({
  label,
  tooltip,
}) {
  return (
    <span className="consignment-confirm-price-info-label">
      <span>{label}</span>

      <Tooltip
        title={tooltip}
        placement="top"
        mouseEnterDelay={0.12}
      >
        <button
          type="button"
          className="consignment-confirm-price-info-button"
          aria-label={`Giải thích ${label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <InfoCircleOutlined />
        </button>
      </Tooltip>
    </span>
  );
}

function SummaryItem({
  label,
  value,
  fullWidth = false,
  tone = "",
}) {
  const hasValue =
    value !== null &&
    value !== undefined &&
    value !== "";

  return (
    <div
      className={[
        "consignment-confirm-summary-item",
        fullWidth &&
          "is-full-width",
        tone && `is-${tone}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>

      <strong>
        {hasValue
          ? value
          : "Chưa có thông tin"}
      </strong>
    </div>
  );
}

function ServiceCard({
  service,
}) {
  return (
    <article
      className={[
        "consignment-confirm-service-card",
        getServiceClassName(
          service.code,
        ),
      ].join(" ")}
    >
      <div className="consignment-confirm-service-card__heading">
        <span className="consignment-confirm-service-dot" />

        <div>
          <strong>
            {service.label}
          </strong>

          <small>
            {service.priceLabel}
          </small>
        </div>
      </div>

      {service.description && (
        <p>
          {service.description}
        </p>
      )}
    </article>
  );
}

function WoodCrateSummary({
  summary,
}) {
  if (!summary?.enabled) {
    return null;
  }

  return (
    <section className="consignment-confirm-wood-summary is-order-scope">
      <div className="consignment-confirm-wood-summary__header">
        <div className="consignment-confirm-wood-summary__icon">
          <SafetyCertificateOutlined />
        </div>

        <div className="consignment-confirm-wood-summary__title">
          <span>
            CHI PHÍ ĐÓNG THÙNG GỖ
          </span>

          <h3>
            Phí dịch vụ tính một lần cho toàn bộ đơn
          </h3>

          <p>
            Phí 35.000 ₫ không nhân theo số kiện.
            Mỗi kiện chỉ cộng thêm giá kích thước
            thùng đã chọn cho sản phẩm đó.
          </p>
        </div>

        <Tag className="consignment-confirm-wood-summary__count">
          {summary.selectedCount}/
          {summary.packageCount} kiện đã chọn thùng
        </Tag>
      </div>

      <div className="consignment-confirm-wood-summary__pricing">
        <div className="consignment-confirm-wood-price-card is-order-fee">
          <PriceInfoLabel
            label="Phí dịch vụ đóng thùng gỗ"
            tooltip="Khoản phí cố định được tính một lần cho toàn bộ đơn ký gửi, không nhân với số lượng kiện."
          />

          <strong>
            {formatVnd(
              summary.orderServiceFee,
            )}
          </strong>

          <small>
            Tính 1 lần / toàn bộ đơn
          </small>
        </div>

        <div className="consignment-confirm-wood-price-card is-box-fee">
          <PriceInfoLabel
            label="Tổng giá thùng theo kiện"
            tooltip="Tổng giá SMALL, MEDIUM, LARGE hoặc CUSTOM đã chọn riêng cho từng kiện hàng."
          />

          <strong>
            {formatVnd(
              summary.configurationFee,
            )}
          </strong>

          <small>
            Cộng giá thùng của từng sản phẩm
          </small>
        </div>

        <div className="consignment-confirm-wood-price-card is-total">
          <PriceInfoLabel
            label="Tổng phí đóng thùng gỗ"
            tooltip="Phí dịch vụ toàn đơn cộng tổng giá cấu hình thùng của tất cả kiện."
          />

          <strong>
            {formatVnd(
              summary.totalFee,
            )}
          </strong>

          <small>
            Phí toàn đơn + giá thùng từng kiện
          </small>
        </div>
      </div>

      {summary.rows.length > 0 && (
        <div className="consignment-confirm-wood-breakdown">
          <div className="consignment-confirm-wood-breakdown__title">
            <div>
              <strong>
                Chi tiết kích thước thùng theo sản phẩm
              </strong>

              <span>
                Mỗi dòng tương ứng một kiện hàng.
              </span>
            </div>
          </div>

          <div className="consignment-confirm-wood-breakdown__list">
            {summary.rows.map(
              (row) => (
                <div
                  key={row.packageId}
                  className="consignment-confirm-wood-breakdown__row"
                >
                  <span className="consignment-confirm-wood-breakdown__index">
                    {row.packageIndex}
                  </span>

                  <div className="consignment-confirm-wood-breakdown__product">
                    <strong>
                      {row.productName}
                    </strong>

                    <small>
                      Kiện: {row.packageDimensions}
                    </small>
                  </div>

                  <div className="consignment-confirm-wood-breakdown__configuration">
                    <Tag>
                      {row.configurationSize}
                    </Tag>

                    <span>
                      {row.configurationName}
                    </span>

                    <small>
                      Thùng: {row.configurationDimensions}
                    </small>
                  </div>

                  <strong className="consignment-confirm-wood-breakdown__fee">
                    {formatVnd(
                      row.packageFee,
                    )}
                  </strong>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <div className="consignment-confirm-wood-summary__note">
        <InfoCircleOutlined />

        <span>
          Phí dịch vụ đóng thùng gỗ chỉ xuất hiện một
          lần trong tổng đơn. Giá hiển thị tại từng kiện
          bên dưới chỉ là giá kích thước thùng của kiện đó.
        </span>
      </div>
    </section>
  );
}

function PackageConfigurationCard({
  pkg,
  packageIndex,
  selectedConfiguration,
}) {
  if (!selectedConfiguration) {
    return null;
  }

  const {
    name,
    size,
  } = getConfigurationDisplay(
    selectedConfiguration,
  );

  const packageFee =
    getConfigurationFee(
      selectedConfiguration,
    );

  const productName =
    String(
      pkg?.productName ||
        `Kiện hàng ${packageIndex}`,
    ).trim();

  const isCustomConfiguration =
    normalizeCode(
      selectedConfiguration
        ?.configCode,
    ) === "CUSTOM";

  const boxLength =
    isCustomConfiguration
      ? pkg?.length
      : selectedConfiguration
          ?.length;

  const boxWidth =
    isCustomConfiguration
      ? pkg?.width
      : selectedConfiguration
          ?.width;

  const boxHeight =
    isCustomConfiguration
      ? pkg?.height
      : selectedConfiguration
          ?.height;

  return (
    <section className="confirm-box-config">
      <div className="confirm-box-config__header">
        <div className="confirm-box-config__title">
          <span className="confirm-box-config__icon">
            <SafetyCertificateOutlined />
          </span>

          <div>
            <small>
              THÔNG TIN CẤU HÌNH ĐÓNG THÙNG
            </small>

            <h4>
              {productName}
            </h4>

            <p>
              Cấu hình đã chọn cho kiện{" "}
              {packageIndex}
            </p>
          </div>
        </div>

        <Tag className="confirm-box-config__size">
          {size}
        </Tag>
      </div>

      <div className="confirm-box-config__content">
        <div className="confirm-box-config__main">
          <span>
            Loại thùng
          </span>

          <strong>
            {name}
          </strong>

          <p>
            {isCustomConfiguration
              ? "Thùng được đóng theo kích thước thực tế của kiện hàng."
              : "Kích thước thùng được lấy từ cấu hình đã chọn trên hệ thống."}
          </p>
        </div>

        <div className="confirm-box-config__dimensions">
          <div>
            <span>Chiều dài thùng</span>

            <strong>
              {formatNumber(
                boxLength,
              )}{" "}
              cm
            </strong>
          </div>

          <div>
            <span>Chiều rộng thùng</span>

            <strong>
              {formatNumber(
                boxWidth,
              )}{" "}
              cm
            </strong>
          </div>

          <div>
            <span>Chiều cao thùng</span>

            <strong>
              {formatNumber(
                boxHeight,
              )}{" "}
              cm
            </strong>
          </div>

          <div>
            <span>Tải trọng tối đa</span>

            <strong>
              {formatNumber(
                selectedConfiguration
                  ?.maxWeight,
              )}{" "}
              kg
            </strong>
          </div>
        </div>

        <div className="confirm-box-config__price">
          <span>
            Giá thùng của kiện này
          </span>

          <strong>
            {formatVnd(packageFee)}
          </strong>

          <small>
            Không bao gồm phí dịch vụ đóng
            thùng gỗ tính một lần cho toàn đơn.
          </small>
        </div>
      </div>

      <div className="confirm-box-config__note">
        <InfoCircleOutlined />

        <span>
          Phí 35.000 ₫ của dịch vụ đóng
          thùng gỗ chỉ tính một lần cho đơn.
          Khu vực này chỉ hiển thị giá kích
          thước thùng của sản phẩm.
        </span>
      </div>
    </section>
  );
}

export default function ConsignmentOrderConfirm({
  form = {},
  packages = [],
  routeOptions = [],
  shippingOptions = [],
  productTypeOptions = [],
  pricingRules = [],
  packageConfigurations = [],
  masterDataLoading = false,
  masterDataError = "",
  isSubmitting,
  submitMessage,
  onBack,
  onConfirm,
}) {
  const loadingProgress =
    useMemo(
      () =>
        getLoadingProgress(
          submitMessage,
        ),
      [submitMessage],
    );

  const loadingStage = useMemo(
    () =>
      getLoadingStage(
        loadingProgress,
      ),
    [loadingProgress],
  );

  useEffect(() => {
    if (!isSubmitting) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isSubmitting]);

  const normalizedPricingRules =
    useMemo(
      () =>
        (
          Array.isArray(pricingRules)
            ? pricingRules
            : []
        ).map(
          normalizePricingRule,
        ),
      [pricingRules],
    );

  const normalizedConfigurations =
    useMemo(
      () =>
        (
          Array.isArray(
            packageConfigurations,
          )
            ? packageConfigurations
            : []
        ).map(
          normalizeConfiguration,
        ),
      [packageConfigurations],
    );

  const pricingRuleById = useMemo(
    () =>
      new Map(
        normalizedPricingRules.map(
          (rule) => [
            normalizeId(rule.id),
            rule,
          ],
        ),
      ),
    [normalizedPricingRules],
  );

  const pricingRuleByCode =
    useMemo(
      () =>
        new Map(
          normalizedPricingRules.map(
            (rule) => [
              rule.ruleCode,
              rule,
            ],
          ),
        ),
      [normalizedPricingRules],
    );

  const configurationById =
    useMemo(
      () =>
        new Map(
          normalizedConfigurations.map(
            (configuration) => [
              normalizeId(
                configuration.id,
              ),
              configuration,
            ],
          ),
        ),
      [normalizedConfigurations],
    );

  const optionalServices = useMemo(
    () => form.optionalServices || {},
    [form.optionalServices],
  );

  /*
   * Đây là nguồn sự thật duy nhất để quyết định có hiển thị
   * dịch vụ, phí và kích thước thùng gỗ hay không.
   * Dữ liệu packageConfigurationId do API gợi ý trả về không
   * được phép tự kích hoạt giao diện đóng thùng.
   */
  const woodCrateSelected =
    optionalServices
      ?.requiresWoodenCrate === true;

  const woodCrateOrderFee =
    useMemo(
      () =>
        getWoodCrateOrderFee({
          optionalServices,
          pricingRuleByCode,
        }),
      [
        optionalServices,
        pricingRuleByCode,
      ],
    );

  const selectedServices =
    useMemo(() => {
      const selectedRuleCodes = [
        optionalServices?.selectedRuleCodes,
        optionalServices?.selectedPricingRuleCodes,
        optionalServices?.pricingRuleCodes,
        optionalServices?.selectedServiceCodes,
        optionalServices?.serviceCodes,
      ]
        .filter(Array.isArray)
        .flat();

      const selectedPricingRuleIds = [
        optionalServices?.selectedPricingRuleIds,
        optionalServices?.pricingRuleIds,
        optionalServices?.selectedServiceIds,
        optionalServices?.serviceIds,
      ]
        .filter(Array.isArray)
        .flat();

      const selectedRuleObjects = [
        optionalServices?.selectedRules,
        optionalServices?.selectedPricingRules,
        optionalServices?.selectedServices,
        optionalServices?.services,
      ]
        .filter(Array.isArray)
        .flat()
        .filter(
          (item) =>
            item &&
            typeof item === "object",
        );

      const serviceMap = new Map();

      const findRuleByCode = (rawCode) => {
        const code = normalizeCode(rawCode);

        if (!code) {
          return null;
        }

        return (
          pricingRuleByCode.get(code) ||
          normalizedPricingRules.find(
            (rule) =>
              rule.ruleCode === code ||
              rule.ruleType === code,
          ) ||
          null
        );
      };

      const appendCode = (
        rawCode,
        fallback = {},
      ) => {
        const requestedCode =
          normalizeCode(rawCode);

        if (
          !requestedCode ||
          HIDDEN_SERVICE_CODES.has(
            requestedCode,
          )
        ) {
          return;
        }

        /*
         * WOOD_CRATE chỉ được xem là đã chọn khi cờ
         * requiresWoodenCrate thực sự bằng true.
         * Vì vậy dữ liệu gợi ý thùng còn sót lại hoặc
         * selectedRuleCodes cũ không thể tự làm dịch vụ
         * đóng thùng gỗ xuất hiện trên màn hình xác nhận.
         */
        if (
          isWoodCrateServiceCode(
            requestedCode,
          ) &&
          !woodCrateSelected
        ) {
          return;
        }

        const rule =
          findRuleByCode(requestedCode) ||
          fallback?.rule ||
          null;

        const normalizedRule =
          rule
            ? normalizePricingRule(
                rule,
              )
            : null;

        const code =
          normalizeCode(
            normalizedRule?.ruleCode ||
              requestedCode,
          );

        if (
          !code ||
          HIDDEN_SERVICE_CODES.has(code)
        ) {
          return;
        }

        if (
          isWoodCrateServiceCode(code) &&
          !woodCrateSelected
        ) {
          return;
        }

        serviceMap.set(code, {
          code,
          label: getServiceLabel(
            code,
            normalizedRule?.ruleName ||
              fallback?.label,
          ),
          description:
            SERVICE_DESCRIPTIONS[code] ||
            (
              hasVietnameseCharacters(
                normalizedRule
                  ?.description,
              )
                ? normalizedRule
                    ?.description
                : ""
            ) ||
            fallback?.description ||
            "",
          priceLabel:
            fallback?.priceLabel ||
            getRulePriceLabel(
              normalizedRule,
            ),
        });
      };

      selectedRuleCodes.forEach(
        (code) => appendCode(code),
      );

      selectedPricingRuleIds.forEach(
        (id) => {
          const rule =
            pricingRuleById.get(
              normalizeId(id),
            );

          if (rule) {
            appendCode(
              rule.ruleCode,
              { rule },
            );
          }
        },
      );

      selectedRuleObjects.forEach(
        (item) => {
          const rawCode =
            item?.ruleCode ||
            item?.code ||
            item?.serviceCode ||
            item?.ruleType;

          if (rawCode) {
            appendCode(rawCode, {
              rule: item,
              label:
                item?.ruleName ||
                item?.name ||
                item?.label,
              description:
                item?.description,
              priceLabel:
                item?.priceLabel,
            });
            return;
          }

          const rawId =
            item?.id ||
            item?.pricingRuleId ||
            item?.serviceId;

          const rule =
            pricingRuleById.get(
              normalizeId(rawId),
            );

          if (rule) {
            appendCode(
              rule.ruleCode,
              { rule },
            );
          }
        },
      );

      if (woodCrateSelected) {
        appendCode(
          "WOOD_CRATE",
          {
            priceLabel:
              woodCrateOrderFee > 0
                ? `${formatVnd(
                    woodCrateOrderFee,
                  )} / toàn bộ đơn`
                : undefined,
          },
        );
      }

      if (
        optionalServices
          ?.requiresInspection ||
        form.inspectPackage
      ) {
        appendCode(
          "SUR_INSPECTION",
        );
      }

      if (
        optionalServices
          ?.requiresInsurance
      ) {
        const insuranceRule =
          normalizedPricingRules.find(
            (rule) =>
              rule.ruleCode.includes(
                "INSURANCE",
              ) ||
              rule.ruleType.includes(
                "INSURANCE",
              ),
          );

        appendCode(
          insuranceRule?.ruleCode ||
            "INSURANCE",
          {
            rule: insuranceRule,
          },
        );
      }

      if (
        optionalServices
          ?.requiresPacking
      ) {
        appendCode("PACKING");
      }

      return Array.from(
        serviceMap.values(),
      );
    }, [
      form.inspectPackage,
      normalizedPricingRules,
      optionalServices,
      pricingRuleByCode,
      pricingRuleById,
      woodCrateOrderFee,
      woodCrateSelected,
    ]);

  const selectedConfigurationByPackage =
    useMemo(() => {
      const selectedMap = new Map();

      /*
       * Không chọn đóng thùng gỗ thì bỏ qua toàn bộ cấu hình thùng,
       * kể cả packageConfigurationId đã từng được API AI gợi ý.
       */
      if (!woodCrateSelected) {
        return selectedMap;
      }

      const savedList =
        Array.isArray(
          optionalServices
            ?.selectedPackageConfigurations,
        )
          ? optionalServices
              .selectedPackageConfigurations
          : [];

      const configurationIdMap =
        optionalServices
          ?.packageConfigurationByPackageId &&
        typeof optionalServices
          .packageConfigurationByPackageId ===
          "object"
          ? optionalServices
              .packageConfigurationByPackageId
          : {};

      packages.forEach(
        (pkg, index) => {
          const packageId =
            String(
              pkg?.id ||
                pkg?.packageId ||
                `package-${index + 1}`,
            ).trim();

          const savedItem =
            savedList.find(
              (item) =>
                String(
                  item?.packageId ||
                    "",
                ).trim() ===
                packageId,
            ) || null;

          const configurationId =
            String(
              pkg
                ?.packageConfigurationId ||
                savedItem
                  ?.packageConfigurationId ||
                configurationIdMap[
                  packageId
                ] ||
                "",
            ).trim();

          const apiConfiguration =
            configurationById.get(
              normalizeId(
                configurationId,
              ),
            ) || null;

          const mergedConfiguration =
            apiConfiguration ||
            (
              savedItem &&
              typeof savedItem ===
                "object"
                ? normalizeConfiguration(
                    savedItem,
                  )
                : null
            );

          if (
            mergedConfiguration
          ) {
            selectedMap.set(
              packageId,
              {
                ...mergedConfiguration,
                ...savedItem,
                id:
                  mergedConfiguration.id ||
                  configurationId,
              },
            );
          }
        },
      );

      return selectedMap;
    }, [
      configurationById,
      optionalServices,
      packages,
      woodCrateSelected,
    ]);

  const missingWoodCratePackages = useMemo(() => {
    if (!woodCrateSelected) {
      return [];
    }

    return packages
      .map((pkg, index) => ({
        packageId: getPackageId(pkg, index),
        packageIndex: index + 1,
        productName: String(
          pkg?.productName || `Kiện hàng ${index + 1}`,
        ).trim(),
      }))
      .filter(
        (item) =>
          !selectedConfigurationByPackage.has(item.packageId),
      );
  }, [
    packages,
    selectedConfigurationByPackage,
    woodCrateSelected,
  ]);

  const woodCrateSelectionComplete =
    !woodCrateSelected ||
    (packages.length > 0 &&
      missingWoodCratePackages.length === 0);

  const woodCratePricingSummary =
    useMemo(
      () =>
        calculateWoodCrateSummary({
          optionalServices,
          packages,
          selectedConfigurationByPackage,
          pricingRuleByCode,
        }),
      [
        optionalServices,
        packages,
        selectedConfigurationByPackage,
        pricingRuleByCode,
      ],
    );

  const totals = useMemo(
    () =>
      packages.reduce(
        (result, pkg) => ({
          quantity:
            result.quantity +
            Number(
              pkg.quantity || 0,
            ),

          weight:
            result.weight +
            Number(
              pkg.weight || 0,
            ),

          declaredValue:
            result.declaredValue +
            Number(
              pkg.declaredValue ||
                0,
            ),

          volume:
            result.volume +
            calculatePackageVolume(
              pkg,
            ),

          images:
            result.images +
            normalizePackageImages(
              pkg,
            ).length,
        }),
        {
          quantity: 0,
          weight: 0,
          declaredValue: 0,
          volume: 0,
          images: 0,
        },
      ),
    [packages],
  );

  const routeLabel =
    getOptionLabel(
      routeOptions,
      form.route,
      "route",
    );

  const shippingLabel =
    getOptionLabel(
      shippingOptions,
      form.shippingOption,
      "shipping",
    );

  const receiverAddress =
    normalizeFullAddress(
      form
        ?.selectedDeliveryAddress,
    ) ||
    normalizeFullAddress(
      form?.receiverAddress,
    );

  const inspectionRequested =
    Boolean(form?.inspectPackage) ||
    Boolean(
      optionalServices
        ?.requiresInspection,
    );

  return (
    <div className="consignment-confirm-page">
      <div className="consignment-confirm-shell">
        <div className="consignment-confirm-topbar">
          <button
            type="button"
            className="consignment-confirm-back"
            disabled={isSubmitting}
            onClick={onBack}
          >
            <LeftOutlined />
            QUAY LẠI CHỈNH SỬA
          </button>

          <div className="consignment-confirm-status">
            <CheckCircleOutlined />
            THÔNG TIN ĐÃ HỢP LỆ
          </div>
        </div>

        <div className="consignment-confirm-hero">
          <div className="consignment-confirm-hero-icon">
            <ShoppingOutlined />
          </div>

          <div className="consignment-confirm-hero-copy">
            <span className="consignment-confirm-hero-eyebrow">
              XÁC NHẬN ĐƠN KÝ GỬI
            </span>

            <h1>
              Kiểm tra lại toàn bộ thông tin
              trước khi tạo đơn
            </h1>

            <p>
              Hãy kiểm tra người nhận, tuyến vận
              chuyển, dịch vụ bổ sung, giá đóng
              thùng và thông tin từng kiện.
            </p>
          </div>

          <div className="consignment-confirm-hero-stats">
            <div>
              <span>Số kiện</span>
              <strong>
                {packages.length}
              </strong>
            </div>

            <div>
              <span>Dịch vụ</span>
              <strong>
                {
                  selectedServices.length
                }
              </strong>
            </div>

            <div>
              <span>Ảnh sản phẩm</span>
              <strong>
                {totals.images}
              </strong>
            </div>
          </div>
        </div>

        {masterDataLoading && (
          <div className="consignment-confirm-api-notice is-loading">
            <LoadingOutlined spin />

            <span>
              Đang tải tên dịch vụ, mức giá
              và cấu hình thùng...
            </span>
          </div>
        )}

        {!masterDataLoading &&
          masterDataError && (
            <div className="consignment-confirm-api-notice is-error">
              <InfoCircleOutlined />

              <span>
                Không thể tải đầy đủ tên dịch vụ,
                mức giá hoặc cấu hình thùng.
                Vui lòng quay lại và thử lại.
              </span>
            </div>
          )}

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <EnvironmentOutlined />
            </span>

            <div>
              <h2>
                Thông tin giao nhận
              </h2>

              <p>
                Tuyến vận chuyển và thông tin
                người nhận cuối cùng.
              </p>
            </div>
          </div>

          <div className="consignment-confirm-summary-grid">
            <SummaryItem
              label="Tuyến hàng"
              value={routeLabel}
              tone="route"
            />

            <SummaryItem
              label="Hình thức vận chuyển"
              value={shippingLabel}
              tone="shipping"
            />

            <SummaryItem
              label="Người nhận"
              value={
                form.receiverName
              }
            />

            <SummaryItem
              label="Số điện thoại"
              value={
                form.receiverPhone
              }
            />

            <SummaryItem
              label="Địa chỉ nhận hàng"
              value={receiverAddress}
              fullWidth
            />

            <SummaryItem
              label="Yêu cầu kiểm hàng"
              value={
                inspectionRequested
                  ? "Có yêu cầu kiểm hàng"
                  : "Không yêu cầu kiểm hàng"
              }
              tone={
                inspectionRequested
                  ? "success"
                  : "neutral"
              }
            />

            <SummaryItem
              label="Số dịch vụ bổ sung"
              value={`${selectedServices.length} dịch vụ`}
              tone="service"
            />
          </div>
        </div>

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <SafetyCertificateOutlined />
            </span>

            <div>
              <h2>
                Dịch vụ bổ sung
              </h2>

              <p>
                Tên dịch vụ và mức giá được
                đối chiếu từ bảng giá hệ thống.
              </p>
            </div>
          </div>

          {selectedServices.length >
          0 ? (
            <div className="consignment-confirm-service-list">
              {selectedServices.map(
                (service) => (
                  <ServiceCard
                    key={
                      service.code
                    }
                    service={
                      service
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <div className="consignment-confirm-empty-service">
              Không sử dụng dịch vụ bổ sung.
            </div>
          )}

          {woodCrateSelected && (
            <>
              <WoodCrateSummary
                summary={
                  woodCratePricingSummary
                }
              />

              {!woodCrateSelectionComplete && (
                <div className="consignment-confirm-api-notice is-error">
                  <InfoCircleOutlined />
                  <span>
                    Đã chọn đóng thùng gỗ nên bắt buộc chọn kích thước cho tất cả kiện. Còn thiếu: {missingWoodCratePackages
                      .map((item) => item.productName)
                      .join(", ")}.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="consignment-confirm-totals">
          <div className="consignment-confirm-total-card is-package">
            <span>Tổng số kiện</span>

            <strong>
              {packages.length}
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-quantity">
            <span>
              Tổng số lượng sản phẩm
            </span>

            <strong>
              {formatNumber(
                totals.quantity,
              )}
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-weight">
            <span>
              Tổng khối lượng
            </span>

            <strong>
              {formatNumber(
                totals.weight,
              )}{" "}
              kg
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-volume">
            <span>
              Tổng thể tích
            </span>

            <strong>
              {formatNumber(
                totals.volume,
              )}{" "}
              cm³
            </strong>
          </div>

          <div className="consignment-confirm-total-card is-value">
            <span>
              Tổng giá trị khai báo
            </span>

            <strong>
              {formatVnd(
                totals.declaredValue,
              )}
            </strong>
          </div>

          {woodCrateSelected && (
            <div className="consignment-confirm-total-card is-wood-total">
              <span>
                Tổng phí đóng thùng
              </span>

              <strong>
                {formatVnd(
                  woodCratePricingSummary
                    .totalFee,
                )}
              </strong>
            </div>
          )}
        </div>

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <ShoppingOutlined />
            </span>

            <div>
              <h2>
                Danh sách kiện hàng
              </h2>

              <p>
                {woodCrateSelected
                  ? "Chi tiết sản phẩm, kích thước kiện, cấu hình thùng và hình ảnh."
                  : "Chi tiết sản phẩm, kích thước kiện và hình ảnh."}
              </p>
            </div>
          </div>

          <div className="consignment-confirm-package-list">
            {packages.map(
              (pkg, index) => {
                const packageVolume =
                  calculatePackageVolume(
                    pkg,
                  );

                const images =
                  normalizePackageImages(
                    pkg,
                  );

                const packageId =
                  getPackageId(
                    pkg,
                    index,
                  );

                const selectedConfiguration =
                  selectedConfigurationByPackage.get(
                    packageId,
                  ) || null;

                const productName =
                  String(
                    pkg?.productName ||
                      "Chưa có tên sản phẩm",
                  ).trim();

                const productTypeLabel =
                  getOptionLabel(
                    productTypeOptions,
                    pkg.productType,
                    "productType",
                  );

                return (
                  <article
                    key={packageId}
                    className="confirm-package-card"
                  >
                    <header className="confirm-package-card__header">
                      <div className="confirm-package-card__identity">
                        <span className="confirm-package-card__number">
                          {String(
                            index + 1,
                          ).padStart(
                            2,
                            "0",
                          )}
                        </span>

                        <div>
                          <small>
                            KIỆN HÀNG THỨ{" "}
                            {index + 1}
                          </small>

                          <h3>
                            {productName}
                          </h3>

                          <p>
                            {woodCrateSelected
                              ? "Kiểm tra hình ảnh, thông tin sản phẩm, kích thước kiện và cấu hình thùng trước khi xác nhận."
                              : "Kiểm tra hình ảnh, thông tin sản phẩm và kích thước kiện trước khi xác nhận."}
                          </p>
                        </div>
                      </div>

                      <div className="confirm-package-card__quick-stats">
                        <div>
                          <span>Số lượng</span>

                          <strong>
                            {formatNumber(
                              pkg.quantity,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Khối lượng</span>

                          <strong>
                            {formatNumber(
                              pkg.weight,
                            )}{" "}
                            kg
                          </strong>
                        </div>

                        <div className="is-value">
                          <span>
                            Giá trị khai báo
                          </span>

                          <strong>
                            {formatVnd(
                              pkg.declaredValue,
                            )}
                          </strong>
                        </div>
                      </div>
                    </header>

                    <div className="confirm-package-card__body">
                      <div className="confirm-package-overview">
                        <section className="confirm-package-media">
                          <div className="confirm-package-block-title">
                            <div>
                              <span>
                                HÌNH ẢNH SẢN PHẨM
                              </span>

                              <strong>
                                {images.length >
                                0
                                  ? `${images.length} ảnh đã tải lên`
                                  : "Chưa có hình ảnh"}
                              </strong>
                            </div>

                            <Tag>
                              KIỆN {index + 1}
                            </Tag>
                          </div>

                          {images.length > 0 ? (
                            <>
                              <Image.PreviewGroup>
                                <Carousel
                                  className="confirm-package-carousel"
                                  autoplay={
                                    images.length >
                                    1
                                  }
                                  autoplaySpeed={
                                    3200
                                  }
                                  pauseOnHover
                                  dots={
                                    images.length >
                                    1
                                  }
                                >
                                  {images.map(
                                    (
                                      image,
                                      imageIndex,
                                    ) => (
                                      <div
                                        key={
                                          image.id
                                        }
                                        className="confirm-package-carousel__slide"
                                      >
                                        <Image
                                          src={
                                            image.previewUrl
                                          }
                                          alt={`Ảnh ${
                                            imageIndex +
                                            1
                                          } của ${productName}`}
                                          className="confirm-package-carousel__image"
                                          preview={{
                                            mask:
                                              "Xem ảnh",
                                          }}
                                        />

                                        <span className="confirm-package-carousel__counter">
                                          Ảnh{" "}
                                          {imageIndex +
                                            1}
                                          /
                                          {
                                            images.length
                                          }
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </Carousel>
                              </Image.PreviewGroup>

                              <div className="confirm-package-media__footer">
                                <InfoCircleOutlined />

                                <span>
                                  Bấm vào ảnh để xem
                                  kích thước lớn.
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="confirm-package-media__empty">
                              <ShoppingOutlined />

                              <strong>
                                Chưa có hình ảnh
                              </strong>

                              <span>
                                Kiện hàng này chưa tải
                                lên ảnh sản phẩm.
                              </span>
                            </div>
                          )}
                        </section>

                        <section className="confirm-product-info">
                          <div className="confirm-package-block-title">
                            <div>
                              <span>
                                THÔNG TIN SẢN PHẨM
                              </span>

                              <strong>
                                Chi tiết kiện hàng
                              </strong>
                            </div>

                            <Tag className="confirm-product-info__type-tag">
                              {productTypeLabel}
                            </Tag>
                          </div>

                          <div className="confirm-product-info__grid">
                            <div className="is-product-name">
                              <span>
                                Tên sản phẩm
                              </span>

                              <strong>
                                {productName}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Loại hàng hóa
                              </span>

                              <strong>
                                {
                                  productTypeLabel
                                }
                              </strong>
                            </div>

                            <div>
                              <span>
                                Số lượng sản phẩm
                              </span>

                              <strong>
                                {formatNumber(
                                  pkg.quantity,
                                )}
                              </strong>
                            </div>

                            <div>
                              <span>
                                Khối lượng kiện
                              </span>

                              <strong>
                                {formatNumber(
                                  pkg.weight,
                                )}{" "}
                                kg
                              </strong>
                            </div>

                            <div className="is-tracking">
                              <span>
                                Mã vận đơn nội địa
                              </span>

                              <strong>
                                {pkg.trackingCode
                                  ?.trim() ||
                                  pkg
                                    ?.domesticTrackingCode
                                    ?.trim() ||
                                  "Chưa có mã vận đơn"}
                              </strong>
                            </div>

                            <div className="is-declared-value">
                              <span>
                                Giá trị khai báo
                              </span>

                              <strong>
                                {formatVnd(
                                  pkg.declaredValue,
                                )}
                              </strong>
                            </div>
                          </div>

                          <div className="confirm-package-dimensions">
                            <div className="confirm-package-dimensions__header">
                              <div>
                                <span>
                                  KÍCH THƯỚC KIỆN HÀNG
                                </span>

                                <strong>
                                  Dài × Rộng × Cao
                                </strong>
                              </div>

                              <small>
                                Đơn vị: cm
                              </small>
                            </div>

                            <div className="confirm-package-dimensions__grid">
                              <div className="is-length">
                                <span>
                                  Chiều dài
                                </span>

                                <strong>
                                  {formatNumber(
                                    pkg.length,
                                  )}
                                </strong>

                                <small>cm</small>
                              </div>

                              <div className="is-width">
                                <span>
                                  Chiều rộng
                                </span>

                                <strong>
                                  {formatNumber(
                                    pkg.width,
                                  )}
                                </strong>

                                <small>cm</small>
                              </div>

                              <div className="is-height">
                                <span>
                                  Chiều cao
                                </span>

                                <strong>
                                  {formatNumber(
                                    pkg.height,
                                  )}
                                </strong>

                                <small>cm</small>
                              </div>

                              <div className="is-volume">
                                <span>
                                  Thể tích
                                </span>

                                <strong>
                                  {formatNumber(
                                    packageVolume,
                                  )}
                                </strong>

                                <small>
                                  cm³
                                </small>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>

                      {woodCrateSelected &&
                        selectedConfiguration && (
                          <PackageConfigurationCard
                            pkg={pkg}
                            packageIndex={
                              index + 1
                            }
                            selectedConfiguration={
                              selectedConfiguration
                            }
                          />
                        )}

                      {woodCrateSelected &&
                        !selectedConfiguration && (
                          <div className="consignment-confirm-api-notice is-error">
                            <InfoCircleOutlined />
                            <span>
                              Kiện này chưa được chọn kích thước thùng gỗ. Vui lòng quay lại chỉnh sửa trước khi tạo đơn.
                            </span>
                          </div>
                        )}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </div>

        <div className="consignment-confirm-section">
          <div className="consignment-confirm-section-title">
            <span>
              <InfoCircleOutlined />
            </span>

            <div>
              <h2>Ghi chú chung</h2>

              <p>
                Thông tin bổ sung được gửi kèm
                yêu cầu ký gửi.
              </p>
            </div>
          </div>

          <p className="consignment-confirm-note">
            {form.note?.trim() ||
              "Không có ghi chú."}
          </p>
        </div>

        <div className="consignment-confirm-warning">
          <SafetyCertificateOutlined />

          <span>
            Sau khi xác nhận, hệ thống sẽ tải
            ảnh và gửi yêu cầu tạo đơn. Vui
            lòng không đóng, quay lại hoặc tải
            lại trang trong lúc xử lý.
          </span>
        </div>

        <div className="consignment-confirm-actions">
          <button
            type="button"
            className="consignment-confirm-button is-secondary"
            disabled={isSubmitting}
            onClick={onBack}
          >
            <LeftOutlined />
            QUAY LẠI CHỈNH SỬA
          </button>

          <button
            type="button"
            className="consignment-confirm-button is-primary"
            disabled={
              isSubmitting ||
              masterDataLoading ||
              !woodCrateSelectionComplete
            }
            onClick={onConfirm}
          >
            {isSubmitting ? (
              <>
                <LoadingOutlined spin />
                ĐANG TẠO ĐƠN...
              </>
            ) : !woodCrateSelectionComplete ? (
              <>
                <InfoCircleOutlined />
                CHƯA CHỌN ĐỦ KÍCH THƯỚC THÙNG
              </>
            ) : (
              <>
                <CheckCircleOutlined />
                XÁC NHẬN TẠO ĐƠN
              </>
            )}
          </button>
        </div>
      </div>

      {isSubmitting && (
        <div
          className="consignment-confirm-loading-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consignment-loading-title"
          aria-describedby="consignment-loading-description"
        >
          <div className="consignment-confirm-loading-card">
            <div className="consignment-confirm-loading-header">
              <div
                className="consignment-confirm-loading-visual"
                aria-hidden="true"
              >
                <span className="consignment-confirm-loading-orbit" />

                <span className="consignment-confirm-loading-icon">
                  <LoadingOutlined spin />
                </span>
              </div>

              <div className="consignment-confirm-loading-copy">
                <span className="consignment-confirm-loading-eyebrow">
                  HỆ THỐNG ĐANG XỬ LÝ
                </span>

                <h3 id="consignment-loading-title">
                  Đang tạo đơn ký gửi
                </h3>

                <p id="consignment-loading-description">
                  {translateSubmitMessage(
                    submitMessage,
                  )}
                </p>
              </div>
            </div>

            <div className="consignment-confirm-loading-progress">
              <div className="consignment-confirm-loading-progress-info">
                <span>
                  Tiến trình xử lý
                </span>

                <strong>
                  {loadingProgress}%
                </strong>
              </div>

              <div
                className="consignment-confirm-loading-progress-track"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={
                  loadingProgress
                }
              >
                <span
                  style={{
                    width: `${loadingProgress}%`,
                  }}
                />
              </div>
            </div>

            <div className="consignment-confirm-loading-steps">
              {[
                "Kiểm tra dữ liệu",
                "Tải ảnh kiện hàng",
                "Gửi yêu cầu tạo đơn",
              ].map(
                (
                  stepLabel,
                  index,
                ) => {
                  const stepNumber =
                    index + 1;

                  const isCompleted =
                    loadingStage >
                    stepNumber;

                  const isActive =
                    loadingStage ===
                    stepNumber;

                  return (
                    <div
                      key={
                        stepLabel
                      }
                      className={[
                        "consignment-confirm-loading-step",
                        isCompleted &&
                          "is-completed",
                        isActive &&
                          "is-active",
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(" ")}
                    >
                      <span className="consignment-confirm-loading-step-dot">
                        {isCompleted ? (
                          <CheckCircleOutlined />
                        ) : (
                          stepNumber
                        )}
                      </span>

                      <span>
                        {stepLabel}
                      </span>
                    </div>
                  );
                },
              )}
            </div>

            <div className="consignment-confirm-loading-safe-note">
              <SafetyCertificateOutlined />

              <span>
                Dữ liệu đang được xử lý an
                toàn. Vui lòng không đóng,
                quay lại hoặc tải lại trang.
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
