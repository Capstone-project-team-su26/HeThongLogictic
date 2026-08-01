import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";

import { DatePicker, Input, Select, Space } from "antd";
import {
  Button,
  CircularProgress,
  Pagination,
} from "@mui/material";

import AutorenewIcon from "@mui/icons-material/Autorenew";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import SearchIcon from "@mui/icons-material/Search";

import { getPurchaseRequestsApi } from "../../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import AuthNotify from "../../../../utils/Common/AuthNotify";

import {
  apiToTimestamp,
  apiToUtcIso,
  formatUtcDateTime,
  formatVietnamDateTime,
} from "../../../../utils/timeUtc";

import "./PendingPurchaseRequestListHistory.css";

const { RangePicker } = DatePicker;

const ALL_STATUS = "ALL";
const DEFAULT_PAGE_SIZE = 10;
const FETCH_PAGE_SIZE = 100;

const PURCHASE_STATUS_CONFIG = {
  PENDING_REVIEW: {
    label: "Chờ duyệt",
    className: "status-pending-review",
  },
  IN_REVIEW: {
    label: "Đang duyệt",
    className: "status-processing",
  },
  APPROVED: {
    label: "Đã duyệt",
    className: "status-approved",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "status-rejected",
  },
  QUOTATION_SENT: {
    label: "Đã gửi báo giá",
    className: "status-quotation-sent",
  },
  WAITING_DEPOSIT: {
    label: "Chờ đặt cọc",
    className: "status-waiting-deposit",
  },
  DEPOSIT_PAID: {
    label: "Đã đặt cọc",
    className: "status-deposit-paid",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "status-processing",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "status-completed",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "status-cancelled",
  },
};

const DEPOSIT_STATUS_CODES = [
  "WAITING_DEPOSIT",
  "DEPOSIT_PAID",
];

const DEPOSIT_STATUS_SET = new Set(DEPOSIT_STATUS_CODES);

const STATUS_OPTIONS = [
  {
    value: ALL_STATUS,
    label: "Tất cả trạng thái cọc",
  },
  {
    value: "WAITING_DEPOSIT",
    label: PURCHASE_STATUS_CONFIG.WAITING_DEPOSIT.label,
  },
  {
    value: "DEPOSIT_PAID",
    label: PURCHASE_STATUS_CONFIG.DEPOSIT_PAID.label,
  },
];

const normalizeDepositStatusFilter = (value) => {
  const normalizedValue = String(value || "")
    .trim()
    .toUpperCase();

  if (normalizedValue === ALL_STATUS) {
    return ALL_STATUS;
  }

  return DEPOSIT_STATUS_SET.has(normalizedValue)
    ? normalizedValue
    : ALL_STATUS;
};

const getDepositStatusesToLoad = (statusFilter) => {
  const normalizedStatus =
    normalizeDepositStatusFilter(statusFilter);

  return normalizedStatus === ALL_STATUS
    ? DEPOSIT_STATUS_CODES
    : [normalizedStatus];
};

const normalizeText = (value) => {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const getProductNames = (item) => {
  const names = Array.isArray(item?.items)
    ? item.items
        .map((product) => String(product?.productName || "").trim())
        .filter(Boolean)
    : [];

  return Array.from(new Set(names));
};

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("Không thể sao chép mã yêu cầu.");
  }
};

const normalizeApiTimeToUtc = (value) => {
  return apiToUtcIso(value, {
    apiTimeMode: "utc",
  });
};

const normalizePurchaseRequestTime = (item) => {
  if (!item) {
    return item;
  }

  return {
    ...item,
    createdAtUtc: normalizeApiTimeToUtc(item.createdAt),
    updatedAtUtc: normalizeApiTimeToUtc(item.updatedAt),
  };
};

const formatDate = (value) => {
  const utcIso = normalizeApiTimeToUtc(value);

  if (!utcIso) {
    return "-";
  }

  return formatVietnamDateTime(utcIso, {
    apiTimeMode: "utc",
    fallback: "-",
  });
};

const formatDateUtcTitle = (value) => {
  const utcIso = normalizeApiTimeToUtc(value);

  if (!utcIso) {
    return "";
  }

  return `UTC+0: ${formatUtcDateTime(utcIso, {
    apiTimeMode: "utc",
    fallback: "-",
  })}`;
};

const getPurchaseStatusCode = (itemOrStatus) => {
  const value =
    typeof itemOrStatus === "object"
      ? itemOrStatus?.status
      : itemOrStatus;

  return String(value || "")
    .trim()
    .toUpperCase();
};

const getPurchaseStatus = (itemOrStatus) => {
  const code = getPurchaseStatusCode(itemOrStatus);
  const configuredStatus = PURCHASE_STATUS_CONFIG[code];

  if (configuredStatus) {
    return {
      code,
      ...configuredStatus,
    };
  }

  const fallbackLabel = code
    ? code
        .replace(/_/g, " ")
        .toLocaleLowerCase("vi-VN")
        .replace(
          /(^|\s)\S/g,
          (character) => character.toLocaleUpperCase("vi-VN")
        )
    : "Chưa xác định";

  return {
    code: code || "UNKNOWN",
    label: fallbackLabel,
    className: "status-unknown",
  };
};

const getShippingOptionLabel = (value) => {
  const normalizedType = String(value || "")
    .trim()
    .toUpperCase();

  if (normalizedType === "EXPRESS") {
    return "HỎA TỐC";
  }

  if (normalizedType === "STANDARD") {
    return "TIÊU CHUẨN";
  }

  if (normalizedType === "ECONOMY") {
    return "TIẾT KIỆM";
  }

  return String(value || "-").toUpperCase();
};

const getPurchaseCode = (item) => {
  return (
    String(item?.purchaseCode || "").trim() || "-"
  );
};

const getPurchaseRequestId = (item) => {
  return String(item?.purchaseRequestId || "").trim();
};

const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.title ||
    error?.message ||
    "Không thể tải danh sách yêu cầu mua hộ."
  );
};

const getUniquePurchaseKey = (item, index) => {
  return String(
    item?.purchaseRequestId ||
      item?.purchaseCode ||
      item?.id ||
      `purchase-${index}`
  ).trim();
};

const loadAllPurchaseRequestsByStatus = async (status) => {
  const firstPage = await getPurchaseRequestsApi({
    pageNumber: 1,
    pageSize: FETCH_PAGE_SIZE,
    status,
  });

  const firstItems = Array.isArray(firstPage?.items)
    ? firstPage.items
    : [];

  if ((Number(firstPage?.totalPages) || 1) <= 1) {
    return firstItems;
  }

  const remainingPageNumbers = Array.from(
    {
      length: Math.max(0, Number(firstPage.totalPages) - 1),
    },
    (_, index) => index + 2
  );

  const remainingResponses = await Promise.all(
    remainingPageNumbers.map((pageNumber) =>
      getPurchaseRequestsApi({
        pageNumber,
        pageSize: FETCH_PAGE_SIZE,
        status,
      })
    )
  );

  return [
    ...firstItems,
    ...remainingResponses.flatMap((response) =>
      Array.isArray(response?.items) ? response.items : []
    ),
  ];
};

export default function PendingPurchaseRequestListHistory() {
  const navigate = useNavigate();

  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [dateRangeInput, setDateRangeInput] = useState(null);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedPurchaseCode, setCopiedPurchaseCode] = useState("");

  const copyResetTimerRef = useRef(null);

  const fetchPurchaseRequests = useCallback(async () => {
    try {
      setLoading(true);

      const statusesToLoad = getDepositStatusesToLoad(statusFilter);
      const statusResults = await Promise.all(
        statusesToLoad.map(loadAllPurchaseRequestsByStatus)
      );

      const uniqueItems = Array.from(
        new Map(
          statusResults.flat().map((item, index) => [
            getUniquePurchaseKey(item, index),
            item,
          ])
        ).values()
      );

      const normalizedItems = uniqueItems
        .map(normalizePurchaseRequestTime)
        .filter((item) => {
          const statusCode = getPurchaseStatusCode(item);

          return (
            DEPOSIT_STATUS_SET.has(statusCode) &&
            (statusFilter === ALL_STATUS ||
              statusCode ===
                normalizeDepositStatusFilter(statusFilter))
          );
        })
        .sort((firstItem, secondItem) => {
          const firstTime =
            apiToTimestamp(firstItem?.createdAtUtc, {
              apiTimeMode: "utc",
            }) || 0;

          const secondTime =
            apiToTimestamp(secondItem?.createdAtUtc, {
              apiTimeMode: "utc",
            }) || 0;

          return secondTime - firstTime;
        });

      setPurchaseRequests(normalizedItems);
      setTotalCount(normalizedItems.length);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách mua hộ:", error);

      setPurchaseRequests([]);
      setTotalCount(0);

      AuthNotify.error(
        "Không tải được danh sách mua hộ",
        getErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPurchaseRequests();
  }, [fetchPurchaseRequests, refreshKey]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const disabledRangeDate = (currentDate, info) => {
    const fromDate = info?.from;

    if (!currentDate || !fromDate) {
      return false;
    }

    return currentDate.isBefore(fromDate, "day");
  };

  const handleDateRangeChange = (dates) => {
    if (!Array.isArray(dates) || !dates[0] || !dates[1]) {
      setDateRangeInput(null);
      setPageNumber(1);
      return;
    }

    const startDate = dayjs(dates[0]).startOf("day");
    const endDate = dayjs(dates[1]).startOf("day");

    if (endDate.isBefore(startDate, "day")) {
      AuthNotify.warning(
        "Khoảng ngày không hợp lệ",
        "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu."
      );

      setDateRangeInput([startDate, startDate]);
      setPageNumber(1);
      return;
    }

    setDateRangeInput([startDate, endDate]);
    setPageNumber(1);
  };

  const filteredPurchaseRequests = useMemo(() => {
    const normalizedSearch = normalizeText(searchInput);

    const startTimestamp = dateRangeInput?.[0]
      ? dateRangeInput[0].startOf("day").valueOf()
      : null;

    const endTimestamp = dateRangeInput?.[1]
      ? dateRangeInput[1].endOf("day").valueOf()
      : null;

    return purchaseRequests.filter((item) => {
      const searchableContent = [
        item?.purchaseRequestId,
        item?.purchaseCode,
        item?.customerId,
        item?.customerName,
        item?.receiverName,
        item?.shippingOption,
        getPurchaseStatusCode(item),
        getPurchaseStatus(item).label,
        item?.route,
        item?.generalNote,
        getProductNames(item).join(" "),
      ]
        .filter(Boolean)
        .map(normalizeText)
        .join(" ");

      const matchesSearch =
        !normalizedSearch ||
        searchableContent.includes(normalizedSearch);

      const createdTimestamp = apiToTimestamp(
        item?.createdAtUtc || item?.createdAt,
        {
          apiTimeMode: "utc",
        }
      );

      const matchesStartDate =
        startTimestamp === null ||
        (createdTimestamp !== null &&
          createdTimestamp >= startTimestamp);

      const matchesEndDate =
        endTimestamp === null ||
        (createdTimestamp !== null &&
          createdTimestamp <= endTimestamp);

      const currentStatus = getPurchaseStatusCode(item);
      const normalizedStatusFilter =
        normalizeDepositStatusFilter(statusFilter);

      const matchesDepositStatus =
        DEPOSIT_STATUS_SET.has(currentStatus);

      const matchesSelectedStatus =
        normalizedStatusFilter === ALL_STATUS ||
        currentStatus === normalizedStatusFilter;

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate &&
        matchesDepositStatus &&
        matchesSelectedStatus
      );
    });
  }, [purchaseRequests, dateRangeInput, searchInput, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPurchaseRequests.length / DEFAULT_PAGE_SIZE)
  );

  const visiblePurchaseRequests = useMemo(() => {
    const startIndex = (pageNumber - 1) * DEFAULT_PAGE_SIZE;

    return filteredPurchaseRequests.slice(
      startIndex,
      startIndex + DEFAULT_PAGE_SIZE
    );
  }, [filteredPurchaseRequests, pageNumber]);

  useEffect(() => {
    if (pageNumber > totalPages) {
      setPageNumber(totalPages);
    }
  }, [pageNumber, totalPages]);

  const scrollDataPanelToTop = () => {
    window.requestAnimationFrame(() => {
      document.querySelector(".vcl-data-panel")?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  };

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
    setPageNumber(1);
  };

  const handleStatusChange = (nextStatus) => {
    setStatusFilter(normalizeDepositStatusFilter(nextStatus));
    setPageNumber(1);
    scrollDataPanelToTop();
  };

  const handleResetClick = () => {
    setSearchInput("");
    setDateRangeInput(null);
    setStatusFilter(ALL_STATUS);
    setPageNumber(1);
    setRefreshKey((previous) => previous + 1);
  };

  const handleCopyPurchaseCode = async (event, item) => {
    event.preventDefault();
    event.stopPropagation();

    const purchaseCode = getPurchaseCode(item);

    if (!purchaseCode || purchaseCode === "-") {
      AuthNotify.warning(
        "Chưa có mã yêu cầu",
        "Yêu cầu chưa có mã để sao chép."
      );
      return;
    }

    try {
      await copyTextToClipboard(purchaseCode);
      setCopiedPurchaseCode(purchaseCode);

      AuthNotify.success(
        "Sao chép thành công",
        "Đã sao chép mã yêu cầu mua hộ."
      );

      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }

      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedPurchaseCode("");
      }, 1800);
    } catch (error) {
      console.error("Không thể sao chép mã yêu cầu:", error);

      AuthNotify.error(
        "Sao chép thất bại",
        "Không thể sao chép mã yêu cầu. Vui lòng thử lại."
      );
    }
  };

  const handlePageChange = (_, nextPageNumber) => {
    setPageNumber(nextPageNumber);
    scrollDataPanelToTop();
  };

  const handleViewDetail = (item) => {
    const purchaseRequestId = getPurchaseRequestId(item);

    if (!purchaseRequestId) {
      AuthNotify.warning(
        "Không thể mở chi tiết",
        "Không tìm thấy mã yêu cầu mua hộ."
      );
      return;
    }

    navigate(`/sale/purchase-requests/${purchaseRequestId}`, {
      state: {
        purchaseRequestId,
        purchaseRequest: item,
      },
    });
  };

  const handleCardKeyDown = (event, item) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleViewDetail(item);
    }
  };

  const hasActiveFilter = Boolean(
    searchInput.trim() ||
      statusFilter !== ALL_STATUS ||
      (dateRangeInput?.[0] && dateRangeInput?.[1])
  );

  return (
    <div className="vcl-container">
      <div className="vcl-fixed-panel">
        <div className="page-header">
          <div>
            <h1 className="page-title">DANH SÁCH YÊU CẦU MUA HỘ</h1>

            <p className="page-subtitle">
              Theo dõi yêu cầu mua hộ đang chờ đặt cọc hoặc đã đặt cọc trên
              hệ thống.
            </p>
          </div>

          <div className="page-summary">
            <strong>{totalCount}</strong>
            <span>Tổng yêu cầu mua hộ</span>
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-fields">
            <Space size="middle" wrap>
              <Input
                prefix={<SearchIcon className="filter-search-icon" />}
                placeholder="Tìm mã yêu cầu, khách hàng, sản phẩm..."
                value={searchInput}
                onChange={handleSearchChange}
                onPressEnter={() => setPageNumber(1)}
                allowClear
                className="filter-search-input"
              />

              <RangePicker
                value={dateRangeInput}
                onChange={handleDateRangeChange}
                disabledDate={disabledRangeDate}
                format="DD/MM/YYYY"
                placeholder={["Từ ngày", "Đến ngày"]}
                allowClear
                inputReadOnly
                className="filter-date-picker"
              />

              <Select
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={handleStatusChange}
                className="filter-status-select"
                popupMatchSelectWidth={290}
                aria-label="Lọc trạng thái đặt cọc"
              />
            </Space>
          </div>

          <div className="filter-actions">
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<AutorenewIcon />}
              onClick={handleResetClick}
              disabled={loading}
              className="filter-reset-button"
            >
              LÀM MỚI
            </Button>
          </div>
        </div>
      </div>

      <div className="vcl-data-panel">
        {loading ? (
          <div className="vcl-loading-box">
            <CircularProgress size={38} />
            <div>Đang tải danh sách yêu cầu mua hộ...</div>
          </div>
        ) : (
          <>
            <div className="card-list">
              {visiblePurchaseRequests.length === 0 ? (
                <div className="empty-container">
                  <div className="empty-icon">📭</div>

                  <h3>Không có yêu cầu mua hộ phù hợp</h3>

                  <p>
                    Chỉ hiển thị đơn chờ đặt cọc hoặc đã đặt cọc. Hãy thay
                    đổi từ khóa, khoảng ngày hoặc làm mới dữ liệu.
                  </p>

                  {hasActiveFilter && (
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<AutorenewIcon />}
                      onClick={handleResetClick}
                      className="empty-reset-button"
                    >
                      Xóa bộ lọc
                    </Button>
                  )}
                </div>
              ) : (
                visiblePurchaseRequests.map((item) => {
                  const productNames = getProductNames(item);
                  const purchaseCode = getPurchaseCode(item);
                  const purchaseRequestId = getPurchaseRequestId(item);
                  const statusInfo = getPurchaseStatus(item);
                  const itemCount =
                    Number(item?.itemCount) || productNames.length || 0;
                  const totalQuantity = Number(item?.totalQuantity) || 0;

                  return (
                    <article
                      key={purchaseRequestId || purchaseCode}
                      className="consignment-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleViewDetail(item)}
                      onKeyDown={(event) =>
                        handleCardKeyDown(event, item)
                      }
                      aria-label={`Xem chi tiết yêu cầu mua hộ ${purchaseCode}`}
                    >
                      <div className="card-header">
                        <div className="header-left">
                          <div className="tracking-code-block">
                            <span className="tracking-code-label">
                              MÃ YÊU CẦU
                            </span>

                            <div className="tracking-code-row">
                              <strong className="order-code">
                                {purchaseCode}
                              </strong>

                              <button
                                type="button"
                                className={[
                                  "copy-tracking-button",
                                  copiedPurchaseCode === purchaseCode &&
                                    "is-copied",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                title="Sao chép mã yêu cầu"
                                aria-label={`Sao chép mã yêu cầu ${purchaseCode}`}
                                onClick={(event) =>
                                  handleCopyPurchaseCode(event, item)
                                }
                              >
                                {copiedPurchaseCode === purchaseCode ? (
                                  <>
                                    <CheckRoundedIcon />
                                    <span>Đã chép</span>
                                  </>
                                ) : (
                                  <>
                                    <ContentCopyRoundedIcon />
                                    <span>Sao chép</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="header-tags">
                            <span className="tag-type">
                              {getShippingOptionLabel(item.shippingOption)}
                            </span>

                            <span className="tag-count">
                              Tuyến {item.route || "-"}
                            </span>

                            <span
                              className={`tag-status-header ${statusInfo.className}`}
                              title={`Trạng thái API: ${statusInfo.code}`}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outlined"
                          size="small"
                          endIcon={<ArrowForwardIcon />}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleViewDetail(item);
                          }}
                          className="view-detail-button"
                        >
                          Xem chi tiết
                        </Button>
                      </div>

                      <div className="sub-header">
                        <span>
                          Khách hàng:{" "}
                          <strong>
                            {item.customerName ||
                              item.customerId ||
                              "-"}
                          </strong>
                        </span>

                        <span>
                          Người nhận:{" "}
                          <strong>{item.receiverName || "-"}</strong>
                        </span>

                        <span
                          title={formatDateUtcTitle(
                            item.createdAtUtc || item.createdAt
                          )}
                        >
                          📅 Ngày tạo:{" "}
                          <strong>
                            {formatDate(
                              item.createdAtUtc || item.createdAt
                            )}
                          </strong>{" "}
                          <small className="utc-display-label">
                            UTC+7
                          </small>
                        </span>

                        <span className="price-total-header">
                          SẢN PHẨM:{" "}
                          <b>{itemCount || productNames.length || 0}</b>
                        </span>
                      </div>

                      <div className="card-body">
                        <div className="body-left">
                          <div className="box-icon">🛒</div>

                          <div className="product-info">
                            <div className="product-name-group">
                              <div className="product-name-heading">
                                <span className="product-name-label">
                                  SẢN PHẨM
                                </span>

                                {productNames.length > 1 && (
                                  <span className="product-name-count">
                                    {productNames.length} sản phẩm
                                  </span>
                                )}
                              </div>

                              {productNames.length > 0 ? (
                                <div
                                  className={[
                                    "product-name-list",
                                    productNames.length === 1 &&
                                      "is-single",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  {productNames.map(
                                    (productName, productIndex) => (
                                      <div
                                        key={`${purchaseRequestId}-${productName}-${productIndex}`}
                                        className="product-name-item"
                                      >
                                        {productNames.length > 1 && (
                                          <span className="product-name-index">
                                            {productIndex + 1}
                                          </span>
                                        )}

                                        <strong
                                          className="product-name-value"
                                          title={productName}
                                        >
                                          {productName}
                                        </strong>
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : (
                                <strong className="product-name-empty">
                                  Chưa có tên sản phẩm
                                </strong>
                              )}
                            </div>

                            <div className="sku-tag">
                              Mã yêu cầu: {purchaseCode}
                            </div>

                            {item.generalNote && (
                              <div className="receiver-address">
                                <span>Ghi chú:</span>{" "}
                                <strong>{item.generalNote}</strong>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="body-right">
                          <span
                            className={`status-badge-center ${statusInfo.className}`}
                            title={`Trạng thái API: ${statusInfo.code}`}
                          >
                            {statusInfo.label}
                          </span>

                          <div className="shipping-type">
                            <span>LOẠI VẬN CHUYỂN</span>

                            <strong>
                              {getShippingOptionLabel(item.shippingOption)}
                            </strong>
                          </div>

                          <div className="specs-list">
                            <span>
                              Số dòng SP:{" "}
                              <strong>{itemCount}</strong>
                            </span>

                            <span>
                              Tổng SL:{" "}
                              <strong>
                                {totalQuantity.toLocaleString("vi-VN")}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {filteredPurchaseRequests.length > 0 && (
              <div className="pagination-section">
                <span className="pagination-summary">
                  Hiển thị{" "}
                  <strong>{visiblePurchaseRequests.length}</strong> yêu
                  cầu trên trang này, tổng cộng{" "}
                  <strong>{filteredPurchaseRequests.length}</strong> yêu
                  cầu đặt cọc
                </span>

                <Pagination
                  count={totalPages}
                  page={pageNumber}
                  onChange={handlePageChange}
                  disabled={loading}
                  color="primary"
                  shape="rounded"
                  showFirstButton
                  showLastButton
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
