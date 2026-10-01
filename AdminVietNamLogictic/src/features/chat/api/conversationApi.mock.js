/* =========================================================
   ⚠ BẢN SAO MOCK — KHÔNG NỐI API THẬT VÀO FILE NÀY.

   Bản sao NGUYÊN VĂN conversationApi.js lúc còn là mock (chụp trước khi file đó nối
   API thật /api/conversations, 26/09/2026). Không màn nào import file này; giữ lại để
   tools/verify-mocks.mjs soát hợp đồng export và để demo UI-only nếu cần. Đừng làm theo
   hướng dẫn "CẮM API THẬT TRỞ LẠI" bên dưới — API thật chỉ nằm ở conversationApi.js.
   ========================================================= */

/**
 * MOCK hội thoại chăm sóc khách hàng — bản chỉ-giao-diện.
 *
 * Tầng HTTP đã bị gỡ: không axiosInstance, không URL thật. Dữ liệu lấy từ bộ mẫu
 * `conversations` trong @/mocks/data/conversations và được trả về đúng hình dạng
 * mà CustomerServiceChat.jsx đang bóc, nên component không phải sửa một dòng nào.
 *
 * Hai điểm phải giữ nguyên, vì sai là màn chi tiết trắng chứ không phải lỗi build:
 *   - getConversationsApi trả MẢNG TRẦN (normalizeConversationList kiểm Array.isArray
 *     trước tiên), còn getConversationDetailApi trả OBJECT hội thoại có mảng `messages`.
 *   - Giá trị trả về không được có khoá `data` hay `conversation` ở cấp ngoài cùng:
 *     unwrapApiData() lấy `response.data ?? response` và normalizeConversationDetail()
 *     lấy `data.conversation || data`, thêm hai khoá đó là component bóc lệch một tầng.
 *
 * Toàn bộ phần kiểm tra dữ liệu đầu vào (độ dài nội dung, loại liên kết, bắt buộc có
 * mã liên kết) được giữ y bản thật để các toast lỗi trên modal vẫn hiện đúng câu.
 *
 * CẮM API THẬT TRỞ LẠI: mỗi hàm có một khối "// [API THẬT]" ghi endpoint cũ. Thay phần
 * đọc/ghi `conversationStore` bằng lời gọi axiosInstance tương ứng rồi trả `response.data`
 * là xong; phần validate và buildPayload phía trên dùng lại được nguyên vẹn.
 */

import {
  conversations as conversationFixtures,
  SALE_STAFF,
} from "@/mocks/data/conversations";
import {
  createApiError,
  deepClone,
  delay,
  nowIso,
} from "@/mocks/mockUtils";

/* =========================================================
   SINH ID CHO BẢN GHI TẠO LÚC CHẠY
========================================================= */

/*
 * KHÔNG dùng nextUuid() của mockUtils ở đây.
 *
 * Bộ sinh đó chỉ cho ra 16 giá trị rồi lặp lại (mọi chữ số đều là
 * (5*(seed + 15*i + counter) + 1) % 16, nên counter chỉ đổi kết quả theo mod 16).
 * Mỗi tin nhắn gửi đi tiêu 1 id, nên tin thứ 9 trong một hội thoại đã trùng id với
 * tin thứ nhất — khung chat render bằng key={message.id} nên React nhận hai phần tử
 * cùng key, và ô "đã sao chép" sáng lên ở hai bong bóng cùng lúc.
 *
 * Bộ đếm dưới đây tăng đơn điệu nên id không bao giờ lặp trong một phiên, vẫn hợp
 * khuôn UUID (8-4-4-4-12, version 4, variant 8-b) để mọi chỗ kiểm khuôn vẫn qua.
 * Nhóm thứ hai để "9000" — fixture dùng "100X" — nên id tạo lúc chạy không thể
 * trùng với id có sẵn trong @/mocks/data/conversations.
 */
const RUNTIME_ID_PREFIX = Object.freeze({
  conversation: "7d2e4f10-9000",
  message: "6a9b3c80-9000",
});

let runtimeIdSequence = 0;

const nextRuntimeId = (kind) => {
  runtimeIdSequence += 1;

  /* Chữ số thập phân cũng là chữ số hex hợp lệ, nên pad thẳng số đếm là đủ. */
  const tail = String(runtimeIdSequence).padStart(12, "0");

  return `${RUNTIME_ID_PREFIX[kind]}-4b8c-9d31-${tail}`;
};

const VALID_RELATED_TYPES = [
  "CONSIGNMENT",
  "PURCHASE_REQUEST",
  "QUOTATION",
];

const getSignal = (options = {}) => {
  return options?.signal;
};

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeNullableText = (value) => {
  const text = normalizeText(value);
  return text || null;
};

const normalizeRelatedType = (value) => {
  return normalizeText(value).toUpperCase();
};

const validateRelatedType = (relatedType) => {
  const type = normalizeRelatedType(relatedType);

  if (!type) {
    return;
  }

  if (!VALID_RELATED_TYPES.includes(type)) {
    throw new Error(
      "Chỉ liên kết được với đơn ký gửi, yêu cầu mua hộ hoặc báo giá."
    );
  }
};

const validateConversationPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Dữ liệu tạo cuộc trò chuyện không hợp lệ.");
  }

  validateRelatedType(payload.relatedType);

  if (!normalizeText(payload.message)) {
    throw new Error("Vui lòng nhập nội dung tin nhắn.");
  }

  if (normalizeText(payload.message).length > 2000) {
    throw new Error("Nội dung tin nhắn không được vượt quá 2000 ký tự.");
  }

  if (normalizeText(payload.attachmentUrl).length > 500) {
    throw new Error("Đường dẫn tệp đính kèm không được vượt quá 500 ký tự.");
  }

  if (normalizeText(payload.relatedType) && !normalizeText(payload.relatedId)) {
    throw new Error("Vui lòng cung cấp mã liên kết.");
  }
};

const buildConversationPayload = (payload) => {
  return {
    relatedType:
      normalizeRelatedType(payload.relatedType) || null,
    relatedId: normalizeNullableText(payload.relatedId),
    message: normalizeText(payload.message),
    attachmentUrl: normalizeNullableText(payload.attachmentUrl),
  };
};

const validateSendMessagePayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Dữ liệu gửi tin nhắn không hợp lệ.");
  }

  if (!normalizeText(payload.content) && !normalizeText(payload.attachmentUrl)) {
    throw new Error("Vui lòng nhập nội dung hoặc đính kèm tệp.");
  }

  if (normalizeText(payload.content).length > 2000) {
    throw new Error("Nội dung tin nhắn không được vượt quá 2000 ký tự.");
  }

  if (normalizeText(payload.attachmentUrl).length > 500) {
    throw new Error("Đường dẫn tệp đính kèm không được vượt quá 500 ký tự.");
  }
};

const buildSendMessagePayload = (payload) => {
  const attachmentUrl = normalizeNullableText(
    payload.attachmentUrl
  );

  return {
    // API bắt buộc content dài ít nhất 1 ký tự, kể cả tin nhắn chỉ có ảnh.
    content:
      normalizeText(payload.content) ||
      (attachmentUrl ? "Đã gửi một hình ảnh" : ""),
    attachmentUrl,
  };
};

/* =========================================================
   BỘ DỮ LIỆU TRONG BỘ NHỚ
========================================================= */

/*
 * Clone một lần rồi mutate trực tiếp trên bản clone này.
 *
 * Gửi tin nhắn xong component gọi refreshConversationSilently() để đọc lại chi tiết;
 * nếu mock không lưu tin vừa gửi thì tin nhắn hiện lên rồi biến mất ngay sau đó.
 * Ngược lại, mọi giá trị trả ra ngoài đều deepClone thêm một lần để một màn hình
 * sort/mutate tại chỗ không làm hỏng dữ liệu của các màn còn lại.
 */
const conversationStore = deepClone(
  conversationFixtures
);

/** Mốc thời gian để xếp hộp thư: tin mới nhất lên đầu, thiếu field thì lùi dần. */
const getSortTime = (conversation) => {
  const value =
    conversation?.lastMessageAt ||
    conversation?.latestMessageAt ||
    conversation?.updatedAt ||
    conversation?.createdAt ||
    "";

  const time = value ? new Date(value).getTime() : 0;

  return Number.isNaN(time) ? 0 : time;
};

const findConversation = (conversationId) => {
  const id = normalizeText(conversationId);

  return conversationStore.find(
    (conversation) =>
      conversation.id === id ||
      conversation.conversationId === id
  );
};

/** Lỗi 404 đúng hình dạng axios, để nhánh catch đọc được error.response.data.message. */
const notFoundError = () =>
  createApiError(
    404,
    "Không tìm thấy cuộc trò chuyện."
  );

/** Xếp tin nhắn cũ trước mới sau — khung chat cuộn từ trên xuống theo thứ tự này. */
const sortMessagesAscending = (messages = []) => {
  return [...messages].sort((firstMessage, secondMessage) => {
    const firstTime = new Date(
      firstMessage?.createdAt || firstMessage?.sentAt || 0
    ).getTime();

    const secondTime = new Date(
      secondMessage?.createdAt || secondMessage?.sentAt || 0
    ).getTime();

    return (
      (Number.isNaN(firstTime) ? 0 : firstTime) -
      (Number.isNaN(secondTime) ? 0 : secondTime)
    );
  });
};

/**
 * Bản rút gọn cho hộp thư bên trái.
 *
 * API danh sách thật không trả kèm mảng tin nhắn; bỏ `messages` ở đây để không màn nào
 * vô tình dựng khung chat từ dữ liệu danh sách rồi lệch với chi tiết.
 */
const toConversationSummary = (conversation) => {
  const summary = deepClone(conversation);

  delete summary.messages;

  return summary;
};

/** Cập nhật lại phần xem trước của hội thoại sau khi có tin nhắn mới. */
const applyLatestMessage = (conversation, message) => {
  const preview =
    normalizeText(message?.content) ||
    (message?.attachmentUrl ? "Đã gửi một hình ảnh" : "");

  conversation.lastMessage = preview;
  conversation.latestMessage = preview;
  conversation.lastMessageAt = message.createdAt;
  conversation.latestMessageAt = message.createdAt;
  conversation.updatedAt = message.createdAt;
  conversation.messageCount = conversation.messages.length;
};

/* =========================================================
   API
========================================================= */

/**
 * Tạo cuộc trò chuyện.
 *
 * [API THẬT] POST /api/conversations
 *
 * Trả về object hội thoại vừa tạo (id + conversationId), vì handleCreateConversation
 * đọc `data?.id || data?.conversationId` để chọn ngay hội thoại mới trên giao diện.
 */
export const createConversationApi = async (payload, options = {}) => {
  validateConversationPayload(payload);

  const requestPayload = buildConversationPayload(payload);

  await delay(320, getSignal(options));

  const createdAt = nowIso();
  const conversationId = nextRuntimeId("conversation");

  /* id và messageId là CÙNG một giá trị, đúng như fixture (makeMessageId dùng chung
     cho cả hai khoá): getMessageId() đọc id trước rồi mới tới messageId, hai giá trị
     khác nhau chỉ làm hai chỗ tra cùng một tin lại ra hai khoá. */
  const firstMessageId = nextRuntimeId("message");

  const firstMessage = {
    id: firstMessageId,
    messageId: firstMessageId,
    conversationId,

    /* Người tạo chính là người đang đăng nhập, nên tin đầu tiên phải mang senderId
       của họ: isMessageMine() so senderId với id trong JWT để canh bong bóng sang
       phải. Gán sai id là tin của chính mình lại hiện như tin của người khác. */
    senderId: SALE_STAFF.id,
    senderName: SALE_STAFF.fullName,
    senderRole: SALE_STAFF.role,

    content: requestPayload.message,
    attachmentUrl: requestPayload.attachmentUrl,

    createdAt,
    sentAt: createdAt,
    updatedAt: createdAt,

    isRead: true,
    readAt: createdAt,
  };

  const conversation = {
    id: conversationId,
    conversationId,

    /* Hội thoại tự tạo chưa gắn với khách hàng nào: để trống customerName và dùng
       `title`, vì getCustomerDisplayName() rơi xuống title thay vì in "Khách hàng". */
    title: "Yêu cầu hỗ trợ mới",

    createdBy: SALE_STAFF.id,
    createdByUserId: SALE_STAFF.id,

    /* Chưa ai nhận: hasAssignedStaff() đọc staffName để hiện "Đang hỗ trợ trực tuyến". */
    staffName: "",
    staff: null,

    relatedType: requestPayload.relatedType,
    relatedId: requestPayload.relatedId,
    relatedCode: "",

    status: "PENDING",

    lastMessage:
      requestPayload.message ||
      (requestPayload.attachmentUrl ? "Đã gửi một hình ảnh" : ""),
    latestMessage:
      requestPayload.message ||
      (requestPayload.attachmentUrl ? "Đã gửi một hình ảnh" : ""),

    createdAt,
    updatedAt: createdAt,
    lastMessageAt: createdAt,
    latestMessageAt: createdAt,
    lastReadAt: createdAt,

    unreadCount: 0,
    unreadMessages: 0,
    unread: 0,

    messageCount: 1,
    messages: [firstMessage],
  };

  conversationStore.unshift(conversation);

  return deepClone(conversation);
};

/**
 * Lấy danh sách cuộc trò chuyện.
 *
 * [API THẬT] GET /api/conversations
 *
 * Trả MẢNG TRẦN: normalizeConversationList() kiểm Array.isArray(data) trước tiên nên
 * đây là hình dạng ít rủi ro nhất; bọc thêm một tầng { items } là thừa.
 */
export const getConversationsApi = async (options = {}) => {
  await delay(260, getSignal(options));

  return conversationStore
    .map(toConversationSummary)
    .sort(
      (firstConversation, secondConversation) =>
        getSortTime(secondConversation) -
        getSortTime(firstConversation)
    );
};

/**
 * Lấy chi tiết cuộc trò chuyện kèm tin nhắn.
 *
 * [API THẬT] GET /api/conversations/{conversationId}
 */
export const getConversationDetailApi = async (
  conversationId,
  options = {}
) => {
  const id = normalizeText(conversationId);

  if (!id) {
    throw new Error("Không tìm thấy mã cuộc trò chuyện.");
  }

  await delay(280, getSignal(options));

  const conversation = findConversation(id);

  if (!conversation) {
    throw notFoundError();
  }

  const detail = deepClone(conversation);

  detail.messages = sortMessagesAscending(
    detail.messages
  );

  return detail;
};

/**
 * Gửi tin nhắn vào cuộc trò chuyện.
 *
 * [API THẬT] POST /api/conversations/{conversationId}/messages
 *
 * Ghi thẳng vào fixture: ngay sau khi gửi, component gọi refreshConversationSilently()
 * đọc lại chi tiết — không lưu thì tin nhắn vừa gửi biến mất trước mắt người dùng.
 */
export const sendConversationMessageApi = async (
  conversationId,
  payload,
  options = {}
) => {
  const id = normalizeText(conversationId);

  if (!id) {
    throw new Error("Không tìm thấy mã cuộc trò chuyện.");
  }

  validateSendMessagePayload(payload);

  const requestPayload = buildSendMessagePayload(payload);

  await delay(300, getSignal(options));

  const conversation = findConversation(id);

  if (!conversation) {
    throw notFoundError();
  }

  const createdAt = nowIso();
  const messageId = nextRuntimeId("message");

  const message = {
    id: messageId,
    messageId,
    conversationId: conversation.id,

    /* Tin do người đang đăng nhập gửi: giữ đúng senderId của họ để bong bóng nằm
       bên phải và nhãn hiện "Bạn", giống hệt tin nhắn do server ghi nhận. */
    senderId: SALE_STAFF.id,
    senderName: SALE_STAFF.fullName,
    senderRole: SALE_STAFF.role,

    content: requestPayload.content,
    attachmentUrl: requestPayload.attachmentUrl,

    createdAt,
    sentAt: createdAt,
    updatedAt: createdAt,

    isRead: true,
    readAt: createdAt,
  };

  if (!Array.isArray(conversation.messages)) {
    conversation.messages = [];
  }

  conversation.messages.push(message);
  applyLatestMessage(conversation, message);

  return deepClone(message);
};

/**
 * Đánh dấu tin nhắn là đã đọc.
 *
 * [API THẬT] PUT /api/conversations/{conversationId}/read
 *
 * Xoá badge chưa đọc ngay trong fixture, nhờ vậy lần tải danh sách sau không dựng lại
 * con số vừa bị người dùng bấm cho mất.
 */
export const markConversationAsReadApi = async (
  conversationId,
  options = {}
) => {
  const id = normalizeText(conversationId);

  if (!id) {
    throw new Error("Không tìm thấy mã cuộc trò chuyện.");
  }

  await delay(180, getSignal(options));

  const conversation = findConversation(id);

  if (!conversation) {
    throw notFoundError();
  }

  const readAt = nowIso();

  conversation.unreadCount = 0;
  conversation.unreadMessages = 0;
  conversation.unread = 0;
  conversation.lastReadAt = readAt;

  if (Array.isArray(conversation.messages)) {
    conversation.messages.forEach((message) => {
      if (!message.isRead) {
        message.isRead = true;
        message.readAt = readAt;
      }
    });
  }

  return {
    conversationId: conversation.id,
    isRead: true,
    unreadCount: 0,
    readAt,
    message: "Đã đánh dấu cuộc trò chuyện là đã đọc.",
  };
};

const conversationApi = {
  createConversationApi,
  getConversationsApi,
  getConversationDetailApi,
  sendConversationMessageApi,
  markConversationAsReadApi,
};

export default conversationApi;
