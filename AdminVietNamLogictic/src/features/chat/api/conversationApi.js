/* =========================================================
   conversationApi.js — CHAT CSKH phía NHÂN VIÊN (Sale). ĐÃ NỐI API THẬT.

   Trước đây file này là mock đọc "@/mocks/data/conversations" nên Sale không thấy tin
   khách gửi thật; bản mock giữ nguyên ở conversationApi.mock.js (không màn nào import).

   Endpoint thật (VCL_API ConversationController, [Authorize]) — cùng bộ với web khách:
     GET  /api/conversations                 Sale/Admin: hội thoại CHƯA AI NHẬN + hội thoại
                                             của chính mình (ConversationService lọc
                                             SalesId == null || SalesId == userId),
                                             mới cập nhật trước. KHÔNG kèm messages.
     GET  /api/conversations/{id}            chi tiết kèm messages[] (hội thoại đã giao
                                             cho Sale khác → 403 { message })
     POST /api/conversations/{id}/messages   body { content (1..2000), attachmentUrl? (≤ 500) }
                                             → MessageDto. Sale trả lời hội thoại chưa ai
                                             nhận thì backend TỰ GÁN hội thoại cho Sale đó
                                             (không có API nhận/giao/đóng/mở riêng).
     PUT  /api/conversations/{id}/read       đánh dấu đã đọc tin của KHÁCH → { message }
     POST /api/conversations                 CHỈ role Customer ([Authorize(Roles="Customer")]):
                                             nhân viên gọi sẽ nhận 403 body rỗng.

   ConversationDto: { id, customerId, customerName, customerCode, salesId, salesName,
     relatedType, relatedId, relatedCode, status ("OPEN" | "CLOSED"), createdAt, updatedAt,
     unreadCount (tin KHÁCH chưa đọc, tính theo người xem), messages[] }.
   MessageDto: { id, conversationId, senderId, senderRole ("Customer" | "Sale"), content,
     attachmentUrl, isRead, createdAt }.

   Realtime: backend có SignalR hub /hubs/chat (ReceiveMessage / NewConversationCreated),
   nhưng cả ba app chưa dùng @microsoft/signalr — màn chat nhân viên POLL như web khách
   (chi tiết 2,5 giây, danh sách 10 giây, bỏ nhịp khi tab ẩn).

   GIỮ NGUYÊN BỀ MẶT của bản mock (5 hàm, cùng tham số, trả phần thân đã bóc — không phải
   response axios; danh sách là MẢNG TRẦN, chi tiết là object có `messages`, không có khoá
   `data`/`conversation` ở cấp ngoài) để CustomerServiceChat.jsx đọc như cũ.

   Chuẩn hoá thêm cho màn chat (backend không có các field này):
   - staffName = salesName; tiêu đề hội thoại để trống → màn hiện customerName;
   - lastMessage / lastMessageAt cho hộp thư bên trái (danh sách không kèm tin nên tóm tắt
     theo tình trạng: số tin mới của khách, chờ tiếp nhận, đã đóng...);
   - senderName: tin khách = customerName, tin Sale phụ trách = salesName;
   - relatedCode là MÃ ĐƠN THẬT backend tra từ bảng Order / PurchaseRequest
     (ConsignmentCode / PurchaseCode) — không bao giờ thay bằng GUID relatedId;
   - backend bắt buộc content ≥ 1 ký tự kể cả tin chỉ có ảnh: gửi câu
     "Đã gửi một hình ảnh" (cùng quy ước web khách), khi đọc về thì ẩn câu đó nếu tin
     có ảnh để bong bóng chỉ hiện ảnh.
   - 400 ModelState (ValidationProblemDetails) → gắn data.message = câu lỗi đầu tiên;
     403 body rỗng (sai role) → câu tiếng Việt.
   ========================================================= */

import httpClient from "@shared/api/httpClient";

const VALID_RELATED_TYPES = ["CONSIGNMENT", "PURCHASE_REQUEST", "QUOTATION"];

const MAX_CONTENT_LENGTH = 2000;
const MAX_ATTACHMENT_URL_LENGTH = 500;

/* Nội dung thay thế cho tin chỉ có ảnh — trùng câu web khách đang gửi. */
const IMAGE_ONLY_MESSAGE_CONTENT = "Đã gửi một hình ảnh";

const CREATE_FORBIDDEN_MESSAGE =
  "Chỉ khách hàng mới tạo được cuộc trò chuyện. Nhân viên trả lời trong hội thoại khách đã mở.";

const FORBIDDEN_MESSAGE =
  "Tài khoản của bạn không có quyền dùng chức năng chăm sóc khách hàng.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getSignal = (options = {}) => {
  if (options && typeof options.addEventListener === "function") {
    return options;
  }

  return options?.signal;
};

const normalizeText = (value) => String(value ?? "").trim();

const normalizeNullableText = (value) => {
  const text = normalizeText(value);
  return text || null;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

/** Lỗi dựng tại chỗ mang cùng hình dạng lỗi axios để màn đọc error.response.data.message. */
const createApiError = (status, message) => {
  const error = new Error(message);

  error.response = { status, data: { message } };

  return error;
};

const requireConversationId = (conversationId) => {
  const id = normalizeText(conversationId);

  if (!id) {
    throw new Error("Không tìm thấy mã cuộc trò chuyện.");
  }

  /* Backend route {conversationId} là Guid: chuỗi khác sẽ bị 400 ModelState khó hiểu. */
  if (!UUID_PATTERN.test(id)) {
    throw createApiError(404, "Không tìm thấy cuộc trò chuyện.");
  }

  return id;
};

/**
 * - 400 ModelState của ASP.NET trả { title, errors: { Field: [msg] } } (hoặc dictionary
 *   trần): không có `message` nên màn chỉ hiện "One or more validation errors occurred.".
 *   Gắn câu lỗi đầu tiên vào data.message.
 * - 403 body rỗng ([Authorize(Roles)] từ chối) → câu tiếng Việt.
 * Giữ nguyên phần còn lại của lỗi axios.
 */
const attachErrorMessage = (error, forbiddenMessage = FORBIDDEN_MESSAGE) => {
  const response = error?.response;

  if (!response) {
    return error;
  }

  const data = response.data;

  if (
    response.status === 403 &&
    (data === undefined || data === null || data === "" ||
      (typeof data === "object" && !normalizeText(data.message)))
  ) {
    response.data = {
      ...(data && typeof data === "object" ? data : {}),
      message: forbiddenMessage,
    };

    return error;
  }

  if (!data || typeof data !== "object" || typeof data.message === "string") {
    return error;
  }

  const errorSource =
    data.errors && typeof data.errors === "object" ? data.errors : data;

  const firstMessage = Object.values(errorSource)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .find((value) => typeof value === "string" && value.trim());

  if (firstMessage) {
    data.message = firstMessage;
  }

  return error;
};

/* =========================================================
   VALIDATE + PAYLOAD (khớp DataAnnotations của DTO backend)
   ========================================================= */

const validateContentLength = (text) => {
  if (text.length > MAX_CONTENT_LENGTH) {
    throw new Error(
      `Nội dung tin nhắn không được vượt quá ${MAX_CONTENT_LENGTH} ký tự.`
    );
  }
};

const validateAttachmentUrl = (attachmentUrl) => {
  if (attachmentUrl && attachmentUrl.length > MAX_ATTACHMENT_URL_LENGTH) {
    throw new Error("Đường dẫn ảnh đính kèm quá dài (tối đa 500 ký tự).");
  }
};

const validateConversationPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Dữ liệu tạo cuộc trò chuyện không hợp lệ.");
  }

  const relatedType = normalizeText(payload.relatedType).toUpperCase();

  if (relatedType && !VALID_RELATED_TYPES.includes(relatedType)) {
    throw new Error(
      "Loại liên kết chỉ nhận: CONSIGNMENT, PURCHASE_REQUEST, QUOTATION."
    );
  }

  const message = normalizeText(payload.message);

  if (!message) {
    throw new Error("Vui lòng nhập nội dung tin nhắn.");
  }

  validateContentLength(message);
  validateAttachmentUrl(normalizeText(payload.attachmentUrl));

  const relatedId = normalizeText(payload.relatedId);

  if (relatedType && !relatedId) {
    throw new Error("Vui lòng cung cấp mã liên kết.");
  }

  if (relatedId && !UUID_PATTERN.test(relatedId)) {
    throw new Error("Mã liên kết không hợp lệ, vui lòng chọn lại từ danh sách.");
  }
};

const buildConversationPayload = (payload) => {
  const relatedType = normalizeText(payload.relatedType).toUpperCase() || null;

  return {
    relatedType,
    relatedId: relatedType ? normalizeNullableText(payload.relatedId) : null,
    message: normalizeText(payload.message),
    attachmentUrl: normalizeNullableText(payload.attachmentUrl),
  };
};

const validateSendMessagePayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Dữ liệu gửi tin nhắn không hợp lệ.");
  }

  const content = normalizeText(payload.content);
  const attachmentUrl = normalizeText(payload.attachmentUrl);

  if (!content && !attachmentUrl) {
    throw new Error("Vui lòng nhập nội dung hoặc đính kèm tệp.");
  }

  validateContentLength(content);
  validateAttachmentUrl(attachmentUrl);
};

/* Chỉ hai field của CreateMessageRequestDto — bỏ sentAtUtc/clientTimeZone... màn gửi kèm. */
const buildSendMessagePayload = (payload) => {
  const attachmentUrl = normalizeNullableText(payload.attachmentUrl);

  return {
    content:
      normalizeText(payload.content) ||
      (attachmentUrl ? IMAGE_ONLY_MESSAGE_CONTENT : ""),
    attachmentUrl,
  };
};

/* =========================================================
   CHUẨN HOÁ RESPONSE CHO MÀN CHAT NHÂN VIÊN
   ========================================================= */

const isCustomerMessage = (message) =>
  normalizeText(message?.senderRole).toUpperCase() === "CUSTOMER";

/** Danh sách không kèm tin nhắn nên tóm tắt theo tình trạng thay cho "tin cuối". */
const buildListSummary = (conversation) => {
  const unreadCount = Number(conversation?.unreadCount) || 0;

  if (unreadCount > 0) {
    return `${unreadCount} tin nhắn mới từ khách hàng`;
  }

  if (normalizeText(conversation?.status).toUpperCase() === "CLOSED") {
    return "Cuộc trò chuyện đã đóng";
  }

  return conversation?.salesId
    ? "Đang trao đổi với khách hàng"
    : "Khách đang chờ nhân viên tiếp nhận";
};

const normalizeMessage = (message, conversation) => {
  if (!message || typeof message !== "object") {
    return message;
  }

  const attachmentUrl = normalizeNullableText(message.attachmentUrl);
  const content = normalizeText(message.content);

  let senderName = message.senderName;

  if (!senderName && conversation) {
    if (isCustomerMessage(message)) {
      senderName = normalizeNullableText(conversation.customerName) || undefined;
    } else if (
      conversation.salesId &&
      String(message.senderId) === String(conversation.salesId)
    ) {
      senderName = normalizeNullableText(conversation.salesName) || undefined;
    }
  }

  return {
    ...message,
    messageId: message.messageId ?? message.id,
    attachmentUrl,
    /* Câu thay thế của tin chỉ có ảnh: ẩn đi để bong bóng chỉ hiện ảnh. */
    content:
      attachmentUrl && content === IMAGE_ONLY_MESSAGE_CONTENT ? "" : message.content,
    ...(senderName ? { senderName } : {}),
  };
};

const summarizeMessage = (message) =>
  normalizeText(message?.content) ||
  (message?.attachmentUrl ? IMAGE_ONLY_MESSAGE_CONTENT : "");

const normalizeConversation = (conversation) => {
  if (!conversation || typeof conversation !== "object") {
    return conversation;
  }

  const messages = toArray(conversation.messages).map((message) =>
    normalizeMessage(message, conversation)
  );
  const lastMessage = messages[messages.length - 1] || null;
  const lastMessageAt =
    lastMessage?.createdAt || conversation.updatedAt || conversation.createdAt;
  const summary = lastMessage
    ? summarizeMessage(lastMessage)
    : buildListSummary(conversation);
  const staffName = normalizeNullableText(conversation.salesName);

  return {
    ...conversation,
    conversationId: conversation.conversationId ?? conversation.id,
    staffId: conversation.salesId ?? null,
    staffName,
    staffRole: staffName ? "Nhân viên tư vấn" : null,
    /* Mã đơn thật (ConsignmentCode / PurchaseCode); null khi hội thoại chung. */
    relatedCode: normalizeNullableText(conversation.relatedCode),
    lastMessage: summary,
    latestMessage: summary,
    lastMessageAt,
    latestMessageAt: lastMessageAt,
    unreadCount: Number(conversation.unreadCount) || 0,
    messages,
  };
};

/** Danh sách không có messages ở backend — bỏ luôn khoá để khỏi hiểu nhầm là rỗng. */
const toListItem = (conversation) => {
  const item = normalizeConversation(conversation);

  if (item && typeof item === "object") {
    delete item.messages;
  }

  return item;
};

/* =========================================================
   API
   ========================================================= */

/**
 * Tạo cuộc trò chuyện.
 *
 * POST /api/conversations — backend CHỈ cho role Customer. Màn nhân viên ẩn nút tạo với
 * Sale; nếu vẫn gọi (vai trò khác) thì 403 rỗng được đổi thành câu tiếng Việt rõ ràng.
 */
export const createConversationApi = async (payload, options = {}) => {
  validateConversationPayload(payload);

  try {
    const response = await httpClient.post(
      "/api/conversations",
      buildConversationPayload(payload),
      { signal: getSignal(options) }
    );

    /* Nơi gọi đọc data?.id để mở hội thoại vừa tạo. */
    return normalizeConversation(response.data);
  } catch (error) {
    throw attachErrorMessage(error, CREATE_FORBIDDEN_MESSAGE);
  }
};

/**
 * Hộp thư của nhân viên: hội thoại chưa ai nhận + hội thoại mình phụ trách.
 *
 * GET /api/conversations
 */
export const getConversationsApi = async (options = {}) => {
  try {
    const response = await httpClient.get("/api/conversations", {
      signal: getSignal(options),
    });

    const body = response.data;
    const list = Array.isArray(body) ? body : toArray(body?.data ?? body?.items);

    return list.map(toListItem);
  } catch (error) {
    throw attachErrorMessage(error);
  }
};

/**
 * Chi tiết cuộc trò chuyện kèm tin nhắn.
 *
 * GET /api/conversations/{conversationId}
 */
export const getConversationDetailApi = async (conversationId, options = {}) => {
  const id = requireConversationId(conversationId);

  try {
    const response = await httpClient.get(
      `/api/conversations/${encodeURIComponent(id)}`,
      { signal: getSignal(options) }
    );

    return normalizeConversation(response.data);
  } catch (error) {
    throw attachErrorMessage(error);
  }
};

/**
 * Nhân viên trả lời khách. Hội thoại chưa ai nhận sẽ được backend gán cho người trả lời.
 *
 * POST /api/conversations/{conversationId}/messages
 */
export const sendConversationMessageApi = async (
  conversationId,
  payload,
  options = {}
) => {
  const id = requireConversationId(conversationId);

  validateSendMessagePayload(payload);

  try {
    const response = await httpClient.post(
      `/api/conversations/${encodeURIComponent(id)}/messages`,
      buildSendMessagePayload(payload),
      { signal: getSignal(options) }
    );

    return normalizeMessage(response.data, null);
  } catch (error) {
    throw attachErrorMessage(error);
  }
};

/**
 * Đánh dấu đã đọc tin nhắn của KHÁCH trong cuộc trò chuyện (xoá unreadCount phía Sale).
 *
 * PUT /api/conversations/{conversationId}/read
 */
export const markConversationAsReadApi = async (conversationId, options = {}) => {
  const id = requireConversationId(conversationId);

  try {
    const response = await httpClient.put(
      `/api/conversations/${encodeURIComponent(id)}/read`,
      undefined,
      { signal: getSignal(options) }
    );

    return {
      success: true,
      conversationId: id,
      isRead: true,
      unreadCount: 0,
      message: response.data?.message || "Đã đánh dấu đọc tin nhắn.",
    };
  } catch (error) {
    throw attachErrorMessage(error);
  }
};

const conversationApi = {
  createConversationApi,
  getConversationsApi,
  getConversationDetailApi,
  sendConversationMessageApi,
  markConversationAsReadApi,
};

export default conversationApi;
