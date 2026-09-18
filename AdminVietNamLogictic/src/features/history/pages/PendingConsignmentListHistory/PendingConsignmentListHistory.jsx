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

import { getConsignmentsApi } from "@features/consignment/api/consignmentService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";

import { apiToTimestamp } from "@shared/utils/timeUtc";

import {
  ALL_STATUS,
  DEFAULT_PAGE_SIZE,
  DEPOSIT_STATUS_SET,
  FETCH_PAGE_SIZE,
  STATUS_OPTIONS,
} from "./PendingConsignmentListHistory.constants";

import {
  formatDate,
  formatDateUtcTitle,
  formatVolumeCm3,
  formatWeight,
  getConsignmentPageData,
  getConsignmentStatus,
  getConsignmentStatusCode,
  getConsignmentTypeLabel,
  getDepositStatusesToLoad,
  getErrorMessage,
  getOrderCode,
  getProductNames,
  getTotalVolumeCm3,
  getTrackingCode,
  getUniqueConsignmentKey,
  normalizeConsignmentTime,
  normalizeDepositStatusFilter,
  normalizeText,
} from "./PendingConsignmentListHistory.helpers";

import "./PendingConsignmentListHistory.css";

const { RangePicker } = DatePicker;

const copyTextToClipboard = async (text) => {
  if (
    navigator.clipboard?.writeText &&
    window.isSecureContext
  ) {
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
    throw new Error("Không thể sao chép mã vận đơn.");
  }
};

const loadAllConsignmentsByStatus =
  async (status) => {
    const firstResponse =
      await getConsignmentsApi({
        pageNumber: 1,
        pageSize:
          FETCH_PAGE_SIZE,
        status,
      });

    const firstPage =
      getConsignmentPageData(
        firstResponse
      );

    if (
      firstPage.totalPages <= 1
    ) {
      return firstPage.items;
    }

    const remainingPageNumbers =
      Array.from(
        {
          length:
            firstPage.totalPages -
            1,
        },
        (_, index) =>
          index + 2
      );

    const remainingResponses =
      await Promise.all(
        remainingPageNumbers.map(
          (pageNumber) =>
            getConsignmentsApi({
              pageNumber,
              pageSize:
                FETCH_PAGE_SIZE,
              status,
            })
        )
      );

    return [
      ...firstPage.items,
      ...remainingResponses.flatMap(
        (response) =>
          getConsignmentPageData(
            response
          ).items
      ),
    ];
  };

/* =========================================================
   COMPONENT
========================================================= */

export default function PendingConsignmentListHistory() {
  const navigate = useNavigate();

  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [dateRangeInput, setDateRangeInput] = useState(null);
  const [statusFilter, setStatusFilter] =
    useState(ALL_STATUS);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedTrackingCode, setCopiedTrackingCode] =
    useState("");

  const copyResetTimerRef = useRef(null);

  /* =========================================================
     LOAD DATA
  ========================================================= */

  const fetchConsignments =
    useCallback(async () => {
      try {
        setLoading(true);

        const statusesToLoad =
          getDepositStatusesToLoad(
            statusFilter
          );

        const statusResults =
          await Promise.all(
            statusesToLoad.map(
              loadAllConsignmentsByStatus
            )
          );

        const mergedItems =
          statusResults.flat();

        const uniqueItems =
          Array.from(
            new Map(
              mergedItems.map(
                (item, index) => [
                  getUniqueConsignmentKey(
                    item,
                    index
                  ),
                  item,
                ]
              )
            ).values()
          );

        const normalizedItems =
          uniqueItems
            .map(
              normalizeConsignmentTime
            )
            .filter((item) => {
              const statusCode =
                getConsignmentStatusCode(
                  item
                );

              return (
                DEPOSIT_STATUS_SET.has(
                  statusCode
                ) &&
                (
                  statusFilter ===
                  ALL_STATUS ||
                  statusCode ===
                  normalizeDepositStatusFilter(
                    statusFilter
                  )
                )
              );
            })
            .sort(
              (
                firstItem,
                secondItem
              ) => {
                const firstTime =
                  apiToTimestamp(
                    firstItem
                      ?.createdAtUtc,
                    {
                      apiTimeMode:
                        "utc",
                    }
                  ) || 0;

                const secondTime =
                  apiToTimestamp(
                    secondItem
                      ?.createdAtUtc,
                    {
                      apiTimeMode:
                        "utc",
                    }
                  ) || 0;

                return (
                  secondTime -
                  firstTime
                );
              }
            );

        setConsignments(
          normalizedItems
        );

        setTotalCount(
          normalizedItems.length
        );
      } catch (error) {
        console.error(
          "Lỗi khi lấy danh sách ký gửi:",
          error
        );

        setConsignments([]);
        setTotalCount(0);

        AuthNotify.error(
          "Không tải được danh sách ký gửi",
          getErrorMessage(error)
        );
      } finally {
        setLoading(false);
      }
    }, [statusFilter]);

  useEffect(() => {
    fetchConsignments();
  }, [fetchConsignments, refreshKey]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  /* =========================================================
     FILTER
  ========================================================= */

  const disabledRangeDate = (currentDate, info) => {
    const fromDate = info?.from;

    if (!currentDate || !fromDate) {
      return false;
    }

    return currentDate.isBefore(fromDate, "day");
  };

  const handleDateRangeChange = (dates) => {
    if (
      !Array.isArray(dates) ||
      !dates[0] ||
      !dates[1]
    ) {
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

  const filteredConsignments = useMemo(() => {
    const normalizedSearch = normalizeText(searchInput);

    const startTimestamp = dateRangeInput?.[0]
      ? dateRangeInput[0].startOf("day").valueOf()
      : null;

    const endTimestamp = dateRangeInput?.[1]
      ? dateRangeInput[1].endOf("day").valueOf()
      : null;

    return consignments.filter((item) => {
      const searchableContent = [
        item?.orderId,
        item?.orderCode,
        item?.consignmentCode,
        item?.customerName,
        item?.receiverName,
        item?.receiverPhone,
        item?.receiverAddress,
        item?.consignmentType,
        getConsignmentStatusCode(item),
        getConsignmentStatus(item).label,
        item?.route,
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

      const currentStatus =
        getConsignmentStatusCode(
          item
        );

      const normalizedStatusFilter =
        normalizeDepositStatusFilter(
          statusFilter
        );

      const matchesDepositStatus =
        DEPOSIT_STATUS_SET.has(
          currentStatus
        );

      const matchesSelectedStatus =
        normalizedStatusFilter ===
        ALL_STATUS ||
        currentStatus ===
        normalizedStatusFilter;

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate &&
        matchesDepositStatus &&
        matchesSelectedStatus
      );
    });
  }, [
    consignments,
    dateRangeInput,
    searchInput,
    statusFilter,
  ]);

  /* =========================================================
     CLIENT PAGINATION
  ========================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredConsignments.length /
      DEFAULT_PAGE_SIZE
    )
  );

  const visibleConsignments =
    useMemo(() => {
      const startIndex =
        (pageNumber - 1) *
        DEFAULT_PAGE_SIZE;

      return filteredConsignments.slice(
        startIndex,
        startIndex +
        DEFAULT_PAGE_SIZE
      );
    }, [
      filteredConsignments,
      pageNumber,
    ]);

  useEffect(() => {
    if (pageNumber > totalPages) {
      setPageNumber(totalPages);
    }
  }, [
    pageNumber,
    totalPages,
  ]);

  /* =========================================================
     EVENTS
  ========================================================= */

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
    setPageNumber(1);
  };

  const handleStatusChange = (
    nextStatus
  ) => {
    setStatusFilter(
      normalizeDepositStatusFilter(
        nextStatus
      )
    );

    setPageNumber(1);

    window.requestAnimationFrame(
      () => {
        document
          .querySelector(
            ".vcl-data-panel"
          )
          ?.scrollTo({
            top: 0,
            behavior: "smooth",
          });
      }
    );
  };

  const handleResetClick = () => {
    setSearchInput("");
    setDateRangeInput(null);
    setStatusFilter(ALL_STATUS);
    setPageNumber(1);
    setRefreshKey(
      (previous) => previous + 1
    );
  };

  const handleCopyTrackingCode = async (event, item) => {
    event.preventDefault();
    event.stopPropagation();

    const trackingCode = getTrackingCode(item);

    if (!trackingCode || trackingCode === "-") {
      AuthNotify.warning(
        "Chưa có mã vận đơn",
        "Yêu cầu chưa có mã vận đơn để sao chép."
      );
      return;
    }

    try {
      await copyTextToClipboard(trackingCode);

      setCopiedTrackingCode(trackingCode);

      AuthNotify.success(
        "Sao chép thành công",
        "Đã sao chép mã vận đơn."
      );

      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current);
      }

      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedTrackingCode("");
      }, 1800);
    } catch (error) {
      console.error(
        "Không thể sao chép mã vận đơn:",
        error
      );

      AuthNotify.error(
        "Sao chép thất bại",
        "Không thể sao chép mã vận đơn. Vui lòng thử lại."
      );
    }
  };

  const handlePageChange = (
    _,
    nextPageNumber
  ) => {
    setPageNumber(
      nextPageNumber
    );

    window.requestAnimationFrame(
      () => {
        document
          .querySelector(
            ".vcl-data-panel"
          )
          ?.scrollTo({
            top: 0,
            behavior: "smooth",
          });
      }
    );
  };

  const handleViewPaymentHistory = (
    item
  ) => {
    const orderId =
      String(
        item?.orderId || ""
      ).trim();

    if (!orderId) {
      AuthNotify.warning(
        "Không thể mở lịch sử thanh toán",
        "Không tìm thấy orderId của đơn hàng."
      );

      return;
    }

    navigate(
      `/sale/orders/${orderId}/payments/history`,
      {
        state: {
          orderId,
          consignment: item,
        },
      }
    );
  };

  const handleCardKeyDown = (
    event,
    item
  ) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      handleViewPaymentHistory(
        item
      );
    }
  };

  const hasActiveFilter = Boolean(
    searchInput.trim() ||
    statusFilter !== ALL_STATUS ||
    (dateRangeInput?.[0] && dateRangeInput?.[1])
  );

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="vcl-container">
      <div className="vcl-fixed-panel">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              DANH SÁCH YÊU CẦU KÝ GỬI
            </h1>

            <p className="page-subtitle">
              Theo dõi đầy đủ yêu cầu ký gửi và trạng thái xử lý trên hệ thống.
            </p>
          </div>

          <div className="page-summary">
            <strong>{totalCount}</strong>
            <span>Tổng yêu cầu ký gửi</span>
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-fields">
            <Space size="middle" wrap>
              <Input
                prefix={
                  <SearchIcon className="filter-search-icon" />
                }
                placeholder="Tìm mã vận đơn, khách hàng, sản phẩm..."
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
                onChange={
                  handleStatusChange
                }
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
            <div>Đang tải danh sách yêu cầu ký gửi...</div>
          </div>
        ) : (
          <>
            <div className="card-list">
              {visibleConsignments.length === 0 ? (
                <div className="empty-container">
                  <div className="empty-icon">📭</div>

                  <h3>Không có yêu cầu ký gửi phù hợp</h3>

                  <p>
                    Chỉ hiển thị đơn chờ đặt cọc hoặc đã đặt cọc. Hãy thay đổi từ khóa, khoảng ngày hoặc làm mới dữ liệu.
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
                visibleConsignments.map((item) => {
                  const productNames = getProductNames(item);
                  const trackingCode = getTrackingCode(item);
                  const statusInfo =
                    getConsignmentStatus(
                      item
                    );

                  return (
                    <article
                      key={item.orderId}
                      className="consignment-card"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        handleViewPaymentHistory(
                          item
                        )
                      }
                      onKeyDown={(event) =>
                        handleCardKeyDown(event, item)
                      }
                      aria-label={`Xem lịch sử thanh toán của đơn ${trackingCode}`}
                    >
                      <div className="card-header">
                        <div className="header-left">
                          <div className="tracking-code-block">
                            <span className="tracking-code-label">
                              MÃ VẬN ĐƠN
                            </span>

                            <div className="tracking-code-row">
                              <strong className="order-code">
                                {trackingCode}
                              </strong>

                              <button
                                type="button"
                                className={[
                                  "copy-tracking-button",
                                  copiedTrackingCode === trackingCode &&
                                  "is-copied",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                title="Sao chép mã vận đơn"
                                aria-label={`Sao chép mã vận đơn ${trackingCode}`}
                                onClick={(event) =>
                                  handleCopyTrackingCode(event, item)
                                }
                              >
                                {copiedTrackingCode === trackingCode ? (
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
                              {getConsignmentTypeLabel(
                                item.consignmentType
                              )}
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

                            handleViewPaymentHistory(
                              item
                            );
                          }}
                          className="view-detail-button"
                        >
                          Xem thanh toán
                        </Button>
                      </div>

                      <div className="sub-header">
                        <div className="sub-header-left">
                          <span className="info-chip">
                            👤 Khách hàng: <strong>{item.customerName || "-"}</strong>
                          </span>

                          <span className="info-chip">
                            📦 Người nhận: <strong>{item.receiverName || "-"}</strong>
                            {item.receiverPhone && <small className="phone-small"> ({item.receiverPhone})</small>}
                          </span>

                          {item.warehouseName && (
                            <span className="info-chip warehouse-chip">
                              🏬 Kho: <strong>{item.warehouseName}</strong>
                            </span>
                          )}
                        </div>

                        <div className="sub-header-right">
                          <span className="inspection-badge-header">
                            Kiểm hàng:{" "}
                            <b
                              className={
                                item.requiresInspection
                                  ? "inspection-yes"
                                  : "inspection-no"
                              }
                            >
                              {item.requiresInspection ? "Có" : "Không"}
                            </b>
                          </span>
                        </div>
                      </div>

                      <div className="card-body">
                        <div className="body-left">
                          <div className="box-icon">📦</div>

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
                                        key={`${item.orderId}-${productName}-${productIndex}`}
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
                              Mã đơn: {getOrderCode(item)}
                            </div>

                            <div className="receiver-phone">
                              <span>Số điện thoại:</span>{" "}
                              <strong>{item.receiverPhone || "-"}</strong>
                            </div>

                            <div className="receiver-address">
                              <span>📍 Địa chỉ:</span>{" "}
                              <strong>{item.receiverAddress || "-"}</strong>
                            </div>
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
                              {getConsignmentTypeLabel(
                                item.consignmentType
                              )}
                            </strong>
                          </div>

                          <div className="specs-list">
                            <span>
                              Khối lượng:{" "}
                              <strong>
                                {formatWeight(
                                  item.totalWeight ?? item.weightKg
                                )}
                              </strong>
                            </span>

                            <span>
                              Thể tích:{" "}
                              <strong>
                                {formatVolumeCm3(
                                  getTotalVolumeCm3(item)
                                )}
                              </strong>
                            </span>
                          </div>

                          <div className="date-timeline-grid">
                            <div
                              className="date-chip"
                              title={formatDateUtcTitle(
                                item.createdAtUtc || item.createdAt
                              )}
                            >
                              <span className="date-chip-label">📅 Ngày tạo</span>
                              <span className="date-chip-value">
                                {formatDate(
                                  item.createdAtUtc || item.createdAt
                                )}
                              </span>
                            </div>

                            {item.quotationCreatedAtUtc && (
                              <div
                                className="date-chip"
                                title={formatDateUtcTitle(
                                  item.quotationCreatedAtUtc
                                )}
                              >
                                <span className="date-chip-label">📝 Báo giá</span>
                                <span className="date-chip-value">
                                  {formatDate(item.quotationCreatedAtUtc)}
                                </span>
                              </div>
                            )}

                            {item.paymentConfirmedAtUtc && (
                              <div
                                className="date-chip"
                                title={formatDateUtcTitle(
                                  item.paymentConfirmedAtUtc
                                )}
                              >
                                <span className="date-chip-label">💳 Xác nhận cọc</span>
                                <span className="date-chip-value">
                                  {formatDate(item.paymentConfirmedAtUtc)}
                                </span>
                              </div>
                            )}

                            {!item.quotationCreatedAtUtc &&
                              !item.paymentConfirmedAtUtc &&
                              item.statusUpdatedAtUtc &&
                              item.statusUpdatedAtUtc !== item.createdAtUtc && (
                                <div
                                  className="date-chip"
                                  title={formatDateUtcTitle(
                                    item.statusUpdatedAtUtc
                                  )}
                                >
                                  <span className="date-chip-label">🕒 Cập nhật</span>
                                  <span className="date-chip-value">
                                    {formatDate(item.statusUpdatedAtUtc)}
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            {filteredConsignments.length > 0 && (
              <div className="pagination-section">
                <span className="pagination-summary">
                  Hiển thị{" "}
                  <strong>{visibleConsignments.length}</strong>{" "}
                  yêu cầu trên trang này, tổng cộng{" "}
                  <strong>
                    {filteredConsignments.length}
                  </strong>{" "}
                  yêu cầu đặt cọc
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