/**
 * Hàm thuần của màn Đơn mua nhà cung cấp — tách ra để kiểm thử được bằng máy
 * và để file màn hình chỉ còn phần dựng giao diện.
 */
import { getOrderStatusLabel } from "@features/consignment";
import {
  PURCHASE_ORDER_STATUS,
  hasPendingRefund,
} from "@features/purchase/api/purchaseOrderService";
import { STATUS_CONFIG as PURCHASE_REQUEST_STATUS_CONFIG } from "@features/purchase/pages/PurchaseRequestDetail/PurchaseRequestDetail.constants";

const upper = (value) => String(value ?? "").trim().toUpperCase();

export const formatVnd = (value) =>
  `${Math.round(Number(value) || 0).toLocaleString("vi-VN")} ₫`;

export const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

/** Ngưỡng lệch giá mặc định của backend (`DefaultPriceToleranceRate`) khi chưa cấu hình phí. */
export const DEFAULT_PRICE_TOLERANCE_RATE = 5;

/** Số tiền có dấu: "+2.500.000 ₫", "−10.770 ₫", "0 ₫". */
export const formatSignedVnd = (value) => {
  const rounded = Math.round(Number(value) || 0);

  if (rounded === 0) return formatVnd(0);

  return `${rounded > 0 ? "+" : "−"}${formatVnd(Math.abs(rounded))}`;
};

/** Phần trăm có dấu, một chữ số thập phân kiểu Việt Nam: "+4,2%", "−18,3%". */
export const formatSignedPercent = (rate) => {
  if (rate === null || rate === undefined || !Number.isFinite(Number(rate))) return "—";

  const value = Math.round(Number(rate) * 10) / 10;
  const text = Math.abs(value).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${text}%`;
};

/**
 * Chênh giữa tiền mua thực và tiền đã báo khách — ĐÚNG quy tắc backend dùng khi gửi duyệt
 * (PurchaseOrderService.SubmitAsync):
 *
 *   vượt ngưỡng ⇔ mua thực > round(đã báo × (1 + ngưỡng/100))
 *     → đơn sang AWAITING_CUSTOMER: khách xem + trả phần chênh rồi mới tới Admin duyệt ngân sách.
 *   mua thực thấp hơn đã báo ≥ 1.000 ₫ → backend lập khoản hoàn chênh giá cho khách.
 *
 * % chênh = (mua thực − đã báo) / đã báo × 100. Đã báo = 0 thì KHÔNG có % (null) — không hiện
 * "0.0%" giả, vì chia cho 0 không có nghĩa.
 *
 * @returns {{ quoted: number, actual: number, diff: number, rate: number|null, hasQuote: boolean,
 *   exceeded: boolean, direction: "over"|"under"|"equal", tone: string, note: string }}
 */
export const getPriceDiffInfo = ({ actual = 0, quoted = 0, toleranceRate } = {}) => {
  const tolerance = Number.isFinite(Number(toleranceRate)) && toleranceRate !== null && toleranceRate !== ""
    ? Number(toleranceRate)
    : DEFAULT_PRICE_TOLERANCE_RATE;
  const quotedValue = Number(quoted) || 0;
  const actualValue = Number(actual) || 0;
  const diff = actualValue - quotedValue;
  const hasQuote = quotedValue > 0;
  const rate = hasQuote ? (diff / quotedValue) * 100 : null;
  const exceeded = hasQuote && actualValue > Math.round(quotedValue * (1 + tolerance / 100));
  const direction = Math.abs(diff) < 1 ? "equal" : diff > 0 ? "over" : "under";

  let tone = "success";
  let note = "Khớp giá đã báo khách.";

  if (!hasQuote) {
    tone = "default";
    note = "Chưa có giá đã báo khách để so.";
  } else if (exceeded) {
    tone = "error";
    note = `Vượt ngưỡng ${tolerance}% — khách phải xác nhận và trả phần chênh, rồi Admin mới duyệt ngân sách.`;
  } else if (direction === "over") {
    tone = "warning";
    note = `Cao hơn giá đã báo nhưng trong ngưỡng ${tolerance}% — khách không phải trả thêm.`;
  } else if (direction === "under") {
    tone = "success";
    note = "Mua rẻ hơn giá đã báo — khách được hoàn phần chênh.";
  }

  return { quoted: quotedValue, actual: actualValue, diff, rate, hasQuote, exceeded, direction, tone, tolerance, note };
};

/**
 * Tổng chênh của các dòng đang lập (tính ngay trên màn để Sale thấy TRƯỚC khi gửi duyệt).
 * Tiền đã báo = Σ đơn giá báo × SL mua — đúng `QuotedGoodsAmount` backend ghi cho đơn.
 */
export const summarizePriceDifference = (lines = [], toleranceRate = DEFAULT_PRICE_TOLERANCE_RATE) => {
  const quoted = lines.reduce(
    (total, line) => total + (Number(line.quotedUnitPrice) || 0) * (Number(line.quantity) || 0),
    0
  );

  const actual = lines.reduce(
    (total, line) => total + (Number(line.unitPriceVnd) || 0) * (Number(line.quantity) || 0),
    0
  );

  return getPriceDiffInfo({ actual, quoted, toleranceRate });
};

/** Đơn mua còn "giữ" sản phẩm theo backend (`PurchaseOrderStatuses.IsActive`): mọi trạng thái trừ CANCELLED. */
export const isActivePurchaseOrder = (order) => upper(order?.status) !== PURCHASE_ORDER_STATUS.CANCELLED;

/**
 * SL đã đóng "không mua được" (đã hoàn tiền) theo sản phẩm — khớp `ClosedUnfulfilledQtyAsync`:
 * dòng hoàn lý do UNFULFILLED thuộc khoản hoàn chưa huỷ.
 *
 * @returns {Map<string, number>} purchaseRequestItemId (chữ thường) → SL đã đóng
 */
export const getClosedUnfulfilledQuantities = (refunds = []) => {
  const closed = new Map();

  (Array.isArray(refunds) ? refunds : [])
    .filter((refund) => upper(refund?.status) !== "CANCELLED")
    .flatMap((refund) => (Array.isArray(refund?.lines) ? refund.lines : []))
    .filter((line) => upper(line?.reasonCode) === "UNFULFILLED")
    .forEach((line) => {
      const key = String(line?.purchaseRequestItemId || "").toLowerCase();

      if (!key) return;
      closed.set(key, (closed.get(key) || 0) + (Number(line?.quantity) || 0));
    });

  return closed;
};

/**
 * Sản phẩm này còn đưa được vào đơn mua đang lập / sửa không, tối đa bao nhiêu — đúng các chặn
 * của backend (PurchaseOrderService.ApplyContentAsync):
 *  - "Mỗi sản phẩm chỉ nằm trong một đơn mua còn hiệu lực": đã có trong đơn KHÁC chưa huỷ (kể cả
 *    nháp / bị từ chối) thì hết — kể cả khi đơn đó mua ít hơn khách đặt (phần thiếu phải đóng
 *    "không mua được" hoặc sửa đơn đó);
 *  - SL ≤ SL khách đặt − SL đã đóng "không mua được";
 *  - sản phẩm phải có trong báo giá khách đã chấp nhận.
 *
 * @returns {{ remaining: number, takenBy: string, closed: number, inQuotation: boolean }}
 */
export const getLineAvailability = (
  requestItem,
  existingOrders = [],
  currentOrderId = "",
  closedQuantities = new Map()
) => {
  const id = String(requestItem?.purchaseRequestItemId || "").toLowerCase();
  const requested = Number(requestItem?.quantity) || 0;
  const closed = closedQuantities.get(id) || 0;
  const inQuotation = requestItem?.inQuotation !== false;

  const holder = (Array.isArray(existingOrders) ? existingOrders : [])
    .filter((order) => order.purchaseOrderId !== currentOrderId && isActivePurchaseOrder(order))
    .find((order) =>
      (order.items || []).some(
        (item) => String(item.purchaseRequestItemId || "").toLowerCase() === id
      )
    );

  const remaining = holder || !inQuotation ? 0 : Math.max(0, requested - closed);

  return { remaining, takenBy: holder ? holder.purchaseOrderCode || "đơn khác" : "", closed, inQuotation };
};

/** Số lượng còn được mua của một dòng (giữ tên cũ cho nơi đang dùng). */
export const getRemainingQuantity = (requestItem, existingOrders = [], currentOrderId = "", closedQuantities) =>
  getLineAvailability(requestItem, existingOrders, currentOrderId, closedQuantities).remaining;

/* Lớp màu của bảng trạng thái yêu cầu mua hộ → màu Tag antd. */
const REQUEST_TONE_BY_CLASS = Object.freeze({
  "is-success": "green",
  "is-warning": "gold",
  "is-info": "blue",
  "is-danger": "red",
});

/* Trạng thái bảng chi tiết chưa có (luồng đơn mua NCC mới thêm) — nhãn đúng như backend. */
const EXTRA_REQUEST_STATUS = Object.freeze({
  PURCHASING: { label: "Đang mua hàng", className: "is-info" },
});

/**
 * Nhãn + màu trạng thái YÊU CẦU mua hộ. Ưu tiên `statusDisplayName` backend đã dịch; không có thì
 * tra bảng trạng thái của trang chi tiết yêu cầu; mã lạ thì hiện nguyên mã.
 */
export const getPurchaseRequestStatusView = (status, statusDisplayName = "") => {
  const code = upper(status);
  const config = PURCHASE_REQUEST_STATUS_CONFIG[code] || EXTRA_REQUEST_STATUS[code] || null;
  const label = String(statusDisplayName || "").trim() || config?.label || code || "—";

  return { code, label, color: REQUEST_TONE_BY_CLASS[config?.className] || "default" };
};

/**
 * Nhãn trạng thái ĐƠN KHO sinh từ đơn mua. Đơn kho mua hộ được tạo ở DEPOSIT_PAID (khách đã trả
 * trước) — bảng nhãn ký gửi gọi mã này là "Đã đặt cọc", sai nghĩa với mua hộ nên đổi riêng.
 */
export const getWarehouseOrderStatusLabel = (status) =>
  upper(status) === "DEPOSIT_PAID" ? "Đã trả trước, chờ hàng về kho" : getOrderStatusLabel(status);

/** Bỏ dấu + chữ thường để tìm "nguyen van" vẫn ra "Nguyễn Văn". */
export const toSearchText = (...values) =>
  values
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/**
 * Dòng của hộp "Chọn yêu cầu mua hộ để lập đơn".
 *
 * Backend mới (`request.hasLineInfo`): dùng thẳng `openLineCount` / `openQuantity` /
 * `closedQuantity` / `activePurchaseOrderCount` — backend đếm đúng luật `getLineAvailability`
 * (có trong báo giá ACCEPTED, không nằm trong đơn mua chưa huỷ nào, SL khách đặt − SL đã đóng
 * "không mua được" > 0), nên không phải đọc đơn mua của từng yêu cầu.
 *
 * Backend cũ (thiếu các trường đó): danh sách chỉ có `itemCount`, không có id từng dòng, nên
 * "còn chưa lập đơn" đếm theo số dòng sản phẩm khác nhau đã nằm trong đơn mua còn hiệu lực
 * (`orders` đọc riêng; null = đọc lỗi). Phần đã đóng "không mua được" không có → hộp lập đơn
 * (đọc chi tiết + khoản hoàn) mới là chốt cuối, ghi rõ nếu không còn gì mua được.
 *
 * Thông tin khách: trường có sẵn trên dòng (`request.hasCustomerInfo`), không thì lấy `customer`
 * ghép từ danh bạ khách hàng.
 */
export const buildPickerRow = (request, { customer = null, orders = null } = {}) => {
  const hasLineInfo = Boolean(request?.hasLineInfo);

  let openLines;
  let activeOrderCount;

  if (hasLineInfo) {
    openLines = Math.max(0, Number(request.openLineCount) || 0);
    activeOrderCount = Math.max(0, Number(request.activePurchaseOrderCount) || 0);
  } else {
    const activeOrders = Array.isArray(orders) ? orders.filter(isActivePurchaseOrder) : [];
    const takenLineIds = new Set(
      activeOrders.flatMap((order) =>
        (order.items || []).map((item) => String(item.purchaseRequestItemId || "").toLowerCase())
      )
    );
    takenLineIds.delete("");

    const itemCount = Number(request.itemCount) || 0;

    openLines = orders === null ? null : Math.max(0, itemCount - takenLineIds.size);
    activeOrderCount = activeOrders.length;
  }

  const customerInfo = request?.hasCustomerInfo
    ? {
      fullName: request.customerName || "",
      customerCode: request.customerCode || "",
      phone: request.customerPhone || "",
    }
    : {
      fullName: customer?.fullName || "",
      customerCode: customer?.customerCode || "",
      phone: customer?.phone || "",
    };

  return {
    ...request,
    customerName: customerInfo.fullName,
    customerCode: customerInfo.customerCode,
    customerPhone: customerInfo.phone,
    statusView: getPurchaseRequestStatusView(request.status, request.statusDisplayName),
    activeOrderCount,
    openLines,
    /* Chỉ có ở backend mới; null = không biết (hộp lập đơn kiểm lại). */
    openQuantity: hasLineInfo ? request.openQuantity ?? null : null,
    closedQuantity: hasLineInfo ? request.closedQuantity ?? null : null,
    prepaidAmount: request?.prepaidAmount ?? null,
    searchText: toSearchText(
      request.purchaseCode,
      customerInfo.fullName,
      customerInfo.customerCode,
      customerInfo.phone,
      request.receiverName
    ),
  };
};

/** Đơn đã đặt NCC — khớp `PurchaseOrderStatuses.Placed` của backend. */
export const PLACED_STATUSES = Object.freeze([
  PURCHASE_ORDER_STATUS.ORDERED,
  PURCHASE_ORDER_STATUS.SUPPLIER_CONFIRMED,
  PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED,
]);

/**
 * Việc người đang đăng nhập được làm với đơn mua này.
 * Quyền đi theo VAI TRÒ vì backend cũng chặn theo vai trò; màn hình chỉ giấu nút cho đỡ rối.
 */
export const getAvailableActions = (order, role) => {
  const status = String(order?.status ?? "").trim().toUpperCase();
  const isSale = role === "sale";
  const isAdmin = role === "admin";

  return {
    edit: isSale && [PURCHASE_ORDER_STATUS.DRAFT, PURCHASE_ORDER_STATUS.REJECTED].includes(status),
    submit: isSale && [PURCHASE_ORDER_STATUS.DRAFT, PURCHASE_ORDER_STATUS.REJECTED].includes(status),
    decide: isAdmin && status === PURCHASE_ORDER_STATUS.PENDING_APPROVAL,
    place: isSale && status === PURCHASE_ORDER_STATUS.APPROVED,
    progress:
      isSale &&
      [PURCHASE_ORDER_STATUS.ORDERED, PURCHASE_ORDER_STATUS.SUPPLIER_CONFIRMED].includes(status),
    cancel:
      isAdmin &&
      ![
        PURCHASE_ORDER_STATUS.CANCELLED,
        PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED,
      ].includes(status),

    /*
     * Xác nhận đã hoàn tiền: không phụ thuộc trạng thái đơn — khoản hoàn là việc của
     * sổ tiền, đơn đã huỷ vẫn phải trả lại tiền cho khách. Cả Sale lẫn Admin làm được,
     * đúng với quyền backend (StaffRoleHelper.CanHandlePayments).
     */
    completeRefund: (isSale || isAdmin) && hasPendingRefund(order),

    /* Xem mọi khoản hoàn của đơn (kể cả đã chuyển xong) — ai trong hai vai cũng cần đối chiếu. */
    viewRefunds:
      (isSale || isAdmin) &&
      ((Array.isArray(order?.refunds) && order.refunds.length > 0) ||
        Number(order?.refundAmount) > 0),

    /*
     * "NCC giao thiếu": chỉ khi NCC ĐÃ phát hàng — hàng chưa đi thì chưa có chuyện giao thiếu.
     * Backend vẫn nhận ghi thiếu từ ORDERED trở đi; màn này cố ý chỉ mở ở SUPPLIER_SHIPPED để
     * nút không hiện cạnh "NCC đã phát hàng". NCC hết hàng TRƯỚC khi giao thì đóng ở trang chi
     * tiết yêu cầu mua hộ (nút "Đóng phần không mua được") hoặc Admin huỷ đơn với nguyên nhân NCC.
     */
    closeShortage: (isSale || isAdmin) && status === PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED,
  };
};

/** Mốc tiến độ kế tiếp của đơn đã đặt NCC. */
export const getNextProgressStep = (status) => {
  const current = String(status ?? "").trim().toUpperCase();

  if (current === PURCHASE_ORDER_STATUS.ORDERED) {
    return {
      status: PURCHASE_ORDER_STATUS.SUPPLIER_CONFIRMED,
      label: "NCC đã xác nhận đơn",
      needsTracking: false,
    };
  }

  if (current === PURCHASE_ORDER_STATUS.SUPPLIER_CONFIRMED) {
    return {
      status: PURCHASE_ORDER_STATUS.SUPPLIER_SHIPPED,
      label: "NCC đã phát hàng",
      needsTracking: true,
    };
  }

  return null;
};

/* =========================================================
   THAO TÁC TRÊN MỘT DÒNG — gửi đúng một lần, cập nhật đúng dòng
========================================================= */

const orderKey = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Bộ chạy thao tác theo đơn: mỗi đơn chỉ MỘT lời gọi đang bay. Gọi lần hai khi lần đầu chưa xong
 * (bấm đúp, Enter + bấm chuột) trả ngay `{ ok: false, skipped: true }` — API không bị gọi lần hai.
 * Không bao giờ ném: `{ ok: true, order }` (order = đơn backend trả, có thể null) hoặc
 * `{ ok: false, error }` để hộp đang mở hiện câu lỗi và giữ nguyên.
 */
export const createOrderActionRunner = () => {
  const inFlight = new Set();

  const run = async (orderId, action) => {
    const key = orderKey(orderId);

    if (inFlight.has(key)) return { ok: false, skipped: true };

    inFlight.add(key);

    try {
      const order = await action();

      return { ok: true, order: order ?? null };
    } catch (error) {
      return { ok: false, error };
    } finally {
      inFlight.delete(key);
    }
  };

  run.isBusy = (orderId) => inFlight.has(orderKey(orderId));

  return run;
};

/**
 * Gộp đơn backend vừa trả (cùng DTO với danh sách) vào bảng, đúng dòng theo `purchaseOrderId`.
 * Đang lọc một trạng thái mà đơn đã sang trạng thái khác → bỏ dòng khỏi bảng, như server trả.
 *
 * @returns {Array|null} bảng mới; null = phản hồi không dùng được (thiếu id / trạng thái, hoặc
 *   dòng không có trong bảng) → trang tải lại bảng MỘT lần.
 */
export const applyOrderUpdate = (rows, updated, { statusFilter = "" } = {}) => {
  const id = orderKey(updated?.purchaseOrderId);
  const status = upper(updated?.status);

  if (!id || !status || !Array.isArray(rows)) return null;

  const index = rows.findIndex((row) => orderKey(row?.purchaseOrderId) === id);

  if (index < 0) return null;

  const filter = upper(statusFilter);

  if (filter && filter !== status) return rows.filter((_, position) => position !== index);

  const next = rows.slice();

  /* Giữ id gốc của dòng: khoá dòng bảng (rowKey) và đơn đang khoá (busyId) không đổi theo hoa/thường. */
  next[index] = { ...rows[index], ...updated, purchaseOrderId: rows[index].purchaseOrderId };

  return next;
};
