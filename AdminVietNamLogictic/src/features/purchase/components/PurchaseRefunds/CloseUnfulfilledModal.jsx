/**
 * "ĐÓNG PHẦN KHÔNG MUA ĐƯỢC" — Sale / Admin lập khoản hoàn cho:
 *   ① phần chưa vào đơn mua nào (NCC hết hàng, mua ít hơn khách đặt);
 *   ② phần NCC giao thiếu trong đơn mua đã đặt.
 * POST /api/purchase-requests/{id}/close-unfulfilled → { refund, summary, requestStatus }.
 *
 * Ba bước trong một hộp: NHẬP → XEM LẠI ĐẦY ĐỦ → KẾT QUẢ.
 *   - Xem lại dùng khối dùng chung `SubmitReview`: người bấm thấy đủ sản phẩm nào, bao nhiêu, của
 *     đơn nào, lý do gì, sổ tiền hiện tại và cách server sẽ tính — trước khi một khoản tiền phải
 *     trả lại khách được lập ra (không huỷ được).
 *   - FE KHÔNG tính số tiền hoàn. Số tiền + từng dòng + công thức là thứ server trả về ở bước kết
 *     quả. Số lượng "còn chưa mua" là ƯỚC TÍNH theo đúng cách backend đếm, chỉ để chọn cho đúng.
 *
 * Bẫy hình dạng của backend: `purchaseRequestItemIds` rỗng = đóng MỌI phần còn chưa mua. Vì vậy:
 *   - "Chỉ sản phẩm chọn" bắt buộc chọn ít nhất một sản phẩm (không để rơi về "tất cả");
 *   - "Chỉ ghi NCC giao thiếu" gửi danh sách các sản phẩm KHÔNG còn phần chưa mua (backend đóng
 *     0 cái) — chỉ bật được khi có ít nhất một sản phẩm như vậy. Ước tính của FE luôn ≥ số backend
 *     đếm, nên sản phẩm FE thấy "0" thì backend cũng thấy "0".
 *
 * Màn cha nên đặt `key` mới mỗi lần mở để state nhập liệu luôn trắng.
 */

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import SubmitReview, {
  ReviewFacts,
  ReviewItemsTable,
  ReviewMoney,
  ReviewSection,
} from "@shared/components/SubmitReview/SubmitReview";
import useSubmitReviewData from "@shared/components/SubmitReview/useSubmitReviewData";
import {
  REVIEW_MODAL_PROPS,
  formatReviewMoney,
} from "@shared/components/SubmitReview/submitReviewFormat";
import {
  closeUnfulfilledPurchase,
  getPurchaseOrderApiError,
  getPurchaseRequestRefunds,
  listPurchaseOrdersOfRequest,
} from "@features/purchase/api/purchaseOrderService";
import { getPurchaseRequestDetail } from "@features/purchase/api/purchaseCatalogService";

import { estimateOpenQuantities, getRecordedShortage } from "./purchaseRefundFormat";
import { RefundDetail, RefundSummaryMoney } from "./PurchaseRefundViews";

const { Text } = Typography;

/* Khớp PurchaseOrderStatuses.Placed — chỉ đơn đã đặt NCC mới ghi được "NCC giao thiếu". */
const PLACED = new Set(["ORDERED", "SUPPLIER_CONFIRMED", "SUPPLIER_SHIPPED"]);

const SCOPE = Object.freeze({ ALL: "ALL", SELECTED: "SELECTED", NONE: "NONE" });

const shortageKey = (orderId, itemId) => `${orderId}:${itemId}`;

/** Nạp đủ dữ liệu một lần: yêu cầu (sản phẩm + báo giá), các đơn mua, sổ hoàn hiện tại. */
const loadContext = async (purchaseRequestId) => {
  const [detail, orders, refunds] = await Promise.allSettled([
    getPurchaseRequestDetail(purchaseRequestId),
    listPurchaseOrdersOfRequest(purchaseRequestId),
    getPurchaseRequestRefunds(purchaseRequestId),
  ]);

  if (detail.status === "rejected") throw detail.reason;
  if (orders.status === "rejected") throw orders.reason;

  return {
    detail: detail.value,
    orders: orders.value,
    /* Sổ hoàn không bắt buộc để nhập — thiếu thì chỉ mất phần "đã đóng trước đó" và sổ tiền. */
    summary: refunds.status === "fulfilled" ? refunds.value : null,
    summaryError:
      refunds.status === "rejected"
        ? getPurchaseOrderApiError(refunds.reason, "Không tải được sổ hoàn hiện tại.")
        : "",
  };
};

export default function CloseUnfulfilledModal({
  open,
  purchaseRequestId,
  focusOrderId = "",
  onClose,
  onDone,
}) {
  const context = useSubmitReviewData(open ? purchaseRequestId : "", () =>
    loadContext(purchaseRequestId)
  );

  const [step, setStep] = useState("form");
  const [scope, setScope] = useState(focusOrderId ? SCOPE.NONE : SCOPE.SELECTED);
  const [selectedIds, setSelectedIds] = useState([]);
  const [shortages, setShortages] = useState({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const detail = context.data?.detail || null;
  const orders = useMemo(() => context.data?.orders || [], [context.data]);
  const summary = context.data?.summary || null;
  const refunds = useMemo(() => summary?.refunds || [], [summary]);

  /* Sản phẩm của yêu cầu + ước tính phần còn chưa mua + đơn giá đã báo. */
  const itemRows = useMemo(() => {
    const items = Array.isArray(detail?.items) ? detail.items : [];
    const quotationItems = Array.isArray(detail?.quotation?.items) ? detail.quotation.items : [];
    const estimate = estimateOpenQuantities({ items, quotationItems, orders, refunds });
    const quotedUnit = new Map(
      quotationItems.map((row) => [String(row.purchaseRequestItemId), Number(row.unitPrice) || 0])
    );

    return items.map((item) => {
      const id = String(item.purchaseRequestItemId);
      return {
        ...item,
        id,
        ...(estimate.get(id) || { quoted: item.quantity, inOrders: 0, closed: 0, open: 0 }),
        quotedUnitPrice: quotedUnit.has(id) ? quotedUnit.get(id) : null,
      };
    });
  }, [detail, orders, refunds]);

  /* Đơn đã đặt NCC — đơn đang xem (từ màn đơn mua) lên đầu. */
  const placedOrders = useMemo(
    () =>
      orders
        .filter((order) => PLACED.has(String(order.status || "").toUpperCase()))
        .sort((a, b) =>
          a.purchaseOrderId === focusOrderId ? -1 : b.purchaseOrderId === focusOrderId ? 1 : 0
        ),
    [orders, focusOrderId]
  );

  const shortageRows = useMemo(
    () =>
      placedOrders.flatMap((order) =>
        order.items.map((item) => {
          const recorded = getRecordedShortage(refunds, order.purchaseOrderId, item.purchaseRequestItemId);
          const key = shortageKey(order.purchaseOrderId, item.purchaseRequestItemId);
          return {
            key,
            order,
            item,
            recorded,
            max: Math.max(0, item.quantity - recorded),
            quantity: Number(shortages[key]) || 0,
          };
        })
      ),
    [placedOrders, refunds, shortages]
  );

  const chosenShortages = shortageRows.filter((row) => row.quantity > 0);
  const zeroOpenIds = itemRows.filter((row) => row.open <= 0).map((row) => row.id);
  const openRows = itemRows.filter((row) => row.open > 0);

  /* Phần "chưa mua" sẽ đóng theo phạm vi đang chọn (để hiện ở bước xem lại). */
  const closingRows =
    scope === SCOPE.ALL
      ? openRows
      : scope === SCOPE.SELECTED
        ? itemRows.filter((row) => selectedIds.includes(row.id))
        : [];

  const problems = [
    !reason.trim() ? "Ghi lý do (khách sẽ đọc được lý do này)." : "",
    scope === SCOPE.SELECTED && selectedIds.length === 0
      ? "Chọn ít nhất một sản phẩm — bỏ trống thì hệ thống đóng MỌI phần còn chưa mua."
      : "",
    scope === SCOPE.NONE && chosenShortages.length === 0
      ? "Nhập số lượng NCC giao thiếu ở mục 2."
      : "",
    scope === SCOPE.NONE && zeroOpenIds.length === 0
      ? "Mọi sản phẩm đều còn phần chưa mua — backend hiện luôn đóng kèm phần đó, chưa ghi riêng giao thiếu được."
      : "",
    scope === SCOPE.ALL && openRows.length === 0 && chosenShortages.length === 0
      ? "Không còn phần nào chưa mua (theo ước tính) và chưa nhập NCC giao thiếu."
      : "",
  ].filter(Boolean);

  const buildPayload = () => ({
    reason: reason.trim(),
    purchaseRequestItemIds:
      scope === SCOPE.SELECTED ? selectedIds : scope === SCOPE.NONE ? zeroOpenIds : [],
    supplierShortages: chosenShortages.map((row) => ({
      purchaseOrderId: row.order.purchaseOrderId,
      purchaseRequestItemId: row.item.purchaseRequestItemId,
      quantity: row.quantity,
    })),
  });

  const submit = async () => {
    setSubmitting(true);
    try {
      const response = await closeUnfulfilledPurchase(purchaseRequestId, buildPayload());
      setResult(response);
      setStep("result");
      AuthNotify.success(
        "Đã lập khoản hoàn",
        `Chờ chuyển trả khách ${formatReviewMoney(response.refund.amount)}.`
      );
      onDone?.(response);
    } catch (error) {
      AuthNotify.error("Không lập được khoản hoàn", getPurchaseOrderApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const facts = detail
    ? [
        { label: "Yêu cầu mua hộ", value: <Text strong>{detail.purchaseCode}</Text> },
        { label: "Khách hàng", value: detail.customerName },
        { label: "Trạng thái", value: detail.statusDisplayName || detail.status },
        {
          label: "Đơn mua",
          value: orders.length
            ? orders.map((order) => `${order.purchaseOrderCode} (${order.statusMeta?.label || order.status})`).join(" · ")
            : "Chưa có đơn mua",
        },
      ]
    : [];

  const itemColumns = [
    { title: "Sản phẩm", dataIndex: "productName", render: (value) => value || "—" },
    { title: "Khách đặt", dataIndex: "quoted", width: 90, align: "center" },
    { title: "Đã vào đơn mua", dataIndex: "inOrders", width: 120, align: "center" },
    { title: "Đã đóng / hoàn", dataIndex: "closed", width: 115, align: "center" },
    {
      title: "Còn chưa mua (ước tính)",
      dataIndex: "open",
      width: 170,
      align: "center",
      render: (value) => (value > 0 ? <Text strong>{value}</Text> : <Tag>không còn</Tag>),
    },
    {
      title: "Giá đã báo",
      dataIndex: "quotedUnitPrice",
      width: 120,
      align: "right",
      render: (value) => (value === null ? "—" : formatReviewMoney(value)),
    },
  ];

  const shortageColumns = [
    {
      title: "Sản phẩm",
      key: "product",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.item.productName || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.order.purchaseOrderCode} · {row.order.supplierName || "NCC"} · {row.order.statusMeta?.label}
          </Text>
        </Space>
      ),
    },
    { title: "SL đã đặt", key: "ordered", width: 90, align: "center", render: (_, row) => row.item.quantity },
    { title: "Đã ghi thiếu", dataIndex: "recorded", width: 100, align: "center" },
    {
      title: "Đơn giá mua / đã báo",
      key: "price",
      width: 170,
      align: "right",
      render: (_, row) =>
        `${formatReviewMoney(row.item.unitPrice)} / ${
          row.item.quotedUnitPrice === null ? "—" : formatReviewMoney(row.item.quotedUnitPrice)
        }`,
    },
  ];

  const renderForm = () => (
    <>
      <ReviewFacts items={facts} />

      <Alert
        type="info"
        showIcon
        style={{ margin: "12px 0" }}
        message="Quy tắc hoàn đã chốt"
        description={
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              NCC hết hàng / mua ít hơn khách đặt / NCC giao thiếu → hoàn ĐỦ tiền hàng + phí mua hộ +
              VAT phí của phần không mua (phí chia theo tỷ lệ tiền hàng đã báo). Ship nội địa không hoàn.
            </li>
            <li>
              Thuế NK tính trên tiền hàng: phần NCC giao thiếu không thu (trừ khi tất toán đơn kho; đã
              tất toán thì trả luôn trong khoản hoàn).
            </li>
            <li>Tổng hoàn không vượt tổng khách đã trả — vượt thì server từ chối.</li>
          </ul>
        }
      />

      {context.data?.summaryError ? (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={context.data.summaryError} />
      ) : null}

      <ReviewSection title="1. Phần chưa vào đơn mua nào (NCC hết hàng / mua ít hơn khách đặt)">
        <Radio.Group
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}
        >
          <Radio value={SCOPE.SELECTED}>Chỉ đóng các sản phẩm tôi chọn trong bảng</Radio>
          <Radio value={SCOPE.ALL}>
            Đóng MỌI phần còn chưa mua ({openRows.length} sản phẩm theo ước tính)
          </Radio>
          <Radio value={SCOPE.NONE} disabled={zeroOpenIds.length === 0}>
            Không đóng phần chưa mua — chỉ ghi NCC giao thiếu ở mục 2
            {zeroOpenIds.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {" "}
                (không dùng được: sản phẩm nào cũng còn phần chưa mua)
              </Text>
            ) : null}
          </Radio>
        </Radio.Group>

        <Table
          size="small"
          pagination={false}
          rowKey="id"
          dataSource={itemRows}
          columns={itemColumns}
          scroll={{ x: 760 }}
          locale={{ emptyText: "Yêu cầu không có sản phẩm." }}
          rowSelection={
            scope === SCOPE.SELECTED
              ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys.map(String)),
                  getCheckboxProps: (row) => ({ disabled: row.open <= 0 }),
                }
              : undefined
          }
        />
      </ReviewSection>

      <div style={{ height: 12 }} />

      <ReviewSection
        title="2. NCC giao thiếu trong đơn đã đặt (không bắt buộc)"
        extra={`${placedOrders.length} đơn đã đặt NCC`}
      >
        {shortageRows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn mua nào đã đặt NCC." />
        ) : (
          <Table
            size="small"
            pagination={false}
            rowKey="key"
            dataSource={shortageRows}
            scroll={{ x: 760 }}
            columns={[
              ...shortageColumns,
              {
                title: "NCC giao thiếu thêm",
                key: "input",
                width: 150,
                render: (_, row) => (
                  <InputNumber
                    min={0}
                    max={row.max}
                    precision={0}
                    disabled={row.max === 0}
                    value={row.quantity || null}
                    placeholder={row.max === 0 ? "đã ghi đủ" : `0 – ${row.max}`}
                    onChange={(value) =>
                      setShortages((current) => ({ ...current, [row.key]: Number(value) || 0 }))
                    }
                    style={{ width: "100%" }}
                  />
                ),
              },
            ]}
          />
        )}
      </ReviewSection>

      <div style={{ marginTop: 12 }}>
        <Text strong>Lý do (bắt buộc — khách đọc được)</Text>
        <Input.TextArea
          rows={2}
          style={{ marginTop: 6 }}
          placeholder="Ví dụ: NCC chỉ còn 3/5 áo; NCC giao thiếu 1 áo trong đơn KR-123"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      {problems.length ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message="Chưa xem lại được"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          }
        />
      ) : null}
    </>
  );

  const renderReview = () => (
    <>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Gửi xong hệ thống lập ngay một khoản hoàn CHỜ CHUYỂN và báo cho khách."
        description="Số tiền do server tính theo quy tắc bên dưới và hiện ở bước sau. Phần đã đóng không lập đơn mua lại được; khoản hoàn không tự huỷ được."
      />

      <ReviewFacts
        items={[
          ...facts,
          {
            label: "Phần chưa mua",
            value:
              scope === SCOPE.ALL
                ? "Đóng MỌI phần còn chưa mua (server tự xác định số lượng)"
                : scope === SCOPE.SELECTED
                  ? `Chỉ ${selectedIds.length} sản phẩm đã chọn`
                  : "Không đóng — chỉ ghi NCC giao thiếu",
          },
          { label: "Lý do", value: reason.trim(), span: 2 },
        ]}
      />

      <div style={{ height: 12 }} />

      <ReviewItemsTable
        title="Phần chưa mua sẽ đóng"
        items={closingRows}
        rowKey="id"
        columns={itemColumns}
        extra={
          closingRows.length
            ? `${closingRows.length} sản phẩm · ${closingRows.reduce((sum, row) => sum + row.open, 0)} cái (ước tính)`
            : "Không có"
        }
        scrollX={760}
        emptyText="Không đóng phần chưa mua nào."
      />

      <div style={{ height: 12 }} />

      <ReviewItemsTable
        title="NCC giao thiếu"
        items={chosenShortages}
        rowKey="key"
        columns={[
          ...shortageColumns,
          {
            title: "SL thiếu",
            dataIndex: "quantity",
            width: 90,
            align: "center",
            render: (value) => <Text strong>{value}</Text>,
          },
        ]}
        extra={chosenShortages.length ? `${chosenShortages.length} dòng` : "Không có"}
        scrollX={760}
        emptyText="Không ghi NCC giao thiếu."
      />

      <div style={{ height: 12 }} />

      <ReviewMoney
        title="Server sẽ tính khoản hoàn thế nào"
        lines={[
          {
            label: "Phần không mua được",
            value: "tiền hàng theo giá báo + phí mua hộ (theo tỷ lệ) + VAT phí",
            hidden: closingRows.length === 0,
          },
          {
            label: "NCC giao thiếu",
            value: "tiền hàng khách đã trả cho phần thiếu + phí mua hộ + VAT phí",
            hint: "thuế NK phần thiếu: trừ khi tất toán đơn kho, hoặc trả luôn nếu đã tất toán",
            hidden: chosenShortages.length === 0,
          },
          { label: "Không hoàn", value: "ship nội địa" },
        ]}
      />

      <div style={{ height: 12 }} />
      {summary ? (
        <RefundSummaryMoney summary={summary} title="Sổ tiền hiện tại (trước khi gửi)" />
      ) : null}
    </>
  );

  const renderResult = () =>
    result ? (
      <>
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Đã lập khoản hoàn ${formatReviewMoney(result.refund.amount)} — chờ chuyển trả khách.`}
          description={
            result.requestStatus
              ? `Trạng thái yêu cầu sau khi đóng: ${result.requestStatus}${
                  result.requestStatus === "CANCELLED" ? " (không còn sản phẩm nào để mua)" : ""
                }.`
              : undefined
          }
        />
        <RefundDetail refund={result.refund} />
        <div style={{ height: 12 }} />
        <RefundSummaryMoney summary={result.summary} title="Sổ tiền sau khi lập khoản" />
      </>
    ) : null;

  const footer =
    step === "result"
      ? [
          <Button key="close" type="primary" onClick={onClose}>
            Đóng
          </Button>,
        ]
      : step === "review"
        ? [
            <Button key="back" disabled={submitting} onClick={() => setStep("form")}>
              Quay lại sửa
            </Button>,
            <Button key="submit" type="primary" danger loading={submitting} onClick={submit}>
              Gửi và lập khoản hoàn
            </Button>,
          ]
        : [
            <Button key="cancel" onClick={onClose}>
              Huỷ
            </Button>,
            <Button
              key="next"
              type="primary"
              disabled={context.loading || Boolean(context.error) || problems.length > 0}
              onClick={() => setStep("review")}
            >
              Xem lại trước khi gửi
            </Button>,
          ];

  return (
    <Modal
      {...REVIEW_MODAL_PROPS}
      open={open}
      title={
        step === "result"
          ? "Khoản hoàn vừa lập"
          : step === "review"
            ? "Xem lại trước khi đóng phần không mua được"
            : "Đóng phần không mua được / NCC giao thiếu"
      }
      footer={footer}
      onCancel={submitting ? undefined : onClose}
      maskClosable={false}
      destroyOnHidden
    >
      <SubmitReview
        loading={context.loading}
        loadingText="Đang tải sản phẩm, đơn mua và sổ hoàn của yêu cầu…"
        error={context.error}
        errorTitle="Chưa tải được yêu cầu mua hộ"
      >
        {step === "form" ? renderForm() : step === "review" ? renderReview() : renderResult()}
      </SubmitReview>
    </Modal>
  );
}
