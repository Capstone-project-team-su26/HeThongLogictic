/**
 * Hàng chờ tất toán — việc của Sale ngay sau khi kho chốt kiểm.
 *
 * Mở một đơn ra là thấy đủ ba thứ cần để gọi khách: khách là ai, hàng gồm những gì và kho có
 * ghi nhận lệch không. Chốt phí cuối tại đây, hệ thống phát hành mã cho khách tự trả.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  DollarOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import {
  createFinalPayment,
  createPurchaseFinalPayment,
  getOrderPayments,
  getSettlementApiError,
  getSettlementPreview,
  listAwaitingSettlement,
  SETTLEMENT_BLOCKER_HINTS,
} from "@features/settlement/api/settlementService";
import AuthNotify from "@shared/components/AuthNotify/AuthNotify";
import "./SaleSettlementPage.css";

const { Title, Text } = Typography;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const formatNumber = (value, digits = 2) => {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("vi-VN", { maximumFractionDigits: digits })
    : "—";
};

/* Điều chỉnh âm = giảm tiền cho khách → xanh; dương = thu thêm → cam. */
const signedMoney = (value) => {
  const number = Number(value) || 0;
  if (number === 0) return <Text type="secondary">0đ</Text>;
  return (
    <Text strong style={{ color: number < 0 ? "#389e0d" : "#d46b08" }}>
      {number > 0 ? "+" : ""}
      {formatMoney(number)}
    </Text>
  );
};

const PAYMENT_TYPE_LABELS = {
  DEPOSIT: "Cọc",
  FINAL: "Tất toán",
  FINAL_PAYMENT: "Tất toán",
  STORAGE_FEE: "Phí lưu kho",
  REDELIVERY_FEE: "Phí giao lại",
};

const emptyFee = () => ({ key: `${Date.now()}-${Math.round(performance.now())}`, name: "", amount: null, note: "" });

export default function SaleSettlementPage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");

  const [target, setTarget] = useState(null);
  const [fees, setFees] = useState([]);
  /* Production chỉ cấu hình SePay (chuyển khoản QR); gửi không kèm phương thức thì backend
     mặc định PayOS và trả lỗi "Chưa cấu hình payOS". */
  const [paymentMethod, setPaymentMethod] = useState("SEPAY");
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState(null);

  /* Xem trước tất toán theo cân đo VN + các khoản đã thu — chỉ đơn ký gửi có API này. */
  const [preview, setPreview] = useState(null);
  const [payments, setPayments] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      setRows(await listAwaitingSettlement());
    } catch (error) {
      setErrorMessage(getSettlementApiError(error, "Không tải được danh sách hàng chờ tất toán."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.orderCode, row.customerName, row.customerPhone, row.receiverName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, keyword]);

  const loadPreview = useCallback(async (row) => {
    setPreview(null);
    setPayments(null);
    setPreviewError("");
    if (!row || row.orderType === "PURCHASE") return;

    setPreviewLoading(true);
    const [previewResult, paymentResult] = await Promise.allSettled([
      getSettlementPreview(row.orderId),
      getOrderPayments(row.orderId),
    ]);
    if (previewResult.status === "fulfilled") setPreview(previewResult.value);
    else setPreviewError(getSettlementApiError(previewResult.reason, "Không tải được xem trước tất toán."));
    if (paymentResult.status === "fulfilled") setPayments(paymentResult.value);
    setPreviewLoading(false);
  }, []);

  const openOrder = useCallback(
    (row) => {
      setTarget(row);
      setFees([]);
      setPaymentMethod("SEPAY");
      setIssued(null);
      loadPreview(row);
    },
    [loadPreview],
  );

  const feesTotal = useMemo(
    () => fees.reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0),
    [fees],
  );

  const submit = useCallback(async () => {
    if (!target) return;

    const cleaned = fees
      .map((fee) => ({ name: fee.name.trim(), amount: Number(fee.amount) || 0, note: fee.note }))
      .filter((fee) => fee.name && fee.amount > 0);

    // Dòng phí điền dở làm số tiền chốt cho khách sai, nên chặn tại đây thay vì lặng lẽ bỏ qua.
    if (fees.length > 0 && cleaned.length !== fees.length) {
      AuthNotify.error("Phí phát sinh chưa hợp lệ", "Mỗi dòng phí phải có tên và số tiền lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    try {
      const result =
        target.orderType === "PURCHASE" && target.purchaseRequestId
          ? await createPurchaseFinalPayment(target.purchaseRequestId, cleaned, paymentMethod)
          : await createFinalPayment(target.orderId, cleaned, paymentMethod);

      setIssued(result);
      loadPreview(target);
      AuthNotify.success(
        "Đã chốt phí cuối",
        `Khách có thể tất toán ${formatMoney(result?.finalAmount ?? result?.amount)} cho đơn ${target.orderCode}.`,
      );
      load();
    } catch (error) {
      AuthNotify.error("Không chốt được phí cuối", getSettlementApiError(error, "Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  }, [target, fees, paymentMethod, load, loadPreview]);

  const columns = useMemo(
    () => [
      {
        title: "Mã đơn",
        dataIndex: "orderCode",
        width: 210,
        render: (value, row) => (
          <Space direction="vertical" size={2}>
            <Text strong>{value || "—"}</Text>
            <Tag color={row.orderType === "PURCHASE" ? "purple" : "blue"}>
              {row.orderType === "PURCHASE" ? "Mua hộ" : "Ký gửi"}
            </Tag>
          </Space>
        ),
      },
      {
        title: "Khách hàng",
        dataIndex: "customerName",
        render: (value, row) => (
          <Space direction="vertical" size={2}>
            <Text strong>{value || "—"}</Text>
            <Text type="secondary">{row.customerPhone || "Chưa có số điện thoại"}</Text>
          </Space>
        ),
      },
      {
        title: "Hàng đã về kho",
        align: "center",
        width: 150,
        render: (_, row) => (
          <Space direction="vertical" size={2}>
            <Text>{row.parcelCount} kiện</Text>
            <Text type="secondary">{Number(row.totalWeight || 0).toLocaleString("vi-VN")} kg</Text>
          </Space>
        ),
      },
      {
        title: "Kiểm đếm",
        align: "center",
        width: 150,
        render: (_, row) =>
          row.discrepancyParcelCount > 0 ? (
            <Tag color="error" icon={<WarningOutlined />}>
              {row.discrepancyParcelCount} kiện lệch
            </Tag>
          ) : (
            <Tag color="success">Khớp khai báo</Tag>
          ),
      },
      { title: "Về kho lúc", dataIndex: "arrivedAt", width: 170, render: formatDateTime },
      {
        title: "Thao tác",
        key: "actions",
        fixed: "right",
        width: 160,
        render: (_, row) => (
          <Button type="primary" icon={<DollarOutlined />} onClick={() => openOrder(row)}>
            Chốt tất toán
          </Button>
        ),
      },
    ],
    [openOrder],
  );

  return (
    <div className="sale-settlement-page">
      <div className="sale-settlement-page__head">
        <div>
          <Title level={4}>Hàng chờ tất toán</Title>
          <Text type="secondary">
            Đơn kho đã kiểm đếm xong, chờ Sale chốt phí cuối để khách tất toán.
          </Text>
        </div>

        <Space>
          <Input.Search
            allowClear
            placeholder="Tìm mã đơn, tên hoặc số điện thoại khách"
            style={{ width: 300 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Tải lại
          </Button>
        </Space>
      </div>

      {errorMessage && (
        <Alert type="error" showIcon message={errorMessage} style={{ marginBottom: 16 }} />
      )}

      <Table
        rowKey={(row) => row.orderId}
        columns={columns}
        dataSource={filtered}
        loading={loading}
        scroll={{ x: 1080 }}
        pagination={{ pageSize: 12, showSizeChanger: false }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có đơn nào chờ tất toán."
            />
          ),
        }}
      />

      <Drawer
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        width={720}
        title={`Chốt tất toán · ${target?.orderCode || ""}`}
      >
        {target && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Khách hàng">{target.customerName || "—"}</Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{target.customerPhone || "—"}</Descriptions.Item>
              <Descriptions.Item label="Loại đơn">
                {target.orderType === "PURCHASE" ? "Mua hộ" : "Ký gửi"}
              </Descriptions.Item>
              <Descriptions.Item label="Tuyến">{target.route || "—"}</Descriptions.Item>
              <Descriptions.Item label="Hàng về kho">
                {target.parcelCount} kiện · {Number(target.totalWeight || 0).toLocaleString("vi-VN")} kg
              </Descriptions.Item>
              <Descriptions.Item label="Về kho lúc">{formatDateTime(target.arrivedAt)}</Descriptions.Item>
              <Descriptions.Item label="Người nhận" span={2}>
                {target.receiverName || "—"} · {target.receiverPhone || "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao" span={2}>
                {target.receiverAddress || "—"}
              </Descriptions.Item>
            </Descriptions>

            {target.discrepancyParcelCount > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`${target.discrepancyParcelCount} kiện bị kho ghi nhận lệch`}
                description="Nên thống nhất với khách cách xử lý trước khi chốt số tiền cuối."
                action={
                  <Button
                    size="small"
                    onClick={() =>
                      navigate(
                        target.orderType === "PURCHASE" && target.purchaseRequestId
                          ? `/sale/purchase-requests/${target.purchaseRequestId}`
                          : `/sale/consignments/${target.orderId}`,
                      )
                    }
                  >
                    Xem chi tiết
                  </Button>
                }
              />
            )}

            {target.orderType !== "PURCHASE" && (
              <Spin spinning={previewLoading}>
                <Title level={5} style={{ marginTop: 4 }}>
                  Xem trước tất toán theo cân đo tại kho VN
                </Title>

                {previewError && (
                  <Alert type="error" showIcon message={previewError} style={{ marginBottom: 12 }} />
                )}

                {preview && Array.isArray(preview.blockers) && preview.blockers.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Chưa phát hành được đợt tất toán"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {preview.blockers.map((blocker) => (
                          <li key={blocker.code}>
                            {blocker.message || SETTLEMENT_BLOCKER_HINTS[blocker.code] || blocker.code}
                          </li>
                        ))}
                      </ul>
                    }
                  />
                )}

                {preview && (
                  <>
                    <Table
                      size="small"
                      rowKey="parcelId"
                      pagination={false}
                      dataSource={preview.parcels || []}
                      style={{ marginBottom: 12 }}
                      columns={[
                        {
                          title: "Kiện",
                          dataIndex: "packageCode",
                          render: (value, row) => (
                            <Space direction="vertical" size={0}>
                              <Text code>{value}</Text>
                              {row.isDisposed ? <Tag>Đã huỷ — không tính cước</Tag> : null}
                            </Space>
                          ),
                        },
                        { title: "Cân kho gốc", dataIndex: "originWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                        { title: "Cân VN", dataIndex: "vnWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                        {
                          title: "Kích thước VN (cm)",
                          key: "dims",
                          render: (_, row) =>
                            `${formatNumber(row.vnLength, 0)}×${formatNumber(row.vnWidth, 0)}×${formatNumber(row.vnHeight, 0)}`,
                        },
                        { title: "Cân quy đổi", dataIndex: "volumetricWeight", align: "right", render: (v) => `${formatNumber(v)} kg` },
                        { title: "Cân tính cước", dataIndex: "chargeableWeight", align: "right", render: (v) => <Text strong>{formatNumber(v)} kg</Text> },
                      ]}
                    />

                    <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
                      <Descriptions.Item label="Đơn giá cước (theo báo giá)">
                        {formatMoney(preview.freightRate)}/kg
                      </Descriptions.Item>
                      <Descriptions.Item label="Cân tính cước VN">
                        {formatNumber(preview.vnChargeableWeight)} kg (tối thiểu {formatNumber(preview.minimumWeight)} kg,
                        hệ số quy đổi {formatNumber(preview.volumetricDivisor, 0)})
                      </Descriptions.Item>
                      <Descriptions.Item label="Cước đã báo">{formatMoney(preview.quotedFreight)}</Descriptions.Item>
                      <Descriptions.Item label="Cước theo cân VN">{formatMoney(preview.vnFreight)}</Descriptions.Item>
                      <Descriptions.Item label="Điều chỉnh cước">{signedMoney(preview.freightAdjustment)}</Descriptions.Item>
                      <Descriptions.Item label={`Điều chỉnh VAT (${formatNumber(preview.vatRatePercent)}%)`}>
                        {signedMoney(preview.vatAdjustment)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Phí lưu kho">{formatMoney(preview.storageFee)}</Descriptions.Item>
                      <Descriptions.Item label="Hoá đơn trước điều chỉnh">
                        {formatMoney(preview.invoiceTotalBefore)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Đã cọc">{formatMoney(preview.depositPaid)}</Descriptions.Item>
                      <Descriptions.Item label="Dự kiến khách trả">
                        <Text strong>{formatMoney(preview.estimatedFinalAmount)}</Text>
                        <Text type="secondary"> (chưa gồm phí phát sinh bên dưới)</Text>
                      </Descriptions.Item>
                      {preview.adjustmentNote ? (
                        <Descriptions.Item label="Không tính lại cước" span={2}>
                          {preview.adjustmentNote}
                        </Descriptions.Item>
                      ) : null}
                    </Descriptions>
                  </>
                )}

                {payments && Array.isArray(payments.payments) && payments.payments.length > 0 && (
                  <>
                    <Text strong>Các khoản thanh toán của đơn</Text>
                    <Table
                      size="small"
                      rowKey={(row) => row.paymentId}
                      pagination={false}
                      dataSource={payments.payments}
                      style={{ margin: "8px 0 16px" }}
                      columns={[
                        {
                          title: "Loại",
                          dataIndex: "installmentType",
                          render: (v) => PAYMENT_TYPE_LABELS[String(v || "").toUpperCase()] || v || "—",
                        },
                        { title: "Số tiền", dataIndex: "amount", align: "right", render: formatMoney },
                        { title: "Phương thức", dataIndex: "paymentMethod", render: (v) => v || "—" },
                        {
                          title: "Trạng thái",
                          dataIndex: "paymentStatus",
                          render: (v) => (
                            <Tag color={String(v).toUpperCase() === "PAID" ? "success" : "default"}>{v || "—"}</Tag>
                          ),
                        },
                        { title: "Trả lúc", dataIndex: "paidAt", render: formatDateTime },
                      ]}
                    />
                  </>
                )}
              </Spin>
            )}

            <div className="sale-settlement-fees">
              <div className="sale-settlement-fees__head">
                <Text strong>Phí phát sinh cộng thêm</Text>
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setFees((current) => [...current, emptyFee()])}
                >
                  Thêm dòng
                </Button>
              </div>

              {fees.length === 0 ? (
                <Text type="secondary">
                  Không có phí phát sinh thì bấm chốt luôn — khách trả nốt phần còn lại của báo giá.
                </Text>
              ) : (
                fees.map((fee, index) => (
                  <div key={fee.key} className="sale-settlement-fees__row">
                    <Input
                      placeholder="Tên khoản phí"
                      value={fee.name}
                      onChange={(event) =>
                        setFees((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <InputNumber
                      placeholder="Số tiền"
                      min={0}
                      step={1000}
                      style={{ width: 160 }}
                      value={fee.amount}
                      formatter={(value) =>
                        value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ""
                      }
                      parser={(value) => value.replace(/\./g, "")}
                      onChange={(value) =>
                        setFees((current) =>
                          current.map((item, i) => (i === index ? { ...item, amount: value } : item)),
                        )
                      }
                    />
                    <Input
                      placeholder="Ghi chú"
                      value={fee.note}
                      onChange={(event) =>
                        setFees((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, note: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => setFees((current) => current.filter((_, i) => i !== index))}
                    />
                  </div>
                ))
              )}

              {fees.length > 0 && (
                <div className="sale-settlement-fees__total">
                  Cộng phí phát sinh: <strong>{formatMoney(feesTotal)}</strong>
                </div>
              )}
            </div>

            {issued ? (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 16 }}
                message="Đã phát hành đợt thanh toán cuối"
                description={
                  <>
                    Khách cần trả <strong>{formatMoney(issued.finalAmount ?? issued.amount)}</strong>
                    {Number(issued.freightAdjustmentDelta) ? (
                      <> (đã gồm điều chỉnh cước theo cân VN {formatMoney(issued.freightAdjustmentDelta)})</>
                    ) : null}
                    .
                    Đơn sẽ chuyển sang mục <strong>Đơn hàng cần xử lý</strong> ngay khi khách trả xong.
                  </>
                }
              />
            ) : (
              <>
              <div style={{ marginTop: 16 }}>
                <Text strong>Khách thanh toán qua</Text>
                <div style={{ marginTop: 8 }}>
                  <Segmented
                    value={paymentMethod}
                    onChange={setPaymentMethod}
                    options={[
                      { label: "Chuyển khoản SePay (QR)", value: "SEPAY" },
                      { label: "PayOS", value: "PAYOS" },
                    ]}
                  />
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                block
                icon={<DollarOutlined />}
                loading={submitting}
                disabled={Boolean(target.orderType !== "PURCHASE" && (previewLoading || (preview && !preview.canIssue)))}
                onClick={submit}
                style={{ marginTop: 16 }}
              >
                Chốt phí cuối và gửi khách tất toán
              </Button>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
