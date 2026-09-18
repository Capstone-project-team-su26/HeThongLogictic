/**
 * Nguồn sự thật duy nhất cho mọi URL.
 *
 * Component không viết chuỗi "/sale/consignments" thẳng vào <Link>/navigate()
 * nữa — đổi URL ở đây là đổi toàn bộ ứng dụng.
 *
 *   navigate(SALE.consignmentDetail(order.id))
 *   <NavLink to={ADMIN.users} />
 */

/* ------------------------------------------------------------------ *
 * Chung                                                               *
 * ------------------------------------------------------------------ */

export const COMMON = {
  root: "/",
  login: "/login",
  unauthorized: "/unauthorized",
};

/* ------------------------------------------------------------------ *
 * Admin — /admin                                                      *
 * ------------------------------------------------------------------ */

const ADMIN_BASE = "/admin";

export const ADMIN = {
  base: ADMIN_BASE,
  dashboard: ADMIN_BASE,

  users: `${ADMIN_BASE}/users`,

  /* Danh mục dùng chung */
  warehouseLocations: `${ADMIN_BASE}/warehouse-locations`,
  warehouses: `${ADMIN_BASE}/warehouses`,
  /* Gán quản lý cho từng kho (người duyệt phiếu nhập / xuất kho của kho đó). */
  warehouseManagers: `${ADMIN_BASE}/warehouse-managers`,
  /* Khai loại khu + báo cáo kiện nằm sai khu. */
  warehouseZones: `${ADMIN_BASE}/warehouse-zones`,
  carriers: `${ADMIN_BASE}/carriers`,
  shippingMethods: `${ADMIN_BASE}/shipping-methods`,
  packageConfigurations: `${ADMIN_BASE}/package-configurations`,
  /* Đường dẫn cũ, chỉ còn để chuyển hướng sang pricingRules (phí đã gộp một danh mục). */
  additionalServiceFees: `${ADMIN_BASE}/additional-service-fees`,
  servicePricings: `${ADMIN_BASE}/service-pricings`,
  pricingRules: `${ADMIN_BASE}/pricing-rules`,
  exchangeRates: `${ADMIN_BASE}/exchange-rates`,
  restrictedItems: `${ADMIN_BASE}/restricted-items`,
  productTypes: `${ADMIN_BASE}/product-types`,
  unitsOfMeasure: `${ADMIN_BASE}/units-of-measure`,
  suppliers: `${ADMIN_BASE}/suppliers`,
  shippingRoutes: `${ADMIN_BASE}/shipping-routes`,

  /* Duyệt giá ngoại lệ của báo giá ký gửi (Admin quyết, không phải chỉ xem). */
  priceApprovals: `${ADMIN_BASE}/price-approvals`,

  /* Giám sát vận hành (chỉ xem) */
  consignments: `${ADMIN_BASE}/consignments`,
  consignmentDetail: (orderId = ":orderId") => `${ADMIN_BASE}/consignments/${orderId}`,
  consignmentPayments: (orderId = ":orderId") =>
    `${ADMIN_BASE}/consignments/${orderId}/payments`,
  inventory: `${ADMIN_BASE}/inventory`,
  wro: `${ADMIN_BASE}/wro`,
  shipments: `${ADMIN_BASE}/shipments`,
  receivingNotes: `${ADMIN_BASE}/receiving-notes`,
  deliveries: `${ADMIN_BASE}/deliveries`,
  cashFlow: `${ADMIN_BASE}/cash-flow`,

  /* Theo dõi đơn + chốt đơn hoàn thành bằng tay. */
  tracking: `${ADMIN_BASE}/tracking`,
  trackingDetail: (orderId = ":orderId") => `${ADMIN_BASE}/tracking/${orderId}`,
  /* Sự cố hàng hoá: ghi nhận đã chi bồi thường. */
  incidents: `${ADMIN_BASE}/incidents`,
};

/* ------------------------------------------------------------------ *
 * Sale — /sale                                                        *
 * ------------------------------------------------------------------ */

const SALE_BASE = "/sale";

export const SALE = {
  base: SALE_BASE,
  dashboard: `${SALE_BASE}/dashboard`,

  consignments: `${SALE_BASE}/consignments`,
  consignmentDetail: (orderId = ":orderId") => `${SALE_BASE}/consignments/${orderId}`,
  consignmentCreateQuotation: (orderId = ":orderId") =>
    `${SALE_BASE}/consignments/${orderId}/create-quotation`,

  createBuyOrder: `${SALE_BASE}/create-order/buy-orders`,
  createConsignmentOrder: `${SALE_BASE}/create-order/consignment`,

  settlements: `${SALE_BASE}/settlements`,
  releases: `${SALE_BASE}/releases`,

  customers: `${SALE_BASE}/customers`,
  restrictedItems: `${SALE_BASE}/restricted-items`,
  servicePricings: `${SALE_BASE}/service-pricings`,

  historyOrder: `${SALE_BASE}/history/order`,
  historyPurchaseRequests: `${SALE_BASE}/history/purchase-requests`,

  documentsConsignments: `${SALE_BASE}/documents/consignments`,
  documentsPurchaseRequests: `${SALE_BASE}/documents/purchase-requests`,

  orderPaymentHistory: (orderId = ":orderId") =>
    `${SALE_BASE}/orders/${orderId}/payments/history`,

  purchaseRequests: `${SALE_BASE}/purchase-requests`,
  purchaseRequestDetail: (purchaseRequestId = ":purchaseRequestId") =>
    `${SALE_BASE}/purchase-requests/${purchaseRequestId}`,

  /* Theo dõi lô về VN: hàng đợi + dòng thời gian + ghi mốc hành trình. */
  shipments: `${SALE_BASE}/shipments`,
  /* Yêu cầu giao hàng: bằng chứng giao, giao lại. */
  deliveries: `${SALE_BASE}/deliveries`,
  /* Theo dõi đơn + giữ hàng thay khách. */
  tracking: `${SALE_BASE}/tracking`,
  trackingDetail: (orderId = ":orderId") => `${SALE_BASE}/tracking/${orderId}`,
  /* Sự cố hàng hoá (chỉ đọc). */
  incidents: `${SALE_BASE}/incidents`,

  customerService: `${SALE_BASE}/customer-service`,
};

/* ------------------------------------------------------------------ *
 * Operations Manager — /operations-manager                            *
 * ------------------------------------------------------------------ */

const OPS_BASE = "/operations-manager";

export const OPERATIONS = {
  base: OPS_BASE,
  dashboard: OPS_BASE,

  wro: `${OPS_BASE}/wro`,
  shipments: `${OPS_BASE}/shipments`,
  receivingApprovals: `${OPS_BASE}/receiving-approvals`,
  parcels: `${OPS_BASE}/parcels`,
  purchaseStore: `${OPS_BASE}/purchase-store`,
  inboundApprovals: `${OPS_BASE}/inbound-approvals`,
  deliveryApprovals: `${OPS_BASE}/delivery-approvals`,
  inspections: `${OPS_BASE}/inspections`,
  /* Quyết định sự cố hàng hoá ở kho VN. */
  incidents: `${OPS_BASE}/incidents`,
  /* Khai loại khu + kiện nằm sai khu. */
  warehouseZones: `${OPS_BASE}/warehouse-zones`,
};

export const ROUTES = { ...COMMON, admin: ADMIN, sale: SALE, operations: OPERATIONS };

export default ROUTES;
