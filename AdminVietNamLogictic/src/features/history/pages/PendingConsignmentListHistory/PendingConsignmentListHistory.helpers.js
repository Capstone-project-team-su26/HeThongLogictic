/*
 * Hàm thuần dùng chung cho màn hình lịch sử ký gửi: chuẩn hoá, tách, định dạng.
 * Chúng chỉ phụ thuộc tham số và hằng cấp module nên tách ra được mà không đổi
 * hành vi, đồng thời giữ phần component gọn lại quanh state và JSX.
 */

import {
  apiToUtcIso,
  formatUtcDateTime,
  formatVietnamDateTime,
} from "@shared/utils/timeUtc";

import { normalizeOrderStatus } from "@features/consignment";

import {
  ALL_STATUS,
  CONSIGNMENT_STATUS_CONFIG,
  DEFAULT_PAGE_SIZE,
  DEPOSIT_STATUS_CODES,
  DEPOSIT_STATUS_SET,
  PRODUCT_NAME_SEPARATOR,
} from "./PendingConsignmentListHistory.constants";

export const normalizeDepositStatusFilter = (
  value
) => {
  const normalizedValue =
    String(value || "")
      .trim()
      .toUpperCase();

  if (
    normalizedValue ===
    ALL_STATUS
  ) {
    return ALL_STATUS;
  }

  return DEPOSIT_STATUS_SET.has(
    normalizedValue
  )
    ? normalizedValue
    : ALL_STATUS;
};

export const getDepositStatusesToLoad = (
  statusFilter
) => {
  const normalizedStatus =
    normalizeDepositStatusFilter(
      statusFilter
    );

  return normalizedStatus ===
    ALL_STATUS
    ? DEPOSIT_STATUS_CODES
    : [normalizedStatus];
};

export const normalizeText = (value) => {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

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

export const getProductNames = (item) => {
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

export const getConsignmentPageData = (apiResult) => {
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

const normalizeApiTimeToUtc = (value) => {
  return apiToUtcIso(value, {
    apiTimeMode: "utc",
  });
};

export const normalizeConsignmentTime = (item) => {
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

export const formatDate = (value) => {
  const utcIso = normalizeApiTimeToUtc(value);

  if (!utcIso) {
    return "-";
  }

  return formatVietnamDateTime(utcIso, {
    apiTimeMode: "utc",
    fallback: "-",
  });
};

export const formatDateUtcTitle = (value) => {
  const utcIso = normalizeApiTimeToUtc(value);

  if (!utcIso) {
    return "";
  }

  return `UTC+0: ${formatUtcDateTime(utcIso, {
    apiTimeMode: "utc",
    fallback: "-",
  })}`;
};

export const formatWeight = (value) => {
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
export const getTotalVolumeCm3 = (item) => {
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

export const formatVolumeCm3 = (value) => {
  const volumeCm3 = Number(value);

  if (!Number.isFinite(volumeCm3) || volumeCm3 < 0) {
    return "0 cm³";
  }

  return `${volumeCm3.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} cm³`;
};

export const getConsignmentStatusCode = (
  itemOrStatus
) => {
  const value =
    typeof itemOrStatus === "object"
      ? itemOrStatus?.status ??
      itemOrStatus?.orderStatus ??
      itemOrStatus?.consignmentStatus
      : itemOrStatus;

  /* Mã cũ còn sót (dữ liệu lạ) được quy về mã đích trước khi tra bảng/lọc. */
  return String(normalizeOrderStatus(value) || "")
    .trim()
    .toUpperCase();
};

export const getConsignmentStatus = (
  itemOrStatus
) => {
  const code =
    getConsignmentStatusCode(
      itemOrStatus
    );

  const configuredStatus =
    CONSIGNMENT_STATUS_CONFIG[code];

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
        (character) =>
          character.toLocaleUpperCase(
            "vi-VN"
          )
      )
    : "Chưa xác định";

  return {
    code: code || "UNKNOWN",
    label: fallbackLabel,
    className: "status-unknown",
  };
};

export const getConsignmentTypeLabel = (type) => {
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

export const getTrackingCode = (item) => {
  const trackingCode =
    item?.consignmentCode ||
    item?.trackingCode ||
    item?.domesticTrackingCode ||
    item?.waybillCode ||
    item?.shipmentCode;

  return String(trackingCode || "").trim() || "-";
};

export const getOrderCode = (item) => {
  return String(
    item?.orderCode || item?.orderId || "-"
  ).trim();
};

export const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.title ||
    error?.message ||
    "Không thể tải danh sách yêu cầu ký gửi."
  );
};

export const getUniqueConsignmentKey = (
  item,
  index
) => {
  return String(
    item?.orderId ||
    item?.consignmentCode ||
    item?.trackingCode ||
    item?.id ||
    `consignment-${index}`
  ).trim();
};
