/**
 * KHÔNG GIAN LÀM VIỆC CỦA SALE — gom màn theo việc, không theo màn.
 *
 * Trước đây menu Sale có 15 mục (4 dropdown) trong khi nhiều màn chỉ khác nhau ở bộ lọc:
 * "Quản lý ký gửi" / "Lịch sử ký gửi" / "Giấy tờ ký gửi" đều là danh sách đơn ký gửi;
 * "Đơn hàng cần xử lý" / "Theo dõi lô về VN" / "Hàng chờ tất toán" / "Yêu cầu giao hàng" /
 * "Sự cố" là các chặng nối đuôi nhau của cùng một đơn.
 *
 * Bảng này khai mỗi NHÓM là một mục menu, mỗi màn cũ thành một TAB trong nhóm. Tab đầu
 * tiên là mặc định (không cần ?tab= trên URL), nên mọi đường dẫn cũ vẫn mở đúng chỗ.
 *
 * Icon để ở dạng COMPONENT (không phải <Icon />) để file này không chứa JSX — nhờ vậy nó là
 * file hằng thuần, sửa bảng tab không làm React Fast Refresh nạp lại cả cây trang.
 *
 * Thứ tự tab trong nhóm "queue" chính là thứ tự chặng trong sổ tay vận hành:
 * cọc xong tạo phiếu tiếp nhận -> lô rời kho gốc -> hàng về VN tất toán -> giao -> sự cố.
 */
import {
  AlertOutlined,
  CarOutlined,
  CustomerServiceOutlined,
  DollarOutlined,
  ExportOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShoppingOutlined,
  TeamOutlined,
  CalculatorOutlined,
} from "@ant-design/icons";

import { SALE_BADGE_KEYS } from "../api/saleBadgeService";

import ConsignmentOrder from "@features/consignment/pages/ConsignmentOrder/ConsignmentOrder";
import ConsignmentBuyOrder from "@features/purchase/pages/ConsignmentBuyOrder/ConsignmentBuyOrder";
import PendingConsignmentList from "@features/consignment/pages/PendingConsignmentList/PendingConsignmentList";
import PendingConsignmentListHistory from "@features/history/pages/PendingConsignmentListHistory/PendingConsignmentListHistory";
import ConsignmentDocumentsList from "@features/documents/pages/ConsignmentDocumentsList/ConsignmentDocumentsList";
import PurchaseRequestList from "@features/purchase/pages/PurchaseRequestList/PurchaseRequestList";
import SupplierOrdersPage from "@features/purchase/pages/SupplierOrdersPage/SupplierOrdersPage";
import PendingPurchaseRequestListHistory from "@features/history/pages/PendingPurchaseRequestListHistory/PendingPurchaseRequestListHistory";
import PurchaseDocumentsList from "@features/documents/pages/PurchaseDocumentsList/PurchaseDocumentsList";
import SaleReleasePage from "@features/settlement/pages/SaleReleasePage/SaleReleasePage";
import SaleShipmentsPage from "@features/shipment/pages/SaleShipmentsPage/SaleShipmentsPage";
import SaleSettlementPage from "@features/settlement/pages/SaleSettlementPage/SaleSettlementPage";
import SaleDeliveriesPage from "@features/settlement/pages/SaleDeliveriesPage/SaleDeliveriesPage";
import SaleIncidentsPage from "@features/incident/pages/SaleIncidentsPage/SaleIncidentsPage";
import CustomerList from "@features/customer/pages/CustomerList/CustomerList";
import CustomerServiceChat from "@features/chat/pages/CustomerServiceChat/CustomerServiceChat";
import ServicePricings from "@features/pricing/pages/ServicePricings/ServicePricings";
import RestrictedItems from "@features/catalog/pages/RestrictedItems/RestrictedItems";

export const SALE_WORKSPACE_KEYS = Object.freeze({
  createOrder: "createOrder",
  consignments: "consignments",
  purchases: "purchases",
  queue: "queue",
  customers: "customers",
  lookup: "lookup",
});

export const SALE_WORKSPACES = Object.freeze({
  [SALE_WORKSPACE_KEYS.createOrder]: {
    label: "Tạo đơn hộ khách",
    hint: "Nhập hộ khách một yêu cầu mới rồi chuyển sang bước báo giá.",
    tabs: [
      {
        key: "consignment",
        label: "Ký gửi",
        Icon: InboxOutlined,
        component: ConsignmentOrder,
      },
      {
        key: "buy-orders",
        label: "Mua hộ",
        Icon: ShoppingOutlined,
        component: ConsignmentBuyOrder,
      },
    ],
  },

  [SALE_WORKSPACE_KEYS.consignments]: {
    label: "Đơn ký gửi",
    hint: "Một chỗ cho cả đơn đang chạy, đơn đã xong và chứng từ kèm theo.",
    tabs: [
      {
        key: "active",
        label: "Đang xử lý",
        Icon: FileSearchOutlined,
        badgeKey: SALE_BADGE_KEYS.consignments,
        component: PendingConsignmentList,
      },
      {
        key: "history",
        label: "Lịch sử",
        Icon: HistoryOutlined,
        component: PendingConsignmentListHistory,
      },
      {
        key: "documents",
        label: "Chứng từ",
        Icon: FileTextOutlined,
        component: ConsignmentDocumentsList,
      },
    ],
  },

  [SALE_WORKSPACE_KEYS.purchases]: {
    label: "Đơn mua hộ",
    hint: "Yêu cầu mua hộ đang chạy, đã xong và chứng từ kèm theo.",
    tabs: [
      {
        key: "active",
        label: "Đang xử lý",
        Icon: ShoppingOutlined,
        badgeKey: SALE_BADGE_KEYS.purchases,
        component: PurchaseRequestList,
      },
      {
        /* Xương sống của luồng mua hộ chuẩn: lập đơn mua NCC, gửi duyệt, đặt hàng, theo tiến độ. */
        key: "supplier-orders",
        label: "Đơn mua NCC",
        Icon: ShoppingOutlined,
        component: SupplierOrdersPage,
      },
      {
        key: "history",
        label: "Lịch sử",
        Icon: HistoryOutlined,
        component: PendingPurchaseRequestListHistory,
      },
      {
        key: "documents",
        label: "Chứng từ",
        Icon: FileTextOutlined,
        component: PurchaseDocumentsList,
      },
    ],
  },

  [SALE_WORKSPACE_KEYS.queue]: {
    label: "Việc cần xử lý",
    hint: "Các chặng nối tiếp nhau của một đơn, xếp theo đúng thứ tự trong sổ tay.",
    tabs: [
      {
        key: "releases",
        label: "Cần tạo phiếu",
        Icon: ExportOutlined,
        badgeKey: SALE_BADGE_KEYS.releases,
        component: SaleReleasePage,
      },
      {
        key: "shipments",
        label: "Lô về VN",
        Icon: SendOutlined,
        badgeKey: SALE_BADGE_KEYS.shipments,
        component: SaleShipmentsPage,
      },
      {
        key: "settlements",
        label: "Chờ tất toán",
        Icon: DollarOutlined,
        badgeKey: SALE_BADGE_KEYS.settlements,
        component: SaleSettlementPage,
      },
      {
        key: "deliveries",
        label: "Giao hàng",
        Icon: CarOutlined,
        badgeKey: SALE_BADGE_KEYS.deliveries,
        component: SaleDeliveriesPage,
      },
      {
        key: "incidents",
        label: "Sự cố hàng hoá",
        Icon: AlertOutlined,
        badgeKey: SALE_BADGE_KEYS.incidents,
        component: SaleIncidentsPage,
      },
    ],
  },

  [SALE_WORKSPACE_KEYS.customers]: {
    label: "Khách hàng",
    hint: "Hồ sơ khách và kênh chăm sóc nằm cạnh nhau.",
    tabs: [
      {
        key: "list",
        label: "Danh sách khách",
        Icon: TeamOutlined,
        component: CustomerList,
      },
      {
        key: "support",
        label: "Chăm sóc khách hàng",
        Icon: CustomerServiceOutlined,
        component: CustomerServiceChat,
      },
    ],
  },

  [SALE_WORKSPACE_KEYS.lookup]: {
    label: "Tra cứu",
    hint: "Bảng giá và danh mục hàng cấm để trả lời khách ngay khi đang tư vấn.",
    tabs: [
      {
        key: "pricing",
        label: "Phí dịch vụ",
        Icon: CalculatorOutlined,
        component: ServicePricings,
      },
      {
        key: "restricted",
        label: "Hàng cấm, hạn chế",
        Icon: SafetyCertificateOutlined,
        component: RestrictedItems,
      },
    ],
  },
});

/** Đường dẫn tới đúng một tab; tab đầu nhóm không cần tham số. */
export const saleWorkspaceTabPath = (basePath, groupKey, tabKey) => {
  const group = SALE_WORKSPACES[groupKey];

  if (!group || !tabKey || group.tabs[0]?.key === tabKey) {
    return basePath;
  }

  return `${basePath}?tab=${tabKey}`;
};

export default SALE_WORKSPACES;
