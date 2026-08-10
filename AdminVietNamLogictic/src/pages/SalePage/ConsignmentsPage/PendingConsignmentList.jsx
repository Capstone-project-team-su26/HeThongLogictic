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

import { getConsignmentsApi, getConsignmentReceiptApi } from "../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import AuthNotify from "../../../utils/Common/AuthNotify";
import { isAuthenticationError } from "../../../utils/Common/authSession";

import {
  apiToTimestamp,
  apiToUtcIso,
  formatUtcDateTime,
  formatVietnamDateTime,
} from "../../../utils/timeUtc";

import "./PendingConsignmentList.css";

const { RangePicker } = DatePicker;

const ALL_STATUS = "ALL";
const DEFAULT_PAGE_SIZE = 10;

const CONSIGNMENT_STATUS_CONFIG = {
  DRAFT: {
    label: "Bản nháp",
    className: "status-pending",
  },
  QUOTATION_CONFIRMED: {
    label: "Đã xác nhận báo giá",
    className: "status-approved",
  },
  PENDING: {
    label: "Chờ xử lý",
    className: "status-pending",
  },
  PENDING_REVIEW: {
    label: "Chờ duyệt",
    className: "status-pending-review",
  },
  APPROVED: {
    label: "Đã duyệt",
    className: "status-approved",
  },
  ACCEPTED: {
    label: "Đã chấp nhận",
    className: "status-approved",
  },
  QUOTATION_SENT: {
    label: "Đã gửi báo giá",
    className: "status-quotation-sent",
  },
  QUOTATION_REJECTED: {
    label: "Báo giá bị từ chối",
    className: "status-quotation-rejected",
  },
  WAITING_PAYMENT: {
    label: "Chờ thanh toán",
    className: "status-waiting-deposit",
  },
  WAITING_DEPOSIT: {
    label: "Chờ đặt cọc",
    className: "status-waiting-deposit",
  },
  DEPOSIT_PAID: {
    label: "Đã đặt cọc",
    className: "status-deposit-paid",
  },
  PAID: {
    label: "Đã thanh toán",
    className: "status-completed",
  },
  WAITING_FOR_PARCEL: {
    label: "Chờ kiện hàng",
    className: "status-processing",
  },
  WAITING_PARCEL: {
    label: "Chờ kiện hàng",
    className: "status-processing",
  },
  CHECKED_IN: {
    label: "Đã nhập kho",
    className: "status-checked-in",
  },
  STORED: {
    label: "Đã nhập kho",
    className: "status-checked-in",
  },
  WAITING_STORED: {
    label: "Chờ nhập kho",
    className: "status-waiting-deposit",
  },
  ARRIVED_ORIGIN_WAREHOUSE: {
    label: "Đã về kho nước ngoài",
    className: "status-in-transit",
  },
  WAREHOUSE_RECEIVED: {
    label: "Đã nhận tại kho",
    className: "status-checked-in",
  },
  RECEIVED: {
    label: "Đã tiếp nhận",
    className: "status-received",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "status-processing",
  },
  IN_TRANSIT: {
    label: "Đang vận chuyển",
    className: "status-in-transit",
  },
  CUSTOMS_CLEARANCE: {
    label: "Đang thông quan",
    className: "status-customs-clearance",
  },
  READY_FOR_DELIVERY: {
    label: "Chờ giao hàng",
    className: "status-ready-delivery",
  },
  DELIVERING: {
    label: "Đang giao hàng",
    className: "status-delivering",
  },
  DELIVERED: {
    label: "Đã giao hàng",
    className: "status-delivered",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "status-completed",
  },
  NEED_MORE_INFO: {
    label: "Cần bổ sung thông tin",
    className: "status-waiting-deposit",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "status-rejected",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "status-cancelled",
  },
};

const STATUS_OPTIONS = [
  {
    value: ALL_STATUS,
    label: "Tất cả trạng thái",
  },
  ...Object.entries(
    CONSIGNMENT_STATUS_CONFIG
  ).map(([value, config]) => ({
    value,
    label: config.label,
  })),
];

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (value) => {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const PRODUCT_NAME_SEPARATOR =
  /\r?\n|[,;|•]+|\s+(?:và|and)\s+/giu;

const collectProductNames = (source) => {
  if (
    source === null ||
    source === undefined ||
    source === ""
  ) {
    return [];
  }

  if (Array.isArray(source)) {
    return source.flatMap(collectProductNames);
  }

  if (typeof source === "object") {
    const directName =
      source.productName ||
      source.itemName ||
      source.name ||
      source.title ||
      source.product?.productName ||
      source.product?.name;

    if (directName) {
      return collectProductNames(directName);
    }

    return collectProductNames(
      source.items ||
      source.productNames ||
      source.itemNames ||
      []
    );
  }

  const text = String(source).trim();

  if (!text) {
    return [];
  }

  if (
    (text.startsWith("[") && text.endsWith("]")) ||
    (text.startsWith("{") && text.endsWith("}"))
  ) {
    try {
      return collectProductNames(JSON.parse(text));
    } catch {
      // Không phải JSON hợp lệ, tiếp tục xử lý như chuỗi thường.
    }
  }

  return text
    .split(PRODUCT_NAME_SEPARATOR)
    .map((name) => name.trim())
    .filter(Boolean);
};

const getProductNames = (item) => {
  const rawNames =
    item?.itemNames ??
    item?.productNames ??
    item?.items ??
    [];

  return Array.from(
    new Set(
      collectProductNames(rawNames)
        .map((name) => String(name).trim())
        .filter(Boolean)
    )
  );
};

const getConsignmentPageData = (apiResult) => {
  const objectCandidates = [
    apiResult,
    apiResult?.data,
    apiResult?.data?.data,
  ].filter(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
  );

  const pageData =
    objectCandidates.find(
      (candidate) =>
        Array.isArray(candidate?.items) ||
        Array.isArray(candidate?.results) ||
        Number.isFinite(
          Number(candidate?.totalCount)
        )
    ) || null;

  const arrayCandidates = [
    pageData?.items,
    pageData?.results,
    apiResult,
    apiResult?.items,
    apiResult?.results,
    apiResult?.data,
    apiResult?.data?.items,
    apiResult?.data?.results,
    apiResult?.data?.data,
    apiResult?.data?.data?.items,
    apiResult?.data?.data?.results,
  ];

  const items =
    arrayCandidates.find(Array.isArray) ||
    [];

  const pageSize = Math.max(
    1,
    Number(pageData?.pageSize) ||
    DEFAULT_PAGE_SIZE
  );

  const totalCount = Math.max(
    0,
    Number(pageData?.totalCount) ||
    items.length
  );

  const totalPages = Math.max(
    1,
    Number(pageData?.totalPages) ||
    Math.ceil(totalCount / pageSize) ||
    1
  );

  const pageNumber = Math.max(
    1,
    Number(pageData?.pageNumber) || 1
  );

  return {
    items,
    totalCount,
    totalPages,
    pageNumber,
    pageSize,
  };
};

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

const normalizeApiTimeToUtc = (value) => {
  return apiToUtcIso(value, {
    apiTimeMode: "utc",
  });
};

const normalizeConsignmentTime = (item) => {
  if (!item) {
    return item;
  }

  return {
    ...item,
    createdAtUtc: normalizeApiTimeToUtc(item.createdAt),
    updatedAtUtc: normalizeApiTimeToUtc(item.updatedAt || item.statusUpdatedAt),
    quotationCreatedAtUtc: normalizeApiTimeToUtc(item.quotationCreatedAt),
    paymentConfirmedAtUtc: normalizeApiTimeToUtc(item.paymentConfirmedAt),
    statusUpdatedAtUtc: normalizeApiTimeToUtc(item.statusUpdatedAt),
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

const formatWeight = (value) => {
  const weight = Number(value);

  if (!Number.isFinite(weight) || weight < 0) {
    return "0 kg";
  }

  return `${weight.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} kg`;
};

/*
 * API danh sách đang có:
 * - totalVolume: thể tích theo cm³
 * - totalVolumeM3: thể tích theo m³
 *
 * UI hiển thị theo cm nên thể tích phải dùng cm³.
 * 1 m³ = 1.000.000 cm³.
 */
const getTotalVolumeCm3 = (item) => {
  const volumeCm3 = Number(item?.totalVolume);

  if (Number.isFinite(volumeCm3) && volumeCm3 >= 0) {
    return volumeCm3;
  }

  const volumeM3 = Number(item?.totalVolumeM3);

  if (Number.isFinite(volumeM3) && volumeM3 >= 0) {
    return volumeM3 * 1_000_000;
  }

  return 0;
};

const formatVolumeCm3 = (value) => {
  const volumeCm3 = Number(value);

  if (!Number.isFinite(volumeCm3) || volumeCm3 < 0) {
    return "0 cm³";
  }

  return `${volumeCm3.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} cm³`;
};

const getConsignmentStatusCode = (
  itemOrStatus
) => {
  const value =
    typeof itemOrStatus === "object"
      ? itemOrStatus?.status ??
      itemOrStatus?.orderStatus ??
      itemOrStatus?.consignmentStatus
      : itemOrStatus;

  return String(value || "")
    .trim()
    .toUpperCase();
};

const getConsignmentStatus = (
  itemOrStatus
) => {
  let statusDisplayName = "";
  let code = "";

  if (typeof itemOrStatus === "object" && itemOrStatus !== null) {
    code = getConsignmentStatusCode(itemOrStatus);
    statusDisplayName = itemOrStatus?.statusDisplayName || itemOrStatus?.statusName || "";
  } else {
    code = getConsignmentStatusCode(itemOrStatus);
  }

  const configuredStatus = CONSIGNMENT_STATUS_CONFIG[code];

  const label =
    statusDisplayName && statusDisplayName !== "string"
      ? statusDisplayName
      : configuredStatus?.label ||
      (code
        ? code
          .replace(/_/g, " ")
          .toLocaleLowerCase("vi-VN")
          .replace(/(^|\s)\S/g, (character) =>
            character.toLocaleUpperCase("vi-VN")
          )
        : "Chưa xác định");

  return {
    code: code || "UNKNOWN",
    label,
    className: configuredStatus?.className || "status-unknown",
  };
};

const getConsignmentTypeLabel = (type) => {
  const normalizedType = String(type || "")
    .trim()
    .toUpperCase();

  if (normalizedType === "EXPRESS") {
    return "HỎA TỐC";
  }

  if (normalizedType === "STANDARD") {
    return "TIÊU CHUẨN";
  }

  return String(type || "-").toUpperCase();
};

const getTrackingCode = (item) => {
  const trackingCode =
    item?.consignmentCode ||
    item?.trackingCode ||
    item?.domesticTrackingCode ||
    item?.waybillCode ||
    item?.shipmentCode;

  return String(trackingCode || "").trim() || "-";
};

const getOrderCode = (item) => {
  return String(
    item?.orderCode || item?.orderId || "-"
  ).trim();
};

const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.title ||
    error?.message ||
    "Không thể tải danh sách yêu cầu ký gửi."
  );
};

/* =========================================================
   COMPONENT
========================================================= */

export default function PendingConsignmentList({
  basePath = "/sale",
} = {}) {
  const navigate = useNavigate();

  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [dateRangeInput, setDateRangeInput] = useState(null);
  const [statusFilter, setStatusFilter] =
    useState(ALL_STATUS);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [serverTotalPages, setServerTotalPages] =
    useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedTrackingCode, setCopiedTrackingCode] =
    useState("");

  const [availableStatusOptions, setAvailableStatusOptions] = useState([
    { value: ALL_STATUS, label: "Tất cả trạng thái" },
  ]);

  // Load all unique status codes & statusDisplayName from entire system API dataset (pageSize: 1000)
  useEffect(() => {
    getConsignmentsApi({ pageNumber: 1, pageSize: 1000 })
      .then((res) => {
        const pageData = getConsignmentPageData(res);
        const raw = Array.isArray(pageData?.items) ? pageData.items : [];
        const map = new Map();
        map.set(ALL_STATUS, "Tất cả trạng thái");

        raw.forEach((item) => {
          const code = getConsignmentStatusCode(item);
          if (code && !map.has(code)) {
            const statusInfo = getConsignmentStatus(item);
            map.set(code, statusInfo.label);
          }
        });

        const options = Array.from(map.entries()).map(([value, label]) => ({
          value,
          label,
        }));

        if (options.length > 1) {
          setAvailableStatusOptions(options);
        }
      })
      .catch((err) => {
        console.error("FETCH ALL CONSIGNMENT STATUSES ERROR:", err);
      });
  }, [refreshKey]);

  const copyResetTimerRef = useRef(null);
  const dataPanelRef = useRef(null);

  useEffect(() => {
    const layoutContent =
      document.querySelector(
        ".app-layout__content"
      );

    layoutContent?.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    dataPanelRef.current?.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, []);

  /* =========================================================
     LOAD DATA
  ========================================================= */

  const fetchConsignments = useCallback(async () => {
    try {
      setLoading(true);

      const response =
        await getConsignmentsApi({
          pageNumber,
          pageSize: DEFAULT_PAGE_SIZE,
          status:
            statusFilter === ALL_STATUS
              ? undefined
              : statusFilter,
        });

      const pageData =
        getConsignmentPageData(response);

      const normalizedItems =
        pageData.items
          .map(normalizeConsignmentTime)
          .sort(
            (
              firstItem,
              secondItem
            ) => {
              const firstTime =
                apiToTimestamp(
                  firstItem?.createdAtUtc,
                  {
                    apiTimeMode: "utc",
                  }
                ) || 0;

              const secondTime =
                apiToTimestamp(
                  secondItem?.createdAtUtc,
                  {
                    apiTimeMode: "utc",
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
        pageData.totalCount
      );
      setServerTotalPages(
        pageData.totalPages
      );

      if (
        pageData.pageNumber !==
        pageNumber
      ) {
        setPageNumber(
          pageData.pageNumber
        );
      }
    } catch (error) {
      if (isAuthenticationError(error)) {
        return;
      }

      console.error(
        "Lỗi khi lấy danh sách ký gửi:",
        error
      );

      setConsignments([]);
      setTotalCount(0);
      setServerTotalPages(1);

      AuthNotify.error(
        "Không tải được danh sách ký gửi",
        getErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  }, [
    pageNumber,
    statusFilter,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(fetchConsignments, 0);
    return () => window.clearTimeout(timeoutId);
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

      return (
        matchesSearch &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [consignments, dateRangeInput, searchInput]);

  /* =========================================================
     SERVER PAGINATION
  ========================================================= */

  const totalPages = Math.max(
    1,
    serverTotalPages
  );

  const visibleConsignments =
    filteredConsignments;

  useEffect(() => {
    if (pageNumber <= totalPages) return undefined;

    const timeoutId = window.setTimeout(
      () => setPageNumber(totalPages),
      0,
    );

    return () => window.clearTimeout(timeoutId);
  }, [pageNumber, totalPages]);

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
    setStatusFilter(nextStatus);
    setPageNumber(1);
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

  const handlePageChange = (_, nextPageNumber) => {
    setPageNumber(nextPageNumber);

    window.requestAnimationFrame(() => {
      const cardList =
        dataPanelRef.current?.querySelector(
          ".card-list"
        );

      cardList?.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    });
  };

  const handleViewDetail = (item) => {
    if (!item?.orderId) {
      return;
    }

    navigate(`${basePath}/consignments/${item.orderId}`, {
      state: {
        consignment: item,
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

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="vcl-container pending-consignment-page">
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
                options={availableStatusOptions}
                onChange={
                  handleStatusChange
                }
                className="filter-status-select"
                popupMatchSelectWidth={
                  false
                }
                aria-label="Lọc theo trạng thái"
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

      <div
        className="vcl-data-panel"
        ref={dataPanelRef}
      >
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
                    Hãy thay đổi từ khóa, khoảng ngày hoặc làm mới dữ liệu.
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
                      onClick={() => handleViewDetail(item)}
                      onKeyDown={(event) =>
                        handleCardKeyDown(event, item)
                      }
                      aria-label={`Xem chi tiết yêu cầu ký gửi ${trackingCode}`}
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

                            {Boolean(
                              (item?.paymentStatus || item?.orderStatus) &&
                              getConsignmentStatusCode(item?.paymentStatus || item?.orderStatus) !== statusInfo.code
                            ) && (
                                <span
                                  className={`tag-status-header ${getConsignmentStatus(
                                    item?.paymentStatus || item?.orderStatus
                                  ).className
                                    }`}
                                  style={{ opacity: 0.9, marginLeft: "4px" }}
                                >
                                  {
                                    getConsignmentStatus(
                                      item?.paymentStatus || item?.orderStatus
                                    ).label
                                  }
                                </span>
                              )}
                          </div>
                        </div>

                        <Space>
                          {/* <Button
                            variant="outlined"
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              const orderId = item?.orderId || item?.id;
                              if (!orderId) return;
                              getConsignmentReceiptApi(orderId, { download: true })
                                .then(() => {
                                  AuthNotify.success("Tải phiếu thành công", `Đã tải phiếu biên nhận đơn ${item?.orderCode || item?.trackingCode || orderId}.pdf`);
                                })
                                .catch((err) => {
                                  AuthNotify.error("Không thể tải phiếu", err?.message || "Vui lòng thử lại.");
                                });
                            }}
                            style={{ borderColor: "#cbd5e1", color: "#334155", textTransform: "none", borderRadius: "8px" }}
                          >
                            📄 In phiếu PDF
                          </Button> */}

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
                        </Space>
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

                            <div className="receiver-address">
                              <span>📍 Địa chỉ:</span>{" "}
                              <strong>{item.receiverAddress || "-"}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="body-right">

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

            {totalCount > 0 && (
              <div className="pagination-section">
                <span className="pagination-summary">
                  Hiển thị{" "}
                  <strong>{visibleConsignments.length}</strong>{" "}
                  yêu cầu trên trang này, tổng cộng{" "}
                  <strong>{totalCount}</strong>{" "}
                  yêu cầu chờ duyệt
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
