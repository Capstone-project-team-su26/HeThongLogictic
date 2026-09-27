/* =========================================================
   purchaseRequestShared.js — hằng số + hàm THUẦN của luồng mua hộ (không gọi mạng,
   không dữ liệu mẫu). Tách khỏi purchaseRequestService.mock.js (27/09/2026) để bản thật
   purchaseRequestService.js không còn import file *.mock (kéo fixture @/mocks vào bundle).
   Nội dung chép nguyên văn từ bản mock — hành vi không đổi.
   ========================================================= */

export const PURCHASE_REQUEST_STATUS = {
  PENDING_REVIEW: "PENDING_REVIEW",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  QUOTATION_SENT: "QUOTATION_SENT",
  WAITING_DEPOSIT: "WAITING_DEPOSIT",
  DEPOSIT_PAID: "DEPOSIT_PAID",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export const PURCHASE_SHIPPING_OPTION = {
  STANDARD: "STANDARD",
  EXPRESS: "EXPRESS",
  ECONOMY: "ECONOMY",
};

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeUuidArray = (value, fieldName) => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .map((id) => {
          if (!UUID_PATTERN.test(id)) {
            throw new Error(`${fieldName} không đúng định dạng UUID.`);
          }
          return id;
        })
    )
  );
};

const normalizePurchaseRequestItemPayload = (item = {}, index = 0) => {
  const productLink = normalizeText(item?.productLink);
  const productType = normalizeText(item?.productType);
  const quantity = Math.trunc(Number(item?.quantity));

  if (!productLink) {
    throw new Error(`Sản phẩm ${index + 1}: vui lòng nhập liên kết sản phẩm.`);
  }
  if (!productType) {
    throw new Error(`Sản phẩm ${index + 1}: vui lòng chọn loại sản phẩm.`);
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 2147483647) {
    throw new Error(`Sản phẩm ${index + 1}: số lượng phải từ 1 đến 2147483647.`);
  }

  return {
    productLink,
    sourceWebsite: normalizeText(item?.sourceWebsite) || null,
    productType,
    productName: normalizeText(item?.productName) || null,
    quantity,
    attributes: normalizeText(item?.attributes) || null,
    note: normalizeText(item?.note) || null,
    imageUrls: Array.from(
      new Set(
        (Array.isArray(item?.imageUrls) ? item.imageUrls : [])
          .map((url) => normalizeText(url))
          .filter(Boolean)
      )
    ),
  };
};

export const normalizeCreatePurchaseRequestPayload = (payload = {}) => {
  const route = normalizeText(payload?.route);
  const shippingOption = normalizeText(payload?.shippingOption);
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizePurchaseRequestItemPayload)
    : [];

  if (!route) throw new Error("Vui lòng chọn tuyến hàng.");
  if (!shippingOption) throw new Error("Vui lòng chọn phương thức vận chuyển.");
  if (!items.length) throw new Error("Vui lòng thêm ít nhất một sản phẩm.");

  const receiverPhone = normalizeText(payload?.receiverPhone);
  if (receiverPhone && !/^0\d{9}$/.test(receiverPhone)) {
    throw new Error("Số điện thoại người nhận phải bắt đầu bằng 0 và gồm đúng 10 chữ số.");
  }

  return {
    route,
    shippingOption,
    receiverName: normalizeText(payload?.receiverName) || null,
    receiverPhone: receiverPhone || null,
    receiverAddress: normalizeText(payload?.receiverAddress) || null,
    pricingRuleIds: normalizeUuidArray(payload?.pricingRuleIds, "pricingRuleIds"),
    requiresPacking: Boolean(payload?.requiresPacking),
    requiresWoodenCrate: Boolean(payload?.requiresWoodenCrate),
    requiresInsurance: Boolean(payload?.requiresInsurance),
    generalNote: normalizeText(payload?.generalNote) || null,
    items,
  };
};
