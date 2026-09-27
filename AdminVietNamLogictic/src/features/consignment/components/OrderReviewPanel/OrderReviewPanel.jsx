/**
 * TÓM TẮT ĐẦY ĐỦ MỘT ĐƠN trong hộp xác nhận — khách, người nhận, từng dòng hàng, kiện, báo
 * giá, tiền đã trả.
 *
 * Dữ liệu do `useOrderReview(orderId)` nạp từ API thật và truyền vào qua `review`; component
 * này chỉ trình bày (bằng các khối dùng chung ở `@shared/components/SubmitReview`). Trang gọi
 * vẫn giữ hook ở phía mình để còn khoá nút gửi trong lúc `review.loading`.
 *
 * `fallback` là dòng bảng mà trang đang có sẵn (mã đơn, tên / SĐT khách, người nhận, tuyến).
 * Khi chi tiết đơn tải lỗi, hộp vẫn hiện được những gì chắc chắn đúng từ dòng đó thay vì trống.
 *
 * Mọi con số hiện ở đây là số backend trả; component chỉ CỘNG các dòng hàng để ra tổng, không
 * tự tính cước, không tự quy đổi.
 */

import { Space, Tag, Typography } from "antd";

import SubmitReview, {
  ReviewFacts,
  ReviewItemsTable,
  ReviewMoney,
} from "@shared/components/SubmitReview/SubmitReview";
import {
  formatReviewDateTime,
  formatReviewKg,
  formatReviewMoney,
  formatReviewNumber,
} from "@shared/components/SubmitReview/submitReviewFormat";
import { getPaymentStatusMeta } from "@shared/utils/paymentStatus";

import { getOrderStatusLabel } from "../../constants/orderStatus";

const { Text } = Typography;

const INSTALLMENT_LABELS = Object.freeze({
  DEPOSIT: "Đặt cọc",
  FINAL_PAYMENT: "Thanh toán phần còn lại",
  REMAINING: "Thanh toán phần còn lại",
  FULL_PAYMENT: "Thanh toán toàn bộ",
  STORAGE_FEE: "Phí lưu kho",
  REDELIVERY_FEE: "Phí giao lại",
});

const QUOTATION_STATUS_LABELS = Object.freeze({
  PENDING: "Chờ khách xác nhận",
  SENT: "Đã gửi khách",
  ACCEPTED: "Khách đã chấp nhận",
  REJECTED: "Khách từ chối",
  EXPIRED: "Đã hết hạn",
  PENDING_PRICE_APPROVAL: "Chờ Admin duyệt giá",
});

const ORDER_TYPE_LABELS = Object.freeze({ CONSIGNMENT: "Ký gửi", PURCHASE: "Mua hộ" });

const upper = (value) => String(value ?? "").trim().toUpperCase();

/** Kiện thật của đơn nằm rải trong shipments[].parcels[] — trải phẳng, giữ mã lô kèm theo. */
const flattenParcels = (detail) =>
  (Array.isArray(detail?.shipments) ? detail.shipments : []).flatMap((group) =>
    (Array.isArray(group?.parcels) ? group.parcels : []).map((parcel) => ({
      ...parcel,
      shipmentCode: group?.shipmentCode || "",
    })),
  );

const PARCEL_COLUMNS = [
  {
    title: "Mã kiện",
    dataIndex: "packageCode",
    width: 170,
    render: (value) => <Text code>{value || "—"}</Text>,
  },
  {
    title: "Cân (kg)",
    dataIndex: "weight",
    width: 100,
    align: "right",
    render: (value) => formatReviewKg(value),
  },
  {
    title: "Trạng thái",
    key: "status",
    width: 170,
    render: (_, parcel) => parcel?.statusText || parcel?.status || "—",
  },
  {
    title: "Xử lý khi về VN",
    key: "handling",
    width: 150,
    render: (_, parcel) => parcel?.destinationHandlingText || "Chưa chọn",
  },
  {
    title: "Lô",
    dataIndex: "shipmentCode",
    width: 130,
    render: (value) => value || "Chưa xếp lô",
  },
  {
    title: "Kho VN kiểm đếm",
    key: "inspection",
    render: (_, parcel) => {
      const inspection = parcel?.inspection;
      if (!inspection) return <Text type="secondary">Chưa kiểm</Text>;
      if (inspection.hasDiscrepancy) {
        return <Text type="danger">{inspection.summary || "Có chênh lệch"}</Text>;
      }
      return (
        <Text type="success">
          Khớp{inspection.actualWeight ? ` · ${formatReviewKg(inspection.actualWeight)}` : ""}
        </Text>
      );
    },
  },
];

/**
 * @param {object} props
 * @param {{ loading: boolean, detail: object|null, detailError: string,
 *           payment: object|null, paymentError: string }} props.review  kết quả useOrderReview
 * @param {object} [props.fallback]      dòng bảng sẵn có (orderCode, customerName, customerPhone...)
 * @param {string[]} [props.parcelIds]   có thì hiện bảng "kiện trong thao tác này" lọc đúng các kiện đó
 * @param {string} [props.parcelTitle]
 * @param {Array} [props.extraFacts]     dữ kiện riêng của thao tác (kho tiếp nhận, nhóm hàng...)
 * @param {boolean} [props.showFacts=true]  tắt khi màn đã tự hiện dữ kiện đơn / khách (tránh lặp)
 * @param {boolean} [props.showItems=true]
 * @param {boolean} [props.showMoney=true]
 * @param {string} [props.errorHint]     câu nói rõ lỗi tải có chặn thao tác hay không
 */
export default function OrderReviewPanel({
  review,
  fallback = {},
  parcelIds,
  parcelTitle = "Kiện trong thao tác này",
  extraFacts = [],
  showFacts = true,
  showItems = true,
  showMoney = true,
  errorHint = "",
}) {
  const detail = review?.detail || null;
  const payment = review?.payment || null;
  const customer = detail?.customer || {};
  const quotation = detail?.quotation || null;

  const orderType = upper(detail?.orderType || fallback?.orderType);

  const facts = [
    {
      label: "Mã đơn",
      value: (
        <Text strong copyable>
          {detail?.consignmentCode || fallback?.orderCode || fallback?.consignmentCode || "—"}
        </Text>
      ),
    },
    {
      label: "Loại đơn · trạng thái",
      value: [
        ORDER_TYPE_LABELS[orderType] || null,
        detail?.status ? getOrderStatusLabel(detail.status) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    { label: "Khách hàng", value: customer.fullName || fallback?.customerName },
    {
      label: "Mã khách hàng",
      value: payment?.customer?.customerCode || fallback?.customerCode,
    },
    { label: "SĐT khách", value: customer.phone || fallback?.customerPhone },
    { label: "Email khách", value: customer.email || fallback?.customerEmail },
    { label: "Tuyến", value: detail?.route || fallback?.route },
    {
      label: "Kiểm hàng",
      value: detail ? (detail.requiresInspection ? "Có yêu cầu kiểm hàng" : "Không") : null,
    },
    {
      label: "Người nhận",
      value: [
        detail?.receiverName || fallback?.receiverName,
        detail?.receiverPhone || fallback?.receiverPhone,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      label: "Nguyện vọng khi về VN",
      value: detail?.defaultDestinationHandlingText || null,
    },
    {
      label: "Địa chỉ giao",
      value: detail?.receiverAddress || fallback?.receiverAddress,
      span: 2,
    },
    { label: "Ngày đặt đơn", value: detail ? formatReviewDateTime(detail.createdAt) : null },
    {
      label: "Xác nhận thanh toán",
      value: detail?.paymentConfirmedAt ? formatReviewDateTime(detail.paymentConfirmedAt) : null,
    },
    { label: "Ghi chú của khách", value: detail?.note, span: 2, hidden: !detail?.note },
    ...extraFacts,
  ];

  const items = Array.isArray(detail?.items) ? detail.items : [];

  /* Tổng backend tự tính cho cả đơn — hiện kèm tổng cộng dòng để hai số soi được nhau. */
  const orderTotalsText = detail
    ? [
        detail.totalWeight ? `Tổng cân đơn ${formatReviewKg(detail.totalWeight)}` : null,
        detail.totalVolume
          ? `thể tích ${formatReviewNumber(detail.totalVolume, 0)} cm³`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const wantedIds = Array.isArray(parcelIds) ? new Set(parcelIds.map(String)) : null;
  const parcels = wantedIds
    ? flattenParcels(detail).filter((parcel) => wantedIds.has(String(parcel?.parcelId)))
    : [];
  const parcelWeight = parcels.reduce((sum, parcel) => sum + (Number(parcel?.weight) || 0), 0);

  const payments = Array.isArray(payment?.payments) ? payment.payments : [];
  const paidDeposit = payments
    .filter((row) => upper(row?.installmentType) === "DEPOSIT")
    .filter((row) => getPaymentStatusMeta(row?.status).tone === "success")
    .reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
  const hasDepositRow = payments.some((row) => upper(row?.installmentType) === "DEPOSIT");

  const quotationLines = quotation
    ? [
        { label: "Cước vận chuyển ước tính", value: quotation.estimatedFreightCharge },
        { label: "Phí vận chuyển nội địa", value: quotation.domesticShippingFee },
        { label: "Phí dịch vụ (thùng, kiểm hàng, bảo hiểm…)", value: quotation.serviceFee },
        { label: "Thuế & phí nhập khẩu", value: quotation.taxAndDuty },
        { label: "Tổng báo giá dự kiến", value: quotation.totalEstimatedCost, strong: true },
      ].filter((line) => line.strong || (line.value !== null && line.value !== undefined))
    : [];

  const paymentLines = payment
    ? [
        {
          label: "Đã cọc",
          value: hasDepositRow ? paidDeposit : null,
          tone: "success",
          hidden: !hasDepositRow,
        },
        { label: "Tổng hoá đơn hiện tại", value: payment.totalBillAmount },
        { label: "Khách đã trả", value: payment.totalPaid, tone: "success" },
        {
          label: "Còn lại",
          value: payment.remaining,
          strong: true,
          tone: Number(payment.remaining) > 0 ? "warning" : undefined,
        },
        ...payments.map((row, index) => {
          const meta = getPaymentStatusMeta(row?.status);
          return {
            key: row?.paymentId || `payment-${index}`,
            label: INSTALLMENT_LABELS[upper(row?.installmentType)] || "Khoản thanh toán",
            hint: row?.paidAt ? `trả lúc ${formatReviewDateTime(row.paidAt)}` : "",
            value: (
              <Space size={6}>
                <Tag color={meta.color}>{meta.label}</Tag>
                <Text>{formatReviewMoney(row?.amount)}</Text>
              </Space>
            ),
          };
        }),
      ]
    : [];

  const errors = [review?.detailError, review?.paymentError].filter(Boolean).join(" ");

  return (
    <SubmitReview
      loading={Boolean(review?.loading)}
      loadingText="Đang tải đầy đủ thông tin đơn…"
      error={errors}
      errorHint={errorHint}
    >
      {showFacts ? <ReviewFacts items={facts} /> : null}

      {wantedIds ? (
        <ReviewItemsTable
          title={parcelTitle}
          items={parcels}
          columns={PARCEL_COLUMNS}
          rowKey={(parcel, index) => parcel?.parcelId || index}
          extra={`${parcels.length}/${wantedIds.size} kiện · ${formatReviewKg(parcelWeight)}`}
          emptyText={
            detail
              ? "Chi tiết đơn chưa có kiện nào trùng với thao tác này."
              : "Chưa đọc được danh sách kiện."
          }
        />
      ) : null}

      {showItems ? (
        <ReviewItemsTable
          title="Hàng khách khai trên đơn"
          items={items}
          emptyText={detail ? "Đơn chưa có dòng hàng nào." : "Chưa đọc được hàng của đơn."}
        />
      ) : null}

      {showItems && orderTotalsText ? (
        <Text type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
          {orderTotalsText} (số backend lưu trên đơn)
        </Text>
      ) : null}

      {showMoney ? (
        <ReviewMoney
          title="Báo giá"
          extra={
            quotation
              ? [
                  QUOTATION_STATUS_LABELS[upper(quotation.status)] || quotation.status,
                  quotation.expiredAt ? `hạn ${formatReviewDateTime(quotation.expiredAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null
          }
          lines={quotationLines}
        />
      ) : null}

      {showMoney ? <ReviewMoney title="Thanh toán" lines={paymentLines} /> : null}
    </SubmitReview>
  );
}
