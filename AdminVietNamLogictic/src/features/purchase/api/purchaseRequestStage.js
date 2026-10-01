/* =========================================================
   purchaseRequestStage.js — CHẶNG THẬT của một yêu cầu mua hộ (hàm THUẦN, không gọi mạng).

   Vì sao có file này (30/09/2026):
   Backend trả `status` của PURCHASE_REQUESTS kèm nhãn `statusDisplayName`. Mã COMPLETED
   mang nhãn "Hoàn tất nghiệp vụ" và được ghi bởi HAI đường khác nghĩa nhau:
     1. PurchaseRequestProgress.SyncAfterOrderClosedAsync — mọi đơn kho của các đơn mua NCC
        đã đặt đều COMPLETED (giao xong, đóng đơn) → hoàn tất thật;
     2. PurchasePaymentEffects.ApplyPaidAsync — khoản FINAL_PAYMENT đời cũ được trả → chỉ là
        "đã tất toán", hàng có thể vẫn nằm ở kho nước ngoài (production 30/09: 2/4 yêu cầu
        COMPLETED có đơn kho còn WAREHOUSE_RECEIVED).
   Vì vậy màn Sale KHÔNG dùng nhãn server cho mã này; chặng được suy ra từ dữ liệu thật:
   trạng thái yêu cầu + đơn mua NCC (`GET /api/purchase-orders`) + đơn kho mua hộ
   (`GET /api/orders/consignments?orderType=PURCHASE`).

   "Đơn đã hoàn tất" chỉ khi: backend đã chốt yêu cầu COMPLETED, MỌI phần hàng (đơn mua NCC
   chưa huỷ / đơn kho) đều COMPLETED hoặc đã đóng, và không còn khoản hoàn nào chờ chuyển.
   ========================================================= */

const upper = (value) => String(value ?? "").trim().toUpperCase();

const text = (value) => String(value ?? "").trim();

/* =========================================================
   CHẶNG + NHÃN
========================================================= */

export const PURCHASE_STAGE = Object.freeze({
  AWAITING_QUOTE: "AWAITING_QUOTE",
  NEED_MORE_INFO: "NEED_MORE_INFO",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PREPAID: "PREPAID",
  ORDERING_SUPPLIER: "ORDERING_SUPPLIER",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED_VN: "ARRIVED_VN",
  DELIVERED: "DELIVERED",
  AWAITING_REFUND: "AWAITING_REFUND",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED",
  /* Chỉ khi không tải được dữ liệu đối chiếu — không bao giờ được tự nhận là hoàn tất. */
  UNVERIFIED: "UNVERIFIED",
});

/**
 * Thứ tự dùng để lấy chặng CHẬM NHẤT khi yêu cầu tách nhiều đơn mua NCC: một phần còn đang
 * đặt NCC thì cả yêu cầu chưa thể "đã về kho VN".
 */
const STAGE_RANK = Object.freeze({
  AWAITING_QUOTE: 1,
  NEED_MORE_INFO: 1,
  AWAITING_PAYMENT: 2,
  PREPAID: 3,
  ORDERING_SUPPLIER: 4,
  IN_TRANSIT: 5,
  ARRIVED_VN: 6,
  DELIVERED: 7,
  AWAITING_REFUND: 8,
  COMPLETED: 9,
});

export const PURCHASE_STAGE_META = Object.freeze({
  AWAITING_QUOTE: { label: "Chờ báo giá", className: "is-warning", tone: "gold" },
  NEED_MORE_INFO: { label: "Chờ khách bổ sung thông tin", className: "is-warning", tone: "gold" },
  AWAITING_PAYMENT: {
    label: "Đã báo giá – chờ khách thanh toán",
    className: "is-info",
    tone: "blue",
  },
  PREPAID: { label: "Đã thanh toán trước", className: "is-info", tone: "cyan" },
  ORDERING_SUPPLIER: { label: "Đang đặt hàng NCC", className: "is-info", tone: "geekblue" },
  IN_TRANSIT: { label: "Đang vận chuyển", className: "is-info", tone: "blue" },
  ARRIVED_VN: { label: "Đã về kho VN", className: "is-info", tone: "purple" },
  DELIVERED: { label: "Đã giao – chờ đóng đơn", className: "is-info", tone: "lime" },
  AWAITING_REFUND: { label: "Chờ hoàn tiền cho khách", className: "is-warning", tone: "orange" },
  COMPLETED: { label: "Đơn đã hoàn tất", className: "is-success", tone: "green" },
  CANCELLED: { label: "Đã huỷ", className: "is-danger", tone: "red" },
  REJECTED: { label: "Đã từ chối", className: "is-danger", tone: "red" },
  UNVERIFIED: {
    label: "Chưa đối chiếu được tiến độ",
    className: "is-default",
    tone: "default",
  },
});

/** Ô lọc của màn Sale: đúng các chặng trên (không có "Hoàn tất nghiệp vụ"). */
export const PURCHASE_STAGE_FILTER_OPTIONS = Object.freeze(
  [
    PURCHASE_STAGE.AWAITING_QUOTE,
    PURCHASE_STAGE.NEED_MORE_INFO,
    PURCHASE_STAGE.AWAITING_PAYMENT,
    PURCHASE_STAGE.PREPAID,
    PURCHASE_STAGE.ORDERING_SUPPLIER,
    PURCHASE_STAGE.IN_TRANSIT,
    PURCHASE_STAGE.ARRIVED_VN,
    PURCHASE_STAGE.DELIVERED,
    PURCHASE_STAGE.AWAITING_REFUND,
    PURCHASE_STAGE.COMPLETED,
    PURCHASE_STAGE.CANCELLED,
    PURCHASE_STAGE.REJECTED,
  ].map((value) => Object.freeze({ value, label: PURCHASE_STAGE_META[value].label }))
);

export const getPurchaseStageMeta = (stage) =>
  PURCHASE_STAGE_META[upper(stage)] || PURCHASE_STAGE_META.UNVERIFIED;

/**
 * Nhãn cho MÃ TRẠNG THÁI YÊU CẦU (không có dữ liệu đơn mua / đơn kho để suy chặng), ví dụ
 * dòng "Mua hộ · …" trên biểu đồ tổng quan. COMPLETED ở mức này chỉ nói được "đã đóng yêu
 * cầu" — không được gọi là hoàn tất vì có thể chỉ là tất toán đời cũ.
 */
const REQUEST_STATUS_LABELS = Object.freeze({
  NEW: "Chờ báo giá",
  PENDING_REVIEW: "Chờ báo giá",
  IN_REVIEW: "Chờ báo giá",
  NEED_MORE_INFO: "Chờ khách bổ sung thông tin",
  QUOTED: "Đã báo giá – chờ khách thanh toán",
  WAITING_PAYMENT: "Đã báo giá – chờ khách thanh toán",
  PAID: "Đã thanh toán trước",
  DEPOSIT_PAID: "Đã thanh toán trước",
  PURCHASING: "Đang đặt hàng NCC",
  PURCHASED: "Đang đặt hàng NCC",
  SELLER_SHIPPED: "Đang vận chuyển",
  ARRIVED_ORIGIN_WAREHOUSE: "Đang vận chuyển",
  WAITING_STORED: "Đang vận chuyển",
  STORED: "Đang vận chuyển",
  WAITING_FINAL_PAYMENT: "Đang vận chuyển",
  COMPLETED: "Đã đóng yêu cầu",
  CANCELLED: "Đã huỷ",
  REJECTED: "Đã từ chối",
  QUOTATION_REJECTED: "Đã từ chối",
});

export const getPurchaseRequestStatusLabel = (status, fallback = "") =>
  REQUEST_STATUS_LABELS[upper(status)] || text(fallback) || "Trạng thái khác";

/* =========================================================
   BẢNG MÃ BACKEND → CHẶNG
========================================================= */

/** Trạng thái yêu cầu trước khi có đơn mua NCC (VCL_BLL PurchaseRequestService). */
const REQUEST_STATUS_STAGE = Object.freeze({
  NEW: PURCHASE_STAGE.AWAITING_QUOTE,
  PENDING_REVIEW: PURCHASE_STAGE.AWAITING_QUOTE,
  IN_REVIEW: PURCHASE_STAGE.AWAITING_QUOTE,
  NEED_MORE_INFO: PURCHASE_STAGE.NEED_MORE_INFO,
  QUOTED: PURCHASE_STAGE.AWAITING_PAYMENT,
  WAITING_PAYMENT: PURCHASE_STAGE.AWAITING_PAYMENT,
  PAID: PURCHASE_STAGE.PREPAID,
  DEPOSIT_PAID: PURCHASE_STAGE.PREPAID,
  PURCHASING: PURCHASE_STAGE.ORDERING_SUPPLIER,
  PURCHASED: PURCHASE_STAGE.ORDERING_SUPPLIER,
  /* Đời cũ: các mốc sau đều là hàng CHƯA về Việt Nam (đợt cuối thu ở kho nguồn). */
  SELLER_SHIPPED: PURCHASE_STAGE.IN_TRANSIT,
  ARRIVED_ORIGIN_WAREHOUSE: PURCHASE_STAGE.IN_TRANSIT,
  WAITING_STORED: PURCHASE_STAGE.IN_TRANSIT,
  STORED: PURCHASE_STAGE.IN_TRANSIT,
  WAITING_FINAL_PAYMENT: PURCHASE_STAGE.IN_TRANSIT,
});

const TERMINAL_REQUEST_STAGE = Object.freeze({
  CANCELLED: PURCHASE_STAGE.CANCELLED,
  REJECTED: PURCHASE_STAGE.REJECTED,
  QUOTATION_REJECTED: PURCHASE_STAGE.REJECTED,
});

/**
 * Đơn kho (ORDERS, OrderType=PURCHASE) ĐÃ nhận hàng trở đi. Trạng thái trước nhận hàng
 * (DEPOSIT_PAID / PAID / APPROVED… sinh lúc đặt NCC) trả null → chặng lấy theo đơn mua NCC.
 */
const WAREHOUSE_ORDER_STAGE = Object.freeze({
  CHECKED_IN: PURCHASE_STAGE.IN_TRANSIT,
  WAREHOUSE_RECEIVED: PURCHASE_STAGE.IN_TRANSIT,
  IN_TRANSIT: PURCHASE_STAGE.IN_TRANSIT,
  AT_DESTINATION_WAREHOUSE: PURCHASE_STAGE.ARRIVED_VN,
  WAITING_FINAL_PAYMENT: PURCHASE_STAGE.ARRIVED_VN,
  DELIVERED: PURCHASE_STAGE.DELIVERED,
  CUSTOMER_CONFIRMED: PURCHASE_STAGE.DELIVERED,
  COMPLETED: PURCHASE_STAGE.COMPLETED,
});

const WAREHOUSE_ORDER_HINT = Object.freeze({
  CHECKED_IN: "Hàng đã tới kho nước ngoài",
  WAREHOUSE_RECEIVED: "Hàng đã nhập kho nước ngoài, chờ/đang chuyển về VN",
  AT_DESTINATION_WAREHOUSE: "Hàng đã nhập kho Việt Nam",
  WAITING_FINAL_PAYMENT: "Hàng ở kho VN, chờ khách thanh toán chặng cuối",
  DELIVERED: "Đã giao cho khách, chờ khách xác nhận / hết hạn khiếu nại",
  CUSTOMER_CONFIRMED: "Khách đã xác nhận nhận hàng, chờ đóng đơn",
});

const CLOSED_WAREHOUSE_ORDER = new Set(["CANCELLED", "CANCELLED_FORFEITED"]);

/** Đơn mua NCC (PurchaseOrderStatuses) — chỉ SUPPLIER_SHIPPED là hàng đã rời NCC. */
const PURCHASE_ORDER_STAGE = Object.freeze({
  DRAFT: PURCHASE_STAGE.ORDERING_SUPPLIER,
  AWAITING_CUSTOMER: PURCHASE_STAGE.ORDERING_SUPPLIER,
  AWAITING_CUSTOMER_PAYMENT: PURCHASE_STAGE.ORDERING_SUPPLIER,
  PENDING_APPROVAL: PURCHASE_STAGE.ORDERING_SUPPLIER,
  APPROVED: PURCHASE_STAGE.ORDERING_SUPPLIER,
  REJECTED: PURCHASE_STAGE.ORDERING_SUPPLIER,
  ORDERED: PURCHASE_STAGE.ORDERING_SUPPLIER,
  SUPPLIER_CONFIRMED: PURCHASE_STAGE.ORDERING_SUPPLIER,
  SUPPLIER_SHIPPED: PURCHASE_STAGE.IN_TRANSIT,
});

/* =========================================================
   NGỮ CẢNH ĐỐI CHIẾU
========================================================= */

const hasPendingRefundOf = (purchaseOrder = {}) => {
  const refunds = Array.isArray(purchaseOrder?.refunds) ? purchaseOrder.refunds : [];

  if (refunds.some((refund) => upper(refund?.status) === "PENDING")) return true;

  return Number(purchaseOrder?.refundAmount) > 0 && upper(purchaseOrder?.refundStatus) === "PENDING";
};

/**
 * Gom dữ liệu đối chiếu theo yêu cầu.
 *
 * @param {{ purchaseOrders?: any[] | null, warehouseOrders?: any[] | null }} sources
 *   `purchaseOrders` — dòng của GET /api/purchase-orders (PurchaseOrderResponseDto);
 *   `warehouseOrders` — dòng của GET /api/orders/consignments?orderType=PURCHASE.
 *   null = nguồn đó không tải được (khác với mảng rỗng = tải được nhưng không có dòng).
 */
export const buildPurchaseStageContext = ({ purchaseOrders = null, warehouseOrders = null } = {}) => {
  const ordersByRequest = new Map();

  (Array.isArray(purchaseOrders) ? purchaseOrders : []).forEach((po) => {
    const key = text(po?.purchaseRequestId).toLowerCase();
    if (!key) return;
    if (!ordersByRequest.has(key)) ordersByRequest.set(key, []);
    ordersByRequest.get(key).push(po);
  });

  const warehouse = (Array.isArray(warehouseOrders) ? warehouseOrders : [])
    .map((order) => ({
      code: upper(order?.consignmentCode ?? order?.orderCode ?? order?.code),
      status: upper(order?.status),
    }))
    .filter((order) => order.code);

  return {
    loaded: Array.isArray(purchaseOrders) && Array.isArray(warehouseOrders),
    purchaseOrdersLoaded: Array.isArray(purchaseOrders),
    warehouseOrdersLoaded: Array.isArray(warehouseOrders),
    purchaseOrdersOf: (purchaseRequestId) =>
      ordersByRequest.get(text(purchaseRequestId).toLowerCase()) || [],
    /* Đơn kho mua hộ mang mã PUR-… (đời cũ) hoặc PUR-…-n (mỗi đơn mua NCC một đơn kho). */
    warehouseOrdersOf: (purchaseCode) => {
      const code = upper(purchaseCode);
      if (!code) return [];
      return warehouse.filter((order) => order.code === code || order.code.startsWith(`${code}-`));
    },
  };
};

/* =========================================================
   SUY CHẶNG
========================================================= */

const slowest = (stages) =>
  stages.reduce(
    (worst, stage) => (worst == null || STAGE_RANK[stage] < STAGE_RANK[worst] ? stage : worst),
    null
  );

const result = (stage, hint = "", extra = {}) => ({
  stage,
  ...getPurchaseStageMeta(stage),
  hint,
  isFullyCompleted: stage === PURCHASE_STAGE.COMPLETED,
  ...extra,
});

/**
 * Chặng thật của MỘT yêu cầu mua hộ.
 *
 * @param {object} request dòng danh sách / chi tiết yêu cầu (status, purchaseRequestId,
 *   purchaseCode, openLineCount, activePurchaseOrderCount).
 * @param {ReturnType<typeof buildPurchaseStageContext> | null} context
 * @returns {{ stage: string, label: string, className: string, tone: string, hint: string,
 *   isFullyCompleted: boolean, milestones: { orderedAt?: string, supplierShippedAt?: string } }}
 */
export const derivePurchaseStage = (request = {}, context = null) => {
  const local = deriveLocalStage(request, context);
  const serverStage = upper(request?.overallStage);

  /*
   * Backend mới (env test 8088, 30/09/2026) tự trả `overallStage` / `isFullyCompleted` suy từ ĐỦ dữ
   * liệu (cả khoản hoàn cấp yêu cầu) → tin backend; FE chỉ giữ mốc thời gian + gợi ý của mình.
   * Backend cũ (production) không có trường này → dùng kết quả tự suy.
   */
  if (serverStage && PURCHASE_STAGE_META[serverStage] && serverStage !== PURCHASE_STAGE.UNVERIFIED) {
    return result(serverStage, serverStage === local.stage ? local.hint : "", {
      milestones: local.milestones,
    });
  }

  return local;
};

const deriveLocalStage = (request = {}, context = null) => {
  const status = upper(request?.status);

  if (TERMINAL_REQUEST_STAGE[status]) {
    return result(TERMINAL_REQUEST_STAGE[status], "", { milestones: {} });
  }

  const purchaseOrders = context
    ? context.purchaseOrdersOf(request?.purchaseRequestId ?? request?.id)
    : [];
  const warehouseOrders = context ? context.warehouseOrdersOf(request?.purchaseCode) : [];

  const activeOrders = purchaseOrders.filter((po) => upper(po?.status) !== "CANCELLED");
  const refundPending = purchaseOrders.some(hasPendingRefundOf);

  const milestones = {};
  activeOrders.forEach((po) => {
    if (po?.orderedAt && (!milestones.orderedAt || po.orderedAt < milestones.orderedAt)) {
      milestones.orderedAt = po.orderedAt;
    }
    if (
      po?.supplierShippedAt &&
      (!milestones.supplierShippedAt || po.supplierShippedAt > milestones.supplierShippedAt)
    ) {
      milestones.supplierShippedAt = po.supplierShippedAt;
    }
  });

  const partStages = [];
  const hints = [];

  if (activeOrders.length > 0) {
    /* Luồng chuẩn: mỗi đơn mua NCC chưa huỷ là một phần hàng, đơn kho của nó đi kèm. */
    activeOrders.forEach((po) => {
      const warehouseStatus = upper(po?.warehouseOrderStatus);
      if (CLOSED_WAREHOUSE_ORDER.has(warehouseStatus)) return;

      const fromWarehouse = WAREHOUSE_ORDER_STAGE[warehouseStatus];
      const stage = fromWarehouse || PURCHASE_ORDER_STAGE[upper(po?.status)] || PURCHASE_STAGE.ORDERING_SUPPLIER;

      partStages.push(stage);
      if (fromWarehouse && WAREHOUSE_ORDER_HINT[warehouseStatus]) hints.push(WAREHOUSE_ORDER_HINT[warehouseStatus]);
      else if (upper(po?.status) === "SUPPLIER_SHIPPED") hints.push("NCC đã phát hàng, chờ kho nước ngoài nhận");
    });

    /* Còn dòng hàng chưa đưa vào đơn mua nào → phần đó vẫn đang ở bước đặt NCC. */
    if (Number(request?.openLineCount) > 0) {
      partStages.push(PURCHASE_STAGE.ORDERING_SUPPLIER);
      hints.push("Còn sản phẩm chưa lập đơn mua NCC");
    }
  } else if (warehouseOrders.length > 0) {
    /* Đời cũ: không có đơn mua NCC, một đơn kho mang đúng mã yêu cầu. */
    warehouseOrders.forEach((order) => {
      if (CLOSED_WAREHOUSE_ORDER.has(order.status)) return;
      const fromWarehouse = WAREHOUSE_ORDER_STAGE[order.status];
      const floor = REQUEST_STATUS_STAGE[status] || PURCHASE_STAGE.PREPAID;
      /* Đơn kho chưa nhận hàng thì lấy mốc của yêu cầu; COMPLETED đời cũ = đã tất toán ở kho nguồn. */
      const stage = fromWarehouse || (status === "COMPLETED" ? PURCHASE_STAGE.IN_TRANSIT : floor);
      partStages.push(
        STAGE_RANK[stage] >= STAGE_RANK[floor] || status === "COMPLETED" ? stage : floor
      );
      if (WAREHOUSE_ORDER_HINT[order.status]) hints.push(WAREHOUSE_ORDER_HINT[order.status]);
    });
    if (status === "COMPLETED" && !partStages.every((stage) => stage === PURCHASE_STAGE.COMPLETED)) {
      hints.unshift("Đơn đời cũ: đã thanh toán đợt cuối nhưng hàng chưa giao xong");
    }
  }

  if (partStages.length === 0) {
    if (status === "COMPLETED") {
      /* Không có dòng nào để đối chiếu: không được tự nhận là hoàn tất. */
      if (activeOrders.length === 0 && purchaseOrders.length > 0) {
        return result(
          refundPending ? PURCHASE_STAGE.AWAITING_REFUND : PURCHASE_STAGE.COMPLETED,
          refundPending ? "Mọi đơn mua NCC đã huỷ, còn khoản hoàn chờ chuyển" : "Mọi đơn mua NCC đã huỷ và đóng",
          { milestones }
        );
      }
      return result(PURCHASE_STAGE.UNVERIFIED, "Yêu cầu đã đóng nhưng chưa tải được đơn mua / đơn kho để đối chiếu", {
        milestones,
      });
    }

    const stage = REQUEST_STATUS_STAGE[status];
    if (!stage) return result(PURCHASE_STAGE.UNVERIFIED, "", { milestones });

    /* PAID mà đã có đơn mua NCC (kể cả đã huỷ hết) thì vẫn là bước đặt NCC. */
    if (stage === PURCHASE_STAGE.PREPAID && Number(request?.activePurchaseOrderCount) > 0) {
      return result(PURCHASE_STAGE.ORDERING_SUPPLIER, "", { milestones });
    }
    return result(stage, "", { milestones });
  }

  let stage = slowest(partStages);

  if (stage === PURCHASE_STAGE.COMPLETED && refundPending) {
    stage = PURCHASE_STAGE.AWAITING_REFUND;
    hints.unshift("Hàng đã giao xong, còn khoản hoàn chờ chuyển cho khách");
  }

  /* Backend chưa chốt yêu cầu (vd còn dòng chưa đóng phần không mua được) → chưa gọi là hoàn tất. */
  if (stage === PURCHASE_STAGE.COMPLETED && status !== "COMPLETED") {
    stage = PURCHASE_STAGE.DELIVERED;
    hints.unshift("Các đơn kho đã đóng nhưng yêu cầu chưa được hệ thống chốt hoàn tất");
  }

  return result(stage, [...new Set(hints)].join(" · "), { milestones });
};

/** Chặng có khớp ô lọc không. `ALL`/rỗng = mọi chặng. */
export const matchesPurchaseStage = (derived, filterStage) => {
  const wanted = upper(filterStage);
  if (!wanted || wanted === "ALL") return true;
  return upper(derived?.stage) === wanted;
};
