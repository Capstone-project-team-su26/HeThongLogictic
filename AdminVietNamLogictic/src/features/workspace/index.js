/**
 * BỀ MẶT CÔNG KHAI CỦA FEATURE "workspace" — vỏ gom nhiều màn cũ vào một mục menu.
 *
 * Feature này không có nghiệp vụ và không gọi API: nó chỉ bố cục lại các trang có sẵn
 * của consignment / purchase / settlement / shipment / incident / customer / chat /
 * pricing / catalog theo nhóm việc của Sale.
 */

export { default as SaleWorkspacePage } from "./pages/SaleWorkspacePage/SaleWorkspacePage";

export { default as SaleBadgeProvider } from "./context/SaleBadgeProvider";
export { useSaleBadges } from "./context/saleBadgeStore";

export {
  SALE_BADGE_KEYS,
  SALE_QUEUE_BADGE_KEYS,
  EMPTY_SALE_BADGES,
  loadSaleBadges,
  sumSaleBadges,
} from "./api/saleBadgeService";

export {
  SALE_WORKSPACES,
  SALE_WORKSPACE_KEYS,
  saleWorkspaceTabPath,
} from "./constants/saleWorkspaces";
