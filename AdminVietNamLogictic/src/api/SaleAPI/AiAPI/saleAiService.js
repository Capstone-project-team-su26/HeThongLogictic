import axiosInstance from "../../axiosInstance";

const AI_ENDPOINT = "/api/ai/sales/order-status-query";

const STATUS_LABELS = {
  CHECKED_IN: "Đã nhập kho",
  PENDING: "Đang chờ xử lý",
  PENDING_REVIEW: "Chờ duyệt",
  ACCEPTED: "Đã chấp nhận",
  APPROVED: "Đã phê duyệt",
  COMPLETED: "Đã hoàn tất",
  RECEIVED: "Đã nhận kiện",
  IN_TRANSIT: "Đang vận chuyển",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  REJECTED: "Đã từ chối",
  RELEASE_PENDING: "Chờ xuất kho",
  RELEASED: "Đã xuất kho",
  QUOTATION_SENT: "Đã gửi báo giá",
  WAITING_DEPOSIT: "Chờ đặt cọc",
  DEPOSIT_PAID: "Đã đặt cọc",
  NOT_ASSIGNED: "Chưa ghép lô vận chuyển quốc tế",
};

const PAYMENT_LABELS = {
  PENDING: "Chưa thanh toán",
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  SUCCESS: "Đã thanh toán",
  FAILED: "Thanh toán thất bại",
  CANCELED: "Đã hủy thanh toán",
  CANCELLED: "Đã hủy thanh toán",
};

const trimOrNull = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const extractStatusCode = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const paren = text.match(/\(([A-Z0-9_]+)\)\s*$/);
  if (paren?.[1]) return paren[1];

  const tokens = text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g);
  if (tokens?.length) return tokens[tokens.length - 1];

  return text.toUpperCase().replace(/\s+/g, "_");
};

export const mapStatusLabel = (value, kind = "order") => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const code = extractStatusCode(text);
  if (kind === "payment" && PAYMENT_LABELS[code]) {
    return PAYMENT_LABELS[code];
  }
  if (STATUS_LABELS[code]) return STATUS_LABELS[code];

  if (/chưa thanh toán/i.test(text)) return "Chưa thanh toán";
  if (/đã thanh toán/i.test(text)) return "Đã thanh toán";
  if (/chưa ghép/i.test(text)) return "Chưa ghép lô vận chuyển quốc tế";
  if (/đã nhập kho|checked.?in/i.test(text)) return "Đã nhập kho";

  if (/^[A-Z0-9_\- :()]+$/.test(text) && /[A-Z]{3,}/.test(text)) {
    return text
      .replace(/[_-]+/g, " ")
      .toLowerCase()
      .replace(/^./, (char) => char.toUpperCase());
  }

  return text;
};

const buildPayload = ({
  message,
  orderCode,
  customerId,
  relatedType,
  relatedId,
} = {}) => {
  const payload = { message: String(message ?? "").trim() };
  const optionalFields = {
    orderCode: trimOrNull(orderCode),
    customerId: trimOrNull(customerId),
    relatedType: trimOrNull(relatedType),
    relatedId: trimOrNull(relatedId),
  };

  for (const [key, value] of Object.entries(optionalFields)) {
    if (value) payload[key] = value;
  }

  return payload;
};

export const normalizeSalesOrderStatusResponse = (response) => {
  const data = response?.data?.data ?? response?.data ?? {};
  const relatedOrders = toArray(data?.relatedOrders);
  const relatedParcels = toArray(data?.relatedParcels);
  const currentStatus = data?.currentStatus || "";
  const paymentStatus = data?.paymentStatus || "";
  const warehouseStatus = data?.warehouseStatus || "";
  const shipmentStatus = data?.shipmentStatus || "";

  return {
    answer: data?.answer || "",
    relatedOrders,
    relatedParcels,
    currentStatus,
    paymentStatus,
    warehouseStatus,
    shipmentStatus,
    nextActionSuggestion: data?.nextActionSuggestion || "",
    dataSources: toArray(data?.dataSources),
    warning: data?.warning || null,
    labels: {
      currentStatus: mapStatusLabel(currentStatus, "order"),
      paymentStatus: mapStatusLabel(paymentStatus, "payment"),
      warehouseStatus: mapStatusLabel(warehouseStatus, "order"),
      shipmentStatus: mapStatusLabel(shipmentStatus, "order"),
    },
  };
};

export const buildCustomerReply = ({
  orderCode,
  result,
  tone = "default",
} = {}) => {
  if (!result) return "";

  const code = trimOrNull(orderCode) || result.relatedOrders?.[0]?.orderCode || "của anh/chị";
  const status = result.labels?.currentStatus || mapStatusLabel(result.currentStatus);
  const payment = result.labels?.paymentStatus || mapStatusLabel(result.paymentStatus, "payment");
  const shipment = result.labels?.shipmentStatus || mapStatusLabel(result.shipmentStatus);
  const warehouse = result.labels?.warehouseStatus || mapStatusLabel(result.warehouseStatus);

  const parts = [];
  if (status) {
    parts.push(`đơn hàng ${code} hiện ${status.toLowerCase()}`);
  } else {
    parts.push(`đơn hàng ${code}`);
  }

  const issues = [];
  if (payment && /chưa|pending|unpaid/i.test(`${payment} ${result.paymentStatus}`)) {
    issues.push("đơn vẫn đang chờ xác nhận thanh toán");
  }
  if (shipment && /chưa ghép|not_assigned|chưa được ghép/i.test(`${shipment} ${result.shipmentStatus}`)) {
    issues.push("chưa được ghép vào chuyến vận chuyển quốc tế");
  }
  if (warehouse && /chờ xuất|release_pending/i.test(`${warehouse} ${result.warehouseStatus}`)) {
    issues.push("yêu cầu xuất kho đang chờ xử lý");
  }

  let reply = `Dạ em kiểm tra thấy ${parts.join(", ")}.`;
  if (issues.length) {
    reply += ` Tuy nhiên ${issues.join(" và ")}.`;
  } else if (warehouse) {
    reply += ` Phía kho: ${warehouse.toLowerCase()}.`;
  }

  if (issues.some((item) => /thanh toán/i.test(item))) {
    reply +=
      " Sau khi thanh toán được xác nhận, bên em sẽ tiếp tục xử lý và cập nhật trạng thái vận chuyển cho anh/chị ạ.";
  } else {
    reply += " Bên em sẽ tiếp tục theo dõi và cập nhật sớm nhất cho anh/chị ạ.";
  }

  if (tone === "short") {
    reply = `Dạ đơn ${code} hiện ${status ? status.toLowerCase() : "đang được xử lý"}.`;
    if (issues.length) {
      reply += ` Hiện còn ${issues[0]}.`;
    }
    reply += " Em sẽ cập nhật tiếp cho anh/chị ạ.";
  }

  if (tone === "friendly") {
    reply = reply
      .replaceAll("anh/chị", "anh/chị")
      .replace(
        "Bên em sẽ tiếp tục theo dõi và cập nhật sớm nhất cho anh/chị ạ.",
        "Anh/chị yên tâm, bên em theo dõi sát và sẽ báo lại ngay khi có cập nhật mới ạ."
      );
  }

  return reply;
};

export const buildWarnings = (result) => {
  if (!result) return [];
  const warnings = [];

  if (result.warning) warnings.push(String(result.warning));

  const payment = `${result.paymentStatus || ""} ${result.labels?.paymentStatus || ""}`;
  const shipment = `${result.shipmentStatus || ""} ${result.labels?.shipmentStatus || ""}`;

  if (/chưa thanh toán|pending|unpaid/i.test(payment)) {
    warnings.push("Đơn đang chờ thanh toán trước khi ghép lô vận chuyển quốc tế.");
  } else if (/chưa ghép|not_assigned/i.test(shipment)) {
    warnings.push("Đơn chưa được ghép vào chuyến vận chuyển quốc tế.");
  }

  if (result.nextActionSuggestion) {
    const suggestion = String(result.nextActionSuggestion).trim();
    if (
      suggestion &&
      !/kiểm tra chi tiết|lịch sử xử lý/i.test(suggestion) &&
      !warnings.includes(suggestion)
    ) {
      warnings.push(suggestion);
    }
  }

  return [...new Set(warnings)];
};

export const getSalesAiError = (error) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.title === "string" && data.title.trim()) return data.title;

  const validationMessages = data?.errors
    ? Object.values(data.errors).flat().filter(Boolean)
    : [];
  return validationMessages.join(" ") || error?.message || "Không thể hỏi AI.";
};

export const querySalesOrderStatus = async (payload, options = {}) => {
  const response = await axiosInstance.post(
    AI_ENDPOINT,
    buildPayload(payload),
    { signal: options.signal }
  );
  return normalizeSalesOrderStatusResponse(response);
};

const saleAiService = {
  querySalesOrderStatus,
  mapStatusLabel,
  buildCustomerReply,
  buildWarnings,
};

export default saleAiService;
