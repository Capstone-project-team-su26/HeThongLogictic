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
    /*
     * Sổ địa chỉ nhận hàng CỦA MỘT KHÁCH — nhân viên đọc được
     * (DeliveryAddressController.GetByCustomerId, role Admin/Sale/WarehouseStaff/
     * OperationsManager). Khác hẳn /api/delivery-addresses: endpoint kia trả sổ địa
     * chỉ của CHÍNH tài khoản đang đăng nhập, gọi bằng token Sale thì ra địa chỉ
     * của nhân viên chứ không phải của khách.
     */
    deliveryAddresses: (customerId) =>
      `/api/customers/${encodeId(customerId)}/delivery-addresses`,
    /*
     * Nhân viên THÊM địa chỉ hộ khách — cùng đường dẫn, method POST
     * (DeliveryAddressController.CreateForCustomer, role Admin/Sale/OperationsManager).
     * Gửi lại đúng địa chỉ cũ thì backend trả lại dòng đã có, không nhân đôi sổ.
     */
    createDeliveryAddress: (customerId) =>
      `/api/customers/${encodeId(customerId)}/delivery-addresses`,
  }),
  consignments: Object.freeze({
    list: "/api/orders/consignments",
    /* Sale tạo đơn ký gửi HỘ KHÁCH — OrderController.CreateConsignmentByStaff, role Sale. */
    createByStaff: "/api/staff/consignments",
    /*
     * Ước tính TRƯỚC khi tạo — cùng payload, cùng phép tính với createByStaff, nhưng
     * không ghi gì xuống DB. Nhờ vậy con số Sale đọc cho khách nghe ở màn xác nhận
     * bằng đúng con số trên báo giá hệ thống phát hành ngay sau đó.
     */
    previewByStaff: "/api/staff/consignments/preview",
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
    /* Sale tạo yêu cầu thay khách — khác endpoint của khách tự tạo. */
    staffCreate: "/api/staff/purchase-requests",
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

    /* Đơn mua nhà cung cấp của một yêu cầu (luồng mua hộ chuẩn). */
    purchaseOrders: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/purchase-orders`,

    /*
     * Tiền đi NGƯỢC của mua hộ (backend mới — hiện CHỈ có trên env test).
     * closeUnfulfilled: Sale/Admin đóng phần không mua được + NCC giao thiếu → lập khoản hoàn.
     * refunds: sổ hoàn của cả yêu cầu (tổng đã thu / đã hoàn / chờ hoàn + từng khoản, từng dòng).
     * completeRefund: kế toán xác nhận đã chuyển MỘT khoản cụ thể (kể cả khoản không gắn đơn mua).
     */
    closeUnfulfilled: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/close-unfulfilled`,
    refunds: (purchaseRequestId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/refunds`,
    completeRefund: (purchaseRequestId, refundId) =>
      `/api/purchase-requests/${encodeId(purchaseRequestId)}/refunds/${encodeId(refundId)}/complete`,
  }),

  /**
   * ĐƠN MUA NHÀ CUNG CẤP — xương sống của luồng mua hộ chuẩn.
   * Sale lập (DRAFT) → gửi duyệt → Admin duyệt ngân sách → Sale đặt NCC → cập nhật tiến độ.
   * Đặt NCC xong, backend tự sinh đơn kho `PUR-xxx-n` + phiếu tiếp nhận cho kho nguồn.
   */
  purchaseOrders: Object.freeze({
    list: "/api/purchase-orders",
    detail: (purchaseOrderId) => `/api/purchase-orders/${encodeId(purchaseOrderId)}`,
    submit: (purchaseOrderId) =>
      `/api/purchase-orders/${encodeId(purchaseOrderId)}/submit`,
    customerDecision: (purchaseOrderId) =>
      `/api/purchase-orders/${encodeId(purchaseOrderId)}/customer-decision`,
    decide: (purchaseOrderId) =>
      `/api/purchase-orders/${encodeId(purchaseOrderId)}/decide`,
    place: (purchaseOrderId) =>
      `/api/purchase-orders/${encodeId(purchaseOrderId)}/place`,
    progress: (purchaseOrderId) =>
      `/api/purchase-orders/${encodeId(purchaseOrderId)}/progress`,
    cancel: (purchaseOrderId) =>
      `/api/purchase-orders/${encodeId(purchaseOrderId)}/cancel`,
    /* Kế toán xác nhận ĐÃ CHUYỂN TRẢ khách khoản hoàn (bắt buộc mã giao dịch). */
    completeRefund: (purchaseOrderId) =>
      `/api/purchase-orders/${encodeId(purchaseOrderId)}/refund/complete`,
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
    /* Nhân viên kho được gán vào kho (Admin/OperationsManager/Sale, chỉ đọc). */
    staff: (warehouseId) => `/api/warehouses/${encodeId(warehouseId)}/staff`,
  }),
  /*
   * Tài khoản nội bộ (màn Quản lý người dùng của Admin). Route cũ viết hoa `User`
   * (UserController); route gán kho mới viết thường `users` — ASP.NET không phân biệt
   * hoa thường nhưng giữ đúng chữ như backend khai.
   */
  users: Object.freeze({
    list: "/api/User",
    detail: (userId) => `/api/User/${encodeId(userId)}`,
    role: (userId) => `/api/User/${encodeId(userId)}/role`,
    lock: (userId) => `/api/User/${encodeId(userId)}/lock`,
    unlock: (userId) => `/api/User/${encodeId(userId)}/unlock`,
    /* GET (Admin/OM) xem kho phụ trách · PUT (Admin) thay TOÀN BỘ danh sách kho. */
    warehouses: (userId) => `/api/users/${encodeId(userId)}/warehouses`,
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
  /*
   * PHÍ DỊCH VỤ BỔ SUNG — bảng RIÊNG với pricing-rules, không gộp được.
   *
   * Backend đọc DEPOSIT_RATE, PURCHASE_PRICE_TOLERANCE_RATE và PURCHASE_CANCEL_FEE_RATE
   * từ bảng NÀY (AdditionalServiceFee), còn hệ số quy đổi / VAT / thuế / phụ phí theo kiện
   * thì đọc từ PRICING_RULES. Sửa nhầm bảng là số hiện trên màn hình đổi mà hệ thống vẫn
   * chạy theo giá trị cũ. Ghi (POST/PUT/DELETE) chỉ role Admin.
   */
  additionalServiceFees: Object.freeze({
    list: "/api/additional-service-fees",
    detail: (feeId) => `/api/additional-service-fees/${encodeId(feeId)}`,
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
  /*
   * Bảng tổng quan theo vai trò (StaffDashboardController) — một lời gọi trả hết số liệu,
   * backend tự đếm/cộng. Sale: Sale/OM/Admin · vận hành: OM/Admin · quản trị: chỉ Admin.
   */
  dashboards: Object.freeze({
    sale: "/api/staff/dashboard",
    operations: "/api/operations/dashboard",
    admin: "/api/admin/dashboard",
  }),
});

export default API_ENDPOINTS;
