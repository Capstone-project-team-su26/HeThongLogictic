/**
 * One-shot migration: HeThongLogictic/AdminVietNamLogictic -> vcl-admin-ui
 *
 * Chuyển từng file sang vị trí mới theo cấu trúc feature-based và viết lại mọi
 * import specifier sang dạng alias.
 *
 *   node tools/migrate.mjs
 */
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT =
  "/Volumes/RCAdvisor/CUS354/HeThongLogictic/AdminVietNamLogictic";
const DST_ROOT = "/Volumes/RCAdvisor/CUS354/vcl-admin-ui";

const pair = (o, n) => [o, n];

/** "<dir>/<Name>.jsx" + "<dir>/<Name>.css" -> thư mục mới cùng tên. */
const page = (oldDir, oldName, newDir, newName = oldName) => [
  pair(`src/${oldDir}/${oldName}.jsx`, `src/${newDir}/${newName}.jsx`),
  pair(`src/${oldDir}/${oldName}.css`, `src/${newDir}/${newName}.css`),
];

/** Component chỉ có .jsx, đặt vào thư mục riêng mang tên nó. */
const comp = (oldPath, newDir, name) =>
  pair(oldPath, `src/${newDir}/${name}/${name}.jsx`);

const MAP = [
  /* ---------------- entry & app shell ---------------- */
  pair("src/main.jsx", "src/main.jsx"),
  pair("src/App.jsx", "src/app/App.jsx"),
  pair("src/routes/PrivateRoute.jsx", "src/app/router/RequireAuth.jsx"),

  /* ---------------- global styles (bản gốc không import) ---------------- */
  pair("src/index.css", "src/shared/styles/legacy/index-legacy.css"),
  pair("src/App.css", "src/shared/styles/legacy/app-legacy.css"),

  /* ---------------- shared api ---------------- */
  pair("src/api/axiosInstance.js", "src/shared/api/httpClient.js"),
  pair("src/api/apiEndpoints.js", "src/shared/api/apiEndpoints.js"),
  pair("src/api/Upload/UploadImage.js", "src/shared/api/uploadImage.js"),
  pair("src/api/AddressAPI/vietnamAddressService.js", "src/shared/api/vietnamAddressService.js"),

  /* ---------------- shared utils ---------------- */
  pair("src/utils/timeUtc.js", "src/shared/utils/timeUtc.js"),
  pair("src/utils/Common/authSession.js", "src/shared/utils/authSession.js"),

  /* ---------------- shared components ---------------- */
  pair("src/utils/Common/AuthNotify.jsx", "src/shared/components/AuthNotify/AuthNotify.jsx"),
  pair("src/utils/Common/auth-notify.css", "src/shared/components/AuthNotify/AuthNotify.css"),
  pair("src/utils/LoginLoader/LoginLoaderPay.jsx", "src/shared/components/LoginLoader/LoginLoader.jsx"),
  pair("src/utils/LoginLoader/LoginLoaderPay.css", "src/shared/components/LoginLoader/LoginLoader.css"),
  pair("src/components/AddressComponents/VietnamAddressSelector.jsx", "src/shared/components/VietnamAddressSelector/VietnamAddressSelector.jsx"),
  pair("src/components/AddressComponents/VietnamAddressSelector.css", "src/shared/components/VietnamAddressSelector/VietnamAddressSelector.css"),
  pair("src/components/UserComponents/UserProfileModal.jsx", "src/shared/components/UserProfileModal/UserProfileModal.jsx"),
  pair("src/components/UserComponents/UserProfileModal.css", "src/shared/components/UserProfileModal/UserProfileModal.css"),
  pair("src/components/SaleComponents/SaleKiguiComponents/ToltipLapelComponents/FieldLabelTooltip.jsx", "src/shared/components/FieldLabelTooltip/FieldLabelTooltip.jsx"),
  pair("src/components/SaleComponents/SaleKiguiComponents/ToltipLapelComponents/FieldLabelTooltip.css", "src/shared/components/FieldLabelTooltip/FieldLabelTooltip.css"),
  /* CSS dùng chung bởi hai màn tạo đơn nằm ở hai feature khác nhau. */
  pair("src/pages/SalePage/CreateRequestPage/CreateRequestPage.css", "src/shared/styles/create-request.css"),

  /* ---------------- layouts ---------------- */
  pair("src/layouts/mainLayout.jsx", "src/layouts/MainLayout/MainLayout.jsx"),
  pair("src/layouts/app-layout.css", "src/layouts/MainLayout/MainLayout.css"),
  pair("src/layouts/HeaderLayout/Header.jsx", "src/layouts/Header/Header.jsx"),
  pair("src/layouts/HeaderLayout/rc-hd.header.css", "src/layouts/Header/Header.css"),
  pair("src/layouts/SidebarLayout/Sidebar.jsx", "src/layouts/Sidebar/Sidebar.jsx"),
  pair("src/layouts/SidebarLayout/Sidebar.css", "src/layouts/Sidebar/Sidebar.css"),

  /* ================= FEATURE: auth ================= */
  pair("src/api/Auth/authService.js", "src/features/auth/api/authService.js"),
  pair("src/pages/LoginPage/Login.jsx", "src/features/auth/pages/Login/Login.jsx"),
  pair("src/pages/LoginPage/login.css", "src/features/auth/pages/Login/Login.css"),

  /* ================= FEATURE: dashboard ================= */
  pair("src/api/OperationsAPI/operationsDashboardService.js", "src/features/dashboard/api/operationsDashboardService.js"),
  ...page("pages/SalePage/SaleDashboard", "SaleDashboard", "features/dashboard/pages/SaleDashboard"),
  pair("src/pages/AdminPage/AdminDashboard.jsx", "src/features/dashboard/pages/AdminDashboard/AdminDashboard.jsx"),
  pair("src/pages/OperationsPage/OperationsDashboard.jsx", "src/features/dashboard/pages/OperationsDashboard/OperationsDashboard.jsx"),

  /* ================= FEATURE: consignment ================= */
  pair("src/api/SaleAPI/ConsignmentAPI/consignmentService.js", "src/features/consignment/api/consignmentService.js"),
  pair("src/api/SaleAPI/ConsignmentAPI/consignmentMasterService.js", "src/features/consignment/api/consignmentMasterService.js"),
  pair("src/api/SaleAPI/ConsignmentAPI/consignmentReceiptService.js", "src/features/consignment/api/consignmentReceiptService.js"),
  pair("src/api/SaleAPI/ConsignmentAPI/deliveryAddressService.js", "src/features/consignment/api/deliveryAddressService.js"),
  ...page("components/SaleComponents/SaleKiguiComponents/ConfirmKigui", "ConsignmentOrderConfirm", "features/consignment/components/ConsignmentOrderConfirm"),
  ...page("components/SaleComponents/SaleKiguiComponents/PackageOptionalServices", "PackageOptionalServices", "features/consignment/components/PackageOptionalServices"),
  ...page("pages/SalePage/ConsignmentsPage/CreateConsigmentsQotation/ConfirmCrearConssigemtQuotaion", "ConfirmConsignmentQuotation", "features/consignment/components/ConfirmConsignmentQuotation"),
  ...page("pages/SalePage/ConsignmentsPage", "PendingConsignmentList", "features/consignment/pages/PendingConsignmentList"),
  ...page("pages/SalePage/ConsignmentsPage/ConsigmentsDetail", "ConsignmentDetail", "features/consignment/pages/ConsignmentDetail"),
  ...page("pages/SalePage/ConsignmentsPage/CreateConsigmentsQotation", "CreateConsignmentQuotation", "features/consignment/pages/CreateConsignmentQuotation"),
  ...page("pages/SalePage/CreateRequestPage/CreateRequestOrderCusPage", "ConsignmentOrder", "features/consignment/pages/ConsignmentOrder"),

  /* ================= FEATURE: purchase ================= */
  pair("src/api/SaleAPI/PurchaseRequestAPI/purchaseRequestService.js", "src/features/purchase/api/purchaseRequestService.js"),
  pair("src/api/SaleAPI/PurchaseRequestAPI/confirmPurchaseApi.js", "src/features/purchase/api/confirmPurchaseApi.js"),
  ...page("components/SaleComponents/SaleBuyComponents/ConfirmBuy", "ConsignmentBuyOrderConfirm", "features/purchase/components/ConsignmentBuyOrderConfirm"),
  ...page("components/SaleComponents/SaleBuyComponents/PacketOption", "PackageOptionalServicesS1", "features/purchase/components/PackageOptionalServicesS1"),
  ...page("pages/SalePage/PurchasePage/PurchaseRequetDetail", "ConfirmPurchaseModal", "features/purchase/components/ConfirmPurchaseModal"),
  ...page("pages/SalePage/PurchasePage/PurchaseRequetDetail", "CreatePurchaseRequestQuotationModal", "features/purchase/components/CreatePurchaseRequestQuotationModal"),
  ...page("pages/SalePage/PurchasePage", "PurchaseRequestList", "features/purchase/pages/PurchaseRequestList"),
  ...page("pages/SalePage/PurchasePage/PurchaseRequetDetail", "PurchaseRequestDetail", "features/purchase/pages/PurchaseRequestDetail"),
  ...page("pages/SalePage/CreateRequestPage/CreateRequestBuyCuspage", "ConsignmentBuyOrder", "features/purchase/pages/ConsignmentBuyOrder"),

  /* ================= FEATURE: customer ================= */
  pair("src/api/SaleAPI/CusSale/CusSaleService.js", "src/features/customer/api/customerService.js"),
  ...page("pages/SalePage/CusTomerPagesale", "CustomerList", "features/customer/pages/CustomerList"),
  ...page("pages/SalePage/CusTomerPagesale/CreateCustomerSale", "CreateCustomerSale", "features/customer/components/CreateCustomerSale"),
  ...page("pages/SalePage/CusTomerPagesale/EditCustomerSale", "EditCustomerSale", "features/customer/components/EditCustomerSale"),
  ...page("pages/SalePage/CusTomerPagesale/CusDeatilSale", "CustomerDetailModal", "features/customer/components/CustomerDetailModal"),

  /* ================= FEATURE: pricing ================= */
  pair("src/api/SaleAPI/ConsignmentAPI/pricingRuleService.js", "src/features/pricing/api/pricingRuleService.js"),
  pair("src/api/SaleAPI/ConsignmentAPI/servicePricingService.js", "src/features/pricing/api/servicePricingService.js"),
  pair("src/api/SaleAPI/ConsignmentAPI/packageConfigurationService.js", "src/features/pricing/api/packageConfigurationService.js"),
  pair("src/api/SaleAPI/ExchangeRateAPI/exchangeRateService.js", "src/features/pricing/api/exchangeRateService.js"),
  ...page("pages/SalePage/ServicePricingRule", "ServicePricings", "features/pricing/pages/ServicePricings"),

  /* ================= FEATURE: catalog (danh mục dùng chung) ================= */
  pair("src/api/SaleAPI/ConsignmentAPI/restrictedItemService.js", "src/features/catalog/api/restrictedItemService.js"),
  pair("src/pages/AdminPage/AdminCatalogPages.jsx", "src/features/catalog/pages/AdminCatalogPages.jsx"),
  pair("src/pages/AdminPage/AdminResourcePage.jsx", "src/features/catalog/components/AdminResourcePage/AdminResourcePage.jsx"),
  ...page("pages/SalePage/BanItem", "RestrictedItems", "features/catalog/pages/RestrictedItems"),

  /* ================= FEATURE: warehouse ================= */
  pair("src/api/SaleAPI/ConsignmentAPI/warehouseService.js", "src/features/warehouse/api/warehouseService.js"),
  pair("src/pages/AdminPage/WarehouseLocationsPage.jsx", "src/features/warehouse/pages/WarehouseLocationsPage/WarehouseLocationsPage.jsx"),
  comp("src/pages/AdminPage/components/BinInventoryModal.jsx", "features/warehouse/components", "BinInventoryModal"),
  comp("src/pages/AdminPage/components/WarehouseHeroHeader.jsx", "features/warehouse/components", "WarehouseHeroHeader"),
  comp("src/pages/AdminPage/components/WarehouseLayeredView.jsx", "features/warehouse/components", "WarehouseLayeredView"),
  comp("src/pages/AdminPage/components/WarehouseLayoutGridView.jsx", "features/warehouse/components", "WarehouseLayoutGridView"),
  comp("src/pages/AdminPage/components/WarehouseLayoutModal.jsx", "features/warehouse/components", "WarehouseLayoutModal"),
  comp("src/pages/AdminPage/components/WarehouseLoadingSkeleton.jsx", "features/warehouse/components", "WarehouseLoadingSkeleton"),
  comp("src/pages/AdminPage/components/WarehouseLocationModal.jsx", "features/warehouse/components", "WarehouseLocationModal"),
  comp("src/pages/AdminPage/components/WarehouseOccupancyStatusView.jsx", "features/warehouse/components", "WarehouseOccupancyStatusView"),
  comp("src/pages/AdminPage/components/WarehouseSummaryCard.jsx", "features/warehouse/components", "WarehouseSummaryCard"),
  comp("src/pages/AdminPage/components/WarehouseToolbar.jsx", "features/warehouse/components", "WarehouseToolbar"),

  /* ================= FEATURE: admin ================= */
  pair("src/api/AdminAPI/adminService.js", "src/features/admin/api/adminService.js"),
  pair("src/api/AdminAPI/adminFinanceService.js", "src/features/admin/api/adminFinanceService.js"),
  pair("src/pages/AdminPage/AdminPage.css", "src/features/admin/styles/AdminPage.css"),
  pair("src/pages/AdminPage/AdminUsersPage.jsx", "src/features/admin/pages/AdminUsersPage/AdminUsersPage.jsx"),
  pair("src/pages/AdminPage/AdminCashFlowPage.jsx", "src/features/admin/pages/AdminCashFlowPage/AdminCashFlowPage.jsx"),
  pair("src/pages/AdminPage/AdminDeliveriesPage.jsx", "src/features/admin/pages/AdminDeliveriesPage/AdminDeliveriesPage.jsx"),

  /* ================= FEATURE: operations ================= */
  pair("src/api/OperationsAPI/consolidationWorkflowService.js", "src/features/operations/api/consolidationWorkflowService.js"),
  pair("src/api/OperationsAPI/destinationApprovalService.js", "src/features/operations/api/destinationApprovalService.js"),
  pair("src/api/OperationsAPI/operationsMappers.js", "src/features/operations/api/operationsMappers.js"),
  pair("src/api/OperationsAPI/parcelInspectionService.js", "src/features/operations/api/parcelInspectionService.js"),
  pair("src/api/OperationsAPI/parcelReturnService.js", "src/features/operations/api/parcelReturnService.js"),
  pair("src/pages/OperationsPage/OperationsPage.css", "src/features/operations/styles/OperationsPage.css"),
  pair("src/pages/OperationsPage/OperationsWroPage/OperationsWroPage.css", "src/features/operations/styles/OperationsWroPage.css"),
  pair("src/pages/OperationsPage/OperationsWroPage/index.jsx", "src/features/operations/pages/OperationsWroPage/OperationsWroPage.jsx"),
  comp("src/pages/OperationsPage/OperationsWroPage/components/WroExportTypeTag.jsx", "features/operations/components/wro", "WroExportTypeTag"),
  comp("src/pages/OperationsPage/OperationsWroPage/components/WroFilterBar.jsx", "features/operations/components/wro", "WroFilterBar"),
  comp("src/pages/OperationsPage/OperationsWroPage/components/WroHeader.jsx", "features/operations/components/wro", "WroHeader"),
  comp("src/pages/OperationsPage/OperationsWroPage/components/WroItemExpandTable.jsx", "features/operations/components/wro", "WroItemExpandTable"),
  comp("src/pages/OperationsPage/OperationsWroPage/components/WroTableList.jsx", "features/operations/components/wro", "WroTableList"),
  comp("src/pages/OperationsPage/components/MasterBoxDetailModal.jsx", "features/operations/components", "MasterBoxDetailModal"),
  comp("src/pages/OperationsPage/components/MasterBoxFormModal.jsx", "features/operations/components", "MasterBoxFormModal"),
  comp("src/pages/OperationsPage/components/ParcelDetailModal.jsx", "features/operations/components", "ParcelDetailModal"),
  comp("src/pages/OperationsPage/components/ShipmentDetailModal.jsx", "features/operations/components", "ShipmentDetailModal"),
  comp("src/pages/OperationsPage/components/WroDetailModal.jsx", "features/operations/components", "WroDetailModal"),
  comp("src/pages/OperationsPage/components/WroLotFormModal.jsx", "features/operations/components", "WroLotFormModal"),
  comp("src/pages/OperationsPage/components/WroShippingRouteModal.jsx", "features/operations/components", "WroShippingRouteModal"),
  comp("src/pages/OperationsPage/components/WroViewModal.jsx", "features/operations/components", "WroViewModal"),
  comp("src/pages/OperationsPage/OperationsParcelsPage.jsx", "features/operations/pages", "OperationsParcelsPage"),
  comp("src/pages/OperationsPage/OperationsShipmentsPage.jsx", "features/operations/pages", "OperationsShipmentsPage"),
  comp("src/pages/OperationsPage/OperationsInboundApprovalsPage.jsx", "features/operations/pages", "OperationsInboundApprovalsPage"),
  comp("src/pages/OperationsPage/OperationsDeliveryApprovalsPage.jsx", "features/operations/pages", "OperationsDeliveryApprovalsPage"),
  comp("src/pages/OperationsPage/OperationsParcelReturnsPage.jsx", "features/operations/pages", "OperationsParcelReturnsPage"),
  comp("src/pages/OperationsPage/OperationsInspectionsPage.jsx", "features/operations/pages", "OperationsInspectionsPage"),
  comp("src/pages/OperationsPage/OperationsPurchaseStorePage.jsx", "features/operations/pages", "OperationsPurchaseStorePage"),
  pair("src/pages/SalePage/SaleWroPage/index.jsx", "src/features/operations/pages/SaleWroPage/SaleWroPage.jsx"),

  /* ================= FEATURE: shipment ================= */
  pair("src/components/Shipment/ShipmentWorkspace.jsx", "src/features/shipment/components/ShipmentWorkspace/ShipmentWorkspace.jsx"),
  pair("src/components/Shipment/ShipmentJourneySteps.jsx", "src/features/shipment/components/ShipmentJourneySteps/ShipmentJourneySteps.jsx"),
  pair("src/components/ShipmentJourney/ShipmentJourney.jsx", "src/features/shipment/components/ShipmentJourney/ShipmentJourney.jsx"),
  pair("src/components/ShipmentJourney/ShipmentJourney.css", "src/features/shipment/components/ShipmentJourney/ShipmentJourney.css"),
  pair("src/components/ShipmentJourney/journeySummary.js", "src/features/shipment/components/ShipmentJourney/journeySummary.js"),
  pair("src/pages/AdminPage/AdminShipmentsPage.jsx", "src/features/shipment/pages/AdminShipmentsPage/AdminShipmentsPage.jsx"),
  pair("src/pages/SalePage/SaleShipmentsPage/index.jsx", "src/features/shipment/pages/SaleShipmentsPage/SaleShipmentsPage.jsx"),

  /* ================= FEATURE: receiving ================= */
  pair("src/api/OperationsAPI/receivingNoteService.js", "src/features/receiving/api/receivingNoteService.js"),
  pair("src/components/ReceivingNotes/ReceivingNotesWorkspace.jsx", "src/features/receiving/components/ReceivingNotesWorkspace/ReceivingNotesWorkspace.jsx"),
  pair("src/pages/AdminPage/AdminReceivingNotesPage.jsx", "src/features/receiving/pages/AdminReceivingNotesPage/AdminReceivingNotesPage.jsx"),
  pair("src/pages/OperationsPage/OperationsReceivingApprovalsPage.jsx", "src/features/receiving/pages/OperationsReceivingApprovalsPage/OperationsReceivingApprovalsPage.jsx"),

  /* ================= FEATURE: goship ================= */
  pair("src/api/OperationsAPI/goshipOrderService.js", "src/features/goship/api/goshipOrderService.js"),
  pair("src/pages/SalePage/SaleGoshipOrdersPage/index.jsx", "src/features/goship/pages/SaleGoshipOrdersPage/SaleGoshipOrdersPage.jsx"),

  /* ================= FEATURE: documents ================= */
  ...page("pages/SalePage/DocumentsPage/ConsignmentDocumentsPage", "ConsignmentDocumentsList", "features/documents/pages/ConsignmentDocumentsList"),
  ...page("pages/SalePage/DocumentsPage/PurchaseDocumentsPage", "PurchaseDocumentsList", "features/documents/pages/PurchaseDocumentsList"),

  /* ================= FEATURE: history ================= */
  ...page("pages/SalePage/HistorySalePage/HistoryOrderPage", "PendingConsignmentListHistory", "features/history/pages/PendingConsignmentListHistory"),
  ...page("pages/SalePage/HistorySalePage/HistoryPurchasePage", "PendingPurchaseRequestListHistory", "features/history/pages/PendingPurchaseRequestListHistory"),

  /* ================= FEATURE: payment ================= */
  pair("src/api/SaleAPI/Historyapi/orderPaymentService.js", "src/features/payment/api/orderPaymentService.js"),
  ...page("pages/SalePage/HistorySalePage/HistoryOrderPage/OrderDetailhisstory", "OrderPaymentHistory", "features/payment/pages/OrderPaymentHistory"),

  /* ================= FEATURE: settlement ================= */
  pair("src/api/SaleAPI/SettlementAPI/settlementService.js", "src/features/settlement/api/settlementService.js"),
  ...page("pages/SalePage/SettlementPage", "SaleSettlementPage", "features/settlement/pages/SaleSettlementPage"),
  pair("src/pages/SalePage/SettlementPage/SaleReleasePage.jsx", "src/features/settlement/pages/SaleReleasePage/SaleReleasePage.jsx"),

  /* ================= FEATURE: chat ================= */
  pair("src/api/SaleAPI/Conversation/conversationApi.js", "src/features/chat/api/conversationApi.js"),
  pair("src/api/SaleAPI/AiAPI/saleAiService.js", "src/features/chat/api/saleAiService.js"),
  ...page("pages/SalePage/Chat", "CustomerServiceChat", "features/chat/pages/CustomerServiceChat"),
  ...page("pages/SalePage/Chat/components", "SalesAiAssistantPanel", "features/chat/components/SalesAiAssistantPanel"),
];

/* Không mang sang — kèm lý do. */
const DROPPED = new Map([
  ["src/routes/AppRoutes.jsx", "thay bằng src/app/router/*"],
  ["src/pages/OperationsPage/OperationsWroPage.jsx", "shim 3 dòng re-export, router import thẳng trang thật"],
  ["src/pages/SalePage/CusTomerPagesale/CustomerAdress/CustomerAddressSelector.jsx", "shim 1 dòng re-export VietnamAddressSelector"],
  ["src/pages/SalePage/CusTomerPagesale/CustomerAdress/CustomerAddressSelector.css", "không file nào import"],
  ["src/pages/OperationsPage/OperationsWroApprovalsPage.jsx", "code chết: không route, không import"],
  ["src/pages/OperationsPage/components/ShipmentFormModal.jsx", "code chết: không file nào import"],
  ["src/pages/OperationsPage/components/WroApproveModal.jsx", "code chết: không file nào import"],
  ["src/pages/OperationsPage/components/wro/WroExportTypeTag.jsx", "bản trùng cũ của OperationsWroPage/components"],
  ["src/pages/OperationsPage/components/wro/WroHeader.jsx", "bản trùng cũ"],
  ["src/pages/OperationsPage/components/wro/WroItemExpandTable.jsx", "bản trùng cũ"],
  ["src/pages/OperationsPage/components/wro/WroTableList.jsx", "bản trùng cũ"],
]);

/** Import trỏ tới file đã bỏ -> chuyển hướng sang file thật. */
const REDIRECT = new Map([
  [
    "src/pages/SalePage/CusTomerPagesale/CustomerAdress/CustomerAddressSelector.jsx",
    "src/components/AddressComponents/VietnamAddressSelector.jsx",
  ],
  [
    "src/pages/OperationsPage/OperationsWroPage.jsx",
    "src/pages/OperationsPage/OperationsWroPage/index.jsx",
  ],
]);

const ASSETS = ["anhlogocap2.jpeg", "hero.png", "react.svg", "vite.svg"];

/* ------------------------------------------------------------------ *
 * Engine                                                              *
 * ------------------------------------------------------------------ */

const oldToNew = new Map(MAP);

const problems = [];
const seenDst = new Map();
for (const [o, n] of MAP) {
  if (!fs.existsSync(path.join(SRC_ROOT, o))) problems.push(`MISSING SOURCE: ${o}`);
  if (seenDst.has(n)) problems.push(`DUPLICATE DEST: ${n} (${o} & ${seenDst.get(n)})`);
  seenDst.set(n, o);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
};
const allSource = walk(path.join(SRC_ROOT, "src"))
  .map((p) => path.relative(SRC_ROOT, p))
  .filter((p) => /\.(jsx?|css)$/.test(p) && !p.startsWith("src/assets/"));

const unaccounted = allSource.filter((p) => !oldToNew.has(p) && !DROPPED.has(p));
if (unaccounted.length) {
  console.error("UNACCOUNTED SOURCE FILES:\n" + unaccounted.join("\n"));
  process.exit(1);
}

const ALIASES = [
  ["src/app/", "@app/"],
  ["src/shared/", "@shared/"],
  ["src/features/", "@features/"],
  ["src/layouts/", "@layouts/"],
  ["src/assets/", "@assets/"],
];

const toAlias = (newPath) => {
  for (const [prefix, alias] of ALIASES) {
    if (newPath.startsWith(prefix)) return alias + newPath.slice(prefix.length);
  }
  return "@/" + newPath.slice("src/".length);
};

const stripExt = (p) => p.replace(/\.(jsx|js)$/, "");
const CANDIDATES = ["", ".js", ".jsx", ".css", "/index.js", "/index.jsx"];

const resolveOld = (fromOld, spec) => {
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromOld), spec)
  );
  for (const suffix of CANDIDATES) {
    let candidate = base + suffix;
    if (REDIRECT.has(candidate)) candidate = REDIRECT.get(candidate);
    if (oldToNew.has(candidate)) return candidate;
    if (DROPPED.has(candidate)) return { dropped: candidate };
  }
  if (base.startsWith("src/assets/") && fs.existsSync(path.join(SRC_ROOT, base))) {
    return { asset: base };
  }
  return null;
};

const SPEC_RE = /(from\s*|import\s*|import\s*\(\s*)(["'])(\.[^"']*)\2/g;
const CSS_IMPORT_RE = /(@import\s+)(["'])(\.[^"']*)\2/g;

const unresolved = [];
let rewrittenCount = 0;

const emit = (target, newPath) => {
  if (target.asset) return "@assets/" + target.asset.slice("src/assets/".length);
  const dst = oldToNew.get(target);
  const sameDir = path.posix.dirname(dst) === path.posix.dirname(newPath);
  return sameDir ? "./" + stripExt(path.posix.basename(dst)) : stripExt(toAlias(dst));
};

const rewrite = (oldPath, newPath, code) =>
  code.replace(SPEC_RE, (match, head, quote, spec) => {
    const target = resolveOld(oldPath, spec);
    if (!target) {
      unresolved.push(`${oldPath}  ->  ${spec}`);
      return match;
    }
    if (target.dropped) {
      unresolved.push(`${oldPath}  ->  ${spec}  (trỏ tới file đã bỏ: ${target.dropped})`);
      return match;
    }
    rewrittenCount += 1;
    return `${head}${quote}${emit(target, newPath)}${quote}`;
  });

const rewriteCss = (oldPath, newPath, code) =>
  code.replace(CSS_IMPORT_RE, (match, head, quote, spec) => {
    const target = resolveOld(oldPath, spec);
    if (!target || target.dropped || target.asset) {
      unresolved.push(`${oldPath}  ->  ${spec}  (css @import)`);
      return match;
    }
    let rel = path.posix.relative(path.posix.dirname(newPath), oldToNew.get(target));
    if (!rel.startsWith(".")) rel = "./" + rel;
    rewrittenCount += 1;
    return `${head}${quote}${rel}${quote}`;
  });

let copied = 0;
for (const [oldPath, newPath] of MAP) {
  const src = path.join(SRC_ROOT, oldPath);
  const dst = path.join(DST_ROOT, newPath);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const code = fs.readFileSync(src, "utf8");
  fs.writeFileSync(
    dst,
    /\.css$/.test(oldPath)
      ? rewriteCss(oldPath, newPath, code)
      : rewrite(oldPath, newPath, code)
  );
  copied += 1;
}

fs.mkdirSync(path.join(DST_ROOT, "src/assets"), { recursive: true });
for (const name of ASSETS) {
  const from = path.join(SRC_ROOT, "src/assets", name);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(DST_ROOT, "src/assets", name));
}
fs.mkdirSync(path.join(DST_ROOT, "public"), { recursive: true });
for (const name of fs.readdirSync(path.join(SRC_ROOT, "public"))) {
  fs.copyFileSync(
    path.join(SRC_ROOT, "public", name),
    path.join(DST_ROOT, "public", name)
  );
}

console.log(`file đã chuyển    : ${copied}`);
console.log(`import viết lại   : ${rewrittenCount}`);
console.log(`file bỏ lại       : ${DROPPED.size}`);
for (const [f, why] of DROPPED) console.log(`    ${f}\n        ${why}`);
if (unresolved.length) {
  console.log(`\nCHƯA GIẢI ĐƯỢC (${unresolved.length}):`);
  console.log([...new Set(unresolved)].join("\n"));
} else {
  console.log("\nmọi import tương đối đã giải xong.");
}
