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
  warehouseReleaseRequests: Object.freeze({
    list: "/api/warehouse-release-requests",
    detail: (id) => `/api/warehouse-release-requests/${encodeId(id)}`,
    status: (id) => `/api/warehouse-release-requests/${encodeId(id)}/status`,
    shippingRoute: (id) => `/api/warehouse-release-requests/${encodeId(id)}/shipping-route`,
    pickingList: (id) => `/api/warehouse-release-requests/${encodeId(id)}/picking-list`,
    complete: (id) => `/api/warehouse-release-requests/${encodeId(id)}/complete`,
    notifyCustomer: (id) => `/api/warehouse-release-requests/${encodeId(id)}/notify-customer`,
  }),
});

export default API_ENDPOINTS;
