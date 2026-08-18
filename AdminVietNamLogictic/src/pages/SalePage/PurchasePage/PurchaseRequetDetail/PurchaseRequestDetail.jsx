import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  ArrowLeftOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  FileTextOutlined,
  GiftOutlined,
  GlobalOutlined,
  InboxOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
  SyncOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Image,
  Skeleton,
  Tag,
  Tooltip,
} from "antd";

import {
  getPurchaseRequestDetailApi,
} from "../../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import {
  getActivePricingRulesApi,
  PRICING_RULE_CODE,
} from "../../../../api/SaleAPI/ConsignmentAPI/pricingRuleService";
import {
  getActiveWarehousesApi,
  getWarehousesApi,
} from "../../../../api/SaleAPI/ConsignmentAPI/warehouseService";
import { getWarehouses } from "../../../../api/AdminAPI/adminService";
import AuthNotify from "../../../../utils/Common/AuthNotify";
import ShipmentJourney from "../../../../components/ShipmentJourney/ShipmentJourney";
import {
  describeJourneyScale,
  summarizeJourney,
} from "../../../../components/ShipmentJourney/journeySummary";

import CreatePurchaseRequestQuotationModal from "./CreatePurchaseRequestQuotationModal";
import ConfirmPurchaseModal from "./ConfirmPurchaseModal";

import {
  apiToUtcIso,
  formatUtcDateTime,
  formatVietnamDateTime,
} from "../../../../utils/timeUtc";

import "./PurchaseRequestDetail.css";

const STATUS_CONFIG = {
  DRAFT: {
    label: "Bản nháp",
    className: "is-info",
  },
  QUOTATION_CONFIRMED: {
    label: "Đã xác nhận báo giá",
    className: "is-success",
  },
  NEW: {
    label: "Đặt đơn hàng",
    className: "is-info",
  },
  PENDING_REVIEW: {
    label: "Đặt đơn hàng (Chờ duyệt)",
    className: "is-warning",
  },
  IN_REVIEW: {
    label: "Đặt đơn hàng (Đang duyệt)",
    className: "is-info",
  },
  APPROVED: {
    label: "Đặt đơn hàng (Đã duyệt)",
    className: "is-success",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "is-danger",
  },
  QUOTATION_SENT: {
    label: "Đặt đơn hàng (Đã gửi báo giá)",
    className: "is-info",
  },
  QUOTED: {
    label: "Đặt đơn hàng (Đã báo giá)",
    className: "is-success",
  },
  WAITING_PAYMENT: {
    label: "Đặt đơn hàng (Chờ thanh toán)",
    className: "is-warning",
  },
  WAITING_DEPOSIT: {
    label: "Đặt đơn hàng (Chờ cọc)",
    className: "is-warning",
  },
  DEPOSIT_PAID: {
    label: "Đặt đơn hàng (Đã cọc)",
    className: "is-success",
  },
  PAID: {
    label: "Đặt đơn hàng (Đã thanh toán)",
    className: "is-success",
  },
  PURCHASED: {
    label: "Hàng đang đặt về",
    className: "is-info",
  },
  SELLER_SHIPPED: {
    label: "Hàng đang đặt về (NCC phát)",
    className: "is-info",
  },
  ARRIVED_ORIGIN_WAREHOUSE: {
    label: "Hàng đã về kho",
    className: "is-info",
  },
  WAITING_STORED: {
    label: "Hàng chờ nhập kho",
    className: "is-warning",
  },
  STORED: {
    label: "Hàng đã nhập kho",
    className: "is-success",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "is-info",
  },
  COMPLETED: {
    label: "Hàng đã nhập kho",
    className: "is-success",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "is-danger",
  },
};

/*
 * Các rule kỹ thuật / phí hệ thống
 * không phải dịch vụ khách hàng lựa chọn.
 * Không hiển thị trong khu vực dịch vụ.
 */
const CREATE_QUOTATION_STATUSES =
  new Set([
    "PENDING_REVIEW",
    "IN_REVIEW",
    "APPROVED",
  ]);

const HIDDEN_SERVICE_RULE_CODES =
  new Set([
    PRICING_RULE_CODE
      .VOLUMETRIC_DIVISOR,

    PRICING_RULE_CODE
      .DOMESTIC_FEE,
  ]);

const QUOTATION_STATUS_CONFIG = {
  PENDING_CUSTOMER_CONFIRMATION: {
    label:
      "Chờ khách xác nhận",
    className:
      "is-warning",
  },

  ACCEPTED: {
    label:
      "Đã chấp nhận",
    className:
      "is-success",
  },

  CUSTOMER_CONFIRMED: {
    label:
      "Khách đã xác nhận",
    className:
      "is-success",
  },

  CONFIRMED: {
    label:
      "Đã xác nhận",
    className:
      "is-success",
  },

  REJECTED: {
    label:
      "Đã từ chối",
    className:
      "is-danger",
  },

  EXPIRED: {
    label:
      "Đã hết hạn",
    className:
      "is-default",
  },
};

const FEE_TYPE_LABELS = {
  SERVICE_FEE:
    "Phí dịch vụ",

  TAX:
    "Thuế",

  WOOD_BOX:
    "Đóng thùng gỗ",

  MAIN_SERVICE:
    "Phí vận chuyển",

  INSPECTION:
    "Kiểm hàng",

  INSURANCE:
    "Bảo hiểm",
};

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const getQuotationStatusInfo = (
  value
) => {
  const code =
    normalizeUpperText(value);

  return (
    QUOTATION_STATUS_CONFIG[
    code
    ] || {
      label:
        code
          .replace(/_/g, " ")
          .toLocaleLowerCase(
            "vi-VN"
          )
          .replace(
            /(^|\s)\S/g,
            (character) =>
              character
                .toLocaleUpperCase(
                  "vi-VN"
                )
          ) ||
        "Chưa xác định",

      className:
        "is-default",
    }
  );
};

const getFeeTypeLabel = (
  value
) => {
  const code =
    normalizeUpperText(value);

  return (
    FEE_TYPE_LABELS[code] ||
    code
      .replace(/_/g, " ")
      .toLocaleLowerCase(
        "vi-VN"
      )
      .replace(
        /(^|\s)\S/g,
        (character) =>
          character
            .toLocaleUpperCase(
              "vi-VN"
            )
      ) ||
    "Phụ phí"
  );
};

const getFeeToneClass = (
  value
) => {
  const code =
    normalizeUpperText(value);

  if (
    code === "TAX"
  ) {
    return "is-tax";
  }

  if (
    code === "INSURANCE"
  ) {
    return "is-insurance";
  }

  if (
    code === "WOOD_BOX" ||
    code === "INSPECTION"
  ) {
    return "is-service";
  }

  return "is-default";
};

const formatFeeCalculation = (fee) => {
  const calculationType = normalizeUpperText(fee?.calculationType);

  if (calculationType === "PERCENTAGE") {
    return `${formatNumber(fee?.value)}%`;
  }

  return "Cố định";
};

const getStatusInfo = (value, statusDisplayName) => {
  const code = normalizeUpperText(value);
  const matched = STATUS_CONFIG[code];

  if (matched) {
    return {
      ...matched,
      label: statusDisplayName || matched.label,
    };
  }

  return {
    label:
      statusDisplayName ||
      code
        .replace(/_/g, " ")
        .toLocaleLowerCase("vi-VN")
        .replace(
          /(^|\s)\S/g,
          (character) =>
            character.toLocaleUpperCase("vi-VN")
        ) ||
      "Chưa xác định",
    className: "is-default",
  };
};

/*
 * API trả thời gian UTC.
 * Chuẩn hóa về UTC+0 trước,
 * sau đó hiển thị theo giờ Việt Nam UTC+7.
 */
const normalizeApiTimeToUtc = (
  value
) => {
  return apiToUtcIso(
    value,
    {
      apiTimeMode: "utc",
    }
  );
};

const formatDateTime = (value) => {
  const utcIso =
    normalizeApiTimeToUtc(
      value
    );

  if (!utcIso) {
    return "—";
  }

  return formatVietnamDateTime(
    utcIso,
    {
      apiTimeMode: "utc",
      fallback: "—",
    }
  );
};

const formatDateUtcTitle = (
  value
) => {
  const utcIso =
    normalizeApiTimeToUtc(
      value
    );

  if (!utcIso) {
    return "";
  }

  return `UTC+0: ${formatUtcDateTime(
    utcIso,
    {
      apiTimeMode: "utc",
      fallback: "—",
    }
  )}`;
};

const formatNumber = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }
  ).format(number);
};

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0 ₫";
  }

  return `${new Intl.NumberFormat(
    "vi-VN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }
  ).format(
    Math.round(number)
  )} ₫`;
};

const formatPricingRuleValue = (
  rule
) => {
  const value =
    Number(rule?.value) || 0;

  const calculationType =
    normalizeUpperText(
      rule?.calculationType
    );

  const ruleCode =
    normalizeUpperText(
      rule?.ruleCode
    );

  if (
    ruleCode ===
    PRICING_RULE_CODE
      .VOLUMETRIC_DIVISOR
  ) {
    return formatNumber(value);
  }

  if (
    calculationType ===
    "PERCENTAGE"
  ) {
    return `${new Intl.NumberFormat(
      "vi-VN",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    ).format(value)}%`;
  }

  return formatCurrency(value);
};

const formatPricingLimit = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "Không giới hạn";
  }

  return formatCurrency(value);
};

const getPricingRuleUnitLabel = (
  rule
) => {
  const ruleCode =
    normalizeUpperText(
      rule?.ruleCode
    );

  const conditionType =
    normalizeUpperText(
      rule?.conditionType
    );

  const map = {
    [PRICING_RULE_CODE.WOOD_CRATE]:
      "Một lần cho toàn đơn",

    [PRICING_RULE_CODE.DOMESTIC_FEE]:
      "Theo đơn",

    [PRICING_RULE_CODE.SUR_INSPECTION]:
      "Theo đơn",

    [PRICING_RULE_CODE.SUR_INSURANCE_3PERCENT]:
      "Theo giá trị khai báo",

    [PRICING_RULE_CODE.VAT]:
      "Theo phí vận chuyển và dịch vụ",

    [PRICING_RULE_CODE.IMPORT_TAX]:
      "Theo giá trị khai báo",

    [PRICING_RULE_CODE.VOLUMETRIC_DIVISOR]:
      "Hệ số quy đổi, không phải khoản phí",
  };

  return (
    map[ruleCode] ||
    (conditionType ===
      "MIN_DECLARED_VALUE"
      ? "Áp dụng theo giá trị khai báo tối thiểu"
      : "Theo cấu hình hệ thống")
  );
};

const getPricingRuleCalculationLabel = (
  rule
) => {
  const calculationType =
    normalizeUpperText(
      rule?.calculationType
    );

  if (
    calculationType ===
    "PERCENTAGE"
  ) {
    return "Phần trăm";
  }

  if (
    calculationType === "FIXED"
  ) {
    return "Cố định";
  }

  return (
    rule?.calculationTypeDisplayName ||
    calculationType ||
    "Chưa xác định"
  );
};

const translateShippingOption = (
  value
) => {
  const map = {
    STANDARD: "Tiêu chuẩn",
    EXPRESS: "Hỏa tốc",
    ECONOMY: "Tiết kiệm",
  };

  const code =
    normalizeUpperText(value);

  return (
    map[code] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

const translateCountry = (value) => {
  const code =
    normalizeText(value)
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(/Đ/g, "D")
      .replace(/đ/g, "d")
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toUpperCase();

  const map = {
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
    USA: "Hoa Kỳ",
    UNITEDSTATES: "Hoa Kỳ",
  };

  return (
    map[code] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

const translateRoute = (value) => {
  const text = normalizeText(value);

  if (!text) {
    return "Chưa xác định";
  }

  const parts = text
    .split(
      /\s*(?:-->|->|→|⇒|đến|to|-)\s*/i
    )
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts
      .map(translateCountry)
      .join(" → ");
  }

  return translateCountry(text);
};

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

function CopyValue({
  value,
  label,
}) {
  const handleCopy = async () => {
    try {
      await copyText(value);

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
    <div className="purchase-detail-copy-value">
      <strong>
        {normalizeText(value) ||
          "—"}
      </strong>

      {normalizeText(value) && (
        <Tooltip title={`Sao chép ${label}`}>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Sao chép ${label}`}
          >
            <CopyOutlined />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function ServiceOptionCard({
  icon,
  title,
  description,
  enabled,
  rule,
  fallbackValue,
  fallbackScope,
  fallbackCode,
}) {
  return (
    <article
      className={`purchase-service-card ${enabled
          ? "is-enabled"
          : "is-disabled"
        }`}
    >
      <div className="purchase-service-card__top">
        <div className="purchase-service-card__icon">
          {icon}
        </div>

        <Tag
          icon={
            enabled ? (
              <CheckCircleOutlined />
            ) : (
              <CloseCircleOutlined />
            )
          }
          className={`purchase-service-status-tag ${enabled
              ? "is-enabled"
              : "is-disabled"
            }`}
        >
          {enabled
            ? "Đã chọn"
            : "Không chọn"}
        </Tag>
      </div>

      <div className="purchase-service-card__content">
        <span>
          DỊCH VỤ
        </span>

        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>
      </div>

      <div className="purchase-service-card__config">
        <div>
          <span>
            Mức phí cấu hình
          </span>

          <strong>
            {rule
              ? formatPricingRuleValue(
                rule
              )
              : fallbackValue}
          </strong>
        </div>

        <div>
          <span>
            Phạm vi tính
          </span>

          <strong>
            {rule
              ? getPricingRuleUnitLabel(
                rule
              )
              : fallbackScope}
          </strong>
        </div>
      </div>

      <div className="purchase-service-card__rule">
        <span>
          Mã cấu hình
        </span>

        <strong>
          {rule?.ruleCode ||
            fallbackCode}
        </strong>
      </div>
    </article>
  );
}

function ProductImageGallery({
  imageUrls = [],
  productName = "Sản phẩm",
}) {
  const images = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(imageUrls) ? imageUrls : [])
            .map(normalizeText)
            .filter(Boolean)
        )
      ),
    [imageUrls]
  );

  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="purchase-detail-image-empty">
        <ShoppingOutlined />
        <span>Chưa có hình ảnh</span>
      </div>
    );
  }

  const currentImage = images[activeIndex] || images[0];

  return (
    <Image.PreviewGroup
      preview={{
        countRender: (current, total) => `Ảnh ${current}/${total}`,
      }}
    >
      <div className="purchase-detail-gallery-container">
        <div className="purchase-detail-featured-image-box">
          <Image
            src={currentImage}
            alt={`${productName} - ảnh ${activeIndex + 1}`}
            rootClassName="purchase-detail-featured-image-root"
            className="purchase-detail-featured-image"
            preview={{
              mask: (
                <span className="purchase-detail-image-mask">
                  <EyeOutlined /> Phóng to ({activeIndex + 1}/{images.length})
                </span>
              ),
            }}
          />
          {images.length > 1 && (
            <span className="purchase-detail-image-badge">
              {images.length} hình ảnh
            </span>
          )}
        </div>

        {images.length > 1 && (
          <div className="purchase-detail-thumbnail-list">
            {images.map((url, idx) => (
              <button
                type="button"
                key={`${url}-${idx}`}
                className={`purchase-detail-thumbnail-item ${idx === activeIndex ? "is-active" : ""
                  }`}
                onClick={() => setActiveIndex(idx)}
              >
                <img src={url} alt={`Thumbnail ${idx + 1}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Image.PreviewGroup>
  );
}

function DetailLoading() {
  return (
    <main className="purchase-detail-page">
      <div className="purchase-detail-shell">
        <Skeleton.Button
          active
          size="small"
        />

        <Skeleton
          active
          paragraph={{ rows: 12 }}
        />
      </div>
    </main>
  );
}

function QuotationView({
  quotation,
}) {
  if (!quotation) {
    return (
      <div className="purchase-quotation-empty">
        <Empty
          image={
            Empty
              .PRESENTED_IMAGE_SIMPLE
          }
          description="Yêu cầu chưa có báo giá"
        />
      </div>
    );
  }

  const quotationStatus =
    getQuotationStatusInfo(
      quotation?.status
    );

  const quotationItems =
    Array.isArray(
      quotation?.items
    )
      ? quotation.items
      : [];

  const additionalFees =
    Array.isArray(
      quotation
        ?.additionalFees
    )
      ? quotation.additionalFees
      : [];

  const additionalFeeTotal =
    additionalFees.reduce(
      (total, fee) =>
        total +
        (Number(
          fee?.amount
        ) || 0),
      0
    );

  const calculatedTotal =
    (Number(
      quotation
        ?.productsSubtotal
    ) || 0) +
    additionalFeeTotal;

  const totalDifference =
    Math.abs(
      calculatedTotal -
      (Number(
        quotation
          ?.totalAmount
      ) || 0)
    );

  return (
    <div className="purchase-quote-view">
      <section className="purchase-quote-overview">
        <div className="purchase-quote-overview__top">
          <div>
            <span className="purchase-quote-eyebrow">
              BÁO GIÁ MUA HỘ
            </span>

            <h3>
              {quotation
                ?.purchaseCode ||
                "Báo giá mua hộ"}
            </h3>

            <p>
              Chi tiết giá sản phẩm,
              dịch vụ, thuế và tổng
              số tiền khách hàng cần
              xác nhận.
            </p>
          </div>

          <Tag
            className={`purchase-quote-status ${quotationStatus.className}`}
          >
            {
              quotationStatus.label
            }
          </Tag>
        </div>

        <div className="purchase-quote-identifiers">
          <div>
            <span>
              Mã báo giá
            </span>

            <CopyValue
              value={
                quotation
                  ?.quotationId
              }
              label="mã báo giá"
            />
          </div>

          <div>
            <span>
              Mã yêu cầu mua hộ
            </span>

            <CopyValue
              value={
                quotation
                  ?.purchaseRequestId
              }
              label="mã yêu cầu mua hộ"
            />
          </div>

          <div>
            <span>
              Thời gian tạo
            </span>

            <div
              className="purchase-quote-date"
              title={
                formatDateUtcTitle(
                  quotation
                    ?.createdAt
                )
              }
            >
              <strong>
                {formatDateTime(
                  quotation
                    ?.createdAt
                )}
              </strong>

              <small>
                UTC+7
              </small>
            </div>
          </div>
        </div>

        <div className="purchase-quote-summary-grid">
          <article>
            <span>
              Tiền sản phẩm
            </span>

            <strong>
              {formatCurrency(
                quotation
                  ?.productsSubtotal
              )}
            </strong>
          </article>

          <article>
            <span>
              Phí mua hộ
            </span>

            <strong>
              {formatCurrency(
                quotation
                  ?.purchaseFee
              )}
            </strong>
          </article>

          <article>
            <span>
              Phí vận chuyển
            </span>

            <strong>
              {formatCurrency(
                quotation
                  ?.shippingFee
              )}
            </strong>
          </article>

          <article>
            <span>
              Thuế VAT
            </span>

            <strong>
              {formatCurrency(
                quotation?.vat
              )}
            </strong>
          </article>

          <article>
            <span>
              Thuế nhập khẩu
            </span>

            <strong>
              {formatCurrency(
                quotation
                  ?.importTax
              )}
            </strong>
          </article>

          <article className="is-total">
            <span>
              Tổng thanh toán
            </span>

            <strong>
              {formatCurrency(
                quotation
                  ?.totalAmount
              )}
            </strong>
          </article>
        </div>

        <div className="purchase-quote-reconciliation">
          <div>
            <span>
              Tổng phụ phí
            </span>

            <strong>
              {formatCurrency(
                additionalFeeTotal
              )}
            </strong>
          </div>

          <div>
            <span>
              Đối soát
            </span>

            <strong>
              {formatCurrency(
                quotation
                  ?.productsSubtotal
              )}{" "}
              +{" "}
              {formatCurrency(
                additionalFeeTotal
              )}{" "}
              ={" "}
              {formatCurrency(
                calculatedTotal
              )}
            </strong>
          </div>
        </div>

        {totalDifference > 1 && (
          <Alert
            type="warning"
            showIcon
            message="Tổng báo giá chưa khớp"
            description={`Chênh lệch ${formatCurrency(
              totalDifference
            )} giữa tổng các khoản và totalAmount từ API.`}
            className="purchase-quote-warning"
          />
        )}
      </section>

      <section className="purchase-quote-panel">
        <div className="purchase-quote-panel__heading">
          <div>
            <ShoppingOutlined />

            <div>
              <span>
                SẢN PHẨM ĐƯỢC BÁO GIÁ
              </span>

              <h3>
                {formatNumber(
                  quotationItems.length
                )} mặt hàng
              </h3>
            </div>
          </div>

          <Tag>
            Thành tiền:{" "}
            {formatCurrency(
              quotation
                ?.productsSubtotal
            )}
          </Tag>
        </div>

        {quotationItems.length ===
          0 ? (
          <Empty description="Báo giá chưa có sản phẩm" />
        ) : (
          <div className="purchase-quote-item-table">
            <div className="purchase-quote-item-table__head">
              <span>
                Sản phẩm
              </span>

              <span>
                Đơn giá
              </span>

              <span>
                Số lượng
              </span>

              <span>
                Thành tiền
              </span>
            </div>

            <div className="purchase-quote-item-table__body">
              {quotationItems.map(
                (item, index) => (
                  <article
                    key={
                      item
                        ?.quotationItemId ||
                      index
                    }
                    className="purchase-quote-item-row"
                  >
                    <div
                      className="purchase-quote-item-row__product"
                      data-label="Sản phẩm"
                    >
                      <span>
                        {index + 1}
                      </span>

                      <div>
                        <strong>
                          {item
                            ?.productName ||
                            "Sản phẩm"}
                        </strong>
                      </div>
                    </div>

                    <div
                      data-label="Đơn giá"
                    >
                      <strong>
                        {formatCurrency(
                          item
                            ?.unitPrice
                        )}
                      </strong>
                    </div>

                    <div
                      data-label="Số lượng"
                    >
                      <strong>
                        {formatNumber(
                          item
                            ?.quantity
                        )}
                      </strong>
                    </div>

                    <div
                      className="purchase-quote-item-row__total"
                      data-label="Thành tiền"
                    >
                      <strong>
                        {formatCurrency(
                          item
                            ?.lineTotal
                        )}
                      </strong>
                    </div>
                  </article>
                )
              )}
            </div>
          </div>
        )}
      </section>

      <section className="purchase-quote-panel">
        <div className="purchase-quote-panel__heading">
          <div>
            <DollarOutlined />

            <div>
              <span>
                CHI TIẾT PHỤ PHÍ
              </span>

              <h3>
                {formatNumber(
                  additionalFees.length
                )} khoản phí và thuế
              </h3>
            </div>
          </div>

          <Tag className="is-fee-total">
            Tổng:{" "}
            {formatCurrency(
              additionalFeeTotal
            )}
          </Tag>
        </div>

        {additionalFees.length ===
          0 ? (
          <Empty description="Không có phụ phí" />
        ) : (
          <div className="purchase-quote-fee-table" role="table" aria-label="Bảng chi tiết phụ phí và thuế">
            <div className="purchase-quote-fee-table__head" role="row">
              <span>#</span>
              <span>Khoản phí / Thuế</span>
              <span>Phân loại</span>
              <span>Cách tính</span>
              <span>Giá trị cấu hình</span>
              <span style={{ textAlign: "right" }}>Thành tiền</span>
            </div>

            <div className="purchase-quote-fee-table__body">
              {additionalFees.map((fee, index) => {
                const feeTone = getFeeToneClass(fee?.feeType);
                return (
                  <div
                    key={fee?.id || index}
                    className="purchase-quote-fee-table__row"
                    role="row"
                  >
                    <div className="purchase-quote-fee-table__index">
                      {index + 1}
                    </div>

                    <div className="purchase-quote-fee-table__name">
                      <strong>{fee?.feeName || "Phụ phí"}</strong>
                      {fee?.note && <small>{fee.note}</small>}
                    </div>

                    <div>
                      <Tag className={`purchase-quote-fee-tag ${feeTone}`}>
                        {getFeeTypeLabel(fee?.feeType)}
                      </Tag>
                    </div>

                    <div className="purchase-quote-fee-table__calc">
                      <span>{formatFeeCalculation(fee)}</span>
                    </div>

                    <div className="purchase-quote-fee-table__val">
                      <strong>
                        {normalizeUpperText(fee?.calculationType) === "PERCENTAGE"
                          ? `${formatNumber(fee?.value)}%`
                          : formatCurrency(fee?.value)}
                      </strong>
                    </div>

                    <div className="purchase-quote-fee-table__amount">
                      <strong>{formatCurrency(fee?.amount)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="purchase-quote-note">
        <FileTextOutlined />

        <div>
          <span>
            GHI CHÚ BÁO GIÁ
          </span>

          <strong>
            {quotation?.note ||
              "Không có ghi chú"}
          </strong>
        </div>
      </section>
    </div>
  );
}

export default function PurchaseRequestDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const purchaseRequestId =
    params?.purchaseRequestId ||
    location?.state
      ?.purchaseRequestId ||
    location?.state
      ?.purchaseRequest
      ?.purchaseRequestId ||
    "";

  const [detail, setDetail] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    pricingRules,
    setPricingRules,
  ] = useState([]);

  const [
    pricingWarning,
    setPricingWarning,
  ] = useState("");

  const [
    quotationModalOpen,
    setQuotationModalOpen,
  ] = useState(false);

  const [
    confirmPurchaseModalOpen,
    setConfirmPurchaseModalOpen,
  ] = useState(false);

  const [systemWarehouses, setSystemWarehouses] = useState([]);

  const loadDetail =
    useCallback(async () => {
      if (!purchaseRequestId) {
        setError(
          "Không tìm thấy mã yêu cầu mua hộ."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        setPricingWarning("");

        const [
          detailResult,
          pricingResult,
          activeWhRes,
          whApiRes,
          adminWhRes,
        ] = await Promise.allSettled([
          getPurchaseRequestDetailApi(
            purchaseRequestId
          ),
          getActivePricingRulesApi(),
          getActiveWarehousesApi(),
          getWarehousesApi(),
          getWarehouses(),
        ]);

        if (
          detailResult.status ===
          "rejected"
        ) {
          throw detailResult.reason;
        }

        setDetail(
          detailResult.value
        );

        let whList = [];
        if (activeWhRes.status === "fulfilled" && Array.isArray(activeWhRes.value) && activeWhRes.value.length > 0) {
          whList = activeWhRes.value;
        } else if (whApiRes.status === "fulfilled" && Array.isArray(whApiRes.value) && whApiRes.value.length > 0) {
          whList = whApiRes.value;
        } else if (adminWhRes.status === "fulfilled" && Array.isArray(adminWhRes.value) && adminWhRes.value.length > 0) {
          whList = adminWhRes.value
            .map((w) => ({
              id: String(w.id || w.warehouseId || ""),
              name: String(w.name || w.warehouseName || ""),
              code: String(w.code || w.warehouseCode || ""),
            }))
            .filter((w) => Boolean(w.id));
        }
        setSystemWarehouses(whList);

        if (
          pricingResult.status ===
          "fulfilled" &&
          Array.isArray(
            pricingResult.value
          )
        ) {
          setPricingRules(
            pricingResult.value
          );
        } else {
          setPricingRules([]);

          setPricingWarning(
            "Không tải được cấu hình phí dịch vụ. Thông tin yêu cầu mua hộ vẫn được hiển thị bình thường."
          );
        }
      } catch (requestError) {
        const message =
          requestError?.message ||
          "Không thể tải chi tiết yêu cầu mua hộ.";

        setError(message);
        setDetail(null);

        AuthNotify.error(
          "Tải dữ liệu thất bại",
          message
        );
      } finally {
        setLoading(false);
      }
    }, [purchaseRequestId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const status = useMemo(
    () =>
      getStatusInfo(
        detail?.status,
        detail?.statusDisplayName
      ),
    [detail?.status, detail?.statusDisplayName]
  );

  /* Hành trình vận chuyển quốc tế của đơn, kèm số liệu cho phần tiêu đề. */
  const journey = useMemo(
    () =>
      summarizeJourney(
        detail?.shipments
      ),
    [detail]
  );

  const items = useMemo(
    () =>
      Array.isArray(
        detail?.items
      )
        ? detail.items
        : [],
    [detail?.items]
  );

  const totalQuantity = useMemo(
    () =>
      Number(
        detail?.totalQuantity
      ) ||
      items.reduce(
        (total, item) =>
          total +
          (Number(
            item?.quantity
          ) || 0),
        0
      ),
    [
      detail?.totalQuantity,
      items,
    ]
  );

  /*
   * Chỉ giữ lại rule khách hàng thực sự chọn.
   *
   * Không hiển thị:
   * - VOLUMETRIC_DIVISOR
   * - DOMESTIC_FEE
   * - rule chỉ dùng để tham khảo
   * - rule không có trong pricingRuleIds
   *   và không tương ứng với lựa chọn dịch vụ.
   */
  const pricingRuleRows =
    useMemo(() => {
      const selectedRuleIds =
        new Set(
          Array.isArray(
            detail?.pricingRuleIds
          )
            ? detail.pricingRuleIds
              .map(normalizeText)
              .filter(Boolean)
            : []
        );

      const selectedRuleCodes =
        new Set();

      if (
        detail?.requiresWoodenCrate
      ) {
        selectedRuleCodes.add(
          PRICING_RULE_CODE
            .WOOD_CRATE
        );
      }

      if (
        detail?.requiresInsurance
      ) {
        selectedRuleCodes.add(
          PRICING_RULE_CODE
            .SUR_INSURANCE_3PERCENT
        );
      }

      return (
        Array.isArray(pricingRules)
          ? pricingRules
          : []
      )
        .map((rule) => {
          const ruleId =
            normalizeText(
              rule?.id
            );

          const ruleCode =
            normalizeUpperText(
              rule?.ruleCode
            );

          const isSelected =
            selectedRuleIds.has(
              ruleId
            ) ||
            selectedRuleCodes.has(
              ruleCode
            );

          return {
            ...rule,
            ruleId,
            ruleCode,
            isSelected,
            isApplied: isSelected,
          };
        })
        .filter((rule) => {
          if (
            HIDDEN_SERVICE_RULE_CODES.has(
              rule?.ruleCode
            )
          ) {
            return false;
          }

          return (
            rule?.isSelected ===
            true
          );
        })
        .sort(
          (
            firstRule,
            secondRule
          ) =>
            normalizeText(
              firstRule?.ruleName
            ).localeCompare(
              normalizeText(
                secondRule?.ruleName
              ),
              "vi"
            )
        );
    }, [
      detail?.pricingRuleIds,
      detail?.requiresInsurance,
      detail?.requiresWoodenCrate,
      pricingRules,
    ]);

  const serviceCards =
    useMemo(() => {
      const findRuleByCode = (
        ruleCode
      ) => {
        const normalizedCode =
          normalizeUpperText(
            ruleCode
          );

        return (
          pricingRuleRows.find(
            (rule) =>
              normalizeUpperText(
                rule?.ruleCode
              ) === normalizedCode
          ) || null
        );
      };

      const packingRule =
        pricingRuleRows.find(
          (rule) => {
            const ruleCode =
              normalizeUpperText(
                rule?.ruleCode
              );

            return (
              ruleCode !==
              PRICING_RULE_CODE
                .WOOD_CRATE &&
              (
                ruleCode.includes(
                  "PACK"
                ) ||
                ruleCode.includes(
                  "REPACK"
                ) ||
                ruleCode.includes(
                  "PACKAGE"
                )
              )
            );
          }
        ) || null;

      return [
        {
          key: "packing",
          icon: <GiftOutlined />,
          title:
            "Đóng gói lại",
          description:
            "Gia cố hoặc đóng gói lại sản phẩm trước khi vận chuyển.",
          enabled: Boolean(
            detail?.requiresPacking
          ),
          rule: packingRule,
          fallbackValue:
            "Theo cấu hình kiện hàng",
          fallbackScope:
            "Theo loại và kích thước kiện",
          fallbackCode:
            "PACKAGE_CONFIGURATION",
        },
        {
          key: "wood-crate",
          icon: <InboxOutlined />,
          title:
            "Đóng thùng gỗ",
          description:
            "Bảo vệ hàng dễ vỡ hoặc hàng cần gia cố trong quá trình vận chuyển.",
          enabled: Boolean(
            detail
              ?.requiresWoodenCrate
          ),
          rule:
            findRuleByCode(
              PRICING_RULE_CODE
                .WOOD_CRATE
            ),
          fallbackValue:
            "Chưa có cấu hình",
          fallbackScope:
            "Một lần cho toàn đơn",
          fallbackCode:
            PRICING_RULE_CODE
              .WOOD_CRATE,
        },
        {
          key: "insurance",
          icon:
            <SafetyCertificateOutlined />,
          title:
            "Bảo hiểm hàng hóa",
          description:
            "Áp dụng bảo hiểm theo giá trị khai báo và điều kiện của hệ thống.",
          enabled: Boolean(
            detail
              ?.requiresInsurance
          ),
          rule:
            findRuleByCode(
              PRICING_RULE_CODE
                .SUR_INSURANCE_3PERCENT
            ),
          fallbackValue:
            "Chưa có cấu hình",
          fallbackScope:
            "Theo giá trị khai báo",
          fallbackCode:
            PRICING_RULE_CODE
              .SUR_INSURANCE_3PERCENT,
        },
      ];
    }, [
      detail?.requiresInsurance,
      detail?.requiresPacking,
      detail?.requiresWoodenCrate,
      pricingRuleRows,
    ]);

  /*
   * Chỉ render dịch vụ khách hàng đã chọn.
   * Dịch vụ không chọn sẽ không xuất hiện.
   */
  const selectedServiceCards =
    useMemo(
      () =>
        serviceCards.filter(
          (service) =>
            service?.enabled ===
            true
        ),
      [serviceCards]
    );

  const selectedServiceCount =
    selectedServiceCards.length;

  const appliedPricingRuleCount =
    pricingRuleRows.length;

  const canCreateQuotation = useMemo(() => {
    const currentStatus = normalizeUpperText(detail?.status);

    return (
      !detail?.quotation &&
      items.length > 0 &&
      CREATE_QUOTATION_STATUSES.has(currentStatus)
    );
  }, [detail?.quotation, detail?.status, items.length]);

  const displayWarehouseName = useMemo(() => {
    // 1. Dùng trực tiếp tên kho do API trả về nếu hợp lệ
    if (detail?.warehouseName && detail.warehouseName !== "string") return detail.warehouseName;
    if (detail?.destinationWarehouseName && detail.destinationWarehouseName !== "string") return detail.destinationWarehouseName;
    if (detail?.originWarehouseName && detail.originWarehouseName !== "string") return detail.originWarehouseName;
    if (detail?.warehouse?.name) return detail.warehouse.name;
    if (detail?.destinationWarehouse?.name) return detail.destinationWarehouse.name;
    if (detail?.originWarehouse?.name) return detail.originWarehouse.name;

    // 2. Tra cứu động theo warehouseId / destinationWarehouseId trong danh sách Kho từ API hệ thống
    const targetWhId = detail?.warehouseId || detail?.destinationWarehouseId || detail?.originWarehouseId;
    if (targetWhId && systemWarehouses.length > 0) {
      const foundWh = systemWarehouses.find(
        (wh) => String(wh.id || wh.warehouseId) === String(targetWhId)
      );
      if (foundWh?.name) return foundWh.name;
    }

    if (detail?.warehouseCode) return detail.warehouseCode;

    return "—";
  }, [detail, systemWarehouses]);

  const canConfirmPurchase = useMemo(() => {
    if (!detail) return false;
    const currentStatus = normalizeUpperText(detail?.status);

    // Nút "Xác nhận mua hộ" chỉ hiển thị ở các bước Sale xử lý:
    // Đã cọc/thanh toán -> Hàng đang đặt về -> Hàng đã về kho.
    // Khi sang bước WAITING_STORED (Hàng chờ nhập kho), nút ẩn hoàn toàn (chỉ Manager / Ops mới có quyền duyệt nhập kho).
    const ALLOWED_PURCHASE_STATUSES = new Set([
      "PAID",
      "DEPOSIT_PAID",
      "PURCHASED",
      "SELLER_SHIPPED",
      "ARRIVED_ORIGIN_WAREHOUSE",
    ]);

    return ALLOWED_PURCHASE_STATUSES.has(currentStatus);
  }, [detail]);

  const handleQuotationCreated =
    useCallback(async () => {
      setQuotationModalOpen(
        false
      );

      await loadDetail();
    }, [loadDetail]);

  if (loading) {
    return <DetailLoading />;
  }

  if (error || !detail) {
    return (
      <main className="purchase-detail-page">
        <div className="purchase-detail-error">
          <InboxOutlined />

          <h2>
            Không thể hiển thị yêu cầu mua hộ
          </h2>

          <p>
            {error ||
              "Không tìm thấy dữ liệu yêu cầu."}
          </p>

          <div>
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
              icon={
                <ReloadOutlined />
              }
              onClick={loadDetail}
            >
              Tải lại
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="purchase-detail-page">
      <div className="purchase-detail-shell">
        <div className="purchase-detail-topbar">
          <Button
            type="text"
            icon={
              <ArrowLeftOutlined />
            }
            onClick={() =>
              navigate(-1)
            }
            className="purchase-detail-back"
          >
            Quay lại danh sách
          </Button>

          <div className="purchase-detail-topbar__actions">
            {canCreateQuotation && (
              <Button
                type="primary"
                icon={
                  <DollarOutlined />
                }
                onClick={() =>
                  setQuotationModalOpen(
                    true
                  )
                }
                className="purchase-create-quotation-button"
              >
                Tạo báo giá
              </Button>
            )}

            {canConfirmPurchase && (
              <Button
                type="primary"
                icon={
                  <ShoppingOutlined />
                }
                onClick={() =>
                  setConfirmPurchaseModalOpen(
                    true
                  )
                }
                style={{
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  borderColor: "#16a34a",
                  fontWeight: 800,
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)",
                }}
              >
                Xác nhận mua hộ
              </Button>
            )}

            <Tag
              className={`purchase-detail-status ${status.className}`}
            >
              {status.label}
            </Tag>
          </div>
        </div>

        <section className="purchase-detail-hero">
          <div>
            <span className="purchase-detail-eyebrow">
              CHI TIẾT YÊU CẦU MUA HỘ
            </span>

            <div className="purchase-detail-title-row">
              <h1>
                {detail
                  ?.purchaseCode ||
                  "Yêu cầu mua hộ"}
              </h1>

              <Tooltip title="Sao chép mã yêu cầu">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await copyText(
                        detail
                          ?.purchaseCode
                      );

                      AuthNotify.success(
                        "Đã sao chép",
                        "Mã yêu cầu mua hộ đã được sao chép."
                      );
                    } catch (
                    copyError
                    ) {
                      AuthNotify.error(
                        "Không thể sao chép",
                        copyError
                          ?.message ||
                        "Vui lòng thử lại."
                      );
                    }
                  }}
                  className="purchase-detail-code-copy"
                >
                  <CopyOutlined />
                  Sao chép
                </button>
              </Tooltip>
            </div>

            <p>
              Hiển thị đầy đủ thông tin khách
              hàng, người nhận, dịch vụ bổ sung,
              sản phẩm và báo giá của yêu cầu.
            </p>
          </div>

          <div className="purchase-detail-hero-meta">
            <div className="hero-stat-card is-quantity">
              <ShoppingOutlined />
              <div>
                <span>
                  Tổng số lượng
                </span>
                <strong>
                  {formatNumber(
                    totalQuantity
                  )}
                </strong>
              </div>
            </div>

            <div className="hero-stat-card is-created">
              <CalendarOutlined />
              <div>
                <span>
                  Ngày tạo
                </span>

                <div
                  className="purchase-detail-date-value"
                  title={formatDateUtcTitle(
                    detail?.createdAt
                  )}
                >
                  <strong>
                    {formatDateTime(
                      detail?.createdAt
                    )}
                  </strong>

                  <small className="purchase-detail-timezone-badge">
                    UTC+7
                  </small>
                </div>
              </div>
            </div>

            {detail?.quotationCreatedAt && (
              <div className="hero-stat-card is-quoted">
                <TagsOutlined />
                <div>
                  <span>
                    Báo giá
                  </span>

                  <div
                    className="purchase-detail-date-value"
                    title={formatDateUtcTitle(
                      detail?.quotationCreatedAt
                    )}
                  >
                    <strong>
                      {formatDateTime(
                        detail?.quotationCreatedAt
                      )}
                    </strong>

                    <small className="purchase-detail-timezone-badge">
                      UTC+7
                    </small>
                  </div>
                </div>
              </div>
            )}

            {detail?.statusUpdatedAt && detail?.statusUpdatedAt !== detail?.createdAt && (
              <div className="hero-stat-card is-updated">
                <SyncOutlined />
                <div>
                  <span>
                    Cập nhật
                  </span>

                  <div
                    className="purchase-detail-date-value"
                    title={formatDateUtcTitle(
                      detail?.statusUpdatedAt
                    )}
                  >
                    <strong>
                      {formatDateTime(
                        detail?.statusUpdatedAt
                      )}
                    </strong>

                    <small className="purchase-detail-timezone-badge">
                      UTC+7
                    </small>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="purchase-detail-summary">
          <article>
            <EnvironmentOutlined />
            <div>
              <span>
                Tuyến vận chuyển
              </span>
              <strong>
                {translateRoute(
                  detail?.route
                )}
              </strong>
              <small>
                {detail?.route ||
                  "—"}
              </small>
            </div>
          </article>

          <article>
            <SafetyCertificateOutlined />
            <div>
              <span>
                Phương thức vận chuyển
              </span>
              <strong>
                {translateShippingOption(
                  detail
                    ?.shippingOption
                )}
              </strong>
            </div>
          </article>

          <article>
            <TeamOutlined />
            <div>
              <span>
                Người nhận
              </span>
              <strong>
                {detail
                  ?.receiverName ||
                  "—"}
              </strong>
            </div>
          </article>

          <article>
            <BankOutlined />
            <div>
              <span>
                Kho nhận dự kiến
              </span>
              <strong>
                {detail?.warehouseName ||
                  detail?.destinationWarehouseName ||
                  detail?.originWarehouseName ||
                  detail?.warehouse?.name ||
                  "—"}
              </strong>
            </div>
          </article>

          <article>
            <ShoppingOutlined />
            <div>
              <span>
                Số mặt hàng
              </span>
              <strong>
                {formatNumber(
                  items.length
                )}
              </strong>
            </div>
          </article>
        </section>

        <div className="purchase-detail-grid">
          <section className="purchase-detail-card">
            <div className="purchase-detail-section-heading">
              <UserOutlined />

              <div>
                <span>
                  THÔNG TIN KHÁCH HÀNG
                </span>
                <h2>
                  Người tạo yêu cầu
                </h2>
              </div>
            </div>

            <div className="purchase-detail-info-grid">
              <div>
                <span>
                  Tên khách hàng
                </span>
                <strong>
                  {detail
                    ?.customerName ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Người tạo
                </span>
                <strong>
                  {detail
                    ?.createdByName ||
                    "—"}
                </strong>
              </div>
            </div>
          </section>

          <section className="purchase-detail-card">
            <div className="purchase-detail-section-heading">
              <EnvironmentOutlined />

              <div>
                <span>
                  THÔNG TIN NHẬN HÀNG
                </span>
                <h2>
                  Người nhận tại Việt Nam
                </h2>
              </div>
            </div>

            <div className="purchase-detail-info-grid">
              <div>
                <span>
                  Họ và tên
                </span>
                <strong>
                  {detail
                    ?.receiverName ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>
                  Số điện thoại
                </span>
                <strong>
                  {detail
                    ?.receiverPhone ||
                    "—"}
                </strong>
              </div>

              <div className="is-full">
                <span>
                  Địa chỉ nhận hàng
                </span>
                <strong>
                  {detail
                    ?.receiverAddress ||
                    "—"}
                </strong>
              </div>
            </div>
          </section>
        </div>

        {/*
          Chỉ hiện khi đơn đã có kiện. Đơn còn đang báo giá mà bày ra khối hành trình rỗng
          thì Sale tưởng hệ thống mất dữ liệu.
        */}
        {journey.groups.length > 0 && (
          <section className="purchase-detail-card">
            <div className="purchase-detail-section-heading purchase-detail-section-heading--between">
              <div className="purchase-detail-section-heading__group">
                <InboxOutlined />

                <div>
                  <span>
                    HÀNH TRÌNH VẬN CHUYỂN
                  </span>

                  <h2>
                    Hàng đang đi tới đâu
                  </h2>
                </div>
              </div>

              <Tag className="purchase-service-count-tag">
                {describeJourneyScale(
                  journey
                )}
              </Tag>
            </div>

            <ShipmentJourney
              groups={journey.groups}
              discrepancyCount={
                journey.discrepancyCount
              }
            />
          </section>
        )}

        <section className="purchase-detail-card purchase-services-section">
          {selectedServiceCards.length > 0 && (
            <>
              <div className="purchase-detail-section-heading purchase-detail-section-heading--between">
                <div className="purchase-detail-section-heading__group">
                  <GiftOutlined />

                  <div>
                    <span>
                      DỊCH VỤ BỔ SUNG
                    </span>

                    <h2>
                      Yêu cầu dịch vụ của khách hàng
                    </h2>
                  </div>
                </div>

                <Tag className="purchase-service-count-tag">
                  {selectedServiceCount}/
                  {serviceCards.length} dịch vụ đã chọn
                </Tag>
              </div>

              <div className="purchase-service-grid">
                {selectedServiceCards.map(
                  (service) => (
                    <ServiceOptionCard
                      key={service.key}
                      icon={service.icon}
                      title={service.title}
                      description={
                        service.description
                      }
                      enabled
                      rule={service.rule}
                      fallbackValue={
                        service.fallbackValue
                      }
                      fallbackScope={
                        service.fallbackScope
                      }
                      fallbackCode={
                        service.fallbackCode
                      }
                    />
                  )
                )}
              </div>
            </>
          )}

          <div
            className="purchase-service-detail-grid"
            style={{
              marginTop: selectedServiceCards.length > 0 ? "16px" : "0px",
            }}
          >
            <div className="purchase-service-note-card">
              <span>
                GHI CHÚ CHUNG
              </span>

              <strong>
                {detail
                  ?.generalNote ||
                  "Không có ghi chú"}
              </strong>
            </div>

            <div className="purchase-service-note-card">
              <span>
                LÝ DO XỬ LÝ / TỪ CHỐI
              </span>

              <strong>
                {detail?.reason ||
                  "Không có"}
              </strong>
            </div>

            {Array.isArray(detail?.proofImages) &&
              detail.proofImages.filter((img) => Boolean(img) && img !== "string").length > 0 && (
                <div
                  className="purchase-service-note-card"
                  style={{ gridColumn: "1 / -1", marginTop: "8px" }}
                >
                  <span style={{ marginBottom: "8px", display: "block" }}>
                    BẰNG CHỨNG MUA HÀNG / HÓA ĐƠN ({detail.proofImages.filter((img) => Boolean(img) && img !== "string").length} ảnh)
                  </span>
                  <Image.PreviewGroup>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {detail.proofImages
                        .filter((img) => Boolean(img) && img !== "string")
                        .map((imgUrl, idx) => (
                          <Image
                            key={idx}
                            src={imgUrl}
                            alt={`Bằng chứng ${idx + 1}`}
                            width={100}
                            height={100}
                            style={{
                              objectFit: "cover",
                              borderRadius: "10px",
                              border: "1px solid #cbd5e1",
                            }}
                          />
                        ))}
                    </div>
                  </Image.PreviewGroup>
                </div>
              )}
          </div>
        </section>

        {pricingRuleRows.length > 0 && (
          <section className="purchase-detail-card purchase-pricing-section">
            <div className="purchase-detail-section-heading purchase-detail-section-heading--between">
              <div className="purchase-detail-section-heading__group">
                <DollarOutlined />

                <div>
                  <span>
                    CẤU HÌNH PHÍ DỊCH VỤ
                  </span>

                  <h2>
                    Bảng quy tắc tính phí đang hoạt động
                  </h2>
                </div>
              </div>

              <Tag className="purchase-pricing-applied-count">
                {formatNumber(
                  appliedPricingRuleCount
                )} cấu hình đã chọn
              </Tag>
            </div>

            <div className="purchase-pricing-intro">
              <DollarOutlined />

              <div>
                <strong>
                  Cách đọc bảng phí
                </strong>

                <p>
                  Bảng chỉ hiển thị các dịch vụ
                  khách hàng đã lựa chọn.
                  Quy tắc kỹ thuật và cấu hình
                  tham khảo được ẩn khỏi giao diện.
                </p>
              </div>
            </div>

            {pricingWarning && (
              <Alert
                type="warning"
                showIcon
                message="Chưa tải đủ cấu hình phí"
                description={
                  pricingWarning
                }
                className="purchase-pricing-warning"
              />
            )}

            <div
              className="purchase-pricing-table"
              role="table"
              aria-label="Bảng cấu hình phí dịch vụ"
            >
              <div
                className="purchase-pricing-table__head"
                role="row"
              >
                <span>
                  Dịch vụ / quy tắc
                </span>

                <span>
                  Mức cấu hình
                </span>

                <span>
                  Kiểu tính
                </span>

                <span>
                  Giới hạn phí
                </span>

                <span>
                  Trạng thái
                </span>
              </div>

              <div className="purchase-pricing-table__body">
                {pricingRuleRows.map(
                  (rule) => (
                    <article
                      key={
                        rule?.ruleId ||
                        rule?.ruleCode
                      }
                      className="purchase-pricing-table__row is-applied"
                      role="row"
                    >
                      <div
                        className="purchase-pricing-table__service"
                        data-label="Dịch vụ / quy tắc"
                      >
                        <span>
                          {rule?.ruleCode ||
                            "PRICING_RULE"}
                        </span>

                        <h3>
                          {rule?.ruleName ||
                            "Cấu hình phí dịch vụ"}
                        </h3>

                        <p>
                          {rule?.description ||
                            "Cấu hình phí được tải từ hệ thống."}
                        </p>
                      </div>

                      <div
                        className="purchase-pricing-table__amount"
                        data-label="Mức cấu hình"
                      >
                        <strong>
                          {formatPricingRuleValue(
                            rule
                          )}
                        </strong>

                        <small>
                          {getPricingRuleUnitLabel(
                            rule
                          )}
                        </small>
                      </div>

                      <div
                        className="purchase-pricing-table__calculation"
                        data-label="Kiểu tính"
                      >
                        <strong>
                          {getPricingRuleCalculationLabel(
                            rule
                          )}
                        </strong>

                        <small>
                          {rule?.conditionType ||
                            "Không có điều kiện"}
                        </small>
                      </div>

                      <div
                        className="purchase-pricing-table__limits"
                        data-label="Giới hạn phí"
                      >
                        <span>
                          Tối thiểu
                          <strong>
                            {formatPricingLimit(
                              rule?.minAmount
                            )}
                          </strong>
                        </span>

                        <span>
                          Tối đa
                          <strong>
                            {formatPricingLimit(
                              rule?.maxAmount
                            )}
                          </strong>
                        </span>
                      </div>

                      <div
                        className="purchase-pricing-table__status"
                        data-label="Trạng thái"
                      >
                        <Tag className="purchase-pricing-apply-tag is-applied">
                          Đã chọn
                        </Tag>
                      </div>
                    </article>
                  )
                )}
              </div>
            </div>

            <p className="purchase-pricing-note">
              Đây là mức cấu hình của hệ thống.
              Tổng tiền thanh toán chính thức vẫn
              sử dụng dữ liệu báo giá do API trả về.
            </p>
          </section>
        )}

        <section className="purchase-detail-card purchase-items-section">
          <div className="purchase-detail-section-heading purchase-detail-section-heading--between">
            <div className="purchase-detail-section-heading__group">
              <ShoppingOutlined />

              <div>
                <span>
                  DANH SÁCH SẢN PHẨM
                </span>
                <h2>
                  {formatNumber(
                    items.length
                  )}{" "}
                  mặt hàng
                </h2>
              </div>
            </div>

            <Tag className="purchase-total-quantity-tag">
              Tổng số lượng:{" "}
              {formatNumber(
                totalQuantity
              )}
            </Tag>
          </div>

          {items.length === 0 ? (
            <Empty description="Chưa có sản phẩm" />
          ) : (
            <div className="purchase-detail-item-list">
              {items.map(
                (item, index) => {
                  const images =
                    Array.isArray(
                      item
                        ?.imageUrls
                    )
                      ? item.imageUrls
                      : [];

                  return (
                    <article
                      key={
                        item
                          ?.itemId ||
                        index
                      }
                      className="purchase-detail-product-card"
                    >
                      <div className="purchase-detail-product-index">
                        {index + 1}
                      </div>

                      <div className="purchase-detail-product-gallery">
                        <ProductImageGallery
                          imageUrls={images}
                          productName={
                            item?.productName ||
                            "Sản phẩm"
                          }
                        />
                      </div>

                      <div className="purchase-detail-product-content">
                        <div className="purchase-detail-product-title">
                          <div>
                            <span>
                              SẢN PHẨM
                            </span>
                            <h3>
                              {item
                                ?.productName ||
                                "Sản phẩm"}
                            </h3>
                          </div>

                          <Tag>
                            Số lượng:{" "}
                            {formatNumber(
                              item
                                ?.quantity
                            )}
                          </Tag>
                        </div>

                        <div className="purchase-detail-product-info">
                          <div>
                            <span>
                              Website nguồn
                            </span>
                            <strong>
                              {item
                                ?.sourceWebsite ||
                                "—"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Mã loại hàng
                            </span>
                            <CopyValue
                              value={
                                item
                                  ?.productType
                              }
                              label="mã loại hàng"
                            />
                          </div>

                          <div>
                            <span>
                              Thuộc tính
                            </span>
                            <strong>
                              {item
                                ?.attributes ||
                                "Không có"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Ghi chú sản phẩm
                            </span>
                            <strong>
                              {item?.note ||
                                "Không có"}
                            </strong>
                          </div>
                        </div>

                        <div className="purchase-detail-product-link">
                          <GlobalOutlined />

                          <div>
                            <span>
                              Đường dẫn sản phẩm
                            </span>

                            {item
                              ?.productLink ? (
                              <a
                                href={
                                  item
                                    .productLink
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkOutlined />
                                Mở trang sản phẩm
                              </a>
                            ) : (
                              <strong>
                                Chưa có liên kết
                              </strong>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="purchase-detail-card purchase-detail-quotation-section">
          <div className="purchase-detail-section-heading">
            <TagsOutlined />

            <div>
              <span>
                THÔNG TIN BÁO GIÁ
              </span>
              <h2>
                Báo giá yêu cầu mua hộ
              </h2>
            </div>
          </div>

          <QuotationView
            quotation={
              detail?.quotation
            }
          />
        </section>
      </div>
      <CreatePurchaseRequestQuotationModal
        open={
          quotationModalOpen
        }
        onClose={() =>
          setQuotationModalOpen(
            false
          )
        }
        onSuccess={
          handleQuotationCreated
        }
        purchaseRequest={
          detail
        }
        pricingRules={
          pricingRules
        }
      />

      <ConfirmPurchaseModal
        open={confirmPurchaseModalOpen}
        onClose={() =>
          setConfirmPurchaseModalOpen(false)
        }
        onSuccess={async (data) => {
          setConfirmPurchaseModalOpen(false);
          if (data?.status) {
            setDetail((prev) => (prev ? { ...prev, status: data.status } : prev));
          }
          await loadDetail();
        }}
        purchaseRequest={detail}
      />
    </main>
  );
}