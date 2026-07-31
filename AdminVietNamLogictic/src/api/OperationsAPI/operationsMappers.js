/** Helpers OP — port từ vcl-forntend modules/operations/mappers (+ status labels tối giản). */

const CONSOLIDATION_STATUS_META = {
  DRAFT: { label: "Nháp", tone: "default" },
  WAITING: { label: "Chờ xử lý", tone: "warning" },
  PENDING: { label: "Chờ xử lý", tone: "warning" },
  PROCESSING: { label: "Đang xử lý", tone: "processing" },
  IN_PROGRESS: { label: "Đang xử lý", tone: "processing" },
  CONSOLIDATED: { label: "Đã gom", tone: "processing" },
  IN_TRANSIT: { label: "Đang vận chuyển", tone: "processing" },
  SHIPPED: { label: "Đang vận chuyển", tone: "processing" },
  COMPLETED: { label: "Hoàn tất", tone: "success" },
  DONE: { label: "Hoàn tất", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "error" },
};

export function getConsolidationStatusMeta(status) {
  const key = String(status ?? "").trim().toUpperCase();
  return (
    CONSOLIDATION_STATUS_META[key] ?? {
      label: key || "Không rõ",
      tone: "default",
    }
  );
}

export function countConsolidationParcels(consolidation) {
  return (consolidation?.orders ?? []).reduce(
    (count, order) => count + (order?.parcels?.length ?? 0),
    0
  );
}

export function buildConsolidationSummary(items) {
  const source = Array.isArray(items) ? items : [];
  const summary = {
    batches: source.length,
    waiting: 0,
    orders: 0,
    parcels: 0,
    totalWeight: 0,
    totalVolume: 0,
  };
  for (const item of source) {
    summary.orders += item?.orders?.length ?? 0;
    summary.parcels += countConsolidationParcels(item);
    summary.totalWeight += Number(item?.totalWeight) || 0;
    summary.totalVolume += Number(item?.totalVolume) || 0;
    if (getConsolidationStatusMeta(item?.status).tone === "warning") {
      summary.waiting += 1;
    }
  }
  return summary;
}

const STATUS_ALIASES = {
  WAITING_PAYMENT: "WAITING_DEPOSIT",
  CHECKED_IN: "IN_WAREHOUSE",
};

const STATUS_LABELS = {
  DRAFT: "Nháp",
  PENDING_REVIEW: "Chờ báo giá",
  QUOTATION_SENT: "Đã gửi báo giá",
  QUOTATION_CONFIRMED: "Khách đã xác nhận báo giá",
  QUOTATION_REJECTED: "Khách từ chối báo giá",
  WAITING_DEPOSIT: "Chờ thanh toán đặt cọc",
  WAITING_PAYMENT: "Chờ thanh toán đặt cọc",
  DEPOSIT_PAID: "Đã thanh toán đặt cọc",
  WAITING_FINAL_PAYMENT: "Chờ thanh toán cuối",
  PAYMENT_CONFIRMED: "Đã xác nhận thanh toán",
  PAID: "Đã thanh toán đủ",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  IN_PROGRESS: "Đang xử lý",
  WAITING_FOR_PARCEL: "Chờ hàng về kho",
  IN_WAREHOUSE: "Đã check-in tại kho",
  WAREHOUSE_RECEIVED: "Đã nhận tại kho (check-in)",
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn tất",
};

export const CONSIGNMENT_TYPE_FILTER_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "STANDARD", label: "Standard" },
  { value: "EXPRESS", label: "Express" },
  { value: "CONSOLIDATION", label: "Consolidation" },
  { value: "ECONOMY", label: "Economy" },
  { value: "FREIGHT", label: "Freight" },
];

export function canonicalizeConsignmentStatus(status) {
  const key = String(status ?? "").trim().toUpperCase();
  if (!key) return "";
  return STATUS_ALIASES[key] || key;
}

export function getConsignmentStatusLabel(status) {
  const key = canonicalizeConsignmentStatus(status);
  return STATUS_LABELS[key] || status || "—";
}

const READY_STATUSES = new Set(["APPROVED"]);
const MOVING_STATUSES = new Set(["IN_PROGRESS", "WAITING_FOR_PARCEL"]);
const COMPLETED_STATUSES = new Set(["COMPLETED"]);

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function normalizeStatus(value) {
  return String(value ?? "").trim().toUpperCase();
}

function isWithin(dateValue, from, to) {
  const timestamp = new Date(dateValue).getTime();
  return Number.isFinite(timestamp) && timestamp >= from.getTime() && timestamp <= to.getTime();
}

function matchesDimensions(item, { status, consignmentType }) {
  const wantedStatus = canonicalizeConsignmentStatus(status);
  const wantedType = String(consignmentType ?? "").trim().toUpperCase();
  return (
    (!wantedStatus || canonicalizeConsignmentStatus(item.status) === wantedStatus) &&
    (!wantedType || String(item.consignmentType ?? "").trim().toUpperCase() === wantedType)
  );
}

function countStatuses(items, statuses) {
  return items.reduce(
    (count, item) => count + (statuses.has(normalizeStatus(item.status)) ? 1 : 0),
    0
  );
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function buildKpi(key, value, previousValue) {
  return {
    key,
    value,
    previousValue,
    change: percentChange(value, previousValue),
  };
}

function toDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTrend(items, from, days) {
  const counts = new Map();
  for (const item of items) {
    if (!item.createdAt) continue;
    const key = toDateKey(item.createdAt);
    const bucket = counts.get(key) ?? { count: 0, totalWeight: 0 };
    bucket.count += 1;
    bucket.totalWeight += Number(item.totalWeight) || 0;
    counts.set(key, bucket);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(from, index);
    const key = toDateKey(date);
    const bucket = counts.get(key) ?? { count: 0, totalWeight: 0 };
    return {
      date: key,
      label: new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }).format(date),
      ...bucket,
    };
  });
}

function buildStatusBreakdown(items) {
  const counts = new Map();
  for (const item of items) {
    const status = canonicalizeConsignmentStatus(item.status) || "UNKNOWN";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([status, count]) => ({
      status,
      count,
      percent: items.length ? Math.round((count / items.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildTopRoutes(items) {
  const routes = new Map();
  for (const item of items) {
    const route = item.route || item.destination || "Chưa xác định";
    const current = routes.get(route) ?? { route, count: 0, totalWeight: 0 };
    current.count += 1;
    current.totalWeight += Number(item.totalWeight) || 0;
    routes.set(route, current);
  }

  return [...routes.values()]
    .sort((a, b) => b.count - a.count || b.totalWeight - a.totalWeight)
    .slice(0, 5);
}

export function buildOperationalAnalytics(
  items,
  { days = 30, status = "", consignmentType = "", now = new Date() } = {}
) {
  const safeDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const currentTo = new Date(now);
  const currentFrom = addDays(startOfDay(currentTo), -(safeDays - 1));
  const previousTo = new Date(currentFrom.getTime() - 1);
  const previousFrom = addDays(startOfDay(currentFrom), -safeDays);
  const source = Array.isArray(items) ? items : [];
  const dimensions = { status, consignmentType };

  const currentRows = source
    .filter(
      (item) =>
        matchesDimensions(item, dimensions) &&
        isWithin(item.createdAt, currentFrom, currentTo)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const previousRows = source.filter(
    (item) =>
      matchesDimensions(item, dimensions) &&
      isWithin(item.createdAt, previousFrom, previousTo)
  );

  const metric = (statuses) => [
    countStatuses(currentRows, statuses),
    countStatuses(previousRows, statuses),
  ];
  const [ready, previousReady] = metric(READY_STATUSES);
  const [moving, previousMoving] = metric(MOVING_STATUSES);
  const [completed, previousCompleted] = metric(COMPLETED_STATUSES);

  return {
    rows: currentRows,
    range: { from: currentFrom, to: currentTo, days: safeDays },
    kpis: [
      buildKpi("total", currentRows.length, previousRows.length),
      buildKpi("ready", ready, previousReady),
      buildKpi("moving", moving, previousMoving),
      buildKpi("completed", completed, previousCompleted),
    ],
    trend: buildTrend(currentRows, currentFrom, safeDays),
    statusBreakdown: buildStatusBreakdown(currentRows),
    topRoutes: buildTopRoutes(currentRows),
    totalWeight: currentRows.reduce((sum, item) => sum + (Number(item.totalWeight) || 0), 0),
  };
}
