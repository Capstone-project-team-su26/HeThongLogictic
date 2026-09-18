/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "chat".
 *
 * Feature này sở hữu đúng bốn thứ:
 *
 *  1. CustomerServiceChat — màn chăm sóc khách hàng của khối Sale (hộp thư hội
 *     thoại bên trái, khung tin nhắn bên phải, đính kèm ảnh/file). Đây là màn
 *     duy nhất được gắn route, khai báo ở @app/router/saleRoutes.
 *  2. SalesAiAssistantPanel — panel trợ lý AI mở kèm bên trong màn trên: sale gõ
 *     câu hỏi, panel tra trạng thái đơn rồi dựng sẵn câu trả lời để gửi cho khách.
 *  3. conversationApi (MOCK) — hội thoại, tin nhắn, đánh dấu đã đọc.
 *  4. saleAiService (MOCK) — tra trạng thái đơn "bằng AI" và soạn câu trả lời.
 *
 * Feature này KHÔNG sở hữu: dữ liệu mẫu (@/mocks/data/conversations.js) và tiện
 * ích upload ảnh (@shared/api/uploadImage) mà màn chat đang mượn.
 *
 * VÌ SAO panel nằm trong barrel dù hiện chỉ CustomerServiceChat dùng: nó được
 * đặt ở components/ cấp feature chứ không lồng trong thư mục của page, tức là
 * đã được chủ ý xếp vào bề mặt công khai của feature — giống cách features/customer
 * đưa các modal của mình ra ngoài. Thứ thật sự nội bộ của một page thì nằm ngay
 * trong file page và không lộ ra đây.
 *
 * VỀ NGUY CƠ VA CHẠM TÊN KHI DÙNG `export *` — đã kiểm trước khi viết:
 * hai module api của feature giao nhau BẰNG RỖNG. conversationApi có 5 tên, đều
 * mang cụm "Conversation" và hậu tố "Api"; saleAiService có 6 tên xoay quanh
 * mapStatusLabel / normalizeSalesOrderStatusResponse / buildCustomerReply /
 * buildWarnings / getSalesAiError / querySalesOrderStatus. Không tên nào đụng
 * nhau, nên hai dòng `export *` bên dưới an toàn và không cần alias.
 *
 * Quét thêm toàn bộ module api của mọi feature trong dự án: 11 tên trên KHÔNG
 * trùng với bất kỳ feature nào khác, nên một barrel tổng có thể `export *` từ
 * "@features/chat" mà không phải alias. (Đây là ngoại lệ dễ chịu — cặp
 * admin/pricing thì trùng getPackageConfigurations và getPricingRules.)
 *
 * BẢO TRÌ: thêm hàm mới vào hai file api thì phải soát lại giao nhau. Tên trùng
 * giữa hai `export *` không làm build đỏ — ESM chỉ âm thầm loại tên đó khỏi
 * namespace của barrel, và lỗi chỉ hiện ra lúc chạy dưới dạng "not a function".
 *
 * CSS (CustomerServiceChat.css, SalesAiAssistantPanel.css) không bao giờ
 * re-export ở đây: chúng là side-effect import, mỗi file tự nạp CSS cạnh mình
 * để giữ nguyên thứ tự nạp như bản gốc.
 */

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

/* `export default function CustomerServiceChat()` — không có named export. */
export { default as CustomerServiceChat } from "./pages/CustomerServiceChat/CustomerServiceChat";

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

/* `export default function SalesAiAssistantPanel({...})` — không có named export. */
export { default as SalesAiAssistantPanel } from "./components/SalesAiAssistantPanel/SalesAiAssistantPanel";

/* ------------------------------------------------------------------ */
/* API — MOCK                                                          */
/* ------------------------------------------------------------------ */

/*
 * conversationApi.js: 5 named export (createConversationApi, getConversationsApi,
 * getConversationDetailApi, sendConversationMessageApi, markConversationAsReadApi)
 * LẪN default. `export *` không bao giờ kéo theo default nên phải nêu riêng —
 * đặt tên default theo đúng tên module để chỗ nào quen gọi kiểu
 * conversationApi.getConversationsApi(...) vẫn chạy qua barrel này.
 */
export * from "./api/conversationApi";
export { default as conversationApi } from "./api/conversationApi";

/*
 * saleAiService.js: 6 named export LẪN default. Lưu ý default ở đây chỉ gom 4
 * trong 6 hàm (thiếu normalizeSalesOrderStatusResponse và getSalesAiError), nên
 * `export *` bên trên mới là bề mặt đầy đủ — đừng bỏ nó mà chỉ giữ default.
 */
export * from "./api/saleAiService";
export { default as saleAiService } from "./api/saleAiService";
