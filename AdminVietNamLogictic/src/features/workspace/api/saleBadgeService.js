/**
 * ĐẾM VIỆC ĐANG CHỜ SALE — số hiện trên menu và trên tab.
 *
 * Nguyên tắc: badge chỉ đếm việc SALE CÒN PHẢI RA TAY. Việc đã làm xong thì rơi khỏi badge
 * ngay cả khi dòng đó vẫn còn nằm trong danh sách:
 *   - đã gửi báo giá, đang chờ khách trả lời  -> không tính;
 *   - đã lập phiếu, đang chờ bộ phận khác duyệt -> không tính (canAct = false);
 *   - đã phát hành khoản thu cuối, chờ khách trả -> không tính (pendingPaymentAmount có giá trị);
 *   - phiếu giao hoàn về kho nhưng đã có phiếu giao lại -> không tính.
 *
 * Hai nguồn đếm khác nhau:
 *  - Danh sách có phân trang (ký gửi, mua hộ, sự cố): gọi pageSize=1 rồi lấy totalCount —
 *    không kéo cả trang dữ liệu chỉ để đếm.
 *  - Hàng đợi trả mảng trần (action-queue, tất toán, lô, phiếu giao): lấy length.
 *
 * Mọi lỗi đều nuốt về 0: badge sai một nhịp thì thôi, tuyệt đối không được làm hỏng trang
 * đang mở hay đẩy người dùng ra màn đăng nhập.
 */
import { getConsignmentsApi } from "@features/consignment/api/consignmentService";
import { getPurchaseRequestsApi } from "@features/purchase/api/purchaseRequestService";
import { listActionQueue } from "@features/settlement/api/actionQueueService";
import { listAwaitingSettlement } from "@features/settlement/api/settlementService";
import { getTrackingQueue } from "@features/shipment/api/internationalShipmentService";
import { listDeliveryRequests } from "@features/operations/api/destinationApprovalService";
import { listIncidents } from "@features/incident/api/parcelIncidentService";
import { getConversationsApi } from "@features/chat/api/conversationApi";

/** Khoá badge — dùng chung cho menu (Sidebar) và tab (SaleWorkspacePage). */
export const SALE_BADGE_KEYS = Object.freeze({
  consignments: "consignments",
  purchases: "purchases",
  releases: "releases",
  shipments: "shipments",
  settlements: "settlements",
  deliveries: "deliveries",
  incidents: "incidents",
  support: "support",
});

/** Badge của mục "Việc cần xử lý" là tổng 5 tab bên trong. */
export const SALE_QUEUE_BADGE_KEYS = Object.freeze([
  SALE_BADGE_KEYS.releases,
  SALE_BADGE_KEYS.shipments,
  SALE_BADGE_KEYS.settlements,
  SALE_BADGE_KEYS.deliveries,
  SALE_BADGE_KEYS.incidents,
]);

export const EMPTY_SALE_BADGES = Object.freeze(
  Object.fromEntries(Object.values(SALE_BADGE_KEYS).map((key) => [key, 0]))
);

const countOfPage = (page) => {
  const total = Number(page?.totalCount);

  if (Number.isFinite(total) && total >= 0) {
    return total;
  }

  return Array.isArray(page?.items) ? page.items.length : 0;
};

const countOfList = (list) => (Array.isArray(list) ? list.length : 0);

/** Đếm dòng còn là việc của Sale; danh sách hỏng thì coi như không có việc nào. */
const countWhere = (list, isPending) =>
  Array.isArray(list) ? list.filter(isPending).length : 0;

/* Mỗi nguồn là một cặp [khoá, hàm đếm]; thêm badge mới chỉ cần thêm một dòng. */
const SOURCES = [
  [
    SALE_BADGE_KEYS.consignments,
    /* Đơn ký gửi khách vừa gửi, đang chờ Sale lập báo giá. */
    async () =>
      countOfPage(
        await getConsignmentsApi({
          status: "PENDING_REVIEW",
          pageNumber: 1,
          pageSize: 1,
        })
      ),
  ],
  [
    SALE_BADGE_KEYS.purchases,
    /* Yêu cầu mua hộ chờ Sale duyệt / báo giá. */
    async () =>
      countOfPage(
        await getPurchaseRequestsApi({
          status: "PENDING_REVIEW",
          pageNumber: 1,
          pageSize: 1,
        })
      ),
  ],
  [
    SALE_BADGE_KEYS.releases,
    /*
     * Hàng đợi trả về cả dòng đang chờ bộ phận khác (phiếu đã lập, chờ kho duyệt). Server
     * đã tính sẵn `canAct` — đúng những dòng có nút bấm được, tức việc còn của Sale.
     */
    async () => countWhere(await listActionQueue(), (row) => row?.canAct),
  ],
  [
    SALE_BADGE_KEYS.shipments,
    /* Lô đang về VN mà server đánh dấu "cần chú ý" (trễ mốc, thiếu chứng từ). */
    async () => countOfList(await getTrackingQueue({ attentionOnly: true })),
  ],
  [
    SALE_BADGE_KEYS.settlements,
    /*
     * Hàng đã về kho VN. `pendingPaymentAmount` có giá trị nghĩa là Sale chốt phí cuối rồi,
     * giờ là việc của khách — dòng vẫn ở lại danh sách nhưng không còn là việc của Sale.
     */
    async () =>
      countWhere(
        await listAwaitingSettlement(),
        (row) => !(Number(row?.pendingPaymentAmount) > 0)
      ),
  ],
  [
    SALE_BADGE_KEYS.deliveries,
    /*
     * Giao không thành, hàng hoàn về kho — Sale phải hẹn giao lại. Phiếu hoàn KHÔNG đổi
     * trạng thái sau khi đã hẹn lại: phiếu giao lại chỉ trỏ ngược về nó bằng
     * `sourceDeliveryRequestId`. Vì vậy phải đọc cả danh sách rồi trừ đi những phiếu hoàn
     * đã có người kế nhiệm, nếu không badge sẽ treo số cũ mãi.
     */
    async () => {
      const result = await listDeliveryRequests({});
      const rows = Array.isArray(result) ? result : [];

      const handledSourceIds = new Set(
        rows
          .map((row) => row?.sourceDeliveryRequestId)
          .filter(Boolean)
          .map(String)
      );

      return rows.filter(
        (row) =>
          String(row?.status || "").toUpperCase() === "DELIVERY_RETURNED" &&
          !handledSourceIds.has(String(row?.deliveryRequestId))
      ).length;
    },
  ],
  [
    SALE_BADGE_KEYS.incidents,
    /*
     * Chỉ sự cố còn OPEN — khách chưa chọn hướng xử lý nên đơn đang bị chặn tất toán.
     * Sự cố đã RESOLVED (kho quyết xong) không còn nằm trong badge.
     */
    async () =>
      countOfPage(
        await listIncidents({ status: "OPEN", pageNumber: 1, pageSize: 1 })
      ),
  ],
  [
    SALE_BADGE_KEYS.support,
    /*
     * Chat CSKH: số hội thoại còn tin KHÁCH chưa đọc (unreadCount do backend tính theo
     * người xem). Hộp thư của Sale = hội thoại chưa ai nhận + hội thoại của mình, nên
     * khách vừa mở hội thoại mới cũng được đếm. Mở hội thoại là đánh dấu đã đọc → rơi khỏi badge.
     */
    async () =>
      countWhere(
        await getConversationsApi(),
        (conversation) => Number(conversation?.unreadCount) > 0
      ),
  ],
];

/**
 * Đếm một lượt tất cả nguồn. Các lời gọi chạy song song và độc lập: một API chết thì badge
 * của nó về 0, phần còn lại vẫn đúng.
 *
 * @returns {Promise<Record<string, number>>}
 */
export const loadSaleBadges = async () => {
  const results = await Promise.allSettled(
    SOURCES.map(([, count]) => count())
  );

  return SOURCES.reduce((badges, [key], index) => {
    const result = results[index];
    const value = result.status === "fulfilled" ? Number(result.value) : 0;

    badges[key] = Number.isFinite(value) && value > 0 ? value : 0;

    return badges;
  }, {});
};

/** Tổng badge của một nhóm tab, ví dụ mục "Việc cần xử lý". */
export const sumSaleBadges = (badges, keys = []) =>
  keys.reduce((total, key) => total + (Number(badges?.[key]) || 0), 0);
