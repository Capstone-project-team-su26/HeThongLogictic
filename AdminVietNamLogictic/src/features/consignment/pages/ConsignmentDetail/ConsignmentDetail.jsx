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
  InfoCircleOutlined,
  HomeOutlined,
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
} from "@features/consignment/api/consignmentService";
import {
  getProductTypesApi,
} from "@features/consignment/api/consignmentMasterService";
import {
  PRICING_RULE_CODE,
  findPricingRuleByCode,
  getActivePricingRulesApi,
} from "@features/pricing/api/pricingRuleService";
import ShipmentJourney from "@features/shipment/components/ShipmentJourney/ShipmentJourney";
import {
  describeJourneyScale,
  summarizeJourney,
} from "@features/shipment/components/ShipmentJourney/journeySummary";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import {
  ReviewFacts,
  ReviewItemsTable,
} from "@shared/components/SubmitReview/SubmitReview";
import { formatReviewMoney } from "@shared/components/SubmitReview/submitReviewFormat";
import { DIM_DECIMAL_PLACES } from "./ConsignmentDetail.constants";
import {
  getOrderStatusLabel,
  normalizeOrderStatus,
  ORDER_STATUS,
} from "../../constants/orderStatus";
import {
  calculateItemDimKg,
  calculateItemVolumeCm3,
  convertCm3ToM3,
  formatCurrency,
  formatDateTime,
  formatDimWeight,
  formatMeasurement,
  formatOrderNote,
  formatSystemDescription,
  resolveItemDim,
  describeItemService,
  getItemDeclaredValue,
  getItemDomesticTrackingCode,
  getItemHeightCm,
  getItemImageUrls,
  getItemLengthCm,
  getItemName,
  getItemPackageConfiguration,
  getItemPackageFee,
  getItemServices,
  getItemQuantity,
  getItemWeightKg,
  getItemWidthCm,
  getOrderStatus,
  getProductTypeName,
  getQuotationStatus,
  normalizePositiveNumber,
  normalizeText,
  roundToDecimals,
  translateCalculationType,
  translateConditionType,
  translateConsignmentType,
  translatePackageConfiguration,
  translateQuoteType,
  translateRoute,
} from "./ConsignmentDetail.helpers";
import "./ConsignmentDetail.css";

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

  /* Hành trình vận chuyển quốc tế của đơn, kèm số liệu cho phần tiêu đề. */
  const journey = useMemo(() => {
    const summary = summarizeJourney(
      detail?.shipments
    );

    return {
      ...summary,
      // Số kiện kho đã phân loại là khách gửi lại — quyết định có cần Sale xác nhận hay không.
      storeAtVnCount: summary.groups
        .flatMap(
          (group) =>
            group?.parcels || []
        )
        .filter(
          (parcel) =>
            String(
              parcel?.destinationHandling ||
                ""
            ).toUpperCase() ===
            "STORE_AT_VN"
        ).length,
    };
  }, [detail]);

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
    /* Backend nhận rule hệ số theo ruleCode HOẶC ruleType VOLUMETRIC_DIVISOR. */
    return (
      findPricingRuleByCode(
        pricingRules,
        PRICING_RULE_CODE
          .VOLUMETRIC_DIVISOR
      ) ||
      pricingRules.find(
        (rule) =>
          normalizeText(
            rule?.ruleType
          ).toUpperCase() ===
          PRICING_RULE_CODE
            .VOLUMETRIC_DIVISOR
      ) ||
      null
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

  /* Mã đơn đã chuẩn hóa về mã đích (mã cũ PENDING → PENDING_REVIEW…). */
  const currentOrderStatus =
    normalizeText(
      normalizeOrderStatus(
        detail?.status ??
        detail?.orderStatus ??
        detail?.consignmentStatus
      )
    ).toUpperCase();



  /*
   * BACKEND ĐÃ BỎ BƯỚC "DUYỆT ĐƠN".
   *
   * PUT /api/orders/consignments/{id}/status chỉ còn nhận REJECTED hoặc
   * NEED_MORE_INFO (gửi APPROVED bị 400), và chỉ đổi được khi đơn đang ở một
   * trong năm trạng thái dưới đây (VCL_BLL/Services/OrderService.Workflow.cs —
   * ReviewableStatuses). Sale xem xong thì gửi báo giá thẳng, không duyệt đơn.
   */
  const REVIEWABLE_ORDER_STATUSES = [
    ORDER_STATUS.PENDING_REVIEW,
    ORDER_STATUS.NEED_MORE_INFO,
    ORDER_STATUS.APPROVED,
    ORDER_STATUS.QUOTATION_SENT,
    ORDER_STATUS.QUOTATION_REJECTED,
  ];

  const canReviewOrder =
    REVIEWABLE_ORDER_STATUSES.includes(
      currentOrderStatus
    );

  /*
   * Trạng thái hoàn tất thao tác phải dựa
   * vào trạng thái đơn hàng, không lấy trạng
   * thái báo giá để tránh hiển thị sai nút.
   */
  const isOrderCancelled = [
    "REJECTED",
    "CANCELLED",
  ].includes(currentOrderStatus);

  const isMoreInfoRequested =
    currentOrderStatus ===
    ORDER_STATUS.NEED_MORE_INFO;

  const canShowReviewActions =
    !readOnly &&
    (canReviewOrder || isOrderCancelled);

  const openReviewModal = (
    action
  ) => {
    if (
      !canReviewOrder ||
      statusUpdating ||
      statusUpdateLockRef.current
    ) {
      AuthNotify.warning(
        "Không thể thực hiện thao tác",
        "Chỉ đơn chưa có báo giá được khách chấp nhận mới từ chối hoặc yêu cầu bổ sung được. Đơn đã thanh toán thì xử lý bằng luồng huỷ đơn."
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
      if (
        statusUpdating ||
        statusUpdateLockRef.current ||
        !canReviewOrder
      ) {
        return;
      }

      const nextStatus =
        reviewAction === "REJECT"
          ? "REJECTED"
          : "NEED_MORE_INFO";

      const normalizedReason =
        normalizeText(
          rejectionReason
        );

      /* Cả hai quyết định đều BẮT BUỘC có lý do — backend cũng chặn. */
      if (normalizedReason.length < 3) {
        AuthNotify.warning(
          nextStatus === "REJECTED"
            ? "Thiếu lý do từ chối"
            : "Thiếu nội dung cần bổ sung",
          nextStatus === "REJECTED"
            ? "Vui lòng nhập lý do từ chối ít nhất 3 ký tự."
            : "Vui lòng ghi rõ khách cần bổ sung gì, ít nhất 3 ký tự."
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
            /* Cả REJECTED lẫn NEED_MORE_INFO đều bắt buộc gửi lý do. */
            rejectionReason: normalizedReason,
          }
        );

        /*
         * Cập nhật giao diện ngay sau khi API thành công.
         */
        setDetail(
          (previousDetail) => ({
            ...previousDetail,
            status: nextStatus,
            rejectionReason: normalizedReason,
          })
        );

        setReviewModalOpen(false);
        setReviewAction("");
        setRejectionReason("");

        AuthNotify.success(
          nextStatus === "REJECTED"
            ? "Đã từ chối yêu cầu"
            : "Đã gửi yêu cầu bổ sung",
          nextStatus === "REJECTED"
            ? "Yêu cầu ký gửi đã bị từ chối và khách hàng đã nhận được lý do."
            : "Khách hàng đã nhận thông báo cần bổ sung thông tin cho đơn này."
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
              navigate("/sale/customers?tab=support", {
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
            {/*
              Viết thẳng phép so sánh ra chữ. Trước đây chỉ ghi "lấy mức lớn hơn",
              Sale vẫn phải tự nhìn hai thẻ bên cạnh rồi tự so.
            */}
            <small className="consignment-chargeable-formula">
              max(cân thực{" "}
              {formatMeasurement(
                displayTotalWeightKg,
                DIM_DECIMAL_PLACES
              )}{" "}
              kg ; quy đổi{" "}
              {formatMeasurement(
                totalDimKg,
                DIM_DECIMAL_PLACES
              )}{" "}
              kg)
              {totalDimKg > displayTotalWeightKg
                ? " → tính theo quy đổi"
                : " → tính theo cân thực"}
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
                    ? "Yêu cầu đã bị từ chối"
                    : isMoreInfoRequested
                      ? "Đang chờ khách bổ sung thông tin"
                      : "Xử lý yêu cầu ký gửi"
                }
                description={
                  isOrderCancelled
                    ? "Yêu cầu này đã bị từ chối và không thể thao tác lại."
                    : isMoreInfoRequested
                      ? "Đã gửi yêu cầu bổ sung cho khách. Khách bổ sung xong thì gửi báo giá, hoặc yêu cầu bổ sung tiếp."
                      : "Hệ thống đã bỏ bước duyệt đơn: xem xong thì gửi báo giá thẳng, hoặc yêu cầu khách bổ sung / từ chối yêu cầu."
                }
                extra={
                  <Tag className="consignment-review-card__status">
                    {isOrderCancelled
                      ? "Đã từ chối"
                      : isMoreInfoRequested
                        ? "Chờ bổ sung"
                        : "Đang xử lý"}
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
                        ? "Yêu cầu đã bị từ chối"
                        : "Kiểm tra thông tin trước khi quyết định"}
                    </strong>

                    <span>
                      {isOrderCancelled
                        ? "Nút từ chối được giữ lại để thể hiện trạng thái nhưng đã bị khóa."
                        : "Cả hai thao tác đều BẮT BUỘC ghi lý do — nội dung này được gửi thẳng cho khách hàng."}
                    </span>
                  </div>
                </div>

                <div className="consignment-review-card__actions">
                  <Button
                    size="large"
                    icon={<InfoCircleOutlined />}
                    loading={
                      statusUpdating &&
                      reviewAction ===
                      "NEED_MORE_INFO"
                    }
                    disabled={
                      statusUpdating ||
                      !canReviewOrder
                    }
                    onClick={() =>
                      openReviewModal(
                        "NEED_MORE_INFO"
                      )
                    }
                    className="consignment-review-card__more-info"
                  >
                    Yêu cầu bổ sung
                  </Button>

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
                      !canReviewOrder
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
                      ? "Đã từ chối yêu cầu"
                      : "Từ chối yêu cầu"}
                  </Button>
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

              {/*
                Nguyện vọng khách khai lúc đặt đơn. Sale cần thấy trước khi hàng về để còn
                chuẩn bị: giao ngay thì lo tuyến nội địa, gửi kho thì lo chỗ kệ và báo phí.
              */}
              <DetailItem
                icon={<HomeOutlined />}
                label="Khi hàng về Việt Nam"
                value={
                  detail?.defaultDestinationHandlingText ||
                  "Khách chưa chọn — mặc định giao ngay"
                }
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

          {/* ================= SHIPMENT JOURNEY ================= */}

          {/*
            Chỉ hiện khi đơn đã có kiện. Đơn còn đang báo giá mà bày ra khối hành trình rỗng
            thì Sale tưởng hệ thống mất dữ liệu.
          */}
          {journey.groups.length > 0 && (
            <section className="consignment-detail-card">
              <SectionTitle
                icon={<InboxOutlined />}
                title="Hành trình lô hàng"
                description="Kiện của đơn đang đi lô nào, tới đâu, và kho Việt Nam kiểm đếm ra sao."
                extra={
                  <Tag className="consignment-package-tag">
                    {describeJourneyScale(
                      journey
                    )}
                  </Tag>
                }
              />

              {/*
                Chỉ báo trạng thái, không phải chỗ bấm. Việc thông báo cho kho nằm ở mục
                "Đơn hàng cần xử lý" và chỉ mở sau khi khách tất toán.
              */}
              {journey.storeAtVnCount > 0 &&
                (detail?.warehouseNotifiedAt ? (
                  <div className="storage-eligible-banner is-done">
                    <CheckCircleOutlined />

                    <span>
                      Đã thông báo cho kho
                      lúc{" "}
                      {formatDateTime(
                        detail.warehouseNotifiedAt
                      )}
                      {detail.warehouseNotifiedNote
                        ? ` — “${detail.warehouseNotifiedNote}”`
                        : ""}
                    </span>
                  </div>
                ) : (
                  <div className="storage-eligible-banner">
                    <div>
                      <strong>
                        {
                          journey.storeAtVnCount
                        }{" "}
                        kiện khách xin gửi
                        lại kho VN
                      </strong>

                      <p>
                        Sau khi khách tất
                        toán, vào mục{" "}
                        <strong>
                          Đơn hàng cần xử lý
                        </strong>{" "}
                        để thông báo cho kho
                        lập phiếu nhập.
                      </p>
                    </div>
                  </div>
                ))}

              <ShipmentJourney
                groups={journey.groups}
                discrepancyCount={
                  journey.discrepancyCount
                }
              />
            </section>
          )}

          {/*
            Hàng hoàn: luồng mới đi qua yêu cầu giao (DELIVERY_RETURNED → giao lại) ở màn
            "Yêu cầu giao hàng", không còn hồ sơ hàng hoàn riêng trên đơn.
          */}

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
                  Kích thước (cm) lấy theo từng dòng hàng khách khai; hệ số lấy từ cấu hình
                  hệ thống (màn Tham số vận hành), cùng số backend dùng để báo giá.
                  Mọi số quy đổi bên dưới đều chia cho đúng hệ số này.
                  Cước tính theo <b>cân lớn hơn</b> giữa cân thực và cân quy đổi.
                </small>

                {/*
                  Ví dụ bằng chính số của đơn này: bản tổng để Sale đọc nhanh,
                  bản chi tiết từng kiện nằm ở cột "Khối lượng quy đổi" bên dưới.
                */}
                {hasApiDimDivisor &&
                  displayTotalVolumeCm3 > 0 && (
                    <span className="consignment-dim-formula__example">
                      Đơn này:{" "}
                      {formatMeasurement(
                        displayTotalVolumeCm3,
                        4
                      )}{" "}
                      cm³ ÷{" "}
                      {formatMeasurement(
                        dimDivisor,
                        0
                      )}{" "}
                      ={" "}
                      {formatMeasurement(
                        totalDimKg,
                        DIM_DECIMAL_PLACES
                      )}{" "}
                      kg quy đổi, cân thực{" "}
                      {formatMeasurement(
                        displayTotalWeightKg,
                        DIM_DECIMAL_PLACES
                      )}{" "}
                      kg →{" "}
                      <b>
                        tính cước{" "}
                        {formatMeasurement(
                          chargeableWeightKg,
                          DIM_DECIMAL_PLACES
                        )}{" "}
                        kg
                      </b>
                    </span>
                  )}
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

                        const itemDim =
                          resolveItemDim(
                            item,
                            dimDivisor
                          );

                        const itemDimKg =
                          itemDim.dimKg;

                        /*
                         * Ba số dưới đây để Sale đọc được CÔNG THỨC ngay trên dòng,
                         * không phải mở máy tính: kích thước thật của kiện, cân thực,
                         * và cân nào đang thắng để tính cước.
                         */
                        const itemActualWeightKg =
                          getItemWeightKg(item);

                        const itemChargeableKg =
                          Math.max(
                            itemActualWeightKg,
                            itemDimKg
                          );

                        const itemDimIsBilled =
                          itemDimKg >
                          itemActualWeightKg;

                        const itemHasDimensions =
                          getItemLengthCm(item) >
                            0 &&
                          getItemWidthCm(item) >
                            0 &&
                          getItemHeightCm(item) >
                            0;

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

                        /* Dịch vụ khách chọn cho riêng kiện này (kiểm hàng, bảo hiểm, đóng lại carton...). */
                        const itemServices =
                          getItemServices(item);

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

                                  {itemServices.length > 0 ? (
                                    <div className="consignment-item-services">
                                      {itemServices.map(
                                        (service, serviceIndex) => (
                                          <Tag
                                            key={
                                              service?.pricingRuleId ||
                                              service?.code ||
                                              `svc-${serviceIndex}`
                                            }
                                            className="consignment-item-service-tag"
                                          >
                                            {describeItemService(service)}
                                          </Tag>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <small className="consignment-api-empty">
                                      Không chọn dịch vụ kèm kiện
                                    </small>
                                  )}
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

                                {/*
                                  Công thức viết ra bằng CHÍNH SỐ CỦA KIỆN NÀY.
                                  Khách hay hỏi "sao ra con số đó" nên Sale phải
                                  đọc được ngay, không đi tra bảng.
                                */}
                                {itemHasDimensions &&
                                  hasApiDimDivisor && (
                                    <small className="consignment-dim-formula-line">
                                      {formatMeasurement(
                                        getItemLengthCm(
                                          item
                                        ),
                                        4
                                      )}
                                      {" × "}
                                      {formatMeasurement(
                                        getItemWidthCm(
                                          item
                                        ),
                                        4
                                      )}
                                      {" × "}
                                      {formatMeasurement(
                                        getItemHeightCm(
                                          item
                                        ),
                                        4
                                      )}
                                      {" ÷ "}
                                      {formatMeasurement(
                                        dimDivisor,
                                        0
                                      )}
                                    </small>
                                  )}

                                <small>
                                  {itemDim.source ===
                                  "DIVISOR"
                                    ? `= ${formatMeasurement(
                                      itemVolumeCm3,
                                      4
                                    )} cm³ ÷ ${formatMeasurement(
                                      dimDivisor,
                                      0
                                    )}`
                                    : itemDim.source ===
                                      "API"
                                      ? "Số hệ thống trả theo kích thước khai trên dòng hàng (chưa tải được hệ số)"
                                      : "Chưa đủ dữ liệu để tính"}
                                </small>

                                {itemDim.isApiMismatch && (
                                  <small className="consignment-dim-formula-line">
                                    API chi tiết đơn trả{" "}
                                    {formatDimWeight(
                                      itemDim.apiDimKg
                                    )}{" "}
                                    kg (backend chia theo hệ số khác cấu hình hiện hành)
                                  </small>
                                )}

                                {/*
                                  Cân tính cước = cân lớn hơn. Ghi rõ bên nào thắng
                                  để Sale không phải tự so hai cột.
                                */}
                                {itemChargeableKg > 0 && (
                                  <span
                                    className={`consignment-dim-billed ${itemDimIsBilled
                                        ? "is-dim"
                                        : "is-actual"
                                      }`}
                                  >
                                    Tính cước{" "}
                                    {formatDimWeight(
                                      itemChargeableKg
                                    )}{" "}
                                    kg
                                    <small>
                                      {itemDimIsBilled
                                        ? "theo quy đổi"
                                        : "theo cân thực"}
                                    </small>
                                  </span>
                                )}
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
        width={900}
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
                <InfoCircleOutlined />
              )}
            </div>

            <div>
              <span>
                XÁC NHẬN TRẠNG THÁI
              </span>

              <h2>
                {reviewAction ===
                  "REJECT"
                  ? "Từ chối yêu cầu ký gửi"
                  : "Yêu cầu khách bổ sung thông tin"}
              </h2>

              <p>
                {reviewAction ===
                  "REJECT"
                  ? "Yêu cầu sẽ chuyển sang trạng thái Đã từ chối."
                  : "Yêu cầu sẽ chuyển sang trạng thái Cần bổ sung thông tin."}
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

            {/*
              Đủ thông tin đơn sắp đổi trạng thái: khách, trạng thái hiện tại → mới, tuyến,
              báo giá đang có (từ chối thì báo giá này hết hiệu lực) và từng dòng hàng. Lấy
              nguyên từ chi tiết đơn đã nạp trên trang, không gọi thêm.
            */}
            <ReviewFacts
              items={[
                {
                  label: "Khách hàng",
                  value: [detail?.customer?.fullName, detail?.customer?.phone]
                    .filter(Boolean)
                    .join(" · "),
                },
                { label: "Email", value: detail?.customer?.email },
                {
                  label: "Trạng thái",
                  value: `${getOrderStatusLabel(detail?.status)} → ${
                    reviewAction === "REJECT"
                      ? "Đã từ chối"
                      : "Cần bổ sung thông tin"
                  }`,
                },
                { label: "Tuyến", value: detail?.route },
                {
                  label: "Người nhận",
                  value: [detail?.receiverName, detail?.receiverPhone]
                    .filter(Boolean)
                    .join(" · "),
                },
                {
                  label: "Báo giá hiện có",
                  value: detail?.quotation
                    ? `${detail.quotation.status || "—"} · ${formatReviewMoney(
                        detail.quotation.totalEstimatedCost
                      )}`
                    : "Chưa có",
                },
                {
                  label: "Địa chỉ giao",
                  value: detail?.receiverAddress,
                  span: 2,
                },
              ]}
            />

            <ReviewItemsTable
              title="Hàng khách khai trên đơn"
              items={detail?.items || []}
            />

            {/* Cả hai quyết định đều bắt buộc ghi lý do — backend chặn nếu để trống. */}
            <div className="consignment-review-modal__reason">
              <label htmlFor="consignment-rejection-reason">
                {reviewAction === "REJECT"
                  ? "Lý do từ chối"
                  : "Nội dung cần khách bổ sung"}
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
                placeholder={
                  reviewAction === "REJECT"
                    ? "Nhập lý do từ chối yêu cầu ký gửi..."
                    : "Ví dụ: thiếu ảnh sản phẩm, chưa khai giá trị hàng..."
                }
                onChange={(event) =>
                  setRejectionReason(
                    event.target.value
                  )
                }
              />

              <small>
                Nội dung này được gửi thẳng cho khách hàng, cần ít nhất 3 ký tự.
              </small>
            </div>

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
                <InfoCircleOutlined />
              )}

              <span>
                {reviewAction ===
                  "REJECT"
                  ? "Đơn bị từ chối sẽ không báo giá được nữa; báo giá đang chờ khách cũng bị thay thế."
                  : "Khách nhận thông báo và bổ sung thông tin; sau đó Sale gửi báo giá như bình thường."}
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
                  <InfoCircleOutlined />
                )
              }
              loading={
                statusUpdating
              }
              disabled={
                statusUpdating ||
                normalizeText(
                  rejectionReason
                ).length < 3
              }
              onClick={
                handleConfirmReviewStatus
              }
            >
              {reviewAction ===
                "REJECT"
                ? "Xác nhận từ chối"
                : "Gửi yêu cầu bổ sung"}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
