import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";
import dayjs from "dayjs";

import {
  DatePicker,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
} from "antd";
import {
  Button,
  CircularProgress,
  Pagination,
} from "@mui/material";

import {
  Autorenew,
  ContentCopyRounded,
  OpenInNewRounded,
  SearchRounded,
  ShoppingCartRounded,
} from "@mui/icons-material";

import {
  getPurchaseRequestsApi,
} from "../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import AuthNotify from "../../../utils/Common/AuthNotify";

import {
  apiToUtcIso,
  formatUtcDateTime,
  formatVietnamDateTime,
} from "../../../utils/timeUtc";

import "./PurchaseRequestList.css";

const { RangePicker } = DatePicker;

const DEFAULT_PAGE_SIZE = 10;
const ALL_STATUS = "ALL";

const STATUS_CONFIG = {
  NEW: {
    label: "Tạo đơn hàng",
    className: "is-info",
  },
  PENDING_REVIEW: {
    label: "Chờ duyệt",
    className: "is-warning",
  },
  IN_REVIEW: {
    label: "Đang duyệt",
    className: "is-info",
  },
  APPROVED: {
    label: "Đã duyệt",
    className: "is-success",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "is-danger",
  },
  QUOTATION_SENT: {
    label: "Đã gửi báo giá",
    className: "is-info",
  },
  QUOTED: {
    label: "Đã báo giá",
    className: "is-info",
  },
  WAITING_PAYMENT: {
    label: "Chờ thanh toán",
    className: "is-warning",
  },
  WAITING_DEPOSIT: {
    label: "Chờ đặt cọc",
    className: "is-warning",
  },
  DEPOSIT_PAID: {
    label: "Đã đặt cọc",
    className: "is-success",
  },
  PAID: {
    label: "Đã thanh toán",
    className: "is-success",
  },
  PURCHASED: {
    label: "Đã mua hàng",
    className: "is-success",
  },
  SELLER_SHIPPED: {
    label: "NCC đã phát hàng",
    className: "is-info",
  },
  ARRIVED_ORIGIN_WAREHOUSE: {
    label: "Đã về kho nước ngoài",
    className: "is-info",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "is-info",
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

const STATUS_OPTIONS = [
  {
    value: ALL_STATUS,
    label: "Tất cả trạng thái",
  },
  ...Object.entries(
    STATUS_CONFIG
  ).map(([value, config]) => ({
    value,
    label: config.label,
  })),
];

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeUpperText = (value) =>
  normalizeText(value).toUpperCase();

const getStatusInfo = (value) => {
  const code =
    normalizeUpperText(value);

  return (
    STATUS_CONFIG[code] || {
      label:
        code
          .replace(/_/g, " ")
          .toLocaleLowerCase("vi-VN")
          .replace(
            /(^|\s)\S/g,
            (character) =>
              character.toLocaleUpperCase(
                "vi-VN"
              )
          ) ||
        "Chưa xác định",
      className: "is-default",
    }
  );
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

const normalizePurchaseRequestTime = (item) => {
  if (!item) {
    return item;
  }

  return {
    ...item,
    createdAtUtc: normalizeApiTimeToUtc(item?.createdAt),
    quotationCreatedAtUtc: normalizeApiTimeToUtc(item?.quotationCreatedAt),
    statusUpdatedAtUtc: normalizeApiTimeToUtc(item?.statusUpdatedAt),
  };
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

const translateShippingOption = (
  value
) => {
  const code =
    normalizeUpperText(value);

  const map = {
    STANDARD: "Tiêu chuẩn",
    EXPRESS: "Hỏa tốc",
    ECONOMY: "Tiết kiệm",
  };

  return (
    map[code] ||
    normalizeText(value) ||
    "Chưa xác định"
  );
};

const translateCountry = (value) => {
  const normalizedValue =
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
    map[normalizedValue] ||
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
    .map((part) => part.trim())
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

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  "Không thể tải danh sách yêu cầu mua hộ.";

export default function PurchaseRequestList() {
  const navigate = useNavigate();

  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [searchInput, setSearchInput] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState(ALL_STATUS);

  const [dateRange, setDateRange] =
    useState(null);

  const [pageNumber, setPageNumber] =
    useState(1);

  const [pageSize] =
    useState(DEFAULT_PAGE_SIZE);

  const [totalCount, setTotalCount] =
    useState(0);

  const [totalPages, setTotalPages] =
    useState(1);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const loadData =
    useCallback(async () => {
      try {
        setLoading(true);

        const data =
          await getPurchaseRequestsApi({
            pageNumber,
            pageSize,
            status:
              statusFilter ===
              ALL_STATUS
                ? undefined
                : statusFilter,
            search:
              searchInput.trim() ||
              undefined,
            fromDate:
              dateRange?.[0]
                ? dateRange[0]
                    .startOf("day")
                    .toISOString()
                : undefined,
            toDate:
              dateRange?.[1]
                ? dateRange[1]
                    .endOf("day")
                    .toISOString()
                : undefined,
          });

        setItems(
          Array.isArray(data?.items)
            ? data.items.map(
                normalizePurchaseRequestTime
              )
            : []
        );

        setTotalCount(
          Number(data?.totalCount) ||
          0
        );

        setTotalPages(
          Math.max(
            1,
            Number(
              data?.totalPages
            ) || 1
          )
        );
      } catch (error) {
        console.error(
          "GET PURCHASE REQUEST LIST ERROR:",
          error
        );

        setItems([]);
        setTotalCount(0);
        setTotalPages(1);

        AuthNotify.error(
          "Không tải được danh sách mua hộ",
          getErrorMessage(error)
        );
      } finally {
        setLoading(false);
      }
    }, [
      pageNumber,
      pageSize,
      statusFilter,
      searchInput,
      dateRange,
      refreshKey,
    ]);

  useEffect(() => {
    const timer =
      window.setTimeout(
        loadData,
        250
      );

    return () =>
      window.clearTimeout(timer);
  }, [loadData]);

  const pageSummary = useMemo(() => {
    if (totalCount <= 0) {
      return {
        start: 0,
        end: 0,
      };
    }

    const start =
      (pageNumber - 1) *
        pageSize +
      1;

    const end = Math.min(
      pageNumber * pageSize,
      totalCount
    );

    return {
      start,
      end,
    };
  }, [
    pageNumber,
    pageSize,
    totalCount,
  ]);

  const handleReset = () => {
    setSearchInput("");
    setStatusFilter(ALL_STATUS);
    setDateRange(null);
    setPageNumber(1);
    setRefreshKey(
      (value) => value + 1
    );
  };

  const handleOpenDetail = (
    item
  ) => {
    const purchaseRequestId =
      normalizeText(
        item?.purchaseRequestId
      );

    if (!purchaseRequestId) {
      AuthNotify.warning(
        "Không thể mở chi tiết",
        "Không tìm thấy mã yêu cầu mua hộ."
      );
      return;
    }

    navigate(
      `/sale/purchase-requests/${purchaseRequestId}`,
      {
        state: {
          purchaseRequestId,
          purchaseRequest: item,
        },
      }
    );
  };

  const handleCopyCode = async (
    event,
    code
  ) => {
    event.stopPropagation();

    try {
      await copyText(code);

      AuthNotify.success(
        "Đã sao chép",
        "Mã yêu cầu mua hộ đã được sao chép."
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
    <main className="purchase-list-page">
      <div className="purchase-list-shell">
        <section className="purchase-list-header">
          <div>
            <span className="purchase-list-eyebrow">
              QUẢN LÝ YÊU CẦU MUA HỘ
            </span>

            <h1>
              Danh sách yêu cầu mua hộ
            </h1>

            <p>
              Theo dõi khách hàng, sản phẩm,
              tuyến vận chuyển và trạng thái
              xử lý của từng yêu cầu.
            </p>
          </div>

          <div className="purchase-list-total">
            <ShoppingCartRounded />
            <div>
              <strong>
                {formatNumber(
                  totalCount
                )}
              </strong>
              <span>
                Tổng yêu cầu
              </span>
            </div>
          </div>
        </section>

        <section className="purchase-list-filters">
          <div className="purchase-list-filter-fields">
            <Space
              size="middle"
              wrap
            >
              <Input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(
                    event.target.value
                  );
                  setPageNumber(1);
                }}
                prefix={
                  <SearchRounded className="purchase-search-icon" />
                }
                placeholder="Tìm mã yêu cầu, người nhận, sản phẩm..."
                allowClear
                className="purchase-search-input"
              />

              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates);
                  setPageNumber(1);
                }}
                format="DD/MM/YYYY"
                placeholder={[
                  "Từ ngày",
                  "Đến ngày",
                ]}
                allowClear
                inputReadOnly
                className="purchase-date-filter"
              />

              <Select
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={(value) => {
                  setStatusFilter(
                    value
                  );
                  setPageNumber(1);
                }}
                popupMatchSelectWidth={
                  260
                }
                className="purchase-status-filter"
              />
            </Space>
          </div>

          <Button
            variant="outlined"
            color="inherit"
            startIcon={
              <Autorenew />
            }
            onClick={handleReset}
            disabled={loading}
            className="purchase-reset-button"
          >
            LÀM MỚI
          </Button>
        </section>

        <section className="purchase-list-content">
          {loading ? (
            <div className="purchase-list-loading">
              <CircularProgress
                size={40}
              />
              <span>
                Đang tải danh sách yêu cầu mua hộ...
              </span>
            </div>
          ) : items.length === 0 ? (
            <div className="purchase-list-empty">
              <ShoppingCartRounded />
              <h2>
                Chưa có yêu cầu phù hợp
              </h2>
              <p>
                Hãy thay đổi bộ lọc hoặc làm
                mới dữ liệu để kiểm tra lại.
              </p>

              <Button
                variant="outlined"
                startIcon={
                  <Autorenew />
                }
                onClick={handleReset}
              >
                Xóa bộ lọc
              </Button>
            </div>
          ) : (
            <div className="purchase-card-list">
              {items.map((item) => {
                const status =
                  getStatusInfo(
                    item?.status
                  );

                const products =
                  Array.isArray(
                    item?.items
                  )
                    ? item.items
                    : [];

                return (
                  <article
                    key={
                      item
                        ?.purchaseRequestId
                    }
                    className="purchase-request-card"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      handleOpenDetail(
                        item
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                          "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        handleOpenDetail(
                          item
                        );
                      }
                    }}
                  >
                    <div className="purchase-card-top">
                      <div className="purchase-code-area">
                        <span>
                          MÃ YÊU CẦU
                        </span>

                        <div>
                          <strong>
                            {item
                              ?.purchaseCode ||
                              "—"}
                          </strong>

                          <Tooltip title="Sao chép mã">
                            <button
                              type="button"
                              onClick={(
                                event
                              ) =>
                                handleCopyCode(
                                  event,
                                  item
                                    ?.purchaseCode
                                )
                              }
                              className="purchase-copy-button"
                            >
                              <ContentCopyRounded />
                            </button>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="purchase-card-actions">
                        <Tag
                          className={`purchase-status-tag ${status.className}`}
                        >
                          {status.label}
                        </Tag>

                        <Button
                          variant="outlined"
                          size="small"
                          endIcon={
                            <OpenInNewRounded />
                          }
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();
                            handleOpenDetail(
                              item
                            );
                          }}
                          className="purchase-detail-button"
                        >
                          Xem chi tiết
                        </Button>
                      </div>
                    </div>

                    <div className="purchase-card-meta">
                      <div>
                        <span>
                          Tuyến vận chuyển
                        </span>
                        <strong>
                          {translateRoute(
                            item?.route
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Dịch vụ
                        </span>
                        <strong>
                          {translateShippingOption(
                            item
                              ?.shippingOption
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Người nhận
                        </span>
                        <strong>
                          {item
                            ?.receiverName ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Ngày tạo
                        </span>

                        <div
                          className="purchase-date-value"
                          title={formatDateUtcTitle(
                            item?.createdAtUtc ||
                              item?.createdAt
                          )}
                        >
                          <strong>
                            {formatDateTime(
                              item?.createdAtUtc ||
                                item?.createdAt
                            )}
                          </strong>

                          <small className="purchase-timezone-badge">
                            UTC+7
                          </small>
                        </div>
                      </div>
                    </div>

                    <div className="purchase-card-body">
                      <div className="purchase-products">
                        <div className="purchase-products-heading">
                          <span>
                            SẢN PHẨM
                          </span>

                          <Tag>
                            {formatNumber(
                              item
                                ?.itemCount
                            )}{" "}
                            mặt hàng
                          </Tag>
                        </div>

                        <div className="purchase-products-list">
                          {products.length >
                          0 ? (
                            products.map(
                              (
                                product,
                                index
                              ) => (
                                <div
                                  key={`${item?.purchaseRequestId}-${index}`}
                                  className="purchase-product-row"
                                >
                                  <span className="purchase-product-index">
                                    {index +
                                      1}
                                  </span>

                                  <strong>
                                    {product
                                      ?.productName ||
                                      "Sản phẩm"}
                                  </strong>

                                  <span>
                                    SL:{" "}
                                    <b>
                                      {formatNumber(
                                        product
                                          ?.quantity
                                      )}
                                    </b>
                                  </span>
                                </div>
                              )
                            )
                          ) : (
                            <span className="purchase-no-product">
                              Chưa có sản phẩm
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="purchase-card-summary">
                        <div>
                          <span>
                            Tổng số lượng
                          </span>
                          <strong>
                            {formatNumber(
                              item
                                ?.totalQuantity
                            )}
                          </strong>
                        </div>

                      </div>
                    </div>

                    <div className="card-dates-timeline-bar">
                      <div className="timeline-bar-label">
                        ⏱️ Tiến trình:
                      </div>

                      <div className="timeline-chips-row">
                        <div
                          className="date-pill"
                          title={formatDateUtcTitle(
                            item?.createdAtUtc || item?.createdAt
                          )}
                        >
                          <span className="pill-dot is-created" />
                          <span className="pill-title">Tạo đơn:</span>
                          <strong className="pill-time">
                            {formatDateTime(
                              item?.createdAtUtc || item?.createdAt
                            )}
                          </strong>
                        </div>

                        {item?.quotationCreatedAtUtc && (
                          <div
                            className="date-pill"
                            title={formatDateUtcTitle(
                              item?.quotationCreatedAtUtc
                            )}
                          >
                            <span className="pill-dot is-quoted" />
                            <span className="pill-title">Báo giá:</span>
                            <strong className="pill-time">
                              {formatDateTime(item?.quotationCreatedAtUtc)}
                            </strong>
                          </div>
                        )}

                        {!item?.quotationCreatedAtUtc &&
                          item?.statusUpdatedAtUtc &&
                          item?.statusUpdatedAtUtc !== item?.createdAtUtc && (
                            <div
                              className="date-pill"
                              title={formatDateUtcTitle(
                                item?.statusUpdatedAtUtc
                              )}
                            >
                              <span className="pill-dot is-updated" />
                              <span className="pill-title">Cập nhật:</span>
                              <strong className="pill-time">
                                {formatDateTime(item?.statusUpdatedAtUtc)}
                              </strong>
                            </div>
                          )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {totalCount > 0 && (
          <section className="purchase-list-pagination">
            <span>
              Hiển thị{" "}
              <strong>
                {pageSummary.start}
              </strong>
              {" – "}
              <strong>
                {pageSummary.end}
              </strong>{" "}
              trong tổng số{" "}
              <strong>
                {formatNumber(
                  totalCount
                )}
              </strong>{" "}
              yêu cầu
            </span>

            <Pagination
              count={totalPages}
              page={pageNumber}
              onChange={(
                _,
                value
              ) =>
                setPageNumber(
                  value
                )
              }
              disabled={loading}
              color="primary"
              shape="rounded"
              showFirstButton
              showLastButton
            />
          </section>
        )}
      </div>
    </main>
  );
}
