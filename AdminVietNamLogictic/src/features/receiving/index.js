/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "receiving".
 *
 * Feature này sở hữu PHIẾU TIẾP NHẬN TẠI KHO GỐC — chặng hàng vừa cập kho nước
 * ngoài, trước khi được xếp kệ. Phiếu TỰ SINH khi đơn ký gửi thu được tiền (không
 * ai bấm tạo), kho cân đếm rồi chốt số thực tế, sau đó Operations Manager soi
 * chênh lệch khai báo / thực tế và quyết duyệt hay bắt kiểm lại:
 *
 *   ACTIVE → PARTIALLY_RECEIVED → RECEIVED → APPROVED
 *                                         ↘ REJECTED
 *
 * Ba thứ nằm trong feature:
 *   - Hai TRANG cùng dựng trên một workspace, chỉ khác props: AdminReceivingNotesPage
 *     (mở tab "Tất cả" để tra cứu mọi kho) và OperationsReceivingApprovalsPage
 *     (mở tab "Chờ duyệt" — đây là hàng đợi việc của OM).
 *   - Một COMPONENT dùng chung ReceivingNotesWorkspace: vì hai trang trên chia sẻ nó
 *     nên nó KHÔNG phải chi tiết nội bộ của riêng một trang, do đó có mặt ở đây.
 *   - Một module API MOCK receivingNoteService (đọc/ghi trên fixture
 *     src/mocks/data/receivingNotes.js, không có backend).
 *
 * KHÔNG nhầm với feature khác: phiếu nhập kho ĐÍCH (Việt Nam) thuộc
 * destinationApprovalService của feature operations — hai vòng đời hoàn toàn khác.
 * Và `createReceivingNote` mà SaleReleasePage gọi là hàm của
 * @features/settlement/api/settlementService, KHÔNG phải của feature này; barrel này
 * cố tình không re-export hộ, để tên hàm chỉ có một chủ sở hữu duy nhất.
 *
 * VỀ NGUY CƠ VA CHẠM TÊN KHI DÙNG `export *` — đã kiểm trước khi viết:
 * feature này chỉ có ĐÚNG MỘT module trong api/ (receivingNoteService.js), nên
 * không tồn tại giao nhau giữa hai `export *` trong cùng barrel — không có đường nào
 * để ESM âm thầm biến một tên thành undefined ở đây. (Cạm bẫy getWarehouses giữa
 * adminService và warehouseService không chạm tới feature này; receiving cũng không
 * export tên nào tên là getWarehouses.) Chín tên api dưới đây cũng không trùng ba tên
 * component/page ở trên, nên gộp chung một barrel là an toàn.
 *
 * MỘT LƯU Ý CHO BARREL CẤP TRÊN: receivingNoteService có dòng
 * `export { getAdminApiError as getReceivingApiError }` — cùng một hàm với
 * getAdminApiError của @features/admin nhưng ĐÃ ĐỔI TÊN. Nhờ vậy nơi nào
 * `export * from "@features/admin"` cạnh `export * from "@features/receiving"` vẫn
 * không va chạm. Đừng "dọn dẹp" bằng cách bỏ alias đó.
 *
 * Đã mở từng file để xác minh hình dạng export thay vì suy từ tên file. CSS không
 * bao giờ re-export: feature này không có styles/ riêng, hai trang tự
 * `import "@features/operations/styles/..."` như side-effect nên thứ tự nạp CSS giữ
 * y hệt bản gốc.
 */

/* ------------------------------------------------------------------ */
/* PAGES — cả hai chỉ có `export default function`, không named export. */
/* ------------------------------------------------------------------ */

/* Admin tra cứu toàn bộ phiếu của mọi kho, kèm dấu vết ai đã duyệt. */
export { default as AdminReceivingNotesPage } from "./pages/AdminReceivingNotesPage/AdminReceivingNotesPage";

/* Cửa duyệt của Operations Manager cho hàng vừa tới kho gốc. */
export { default as OperationsReceivingApprovalsPage } from "./pages/OperationsReceivingApprovalsPage/OperationsReceivingApprovalsPage";

/* ------------------------------------------------------------------ */
/* COMPONENTS                                                          */
/* ------------------------------------------------------------------ */

/**
 * Bảng + Drawer đối chiếu + cặp nút Duyệt / Từ chối. Chỉ có default export;
 * DiffCell bên trong là hàm nội bộ không export, nên không có gì thêm để đưa ra.
 */
export { default as ReceivingNotesWorkspace } from "./components/ReceivingNotesWorkspace/ReceivingNotesWorkspace";

/* ------------------------------------------------------------------ */
/* API — MOCK                                                          */
/* ------------------------------------------------------------------ */

/**
 * Module api duy nhất của feature nên spread thẳng, khỏi phải bảo trì danh sách tên.
 * Đưa ra 9 tên: listReceivingNotes, getReceivingNoteDetail, getReceivingNoteByOrder,
 * approveReceivingNote, rejectReceivingNote, getReceivingStatusMeta,
 * RECEIVING_STATUS_META, RECEIVING_STATUS_TABS và getReceivingApiError.
 */
export * from "./api/receivingNoteService";

/**
 * `export *` KHÔNG mang theo default, mà receivingNoteService còn một default là
 * object gom sẵn tám thành viên của chính nó — nên phải nêu tường minh, đặt tên
 * theo module để gọi kiểu receivingNoteService.listReceivingNotes() vẫn dùng được.
 */
export { default as receivingNoteService } from "./api/receivingNoteService";
