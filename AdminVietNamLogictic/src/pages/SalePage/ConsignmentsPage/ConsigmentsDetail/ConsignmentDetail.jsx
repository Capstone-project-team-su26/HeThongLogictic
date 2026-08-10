import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Button,
  Empty,
  Input,
  Modal,
  Skeleton,
  Tag,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  InboxOutlined,
  LeftOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
  RightOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShoppingOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  getConsignmentDetailApi,
  updateConsignmentStatusApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import {
  getProductTypesApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/consignmentMasterService";
import {
  PRICING_RULE_CODE,
  findPricingRuleByCode,
  getActivePricingRulesApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import "./ConsignmentDetail.css";

/* =========================
   STATUS CONFIG
========================= */

const ORDER_STATUS_CONFIG = {
  PENDING: {
    label: "Chờ xử lý",
    className: "is-warning",
  },
  PENDING_REVIEW: {
    label: "Chờ duyệt",
    className: "is-warning",
  },
  ACCEPTED: {
    label: "Đã chấp nhận",
    className: "is-accepted",
  },
  APPROVED: {
    label: "Đã phê duyệt",
    className: "is-success",
  },
  REJECTED: {
    label: "Đã hủy",
    className: "is-danger",
  },
  QUOTATION_SENT: {
    label: "Đã gửi báo giá",
    className: "is-info",
  },
  QUOTATION_REJECTED: {
    label: "Báo giá bị từ chối",
    className: "is-danger",
  },
  WAITING_DEPOSIT: {
    label: "Chờ đặt cọc",
    className: "is-warning",
  },
  DEPOSIT_PAID: {
    label: "Đã đặt cọc",
    className: "is-success",
  },
  CHECKED_IN: {
    label: "Đã nhập kho",
    className: "is-info",
  },
  WAREHOUSE_RECEIVED: {
    label: "Đã nhận tại kho",
    className: "is-info",
  },
  RECEIVED: {
    label: "Đã tiếp nhận",
    className: "is-info",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "is-info",
  },
  IN_TRANSIT: {
    label: "Đang vận chuyển",
    className: "is-info",
  },
  CUSTOMS_CLEARANCE: {
    label: "Đang thông quan",
    className: "is-info",
  },
  READY_FOR_DELIVERY: {
    label: "Chờ giao hàng",
    className: "is-warning",
  },
  DELIVERING: {
    label: "Đang giao hàng",
    className: "is-info",
  },
  DELIVERED: {
    label: "Đã giao hàng",
    className: "is-success",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "is-success",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "is-danger",
  },
};

const QUOTATION_STATUS_CONFIG = {
  DRAFT: {
    label: "Bản nháp",
    className: "is-draft",
  },
  PENDING: {
    label: "Chờ xác nhận",
    className: "is-warning",
  },
  SENT: {
    label: "Đã gửi",
    className: "is-info",
  },
  ACCEPTED: {
    label: "Đã chấp nhận",
    className: "is-success",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "is-danger",
  },
  EXPIRED: {
    label: "Đã hết hạn",
    className: "is-danger",
  },
};

const DIM_DECIMAL_PLACES = 4;

/* =========================
   BASIC HELPERS
========================= */

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

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

const roundToDecimals = (
  value,
  decimals = DIM_DECIMAL_PLACES
) => {
  const number = normalizeNumber(value, 0);
  const factor = 10 ** decimals;

  return Math.round(
    (number + Number.EPSILON) * factor
  ) / factor;
};

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0 ₫";
  }

  const roundedAmount = Math.round(number);

  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(roundedAmount)} ₫`;
};

/**
 * Định dạng số đo linh hoạt:
 * 27   -> 27
 * 3.2  -> 3,2
 * 3.25 -> 3,25
 *
 * Không ép số 0 ở cuối.
 */
const formatMeasurement = (
  value,
  maximumFractionDigits = 4
) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  const safeDigits = Math.max(
    0,
    Math.min(
      10,
      Math.trunc(
        normalizeNumber(
          maximumFractionDigits,
          4
        )
      )
    )
  );

  const roundedNumber = Number(
    number.toFixed(safeDigits)
  );

  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits:
      safeDigits,
    useGrouping: true,
  }).format(roundedNumber);
};

/**
 * DIM giữ tối đa 4 chữ số thập phân nhưng không ép số 0 ở cuối.
 * 6      -> 6
 * 6.25   -> 6,25
 * 0.0016 -> 0,0016
 */
const formatDimWeight = (value) => {
  return formatMeasurement(
    roundToDecimals(
      value,
      DIM_DECIMAL_PLACES
    ),
    DIM_DECIMAL_PLACES
  );
};

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};


const STATUS_LABEL_MAP = {
  PENDING: "Chờ xử lý",
  PENDING_REVIEW: "Chờ duyệt",
  ACCEPTED: "Đã chấp nhận",
  APPROVED: "Đã phê duyệt",
  REJECTED: "Đã từ chối",
  QUOTATION_SENT: "Đã gửi báo giá",
  QUOTATION_REJECTED:
    "Báo giá bị từ chối",
  WAITING_DEPOSIT: "Chờ đặt cọc",
  DEPOSIT_PAID: "Đã đặt cọc",
  CHECKED_IN: "Đã nhập kho",
  RECEIVED: "Đã tiếp nhận",
  PROCESSING: "Đang xử lý",
  IN_TRANSIT: "Đang vận chuyển",
  CUSTOMS_CLEARANCE:
    "Đang thông quan",
  READY_FOR_DELIVERY:
    "Chờ giao hàng",
  DELIVERING: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  DRAFT: "Bản nháp",
  SENT: "Đã gửi",
  EXPIRED: "Đã hết hạn",
};

const translateStatusLabel = (
  value
) => {
  const normalizedStatus =
    normalizeText(value)
      .toUpperCase();

  if (!normalizedStatus) {
    return "Chưa xác định";
  }

  return (
    STATUS_LABEL_MAP[
    normalizedStatus
    ] ||
    "Trạng thái khác"
  );
};

const translateCountryName = (
  value
) => {
  const originalValue =
    normalizeText(value);

  const normalizedValue =
    originalValue
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(/Đ/g, "D")
      .replace(/đ/g, "d")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

  const countryMap = {
    CN: "Trung Quốc",
    CHINA: "Trung Quốc",
    TRUNGQUOC: "Trung Quốc",
    JP: "Nhật Bản",
    JAPAN: "Nhật Bản",
    NHATBAN: "Nhật Bản",
    KR: "Hàn Quốc",
    KOREA: "Hàn Quốc",
    SOUTHKOREA: "Hàn Quốc",
    HANQUOC: "Hàn Quốc",
    VN: "Việt Nam",
    VIETNAM: "Việt Nam",
  };

  return (
    countryMap[normalizedValue] ||
    originalValue ||
    "Chưa xác định"
  );
};

const translateRoute = (value) => {
  const routeText =
    normalizeText(value);

  if (!routeText) {
    return "Chưa xác định";
  }

  const routeParts = routeText
    .split(
      /\s*(?:-->|->|→|⇒|đến|to)\s*/i
    )
    .map((part) => part.trim())
    .filter(Boolean);

  if (routeParts.length >= 2) {
    return routeParts
      .map(translateCountryName)
      .join(" → ");
  }

  return translateCountryName(
    routeText
  );
};

const translateConsignmentType = (
  value
) => {
  const originalValue =
    normalizeText(value);

  const normalizedValue =
    originalValue
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const typeMap = {
    express: "Hỏa tốc",
    expedited: "Hỏa tốc",
    priority: "Ưu tiên",
    standard: "Tiêu chuẩn",
    normal: "Tiêu chuẩn",
    economy: "Tiết kiệm",
  };

  if (typeMap[normalizedValue]) {
    return typeMap[normalizedValue];
  }

  /*
   * Nếu API đã trả tiếng Việt thì giữ nguyên.
   * Không đưa mã tiếng Anh chưa dịch ra giao diện.
   */
  if (
    /[À-ỹ]/.test(
      originalValue
    )
  ) {
    return originalValue;
  }

  return originalValue
    ? "Loại dịch vụ khác"
    : "Chưa xác định";
};

const translateQuoteType = (
  value
) => {
  const quoteTypeMap = {
    ESTIMATE: "Báo giá tạm tính",
    TEMPORARY: "Báo giá tạm tính",
    OFFICIAL: "Báo giá chính thức",
  };

  const normalizedValue =
    normalizeText(value)
      .toUpperCase();

  return (
    quoteTypeMap[
    normalizedValue
    ] ||
    (normalizedValue
      ? "Loại báo giá khác"
      : "—")
  );
};

const isUuid = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalizeText(value)
  );
};

const translateCalculationType = (value) => {
  const typeMap = {
    FIXED: "Mức phí cố định",
    PERCENTAGE: "Tính theo tỷ lệ phần trăm",
  };

  const normalizedValue =
    normalizeText(value).toUpperCase();

  return (
    typeMap[normalizedValue] ||
    "Cách tính theo cấu hình hệ thống"
  );
};

const translateConditionType = (value) => {
  const conditionMap = {
    "": "Áp dụng theo cấu hình của đơn hàng",
    "VND/KIỆN": "Tính theo từng kiện hàng",
    FREIGHT_PLUS_SERVICE:
      "Tính trên phí vận chuyển quốc tế và phí dịch vụ",
    DECLARED_VALUE:
      "Tính trên tổng giá trị hàng hóa khai báo",
    MIN_DECLARED_VALUE:
      "Áp dụng khi giá trị hàng hóa đạt mức tối thiểu",
    REQUIRES_INSPECTION:
      "Áp dụng khi khách hàng yêu cầu kiểm hàng",
  };

  const normalizedValue =
    normalizeText(value).toUpperCase();

  return (
    conditionMap[normalizedValue] ||
    "Áp dụng theo điều kiện của hệ thống"
  );
};

const translatePackageConfiguration = (
  packageConfig
) => {
  const code = normalizeText(
    packageConfig?.configCode
  ).toUpperCase();

  const nameMap = {
    SMALL: "Thùng nhỏ",
    MEDIUM: "Thùng vừa",
    LARGE: "Thùng lớn",
    CUSTOM: "Đóng gói theo kích thước thực tế",
  };

  return (
    nameMap[code] ||
    normalizeText(packageConfig?.configName) ||
    "Cấu hình đóng gói"
  );
};

const formatSystemDescription = (value) => {
  return normalizeText(value)
    .replace(/FreightCharge/gi, "phí vận chuyển quốc tế")
    .replace(/ServiceFee/gi, "phí dịch vụ")
    .replace(/DOMESTIC_FEE/gi, "phí vận chuyển nội địa")
    .replace(/DeclaredValue/gi, "giá trị hàng hóa khai báo")
    .replace(/declared value/gi, "giá trị hàng hóa khai báo")
    .replace(/ImportTax/gi, "thuế nhập khẩu")
    .replace(/fallback/gi, "mức áp dụng mặc định")
    .replace(/WOOD_CRATE/gi, "đóng thùng gỗ")
    .replace(/SUR_INSPECTION/gi, "phí kiểm hàng")
    .replace(
      /SUR_INSURANCE_3PERCENT/gi,
      "phí bảo hiểm hàng hóa"
    )
    .replace(/VOLUMETRIC_DIVISOR/gi, "hệ số quy đổi thể tích")
    .replace(/VAT/gi, "thuế giá trị gia tăng");
};

const formatOrderNote = (value) => {
  const text = formatSystemDescription(value);

  return text || "Không có ghi chú";
};

const getOrderStatus = (status) => {
  const normalizedStatus =
    normalizeText(status)
      .toUpperCase();

  return (
    ORDER_STATUS_CONFIG[
    normalizedStatus
    ] || {
      label:
        translateStatusLabel(
          normalizedStatus
        ),
      className: "is-default",
    }
  );
};

const getQuotationStatus = (
  status
) => {
  const normalizedStatus =
    normalizeText(status)
      .toUpperCase();

  return (
    QUOTATION_STATUS_CONFIG[
    normalizedStatus
    ] || {
      label:
        translateStatusLabel(
          normalizedStatus
        ),
      className: "is-default",
    }
  );
};

const convertCm3ToM3 = (
  volumeCm3
) => {
  return (
    normalizePositiveNumber(
      volumeCm3
    ) / 1_000_000
  );
};

/* =========================
   ITEM HELPERS
========================= */

const getItemName = (item) => {
  return (
    normalizeText(item?.name) ||
    normalizeText(
      item?.productName
    ) ||
    normalizeText(
      item?.itemName
    ) ||
    "Sản phẩm"
  );
};

const getItemWeightKg = (item) => {
  return normalizePositiveNumber(
    item?.weight ??
    item?.actualWeight ??
    item?.totalWeight ??
    item?.weightKg
  );
};

const getItemLengthCm = (item) => {
  return normalizePositiveNumber(
    item?.length ??
    item?.lengthCm
  );
};

const getItemWidthCm = (item) => {
  return normalizePositiveNumber(
    item?.width ??
    item?.widthCm
  );
};

const getItemHeightCm = (item) => {
  return normalizePositiveNumber(
    item?.height ??
    item?.heightCm
  );
};

const getItemQuantity = (item) => {
  return Math.max(
    0,
    Math.trunc(
      normalizePositiveNumber(
        item?.quantity
      )
    )
  );
};

const getItemDeclaredValue = (item) => {
  return normalizePositiveNumber(
    item?.declaredValue
  );
};

const getItemDomesticTrackingCode = (
  item
) => {
  return normalizeText(
    item?.domesticTrackingCode ??
    item?.trackingNumber
  );
};


/* =========================
   IMAGE HELPERS
========================= */

const collectImageUrls = (source) => {
  if (
    source === undefined ||
    source === null ||
    source === ""
  ) {
    return [];
  }

  if (Array.isArray(source)) {
    return source.flatMap(
      collectImageUrls
    );
  }

  if (typeof source === "object") {
    const directUrl =
      source?.url ??
      source?.imageUrl ??
      source?.fileUrl ??
      source?.src ??
      source?.path ??
      source?.secureUrl;

    if (directUrl) {
      return collectImageUrls(
        directUrl
      );
    }

    return collectImageUrls(
      source?.images ??
      source?.urls ??
      source?.files ??
      source?.attachments ??
      []
    );
  }

  const text =
    normalizeText(source);

  if (!text) {
    return [];
  }

  if (
    (text.startsWith("[") &&
      text.endsWith("]")) ||
    (text.startsWith("{") &&
      text.endsWith("}"))
  ) {
    try {
      return collectImageUrls(
        JSON.parse(text)
      );
    } catch {
      // Tiếp tục dùng như URL thường.
    }
  }

  return [text];
};

const getItemImageUrls = (item) => {
  const sources = [
    item?.referenceUrls,
    item?.imageUrls,
    item?.images,
    item?.productImages,
    item?.referenceImages,
    item?.attachments,
    item?.imageUrl,
    item?.productImageUrl,
    item?.thumbnailUrl,
  ];

  return Array.from(
    new Set(
      sources
        .flatMap(collectImageUrls)
        .map(normalizeText)
        .filter(Boolean)
    )
  );
};

const getItemPackageConfiguration = (
  item
) => {
  return (
    item?.packageConfiguration ||
    null
  );
};

const getItemPackageFee = (item) => {
  const config = getItemPackageConfiguration(item);
  if (!config) return 0;

  const estimatedFee = Number(config?.estimatedFee);
  if (Number.isFinite(estimatedFee) && estimatedFee > 0) {
    return estimatedFee;
  }

  const baseFee = normalizePositiveNumber(config?.packageFee);
  if (baseFee <= 0) return 0;

  const maxFee = Number(config?.maxFee ?? config?.maxPackageFee);
  const hasMaxFee = Number.isFinite(maxFee) && maxFee > 0;

  const configCode = String(config?.configCode ?? "").toUpperCase();
  const isCustom = configCode === "CUSTOM" || configCode.includes("CUSTOM");

  if (isCustom) {
    const volumeCm3 = calculateItemVolumeCm3(item);
    if (volumeCm3 > 0) {
      const calculatedFee = Math.round((volumeCm3 / 1000) * baseFee);
      return hasMaxFee ? Math.min(calculatedFee, maxFee) : calculatedFee;
    }
  }

  return baseFee;
};

const getItemApiDimWeight = (item) => {
  const value = Number(
    item?.volumetricWeight
  );

  return Number.isFinite(value) &&
    value >= 0
    ? value
    : null;
};

const calculateItemVolumeCm3 = (
  item
) => {
  const length = getItemLengthCm(
    item
  );
  const width = getItemWidthCm(item);
  const height = getItemHeightCm(
    item
  );

  if (
    length <= 0 ||
    width <= 0 ||
    height <= 0
  ) {
    return 0;
  }

  /*
   * Mỗi dòng sản phẩm được tính là 1 kiện.
   * Không nhân thêm quantity.
   */
  return length * width * height;
};

const calculateItemDimKg = (
  item,
  divisor
) => {
  /*
   * Ưu tiên khối lượng quy đổi đã có trong dữ liệu kiện hàng.
   * Chỉ tự tính khi kiện hàng chưa có khối lượng quy đổi
   * và hệ thống có hệ số quy đổi hợp lệ.
   */
  const apiDimWeight =
    getItemApiDimWeight(item);

  if (apiDimWeight !== null) {
    return apiDimWeight;
  }

  const volumeCm3 =
    calculateItemVolumeCm3(item);

  const divisorValue =
    normalizePositiveNumber(divisor);

  if (
    volumeCm3 <= 0 ||
    divisorValue <= 0
  ) {
    return 0;
  }

  return volumeCm3 / divisorValue;
};

const getProductTypeId = (item) => {
  return normalizeText(
    item?.productTypeId ??
    item?.productTypeID ??
    item?.productType?.id ??
    item?.productType?.productTypeId
  );
};

const getProductTypeName = (
  item,
  productTypeMap
) => {
  /*
   * Ưu tiên tên loại hàng nếu dữ liệu chi tiết
   * đã trả trực tiếp productTypeName.
   */
  const directName =
    normalizeText(
      item?.productTypeName
    ) ||
    normalizeText(
      item?.productType?.name
    );

  if (directName) {
    return directName;
  }

  /*
   * Trường productType có thể là:
   * - Tên loại hàng, ví dụ "Điện tử"
   * - ID loại hàng dạng UUID
   */
  const productTypeValue =
    typeof item?.productType ===
      "string"
      ? normalizeText(
        item.productType
      )
      : "";

  if (productTypeValue) {
    const mappedName =
      productTypeMap.get(
        productTypeValue
      ) ||
      productTypeMap.get(
        productTypeValue.toLowerCase()
      );

    if (mappedName) {
      return mappedName;
    }

    return isUuid(productTypeValue)
      ? "Chưa phân loại"
      : productTypeValue;
  }

  const productTypeId =
    getProductTypeId(item);

  if (!productTypeId) {
    return "Chưa phân loại";
  }

  return (
    productTypeMap.get(
      productTypeId
    ) ||
    productTypeMap.get(
      productTypeId.toLowerCase()
    ) ||
    "Chưa phân loại"
  );
};

/* =========================
   COPY HELPER
========================= */

const copyText = async (value) => {
  const text = normalizeText(value);

  if (!text) {
    throw new Error(
      "Không có nội dung để sao chép."
    );
  }

  if (
    navigator?.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text
    );

    return;
  }

  const textArea =
    document.createElement(
      "textarea"
    );

  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";

  document.body.appendChild(
    textArea
  );

  textArea.focus();
  textArea.select();

  document.execCommand("copy");

  document.body.removeChild(
    textArea
  );
};

/* =========================
   SMALL COMPONENTS
========================= */


function ProductImageGallery({
  images = [],
  productName = "Sản phẩm",
}) {
  const [
    previewOpen,
    setPreviewOpen,
  ] = useState(false);

  const [
    activeIndex,
    setActiveIndex,
  ] = useState(0);

  const safeImages =
    Array.isArray(images)
      ? images.filter(Boolean)
      : [];

  const hasMultipleImages =
    safeImages.length > 1;

  const activeImage =
    safeImages[activeIndex] ||
    safeImages[0] ||
    "";

  const openPreview = (index) => {
    setActiveIndex(index);
    setPreviewOpen(true);
  };

  const showPreviousImage = () => {
    if (!hasMultipleImages) {
      return;
    }

    setActiveIndex(
      (currentIndex) =>
        currentIndex <= 0
          ? safeImages.length - 1
          : currentIndex - 1
    );
  };

  const showNextImage = () => {
    if (!hasMultipleImages) {
      return;
    }

    setActiveIndex(
      (currentIndex) =>
        currentIndex >=
          safeImages.length - 1
          ? 0
          : currentIndex + 1
    );
  };

  if (safeImages.length === 0) {
    return (
      <div className="consignment-product-image is-empty">
        <ShoppingOutlined />
      </div>
    );
  }

  return (
    <>
      <div
        className="consignment-product-gallery"
        aria-label={`Ảnh của ${productName}`}
      >
        {safeImages.map(
          (imageUrl, imageIndex) => (
            <button
              key={`${imageUrl}-${imageIndex}`}
              type="button"
              className="consignment-product-thumbnail"
              onClick={() =>
                openPreview(imageIndex)
              }
              title={`Xem ảnh ${imageIndex + 1
                } của ${productName}`}
              aria-label={`Xem ảnh ${imageIndex + 1
                } của ${productName}`}
            >
              <img
                src={imageUrl}
                alt={`${productName} - ảnh ${imageIndex + 1
                  }`}
                className="consignment-product-image"
                loading="lazy"
              />

              <span className="consignment-product-thumbnail__view">
                <EyeOutlined />
              </span>
            </button>
          )
        )}
      </div>

      <Modal
        open={previewOpen}
        centered
        width={920}
        footer={null}
        title={null}
        destroyOnHidden
        className="consignment-image-preview-modal"
        onCancel={() =>
          setPreviewOpen(false)
        }
      >
        <div className="consignment-image-preview">
          <div className="consignment-image-preview__header">
            <div>
              <span>
                THƯ VIỆN ẢNH SẢN PHẨM
              </span>

              <h3>
                {productName}
              </h3>
            </div>

            <strong>
              {activeIndex + 1}/
              {safeImages.length}
            </strong>
          </div>

          <div className="consignment-image-preview__stage">
            {hasMultipleImages && (
              <button
                type="button"
                className="consignment-image-preview__nav is-previous"
                onClick={
                  showPreviousImage
                }
                aria-label="Xem ảnh trước"
              >
                <LeftOutlined />
              </button>
            )}

            <img
              src={activeImage}
              alt={`${productName} - ảnh lớn ${activeIndex + 1
                }`}
              className="consignment-image-preview__main"
            />

            {hasMultipleImages && (
              <button
                type="button"
                className="consignment-image-preview__nav is-next"
                onClick={
                  showNextImage
                }
                aria-label="Xem ảnh tiếp theo"
              >
                <RightOutlined />
              </button>
            )}
          </div>

          <div className="consignment-image-preview__thumbnails">
            {safeImages.map(
              (
                imageUrl,
                imageIndex
              ) => (
                <button
                  key={`preview-${imageUrl}-${imageIndex}`}
                  type="button"
                  className={`consignment-image-preview__thumbnail ${activeIndex ===
                      imageIndex
                      ? "is-active"
                      : ""
                    }`}
                  onClick={() =>
                    setActiveIndex(
                      imageIndex
                    )
                  }
                  aria-label={`Chọn ảnh ${imageIndex + 1
                    }`}
                >
                  <img
                    src={imageUrl}
                    alt={`${productName} - ảnh thu nhỏ ${imageIndex + 1
                      }`}
                    loading="lazy"
                  />
                </button>
              )
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

function StatusBadge({
  label,
  className,
  icon,
}) {
  return (
    <Tag
      className={`consignment-detail-status ${className}`}
      icon={icon}
    >
      {label}
    </Tag>
  );
}

function DetailItem({
  icon,
  label,
  value,
  fullWidth = false,
  copyable = false,
}) {
  const displayValue =
    value === undefined ||
      value === null ||
      value === ""
      ? "—"
      : value;

  const handleCopy = async () => {
    try {
      await copyText(displayValue);

      AuthNotify.success(
        "Đã sao chép",
        `${label} đã được sao chép.`
      );
    } catch (error) {
      AuthNotify.error(
        "Không thể sao chép",
        error?.message ||
        "Vui lòng thử lại."
      );
    }
  };

  return (
    <div
      className={`consignment-detail-item ${fullWidth
          ? "is-full-width"
          : ""
        }`}
    >
      <div className="consignment-detail-item__icon">
        {icon}
      </div>

      <div className="consignment-detail-item__content">
        <span className="consignment-detail-item__label">
          {label}
        </span>

        <div className="consignment-detail-item__value-row">
          <strong className="consignment-detail-item__value">
            {displayValue}
          </strong>

          {copyable &&
            displayValue !== "—" && (
              <Tooltip title="Sao chép">
                <button
                  type="button"
                  className="consignment-copy-button"
                  onClick={handleCopy}
                  aria-label={`Sao chép ${label}`}
                >
                  <CopyOutlined />
                </button>
              </Tooltip>
            )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
  extra,
}) {
  return (
    <div className="consignment-section-heading">
      <div className="consignment-section-heading__left">
        <div className="consignment-section-heading__icon">
          {icon}
        </div>

        <div>
          <h2>{title}</h2>

          {description && (
            <p>{description}</p>
          )}
        </div>
      </div>

      {extra && (
        <div className="consignment-section-heading__extra">
          {extra}
        </div>
      )}
    </div>
  );
}

/* =========================
   LOADING
========================= */

function DetailLoading() {
  return (
    <div className="consignment-detail-page">
      <div className="consignment-detail-loading-header">
        <Skeleton.Button
          active
          size="small"
        />

        <Skeleton.Input
          active
          size="large"
        />
      </div>

      <div className="consignment-detail-skeleton-grid">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="consignment-detail-card"
          >
            <Skeleton
              active
              paragraph={{ rows: 5 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


export default function ConsignmentDetail({
  readOnly = false,
} = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const orderId =
    params?.orderId ||
    location?.state?.consignment?.orderId ||
    location?.state?.orderId ||
    "";

  const [detail, setDetail] = useState(null);
  const [productTypes, setProductTypes] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [masterDataWarning, setMasterDataWarning] = useState("");

  const [
    reviewModalOpen,
    setReviewModalOpen,
  ] = useState(false);

  const [
    reviewAction,
    setReviewAction,
  ] = useState("");

  const [
    rejectionReason,
    setRejectionReason,
  ] = useState("");

  const [
    statusUpdating,
    setStatusUpdating,
  ] = useState(false);

  const statusUpdateLockRef =
    useRef(false);

  const loadPageData = useCallback(async () => {
    if (!orderId) {
      setError("Không tìm thấy mã đơn ký gửi.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMasterDataWarning("");

      const [detailResult, productTypeResult, pricingRuleResult] =
        await Promise.allSettled([
          getConsignmentDetailApi(orderId),
          getProductTypesApi(),
          getActivePricingRulesApi(),
        ]);

      if (detailResult.status === "rejected") {
        throw detailResult.reason;
      }

      setDetail(detailResult.value || null);

      if (productTypeResult.status === "fulfilled") {
        setProductTypes(
          Array.isArray(productTypeResult.value)
            ? productTypeResult.value
            : []
        );
      } else {
        console.error(
          "GET PRODUCT TYPES ERROR:",
          productTypeResult.reason
        );
        setProductTypes([]);
      }

      if (pricingRuleResult.status === "fulfilled") {
        setPricingRules(
          Array.isArray(pricingRuleResult.value)
            ? pricingRuleResult.value
            : []
        );
      } else {
        console.error(
          "GET PRICING RULES ERROR:",
          pricingRuleResult.reason
        );
        setPricingRules([]);
      }

      const warningMessages = [];

      if (productTypeResult.status === "rejected") {
        warningMessages.push(
          "Không tải được danh sách loại hàng."
        );
      }

      if (pricingRuleResult.status === "rejected") {
        warningMessages.push(
          "Không tải được cấu hình tính phí và hệ số quy đổi. Vui lòng tải lại trang."
        );
      }

      setMasterDataWarning(warningMessages.join(" "));
    } catch (requestError) {
      console.error(
        "GET CONSIGNMENT DETAIL ERROR:",
        requestError
      );

      const message =
        requestError?.response?.data?.message ||
        requestError?.response?.data?.error ||
        requestError?.message ||
        "Không thể tải chi tiết yêu cầu ký gửi.";

      setError(message);

      AuthNotify.error(
        "Tải dữ liệu thất bại",
        message
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const orderStatus = useMemo(
    () => getOrderStatus(detail?.status),
    [detail?.status]
  );

  const quotationStatus = useMemo(
    () => getQuotationStatus(detail?.quotation?.status),
    [detail?.quotation?.status]
  );

  const quotation = detail?.quotation || null;

  const items = useMemo(() => {
    return Array.isArray(detail?.items)
      ? detail.items
      : [];
  }, [detail?.items]);

  const productTypeMap = useMemo(() => {
    return new Map(
      productTypes.flatMap((item) => {
        const id = normalizeText(item?.id);
        const name = normalizeText(item?.name);

        if (!id || !name) {
          return [];
        }

        return [
          [id, name],
          [id.toLowerCase(), name],
          [name, name],
          [name.toLowerCase(), name],
        ];
      })
    );
  }, [productTypes]);

  const dimRule = useMemo(() => {
    return findPricingRuleByCode(
      pricingRules,
      PRICING_RULE_CODE
        .VOLUMETRIC_DIVISOR
    );
  }, [pricingRules]);

  /*
   * Không sử dụng hệ số cố định trong mã nguồn.
   * Hệ số quy đổi phải được lấy từ cấu hình hệ thống.
   */
  const dimDivisor =
    normalizePositiveNumber(
      dimRule?.value
    );

  const hasApiDimDivisor =
    dimDivisor > 0;

  const packageCount = items.length;

  const totalQuantity = useMemo(() => {
    return items.reduce(
      (total, item) =>
        total + getItemQuantity(item),
      0
    );
  }, [items]);

  const totalItemWeightKg = useMemo(() => {
    return roundToDecimals(
      items.reduce(
        (total, item) =>
          total + getItemWeightKg(item),
        0
      ),
      DIM_DECIMAL_PLACES
    );
  }, [items]);

  const apiTotalWeightKg =
    normalizePositiveNumber(
      detail?.totalWeight
    );

  const displayTotalWeightKg =
    apiTotalWeightKg > 0
      ? apiTotalWeightKg
      : totalItemWeightKg;

  const calculatedItemsVolumeCm3 =
    useMemo(() => {
      return roundToDecimals(
        items.reduce(
          (total, item) =>
            total +
            calculateItemVolumeCm3(item),
          0
        ),
        DIM_DECIMAL_PLACES
      );
    }, [items]);

  const apiTotalVolumeCm3 =
    normalizePositiveNumber(
      detail?.totalVolume
    );

  const displayTotalVolumeCm3 =
    apiTotalVolumeCm3 > 0
      ? apiTotalVolumeCm3
      : calculatedItemsVolumeCm3;

  const totalVolumeM3 =
    convertCm3ToM3(
      displayTotalVolumeCm3
    );

  const totalDimKg = useMemo(() => {
    return roundToDecimals(
      items.reduce(
        (total, item) =>
          total +
          calculateItemDimKg(
            item,
            dimDivisor
          ),
        0
      ),
      DIM_DECIMAL_PLACES
    );
  }, [items, dimDivisor]);

  const chargeableWeightKg =
    roundToDecimals(
      Math.max(
        displayTotalWeightKg,
        totalDimKg
      ),
      DIM_DECIMAL_PLACES
    );

  const totalDeclaredValue =
    useMemo(() => {
      return items.reduce(
        (total, item) =>
          total +
          getItemDeclaredValue(item),
        0
      );
    }, [items]);

  const totalPackageFee =
    useMemo(() => {
      return items.reduce(
        (total, item) =>
          total +
          getItemPackageFee(item),
        0
      );
    }, [items]);

  const appliedPricingRuleIds =
    useMemo(() => {
      return new Set(
        Array.isArray(
          detail?.pricingRuleIds
        )
          ? detail.pricingRuleIds
            .map(normalizeText)
            .filter(Boolean)
          : []
      );
    }, [detail?.pricingRuleIds]);

  const quotationBreakdown =
    useMemo(() => {
      if (!quotation) {
        return null;
      }

      const freight =
        normalizePositiveNumber(
          quotation
            ?.estimatedFreightCharge
        );

      const domestic =
        normalizePositiveNumber(
          quotation
            ?.domesticShippingFee
        );

      const service =
        normalizePositiveNumber(
          quotation?.serviceFee
        );

      const tax =
        normalizePositiveNumber(
          quotation?.taxAndDuty
        );

      const total =
        normalizePositiveNumber(
          quotation
            ?.totalEstimatedCost
        );

      const componentTotal =
        roundToDecimals(
          freight +
          domestic +
          service +
          tax,
          2
        );

      return {
        freight,
        domestic,
        service,
        tax,
        total,
        componentTotal,
        difference:
          roundToDecimals(
            total - componentTotal,
            2
          ),
      };
    }, [quotation]);

  const currentOrderStatus =
    normalizeText(
      detail?.status ??
      detail?.orderStatus ??
      detail?.consignmentStatus
    ).toUpperCase();

  const currentQuotationStatus =
    normalizeText(
      detail?.quotation?.status ??
      detail?.quotationStatus ??
      detail?.quoteStatus
    ).toUpperCase();

  const currentPaymentStatus =
    normalizeText(
      detail?.paymentStatus ??
      detail?.depositStatus ??
      detail?.quotation?.paymentStatus ??
      detail?.quotation?.depositStatus
    ).toUpperCase();

  const allCurrentStatuses = [
    currentOrderStatus,
    currentQuotationStatus,
    currentPaymentStatus,
  ].filter(Boolean);

  /*
   * CHỜ DUYỆT:
   * Chỉ kiểm tra trạng thái của ĐƠN HÀNG.
   *
   * Không dùng quotation.status vì báo giá
   * có thể đang PENDING trong khi đơn đã là
   * QUOTATION_SENT. Trường hợp đó không được
   * hiển thị nút Hủy yêu cầu.
   */
  const canCancelPendingOrder = [
    "PENDING",
    "PENDING_REVIEW",
  ].includes(currentOrderStatus);

  /*
   * ĐÃ ĐẶT CỌC:
   * Có thể được trả ở order status hoặc
   * payment/deposit status.
   */
  const canConfirmDepositedOrder =
    currentOrderStatus ===
    "DEPOSIT_PAID" ||
    [
      "DEPOSIT_PAID",
      "PAID",
      "DEPOSITED",
      "PAYMENT_COMPLETED",
    ].includes(currentPaymentStatus);

  /*
   * Trạng thái hoàn tất thao tác phải dựa
   * vào trạng thái đơn hàng, không lấy trạng
   * thái báo giá để tránh hiển thị sai nút.
   */
  const isOrderCancelled = [
    "REJECTED",
    "CANCELLED",
  ].includes(currentOrderStatus);

  const isOrderConfirmed =
    currentOrderStatus ===
    "APPROVED";

  const canShowReviewActions =
    !readOnly &&
    (canCancelPendingOrder ||
      canConfirmDepositedOrder ||
      isOrderCancelled ||
      isOrderConfirmed);

  const hasQuotationBeenSent =
    currentOrderStatus ===
    "QUOTATION_SENT" ||
    currentOrderStatus ===
    "WAITING_DEPOSIT" ||
    currentOrderStatus ===
    "QUOTATION_REJECTED";

  const openReviewModal = (
    action
  ) => {
    const canOpenAction =
      action === "REJECT"
        ? canCancelPendingOrder &&
        !hasQuotationBeenSent
        : canConfirmDepositedOrder;

    if (
      !canOpenAction ||
      statusUpdating ||
      statusUpdateLockRef.current
    ) {
      AuthNotify.warning(
        "Không thể thực hiện thao tác",
        action === "REJECT"
          ? "Chỉ đơn đang chờ xử lý hoặc chờ duyệt mới có thể hủy. Đơn đã gửi báo giá không thể hủy tại đây."
          : "Chỉ yêu cầu đã đặt cọc mới có thể xác nhận."
      );
      return;
    }

    setReviewAction(action);
    setRejectionReason("");
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    if (
      statusUpdating ||
      statusUpdateLockRef.current
    ) {
      return;
    }

    setReviewModalOpen(false);
    setReviewAction("");
    setRejectionReason("");
  };

  const handleConfirmReviewStatus =
    async () => {
      const canSubmitAction =
        reviewAction === "REJECT"
          ? canCancelPendingOrder &&
          !hasQuotationBeenSent
          : canConfirmDepositedOrder;

      if (
        statusUpdating ||
        statusUpdateLockRef.current ||
        !canSubmitAction
      ) {
        return;
      }

      const nextStatus =
        reviewAction === "REJECT"
          ? "REJECTED"
          : "APPROVED";

      const normalizedReason =
        normalizeText(
          rejectionReason
        );

      if (
        nextStatus === "REJECTED" &&
        normalizedReason.length < 3
      ) {
        AuthNotify.warning(
          "Thiếu lý do hủy",
          "Vui lòng nhập lý do hủy ít nhất 3 ký tự."
        );
        return;
      }

      try {
        statusUpdateLockRef.current =
          true;
        setStatusUpdating(true);

        await updateConsignmentStatusApi(
          orderId,
          {
            status: nextStatus,
            rejectionReason:
              nextStatus === "REJECTED"
                ? normalizedReason
                : "",
          }
        );

        /*
         * Cập nhật giao diện ngay sau khi API thành công.
         */
        setDetail(
          (previousDetail) => ({
            ...previousDetail,
            status: nextStatus,
            rejectionReason:
              nextStatus === "REJECTED"
                ? normalizedReason
                : null,
          })
        );

        setReviewModalOpen(false);
        setReviewAction("");
        setRejectionReason("");

        AuthNotify.success(
          nextStatus === "APPROVED"
            ? "Xác nhận thành công"
            : "Hủy yêu cầu thành công",
          nextStatus === "APPROVED"
            ? "Yêu cầu ký gửi đã được xác nhận."
            : "Yêu cầu ký gửi đã được hủy."
        );

        /*
         * Đồng bộ lại dữ liệu mới nhất từ server.
         * Việc tải lại thất bại không làm mất kết quả cập nhật.
         */
        try {
          const refreshedDetail =
            await getConsignmentDetailApi(
              orderId
            );

          if (refreshedDetail) {
            setDetail(
              refreshedDetail
            );
          }
        } catch (
        refreshError
        ) {
          console.warn(
            "REFRESH CONSIGNMENT AFTER STATUS UPDATE ERROR:",
            refreshError
          );
        }
      } catch (requestError) {
        console.error(
          "UPDATE CONSIGNMENT STATUS ERROR:",
          requestError
        );

        const message =
          requestError?.response?.data
            ?.message ||
          requestError?.response?.data
            ?.error ||
          requestError?.message ||
          "Không thể cập nhật trạng thái yêu cầu ký gửi.";

        AuthNotify.error(
          "Cập nhật trạng thái thất bại",
          message
        );
      } finally {
        setStatusUpdating(false);
        statusUpdateLockRef.current =
          false;
      }
    };

  const terminalStatus = [
    "COMPLETED",
    "CANCELLED",
  ].includes(currentOrderStatus);

  const canOpenQuotationPage =
    Boolean(orderId) && !terminalStatus && !readOnly;

  const handleOpenQuotationPage = () => {
    if (!orderId) {
      AuthNotify.error(
        "Không thể mở báo giá",
        "Không tìm thấy mã đơn ký gửi."
      );
      return;
    }

    navigate(
      `/sale/consignments/${orderId}/create-quotation`,
      {
        state: {
          orderId,
          consignment: detail,
        },
      }
    );
  };

  if (loading) {
    return <DetailLoading />;
  }

  if (error || !detail) {
    return (
      <main className="consignment-detail-page">
        <div className="consignment-detail-error">
          <div className="consignment-detail-error__icon">
            <InboxOutlined />
          </div>

          <h2>
            Không thể hiển thị đơn ký gửi
          </h2>

          <p>
            {error ||
              "Không tìm thấy dữ liệu đơn ký gửi."}
          </p>

          <div className="consignment-detail-error__actions">
            <Button
              icon={
                <ArrowLeftOutlined />
              }
              onClick={() =>
                navigate(-1)
              }
            >
              Quay lại
            </Button>

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadPageData}
            >
              Tải lại
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="consignment-detail-page">
      {/* ================= HEADER ================= */}

      <div className="consignment-detail-topbar">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          className="consignment-back-button"
          onClick={() => navigate(-1)}
        >
          Quay lại danh sách
        </Button>

        {!readOnly && (
          <Button
            type="default"
            icon={<RobotOutlined />}
            onClick={() =>
              navigate("/sale/customer-service", {
                state: {
                  aiOrderCode:
                    detail?.consignmentCode || "",
                  aiCustomerId:
                    detail?.customer?.id ||
                    detail?.customer?.customerId ||
                    "",
                  aiCustomerName:
                    detail?.customer?.fullName || "",
                  aiRelatedType: "CONSIGNMENT",
                  aiRelatedId: orderId || "",
                },
              })
            }
          >
            Hỏi AI trạng thái
          </Button>
        )}
      </div>

      {masterDataWarning && (
        <div
          className="consignment-master-warning"
          role="alert"
        >
          <SafetyCertificateOutlined />

          <span>
            {masterDataWarning}
          </span>

          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            onClick={loadPageData}
          >
            Tải lại
          </Button>
        </div>
      )}

      <section className="consignment-detail-hero">
        <div className="consignment-detail-hero__main">
          <span className="consignment-detail-eyebrow">
            CHI TIẾT YÊU CẦU KÝ GỬI
          </span>

          <div className="consignment-detail-title-row">
            <div>
              <h1>
                {detail?.consignmentCode ||
                  "Đơn ký gửi"}
              </h1>

              <button
                type="button"
                className="consignment-code-copy"
                onClick={async () => {
                  try {
                    await copyText(
                      detail?.consignmentCode
                    );

                    AuthNotify.success(
                      "Đã sao chép",
                      "Mã yêu cầu ký gửi đã được sao chép."
                    );
                  } catch (copyError) {
                    AuthNotify.error(
                      "Không thể sao chép",
                      copyError?.message ||
                      "Vui lòng thử lại."
                    );
                  }
                }}
              >
                <CopyOutlined />
                Sao chép mã
              </button>
            </div>

            <StatusBadge
              label={orderStatus.label}
              className={
                orderStatus.className
              }
              icon={<SendOutlined />}
            />
          </div>

          <p className="consignment-detail-description">
            Theo dõi thông tin yêu cầu, người nhận,
            khách hàng, từng kiện hàng và báo giá.
          </p>
        </div>

        <div className="consignment-detail-hero__meta">
          <div>
            <CalendarOutlined />
            <span>Ngày tạo</span>

            <strong>
              {formatDateTime(
                detail?.createdAt
              )}
            </strong>
          </div>

          <div>
            <TagsOutlined />
            <span>Loại dịch vụ</span>

            <strong>
              {translateConsignmentType(
                detail?.consignmentType
              )}
            </strong>
          </div>
        </div>
      </section>

      {/* ================= SUMMARY ================= */}

      <section className="consignment-summary-grid">
        <article className="consignment-summary-card">
          <div className="consignment-summary-card__icon">
            <ShoppingOutlined />
          </div>

          <div>
            <span>Tổng trọng lượng</span>
            <strong>
              {formatMeasurement(
                displayTotalWeightKg,
                4
              )}{" "}
              kg
            </strong>
          </div>
        </article>

        <article className="consignment-summary-card">
          <div className="consignment-summary-card__icon">
            <InboxOutlined />
          </div>

          <div>
            <span>Số kiện / số lượng</span>
            <strong>
              {packageCount} kiện
            </strong>
            <small>
              {totalQuantity} sản phẩm
            </small>
          </div>
        </article>

        <article className="consignment-summary-card">
          <div className="consignment-summary-card__icon">
            <TagsOutlined />
          </div>

          <div>
            <span>Tổng thể tích</span>
            <strong>
              {formatMeasurement(
                displayTotalVolumeCm3,
                4
              )}{" "}
              cm³
            </strong>
            <small>
              {formatMeasurement(
                totalVolumeM3,
                6
              )}{" "}
              m³
            </small>
          </div>
        </article>

        <article className="consignment-summary-card is-dim">
          <div className="consignment-summary-card__icon">
            <FileTextOutlined />
          </div>

          <div>
            <span>Tổng khối lượng quy đổi</span>
            <strong>
              {formatMeasurement(
                totalDimKg,
                DIM_DECIMAL_PLACES
              )}{" "}
              kg
            </strong>
            <small>
              {hasApiDimDivisor
                ? `Hệ số quy đổi: ${formatMeasurement(
                  dimDivisor,
                  0
                )}`
                : "Chưa có hệ số quy đổi"}
            </small>
          </div>
        </article>

        <article className="consignment-summary-card is-chargeable">
          <div className="consignment-summary-card__icon">
            <SafetyCertificateOutlined />
          </div>

          <div>
            <span>Khối lượng tính cước</span>
            <strong>
              {formatMeasurement(
                chargeableWeightKg,
                4
              )}{" "}
              kg
            </strong>
            <small>
              Lấy mức lớn hơn giữa trọng lượng thực và khối lượng quy đổi
            </small>
          </div>
        </article>

        <article className="consignment-summary-card is-total">
          <div className="consignment-summary-card__icon">
            <DollarOutlined />
          </div>

          <div>
            <span>Tổng báo giá</span>
            <strong>
              {formatCurrency(
                quotation
                  ?.totalEstimatedCost
              )}
            </strong>
            <small>
              {quotation
                ? translateQuoteType(
                  quotation?.quoteType
                )
                : "Chưa có báo giá"}
            </small>
          </div>
        </article>
      </section>

      <div className="consignment-detail-layout">
        <div className="consignment-detail-main">
          {/* ================= SALE REVIEW ACTION ================= */}

          {canShowReviewActions && (
            <section className="consignment-detail-card consignment-review-card">
              <SectionTitle
                icon={<SafetyCertificateOutlined />}
                title={
                  isOrderCancelled
                    ? "Yêu cầu đã được hủy"
                    : isOrderConfirmed
                      ? "Yêu cầu đã được xác nhận"
                      : canConfirmDepositedOrder
                        ? "Xác nhận yêu cầu đã đặt cọc"
                        : "Xử lý yêu cầu đang chờ duyệt"
                }
                description={
                  isOrderCancelled
                    ? "Yêu cầu này đã được hủy và không thể thao tác lại."
                    : isOrderConfirmed
                      ? "Yêu cầu này đã được xác nhận và không thể xác nhận lại."
                      : canConfirmDepositedOrder
                        ? "Báo giá đã được đặt cọc. Nhân viên kinh doanh cần xác nhận để tiếp tục xử lý."
                        : "Yêu cầu đang chờ duyệt. Nhân viên kinh doanh chỉ có thể hủy yêu cầu."
                }
                extra={
                  <Tag className="consignment-review-card__status">
                    {isOrderCancelled
                      ? "Đã hủy"
                      : isOrderConfirmed
                        ? "Đã xác nhận"
                        : canConfirmDepositedOrder
                          ? "Đã đặt cọc"
                          : "Chờ duyệt"}
                  </Tag>
                }
              />

              <div className="consignment-review-card__content">
                <div className="consignment-review-card__message">
                  <div className="consignment-review-card__message-icon">
                    {isOrderCancelled ? (
                      <CloseCircleOutlined />
                    ) : (
                      <SafetyCertificateOutlined />
                    )}
                  </div>

                  <div>
                    <strong>
                      {isOrderCancelled
                        ? "Yêu cầu đã được hủy"
                        : isOrderConfirmed
                          ? "Yêu cầu đã được xác nhận"
                          : canConfirmDepositedOrder
                            ? "Kiểm tra khoản đặt cọc trước khi xác nhận"
                            : "Kiểm tra thông tin trước khi hủy"}
                    </strong>

                    <span>
                      {isOrderCancelled
                        ? "Nút hủy được giữ lại để thể hiện trạng thái nhưng đã bị khóa."
                        : isOrderConfirmed
                          ? "Nút xác nhận được giữ lại để thể hiện trạng thái nhưng đã bị khóa."
                          : canConfirmDepositedOrder
                            ? "Sau khi xác nhận, yêu cầu sẽ chuyển sang trạng thái Đã xác nhận."
                            : "Khi hủy yêu cầu, bạn bắt buộc phải nhập lý do để lưu trên hệ thống."}
                    </span>
                  </div>
                </div>

                <div className="consignment-review-card__actions">
                  {(canCancelPendingOrder ||
                    isOrderCancelled) && (
                      <Button
                        danger={!isOrderCancelled}
                        size="large"
                        icon={<CloseCircleOutlined />}
                        loading={
                          statusUpdating &&
                          reviewAction ===
                          "REJECT"
                        }
                        disabled={
                          statusUpdating ||
                          isOrderCancelled
                        }
                        onClick={() =>
                          openReviewModal(
                            "REJECT"
                          )
                        }
                        className="consignment-review-card__reject"
                        style={
                          isOrderCancelled
                            ? {
                              borderColor:
                                "#cbd5e1",
                              background:
                                "#e2e8f0",
                              color:
                                "#64748b",
                              opacity: 0.78,
                              cursor:
                                "not-allowed",
                              boxShadow:
                                "none",
                            }
                            : undefined
                        }
                      >
                        {isOrderCancelled
                          ? "Đã hủy yêu cầu"
                          : "Hủy yêu cầu"}
                      </Button>
                    )}

                  {(canConfirmDepositedOrder ||
                    isOrderConfirmed) && (
                      <Button
                        type="primary"
                        size="large"
                        icon={<CheckCircleOutlined />}
                        loading={
                          statusUpdating &&
                          reviewAction ===
                          "APPROVE"
                        }
                        disabled={
                          statusUpdating ||
                          isOrderConfirmed
                        }
                        onClick={() =>
                          openReviewModal(
                            "APPROVE"
                          )
                        }
                        className="consignment-review-card__approve"
                        style={
                          isOrderConfirmed
                            ? {
                              borderColor:
                                "#cbd5e1",
                              background:
                                "#e2e8f0",
                              color:
                                "#64748b",
                              opacity: 0.78,
                              cursor:
                                "not-allowed",
                              boxShadow:
                                "none",
                            }
                            : undefined
                        }
                      >
                        {isOrderConfirmed
                          ? "Đã xác nhận"
                          : "Xác nhận yêu cầu"}
                      </Button>
                    )}
                </div>
              </div>
            </section>
          )}

          {/* ================= QUOTATION ACTION ================= */}

          <section className="consignment-detail-card quotation-entry-card">
            <SectionTitle
              icon={<DollarOutlined />}
              title="Báo giá đơn hàng"
              description="Tạo và gửi báo giá cho đơn ký gửi trên màn hình riêng."
              extra={
                <Tag className="quotation-builder-status-tag">
                  {quotation
                    ? translateQuoteType(quotation?.quoteType)
                    : "Chưa có báo giá"}
                </Tag>
              }
            />

            <div className="quotation-entry-card__content">
              <div className="quotation-entry-card__icon">
                <DollarOutlined />
              </div>

              <div className="quotation-entry-card__text">
                <strong>
                  {quotation
                    ? "Xem và cập nhật báo giá"
                    : "Tạo báo giá cho đơn ký gửi"}
                </strong>

                <span>
                  Chuyển sang màn hình lập báo giá riêng để kiểm tra và gửi báo giá.
                </span>

                {terminalStatus && (
                  <small>
                    Không thể tạo báo giá cho đơn đã hoàn thành hoặc đã hủy.
                  </small>
                )}
              </div>

              <Button
                type="primary"
                size="large"
                icon={<DollarOutlined />}
                disabled={!canOpenQuotationPage}
                onClick={handleOpenQuotationPage}
                className="quotation-entry-card__button"
              >
                {quotation
                  ? "Mở màn hình báo giá"
                  : "Tạo báo giá"}
              </Button>
            </div>
          </section>

          {/* ================= ORDER ================= */}

          <section className="consignment-detail-card">
            <SectionTitle
              icon={<FileTextOutlined />}
              title="Thông tin yêu cầu"
              description="Thông tin vận chuyển và xử lý đơn ký gửi."
            />

            <div className="consignment-detail-info-grid">
              <DetailItem
                icon={<TagsOutlined />}
                label="Mã ký gửi"
                value={
                  detail?.consignmentCode
                }
                copyable
              />

              <DetailItem
                icon={<SendOutlined />}
                label="Loại dịch vụ"
                value={translateConsignmentType(
                  detail?.consignmentType
                )}
              />

              <DetailItem
                icon={
                  <EnvironmentOutlined />
                }
                label="Tuyến hàng"
                value={translateRoute(
                  detail?.route
                )}
                fullWidth
              />

              <DetailItem
                icon={<CalendarOutlined />}
                label="Ngày tạo"
                value={formatDateTime(
                  detail?.createdAt
                )}
              />

              <DetailItem
                icon={
                  <SafetyCertificateOutlined />
                }
                label="Yêu cầu kiểm hàng"
                value={
                  detail
                    ?.requiresInspection
                    ? "Có"
                    : "Không"
                }
              />

              <DetailItem
                icon={<InboxOutlined />}
                label="Tổng số kiện"
                value={`${packageCount} kiện`}
              />

              <DetailItem
                icon={<FileTextOutlined />}
                label="Hệ số quy đổi"
                value={
                  hasApiDimDivisor
                    ? formatMeasurement(
                      dimDivisor,
                      0
                    )
                    : "Chưa có dữ liệu"
                }
              />

              <DetailItem
                icon={<FileTextOutlined />}
                label="Ghi chú"
                value={
                  formatOrderNote(
                    detail?.note
                  )
                }
                fullWidth
              />
            </div>
          </section>

          {/* ================= RECEIVER ================= */}

          <section className="consignment-detail-card">
            <SectionTitle
              icon={
                <EnvironmentOutlined />
              }
              title="Thông tin người nhận"
              description="Thông tin giao hàng tại Việt Nam."
            />

            <div className="consignment-detail-info-grid">
              <DetailItem
                icon={<UserOutlined />}
                label="Người nhận"
                value={
                  detail?.receiverName
                }
              />

              <DetailItem
                icon={<PhoneOutlined />}
                label="Số điện thoại"
                value={
                  detail?.receiverPhone
                }
                copyable
              />

              <DetailItem
                icon={
                  <EnvironmentOutlined />
                }
                label="Địa chỉ nhận hàng"
                value={
                  detail?.receiverAddress
                }
                fullWidth
              />
            </div>
          </section>

          {/* ================= PRICING RULES ================= */}

          <section className="consignment-detail-card pricing-rules-card">
            <SectionTitle
              icon={<SafetyCertificateOutlined />}
              title="Các khoản phí và điều kiện áp dụng"
              description={`${pricingRules.length} khoản phí và điều kiện đang được hệ thống áp dụng.`}
              extra={
                <Tag className="pricing-rules-count-tag">
                  {appliedPricingRuleIds.size} khoản phí áp dụng cho đơn
                </Tag>
              }
            />

            {pricingRules.length === 0 ? (
              <Empty
                image={
                  Empty.PRESENTED_IMAGE_SIMPLE
                }
                description="Hiện chưa có khoản phí nào được cấu hình cho đơn hàng."
              />
            ) : (
              <div className="pricing-rules-grid">
                {pricingRules.map((rule) => {
                  const isApplied =
                    appliedPricingRuleIds.has(
                      normalizeText(rule?.id)
                    );

                  const isPercentage =
                    normalizeText(
                      rule?.calculationType
                    ).toUpperCase() ===
                    "PERCENTAGE";

                  return (
                    <article
                      key={rule?.id || rule?.ruleCode}
                      className={`pricing-rule-item ${isApplied
                          ? "is-applied"
                          : ""
                        }`}
                    >
                      <div className="pricing-rule-item__top">
                        <div>
                          <strong>
                            {rule?.ruleName ||
                              "Khoản phí"}
                          </strong>
                        </div>

                        <Tag
                          className={
                            rule?.isRequired
                              ? "pricing-rule-required"
                              : "pricing-rule-optional"
                          }
                        >
                          {rule?.isRequired
                            ? "Bắt buộc"
                            : "Tùy chọn"}
                        </Tag>
                      </div>

                      <div className="pricing-rule-item__value">
                        {isPercentage
                          ? `${formatMeasurement(
                            rule?.value,
                            2
                          )}%`
                          : rule?.ruleCode ===
                            PRICING_RULE_CODE
                              .VOLUMETRIC_DIVISOR
                            ? formatMeasurement(
                              rule?.value,
                              0
                            )
                            : formatCurrency(
                              rule?.value
                            )}
                      </div>

                      <div className="pricing-rule-item__meta">
                        <span>
                          {translateCalculationType(
                            rule?.calculationType
                          )}
                        </span>
                        <span>
                          {translateConditionType(
                            rule?.conditionType
                          )}
                        </span>
                      </div>

                      {rule?.description && (
                        <p>
                          {formatSystemDescription(
                            rule.description
                          )}
                        </p>
                      )}

                      {isApplied && (
                        <small>
                          Đang được áp dụng cho đơn hàng
                        </small>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* ================= ITEMS ================= */}

          <section className="consignment-detail-card consignment-products-card">
            <SectionTitle
              icon={<ShoppingOutlined />}
              title="Danh sách kiện hàng"
              description="Thông tin kích thước, khối lượng quy đổi, đóng gói và giá trị hàng hóa của từng kiện."
              extra={
                <Tag className="consignment-package-tag">
                  {packageCount} kiện • {totalQuantity} sản phẩm
                </Tag>
              }
            />

            <div
              className={`consignment-dim-formula ${hasApiDimDivisor
                  ? "is-ready"
                  : "is-missing"
                }`}
            >
              <div className="consignment-dim-formula__icon">
                <FileTextOutlined />
              </div>

              <div className="consignment-dim-formula__content">
                <span>CÁCH TÍNH KHỐI LƯỢNG QUY ĐỔI</span>

                <strong>
                  {hasApiDimDivisor
                    ? `(Dài × Rộng × Cao) ÷ ${formatMeasurement(
                      dimDivisor,
                      0
                    )}`
                    : "Chưa thể tính khối lượng quy đổi"}
                </strong>

                <small>
                  Khối lượng quy đổi được lấy từ thông tin của kiện hàng. Khi chưa có sẵn, hệ thống tính theo kích thước và hệ số quy đổi đang áp dụng.
                </small>
              </div>

              <Tag
                className={`consignment-dim-source ${hasApiDimDivisor
                    ? "is-api"
                    : "is-missing"
                  }`}
              >
                {hasApiDimDivisor
                  ? "Hệ số đang áp dụng"
                  : "Chưa có hệ số quy đổi"}
              </Tag>
            </div>

            {items.length === 0 ? (
              <div className="consignment-empty-items">
                <Empty
                  image={
                    Empty.PRESENTED_IMAGE_SIMPLE
                  }
                  description="Yêu cầu này chưa có dữ liệu sản phẩm."
                />
              </div>
            ) : (
              <div className="consignment-items-table-wrapper">
                <table className="consignment-items-table consignment-items-table--api">
                  <colgroup>
                    <col className="col-index" />
                    <col className="col-product-name" />
                    <col className="col-product-type" />
                    <col className="col-quantity" />
                    <col className="col-weight" />
                    <col className="col-dimension" />
                    <col className="col-package-config" />
                    <col className="col-volume" />
                    <col className="col-dim" />
                    <col className="col-declared-value" />
                  </colgroup>

                  <thead>
                    <tr>
                      <th className="is-center">STT</th>
                      <th>Sản phẩm</th>
                      <th>Loại hàng</th>
                      <th className="is-center">
                        Số lượng
                      </th>
                      <th>Trọng lượng</th>
                      <th>Kích thước thực</th>
                      <th>Cấu hình đóng gói</th>
                      <th>Thể tích</th>
                      <th>DIM</th>
                      <th>Giá trị khai báo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map(
                      (item, index) => {
                        const itemVolumeCm3 =
                          calculateItemVolumeCm3(
                            item
                          );

                        const itemDimKg =
                          calculateItemDimKg(
                            item,
                            dimDivisor
                          );

                        const apiDimWeight =
                          getItemApiDimWeight(
                            item
                          );

                        const productTypeName =
                          getProductTypeName(
                            item,
                            productTypeMap
                          );

                        const trackingCode =
                          getItemDomesticTrackingCode(
                            item
                          );

                        const packageConfig =
                          getItemPackageConfiguration(
                            item
                          );

                        const imageUrls =
                          getItemImageUrls(
                            item
                          );

                        return (
                          <tr
                            key={
                              item?.id ||
                              `${getItemName(
                                item
                              )}-${index}`
                            }
                          >
                            <td className="is-center">
                              <span className="consignment-index-badge">
                                {index + 1}
                              </span>
                            </td>

                            <td className="product-name-cell">
                              <div className="consignment-product-cell">
                                <ProductImageGallery
                                  images={
                                    imageUrls
                                  }
                                  productName={
                                    getItemName(
                                      item
                                    )
                                  }
                                />

                                <div className="consignment-product-name">
                                  <strong>
                                    {getItemName(item)}
                                  </strong>

                                  <small>
                                    {trackingCode
                                      ? `Mã nội địa: ${trackingCode}`
                                      : "Chưa có mã nội địa"}
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td className="product-type-cell">
                              <Tag className="consignment-product-type-tag">
                                {productTypeName}
                              </Tag>
                            </td>

                            <td className="is-center">
                              <strong className="consignment-package-count">
                                {getItemQuantity(
                                  item
                                )}
                              </strong>
                            </td>

                            <td>
                              <strong className="consignment-measure-value">
                                {formatMeasurement(
                                  getItemWeightKg(
                                    item
                                  ),
                                  4
                                )}{" "}
                                kg
                              </strong>
                            </td>

                            <td>
                              <div className="consignment-dimension-value">
                                <strong>
                                  {formatMeasurement(
                                    getItemLengthCm(
                                      item
                                    ),
                                    4
                                  )}
                                </strong>
                                <span>×</span>
                                <strong>
                                  {formatMeasurement(
                                    getItemWidthCm(
                                      item
                                    ),
                                    4
                                  )}
                                </strong>
                                <span>×</span>
                                <strong>
                                  {formatMeasurement(
                                    getItemHeightCm(
                                      item
                                    ),
                                    4
                                  )}
                                </strong>
                                <small>cm</small>
                              </div>
                            </td>

                            <td>
                              {!packageConfig ? (
                                <span className="consignment-api-empty">
                                  Chưa có cấu hình
                                </span>
                              ) : (
                                <div className="consignment-package-config">
                                  <strong>
                                    {translatePackageConfiguration(
                                      packageConfig
                                    )}
                                  </strong>

                                  <span>
                                    {formatMeasurement(
                                      packageConfig
                                        ?.length,
                                      2
                                    )}{" "}
                                    ×{" "}
                                    {formatMeasurement(
                                      packageConfig
                                        ?.width,
                                      2
                                    )}{" "}
                                    ×{" "}
                                    {formatMeasurement(
                                      packageConfig
                                        ?.height,
                                      2
                                    )}{" "}
                                    cm
                                  </span>

                                  {String(packageConfig?.configCode ?? "").toUpperCase() === "CUSTOM" && packageConfig?.packageFee > 0 && (
                                    <small style={{ display: "block", color: "#64748b", marginTop: 2 }}>
                                      Đơn giá: {formatCurrency(packageConfig.packageFee)} / 1.000 cm³
                                    </small>
                                  )}

                                  <small style={{ fontWeight: 600, color: "#1e293b", display: "block", marginTop: 2 }}>
                                    Phí đóng gói:{" "}
                                    {formatCurrency(
                                      getItemPackageFee(item)
                                    )}
                                  </small>
                                </div>
                              )}
                            </td>

                            <td>
                              <strong className="consignment-measure-value">
                                {formatMeasurement(
                                  itemVolumeCm3,
                                  4
                                )}{" "}
                                cm³
                              </strong>
                            </td>

                            <td>
                              <div className="consignment-dim-value">
                                <strong>
                                  {formatDimWeight(
                                    itemDimKg
                                  )}{" "}
                                  kg
                                </strong>

                                <small>
                                  {apiDimWeight !== null
                                    ? "Khối lượng quy đổi của kiện"
                                    : hasApiDimDivisor
                                      ? `÷ ${formatMeasurement(
                                        dimDivisor,
                                        0
                                      )}`
                                      : "Chưa đủ dữ liệu để tính"}
                                </small>
                              </div>
                            </td>

                            <td>
                              <strong className="consignment-declared-value">
                                {formatCurrency(
                                  getItemDeclaredValue(
                                    item
                                  )
                                )}
                              </strong>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td
                        colSpan={3}
                        className="consignment-table-total-label"
                      >
                        TỔNG CỘNG
                      </td>

                      <td className="is-center">
                        <strong>
                          {totalQuantity}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {formatMeasurement(
                            displayTotalWeightKg,
                            4
                          )}{" "}
                          kg
                        </strong>
                      </td>

                      <td>—</td>

                      <td>
                        <strong>
                          {formatCurrency(
                            totalPackageFee
                          )}
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {formatMeasurement(
                            displayTotalVolumeCm3,
                            4
                          )}{" "}
                          cm³
                        </strong>
                      </td>

                      <td>
                        <strong className="consignment-table-total-dim">
                          {formatMeasurement(
                            totalDimKg,
                            DIM_DECIMAL_PLACES
                          )}{" "}
                          kg
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            totalDeclaredValue
                          )}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>




        </div>

        <aside className="consignment-detail-sidebar">
          {/* ================= CUSTOMER ================= */}

          <section className="consignment-detail-card">
            <SectionTitle
              icon={<TeamOutlined />}
              title="Khách hàng"
            />

            <div className="consignment-customer">
              <div className="consignment-customer__avatar">
                {normalizeText(
                  detail?.customer
                    ?.fullName
                )
                  .charAt(0)
                  .toUpperCase() || "K"}
              </div>

              <div className="consignment-customer__name">
                <strong>
                  {detail?.customer
                    ?.fullName ||
                    "Chưa cập nhật"}
                </strong>

                <span>
                  Khách hàng ký gửi
                </span>
              </div>
            </div>

            <div className="consignment-customer__details">
              <DetailItem
                icon={<MailOutlined />}
                label="Thư điện tử"
                value={
                  detail?.customer?.email
                }
                fullWidth
                copyable
              />

              <DetailItem
                icon={<PhoneOutlined />}
                label="Số điện thoại"
                value={
                  detail?.customer?.phone
                }
                fullWidth
                copyable
              />
            </div>
          </section>

          {/* ================= QUOTATION ================= */}

          <section className="consignment-detail-card consignment-quotation-card">
            <SectionTitle
              icon={<DollarOutlined />}
              title="Chi tiết báo giá"
              description="Các khoản phí và tổng chi phí của đơn hàng được trình bày rõ ràng bên dưới."
              extra={
                quotation ? (
                  <StatusBadge
                    label={
                      quotationStatus.label
                    }
                    className={
                      quotationStatus.className
                    }
                    icon={
                      normalizeText(
                        quotation?.status
                      ).toUpperCase() ===
                        "DRAFT" ? (
                        <ClockCircleOutlined />
                      ) : (
                        <CheckCircleOutlined />
                      )
                    }
                  />
                ) : null
              }
            />

            {!quotation ? (
              <Empty
                image={
                  Empty.PRESENTED_IMAGE_SIMPLE
                }
                description="Đơn hàng chưa có báo giá."
              />
            ) : (
              <>
                <div className="consignment-quotation-source">
                  <div>
                    <span>Thông tin báo giá</span>
                    <strong>
                      {translateQuoteType(
                        quotation?.quoteType
                      )}
                    </strong>
                  </div>

                  <Tag className="consignment-quotation-api-tag">
                    {quotationStatus.label}
                  </Tag>
                </div>

                <div className="consignment-quotation-meta-grid">
                  <div>
                    <span>Loại báo giá</span>
                    <strong>
                      {translateQuoteType(
                        quotation?.quoteType
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Trạng thái</span>
                    <strong>
                      {quotationStatus.label}
                    </strong>
                  </div>

                  <div>
                    <span>Thể tích báo giá</span>
                    <strong>
                      {formatMeasurement(
                        quotation?.totalVolume,
                        4
                      )}{" "}
                      cm³
                    </strong>
                  </div>

                  <div>
                    <span>Hệ số quy đổi</span>
                    <strong>
                      {hasApiDimDivisor
                        ? formatMeasurement(
                          dimDivisor,
                          0
                        )
                        : "Chưa có dữ liệu"}
                    </strong>
                  </div>
                </div>

                <div className="consignment-quotation-lines is-detailed">
                  <div className="is-freight">
                    <span>
                      Phí vận chuyển quốc tế
                    </span>
                    <strong>
                      {formatCurrency(
                        quotationBreakdown
                          ?.freight
                      )}
                    </strong>
                  </div>

                  <div className="is-domestic">
                    <span>
                      Phí vận chuyển nội địa
                    </span>
                    <strong>
                      {formatCurrency(
                        quotationBreakdown
                          ?.domestic
                      )}
                    </strong>
                  </div>

                  <div className="is-service">
                    <span>Phí dịch vụ</span>
                    <strong>
                      {formatCurrency(
                        quotationBreakdown
                          ?.service
                      )}
                    </strong>
                  </div>

                  <div className="is-tax">
                    <span>
                      Thuế và phí nhập khẩu
                    </span>
                    <strong>
                      {formatCurrency(
                        quotationBreakdown?.tax
                      )}
                    </strong>
                  </div>
                </div>

                <div className="consignment-quotation-total">
                  <span>
                    Tổng chi phí dự kiến
                  </span>

                  <strong>
                    {formatCurrency(
                      quotationBreakdown?.total
                    )}
                  </strong>
                </div>

                <div
                  className={`consignment-quotation-check ${Math.abs(
                    quotationBreakdown
                      ?.difference || 0
                  ) < 1
                      ? "is-match"
                      : "is-mismatch"
                    }`}
                >
                  <CheckCircleOutlined />

                  <div>
                    <strong>
                      {Math.abs(
                        quotationBreakdown
                          ?.difference || 0
                      ) < 1
                        ? "Tổng báo giá đã khớp"
                        : "Tổng báo giá đang lệch"}
                    </strong>

                    <span>
                      Tổng các khoản chi phí:{" "}
                      {formatCurrency(
                        quotationBreakdown
                          ?.componentTotal
                      )}
                      {Math.abs(
                        quotationBreakdown
                          ?.difference || 0
                      ) >= 1 &&
                        ` • Chênh lệch ${formatCurrency(
                          quotationBreakdown
                            ?.difference
                        )}`}
                    </span>
                  </div>
                </div>

                <div className="consignment-quotation-dates">
                  <div>
                    <CalendarOutlined />

                    <span>
                      <small>Ngày tạo</small>
                      <strong>
                        {formatDateTime(
                          quotation?.createdAt
                        )}
                      </strong>
                    </span>
                  </div>

                  <div>
                    <ClockCircleOutlined />

                    <span>
                      <small>Hết hạn</small>
                      <strong>
                        {formatDateTime(
                          quotation?.expiredAt
                        )}
                      </strong>
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>

      <Modal
        open={reviewModalOpen}
        centered
        width={560}
        footer={null}
        title={null}
        mask={{ closable: !statusUpdating }}
        closable={!statusUpdating}
        destroyOnHidden
        className="consignment-review-modal"
        onCancel={closeReviewModal}
      >
        <div className="consignment-review-modal__content">
          <div
            className={`consignment-review-modal__hero ${reviewAction === "REJECT"
                ? "is-reject"
                : "is-approve"
              }`}
          >
            <div className="consignment-review-modal__icon">
              {reviewAction ===
                "REJECT" ? (
                <CloseCircleOutlined />
              ) : (
                <CheckCircleOutlined />
              )}
            </div>

            <div>
              <span>
                XÁC NHẬN TRẠNG THÁI
              </span>

              <h2>
                {reviewAction ===
                  "REJECT"
                  ? "Hủy yêu cầu ký gửi"
                  : "Xác nhận yêu cầu ký gửi"}
              </h2>

              <p>
                {reviewAction ===
                  "REJECT"
                  ? "Yêu cầu sẽ chuyển sang trạng thái Đã hủy."
                  : "Yêu cầu sẽ chuyển sang trạng thái Đã xác nhận."}
              </p>
            </div>
          </div>

          <div className="consignment-review-modal__body">
            <div className="consignment-review-modal__order">
              <span>
                Mã yêu cầu
              </span>

              <strong>
                {detail?.consignmentCode ||
                  "—"}
              </strong>
            </div>

            {reviewAction ===
              "REJECT" && (
                <div className="consignment-review-modal__reason">
                  <label htmlFor="consignment-rejection-reason">
                    Lý do hủy
                    <b>*</b>
                  </label>

                  <Input.TextArea
                    id="consignment-rejection-reason"
                    value={
                      rejectionReason
                    }
                    rows={5}
                    maxLength={500}
                    showCount
                    disabled={
                      statusUpdating
                    }
                    placeholder="Nhập lý do hủy yêu cầu ký gửi..."
                    onChange={(event) =>
                      setRejectionReason(
                        event.target.value
                      )
                    }
                  />

                  <small>
                    Lý do cần có ít nhất 3 ký tự.
                  </small>
                </div>
              )}

            <div
              className={`consignment-review-modal__notice ${reviewAction ===
                  "REJECT"
                  ? "is-reject"
                  : "is-approve"
                }`}
            >
              {reviewAction ===
                "REJECT" ? (
                <CloseCircleOutlined />
              ) : (
                <SafetyCertificateOutlined />
              )}

              <span>
                {reviewAction ===
                  "REJECT"
                  ? "Sau khi hủy, nút Hủy yêu cầu vẫn hiển thị nhưng sẽ bị khóa."
                  : "Sau khi xác nhận, nút Xác nhận yêu cầu vẫn hiển thị nhưng sẽ bị khóa."}
              </span>
            </div>
          </div>

          <div className="consignment-review-modal__actions">
            <Button
              size="large"
              disabled={
                statusUpdating
              }
              onClick={
                closeReviewModal
              }
            >
              Quay lại
            </Button>

            <Button
              type="primary"
              danger={
                reviewAction ===
                "REJECT"
              }
              size="large"
              icon={
                reviewAction ===
                  "REJECT" ? (
                  <CloseCircleOutlined />
                ) : (
                  <CheckCircleOutlined />
                )
              }
              loading={
                statusUpdating
              }
              disabled={
                statusUpdating ||
                (reviewAction ===
                  "REJECT" &&
                  normalizeText(
                    rejectionReason
                  ).length < 3)
              }
              onClick={
                handleConfirmReviewStatus
              }
            >
              {reviewAction ===
                "REJECT"
                ? "Xác nhận hủy"
                : "Xác nhận yêu cầu"}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
