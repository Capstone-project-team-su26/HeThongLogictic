/**
 * Các mảnh HIỂN THỊ tiền hoàn mua hộ cho Sale / Admin: sổ hoàn của yêu cầu, bảng các khoản hoàn,
 * chi tiết từng dòng kèm công thức.
 *
 * Chỉ trình bày — không gọi API, không tính lại tiền. Mọi con số và câu công thức là thứ backend đã
 * chốt khi lập khoản (PURCHASE_REFUND_LINES), nên kế toán, Sale và khách luôn đọc cùng một số.
 * Dựng trên các khối của `SubmitReview` để bảng tiền trong hộp xác nhận và ngoài màn đọc giống nhau.
 */

import { Button, Space, Table, Tag, Typography } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";

import {
  ReviewFacts,
  ReviewMoney,
  ReviewSection,
} from "@shared/components/SubmitReview/SubmitReview";
import {
  formatReviewDateTime,
  formatReviewMoney,
} from "@shared/components/SubmitReview/submitReviewFormat";

import { describeImportTax } from "./purchaseRefundFormat";

const { Text } = Typography;

/* 0đ là số thật backend trả — vẫn hiện, nhưng mờ đi để mắt dừng ở cột có tiền. */
const moneyCell = (value) =>
  Number(value) ? (
    <span style={{ whiteSpace: "nowrap" }}>{formatReviewMoney(value)}</span>
  ) : (
    <Text type="secondary">0đ</Text>
  );

/* Khoản TRỪ (phí huỷ) hiện kèm dấu trừ — backend trả số dương "đã trừ". */
const deductedMoney = (value) => `− ${formatReviewMoney(value)}`;

/** Sổ tiền của cả yêu cầu: đã thu / đã hoàn / chờ hoàn / còn có thể hoàn — đọc thẳng từ API. */
export function RefundSummaryMoney({ summary, title = "Sổ tiền của yêu cầu" }) {
  if (!summary) return null;

  return (
    <ReviewMoney
      title={title}
      lines={[
        {
          label: "Tổng khách đã trả",
          hint: "trả trước + chênh giá, không gồm hoá đơn chặng VN",
          value: summary.totalCollected,
        },
        { label: "Đã chuyển trả khách", value: summary.totalRefunded, tone: "success" },
        {
          label: "Đang chờ chuyển trả",
          value: summary.totalPendingRefund,
          tone: summary.totalPendingRefund > 0 ? "warning" : undefined,
        },
        {
          label: "Còn có thể hoàn tối đa",
          hint: "server từ chối mọi khoản làm tổng hoàn vượt số đã thu",
          value: summary.refundableRemaining,
          strong: true,
        },
      ]}
    />
  );
}

/** Tổng theo thành phần của một khoản hoàn. */
export function RefundMoneyBreakdown({ refund, title = "Thành phần khoản hoàn" }) {
  if (!refund) return null;

  const taxHint = describeImportTax(refund);

  return (
    <ReviewMoney
      title={title}
      lines={[
        { label: "Tiền hàng (theo giá báo)", value: refund.goodsAmount, hidden: !refund.goodsAmount },
        {
          label: "Chênh giá",
          hint:
            refund.priceDifferenceAmount < 0
              ? "phần chênh đã hoàn trước đó — trừ ra để không hoàn hai lần"
              : "phần khách đã trả thêm / giá mua thấp hơn giá báo",
          value: refund.priceDifferenceAmount,
          hidden: !refund.priceDifferenceAmount,
        },
        { label: "Phí mua hộ", value: refund.serviceFeeAmount, hidden: !refund.serviceFeeAmount },
        { label: "VAT phần phí", value: refund.vatAmount, hidden: !refund.vatAmount },
        {
          label: "Thuế NK phần hàng không tới tay khách",
          hint: taxHint,
          value: refund.importTaxAdjustment,
          hidden: !refund.importTaxAdjustment,
        },
        {
          label: "Phí huỷ",
          hint: "giữ lại theo chính sách huỷ sau khi đã đặt NCC",
          value: deductedMoney(refund.cancelFeeAmount),
          tone: "danger",
          hidden: !refund.cancelFeeAmount,
        },
        { label: "Số tiền hoàn", value: refund.amount, strong: true },
      ]}
    />
  );
}

const LINE_COLUMNS = [
  {
    title: "Sản phẩm",
    key: "product",
    width: 230,
    render: (_, line) => (
      <Space direction="vertical" size={2}>
        <Text strong>{line.productName || "—"}</Text>
        <Tag style={{ whiteSpace: "normal" }}>{line.reasonLabel}</Tag>
        {line.purchaseOrderCode ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Đơn mua {line.purchaseOrderCode}
          </Text>
        ) : null}
      </Space>
    ),
  },
  { title: "SL", dataIndex: "quantity", width: 56, align: "center", render: (v) => v || "—" },
  { title: "Đơn giá khách trả", dataIndex: "unitPrice", width: 130, align: "right", render: moneyCell },
  { title: "Tiền hàng", dataIndex: "goodsAmount", width: 120, align: "right", render: moneyCell },
  { title: "Chênh giá", dataIndex: "priceDifferenceAmount", width: 110, align: "right", render: moneyCell },
  { title: "Phí mua hộ", dataIndex: "serviceFeeAmount", width: 110, align: "right", render: moneyCell },
  { title: "VAT phí", dataIndex: "vatAmount", width: 95, align: "right", render: moneyCell },
  {
    title: "Thuế NK",
    dataIndex: "importTaxAdjustment",
    width: 130,
    align: "right",
    render: (value, line) =>
      Number(value) ? (
        <Space direction="vertical" size={0} style={{ alignItems: "flex-end" }}>
          {moneyCell(value)}
          <Text type="secondary" style={{ fontSize: 11 }}>
            {line.importTaxInRefund ? "trả trong khoản này" : "trừ khi tất toán"}
          </Text>
        </Space>
      ) : (
        moneyCell(0)
      ),
  },
  {
    title: "Phí huỷ",
    dataIndex: "cancelFeeAmount",
    width: 100,
    align: "right",
    render: (value) => (Number(value) ? <Text type="danger">{deductedMoney(value)}</Text> : moneyCell(0)),
  },
  {
    title: "Hoàn",
    dataIndex: "amount",
    width: 120,
    align: "right",
    fixed: "right",
    render: (value) => <Text strong>{formatReviewMoney(value)}</Text>,
  },
];

/**
 * Từng dòng của khoản hoàn. Công thức nằm ngay dưới dòng (luôn mở) — đó là câu trả lời cho
 * "vì sao ra số này", không nên bắt người đọc bấm thêm mới thấy.
 */
export function RefundLinesTable({ lines = [], title = "Chi tiết từng dòng" }) {
  const list = Array.isArray(lines) ? lines : [];

  return (
    <ReviewSection title={title} extra={`${list.length} dòng`}>
      <Table
        size="small"
        pagination={false}
        rowKey={(line, index) => line.lineId || index}
        dataSource={list}
        columns={LINE_COLUMNS}
        scroll={{ x: 1200 }}
        locale={{ emptyText: "Khoản hoàn này không có dòng chi tiết." }}
        expandable={{
          /* Mở sẵn mọi dòng có công thức / ghi chú, không có nút thu gọn. */
          showExpandColumn: false,
          expandedRowKeys: list
            .map((line, index) => (line.formula || line.note ? line.lineId || index : null))
            .filter((key) => key !== null),
          expandedRowRender: (line) => (
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              {line.formula ? (
                <Text style={{ fontSize: 12 }}>
                  <Text type="secondary">Công thức: </Text>
                  {line.formula}
                </Text>
              ) : null}
              {line.note ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Ghi chú: {line.note}
                </Text>
              ) : null}
            </Space>
          ),
        }}
      />
    </ReviewSection>
  );
}

/** Toàn bộ một khoản hoàn: dữ kiện, thành phần tiền, từng dòng. */
export function RefundDetail({ refund, showFacts = true }) {
  if (!refund) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {showFacts ? (
        <ReviewFacts
          items={[
            { label: "Loại khoản", value: refund.typeLabel },
            { label: "Trạng thái", value: <Tag color={refund.statusMeta.tone}>{refund.statusMeta.label}</Tag> },
            { label: "Đơn mua", value: refund.purchaseOrderCode, hidden: !refund.purchaseOrderCode },
            { label: "Lập lúc", value: formatReviewDateTime(refund.createdAt) },
            { label: "Mã giao dịch", value: refund.transactionCode, hidden: !refund.transactionCode },
            {
              label: "Chuyển trả lúc",
              value: formatReviewDateTime(refund.refundedAt),
              hidden: !refund.refundedAt,
            },
          ]}
        />
      ) : null}

      {refund.isLegacy ? (
        <Text type="secondary">
          Khoản hoàn lập trước khi hệ thống ghi chi tiết theo sản phẩm — chỉ có tổng tiền.
        </Text>
      ) : null}

      <RefundMoneyBreakdown refund={refund} />
      {!refund.isLegacy || refund.lines.length ? <RefundLinesTable lines={refund.lines} /> : null}
    </div>
  );
}

/**
 * Bảng MỌI khoản hoàn (không chỉ khoản mới nhất). Mở một dòng để xem chi tiết + công thức.
 * `onComplete(refund)` chỉ hiện nút cho khoản đang chờ; màn cha tự quyết gọi endpoint nào.
 */
export function RefundsTable({
  refunds = [],
  canComplete = false,
  onComplete,
  busyRefundId = "",
  emptyText = "Chưa có khoản hoàn nào.",
}) {
  const list = Array.isArray(refunds) ? refunds : [];

  const columns = [
    {
      title: "Khoản hoàn",
      key: "type",
      render: (_, refund) => (
        <Space direction="vertical" size={0}>
          <Text strong>{refund.typeLabel}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {[refund.purchaseOrderCode ? `Đơn mua ${refund.purchaseOrderCode}` : "Cả yêu cầu", formatReviewDateTime(refund.createdAt)]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {/* Lý do từng dòng — một khoản "Huỷ đơn" có thể là khách huỷ hay NCC huỷ. */}
          <Space size={[4, 4]} wrap style={{ marginTop: 2 }}>
            {[...new Set(refund.lines.map((line) => line.reasonLabel))].map((label) => (
              <Tag key={label} style={{ whiteSpace: "normal" }}>
                {label}
              </Tag>
            ))}
            {refund.isLegacy ? <Tag>Khoản cũ, không có chi tiết</Tag> : null}
          </Space>
        </Space>
      ),
    },
    {
      title: "Số tiền",
      dataIndex: "amount",
      width: 140,
      align: "right",
      render: (value) => <Text strong>{formatReviewMoney(value)}</Text>,
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 200,
      render: (_, refund) => (
        <Space direction="vertical" size={0}>
          <Tag color={refund.statusMeta.tone}>{refund.statusMeta.label}</Tag>
          {refund.transactionCode ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              GD {refund.transactionCode}
            </Text>
          ) : null}
          {refund.refundedAt ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatReviewDateTime(refund.refundedAt)}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 190,
      render: (_, refund) =>
        canComplete && refund.status === "PENDING" && onComplete ? (
          <Button
            size="small"
            type="primary"
            ghost
            icon={<CheckCircleOutlined />}
            loading={busyRefundId === refund.refundId}
            onClick={() => onComplete(refund)}
          >
            Đã chuyển tiền hoàn
          </Button>
        ) : null,
    },
  ];

  return (
    <Table
      size="small"
      rowKey={(refund, index) => refund.refundId || index}
      dataSource={list}
      columns={columns}
      pagination={false}
      scroll={{ x: 760 }}
      locale={{ emptyText }}
      expandable={{
        expandedRowRender: (refund) => <RefundDetail refund={refund} showFacts={false} />,
      }}
    />
  );
}
