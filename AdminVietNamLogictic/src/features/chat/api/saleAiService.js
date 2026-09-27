/**
 * Trợ lý AI của Sales — API THẬT: POST /api/ai/sales/order-status-query (AiController, [Authorize],
 * vai trò ADMIN/SALE/OPERATIONSMANAGER...).
 *
 * Body SalesOrderStatusQueryRequest { message (bắt buộc), orderCode?, customerId?: Guid,
 * relatedType?: CONSIGNMENT|PURCHASE|PARCEL|CUSTOMER, relatedId?: Guid } → response TRẦN
 * SalesOrderStatusQueryResponse { answer, relatedOrders[], relatedParcels[], currentStatus,
 * paymentStatus, warehouseStatus, shipmentStatus, nextActionSuggestion, dataSources[], warning }.
 * 404 { message } khi không tìm thấy đơn/kiện/khách · 400 { message } / ModelState · 403 { message }
 * · 500 { message, error }. Backend tra cứu theo QUY TẮC trên DB thật (không gọi mô hình ngôn ngữ
 * ngoài), nên không có trạng thái "thiếu cấu hình AI"; lỗi nào cũng hiện đúng câu backend qua
 * getSalesAiError — KHÔNG bao giờ tự dựng câu trả lời.
 *
 * customerId / relatedId là Guid ở backend: giá trị không phải GUID bị bỏ (không để model binder
 * trả 400 khó đọc); relatedId không phải GUID nhưng trông như mã đơn thì chuyển sang orderCode.
 *
 * Các hàm thuần (mapStatusLabel, normalizeSalesOrderStatusResponse, buildCustomerReply,
 * buildWarnings, getSalesAiError) giữ nguyên. Bản mock cũ (hồ sơ AI giả) ở saleAiService.mock.js.
 */
import httpClient from "@shared/api/httpClient";
import {
  getOrderStatusLabel,
  LEGACY_ORDER_STATUS_MAP,
  ORDER_STATUS_LABELS,
} from "@features/consignment";

/*
 * Nhãn trạng thái ĐƠN (19 mã đích + mã cũ) lấy từ module dùng chung của feature
 * consignment. Bảng dưới chỉ còn các mã KHÔNG phải trạng thái đơn mà hồ sơ AI trả về
 * cho kho / lô / kiện, và được tra TRƯỚC mã cũ của đơn (RECEIVED ở đây là "đã nhận kiện").
 */
const NON_ORDER_STATUS_LABELS = {
  CANCELED: "Đã hủy",
  RECEIVED: "Đã nhận kiện",
  RELEASE_PENDING: "Chờ xuất kho",
  RELEASED: "Đã xuất kho",
  NOT_ASSIGNED: "Chưa ghép lô vận chuyển quốc tế",
};

const lookupStatusLabel = (code) => {
  if (ORDER_STATUS_LABELS[code]) return ORDER_STATUS_LABELS[code];
  if (NON_ORDER_STATUS_LABELS[code]) return NON_ORDER_STATUS_LABELS[code];
  if (LEGACY_ORDER_STATUS_MAP[code] || code.startsWith("CUSTOMS_")) {
    return getOrderStatusLabel(code);
  }
  return "";
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
  const statusLabel = lookupStatusLabel(code);
  if (statusLabel) return statusLabel;

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

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toGuidOrNull = (value) => {
  const text = trimOrNull(value);
  return text && GUID_PATTERN.test(text) ? text : null;
};

const RELATED_TYPES = new Set(["CONSIGNMENT", "PURCHASE", "PARCEL", "CUSTOMER"]);

export const SALES_AI_ENDPOINT = "/api/ai/sales/order-status-query";

export const buildSalesAiPayload = ({
  message,
  orderCode,
  customerId,
  relatedType,
  relatedId,
} = {}) => {
  const payload = { message: String(message ?? "").trim() };
  const relatedGuid = toGuidOrNull(relatedId);
  const rawRelated = trimOrNull(relatedId);
  const type = String(relatedType ?? "").trim().toUpperCase();

  const optionalFields = {
    orderCode: trimOrNull(orderCode) || (!relatedGuid && rawRelated) || null,
    customerId: toGuidOrNull(customerId),
    relatedType: relatedGuid && RELATED_TYPES.has(type) ? type : null,
    relatedId: relatedGuid && RELATED_TYPES.has(type) ? relatedGuid : null,
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

/**
 * Hỏi AI về trạng thái đơn (API thật). Trả kết quả ĐÃ chuẩn hoá (panel đọc data.labels.*).
 * options.signal chuyển xuống axios: đổi đơn liên tục thì request cũ bị huỷ (CanceledError).
 */
export const querySalesOrderStatus = async (payload, options = {}) => {
  const body = buildSalesAiPayload(payload);

  if (!body.message) {
    throw new Error("Nội dung câu hỏi không được để trống.");
  }

  const response = await httpClient.post(SALES_AI_ENDPOINT, body, {
    signal: options?.signal,
  });

  return normalizeSalesOrderStatusResponse(response);
};

const saleAiService = {
  querySalesOrderStatus,
  mapStatusLabel,
  buildCustomerReply,
  buildWarnings,
};

export default saleAiService;
