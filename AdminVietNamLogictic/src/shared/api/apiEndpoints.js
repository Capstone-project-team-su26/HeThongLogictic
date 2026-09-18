const encodeId = (value) => encodeURIComponent(String(value));

export const API_ENDPOINTS = Object.freeze({
  auth: Object.freeze({
    login: "/api/Auth/login",
    profile: "/api/User/profile",
  }),
  customers: Object.freeze({
    list: "/api/customers",
    detail: (customerId) =>
      `/api/customers/${encodeId(customerId)}`,
  }),
  consignments: Object.freeze({
    list: "/api/orders/consignments",
    routes: "/api/orders/consignments/routes",
    shippingOptions: "/api/orders/consignments/shipping-options",
    validateItems: "/api/orders/consignments/validate-items",
    detail: (orderId) =>
      `/api/orders/consignments/${encodeId(orderId)}`,
    status: (orderId) =>
      `/api/orders/consignments/${encodeId(orderId)}/status`,
    estimateQuotation: (orderId) =>
      `/api/orders/${encodeId(orderId)}/quotation/estimate`,
    sendQuotation: (orderId) =>
      `/api/orders/${encodeId(orderId)}/quotation/send`,
    receipt: (orderId) =>
      `/api/orders/consignments/${encodeId(orderId)}/receipt`,
  }),
  purchaseRequests: Object.freeze({
    list: "/api/purchase-requests",
    detail: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}`,
    quotation: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/quotation`,
    confirmPurchase: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/confirm-purchase`,
    approveStore: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/approve-store`,
    history: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/history`,
  }),
  deliveryAddresses: Object.freeze({
    list: "/api/delivery-addresses",
    detail: (addressId) =>
      `/api/delivery-addresses/${encodeId(addressId)}`,
  }),
  uploads: Object.freeze({
    image: "/api/uploads/image",
    images: "/api/uploads/images",
  }),
  productTypes: "/api/product-types",
  warehouses: Object.freeze({
    list: "/api/warehouses",
    active: "/api/warehouses/active",
  }),
  restrictedItems: Object.freeze({
    list: "/api/restricted-items",
    detail: (restrictedItemId) =>
      `/api/restricted-items/${encodeId(restrictedItemId)}`,
  }),
  packageConfigurations: Object.freeze({
    list: "/api/package-configurations",
    suggest: "/api/package-configurations/suggest",
    detail: (configurationId) =>
      `/api/package-configurations/${encodeId(configurationId)}`,
  }),
  servicePricings: Object.freeze({
    list: "/api/service-pricings",
    detail: (servicePricingId) =>
      `/api/service-pricings/${encodeId(servicePricingId)}`,
  }),
  pricingRules: Object.freeze({
    list: "/api/pricing-rules",
    detail: (pricingRuleId) =>
      `/api/pricing-rules/${encodeId(pricingRuleId)}`,
  }),
  exchangeRates: Object.freeze({
    list: "/api/exchange-rates",
    convert: "/api/exchange-rates/convert",
    detail: (id) => `/api/exchange-rates/${encodeId(id)}`,
  }),
  /*
   * Phiếu xuất kho (WRO) — luồng xuất kho quốc tế mới (api-xuat-kho.md mục B–G).
   * Đã GỠ các endpoint cũ backend bỏ hẳn (mục N): /{id}/status, /{id}/shipping-route,
   * /{id}/picking-list, /{id}/complete, /{id}/notify-customer, /single, /batch, /{id}/packing,
   * /{id}/handover, /{id}/confirm-picking và /api/picking-lists/{id}/scan-item|confirm.
   * Web quản trị chỉ ĐỌC và DUYỆT — lập / bốc hàng / lập lô là việc của app kho.
   */
  warehouseReleaseRequests: Object.freeze({
    list: "/api/warehouse-release-requests",
    detail: (id) => `/api/warehouse-release-requests/${encodeId(id)}`,
    decide: (id) => `/api/warehouse-release-requests/${encodeId(id)}/decide`,
    releaseNote: (id) => `/api/warehouse-release-requests/${encodeId(id)}/release-note`,
    pickingSheet: (id) => `/api/warehouse-release-requests/${encodeId(id)}/picking-sheet`,
  }),
  /* Lô vận chuyển quốc tế — Sale theo dõi và ghi mốc hành trình (api-xuat-kho.md mục H–M). */
  internationalShipments: Object.freeze({
    list: "/api/international-shipments",
    trackingQueue: "/api/international-shipments/tracking-queue",
    detail: (id) => `/api/international-shipments/${encodeId(id)}`,
    timeline: (id) => `/api/international-shipments/${encodeId(id)}/timeline`,
    status: (id) => `/api/international-shipments/${encodeId(id)}/status`,
    manifest: (id) => `/api/international-shipments/${encodeId(id)}/manifest`,
  }),
  attachments: Object.freeze({
    list: "/api/attachments",
    download: (id) => `/api/attachments/${encodeId(id)}/download`,
  }),
  parcelIncidents: Object.freeze({
    list: "/api/parcel-incidents",
    detail: (id) => `/api/parcel-incidents/${encodeId(id)}`,
    resolve: (id) => `/api/parcel-incidents/${encodeId(id)}/resolve`,
    compensationPaid: (id) => `/api/parcel-incidents/${encodeId(id)}/compensation-paid`,
  }),
  parcelInspections: "/api/parcel-inspections",
  warehouseInboundRequests: Object.freeze({
    list: "/api/warehouse-inbound-requests",
    detail: (id) => `/api/warehouse-inbound-requests/${encodeId(id)}`,
    status: (id) => `/api/warehouse-inbound-requests/${encodeId(id)}/status`,
  }),
  deliveryRequests: Object.freeze({
    list: "/api/delivery-requests",
    detail: (id) => `/api/delivery-requests/${encodeId(id)}`,
    status: (id) => `/api/delivery-requests/${encodeId(id)}/status`,
    proof: (id) => `/api/delivery-requests/${encodeId(id)}/proof`,
  }),
  /* Chặng cuối của đơn: tất toán, thanh toán, theo dõi, giữ hàng, chốt đơn. */
  orders: Object.freeze({
    awaitingSettlement: "/api/orders/awaiting-settlement",
    actionQueue: "/api/orders/action-queue",
    settlementPreview: (orderId) => `/api/orders/${encodeId(orderId)}/settlement-preview`,
    finalPayment: (orderId) => `/api/orders/${encodeId(orderId)}/payments/final`,
    payments: (orderId) => `/api/orders/${encodeId(orderId)}/payments`,
    paymentHistory: (orderId) => `/api/orders/${encodeId(orderId)}/payments/history`,
    notifyWarehouse: (orderId) =>
      `/api/orders/consignments/${encodeId(orderId)}/notify-warehouse`,
    trackingList: "/api/orders/consignments/tracking",
    tracking: (orderId) => `/api/orders/consignments/${encodeId(orderId)}/tracking`,
    exportHold: (orderId) => `/api/orders/consignments/${encodeId(orderId)}/export-hold`,
    complete: (orderId) => `/api/orders/consignments/${encodeId(orderId)}/complete`,
  }),
  purchaseFinalPayment: (purchaseRequestId) =>
    `/api/purchase-requests/${encodeId(purchaseRequestId)}/final-payment`,
  warehouseZones: Object.freeze({
    list: (warehouseId) => `/api/warehouses/${encodeId(warehouseId)}/zones`,
    update: (zoneId) => `/api/warehouse-zones/${encodeId(zoneId)}`,
    misplacedParcels: (warehouseId) =>
      `/api/warehouses/${encodeId(warehouseId)}/misplaced-parcels`,
  }),
  inventories: "/api/inventories",
  carriers: Object.freeze({
    list: "/api/carriers",
    active: "/api/carriers/active",
    detail: (id) => `/api/carriers/${encodeId(id)}`,
  }),
  shippingRoutes: Object.freeze({
    list: "/api/shipping-routes",
    detail: (id) => `/api/shipping-routes/${encodeId(id)}`,
  }),
});

export default API_ENDPOINTS;
