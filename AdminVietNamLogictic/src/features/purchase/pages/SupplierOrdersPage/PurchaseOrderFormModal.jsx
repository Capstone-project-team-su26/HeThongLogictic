/**
 * Lập / sửa ĐƠN MUA NHÀ CUNG CẤP.
 *
 * Màn này là chỗ tiền công ty bắt đầu chảy ra, nên nó phải nói thật rõ ba con số:
 * khách đã được báo bao nhiêu, mình định mua thực bao nhiêu, chênh bao nhiêu phần trăm.
 * Vượt ngưỡng (mặc định 5%) thì backend bắt khách duyệt phần chênh trước khi Admin duyệt
 * ngân sách — màn cảnh báo ngay lúc gõ để Sale không gửi duyệt rồi mới biết.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";

import {
  DEFAULT_PRICE_TOLERANCE_RATE,
  formatSignedPercent,
  formatSignedVnd,
  formatVnd,
  getClosedUnfulfilledQuantities,
  getLineAvailability,
  getPriceDiffInfo,
  summarizePriceDifference,
} from "./SupplierOrdersPage.helpers";

const { Text } = Typography;

const CURRENCIES = ["VND", "CNY", "USD", "KRW", "JPY"];

/** Quy đổi đơn giá nguyên tệ sang VND để so với giá đã báo khách. */
const toVnd = (unitPrice, currency, exchangeRate) =>
  currency === "VND" ? Number(unitPrice) || 0 : (Number(unitPrice) || 0) * (Number(exchangeRate) || 0);

export default function PurchaseOrderFormModal({
  open,
  mode = "create",
  request,
  existingOrders = [],
  refunds = [],
  toleranceRate,
  editingOrder = null,
  suppliers = [],
  warehouses = [],
  loading = false,
  submitting = false,
  onCancel,
  onSubmit,
}) {
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([]);

  /* Mở modal thì nạp lại từ đầu: sửa đơn cũ thì đổ dữ liệu đơn, lập mới thì đổ từ yêu cầu. */
  useEffect(() => {
    if (!open) return;

    setSupplierId(editingOrder?.supplierId || "");
    setWarehouseId(editingOrder?.warehouseId || request?.warehouseId || "");
    setCurrency((editingOrder?.currency || "VND").toUpperCase());
    setExchangeRate(Number(editingOrder?.exchangeRate) || 1);
    setNote(editingOrder?.purchaseNote || "");

    const requestItems = request?.items || [];
    const closedQuantities = getClosedUnfulfilledQuantities(refunds);

    setLines(
      requestItems.map((item) => {
        const picked = (editingOrder?.items || []).find(
          (line) =>
            String(line.purchaseRequestItemId).toLowerCase() ===
            String(item.purchaseRequestItemId).toLowerCase()
        );

        const availability = getLineAvailability(
          item,
          existingOrders,
          editingOrder?.purchaseOrderId || "",
          closedQuantities
        );

        /* Giá đã báo: số backend dùng khi lập đơn (dòng báo giá ACCEPTED); null = không có trong báo giá. */
        const quotedUnitPrice =
          item.quotedUnitPrice === null || item.quotedUnitPrice === undefined
            ? null
            : Number(item.quotedUnitPrice) || 0;

        return {
          purchaseRequestItemId: item.purchaseRequestItemId,
          productName: item.productName || item.name || "—",
          requestedQuantity: Number(item.quantity) || 0,
          remaining: availability.remaining,
          takenBy: availability.takenBy,
          closed: availability.closed,
          inQuotation: availability.inQuotation,
          quotedUnitPrice,
          quantity: picked ? Number(picked.quantity) || 0 : availability.remaining,
          /* Lập mới: gợi ý sẵn đơn giá = giá đã báo (VND) để Sale chỉ sửa dòng lệch. */
          unitPrice: picked
            ? Number(picked.unitPriceOriginal ?? picked.unitPrice) || 0
            : quotedUnitPrice ?? 0,
        };
      })
    );
  }, [open, request, editingOrder, existingOrders, refunds]);

  const linesWithVnd = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        unitPriceVnd: toVnd(line.unitPrice, currency, exchangeRate),
      })),
    [lines, currency, exchangeRate]
  );

  /* Ngưỡng backend trả trên mỗi đơn mua (`priceToleranceRate`); chưa có đơn nào thì mặc định 5%. */
  const tolerance = Number.isFinite(Number(toleranceRate)) && toleranceRate !== null && toleranceRate !== undefined
    ? Number(toleranceRate)
    : DEFAULT_PRICE_TOLERANCE_RATE;

  const summary = useMemo(
    () => summarizePriceDifference(linesWithVnd, tolerance),
    [linesWithVnd, tolerance]
  );

  const chosenLines = linesWithVnd.filter((line) => line.quantity > 0);

  const overBooked = linesWithVnd.filter((line) => line.quantity > line.remaining);

  const purchasableLines = linesWithVnd.filter((line) => line.remaining > 0);

  const unquotedChosen = chosenLines.filter((line) => !(line.quotedUnitPrice > 0));

  const updateLine = (id, patch) =>
    setLines((previous) =>
      previous.map((line) =>
        line.purchaseRequestItemId === id ? { ...line, ...patch } : line
      )
    );

  const handleSubmit = () =>
    onSubmit?.({
      supplierId,
      warehouseId,
      currency,
      purchaseNote: note,
      /* Chỉ gửi dòng có mua; đơn giá gửi theo NGUYÊN TỆ, backend tự quy đổi bằng tỷ giá. */
      items: chosenLines.map((line) => ({
        purchaseRequestItemId: line.purchaseRequestItemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    });

  const disabledReason = !purchasableLines.length
    ? "Yêu cầu này không còn sản phẩm nào mua được"
    : !supplierId
    ? "Chọn nhà cung cấp"
    : !chosenLines.length
      ? "Chọn ít nhất một sản phẩm với số lượng > 0"
      : overBooked.length
        ? "Có dòng mua vượt số lượng còn mua được"
        : currency !== "VND" && !(Number(exchangeRate) > 0)
          ? "Nhập tỷ giá quy đổi"
          : "";

  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "productName",
      render: (value, row) => (
        <div>
          <Text strong>{value}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Khách đặt {row.requestedQuantity}
              {row.closed > 0 ? ` · đã đóng ${row.closed}` : ""} · còn mua được {row.remaining}
            </Text>
          </div>
          {row.takenBy && (
            <Tag color="default" style={{ marginTop: 4, whiteSpace: "normal" }}>
              Đã nằm trong {row.takenBy}
            </Tag>
          )}
          {!row.inQuotation && (
            <Tag color="error" style={{ marginTop: 4 }}>
              Không có trong báo giá đã chấp nhận
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "SL mua",
      dataIndex: "quantity",
      width: 96,
      render: (value, row) => (
        <InputNumber
          min={0}
          max={row.remaining}
          value={value}
          disabled={row.remaining <= 0}
          style={{ width: "100%" }}
          onChange={(next) =>
            updateLine(row.purchaseRequestItemId, { quantity: Number(next) || 0 })
          }
        />
      ),
    },
    {
      title: `Đơn giá mua (${currency})`,
      dataIndex: "unitPrice",
      width: 150,
      render: (value, row) => (
        <InputNumber
          min={0}
          value={value}
          disabled={row.remaining <= 0}
          style={{ width: "100%" }}
          formatter={(raw) => String(raw ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
          parser={(raw) => String(raw ?? "").replace(/\./g, "")}
          onChange={(next) =>
            updateLine(row.purchaseRequestItemId, { unitPrice: Number(next) || 0 })
          }
        />
      ),
    },
    {
      title: "Giá đã báo khách",
      dataIndex: "quotedUnitPrice",
      width: 150,
      align: "right",
      render: (value, row) =>
        value === null ? (
          <Text type="secondary">—</Text>
        ) : (
          <div>
            <Text>{formatVnd(value)}</Text>
            {row.quantity > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  × {row.quantity} = {formatVnd(value * row.quantity)}
                </Text>
              </div>
            )}
          </div>
        ),
    },
    {
      title: "Thành tiền",
      key: "lineTotal",
      width: 130,
      align: "right",
      render: (_, row) => <Text strong>{formatVnd(row.unitPriceVnd * row.quantity)}</Text>,
    },
    {
      title: "Chênh",
      key: "lineDiff",
      width: 150,
      align: "right",
      render: (_, row) => {
        if (!(row.quantity > 0)) return <Text type="secondary">—</Text>;

        const info = getPriceDiffInfo({
          actual: row.unitPriceVnd * row.quantity,
          quoted: (row.quotedUnitPrice || 0) * row.quantity,
          toleranceRate: tolerance,
        });

        if (!info.hasQuote) {
          return <Tag color="default">Chưa có giá báo</Tag>;
        }

        return (
          <div>
            <Tag color={info.tone} style={{ marginInlineEnd: 0 }}>
              {formatSignedPercent(info.rate)}
            </Tag>
            <div>
              <Text style={{ fontSize: 12 }} type={info.direction === "over" ? "danger" : info.direction === "under" ? "success" : "secondary"}>
                {formatSignedVnd(info.diff)}
              </Text>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      width={1080}
      destroyOnClose
      title={mode === "edit" ? "Sửa đơn mua nhà cung cấp" : "Lập đơn mua nhà cung cấp"}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Đóng
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={submitting}
          disabled={Boolean(disabledReason)}
          title={disabledReason}
          onClick={handleSubmit}
        >
          {mode === "edit" ? "Lưu đơn mua" : "Tạo đơn mua"}
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        {!request ? (
          <Empty description="Chọn một yêu cầu mua hộ để lập đơn" />
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14 }}
              message={`Yêu cầu ${request.purchaseCode || ""} · ${request.customerName || "—"}`}
              description="Chỉ mua được phần khách đã trả trước. Một yêu cầu có thể chia cho nhiều nhà cung cấp (mỗi sản phẩm nằm trong một đơn mua); mỗi đơn mua sẽ sinh một đơn kho riêng."
            />

            {request.quotationStatus && !request.quotationAccepted && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 14 }}
                message="Báo giá mới nhất của yêu cầu chưa ở trạng thái khách chấp nhận"
                description="Giá đã báo bên dưới lấy từ báo giá mới nhất; backend lập đơn theo báo giá khách đã chấp nhận nên số cuối cùng có thể khác."
              />
            )}

            {mode === "create" && !purchasableLines.length && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 14 }}
                message="Yêu cầu này không còn sản phẩm nào mua được"
                description="Mọi sản phẩm đã nằm trong đơn mua khác còn hiệu lực hoặc đã đóng phần không mua được. Muốn đổi giá / NCC thì sửa đơn mua đang có."
              />
            )}

            <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
              <Col xs={24} md={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  NHÀ CUNG CẤP *
                </Text>
                <Select
                  showSearch
                  optionFilterProp="label"
                  value={supplierId || undefined}
                  placeholder="Chọn trong danh mục"
                  style={{ width: "100%" }}
                  onChange={setSupplierId}
                  options={suppliers.map((supplier) => ({
                    value: supplier.supplierId,
                    label: supplier.contact
                      ? `${supplier.name} — ${supplier.contact}`
                      : supplier.name,
                  }))}
                />
              </Col>

              <Col xs={24} md={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  KHO NHẬN HÀNG
                </Text>
                <Select
                  allowClear
                  value={warehouseId || undefined}
                  placeholder="Theo kho dự kiến của yêu cầu"
                  style={{ width: "100%" }}
                  onChange={(value) => setWarehouseId(value || "")}
                  options={warehouses.map((warehouse) => ({
                    value: warehouse.warehouseId,
                    label: warehouse.regionCode
                      ? `${warehouse.name} (${warehouse.regionCode})`
                      : warehouse.name,
                  }))}
                />
              </Col>

              <Col xs={12} md={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  TIỀN TỆ
                </Text>
                <Select
                  value={currency}
                  style={{ width: "100%" }}
                  onChange={setCurrency}
                  options={CURRENCIES.map((code) => ({ value: code, label: code }))}
                />
              </Col>

              <Col xs={12} md={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  TỶ GIÁ → VND
                </Text>
                <InputNumber
                  min={0}
                  value={exchangeRate}
                  disabled={currency === "VND"}
                  style={{ width: "100%" }}
                  onChange={(value) => setExchangeRate(Number(value) || 0)}
                />
              </Col>
            </Row>

            <Table
              rowKey="purchaseRequestItemId"
              size="small"
              pagination={false}
              columns={columns}
              dataSource={linesWithVnd}
            />

            <Row gutter={12} style={{ marginTop: 14 }}>
              <Col xs={24} md={16}>
                <Input.TextArea
                  rows={2}
                  value={note}
                  placeholder="Ghi chú cho đơn mua (không bắt buộc)"
                  onChange={(event) => setNote(event.target.value)}
                />
              </Col>

              <Col xs={24} md={8}>
                <div style={{ textAlign: "right" }}>
                  <div>
                    <Text type="secondary">Đã báo khách: </Text>
                    <Text>{summary.hasQuote ? formatVnd(summary.quoted) : "—"}</Text>
                  </div>
                  <div>
                    <Text type="secondary">Mua thực: </Text>
                    <Text strong>{formatVnd(summary.actual)}</Text>
                  </div>
                  <div>
                    <Text type="secondary">Chênh: </Text>
                    {summary.hasQuote ? (
                      <Tag color={summary.tone} style={{ marginInlineEnd: 0 }}>
                        {formatSignedVnd(summary.diff)} ({formatSignedPercent(summary.rate)})
                      </Tag>
                    ) : (
                      <Tag color="default" style={{ marginInlineEnd: 0 }}>—</Tag>
                    )}
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ngưỡng cho phép {tolerance}%
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>

            {chosenLines.length > 0 && !summary.hasQuote && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message="Chưa có giá đã báo khách để so"
                description="Không tính được % chênh. Kiểm tra báo giá khách đã chấp nhận của yêu cầu trước khi gửi duyệt."
              />
            )}

            {summary.hasQuote && unquotedChosen.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message="Có sản phẩm chưa có giá đã báo khách"
                description={unquotedChosen.map((line) => line.productName).join(" · ")}
              />
            )}

            {summary.exceeded && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message={`Giá mua thực vượt giá đã báo ${formatSignedPercent(summary.rate)} (ngưỡng ${tolerance}%)`}
                description="Gửi duyệt xong, đơn sẽ sang trạng thái chờ khách xem phần chênh. Khách đồng ý và trả xong thì Admin mới duyệt ngân sách được."
              />
            )}

            {summary.hasQuote && summary.direction === "under" && (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 12 }}
                message={`Mua rẻ hơn giá đã báo ${formatSignedVnd(summary.diff)} (${formatSignedPercent(summary.rate)})`}
                description="Gửi duyệt xong, hệ thống lập khoản hoàn phần chênh cho khách (từ 1.000 ₫ trở lên)."
              />
            )}

            {overBooked.length > 0 && (
              <Alert
                type="error"
                showIcon
                style={{ marginTop: 12 }}
                message="Có dòng mua vượt số lượng còn mua được"
                description={overBooked
                  .map((line) => `${line.productName}: mua ${line.quantity}, còn ${line.remaining}`)
                  .join(" · ")}
              />
            )}
          </>
        )}
      </Spin>
    </Modal>
  );
}
