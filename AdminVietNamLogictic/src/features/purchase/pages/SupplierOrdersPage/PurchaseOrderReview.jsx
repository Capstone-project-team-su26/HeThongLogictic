/**
 * Toàn bộ một đơn mua nhà cung cấp, hiện trong các hộp xác nhận của màn (gửi duyệt, duyệt /
 * từ chối, đặt NCC, cập nhật tiến độ, huỷ, hoàn tiền).
 *
 * Trước đây các hộp này chỉ có mã đơn và một câu ("Công ty sẽ chi X cho NCC") — người bấm
 * không thấy mua những gì, bao nhiêu cái, giá từng dòng, lệch bao nhiêu so với giá đã báo
 * khách. Dòng bảng `listPurchaseOrders` đã mang đủ các số đó (items[], tiền đã báo, chênh,
 * tiền tệ, tỷ giá), nên hộp hiện thẳng — không gọi thêm API, không tự tính lại số nào.
 */

import { Typography } from "antd";
import { textOr } from "@shared/utils/statusLabel";

import {
  ReviewFacts,
  ReviewItemsTable,
  ReviewMoney,
} from "@shared/components/SubmitReview/SubmitReview";

import {
  formatDateTime,
  formatSignedPercent,
  formatSignedVnd,
  formatVnd,
  getPriceDiffInfo,
} from "./SupplierOrdersPage.helpers";

const { Text } = Typography;

const ITEM_COLUMNS = [
  { title: "Sản phẩm", dataIndex: "productName", render: (value) => value || "—" },
  {
    title: "SL mua / khách đặt",
    key: "quantity",
    width: 150,
    align: "center",
    render: (_, item) => `${item.quantity} / ${item.requestedQuantity || "—"}`,
  },
  {
    title: "Đơn giá mua",
    key: "unitPrice",
    width: 170,
    align: "right",
    render: (_, item) => (
      <span>
        {formatVnd(item.unitPrice)}
        {item.unitPriceOriginal !== null && item.unitPriceOriginal !== undefined ? (
          <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
            nguyên tệ {Number(item.unitPriceOriginal).toLocaleString("vi-VN")}
          </Text>
        ) : null}
      </span>
    ),
  },
  {
    title: "Giá đã báo khách",
    dataIndex: "quotedUnitPrice",
    width: 140,
    align: "right",
    render: (value) => (value === null || value === undefined ? "—" : formatVnd(value)),
  },
  {
    title: "Chênh",
    key: "diff",
    width: 130,
    align: "right",
    render: (_, item) => {
      if (item.quotedUnitPrice === null || item.quotedUnitPrice === undefined) return "—";

      const info = getPriceDiffInfo({
        actual: item.unitPrice * item.quantity,
        quoted: item.quotedUnitPrice * item.quantity,
      });

      if (!info.hasQuote) return "—";

      return (
        <span>
          {formatSignedPercent(info.rate)}
          <Text
            type={info.direction === "over" ? "danger" : info.direction === "under" ? "success" : "secondary"}
            style={{ display: "block", fontSize: 12 }}
          >
            {formatSignedVnd(info.diff)}
          </Text>
        </span>
      );
    },
  },
  {
    title: "Thành tiền",
    dataIndex: "lineTotal",
    width: 150,
    align: "right",
    render: (value) => <Text strong>{formatVnd(value)}</Text>,
  },
];

/** Khung cuộn cho nội dung Modal.confirm — hộp dài bao nhiêu nút xác nhận vẫn nằm trong màn. */
export function PurchaseOrderReviewScroll({ children }) {
  return (
    <div style={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto", paddingRight: 4 }}>
      {children}
    </div>
  );
}

export default function PurchaseOrderReview({ order }) {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  /*
   * Chênh = tổng chi thực − tiền hàng đã báo (có dấu). KHÔNG dùng `priceDifferenceAmount`: trường
   * đó là số khách PHẢI TRẢ THÊM, backend chỉ ghi khi vượt ngưỡng, còn lại = 0 — nên mua rẻ hơn
   * giá báo trước đây vẫn hiện "0đ · 0%".
   */
  const diffInfo = getPriceDiffInfo({
    actual: order.totalAmount,
    quoted: order.quotedGoodsAmount,
    toleranceRate: order.priceToleranceRate,
  });
  const diffTone =
    !diffInfo.hasQuote || diffInfo.direction === "equal"
      ? undefined
      : diffInfo.exceeded
        ? "danger"
        : diffInfo.direction === "over"
          ? "warning"
          : "success";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "10px 0" }}>
      <ReviewFacts
        items={[
          { label: "Đơn mua", value: <Text strong>{order.purchaseOrderCode}</Text> },
          { label: "Yêu cầu mua hộ", value: order.purchaseCode },
          { label: "Khách hàng", value: order.customerName },
          { label: "Trạng thái", value: textOr(order.statusText, order.statusMeta?.label) },
          { label: "Nhà cung cấp", value: order.supplierName || "Chưa chọn" },
          { label: "Kho nhận", value: order.warehouseName || "Chưa gắn kho" },
          {
            label: "Tiền tệ · tỷ giá",
            value:
              order.currency && order.currency !== "VND"
                ? `${order.currency} · ${Number(order.exchangeRate || 0).toLocaleString("vi-VN")}`
                : order.currency || "VND",
          },
          {
            label: "Mã đơn bên NCC",
            value: order.supplierOrderCode,
            hidden: !order.supplierOrderCode,
          },
          {
            label: "Gửi duyệt lúc",
            value: formatDateTime(order.submittedAt),
            hidden: !order.submittedAt,
          },
          { label: "Ghi chú quyết định", value: order.decisionNote, hidden: !order.decisionNote },
          { label: "Ghi chú mua", value: order.purchaseNote, span: 2 },
        ]}
      />

      <ReviewItemsTable
        title="Hàng sẽ mua"
        items={items}
        columns={ITEM_COLUMNS}
        rowKey={(item, index) => item.orderItemId || item.purchaseRequestItemId || index}
        extra={`${items.length} dòng · ${quantity} sản phẩm`}
        scrollX={880}
        emptyText="Đơn mua chưa có dòng hàng."
      />

      <ReviewMoney
        title="Tiền"
        lines={[
          { label: "Tiền hàng đã báo khách", value: order.quotedGoodsAmount },
          { label: "Tổng chi thực cho NCC", value: order.totalAmount, strong: true },
          {
            label: "Chênh so với giá đã báo",
            value: diffInfo.hasQuote ? formatSignedVnd(diffInfo.diff) : "—",
            tone: diffTone,
            hint: diffInfo.hasQuote
              ? `${formatSignedPercent(diffInfo.rate)} · ${diffInfo.note}`
              : `Chưa có giá đã báo khách để so · ngưỡng cho phép ${diffInfo.tolerance}%`,
          },
          {
            label: "Khách phải trả thêm (chênh vượt ngưỡng)",
            value: order.priceDifferenceAmount,
            hidden: !(order.priceDifferenceAmount > 0),
            tone: "danger",
          },
          /*
           * Backend mới trả MỌI khoản hoàn của đơn — hiện tổng của chúng (chi tiết ở nút
           * "Khoản hoàn"). Backend cũ chỉ có một khoản → giữ dòng cũ.
           */
          {
            label: "Tổng các khoản hoàn của đơn",
            value: order.totalRefundAmount,
            hint: `${order.refunds?.length || 0} khoản · chi tiết ở nút Khoản hoàn`,
            hidden: !(order.refunds?.length > 0),
            tone: "warning",
          },
          {
            label: "Phải hoàn khách",
            value: order.refundAmount,
            hidden: !(order.refundAmount > 0) || order.refunds?.length > 0,
            tone: "warning",
          },
          {
            label: "Phí huỷ đã trừ",
            value: order.cancelFeeAmount,
            hidden: !(order.cancelFeeAmount > 0),
            hint: `${order.cancelFeeRate}% tiền hàng đã báo`,
          },
        ]}
      />
    </div>
  );
}
