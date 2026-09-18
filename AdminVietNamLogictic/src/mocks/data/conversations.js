/**
 * DỮ LIỆU MẪU: HỘI THOẠI CHĂM SÓC KHÁCH HÀNG (CSKH)
 *
 * File này chỉ chứa DỮ LIỆU. `features/chat/api/conversationApi.js` import và trả về,
 * nên hình dạng ở đây phải khớp đúng cái CustomerServiceChat.jsx đang đọc — component
 * không được sửa một dòng nào.
 *
 * Bốn ràng buộc dễ vỡ nhất, ghi lại để về sau không ai lỡ tay phá:
 *
 * 1. Tin nhắn của nhân viên PHẢI có `senderId` trùng claim `sub` trong
 *    DEMO_SALE_ACCESS_TOKEN (people.js) — tức "3f1a7c20-1002-4b8c-9d31-100000000002".
 *    isMessageMine() so senderId với id lấy từ JWT trước mọi thứ khác; lệch một ký tự
 *    là toàn bộ bong bóng chat dồn hết sang một bên và mất luôn khái niệm "tin của tôi".
 *    Trang này chỉ nằm trong saleRoutes nên người xem luôn là tài khoản Sale.
 * 2. Object hội thoại TUYỆT ĐỐI không được có khoá `conversation` hay `data` ở cấp
 *    ngoài cùng: normalizeConversationDetail() trả `data?.conversation || data`, còn
 *    unwrapApiData() trả `response?.data ?? response`. Thêm hai khoá đó là component
 *    bóc sai một tầng và màn chi tiết trống trơn.
 * 3. Ảnh đính kèm dùng data URI `data:image/...`. Bản chỉ-giao-diện không có server file
 *    nên URL http thật sẽ hiện ảnh lỗi; isLikelyAttachmentUrl() chấp nhận data:image/
 *    và isImageUrl() thấy chữ "image" nên ảnh vẫn render đúng trong bong bóng chat.
 * 4. Mốc thời gian tính tương đối theo giờ hiện tại, không ghim ngày cứng: dải phân cách
 *    "Hôm nay" / "Hôm qua" trong buildMessageTimeline() chỉ hiện khi tin nhắn thực sự
 *    rơi vào hôm nay và hôm qua theo giờ Asia/Ho_Chi_Minh.
 * 5. `relatedCode` phải là mã đơn CÓ THẬT trong src/mocks/data/consignments.js hoặc
 *    purchaseRequests.js, và mã đó phải có hồ sơ trong AI_DOSSIERS của
 *    features/chat/api/saleAiService.js. Panel trợ lý AI mở từ trang này lấy
 *    `orderCode` chính là chuỗi ở đây (buildAiContextFromConversation), nên mã tự nghĩ
 *    ra sẽ làm mọi câu hỏi rơi vào nhánh "Em chưa tra được đơn nào khớp..." — hỏng
 *    thầm lặng, không có lỗi nào hiện ra. Mã WRO/SHP/PCL nhắc trong tin nhắn cũng lấy
 *    từ chính hồ sơ AI của đơn đó để hai bên không kể hai câu chuyện khác nhau.
 */

import {
  isoHoursAgo,
} from "@/mocks/mockUtils";

/* =====================================================
   HELPERS SINH ID
===================================================== */

/**
 * Sinh id dạng UUID hợp lệ, cố định giữa các lần tải trang.
 *
 * Giữ đúng khuôn của people.js để id khách hàng ở đây trỏ về đúng bản ghi khách
 * hàng bên đó (8b3c5d90-100X-...), nhờ vậy trợ lý AI đọc customerId vẫn ra người thật.
 */
const makeUuid = (prefix, index) =>
  `${prefix}-${String(1000 + index)}-4b8c-9d31-${String(100000000000 + index)}`;

const makeCustomerId = (index) =>
  makeUuid("8b3c5d90", index);

const makeConversationId = (index) =>
  makeUuid("7d2e4f10", index);

const makeRelatedId = (index) =>
  makeUuid("5c8d1a30", index);

const makeMessageId = (
  conversationIndex,
  messageIndex
) =>
  `6a9b3c80-${String(1000 + conversationIndex)}-4b8c-9d31-${String(
    100000000000 + conversationIndex * 100 + messageIndex
  )}`;

/* =====================================================
   NGƯỜI ĐANG ĐĂNG NHẬP (PHÍA NHÂN VIÊN)
===================================================== */

/**
 * Nhân viên Sale demo — trùng users[1] của people.js.
 *
 * `id` phải trùng claim `sub` của DEMO_SALE_ACCESS_TOKEN, xem ràng buộc số 1 ở đầu file.
 */
export const SALE_STAFF = {
  id: "3f1a7c20-1002-4b8c-9d31-100000000002",
  fullName: "Trần Thị Bảo Ngọc",
  role: "Sale",
};

/**
 * Sale thứ hai, để dòng "Nhân viên: ..." trên đầu khung chat không phải lúc nào cũng một tên.
 *
 * CHỈ được gán cho hội thoại CHƯA có lượt trả lời nào của nhân viên. Người này không phải
 * tài khoản đang đăng nhập, nên mọi tin do họ gửi sẽ rơi về phía "người khác" (ràng buộc
 * số 1) — thread nào đã có nhân viên trả lời mà gán tên này là bong bóng dồn hết sang trái.
 */
export const SALE_STAFF_SECOND = {
  id: "3f1a7c20-1004-4b8c-9d31-100000000004",
  fullName: "Phạm Hồng Nhung",
  role: "Sale",
};

/* =====================================================
   ẢNH ĐÍNH KÈM
===================================================== */

/**
 * Bốn ảnh mẫu dạng data URI (SVG nhúng sẵn).
 *
 * Xem ràng buộc số 3: bản chỉ-giao-diện không có endpoint upload nên phải tự mang ảnh
 * theo, nếu không mọi bong bóng có đính kèm đều hiện icon ảnh vỡ.
 */
export const CHAT_ATTACHMENT_IMAGES = {
  product:
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjIwIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIyMCIgZmlsbD0iI2VmZjZmZiIvPjxyZWN0IHg9IjE0IiB5PSIxNCIgd2lkdGg9IjI5MiIgaGVpZ2h0PSIxOTIiIHJ4PSIxNiIgZmlsbD0iI2RiZWFmZSIgc3Ryb2tlPSIjMjU2M2ViIiBzdHJva2Utd2lkdGg9IjMiLz48dGV4dCB4PSIxNjAiIHk9IjEyMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjEiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMxZDRlZDgiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuG6om5oIHPhuqNuIHBo4bqpbSBUYW9iYW88L3RleHQ+PC9zdmc+",

  warehouse:
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjIwIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIyMCIgZmlsbD0iI2YwZmRmNCIvPjxyZWN0IHg9IjE0IiB5PSIxNCIgd2lkdGg9IjI5MiIgaGVpZ2h0PSIxOTIiIHJ4PSIxNiIgZmlsbD0iI2RjZmNlNyIgc3Ryb2tlPSIjMTZhMzRhIiBzdHJva2Utd2lkdGg9IjMiLz48dGV4dCB4PSIxNjAiIHk9IjEyMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjEiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiMxNTgwM2QiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuG6om5oIGtp4buHbiBow6BuZyB04bqhaSBraG88L3RleHQ+PC9zdmc+",

  waybill:
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjIwIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIyMCIgZmlsbD0iI2ZmZjdlZCIvPjxyZWN0IHg9IjE0IiB5PSIxNCIgd2lkdGg9IjI5MiIgaGVpZ2h0PSIxOTIiIHJ4PSIxNiIgZmlsbD0iI2ZmZWRkNSIgc3Ryb2tlPSIjZWE1ODBjIiBzdHJva2Utd2lkdGg9IjMiLz48dGV4dCB4PSIxNjAiIHk9IjEyMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjEiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiNjMjQxMGMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuG6om5oIHbhuq1uIMSRxqFuIG7hu5lpIMSR4buLYTwvdGV4dD48L3N2Zz4=",

  receipt:
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMjAiIGhlaWdodD0iMjIwIj48cmVjdCB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIyMCIgZmlsbD0iI2ZkZjRmZiIvPjxyZWN0IHg9IjE0IiB5PSIxNCIgd2lkdGg9IjI5MiIgaGVpZ2h0PSIxOTIiIHJ4PSIxNiIgZmlsbD0iI2ZhZThmZiIgc3Ryb2tlPSIjYTIxY2FmIiBzdHJva2Utd2lkdGg9IjMiLz48dGV4dCB4PSIxNjAiIHk9IjEyMCIgZm9udC1mYW1pbHk9IlNlZ29lIFVJLEFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjEiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiM4NjE5OGYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPuG6om5oIGJpw6puIGxhaSBjaHV54buDbiBraG/huqNuPC90ZXh0Pjwvc3ZnPg==",
};

/* =====================================================
   BUILDER
===================================================== */

/** Nội dung xem trước ở sidebar khi tin cuối chỉ có ảnh — trùng chữ component tự sinh. */
const IMAGE_ONLY_PREVIEW = "Đã gửi một hình ảnh";

/**
 * Dựng một hội thoại đầy đủ từ danh sách lượt trao đổi.
 *
 * Mỗi lượt chỉ khai báo ai nói, nói gì và cách đây bao nhiêu giờ; phần id, senderId,
 * senderRole, mốc thời gian và tin nhắn cuối cùng của hội thoại được suy ra ở đây để
 * không có chỗ nào lệch nhau (sidebar in lastMessage, khung chat in messages — hai chỗ
 * đọc hai field khác nhau nên phải sinh từ cùng một nguồn).
 *
 * @param {{ index: number, customerIndex: number, customerName: string, customerPhone: string, staff: Object|null, relatedType: string|null, relatedCode: string, status: string, unreadCount: number, turns: Array }} config
 */
const buildConversation = ({
  index,
  customerIndex,
  customerName,
  customerPhone,
  staff = SALE_STAFF,
  relatedType = null,
  relatedCode = "",
  status = "ACTIVE",
  unreadCount = 0,
  turns = [],
}) => {
  const conversationId = makeConversationId(index);
  const customerId = makeCustomerId(customerIndex);

  /* Tin chưa đọc luôn là mấy tin cuối của khách: đánh dấu từ cuối lên để con số trên
     badge và trạng thái isRead của từng tin nhắn không nói ngược nhau. */
  const unreadFromEnd = new Set();

  if (unreadCount > 0) {
    let remaining = unreadCount;

    for (
      let cursor = turns.length - 1;
      cursor >= 0 && remaining > 0;
      cursor -= 1
    ) {
      if (turns[cursor].from === "customer") {
        unreadFromEnd.add(cursor);
        remaining -= 1;
      }
    }
  }

  const messages = turns.map((turn, turnIndex) => {
    const isFromSale = turn.from === "sale";
    const createdAt = isoHoursAgo(turn.hoursAgo);
    const isRead = !unreadFromEnd.has(turnIndex);

    return {
      id: makeMessageId(index, turnIndex + 1),
      messageId: makeMessageId(index, turnIndex + 1),
      conversationId,

      senderId: isFromSale
        ? staff?.id || SALE_STAFF.id
        : customerId,
      senderName: isFromSale
        ? staff?.fullName || SALE_STAFF.fullName
        : customerName,
      senderRole: isFromSale ? "Sale" : "Customer",

      content: turn.content || "",
      attachmentUrl: turn.attachmentUrl || null,

      createdAt,
      sentAt: createdAt,
      updatedAt: createdAt,

      isRead,
      readAt: isRead ? createdAt : null,
    };
  });

  const firstTurn = turns[0];
  const lastTurn = turns[turns.length - 1];

  const createdAt = isoHoursAgo(
    firstTurn ? firstTurn.hoursAgo : 72
  );

  const lastMessageAt = isoHoursAgo(
    lastTurn ? lastTurn.hoursAgo : 72
  );

  const lastMessage =
    (lastTurn?.content || "").trim() ||
    (lastTurn?.attachmentUrl
      ? IMAGE_ONLY_PREVIEW
      : "");

  /* Lần đọc gần nhất: nếu còn tin chưa đọc thì mốc này phải cũ hơn tin cuối,
     đúng như server trả về, để badge chưa đọc không tự vô nghĩa. */
  const lastReadAt = unreadCount > 0
    ? isoHoursAgo((lastTurn?.hoursAgo || 0) + 2)
    : lastMessageAt;

  return {
    id: conversationId,
    conversationId,

    customerId,
    customerName,
    customerFullName: customerName,
    customerPhone,
    customer: {
      id: customerId,
      userId: customerId,
      fullName: customerName,
      name: customerName,
      phone: customerPhone,
    },

    /* Chưa ai nhận thì để rỗng hẳn: hasAssignedStaff() đọc chuỗi này để chọn giữa
       "Nhân viên: ..." và "Đang hỗ trợ trực tuyến" trên đầu khung chat. */
    staffName: staff?.fullName || "",
    staff: staff
      ? {
          id: staff.id,
          fullName: staff.fullName,
          name: staff.fullName,
          role: staff.role,
        }
      : null,

    relatedType,
    relatedId: relatedType
      ? makeRelatedId(index)
      : null,
    relatedCode: relatedType ? relatedCode : "",

    status,

    lastMessage,
    latestMessage: lastMessage,

    createdAt,
    updatedAt: lastMessageAt,
    lastMessageAt,
    latestMessageAt: lastMessageAt,
    lastReadAt,

    unreadCount,
    unreadMessages: unreadCount,
    unread: unreadCount,

    messageCount: messages.length,
    messages,
  };
};

/* =====================================================
   HỘI THOẠI MẪU
===================================================== */

/**
 * 15 hội thoại của 12 khách hàng.
 *
 * Ba khách có hai hội thoại (Kiều Trinh, Thuỳ Dương, Hải Yến) để buildConversationGroups()
 * có nhóm gộp nhiều hội thoại mà mở/thu, chứ không phải danh sách phẳng toàn nhóm đơn.
 * Xen kẽ hội thoại đã đọc / còn badge chưa đọc, có liên kết đơn / không liên kết, đã có
 * nhân viên phụ trách / chưa ai nhận — mỗi nhánh giao diện đều có một ca để hiện.
 */
export const conversations = [
  buildConversation({
    index: 1,
    customerIndex: 1,
    customerName: "Vương Thị Kiều Trinh",
    customerPhone: "0921112233",
    staff: SALE_STAFF,
    relatedType: "CONSIGNMENT",
    relatedCode: "VCL-20260816104408-271455",
    unreadCount: 2,
    turns: [
      {
        from: "customer",
        content:
          "Chào anh chị, lô ký gửi VCL-20260816104408-271455 của em đã về kho Bằng Tường chưa ạ?",
        hoursAgo: 27,
      },
      {
        from: "sale",
        content:
          "Dạ chào chị Trinh, kho Bằng Tường đã nhận 6/8 kiện lúc 14h20 hôm qua. Còn 2 kiện shop gửi chậm một ngày ạ.",
        hoursAgo: 26,
      },
      {
        from: "sale",
        content: "Em gửi chị ảnh kiện hàng đang nằm ở khu A2 để chị đối chiếu ạ.",
        attachmentUrl: CHAT_ATTACHMENT_IMAGES.warehouse,
        hoursAgo: 26,
      },
      {
        from: "customer",
        content:
          "Vậy 2 kiện còn lại có kịp ghép lô đi ngày mai không anh? Em cần hàng trước 30/9.",
        hoursAgo: 3,
      },
      {
        from: "customer",
        content:
          "Nếu không kịp thì cho em tách lô, 6 kiện đi trước cũng được ạ.",
        hoursAgo: 2,
      },
    ],
  }),

  buildConversation({
    index: 2,
    customerIndex: 1,
    customerName: "Vương Thị Kiều Trinh",
    customerPhone: "0921112233",
    staff: SALE_STAFF,
    relatedType: "PURCHASE_REQUEST",
    relatedCode: "PUR-20260902081522-410233",
    unreadCount: 0,
    turns: [
      {
        from: "customer",
        content:
          "Em vừa đặt mua hộ 12 mã đèn trang trí, link Taobao em đã dán trong đơn PUR-20260902081522-410233.",
        hoursAgo: 52,
      },
      {
        from: "sale",
        content:
          "Dạ em kiểm tra rồi, có 2 mã shop báo hết hàng. Chị đổi sang mã tương tự hay huỷ 2 dòng đó ạ?",
        hoursAgo: 50,
      },
      {
        from: "customer",
        content: "Anh gửi em ảnh mã tương tự xem đã ạ.",
        hoursAgo: 49,
      },
      {
        from: "sale",
        content: "Đây ạ, cùng chất liệu nhôm, giá chênh 18.000đ/cái.",
        attachmentUrl: CHAT_ATTACHMENT_IMAGES.product,
        hoursAgo: 48,
      },
      {
        from: "customer",
        content: "Ok anh chốt mã này giúp em nhé, cảm ơn anh.",
        hoursAgo: 47,
      },
      {
        from: "sale",
        content:
          "Dạ em đã cập nhật đơn và gửi lại báo giá tạm tính 24.680.000đ cho chị ạ.",
        hoursAgo: 46,
      },
    ],
  }),

  buildConversation({
    index: 3,
    customerIndex: 2,
    customerName: "Đoàn Chí Thành",
    customerPhone: "0922223344",
    staff: SALE_STAFF,
    relatedType: "QUOTATION",
    relatedCode: "VCL-20260828093310-152904",
    unreadCount: 1,
    turns: [
      {
        from: "sale",
        content:
          "Chào anh Thành, em đã gửi báo giá lô nội thất tuyến Quảng Châu - Đà Nẵng, tổng 41.250.000đ ạ.",
        hoursAgo: 30,
      },
      {
        from: "customer",
        content:
          "Phí nội địa Trung Quốc 3.900.000đ hơi cao so với lần trước, anh xem lại giúp em.",
        hoursAgo: 5,
      },
    ],
  }),

  buildConversation({
    index: 4,
    customerIndex: 3,
    customerName: "Hồ Ngọc Mai",
    customerPhone: "0923334455",
    staff: null,
    relatedType: null,
    relatedCode: "",
    unreadCount: 3,
    turns: [
      {
        from: "customer",
        content:
          "Em muốn hỏi về dịch vụ ký gửi hàng dễ vỡ từ Nghĩa Ô về TP. Hồ Chí Minh.",
        hoursAgo: 6,
      },
      {
        from: "customer",
        content: "Hàng của em là ly thuỷ tinh, khoảng 40kg.",
        hoursAgo: 6,
      },
      {
        from: "customer",
        content: "Bên mình có gói đóng gỗ không ạ?",
        hoursAgo: 5,
      },
    ],
  }),

  buildConversation({
    index: 5,
    customerIndex: 4,
    customerName: "Lâm Tuấn Kiệt",
    customerPhone: "0924445566",
    staff: SALE_STAFF,
    relatedType: "CONSIGNMENT",
    relatedCode: "VCL-20260812142310-317744",
    unreadCount: 0,
    turns: [
      {
        from: "customer",
        content:
          "Lô VCL-20260812142310-317744 đã giao tới kho Hà Nội, khi nào em nhận được hàng ạ?",
        hoursAgo: 74,
      },
      {
        from: "sale",
        content:
          "Dạ phiếu xuất kho WRO-20260901084512-773051 đã lập, tài xế lấy hàng sáng mai và giao trong ngày ạ.",
        hoursAgo: 73,
      },
      {
        from: "sale",
        content: "Em gửi anh ảnh vận đơn nội địa ạ.",
        attachmentUrl: CHAT_ATTACHMENT_IMAGES.waybill,
        hoursAgo: 73,
      },
      {
        from: "customer",
        content: "Cảm ơn chị, em đã nhận đủ 3 kiện.",
        hoursAgo: 26,
      },
      {
        from: "sale",
        content:
          "Dạ em cảm ơn anh Kiệt, có phát sinh gì anh nhắn lại giúp em ạ.",
        hoursAgo: 25,
      },
    ],
  }),

  buildConversation({
    index: 6,
    customerIndex: 5,
    customerName: "Nguyễn Thị Thuỳ Dương",
    customerPhone: "0356778899",
    staff: SALE_STAFF,
    relatedType: "PURCHASE_REQUEST",
    relatedCode: "PUR-20260824131044-511982",
    unreadCount: 1,
    turns: [
      {
        from: "customer",
        content:
          "Đơn mua hộ mỹ phẩm PUR-20260824131044-511982 em đã chuyển khoản cọc 50%.",
        hoursAgo: 20,
      },
      {
        from: "customer",
        content: "",
        attachmentUrl: CHAT_ATTACHMENT_IMAGES.receipt,
        hoursAgo: 20,
      },
      {
        from: "sale",
        content:
          "Dạ em đã đối soát được 14.500.000đ, đơn chuyển sang trạng thái đang mua hàng ạ.",
        hoursAgo: 19,
      },
      {
        from: "customer",
        content:
          "Em cần hàng gấp, có cách nào đi đường bay không chị? Thêm bao nhiêu tiền ạ?",
        hoursAgo: 4,
      },
    ],
  }),

  buildConversation({
    index: 7,
    customerIndex: 5,
    customerName: "Nguyễn Thị Thuỳ Dương",
    customerPhone: "0356778899",
    staff: SALE_STAFF,
    relatedType: null,
    relatedCode: "",
    unreadCount: 0,
    turns: [
      {
        from: "customer",
        content:
          "Chị cho em xin bảng giá vận chuyển đường bộ tuyến Quảng Châu - Hà Nội tháng 9 với ạ.",
        hoursAgo: 98,
      },
      {
        from: "sale",
        content:
          "Dạ hàng thường 26.000đ/kg, hàng cồng kềnh tính theo quy đổi 6000. Em gửi chị file chi tiết qua Zalo nhé.",
        hoursAgo: 97,
      },
      {
        from: "customer",
        content: "Em nhận được rồi, cảm ơn chị nhiều.",
        hoursAgo: 96,
      },
    ],
  }),

  buildConversation({
    index: 8,
    customerIndex: 6,
    customerName: "Trần Đăng Khoa",
    customerPhone: "0788990011",
    staff: SALE_STAFF,
    relatedType: "CONSIGNMENT",
    relatedCode: "VCL-20260815152139-284007",
    unreadCount: 2,
    turns: [
      {
        from: "sale",
        content:
          "Chào anh Khoa, kiện PCL-20260815160930-390884 bị móp góc khi kiểm hàng, em đã chụp ảnh biên bản.",
        hoursAgo: 12,
      },
      {
        from: "sale",
        content: "",
        attachmentUrl: CHAT_ATTACHMENT_IMAGES.warehouse,
        hoursAgo: 12,
      },
      {
        from: "customer",
        content:
          "Bên trong là máy pha cà phê, anh mở kiểm giúp em xem máy còn nguyên không.",
        hoursAgo: 7,
      },
      {
        from: "customer",
        content: "Nếu hỏng thì em muốn trả hàng về shop luôn ạ.",
        hoursAgo: 7,
      },
    ],
  }),

  buildConversation({
    index: 9,
    customerIndex: 7,
    customerName: "Phạm Thị Hải Yến",
    customerPhone: "0812334455",
    staff: SALE_STAFF,
    relatedType: "PURCHASE_REQUEST",
    relatedCode: "PUR-20260828101244-471530",
    unreadCount: 0,
    turns: [
      {
        from: "customer",
        content:
          "Em mới mở tài khoản, muốn nhờ mua hộ 200 bộ phụ kiện điện thoại.",
        hoursAgo: 44,
      },
      {
        from: "sale",
        content:
          "Dạ chị gửi em link sản phẩm và số lượng từng mã, em báo giá trong 30 phút ạ.",
        hoursAgo: 43,
      },
      {
        from: "customer",
        content: "Em đã tạo đơn PUR-20260828101244-471530 rồi ạ.",
        hoursAgo: 42,
      },
      {
        from: "sale",
        content:
          "Dạ em nhận được đơn, tổng tạm tính 31.400.000đ gồm phí mua hộ 2%. Chị cọc 30% để em đặt hàng nhé.",
        hoursAgo: 41,
      },
      {
        from: "customer",
        content: "Vâng em chuyển ngay ạ.",
        hoursAgo: 40,
      },
    ],
  }),

  buildConversation({
    index: 10,
    customerIndex: 7,
    customerName: "Phạm Thị Hải Yến",
    customerPhone: "0812334455",
    staff: null,
    relatedType: "QUOTATION",
    relatedCode: "VCL-20260825084733-181664",
    unreadCount: 1,
    turns: [
      {
        from: "customer",
        content:
          "Báo giá VCL-20260825084733-181664 có bao gồm thuế nhập khẩu chưa ạ?",
        hoursAgo: 9,
      },
    ],
  }),

  buildConversation({
    index: 11,
    customerIndex: 8,
    customerName: "Bùi Quang Vinh",
    customerPhone: "0905112233",
    staff: SALE_STAFF,
    relatedType: "CONSIGNMENT",
    relatedCode: "VCL-20260818094911-258873",
    unreadCount: 0,
    turns: [
      {
        from: "customer",
        content:
          "Lô hàng của em nằm trong SHP-20260818120400-701338 đúng không anh?",
        hoursAgo: 120,
      },
      {
        from: "sale",
        content:
          "Dạ đúng ạ, lô đã qua cửa khẩu Hữu Nghị lúc 6h sáng nay, dự kiến về kho Đà Nẵng sau 2 ngày.",
        hoursAgo: 119,
      },
      {
        from: "customer",
        content: "Cảm ơn anh, em theo dõi tiếp ạ.",
        hoursAgo: 118,
      },
    ],
  }),

  buildConversation({
    index: 12,
    customerIndex: 9,
    customerName: "Lê Thị Mỹ Hạnh",
    customerPhone: "0913224466",
    staff: SALE_STAFF_SECOND,
    relatedType: null,
    relatedCode: "",
    unreadCount: 4,
    turns: [
      {
        from: "customer",
        content: "Chị ơi em cần hỏi về phí lưu kho quá hạn.",
        hoursAgo: 3,
      },
      {
        from: "customer",
        content: "Hàng em để ở kho Hà Nội 12 ngày rồi.",
        hoursAgo: 3,
      },
      {
        from: "customer",
        content: "Miễn phí mấy ngày đầu ạ?",
        hoursAgo: 2,
      },
      {
        from: "customer",
        content: "Chị trả lời giúp em sớm với, em cảm ơn.",
        hoursAgo: 1,
      },
    ],
  }),

  buildConversation({
    index: 13,
    customerIndex: 10,
    customerName: "Đặng Hoàng Nam",
    customerPhone: "0934557788",
    staff: SALE_STAFF,
    relatedType: "PURCHASE_REQUEST",
    relatedCode: "PUR-20260814092044-590135",
    unreadCount: 0,
    turns: [
      {
        from: "customer",
        content:
          "Đơn mua hộ tháng trước của em đã tất toán chưa ạ? Em cần hoá đơn để kế toán ghi nhận.",
        hoursAgo: 168,
      },
      {
        from: "sale",
        content:
          "Dạ đơn PUR-20260814092044-590135 đã tất toán, còn dư 320.000đ em hoàn vào ví của anh ạ.",
        hoursAgo: 167,
      },
      {
        from: "customer",
        content: "Ok anh, phần dư cứ để ví cho đơn sau.",
        hoursAgo: 166,
      },
      {
        from: "sale",
        content: "Dạ vâng, em ghi nhận rồi ạ.",
        hoursAgo: 165,
      },
    ],
  }),

  buildConversation({
    index: 14,
    customerIndex: 11,
    customerName: "Võ Thị Thanh Trúc",
    customerPhone: "0947668899",
    staff: SALE_STAFF,
    relatedType: "CONSIGNMENT",
    relatedCode: "VCL-20260817132650-263092",
    unreadCount: 1,
    turns: [
      {
        from: "sale",
        content:
          "Chào chị Trúc, kho Quảng Châu vừa nhận 4 kiện của chị, em đã lên mã lô SHP-20260822081200-118655.",
        hoursAgo: 8,
      },
      {
        from: "customer",
        content:
          "Chị kiểm tra giúp em 1 kiện có 2 thùng son môi, hàng này có bị hạn chế vận chuyển không ạ?",
        hoursAgo: 1,
      },
    ],
  }),

  buildConversation({
    index: 15,
    customerIndex: 12,
    customerName: "Hoàng Anh Tuấn",
    customerPhone: "0958771122",
    staff: SALE_STAFF,
    relatedType: null,
    relatedCode: "",
    unreadCount: 0,
    turns: [
      {
        from: "customer",
        content:
          "Em muốn mở tài khoản doanh nghiệp để lấy hoá đơn VAT hàng tháng.",
        hoursAgo: 220,
      },
      {
        from: "sale",
        content:
          "Dạ anh gửi em mã số thuế và tên công ty, em nâng cấp tài khoản trong hôm nay ạ.",
        hoursAgo: 219,
      },
      {
        from: "customer",
        content: "Đã gửi qua email rồi chị nhé.",
        hoursAgo: 218,
      },
      {
        from: "sale",
        content:
          "Dạ em đã nâng cấp xong, từ đơn tiếp theo hệ thống tự xuất hoá đơn cho công ty anh ạ.",
        hoursAgo: 217,
      },
    ],
  }),
];

/* =====================================================
   TRA CỨU
===================================================== */

/** Tìm hội thoại theo id hoặc conversationId — hai khoá component đều có thể truyền lên. */
export const findConversationById = (conversationId) => {
  const id = String(conversationId ?? "").trim();

  if (!id) {
    return null;
  }

  return (
    conversations.find(
      (conversation) =>
        conversation.id === id ||
        conversation.conversationId === id
    ) || null
  );
};

export const CONVERSATION_RELATED_TYPES = [
  "CONSIGNMENT",
  "PURCHASE_REQUEST",
  "QUOTATION",
];

export default conversations;
