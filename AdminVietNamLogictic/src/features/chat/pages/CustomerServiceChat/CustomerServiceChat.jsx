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
  CaretDownOutlined,
  CaretRightOutlined,
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
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  useLocation,
} from "react-router-dom";
import {
  createConversationApi,
  getConversationDetailApi,
  getConversationsApi,
  markConversationAsReadApi,
  sendConversationMessageApi,
} from "@features/chat/api/conversationApi";
/* Upload ảnh THẬT (POST /api/uploads/images) qua lớp mỏng trên @shared/api/uploadImage. */
import { uploadChatImages } from "@features/chat/api/chatImageUploadApi";
import SalesAiAssistantPanel from "@features/chat/components/SalesAiAssistantPanel/SalesAiAssistantPanel";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";

import {
  CONVERSATION_LIST_POLL_INTERVAL_MS,
  INITIAL_CREATE_FORM,
  INITIAL_MESSAGE_FORM,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_MB,
  MESSAGE_POLL_INTERVAL_MS,
  RELATED_TYPE_LABELS,
  RELATED_TYPE_LOADERS,
  RELATED_TYPE_OPTIONS,
} from "./CustomerServiceChat.constants";

import {
  buildAiContextFromConversation,
  buildAiPrefillFromLocation,
  buildConversationGroups,
  buildMessageTimeline,
  createAttachmentItem,
  extractUploadUrls,
  formatDateTime,
  formatMessageTime,
  getApiErrorText,
  getConversationId,
  getConversationLastMessage,
  getConversationSubtitle,
  getConversationTitle,
  getCreatedTime,
  getCurrentUserId,
  getCurrentUserName,
  getCurrentUserRole,
  getClientTimePayload,
  getMessageAttachment,
  getMessageAttachments,
  getMessageContent,
  getMessageId,
  getMessagesSignature,
  getRelatedItemId,
  getRelatedItemLabel,
  getStaffDisplayName,
  getTimeValue,
  getUnreadCount,
  getViewerMessageLabel,
  hasAssignedStaff,
  isImageUrl,
  isSaleRole,
  normalizeApiTimeToUtc,
  normalizeConversationDetail,
  normalizeConversationDetailTime,
  normalizeConversationList,
  normalizeConversationTime,
  normalizeMessages,
  normalizeRelatedList,
  notifyError,
  notifySuccess,
  notifyWarning,
  unwrapApiData,
  validateImageFile,
} from "./CustomerServiceChat.helpers";

import "./CustomerServiceChat.css";

/* Số nhóm khách vẽ mỗi nấc ở cột hội thoại (phân trang kiểu "Xem thêm"). */
const CONVERSATION_GROUP_WINDOW = 20;

export default function CustomerServiceChat() {
  const location = useLocation();
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
  const isListPollingRef = useRef(false);
  const didInitGroupCollapseRef = useRef(false);

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
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState(() => new Set());
  const [aiPrefill, setAiPrefill] = useState(() =>
    buildAiPrefillFromLocation(location.state)
  );
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(() =>
    Boolean(buildAiPrefillFromLocation(location.state))
  );

  useEffect(() => {
    const nextPrefill = buildAiPrefillFromLocation(location.state);
    if (!nextPrefill) return;
    setAiPrefill(nextPrefill);
    setIsAiAssistantOpen(true);
  }, [location.state]);

  const hasConversation = conversations.length > 0;
  const hasSelectedConversation = Boolean(selectedConversationId);

  const selectedConversationTitle = selectedConversation
    ? getConversationTitle(selectedConversation)
    : "Chọn cuộc trò chuyện";

  const conversationGroups = useMemo(
    () => buildConversationGroups(conversations),
    [conversations]
  );

  /* Hộp thư dài (GET /api/conversations không phân trang): vẽ trước CONVERSATION_GROUP_WINDOW
     khách, "Xem thêm" mở thêm từng nấc — cột trái không phải dựng hàng trăm nhóm một lúc. */
  const [visibleGroupCount, setVisibleGroupCount] = useState(
    CONVERSATION_GROUP_WINDOW
  );
  const visibleConversationGroups = conversationGroups.slice(0, visibleGroupCount);
  const hiddenGroupCount = Math.max(
    0,
    conversationGroups.length - visibleConversationGroups.length
  );

  const messageTimeline = useMemo(
    () => buildMessageTimeline(messages, currentUserId, currentUserRole),
    [messages, currentUserId, currentUserRole]
  );

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

    const uploadResponse = await uploadChatImages(files);

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

  /*
   * Poll hộp thư (không spinner, không tự chọn hội thoại): hội thoại khách vừa mở và số tin
   * chưa đọc của các hội thoại KHÁC hiện ra mà không phải bấm "Làm mới".
   *
   * Danh sách backend không kèm tin nhắn nên lastMessage chỉ là câu tóm tắt tình trạng. Hội
   * thoại chưa có hoạt động mới (updatedAt không đổi) thì giữ nguyên dòng xem trước đã dựng
   * từ chi tiết; hội thoại đang mở thì luôn 0 chưa đọc vì khung chat tự đánh dấu đã đọc.
   */
  const pollConversationsSilently = async () => {
    if (
      isListPollingRef.current ||
      (typeof document !== "undefined" &&
        document.visibilityState === "hidden")
    ) {
      return;
    }

    isListPollingRef.current = true;

    try {
      const response = await getConversationsApi();
      const activeId = selectedConversationIdRef.current;
      const incoming = normalizeConversationList(response).map(
        normalizeConversationTime
      );

      setConversations((current) => {
        const previousById = new Map(
          current.map((item) => [getConversationId(item), item])
        );

        return incoming
          .map((conversation) => {
            const id = getConversationId(conversation);
            const previous = previousById.get(id);
            let next = conversation;

            if (
              previous &&
              String(previous.updatedAt || "") ===
                String(conversation.updatedAt || "")
            ) {
              next = {
                ...conversation,
                lastMessage: previous.lastMessage,
                latestMessage: previous.latestMessage,
                lastMessageAt: previous.lastMessageAt,
                latestMessageAt: previous.latestMessageAt,
                lastMessageAtUtc: previous.lastMessageAtUtc,
                latestMessageAtUtc: previous.latestMessageAtUtc,
              };
            }

            if (id && id === activeId) {
              next = {
                ...next,
                unreadCount: 0,
                unreadMessages: 0,
                unread: 0,
              };
            }

            return next;
          })
          .sort(
            (firstConversation, secondConversation) =>
              getTimeValue(secondConversation) -
              getTimeValue(firstConversation)
          );
      });
    } catch (error) {
      console.debug(
        "Silent conversation list refresh failed:",
        error?.response?.data || error?.message
      );
    } finally {
      isListPollingRef.current = false;
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
    if (didInitGroupCollapseRef.current || conversationGroups.length === 0) {
      return;
    }

    didInitGroupCollapseRef.current = true;

    const multiGroupKeys = conversationGroups
      .filter((group) => group.conversationCount > 1)
      .map((group) => group.key);

    if (multiGroupKeys.length > 0) {
      setCollapsedGroupKeys(new Set(multiGroupKeys));
    }
  }, [conversationGroups]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const activeGroup = conversationGroups.find((group) =>
      group.conversations.some(
        (conversation) =>
          getConversationId(conversation) === selectedConversationId
      )
    );

    if (!activeGroup) {
      return;
    }

    setCollapsedGroupKeys((current) => {
      if (!current.has(activeGroup.key)) {
        return current;
      }

      const next = new Set(current);
      next.delete(activeGroup.key);
      return next;
    });
  }, [selectedConversationId, conversationGroups]);

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      pollConversationsSilently();
    }, CONVERSATION_LIST_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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

  const handleToggleCustomerGroup = (groupKey) => {
    setCollapsedGroupKeys((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
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

  const aiContext = useMemo(
    () => buildAiContextFromConversation(selectedConversation),
    [selectedConversation]
  );

  const handleInsertAiAnswer = (text) => {
    const content = String(text || "").trim();
    if (!content) return;

    setMessageForm((current) => ({
      ...current,
      content: current.content
        ? `${current.content}\n\n${content}`
        : content,
    }));

    AuthNotify.success(
      "Đã chèn gợi ý",
      "Câu trả lời cho khách đã được chèn vào ô nhắn tin. Kiểm tra lại rồi gửi."
    );
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
          colorPrimary: "#0084ff",
          colorInfo: "#0084ff",
          colorSuccess: "#16a34a",
          colorError: "#d34f4f",
          colorText: "#050505",
          colorTextSecondary: "#65676b",
          borderRadius: 10,
          controlHeight: 40,
          fontFamily:
            '"Segoe UI", Roboto, Tahoma, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
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
        <section
          className={[
            "cskh-chat-shell",
            isSaleViewer && isAiAssistantOpen && "has-ai-panel",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <aside className="cskh-chat-sidebar">
            <div className="cskh-chat-sidebar__header">
              <p className="cskh-chat-eyebrow">CHĂM SÓC KHÁCH HÀNG</p>

              <div className="cskh-chat-sidebar__title-row">
                <h2>
                  {isSaleViewer
                    ? "Hộp thư khách hàng"
                    : "Trung tâm hỗ trợ"}
                </h2>

                <Tooltip title="Làm mới hộp thư">
                  <Button
                    type="text"
                    shape="circle"
                    className={[
                      "cskh-refresh-button",
                      (isLoadingList || isLoadingDetail) && "is-loading",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    icon={
                      <ReloadOutlined
                        spin={isLoadingList || isLoadingDetail}
                      />
                    }
                    onClick={handleRefresh}
                    disabled={isLoadingList || isLoadingDetail}
                    aria-label="Làm mới danh sách trò chuyện"
                  />
                </Tooltip>
              </div>

              <span className="cskh-chat-sidebar__subtitle">
                {isSaleViewer
                  ? "Tiếp nhận yêu cầu và trao đổi trực tiếp với khách hàng."
                  : "Trao đổi trực tiếp và theo dõi phản hồi từ nhân viên Sale."}
              </span>
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
                visibleConversationGroups.map((group) => {
                  const isCollapsed = collapsedGroupKeys.has(group.key);
                  const hasMultiple = group.conversationCount > 1;
                  const groupHasActive = group.conversations.some(
                    (conversation) =>
                      getConversationId(conversation) === selectedConversationId
                  );
                  const latest = group.latestConversation;
                  const previewConversation = latest || group.conversations[0];

                  if (!hasMultiple) {
                    const conversation = group.conversations[0];
                    const id = getConversationId(conversation);
                    const unreadCount = getUnreadCount(conversation);
                    const isActive = id === selectedConversationId;

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
                          size={40}
                          className="cskh-conversation-avatar"
                          icon={<UserOutlined />}
                        />

                        <span className="cskh-conversation-main">
                          <span className="cskh-conversation-top">
                            <strong>{group.customerName}</strong>
                            <em>
                              {formatDateTime(getCreatedTime(conversation))}
                            </em>
                          </span>

                          <span className="cskh-conversation-subtitle">
                            {getConversationSubtitle(conversation)}
                          </span>

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
                  }

                  return (
                    <div
                      key={group.key}
                      className={[
                        "cskh-customer-group",
                        groupHasActive && "has-active",
                        isCollapsed && "is-collapsed",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <button
                        type="button"
                        className={[
                          "cskh-customer-group__header",
                          groupHasActive && "is-active",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleToggleCustomerGroup(group.key)}
                        aria-expanded={!isCollapsed}
                      >
                        <span className="cskh-customer-group__caret">
                          {isCollapsed ? (
                            <CaretRightOutlined />
                          ) : (
                            <CaretDownOutlined />
                          )}
                        </span>

                        <Avatar
                          size={40}
                          className="cskh-conversation-avatar"
                          icon={<UserOutlined />}
                        />

                        <span className="cskh-conversation-main">
                          <span className="cskh-conversation-top">
                            <strong>{group.customerName}</strong>
                            <em>
                              {formatDateTime(getCreatedTime(previewConversation))}
                            </em>
                          </span>

                          <span className="cskh-customer-group__meta">
                            {group.conversationCount} cuộc trò chuyện
                            {previewConversation
                              ? ` · ${getConversationSubtitle(previewConversation)}`
                              : ""}
                          </span>
                        </span>

                        {group.unreadCount > 0 && (
                          <Badge
                            count={group.unreadCount}
                            overflowCount={99}
                            className="cskh-unread-badge"
                          />
                        )}
                      </button>

                      {!isCollapsed && (
                        <div className="cskh-customer-group__children">
                          {group.conversations.map((conversation) => {
                            const id = getConversationId(conversation);
                            const unreadCount = getUnreadCount(conversation);
                            const isActive = id === selectedConversationId;

                            return (
                              <button
                                key={id}
                                type="button"
                                className={[
                                  "cskh-conversation-item",
                                  "cskh-conversation-item--child",
                                  isActive && "is-active",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() =>
                                  handleSelectConversation(conversation)
                                }
                                aria-busy={isActive && isLoadingDetail}
                              >
                                <span className="cskh-conversation-item__tree-line" />

                                <Avatar
                                  size={32}
                                  className="cskh-conversation-avatar cskh-conversation-avatar--child"
                                  icon={<MessageFilled />}
                                />

                                <span className="cskh-conversation-main">
                                  <span className="cskh-conversation-top">
                                    <strong>
                                      {getConversationSubtitle(conversation)}
                                    </strong>
                                    <em>
                                      {formatDateTime(
                                        getCreatedTime(conversation)
                                      )}
                                    </em>
                                  </span>

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
                      )}
                    </div>
                  );
                })}

              {!isLoadingList && hiddenGroupCount > 0 && (
                <div className="cskh-load-more">
                  <span>
                    Đang hiện {visibleConversationGroups.length} /{" "}
                    {conversationGroups.length} khách
                  </span>
                  <Button
                    size="small"
                    onClick={() =>
                      setVisibleGroupCount(
                        (count) => count + CONVERSATION_GROUP_WINDOW
                      )
                    }
                  >
                    Xem thêm (còn {hiddenGroupCount})
                  </Button>
                </div>
              )}
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
                    ? "Chọn một cuộc trò chuyện bên trái để xem lịch sử và phản hồi khách hàng. Bấm AI khi cần soạn gợi ý trả lời."
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

                {isSaleViewer && (
                  <Button
                    type="default"
                    size="large"
                    icon={<RobotOutlined />}
                    className="cskh-welcome-button"
                    onClick={() =>
                      setIsAiAssistantOpen((current) => !current)
                    }
                  >
                    {isAiAssistantOpen ? "Đóng trợ lý AI" : "Mở trợ lý AI"}
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

                      <div className="cskh-chat-title__status">
                        <span className="cskh-status-dot" />
                        <span className="cskh-status-text">
                          {/* Liên kết đơn: mã đơn THẬT (relatedCode) backend trả về. */}
                          {selectedConversation?.relatedType
                            ? `${getConversationSubtitle(selectedConversation)} · `
                            : ""}
                          {hasAssignedStaff(selectedConversation)
                            ? `Nhân viên: ${getStaffDisplayName(selectedConversation)}`
                            : isSaleViewer
                              ? "Chưa có nhân viên nhận — trả lời để nhận hội thoại"
                              : "Đang hỗ trợ trực tuyến"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="cskh-chat-header__actions">
                    {isSaleViewer && (
                      <Tooltip
                        title={
                          isAiAssistantOpen
                            ? "Đóng trợ lý AI"
                            : "Mở trợ lý AI hỗ trợ soạn phản hồi"
                        }
                      >
                        <Button
                          type={isAiAssistantOpen ? "primary" : "default"}
                          icon={<RobotOutlined />}
                          onClick={() =>
                            setIsAiAssistantOpen((current) => !current)
                          }
                        >
                          <span className="cskh-read-button__label">AI</span>
                        </Button>
                      </Tooltip>
                    )}

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
                  </div>
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
                    messageTimeline.map((entry) => {
                      if (entry.type === "day") {
                        return (
                          <div key={entry.key} className="cskh-day-divider">
                            <span>{entry.label}</span>
                          </div>
                        );
                      }

                      const clusterSize = entry.items.length;

                      return (
                        <div
                          key={entry.key}
                          className={[
                            "cskh-message-cluster",
                            entry.mine ? "is-mine" : "is-other",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {entry.items.map(({ message: item, index }, itemIndex) => {
                            const content = getMessageContent(item);
                            const attachmentUrls = getMessageAttachments(item);
                            const messageId = String(getMessageId(item, index));
                            const isCopied = copiedMessageId === messageId;
                            const isFirst = itemIndex === 0;
                            const isLast = itemIndex === clusterSize - 1;
                            const showAvatar = !entry.mine && isLast;
                            const showMeta = isFirst;

                            return (
                              <div
                                key={messageId}
                                className={[
                                  "cskh-message-row",
                                  entry.mine ? "is-mine" : "is-other",
                                  isFirst && "is-group-start",
                                  isLast && "is-group-end",
                                  !isFirst && !isLast && "is-group-middle",
                                  clusterSize === 1 && "is-group-single",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                {!entry.mine && (
                                  showAvatar ? (
                                    <Avatar
                                      size={28}
                                      className="cskh-message-avatar"
                                      icon={<MessageFilled />}
                                    />
                                  ) : (
                                    <span
                                      className="cskh-message-avatar-spacer"
                                      aria-hidden="true"
                                    />
                                  )
                                )}

                                <div className="cskh-message-group">
                                  {showMeta && (
                                    <div className="cskh-message-meta cskh-message-meta--outside">
                                      <div className="cskh-message-meta__identity">
                                        <strong>
                                          {getViewerMessageLabel(
                                            entry.mine,
                                            currentUserRole,
                                            currentUserName,
                                            item
                                          )}
                                        </strong>
                                        <span>
                                          {formatMessageTime(getCreatedTime(item))}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  <div className="cskh-message-bubble">
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
                                        {attachmentUrls.map(
                                          (attachmentUrl, imageIndex) => (
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
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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

                    <Tooltip title="Gửi tin nhắn">
                      <Button
                        htmlType="submit"
                        type="text"
                        shape="circle"
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
                        aria-label="Gửi tin nhắn"
                      />
                    </Tooltip>
                  </div>
                </form>
              </>
            )}
          </main>

          {isSaleViewer && isAiAssistantOpen && (
            <SalesAiAssistantPanel
              context={aiContext}
              prefill={aiPrefill}
              customerName={
                aiContext?.customerName ||
                aiPrefill?.customerName ||
                selectedConversationTitle
              }
              onInsertText={
                hasSelectedConversation ? handleInsertAiAnswer : null
              }
              onClose={() => setIsAiAssistantOpen(false)}
            />
          )}
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
