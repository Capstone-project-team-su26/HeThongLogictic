// Hàm thuần dùng cho màn hình chat CSKH: đọc token, chuẩn hoá payload API,
// định dạng thời gian, gom nhóm hội thoại và dựng timeline tin nhắn.
// Không hàm nào ở đây chạm vào state/props/hook — chúng chỉ nhận tham số và trả kết quả,
// nên tách ra được mà không đổi thứ component render.

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import { getOrderStatusLabel } from "@features/consignment";

import {
  apiToUtcIso,
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "@shared/utils/timeUtc";

import {
  ACCEPTED_CHAT_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  MESSAGE_GROUP_GAP_MS,
  RELATED_TYPE_LABELS,
  STATUS_LABELS,
} from "./CustomerServiceChat.constants";

export const normalizeDisplayCode = (value) => {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
};

export const getRelatedTypeLabel = (value) => {
  const normalized = normalizeDisplayCode(value);
  const compact = normalized.replaceAll("_", "");

  return (
    RELATED_TYPE_LABELS[normalized] ||
    RELATED_TYPE_LABELS[compact] ||
    "Hỗ trợ chung"
  );
};

export const getStatusDisplayName = (value) => {
  const normalized = normalizeDisplayCode(value);

  if (!normalized) {
    return "";
  }

  return (
    STATUS_LABELS[normalized] ||
    normalized
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^./, (character) => character.toUpperCase())
  );
};

export const createAttachmentItem = (file) => ({
  id:
    String(file?.uid || "").trim() ||
    `${file?.name || "image"}-${file?.size || 0}-${file?.lastModified || Date.now()}`,
  file,
  previewUrl: URL.createObjectURL(file),
  name: file?.name || "Ảnh đính kèm",
});

export const getAccessToken = () => {
  return (
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
};

export const decodeJwtPayload = (token) => {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const normalizedPayload = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const json = decodeURIComponent(
      atob(normalizedPayload)
        .split("")
        .map((char) => {
          return `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`;
        })
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getCurrentUserId = () => {
  const token = getAccessToken();
  const payload = decodeJwtPayload(token);

  return (
    payload?.[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    ] ||
    payload?.nameid ||
    payload?.sub ||
    payload?.userId ||
    ""
  );
};

export const getCurrentUserRole = () => {
  const payload = decodeJwtPayload(
    getAccessToken()
  );

  return (
    payload?.[
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
    ] ||
    payload?.role ||
    sessionStorage.getItem("role") ||
    localStorage.getItem("role") ||
    ""
  );
};

export const getCurrentUserName = () => {
  const payload = decodeJwtPayload(
    getAccessToken()
  );

  return (
    payload?.[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
    ] ||
    payload?.name ||
    sessionStorage.getItem("fullName") ||
    ""
  );
};

export const unwrapApiData = (response) => {
  return response?.data ?? response;
};

export const normalizeConversationList = (response) => {
  const data = unwrapApiData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.conversations)) return data.conversations;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

export const normalizeConversationDetail = (response) => {
  const data = unwrapApiData(response);

  return data?.conversation || data;
};

export const normalizeMessages = (detail) => {
  if (Array.isArray(detail?.messages)) return detail.messages;
  if (Array.isArray(detail?.conversationMessages)) {
    return detail.conversationMessages;
  }
  if (Array.isArray(detail?.data?.messages)) return detail.data.messages;

  return [];
};

export const normalizeRelatedList = (response) => {
  const data = unwrapApiData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.purchaseRequests)) return data.purchaseRequests;
  if (Array.isArray(data?.consignments)) return data.consignments;

  return [];
};

export const getConversationId = (conversation) => {
  return (
    conversation?.id ||
    conversation?.conversationId ||
    conversation?.conversationID ||
    ""
  );
};

export const getMessageId = (message, index) => {
  return (
    message?.id ||
    message?.messageId ||
    message?.createdAt ||
    `${index}-${message?.content || message?.message || ""}`
  );
};

export const getMessageContent = (message) => {
  return message?.content || message?.message || message?.text || "";
};

export const isLikelyAttachmentUrl = (value) => {
  const text = String(value || "").trim();

  return (
    /^(https?:\/\/|blob:|data:image\/)/i.test(text) ||
    /^\/[^/\s]/.test(text) ||
    /(?:^|\/)(?:uploads?|images?|files?)\//i.test(text) ||
    /\.(?:png|jpe?g|webp|gif|bmp|svg|heic|heif|avif)(?:[?#].*)?$/i.test(text)
  );
};

export const collectAttachmentUrls = (value, output = [], depth = 0) => {
  if (value === null || value === undefined || depth > 7) {
    return output;
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (!text) {
      return output;
    }

    if (
      (text.startsWith("[") && text.endsWith("]")) ||
      (text.startsWith("{") && text.endsWith("}"))
    ) {
      try {
        collectAttachmentUrls(JSON.parse(text), output, depth + 1);
        return output;
      } catch {
        // Chuỗi không phải JSON, tiếp tục kiểm tra như URL thông thường.
      }
    }

    if (isLikelyAttachmentUrl(text) && !output.includes(text)) {
      output.push(text);
    }

    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectAttachmentUrls(item, output, depth + 1));
    return output;
  }

  if (typeof value === "object") {
    [
      "url",
      "imageUrl",
      "imageURL",
      "fileUrl",
      "fileURL",
      "attachmentUrl",
      "attachmentURL",
      "secureUrl",
      "secureURL",
      "secure_url",
      "path",
    ].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectAttachmentUrls(value[key], output, depth + 1);
      }
    });

    [
      "urls",
      "imageUrls",
      "imageURLs",
      "fileUrls",
      "fileURLs",
      "attachmentUrls",
      "attachmentURLs",
      "attachments",
      "files",
      "images",
      "items",
      "results",
      "data",
    ].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectAttachmentUrls(value[key], output, depth + 1);
      }
    });
  }

  return output;
};

export const getMessageAttachments = (message) => {
  return collectAttachmentUrls([
    message?.attachmentUrls,
    message?.attachmentURLs,
    message?.attachments,
    message?.images,
    message?.files,
    message?.attachmentUrl,
    message?.attachmentURL,
  ]);
};

export const getMessageAttachment = (message) => {
  return getMessageAttachments(message)[0] || "";
};

export const normalizeRoleKey = (role) => {
  return String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");
};

export const getRoleDisplayName = (role) => {
  const roleKey = normalizeRoleKey(role);

  if (!roleKey) return "";

  if (
    roleKey === "SALES" ||
    roleKey === "SALE" ||
    roleKey === "SALESSTAFF" ||
    roleKey.includes("SALE")
  ) {
    return "Nhân viên tư vấn";
  }

  if (roleKey === "CUSTOMER") return "Khách hàng";
  if (roleKey === "ADMIN" || roleKey === "ADMINISTRATOR") {
    return "Quản trị viên";
  }
  if (roleKey === "MANAGER") return "Quản lý";
  if (roleKey.includes("WAREHOUSE")) return "Nhân viên kho";
  if (roleKey.includes("STAFF")) return "Nhân viên";

  return role;
};

export const getMessageSenderRole = (message) => {
  return (
    message?.senderRole ||
    message?.senderType ||
    message?.role ||
    message?.createdByRole ||
    message?.userRole ||
    message?.sender?.role ||
    message?.createdByUser?.role ||
    ""
  );
};

export const getMessageSenderName = (message) => {
  const senderName =
    message?.senderName ||
    message?.senderFullName ||
    message?.createdByName ||
    message?.createdByFullName ||
    message?.userName ||
    message?.fullName ||
    message?.sender?.fullName ||
    message?.sender?.name ||
    message?.createdByUser?.fullName ||
    message?.createdByUser?.name ||
    "";

  if (senderName) {
    return senderName;
  }

  const roleLabel = getRoleDisplayName(getMessageSenderRole(message));

  if (roleLabel) {
    return roleLabel;
  }

  return "CSKH";
};

export const getMessageSenderId = (message) => {
  return (
    message?.senderId ||
    message?.senderUserId ||
    message?.senderID ||
    message?.createdBy ||
    message?.createdByUserId ||
    message?.userId ||
    message?.authorId ||
    message?.sender?.id ||
    message?.sender?.userId ||
    ""
  );
};

export const isSaleRole = (role) => {
  const roleKey = normalizeRoleKey(role);

  return (
    roleKey === "SALE" ||
    roleKey === "SALES" ||
    roleKey === "SALESSTAFF" ||
    roleKey.includes("SALE")
  );
};

export const isMessageMine = (
  message,
  currentUserId,
  currentUserRole
) => {
  if (typeof message?.isMine === "boolean") return message.isMine;
  if (typeof message?.fromMe === "boolean") return message.fromMe;

  const senderId = getMessageSenderId(message);

  if (senderId && currentUserId) {
    return String(senderId) === String(currentUserId);
  }

  const senderRole = normalizeRoleKey(
    getMessageSenderRole(message)
  );
  const viewerRole = normalizeRoleKey(
    currentUserRole
  );

  if (!senderRole || !viewerRole) {
    return false;
  }

  if (isSaleRole(viewerRole)) {
    return isSaleRole(senderRole);
  }

  return senderRole === viewerRole;
};

export const getViewerMessageLabel = (
  isMine,
  currentUserRole,
  currentUserName,
  message
) => {
  if (!isMine) {
    const senderName = getMessageSenderName(message);

    if (isSaleRole(currentUserRole) && senderName === "CSKH") {
      return "Khách hàng";
    }

    return senderName;
  }

  const displayName = String(
    currentUserName || ""
  ).trim();

  if (isSaleRole(currentUserRole)) {
    return displayName
      ? `${displayName} (Sale)`
      : "Bạn (Sale)";
  }

  return displayName
    ? `${displayName} (Khách hàng)`
    : "Bạn (Khách hàng)";
};

export const getConversationTitle = (conversation) => {
  const explicitTitle =
    conversation?.title ||
    conversation?.customerName ||
    conversation?.customer?.fullName ||
    conversation?.customerFullName ||
    conversation?.createdByName ||
    "";

  if (explicitTitle) {
    return String(explicitTitle);
  }

  if (conversation?.relatedType) {
    return getRelatedTypeLabel(conversation.relatedType);
  }

  return "Cuộc trò chuyện hỗ trợ";
};

export const getStaffName = (conversation) => {
  return (
    conversation?.staffName ||
    conversation?.employeeName ||
    conversation?.salesStaffName ||
    conversation?.saleStaffName ||
    conversation?.supportStaffName ||
    conversation?.assignedStaffName ||
    conversation?.staff?.fullName ||
    conversation?.employee?.fullName ||
    conversation?.salesStaff?.fullName ||
    conversation?.supportStaff?.fullName ||
    conversation?.assignedStaff?.fullName ||
    conversation?.staff?.name ||
    conversation?.employee?.name ||
    conversation?.salesStaff?.name ||
    conversation?.supportStaff?.name ||
    ""
  );
};

export const getStaffDisplayName = (conversation) => {
  return getStaffName(conversation);
};

export const hasAssignedStaff = (conversation) => {
  return Boolean(getStaffName(conversation));
};

export const getConversationRelatedCode = (conversation) => {
  return (
    conversation?.relatedCode ||
    conversation?.orderCode ||
    conversation?.requestCode ||
    conversation?.consignmentCode ||
    conversation?.purchaseRequestCode ||
    conversation?.relatedId ||
    ""
  );
};

export const getConversationSubtitle = (conversation) => {
  const relatedType = conversation?.relatedType;
  const relatedCode = getConversationRelatedCode(conversation);

  if (relatedType) {
    const typeLabel = getRelatedTypeLabel(relatedType);

    if (relatedCode) {
      const displayCode = String(relatedCode);
      const shortCode =
        displayCode.length > 12
          ? `${displayCode.slice(0, 10)}…`
          : displayCode;

      return `${typeLabel} · ${shortCode}`;
    }

    return typeLabel;
  }

  return "Yêu cầu hỗ trợ chung";
};

export const getConversationLastMessage = (conversation) => {
  return (
    conversation?.lastMessage ||
    conversation?.latestMessage ||
    conversation?.message ||
    "Chưa có tin nhắn mới"
  );
};

export const getUnreadCount = (conversation) => {
  return Number(
    conversation?.unreadCount ||
      conversation?.unreadMessages ||
      conversation?.unread ||
      0
  );
};

export const getCustomerId = (conversation) => {
  return (
    conversation?.customerId ||
    conversation?.customerID ||
    conversation?.customerUserId ||
    conversation?.customer?.id ||
    conversation?.customer?.userId ||
    conversation?.createdByUserId ||
    conversation?.createdBy ||
    ""
  );
};

export const getCustomerDisplayName = (conversation) => {
  return (
    conversation?.customerName ||
    conversation?.customer?.fullName ||
    conversation?.customerFullName ||
    conversation?.createdByName ||
    conversation?.title ||
    "Khách hàng"
  );
};

export const getCustomerGroupKey = (conversation) => {
  const customerId = String(getCustomerId(conversation) || "").trim();

  if (customerId) {
    return `id:${customerId}`;
  }

  const name = String(getCustomerDisplayName(conversation) || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (name) {
    return `name:${name}`;
  }

  return `solo:${getConversationId(conversation)}`;
};

export const buildConversationGroups = (conversationList = []) => {
  const groupMap = new Map();

  conversationList.forEach((conversation) => {
    const key = getCustomerGroupKey(conversation);
    const existing = groupMap.get(key);

    if (existing) {
      existing.conversations.push(conversation);
      return;
    }

    groupMap.set(key, {
      key,
      customerId: getCustomerId(conversation),
      customerName: getCustomerDisplayName(conversation),
      conversations: [conversation],
    });
  });

  return Array.from(groupMap.values())
    .map((group) => {
      const conversations = [...group.conversations].sort(
        (firstConversation, secondConversation) =>
          getTimeValue(secondConversation) - getTimeValue(firstConversation)
      );

      const unreadCount = conversations.reduce(
        (total, conversation) => total + getUnreadCount(conversation),
        0
      );

      return {
        ...group,
        conversations,
        unreadCount,
        latestConversation: conversations[0] || null,
        conversationCount: conversations.length,
      };
    })
    .sort((firstGroup, secondGroup) => {
      return (
        getTimeValue(secondGroup.latestConversation) -
        getTimeValue(firstGroup.latestConversation)
      );
    });
};

export const normalizeApiTimeToUtc = (value) => {
  return apiToUtcIso(value, {
    apiTimeMode: "utc",
  });
};

export const getClientTimePayload = () => {
  const timeInfo = getBrowserTimeInfo();
  const nowUtc = getSyncedNowUtcIso();

  return {
    sentAtUtc: nowUtc,
    createdAtUtc: nowUtc,
    clientSentAtUtc: nowUtc,
    clientCreatedAtUtc: nowUtc,
    clientTimeZone: timeInfo.timeZone,
    clientUtcOffset: timeInfo.utcOffsetText,
    clientUtcOffsetMinutes: timeInfo.utcOffsetMinutes,
  };
};

export const normalizeMessageTime = (message) => {
  if (!message) {
    return message;
  }

  return {
    ...message,
    createdAtUtc: normalizeApiTimeToUtc(message.createdAt),
    sentAtUtc: normalizeApiTimeToUtc(message.sentAt),
    updatedAtUtc: normalizeApiTimeToUtc(message.updatedAt),
    readAtUtc: normalizeApiTimeToUtc(message.readAt),
  };
};

export const normalizeConversationTime = (conversation) => {
  if (!conversation) {
    return conversation;
  }

  return {
    ...conversation,
    createdAtUtc: normalizeApiTimeToUtc(conversation.createdAt),
    updatedAtUtc: normalizeApiTimeToUtc(conversation.updatedAt),
    lastMessageAtUtc: normalizeApiTimeToUtc(conversation.lastMessageAt),
    latestMessageAtUtc: normalizeApiTimeToUtc(conversation.latestMessageAt),
    lastReadAtUtc: normalizeApiTimeToUtc(conversation.lastReadAt),
  };
};

export const normalizeConversationDetailTime = (detail) => {
  if (!detail) {
    return detail;
  }

  const messages = normalizeMessages(detail)
    .map(normalizeMessageTime)
    .sort((firstMessage, secondMessage) => {
      return getTimeValue(firstMessage) - getTimeValue(secondMessage);
    });

  return {
    ...normalizeConversationTime(detail),
    messages,
    conversationMessages: messages,
  };
};

export const formatDateTime = (value) => {
  const utcIso = normalizeApiTimeToUtc(value);

  if (!utcIso) return "";

  const date = new Date(utcIso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${getPart("hour")}:${getPart("minute")} · ${getPart(
    "day"
  )}/${getPart("month")}`;
};

export const getCreatedTime = (item) => {
  return (
    item?.createdAtUtc ||
    item?.sentAtUtc ||
    item?.updatedAtUtc ||
    item?.lastMessageAtUtc ||
    item?.latestMessageAtUtc ||
    item?.createdAt ||
    item?.sentAt ||
    item?.updatedAt ||
    item?.lastMessageAt ||
    item?.latestMessageAt ||
    ""
  );
};

export const getTimeValue = (item) => {
  const normalizedTime = normalizeApiTimeToUtc(getCreatedTime(item));
  const timeValue = normalizedTime ? new Date(normalizedTime).getTime() : 0;

  return Number.isNaN(timeValue) ? 0 : timeValue;
};

export const getMessageDayKey = (item) => {
  const utcIso = normalizeApiTimeToUtc(getCreatedTime(item));

  if (!utcIso) {
    return "";
  }

  const date = new Date(utcIso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

export const formatDayLabel = (dayKey) => {
  if (!dayKey) {
    return "";
  }

  const [year, month, day] = dayKey.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  const todayKey = getMessageDayKey({ createdAtUtc: getSyncedNowUtcIso() });

  if (dayKey === todayKey) {
    return "Hôm nay";
  }

  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const yesterdayDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayKey = [
    yesterdayDate.getUTCFullYear(),
    String(yesterdayDate.getUTCMonth() + 1).padStart(2, "0"),
    String(yesterdayDate.getUTCDate()).padStart(2, "0"),
  ].join("-");

  if (dayKey === yesterdayKey) {
    return "Hôm qua";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(target);
};

export const formatMessageTime = (value) => {
  const utcIso = normalizeApiTimeToUtc(value);

  if (!utcIso) {
    return "";
  }

  const date = new Date(utcIso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

export const getMessageSenderKey = (message, currentUserId, currentUserRole) => {
  if (isMessageMine(message, currentUserId, currentUserRole)) {
    return `mine:${currentUserId || normalizeRoleKey(currentUserRole) || "self"}`;
  }

  return `other:${
    getMessageSenderId(message) ||
    normalizeRoleKey(getMessageSenderRole(message)) ||
    getMessageSenderName(message) ||
    "peer"
  }`;
};

export const buildMessageTimeline = (
  messageList = [],
  currentUserId,
  currentUserRole
) => {
  const timeline = [];
  let currentCluster = null;

  messageList.forEach((message, index) => {
    const dayKey = getMessageDayKey(message);
    const senderKey = getMessageSenderKey(
      message,
      currentUserId,
      currentUserRole
    );
    const timeValue = getTimeValue(message);
    const mine = isMessageMine(message, currentUserId, currentUserRole);

    if (
      !currentCluster ||
      currentCluster.dayKey !== dayKey ||
      currentCluster.senderKey !== senderKey ||
      timeValue - currentCluster.lastTimeValue > MESSAGE_GROUP_GAP_MS
    ) {
      if (
        !currentCluster ||
        currentCluster.dayKey !== dayKey
      ) {
        timeline.push({
          type: "day",
          key: `day-${dayKey || index}`,
          label: formatDayLabel(dayKey),
        });
      }

      currentCluster = {
        type: "cluster",
        key: `cluster-${index}-${senderKey}`,
        senderKey,
        mine,
        dayKey,
        lastTimeValue: timeValue,
        items: [],
      };
      timeline.push(currentCluster);
    }

    currentCluster.items.push({ message, index });
    currentCluster.lastTimeValue = timeValue;
  });

  return timeline;
};

export const getRelatedItemId = (item, relatedType) => {
  if (!item) return "";

  if (relatedType === "PURCHASE_REQUEST") {
    return (
      item.purchaseRequestId ||
      item.purchaseRequestID ||
      item.requestId ||
      item.requestID ||
      item.orderId ||
      item.orderID ||
      item.id ||
      ""
    );
  }

  if (relatedType === "CONSIGNMENT") {
    return (
      item.consignmentId ||
      item.consignmentID ||
      item.orderId ||
      item.orderID ||
      item.requestId ||
      item.requestID ||
      item.id ||
      ""
    );
  }

  return item.id || "";
};

export const getRelatedItemCode = (item, relatedType) => {
  if (!item) return "";

  if (relatedType === "PURCHASE_REQUEST") {
    return (
      item.purchaseRequestCode ||
      item.requestCode ||
      item.orderCode ||
      item.code ||
      item.trackingCode ||
      ""
    );
  }

  if (relatedType === "CONSIGNMENT") {
    return (
      item.consignmentCode ||
      item.orderCode ||
      item.requestCode ||
      item.code ||
      item.trackingCode ||
      ""
    );
  }

  return item.code || "";
};

export const getRelatedItemName = (item, relatedType) => {
  if (!item) return "";

  if (relatedType === "PURCHASE_REQUEST") {
    return (
      item.productName ||
      item.name ||
      item.title ||
      item.receiverName ||
      ""
    );
  }

  if (relatedType === "CONSIGNMENT") {
    return (
      item.consignmentType ||
      item.name ||
      item.title ||
      item.receiverName ||
      ""
    );
  }

  return item.name || item.title || "";
};

export const getRelatedItemStatus = (item) => {
  return item?.status || item?.orderStatus || "";
};

export const getRelatedItemLabel = (item, relatedType) => {
  const id = getRelatedItemId(item, relatedType);
  const code = getRelatedItemCode(item, relatedType);
  const name = getRelatedItemName(item, relatedType);
  /* Đơn ký gửi dùng nhãn trạng thái đơn thống nhất; loại khác giữ bảng nhãn chung. */
  const rawStatus = getRelatedItemStatus(item);
  const status =
    normalizeDisplayCode(relatedType).includes("CONSIGNMENT") && String(rawStatus).trim()
      ? getOrderStatusLabel(rawStatus)
      : getStatusDisplayName(rawStatus);
  const typeLabel = getRelatedTypeLabel(relatedType);
  const shortId = id ? String(id).slice(0, 8) : "N/A";

  const parts = [
    typeLabel,
    code || `${shortId}...`,
    name,
    status,
  ].filter(Boolean);

  return parts.join(" - ");
};

export const getApiErrorText = (error, fallback) => {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  if (typeof data?.title === "string" && data.title.trim()) return data.title;

  return error?.message || fallback;
};

export const notifySuccess = (title, description) => {
  if (typeof AuthNotify?.success === "function") {
    AuthNotify.success(title, description);
  }
};

export const notifyError = (title, description) => {
  if (typeof AuthNotify?.error === "function") {
    AuthNotify.error(title, description);
  }
};

export const notifyWarning = (title, description) => {
  if (typeof AuthNotify?.warning === "function") {
    AuthNotify.warning(title, description);
    return;
  }

  if (typeof AuthNotify?.info === "function") {
    AuthNotify.info(title, description);
    return;
  }

  notifyError(title, description);
};

export const getMessageSignature = (message, index) => {
  return [
    getMessageId(message, index),
    getMessageSenderId(message),
    getMessageSenderRole(message),
    getMessageContent(message),
    getMessageAttachments(message).join("|"),
    getCreatedTime(message),
  ]
    .map((value) => String(value || ""))
    .join("::");
};

export const getMessagesSignature = (messageList = []) => {
  return messageList
    .map((message, index) => getMessageSignature(message, index))
    .join("||");
};

export const isImageUrl = (url) => {
  const text = String(url || "").toLowerCase();

  return (
    text.includes("image") ||
    /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?.*)?$/.test(text)
  );
};

export const extractUploadUrls = (response) => {
  return collectAttachmentUrls(unwrapApiData(response));
};

export const validateImageFile = (file) => {
  if (!file) {
    throw new Error("Không tìm thấy ảnh.");
  }

  const mimeType = String(file.type || "")
    .trim()
    .toLowerCase();

  const extensionIsAccepted = /\.(?:jpe?g|png|webp)$/i.test(
    String(file.name || ""),
  );

  if (
    !ACCEPTED_CHAT_IMAGE_TYPES.has(mimeType) &&
    !extensionIsAccepted
  ) {
    throw new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Ảnh không được vượt quá ${MAX_IMAGE_SIZE_MB}MB.`);
  }
};

export const buildAiContextFromConversation = (conversation) => {
  if (!conversation) return null;

  const relatedCode = getConversationRelatedCode(conversation);
  const looksLikeId =
    relatedCode && getConversationId(conversation) === relatedCode;

  return {
    orderCode: looksLikeId ? "" : relatedCode,
    customerId: getCustomerId(conversation) || undefined,
    customerName: getCustomerDisplayName(conversation) || undefined,
    relatedType: conversation?.relatedType || undefined,
    relatedId: conversation?.relatedId || undefined,
  };
};

export const buildAiPrefillFromLocation = (state) => {
  if (!state || typeof state !== "object") return null;

  const orderCode = String(state.aiOrderCode || "").trim();
  if (!orderCode) return null;

  return {
    orderCode,
    customerId: String(state.aiCustomerId || "").trim() || undefined,
    customerName: String(state.aiCustomerName || "").trim() || undefined,
    relatedType: String(state.aiRelatedType || "").trim() || undefined,
    relatedId: String(state.aiRelatedId || "").trim() || undefined,
  };
};
