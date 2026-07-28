import axiosInstance from "../../axiosInstance";

/* =========================================================
   RESPONSE HELPER
========================================================= */

const getResponseData = (response) => {
  return (
    response?.data?.data ??
    response?.data ??
    null
  );
};

/* =========================================================
   TOKEN HELPER
========================================================= */

const getAccessToken = () => {
  const token =
    sessionStorage.getItem("accessToken");

  if (!token) {
    throw new Error(
      "Không tìm thấy token. Vui lòng đăng nhập lại."
    );
  }

  return token;
};

const getAuthHeaders = () => {
  return {
    Accept: "*/*",
    Authorization: `Bearer ${getAccessToken()}`,
  };
};

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
      const response =
        await axiosInstance.get(
          `/api/orders/${normalizedOrderId}/payments/history`,
          {
            headers: getAuthHeaders(),
          }
        );

      const data =
        getResponseData(response);

      return normalizeOrderPaymentHistory(
        data
      );
    } catch (error) {
      console.error(
        "GET ORDER PAYMENT HISTORY ERROR:",
        error
      );

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Không thể lấy lịch sử thanh toán của đơn.";

      throw new Error(message);
    }
  };

/* =========================================================
   DEFAULT EXPORT
========================================================= */

const orderPaymentService = {
  getOrderPaymentHistoryApi,
};

export default orderPaymentService;