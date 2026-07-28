import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Empty,
  Input,
  Modal,
  Select,
  Spin,
  Tooltip,
  Upload,
} from "antd";

import {
  CheckCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  MessageFilled,
  DeleteOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";

import {
  createConversationApi,
  getConversationDetailApi,
  getConversationsApi,
  markConversationAsReadApi,
  sendConversationMessageApi,
} from "../../../api/SaleAPI/Conversation/conversationApi";

import AuthNotify from "../../../utils/Common/AuthNotify";

import { getConsignmentsApi } from "../../../api/SaleAPI/ConsignmentAPI/consignmentService";
import { getPurchaseRequestsApi } from "../../../api/SaleAPI/PurchaseRequestAPI/purchaseRequestService";
import { uploadImages } from "../../../api/Upload/UploadImage";

import {
  apiToUtcIso,
  getBrowserTimeInfo,
  getSyncedNowUtcIso,
} from "../../../utils/timeUtc";

import "./CustomerServiceChat.css";

const RELATED_TYPE_OPTIONS = [
  {
    value: "",
    label: "Không liên kết",
  },
  {
    value: "PURCHASE_REQUEST",
    label: "Yêu cầu mua hộ",
  },
  {
    value: "CONSIGNMENT",
    label: "Yêu cầu ký gửi",
  },
];

const RELATED_TYPE_LABELS = {
  PURCHASE_REQUEST: "Yêu cầu mua hộ",
  PURCHASEREQUEST: "Yêu cầu mua hộ",
  BUY_FOR_ME: "Yêu cầu mua hộ",
  BUYFORME: "Yêu cầu mua hộ",
  CONSIGNMENT: "Yêu cầu ký gửi",
  CONSIGNMENT_REQUEST: "Yêu cầu ký gửi",
  CONSIGNMENTREQUEST: "Yêu cầu ký gửi",
  QUOTATION: "Báo giá",
  SUPPORT: "Hỗ trợ chung",
};

const STATUS_LABELS = {
  PENDING: "Đang chờ xử lý",
  PENDING_REVIEW: "Đang chờ duyệt",
  PROCESSING: "Đang xử lý",
  IN_PROGRESS: "Đang xử lý",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  QUOTATION_SENT: "Đã gửi báo giá",
};

const normalizeDisplayCode = (value) => {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
};

const getRelatedTypeLabel = (value) => {
  const normalized = normalizeDisplayCode(value);
  const compact = normalized.replaceAll("_", "");

  return (
    RELATED_TYPE_LABELS[normalized] ||
    RELATED_TYPE_LABELS[compact] ||
    "Hỗ trợ chung"
  );
};

const getStatusDisplayName = (value) => {
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

const RELATED_TYPE_LOADERS = {
  PURCHASE_REQUEST: getPurchaseRequestsApi,
  CONSIGNMENT: getConsignmentsApi,
};

const INITIAL_CREATE_FORM = {
  relatedType: "",
  relatedId: "",
  message: "",
};

const INITIAL_MESSAGE_FORM = {
  content: "",
};

const MAX_IMAGE_COUNT = 1;
const MAX_IMAGE_SIZE_MB = 6;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const ACCEPTED_CHAT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const createAttachmentItem = (file) => ({
  id:
    String(file?.uid || "").trim() ||
    `${file?.name || "image"}-${file?.size || 0}-${file?.lastModified || Date.now()}`,
  file,
  previewUrl: URL.createObjectURL(file),
  name: file?.name || "Ảnh đính kèm",
});

const MESSAGE_POLL_INTERVAL_MS = 2500;

const getAccessToken = () => {
  return (
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
};

const decodeJwtPayload = (token) => {
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

const getCurrentUserId = () => {
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

const getCurrentUserRole = () => {
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

const getCurrentUserName = () => {
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

const unwrapApiData = (response) => {
  return response?.data ?? response;
};

const normalizeConversationList = (response) => {
  const data = unwrapApiData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.conversations)) return data.conversations;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;

  return [];
};

const normalizeConversationDetail = (response) => {
  const data = unwrapApiData(response);

  return data?.conversation || data;
};

const normalizeMessages = (detail) => {
  if (Array.isArray(detail?.messages)) return detail.messages;
  if (Array.isArray(detail?.conversationMessages)) {
    return detail.conversationMessages;
  }
  if (Array.isArray(detail?.data?.messages)) return detail.data.messages;

  return [];
};

const normalizeRelatedList = (response) => {
  const data = unwrapApiData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.purchaseRequests)) return data.purchaseRequests;
  if (Array.isArray(data?.consignments)) return data.consignments;

  return [];
};

const getConversationId = (conversation) => {
  return (
    conversation?.id ||
    conversation?.conversationId ||
    conversation?.conversationID ||
    ""
  );
};

const getMessageId = (message, index) => {
  return (
    message?.id ||
    message?.messageId ||
    message?.createdAt ||
    `${index}-${message?.content || message?.message || ""}`
  );
};

const getMessageContent = (message) => {
  return message?.content || message?.message || message?.text || "";
};

const isLikelyAttachmentUrl = (value) => {
  const text = String(value || "").trim();

  return (
    /^(https?:\/\/|blob:|data:image\/)/i.test(text) ||
    /^\/[^/\s]/.test(text) ||
    /(?:^|\/)(?:uploads?|images?|files?)\//i.test(text) ||
    /\.(?:png|jpe?g|webp|gif|bmp|svg|heic|heif|avif)(?:[?#].*)?$/i.test(text)
  );
};

const collectAttachmentUrls = (value, output = [], depth = 0) => {
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

const getMessageAttachments = (message) => {
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

const getMessageAttachment = (message) => {
  return getMessageAttachments(message)[0] || "";
};

const normalizeRoleKey = (role) => {
  return String(role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]/g, "");
};

const getRoleDisplayName = (role) => {
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

const getMessageSenderRole = (message) => {
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

const getMessageSenderName = (message) => {
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

const getMessageSenderId = (message) => {
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

const isSaleRole = (role) => {
  const roleKey = normalizeRoleKey(role);

  return (
    roleKey === "SALE" ||
    roleKey === "SALES" ||
    roleKey === "SALESSTAFF" ||
    roleKey.includes("SALE")
  );
};

const isMessageMine = (
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

const getViewerMessageLabel = (
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

const getConversationTitle = (conversation) => {
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

const getStaffName = (conversation) => {
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

const getStaffDisplayName = (conversation) => {
  return getStaffName(conversation);
};

const hasAssignedStaff = (conversation) => {
  return Boolean(getStaffName(conversation));
};

const getConversationRelatedCode = (conversation) => {
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

const getConversationSubtitle = (conversation) => {
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

const getConversationLastMessage = (conversation) => {
  return (
    conversation?.lastMessage ||
    conversation?.latestMessage ||
    conversation?.message ||
    "Chưa có tin nhắn mới"
  );
};

const getUnreadCount = (conversation) => {
  return Number(
    conversation?.unreadCount ||
      conversation?.unreadMessages ||
      conversation?.unread ||
      0
  );
};

const normalizeApiTimeToUtc = (value) => {
  return apiToUtcIso(value, {
    apiTimeMode: "utc",
  });
};

const getClientTimePayload = () => {
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

const normalizeMessageTime = (message) => {
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

const normalizeConversationTime = (conversation) => {
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

const normalizeConversationDetailTime = (detail) => {
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

const formatDateTime = (value) => {
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

const getCreatedTime = (item) => {
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

const getTimeValue = (item) => {
  const normalizedTime = normalizeApiTimeToUtc(getCreatedTime(item));
  const timeValue = normalizedTime ? new Date(normalizedTime).getTime() : 0;

  return Number.isNaN(timeValue) ? 0 : timeValue;
};

const getRelatedItemId = (item, relatedType) => {
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

const getRelatedItemCode = (item, relatedType) => {
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

const getRelatedItemName = (item, relatedType) => {
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

const getRelatedItemStatus = (item) => {
  return item?.status || item?.orderStatus || "";
};

const getRelatedItemLabel = (item, relatedType) => {
  const id = getRelatedItemId(item, relatedType);
  const code = getRelatedItemCode(item, relatedType);
  const name = getRelatedItemName(item, relatedType);
  const status = getStatusDisplayName(getRelatedItemStatus(item));
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

const getApiErrorText = (error, fallback) => {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  if (typeof data?.title === "string" && data.title.trim()) return data.title;

  return error?.message || fallback;
};

const notifySuccess = (title, description) => {
  if (typeof AuthNotify?.success === "function") {
    AuthNotify.success(title, description);
  }
};

const notifyError = (title, description) => {
  if (typeof AuthNotify?.error === "function") {
    AuthNotify.error(title, description);
  }
};

const notifyWarning = (title, description) => {
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

const getMessageSignature = (message, index) => {
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

const getMessagesSignature = (messageList = []) => {
  return messageList
    .map((message, index) => getMessageSignature(message, index))
    .join("||");
};

const isImageUrl = (url) => {
  const text = String(url || "").toLowerCase();

  return (
    text.includes("image") ||
    /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?.*)?$/.test(text)
  );
};

const extractUploadUrls = (response) => {
  return collectAttachmentUrls(unwrapApiData(response));
};

const validateImageFile = (file) => {
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

export default function CustomerServiceChat() {
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const currentUserRole = useMemo(
    () => getCurrentUserRole(),
    []
  );
  const currentUserName = useMemo(
    () => getCurrentUserName(),
    []
  );
  const isSaleViewer = isSaleRole(
    currentUserRole
  );

  const detailAbortRef = useRef(null);
  const detailRequestVersionRef = useRef(0);
  const selectedConversationIdRef = useRef("");
  const messageAreaRef = useRef(null);
  const copyTimerRef = useRef(null);

  const messagesSignatureRef = useRef("");
  const isSilentRefreshingRef = useRef(false);

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [messageForm, setMessageForm] = useState(INITIAL_MESSAGE_FORM);

  const [createAttachments, setCreateAttachments] = useState([]);
  const [messageAttachments, setMessageAttachments] = useState([]);
  const [relatedOptions, setRelatedOptions] = useState([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingRelatedOptions, setIsLoadingRelatedOptions] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const hasConversation = conversations.length > 0;
  const hasSelectedConversation = Boolean(selectedConversationId);

  const selectedConversationTitle = selectedConversation
    ? getConversationTitle(selectedConversation)
    : "Chọn cuộc trò chuyện";

  const isCreateFormValid = useMemo(() => {
    const relatedType = String(createForm.relatedType || "").trim();
    const relatedId = String(createForm.relatedId || "").trim();
    const message = String(createForm.message || "").trim();

    return Boolean(
      message &&
        (!relatedType || relatedId) &&
        !isLoadingRelatedOptions
    );
  }, [
    createForm.message,
    createForm.relatedId,
    createForm.relatedType,
    isLoadingRelatedOptions,
  ]);

  const createFormHint = useMemo(() => {
    const relatedType = String(createForm.relatedType || "").trim();
    const relatedId = String(createForm.relatedId || "").trim();
    const message = String(createForm.message || "").trim();

    if (!message) {
      return "Nhập nội dung cần hỗ trợ để tiếp tục";
    }

    if (relatedType && !relatedId) {
      return "Chọn đơn hàng cần hỗ trợ để tiếp tục";
    }

    if (isLoadingRelatedOptions) {
      return "Đang tải danh sách đơn hàng";
    }

    return "Đã đủ thông tin để tạo yêu cầu";
  }, [
    createForm.message,
    createForm.relatedId,
    createForm.relatedType,
    isLoadingRelatedOptions,
  ]);

  const scrollMessagesToBottom = (behavior = "smooth") => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const messageArea = messageAreaRef.current;

        if (!messageArea) {
          return;
        }

        const top = Math.max(
          0,
          messageArea.scrollHeight - messageArea.clientHeight
        );

        if (typeof messageArea.scrollTo === "function") {
          messageArea.scrollTo({ top, behavior });
          return;
        }

        messageArea.scrollTop = top;
      });
    });
  };

  const copyTextToClipboard = async (value) => {
    const text = String(value || "").trim();

    if (!text) {
      return false;
    }

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    return copied;
  };

  const handleCopyMessage = async (message, index) => {
    const content = getMessageContent(message);
    const attachmentUrls = getMessageAttachments(message);
    const valueToCopy = [content, ...attachmentUrls]
      .filter(Boolean)
      .join("\n");
    const messageId = String(getMessageId(message, index));

    try {
      const copied = await copyTextToClipboard(valueToCopy);

      if (!copied) {
        throw new Error("Không thể sao chép nội dung.");
      }

      setCopiedMessageId(messageId);
      notifySuccess("Đã sao chép", "Nội dung tin nhắn đã được sao chép.");

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => {
        setCopiedMessageId("");
      }, 1600);
    } catch (error) {
      notifyError(
        "Sao chép thất bại",
        error?.message || "Không thể sao chép nội dung tin nhắn."
      );
    }
  };

  const revokeAttachmentPreviews = (attachments = []) => {
    attachments.forEach((attachment) => {
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
  };

  const clearCreateAttachments = () => {
    setCreateAttachments((current) => {
      revokeAttachmentPreviews(current);
      return [];
    });
  };

  const clearMessageAttachments = () => {
    setMessageAttachments((current) => {
      revokeAttachmentPreviews(current);
      return [];
    });
  };

  const removeCreateAttachment = (attachmentId) => {
    setCreateAttachments((current) => {
      const removed = current.find((item) => item.id === attachmentId);

      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== attachmentId);
    });
  };

  const removeMessageAttachment = (attachmentId) => {
    setMessageAttachments((current) => {
      const removed = current.find((item) => item.id === attachmentId);

      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return current.filter((item) => item.id !== attachmentId);
    });
  };

  const uploadSelectedImages = async (attachments = []) => {
    if (!attachments.length) {
      return [];
    }

    const files = attachments
      .map((attachment) => attachment?.file)
      .filter(Boolean);

    if (!files.length) {
      return [];
    }

    const uploadResponse = await uploadImages(
      files,
      undefined,
      { showNotification: false },
    );

    const uploadedUrls = extractUploadUrls(uploadResponse);

    if (uploadedUrls.length < files.length) {
      throw new Error(
        `API chỉ trả về ${uploadedUrls.length}/${files.length} URL ảnh. Vui lòng kiểm tra response upload.`,
      );
    }

    return uploadedUrls.slice(0, files.length);
  };

  const updateConversationSummary = (
    conversationId,
    detail,
    messageList = []
  ) => {
    if (!conversationId) {
      return;
    }

    const latestMessage =
      messageList.length > 0
        ? messageList[messageList.length - 1]
        : null;

    const summary =
      detail && typeof detail === "object"
        ? { ...detail }
        : {};

    delete summary.messages;
    delete summary.conversationMessages;
    delete summary.data;

    const latestContent = latestMessage
      ? getMessageContent(latestMessage) ||
        (getMessageAttachment(latestMessage) ? "Đã gửi một hình ảnh" : "")
      : "";

    const latestTime = latestMessage
      ? getCreatedTime(latestMessage)
      : getCreatedTime(detail);

    setConversations((current) =>
      current.map((conversation) => {
        if (getConversationId(conversation) !== conversationId) {
          return conversation;
        }

        return {
          ...conversation,
          ...summary,
          ...(latestContent
            ? {
                lastMessage: latestContent,
                latestMessage: latestContent,
              }
            : {}),
          ...(latestTime
            ? {
                lastMessageAt: latestTime,
                latestMessageAt: latestTime,
                lastMessageAtUtc: normalizeApiTimeToUtc(latestTime),
                latestMessageAtUtc: normalizeApiTimeToUtc(latestTime),
              }
            : {}),
          unreadCount: 0,
          unreadMessages: 0,
          unread: 0,
        };
      })
    );
  };

  const loadConversations = async () => {
    setIsLoadingList(true);
    setErrorMessage("");

    try {
      const response = await getConversationsApi();
      const list = normalizeConversationList(response)
        .map(normalizeConversationTime)
        .sort((firstConversation, secondConversation) => {
          return (
            getTimeValue(secondConversation) - getTimeValue(firstConversation)
          );
        });

      setConversations(list);

      const activeConversationId =
        selectedConversationIdRef.current || selectedConversationId;

      if (!activeConversationId && list.length > 0) {
        const firstConversation = list[0];
        const firstId = getConversationId(firstConversation);

        if (firstId) {
          selectedConversationIdRef.current = firstId;
          setSelectedConversation(firstConversation);
          setSelectedConversationId(firstId);
        }
      }
    } catch (error) {
      setErrorMessage(
        getApiErrorText(error, "Không thể tải danh sách cuộc trò chuyện.")
      );
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadConversationDetail = async (conversationId) => {
    if (!conversationId) {
      return;
    }

    detailAbortRef.current?.abort();

    const controller = new AbortController();
    const requestVersion = ++detailRequestVersionRef.current;

    detailAbortRef.current = controller;

    setIsLoadingDetail(true);
    setErrorMessage("");

    try {
      const response = await getConversationDetailApi(conversationId, {
        signal: controller.signal,
      });

      if (
        controller.signal.aborted ||
        requestVersion !== detailRequestVersionRef.current ||
        conversationId !== selectedConversationIdRef.current
      ) {
        return;
      }

      const detail = normalizeConversationDetailTime(
        normalizeConversationDetail(response)
      );
      const messageList = normalizeMessages(detail);

      setSelectedConversation(detail);
      setMessages(messageList);
      messagesSignatureRef.current = getMessagesSignature(messageList);
      updateConversationSummary(conversationId, detail, messageList);

      try {
        await markConversationAsReadApi(conversationId);
        updateConversationSummary(conversationId, detail, messageList);
      } catch {
        // Không chặn UI nếu đánh dấu đã đọc lỗi.
      }
    } catch (error) {
      if (
        error?.code === "ERR_CANCELED" ||
        error?.name === "CanceledError" ||
        error?.name === "AbortError"
      ) {
        return;
      }

      if (requestVersion !== detailRequestVersionRef.current) {
        return;
      }

      setErrorMessage(
        getApiErrorText(error, "Không thể tải chi tiết cuộc trò chuyện.")
      );
    } finally {
      if (
        detailAbortRef.current === controller &&
        requestVersion === detailRequestVersionRef.current
      ) {
        setIsLoadingDetail(false);
        detailAbortRef.current = null;
      }
    }
  };

  const refreshConversationSilently = async (
    conversationId,
    options = {}
  ) => {
    if (!conversationId || isSilentRefreshingRef.current) {
      return;
    }

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    isSilentRefreshingRef.current = true;

    try {
      const detailResponse = await getConversationDetailApi(conversationId);

      if (conversationId !== selectedConversationIdRef.current) {
        return;
      }

      const detail = normalizeConversationDetailTime(
        normalizeConversationDetail(detailResponse)
      );
      const messageList = normalizeMessages(detail);
      const nextSignature = getMessagesSignature(messageList);
      const hasChanged = nextSignature !== messagesSignatureRef.current;

      setSelectedConversation(detail);
      updateConversationSummary(conversationId, detail, messageList);

      if (hasChanged || options.forceUpdate) {
        setMessages(messageList);
        messagesSignatureRef.current = nextSignature;

        scrollMessagesToBottom(
          options.forceScroll ? "smooth" : "auto"
        );

        try {
          await markConversationAsReadApi(conversationId);
          updateConversationSummary(conversationId, detail, messageList);
        } catch {
          // Không chặn UI nếu đánh dấu đã đọc lỗi.
        }
      }
    } catch (error) {
      console.debug(
        "Silent chat refresh failed:",
        error?.response?.data || error?.message
      );
    } finally {
      isSilentRefreshingRef.current = false;
    }
  };

  const loadRelatedOptions = async (relatedType) => {
    const type = String(relatedType || "").trim();

    setRelatedOptions([]);

    if (!type) {
      return;
    }

    const loader = RELATED_TYPE_LOADERS[type];

    if (!loader) {
      setErrorMessage("Loại liên kết không hợp lệ.");
      return;
    }

    setIsLoadingRelatedOptions(true);
    setErrorMessage("");

    try {
      const response = await loader();
      const list = normalizeRelatedList(response);

      const options = list
        .map((item) => {
          const id = getRelatedItemId(item, type);

          if (!id) {
            return null;
          }

          return {
            value: String(id),
            label: getRelatedItemLabel(item, type),
            raw: item,
          };
        })
        .filter(Boolean);

      setRelatedOptions(options);

      if (options.length === 0) {
        setErrorMessage(
          `Không tìm thấy dữ liệu ${
            RELATED_TYPE_LABELS[type] || "liên kết"
          }.`
        );
      }
    } catch (error) {
      setErrorMessage(
        getApiErrorText(error, "Không thể tải danh sách mã liên kết.")
      );
    } finally {
      setIsLoadingRelatedOptions(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(
      () => loadConversations(),
      0
    );

    return () => {
      window.clearTimeout(loadTimer);
      detailAbortRef.current?.abort();

      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId) {
      const detailTimer =
        window.setTimeout(
          () =>
            loadConversationDetail(
              selectedConversationId
            ),
          0
        );

      return () =>
        window.clearTimeout(
          detailTimer
        );
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  useEffect(() => {
    const relatedTimer = window.setTimeout(
      () =>
        loadRelatedOptions(
          createForm.relatedType
        ),
      0
    );

    return () =>
      window.clearTimeout(relatedTimer);
  }, [createForm.relatedType]);

  useEffect(() => {
    if (!isLoadingDetail) {
      scrollMessagesToBottom("auto");
    }
  }, [messages.length, selectedConversationId, isLoadingDetail]);

  useEffect(() => {
    if (!selectedConversationId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshConversationSilently(selectedConversationId);
    }, MESSAGE_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  const handleOpenCreateModal = () => {
    setErrorMessage("");
    setRelatedOptions([]);
    setCreateForm(INITIAL_CREATE_FORM);
    clearCreateAttachments();
    setIsCreateOpen(true);
  };

  const handleCloseCreateModal = () => {
    if (isCreating) {
      return;
    }

    setIsCreateOpen(false);
    setRelatedOptions([]);
    setCreateForm(INITIAL_CREATE_FORM);
    clearCreateAttachments();
  };

  const handleSelectConversation = (conversation) => {
    const id = getConversationId(conversation);

    if (!id || id === selectedConversationIdRef.current) {
      return;
    }

    detailAbortRef.current?.abort();
    detailRequestVersionRef.current += 1;
    selectedConversationIdRef.current = id;
    messagesSignatureRef.current = "";

    setErrorMessage("");
    setSelectedConversation(normalizeConversationTime(conversation));
    setMessages([]);
    setMessageForm(INITIAL_MESSAGE_FORM);
    clearMessageAttachments();
    setIsLoadingDetail(true);
    setSelectedConversationId(id);

    setConversations((current) =>
      current.map((item) =>
        getConversationId(item) === id
          ? {
              ...item,
              unreadCount: 0,
              unreadMessages: 0,
              unread: 0,
            }
          : item
      )
    );
  };

  const handleMessageChange = (event) => {
    const { name, value } = event.target;

    setMessageForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const appendImageAttachment = ({
    file,
    setAttachments,
    title,
  }) => {
    if (!file) {
      return false;
    }

    try {
      validateImageFile(file);

      setAttachments((current) => {
        const attachmentId =
          String(file?.uid || "").trim() ||
          `${file?.name || "image"}-${file?.size || 0}-${file?.lastModified || 0}`;

        const isDuplicate = current.some(
          (item) =>
            item.id === attachmentId ||
            (
              item.file?.name === file.name &&
              item.file?.size === file.size &&
              item.file?.lastModified === file.lastModified
            ),
        );

        if (isDuplicate) {
          return current;
        }

        if (current.length >= MAX_IMAGE_COUNT) {
          window.queueMicrotask(() => {
            notifyWarning(
              "Đã đạt giới hạn ảnh",
              `Chỉ được đính kèm tối đa ${MAX_IMAGE_COUNT} ảnh.`,
            );
          });

          return current;
        }

        const nextAttachments = [
          ...current,
          createAttachmentItem(file),
        ];

        window.queueMicrotask(() => {
          notifySuccess(
            "Đã chọn ảnh",
            `Đã chọn ${nextAttachments.length}/${MAX_IMAGE_COUNT} ảnh.`,
          );
        });

        return nextAttachments;
      });

      setErrorMessage("");
    } catch (error) {
      const errorText = error?.message || "Không thể chọn ảnh.";

      setErrorMessage(errorText);
      notifyError(title, errorText);
    }

    return false;
  };

  const handlePickCreateImage = (file) => {
    return appendImageAttachment({
      file,
      setAttachments: setCreateAttachments,
      title: "Không thể chọn ảnh yêu cầu",
    });
  };

  const handlePickMessageImage = (file) => {
    return appendImageAttachment({
      file,
      setAttachments: setMessageAttachments,
      title: "Không thể chọn ảnh tin nhắn",
    });
  };

  const updateCreateField = (name, value) => {
    setCreateForm((current) => {
      if (name === "relatedType") {
        return {
          ...current,
          relatedType: value,
          relatedId: "",
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  };

  const handleMessagePressEnter = (event) => {
    if (event.shiftKey || event.nativeEvent?.isComposing) {
      return;
    }

    event.preventDefault();

    if (
      !isSending &&
      (messageForm.content.trim() || messageAttachments.length > 0)
    ) {
      handleSendMessage(event);
    }
  };

  const handleCreateConversation = async (event) => {
    event.preventDefault();

    setIsCreating(true);
    setErrorMessage("");

    const relatedType = String(createForm.relatedType || "").trim();
    const relatedId = String(createForm.relatedId || "").trim();
    const message = String(createForm.message || "").trim();

    if (!message) {
      const errorText = "Vui lòng nhập nội dung cần hỗ trợ.";

      setErrorMessage(errorText);
      notifyError("Tạo cuộc trò chuyện thất bại", errorText);
      setIsCreating(false);
      return;
    }

    if (relatedType && !relatedId) {
      const errorText = "Vui lòng chọn mã liên kết từ danh sách.";

      setErrorMessage(errorText);
      notifyError("Tạo cuộc trò chuyện thất bại", errorText);
      setIsCreating(false);
      return;
    }

    try {
      const attachmentUrls = await uploadSelectedImages(createAttachments);
      const timePayload = getClientTimePayload();

      const requestPayload = {
        relatedType: relatedType || null,
        relatedId: relatedType ? relatedId : null,
        message,
        attachmentUrl: attachmentUrls[0] || null,
        createdAtUtc: timePayload.createdAtUtc,
        clientCreatedAtUtc: timePayload.clientCreatedAtUtc,
        clientTimeZone: timePayload.clientTimeZone,
        clientUtcOffset: timePayload.clientUtcOffset,
        clientUtcOffsetMinutes: timePayload.clientUtcOffsetMinutes,
      };

      const response = await createConversationApi(requestPayload);
      const data = unwrapApiData(response);

      const conversationId =
        data?.id ||
        data?.conversationId ||
        data?.conversation?.id ||
        data?.conversation?.conversationId;

      let remainingImageError = "";

      /*
       * API hội thoại cũ chỉ nhận một attachmentUrl.
       * Ảnh đầu tiên đi cùng tin nhắn tạo hội thoại; các ảnh còn lại
       * được gửi thành từng tin nhắn ảnh để đảm bảo không bị mất ảnh.
       */
      if (!conversationId && attachmentUrls.length > 1) {
        remainingImageError =
          "API tạo hội thoại không trả về conversationId nên các ảnh bổ sung chưa thể gửi.";
      }

      if (conversationId && attachmentUrls.length > 1) {
        try {
          for (const attachmentUrl of attachmentUrls.slice(1)) {
            const extraTimePayload = getClientTimePayload();

            await sendConversationMessageApi(String(conversationId), {
              content: "",
              attachmentUrl,
              sentAtUtc: extraTimePayload.sentAtUtc,
              clientSentAtUtc: extraTimePayload.clientSentAtUtc,
              clientTimeZone: extraTimePayload.clientTimeZone,
              clientUtcOffset: extraTimePayload.clientUtcOffset,
              clientUtcOffsetMinutes:
                extraTimePayload.clientUtcOffsetMinutes,
            });
          }
        } catch (error) {
          remainingImageError = getApiErrorText(
            error,
            "Một số ảnh bổ sung chưa gửi được.",
          );
        }
      }

      setCreateForm(INITIAL_CREATE_FORM);
      clearCreateAttachments();
      setRelatedOptions([]);
      setIsCreateOpen(false);

      notifySuccess(
        "Tạo cuộc trò chuyện thành công",
        attachmentUrls.length
          ? `Đã gửi kèm ${attachmentUrls.length} ảnh.`
          : "Bạn có thể bắt đầu trao đổi với CSKH.",
      );

      if (remainingImageError) {
        notifyWarning("Ảnh gửi chưa đầy đủ", remainingImageError);
      }

      await loadConversations();

      if (conversationId) {
        const nextConversationId = String(conversationId);

        detailAbortRef.current?.abort();
        detailRequestVersionRef.current += 1;
        selectedConversationIdRef.current = nextConversationId;
        messagesSignatureRef.current = "";
        setSelectedConversation(null);
        setMessages([]);
        setSelectedConversationId(nextConversationId);
      }
    } catch (error) {
      console.error("CREATE CONVERSATION ERROR:", {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });

      const errorText = getApiErrorText(
        error,
        "Không thể tạo cuộc trò chuyện."
      );

      setErrorMessage(errorText);

      notifyError(
        "Tạo cuộc trò chuyện thất bại",
        errorText
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if (!selectedConversationId || isSending) {
      return;
    }

    const content = messageForm.content.trim();

    if (!content && messageAttachments.length === 0) {
      const errorText = "Vui lòng nhập nội dung hoặc chọn ít nhất một ảnh.";

      setErrorMessage(errorText);
      notifyWarning("Chưa có nội dung gửi", errorText);
      return;
    }

    setIsSending(true);
    setErrorMessage("");

    try {
      const attachmentUrls = await uploadSelectedImages(messageAttachments);
      const messageItems = attachmentUrls.length
        ? attachmentUrls
        : [null];

      for (let index = 0; index < messageItems.length; index += 1) {
        const attachmentUrl = messageItems[index];
        const timePayload = getClientTimePayload();

        await sendConversationMessageApi(selectedConversationId, {
          content: index === 0 ? content : "",
          attachmentUrl,
          sentAtUtc: timePayload.sentAtUtc,
          clientSentAtUtc: timePayload.clientSentAtUtc,
          clientTimeZone: timePayload.clientTimeZone,
          clientUtcOffset: timePayload.clientUtcOffset,
          clientUtcOffsetMinutes: timePayload.clientUtcOffsetMinutes,
        });
      }

      setMessageForm(INITIAL_MESSAGE_FORM);
      clearMessageAttachments();

      notifySuccess(
        "Gửi tin nhắn thành công",
        attachmentUrls.length
          ? `Đã gửi nội dung cùng ${attachmentUrls.length} ảnh.`
          : isSaleViewer
            ? "Tin nhắn đã được gửi đến khách hàng."
            : "Tin nhắn đã được gửi đến nhân viên Sale.",
      );

      await refreshConversationSilently(selectedConversationId, {
        forceUpdate: true,
        forceScroll: true,
      });
    } catch (error) {
      const errorText = getApiErrorText(error, "Không thể gửi tin nhắn.");

      setErrorMessage(errorText);
      notifyError("Gửi tin nhắn thất bại", errorText);
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkRead = async () => {
    if (!selectedConversationId) {
      return;
    }

    try {
      await markConversationAsReadApi(selectedConversationId);

      setConversations((current) =>
        current.map((conversation) =>
          getConversationId(conversation) === selectedConversationId
            ? {
                ...conversation,
                unreadCount: 0,
                unreadMessages: 0,
                unread: 0,
              }
            : conversation
        )
      );
    } catch (error) {
      setErrorMessage(getApiErrorText(error, "Không thể đánh dấu đã đọc."));
    }
  };

  const handleRefresh = async () => {
    await loadConversations();

    if (selectedConversationId) {
      await loadConversationDetail(selectedConversationId);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          colorInfo: "#2563eb",
          colorSuccess: "#16a34a",
          colorError: "#d34f4f",
          colorText: "#1e293b",
          colorTextSecondary: "#64748b",
          borderRadius: 12,
          controlHeight: 44,
          fontFamily:
            'Inter, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        },
        components: {
          Button: {
            fontWeight: 800,
            primaryShadow: "0 12px 26px rgba(37, 99, 235, 0.24)",
          },
          Input: {
            activeBorderColor: "#2563eb",
            hoverBorderColor: "#93c5fd",
          },
          Select: {
            activeBorderColor: "#2563eb",
            hoverBorderColor: "#93c5fd",
            optionSelectedBg: "#eff6ff",
          },
          Modal: {
            borderRadiusLG: 24,
          },
        },
      }}
    >
      <div className="cskh-chat-page">
        <div className="cskh-chat-bg cskh-chat-bg--one" />
        <div className="cskh-chat-bg cskh-chat-bg--two" />

        <section className="cskh-chat-shell">
          <aside className="cskh-chat-sidebar">
            <div className="cskh-chat-sidebar__header">
              <div>
                <p className="cskh-chat-eyebrow">CHĂM SÓC KHÁCH HÀNG</p>
                <h2>
                  {isSaleViewer
                    ? "Hộp thư khách hàng"
                    : "Trung tâm hỗ trợ"}
                </h2>
                <span>
                  {isSaleViewer
                    ? "Tiếp nhận yêu cầu và trao đổi trực tiếp với khách hàng."
                    : "Trao đổi trực tiếp và theo dõi phản hồi từ nhân viên Sale."}
                </span>
              </div>

              <Tooltip title="Làm mới dữ liệu">
                <Button
                  type="text"
                  shape="circle"
                  className="cskh-icon-button"
                  icon={<ReloadOutlined spin={isLoadingList || isLoadingDetail} />}
                  onClick={handleRefresh}
                  disabled={isLoadingList || isLoadingDetail}
                  aria-label="Làm mới danh sách trò chuyện"
                />
              </Tooltip>
            </div>

            {!isSaleViewer && (
              <Button
                type="primary"
                className="cskh-create-button"
                icon={<PlusOutlined />}
                onClick={handleOpenCreateModal}
                block
              >
                Tạo cuộc trò chuyện
              </Button>
            )}

            {errorMessage && !isCreateOpen && (
              <Alert
                className="cskh-alert"
                type="error"
                showIcon
                closable
                message={errorMessage}
                onClose={() => setErrorMessage("")}
              />
            )}

            <div
              className="cskh-conversation-list"
              tabIndex={0}
              role="region"
              aria-label="Danh sách cuộc trò chuyện"
            >
              {isLoadingList && (
                <div className="cskh-state-box">
                  <Spin size="small" />
                  <span>Đang tải danh sách...</span>
                </div>
              )}

              {!isLoadingList && !hasConversation && (
                <Empty
                  className="cskh-empty cskh-empty--sidebar"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span>
                      Chưa có cuộc trò chuyện.
                      <br />
                      {isSaleViewer
                        ? "Chưa có yêu cầu mới từ khách hàng."
                        : "Hãy tạo yêu cầu hỗ trợ mới."}
                    </span>
                  }
                />
              )}

              {!isLoadingList &&
                conversations.map((conversation) => {
                  const id = getConversationId(conversation);
                  const unreadCount = getUnreadCount(conversation);
                  const isActive = id === selectedConversationId;
                  const staffName = getStaffDisplayName(conversation);

                  return (
                    <button
                      key={id}
                      type="button"
                      className={[
                        "cskh-conversation-item",
                        isActive && "is-active",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleSelectConversation(conversation)}
                      aria-busy={isActive && isLoadingDetail}
                    >
                      <Avatar
                        size={44}
                        className="cskh-conversation-avatar"
                        icon={<MessageFilled />}
                      />

                      <span className="cskh-conversation-main">
                        <span className="cskh-conversation-top">
                          <strong>{getConversationTitle(conversation)}</strong>
                          <em>{formatDateTime(getCreatedTime(conversation))}</em>
                        </span>

                        <span className="cskh-conversation-subtitle">
                          {getConversationSubtitle(conversation)}
                        </span>

                        {staffName && (
                          <span className="cskh-staff-line">
                            <MessageFilled />
                            {staffName}
                          </span>
                        )}

                        <span className="cskh-conversation-message">
                          {getConversationLastMessage(conversation)}
                        </span>
                      </span>

                      {unreadCount > 0 && (
                        <Badge
                          count={unreadCount}
                          overflowCount={99}
                          className="cskh-unread-badge"
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          </aside>

          <main
            className={[
              "cskh-chat-main",
              hasSelectedConversation ? "has-conversation" : "is-empty",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {!hasSelectedConversation && (
              <div className="cskh-welcome-panel">
                <div className="cskh-welcome-icon">
                  <MessageOutlined />
                </div>

                <span className="cskh-welcome-kicker">HỖ TRỢ TRỰC TUYẾN</span>
                <h1>
                  {isSaleViewer
                    ? "Chọn khách hàng cần hỗ trợ"
                    : "Chúng tôi luôn sẵn sàng hỗ trợ"}
                </h1>

                <p>
                  {isSaleViewer
                    ? "Chọn một cuộc trò chuyện bên trái để xem lịch sử và phản hồi khách hàng."
                    : "Chọn một cuộc trò chuyện bên trái hoặc tạo yêu cầu mới để bắt đầu trao đổi với nhân viên Sale."}
                </p>

                {!isSaleViewer && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    className="cskh-welcome-button"
                    onClick={handleOpenCreateModal}
                  >
                    Tạo cuộc trò chuyện
                  </Button>
                )}
              </div>
            )}

            {hasSelectedConversation && (
              <>
                <header className="cskh-chat-main__header">
                  <div className="cskh-chat-title">
                    <Avatar
                      size={46}
                      className="cskh-chat-title__avatar"
                      icon={<MessageFilled />}
                    />

                    <div className="cskh-chat-title__content">
                      <h1>{selectedConversationTitle}</h1>

                      <div
  className="cskh-chat-title__status"
  style={{
    display: "flex",
    alignItems: "center",
    marginTop: 6,
  }}
>
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 14px",
      borderRadius: 999,
      background: "#ecfdf5",
      border: "1px solid #bbf7d0",
      color: "#166534",
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(34,197,94,.08)",
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#22c55e",
        boxShadow: "0 0 0 4px rgba(34,197,94,.18)",
        animation: "onlinePulse 1.8s infinite",
      }}
    />
    {hasAssignedStaff(selectedConversation)
      ? `Nhân viên: ${getStaffDisplayName(selectedConversation)}`
      : "Đang hỗ trợ trực tuyến"}
  </div>
</div>
                    </div>
                  </div>

                  <Tooltip title="Đánh dấu cuộc trò chuyện đã đọc">
                    <Button
                      type="default"
                      className="cskh-read-button"
                      icon={<CheckCircleOutlined />}
                      onClick={handleMarkRead}
                    >
                      <span className="cskh-read-button__label">Đã đọc</span>
                    </Button>
                  </Tooltip>
                </header>

                <section
                  ref={messageAreaRef}
                  className="cskh-message-area"
                  tabIndex={0}
                  role="log"
                  aria-live="polite"
                  aria-label="Nội dung cuộc trò chuyện"
                >
                  {isLoadingDetail && (
                    <div className="cskh-loading-overlay">
                      <Spin />
                      <span>Đang tải tin nhắn...</span>
                    </div>
                  )}

                  {!isLoadingDetail && messages.length === 0 && (
                    <div className="cskh-empty cskh-empty--messages">
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span>
                            Chưa có tin nhắn.
                            <br />
                            Hãy gửi nội dung đầu tiên để bắt đầu trao đổi.
                          </span>
                        }
                      />
                    </div>
                  )}

                  {!isLoadingDetail &&
                    messages.map((item, index) => {
                      const mine = isMessageMine(
                        item,
                        currentUserId,
                        currentUserRole
                      );
                      const content = getMessageContent(item);
                      const attachmentUrls = getMessageAttachments(item);
                      const messageId = String(getMessageId(item, index));
                      const isCopied = copiedMessageId === messageId;

                      return (
                        <div
                          key={messageId}
                          className={[
                            "cskh-message-row",
                            mine ? "is-mine" : "is-other",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {!mine && (
                            <Avatar
                              size={34}
                              className="cskh-message-avatar"
                              icon={<MessageFilled />}
                            />
                          )}

                          <div className="cskh-message-group">
                            <div className="cskh-message-bubble">
                              <div className="cskh-message-meta">
                                <div className="cskh-message-meta__identity">
                                  <strong>
                                    {getViewerMessageLabel(
                                      mine,
                                      currentUserRole,
                                      currentUserName,
                                      item
                                    )}
                                  </strong>
                                  <span>{formatDateTime(getCreatedTime(item))}</span>
                                </div>

                                {(content || attachmentUrls.length > 0) && (
                                  <Tooltip
                                    title={
                                      isCopied
                                        ? "Đã sao chép"
                                        : "Sao chép nội dung"
                                    }
                                  >
                                    <Button
                                      type="text"
                                      shape="circle"
                                      size="small"
                                      className={[
                                        "cskh-message-copy-button",
                                        isCopied && "is-copied",
                                      ]
                                        .filter(Boolean)
                                        .join(" ")}
                                      icon={
                                        isCopied ? (
                                          <CheckCircleOutlined />
                                        ) : (
                                          <CopyOutlined />
                                        )
                                      }
                                      onClick={() =>
                                        handleCopyMessage(item, index)
                                      }
                                      aria-label="Sao chép tin nhắn"
                                    />
                                  </Tooltip>
                                )}
                              </div>

                              {content && <p>{content}</p>}

                              {attachmentUrls.length > 0 && (
                                <div
                                  className={[
                                    "cskh-attachment-grid",
                                    attachmentUrls.length === 1 &&
                                      "has-single-image",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  {attachmentUrls.map((attachmentUrl, imageIndex) => (
                                    <a
                                      key={`${attachmentUrl}-${imageIndex}`}
                                      className="cskh-attachment-preview"
                                      href={attachmentUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {isImageUrl(attachmentUrl) ? (
                                        <img
                                          src={attachmentUrl}
                                          alt={`Ảnh đính kèm ${imageIndex + 1}`}
                                          onLoad={() =>
                                            scrollMessagesToBottom("auto")
                                          }
                                        />
                                      ) : (
                                        <span>
                                          <PaperClipOutlined />
                                          Xem tệp đính kèm
                                        </span>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  <div className="cskh-messages-end" aria-hidden="true" />
                </section>

                <form className="cskh-send-form" onSubmit={handleSendMessage}>
                  {messageAttachments.length > 0 && (
                    <div className="cskh-selected-images">
                      <div className="cskh-selected-images__header">
                        <strong>
                          Ảnh đã chọn ({messageAttachments.length}/{MAX_IMAGE_COUNT})
                        </strong>

                        <Button
                          type="text"
                          size="small"
                          danger
                          onClick={clearMessageAttachments}
                          disabled={isSending}
                        >
                          Xóa tất cả
                        </Button>
                      </div>

                      <div className="cskh-selected-images__grid">
                        {messageAttachments.map((attachment, index) => (
                          <div
                            key={attachment.id}
                            className="cskh-selected-image-card"
                          >
                            <img
                              src={attachment.previewUrl}
                              alt={`Ảnh chuẩn bị gửi ${index + 1}`}
                            />

                            <Tooltip title="Xóa ảnh">
                              <Button
                                type="text"
                                shape="circle"
                                danger
                                className="cskh-selected-image-card__remove"
                                icon={<DeleteOutlined />}
                                onClick={() =>
                                  removeMessageAttachment(attachment.id)
                                }
                                disabled={isSending}
                              />
                            </Tooltip>

                            <span title={attachment.name}>
                              {attachment.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="cskh-message-input-row">
                    <Tooltip title="Đính kèm ảnh">
                      <Upload
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        maxCount={MAX_IMAGE_COUNT}
                        showUploadList={false}
                        beforeUpload={handlePickMessageImage}
                        disabled={
                          isSending ||
                          messageAttachments.length >= MAX_IMAGE_COUNT
                        }
                      >
                        <Button
                          type="text"
                          shape="circle"
                          className="cskh-upload-button"
                          icon={<PictureOutlined />}
                          disabled={
                            isSending ||
                            messageAttachments.length >= MAX_IMAGE_COUNT
                          }
                          aria-label={`Chọn ảnh, tối đa ${MAX_IMAGE_COUNT} ảnh`}
                        />
                      </Upload>
                    </Tooltip>

                    <Input.TextArea
                      name="content"
                      value={messageForm.content}
                      onChange={handleMessageChange}
                      onPressEnter={handleMessagePressEnter}
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      maxLength={2000}
                      placeholder="Nhập tin nhắn... (Enter để gửi, Shift + Enter để xuống dòng)"
                      disabled={isSending}
                      className="cskh-message-input"
                    />

                    <Button
                      htmlType="submit"
                      type="primary"
                      className="cskh-send-button"
                      icon={<SendOutlined />}
                      loading={isSending}
                      disabled={
                        isSending ||
                        (
                          !messageForm.content.trim() &&
                          messageAttachments.length === 0
                        )
                      }
                    >
                      <span>Gửi</span>
                    </Button>
                  </div>
                </form>
              </>
            )}
          </main>
        </section>

        <Modal
          open={!isSaleViewer && isCreateOpen}
          centered
          width={590}
          className="cskh-create-modal"
          wrapClassName="cskh-create-modal-wrap"
          title={null}
          footer={null}
          closeIcon={null}
          mask={{ closable: !isCreating }}
          keyboard={!isCreating}
          onCancel={handleCloseCreateModal}
          destroyOnHidden={false}
        >
          <form
            className="cskh-create-modal__form"
            onSubmit={handleCreateConversation}
          >
            <div className="cskh-create-modal__header">
              <div className="cskh-create-modal__header-icon">
                <MessageFilled />
              </div>

              <div>
                <span>HỖ TRỢ KHÁCH HÀNG</span>
                <h2>Tạo yêu cầu hỗ trợ</h2>
                <p>
                  Chọn đơn hàng liên quan và mô tả rõ nội dung để nhân viên
                  hỗ trợ bạn nhanh hơn.
                </p>
              </div>

              <Tooltip title="Đóng">
                <Button
                  type="text"
                  shape="circle"
                  className="cskh-create-modal__close"
                  icon={<CloseOutlined />}
                  onClick={handleCloseCreateModal}
                  disabled={isCreating}
                  aria-label="Đóng cửa sổ"
                />
              </Tooltip>
            </div>

            <div className="cskh-create-modal__body">
              {errorMessage && (
                <Alert
                  type="error"
                  showIcon
                  closable
                  message={errorMessage}
                  onClose={() => setErrorMessage("")}
                />
              )}

              <div className="cskh-form-field">
                <label htmlFor="cskh-related-type">
                  Liên kết với loại yêu cầu
                  <span className="cskh-form-field__optional">Tùy chọn</span>
                </label>

                <Select
                  id="cskh-related-type"
                  value={createForm.relatedType}
                  onChange={(value) => updateCreateField("relatedType", value)}
                  options={RELATED_TYPE_OPTIONS}
                  disabled={isCreating}
                  placeholder="Chọn loại yêu cầu"
                  className="cskh-form-control"
                />

                <small>
                  Có thể chọn “Không liên kết” khi cần hỗ trợ chung.
                </small>
              </div>

              <div className="cskh-form-field">
                <label htmlFor="cskh-related-id">
                  Đơn hàng cần hỗ trợ
                  {createForm.relatedType && <b>*</b>}
                </label>

                <Select
                  id="cskh-related-id"
                  showSearch
                  allowClear
                  value={createForm.relatedId || undefined}
                  onChange={(value) =>
                    updateCreateField("relatedId", value || "")
                  }
                  options={relatedOptions.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  optionFilterProp="label"
                  loading={isLoadingRelatedOptions}
                  disabled={
                    isCreating ||
                    !createForm.relatedType ||
                    isLoadingRelatedOptions ||
                    relatedOptions.length === 0
                  }
                  placeholder={
                    isLoadingRelatedOptions
                      ? "Đang tải danh sách..."
                      : createForm.relatedType
                        ? "Chọn yêu cầu cần hỗ trợ"
                        : "Chọn loại yêu cầu trước"
                  }
                  notFoundContent={
                    isLoadingRelatedOptions ? (
                      <div className="cskh-select-loading">
                        <Spin size="small" />
                        <span>Đang tải...</span>
                      </div>
                    ) : (
                      "Không tìm thấy dữ liệu"
                    )
                  }
                  className="cskh-form-control"
                />

                <small>Chọn đúng đơn hàng để nhân viên tra cứu nhanh hơn.</small>
              </div>

              <div className="cskh-form-field">
                <label htmlFor="cskh-create-message">
                  Nội dung cần hỗ trợ <b>*</b>
                  <span className="cskh-form-field__counter">
                    {createForm.message.length}/1000
                  </span>
                </label>

                <Input.TextArea
                  id="cskh-create-message"
                  value={createForm.message}
                  onChange={(event) =>
                    updateCreateField("message", event.target.value)
                  }
                  autoSize={{ minRows: 5, maxRows: 8 }}
                  maxLength={1000}
                  disabled={isCreating}
                  placeholder="Ví dụ: Tôi muốn kiểm tra tình trạng báo giá hoặc cần hỗ trợ cập nhật thông tin đơn hàng..."
                  className="cskh-create-textarea"
                />
              </div>

              <div className="cskh-create-upload">
                <div>
                  <strong>Ảnh đính kèm</strong>
                  <span>
                    PNG, JPG hoặc WEBP, tối đa {MAX_IMAGE_COUNT} ảnh,
                    mỗi ảnh không quá {MAX_IMAGE_SIZE_MB}MB.
                  </span>
                </div>

                <Upload
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  maxCount={MAX_IMAGE_COUNT}
                  showUploadList={false}
                  beforeUpload={handlePickCreateImage}
                  disabled={
                    isCreating ||
                    createAttachments.length >= MAX_IMAGE_COUNT
                  }
                >
                  <Button
                    type="default"
                    icon={<PictureOutlined />}
                    disabled={
                      isCreating ||
                      createAttachments.length >= MAX_IMAGE_COUNT
                    }
                  >
                    {createAttachments.length >= MAX_IMAGE_COUNT
                      ? "Đã đủ ảnh"
                      : "Chọn ảnh"}
                  </Button>
                </Upload>
              </div>

              {createAttachments.length > 0 && (
                <div className="cskh-selected-images cskh-selected-images--modal">
                  <div className="cskh-selected-images__header">
                    <strong>
                      Ảnh đã chọn ({createAttachments.length}/{MAX_IMAGE_COUNT})
                    </strong>

                    <Button
                      type="text"
                      size="small"
                      danger
                      onClick={clearCreateAttachments}
                      disabled={isCreating}
                    >
                      Xóa tất cả
                    </Button>
                  </div>

                  <div className="cskh-selected-images__grid">
                    {createAttachments.map((attachment, index) => (
                      <div
                        key={attachment.id}
                        className="cskh-selected-image-card"
                      >
                        <img
                          src={attachment.previewUrl}
                          alt={`Ảnh yêu cầu hỗ trợ ${index + 1}`}
                        />

                        <Tooltip title="Xóa ảnh">
                          <Button
                            type="text"
                            shape="circle"
                            danger
                            className="cskh-selected-image-card__remove"
                            icon={<DeleteOutlined />}
                            onClick={() =>
                              removeCreateAttachment(attachment.id)
                            }
                            disabled={isCreating}
                          />
                        </Tooltip>

                        <span title={attachment.name}>
                          {attachment.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="cskh-create-modal__footer">
              <div
                className={[
                  "cskh-create-modal__footer-status",
                  isCreateFormValid && "is-ready",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isCreateFormValid && <CheckCircleOutlined />}
                <span>{createFormHint}</span>
              </div>

              <Button
                type="default"
                onClick={handleCloseCreateModal}
                disabled={isCreating}
              >
                Hủy
              </Button>

              <Button
                htmlType="submit"
                type="primary"
                icon={<PlusOutlined />}
                loading={isCreating}
                disabled={!isCreateFormValid || isCreating}
                className={[
                  "cskh-create-modal__submit",
                  isCreateFormValid && !isCreating && "is-ready",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isCreating ? "Đang tạo..." : "Tạo cuộc trò chuyện"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
