/**
 * Lịch sử thanh toán của đơn — ĐÃ NỐI API THẬT.
 *
 *   GET /api/orders/{orderId}/payments/history
 *       → { message, data: { orderId, consignmentCode, orderStatus, customer, quotation,
 *            totalBillAmount, totalPaid, remaining, payments[] } }
 *
 * Nhóm normalize* giữ nguyên: đó là nơi duy nhất bảo đảm hình dạng OrderPaymentHistory.jsx
 * destructure (payments[].status, customer.fullName...), backend thiếu khoá nào màn cũng
 * không trắng.
 */

import httpClient from "@shared/api/httpClient";
import API_ENDPOINTS from "@shared/api/apiEndpoints";
import { getResponseData } from "@shared/api/apiEnvelope";

/* =========================================================
   VALIDATION
========================================================= */

const validateOrderId = (orderId) => {
  const normalizedOrderId =
    String(orderId || "").trim();

  if (!normalizedOrderId) {
    throw new Error(
      "Không tìm thấy orderId để lấy lịch sử thanh toán."
    );
  }

  return normalizedOrderId;
};

/* =========================================================
   NORMALIZE PAYMENT
========================================================= */

const normalizePayment = (payment = {}) => {
  return {
    paymentId:
      payment?.paymentId ?? "",

    invoiceId:
      payment?.invoiceId ?? "",

    installmentType:
      payment?.installmentType ?? "",

    amount:
      Number(payment?.amount) || 0,

    paymentMethod:
      payment?.paymentMethod ?? "",

    status:
      payment?.status ?? "",

    orderCode:
      payment?.orderCode ?? null,

    transactionCode:
      payment?.transactionCode ?? "",

    checkoutUrl:
      payment?.checkoutUrl ?? "",

    createdAt:
      payment?.createdAt ?? null,

    paidAt:
      payment?.paidAt ?? null,

    failureReason:
      payment?.failureReason ?? null,
  };
};

/* =========================================================
   NORMALIZE PAYMENT HISTORY
========================================================= */

const normalizeOrderPaymentHistory = (
  data = {}
) => {
  return {
    orderId:
      data?.orderId ?? "",

    consignmentCode:
      data?.consignmentCode ?? "",

    orderStatus:
      data?.orderStatus ?? "",

    customer: {
      customerId:
        data?.customer?.customerId ?? "",

      fullName:
        data?.customer?.fullName ?? "",

      customerCode:
        data?.customer?.customerCode ?? "",

      email:
        data?.customer?.email ?? "",

      phone:
        data?.customer?.phone ?? "",
    },

    quotation: {
      quotationId:
        data?.quotation?.quotationId ?? "",

      quoteType:
        data?.quotation?.quoteType ?? "",

      status:
        data?.quotation?.status ?? "",

      totalAmount:
        Number(
          data?.quotation?.totalAmount
        ) || 0,
    },

    totalBillAmount:
      Number(data?.totalBillAmount) || 0,

    totalPaid:
      Number(data?.totalPaid) || 0,

    remaining:
      Number(data?.remaining) || 0,

    payments:
      Array.isArray(data?.payments)
        ? data.payments.map(
            normalizePayment
          )
        : [],

    /* Backend không trả khoá này; trang tự lùi về createdAt của giao dịch đầu tiên. */
    createdAt:
      data?.createdAt ?? null,
  };
};

/* =========================================================
   GET ORDER PAYMENT HISTORY
   GET /api/orders/{orderId}/payments/history
========================================================= */

export const getOrderPaymentHistoryApi =
  async (orderId) => {
    const normalizedOrderId =
      validateOrderId(orderId);

    try {
      const response = await httpClient.get(
        API_ENDPOINTS.orders.paymentHistory(normalizedOrderId)
      );

      return normalizeOrderPaymentHistory(
        getResponseData(response) || {}
      );
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Không thể lấy lịch sử thanh toán của đơn.";

      /* Component chỉ đọc error.message; giữ lỗi gốc ở cause để không mất stack của axios. */
      throw new Error(message, {
        cause: error,
      });
    }
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

const orderPaymentService = {
  getOrderPaymentHistoryApi,
};

export default orderPaymentService;
