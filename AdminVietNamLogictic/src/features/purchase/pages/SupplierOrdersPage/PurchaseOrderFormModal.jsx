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
  formatVnd,
  getRemainingQuantity,
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

    setLines(
      requestItems.map((item) => {
        const picked = (editingOrder?.items || []).find(
          (line) => line.purchaseRequestItemId === item.purchaseRequestItemId
        );

        const remaining = getRemainingQuantity(
          item,
          existingOrders,
          editingOrder?.purchaseOrderId || ""
        );

        return {
          purchaseRequestItemId: item.purchaseRequestItemId,
          productName: item.productName || item.name || "—",
          requestedQuantity: Number(item.quantity) || 0,
          remaining,
          quotedUnitPrice: Number(item.quotedUnitPrice ?? item.unitPrice) || 0,
          quantity: picked ? Number(picked.quantity) || 0 : remaining,
          unitPrice: picked
            ? Number(picked.unitPriceOriginal ?? picked.unitPrice) || 0
            : Number(item.unitPrice) || 0,
        };
      })
    );
  }, [open, request, editingOrder, existingOrders]);

  const linesWithVnd = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        unitPriceVnd: toVnd(line.unitPrice, currency, exchangeRate),
      })),
    [lines, currency, exchangeRate]
  );

  const tolerance = Number(editingOrder?.priceToleranceRate) || 5;

  const summary = useMemo(
    () => summarizePriceDifference(linesWithVnd, tolerance),
    [linesWithVnd, tolerance]
  );

  const chosenLines = linesWithVnd.filter((line) => line.quantity > 0);

  const overBooked = linesWithVnd.filter((line) => line.quantity > line.remaining);

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

  const disabledReason = !supplierId
    ? "Chọn nhà cung cấp"
    : !chosenLines.length
      ? "Chọn ít nhất một sản phẩm với số lượng > 0"
      : overBooked.length
        ? "Có dòng mua vượt số lượng khách đặt"
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
              Khách đặt {row.requestedQuantity} · còn mua được {row.remaining}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "SL mua",
      dataIndex: "quantity",
      width: 110,
      render: (value, row) => (
        <InputNumber
          min={0}
          max={row.remaining}
          value={value}
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
      width: 160,
      render: (value, row) => (
        <InputNumber
          min={0}
          value={value}
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
      render: (value, row) => {
        const diff = row.unitPriceVnd - value;

        return (
          <div>
            <Text>{formatVnd(value)}</Text>
            {value > 0 && Math.abs(diff) >= 1 && (
              <div>
                <Text type={diff > 0 ? "danger" : "success"} style={{ fontSize: 12 }}>
                  {diff > 0 ? "+" : ""}
                  {formatVnd(diff)}
                </Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Thành tiền",
      key: "lineTotal",
      width: 140,
      render: (_, row) => <Text strong>{formatVnd(row.unitPriceVnd * row.quantity)}</Text>,
    },
  ];

  return (
    <Modal
      open={open}
      width={980}
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
              description="Chỉ mua được phần khách đã trả trước. Một yêu cầu có thể chia cho nhiều nhà cung cấp; mỗi đơn mua sẽ sinh một đơn kho riêng."
            />

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
                    <Text>{formatVnd(summary.quoted)}</Text>
                  </div>
                  <div>
                    <Text type="secondary">Mua thực: </Text>
                    <Text strong>{formatVnd(summary.actual)}</Text>
                  </div>
                  <div>
                    <Text type="secondary">Chênh: </Text>
                    <Tag color={summary.exceeded ? "error" : summary.diff > 0 ? "warning" : "success"}>
                      {summary.diff > 0 ? "+" : ""}
                      {formatVnd(summary.diff)} ({summary.rate.toFixed(1)}%)
                    </Tag>
                  </div>
                </div>
              </Col>
            </Row>

            {summary.exceeded && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message={`Giá mua thực vượt giá đã báo ${summary.rate.toFixed(1)}% (ngưỡng ${tolerance}%)`}
                description="Gửi duyệt xong, đơn sẽ sang trạng thái chờ khách xem phần chênh. Khách đồng ý và trả xong thì Admin mới duyệt ngân sách được."
              />
            )}

            {overBooked.length > 0 && (
              <Alert
                type="error"
                showIcon
                style={{ marginTop: 12 }}
                message="Có dòng mua vượt số lượng khách đặt"
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
